import type { GameStats } from './types';

export type ActivityId = 'foosball' | 'pingpong' | 'darts' | 'snacks' | 'drinks';

export interface ActivityRule {
  /** what the hint says, e.g. "play table football" */
  action: string;
  /** shown in the toast when it finishes */
  title: string;
  /** real seconds the activity plays for */
  duration: number;
  /** in-game hours it costs */
  hours: number;
  effects: Partial<GameStats>;
}

/** Games lower burnout; food and drink restore energy. Everything costs a little time. */
export const ACTIVITY_RULES: Record<ActivityId, ActivityRule> = {
  foosball: { action: 'play table football', title: 'Table football break', duration: 5, hours: 0.5, effects: { burnout: -8, energy: 4, performance: -2 } },
  pingpong: { action: 'play ping-pong', title: 'Ping-pong rally', duration: 5, hours: 0.5, effects: { burnout: -10, energy: -3, reputation: 2 } },
  darts: { action: 'throw darts', title: 'Darts', duration: 3.8, hours: 0.25, effects: { burnout: -5 } },
  snacks: { action: 'grab a snack', title: 'Snack break', duration: 3, hours: 1 / 6, effects: { energy: 8, burnout: -2 } },
  drinks: { action: 'grab a drink', title: 'Cold drink', duration: 3.4, hours: 1 / 12, effects: { energy: 5 } },
};

/** Each activity can be done once per in-game hour. */
export const COOLDOWN_HOURS = 1;

/** Absolute in-game time in hours, so cooldowns survive the day rolling over. */
export function absoluteHours(dayNumber: number, dayTime: number): number {
  return dayNumber * 24 + dayTime;
}

/** Whole in-game minutes left before an activity can be done again (0 = ready). */
export function cooldownMinutesLeft(readyAt: number | undefined, now: number): number {
  if (readyAt === undefined || now >= readyAt) return 0;
  return Math.ceil((readyAt - now) * 60);
}

const LABELS: Record<keyof GameStats, string> = {
  energy: 'Energy',
  reputation: 'Reputation',
  performance: 'Performance',
  burnout: 'Burnout',
};

/** "Burnout −8 · Energy +4 · 30 min" */
export function describeEffects(effects: Partial<GameStats>, hours: number): string {
  const parts = (Object.entries(effects) as [keyof GameStats, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => `${LABELS[k]} ${v > 0 ? '+' : '−'}${Math.abs(v)}`);
  parts.push(`${Math.round(hours * 60)} min`);
  return parts.join(' · ');
}

/** Darts: distance from the bullseye (board radius 0.42) to points. */
export function dartPoints(distance: number): number {
  if (distance < 0.07) return 50;
  if (distance < 0.17) return 20;
  if (distance < 0.26) return 10;
  if (distance < 0.36) return 5;
  return 0;
}
