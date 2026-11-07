import type { GameStats, GameState, Choice, InventoryItem, ReviewOutcome } from './types';
import { INITIAL_STATS, PROMOTION_THRESHOLD, WORK_HOURS, REVIEW_DAY, REVIEW_HOUR } from './types';

/** True when the stats would earn a promotion if the review happened now. */
export function meetsPromotionBar(stats: GameStats): boolean {
  return stats.performance >= PROMOTION_THRESHOLD.junior.performance &&
    stats.reputation >= PROMOTION_THRESHOLD.junior.reputation;
}

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
      offeredToday: [],
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
    if (this.state.stats.burnout >= 100 && !this.state.isGameOver) {
      this.endGame('Burnout. You pushed too hard. Remember: sustainable pace beats heroic sprints.', 'burnout');
      return;
    }

    // Promotion is decided at the Friday review, not the moment the bar is crossed
    this.notify();
  }

  advanceTime(hours: number = 1) {
    this.state.dayTime += hours;
    this.tickPendingEffects(hours);
    if (this.isReviewTime()) {
      this.holdReview();
      return;
    }

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
    this.tickPendingEffects(hours);
    if (this.state.isGameOver) return;
    if (this.isReviewTime()) {
      this.holdReview();
      return;
    }
    if (this.state.dayTime >= WORK_HOURS.end) {
      this.startNewDay();
    }
    this.notify();
  }

  private startNewDay() {
    this.state.dayTime = WORK_HOURS.start;
    this.state.dayNumber++;
    this.state.offeredToday = [];

    // Morning energy recovery
    this.updateStats({ energy: 20 });
  }

  /** Count delayed effects down by in-game hours and apply the ones that are due. */
  private tickPendingEffects(hours: number) {
    const due: GameState['pendingEffects'] = [];
    const stillPending: GameState['pendingEffects'] = [];
    for (const effect of this.state.pendingEffects) {
      effect.hoursRemaining -= hours;
      (effect.hoursRemaining <= 0 ? due : stillPending).push(effect);
    }
    this.state.pendingEffects = stillPending;
    for (const effect of due) this.updateStats(effect.stats);
  }

  private isReviewTime(): boolean {
    return this.state.dayNumber >= REVIEW_DAY && this.state.dayTime >= REVIEW_HOUR;
  }

  /** Friday 17:00: every consequence still pending lands, then the boss scores the week. */
  private holdReview() {
    this.state.dayTime = REVIEW_HOUR;
    const pending = this.state.pendingEffects;
    this.state.pendingEffects = [];
    for (const effect of pending) this.updateStats(effect.stats);
    if (this.state.isGameOver) return;

    const { performance, reputation } = this.state.stats;
    const bar = PROMOTION_THRESHOLD.junior;
    if (meetsPromotionBar(this.state.stats)) {
      this.state.level = 'mid';
      this.state.characterMemories.set('promotion_happened', ['true']);
      this.endGame('Promoted to Mid-Level. You learned to spot manipulation, set boundaries, and protect your energy. Well done.', 'promoted');
    } else if (performance >= bar.performance || reputation >= bar.reputation) {
      const missing = performance >= bar.performance
        ? `Reputation ${Math.round(reputation)}/${bar.reputation}: good work, but people didn't see it.`
        : `Performance ${Math.round(performance)}/${bar.performance}: people like you, but the work didn't land.`;
      this.endGame(`Kept on as Junior. ${missing} Try again next cycle.`, 'kept');
    } else {
      this.endGame(`Put on an improvement plan. Performance ${Math.round(performance)}/${bar.performance}, Reputation ${Math.round(reputation)}/${bar.reputation}. Choose your yeses more carefully.`, 'pip');
    }
  }

  /**
   * Show an offer. Each character gets one offer per day, so returns false
   * (and shows nothing) if this character already made one today.
   */
  presentChoice(choice: Choice): boolean {
    if (this.state.isGameOver || this.state.activeChoice) return false;
    if (this.state.offeredToday.includes(choice.characterId)) return false;
    this.state.offeredToday = [...this.state.offeredToday, choice.characterId];
    this.state.activeChoice = choice;
    this.notify();
    return true;
  }

  hasOfferedToday(characterId: string): boolean {
    return this.state.offeredToday.includes(characterId);
  }

  acceptChoice() {
    if (!this.state.activeChoice) return;

    const choice = this.state.activeChoice;
    this.updateStats(choice.accept.immediate);

    // Schedule delayed effects
    if (choice.accept.delayed) {
      this.state.pendingEffects.push({
        stats: choice.accept.delayed,
        hoursRemaining: choice.accept.delayHours || 3,
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

  private endGame(reason: string, outcome: ReviewOutcome) {
    this.state.isGameOver = true;
    this.state.gameOverReason = reason;
    this.state.outcome = outcome;
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
      offeredToday: [],
    };
    this.notify();
  }
}
