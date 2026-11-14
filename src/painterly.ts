import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { INK, IQ, paint } from './palette';

/**
 * The hand-illustrated look: stepped toon shading in the painterly palette, an
 * ink outline pass drawn from the depth buffer and colour edges, and a light
 * paper grain with a navy vignette. Everything is procedural; the only textures
 * are a 4-pixel ramp and a 64-pixel blob shadow.
 */

/** Four soft light bands, darkest first. Kept tiny and nearest-filtered so bands stay crisp. */
export function createRampTexture(): THREE.DataTexture {
  const steps = [92, 150, 214, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const swapped = new WeakMap<THREE.Material, THREE.Material>();

function toonFrom(m: THREE.MeshStandardMaterial, ramp: THREE.Texture): THREE.MeshToonMaterial {
  const toon = new THREE.MeshToonMaterial({
    color: new THREE.Color(paint(`#${m.color.getHexString()}`)),
    map: m.map,
    gradientMap: ramp,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
    depthWrite: m.depthWrite,
    emissive: new THREE.Color(paint(`#${m.emissive.getHexString()}`)),
    emissiveIntensity: m.emissiveIntensity,
    emissiveMap: m.emissiveMap,
    alphaTest: m.alphaTest,
    fog: false,
  });
  toon.name = m.name;
  toon.userData = { ...m.userData, painted: true };
  return toon;
}

/**
 * Swap every lit material under `root` for a toon one in the painted palette, and
 * wash unlit colours (labels, screens, bulbs) the same way. Shared materials stay
 * shared, so the shader count doesn't grow.
 */
export function toonify(root: THREE.Object3D, ramp: THREE.Texture): number {
  let count = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m: THREE.Material) => {
      if (m.userData?.painted) return m;
      const cached = swapped.get(m);
      if (cached) return cached;
      let out: THREE.Material = m;
      if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhongMaterial || m instanceof THREE.MeshLambertMaterial) {
        out = toonFrom(m as THREE.MeshStandardMaterial, ramp);
        count++;
      } else if (m instanceof THREE.MeshBasicMaterial) {
        if (!m.map) m.color.set(paint(`#${m.color.getHexString()}`));
        m.fog = false;
        m.toneMapped = false;
        m.userData.painted = true;
      }
      swapped.set(m, out);
      return out;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
  return count;
}

/** A soft round contact shadow to sit under characters and pickups. */
let blobTexture: THREE.CanvasTexture | null = null;
export function createBlobShadow(radius = 0.55, opacity = 0.42): THREE.Mesh {
  if (!blobTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(30,18,10,1)');
    g.addColorStop(0.55, 'rgba(30,18,10,0.55)');
    g.addColorStop(1, 'rgba(30,18,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    blobTexture = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.035;
  m.renderOrder = 2;
  m.userData.painted = true;
  m.userData.noShadow = true;
  return m;
}

const inkShader = {
  uniforms: {
    tColor: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(1, 1) },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 200 },
    worldPerPixel: { value: 0.03 },
    ink: { value: new THREE.Color(INK) },
    vignette: { value: new THREE.Color(IQ.bg) },
    strength: { value: 1 },
    grain: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 resolution;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float worldPerPixel;
    uniform vec3 ink;
    uniform vec3 vignette;
    uniform float strength;
    uniform float grain;
    varying vec2 vUv;

    float viewDepth(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return -orthographicDepthToViewZ(d, cameraNear, cameraFar);
    }
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    void main() {
      vec2 px = 1.0 / resolution;
      vec4 base = texture2D(tColor, vUv);
      float dc = viewDepth(vUv);
      float dl = viewDepth(vUv - vec2(px.x, 0.0));
      float dr = viewDepth(vUv + vec2(px.x, 0.0));
      float du = viewDepth(vUv + vec2(0.0, px.y));
      float dd = viewDepth(vUv - vec2(0.0, px.y));

      // silhouettes: a jump in depth bigger than a steep floor would make
      float jump = max(max(abs(dl - dc), abs(dr - dc)), max(abs(du - dc), abs(dd - dc)));
      float sil = smoothstep(worldPerPixel * 3.0 + 0.06, worldPerPixel * 5.0 + 0.16, jump);
      // creases: the depth slope changes, e.g. where a box face meets its top
      float lap = abs(dl + dr - 2.0 * dc) + abs(du + dd - 2.0 * dc);
      float crease = smoothstep(worldPerPixel * 0.9, worldPerPixel * 2.2, lap) * 0.75;
      // colour edges, softer: where toon bands or paint colours meet
      vec3 cl = texture2D(tColor, vUv - vec2(px.x, 0.0)).rgb;
      vec3 cr = texture2D(tColor, vUv + vec2(px.x, 0.0)).rgb;
      vec3 cu = texture2D(tColor, vUv + vec2(0.0, px.y)).rgb;
      vec3 cd = texture2D(tColor, vUv - vec2(0.0, px.y)).rgb;
      float ce = length(vec2(luma(cr) - luma(cl), luma(cu) - luma(cd)));
      float colourEdge = smoothstep(0.10, 0.28, ce) * 0.35;

      float line = clamp(max(max(sil, crease), colourEdge), 0.0, 1.0) * 0.82 * strength;
      // the hand-drawn wobble: ink is a little lighter here and there
      line *= 0.78 + 0.22 * noise(gl_FragCoord.xy * 0.35);
      vec3 col = mix(base.rgb, ink, line);

      // paper: fine grain plus a soft wash so flat colours aren't perfectly even
      float g = hash(floor(gl_FragCoord.xy / 1.5)) - 0.5;
      float wash = noise(gl_FragCoord.xy / 90.0) - 0.5;
      col *= 1.0 + (g * 0.055 + wash * 0.07) * grain;

      // navy vignette like Interview Quest's walk view
      vec2 q = vUv - 0.5;
      float v = smoothstep(0.38, 0.85, length(q * vec2(1.15, 1.0)));
      col = mix(col, vignette, v * 0.55);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

class InkPass extends Pass {
  material: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  constructor(private camera: THREE.OrthographicCamera) {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(inkShader.uniforms),
      vertexShader: inkShader.vertexShader,
      fragmentShader: inkShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const u = this.material.uniforms;
    u.tColor.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.cameraNear.value = this.camera.near;
    u.cameraFar.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  setSize(w: number, h: number) {
    this.material.uniforms.resolution.value.set(w, h);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export interface Painterly {
  render(): void;
  setSize(w: number, h: number, pixelRatio: number): void;
  /** world units per screen pixel, so outlines stay the same width at every zoom */
  setWorldPerPixel(v: number): void;
}

export function createPainterly(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera, w: number, h: number): Painterly {
  const pr = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(Math.round(w * pr), Math.round(h * pr), {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  target.depthTexture = new THREE.DepthTexture(target.width, target.height);
  target.depthTexture.type = THREE.UnsignedIntType;
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ink = new InkPass(camera);
  composer.addPass(ink);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  return {
    render: () => composer.render(),
    setSize(nw, nh, npr) {
      composer.setPixelRatio(npr);
      composer.setSize(nw, nh);
    },
    setWorldPerPixel(v) {
      // the depth buffer is at device resolution
      ink.material.uniforms.worldPerPixel.value = v / renderer.getPixelRatio();
    },
  };
}
