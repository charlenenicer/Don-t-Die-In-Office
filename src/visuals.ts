import * as THREE from 'three';
import { dartPoints } from './activities';

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

// The open office is neutral grey; every room gets its own color.
const GREY_LIGHT = '#d8dbe0';
const GREY_MID = '#b4b9c0';
const GREY_DARK = '#8b929b';
const BLUE = '#2f6fdb';
const GREEN = '#43a85a';
const PURPLE = '#8a5fc4';

let tileBase: THREE.CanvasTexture | null = null;

/** A square floor tile with grout lines; tinted per room through the material color. */
function makeTileTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  // soft bevel so each tile reads as a separate piece
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, 'rgba(255,255,255,0.0)');
  g.addColorStop(1, 'rgba(0,0,0,0.07)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#b9bdc4';
  ctx.fillRect(0, 0, size, 5);
  ctx.fillRect(0, 0, 5, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function tiledFloor(parent: THREE.Object3D, w: number, d: number, x: number, z: number, tint: string, y = 0.015, h = 0.03) {
  tileBase ??= makeTileTexture();
  const tex = tileBase.clone();
  tex.needsUpdate = true;
  tex.repeat.set(w / 1.25, d / 1.25);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.3, metalness: 0.05 }),
  );
  mesh.userData.noCollide = true;
  mesh.userData.keep = true;
  return place(mesh, parent, x, y, z);
}

export type PlantKind = 'bush' | 'snake' | 'fig' | 'palm' | 'cactus' | 'fern' | 'monstera' | 'flowers';
const PLANT_KINDS: PlantKind[] = ['snake', 'fig', 'bush', 'palm', 'monstera', 'cactus', 'fern', 'flowers'];
// neutral pots for the grey open office; rooms pass their own color
const NEUTRAL_POTS = ['#8b929b', '#e9e4da', '#b07a52', '#5b6470', '#d8dbe0', '#c9b8a0'];
let plantCount = 0;

/**
 * A potted plant. Without a `kind` the plants cycle through every variety, and each
 * one gets its own pot shape, size and rotation so no two look alike.
 */
function addPlant(parent: THREE.Object3D, x: number, z: number, potColor: string, kind?: PlantKind) {
  const n = plantCount++;
  const type = kind ?? PLANT_KINDS[n % PLANT_KINDS.length];
  const rand = mulberry32(Math.round(x * 73 + z * 131) + n * 7919);
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rand() * Math.PI * 2;
  const s = 0.85 + rand() * 0.35; // overall size
  g.scale.setScalar(s);
  const pot = potColor === '#8b929b' ? NEUTRAL_POTS[n % NEUTRAL_POTS.length] : potColor;
  const leaf = ['#2f8a3c', '#3f9a46', '#277a3a', '#4f9f3a'][n % 4];
  const leafLight = ['#5fb84f', '#7fbf4a', '#6fae46'][n % 3];

  // pot: four shapes; `top` is where the soil sits
  let top = 0.55;
  switch (type === 'fern' || type === 'flowers' ? 'bowl' : ['round', 'square', 'tall', 'round'][n % 4]) {
    case 'square':
      box(g, 0.6, 0.55, 0.6, pot, 0, 0.28, 0);
      break;
    case 'tall':
      cyl(g, 0.3, 0.26, 0.85, pot, 0, 0.43, 0, 20);
      top = 0.85;
      break;
    case 'bowl':
      cyl(g, 0.45, 0.3, 0.38, pot, 0, 0.19, 0, 24);
      top = 0.38;
      break;
    default:
      cyl(g, 0.35, 0.27, 0.55, pot, 0, 0.28, 0, 20);
  }
  cyl(g, 0.3, 0.3, 0.03, '#4a3626', 0, top, 0, 16); // soil

  const leafAt = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, rx: number, ry: number, rz: number, c = leaf) => {
    const m = ball(g, 1, c, lx, ly, lz, sx, sy, sz);
    m.rotation.set(rx, ry, rz);
    return m;
  };

  switch (type) {
    case 'snake': // upright sword-shaped blades, two-tone
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const h = 0.8 + rand() * 0.7;
        const blade = box(g, 0.09, h, 0.025, i % 2 ? '#2f6b3a' : '#5b8f3a', Math.cos(a) * 0.12, top + h / 2, Math.sin(a) * 0.12);
        blade.rotation.set(Math.sin(a) * 0.15, -a, Math.cos(a) * 0.15);
      }
      break;
    case 'fig': // thin trunk with big paddle leaves up top
      cyl(g, 0.04, 0.05, 1.5, '#6b4e32', 0, top + 0.75, 0, 8);
      for (let i = 0; i < 16; i++) {
        const a = rand() * Math.PI * 2;
        const y = top + 0.9 + rand() * 0.9;
        const r = 0.15 + rand() * 0.3;
        leafAt(Math.cos(a) * r, y, Math.sin(a) * r, 0.17, 0.25, 0.04, rand() - 0.5, -a, rand() - 0.5, i % 3 ? leaf : leafLight);
      }
      break;
    case 'palm': // several stems with long drooping fronds
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rand() * 0.4;
        const h = 1.0 + rand() * 0.6;
        const stem = cyl(g, 0.018, 0.022, h, '#7a8f3a', Math.cos(a) * 0.12, top + h / 2, Math.sin(a) * 0.12, 6);
        stem.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
        const tipX = Math.cos(a) * (0.12 + h * 0.25);
        const tipZ = Math.sin(a) * (0.12 + h * 0.25);
        leafAt(tipX + Math.cos(a) * 0.3, top + h - 0.05, tipZ + Math.sin(a) * 0.3, 0.45, 0.03, 0.11, 0, -a, -0.45, i % 2 ? leaf : leafLight);
      }
      break;
    case 'cactus': // column with two arms and a pink flower
      cyl(g, 0.17, 0.19, 1.05, '#5d9b4a', 0, top + 0.52, 0, 14);
      ball(g, 0.17, '#5d9b4a', 0, top + 1.05, 0);
      for (const side of [-1, 1]) {
        const ay = top + 0.45 + (side > 0 ? 0.15 : 0);
        const arm = cyl(g, 0.09, 0.09, 0.22, '#5d9b4a', side * 0.24, ay, 0, 10);
        arm.rotation.z = Math.PI / 2;
        cyl(g, 0.09, 0.09, 0.32, '#5d9b4a', side * 0.33, ay + 0.16, 0, 10);
        ball(g, 0.09, '#5d9b4a', side * 0.33, ay + 0.32, 0);
      }
      ball(g, 0.07, '#ef6aa6', 0, top + 1.2, 0);
      break;
    case 'fern': // low arching fronds all around
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        leafAt(Math.cos(a) * 0.35, top + 0.28, Math.sin(a) * 0.35, 0.42, 0.04, 0.12, 0, -a, 0.55, i % 2 ? leafLight : leaf);
      }
      ball(g, 0.2, leafLight, 0, top + 0.2, 0);
      break;
    case 'monstera': // big round split leaves on long stems
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rand() * 0.3;
        const h = 0.55 + rand() * 0.55;
        const lx = Math.cos(a) * 0.32;
        const lz = Math.sin(a) * 0.32;
        const stem = cyl(g, 0.015, 0.015, h, '#4f7f3a', lx * 0.5, top + h / 2, lz * 0.5, 6);
        stem.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
        const big = cyl(g, 0.3, 0.3, 0.02, i % 2 ? '#2f7a3a' : '#3f8f42', lx, top + h, lz, 14);
        big.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      }
      break;
    case 'flowers': // leafy mound dotted with blooms
      ball(g, 0.38, leaf, 0, top + 0.25, 0, 1, 0.7, 1);
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2;
        const r = rand() * 0.3;
        ball(g, 0.07, ['#ef6aa6', '#f2c230', '#ffffff', '#e0452f'][(n + i) % 4], Math.cos(a) * r, top + 0.4 + rand() * 0.12, Math.sin(a) * r);
      }
      break;
    default: // 'bush': round clipped shrub
      ball(g, 0.5, leaf, 0, top + 0.45, 0, 1, 1.1, 1);
      ball(g, 0.36, leafLight, 0.25, top + 0.9, 0.1);
      ball(g, 0.3, '#237a36', -0.2, top + 0.95, -0.1);
  }
  parent.add(g);
  return g;
}

