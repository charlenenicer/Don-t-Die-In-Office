import * as THREE from 'three';
import type { GaitPose } from './gait';

// Chibi office workers: big round head, two tall black oval eyes, no mouth,
// small body. Everyone shares the body; hair, clothes and accessories vary.

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.8): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    materials.set(key, m);
  }
  return m;
}

function add<T extends THREE.Object3D>(obj: T, parent: THREE.Object3D, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

function ball(parent: THREE.Object3D, r: number, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const m = add(new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat(color)), parent, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

function cyl(parent: THREE.Object3D, rTop: number, rBottom: number, h: number, color: string, x: number, y: number, z: number, seg = 20) {
  return add(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat(color)), parent, x, y, z);
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  return add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)), parent, x, y, z);
}

function capsule(parent: THREE.Object3D, r: number, len: number, color: string, x: number, y: number, z: number) {
  return add(new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat(color)), parent, x, y, z);
}

function ring(parent: THREE.Object3D, r: number, tube: number, color: string, x: number, y: number, z: number, square = false) {
  const geo = square ? new THREE.TorusGeometry(r, tube, 6, 4) : new THREE.TorusGeometry(r, tube, 8, 28);
  const m = add(new THREE.Mesh(geo, mat(color, 0.4)), parent, x, y, z);
  if (square) m.rotation.z = Math.PI / 4;
  return m;
}

// --------------------------------------------------------------------- looks

export type HairStyle = 'wavy' | 'short' | 'quiff' | 'bob' | 'bun' | 'curly' | 'ponytail';
export type TopStyle = 'sweater' | 'blazer' | 'shirt' | 'cardigan' | 'hoodie';
export type Extra = 'beard' | 'headphones' | 'earrings' | 'lanyard';

export interface PersonLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  hairHighlight?: string;
  top: string;
  topStyle: TopStyle;
  /** ribbing / lapels / cuffs */
  topTrim?: string;
  /** shirt showing under a blazer or cardigan */
  inner?: string;
  /** two stripes on each sleeve */
  stripes?: string;
  tie?: string;
  pants: string;
  shoes: string;
  /** white rubber soles and toe caps make canvas sneakers */
  soles?: string;
  glasses?: { color: string; shape: 'round' | 'square' };
  extras?: Extra[];
  /** body width multiplier */
  build?: number;
  /** overall size multiplier */
  height?: number;
}

/** The player: wavy black hair, round pink glasses, magenta striped sweatshirt, black jeans, canvas sneakers. */
export const PLAYER_LOOK: PersonLook = {
  skin: '#f5d3b0',
  hair: '#2a2230',
  hairHighlight: '#4b3f55',
  hairStyle: 'wavy',
  top: '#b5246e',
  topTrim: '#8a1a52',
  topStyle: 'sweater',
  stripes: '#26222a',
  pants: '#24232a',
  shoes: '#2b2b33',
  soles: '#f2efe8',
  glasses: { color: '#f2a0c4', shape: 'round' },
};

const NPC_LOOKS: Record<string, PersonLook> = {
  // Marcus, Senior PM: polished navy blazer, khakis, neat side part
  flatterer: {
    skin: '#e9c09a', hair: '#1d1a1c', hairStyle: 'short',
    top: '#2a4d9b', topTrim: '#1f3a78', topStyle: 'blazer', inner: '#f4f4f0',
    pants: '#c8b48a', shoes: '#6b4226',
  },
  // Sarah, Team Lead: neat bob, square glasses, teal cardigan
  jealous: {
    skin: '#f2d2b6', hair: '#3b2a20', hairStyle: 'bob',
    top: '#1f9d9a', topTrim: '#177a77', topStyle: 'cardigan', inner: '#f1e6cf',
    pants: '#4a4f5a', shoes: '#2b2b33',
    glasses: { color: '#1b1c20', shape: 'square' }, extras: ['earrings'],
  },
  // Brad, Engineering Manager: tall and broad, blond quiff, shirt and red tie
  overconfident: {
    skin: '#f0c8a8', hair: '#e2c06a', hairHighlight: '#f2d88a', hairStyle: 'quiff',
    top: '#9fc3ea', topStyle: 'shirt', tie: '#d6332a',
    pants: '#2a3550', shoes: '#1b1c20', build: 1.18, height: 1.06,
  },
  // Diana, VP of Operations: greying bun, red power blazer, gold earrings
  burnout: {
    skin: '#c98b5e', hair: '#4a4040', hairHighlight: '#a29c9c', hairStyle: 'bun',
    top: '#b8321f', topTrim: '#8a2418', topStyle: 'blazer', inner: '#1b1c20',
    pants: '#1b1c20', shoes: '#5a1a14', extras: ['earrings'],
  },
  // James, Staff Engineer: curly hair, beard, green hoodie, headphones, white sneakers
  mentor: {
    skin: '#8d5a3b', hair: '#151214', hairStyle: 'curly',
    top: '#2f8a47', topTrim: '#256e39', topStyle: 'hoodie',
    pants: '#3b5a86', shoes: '#f2f2f2', soles: '#d9d9d9',
    extras: ['beard', 'headphones'],
  },
  // Taylor, Office Coordinator: auburn ponytail, yellow cardigan, lanyard badge
  gossip: {
    skin: '#f6dcc6', hair: '#b5532b', hairHighlight: '#d0703f', hairStyle: 'ponytail',
    top: '#f2c230', topTrim: '#d9a514', topStyle: 'cardigan', inner: '#ef6aa6',
    pants: '#3b3f4a', shoes: '#c94f7c', extras: ['lanyard', 'earrings'],
  },
};

