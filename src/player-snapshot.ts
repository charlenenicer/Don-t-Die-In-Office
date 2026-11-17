import type { GameState } from './types';
import { DAY_NAMES, PROMOTION_THRESHOLD, WORK_HOURS, hoursUntilReview } from './types';

/**
 * What check_player tells a coworker about the player: the numbers, and a
 * speakable summary in words (the agents never read digits out).
 */
export interface PlayerSnapshot {
  energy: number;
  /** burnout, named the way coworkers talk about it */
  stress: number;
  reputation: number;
  performance: number;
  hoursWorkedToday: number;
  hoursUntilReview: number;
  day: string;
  level: GameState['level'];
  onTrackForPromotion: boolean;
  promoted: boolean;
  summary: string;
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0..100 as words: "forty-five", "a hundred". */
export function numberWords(n: number): string {
  const v = Math.max(0, Math.min(100, Math.round(n)));
  if (v === 100) return 'a hundred';
  if (v < 20) return ONES[v];
  const t = TENS[Math.floor(v / 10)];
  return v % 10 ? `${t}-${ONES[v % 10]}` : t;
}

/** "about forty" for a stat, rounded to the nearest five. */
export function about(n: number): string {
  return `about ${numberWords(Math.round(n / 5) * 5)}`;
}

function band(v: number, low: number, high: number): 'low' | 'okay' | 'high' {
  return v < low ? 'low' : v > high ? 'high' : 'okay';
}

export function describePlayer(s: Omit<PlayerSnapshot, 'summary'>): string {
  const parts = [
    `Energy is ${band(s.energy, 40, 75)}, ${about(s.energy)} out of a hundred`,
    `stress is ${band(s.stress, 25, 60)}, ${about(s.stress)}`,
    `reputation is ${band(s.reputation, 40, 65)} and performance is ${band(s.performance, 45, 70)}`,
  ];
  const hours = s.hoursWorkedToday < 1 ? 'They only just got in today' : `They've worked ${numberWords(Math.floor(s.hoursWorkedToday))} ${Math.floor(s.hoursWorkedToday) === 1 ? 'hour' : 'hours'} today`;
  const review = s.hoursUntilReview < 1 ? 'the review is any minute now' : `the review is ${numberWords(Math.ceil(s.hoursUntilReview))} work hours away`;
  const track = s.promoted ? 'They were promoted this week.' : s.onTrackForPromotion ? 'They\'re on track for a promotion.' : 'They\'re not on track for a promotion yet.';
  return `${parts.join(', ')}. ${hours}, and ${review}. It's ${s.day}. ${track}`;
}

export function playerSnapshot(state: GameState, promoted: boolean): PlayerSnapshot {
  const bar = state.level === 'mid' ? PROMOTION_THRESHOLD.mid : PROMOTION_THRESHOLD.junior;
  const base = {
    energy: Math.round(state.stats.energy),
    stress: Math.round(state.stats.burnout),
    reputation: Math.round(state.stats.reputation),
    performance: Math.round(state.stats.performance),
    hoursWorkedToday: Math.max(0, Math.round((state.dayTime - WORK_HOURS.start) * 10) / 10),
    hoursUntilReview: Math.round(hoursUntilReview(state.dayNumber, state.dayTime) * 10) / 10,
    day: DAY_NAMES[state.dayNumber - 1] ?? DAY_NAMES[DAY_NAMES.length - 1],
    level: state.level,
    onTrackForPromotion: state.stats.performance >= bar.performance && state.stats.reputation >= bar.reputation,
    promoted,
  };
  return { ...base, summary: describePlayer(base) };
}

/** Used when no game has reported in yet (e.g. a call placed from the provider's console). */
export const UNKNOWN_PLAYER: PlayerSnapshot = {
  energy: 80, stress: 0, reputation: 50, performance: 50, hoursWorkedToday: 0, hoursUntilReview: 26,
  day: DAY_NAMES[0], level: 'junior', onTrackForPromotion: false, promoted: false,
  summary: 'Nothing unusual about them yet. Assume they\'re new this week and doing okay.',
};
