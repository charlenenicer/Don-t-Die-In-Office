import type { GameStats, GameState, Choice, InventoryItem, Character } from './types';
import { INITIAL_STATS, PROMOTION_THRESHOLD, WORK_HOURS } from './types';

export class GameEngine {
  private state: GameState;
  private listeners: Set<(state: GameState) => void> = new Set();

  constructor() {
    this.state = {
      stats: { ...INITIAL_STATS },
      inventory: [],
      dayTime: WORK_HOURS.start,
      dayNumber: 1,
      level: 'junior',
      isGameOver: false,
      activeChoice: null,
      characterMemories: new Map(),
      pendingEffects: [],
    };
  }

  getState(): GameState {
    return { ...this.state };
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  updateStats(changes: Partial<GameStats>) {
    let newStats = { ...this.state.stats };
    
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        newStats[key as keyof GameStats] = Math.max(0, Math.min(100, 
          newStats[key as keyof GameStats] + value
        ));
      }
    }

    this.state.stats = newStats;

    // Check burnout
    if (this.state.stats.burnout >= 100) {
      this.endGame('Burnout. You pushed too hard. Remember: sustainable pace beats heroic sprints.');
      return;
    }

    // Check promotion
    this.checkPromotion();
    this.notify();
  }

  private checkPromotion() {
    const { stats, level } = this.state;
    
    if (level === 'junior' && 
        stats.performance >= PROMOTION_THRESHOLD.junior.performance &&
        stats.reputation >= PROMOTION_THRESHOLD.junior.reputation) {
      this.state.level = 'mid';
      this.updateStats({ reputation: 10 });
      
      // Mark characters as post-promotion for behavior changes
      this.state.characterMemories.set('promotion_happened', ['true']);
      
      setTimeout(() => {
        this.endGame('Promoted to Mid-Level. You learned to spot manipulation, set boundaries, and protect your energy. Well done.');
      }, 2000);
    }
  }

  advanceTime(hours: number = 1) {
    this.state.dayTime += hours;

    // Working late costs energy and increases burnout
    if (this.state.dayTime > WORK_HOURS.end) {
      const overtimeHours = this.state.dayTime - WORK_HOURS.end;
      this.updateStats({ 
        energy: -5 * overtimeHours, 
        burnout: 3 * overtimeHours 
      });
    }

    // New day
    if (this.state.dayTime >= 24) {
      this.startNewDay();
    }

    this.notify();
  }

  /**
   * Real-time clock tick. Moves the clock forward and, when the workday ends
   * at the end of WORK_HOURS, rolls over to the next morning.
   */
  tickClock(hours: number) {
    if (this.state.isGameOver) return;
    this.state.dayTime += hours;
    if (this.state.dayTime >= WORK_HOURS.end) {
      this.startNewDay();
    }
    this.notify();
  }

  private startNewDay() {
    this.state.dayTime = WORK_HOURS.start;
    this.state.dayNumber++;

    // Morning energy recovery
    this.updateStats({ energy: 20 });

    // Process pending delayed effects
    this.processPendingEffects();
  }

  private processPendingEffects() {
    const stillPending = [];
    
    for (const effect of this.state.pendingEffects) {
      effect.turnsRemaining--;
      if (effect.turnsRemaining <= 0) {
        this.updateStats(effect.stats);
      } else {
        stillPending.push(effect);
      }
    }
    
    this.state.pendingEffects = stillPending;
  }

  presentChoice(choice: Choice) {
    this.state.activeChoice = choice;
    this.notify();
  }

  acceptChoice() {
    if (!this.state.activeChoice) return;

    const choice = this.state.activeChoice;
    this.updateStats(choice.accept.immediate);

    // Schedule delayed effects
    if (choice.accept.delayed) {
      this.state.pendingEffects.push({
        stats: choice.accept.delayed,
        turnsRemaining: choice.accept.delayTurns || 3,
      });
    }

    // Add to character memory
    this.addMemory(choice.characterId, `Accepted: ${choice.title}`);
    
    this.state.activeChoice = null;
    this.notify();
  }

  declineChoice() {
    if (!this.state.activeChoice) return;

    const choice = this.state.activeChoice;
    this.updateStats(choice.decline.immediate);
    
    this.addMemory(choice.characterId, `Declined: ${choice.title}`);
    
    this.state.activeChoice = null;
    this.notify();
  }

  collectItem(item: InventoryItem) {
    const existing = this.state.inventory.find(i => i.id === item.id);
    if (existing || item.collected) return;

    item.collected = true;
    this.state.inventory.push(item);
    this.updateStats(item.effects);
    this.notify();
  }

  addMemory(characterId: string, memory: string) {
    const memories = this.state.characterMemories.get(characterId) || [];
    memories.push(memory);
    // Keep last 5 memories per character
    if (memories.length > 5) memories.shift();
    this.state.characterMemories.set(characterId, memories);
  }

  getMemorySummary(characterId: string): string {
    const memories = this.state.characterMemories.get(characterId) || [];
    return memories.join('. ');
  }

  wasPromoted(): boolean {
    return this.state.characterMemories.has('promotion_happened');
  }

  private endGame(reason: string) {
    this.state.isGameOver = true;
    this.state.gameOverReason = reason;
    this.notify();
  }

  reset() {
    this.state = {
      stats: { ...INITIAL_STATS },
      inventory: [],
      dayTime: WORK_HOURS.start,
      dayNumber: 1,
      level: 'junior',
      isGameOver: false,
      activeChoice: null,
      characterMemories: new Map(),
      pendingEffects: [],
    };
    this.notify();
  }
}
