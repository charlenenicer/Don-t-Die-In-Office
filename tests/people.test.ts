import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/characters';
import { createGait, gaitPose } from '../src/gait';
import { HAIR_MAX_MESHES, PLAYER_LOOK, animateCharacter, createCharacter, hairShellGeometry, lookForCharacter } from '../src/people';
import type { PersonLook } from '../src/people';

const looks: PersonLook[] = [PLAYER_LOOK, ...CHARACTERS.map((c) => lookForCharacter(c.id))];
const hairOf = (look: PersonLook) => createCharacter(look).head.getObjectByName('hair')!;
const meshes = (o: THREE.Object3D) => { const out: THREE.Mesh[] = []; o.traverse((m) => { if (m instanceof THREE.Mesh) out.push(m); }); return out; };

describe('hair', () => {
  it('is a few smooth shapes per character, not a bunch of spheres', () => {
    for (const look of looks) {
      const n = meshes(hairOf(look)).length;
      expect(n, look.hairStyle).toBeGreaterThanOrEqual(1);
      expect(n, look.hairStyle).toBeLessThanOrEqual(HAIR_MAX_MESHES);
    }
  });

  it('keeps every character\'s hair colour', () => {
    for (const look of looks) {
      const colours = meshes(hairOf(look)).map((m) => `#${(m.material as THREE.MeshStandardMaterial).color.getHexString()}`);
      expect(colours, look.hairStyle).toContain(look.hair.toLowerCase());
    }
  });

  it('keeps silhouettes distinct between styles', () => {
    const boxes = new Map(looks.map((l) => {
      const h = hairOf(l);
      h.updateMatrixWorld(true);
      return [l.hairStyle, new THREE.Box3().setFromObject(h)] as const;
    }));
    const size = (k: string) => boxes.get(k as never)!.getSize(new THREE.Vector3());
    // long styles fall below the chin; the bun and ponytail reach out behind
    expect(boxes.get('wavy')!.min.y).toBeLessThan(boxes.get('bob')!.min.y);
    expect(boxes.get('bob')!.min.y).toBeLessThan(boxes.get('short')!.min.y);
    expect(boxes.get('bun')!.min.z).toBeLessThan(boxes.get('short')!.min.z - 0.05);
    expect(boxes.get('ponytail')!.min.y).toBeLessThan(boxes.get('short')!.min.y);
    expect(boxes.get('quiff')!.max.y).toBeGreaterThan(boxes.get('short')!.max.y);
    expect(size('curly').x).toBeGreaterThan(size('short').x);
  });

  it('leaves the face clear: the cap shell has no triangles in the face opening', () => {
    const geo = hairShellGeometry(0.39, { hairline: 0.9, gap: 1.9, bottom: 1.8 });
    const pos = geo.attributes.position;
    const idx = geo.index!;
    const eye = new THREE.Vector3(0.115, -0.02, 0.338).normalize();
    for (let i = 0; i < idx.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i)).normalize();
      expect(v.angleTo(eye)).toBeGreaterThan(0.12);
    }
    expect(idx.count).toBeGreaterThan(1000);
  });
});

describe('character rig', () => {
  it('has separate hinged limbs and a head that the walk cycle drives', () => {
    const rig = createCharacter(PLAYER_LOOK);
    for (const part of [rig.legL, rig.legR, rig.armL, rig.armR, rig.head]) expect(meshes(part).length).toBeGreaterThan(0);
    animateCharacter(rig, gaitPose({ phase: Math.PI / 2, walk: 1 }, 0), 0);
    expect(rig.legL.rotation.x).toBeGreaterThan(0.3);
    expect(rig.legR.rotation.x).toBeLessThan(-0.3);
    expect(rig.armL.rotation.x).toBeLessThan(0);
    expect(rig.inner.rotation.x).toBeGreaterThan(0);
  });

  it('holds limbs at rest when idle', () => {
    const rig = createCharacter(PLAYER_LOOK);
    animateCharacter(rig, gaitPose(createGait(), 0, true), 0, 0, 0, true);
    for (const part of [rig.legL, rig.legR, rig.armL, rig.armR]) expect(part.rotation.x).toBeCloseTo(0, 6);
    expect(rig.inner.position.y).toBeCloseTo(0, 6);
    expect(rig.head.rotation.y).toBeCloseTo(0, 6);
  });
});
