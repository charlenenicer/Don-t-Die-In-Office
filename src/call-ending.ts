/**
 * How conversations end. Three ways in:
 *  - the coworker wraps up: says one closing line, then hangs up with the voice
 *    engine's own end-call ability; the game gets `call_ended` and waits for the
 *    queued audio of that line to finish before tearing the call down;
 *  - the player winds down ("gotta go", "bye"): the coworker is prompted to close;
 *    if it hasn't hung up after its next reply plus a short silence, the game does;
 *  - the player presses E or walks out of range: whatever is being said finishes,
 *    the coworker gets a short farewell caption, then the call ends.
 * Nothing is ever cut off mid-sentence, and hanging up is never spoken.
 */

/** Walking further than this from the coworker you're talking to ends the conversation. */
export const WALK_AWAY_RANGE = 4.5;
/** ...after being out of range for this long, so brushing past the edge doesn't. */
export const WALK_AWAY_GRACE_S = 0.6;
/** Never wait longer than this for queued audio to drain. */
export const MAX_DRAIN_MS = 8000;
/** Silence after the coworker's reply to a goodbye before the game hangs up for them. */
export const GOODBYE_SILENCE_MS = 2500;

const WINDING_DOWN = [
  /\b(got|gotta|have|need) to (go|run|head|get going|get back)\b/,
  /\bgotta (go|run|bounce)\b/,
  /\b(i should|i'd better|i better) (go|get back|get going|head)\b/,
  /\b(good ?bye|bye|see you|see ya|catch you later|talk (to you )?later|later then)\b/,
  /\b(that's all|that's it for now|i'm heading off|heading out)\b/,
  /\b(thanks?|thank you),? (bye|that's all|see you)\b/,
];

/** Does this line from the player sound like they're wrapping up? */
export function isWindingDown(text: string): boolean {
  const t = text.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return WINDING_DOWN.some((r) => r.test(t));
}

/** Milliseconds until queued audio (scheduled up to `playhead` seconds) has played, plus a short tail. */
export function drainDelayMs(playheadS: number, nowS: number, tailMs = 250): number {
  const left = Math.max(0, playheadS - nowS) * 1000;
  return Math.min(MAX_DRAIN_MS, left > 0 ? left + tailMs : 0);
}

/** How long a line takes to say, for the demo client that shows text instead of audio. */
export function speechMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(7000, Math.max(1200, words * 330 + 400));
}

/** Tracks how long the player has been out of range of the coworker they're talking to. */
export class WalkAwayTimer {
  private outFor = 0;
  /** Returns true once, when the player has been out of range for the grace period. */
  update(distance: number, delta: number): boolean {
    if (distance <= WALK_AWAY_RANGE) {
      this.outFor = 0;
      return false;
    }
    const before = this.outFor;
    this.outFor += delta;
    return before < WALK_AWAY_GRACE_S && this.outFor >= WALK_AWAY_GRACE_S;
  }
  reset() { this.outFor = 0; }
}
