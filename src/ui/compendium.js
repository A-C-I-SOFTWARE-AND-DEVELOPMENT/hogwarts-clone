// ─────────────────────────────────────────────────────────────────────────────
//  compendium.js — the Keeper's field guide: the species Beastiary (discovered &
//  locked), the materials larder, and the workbench crafting bench. Render-only;
//  crafting goes through the game facade, everything else just paints state.
// ─────────────────────────────────────────────────────────────────────────────
import { el, fmtNum } from '../core/util.js';
import { MATERIALS, RECIPES, materialFor, RARITY_COLOR } from '../game/materials-data.js';
import { ITEMS } from '../game/items-data.js';
import { metaOf, SPECIES_LIST, RARITY } from '../creatures/index.js';
import { SPECIES_EMOJI } from './hud.js';

export function renderCompendium(game, ui, body, tab) {
  if (tab === 'materials') return renderMaterials(game, ui, body);
  if (tab === 'craft') return renderCraft(game, ui, body);
  return renderBeasts(game, ui, body);
}

// ── Beastiary ────────────────────────────────────────────────────────────────
function renderBeasts(game, ui, body) {
  const discovered = game.state.data.discovered || [];
  const total = SPECIES_LIST.length;
  const found = SPECIES_LIST.filter(m => discovered.includes(m.id)).length;
  const pct = total ? Math.round(found / total * 100) : 0;

  body.append(el('div', { style: 'margin-bottom:14px;font-family:\'Cinzel\';font-size:.9rem;color:var(--gold-hi);text-align:center' }, [
    el('span', { text: `Discovered ${found} / ${total} species` }),
    el('span', { style: 'color:var(--parchment-dim)', text: ` — ${pct}%` }),
  ]));

  const grid = el('div', { class: 'grid' });
  const sorted = [...SPECIES_LIST].sort((a, b) =>
    (RARITY[a.rarity].order - RARITY[b.rarity].order) || (a.unlockCost - b.unlockCost));

  sorted.forEach(meta => {
    const known = discovered.includes(meta.id);
    if (!known) {
      grid.append(el('div', { class: 'card locked', style: 'opacity:.5' }, [
        el('div', { class: 'top' }, [
          el('div', { class: 'em', text: '❓' }),
          el('div', {}, [
            el('div', { class: 'nm', text: '???' }),
            el('div', { style: 'font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;font-family:\'Cinzel\';color:var(--parchment-dim)', text: 'Undiscovered' }),
          ]),
        ]),
        el('div', { class: 'bl', text: 'A beast you have yet to meet…' }),
      ]));
      return;
    }
    const rar = RARITY[meta.rarity] || RARITY.common;
    const owned = game.state.data.beasts.filter(b => b.species === meta.id).length;
    const matId = materialFor(meta.id);
    const mat = matId ? MATERIALS[matId] : null;
    const fav = ITEMS[meta.favorite];

    grid.append(el('div', { class: 'card' }, [
      el('div', { class: 'top' }, [
        el('div', { class: 'em', text: SPECIES_EMOJI[meta.id] || '🐾' }),
        el('div', {}, [
          el('div', { class: 'nm', text: meta.name }),
          el('div', { style: `font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;font-family:'Cinzel';color:${rar.color}`, text: rar.label }),
        ]),
      ]),
      el('div', { class: 'bl', text: meta.blurb }),
      el('div', { style: 'display:flex;flex-direction:column;gap:3px;font-size:.62rem;color:var(--parchment-dim)' }, [
        el('div', { text: '🍽 ' + (meta.care?.feed || (fav ? fav.name : '—')) }),
        fav ? el('div', { text: `❤️ Favourite: ${fav.emoji} ${fav.name}` }) : null,
        mat ? el('div', { text: `🎁 Yields: ${mat.emoji} ${mat.name}` }) : null,
      ]),
      owned > 0
        ? el('div', { class: 'owned', text: `In your care ×${owned}` })
        : el('div', { class: 'owned', style: 'color:var(--parchment-dim)', text: 'None in your care' }),
    ]));
  });
  body.append(grid);
}

// ── Materials larder ─────────────────────────────────────────────────────────
function renderMaterials(game, ui, body) {
  body.append(el('div', { style: 'font-size:.86rem;color:var(--parchment-dim);font-style:italic;margin-bottom:14px;line-height:1.6',
    text: 'Magical materials are gathered when you collect produce from a contented beast, and now and then while grooming or bathing. Spend them at the workbench.' }));

  const grid = el('div', { class: 'grid' });
  Object.entries(MATERIALS).forEach(([id, m]) => {
    const count = game.state.mat(id);
    const color = RARITY_COLOR[m.rarity] || RARITY_COLOR.common;
    const has = count > 0;
    grid.append(el('div', { class: 'card', style: has ? null : 'opacity:.5' }, [
      el('div', { class: 'top' }, [
        el('div', { class: 'em', text: m.emoji }),
        el('div', {}, [
          el('div', { class: 'nm', text: m.name }),
          el('div', { style: `font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;font-family:'Cinzel';color:${color}`, text: m.rarity }),
        ]),
      ]),
      el('div', { class: 'bl', text: m.blurb }),
      el('div', { class: 'owned', style: has ? null : 'color:var(--parchment-dim)', text: `×${count}` }),
    ]));
  });
  body.append(grid);
}

// ── Workbench ────────────────────────────────────────────────────────────────
function renderCraft(game, ui, body) {
  body.append(el('div', { style: 'font-size:.86rem;color:var(--parchment-dim);font-style:italic;margin-bottom:14px;line-height:1.6',
    text: 'Combine harvested materials and a few Galleons to brew treats, charms and elixirs at the workbench.' }));

  const grid = el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(200px,1fr))' });
  RECIPES.forEach(r => {
    const out = ITEMS[r.makes];
    const enoughCoins = game.state.coins >= (r.coins || 0);
    const enoughMats = Object.entries(r.cost).every(([mid, n]) => game.state.mat(mid) >= n);
    const afford = enoughCoins && enoughMats;

    const costRow = el('div', { style: 'display:flex;gap:7px;flex-wrap:wrap;font-size:.7rem;align-items:center' });
    Object.entries(r.cost).forEach(([mid, n]) => {
      const m = MATERIALS[mid];
      const lack = game.state.mat(mid) < n;
      costRow.append(el('span', { style: `display:flex;align-items:center;gap:2px;color:${lack ? '#d9706b' : 'var(--parchment)'}` }, [
        el('span', { text: m ? m.emoji : '❔' }), el('b', { text: '×' + n }),
      ]));
    });
    if (r.coins) {
      costRow.append(el('span', { style: `display:flex;align-items:center;gap:2px;color:${enoughCoins ? 'var(--parchment)' : '#d9706b'}` }, [
        el('span', { text: '🪙' }), el('b', { text: fmtNum(r.coins) }),
      ]));
    }

    grid.append(el('div', { class: 'card' }, [
      el('div', { class: 'top' }, [
        el('div', { class: 'em', text: out ? out.emoji : '🧪' }),
        el('div', {}, [
          el('div', { class: 'nm' }, [
            el('span', { text: out ? out.name : r.makes }),
            r.qty > 1 ? el('span', { style: 'color:var(--gold-dim)', text: ' ×' + r.qty }) : null,
          ]),
        ]),
      ]),
      el('div', { class: 'bl', text: r.blurb }),
      costRow,
      el('button', {
        class: 'buy', disabled: afford ? null : 'disabled',
        onclick: () => { game.craft(r.id); ui.repaint(); },
      }, [el('span', { text: 'Craft' })]),
    ]));
  });
  body.append(grid);
}
