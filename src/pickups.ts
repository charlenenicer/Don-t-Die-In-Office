import * as THREE from 'three';

// Small 3D models of the items you can pick up, so each one looks like what it is.
// Every pickup floats and turns above a soft glowing ring on the floor.

const materials = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.6): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
    materials.set(key, m);
  }
  return m;
}

function add<T extends THREE.Object3D>(obj: T, parent: THREE.Object3D, x: number, y: number, z: number): T {
  obj.position.set(x, y, z);
  parent.add(obj);
  return obj;
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, c: string, x: number, y: number, z: number) =>
  add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)), p, x, y, z);
const cyl = (p: THREE.Object3D, rt: number, rb: number, h: number, c: string, x: number, y: number, z: number, seg = 20) =>
  add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c)), p, x, y, z);
function ball(p: THREE.Object3D, r: number, c: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const m = add(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat(c)), p, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
const glow = (p: THREE.Object3D, r: number, c: string, x: number, y: number, z: number) =>
  add(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshBasicMaterial({ color: c })), p, x, y, z);

// ------------------------------------------------------------------ models

function standingDesk(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0.8, 0.05, 0.45, '#c9a27a', 0, 0.78, 0);                 // desktop
  for (const x of [-0.32, 0.32]) {
    box(g, 0.06, 0.75, 0.06, '#8b929b', x, 0.39, 0);               // telescoping legs
    box(g, 0.05, 0.25, 0.05, '#b4b9c0', x, 0.62, 0);
    box(g, 0.08, 0.04, 0.42, '#5b6470', x, 0.02, 0);               // feet
  }
  box(g, 0.64, 0.04, 0.04, '#8b929b', 0, 0.3, 0);                  // crossbar
  box(g, 0.32, 0.2, 0.02, '#26292f', 0, 0.98, -0.12);              // monitor
  box(g, 0.29, 0.17, 0.01, '#a8d4f0', 0, 0.98, -0.108);
  box(g, 0.04, 0.12, 0.04, '#26292f', 0, 0.86, -0.13);
  box(g, 0.08, 0.02, 0.05, '#4ac27a', 0.3, 0.82, 0.18);            // height control
  return g;
}

function ergonomicChair(): THREE.Group {
  const g = new THREE.Group();
  const dark = '#2b2d33';
  const teal = '#1f9d9a';
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5;
    box(g, 0.3, 0.03, 0.05, dark, Math.cos(a) * 0.15, 0.08, Math.sin(a) * 0.15).rotation.y = -a;
    ball(g, 0.035, '#15161a', Math.cos(a) * 0.29, 0.035, Math.sin(a) * 0.29);
  }
  cyl(g, 0.03, 0.03, 0.3, '#9aa0a8', 0, 0.25, 0, 12);              // gas lift
  ball(g, 0.24, teal, 0, 0.44, 0, 1, 0.22, 1);                      // cushion
  const back = box(g, 0.42, 0.55, 0.05, teal, 0, 0.78, -0.22);     // tall mesh back
  back.rotation.x = -0.1;
  box(g, 0.36, 0.08, 0.05, '#177a77', 0, 0.62, -0.19).rotation.x = -0.1; // lumbar support
  box(g, 0.28, 0.13, 0.05, teal, 0, 1.13, -0.26);                  // headrest
  for (const side of [-1, 1]) {
    box(g, 0.035, 0.17, 0.035, dark, side * 0.26, 0.55, -0.02);
    box(g, 0.06, 0.03, 0.26, dark, side * 0.26, 0.64, -0.03);       // armrests
  }
  return g;
}

function headphones(): THREE.Group {
  const g = new THREE.Group();
  const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 10, 32, Math.PI), mat('#26292f')), g, 0, 0.42, 0);
  band.rotation.z = 0; // arc over the top
  add(new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 32, Math.PI * 0.6), mat('#e0452f')), g, 0, 0.42, 0).rotation.z = Math.PI * 0.2;
  for (const side of [-1, 1]) {
    const cup = cyl(g, 0.11, 0.11, 0.09, '#26292f', side * 0.25, 0.4, 0, 24);
    cup.rotation.z = Math.PI / 2;
    const accent = cyl(g, 0.07, 0.07, 0.092, '#e0452f', side * 0.25, 0.4, 0, 20);
    accent.rotation.z = Math.PI / 2;
    const pad = add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 20), mat('#5b6470', 0.9)), g, side * 0.2, 0.4, 0);
    pad.rotation.y = Math.PI / 2;
  }
  g.scale.setScalar(1.35);
  return g;
}

