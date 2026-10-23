import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/game-engine';
import type { Choice } from '../src/types';
import { GAME_HOURS_PER_REAL_SECOND, REAL_MINUTES_PER_DAY, formatClock, hoursUntilReview } from '../src/types';

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  describe('Stats management', () => {
    it('should initialize with correct default stats', () => {
      const state = engine.getState();
      expect(state.stats.energy).toBe(80);
      expect(state.stats.reputation).toBe(50);
      expect(state.stats.performance).toBe(50);
      expect(state.stats.burnout).toBe(0);
    });

    it('should clamp stats between 0 and 100', () => {
      engine.updateStats({ energy: 50 }); // 130 total
      let state = engine.getState();
      expect(state.stats.energy).toBe(100);

      engine.updateStats({ energy: -150 });
      state = engine.getState();
      expect(state.stats.energy).toBe(0);
    });

    it('should trigger game over at 100 burnout', () => {
      engine.updateStats({ burnout: 100 });
      const state = engine.getState();
      expect(state.isGameOver).toBe(true);
      expect(state.gameOverReason).toContain('Burnout');
    });
  });

  describe('Choices', () => {
    const testChoice: Choice = {
      id: 'test-choice',
      characterId: 'flatterer',
      title: 'Weekend Work',
      description: 'Work this weekend',
      accept: {
        immediate: { performance: 10, energy: -15 },
        delayed: { burnout: 10 },
        delayHours: 2,
      },
      decline: {
        immediate: { reputation: -5 },
      },
    };

    it('should apply immediate effects when accepting', () => {
      engine.presentChoice(testChoice);
      engine.acceptChoice();
      
      const state = engine.getState();
      expect(state.stats.performance).toBe(60);
      expect(state.stats.energy).toBe(65);
    });

    it('should schedule delayed effects', () => {
      engine.presentChoice(testChoice);
      engine.acceptChoice();
      
      let state = engine.getState();
      expect(state.pendingEffects.length).toBe(1);
      expect(state.pendingEffects[0].hoursRemaining).toBe(2);

      // Delayed effects count down in in-game hours
      engine.tickClock(1);
      state = engine.getState();
      expect(state.pendingEffects[0].hoursRemaining).toBe(1);
      expect(state.stats.burnout).toBe(0);

      engine.tickClock(1);
      state = engine.getState();
      expect(state.pendingEffects.length).toBe(0);
      expect(state.stats.burnout).toBe(10);
    });

    it('should allow one offer per character per day', () => {
      expect(engine.presentChoice(testChoice)).toBe(true);
      engine.declineChoice();
      expect(engine.presentChoice(testChoice)).toBe(false);
      expect(engine.getState().activeChoice).toBeNull();

      // another character can still make an offer
      expect(engine.presentChoice({ ...testChoice, characterId: 'mentor' })).toBe(true);
      engine.declineChoice();

      // the next morning the slot is back
      engine.tickClock(9);
      expect(engine.getState().dayNumber).toBe(2);
      expect(engine.presentChoice(testChoice)).toBe(true);
    });

    it('should apply decline effects', () => {
      engine.presentChoice(testChoice);
      engine.declineChoice();
      
      const state = engine.getState();
      expect(state.stats.reputation).toBe(45);
    });
  });

  describe('Real-time clock', () => {
    it('should make one day last 15 real minutes', () => {
      expect(REAL_MINUTES_PER_DAY).toBe(15);
      engine.tickClock(GAME_HOURS_PER_REAL_SECOND * 60 * 7.5);
      expect(engine.getState().dayTime).toBeCloseTo(9 + 4.5, 5);

      // another 7.5 minutes finishes the day and starts day 2
      engine.tickClock(GAME_HOURS_PER_REAL_SECOND * 60 * 7.5);
      const state = engine.getState();
      expect(state.dayNumber).toBe(2);
      expect(state.dayTime).toBe(9);
    });

    it('should advance the clock on every tick', () => {
      const before = engine.getState().dayTime;
      engine.tickClock(GAME_HOURS_PER_REAL_SECOND);
      expect(engine.getState().dayTime).toBeGreaterThan(before);
    });

    it('should recover energy when the day rolls over', () => {
      engine.updateStats({ energy: -40 });
      engine.tickClock(9);
      const state = engine.getState();
      expect(state.dayNumber).toBe(2);
      expect(state.stats.energy).toBe(60);
    });

    it('should not tick after game over', () => {
      engine.updateStats({ burnout: 100 });
      const before = engine.getState().dayTime;
      engine.tickClock(1);
      expect(engine.getState().dayTime).toBe(before);
    });

    it('should format the clock with minutes', () => {
      expect(formatClock(9)).toBe('9:00');
      expect(formatClock(13.5)).toBe('13:30');
      expect(formatClock(9 + 5 / 60)).toBe('9:05');
    });
  });

  describe('Time progression', () => {
    it('should advance time correctly', () => {
      engine.advanceTime(2);
      let state = engine.getState();
      expect(state.dayTime).toBe(11);

      engine.advanceTime(8);
      state = engine.getState();
      expect(state.dayTime).toBe(19);
    });

    it('should penalize overtime work', () => {
      const initialBurnout = engine.getState().stats.burnout;
      engine.advanceTime(10); // Work until 7pm (1 hour overtime)
      
      const state = engine.getState();
      expect(state.stats.burnout).toBeGreaterThan(initialBurnout);
      expect(state.stats.energy).toBeLessThan(80);
    });

    it('should start new day and recover energy', () => {
      // Drop energy first
      engine.updateStats({ energy: -40 }); // Down to 40
      const beforeSleep = engine.getState().stats.energy;
      
      // Advance to new day (adds 20 energy recovery)
      engine.advanceTime(15);
      const state = engine.getState();
      
      expect(state.dayNumber).toBe(2);
      // Should have recovered some energy despite overtime penalty
      expect(state.stats.energy).toBeGreaterThanOrEqual(beforeSleep - 10);
    });
  });

  describe('Friday review', () => {
    /** Run the clock up to Friday 17:00 one in-game hour at a time. */
    const playToReview = () => {
      for (let i = 0; i < 40 && !engine.getState().isGameOver; i++) engine.tickClock(1);
    };

    it('should fit the whole week in under an hour of real time', () => {
      const hours = hoursUntilReview(1, 9);
      expect(hours).toBe(26);
      const realMinutes = hours / GAME_HOURS_PER_REAL_SECOND / 60;
      expect(realMinutes).toBeGreaterThan(40);
      expect(realMinutes).toBeLessThan(50);
    });

    it('should not end the game when the promotion bar is crossed early', () => {
      engine.updateStats({ performance: 20, reputation: 10 });
      const state = engine.getState();
      expect(state.level).toBe('junior');
      expect(state.isGameOver).toBe(false);
    });

    it('should hold the review at 17:00 on Friday', () => {
      engine.tickClock(9); // Thursday
      engine.tickClock(9); // Friday
      expect(engine.getState().dayNumber).toBe(3);
      engine.tickClock(7.5);
      expect(engine.getState().isGameOver).toBe(false);
      engine.tickClock(0.5);
      const state = engine.getState();
      expect(state.isGameOver).toBe(true);
      expect(state.dayTime).toBe(17);
    });

    it('should promote when both stats meet the bar', () => {
      engine.updateStats({ performance: 20, reputation: 10 });
      playToReview();
      const state = engine.getState();
      expect(state.outcome).toBe('promoted');
      expect(state.level).toBe('mid');
    });

    it('should keep you on when only one stat meets the bar', () => {
      engine.updateStats({ performance: 25 });
      playToReview();
      const state = engine.getState();
      expect(state.outcome).toBe('kept');
      expect(state.gameOverReason).toContain('Reputation');
    });

    it('should put you on an improvement plan when neither stat meets the bar', () => {
      playToReview();
      expect(engine.getState().outcome).toBe('pip');
    });

    it('should land every pending consequence before scoring', () => {
      engine.updateStats({ performance: 20, reputation: 10 });
      engine.tickClock(9);
      engine.tickClock(9);
      engine.tickClock(7); // Friday 16:00
      engine.presentChoice({
        id: 'gossip', characterId: 'gossip', title: 'Gossip', description: '',
        accept: { immediate: {}, delayed: { reputation: -5 }, delayHours: 4 },
        decline: { immediate: {} },
      });
      engine.acceptChoice();
      engine.tickClock(1);
      const state = engine.getState();
      expect(state.stats.reputation).toBe(55);
      expect(state.outcome).toBe('kept');
    });

    it('should still end early on burnout', () => {
      engine.updateStats({ burnout: 100 });
      expect(engine.getState().outcome).toBe('burnout');
    });
  });

  describe('Inventory', () => {
    it('should collect items and apply effects', () => {
      const item = {
        id: 'test-item',
        name: 'Test Item',
        description: 'A test item',
        position: [0, 0, 0] as [number, number, number],
        effects: { energy: 10, burnout: -5 },
        collected: false,
      };

      engine.collectItem(item);
      const state = engine.getState();
      
      expect(state.inventory.length).toBe(1);
      expect(state.inventory[0].id).toBe('test-item');
      expect(state.stats.energy).toBe(90);
    });

    it('should not collect same item twice', () => {
      const item = {
        id: 'test-item',
        name: 'Test Item',
        description: 'A test item',
        position: [0, 0, 0] as [number, number, number],
        effects: { energy: 10 },
        collected: false,
      };

      engine.collectItem(item);
      engine.collectItem(item);
      
      const state = engine.getState();
      expect(state.inventory.length).toBe(1);
    });
  });

  describe('Memory', () => {
    it('should store and retrieve character memories', () => {
      engine.addMemory('flatterer', 'Accepted weekend work');
      engine.addMemory('flatterer', 'Declined late night');
      
      const summary = engine.getMemorySummary('flatterer');
      expect(summary).toContain('Accepted weekend work');
      expect(summary).toContain('Declined late night');
    });

    it('should limit memories to last 5', () => {
      for (let i = 0; i < 10; i++) {
        engine.addMemory('test', `Memory ${i}`);
      }
      
      const summary = engine.getMemorySummary('test');
      expect(summary).toContain('Memory 9');
      expect(summary).not.toContain('Memory 0');
    });
  });
});
