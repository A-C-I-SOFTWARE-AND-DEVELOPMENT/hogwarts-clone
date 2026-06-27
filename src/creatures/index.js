// ─────────────────────────────────────────────────────────────────────────────
//  index.js — creature registry. Maps a species id -> { meta, build }.
//  Adding a beast = drop a file in this folder and register it here.
// ─────────────────────────────────────────────────────────────────────────────
import * as niffler from './niffler.js';
import * as mooncalf from './mooncalf.js';
import * as puffskein from './puffskein.js';
import * as kneazle from './kneazle.js';
import * as jobberknoll from './jobberknoll.js';
import * as fwooper from './fwooper.js';
import * as diricawl from './diricawl.js';
import * as graphorn from './graphorn.js';
import * as hippogriff from './hippogriff.js';
import * as thestral from './thestral.js';
import * as unicorn from './unicorn.js';

const MODULES = [
  niffler, mooncalf, puffskein, kneazle, jobberknoll,
  fwooper, diricawl, graphorn, hippogriff, thestral, unicorn,
];

export const SPECIES = {};
export const SPECIES_LIST = [];
for (const m of MODULES) {
  if (!m || !m.meta || !m.build) continue;
  SPECIES[m.meta.id] = { meta: m.meta, build: m.build };
  SPECIES_LIST.push(m.meta);
}

export function buildCreature(species, opts) {
  const s = SPECIES[species];
  if (!s) throw new Error('Unknown species: ' + species);
  return s.build(opts);
}

export function metaOf(species) { return SPECIES[species]?.meta; }

export const RARITY = {
  common: { label: 'Common', color: '#9c8e6e', order: 0 },
  uncommon: { label: 'Uncommon', color: '#6fae7a', order: 1 },
  rare: { label: 'Rare', color: '#6f8fd6', order: 2 },
  epic: { label: 'Epic', color: '#b07fe0', order: 3 },
  legendary: { label: 'Legendary', color: '#e0b24b', order: 4 },
};
