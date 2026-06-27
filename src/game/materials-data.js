// ─────────────────────────────────────────────────────────────────────────────
//  materials-data.js — the magical materials beasts yield when well cared for
//  (harvested via "collect" and occasionally while grooming/bathing), plus the
//  workbench recipes that turn them into treats, charms and elixirs.
//
//  The eleven hero beasts have hand-curated materials below; every data-driven
//  spec creature gets a lore-accurate material auto-derived from its `produces`
//  (e.g. Demiguise → Demiguise hair, Basilisk → Basilisk venom) so the
//  Compendium shows a harvestable yield for ALL ~100 species, not just the heroes.
// ─────────────────────────────────────────────────────────────────────────────
import { SPECS } from '../creatures/specs.js';

export const MATERIALS = {
  niffler_gold:    { name: 'Niffler Trinket',   emoji: '🪙', rarity: 'common',    blurb: 'Shiny baubles squirreled away.' },
  moon_dew:        { name: 'Moon-Dew',          emoji: '💧', rarity: 'uncommon',  blurb: 'Silvery dew gathered under moonlight.' },
  puff_fluff:      { name: 'Puffskein Fluff',   emoji: '☁️', rarity: 'common',    blurb: 'Impossibly soft custard down.' },
  kneazle_whisker: { name: 'Kneazle Whisker',   emoji: '〰️', rarity: 'uncommon',  blurb: 'Senses ill intent at a distance.' },
  jobber_feather:  { name: 'Jobberknoll Feather',emoji: '🪶', rarity: 'uncommon', blurb: 'Used in Truth Serums and Memory Potions.' },
  fwooper_plume:   { name: 'Fwooper Plume',     emoji: '🌈', rarity: 'rare',      blurb: 'Outrageously colourful quill.' },
  diri_down:       { name: 'Diricawl Down',     emoji: '🌫️', rarity: 'rare',      blurb: 'Faintly fades in and out of sight.' },
  graphorn_dust:   { name: 'Graphorn Dust',     emoji: '🪨', rarity: 'epic',      blurb: 'Ground from shed horn — tough as dragonhide.' },
  hippo_feather:   { name: 'Hippogriff Feather', emoji: '🪽', rarity: 'epic',     blurb: 'A proud, storm-grey flight feather.' },
  thestral_hair:   { name: 'Thestral Tail-Hair', emoji: '🖤', rarity: 'rare',     blurb: 'A potent, death-touched wand core.' },
  unicorn_hair:    { name: 'Unicorn Hair',      emoji: '✨', rarity: 'legendary', blurb: 'Pure, loyal, and faintly glowing.' },
};

// which material each species yields (hero beasts; spec beasts appended below)
export const SPECIES_MATERIAL = {
  niffler: 'niffler_gold', mooncalf: 'moon_dew', puffskein: 'puff_fluff', kneazle: 'kneazle_whisker',
  jobberknoll: 'jobber_feather', fwooper: 'fwooper_plume', diricawl: 'diri_down', graphorn: 'graphorn_dust',
  hippogriff: 'hippo_feather', thestral: 'thestral_hair', unicorn: 'unicorn_hair',
};

// ── auto-derive a material for every data-driven spec creature ────────────────
// pick an emoji from keywords in the material's name, falling back by rarity.
const MAT_EMOJI = [
  [/feather|plume|quill|down|crest/i, '🪶'], [/scale|carapace|shell|chitin/i, '🐚'],
  [/horn|tusk|antler|spur|fang|tooth/i, '🦴'], [/venom|sting|poison/i, '☠️'],
  [/blood|fluid|ichor/i, '🩸'], [/egg/i, '🥚'],
  [/ooze|mucus|treacle|slime|pustule|jelly|goo/i, '🧪'], [/hair|fur|mane|whisker|wool|hide|pelt|skin/i, '🧶'],
  [/gold|coin|trinket|treasure|galleon/i, '🪙'], [/tentacle/i, '🐙'],
  [/reed|wood|sliver|bark|leaf|root|moss|vine|petal|bloom/i, '🌿'], [/riddle|rune|scroll/i, '📜'],
  [/crystal|gem|jewel|star|shard/i, '💎'], [/fire|flame|ember|ash|cinder|spark/i, '🔥'],
  [/ice|frost|snow/i, '❄️'], [/light|glow|lumin|radian/i, '🌟'],
];
function matEmoji(name, tier) {
  for (const [re, em] of MAT_EMOJI) if (re.test(name)) return em;
  return ({ common: '🍂', uncommon: '🌾', rare: '🔮', ultra: '🪄', legendary: '👑', mythic: '🌌' })[tier] || '✨';
}
// fallback material name when a spec has no explicit produce item
function fallbackMatName(spec) {
  const skin = spec.build?.skin, arch = spec.build?.archetype;
  const suffix = /feather/.test(skin) || arch === 'avian' ? 'Feather'
    : /scale/.test(skin) || arch === 'dragon' || arch === 'serpent' ? 'Scale'
    : /chitin/.test(skin) || arch === 'insectoid' || arch === 'arachnid' ? 'Carapace'
    : /hide|fur/.test(skin) || arch === 'beast' || arch === 'rodent' || arch === 'equine' ? 'Tuft'
    : /bark|plant/.test(skin) || arch === 'plant' ? 'Frond'
    : /slime|ethereal/.test(skin) || arch === 'amorphous' ? 'Essence'
    : 'Token';
  return `${spec.name} ${suffix}`;
}
for (const spec of SPECS) {
  if (SPECIES_MATERIAL[spec.id]) continue;            // hero beasts keep curated mats
  const id = spec.id + '_mat';
  const name = (spec.produces && spec.produces.item) ? spec.produces.item : fallbackMatName(spec);
  MATERIALS[id] = {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    emoji: matEmoji(name, spec.tier),
    rarity: spec.tier,
    blurb: `Harvested from a contented ${spec.name}.`,
  };
  SPECIES_MATERIAL[spec.id] = id;
}

export function materialFor(species) { return SPECIES_MATERIAL[species]; }

// workbench recipes → produce an item id (added to inventory) from materials + coins
export const RECIPES = [
  { id: 'gourmet_treat', makes: 'gourmet_treat', qty: 2, coins: 10,
    cost: { puff_fluff: 1, moon_dew: 1 }, blurb: 'A favourite-tier treat any beast adores.' },
  { id: 'growth_pellet', makes: 'growth_pellet', qty: 1, coins: 40,
    cost: { jobber_feather: 2, kneazle_whisker: 1 }, blurb: 'Helps a beast grow a life-stage sooner.' },
  { id: 'luck_charm', makes: 'luck_charm', qty: 1, coins: 30,
    cost: { niffler_gold: 4, fwooper_plume: 1 }, blurb: 'Habitat charm: +50% Galleon produce nearby.' },
  { id: 'mana_crystal', makes: 'crystal', qty: 1, coins: 60,
    cost: { graphorn_dust: 1, hippo_feather: 1 }, blurb: 'A restorative habitat crystal.' },
  { id: 'shiny_lure', makes: 'shiny_lure', qty: 1, coins: 80,
    cost: { unicorn_hair: 1, fwooper_plume: 1, diri_down: 1 }, blurb: 'Guarantees the next egg hatches Shiny.' },
];

export const RARITY_COLOR = {
  common: '#9c8e6e', uncommon: '#6fae7a', rare: '#6f8fd6', epic: '#b07fe0', ultra: '#b07fe0',
  legendary: '#e0b24b', mythic: '#e0584b',
};

export function materialList() {
  return Object.entries(MATERIALS).map(([id, m]) => ({ id, ...m }));
}
