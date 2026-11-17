/**
 * Isometric camera maths and screen-aligned movement, kept free of the renderer
 * so it can be unit-tested.
 *
 * The camera looks down at ISO_PITCH_DEG from the south-east (ISO_YAW_DEG), like
 * Interview Quest's streets: the back row of offices is at the top of the screen
 * and the reception desk at the bottom.
 */

export const ISO_PITCH_DEG = 35;
export const ISO_YAW_DEG = 45;
/** How far the camera sits from its target. Orthographic, so this only affects clipping. */
export const ISO_DISTANCE = 70;
/** World units visible vertically at zoom 1. */
export const VIEW_HEIGHT = 24;
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.4;
export const ZOOM_DEFAULT = 1.3;
/** Multiplicative step for one wheel notch or one +/- key press. */
export const ZOOM_STEP = 1.12;

const rad = (deg: number) => (deg * Math.PI) / 180;

export type Vec3 = [number, number, number];

/** Offset from the follow target to the camera. */
export function isoOffset(pitchDeg = ISO_PITCH_DEG, yawDeg = ISO_YAW_DEG, distance = ISO_DISTANCE): Vec3 {
  const p = rad(pitchDeg);
  const y = rad(yawDeg);
  return [Math.cos(p) * Math.sin(y) * distance, Math.sin(p) * distance, Math.cos(p) * Math.cos(y) * distance];
}

/** Ground-plane unit vectors for "up the screen" and "right on the screen". */
export function screenAxes(yawDeg = ISO_YAW_DEG): { up: [number, number]; right: [number, number] } {
  const y = rad(yawDeg);
  return {
    up: [-Math.sin(y), -Math.cos(y)],
    right: [Math.cos(y), -Math.sin(y)],
  };
}

export interface MoveInput { up: boolean; down: boolean; left: boolean; right: boolean }

/** Which screen directions are held, from lower-cased `KeyboardEvent.key` values (WASD and arrows). */
export function inputFromKeys(keys: ReadonlySet<string>): MoveInput {
  return {
    up: keys.has('w') || keys.has('arrowup'),
    down: keys.has('s') || keys.has('arrowdown'),
    left: keys.has('a') || keys.has('arrowleft'),
    right: keys.has('d') || keys.has('arrowright'),
  };
}

/**
 * World-space (x, z) walking direction for the held keys, so W/up always walks
 * up the screen whatever the camera yaw. Length 1, or 0 when nothing (or two
 * opposite keys) is held.
 */
export function screenMove(input: MoveInput, yawDeg = ISO_YAW_DEG): { x: number; z: number } {
  const sy = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const sx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (sx === 0 && sy === 0) return { x: 0, z: 0 };
  const { up, right } = screenAxes(yawDeg);
  const x = up[0] * sy + right[0] * sx;
  const z = up[1] * sy + right[1] * sx;
  const len = Math.hypot(x, z);
  return { x: x / len, z: z / len };
}

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return ZOOM_DEFAULT;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

/** Zoom after a wheel event (negative deltaY zooms in) or a key press (+1 in, -1 out). */
export function zoomBy(zoom: number, direction: number): number {
  if (direction === 0) return clampZoom(zoom);
  return clampZoom(direction > 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP);
}

/** Orthographic frustum half-extents for a viewport aspect ratio and zoom. */
export function frustum(aspect: number, zoom: number, viewHeight = VIEW_HEIGHT) {
  const halfH = viewHeight / 2 / clampZoom(zoom);
  const halfW = halfH * (aspect > 0 ? aspect : 1);
  return { left: -halfW, right: halfW, top: halfH, bottom: -halfH };
}

/** How much of the remaining distance the camera closes this frame; snaps under reduced motion. */
export function followFactor(delta: number, reducedMotion: boolean, rate = 6): number {
  if (reducedMotion) return 1;
  return Math.min(1, Math.max(0, delta) * rate);
}

/** World units covered by one screen pixel, for resolution-independent outline thresholds. */
export function worldPerPixel(viewportHeightPx: number, zoom: number, viewHeight = VIEW_HEIGHT): number {
  return viewHeight / clampZoom(zoom) / Math.max(1, viewportHeightPx);
}
