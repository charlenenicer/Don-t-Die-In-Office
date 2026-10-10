import * as THREE from 'three';

// Look inspired by Big Walk (House House): chunky round characters with
// mismatched saturated parts, bold flat-colored architecture, a naturalistic
// outdoor setting, bright sky and soft real shadows.

export const FOG_COLOR = '#cfe3ee';

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.9): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
    materials.set(key, m);
  }
  return m;
}

function place<T extends THREE.Object3D>(obj: T, parent: THREE.Object3D, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}

function box(parent: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  return place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)), parent, x, y, z);
}

function cyl(parent: THREE.Object3D, rTop: number, rBottom: number, h: number, color: string, x: number, y: number, z: number, seg = 28) {
  return place(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), mat(color)), parent, x, y, z);
}

function ball(parent: THREE.Object3D, r: number, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const mesh = place(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat(color)), parent, x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
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

// ---------------------------------------------------------------- characters

export interface BirdColors {
  body: string;
  head: string;
  neck: string;
  limbs: string;
  feet: string;
}

export interface BirdRig {
  group: THREE.Group;
  inner: THREE.Group;
  head: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
}

export const PLAYER_COLORS: BirdColors = {
  body: '#2f6fdb', head: '#e8591f', neck: '#f3b01c', limbs: '#2f6fdb', feet: '#1c3d8f',
};

const NPC_COLORS: Record<string, BirdColors> = {
  flatterer: { body: '#e8517a', head: '#f2a31b', neck: '#2e5cb8', limbs: '#f2a31b', feet: '#e8517a' },
  jealous: { body: '#8cc63f', head: '#7a1f4d', neck: '#f2a31b', limbs: '#7a1f4d', feet: '#8cc63f' },
  overconfident: { body: '#27a6a0', head: '#e0452f', neck: '#2a4d9b', limbs: '#e0452f', feet: '#1d6f6b' },
  burnout: { body: '#8a5fc4', head: '#d9d4c7', neck: '#e0452f', limbs: '#6a6f78', feet: '#8a5fc4' },
  mentor: { body: '#f2c230', head: '#2a7d4f', neck: '#c8d8a0', limbs: '#2a7d4f', feet: '#f2c230' },
  gossip: { body: '#e0452f', head: '#f4c7a0', neck: '#2f6fdb', limbs: '#f2c230', feet: '#e0452f' },
};
const FALLBACK_COLORS: BirdColors = { body: '#d96b2b', head: '#2b8a6e', neck: '#f2c230', limbs: '#d96b2b', feet: '#7a3a14' };

export function colorsForCharacter(id: string): BirdColors {
  return NPC_COLORS[id] ?? FALLBACK_COLORS;
}

/** A Big Walk style walker: tiny eyed head, big round body, noodle limbs. */
export function createBird(colors: BirdColors, scale = 0.85): BirdRig {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);

  // big round body
  ball(inner, 0.55, colors.body, 0, 1.05, 0, 1, 1.05, 0.95);

  // legs: pivot at the hip, so they can swing
  const makeLeg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2, 0.78, 0);
    const len = 0.6;
    place(new THREE.Mesh(new THREE.CapsuleGeometry(0.055, len, 4, 10), mat(colors.limbs)), pivot, 0, -0.38, 0);
    ball(pivot, 0.1, colors.feet, 0, -0.74, 0.07, 1.1, 0.6, 1.7);
    inner.add(pivot);
    return pivot;
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // neck ball
  ball(inner, 0.21, colors.neck, 0, 1.68, 0);

  // arms: long noodles from the neck, ending in a rounded nub
  const makeArm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.26, 1.66, 0);
    pivot.rotation.z = side * 0.6;
    place(new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.85, 4, 10), mat(colors.limbs)), pivot, 0, -0.47, 0);
    ball(pivot, 0.085, colors.feet, 0, -0.97, 0);
    inner.add(pivot);
    return pivot;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // head: small sphere, nub beak, big white eyes with black pupils
  const head = new THREE.Group();
  head.position.set(0, 2.03, 0);
  inner.add(head);
  ball(head, 0.3, colors.head, 0, 0, 0);
  const beak = place(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.14, 4, 10), mat(colors.head)), head, 0, -0.03, 0.34);
  beak.rotation.x = Math.PI / 2;
  const eyeWhite = mat('#ffffff', 0.4);
  const pupil = new THREE.MeshStandardMaterial({ color: '#0b0b0f', roughness: 0.3 });
  for (const side of [-1, 1]) {
    const eye = place(new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), eyeWhite), head, side * 0.265, 0.06, 0.11);
    eye.scale.set(0.4, 1, 1);
    const p = place(new THREE.Mesh(new THREE.SphereGeometry(0.058, 16, 12), pupil), head, side * 0.296, 0.06, 0.125);
    p.scale.set(0.45, 1, 1);
  }

  group.scale.setScalar(scale);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, inner, head, legL, legR, armL, armR };
}

