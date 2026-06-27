// ─────────────────────────────────────────────────────────────────────────────
//  settings.js — world (time/weather/season), sound, graphics fidelity and save
//  management. Renders into the modal body; calls game facade setters.
// ─────────────────────────────────────────────────────────────────────────────
import { el } from '../core/util.js';

function field(label, ...kids) {
  return el('div', { class: 'field' }, [el('div', { class: 'lab', text: label }), ...kids]);
}
function choiceRow(options, current, onPick) {
  const row = el('div', { class: 'choices' });
  options.forEach(o => {
    const b = el('button', { class: 'choice', 'aria-pressed': String(o.id === current), onclick: () => { onPick(o.id); [...row.children].forEach(c => c.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); } }, o.label);
    row.append(b);
  });
  return row;
}

export function renderSettings(game, ui, body, tab) {
  if (tab === 'world') return worldTab(game, ui, body);
  if (tab === 'sound') return soundTab(game, body);
  if (tab === 'graphics') return graphicsTab(game, body);
  if (tab === 'save') return saveTab(game, ui, body);
}

function worldTab(game, ui, body) {
  const w = game.world;
  // time scrubber
  const timeLbl = el('b', { text: fmtH(w.hour) });
  const slider = el('input', { type: 'range', min: '0', max: '24', step: '0.1', value: String(w.hour) });
  slider.addEventListener('input', () => { game.setTimePaused(true); game.setTime(parseFloat(slider.value)); timeLbl.textContent = fmtH(parseFloat(slider.value)); });
  body.append(field('Time of day', el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px' }, [
    el('span', { style: 'font-size:.78rem;color:var(--parchment-dim)', text: 'Hour' }), timeLbl,
  ]), slider,
    el('div', { class: 'choices', style: 'margin-top:8px' }, [
      el('button', { class: 'choice', onclick: () => { game.setTimePaused(false); } }, '▶ Resume cycle'),
      el('button', { class: 'choice', onclick: () => { game.setTime(8); slider.value = '8'; timeLbl.textContent = fmtH(8); game.setTimePaused(true); } }, '☀️ Day'),
      el('button', { class: 'choice', onclick: () => { game.setTime(21); slider.value = '21'; timeLbl.textContent = fmtH(21); game.setTimePaused(true); } }, '🌙 Night'),
    ])));

  body.append(field('Weather', choiceRow(
    [{ id: 'clear', label: 'Clear' }, { id: 'mist', label: 'Misty' }, { id: 'rain', label: 'Rain' }, { id: 'snow', label: 'Snow' }],
    w.weather, id => game.setWeather(id))));

  body.append(field('Season', choiceRow(
    [{ id: 'summer', label: 'Summer' }, { id: 'autumn', label: 'Autumn' }, { id: 'winter', label: 'Winter' }, { id: 'spring', label: 'Spring' }],
    w.season, id => game.setSeason(id))));
}

function soundTab(game, body) {
  const s = game.state.data.settings;
  body.append(field('Music', choiceRow([{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }], s.music ? 'on' : 'off',
    id => { s.music = id === 'on'; game.audio.ensure(); game.audio.setMusic(s.music); game.state.save(); })));
  body.append(field('Sound effects', choiceRow([{ id: 'on', label: 'On' }, { id: 'off', label: 'Off' }], s.sfx ? 'on' : 'off',
    id => { s.sfx = id === 'on'; game.audio.setSfx(s.sfx); game.state.save(); })));
  body.append(el('div', { style: 'font-size:.78rem;color:var(--parchment-dim);font-style:italic',
    text: 'All sound is woven live from the castle\'s own enchantments — no recordings.' }));
}

function graphicsTab(game, body) {
  body.append(field('Fidelity', choiceRow(
    [{ id: 'cinematic', label: 'Cinematic' }, { id: 'balanced', label: 'Balanced' }, { id: 'performance', label: 'Performance' }],
    game.stage.quality, id => game.setQuality(id))));
  body.append(el('div', { style: 'font-size:.78rem;color:var(--parchment-dim);font-style:italic',
    text: 'Higher fidelity adds grass, shadows and bloom. Lower it if the vivarium runs slowly.' }));
}

function saveTab(game, ui, body) {
  const d = game.state.data;
  body.append(el('div', { style: 'font-size:.86rem;line-height:1.9;color:var(--parchment-dim)' }, [
    el('div', { html: `Keeper: <b style="color:var(--gold-hi)">${esc(d.keeperName)}</b>` }),
    el('div', { html: `Day <b>${d.day}</b> · <b>${d.beasts.length}</b> beasts · <b>${game.state.coins}</b> Galleons` }),
    el('div', { html: `Rescued <b>${d.stats.rescued}</b> · Fed <b>${d.stats.fed}</b> · Played <b>${d.stats.played}</b> · Collected <b>${d.stats.collected}</b> 🪙` }),
  ]));
  body.append(el('div', { style: 'display:flex;gap:8px;margin-top:16px;flex-wrap:wrap' }, [
    el('button', { class: 'choice', onclick: () => { game.state.save(); game.toaster.show('Game saved.', '💾'); } }, '💾 Save now'),
    el('button', { class: 'choice', style: 'border-color:var(--bad);color:var(--bad)', onclick: () => {
      if (confirm('Release all beasts and start over? This cannot be undone.')) { game.hardReset(); }
    } }, '⚠️ Reset everything'),
  ]));
  body.append(el('div', { style: 'margin-top:14px;font-size:.74rem;color:var(--parchment-dim);font-style:italic',
    text: 'Your vivarium is saved automatically in this browser.' }));
}

const fmtH = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
