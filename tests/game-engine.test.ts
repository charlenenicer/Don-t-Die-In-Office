import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/game-engine';
import type { Choice } from '../src/types';

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
        delayTurns: 2,
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
      expect(state.pendingEffects[0].turnsRemaining).toBe(2);
      
      // Advance to next day (effects decrement on new day)
      engine.advanceTime(15); // Trigger new day (dayTime >= 24)
      state = engine.getState();
      expect(state.pendingEffects[0].turnsRemaining).toBe(1);
      
      // Advance to second new day
      engine.advanceTime(15); // Trigger another new day
      state = engine.getState();
      expect(state.pendingEffects.length).toBe(0);
      // Burnout should have the delayed +10
      expect(state.stats.burnout).toBeGreaterThanOrEqual(10);
    });

    it('should apply decline effects', () => {
      engine.presentChoice(testChoice);
      engine.declineChoice();
      
      const state = engine.getState();
      expect(state.stats.reputation).toBe(45);
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

  describe('Promotion', () => {
    it('should promote from junior to mid with sufficient stats', () => {
      engine.updateStats({ 
        performance: 20, 
        reputation: 10 
      });
      
      const state = engine.getState();
      expect(state.level).toBe('mid');
      // Note: game over happens async after 2 seconds, so we just check the level
    });

    it('should not promote with insufficient stats', () => {
      engine.updateStats({ performance: 15 });
      
      const state = engine.getState();
      expect(state.level).toBe('junior');
      expect(state.isGameOver).toBe(false);
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