/** Animate a walker. `walk` is 0 (idle) to 1 (full stride). */
export function animateBird(rig: BirdRig, t: number, walk: number, sit = 0) {
  const stride = Math.sin(t * 10) * 0.75 * walk;
  // sitting: legs stick out forward, arms rest in front
  rig.legL.rotation.x = stride * (1 - sit) - 1.45 * sit;
  rig.legR.rotation.x = -stride * (1 - sit) - 1.45 * sit;
  rig.armL.rotation.x = -stride * 0.8 * (1 - sit) - 0.75 * sit;
  rig.armR.rotation.x = stride * 0.8 * (1 - sit) - 0.75 * sit;
  const sway = Math.sin(t * 1.6) * 0.06 * (1 - walk);
  rig.armL.rotation.z = -0.6 - sway;
  rig.armR.rotation.z = 0.6 + sway;
  rig.inner.position.y = (Math.abs(Math.sin(t * 10)) * 0.07 * walk + Math.sin(t * 2) * 0.012 * (1 - walk)) * (1 - sit);
  rig.inner.rotation.z = Math.sin(t * 10) * 0.05 * walk;
  rig.head.rotation.y = Math.sin(t * 0.7) * 0.25 * (1 - walk);
}

// ------------------------------------------------------------------ pickups

/** The red rotund bowling-pin collectible ("wibbler"). */
export function createWibbler(): THREE.Mesh {
  const profile = [
    [0, 0], [0.17, 0.02], [0.26, 0.17], [0.25, 0.36], [0.16, 0.52],
    [0.1, 0.65], [0.12, 0.77], [0.08, 0.86], [0, 0.88],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(profile, 28);
  geometry.translate(0, -0.44, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#e8392b', roughness: 0.45 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// --------------------------------------------------------------------- sky

export function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#3f7fd6');
  g.addColorStop(0.4, '#8fbfec');
  g.addColorStop(0.7, FOG_COLOR);
  g.addColorStop(1, FOG_COLOR);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addClouds(scene: THREE.Scene) {
  const rand = mulberry32(7);
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const puffs = 4 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + rand() * 5, 16, 12), cloudMat);
      puff.position.set((p - puffs / 2) * 7 + rand() * 3, rand() * 3, rand() * 4);
      puff.scale.y = 0.55;
      cloud.add(puff);
    }
    const angle = rand() * Math.PI * 2;
    const dist = 110 + rand() * 60;
    cloud.position.set(Math.cos(angle) * dist, 38 + rand() * 25, Math.sin(angle) * dist);
    cloud.rotation.y = rand() * Math.PI;
    scene.add(cloud);
  }
}

// ------------------------------------------------------------------- world

const CHARTREUSE = '#b9cf1c';
const MUSTARD = '#e8b923';
const TOMATO = '#e0452f';
const TEAL = '#1f9d9a';
const NAVY = '#2a4d9b';
const CREAM = '#efe4c4';

function addPlant(world: THREE.Group, x: number, z: number, potColor: string) {
  cyl(world, 0.35, 0.28, 0.55, potColor, x, 0.28, z);
  ball(world, 0.5, '#2f8a3c', x, 1.0, z, 1, 1.1, 1);
  ball(world, 0.36, '#4aa84a', x + 0.25, 1.45, z + 0.1);
  ball(world, 0.3, '#237a36', x - 0.2, 1.5, z - 0.1);
}

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A spot the player can sit on. `top` is the seat surface height, `yaw` the facing direction. */
export interface Seat {
  x: number;
  z: number;
  top: number;
  yaw: number;
}

