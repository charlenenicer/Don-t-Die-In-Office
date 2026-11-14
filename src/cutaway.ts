import * as THREE from 'three';

/**
 * Dollhouse cutaway for the isometric camera. The camera looks in from the
 * south-east, so the two far outer walls (north and west) stay full height and
 * frame the scene with their windows; every other wall is cut down to a low
 * partition and the ceiling, hanging lamps and signs above head height are
 * hidden, so every room reads from above.
 */

/** Height interior partitions and door frames are cut down to. */
export const PARTITION_CUT = 1.5;
/** Height the near outer walls (south and east) are cut down to: just the sill. */
export const NEAR_WALL_CUT = 1.0;
/** Anything (that isn't on a far wall) starting above this is hidden: ceiling, lamps, signs. */
export const HIDE_ABOVE = 2.9;
/** Half-size of the office floor plate; things centred further out are exterior scenery. */
export const OFFICE_HALF = 26.5;

export type WallKind = 'far' | 'near-outer' | 'partition';

/** Classify a wall piece by its world bounds (the office spans -25..25 on x and z). */
export function wallKind(min: { x: number; z: number }, max: { x: number; z: number }): WallKind {
  if (max.z < -24 || max.x < -24) return 'far';
  if (min.z > 24 || min.x > 24) return 'near-outer';
  return 'partition';
}

/**
 * New vertical extent for a box spanning minY..maxY after cutting at `cut`:
 * null when it's entirely above the cut and should be hidden.
 */
export function cutSpan(minY: number, maxY: number, cut: number): { minY: number; maxY: number } | null {
  if (minY >= cut - 0.02) return null;
  return { minY, maxY: Math.min(maxY, cut) };
}

/** Lower a centred box mesh so its top sits at `cut`, or hide it. */
function cutMesh(mesh: THREE.Mesh, cut: number, box: THREE.Box3) {
  box.setFromObject(mesh);
  const span = cutSpan(box.min.y, box.max.y, cut);
  if (!span) {
    mesh.visible = false;
    return;
  }
  if (span.maxY >= box.max.y - 1e-4) return;
  const full = box.max.y - box.min.y;
  const k = (span.maxY - span.minY) / full;
  mesh.scale.y *= k;
  // keep the bottom on the floor: the geometry is centred on its origin
  mesh.position.y = (span.minY + span.maxY) / 2 - (mesh.parent ? mesh.parent.getWorldPosition(new THREE.Vector3()).y : 0);
  mesh.userData.cut = true;
}

export interface CutawayResult { cut: number; hidden: number; kept: number }

export function applyCutaway(world: THREE.Object3D, walls: THREE.Object3D[]): CutawayResult {
  world.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const wallSet = new Set(walls);
  const result: CutawayResult = { cut: 0, hidden: 0, kept: 0 };

  for (const wall of walls) {
    box.setFromObject(wall);
    const kind = wallKind(box.min, box.max);
    if (kind === 'far') {
      result.kept++;
      continue;
    }
    const cut = kind === 'near-outer' ? NEAR_WALL_CUT : PARTITION_CUT;
    // art and name plates hang on the walls: lift them off before scaling, then
    // keep only what still fits below the cut
    for (const child of [...wall.children]) {
      world.attach(child);
      box.setFromObject(child);
      if (box.min.y > cut - 0.3) child.visible = false;
    }
    if (wall instanceof THREE.Mesh) {
      cutMesh(wall, cut, box);
      if (wall.visible) result.cut++;
      else result.hidden++;
    }
  }

  // exterior scenery, ceiling, lamps and hanging signs
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  const visit = (o: THREE.Object3D) => {
    for (const child of o.children) {
      if (wallSet.has(child) || child instanceof THREE.Light) continue;
      if (child.userData.interior) {
        visit(child);
        continue;
      }
      box.setFromObject(child);
      if (box.isEmpty()) continue;
      box.getCenter(center);
      box.getSize(size);
      const exterior = Math.abs(center.x) > OFFICE_HALF || Math.abs(center.z) > OFFICE_HALF || size.x > 60 || size.z > 60;
      const onFarWall = box.max.z < -24 || box.max.x < -24;
      if (exterior || (box.min.y > HIDE_ABOVE && !onFarWall) || box.min.y > 6.9) {
        child.visible = false;
        result.hidden++;
      }
    }
  };
  visit(world);
  return result;
}
