import * as THREE from 'three';
import type { Collider } from './visuals';

/**
 * Extra cozy props and warm window light for the isometric view. All
 * procedural; the only textures are two small canvases (a window sky and a light
 * pool). Props are only placed where they don't overlap existing furniture.
 */

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Late-afternoon sky seen through the far windows, with a few painted towers. */
function windowSkyTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#3c4f73');
    g.addColorStop(0.45, '#d98f5c');
    g.addColorStop(0.8, '#f4c27a');
    g.addColorStop(1, '#f7d79a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 64);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = 0; x < 128; x += 6 + Math.floor(rnd() * 8)) {
      const h = 10 + rnd() * 26;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(70,52,60,0.55)' : 'rgba(95,66,64,0.5)';
      ctx.fillRect(x, 64 - h, 5 + rnd() * 6, h);
    }
  });
}

/** Soft warm pool of light for the floor under a window. */
function lightPoolTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,214,150,0.9)');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    // soften the window-pane edges
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.2, 'rgba(0,0,0,1)');
    v.addColorStop(0.8, 'rgba(0,0,0,1)');
    v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 64, 64);
  });
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string): THREE.MeshStandardMaterial {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })));
  return m;
}
function box(p: THREE.Object3D, w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  p.add(m);
  return m;
}
function cyl(p: THREE.Object3D, r: number, h: number, color: string, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 14), mat(color));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  p.add(m);
  return m;
}

function overlaps(colliders: Collider[], minX: number, maxX: number, minZ: number, maxZ: number): boolean {
  return colliders.some((c) => c.minX < maxX && c.maxX > minX && c.minZ < maxZ && c.maxZ > minZ);
}

const MUG_COLORS = ['#e8e0cf', '#c9573f', '#3f6f8f', '#e0b14a', '#5f8f5a'];

export interface DecorResult { props: number; windows: number }

export function addIsoDecor(world: THREE.Object3D, colliders: Collider[]): DecorResult {
  const decor = new THREE.Group();
  decor.name = 'iso-decor';
  let props = 0;

  // ---- warm window light along the far (north and west) walls ----------------
  const sky = windowSkyTexture();
  const skyMat = new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, fog: false });
  skyMat.userData.painted = true;
  const north = new THREE.Mesh(new THREE.PlaneGeometry(52, 5), skyMat);
  north.position.set(0, 3.5, -25.9);
  const west = new THREE.Mesh(new THREE.PlaneGeometry(52, 5), skyMat);
  west.position.set(-25.9, 3.5, 0);
  west.rotation.y = Math.PI / 2;
  decor.add(north, west);

  const pool = lightPoolTexture();
  const poolMat = new THREE.MeshBasicMaterial({
    map: pool, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
  });
  poolMat.userData.painted = true;
  const bays = [-21.2, -12.75, -4.25, 4.25, 12.75, 21.2];
  let windows = 0;
  for (const along of bays) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7), poolMat);
    n.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    n.position.set(along + 1.2, 0.04, -24.6 + 3.5);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 7), poolMat);
    w.rotation.set(-Math.PI / 2, 0, 0);
    w.position.set(-24.6 + 3.5, 0.04, along + 1.2);
    for (const m of [n, w]) {
      m.renderOrder = 1;
      m.userData.noShadow = true;
      decor.add(m);
    }
    windows += 2;
  }

  // ---- desk clutter: a mug and a paper stack on every open-plan desk ----------
  let k = 0;
  for (const rowZ of [-5, 5]) {
    for (let i = 0; i < 6; i++) {
      const x = -5 + i * 2;
      const c = MUG_COLORS[k++ % MUG_COLORS.length];
      cyl(decor, 0.07, 0.13, c, x + 0.62, 0.905, rowZ - 0.05);
      box(decor, 0.03, 0.08, 0.02, c, x + 0.71, 0.9, rowZ - 0.05); // handle
      box(decor, 0.32, 0.05, 0.24, '#f4eee0', x - 0.6, 0.865, rowZ - 0.38).rotation.y = (i % 3) * 0.12;
      if (i % 2 === 0) box(decor, 0.3, 0.03, 0.22, '#e7d9b8', x - 0.58, 0.9, rowZ - 0.36).rotation.y = -0.1;
      props += 2;
    }
  }

  // ---- whiteboards: one on wheels in the open office, one in the meeting room --
  const whiteboard = (x: number, z: number, yaw: number, scribbles: string[]) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    box(g, 2.2, 1.3, 0.06, '#f6f3ea', 0, 1.55, 0);
    box(g, 2.3, 0.06, 0.1, '#8a8f96', 0, 2.22, 0);
    box(g, 2.3, 0.06, 0.12, '#8a8f96', 0, 0.88, 0.02);
    for (const sx of [-1.05, 1.05]) {
      box(g, 0.06, 1.75, 0.06, '#8a8f96', sx, 0.875, 0);
      box(g, 0.06, 0.04, 0.6, '#5d6168', sx, 0.04, 0);
    }
    scribbles.forEach((c, i) => box(g, 0.5 + (i % 2) * 0.5, 0.05, 0.01, c, -0.5 + (i % 3) * 0.35, 1.9 - i * 0.18, 0.04));
    box(g, 0.45, 0.45, 0.01, '#f2d36b', 0.75, 1.55, 0.04); // sticky note
    decor.add(g);
    props++;
  };
  const tryPlace = (x: number, z: number, hw: number, hd: number, place: () => void) => {
    if (overlaps(colliders, x - hw, x + hw, z - hd, z + hd)) return false;
    place();
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
    return true;
  };
  for (const [x, z] of [[-8, -9.6], [-7.5, 9.5], [8, -1]] as [number, number][]) {
    if (tryPlace(x, z, 1.25, 0.4, () => whiteboard(x, z, 0, ['#3f6f8f', '#c9573f', '#3f6f8f', '#5f8f5a']))) break;
  }
  // meeting room: wall-mounted on the far west wall
  const wb = new THREE.Group();
  wb.position.set(-24.55, 0, -19.2);
  wb.rotation.y = Math.PI / 2;
  box(wb, 2.8, 1.5, 0.05, '#f6f3ea', 0, 2.2, 0);
  box(wb, 2.9, 0.05, 0.12, '#8a8f96', 0, 1.42, 0.04);
  ['#c9573f', '#3f6f8f', '#3f6f8f'].forEach((c, i) => box(wb, 1.2 - i * 0.2, 0.05, 0.01, c, -0.4, 2.6 - i * 0.22, 0.03));
  box(wb, 0.4, 0.4, 0.01, '#f2d36b', 0.9, 2.4, 0.03);
  decor.add(wb);
  props++;

  // ---- a wall clock above the far wall of the open office ------------------
  const clock = new THREE.Group();
  clock.position.set(-24.55, 4.4, 8);
  clock.rotation.y = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24), mat('#f6f3ea'));
  face.rotation.x = Math.PI / 2;
  clock.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), mat('#5d4636'));
  clock.add(rim);
  box(clock, 0.04, 0.34, 0.02, '#2a1d16', 0, 0.13, 0.05);
  box(clock, 0.26, 0.04, 0.02, '#2a1d16', 0.1, 0, 0.05);
  decor.add(clock);
  props++;

  decor.traverse((o) => { o.userData.keep = true; });
  world.add(decor);
  return { props, windows };
}
