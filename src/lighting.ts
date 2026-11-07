import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Indoor lighting: filmic tone mapping, a soft studio environment for bounce
 * light, a warm overhead key that casts short shadows, a cool fill from the
 * windows, and warm practical lights at the lamps and fireplace (added by
 * buildWorld).
 */
export interface Lighting {
  /** Keep the shadow-casting key light centred on the player. */
  follow(target: THREE.Vector3): void;
  /** Call once everything is in the scene, so every material gets the same bounce light. */
  applyEnvironment(root: THREE.Object3D): void;
}

/** How strongly the environment lights standard materials (r160 has no scene.environmentIntensity). */
const ENV_INTENSITY = 0.3;

export function setupLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Lighting {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  // Sky above, warm floor bounce below; low, since the environment does most of the fill
  scene.add(new THREE.HemisphereLight(0xdcecff, 0xb89a72, 0.3));

  // Key: warm, nearly overhead like ceiling panels, so shadows pool under furniture
  // instead of stretching across the floor
  const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera;
  cam.left = -24;
  cam.right = 24;
  cam.top = 24;
  cam.bottom = -24;
  cam.near = 1;
  cam.far = 60;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.04;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  // Fill: cool daylight from the windows on the other side, no shadows, so the
  // walls facing away from the key still read as different planes
  const fill = new THREE.DirectionalLight(0xbfd8ff, 0.45);
  fill.position.set(-20, 12, -14);
  scene.add(fill);

  return {
    follow(target) {
      key.position.set(target.x + 9, 28, target.z + 10);
      key.target.position.set(target.x, 0, target.z);
    },
    applyEnvironment(root) {
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m instanceof THREE.MeshStandardMaterial) m.envMapIntensity = ENV_INTENSITY;
          // Labels, screens and glowing bits keep their exact colours under tone mapping
          else if (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.SpriteMaterial) m.toneMapped = false;
        }
      });
    },
  };
}

/** A warm lamp light with a soft falloff. Kept at the world root so hiding rooms never changes the light count (which would recompile every shader). */
export function lampLight(parent: THREE.Object3D, x: number, y: number, z: number, intensity = 16, distance = 14, color = 0xffd9a0): THREE.PointLight {
  const light = new THREE.PointLight(color, intensity, distance, 1.6);
  light.position.set(x, y, z);
  light.userData.keep = true;
  parent.add(light);
  return light;
}

/** Fireplace glow that flickers; call with the running time in seconds. */
export function flicker(light: THREE.PointLight, base: number, t: number) {
  light.intensity = base * (0.85 + 0.1 * Math.sin(t * 9.1) + 0.06 * Math.sin(t * 23.7 + 1.3) + 0.04 * Math.sin(t * 3.3));
}