export function lookForCharacter(id: string): PersonLook {
  return NPC_LOOKS[id] ?? PLAYER_LOOK;
}

// --------------------------------------------------------------------- body

export interface CharacterRig {
  group: THREE.Group;
  inner: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  /** how far the arms hang out from the body */
  armSpread: number;
}

/** Hip height; seats line the hips up with the seat surface. */
export const HIP_HEIGHT = 0.66;
const HEAD_Y = 1.55;
const HEAD_R = 0.36;

export function createCharacter(look: PersonLook): CharacterRig {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const build = look.build ?? 1;
  const trim = look.topTrim ?? look.top;

  // legs: pivot at the hip so they can swing; shoes at the bottom
  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.1 * build, HIP_HEIGHT, 0);
    capsule(pivot, 0.08, 0.46, look.pants, 0, -0.31, 0);
    ball(pivot, 1, look.shoes, 0, -0.6, 0.05, 0.085, 0.065, 0.15);
    if (look.soles) {
      box(pivot, 0.17, 0.035, 0.31, look.soles, 0, -0.645, 0.05);
      ball(pivot, 1, look.soles, 0, -0.615, 0.17, 0.075, 0.045, 0.05);   // rubber toe cap
      for (let i = 0; i < 3; i++) box(pivot, 0.09, 0.012, 0.018, '#f2efe8', 0, -0.545 + i * 0.004, 0.0 + i * 0.045); // laces
    } else {
      box(pivot, 0.17, 0.03, 0.3, '#1b1c20', 0, -0.645, 0.05);
    }
    inner.add(pivot);
    return pivot;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // hips and torso
  const hips = cyl(inner, 0.19 * build, 0.19 * build, 0.16, look.pants, 0, HIP_HEIGHT, 0);
  hips.scale.z = 0.8;
  const torso = capsule(inner, 0.2, 0.3, look.top, 0, 0.9, 0);
  torso.scale.set(build, 1, 0.78);
  const chestZ = 0.156; // front surface of the torso

  switch (look.topStyle) {
    case 'sweater': {
      const hem = cyl(inner, 0.205 * build, 0.205 * build, 0.05, trim, 0, 0.6, 0);
      hem.scale.z = 0.8;
      ring(inner, 0.09, 0.025, trim, 0, 1.22, 0).rotation.x = Math.PI / 2;
      break;
    }
    case 'blazer': {
      box(inner, 0.12, 0.34, 0.01, look.inner ?? '#f4f4f0', 0, 1.04, chestZ);           // shirt in the V
      for (const side of [-1, 1]) {
        const lapel = box(inner, 0.07, 0.3, 0.012, trim, side * 0.075, 1.04, chestZ + 0.004);
        lapel.rotation.z = side * 0.35;
      }
      ball(inner, 0.016, trim, 0, 0.82, chestZ + 0.01);
      ball(inner, 0.016, trim, 0, 0.74, chestZ + 0.01);
      ring(inner, 0.085, 0.022, look.inner ?? '#f4f4f0', 0, 1.22, 0).rotation.x = Math.PI / 2;
      break;
    }
    case 'cardigan': {
      box(inner, 0.08, 0.6, 0.01, look.inner ?? '#f1e6cf', 0, 0.9, chestZ);
      for (let i = 0; i < 4; i++) ball(inner, 0.014, trim, 0.05, 1.05 - i * 0.12, chestZ + 0.008);
      ring(inner, 0.085, 0.022, look.inner ?? '#f1e6cf', 0, 1.22, 0).rotation.x = Math.PI / 2;
      break;
    }
    case 'hoodie': {
      const hood = ring(inner, 0.15, 0.06, trim, 0, 1.2, -0.08);
      hood.rotation.x = Math.PI / 2.3;
      box(inner, 0.24, 0.12, 0.01, trim, 0, 0.75, chestZ);                             // front pocket
      for (const side of [-1, 1]) cyl(inner, 0.008, 0.008, 0.16, '#f2f2f2', side * 0.05, 1.08, chestZ + 0.01, 6);
      break;
    }
    default: { // shirt
      for (const side of [-1, 1]) {
        const collar = box(inner, 0.09, 0.05, 0.02, look.top, side * 0.06, 1.2, 0.1);
        collar.rotation.z = side * 0.5;
      }
      for (let i = 0; i < 4; i++) ball(inner, 0.012, '#f4f4f0', 0, 1.05 - i * 0.12, chestZ + 0.006);
    }
  }
  if (look.tie) {
    box(inner, 0.06, 0.32, 0.012, look.tie, 0, 1.0, chestZ + 0.008);
    ball(inner, 0.035, look.tie, 0, 1.17, chestZ + 0.008);
  }
  if (look.extras?.includes('lanyard')) {
    for (const side of [-1, 1]) {
      const strap = box(inner, 0.018, 0.26, 0.008, '#c8341f', side * 0.05, 1.07, chestZ + 0.01);
      strap.rotation.z = -side * 0.22;
    }
    box(inner, 0.08, 0.11, 0.01, '#ffffff', 0, 0.9, chestZ + 0.014);
    box(inner, 0.06, 0.03, 0.012, '#2f6fdb', 0, 0.93, chestZ + 0.016);
  }

  // neck
  cyl(inner, 0.06, 0.07, 0.1, look.skin, 0, 1.22, 0);
  if (look.extras?.includes('headphones')) {
    const band = ring(inner, 0.17, 0.03, '#26292f', 0, 1.18, 0);
    band.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const cup = cyl(inner, 0.07, 0.07, 0.05, '#26292f', side * 0.17, 1.16, 0.06, 16);
      cup.rotation.z = Math.PI / 2;
    }
  }

  // arms: pivot at the shoulder, sleeve, optional stripes, cuff, hand
  const armSpread = 0.12;
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.235 * build, 1.13, 0);
    pivot.rotation.z = side * armSpread;
    capsule(pivot, 0.062, 0.36, look.top, 0, -0.25, 0);
    if (look.stripes) for (const y of [-0.13, -0.18]) cyl(pivot, 0.066, 0.066, 0.025, look.stripes, 0, y, 0, 16);
    cyl(pivot, 0.066, 0.066, 0.05, trim, 0, -0.45, 0, 16);
    ball(pivot, 0.06, look.skin, 0, -0.52, 0);
    inner.add(pivot);
    return pivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // head: big round face, tall oval eyes, no mouth
  const head = new THREE.Group();
  head.position.set(0, HEAD_Y, 0);
  inner.add(head);
  ball(head, HEAD_R, look.skin, 0, 0, 0);
  for (const side of [-1, 1]) ball(head, 1, '#141216', side * 0.115, -0.02, 0.338, 0.045, 0.085, 0.03);

  if (look.glasses) {
    const { color, shape } = look.glasses;
    const square = shape === 'square';
    for (const side of [-1, 1]) {
      ring(head, 0.1, 0.011, color, side * 0.12, -0.02, 0.37, square);
      const temple = box(head, 0.012, 0.012, 0.26, color, side * 0.27, 0.0, 0.2);
      temple.rotation.y = side * 0.55; // runs back into the hair toward the ear
    }
    const bridge = cyl(head, 0.008, 0.008, 0.06, color, 0, 0.0, 0.375, 6);
    bridge.rotation.z = Math.PI / 2;
  }
  if (look.extras?.includes('beard')) ball(head, 1, look.hair, 0, -0.2, 0.12, 0.27, 0.17, 0.24);
  if (look.extras?.includes('earrings')) {
    for (const side of [-1, 1]) ball(head, 0.03, '#f2c230', side * 0.35, -0.13, 0.03);
  }
  addHair(head, look);

  group.scale.setScalar(look.height ?? 1);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, inner, head, legL, legR, armL, armR, armSpread };
}

