// ─────────────────────────────────────────────────────────────────────────────
//  state.js — the save game. Currency, inventory, the beasts you've rescued and
//  their persistent care stats, placed decor, quests and settings. Auto-persists
//  to localStorage. Time-away need decay is computed on load so beasts "miss you".
// ─────────────────────────────────────────────────────────────────────────────
import { STARTER_INVENTORY } from './items-data.js';
import { metaOf, SPECIES_LIST } from '../creatures/index.js';

const KEY = 'hogwarts-beasts-save-v1';
const DECAY_PER_HR = { hunger: 5.5, energy: 3.0, joy: 4.2, hygiene: 2.4 };

let _id = 0;
const uid = () => 'b' + (Date.now().toString(36)) + (_id++).toString(36) + Math.floor(Math.random() * 1e4).toString(36);

export class GameState {
  constructor(bus) {
    this.bus = bus;
    this.loaded = false;
    this.data = null;
  }

  fresh() {
    const starter = metaOf('niffler');
    return {
      version: 1,
      created: Date.now(),
      lastPlayed: Date.now(),
      coins: 75,
      day: 1,
      keeperName: 'Keeper',
      inventory: { ...STARTER_INVENTORY },
      beasts: [],
      activeId: null,
      decor: [],
      unlocked: ['niffler'],
      quests: null,
      stats: { fed: 0, petted: 0, brushed: 0, played: 0, rescued: 0, collected: 0 },
      settings: { quality: null, music: true, sfx: true },
      onboarded: false,
    };
  }

  load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    if (raw) {
      try { this.data = JSON.parse(raw); } catch (e) { this.data = null; }
    }
    if (!this.data) this.data = this.fresh();
    this._applyAwayDecay();
    this.data.lastPlayed = Date.now();
    this.loaded = true;
    return this.data;
  }

  _applyAwayDecay() {
    const dtHr = Math.min(48, (Date.now() - (this.data.lastPlayed || Date.now())) / 3.6e6);
    if (dtHr < 0.01) return;
    for (const b of this.data.beasts) {
      for (const k in DECAY_PER_HR) {
        b.needs[k] = clamp(b.needs[k] - DECAY_PER_HR[k] * dtHr);
      }
    }
    this.awayHours = dtHr;
  }

  save() {
    if (!this.data) return;
    this.data.lastPlayed = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  }

  reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    this.data = this.fresh();
    this._seedFirstBeast();
    this.save();
  }

  // ── beasts ──
  _seedFirstBeast() {
    if (this.data.beasts.length) return;
    this.rescue('niffler', 'Galleon', true);
    this.data.activeId = this.data.beasts[0].id;
  }

  rescue(species, name, free = false) {
    const meta = metaOf(species);
    if (!meta) return null;
    if (!free) {
      if (this.data.coins < meta.unlockCost) return null;
      this.data.coins -= meta.unlockCost;
    }
    const b = {
      id: uid(), species, name: name || meta.name,
      needs: { hunger: 70, energy: 85, joy: 70, hygiene: 80 },
      bond: 0, level: 1, xp: 0,
      adoptedDay: this.data.day, careStreak: 0, totalCare: 0,
      seed: Math.floor(Math.random() * 1e6) + 1,
    };
    this.data.beasts.push(b);
    if (!this.data.unlocked.includes(species)) this.data.unlocked.push(species);
    this.data.stats.rescued++;
    this.bus?.emit('rescued', b);
    this.save();
    return b;
  }

  get active() { return this.data.beasts.find(b => b.id === this.data.activeId) || this.data.beasts[0] || null; }
  setActive(id) { this.data.activeId = id; this.bus?.emit('active-changed', this.active); }

  beast(id) { return this.data.beasts.find(b => b.id === id); }

  // ── economy ──
  get coins() { return this.data.coins; }
  addCoins(n) { this.data.coins = Math.max(0, this.data.coins + n); this.bus?.emit('coins', this.data.coins); }
  spend(n) { if (this.data.coins < n) return false; this.data.coins -= n; this.bus?.emit('coins', this.data.coins); return true; }

  // ── inventory ──
  inv(id) { return this.data.inventory[id] || 0; }
  addItem(id, n = 1) { this.data.inventory[id] = (this.data.inventory[id] || 0) + n; this.bus?.emit('inventory', id); }
  useItem(id, n = 1) {
    if ((this.data.inventory[id] || 0) < n) return false;
    this.data.inventory[id] -= n;
    if (this.data.inventory[id] <= 0) delete this.data.inventory[id];
    this.bus?.emit('inventory', id);
    return true;
  }

  // ── leveling / bond ──
  addBond(b, amount) {
    b.bond = clamp(b.bond + amount);
    b.totalCare += Math.max(0, amount);
    while (b.bond >= 100 && b.level < 20) {
      b.bond -= 100; b.level++;
      this.bus?.emit('levelup', b);
    }
    if (b.level >= 20) b.bond = Math.min(b.bond, 100);
  }

  applyNeeds(b, effects) {
    for (const k in effects) {
      if (b.needs[k] != null) b.needs[k] = clamp(b.needs[k] + effects[k]);
    }
  }

  // ── decor ──
  placeDecor(id) {
    if (this.data.decor.length >= 6) this.data.decor.shift();
    this.data.decor.push(id);
    this.bus?.emit('decor', this.data.decor);
    this.save();
  }
  removeDecorAt(i) { this.data.decor.splice(i, 1); this.bus?.emit('decor', this.data.decor); this.save(); }

  // ── day rollover ──
  advanceDay() {
    this.data.day++;
    for (const b of this.data.beasts) {
      const avg = (b.needs.hunger + b.needs.energy + b.needs.joy + b.needs.hygiene) / 4;
      if (avg > 55) b.careStreak++; else b.careStreak = 0;
    }
    this.bus?.emit('newday', this.data.day);
    this.save();
  }
}

function clamp(v) { return Math.min(100, Math.max(0, v)); }
export { clamp };
export const ALL_SPECIES = SPECIES_LIST;
