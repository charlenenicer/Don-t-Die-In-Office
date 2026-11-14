import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HIDE_ABOVE, NEAR_WALL_CUT, PARTITION_CUT, applyCutaway, cutSpan, wallKind } from '../src/cutaway';

function wall(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const bounds = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

describe('wall classification', () => {
  it('keeps the far north and west outer walls, cuts the near ones and partitions', () => {
    expect(wallKind({ x: -26, z: -25.4 }, { x: 26, z: -24.6 })).toBe('far');
    expect(wallKind({ x: -25.4, z: -26 }, { x: -24.6, z: 26 })).toBe('far');
    expect(wallKind({ x: -26, z: 24.6 }, { x: 26, z: 25.4 })).toBe('near-outer');
    expect(wallKind({ x: 24.6, z: -26 }, { x: 25.4, z: 26 })).toBe('near-outer');
    expect(wallKind({ x: -24.5, z: -13.1 }, { x: -8.5, z: -12.9 })).toBe('partition');
  });

  it('cuts spans at the cut height and hides ones entirely above it', () => {
    expect(cutSpan(0, 7, 1.5)).toEqual({ minY: 0, maxY: 1.5 });
    expect(cutSpan(0, 1, 1.5)).toEqual({ minY: 0, maxY: 1 });
    expect(cutSpan(3.2, 7, 1.5)).toBeNull();
  });
});

describe('applyCutaway', () => {
  it('lowers partitions, keeps far walls, hides the ceiling and exterior scenery', () => {
    const world = new THREE.Group();
    const partition = wall(world, 16, 7, 0.25, -16.5, 3.5, -13);
    const header = wall(world, 3, 3.8, 0.25, -15.5, 5.1, -13);
    const far = wall(world, 52, 7, 0.7, 0, 3.5, -25);
    const near = wall(world, 52, 7, 0.7, 0, 3.5, 25);
    const painting = wall(world, 2, 1.4, 0.05, 0, 0, 0);
    partition.attach(painting);
    painting.position.set(0, 0, 0.2); // on the partition, centred at 3.5 m
    const ceiling = wall(world, 52, 0.3, 52, 0, 7.15, 0);
    const desk = wall(world, 2, 0.8, 1, 0, 0.4, 0);
    const lamp = wall(world, 0.6, 0.4, 0.6, 0, 6.2, 10);
    const farArt = wall(world, 2, 1.2, 0.05, 0, 4.4, -24.6);
    const city = new THREE.Group();
    wall(city, 10, 40, 10, -80, 20, 0);
    wall(city, 10, 40, 10, 80, 20, 0);
    world.add(city);
    const room = new THREE.Group();
    room.userData.interior = true;
    const bookcase = wall(room, 3, 2.6, 0.5, 11, 1.3, -24.5);
    const sign = wall(room, 3, 0.6, 0.1, 11, 6, -14);
    world.add(room);

    applyCutaway(world, [partition, header, far, near]);

    expect(bounds(partition).max.y).toBeCloseTo(PARTITION_CUT, 5);
    expect(bounds(partition).min.y).toBeCloseTo(0, 5);
    expect(header.visible).toBe(false);
    expect(bounds(far).max.y).toBeCloseTo(7, 5);
    expect(bounds(near).max.y).toBeCloseTo(NEAR_WALL_CUT, 5);
    expect(painting.visible).toBe(false);
    expect(painting.parent).toBe(world); // lifted off before the wall was squashed
    expect(ceiling.visible).toBe(false);
    expect(lamp.visible).toBe(false);
    expect(desk.visible).toBe(true);
    expect(farArt.visible).toBe(true); // art high on a far wall stays
    expect(city.visible).toBe(false);
    expect(bookcase.visible).toBe(true);
    expect(sign.visible).toBe(false);
    expect(HIDE_ABOVE).toBeGreaterThan(PARTITION_CUT);
  });
});
