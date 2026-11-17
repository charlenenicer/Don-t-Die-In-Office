/**
 * Walk cycle maths, kept free of Three.js so it can be tested. The stride phase
 * advances with distance actually travelled (after collisions), not with time,
 * so feet keep pace with the ground at any speed and stop when a wall stops you.
 */

/** World units covered by one full cycle (two steps). Legs are ~0.66 long. */
export const STRIDE_LENGTH = 1.5;
/** How quickly the walk pose blends in and out (per second). */
export const WALK_BLEND_RATE = 7;
/** Heading smoothing rate (per second) and the fastest turn allowed (rad/s). */
export const TURN_RATE = 10;
export const MAX_TURN_SPEED = 9;

export interface GaitState {
  /** stride phase in radians; legs are together (at rest) at multiples of π */
  phase: number;
  /** 0 = standing, 1 = full stride */
  walk: number;
}

export function createGait(): GaitState {
  return { phase: 0, walk: 0 };
}

const TAU = Math.PI * 2;

/** Shortest signed angle from a to b, in (-π, π]. */
export function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * Ease a heading toward a target along the shorter way round: exponential
 * smoothing, capped at MAX_TURN_SPEED so a reversal reads as a turn, not a snap.
 */
export function turnToward(current: number, target: number, delta: number, rate = TURN_RATE, maxSpeed = MAX_TURN_SPEED): number {
  const d = angleDelta(current, target);
  const k = 1 - Math.exp(-rate * Math.max(0, delta));
  const step = Math.sign(d) * Math.min(Math.abs(d * k), maxSpeed * Math.max(0, delta));
  return current + step;
}

/**
 * One frame of the walk cycle. `distance` is how far the character really moved
 * this frame. While moving the phase advances with distance; once stopped it
 * settles to the nearest rest point (feet together) as the pose blends out.
 */
export function advanceGait(s: GaitState, distance: number, delta: number, reducedMotion = false): GaitState {
  const moving = distance > 1e-4;
  const k = reducedMotion ? 1 : 1 - Math.exp(-WALK_BLEND_RATE * Math.max(0, delta));
  const walk = s.walk + ((moving ? 1 : 0) - s.walk) * k;
  let phase = s.phase;
  if (moving) {
    phase += (distance / STRIDE_LENGTH) * TAU;
  } else {
    const rest = Math.round(phase / Math.PI) * Math.PI;
    phase += (rest - phase) * k;
  }
  // keep the number small without disturbing the cycle (period 2π)
  if (phase > TAU * 64) phase -= TAU * 64;
  return { phase, walk: walk < 1e-3 ? 0 : walk };
}

export interface GaitPose {
  /** walk blend, 0..1 */
  walk: number;
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** body lift, world units */
  bob: number;
  /** forward lean, radians (about x) */
  lean: number;
  /** side-to-side roll, radians (about z) */
  roll: number;
  /** hip twist, radians (about y) */
  twist: number;
  /** breathing: chest scale offset and arm sway */
  breath: number;
  armSway: number;
}

/** Limb angles and body motion for a gait state; `t` (seconds) only drives idle breathing. */
export function gaitPose(s: GaitState, t: number, reducedMotion = false): GaitPose {
  const w = s.walk;
  const swing = Math.sin(s.phase);
  const legs = 0.62 * swing * w;
  const motion = reducedMotion ? 0.3 : 1;
  const idle = 1 - w;
  const breathe = reducedMotion ? 0 : Math.sin(t * 2.1);
  return {
    walk: w,
    legL: legs,
    legR: -legs,
    // arms swing opposite their own side's leg
    armL: -legs * 0.85,
    armR: legs * 0.85,
    // up at mid-stance twice a cycle: highest when the legs pass each other
    bob: 0.045 * w * motion * (1 + Math.cos(2 * s.phase)) * 0.5,
    lean: 0.09 * w * (reducedMotion ? 0.5 : 1),
    roll: 0.035 * swing * w * motion,
    twist: 0.08 * swing * w * motion,
    breath: 0.012 * breathe * idle,
    armSway: 0.025 * breathe * idle,
  };
}