// --------------------------------------------------------------------- hair

/** Hair is a handful of smooth shapes per style (see HAIR_MAX_MESHES), so the ink pass draws a clean silhouette. */
export const HAIR_MAX_MESHES = 4;

const doubleSided = new Map<string, THREE.MeshStandardMaterial>();
function shellMat(color: string): THREE.MeshStandardMaterial {
  let m = doubleSided.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    doubleSided.set(color, m);
  }
  return m;
}

/** Profile points (radius, height) for a lathe, with a gentle wave so long hair isn't a plain tube. */
function profile(points: [number, number][], wave = 0): THREE.Vector2[] {
  return points.map(([r, y], i) => new THREE.Vector2(r + (i > 0 && i < points.length - 1 ? Math.sin(i * 1.9) * wave : 0), y));
}

export interface ShellOptions {
  /** polar angle (from the top) of the hairline over the forehead */
  hairline: number;
  /** width of the face opening, radians around the head */
  gap: number;
  /** polar angle where the hair ends at the sides and back */
  bottom: number;
  /** soft outward lumps (curly hair), as a fraction of the radius */
  lumps?: number;
}

/**
 * A hair shell concentric with the head (radius > the head's), with a clean
 * opening for the face. Being concentric it never cuts into the face, so the
 * hairline is a crisp open edge rather than a jagged sphere-sphere intersection.
 * The opening follows the sphere's grid lines, so its edges stay straight.
 */
