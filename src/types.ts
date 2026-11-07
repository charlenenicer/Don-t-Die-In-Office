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
    /** in-game hours before the delayed effect lands */
    delayHours?: number;
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
  /** how the run ended; set together with isGameOver */
  outcome?: ReviewOutcome;
  /** characters who have already made an offer today (one each per day) */
  offeredToday: string[];
  activeChoice: Choice | null;
  characterMemories: Map<string, string[]>;
  pendingEffects: Array<{
    stats: Partial<GameStats>;
    /** in-game hours until it lands; anything still pending lands at the review */
    hoursRemaining: number;
  }>;
}

export type ReviewOutcome = 'promoted' | 'kept' | 'pip' | 'burnout';

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

/**
 * Review Week: the run covers Wednesday to Friday and ends with a performance
 * review on the last day, so a full game takes about 45 real minutes.
 */
export const DAY_NAMES = ['Wednesday', 'Thursday', 'Friday'];
export const REVIEW_DAY = DAY_NAMES.length;
export const REVIEW_HOUR = 17;

/** One in-game day (9:00 to 18:00) takes this many real minutes. */
export const REAL_MINUTES_PER_DAY = 15;
export const GAME_HOURS_PER_REAL_SECOND =
  (WORK_HOURS.end - WORK_HOURS.start) / (REAL_MINUTES_PER_DAY * 60);

/** Format an in-game time (fractional hours) as H:MM. */
export function formatClock(dayTime: number): string {
  const totalMinutes = Math.floor(dayTime * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/** In-game work hours left before the review starts. */
export function hoursUntilReview(dayNumber: number, dayTime: number): number {
  const workday = WORK_HOURS.end - WORK_HOURS.start;
  return Math.max(0, (REVIEW_DAY - dayNumber) * workday + REVIEW_HOUR - dayTime);
}