/** A tiny succulent for desk tops. */
function deskPlant(parent: THREE.Object3D, x: number, y: number, z: number, n: number) {
  const pots = ['#e9e4da', '#b07a52', '#5b6470', '#f2c230'];
  cyl(parent, 0.08, 0.06, 0.1, pots[n % pots.length], x, y + 0.05, z, 12);
  const green = ['#6fae8a', '#5d9b4a', '#8fbf6a'][n % 3];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = ball(parent, 0.05, green, x + Math.cos(a) * 0.04, y + 0.14, z + Math.sin(a) * 0.04, 0.6, 1.2, 0.6);
    m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
  }
  ball(parent, 0.04, green, x, y + 0.17, z);
}

/**
 * A rolling office chair: five-star base with casters, gas lift, cushion, curved back, arms.
 * Returns the swivel (seat, back and arms), which turns on the fixed base.
 */
function officeChair(parent: THREE.Object3D, x: number, z: number, color: string, seatH: number, yaw: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw; // faces +z before rotation
  const dark = '#2b2d33';
  const wheel = '#15161a';

  // five-star base with a caster at the end of every leg
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 + 0.3;
    const leg = box(g, 0.36, 0.035, 0.055, dark, Math.cos(a) * 0.18, 0.1, Math.sin(a) * 0.18);
    leg.rotation.y = -a;
    box(g, 0.035, 0.05, 0.035, dark, Math.cos(a) * 0.34, 0.075, Math.sin(a) * 0.34);
    const caster = ball(g, 0.045, wheel, Math.cos(a) * 0.34, 0.045, Math.sin(a) * 0.34, 0.8, 1, 1);
    caster.rotation.y = -a;
  }
  cyl(g, 0.07, 0.09, 0.07, dark, 0, 0.13, 0, 16);       // hub
  cyl(g, 0.035, 0.035, seatH - 0.2, '#9aa0a8', 0, (seatH + 0.0) / 2 + 0.03, 0, 12); // gas lift
  const swivel = new THREE.Group();
  g.add(swivel);
  box(swivel, 0.34, 0.04, 0.34, dark, 0, seatH - 0.06, 0);    // seat plate

  // cushioned seat and curved backrest
  ball(swivel, 0.27, color, 0, seatH - 0.01, 0.0, 1, 0.22, 1);
  const back = ball(swivel, 0.27, color, 0, seatH + 0.4, -0.24, 1, 1.15, 0.2);
  back.rotation.x = -0.12;
  box(swivel, 0.07, 0.34, 0.05, dark, 0, seatH + 0.12, -0.2).rotation.x = -0.12; // back support

  // armrests
  for (const side of [-1, 1]) {
    box(swivel, 0.04, 0.2, 0.04, dark, side * 0.3, seatH + 0.1, -0.02);
    box(swivel, 0.07, 0.035, 0.3, dark, side * 0.3, seatH + 0.21, -0.04);
  }
  parent.add(g);
  return swivel;
}