export interface WorldData {
  colliders: Collider[];
  seats: Seat[];
}

const WALL_H = 8;
const WALL_T = 0.25;

function makeSign(text: string, bg: string, w = 5, h = 1.2): THREE.Group {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = Math.round(640 * (h / w));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${Math.round(canvas.height * 0.52)}px -apple-system, 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), mat('#2b2b33'));
  group.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), new THREE.MeshBasicMaterial({ map: tex }));
  face.position.z = 0.08;
  group.add(face);
  // cords up to the ceiling
  for (const dx of [-w / 2 + 0.4, w / 2 - 0.4]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3, 6), mat('#333'));
    cord.position.set(dx, h / 2 + 1.5, 0);
    group.add(cord);
  }
  group.traverse((o) => { o.userData.noCastShadow = true; });
  return group;
}

// ------------------------------------------------------------ high-rise view

function facadeTexture(base: string, glassDark: string, glassLight: string, rand: () => number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  const cw = 128 / cols;
  const ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = rand();
      ctx.fillStyle = v < 0.05 ? '#ffe9a8' : v < 0.4 ? glassLight : glassDark;
      ctx.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * We are on a high floor. West side: a city skyline of towers. East side:
 * a bay with boats, with mountains rising beyond it.
 */
function buildHighriseView(world: THREE.Group, rand: () => number) {
  const view = new THREE.Group();

  // ---- city (west, x < 0) -----------------------------------------------------
  const palettes: [string, string, string][] = [
    ['#8ea5bd', '#3d5878', '#cfe3f2'],
    ['#b3a595', '#4a5a6a', '#d8e4ea'],
    ['#6f859c', '#2e4660', '#bcd6ea'],
    ['#a7b4b6', '#44606a', '#d6ecf0'],
    ['#c4b8a6', '#56606e', '#e4eef2'],
  ];
  const textures = palettes.map(([b, d, l]) => facadeTexture(b, d, l, rand));
  const roofMat = mat('#8a9098', 1);
  const BASE = -80;
  for (let i = 0; i < 90; i++) {
    const angle = Math.PI / 2 + rand() * Math.PI; // west half
    const dist = 85 + Math.pow(rand(), 0.8) * 260;
    const w = 9 + rand() * 16;
    const d = 9 + rand() * 16;
    const top = -45 + rand() * rand() * 115; // mostly shorter than us, a few towers above
    const h = top - BASE;
    const tex = textures[i % textures.length].clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 9)));
    const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.1 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roofMat, roofMat, side, side]);
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (Math.abs(x) < 36 && Math.abs(z) < 36) continue; // keep clear of our own building
    mesh.position.set(x, BASE + h / 2, z);
    mesh.rotation.y = Math.floor(rand() * 4) * 0.05;
    view.add(mesh);
  }

  // ---- bay and mountains (east, x > 0) -------------------------------------------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshStandardMaterial({ color: '#3d87bd', roughness: 0.25, metalness: 0.05 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(30 + 900, -10, 0);
  view.add(water);

  const boatHull = '#f4f4f0';
  const boatTrim = '#e0452f';
  const sail = mat('#ffffff', 0.9);
  for (let i = 0; i < 9; i++) {
    const boat = new THREE.Group();
    box(boat, 3.2, 0.7, 1.1, boatHull, 0, 0.35, 0);
    box(boat, 3.25, 0.15, 1.15, boatTrim, 0, 0.55, 0);
    if (i % 2 === 0) {
      cyl(boat, 0.05, 0.05, 3.2, '#444', 0, 2.2, 0, 6);
      const triangle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.1, 2.8, 3, 1), sail);
      triangle.rotation.z = Math.PI / 2;
      triangle.scale.set(0.5, 1, 0.05);
      triangle.position.set(0, 2.1, 0);
      boat.add(triangle);
    } else {
      box(boat, 1.2, 0.7, 0.9, boatHull, -0.3, 1.0, 0);
    }
    boat.scale.setScalar(1.6);
    boat.position.set(45 + rand() * 170, -10, (rand() - 0.5) * 200);
    boat.rotation.y = rand() * Math.PI * 2;
    view.add(boat);
  }

  const rockColors = ['#47688f', '#55769c', '#3e5f86'];
  for (let i = 0; i < 30; i++) {
    const angle = (rand() - 0.5) * Math.PI * 1.1; // east half
    const dist = 200 + rand() * 170;
    const r = 70 + rand() * 70;
    const h = 45 + rand() * 50;
    const group = new THREE.Group();
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7, 1), new THREE.MeshStandardMaterial({ color: rockColors[i % 3], roughness: 1, flatShading: true }));
    peak.position.y = h / 2 - 10;
    peak.rotation.y = rand() * Math.PI;
    group.add(peak);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.3, 7, 1), new THREE.MeshStandardMaterial({ color: '#f1f5f8', roughness: 1, flatShading: true }));
    snow.position.y = h * 0.85 - 10;
    snow.rotation.y = peak.rotation.y;
    group.add(snow);
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    view.add(group);
  }

  view.traverse((o) => { o.userData.noShadow = true; });
  world.add(view);
}

