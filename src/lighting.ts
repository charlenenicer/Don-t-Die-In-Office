import * as THREE from 'three';

/**
 * Painterly indoor lighting for the toon materials: a warm sky/floor bounce, a
 * low warm "late afternoon" key coming in through the far (north-west) windows
 * whose soft shadows fall towards the camera, a cool fill from the other side,
 * and warm practical lights at the lamps and fireplace (added by buildWorld).
 *
 * The key's shadow box covers the whole office and the furniture never moves,
 * so the shadow map is drawn once (see Game) instead of every frame.
 */
export interface Lighting {
  /** Kept for callers; the key light covers the whole floor so nothing needs to follow. */
  follow(target: THREE.Vector3): void;
  /** Call once everything is in the scene: labels and glows are exempt from tone mapping. */
  applyEnvironment(root: THREE.Object3D): void;
}

export function setupLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Lighting {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // warm bounce: honey from the floor, a dusky blue-lilac from above
  scene.add(new THREE.HemisphereLight(0xfff0d6, 0x9a7a5a, 1.5));

  const key = new THREE.DirectionalLight(0xffd29a, 2.6);
  key.position.set(-18, 30, -22);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const cam = key.shadow.camera;
  cam.left = -34;
  cam.right = 34;
  cam.top = 34;
  cam.bottom = -34;
  cam.near = 1;
  cam.far = 90;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.05;
  key.shadow.radius = 4;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xb9c8ff, 0.5);
  fill.position.set(20, 14, 18);
  scene.add(fill);

  return {
    follow() {},
    applyEnvironment(root) {
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.SpriteMaterial) m.toneMapped = false;
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
