// ─────────────────────────────────────────────────────────────────────────────
//  quests.js — render the daily tasks (with claim buttons) and the milestone
//  ledger. Logic lives in game/quests.js; this only paints + claims.
// ─────────────────────────────────────────────────────────────────────────────
import { el } from '../core/util.js';

const KIND_ICON = { feed: '🍖', pet: '🤚', play: '🎾', groom: '🧹', wash: '🫧', collect: '🪙', fav: '❤️' };

export function renderQuests(game, ui, body, tab) {
  if (tab === 'mile') return renderMilestones(game, body);
  const list = game.quests.list();
  if (!list.length) { body.append(el('div', { style: 'color:var(--parchment-dim);font-style:italic', text: 'New tasks at dawn.' })); return; }
  list.forEach(q => {
    const pct = Math.min(100, q.progress / q.goal * 100);
    const row = el('div', { class: 'qrow' + (q.done ? ' done' : '') }, [
      el('div', { class: 'qic', text: KIND_ICON[q.kind] || '⭐' }),
      el('div', { class: 'qmid' }, [
        el('div', { class: 'qt', text: q.text }),
        el('div', { class: 'qbar' }, [el('i', { style: `width:${pct}%` })]),
        el('div', { style: 'font-size:.64rem;color:var(--parchment-dim);margin-top:3px', text: `${q.progress}/${q.goal} · reward 🪙${q.reward}` }),
      ]),
      el('button', {
        class: 'claim', disabled: (q.done && !q.claimed) ? null : 'disabled',
        onclick: () => { const r = game.quests.claim(q.id); if (r) { game.audio.sfx('coin'); game.toaster.show(`Claimed ${r} Galleons!`, '🪙', { tone: 'gold' }); ui.repaint(); ui.hud._refreshQuestDot(); } },
      }, q.claimed ? 'Claimed' : q.done ? 'Claim' : '…'),
    ]);
    body.append(row);
  });
  body.append(el('div', { style: 'margin-top:12px;font-size:.76rem;color:var(--parchment-dim);font-style:italic;text-align:center',
    text: 'Daily tasks refresh each new day in the vivarium.' }));
}

function renderMilestones(game, body) {
  const miles = game.quests.milestones();
  miles.forEach(m => {
    body.append(el('div', { class: 'mile' + (m.done ? ' done' : '') }, [
      el('span', { class: 'mk', text: m.done ? '🏅' : '🔒' }),
      el('span', { style: 'flex:1', text: m.text }),
      m.reward ? el('span', { style: 'font-size:.7rem;color:var(--gold-dim)', text: '🪙' + m.reward }) : null,
    ]));
  });
}
