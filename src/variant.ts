/**
 * One place that describes how the world is framed and drawn. The main branch
 * uses DEFAULT_VARIANT (fixed isometric follow camera + painted toon look);
 * experiment branches only change `VARIANT` below.
 */

export type CameraMode =
  /** orthographic iso view that follows the player */
  | 'iso-follow'
  /** perspective follow camera that glides to frame a room when you walk in */
  | 'follow-rooms'
  /** orthographic camera fixed per room/area, cutting when you change area */
  | 'room-snap'
  /** close perspective 3/4 view just over the player's shoulder */
  | 'shoulder'
  /** tilted orthographic view that zooms in smoothly inside rooms */
  | 'tilted-zoom';

export interface StyleConfig {
  /** toon ramp light levels (0-255), darkest first */
  ramp: number[];
  /** smooth (linear) ramp instead of hard bands */
  softRamp: boolean;
  /** faceted flat shading */
  flatShading: boolean;
  saturationKeep: number;
  lightnessFloor: number;
  lightnessCeil: number;
  paperWash: number;
  paper: string;
  background: string;
  ink: string;
  inkStrength: number;
  /** pixels between outline samples: 1 = fine, 2 = chunky */
  inkWidth: number;
  /** how much ink varies along a line (0 = perfectly even) */
  inkWobble: number;
  colourEdge: number;
  grain: number;
  wash: number;
  /** size of the paint wash blotches, in px */
  washScale: number;
  vignette: string;
  vignetteStrength: number;
  /** colour levels per channel, 0 = off */
  posterize: number;
  /** render-resolution multiplier, e.g. 0.25 for chunky pixels */
  pixelScale: number;
  /** extra class on <body> for HUD tweaks */
  bodyClass: string;
}

export interface VariantConfig {
  name: string;
  camera: CameraMode;
  /** camera pitch/yaw in degrees (yaw 0 = looking north from the south) */
  pitchDeg: number;
  yawDeg: number;
  /** perspective modes: field of view and distance to the target */
  fov: number;
  distance: number;
  /** orthographic modes: starting zoom */
  zoom: number;
  style: StyleConfig;
}

export const PAINTED_STYLE: StyleConfig = {
  ramp: [92, 150, 214, 255],
  softRamp: false,
  flatShading: false,
  saturationKeep: 0.7,
  lightnessFloor: 0.05,
  lightnessCeil: 0.88,
  paperWash: 0.1,
  paper: '#f1dfbd',
  background: '#0e1620',
  ink: '#2a1d16',
  inkStrength: 1,
  inkWidth: 1,
  inkWobble: 0.22,
  colourEdge: 0.35,
  grain: 1,
  wash: 1,
  washScale: 90,
  vignette: '#0e1620',
  vignetteStrength: 0.55,
  posterize: 0,
  pixelScale: 1,
  bodyClass: '',
};

export const DEFAULT_VARIANT: VariantConfig = {
  name: 'restyle-isometric-painted',
  camera: 'iso-follow',
  pitchDeg: 35,
  yawDeg: 45,
  fov: 40,
  distance: 70,
  zoom: 1.3,
  style: PAINTED_STYLE,
};

/**
 * Experiment: follow camera with room transitions + soft watercolour.
 * A perspective camera trails behind the player (like the original game but
 * higher); stepping into a room glides it up to frame the whole room. Pastel,
 * low-contrast washes on warm paper, thin violet-sepia ink, big soft blotches.
 */
export const VARIANT: VariantConfig = {
  name: 'exp/follow-cam-watercolor',
  camera: 'follow-rooms',
  pitchDeg: 38,
  yawDeg: 0,
  fov: 42,
  distance: 24,
  zoom: 1,
  style: {
    ...PAINTED_STYLE,
    ramp: [150, 198, 235, 255],
    softRamp: true,
    saturationKeep: 0.66,
    lightnessFloor: 0.12,
    lightnessCeil: 0.9,
    paperWash: 0.16,
    paper: '#f6eddc',
    background: '#efe6d4',
    ink: '#6b5a7a',
    inkStrength: 0.55,
    inkWobble: 0.55,
    colourEdge: 0.12,
    grain: 1.5,
    wash: 3.6,
    washScale: 150,
    vignette: '#e6d6bb',
    vignetteStrength: 0.5,
    bodyClass: 'variant-watercolor',
  },
};