/** A football match on the lounge TV. */
function tvTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#3f9d4a' : '#46a852';
    ctx.fillRect(i * 40, 0, 40, 180);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 296, 156);
  ctx.beginPath();
  ctx.moveTo(160, 12);
  ctx.lineTo(160, 168);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(160, 90, 26, 0, Math.PI * 2);
  ctx.stroke();
  const players: [number, number, string][] = [[90, 60, '#e0452f'], [120, 110, '#e0452f'], [200, 80, '#2f6fdb'], [230, 130, '#2f6fdb'], [150, 70, '#e0452f']];
  for (const [x, y, c] of players) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(172, 92, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(10, 8, 92, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('RED 2 - 1 BLU', 16, 24);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Table football: wooden box, green pitch, eight spinning rods with players, and a ball. */
function foosball(parent: THREE.Object3D, x: number, z: number) {
  const wood = '#8a5f35';
  box(parent, 1.7, 0.3, 0.95, wood, x, 0.82, z);
  box(parent, 1.6, 0.02, 0.85, '#2f9e4f', x, 0.95, z);
  box(parent, 0.02, 0.022, 0.85, '#ffffff', x, 0.962, z);
  for (const dx of [-0.75, 0.75]) for (const dz of [-0.4, 0.4]) box(parent, 0.1, 0.68, 0.1, wood, x + dx, 0.34, z + dz);
  for (const dx of [-0.86, 0.86]) box(parent, 0.04, 0.12, 0.3, '#f2f2f2', x + dx, 0.9, z); // goals
  const rods: THREE.Group[] = [];
  const rodXs = [-0.68, -0.48, -0.25, -0.08, 0.08, 0.25, 0.48, 0.68];
  rodXs.forEach((rx, i) => {
    // each rod is a group along z, so turning it spins the little players around the rod
    const g = new THREE.Group();
    g.position.set(x + rx, 1.04, z);
    const team = i % 2 === 0 ? '#e0452f' : '#2f6fdb';
    cyl(g, 0.012, 0.012, 1.5, '#cfd3d8', 0, 0, 0, 8).rotation.x = Math.PI / 2;
    const handleSide = i % 2 === 0 ? -1 : 1;
    cyl(g, 0.035, 0.035, 0.16, '#1b1c20', 0, 0, handleSide * 0.82, 10).rotation.x = Math.PI / 2;
    const count = [1, 2, 3, 5][Math.min(3, Math.floor(Math.abs(rx) * 4))] ?? 3;
    for (let p = 0; p < count; p++) {
      const pz = (p - (count - 1) / 2) * (0.7 / Math.max(1, count));
      box(g, 0.05, 0.14, 0.05, team, 0, -0.04, pz);
    }
    parent.add(g);
    rods.push(g);
  });
  const puck = ball(parent, 0.035, '#ffffff', x, 0.985, z);
  return { rods, puck };
}

/** A ping-pong table with net, two paddles and a ball. */
function pingPong(parent: THREE.Object3D, x: number, z: number) {
  box(parent, 2.74, 0.05, 1.52, '#1f6f4a', x, 0.76, z);
  box(parent, 2.74, 0.052, 0.02, '#ffffff', x, 0.761, z);                   // centre line
  box(parent, 0.02, 0.052, 1.52, '#ffffff', x + 1.36, 0.761, z);
  box(parent, 0.02, 0.052, 1.52, '#ffffff', x - 1.36, 0.761, z);
  box(parent, 0.03, 0.15, 1.7, '#f2f2f2', x, 0.86, z);                       // net
  for (const dx of [-1.2, 1.2]) for (const dz of [-0.6, 0.6]) box(parent, 0.06, 0.73, 0.06, '#26292f', x + dx, 0.37, z + dz);
  const paddle = cyl(parent, 0.08, 0.08, 0.02, '#e0452f', x - 0.9, 0.8, z + 0.3, 16);
  cyl(parent, 0.08, 0.08, 0.02, '#2f6fdb', x + 0.9, 0.8, z - 0.3, 16);
  const pongBall = ball(parent, 0.025, '#f08a1c', x + 0.4, 0.82, z + 0.1);
  return { paddle, pongBall };
}

/** A four-legged dining chair with a slatted back. Faces +z before `yaw` is applied. */
function diningChair(parent: THREE.Object3D, x: number, z: number, color: string, yaw: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  const seatH = 0.47;
  box(g, 0.46, 0.05, 0.44, color, 0, seatH, 0);                       // seat
  for (const lx of [-0.19, 0.19]) {
    for (const lz of [-0.18, 0.18]) box(g, 0.045, seatH, 0.045, '#5a4632', lx, seatH / 2, lz); // legs
    box(g, 0.045, 0.5, 0.045, '#5a4632', lx, seatH + 0.25, -0.2);    // back posts
  }
  box(g, 0.44, 0.12, 0.04, color, 0, seatH + 0.42, -0.2);             // top rail
  box(g, 0.44, 0.06, 0.03, color, 0, seatH + 0.22, -0.2);             // middle slat
  parent.add(g);
  return g;
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
  /** id of the room the seat is in, or null in the open office (filled in by buildWorld) */
  room?: string | null;
  /** the turning part of a swivel office chair; seats without one can't spin */
  swivel?: THREE.Object3D;
}

/** A walled room. Its furniture lives in `interior`, shown only when the player is at or inside it. */
export interface Room {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  interior: THREE.Group;
  /** the wall (and sign) facing the camera; hidden while the player is inside */
  front: THREE.Object3D[];
}

export function roomAt(rooms: Room[], x: number, z: number, margin = 0): Room | null {
  return rooms.find((r) => x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin) ?? null;
}

/**
 * Something in the fun zone the player can do. The game owns the rules (see
 * activities.ts); the world owns where it is and how its props move.
 */
export interface ActivitySpot {
  id: 'foosball' | 'pingpong' | 'darts' | 'snacks' | 'drinks';
  /** where the white circle floats */
  marker: THREE.Vector3;
  /** where the player stands and which way they face */
  stand: { x: number; z: number; yaw: number };
  /** reset props when the activity starts */
  start?: () => void;
  /** move the props: seconds since start, whether it's running, the player's hand */
  animate: (elapsed: number, active: boolean, hand: THREE.Vector3) => void;
  /** extra line for the result toast, e.g. the darts score */
  result?: () => string;
}

export interface WorldData {
  colliders: Collider[];
  seats: Seat[];
  rooms: Room[];
  /** every partition wall piece, so the game can cut away any that block the camera */
  walls: THREE.Object3D[];
  activities: ActivitySpot[];
}

const WALL_H = 7;
const WALL_T = 0.25;
/** every wall, partition and pillar shares this grey; rooms keep their color around the doorway */
const WALL_GREY = GREY_MID;

/** A framed canvas painting, facing +z. Styles are simple procedural "office art". */
function makePainting(style: 'sunset' | 'blocks' | 'circles' | 'mountain', w: number, h: number, rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = Math.round(256 * (h / w));
  const cw = canvas.width;
  const ch = canvas.height;
  const ctx = canvas.getContext('2d')!;
  if (style === 'sunset') {
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#f6a05a');
    sky.addColorStop(0.6, '#f7d77a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(cw * 0.62, ch * 0.55, ch * 0.18, 0, Math.PI * 2);
    ctx.fill();
    for (const [y, c] of [[0.6, '#c0603e'], [0.72, '#8a3f3a'], [0.85, '#4f2a3a']] as [number, string][]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, ch);
      for (let x = 0; x <= cw; x += 16) ctx.lineTo(x, ch * y + Math.sin(x * 0.03 + y * 10) * ch * 0.05);
      ctx.lineTo(cw, ch);
      ctx.fill();
    }
  } else if (style === 'blocks') {
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(0, 0, cw, ch);
    const colors = ['#e0452f', '#2f6fdb', '#f2c230', '#f4f1e8', '#f4f1e8'];
    const xs = [0, cw * (0.25 + rand() * 0.2), cw * (0.65 + rand() * 0.15), cw];
    const ys = [0, ch * (0.3 + rand() * 0.2), ch * (0.7 + rand() * 0.1), ch];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.fillRect(xs[i], ys[j], xs[i + 1] - xs[i], ys[j + 1] - ys[j]);
      }
    }
    ctx.strokeStyle = '#1b1c20';
    ctx.lineWidth = 8;
    for (const x of xs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke(); }
    for (const y of ys) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }
  } else if (style === 'circles') {
    ctx.fillStyle = '#1f3b4d';
    ctx.fillRect(0, 0, cw, ch);
    const colors = ['#f2c230', '#e0452f', '#1f9d9a', '#efe4c4', '#f08a1c'];
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(rand() * cw, rand() * ch, ch * (0.08 + rand() * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else {
    const sky = ctx.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, '#8fc3e8');
    sky.addColorStop(1, '#dff0f8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cw, ch);
    for (const [cx, peak, c] of [[0.3, 0.25, '#47688f'], [0.7, 0.35, '#55769c'], [0.5, 0.45, '#3e5f86']] as [number, number, string][]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(cw * (cx - 0.45), ch);
      ctx.lineTo(cw * cx, ch * peak);
      ctx.lineTo(cw * (cx + 0.45), ch);
      ctx.fill();
      ctx.fillStyle = '#f1f5f8';
      ctx.beginPath();
      ctx.moveTo(cw * (cx - 0.08), ch * (peak + 0.14));
      ctx.lineTo(cw * cx, ch * peak);
      ctx.lineTo(cw * (cx + 0.08), ch * (peak + 0.14));
      ctx.fill();
    }
    ctx.fillStyle = '#4f9a5c';
    ctx.fillRect(0, ch * 0.88, cw, ch * 0.12);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.06), mat('#3a3128')));
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  art.position.z = 0.031;
  group.add(art);
  group.traverse((o) => { o.userData.noCastShadow = true; });
  return group;
}

/** A glowing neon slogan on a clear backer, facing +z. */
function makeNeon(text: string, color: string, h = 1.1): THREE.Group {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `italic 800 96px 'Avenir Next', 'Segoe UI', Arial, sans-serif`;
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 80;
  canvas.height = 160;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // a wide soft glow, then the tube itself with a white-hot core
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.lineWidth = 14;
  ctx.strokeStyle = color;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.8;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = h * (canvas.width / canvas.height);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  glow.position.z = 0.03;
  group.add(glow);
  const backer = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.92, h * 0.8, 0.02),
    new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.1 }),
  );
  group.add(backer);
  group.traverse((o) => { o.userData.noCastShadow = true; });
  return group;
}