export function hairShellGeometry(r: number, o: ShellOptions): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, 64, 48);
  const pos = geo.attributes.position;
  const keep: number[] = [];
  const index = geo.index!;
  const v = new THREE.Vector3();
  for (let i = 0; i < index.count; i += 3) {
    v.set(0, 0, 0);
    for (let k = 0; k < 3; k++) v.add(new THREE.Vector3().fromBufferAttribute(pos, index.getX(i + k)));
    v.multiplyScalar(1 / 3);
    const theta = Math.acos(THREE.MathUtils.clamp(v.y / v.length(), -1, 1));
    const front = Math.abs(Math.atan2(v.x, v.z));
    if (theta > o.bottom) continue;
    if (theta > o.hairline && front < o.gap / 2) continue;
    keep.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  }
  geo.setIndex(keep);
  if (o.lumps) {
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const theta = Math.acos(THREE.MathUtils.clamp(v.y / r, -1, 1));
      const phi = Math.atan2(v.z, v.x);
      v.multiplyScalar(1 + o.lumps * (0.5 + 0.5 * Math.sin(theta * 7) * Math.sin(phi * 6)));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function addHair(head: THREE.Group, look: PersonLook) {
  const hair = new THREE.Group();
  hair.name = 'hair';
  head.add(hair);
  const c = look.hair;
  const hl = look.hairHighlight ?? c;
  const smooth = (r: number, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const m = add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat(color)), hair, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  };
  // the cap every style starts from: a shell over the skull, open for the face
  const shell = (r: number, o: ShellOptions, color = c) => add(new THREE.Mesh(hairShellGeometry(r, o), shellMat(color)), hair, 0, 0, 0);
  // hair falling from the crown, open at the front for the face (gap in radians)
  const fall = (points: [number, number][], gap: number, wave = 0) => {
    const geo = new THREE.LatheGeometry(profile(points, wave), 48, gap / 2, Math.PI * 2 - gap);
    return add(new THREE.Mesh(geo, shellMat(c)), hair, 0, 0, 0);
  };
  // a fringe: a band of a sphere across the forehead (width in radians, polar range from..to)
  const fringe = (r: number, width: number, from: number, to: number, color = c) => {
    const geo = new THREE.SphereGeometry(r, 36, 12, Math.PI / 2 - width / 2, width, from, to - from);
    return add(new THREE.Mesh(geo, shellMat(color)), hair, 0, 0, 0);
  };
  const piece = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, color = c) => {
    const m = smooth(1, color, x, y, z, sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    return m;
  };
  const short: ShellOptions = { hairline: 0.95, gap: 1.9, bottom: 1.8 };

  switch (look.hairStyle) {
    case 'wavy': {
      // shoulder-length waves: cap, one wavy fall down the back and sides, soft bangs
      shell(0.395, { hairline: 0.6, gap: 2.1, bottom: 2.0 });
      fall([[0.33, 0.2], [0.41, 0.05], [0.43, -0.16], [0.45, -0.38], [0.48, -0.58], [0.45, -0.68], [0.36, -0.7]], 2.3, 0.012);
      fringe(0.405, 2.0, 0.45, 1.38);
      break;
    }
    case 'short': {
      shell(0.385, short);
      piece(0.06, 0.25, 0.24, 0.26, 0.09, 0.12, -0.45, 0, -0.15, hl);          // side-parted fringe
      break;
    }
    case 'quiff': {
      shell(0.385, short);
      piece(0.01, 0.34, 0.14, 0.24, 0.14, 0.26, -0.45, 0, 0, hl);            // swept-up front
      break;
    }
    case 'bob': {
      // chin-length bob that curls under, with straight blunt bangs
      shell(0.395, { hairline: 0.6, gap: 2.0, bottom: 2.0 });
      fall([[0.33, 0.2], [0.41, 0.05], [0.44, -0.14], [0.44, -0.28], [0.4, -0.35], [0.34, -0.36]], 2.0);
      fringe(0.405, 2.0, 0.45, 1.3);
      break;
    }
    case 'bun': {
      shell(0.38, { ...short, hairline: 0.9 });
      smooth(0.16, hl, 0, 0.3, -0.33);                                        // the bun, in the grey highlight
      ring(hair, 0.1, 0.025, c, 0, 0.25, -0.27).rotation.x = Math.PI / 3;     // where it's tied
      break;
    }
    case 'curly': {
      // one soft, lumpy cloud instead of dozens of curls
      shell(0.41, { hairline: 0.85, gap: 1.8, bottom: 1.9, lumps: 0.14 });
      break;
    }
    case 'ponytail': {
      shell(0.385, short);
      piece(-0.05, 0.24, 0.24, 0.27, 0.09, 0.12, -0.4, 0, 0.2, hl);           // swept fringe
      ring(hair, 0.065, 0.028, '#ef6aa6', 0, 0.12, -0.39).rotation.x = Math.PI / 2.4; // scrunchie
      // one tapered tail hanging from the scrunchie
      const tail = new THREE.Mesh(new THREE.LatheGeometry(profile([[0, 0], [0.09, -0.06], [0.12, -0.2], [0.1, -0.36], [0.05, -0.5], [0, -0.55]]), 28), mat(c));
      add(tail, hair, 0, 0.14, -0.42).rotation.x = 0.3;
      break;
    }
  }
}

