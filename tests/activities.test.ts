import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_RULES, COOLDOWN_HOURS, absoluteHours, cooldownMinutesLeft, dartPoints, describeEffects,
} from '../src/activities';

describe('Fun zone activities', () => {
  it('games lower burnout and food or drink restores energy', () => {
    for (const id of ['foosball', 'pingpong', 'darts'] as const) {
      expect(ACTIVITY_RULES[id].effects.burnout).toBeLessThan(0);
    }
    for (const id of ['snacks', 'drinks'] as const) {
      expect(ACTIVITY_RULES[id].effects.energy).toBeGreaterThan(0);
    }
  });

  it('every activity costs some game time and plays for a few seconds', () => {
    for (const rule of Object.values(ACTIVITY_RULES)) {
      expect(rule.hours).toBeGreaterThan(0);
      expect(rule.duration).toBeGreaterThanOrEqual(2);
      expect(rule.duration).toBeLessThanOrEqual(6);
    }
  });

  it('tracks cooldowns in game minutes across days', () => {
    const now = absoluteHours(1, 10);
    const readyAt = now + COOLDOWN_HOURS;
    expect(cooldownMinutesLeft(readyAt, now)).toBe(60);
    expect(cooldownMinutesLeft(readyAt, now + 0.5)).toBe(30);
    expect(cooldownMinutesLeft(readyAt, readyAt)).toBe(0);
    expect(cooldownMinutesLeft(undefined, now)).toBe(0);
    // the next morning is always past an hour-long cooldown from the evening before
    expect(cooldownMinutesLeft(absoluteHours(1, 17.9) + COOLDOWN_HOURS, absoluteHours(2, 9))).toBe(0);
  });

  it('describes effects for the toast', () => {
    expect(describeEffects({ burnout: -8, energy: 4, performance: -2 }, 0.5)).toBe('Burnout −8 · Energy +4 · Performance −2 · 30 min');
    expect(describeEffects({ energy: 5 }, 1 / 12)).toBe('Energy +5 · 5 min');
  });

  it('scores darts by distance from the bullseye', () => {
    expect(dartPoints(0.02)).toBe(50);
    expect(dartPoints(0.1)).toBe(20);
    expect(dartPoints(0.2)).toBe(10);
    expect(dartPoints(0.3)).toBe(5);
    expect(dartPoints(0.5)).toBe(0);
  });
});
