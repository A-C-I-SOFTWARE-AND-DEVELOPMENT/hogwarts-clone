// ─────────────────────────────────────────────────────────────────────────────
//  shop.js — Eeylops & Co. (supplies) and The Sanctuary (adopt new beasts).
//  Render-only: all purchasing logic lives on the game facade; these just paint.
// ─────────────────────────────────────────────────────────────────────────────
import { el, fmtNum } from '../core/util.js';
import { ITEMS, SHOP_ORDER } from '../game/items-data.js';
import { ALL_SPECIES } from '../game/state.js';
import { RARITY, metaOf } from '../creatures/index.js';
import { SPECIES_EMOJI } from './hud.js';

const TAB_KINDS = {
  food: ['food', 'treat'],
  care: ['tool'],
  toy: ['toy'],
  decor: ['decor'],
};

export function renderShop(game, ui, body, tab) {
  const kinds = TAB_KINDS[tab] || ['food'];
  const grid = el('div', { class: 'grid' });
  const ids = SHOP_ORDER.filter(id => ITEMS[id] && kinds.includes(ITEMS[id].kind) && ITEMS[id].cost > 0);
  if (tab === 'care') {
    // include the free starter tools as "owned" reference plus restoratives
    ['pepperup', 'calming_draught'].forEach(id => { if (!ids.includes(id)) ids.unshift(id); });
  }
  ids.forEach(id => {
    const it = ITEMS[id];
    const owned = game.state.inv(id);
    const placed = tab === 'decor' ? game.state.data.decor.filter(d => d === id).length : 0;
    const afford = game.state.coins >= it.cost;
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'top' }, [
        el('div', { class: 'em', text: it.emoji }),
        el('div', {}, [
          el('div', { class: 'nm', text: it.name }),
          owned > 0 && it.kind !== 'decor' ? el('div', { class: 'owned', text: 'Owned ×' + owned }) : null,
        ]),
      ]),
      el('div', { class: 'bl', text: it.blurb || '' }),
      el('button', {
        class: 'buy', disabled: afford ? null : 'disabled',
        onclick: () => {
          if (tab === 'decor') game.placeDecor(id); else game.buy(id);
          ui.repaint();
        },
      }, [
        el('span', { text: tab === 'decor' ? (placed ? `Place again` : 'Place') : 'Buy' }),
        el('span', { class: 'cost' }, [el('span', { text: '🪙' }), el('b', { text: fmtNum(it.cost) })]),
      ]),
    ]);
    grid.append(card);
  });
  body.append(grid);

  if (tab === 'decor') {
    body.append(el('div', { style: 'margin-top:14px;font-size:.78rem;color:var(--parchment-dim);font-style:italic;text-align:center',
      text: `Placed ${game.state.data.decor.length}/6 — decor calms your beasts and slows their needs. Newest replaces oldest.` }));
  }
}

export function renderSanctuary(game, ui, body) {
  const intro = el('div', { style: 'font-size:.86rem;color:var(--parchment-dim);font-style:italic;margin-bottom:14px;line-height:1.6',
    text: 'Rescued beasts join your vivarium to be fed, played with and loved. Rarer beasts ask a greater bond — and a greater price.' });
  body.append(intro);
  const grid = el('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(180px,1fr))' });

  const sorted = [...ALL_SPECIES].sort((a, b) => (RARITY[a.rarity].order - RARITY[b.rarity].order) || (a.unlockCost - b.unlockCost));
  sorted.forEach(meta => {
    const rar = RARITY[meta.rarity] || RARITY.common;
    const ownedCount = game.state.data.beasts.filter(b => b.species === meta.id).length;
    const afford = game.state.coins >= meta.unlockCost;
    const card = el('div', { class: 'card' }, [
      el('div', { class: 'top' }, [
        el('div', { class: 'em', text: SPECIES_EMOJI[meta.id] || '🐾' }),
        el('div', {}, [
          el('div', { class: 'nm', text: meta.name }),
          el('div', { style: `font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;font-family:'Cinzel';color:${rar.color}`, text: rar.label }),
        ]),
      ]),
      el('div', { class: 'bl', text: meta.blurb }),
      el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;font-size:.62rem;color:var(--parchment-dim)' }, [
        el('span', { text: '🍽 ' + (meta.care?.feed || meta.favorite) }),
      ]),
      ownedCount > 0 ? el('div', { class: 'owned', text: `In your care ×${ownedCount}` }) : null,
      el('button', {
        class: 'buy', disabled: afford ? null : 'disabled',
        onclick: () => { game.adopt(meta.id); ui.hud.refreshRoster(); ui.repaint(); },
      }, meta.unlockCost === 0
        ? [el('span', { text: 'Adopt' }), el('span', { text: 'Free' })]
        : [el('span', { text: ownedCount ? 'Adopt another' : 'Adopt' }), el('span', { class: 'cost' }, [el('span', { text: '🪙' }), el('b', { text: fmtNum(meta.unlockCost) })])]),
    ]);
    grid.append(card);
  });
  body.append(grid);
}
