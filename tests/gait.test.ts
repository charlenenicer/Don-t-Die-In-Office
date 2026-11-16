import { describe, expect, it } from 'vitest';
import { advanceGait, angleDelta, createGait, gaitPose, MAX_TURN_SPEED, STRIDE_LENGTH, turnToward } from '../src/gait';

const DT = 1 / 60;
const walkFor = (seconds: number, speed: number, s = createGait()) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) s = advanceGait(s, speed * DT, DT);
  return s;
};

describe('walk cycle', () => {
  it('advances the stride phase with distance travelled, not time', () => {
    // the same 3 units walked slowly or quickly give the same phase
    const slow = walkFor(1.5, 2);
    const fast = walkFor(0.6, 5);
    expect(slow.phase).toBeCloseTo((3 / STRIDE_LENGTH) * Math.PI * 2, 1);
    expect(fast.phase).toBeCloseTo(slow.phase, 1);
  });

  it('does not advance when blocked (no distance), even while time passes', () => {
    let s = walkFor(0.5, 5);
    const before = s.phase;
    s = advanceGait(s, 0, DT);
    expect(Math.abs(s.phase - before)).toBeLessThan(0.5);
    expect(s.walk).toBeLessThan(1);
  });

  it('eases into walking instead of popping', () => {
    const s1 = advanceGait(createGait(), 5 * DT, DT);
    expect(s1.walk).toBeGreaterThan(0);
    expect(s1.walk).toBeLessThan(0.3);
    expect(walkFor(1, 5).walk).toBeGreaterThan(0.99);
  });

  it('settles to rest (feet together, limbs straight) after stopping', () => {
    let s = walkFor(0.73, 5);
    for (let i = 0; i < 120; i++) s = advanceGait(s, 0, DT);
    expect(s.walk).toBe(0);
    expect(Math.abs(Math.sin(s.phase))).toBeLessThan(1e-3);
    const pose = gaitPose(s, 0);
    for (const k of ['legL', 'legR', 'armL', 'armR', 'bob', 'lean', 'roll', 'twist'] as const) expect(Math.abs(pose[k])).toBeLessThan(1e-3);
  });

  it('swings legs alternately and each arm opposite its own leg', () => {
    const s = { phase: Math.PI / 2, walk: 1 };
    const p = gaitPose(s, 0);
    expect(p.legL).toBeGreaterThan(0.3);
    expect(p.legR).toBeCloseTo(-p.legL);
    expect(Math.sign(p.armL)).toBe(-Math.sign(p.legL));
    expect(Math.sign(p.armR)).toBe(-Math.sign(p.legR));
  });

  it('bobs twice per stride and leans forward while walking', () => {
    const at = (phase: number) => gaitPose({ phase, walk: 1 }, 0);
    expect(at(0).bob).toBeGreaterThan(at(Math.PI / 2).bob);
    expect(at(Math.PI).bob).toBeCloseTo(at(0).bob);
    expect(at(1).lean).toBeGreaterThan(0.05);
    expect(gaitPose({ phase: 1, walk: 0 }, 0).lean).toBe(0);
  });

  it('breathes subtly when idle, and not at all with reduced motion', () => {
    const idle = [0, 0.4, 0.8, 1.2].map((t) => gaitPose(createGait(), t).breath);
    expect(Math.max(...idle) - Math.min(...idle)).toBeGreaterThan(0.005);
    expect(Math.max(...idle.map(Math.abs))).toBeLessThan(0.02);
    expect(gaitPose(createGait(), 0.4, true).breath).toBe(0);
    expect(gaitPose(createGait(), 0.4, true).armSway).toBe(0);
  });

  it('tones the bob and sway down under reduced motion', () => {
    const s = { phase: 0, walk: 1 };
    expect(gaitPose(s, 0, true).bob).toBeLessThan(gaitPose(s, 0).bob * 0.5);
    expect(Math.abs(gaitPose({ phase: 1, walk: 1 }, 0, true).roll)).toBeLessThan(Math.abs(gaitPose({ phase: 1, walk: 1 }, 0).roll));
  });
});

describe('turning', () => {
  it('takes the short way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(turnToward(3, -3, DT)).toBeGreaterThan(3);
  });

  it('turns smoothly over several frames, never in one snap', () => {
    let h = 0;
    const target = Math.PI; // full reversal
    const steps: number[] = [];
    for (let i = 0; i < 60; i++) {
      const next = turnToward(h, target, DT);
      steps.push(Math.abs(next - h));
      h = next;
    }
    expect(Math.max(...steps)).toBeLessThanOrEqual(MAX_TURN_SPEED * DT + 1e-9);
    expect(steps[0]).toBeLessThan(0.3);
    expect(Math.abs(angleDelta(h, target))).toBeLessThan(0.02);
  });

  it('turns no matter the frame rate', () => {
    let a = 0, b = 0;
    for (let i = 0; i < 30; i++) a = turnToward(a, 1.5, 1 / 30);
    for (let i = 0; i < 120; i++) b = turnToward(b, 1.5, 1 / 120);
    expect(a).toBeCloseTo(b, 1);
  });
});
