// ─────────────────────────────────────────────────────────────────────────────
//  items-data.js — every feedable, toy, tool and decoration in the vivarium.
//  Each item declares what care-need it serves and how strongly, plus shop cost.
// ─────────────────────────────────────────────────────────────────────────────

// kind: food | treat | tool | toy | decor
// effects are applied to the active beast's needs (clamped 0..100)
export const ITEMS = {
  // ── FOOD (restores hunger; favourites give bonus joy + bond) ──
  gold_coin:     { name: 'Galleon',        kind: 'treat', emoji: '🪙', cost: 0,  sell: 1,  effects: { hunger: 8,  joy: 6 },  tag: 'shiny', blurb: 'Nifflers cannot resist.' },
  shiny_gem:     { name: 'Moonstone',      kind: 'treat', emoji: '💎', cost: 40, sell: 18, effects: { hunger: 14, joy: 10 }, tag: 'shiny', blurb: 'A glittering prize.' },
  sweet_truffle: { name: 'Sugar Truffle',  kind: 'treat', emoji: '🍬', cost: 12, sell: 4,  effects: { hunger: 16, joy: 8 },  tag: 'sweet', blurb: 'A honeyed treat most beasts adore.' },
  leafy_greens:  { name: 'Fanged Greens',  kind: 'food',  emoji: '🥬', cost: 6,  sell: 2,  effects: { hunger: 22, energy: 6 }, tag: 'plant', blurb: 'Wholesome, if a touch bitey.' },
  moon_pellet:   { name: 'Moon Pellet',    kind: 'food',  emoji: '🌙', cost: 18, sell: 6,  effects: { hunger: 26, joy: 12 }, tag: 'lunar', blurb: 'Glows faintly silver at night.' },
  raw_meat:      { name: 'Dragon Jerky',   kind: 'food',  emoji: '🥩', cost: 20, sell: 7,  effects: { hunger: 30, energy: 10 }, tag: 'meat', blurb: 'For the fiercer appetites.' },
  fresh_fish:    { name: 'Silver Trout',   kind: 'food',  emoji: '🐟', cost: 14, sell: 5,  effects: { hunger: 24, energy: 8 },  tag: 'fish', blurb: 'Caught from the Black Lake.' },
  berries:       { name: 'Bowtruckle Berries', kind: 'food', emoji: '🫐', cost: 8, sell: 3, effects: { hunger: 18, joy: 6 }, tag: 'plant', blurb: 'Tart and full of magic.' },
  honey_pot:     { name: 'Pot of Honey',   kind: 'food',  emoji: '🍯', cost: 16, sell: 6,  effects: { hunger: 20, joy: 14 }, tag: 'sweet', blurb: 'Sticky, golden, beloved.' },
  beetle:        { name: 'Glow Beetle',    kind: 'food',  emoji: '🪲', cost: 10, sell: 3,  effects: { hunger: 16, joy: 6 },  tag: 'bug', blurb: 'A crunchy midnight snack.' },

  // ── RESTORATIVES ──
  pepperup:      { name: 'Pepperup Tonic', kind: 'tool',  emoji: '🧪', cost: 30, sell: 0,  effects: { energy: 45 }, tag: 'potion', blurb: 'Steam from the ears — fully rested.' },
  calming_draught:{name: 'Calming Draught',kind: 'tool',  emoji: '🍵', cost: 26, sell: 0,  effects: { joy: 30, energy: 10 }, tag: 'potion', blurb: 'Soothes a frightened beast.' },

  // ── CRAFTED (made at the workbench from harvested materials; not sold) ──
  gourmet_treat: { name: 'Gourmet Beast Treat', kind: 'treat', emoji: '🧁', cost: 0, sell: 0, crafted: true, effects: { hunger: 34, joy: 28, energy: 8 }, tag: 'sweet', universalFav: true, blurb: 'Every beast adores it — a feast of bond.' },
  growth_pellet: { name: 'Growth Pellet',      kind: 'tool',  emoji: '🌟', cost: 0, sell: 0, crafted: true, grantsLevel: 1, blurb: 'Coaxes a beast to grow a stage faster.' },
  shiny_lure:    { name: 'Shiny Lure',         kind: 'tool',  emoji: '🪄', cost: 0, sell: 0, crafted: true, blurb: 'The next egg is guaranteed to hatch shiny.' },

  // ── TOOLS (used in care actions, not consumed) ──
  brush:         { name: 'Grooming Brush', kind: 'tool',  emoji: '🧹', cost: 0,  sell: 0,  persistent: true, blurb: 'For brushing fur, scale and feather.' },
  soap:          { name: 'Bubotuber Soap', kind: 'tool',  emoji: '🫧', cost: 0,  sell: 0,  persistent: true, blurb: 'A magical lather that never runs out.' },
  ball:          { name: 'Bouncing Ball',  kind: 'toy',   emoji: '🥎', cost: 35, sell: 0,  persistent: true, effects: { joy: 0 }, blurb: 'Enchanted to bounce forever.' },
  feather_wand:  { name: 'Feather Wand',   kind: 'toy',   emoji: '🪶', cost: 28, sell: 0,  persistent: true, blurb: 'Teases out a playful streak.' },
  whistle:       { name: 'Summoning Whistle', kind: 'toy', emoji: '📯', cost: 45, sell: 0, persistent: true, blurb: 'Calls every beast to your side.' },

  // ── DECOR (placed in habitat; small ambient joy aura) ──
  lantern:       { name: 'Floating Lantern', kind: 'decor', emoji: '🏮', cost: 60,  sell: 20, aura: 2, blurb: 'Warm light that drifts on its own.' },
  fountain:      { name: 'Stone Fountain',   kind: 'decor', emoji: '⛲', cost: 140, sell: 50, aura: 4, blurb: 'Beasts love to drink and splash.' },
  pumpkin_patch: { name: 'Pumpkin Patch',    kind: 'decor', emoji: '🎃', cost: 90,  sell: 30, aura: 3, blurb: 'Hagrid would be proud.' },
  toy_chest:     { name: 'Toy Chest',        kind: 'decor', emoji: '🧰', cost: 80,  sell: 26, aura: 3, blurb: 'A jumble of beloved playthings.' },
  cozy_nest:     { name: 'Cozy Nest',        kind: 'decor', emoji: '🪺', cost: 70,  sell: 24, aura: 3, blurb: 'A snug place to rest and recover.' },
  crystal:       { name: 'Mana Crystal',     kind: 'decor', emoji: '🔮', cost: 200, sell: 70, aura: 6, blurb: 'Hums with restorative magic.' },
  luck_charm:    { name: 'Leprechaun Charm',  kind: 'decor', emoji: '🍀', cost: 0,   sell: 40, aura: 2, crafted: true, coinBoost: 0.5, blurb: 'Beasts nearby produce extra Galleons.' },
  breeding_pen:  { name: 'Breeding Pen',      kind: 'decor', emoji: '💞', cost: 260, sell: 80, aura: 2, blurb: 'A cosy bower where pairs may court and nest.' },
};

// Starter inventory the player begins with
export const STARTER_INVENTORY = {
  gold_coin: 8, sweet_truffle: 4, leafy_greens: 6, moon_pellet: 3,
  brush: 1, soap: 1, ball: 1,
};

export function itemList(filterKind) {
  return Object.entries(ITEMS)
    .filter(([, v]) => !filterKind || v.kind === filterKind)
    .map(([id, v]) => ({ id, ...v }));
}

export const SHOP_ORDER = [
  'leafy_greens', 'berries', 'fresh_fish', 'beetle', 'honey_pot', 'sweet_truffle',
  'moon_pellet', 'raw_meat', 'shiny_gem',
  'pepperup', 'calming_draught',
  'ball', 'feather_wand', 'whistle',
  'cozy_nest', 'toy_chest', 'pumpkin_patch', 'lantern', 'fountain', 'crystal',
];
