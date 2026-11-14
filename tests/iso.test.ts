import { describe, expect, it } from 'vitest';
import {
  ISO_PITCH_DEG, ISO_YAW_DEG, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN,
  clampZoom, followFactor, frustum, inputFromKeys, isoOffset, screenAxes, screenMove, worldPerPixel, zoomBy,
} from '../src/iso';

const keys = (...k: string[]) => inputFromKeys(new Set(k));
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('isometric camera', () => {
  it('looks down at ~35 degrees from the south-east (45 degree yaw)', () => {
    expect(ISO_PITCH_DEG).toBe(35);
    expect(ISO_YAW_DEG).toBe(45);
    const [x, y, z] = isoOffset();
    expect(x).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
    close(x, z);
    close((Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI, 35);
  });

  it('keeps the requested distance', () => {
    const [x, y, z] = isoOffset(35, 45, 50);
    close(Math.hypot(x, y, z), 50);
  });

  it('builds an orthographic frustum that matches the aspect ratio and shrinks as you zoom in', () => {
    const f1 = frustum(16 / 9, 1);
    close((f1.right - f1.left) / (f1.top - f1.bottom), 16 / 9);
    const f2 = frustum(16 / 9, 2);
    close(f2.top, f1.top / 2);
    expect(frustum(0, 1).right).toBeGreaterThan(0); // a zero-height viewport doesn't produce NaN
  });

  it('clamps zoom and steps it multiplicatively', () => {
    expect(clampZoom(100)).toBe(ZOOM_MAX);
    expect(clampZoom(0)).toBe(ZOOM_MIN);
    expect(clampZoom(Number.NaN)).toBe(ZOOM_DEFAULT);
    expect(zoomBy(1, 1)).toBeGreaterThan(1);
    expect(zoomBy(1, -1)).toBeLessThan(1);
    close(zoomBy(zoomBy(1, 1), -1), 1);
    expect(zoomBy(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(zoomBy(1.3, 0)).toBe(1.3);
  });

  it('snaps the follow camera under prefers-reduced-motion, and eases otherwise', () => {
    expect(followFactor(0.016, true)).toBe(1);
    const k = followFactor(0.016, false);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(1);
    expect(followFactor(5, false)).toBe(1);
  });

  it('reports world units per pixel so outlines keep their width when zooming', () => {
    expect(worldPerPixel(800, 2)).toBeCloseTo(worldPerPixel(800, 1) / 2);
  });
});

describe('screen-aligned movement (WASD and arrows)', () => {
  it('maps W and the up arrow to "up the screen": away from the camera, towards -x -z', () => {
    for (const k of ['w', 'arrowup']) {
      const m = screenMove(keys(k));
      close(m.x, -Math.SQRT1_2);
      close(m.z, -Math.SQRT1_2);
    }
  });

  it('maps S/down, A/left and D/right to the other screen directions', () => {
    const s = screenMove(keys('s'));
    close(s.x, Math.SQRT1_2);
    close(s.z, Math.SQRT1_2);
    const d = screenMove(keys('arrowright'));
    close(d.x, Math.SQRT1_2);
    close(d.z, -Math.SQRT1_2);
    const a = screenMove(keys('a'));
    close(a.x, -Math.SQRT1_2);
    close(a.z, Math.SQRT1_2);
  });

  it('screen right is perpendicular to screen up and points right of the camera view', () => {
    const { up, right } = screenAxes();
    close(up[0] * right[0] + up[1] * right[1], 0);
    // right = forward x worldUp, i.e. (-forward.z, forward.x) on the ground plane
    close(right[0], -up[1]);
    close(right[1], up[0]);
  });

  it('normalises diagonals so they are not faster', () => {
    const m = screenMove(keys('w', 'd'));
    close(Math.hypot(m.x, m.z), 1);
    // up + right on screen is straight along -z in the world
    close(m.x, 0);
    close(m.z, -1);
  });

  it('cancels opposite keys and returns no movement when idle', () => {
    expect(screenMove(keys('w', 's'))).toEqual({ x: 0, z: 0 });
    expect(screenMove(keys())).toEqual({ x: 0, z: 0 });
    expect(screenMove(keys('e', ' '))).toEqual({ x: 0, z: 0 });
  });

  it('follows the camera yaw, so a different yaw would still keep W pointing up the screen', () => {
    const m = screenMove(keys('w'), 0);
    close(m.x, 0);
    close(m.z, -1);
  });
});