// ----------------------------------------------------------------- animation

/**
 * Pose a character from a walk-cycle pose (see gait.ts). `sit` and `reach` blend
 * into the seated and hands-busy poses; `t` drives the idle glance and the busy
 * hands. Pass reducedMotion to keep the head still.
 */
export function animateCharacter(rig: CharacterRig, pose: GaitPose, t: number, sit = 0, reach = 0, reducedMotion = false) {
  const stand = 1 - sit;
  rig.legL.rotation.x = pose.legL * stand - 1.45 * sit;
  rig.legR.rotation.x = pose.legR * stand - 1.45 * sit;
  rig.armL.rotation.x = pose.armL * stand - 0.5 * sit;
  rig.armR.rotation.x = pose.armR * stand - 0.5 * sit;
  rig.armL.rotation.z = -rig.armSpread - pose.armSway;
  rig.armR.rotation.z = rig.armSpread + pose.armSway;
  rig.inner.position.y = (pose.bob + pose.breath * 0.6) * stand;
  rig.inner.rotation.set(pose.lean * stand, pose.twist * stand, pose.roll * stand);
  // the head stays level and facing forward against the body's lean and twist,
  // and glances around a little when standing idle
  const glance = reducedMotion ? 0 : Math.sin(t * 0.7) * 0.25 * (1 - pose.walk) * (1 - reach);
  rig.head.rotation.set(-pose.lean * 0.6 * stand + pose.breath * 0.5, glance - pose.twist * 0.9 * stand, -pose.roll * 0.7 * stand);
  // reaching: both arms forward and busy (playing, grabbing, throwing)
  rig.armL.rotation.x -= reach * (0.95 + Math.sin(t * 11) * 0.2);
  rig.armR.rotation.x -= reach * (0.95 + Math.sin(t * 11 + 1.7) * 0.25);
}
