// ─────────────────────────────────────────────────────────────────────────────
//  breeding.js — The Nest. Watch your eggs incubate and hatch them, and pair two
//  grown, content beasts to court and lay a new egg. Render-only: all breeding
//  logic lives on the game facade; this just paints + calls startBreeding/hatch.
// ─────────────────────────────────────────────────────────────────────────────
import { el } from '../core/util.js';
import { stageOf } from '../game/genetics.js';
import { canBreed, pairResultSpecies } from '../game/breeding.js';
import { moodValue } from '../game/needs.js';
import { metaOf } from '../creatures/index.js';
import { SPECIES_EMOJI } from './hud.js';

// module-local pairing selection (kept across local repaints so picks survive)
let pickA = null;
let pickB = null;

export function renderBreeding(game, ui, body) {
  const state = game.state;

  // ── 1) Eggs in the nest ──────────────────────────────────────────────────
  body.append(el('div', { style: 'font-family:\'Cinzel\';font-size:.84rem;letter-spacing:.06em;color:var(--gold-hi);margin-bottom:10px', text: 'Eggs in the nest' }));
  const eggs = state.data.eggs || [];
  if (!eggs.length) {
    body.append(el('div', { style: 'color:var(--parchment-dim);font-style:italic;text-align:center;padding:14px 8px;line-height:1.6',
      text: '🪺 The nest is quiet. Pair two happy, grown beasts below to lay your first egg.' }));
  } else {
    const grid = el('div', { class: 'grid' });
    eggs.forEach(egg => {
      const [pa, pb] = [state.beast(egg.a), state.beast(egg.b)];
      const meta = metaOf(egg.species);
      const pct = Math.round(Math.min(1, Math.max(0, egg.progress || 0)) * 100);
      const card = el('div', { class: 'card' }, [
        el('div', { class: 'top' }, [
          el('div', { class: 'em', text: '🥚' }),
          el('div', {}, [
            el('div', { class: 'nm' }, [
              el('span', { text: (SPECIES_EMOJI[egg.species] || '🐾') + ' ' }),
              el('span', { text: meta ? meta.name : 'Egg' }),
            ]),
            egg.genes?.shiny
              ? el('div', { style: 'font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;font-family:\'Cinzel\';color:var(--gold-hi)', text: '✨ Shiny!' })
              : null,
          ]),
        ]),
        el('div', { class: 'bl', text: `${pa?.name || '?'} 💞 ${pb?.name || '?'}` }),
        el('div', { class: 'bar', style: 'margin:2px 0 2px' }, [
          el('i', { style: `width:${pct}%;background:linear-gradient(90deg,var(--gold-dim),var(--gold-hi))` }),
        ]),
        el('button', {
          class: 'buy', disabled: egg.ready ? null : 'disabled',
          onclick: () => { game.hatchEgg(egg.id); ui.repaint(); },
        }, [
          el('span', { text: egg.ready ? 'Hatch 🐣' : `Incubating… ${pct}%` }),
        ]),
      ]);
      grid.append(card);
    });
    body.append(grid);
  }

  // ── 2) Pair two beasts ───────────────────────────────────────────────────
  body.append(el('div', { style: 'font-family:\'Cinzel\';font-size:.84rem;letter-spacing:.06em;color:var(--gold-hi);margin:18px 0 6px', text: 'Pair two beasts' }));
  body.append(el('div', { style: 'font-size:.76rem;color:var(--parchment-dim);font-style:italic;margin-bottom:10px;line-height:1.5',
    text: 'Both parents must be fully grown (Adult) and Happy. Matching species pair true; a few magical pairings cross-breed.' }));

  const beasts = state.data.beasts || [];
  // keep selections valid against the current roster
  if (pickA && !state.beast(pickA)) pickA = null;
  if (pickB && !state.beast(pickB)) pickB = null;

  const pairBox = el('div');
  body.append(pairBox);

  // local repaint of just the pairing section so selections survive
  function paint() {
    pairBox.innerHTML = '';

    pairBox.append(
      buildSelector('Parent A', pickA, id => { pickA = (pickA === id ? null : id); paint(); }),
      buildSelector('Parent B', pickB, id => { pickB = (pickB === id ? null : id); paint(); }),
    );

    const a = pickA ? state.beast(pickA) : null;
    const b = pickB ? state.beast(pickB) : null;
    const hint = el('div', { style: 'margin-top:10px' });

    if (!a || !b) {
      hint.append(el('div', { style: 'color:var(--parchment-dim);font-style:italic;text-align:center;font-size:.82rem',
        text: 'Choose two beasts to see if they are compatible.' }));
      pairBox.append(hint);
      return;
    }

    const chk = canBreed(state, a, b);
    if (chk.ok) {
      const child = pairResultSpecies(a, b);
      const cmeta = metaOf(child);
      hint.append(el('div', {
        style: 'text-align:center;font-size:.84rem;color:var(--good);font-family:\'Cinzel\';margin-bottom:10px',
        text: `Compatible — a ${(SPECIES_EMOJI[child] || '🐾')} ${cmeta ? cmeta.name : child} egg!`,
      }));
      hint.append(el('button', {
        class: 'buy', style: 'width:100%;padding:11px;font-size:.86rem',
        onclick: () => { game.startBreeding(a.id, b.id); },
      }, [el('span', { text: 'Begin Courtship 💞' })]));
    } else {
      hint.append(el('div', {
        style: 'text-align:center;font-size:.82rem;color:var(--warn);margin-bottom:10px;line-height:1.5',
        text: chk.reason,
      }));
      hint.append(el('button', { class: 'buy', disabled: 'disabled', style: 'width:100%;padding:11px;font-size:.86rem' },
        [el('span', { text: 'Begin Courtship 💞' })]));
    }
    pairBox.append(hint);
  }

  // a labelled scrollable row of candidate chips
  function buildSelector(label, chosenId, onPick) {
    const row = el('div', { style: 'display:flex;gap:7px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch' });
    if (!beasts.length) {
      row.append(el('div', { style: 'color:var(--parchment-dim);font-style:italic;font-size:.78rem;padding:6px', text: 'No beasts yet.' }));
    }
    beasts.forEach(bst => {
      const meta = metaOf(bst.species);
      const stage = stageOf(bst.level);
      const ready = stage.key === 'adult' || stage.key === 'elder';
      const happy = moodValue(bst.needs) >= 0.6;
      const ok = ready && happy;
      const sel = chosenId === bst.id;
      const chip = el('button', {
        class: 'rchip' + (sel ? ' active' : ''),
        style: 'flex:0 0 auto;min-width:92px;flex-direction:column;align-items:center;gap:3px;padding:8px 10px',
        title: `${bst.name} — ${meta ? meta.name : ''} · ${stage.name}${ok ? '' : (ready ? ' · needs care' : ' · too young')}`,
        onclick: () => onPick(bst.id),
      }, [
        el('span', { class: 'av', text: SPECIES_EMOJI[bst.species] || '🐾', style: 'font-size:1.4rem' }),
        el('span', { class: 'rn', text: bst.name }),
        el('span', { style: 'display:flex;align-items:center;gap:5px;font-size:.58rem;color:var(--parchment-dim)' }, [
          el('span', { style: `width:7px;height:7px;border-radius:50%;background:${ok ? 'var(--good)' : 'var(--warn)'}` }),
          el('span', { text: stage.name }),
        ]),
      ]);
      row.append(chip);
    });
    return el('div', { class: 'field', style: 'margin-bottom:6px' }, [
      el('div', { class: 'lab', text: label }),
      row,
    ]);
  }

  paint();
}
