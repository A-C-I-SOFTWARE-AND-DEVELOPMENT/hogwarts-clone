// ─────────────────────────────────────────────────────────────────────────────
//  needs.js — the care model. Needs drift down over time; tending them up is the
//  game. Mood is a weighted blend that drives the creature's animation and your
//  passive income. Decor placed in the habitat slows the drift.
// ─────────────────────────────────────────────────────────────────────────────
import { clamp } from './state.js';

export const NEED_META = {
  hunger:  { label: 'Fed',     icon: '🍖', color: '#e8a34b', low: 'Hungry' },
  energy:  { label: 'Rested',  icon: '⚡', color: '#7ec0e8', low: 'Tired' },
  joy:     { label: 'Happy',   icon: '✨', color: '#e07fc0', low: 'Lonely' },
  hygiene: { label: 'Clean',   icon: '🫧', color: '#7fd6b0', low: 'Grubby' },
};
export const NEED_KEYS = ['hunger', 'energy', 'joy', 'hygiene'];

// drift per real minute (gentle — this is a cozy game)
const DRIFT = { hunger: 6.5, energy: 3.6, joy: 5.4, hygiene: 2.8 };

export function moodValue(needs) {
  return clamp(needs.hunger * 0.30 + needs.energy * 0.20 + needs.joy * 0.35 + needs.hygiene * 0.15) / 100;
}

export function moodLabel(m) {
  if (m > 0.85) return { word: 'Blissful', emoji: '😍', color: '#e0b24b' };
  if (m > 0.68) return { word: 'Happy', emoji: '😊', color: '#6fae7a' };
  if (m > 0.5) return { word: 'Content', emoji: '🙂', color: '#9bbf6a' };
  if (m > 0.34) return { word: 'Restless', emoji: '😕', color: '#d8a14b' };
  if (m > 0.18) return { word: 'Sad', emoji: '😢', color: '#d87a4b' };
  return { word: 'Distressed', emoji: '😣', color: '#d85a5a' };
}

export function lowestNeed(needs) {
  let k = NEED_KEYS[0];
  for (const n of NEED_KEYS) if (needs[n] < needs[k]) k = n;
  return { key: k, value: needs[k], meta: NEED_META[k] };
}

// advance one beast's needs by dt seconds. auraBonus 0..1 slows the drift.
export function tickNeeds(b, dt, auraBonus = 0, asleep = false) {
  const slow = 1 - clamp(auraBonus, 0, 0.6);
  for (const k of NEED_KEYS) {
    let rate = DRIFT[k] / 60 * dt * slow;
    // sleeping recovers energy and slows hunger drain
    if (asleep) {
      if (k === 'energy') { b.needs[k] = clamp(b.needs[k] + (8 / 60) * dt); continue; }
      rate *= 0.4;
    }
    b.needs[k] = clamp(b.needs[k] - rate);
  }
}

export function needBadges(needs) {
  return NEED_KEYS.map(k => ({ key: k, value: needs[k], ...NEED_META[k], urgent: needs[k] < 30 }));
}