function aiAssistant(): THREE.Group {
  const g = new THREE.Group();
  ball(g, 0.22, '#eef0f2', 0, 0.5, 0, 1.15, 0.95, 1);              // head
  box(g, 0.32, 0.17, 0.03, '#1c2126', 0, 0.5, 0.2);                // face screen
  for (const x of [-0.07, 0.07]) glow(g, 0.035, '#3ff4ff', x, 0.52, 0.22).scale.set(1, 1.3, 0.5);
  box(g, 0.08, 0.015, 0.01, '#3ff4ff', 0, 0.45, 0.218);             // smile
  for (const side of [-1, 1]) cyl(g, 0.05, 0.05, 0.05, '#2f6fdb', side * 0.25, 0.5, 0, 16).rotation.z = Math.PI / 2;
  cyl(g, 0.012, 0.012, 0.16, '#8b929b', 0, 0.78, 0, 8);            // antenna
  glow(g, 0.04, '#ff3fa4', 0, 0.87, 0);
  cyl(g, 0.12, 0.16, 0.12, '#2f6fdb', 0, 0.23, 0, 20);             // neck/base
  cyl(g, 0.18, 0.18, 0.04, '#26292f', 0, 0.15, 0, 24);
  return g;
}

function coffeeMachine(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0.38, 0.12, 0.32, '#26292f', 0, 0.06, 0);                 // drip tray base
  box(g, 0.38, 0.5, 0.12, '#b8321f', 0, 0.37, -0.1);               // body
  box(g, 0.38, 0.1, 0.32, '#b8321f', 0, 0.67, 0);                  // top
  box(g, 0.1, 0.06, 0.1, '#cfd3d8', 0, 0.58, 0.05);                // group head
  cyl(g, 0.015, 0.015, 0.05, '#cfd3d8', 0, 0.53, 0.05, 8);         // spout
  cyl(g, 0.06, 0.05, 0.09, '#ffffff', 0, 0.165, 0.05, 16);          // cup
  cyl(g, 0.052, 0.052, 0.005, '#5a3820', 0, 0.207, 0.05, 16);       // coffee
  for (let i = 0; i < 3; i++) {
    const steam = add(new THREE.Mesh(new THREE.SphereGeometry(0.03 + i * 0.008, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 - i * 0.12 })), g, Math.sin(i) * 0.02, 0.27 + i * 0.07, 0.05);
    steam.userData.noShadow = true;
  }
  glow(g, 0.018, '#4ac27a', 0.13, 0.66, 0.165);                     // power light
  return g;
}

function calendarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 220;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 220);
  ctx.fillStyle = '#e0452f';
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('FOCUS', 128, 35);
  // a week grid with focus blocks
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const x = 14 + c * 46;
      const y = 60 + r * 38;
      const blocked = (r + c) % 3 === 0;
      ctx.fillStyle = blocked ? '#2f6fdb' : '#eef0f2';
      ctx.fillRect(x, y, 40, 32);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function calendar(): THREE.Group {
  const g = new THREE.Group();
  // a tented desk calendar: two leaning boards, the front one printed
  const front = new THREE.Group();
  front.position.set(0, 0.0, 0.08);
  front.rotation.x = -0.25;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.02), mat('#d8dbe0')), front, 0, 0.25, 0);
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.44), new THREE.MeshStandardMaterial({ map: calendarTexture(), roughness: 0.8 })), front, 0, 0.25, 0.012);
  g.add(front);
  const back = box(g, 0.56, 0.48, 0.02, '#d8dbe0', 0, 0.24, -0.08);
  back.rotation.x = 0.25;
  for (let i = 0; i < 6; i++) {                                     // binder rings
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12), mat('#8b929b')), g, -0.2 + i * 0.08, 0.49, 0);
    ring.rotation.y = Math.PI / 2;
  }
  return g;
}

const MODELS: Record<string, () => THREE.Group> = {
  'standing-desk': standingDesk,
  'ergonomic-chair': ergonomicChair,
  'noise-cancelling-headphones': headphones,
  'ai-assistant': aiAssistant,
  'coffee-machine': coffeeMachine,
  'calendar-blocker': calendar,
};

/** How much clear floor a pickup needs around it, so it never sits in furniture. */
export const PICKUP_CLEARANCE = 0.7;

/**
 * A pickup: the item's model (turning and bobbing in `spin`) above a glowing ring.
 * Unknown ids get a gift box so nothing is ever invisible.
 */
export function createPickup(id: string): { group: THREE.Group; spin: THREE.Group } {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.18, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.035;
  group.add(halo);

  const spin = new THREE.Group();
  spin.position.y = 0.35;
  const make = MODELS[id];
  if (make) {
    spin.add(make());
  } else {
    const gift = new THREE.Group();
    box(gift, 0.4, 0.4, 0.4, '#e0452f', 0, 0.2, 0);
    box(gift, 0.42, 0.42, 0.08, '#f2c230', 0, 0.2, 0);
    box(gift, 0.08, 0.42, 0.42, '#f2c230', 0, 0.2, 0);
    spin.add(gift);
  }
  group.add(spin);

  group.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o.material instanceof THREE.MeshBasicMaterial)) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, spin };
}
