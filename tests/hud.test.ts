import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AREA_LABELS, STAT_KEYS, escapeHtml, hudMarkup, initials, nameTagHtml, statTone } from '../src/hud';
import { CHARACTERS } from '../src/characters';

describe('HUD markup', () => {
  const html = hudMarkup(false, 'Wednesday');

  it('has every stat bar with the classes main.ts updates', () => {
    for (const stat of STAT_KEYS) {
      expect(html).toContain(`class="stat-fill ${stat}"`);
    }
    // main.ts reads the value from the element right after the bar
    expect(html).toMatch(/<div class="stat-bar">\s*<div class="stat-fill energy" style="width: 80%"><\/div>\s*<\/div>\s*<span class="stat-value">80<\/span>/);
  });

  it('has the clock, countdown, level, location and inventory hooks', () => {
    for (const cls of ['time-panel', 'day', 'time', 'review-countdown', 'level', 'location', 'inventory-items', 'mode-indicator']) {
      expect(html).toContain(cls);
    }
    expect(html).toContain('Wednesday');
  });

  it('shows the voice or demo badge', () => {
    expect(html).toContain('Demo Mode');
    expect(hudMarkup(true, 'Wednesday')).toContain('Voice Mode');
  });

  it('uses Interview Quest panel styling (card, chips, panel titles) and has zoom buttons', () => {
    expect(html).toContain('stats-panel card');
    expect(html).toContain('chip time');
    expect(html).toContain('panel-title');
    expect(html).toContain('zoom-in');
    expect(html).toContain('zoom-out');
  });

  it('escapes the day name', () => {
    expect(hudMarkup(false, '<b>x</b>')).not.toContain('<b>x</b>');
  });
});

describe('stat tones', () => {
  it('colours high energy good and low energy low', () => {
    expect(statTone('energy', 80)).toBe('good');
    expect(statTone('energy', 45)).toBe('ok');
    expect(statTone('energy', 10)).toBe('low');
  });

  it('treats burnout the other way round', () => {
    expect(statTone('burnout', 0)).toBe('good');
    expect(statTone('burnout', 90)).toBe('low');
  });
});

describe('name tags', () => {
  it('shows name and role for every coworker, escaped', () => {
    for (const c of CHARACTERS) {
      const tag = nameTagHtml(c);
      expect(tag).toContain(escapeHtml(c.name));
      expect(tag).toContain(escapeHtml(c.role));
      expect(tag).toContain('tag-key');
    }
    expect(nameTagHtml({ name: '<i>', role: 'a&b' })).toBe(
      '<b class="tag-name">&lt;i&gt;</b><small class="tag-role">a&amp;b</small><span class="tag-key">E · talk</span>',
    );
  });

  it('makes two-letter portrait initials', () => {
    expect(initials('Taylor Brooks')).toBe('TB');
    expect(initials('james')).toBe('J');
    expect(initials('Mary Ann de Vries')).toBe('MA');
  });
});

describe('area labels', () => {
  it('are inside the office and uniquely named', () => {
    const names = new Set(AREA_LABELS.map((a) => a.name));
    expect(names.size).toBe(AREA_LABELS.length);
    for (const a of AREA_LABELS) {
      expect(Math.abs(a.x)).toBeLessThan(25);
      expect(Math.abs(a.z)).toBeLessThan(25);
    }
  });
});

describe('stylesheet', () => {
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  it('styles the restyled pieces', () => {
    for (const sel of ['.topbar', '.dlg-box', '.result-card', '.character-label.near', '.area-label', '.hint', '.btn.ghost']) {
      expect(css).toContain(sel);
    }
  });
  it('turns animations off under prefers-reduced-motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation: none !important/);
  });
});
