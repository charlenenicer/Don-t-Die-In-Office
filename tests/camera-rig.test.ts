import { describe, expect, it } from 'vitest';
import { framingFor, isPerspective, nearestArea, ORIGINAL_CAMERA, originalCameraTarget, originalEase, roomCenter, zoomable } from '../src/camera-rig';
import { inputFromKeys, screenMove } from '../src/iso';
import { OCCLUSION_HEIGHTS, OCCLUSION_LATERALS } from '../src/occlusion';
import { AREA_LABELS } from '../src/hud';
import { VARIANT } from '../src/variant';

const room = { id: 'manager', minX: -8.5, maxX: 8.5, minZ: -25.2, maxZ: -13 };
const v = { pitchDeg: 35 };

describe('camera framing per mode', () => {
  it('iso-follow always centres on the player and eases', () => {
    const f = framingFor('iso-follow', v, { x: 3, z: -4 }, room, AREA_LABELS);
    expect(f.target[0]).toBe(3);
    expect(f.target[2]).toBe(-4);
    expect(f.snap).toBe(false);
    expect(f.zoomFactor).toBe(1);
  });

  it('room-snap cuts to the room centre inside a room, and to the nearest area outside', () => {
    const inRoom = framingFor('room-snap', v, { x: 3, z: -20 }, room, AREA_LABELS);
    expect(inRoom.snap).toBe(true);
    expect([inRoom.target[0], inRoom.target[2]]).toEqual(roomCenter(room));
    const outside = framingFor('room-snap', v, { x: 0.5, z: 17 }, null, AREA_LABELS);
    const a = nearestArea(AREA_LABELS, 0.5, 17)!;
    expect(a.name).toBe('Reception');
    expect([outside.target[0], outside.target[2]]).toEqual([a.x, a.z]);
  });

  it('tilted-zoom zooms in inside rooms only', () => {
    expect(framingFor('tilted-zoom', v, { x: 0, z: -20 }, room, AREA_LABELS).zoomFactor).toBeGreaterThan(1);
    expect(framingFor('tilted-zoom', v, { x: 0, z: 0 }, null, AREA_LABELS).zoomFactor).toBe(1);
  });

  it('follow-rooms follows the player outside and glides up to frame a room inside', () => {
    const out = framingFor('follow-rooms', v, { x: 1, z: 2 }, null, AREA_LABELS);
    expect(out.target[0]).toBe(1);
    const inside = framingFor('follow-rooms', v, { x: 1, z: -20 }, room, AREA_LABELS);
    expect(inside.pitchDeg).toBeGreaterThan(35);
    expect(inside.snap).toBe(false);
  });

  it('shoulder keeps the player in the middle at chest height', () => {
    const f = framingFor('shoulder', v, { x: 2, z: 2 }, null, AREA_LABELS);
    expect(f.target).toEqual([2, 1.3, 2]);
  });

  it('only the follow-rooms and shoulder modes are perspective', () => {
    expect(isPerspective('follow-rooms')).toBe(true);
    expect(isPerspective('shoulder')).toBe(true);
    expect(isPerspective('iso-follow')).toBe(false);
    expect(isPerspective('room-snap')).toBe(false);
    expect(isPerspective('tilted-zoom')).toBe(false);
  });
});

describe('active variant', () => {
  it('is main\'s original camera with the painted style', () => {
    expect(VARIANT.camera).toBe('original');
    expect(isPerspective(VARIANT.camera)).toBe(true);
    expect(zoomable(VARIANT.camera)).toBe(false);
    expect(VARIANT.style.ramp.length).toBeGreaterThanOrEqual(2);
    expect([...VARIANT.style.ramp].sort((a, b) => a - b)).toEqual(VARIANT.style.ramp);
    expect(VARIANT.style.pixelScale).toBeGreaterThan(0);
    expect(VARIANT.style.pixelScale).toBeLessThanOrEqual(1);
    expect(VARIANT.style.saturationKeep).toBeLessThanOrEqual(1);
  });
});

/** main's game.ts, verbatim: world-axis WASD, normalised */
function mainMove(keys: Set<string>): { x: number; z: number } {
  let x = 0, z = 0;
  if (keys.has('w') || keys.has('arrowup')) z -= 1;
  if (keys.has('s') || keys.has('arrowdown')) z += 1;
  if (keys.has('a') || keys.has('arrowleft')) x -= 1;
  if (keys.has('d') || keys.has('arrowright')) x += 1;
  const l = Math.hypot(x, z);
  return l ? { x: x / l, z: z / l } : { x: 0, z: 0 };
}

describe('main\'s original camera', () => {
  it('starts where main\'s did, with main\'s lens', () => {
    expect(ORIGINAL_CAMERA.start).toEqual([0, 5.5, 23.5]);
    expect(ORIGINAL_CAMERA.fov).toBe(60);
    expect(ORIGINAL_CAMERA.near).toBe(0.5);
    // the player spawns at (0, 16.4): main's start position is exactly its target there
    expect(originalCameraTarget({ x: 0, z: 16.4 })).toEqual([0, 5.5, 23.5]);
  });

  it('sits 9.5 behind the player in the middle of the floor', () => {
    expect(originalCameraTarget({ x: 4, z: -10 })).toEqual([4, 5.5, -0.5]);
  });

  it('stays inside the front wall until that would be closer than 5', () => {
    expect(originalCameraTarget({ x: 0, z: 17 })[2]).toBe(23.5);
    expect(originalCameraTarget({ x: 0, z: 21 })[2]).toBe(26);
  });

  it('keeps a little in from the side walls', () => {
    expect(originalCameraTarget({ x: 24, z: 0 })[0]).toBe(22.5);
    expect(originalCameraTarget({ x: -24, z: 0 })[0]).toBe(-22.5);
  });

  it('eases like main (min(1, delta * 5)) and snaps under reduced motion', () => {
    expect(originalEase(0.1, false)).toBeCloseTo(0.5);
    expect(originalEase(0.5, false)).toBe(1);
    expect(originalEase(0.016, true)).toBe(1);
  });

  it('maps every key combination exactly like main (W walks north, away from the camera)', () => {
    const names = ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'];
    for (let mask = 0; mask < 1 << names.length; mask++) {
      const keys = new Set(names.filter((_, i) => mask & (1 << i)));
      const want = mainMove(keys);
      const got = screenMove(inputFromKeys(keys), VARIANT.yawDeg);
      expect(got.x).toBeCloseTo(want.x, 9);
      expect(got.z).toBeCloseTo(want.z, 9);
    }
  });

  it('checks head, chest and feet for walls in front of the player, including main\'s chest row', () => {
    expect(OCCLUSION_HEIGHTS).toContain(1.2);
    expect(Math.min(...OCCLUSION_HEIGHTS)).toBeLessThan(0.5);
    expect(Math.max(...OCCLUSION_HEIGHTS)).toBeGreaterThan(1.7);
    expect([...OCCLUSION_LATERALS]).toEqual([-0.7, 0, 0.7]);
  });
});
