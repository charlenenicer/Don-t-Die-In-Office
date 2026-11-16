import { describe, expect, it } from 'vitest';
import { framingFor, isPerspective, nearestArea, roomCenter } from '../src/camera-rig';
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
  it('has a sane camera and style', () => {
    expect(VARIANT.pitchDeg).toBeGreaterThan(10);
    expect(VARIANT.pitchDeg).toBeLessThan(80);
    expect(VARIANT.style.ramp.length).toBeGreaterThanOrEqual(2);
    expect([...VARIANT.style.ramp].sort((a, b) => a - b)).toEqual(VARIANT.style.ramp);
    expect(VARIANT.style.pixelScale).toBeGreaterThan(0);
    expect(VARIANT.style.pixelScale).toBeLessThanOrEqual(1);
    expect(VARIANT.style.saturationKeep).toBeLessThanOrEqual(1);
  });
});
