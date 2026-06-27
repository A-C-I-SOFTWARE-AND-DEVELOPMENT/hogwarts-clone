// ─────────────────────────────────────────────────────────────────────────────
//  materials-data.js — the magical materials beasts yield when well cared for
//  (harvested via "collect" and occasionally while grooming/bathing), plus the
//  workbench recipes that turn them into treats, charms and elixirs.
// ─────────────────────────────────────────────────────────────────────────────

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

// which material each species yields
export const SPECIES_MATERIAL = {
  niffler: 'niffler_gold', mooncalf: 'moon_dew', puffskein: 'puff_fluff', kneazle: 'kneazle_whisker',
  jobberknoll: 'jobber_feather', fwooper: 'fwooper_plume', diricawl: 'diri_down', graphorn: 'graphorn_dust',
  hippogriff: 'hippo_feather', thestral: 'thestral_hair', unicorn: 'unicorn_hair',
};

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
  common: '#9c8e6e', uncommon: '#6fae7a', rare: '#6f8fd6', epic: '#b07fe0', legendary: '#e0b24b',
};

export function materialList() {
  return Object.entries(MATERIALS).map(([id, m]) => ({ id, ...m }));
}
