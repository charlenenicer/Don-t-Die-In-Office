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
 * Experiment: tilted iso with smooth room zoom + cut paper.
 * A steeper, more top-down orthographic view (55° down, 20° round) that eases
 * in close when you step into a room and back out on the open floor. Flat
 * posterised colour like layered craft paper on a kraft backdrop, with heavy
 * paper fibre grain, soft brown edges and offset paper shadows on the HUD.
 */
export const VARIANT: VariantConfig = {
  name: 'exp/tilted-iso-paper',
  camera: 'tilted-zoom',
  pitchDeg: 55,
  yawDeg: 20,
  fov: 40,
  distance: 70,
  zoom: 1.0,
  style: {
    ...PAINTED_STYLE,
    ramp: [140, 205, 255],
    saturationKeep: 0.8,
    lightnessFloor: 0.1,
    lightnessCeil: 0.86,
    paperWash: 0.14,
    paper: '#e8d9b8',
    background: '#cdb98f',
    ink: '#4a3826',
    inkStrength: 0.7,
    inkWobble: 0.35,
    colourEdge: 0.45,
    grain: 2.6,
    wash: 1.6,
    washScale: 38,
    vignette: '#a8916a',
    vignetteStrength: 0.5,
    posterize: 5,
    bodyClass: 'variant-paper',
  },
};

