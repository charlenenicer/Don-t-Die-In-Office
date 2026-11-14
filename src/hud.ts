import type { Character, GameStats } from './types';

/**
 * HUD markup and small presentation rules, styled after Interview Quest's
 * panels (dark navy cards, amber accents, pill chips). Kept as plain strings so
 * they can be unit-tested without a DOM.
 */

export const STAT_KEYS = ['energy', 'reputation', 'performance', 'burnout'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  energy: 'Energy',
  reputation: 'Reputation',
  performance: 'Performance',
  burnout: 'Burnout',
};

/** Small icons shown before each stat, like Interview Quest's chips. */
export const STAT_ICONS: Record<StatKey, string> = {
  energy: '⚡',
  reputation: '★',
  performance: '▲',
  burnout: '🔥',
};

export type StatTone = 'good' | 'ok' | 'low';

/** Colour band for a stat value; burnout is "good" when it's low. */
export function statTone(stat: StatKey, value: number): StatTone {
  const v = stat === 'burnout' ? 100 - value : value;
  if (v >= 60) return 'good';
  if (v >= 30) return 'ok';
  return 'low';
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Initials for the dialogue portrait badge. */
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

/** Name tag over a coworker: name, plus role and the talk key once you're close (see `.near`). */
export function nameTagHtml(c: Pick<Character, 'name' | 'role'>): string {
  return `<b class="tag-name">${escapeHtml(c.name)}</b><small class="tag-role">${escapeHtml(c.role)}</small><span class="tag-key">E · talk</span>`;
}

function statRow(stat: StatKey, initial: number): string {
  return `
            <div class="stat ${stat}" data-tone="${statTone(stat, initial)}">
              <span class="stat-label"><i aria-hidden="true">${STAT_ICONS[stat]}</i>${STAT_LABELS[stat]}</span>
              <div class="stat-bar">
                <div class="stat-fill ${stat}" style="width: ${initial}%"></div>
              </div>
              <span class="stat-value">${initial}</span>
            </div>`;
}

export const INITIAL_STATS: GameStats = { energy: 80, reputation: 50, performance: 50, burnout: 0 };

/**
 * The HUD: brand bar on top (like Interview Quest's header), stats card bottom
 * left, clock chips top centre, inventory bottom right. Class names are the ones
 * main.ts updates.
 */
export function hudMarkup(voiceAvailable: boolean, day: string, stats: GameStats = INITIAL_STATS): string {
  return `
        <div class="hud">
          <div class="topbar">
            <div class="brand">
              <span class="brand-mark" aria-hidden="true">◆</span>
              <div><b>Open Plan</b><small>Review Week</small></div>
            </div>
            <div class="time-panel">
              <span class="chip day">${escapeHtml(day)}</span>
              <span class="chip time">9:00</span>
              <span class="chip review-countdown"></span>
              <span class="chip level">Junior</span>
              <span class="chip location">Reception</span>
            </div>
            <div class="mode-indicator ${voiceAvailable ? 'voice' : 'demo'}">
              ${voiceAvailable ? 'Voice Mode' : 'Demo Mode'}
            </div>
          </div>

          <div class="stats-panel card">
            <h2 class="panel-title">Your week</h2>${STAT_KEYS.map((k) => statRow(k, stats[k])).join('')}
          </div>

          <div class="inventory-panel card">
            <h2 class="inventory-title panel-title">Inventory</h2>
            <div class="inventory-items"></div>
          </div>

          <div class="zoom-controls" role="group" aria-label="Zoom">
            <button class="btn ghost sm zoom-in" title="Zoom in (+)" aria-label="Zoom in">+</button>
            <button class="btn ghost sm zoom-out" title="Zoom out (−)" aria-label="Zoom out">−</button>
          </div>
        </div>`;
}

/** Rooms and areas, labelled on the floor like Interview Quest's street names. */
export const AREA_LABELS: { name: string; x: number; z: number }[] = [
  { name: 'Meeting Room', x: -16.5, z: -15.2 },
  { name: "Manager's Office", x: 0, z: -15.2 },
  { name: "Boss's Office", x: 16.5, z: -15.2 },
  { name: 'Lunch Room', x: -18.5, z: -1.2 },
  { name: 'Copy Room', x: 18, z: -1.2 },
  { name: 'Open Office', x: -7.5, z: 0 },
  { name: 'Reception', x: 0, z: 18.5 },
  { name: 'Luxury Lounge', x: -18, z: 14 },
  { name: 'Fun Zone', x: 19, z: 12.5 },
  { name: 'TV Lounge', x: 9.5, z: 15.6 },
];
