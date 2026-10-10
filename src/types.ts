export interface GameStats {
  energy: number;
  reputation: number;
  performance: number;
  burnout: number;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  archetype: 'flatterer' | 'jealous' | 'overconfident' | 'burnout' | 'mentor' | 'gossip';
  agentId?: string;
  position: [number, number, number];
  color: string;
  description: string;
  wasPromoted?: boolean;
  /** sits in a chair at their post instead of standing */
  sitting?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  position: [number, number, number];
  effects: Partial<GameStats>;
  collected: boolean;
}

export interface Choice {
  id: string;
  characterId: string;
  title: string;
  description: string;
  accept: {
    immediate: Partial<GameStats>;
    delayed?: Partial<GameStats>;
    delayTurns?: number;
  };
  decline: {
    immediate: Partial<GameStats>;
  };
}

export interface GameState {
  stats: GameStats;
  inventory: InventoryItem[];
  dayTime: number; // 9-18 (9am-6pm)
  dayNumber: number;
  level: 'junior' | 'mid' | 'senior';
  isGameOver: boolean;
  gameOverReason?: string;
  activeChoice: Choice | null;
  characterMemories: Map<string, string[]>;
  pendingEffects: Array<{
    stats: Partial<GameStats>;
    turnsRemaining: number;
  }>;
}

export interface VoiceCallState {
  active: boolean;
  characterId: string | null;
  callId: string | null;
}

export interface Offer {
  title: string;
  description: string;
  workload: number;
  intent: string;
}

export const INITIAL_STATS: GameStats = {
  energy: 80,
  reputation: 50,
  performance: 50,
  burnout: 0,
};

export const PROMOTION_THRESHOLD = {
  junior: { performance: 70, reputation: 60 },
  mid: { performance: 85, reputation: 75 },
};

export const WORK_HOURS = {
  start: 9,
  end: 18,
};

/** One in-game day (9:00 to 18:00) takes this many real minutes. */
export const REAL_MINUTES_PER_DAY = 30;
export const GAME_HOURS_PER_REAL_SECOND =
  (WORK_HOURS.end - WORK_HOURS.start) / (REAL_MINUTES_PER_DAY * 60);

/** Format an in-game time (fractional hours) as H:MM. */
export function formatClock(dayTime: number): string {
  const totalMinutes = Math.floor(dayTime * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