export function buildWorld(scene: THREE.Scene): WorldData {
  const world = new THREE.Group();
  const rand = mulberry32(42);
  const colliders: Collider[] = [];
  const seats: Seat[] = [];
  const solid = (x: number, z: number, w: number, d: number) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };
  const glassWall = new THREE.MeshStandardMaterial({ color: '#a9dcf2', transparent: true, opacity: 0.2, roughness: 0.1 });

  // ---- helpers that need the collider list --------------------------------

  /** A partition: low colored base, glass above (optional), with doorway gaps. */
  const wallLine = (
    axis: 'x' | 'z', fixed: number, from: number, to: number, color: string,
    gaps: [number, number][] = [], glassTop = true,
  ) => {
    const dims = (l: number, h: number): [number, number, number] => (axis === 'x' ? [l, h, WALL_T] : [WALL_T, h, l]);
    const pos = (m: number, y: number): [number, number, number] => (axis === 'x' ? [m, y, fixed] : [fixed, y, m]);
    const sorted = [...gaps].sort((g1, g2) => g1[0] - g2[0]);
    const segs: [number, number][] = [];
    let cur = from;
    for (const [g0, g1] of sorted) {
      if (g0 > cur) segs.push([cur, g0]);
      cur = g1;
    }
    if (cur < to) segs.push([cur, to]);
    for (const [a, b] of segs) {
      const len = b - a;
      const m = (a + b) / 2;
      box(world, ...dims(len, 1.0), color, ...pos(m, 0.5));
      if (glassTop) {
        const pane = place(new THREE.Mesh(new THREE.BoxGeometry(...dims(len, 2.2)), glassWall), world, ...pos(m, 2.1));
        pane.userData.noCastShadow = true;
        pane.userData.noCollide = true;
        box(world, ...dims(len, 0.14), color, ...pos(m, 3.27));
      }
      if (axis === 'x') solid(m, fixed, len, WALL_T + 0.1);
      else solid(fixed, m, WALL_T + 0.1, len);
    }
    if (glassTop) {
      for (const [g0, g1] of sorted) box(world, ...dims(g1 - g0, 0.14), color, ...pos((g0 + g1) / 2, 3.27));
    }
  };

  const desk = (x: number, z: number, w: number, d: number, top: string, legs = '#6d6a62') => {
    box(world, w, 0.12, d, top, x, 0.78, z);
    box(world, 0.12, 0.72, d - 0.1, legs, x - w / 2 + 0.1, 0.38, z);
    box(world, 0.12, 0.72, d - 0.1, legs, x + w / 2 - 0.1, 0.38, z);
    solid(x, z, w, d);
  };
  const computer = (x: number, z: number, faceZ = 1) => {
    box(world, 0.09, 0.25, 0.09, '#33343a', x, 0.97, z);
    box(world, 0.75, 0.46, 0.05, '#33343a', x, 1.28, z);
    box(world, 0.67, 0.38, 0.02, '#a8d4f0', x, 1.28, z + 0.03 * faceZ);
    box(world, 0.5, 0.03, 0.2, '#d8d8d8', x, 0.86, z + 0.35 * faceZ);
  };
  const stool = (x: number, z: number, color: string, h = 0.5, yaw = 0, back = false) => {
    cyl(world, 0.26, 0.26, 0.1, color, x, h, z, 20);
    cyl(world, 0.05, 0.05, h - 0.05, '#444', x, (h - 0.05) / 2, z, 10);
    if (back) {
      const rest = box(world, 0.52, 0.5, 0.08, color, x - Math.sin(yaw) * 0.27, h + 0.3, z - Math.cos(yaw) * 0.27);
      rest.rotation.y = yaw;
    }
    seats.push({ x, z, top: h + 0.05, yaw });
  };
  const cubicle = (x: number, z: number, color: string) => {
    box(world, 3.1, 1.3, 0.16, color, x, 0.65, z + 1.5);
    box(world, 0.16, 1.3, 3.1, color, x + 1.5, 0.65, z);
    solid(x, z + 1.5, 3.1, 0.3);
    solid(x + 1.5, z, 0.3, 3.1);
    desk(x - 0.1, z - 0.2, 1.9, 0.9, CREAM);
    computer(x - 0.1, z - 0.4);
    stool(x - 0.1, z + 0.5, TOMATO, 0.5, Math.PI, true);
  };
  const sign = (text: string, bg: string, x: number, z: number, y = 6.2) => {
    const g = makeSign(text, bg);
    g.position.set(x, y, z);
    world.add(g);
  };
  const sofa = (x: number, z: number, w: number, color: string, rotY = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    box(g, w, 0.45, 1.1, color, 0, 0.3, 0);
    box(g, w, 0.7, 0.3, color, 0, 0.75, -0.45);
    box(g, 0.3, 0.6, 1.1, color, -w / 2 + 0.15, 0.55, 0);
    box(g, 0.3, 0.6, 1.1, color, w / 2 - 0.15, 0.55, 0);
    world.add(g);
    const slots = w >= 3 ? [-w / 4, w / 4] : [0];
    for (const ox of slots) {
      seats.push({ x: x + ox * Math.cos(rotY), z: z - ox * Math.sin(rotY), top: 0.55, yaw: rotY });
    }
    if (Math.abs(Math.sin(rotY)) > 0.5) solid(x, z, 1.1, w);
    else solid(x, z, w, 1.1);
  };

  // ---- ground, slab and floor zones ---------------------------------------
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 48), mat('#6f7782', 1));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -80;
  ground.userData.noCastShadow = true;
  world.add(ground);
  box(world, 52, 0.2, 52, '#ead9ae', 0, -0.1, 0);

  box(world, 20.5, 0.03, 25, '#b9cdee', 0, 0.015, 3);        // open-plan carpet
  cyl(world, 3.4, 3.4, 0.04, TOMATO, 0, 0.02, 0, 48);          // central rug
  cyl(world, 2.2, 2.2, 0.05, MUSTARD, 0, 0.025, 0, 48);
  box(world, 13.5, 0.03, 12, '#45bdb8', -17.75, 0.015, -3);     // lunch room tiles
  box(world, 13.5, 0.03, 12, '#cdb9e4', 17.75, 0.015, -3);      // copy room
  box(world, 16, 0.03, 11.5, '#d4dfa0', -16.5, 0.015, -18.75);  // meeting room
  box(world, 17, 0.03, 11.5, '#efd2ae', 0, 0.015, -18.75);      // manager office
  box(world, 16, 0.03, 11.5, '#e9a899', 16.5, 0.015, -18.75);   // boss office
  cyl(world, 3.2, 3.2, 0.04, '#a8322a', 16.5, 0.02, -19.5, 40); // boss rug

  // ---- perimeter: tall walls, window band, pillars --------------------------
  const addWall = (alongX: boolean, fixed: number, wallColor: string, pierColor: string) => {
    const len = 52;
    const t = 0.7;
    const at = (along: number, y: number) => (alongX ? [along, y, fixed] : [fixed, y, along]) as [number, number, number];
    const size = (l: number, h: number): [number, number, number] => (alongX ? [l, h, t] : [t, h, l]);
    box(world, ...size(len, 1.0), wallColor, ...at(0, 0.5));
    box(world, ...size(len, 1.0), wallColor, ...at(0, WALL_H - 0.5));
    const pane = place(new THREE.Mesh(new THREE.BoxGeometry(...size(len, WALL_H - 2)), glassWall), world, ...at(0, WALL_H / 2));
    pane.userData.noCastShadow = true;
    pane.userData.noCollide = true;
    for (const along of [-25.4, -17, -8.5, 0, 8.5, 17, 25.4]) {
      box(world, ...(alongX ? [1.2, WALL_H, t + 0.1] : [t + 0.1, WALL_H, 1.2]) as [number, number, number], pierColor, ...at(along, WALL_H / 2));
    }
    const inward = fixed > 0 ? -1 : 1;
    const bb = alongX ? [len - 1, 0.18, 0.1] : [0.1, 0.18, len - 1];
    box(world, ...(bb as [number, number, number]), '#f5f0e0', ...(alongX ? [0, 0.09, fixed + inward * 0.38] : [fixed + inward * 0.38, 0.09, 0]) as [number, number, number]);
  };
  addWall(true, -25, CHARTREUSE, MUSTARD);
  addWall(true, 25, TEAL, MUSTARD);
  addWall(false, -25, MUSTARD, CHARTREUSE);
  addWall(false, 25, CHARTREUSE, MUSTARD);

  const ceiling = place(new THREE.Mesh(new THREE.BoxGeometry(52, 0.3, 52), new THREE.MeshBasicMaterial({ color: '#f4eedb' })), world, 0, WALL_H + 0.15, 0);
  ceiling.userData.noCastShadow = true;

  // ---- back row: meeting room | manager office | boss corner office -------
  wallLine('x', -13, -24.5, -8.5, MUSTARD, [[-17, -14]]);
  wallLine('x', -13, -8.5, 8.5, TEAL, [[-1.5, 1.5]]);
  wallLine('x', -13, 8.5, 24.5, TOMATO, [[14.5, 17.5]]);
  wallLine('z', -8.5, -24.5, -13, MUSTARD, [], true);
  wallLine('z', 8.5, -24.5, -13, TOMATO, [], true);

  // meeting room: long table with stools, a screen on the back wall
  desk(-16.5, -19.5, 7, 2.2, NAVY, '#222');
  for (const dx of [-2.6, -0.9, 0.9, 2.6]) {
    stool(-16.5 + dx, -21.2, TOMATO, 0.45, 0);
    stool(-16.5 + dx, -17.8, TOMATO, 0.45, Math.PI);
  }
  box(world, 4, 2, 0.1, '#33343a', -16.5, 2.4, -24.55);
  box(world, 3.8, 1.8, 0.05, '#cfe8f7', -16.5, 2.4, -24.48);
  addPlant(world, -23, -14.5, MUSTARD);

  // manager office
  desk(0, -22, 3.4, 1.2, '#b8864f', '#8a5f35');
  computer(0, -22.2, 1);
  stool(0, -23.7, NAVY, 0.55, 0, true);
  stool(-1.2, -18.6, TEAL, 0.45, Math.PI);
  stool(1.2, -18.6, TEAL, 0.45, Math.PI);
  box(world, 2.2, 2.2, 0.5, '#8a5f35', -6.5, 1.1, -24.5);
  solid(-6.5, -24.4, 2.2, 0.6);
  addPlant(world, 7, -14.5, TEAL);

  // boss corner office: big desk, sofa, bookcase
  desk(16.5, -22.4, 4.4, 1.5, '#7a4a2a', '#5a3820');
  computer(16.5, -22.6, 1);
  box(world, 0.7, 0.05, 0.4, '#e8c34a', 18, 0.88, -22);
  stool(16.5, -24, '#7a1f4d', 0.6, 0, true);
  stool(15.2, -18.8, MUSTARD, 0.45, Math.PI);
  stool(17.8, -18.8, MUSTARD, 0.45, Math.PI);
  sofa(22.4, -17, 3, NAVY, -Math.PI / 2);
  box(world, 3, 2.6, 0.5, '#7a4a2a', 11.2, 1.3, -24.5);
  solid(11.2, -24.4, 3, 0.6);
  addPlant(world, 23, -23, TOMATO);

  // ---- middle row: lunch room (west) | copy room (east) --------------------
  wallLine('x', 3, -24.5, -11, TEAL, [], false);
  wallLine('z', -11, -9, 3, TEAL, [[-6.5, -1.5]], false);
  wallLine('x', -9, -24.5, -11, TEAL, [], false);
  wallLine('x', 3, 11, 24.5, '#8a5fc4', [], false);
  wallLine('z', 11, -9, 3, '#8a5fc4', [[-6.5, -1.5]], false);
  wallLine('x', -9, 11, 24.5, '#8a5fc4', [], false);

  // lunch room: counter, fridge, vending machine, coffee machine, tables
  box(world, 9, 0.9, 1, MUSTARD, -17.5, 0.45, -8.2);
  box(world, 9.1, 0.1, 1.1, CREAM, -17.5, 0.95, -8.2);
  solid(-17.5, -8.2, 9, 1);
  box(world, 1.2, 2.5, 1.1, TOMATO, -23.6, 1.25, -8.1);
  solid(-23.6, -8.1, 1.2, 1.1);
  box(world, 1.3, 2.3, 1.0, MUSTARD, -24, 1.15, -3);
  box(world, 0.9, 1.4, 0.05, '#cfe8f7', -23.45, 1.35, -3);
  solid(-24, -3, 1.3, 1.1);
  box(world, 0.5, 0.55, 0.45, '#2b2b33', -20.5, 1.28, -8.2);   // coffee machine on the counter
  box(world, 0.7, 0.06, 0.12, '#e8392b', -20.5, 1.6, -7.95);
  cyl(world, 0.35, 0.35, 0.06, CREAM, -15.5, 1.02, -8.2, 16);  // sink basin
  for (const [tx, tz] of [[-19.5, -2.5], [-15.5, -2.5], [-17.5, 0.8]] as [number, number][]) {
    cyl(world, 0.85, 0.85, 0.1, CREAM, tx, 0.8, tz, 32);
    cyl(world, 0.1, 0.1, 0.8, '#555', tx, 0.4, tz, 10);
    solid(tx, tz, 1.7, 1.7);
    for (const a of [0.4, 2.5, 4.6]) {
      const sx = tx + Math.cos(a) * 1.25;
      const sz = tz + Math.sin(a) * 1.25;
      stool(sx, sz, [NAVY, TOMATO, '#7a1f4d'][Math.floor(a) % 3], 0.45, Math.atan2(tx - sx, tz - sz));
    }
  }

  // copy room: big copier, printer, paper shelves and a collating table
  box(world, 2.4, 1.1, 1.3, '#e9e9ee', 18, 0.55, -7.9);
  box(world, 2.4, 0.18, 1.3, '#33343a', 18, 1.19, -7.9);
  box(world, 2.5, 0.06, 1.4, '#9fc0e8', 18, 1.31, -7.9);
  box(world, 0.7, 0.2, 0.05, '#4ac27a', 17, 1.0, -7.2);
  box(world, 0.5, 0.06, 0.12, '#e8392b', 18.6, 1.0, -7.2);
  solid(18, -7.9, 2.4, 1.3);
  box(world, 1.2, 0.8, 1.0, '#e9e9ee', 21.5, 0.4, -7.9);
  box(world, 1.1, 0.12, 0.8, '#33343a', 21.5, 0.86, -7.9);
  solid(21.5, -7.9, 1.2, 1);
  desk(15.5, -4.5, 3.2, 1.1, CREAM);
  for (let i = 0; i < 3; i++) box(world, 0.7, 0.14, 0.5, '#ffffff', 14.6 + i * 0.9, 0.9, -4.5);
  for (let i = 0; i < 4; i++) {
    box(world, 0.9, 0.55, 0.65, '#d9b88a', 24 - (i % 2) * 0.95, 0.28 + Math.floor(i / 2) * 0.56, -3.2 + (i % 2) * 0);
  }
  solid(23.6, -3.2, 1.9, 0.7);
  box(world, 2.6, 2.4, 0.5, '#c7cdd6', 22.5, 1.2, 0.0);
  solid(22.5, 0, 2.6, 0.6);

  // ---- center open-plan area: desks and computers --------------------------
  for (const z of [-5, 5]) {
    cubicle(-6, z, z < 0 ? NAVY : MUSTARD);
    cubicle(0, z, z < 0 ? TEAL : CHARTREUSE);
    cubicle(6, z, z < 0 ? TOMATO : NAVY);
  }
  addPlant(world, -9.5, -8.5, TOMATO);
  addPlant(world, 9.5, -8.5, MUSTARD);
  addPlant(world, 9.5, 9, TEAL);

  // ---- front: reception desk and two lounges --------------------------------
  desk(0, 17.5, 6, 1.4, MUSTARD, '#b58a0f');
  computer(0, 17.2, -1);
  stool(0, 18.8, TOMATO, 0.6, Math.PI, true);
  sofa(-17, 16.5, 4.2, NAVY, 0);
  sofa(17, 16.5, 4.2, TEAL, 0);
  desk(-17, 14.2, 1.6, 0.9, CREAM);
  desk(17, 14.2, 1.6, 0.9, CREAM);
  addPlant(world, -22, 17.5, MUSTARD);
  addPlant(world, 22, 17.5, TOMATO);
  addPlant(world, -9, 18.5, TEAL);
  addPlant(world, 9, 18.5, NAVY);
  cyl(world, 0.3, 0.3, 1.1, '#cfe8f7', 11.5, 0.55, 8, 20);   // water cooler
  box(world, 0.7, 0.9, 0.7, '#e9e9ee', 11.5, 0.45, 8);
  solid(11.5, 8, 0.7, 0.7);

  // ---- hanging signs ---------------------------------------------------------
  sign('MEETING ROOM', '#d89a12', -16.5, -13.4);
  sign('MANAGER', '#1f9d9a', 0, -13.4);
  sign('BOSS OFFICE', '#c8341f', 16.5, -13.4);
  sign('LUNCH ROOM', '#2a8f8b', -17.75, -3.5);
  sign('COPY ROOM', '#7a4cb8', 17.75, -3.5);
  sign('OPEN OFFICE', '#2a4d9b', 0, 0.5);

  // ---- ceiling lamps ----------------------------------------------------------
  const lampColors = [TOMATO, MUSTARD, TEAL, NAVY];
  let lampIdx = 0;
  for (const x of [-16, 0, 16]) {
    for (const z of [10, 21]) {
      const c = lampColors[lampIdx++ % lampColors.length];
      cyl(world, 0.02, 0.02, 1.2, '#333', x, WALL_H - 0.6, z, 6);
      const shade = cyl(world, 0.15, 0.6, 0.4, c, x, WALL_H - 1.4, z, 28);
      shade.userData.noCastShadow = true;
      const bulb = place(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8' })), world, x, WALL_H - 1.65, z);
      bulb.userData.noCastShadow = true;
    }
  }

  buildHighriseView(world, rand);

  // shadows everywhere except far scenery and glass
  world.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.receiveShadow = !o.userData.noShadow;
      o.castShadow = !o.userData.noShadow && !o.userData.noCastShadow;
    }
  });

  // Collision comes from the furniture itself: any solid mesh that reaches into the
  // walking zone (above the floor, below head height) blocks the player.
  world.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  world.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.noShadow || o.userData.noCollide) return;
    bounds.setFromObject(o);
    const w = bounds.max.x - bounds.min.x;
    const d = bounds.max.z - bounds.min.z;
    if (bounds.min.y >= 1.0 || bounds.max.y <= 0.3 || w > 14 || d > 14) return;
    colliders.push({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z });
  });

  scene.add(world);
  addClouds(scene);
  return { colliders, seats };
}
