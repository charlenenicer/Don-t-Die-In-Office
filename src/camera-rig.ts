import * as THREE from 'three';
import { clampZoom, followFactor, frustum, isoOffset, worldPerPixel } from './iso';
import type { CameraMode, VariantConfig } from './variant';

/**
 * Where the camera looks and how it moves, for every camera mode in
 * variant.ts. Pure framing logic lives in `framingFor` so it can be tested.
 */

export interface Area { name: string; x: number; z: number }
export interface RoomBox { id: string; minX: number; maxX: number; minZ: number; maxZ: number }

export interface Framing {
  target: [number, number, number];
  /** multiplies the user's zoom */
  zoomFactor: number;
  /** true = jump straight there (a cut), false = ease */
  snap: boolean;
  pitchDeg: number;
}

export function nearestArea(areas: Area[], x: number, z: number): Area | null {
  let best: Area | null = null;
  let bestD = Infinity;
  for (const a of areas) {
    const d = (a.x - x) ** 2 + (a.z - z) ** 2;
    if (d < bestD) { best = a; bestD = d; }
  }
  return best;
}

export function roomCenter(r: RoomBox): [number, number] {
  return [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
}

/** What the camera should frame this frame, given the mode, the player and the room they're in. */
export function framingFor(mode: CameraMode, v: Pick<VariantConfig, 'pitchDeg'>, player: { x: number; z: number }, room: RoomBox | null, areas: Area[]): Framing {
  const follow: Framing = { target: [player.x, 0.8, player.z], zoomFactor: 1, snap: false, pitchDeg: v.pitchDeg };
  switch (mode) {
    case 'iso-follow':
      return follow;
    case 'tilted-zoom':
      return { ...follow, zoomFactor: room ? 1.55 : 1 };
    case 'room-snap': {
      if (room) {
        const [cx, cz] = roomCenter(room);
        return { target: [cx, 0.8, cz], zoomFactor: 1.15, snap: true, pitchDeg: v.pitchDeg };
      }
      const a = nearestArea(areas, player.x, player.z);
      return { target: [a ? a.x : player.x, 0.8, a ? a.z : player.z], zoomFactor: 1, snap: true, pitchDeg: v.pitchDeg };
    }
    case 'follow-rooms': {
      if (!room) return follow;
      const [cx, cz] = roomCenter(room);
      // glide over to frame the whole room from a little higher up
      return { target: [cx, 0.5, cz], zoomFactor: 0.82, snap: false, pitchDeg: v.pitchDeg + 12 };
    }
    case 'shoulder':
      return { ...follow, target: [player.x, 1.3, player.z] };
  }
}

export function isPerspective(mode: CameraMode): boolean {
  return mode === 'follow-rooms' || mode === 'shoulder';
}

export class CameraRig {
  readonly camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  private zoom: number;
  private userZoom: number;
  private factor = 1;
  private pitch: number;
  private target = new THREE.Vector3();
  private lastKey = '';
  private aspect = 1;
  private heightPx = 1;

  constructor(private v: VariantConfig, private areas: Area[], aspect: number, heightPx: number, start: { x: number; z: number }) {
    this.zoom = this.userZoom = v.zoom;
    this.pitch = v.pitchDeg;
    this.aspect = aspect;
    this.heightPx = heightPx;
    if (isPerspective(v.camera)) {
      this.camera = new THREE.PerspectiveCamera(v.fov, aspect, 0.5, 220);
    } else {
      const f = frustum(aspect, this.zoom);
      this.camera = new THREE.OrthographicCamera(f.left, f.right, f.top, f.bottom, 1, 160);
    }
    this.target.set(start.x, 0.8, start.z);
    this.update(1, start, null, true);
  }

  setZoom(z: number) { this.userZoom = clampZoom(z); }
  getZoom(): number { return this.userZoom; }

  resize(w: number, h: number) {
    this.aspect = w / h;
    this.heightPx = h;
    this.applyProjection();
  }

  /** world units per CSS pixel at the target (orthographic modes) */
  worldPerPixel(): number {
    return worldPerPixel(this.heightPx, this.zoom);
  }

  getTarget(): THREE.Vector3 { return this.target; }

  private applyProjection() {
    const cam = this.camera;
    if (cam instanceof THREE.PerspectiveCamera) {
      cam.aspect = this.aspect;
    } else {
      Object.assign(cam, frustum(this.aspect, this.zoom));
    }
    cam.updateProjectionMatrix();
  }

  update(delta: number, player: { x: number; z: number }, room: RoomBox | null, reducedMotion: boolean) {
    const f = framingFor(this.v.camera, this.v, player, room, this.areas);
    const key = `${f.target[0].toFixed(2)},${f.target[2].toFixed(2)}`;
    const cut = f.snap && key !== this.lastKey;
    this.lastKey = key;
    const k = cut ? 1 : followFactor(delta, reducedMotion, this.v.camera === 'follow-rooms' ? 3 : 6);
    this.target.lerp(new THREE.Vector3(...f.target), k);
    this.pitch += (f.pitchDeg - this.pitch) * k;
    const kz = cut ? 1 : followFactor(delta, reducedMotion, this.v.camera === 'iso-follow' ? 10 : 3.5);
    const want = clampZoom(this.userZoom * f.zoomFactor);
    if (Math.abs(want - this.zoom) > 1e-4) {
      this.zoom += (want - this.zoom) * kz;
      if (!(this.camera instanceof THREE.PerspectiveCamera)) this.applyProjection();
    }
    const dist = this.camera instanceof THREE.PerspectiveCamera ? this.v.distance / this.zoom : this.v.distance;
    const [ox, oy, oz] = isoOffset(this.pitch, this.v.yawDeg, dist);
    this.camera.position.set(this.target.x + ox, this.target.y + oy, this.target.z + oz);
    this.camera.lookAt(this.target);
    return cut;
  }
}
