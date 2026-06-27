// ─────────────────────────────────────────────────────────────────────────────
//  breeding.js — pair two grown, content beasts of the same species to lay an
//  egg. The offspring inherits a fresh roll of genes (colour/size/personality/
//  shiny) from both parents. A handful of "magical pairings" cross-breed into a
//  different species as a rare surprise.
// ─────────────────────────────────────────────────────────────────────────────
import { moodValue } from './needs.js';
import { rollGenes, stageOf } from './genetics.js';
import { metaOf } from '../creatures/index.js';

// rare cross-species results (order-independent) → child species
const MAGICAL_PAIRINGS = {
  'kneazle+puffskein': 'puffskein',
  'mooncalf+unicorn': 'unicorn',
  'thestral+hippogriff': 'thestral',
  'fwooper+jobberknoll': 'fwooper',
};

const pairKey = (a, b) => [a, b].sort().join('+');

export function pairResultSpecies(a, b) {
  if (a.species === b.species) return a.species;
  return MAGICAL_PAIRINGS[pairKey(a.species, b.species)] || null;
}

// requirements: both grown (adult+), content, not already an egg-parent, distinct
export function canBreed(state, a, b) {
  if (!a || !b || a.id === b.id) return { ok: false, reason: 'Pick two different beasts.' };
  if (state.data.beasts.length >= 14) return { ok: false, reason: 'Your vivarium is full.' };
  const sa = stageOf(a.level), sb = stageOf(b.level);
  if (sa.key === 'baby' || sa.key === 'juvenile' || sb.key === 'baby' || sb.key === 'juvenile')
    return { ok: false, reason: 'Both beasts must be fully grown (Adult).' };
  if (moodValue(a.needs) < 0.6 || moodValue(b.needs) < 0.6)
    return { ok: false, reason: 'Both beasts must be Happy (well cared for).' };
  const busy = new Set(state.data.eggs.flatMap(e => [e.a, e.b]));
  if (busy.has(a.id) || busy.has(b.id)) return { ok: false, reason: 'A parent is already nurturing an egg.' };
  const sp = pairResultSpecies(a, b);
  if (!sp) return { ok: false, reason: 'These two aren\'t compatible. Try a matching pair.' };
  return { ok: true, species: sp, hybrid: sp !== a.species };
}

// produce the egg payload (call after a successful courtship). danceBonus 0..1
// raises the chance of a shiny / better genes.
export function makeEgg(state, a, b, danceBonus = 0) {
  const species = pairResultSpecies(a, b) || a.species;
  const genes = rollGenes(a.genes, b.genes);
  if (danceBonus > 0.7 && Math.random() < danceBonus * 0.4) genes.shiny = true;
  if (danceBonus > 0.4) { genes.light = Math.min(1.25, genes.light * (1 + danceBonus * 0.05)); }
  return state.startEgg(a.id, b.id, species, genes);
}

export function eggParentNames(state, egg) {
  return [state.beast(egg.a)?.name || '?', state.beast(egg.b)?.name || '?'];
}

export function suggestChildName(species) {
  const meta = metaOf(species);
  const pool = {
    niffler: ['Sickle', 'Knut', 'Glint', 'Sixpence'], mooncalf: ['Luna', 'Pip', 'Dewdrop'],
    puffskein: ['Fizz', 'Pom', 'Tuffet'], kneazle: ['Mittens', 'Sphinx', 'Tabby'],
    unicorn: ['Aurora', 'Lumi', 'Pearl'], graphorn: ['Boulder', 'Tusk'], hippogriff: ['Skywing', 'Talon'],
    thestral: ['Wisp', 'Shade'], fwooper: ['Mango', 'Plume'], jobberknoll: ['Sky', 'Cobalt'], diricawl: ['Dodo', 'Puff'],
  };
  const arr = pool[species] || [meta?.name || 'Hatchling'];
  return arr[Math.floor(Math.random() * arr.length)];
}
