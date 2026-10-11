import * as THREE from 'three';

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

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function addHair(head: THREE.Group, look: PersonLook) {
  const c = look.hair;
  const hl = look.hairHighlight ?? c;
  const rand = mulberry32(c.length * 977 + look.hairStyle.length * 131);
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const tuft = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, color = c) => {
    const m = ball(head, 1, color, x, y, z, sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    return m;
  };
  // the skull cap that every style starts from, sitting slightly back so the face shows
  const cap = (r = 0.385, y = 0.06, z = -0.06) => ball(head, r, c, 0, y, z, 1.05, 1, 1.03);

  switch (look.hairStyle) {
    case 'wavy': {
      cap(0.39);
      // bangs fanned across the forehead, hanging to the top of the glasses
      for (let i = 0; i < 7; i++) {
        const a = -0.95 + i * 0.32;
        tuft(Math.sin(a) * 0.31, 0.13, Math.cos(a) * 0.31, 0.1, 0.17, 0.07, -0.35, a, (i - 3) * 0.08, i === 2 ? hl : c);
      }
      // waves down the sides and back, flaring out toward the shoulders
      // smooth mass of hair down the back; the waves below only break up its edges
      ball(head, 1, c, 0, -0.2, -0.17, 0.43, 0.47, 0.3);
      ball(head, 1, c, 0, -0.5, -0.12, 0.47, 0.22, 0.27);
      // the face stays clear: wide gap at eye level, narrower below the chin where
      // the hair falls forward over the shoulders
      for (let layer = 0; layer < 6; layer++) {
        const y = 0.06 - layer * 0.13;
        const spread = 0.36 + layer * 0.028;
        const r = 0.12 + (layer % 2) * 0.02;
        const clearFace = layer < 3 ? 1.4 : layer === 3 ? 1.15 : 0.9;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2 + layer * 0.22;
          if (Math.abs(wrap(a)) < clearFace) continue;
          if (Math.abs(wrap(a)) > 2.5 && k % 2 === 0) continue;
          ball(head, r, (k + layer) % 4 === 0 ? hl : c, Math.sin(a) * spread, y + Math.sin(k * 1.7) * 0.025, Math.cos(a) * spread - 0.05);
        }
      }
      // cowlick sticking up on top
      const strand = add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 12, Math.PI), mat(c)), head, 0.02, 0.45, 0);
      strand.rotation.set(0, 0.4, 0.3);
      tuft(-0.12, 0.31, 0.12, 0.12, 0.04, 0.08, 0.3, 0.3, 0.2, hl);
      break;
    }
    case 'short': {
      cap(0.375, 0.07, -0.04);
      tuft(0.06, 0.24, 0.25, 0.26, 0.09, 0.12, -0.4, 0, -0.15);            // side-parted fringe
      for (const side of [-1, 1]) tuft(side * 0.34, -0.02, 0.06, 0.04, 0.1, 0.06, 0, 0, 0); // sideburns
      break;
    }
    case 'quiff': {
      cap(0.375, 0.07, -0.04);
      tuft(0.02, 0.36, 0.17, 0.22, 0.13, 0.2, -0.5, 0, 0, hl);             // swept-up front
      tuft(-0.08, 0.3, 0.05, 0.2, 0.1, 0.22, -0.2, 0, 0.2);
      break;
    }
    case 'bob': {
      cap(0.39, 0.06, -0.05);
      tuft(0, 0.18, 0.27, 0.32, 0.1, 0.1, -0.2, 0, 0);                     // straight blunt bangs
      for (let layer = 0; layer < 3; layer++) {
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          if (Math.abs(wrap(a)) < 1.1) continue;
          ball(head, 0.14, c, Math.sin(a) * 0.38, 0.02 - layer * 0.12, Math.cos(a) * 0.38 - 0.03);
        }
      }
      break;
    }
    case 'bun': {
      cap(0.372, 0.05, -0.04);
      ball(head, 0.15, c, 0, 0.32, -0.28);
      ring(head, 0.11, 0.02, hl, 0, 0.27, -0.24).rotation.x = Math.PI / 3;
      for (let i = 0; i < 4; i++) tuft(-0.2 + i * 0.13, 0.25, 0.2, 0.08, 0.03, 0.08, -0.5, 0, 0, hl); // grey streaks
      break;
    }
    case 'curly': {
      cap(0.37, 0.05, -0.04);
      for (let lat = 0; lat < 5; lat++) {
        const phi = 0.2 + lat * 0.3; // from the top down
        const count = 6 + lat * 3;
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + rand() * 0.3;
          if (lat > 2 && Math.abs(wrap(a)) < 0.9) continue;
          const rr = 0.43;
          ball(head, 0.1 + rand() * 0.03, c, Math.sin(phi) * Math.sin(a) * rr, Math.cos(phi) * rr - 0.02, Math.sin(phi) * Math.cos(a) * rr - 0.05);
        }
      }
      break;
    }
    case 'ponytail': {
      cap(0.38, 0.06, -0.05);
      tuft(-0.05, 0.22, 0.25, 0.28, 0.09, 0.12, -0.35, 0, 0.2, hl);        // swept fringe
      ball(head, 0.06, '#ef6aa6', 0, 0.16, -0.38);                          // scrunchie
      tuft(0, -0.12, -0.45, 0.13, 0.32, 0.13, 0.3, 0, 0);
      tuft(0, -0.4, -0.5, 0.1, 0.12, 0.1, 0.2, 0, 0, hl);
      break;
    }
  }
}

// ----------------------------------------------------------------- animation

/** Animate a character. `walk` is 0 (idle) to 1 (full stride); `sit` and `reach` blend into seated and hands-busy poses. */
export function animateCharacter(rig: CharacterRig, t: number, walk: number, sit = 0, reach = 0) {
  const stride = Math.sin(t * 9) * 0.6 * walk;
  rig.legL.rotation.x = stride * (1 - sit) - 1.45 * sit;
  rig.legR.rotation.x = -stride * (1 - sit) - 1.45 * sit;
  rig.armL.rotation.x = -stride * 0.9 * (1 - sit) - 0.5 * sit;
  rig.armR.rotation.x = stride * 0.9 * (1 - sit) - 0.5 * sit;
  const sway = Math.sin(t * 1.6) * 0.03 * (1 - walk);
  rig.armL.rotation.z = -rig.armSpread - sway;
  rig.armR.rotation.z = rig.armSpread + sway;
  rig.inner.position.y = (Math.abs(Math.sin(t * 9)) * 0.04 * walk + Math.sin(t * 2) * 0.008 * (1 - walk)) * (1 - sit);
  rig.inner.rotation.z = Math.sin(t * 9) * 0.03 * walk;
  rig.head.rotation.y = Math.sin(t * 0.7) * 0.25 * (1 - walk) * (1 - reach);
  // reaching: both arms forward and busy (playing, grabbing, throwing)
  rig.armL.rotation.x -= reach * (0.95 + Math.sin(t * 11) * 0.2);
  rig.armR.rotation.x -= reach * (0.95 + Math.sin(t * 11 + 1.7) * 0.25);
}
