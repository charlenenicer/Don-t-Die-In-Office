/**
 * Painterly palette shared with Interview Quest: warm, slightly desaturated
 * colours on a deep navy night backdrop, with soft brown-black ink lines.
 *
 * `paint()` maps any of the original bright office colours onto that palette, so
 * the existing procedural props keep their identity (a red sofa stays red) but
 * read as part of the same hand-illustrated world.
 */

/** Interview Quest's UI tokens (src/style.css :root there), reused for the 3D world. */
export const IQ = {
  bg: '#0e1620',
  bg2: '#121d2a',
  text: '#e8eef5',
  muted: '#93a3b5',
  accent: '#ffb547',
  accent2: '#ffcf85',
  green: '#5fd39a',
  red: '#ff7a7a',
  blue: '#6fb6ff',
  teal: '#4fd1c5',
} as const;

/** Ink used for outlines in the post pass. */
export const INK = '#2a1d16';
/** Warm paper tint every colour is washed towards. */
export const PAPER = '#f1dfbd';
/** How much of the original saturation survives. */
export const SATURATION_KEEP = 0.7;
/** How far colours are washed towards the paper tint. */
export const PAPER_WASH = 0.1;
/** Hue nudge towards warm orange, as a fraction of the distance. */
export const WARM_SHIFT = 0.06;

/** Colours less saturated than this count as greys and are warmed. */
export const NEUTRAL_BELOW = 0.15;
/** Lightness is squeezed into this range so whites read as paint, not glare. */
export const LIGHTNESS_FLOOR = 0.05;
export const LIGHTNESS_CEIL = 0.88;

export interface HSL { h: number; s: number; l: number }

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`not a hex colour: ${hex}`);
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: HSL): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 360;
  const t = (x: number) => {
    let v = x;
    if (v < 0) v += 1;
    if (v > 1) v -= 1;
    if (v < 1 / 6) return p + (q - p) * 6 * v;
    if (v < 1 / 2) return q;
    if (v < 2 / 3) return p + (q - p) * (2 / 3 - v) * 6;
    return p;
  };
  return [t(hk + 1 / 3), t(hk), t(hk - 1 / 3)];
}

/** Shortest signed angle from a to b, in degrees. */
function angleTo(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/** Map a colour onto the warm, slightly desaturated painterly palette. */
export function paint(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  // near-neutral greys become warm greys (like paint mixed with umber); colours keep their hue
  const neutral = hsl.s < NEUTRAL_BELOW;
  const warmed: HSL = {
    h: neutral ? 32 : hsl.h + angleTo(hsl.h, 32) * WARM_SHIFT,
    s: neutral ? 0.1 + hsl.s * 0.3 : hsl.s * SATURATION_KEEP,
    // no paper-white or pure black: the brightest surfaces stay a soft cream
    l: LIGHTNESS_FLOOR + hsl.l * (LIGHTNESS_CEIL - LIGHTNESS_FLOOR),
  };
  const [pr, pg, pb] = hexToRgb(PAPER);
  const [wr, wg, wb] = hslToRgb(warmed);
  return rgbToHex(wr + (pr - wr) * PAPER_WASH, wg + (pg - wg) * PAPER_WASH, wb + (pb - wb) * PAPER_WASH);
}

export function saturation(hex: string): number {
  return rgbToHsl(...hexToRgb(hex)).s;
}
