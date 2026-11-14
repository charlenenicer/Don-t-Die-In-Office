import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IQ, LIGHTNESS_CEIL, hexToRgb, paint, rgbToHex, rgbToHsl, saturation } from '../src/palette';

describe('painterly palette', () => {
  it('round-trips hex colours', () => {
    expect(rgbToHex(...hexToRgb('#b5246e'))).toBe('#b5246e');
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
    expect(() => hexToRgb('nope')).toThrow();
  });

  it('desaturates bright office colours but keeps their hue family', () => {
    for (const c of ['#e0452f', '#2f6fdb', '#43a85a', '#8a5fc4', '#e8b923']) {
      const out = paint(c);
      expect(saturation(out)).toBeLessThan(saturation(c));
      const before = rgbToHsl(...hexToRgb(c)).h;
      const after = rgbToHsl(...hexToRgb(out)).h;
      const diff = Math.abs(((after - before + 540) % 360) - 180);
      expect(diff).toBeLessThan(20);
    }
  });

  it('keeps whites off paper-white and warms neutral greys', () => {
    const white = hexToRgb(paint('#ffffff'));
    expect(Math.max(...white)).toBeLessThan(1);
    expect(rgbToHsl(...white).l).toBeLessThanOrEqual(LIGHTNESS_CEIL + 0.05);
    const [r, , b] = hexToRgb(paint('#b4b9c0'));
    expect(r).toBeGreaterThan(b); // the cool grey picked up the warm paper tint
  });

  it('is deterministic', () => {
    expect(paint('#1f9d9a')).toBe(paint('#1f9d9a'));
  });

  it("uses the same UI tokens as the stylesheet (Interview Quest's :root)", () => {
    const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
    for (const [name, value] of Object.entries(IQ)) {
      expect(css, `--${name}`).toContain(`--${name}: ${value};`);
    }
  });
});