function makeSign(text: string, bg: string, w = 5, h = 1.2, hanging = true): THREE.Group {
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
  for (const dx of hanging ? [-w / 2 + 0.4, w / 2 - 0.4] : []) {
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

  view.userData.keep = true;
  view.traverse((o) => { o.userData.noShadow = true; });
  world.add(view);
}

export function buildWorld(scene: THREE.Scene): WorldData {
  const world = new THREE.Group();
  const rand = mulberry32(42);
  const colliders: Collider[] = [];
  const seats: Seat[] = [];
  const activities: ActivitySpot[] = [];
  const solid = (x: number, z: number, w: number, d: number) => {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  };
  const glassWall = new THREE.MeshStandardMaterial({ color: '#a9dcf2', transparent: true, opacity: 0.2, roughness: 0.1 });

  // ---- helpers that need the collider list --------------------------------

  /** A partition: low colored base, glass above (optional), with doorway gaps. */
  const allWalls: THREE.Object3D[] = [];
  const wallLine = (
    axis: 'x' | 'z', fixed: number, from: number, to: number, color: string,
    gaps: [number, number][] = [], collect?: THREE.Object3D[],
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
    const before = world.children.length;
    for (const [a, b] of segs) {
      const len = b - a;
      const m = (a + b) / 2;
      box(world, ...dims(len, WALL_H), WALL_GREY, ...pos(m, WALL_H / 2));
      if (axis === 'x') solid(m, fixed, len, WALL_T + 0.1);
      else solid(fixed, m, WALL_T + 0.1, len);
    }
    // each doorway: grey wall above it, framed in the room's color so rooms are easy to tell apart
    const DOOR_H = 3.2;
    const FRAME = 0.24;
    const frameDims = (l: number, h: number): [number, number, number] => (axis === 'x' ? [l, h, WALL_T + 0.06] : [WALL_T + 0.06, h, l]);
    for (const [g0, g1] of sorted) {
      box(world, ...dims(g1 - g0, WALL_H - DOOR_H), WALL_GREY, ...pos((g0 + g1) / 2, DOOR_H + (WALL_H - DOOR_H) / 2));
      box(world, ...frameDims(FRAME, DOOR_H + FRAME), color, ...pos(g0 - FRAME / 2, (DOOR_H + FRAME) / 2));
      box(world, ...frameDims(FRAME, DOOR_H + FRAME), color, ...pos(g1 + FRAME / 2, (DOOR_H + FRAME) / 2));
      box(world, ...frameDims(g1 - g0 + FRAME * 2, FRAME), color, ...pos((g0 + g1) / 2, DOOR_H + FRAME / 2));
    }
    for (let i = before; i < world.children.length; i++) {
      world.children[i].userData.keep = true;
      allWalls.push(world.children[i]);
      collect?.push(world.children[i]);
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
    let swivel: THREE.Object3D | undefined;
    if (back) {
      swivel = officeChair(world, x, z, color, h, yaw);
    } else {
      cyl(world, 0.26, 0.26, 0.1, color, x, h, z, 20);
      cyl(world, 0.05, 0.05, h - 0.05, '#444', x, (h - 0.05) / 2, z, 10);
    }
    seats.push({ x, z, top: h + 0.05, yaw, swivel });
  };
  /** A row of desks pushed side by side, each with a computer and a chair. */
  const deskRow = (z: number, count: number, chairColors: string[]) => {
    const width = 2;
    const startX = -((count - 1) * width) / 2;
    const tops = ['#eceef1', '#dfe2e6'];
    for (let i = 0; i < count; i++) {
      const x = startX + i * width;
      box(world, width, 0.12, 0.9, tops[i % 2], x, 0.78, z - 0.2);
      box(world, 0.1, 0.72, 0.8, '#6d6a62', x - width / 2 + 0.05, 0.38, z - 0.2);
      computer(x, z - 0.4);
      stool(x, z + 0.5, chairColors[i % chairColors.length], 0.5, Math.PI, true);
    }
    box(world, 0.1, 0.72, 0.8, '#6d6a62', startX + (count - 1) * width + width / 2 - 0.05, 0.38, z - 0.2);
    solid(0, z - 0.2, count * width, 0.9);
  };
  const sign = (text: string, bg: string, x: number, z: number, y = 6.2) => {
    const g = makeSign(text, bg);
    g.position.set(x, y, z);
    world.add(g);
    return g;
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
  ground.userData.keep = true;
  world.add(ground);
  box(world, 52, 0.2, 52, '#8b929b', 0, -0.1, 0);
  tiledFloor(world, 52, 52, 0, 0, '#e4e7eb', 0.005, 0.01);              // whole floor: light grey tiles
  tiledFloor(world, 20.5, 25, 0, 3, '#cdd2d8');                          // open-plan zone, slightly darker
  cyl(world, 3.4, 3.4, 0.04, '#9ea5ae', 0, 0.02, 0, 48);                 // central rug
  cyl(world, 2.2, 2.2, 0.05, '#bcc2c9', 0, 0.025, 0, 48);
  tiledFloor(world, 13.5, 12, -17.75, -3, '#a6dcb0');                    // lunch room: green
  tiledFloor(world, 13.5, 12, 17.75, -3, '#cdb8ee');                     // copy room: purple
  tiledFloor(world, 16, 11.5, -16.5, -18.75, '#f6dc7e');                 // meeting room: yellow
  tiledFloor(world, 17, 11.5, 0, -18.75, '#a5c2f2');                     // manager office: blue
  tiledFloor(world, 16, 11.5, 16.5, -18.75, '#f2a094');                  // boss office: red
  cyl(world, 3.2, 3.2, 0.04, '#a8322a', 16.5, 0.02, -19.5, 40);          // boss rug

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
  addWall(true, -25, WALL_GREY, WALL_GREY);
  addWall(true, 25, WALL_GREY, WALL_GREY);
  addWall(false, -25, WALL_GREY, WALL_GREY);
  addWall(false, 25, WALL_GREY, WALL_GREY);
  for (const o of world.children) o.userData.keep = true; // everything so far is structure, never a room's contents

  for (const o of world.children) o.userData.keep = true;

  const ceiling = place(new THREE.Mesh(new THREE.BoxGeometry(52, 0.3, 52), new THREE.MeshBasicMaterial({ color: '#eef0f2' })), world, 0, WALL_H + 0.15, 0);
  ceiling.userData.noCastShadow = true;

  // ---- back row: meeting room | manager office | boss corner office -------
  const front: Record<string, THREE.Object3D[]> = { meeting: [], manager: [], boss: [], lunch: [], copy: [] };
  wallLine('x', -13, -24.5, -8.5, MUSTARD, [[-17, -14]], front.meeting);
  wallLine('x', -13, -8.5, 8.5, BLUE, [[-1.5, 1.5]], front.manager);
  wallLine('x', -13, 8.5, 24.5, TOMATO, [[14.5, 17.5]], front.boss);
  wallLine('z', -8.5, -24.5, -13, MUSTARD);   // meeting | manager
  wallLine('z', 8.5, -24.5, -13, BLUE);       // manager | boss

  // meeting room: long table with stools, a screen on the back wall
  desk(-16.5, -19.5, 7, 2.2, '#c98f0f', '#7a560a');
  for (const dx of [-2.6, -0.9, 0.9, 2.6]) {
    stool(-16.5 + dx, -21.2, MUSTARD, 0.45, 0);
    stool(-16.5 + dx, -17.8, MUSTARD, 0.45, Math.PI);
  }
  box(world, 4, 2, 0.1, '#33343a', -16.5, 2.4, -24.55);
  box(world, 3.8, 1.8, 0.05, '#cfe8f7', -16.5, 2.4, -24.48);
  addPlant(world, -23, -14.5, MUSTARD);

  // manager office
  desk(0, -22, 3.4, 1.2, '#9db8e6', '#2a55a8');
  computer(0, -22.2, 1);
  stool(0, -23.7, BLUE, 0.55, 0, true);
  stool(-1.2, -18.6, BLUE, 0.45, Math.PI);
  stool(1.2, -18.6, BLUE, 0.45, Math.PI);
  box(world, 2.2, 2.2, 0.5, '#2a55a8', -6.5, 1.1, -24.5);
  solid(-6.5, -24.4, 2.2, 0.6);
  addPlant(world, 7, -14.5, BLUE);

  // boss corner office: big desk, sofa, bookcase
  desk(16.5, -22.4, 4.4, 1.5, '#d9503a', '#8a2418');
  computer(16.5, -22.6, 1);
  box(world, 0.7, 0.05, 0.4, '#e8c34a', 18, 0.88, -22);
  stool(16.5, -24, '#a8322a', 0.6, 0, true);
  stool(15.2, -18.8, TOMATO, 0.45, Math.PI);
  stool(17.8, -18.8, TOMATO, 0.45, Math.PI);
  sofa(22.4, -17, 3, '#b8321f', -Math.PI / 2);
  box(world, 3, 2.6, 0.5, '#8a2418', 11.2, 1.3, -24.5);
  solid(11.2, -24.4, 3, 0.6);
  addPlant(world, 23, -23, TOMATO);

  // ---- middle row: lunch room (west) | copy room (east) --------------------
  wallLine('x', 3, -24.5, -11, GREEN, [], front.lunch);
  wallLine('z', -11, -9, 3, GREEN, [[-6.5, -1.5]]);
  wallLine('x', -9, -24.5, -11, GREEN);
  wallLine('x', 3, 11, 24.5, PURPLE, [], front.copy);
  wallLine('z', 11, -9, 3, PURPLE, [[-6.5, -1.5]]);
  wallLine('x', -9, 11, 24.5, PURPLE);

  // lunch room: counter, fridge, vending machine, coffee machine, tables
  box(world, 9, 0.9, 1, GREEN, -17.5, 0.45, -8.2);
  box(world, 9.1, 0.1, 1.1, CREAM, -17.5, 0.95, -8.2);
  solid(-17.5, -8.2, 9, 1);
  // refrigerator: freezer door on top, fridge door below, long handles, magnets
  box(world, 1.2, 2.5, 1.1, '#eef0f2', -23.6, 1.25, -8.1);
  box(world, 1.12, 0.78, 0.05, '#e2e5e8', -23.6, 2.05, -7.53);   // freezer door
  box(world, 1.12, 1.55, 0.05, '#e9ecef', -23.6, 0.82, -7.53);   // fridge door
  box(world, 1.2, 0.04, 0.06, '#8a9099', -23.6, 1.67, -7.52);    // door seam
  box(world, 0.06, 0.5, 0.08, '#8a9099', -23.15, 2.05, -7.46);   // freezer handle
  box(world, 0.06, 0.9, 0.08, '#8a9099', -23.15, 1.1, -7.46);    // fridge handle
  box(world, 0.14, 0.14, 0.02, TOMATO, -23.95, 1.9, -7.49);      // magnets
  box(world, 0.14, 0.14, 0.02, MUSTARD, -23.75, 1.6, -7.49);
  box(world, 0.3, 0.36, 0.02, '#fffbe6', -23.9, 1.35, -7.49);    // note
  solid(-23.6, -8.1, 1.2, 1.1);

  // vending machine: glass front with snack rows, keypad, coin slot, dispenser
  box(world, 1.3, 2.3, 1.0, '#2f8a47', -24, 1.15, -3);
  box(world, 0.04, 1.35, 0.66, '#1c2b33', -23.33, 1.5, -3.14);   // window backing
  const snackColors = [TOMATO, MUSTARD, '#2f6fdb', '#f08a1c', '#8a5fc4'];
  for (let row = 0; row < 4; row++) {
    box(world, 0.08, 0.03, 0.62, '#aeb4bb', -23.34, 0.98 + row * 0.33, -3.14);   // shelf
    for (let col = 0; col < 4; col++) {
      box(world, 0.1, 0.2, 0.1, snackColors[(row + col) % snackColors.length], -23.36, 1.1 + row * 0.33, -3.37 + col * 0.15);
    }
  }
  const glass = box(world, 0.03, 1.35, 0.66, '#cfe8f7', -23.31, 1.5, -3.14);     // glass
  (glass.material as THREE.MeshStandardMaterial) = new THREE.MeshStandardMaterial({ color: '#cfe8f7', transparent: true, opacity: 0.22, roughness: 0.1 });
  glass.userData.noCastShadow = true;
  box(world, 0.05, 0.62, 0.24, '#26292f', -23.32, 1.6, -2.52);                    // keypad panel
  for (let i = 0; i < 6; i++) box(world, 0.03, 0.07, 0.07, '#d8dce0', -23.29, 1.8 - Math.floor(i / 2) * 0.12, -2.58 + (i % 2) * 0.12);
  box(world, 0.04, 0.12, 0.2, '#e8392b', -23.3, 1.28, -2.52);                      // coin slot
  box(world, 0.05, 0.3, 0.66, '#101114', -23.32, 0.42, -3.14);                    // dispenser flap
  box(world, 0.62, 0.22, 0.9, '#f2c230', -23.99, 2.42, -3);                       // lit header sign
  solid(-24, -3, 1.3, 1.1);
  box(world, 0.5, 0.55, 0.45, '#2b2b33', -20.5, 1.28, -8.2);   // coffee machine on the counter
  box(world, 0.7, 0.06, 0.12, '#e8392b', -20.5, 1.6, -7.95);

  // sink: stainless basin set into the counter, with a faucet and two taps
  box(world, 0.8, 0.02, 0.6, '#b8bec6', -15.5, 1.006, -8.2);
  box(world, 0.66, 0.022, 0.44, '#6f767f', -15.5, 1.008, -8.17);
  cyl(world, 0.04, 0.04, 0.34, '#c9ced5', -15.5, 1.17, -8.52, 10);        // faucet post
  const spout = cyl(world, 0.03, 0.03, 0.26, '#c9ced5', -15.5, 1.33, -8.4, 10);
  spout.rotation.x = Math.PI / 2;
  for (const dx of [-0.18, 0.18]) cyl(world, 0.035, 0.035, 0.08, dx < 0 ? '#2f6fdb' : TOMATO, -15.5 + dx, 1.05, -8.52, 10);

  // microwave: body, dark glass door, control panel, handle
  box(world, 0.62, 0.36, 0.42, '#eceef1', -18.2, 1.18, -8.25);
  box(world, 0.4, 0.26, 0.02, '#1c2126', -18.3, 1.18, -8.03);             // door window
  box(world, 0.14, 0.28, 0.02, '#3a3f46', -17.98, 1.18, -8.03);           // control panel
  box(world, 0.08, 0.03, 0.012, '#4ac27a', -17.98, 1.27, -8.02);          // clock display
  for (let i = 0; i < 3; i++) box(world, 0.08, 0.025, 0.012, '#cfd3d8', -17.98, 1.2 - i * 0.05, -8.02);
  box(world, 0.025, 0.2, 0.03, '#8a9099', -18.09, 1.18, -8.01);           // handle

  // dining tables: two rows of three, four chairs each, facing the table
  const chairColors = ['#2f8a47', GREEN, '#6fcf82'];
  let chairN = 0;
  for (const tz of [-4.6, -0.6]) {
    for (const tx of [-21.2, -18, -14.8]) {
      box(world, 1.05, 0.06, 1.05, CREAM, tx, 0.76, tz);                    // table top
      for (const lx of [-0.45, 0.45]) for (const lz of [-0.45, 0.45]) box(world, 0.06, 0.73, 0.06, '#5a4632', tx + lx, 0.365, tz + lz);
      for (const [dx, dz] of [[0, -0.85], [0, 0.85], [-0.85, 0], [0.85, 0]] as [number, number][]) {
        const cx = tx + dx;
        const cz = tz + dz;
        const yaw = Math.atan2(-dx, -dz); // face the table
        diningChair(world, cx, cz, chairColors[chairN++ % chairColors.length], yaw);
        seats.push({ x: cx, z: cz, top: 0.52, yaw });
      }
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
  deskRow(-5, 6, [GREY_DARK, '#a0a6ae', '#767d86']);
  deskRow(5, 6, ['#a0a6ae', GREY_DARK, '#767d86']);
  addPlant(world, -9.5, -8.5, GREY_DARK);
  addPlant(world, 9.5, -8.5, GREY_DARK);
  addPlant(world, 6.9, 9.0, GREY_DARK);

  // ---- front: reception desk where the player starts --------------------------
  desk(0, 14.5, 4.5, 0.9, GREY_LIGHT, GREY_DARK);
  box(world, 4.5, 0.72, 0.06, '#5b6470', 0, 0.42, 14.96);                  // front panel facing the entrance
  const receptionPanel = makeSign('RECEPTION', '#5b6470', 2.4, 0.42, false);
  receptionPanel.position.set(0, 0.5, 15.0);
  world.add(receptionPanel);
  computer(0.9, 14.55, -1);                                                // screen faces the receptionist
  // desk phone: base, keypad, handset, a red line light
  box(world, 0.34, 0.08, 0.26, '#26292f', -1.1, 0.88, 14.45);
  box(world, 0.16, 0.012, 0.12, '#cfd3d8', -1.04, 0.925, 14.52);
  const handset = place(new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.26, 4, 8), mat('#26292f')), world, -1.18, 0.95, 14.42);
  handset.rotation.z = Math.PI / 2;
  box(world, 0.03, 0.02, 0.03, '#e8392b', -0.97, 0.93, 14.36);
  officeChair(world, 0, 13.6, GREY_DARK, 0.6, 0);                          // receptionist's chair (not a player seat)
  addPlant(world, -3.6, 14.4, GREY_DARK);
  addPlant(world, 3.6, 14.4, GREY_DARK);

  // waiting area on the left
  sofa(-17, 16.5, 4.2, GREY_DARK, 0);
  desk(-17, 14.2, 1.6, 0.9, CREAM);
  addPlant(world, -22, 17.5, GREY_DARK);
  addPlant(world, -9, 18.5, GREY_DARK);
  cyl(world, 0.3, 0.3, 1.1, '#cfe8f7', -9.5, 0.55, 11, 20);   // water cooler
  box(world, 0.7, 0.9, 0.7, '#e9e9ee', -9.5, 0.45, 11);

  // ---- lounge just to the right of reception: TV and sofas -------------------------
  cyl(world, 3.3, 3.3, 0.04, '#7a8fa8', 10, 0.02, 12.2, 48);               // rug
  box(world, 3.4, 0.5, 0.6, GREY_DARK, 10, 0.25, 9.4);                     // media console
  box(world, 0.12, 0.55, 0.12, '#26292f', 10, 0.78, 9.4);                  // TV neck
  box(world, 3.1, 1.8, 0.12, '#1b1c20', 10, 1.9, 9.4);                     // TV
  const tv = new THREE.Mesh(new THREE.PlaneGeometry(2.92, 1.62), new THREE.MeshBasicMaterial({ map: tvTexture() }));
  tv.position.set(10, 1.9, 9.47);
  tv.userData.noCastShadow = true;
  world.add(tv);
  sofa(10, 14.6, 3.8, '#5b7fae', Math.PI);                                 // main sofa, facing the TV
  sofa(13.4, 12, 2.4, '#5b7fae', -Math.PI / 2);                            // side sofa
  desk(10, 12.2, 1.8, 0.8, '#eceef1', GREY_DARK);                          // coffee table
  cyl(world, 0.12, 0.1, 0.1, '#f2f2f2', 9.5, 0.89, 12.2, 16);              // mug
  box(world, 0.35, 0.03, 0.25, '#e0452f', 10.4, 0.85, 12.1);               // magazine

  // ---- fun zone on the right: table football, ping-pong, darts, drinks, snack bar ------
  tiledFloor(world, 11, 17.4, 19.1, 11.9, '#f7c58c');
  // table football: rods spin and the ball zips around while you play
  const foos = foosball(world, 17.6, 9.8);
  activities.push({
    id: 'foosball',
    marker: new THREE.Vector3(17.6, 1.55, 9.8),
    stand: { x: 17.6, z: 11.0, yaw: Math.PI },
    animate: (e, active) => {
      foos.rods.forEach((rod, i) => {
        const target = active ? Math.sin(e * 7 + i * 1.3) * 0.8 : 0;
        rod.rotation.z += (target - rod.rotation.z) * 0.25;
      });
      if (active) foos.puck.position.set(17.6 + Math.sin(e * 2.6) * 0.65, 0.985, 9.8 + Math.sin(e * 4.1) * 0.3);
      else foos.puck.position.set(17.6, 0.985, 9.8);
    },
  });

  // ping-pong: the red paddle moves to your hand and the ball rallies end to end
  const pong = pingPong(world, 18.5, 5.6);
  const paddleHome = pong.paddle.position.clone();
  activities.push({
    id: 'pingpong',
    marker: new THREE.Vector3(18.5, 1.45, 5.6),
    stand: { x: 16.7, z: 5.6, yaw: Math.PI / 2 },
    animate: (e, active, hand) => {
      if (!active) {
        pong.paddle.position.copy(paddleHome);
        pong.paddle.rotation.set(0, 0, 0);
        pong.pongBall.position.set(18.9, 0.82, 5.7);
        return;
      }
      pong.paddle.position.copy(hand);
      pong.paddle.rotation.set(0, 0, Math.PI / 2 + Math.sin(e * 6) * 0.3);
      const phase = (e * 1.1) % 2;
      const u = phase < 1 ? phase : 2 - phase;                              // 0 = your end, 1 = far end
      pong.pongBall.position.set(18.5 - 1.25 + u * 2.5, 0.8 + Math.abs(Math.sin(u * Math.PI * 2)) * 0.32, 5.6 + Math.sin(e * 1.7) * 0.4);
    },
  });

  // darts: three throws that stick in the board and get scored
  const board = new THREE.Vector3(13.6, 1.75, 3.2);
  const dartboard = cyl(world, 0.42, 0.42, 0.05, '#1b1c20', board.x, board.y, 3.17, 32);
  dartboard.rotation.x = Math.PI / 2;
  for (const [r, c] of [[0.36, '#e8e2cf'], [0.26, '#2f9e4f'], [0.17, '#e8e2cf'], [0.07, '#e0452f']] as [number, string][]) {
    const ring = cyl(world, r, r, 0.02, c, board.x, board.y, 3.2 + (0.42 - r) * 0.02, 32);
    ring.rotation.x = Math.PI / 2;
  }
  const darts: THREE.Group[] = [];
  const dartTargets: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new THREE.Group();
    cyl(d, 0.012, 0.006, 0.16, '#cfd3d8', 0, 0, 0, 6).rotation.x = Math.PI / 2;     // barrel along z
    box(d, 0.07, 0.002, 0.05, ['#e0452f', '#2f6fdb', '#f2c230'][i], 0, 0, 0.09);   // flights
    box(d, 0.002, 0.07, 0.05, ['#e0452f', '#2f6fdb', '#f2c230'][i], 0, 0, 0.09);
    d.visible = false;
    world.add(d);
    darts.push(d);
  }
  activities.push({
    id: 'darts',
    marker: new THREE.Vector3(13.6, 2.45, 3.6),
    stand: { x: 13.6, z: 6.4, yaw: Math.PI },
    start: () => {
      dartTargets.length = 0;
      for (let i = 0; i < 3; i++) {
        // aim for the bull: closer throws are more likely
        const r = Math.pow(Math.random(), 0.8) * 0.4;
        const a = Math.random() * Math.PI * 2;
        dartTargets.push(new THREE.Vector3(board.x + Math.cos(a) * r, board.y + Math.sin(a) * r, board.z + 0.1));
      }
      darts.forEach((d) => { d.visible = false; });
    },
    animate: (e, active, hand) => {
      if (!active) return; // darts stay stuck in the board until the next game
      darts.forEach((d, i) => {
        const throwAt = 0.5 + i * 1.0;
        const target = dartTargets[i];
        if (!target) return;
        if (e < throwAt - 0.5) { d.visible = false; return; }
        d.visible = true;
        if (e < throwAt) { d.position.copy(hand); d.lookAt(target); d.rotateY(Math.PI); return; }
        const u = Math.min(1, (e - throwAt) / 0.35);
        d.position.lerpVectors(hand, target, u);
        d.position.y += Math.sin(u * Math.PI) * 0.25;
        d.lookAt(target);
        d.rotateY(Math.PI); // flights point back toward the thrower
      });
    },
    result: () => {
      const pts = dartTargets.map((t) => dartPoints(Math.hypot(t.x - board.x, t.y - board.y)));
      return `${pts.join(' + ')} = ${pts.reduce((a, b) => a + b, 0)} points`;
    },
  });

  // snack bar counter with stools
  box(world, 0.9, 1.05, 4.0, '#f08a1c', 21, 0.52, 17);
  box(world, 1.1, 0.06, 4.1, CREAM, 21, 1.08, 17);
  const snackPanel = makeSign('SNACK BAR', '#c96a0c', 2.6, 0.5, false);
  snackPanel.position.set(20.53, 0.6, 17);
  snackPanel.rotation.y = -Math.PI / 2;
  world.add(snackPanel);
  const jarGlass = new THREE.MeshStandardMaterial({ color: '#dff1f7', transparent: true, opacity: 0.35, roughness: 0.1 });
  for (const [jz, c] of [[15.5, TOMATO], [16.1, MUSTARD], [16.7, '#2f6fdb']] as [number, string][]) {
    cyl(world, 0.09, 0.09, 0.16, c, 21, 1.19, jz, 12);                       // candy
    const jar = place(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 16), jarGlass), world, 21, 1.26, jz);
    jar.userData.noCastShadow = true;
    cyl(world, 0.125, 0.125, 0.04, '#26292f', 21, 1.43, jz, 16);             // lid
  }
  for (let i = 0; i < 4; i++) {                                              // chip bags
    const bag = box(world, 0.06, 0.3, 0.22, [TOMATO, '#2f6fdb', GREEN, MUSTARD][i], 21.1, 1.26, 17.5 + i * 0.28);
    bag.rotation.z = 0.12;
  }
  ball(world, 0.22, '#f2f2f2', 21, 1.13, 18.7, 1, 0.45, 1);                  // fruit bowl
  for (const [fx, fz, c] of [[-0.06, -0.05, TOMATO], [0.07, 0.04, MUSTARD], [0.0, 0.09, GREEN]] as [number, number, string][]) {
    ball(world, 0.07, c, 21 + fx, 1.23, 18.7 + fz);
  }
  for (const z of [15.6, 17, 18.4]) stool(19.9, z, MUSTARD, 0.75, Math.PI / 2);
  const snack = box(world, 0.16, 0.22, 0.06, TOMATO, 21, 1.25, 16.3);
  snack.visible = false;
  const snackFrom = new THREE.Vector3(21, 1.25, 16.3);
  activities.push({
    id: 'snacks',
    marker: new THREE.Vector3(21, 1.75, 16.3),
    stand: { x: 19.2, z: 16.3, yaw: Math.PI / 2 },
    start: () => {
      (snack.material as THREE.MeshStandardMaterial) = mat([TOMATO, '#2f6fdb', GREEN, MUSTARD][Math.floor(Math.random() * 4)]);
      snack.scale.setScalar(1);
    },
    animate: (e, active, hand) => {
      snack.visible = active && e < 2.8;
      if (!snack.visible) return;
      if (e < 0.6) snack.position.lerpVectors(snackFrom, hand, e / 0.6);
      else {
        snack.position.copy(hand);
        snack.position.y += 0.15 + Math.abs(Math.sin(e * 6)) * 0.08;       // munching
        snack.scale.setScalar(Math.max(0.3, 1 - Math.max(0, e - 1.8)));     // bag empties
      }
    },
  });

  // drinks fridge on the wall beside the bar: glass door full of bottles; the door swings open
  const FZ = 12.8;
  box(world, 0.8, 2.1, 1.1, '#d93a2b', 24.2, 1.05, FZ);
  box(world, 0.04, 1.6, 0.9, '#1c2b33', 23.8, 1.0, FZ);
  const bottleColors = ['#f2c230', '#e0452f', '#43a85a', '#2f6fdb', '#f08a1c', '#ffffff'];
  for (let row = 0; row < 4; row++) {
    box(world, 0.06, 0.02, 0.86, '#aeb4bb', 23.76, 0.3 + row * 0.4, FZ);
    for (let col = 0; col < 5; col++) {
      cyl(world, 0.045, 0.045, 0.24, bottleColors[(row * 2 + col) % bottleColors.length], 23.74, 0.44 + row * 0.4, FZ - 0.34 + col * 0.17, 10);
    }
  }
  const door = new THREE.Group();          // hinged on its +z edge
  door.position.set(23.72, 1.0, FZ + 0.45);
  const fridgeGlass = place(new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.6, 0.9), new THREE.MeshStandardMaterial({ color: '#cfe8f7', transparent: true, opacity: 0.2, roughness: 0.05 })), door, 0, 0, -0.45);
  fridgeGlass.userData.noCastShadow = true;
  box(door, 0.05, 0.6, 0.05, '#d8dce0', -0.02, 0, -0.82);                   // handle
  world.add(door);
  const drinksPanel = makeSign('DRINKS', '#b8321f', 1.0, 0.32, false);
  drinksPanel.position.set(23.78, 1.92, FZ);
  drinksPanel.rotation.y = -Math.PI / 2;
  world.add(drinksPanel);
  const bottle = new THREE.Group();
  cyl(bottle, 0.045, 0.045, 0.24, '#43a85a', 0, 0, 0, 10);
  cyl(bottle, 0.02, 0.03, 0.06, '#43a85a', 0, 0.15, 0, 8);
  cyl(bottle, 0.022, 0.022, 0.02, '#f2f2f2', 0, 0.19, 0, 8);
  bottle.visible = false;
  world.add(bottle);
  const bottleFrom = new THREE.Vector3(23.6, 1.24, FZ);
  activities.push({
    id: 'drinks',
    marker: new THREE.Vector3(23.6, 2.45, FZ),
    stand: { x: 21.9, z: FZ, yaw: Math.PI / 2 },
    animate: (e, active, hand) => {
      // door: open over 0.7s, closed again by 1.6s
      const open = active ? (e < 0.7 ? e / 0.7 : e < 1.0 ? 1 : Math.max(0, 1 - (e - 1.0) / 0.6)) : 0;
      door.rotation.y += (open * 1.3 - door.rotation.y) * 0.3;
      bottle.visible = active && e > 0.6 && e < 3.2;
      if (!bottle.visible) return;
      if (e < 1.0) { bottle.position.lerpVectors(bottleFrom, hand, (e - 0.6) / 0.4); bottle.rotation.set(0, 0, 0); return; }
      bottle.position.copy(hand);
      const sip = Math.min(1, Math.max(0, (e - 1.6) / 0.4));
      bottle.position.y += 0.25 * sip;
      bottle.rotation.set(0, 0, sip * 1.9);                                 // tip it up to drink
    },
  });

  addPlant(world, 23.4, 20, GREY_DARK);
  addPlant(world, 14.2, 20.2, GREY_DARK);

  // ---- more greenery around the office ---------------------------------------------
  for (const [px, pz, c] of [
    [-6, -12.3, GREY_DARK], [6, -12.3, GREY_DARK],              // beside the manager door
    [-8.6, 0, GREY_DARK], [8.6, 0, GREY_DARK],                  // ends of the desk area
    [-22.6, 6.2, GREY_DARK], [-14, 6.5, GREY_DARK],             // west side, outside the lunch room
    [-13.6, 20.2, GREY_DARK], [-5.6, 20.2, GREY_DARK], [5.6, 20.2, GREY_DARK], // along the front windows
    [7.2, 15.9, GREY_DARK],                                     // lounge, beside the sofa
    [23.6, 4.2, GREY_DARK], [23.6, 9.6, GREY_DARK],             // fun zone
    [-10.2, -23.6, MUSTARD],                                    // meeting room corner
    [-7.4, -14.4, BLUE], [7.4, -23.6, BLUE],                    // manager office
    [10, -14.4, TOMATO],                                        // boss office
    [-12.1, 2.3, GREEN],                                        // lunch room corner
    [12.1, 2.3, PURPLE],                                        // copy room corner
  ] as [number, number, string][]) addPlant(world, px, pz, c);

  // little succulents on some of the desks
  let succulent = 0;
  for (const [dx, dz] of [[-5, -5.55], [-1, -5.55], [3, -5.55], [-3, 4.45], [1, 4.45], [5, 4.45]] as [number, number][]) {
    deskPlant(world, dx + 0.72, 0.84, dz, succulent++);
  }
  deskPlant(world, 1.8, 0.84, 14.3, succulent++);                 // reception desk
  deskPlant(world, -16.8, 0.84, 14.2, succulent++);               // waiting-area table

  // ---- hanging signs ---------------------------------------------------------
  front.meeting.push(sign('MEETING ROOM', '#d89a12', -16.5, -13.4));
  front.manager.push(sign('MANAGER', '#2f6fdb', 0, -13.4));
  front.boss.push(sign('BOSS OFFICE', '#c8341f', 16.5, -13.4));
  front.lunch.push(sign('LUNCH ROOM', '#2f9e4f', -17.75, 3.4));
  front.copy.push(sign('COPY ROOM', '#7a4cb8', 17.75, 3.4));
  sign('OPEN OFFICE', '#5b6470', 0, 0.5);
  sign('FUN ZONE', '#f08a1c', 19, 12.5);

  // ---- ceiling lamps ----------------------------------------------------------
  const lampColors = [GREY_DARK, '#a0a6ae'];
  let lampIdx = 0;
  for (const x of [-16, 0, 16]) {
    for (const z of [10, 21]) {
      const c = lampColors[lampIdx++ % lampColors.length];
      cyl(world, 0.02, 0.02, 0.6, '#333', x, WALL_H - 0.3, z, 6);
      const shade = cyl(world, 0.15, 0.6, 0.4, c, x, WALL_H - 0.8, z, 28);
      shade.userData.noCastShadow = true;
      const bulb = place(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff6c8' })), world, x, WALL_H - 1.05, z);
      bulb.userData.noCastShadow = true;
    }
  }

  // ---- wall art: paintings and motivational neon ---------------------------------
  // Each piece is parented to the wall it hangs on, so it disappears with that wall
  // when the wall is cut away for the camera. (x, z) is a point on the wall's center
  // line; (dx, dz) is the direction the piece faces.
  world.updateMatrixWorld(true);
  const wallBox = new THREE.Box3();
  const onWall = (obj: THREE.Object3D, x: number, y: number, z: number, dx: number, dz: number) => {
    const point = new THREE.Vector3(x, y, z);
    const wall = allWalls.find((w) => wallBox.setFromObject(w).containsPoint(point));
    if (!wall) throw new Error(`no wall at (${x}, ${y}, ${z})`);
    obj.position.set(x + (dx * WALL_T) / 2, y, z + (dz * WALL_T) / 2).sub(wall.position);
    obj.rotation.y = Math.atan2(dx, dz);
    wall.add(obj);
  };
  const artRand = mulberry32(7);
  const painting = (style: Parameters<typeof makePainting>[0], w: number, h: number) => makePainting(style, w, h, artRand);
  const NEON_PINK = '#ff3fa4';
  const NEON_CYAN = '#3ff4ff';
  const NEON_YELLOW = '#ffe23f';
  const NEON_GREEN = '#5dff7a';
  const NEON_ORANGE = '#ff9a3f';
  const NEON_PURPLE = '#c77dff';

  // open-office side of the back row
  onWall(painting('sunset', 2.4, 1.6), -21, 2.4, -13, 0, 1);
  onWall(makeNeon('Work Hard', NEON_PINK), -11.25, 4.1, -13, 0, 1);
  onWall(painting('blocks', 1.4, 1.4), -11.25, 2.3, -13, 0, 1);
  onWall(painting('circles', 2.2, 1.5), -5, 2.4, -13, 0, 1);
  onWall(makeNeon('Dream Big', NEON_CYAN), 5, 4.1, -13, 0, 1);
  onWall(painting('mountain', 2.2, 1.4), 5, 2.3, -13, 0, 1);
  onWall(painting('blocks', 1.6, 1.6), 11.5, 2.4, -13, 0, 1);
  onWall(makeNeon('No Excuses', NEON_YELLOW), 21, 4.1, -13, 0, 1);
  onWall(painting('sunset', 2.2, 1.4), 21, 2.3, -13, 0, 1);
  // outside of the lunch and copy rooms
  onWall(makeNeon('Good Vibes Only', NEON_GREEN), -17.75, 4.1, 3, 0, 1);
  onWall(painting('blocks', 1.6, 1.6), -22, 2.4, 3, 0, 1);
  onWall(painting('sunset', 2, 1.4), -13.5, 2.4, 3, 0, 1);
  onWall(painting('circles', 1.8, 1.3), -11, 2.4, 0.75, 1, 0);
  onWall(painting('mountain', 1.8, 1.3), 11, 2.4, 0.75, -1, 0);
  onWall(painting('circles', 2, 1.4), 17.5, 2.4, 3, 0, 1);
  onWall(makeNeon('Hustle', NEON_ORANGE), 21.5, 3.2, 3, 0, 1);
  // inside the rooms
  onWall(makeNeon('Synergy', NEON_PURPLE), -8.5, 3.4, -19, -1, 0);
  onWall(painting('mountain', 2.4, 1.6), -8.5, 2.4, -19, 1, 0);
  onWall(painting('circles', 2, 1.4), 8.5, 2.4, -19, -1, 0);
  onWall(makeNeon('Be The Boss', NEON_YELLOW), 8.5, 3.6, -19, 1, 0);
  onWall(painting('blocks', 1.4, 1.4), 8.5, 2.0, -19, 1, 0);
  onWall(makeNeon('Coffee First', NEON_PINK, 0.8), -11, 3.2, 0.75, -1, 0);
  onWall(makeNeon('Do It Now', NEON_CYAN, 0.8), 11, 3.2, 0.75, 1, 0);

  buildHighriseView(world, rand);

  // ---- rooms: move each room's furniture into its own group ---------------------
  const roomDefs = [
    { id: 'meeting', minX: -25.2, maxX: -8.5, minZ: -25.2, maxZ: -13 },
    { id: 'manager', minX: -8.5, maxX: 8.5, minZ: -25.2, maxZ: -13 },
    { id: 'boss', minX: 8.5, maxX: 25.2, minZ: -25.2, maxZ: -13 },
    { id: 'lunch', minX: -25.2, maxX: -11, minZ: -9, maxZ: 3 },
    { id: 'copy', minX: 11, maxX: 25.2, minZ: -9, maxZ: 3 },
  ];
  const rooms: Room[] = roomDefs.map((d) => ({ ...d, interior: new THREE.Group(), front: front[d.id] }));
  world.updateMatrixWorld(true);
  const roomBox = new THREE.Box3();
  const roomCenter = new THREE.Vector3();
  for (const obj of [...world.children]) {
    if (obj.userData.keep) continue;
    roomBox.setFromObject(obj).getCenter(roomCenter);
    if (roomCenter.y > 3.5) continue; // hanging signs and lamps
    const room = roomAt(rooms, roomCenter.x, roomCenter.z);
    if (room) room.interior.add(obj);
  }
  rooms.forEach((r) => world.add(r.interior));
  seats.forEach((st) => { st.room = roomAt(rooms, st.x, st.z)?.id ?? null; });

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
  return { colliders, seats, rooms, walls: allWalls, activities };
}
