// ─────────────────────────────────────────────────────────────────────────────
//  onboarding.js — first-run welcome: name your keeper, meet your first beast.
//  Returning players get a "welcome back" with how their beasts fared while away.
// ─────────────────────────────────────────────────────────────────────────────
import { el, $ } from '../core/util.js';

export class Onboarding {
  constructor(game, ui) {
    this.game = game; this.ui = ui;
    this.root = el('div', { id: 'intro' });
    document.body.append(this.root);
  }

  maybeShow() {
    if (this.game.state.data.onboarded) { this._welcomeBack(); return; }
    this._showIntro();
  }

  _showIntro() {
    const input = el('input', { type: 'text', maxlength: '18', placeholder: 'Your keeper name', value: this.game.state.data.keeperName || '' });
    const begin = () => {
      const name = (input.value || 'Keeper').trim().slice(0, 18) || 'Keeper';
      this.game.state.data.keeperName = name;
      this.game.state.data.onboarded = true;
      // gift the first beast — a Niffler named Galleon
      if (!this.game.state.data.beasts.length) {
        const b = this.game.state.rescue('niffler', 'Galleon', true);
        this.game.state.setActive(b.id);
      }
      this.game.state.save();
      this.game.director.sync();
      this.game.director.setActive(this.game.state.active?.id);
      this.ui.refresh();
      this.root.classList.remove('show');
      this.game.audio.ensure(); this.game.audio.sfx('rescue');
      setTimeout(() => this.ui.hud.showTip('Tap your Niffler to pet it 🤚  ·  use the dock below to care for it', 7000), 900);
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') begin(); });
    this.root.innerHTML = '';
    this.root.append(
      el('div', { class: 'crest', html: crestSVG() }),
      el('h2', { text: 'Welcome to the Vivarium' }),
      el('p', { text: 'Deep in the Hogwarts grounds lies a sanctuary for rescued magical beasts. They are yours to feed, groom, play with and love. Care well, and an unbreakable bond will grow — along with a few Galleons.' }),
      el('div', { class: 'namefield' }, [input]),
      el('button', { class: 'bigbtn', onclick: begin }, 'Meet your first beast →'),
      el('div', { style: 'margin-top:1.6em;font-size:.78rem;color:var(--parchment-dim)', text: 'A Niffler named Galleon is waiting for you.' }),
    );
    this.root.classList.add('show');
    setTimeout(() => input.focus(), 300);
  }

  _welcomeBack() {
    const d = this.game.state.data;
    const away = this.game.state.awayHours || 0;
    let msg = `Welcome back, ${d.keeperName}.`;
    let emoji = '✨';
    if (away > 1) {
      const hungry = d.beasts.filter(b => b.needs.hunger < 40).length;
      if (hungry > 0) { msg = `${hungry} beast${hungry > 1 ? 's' : ''} missed you and ${hungry > 1 ? 'are' : 'is'} hungry.`; emoji = '🍖'; }
      else { msg = `Your beasts were content while you were away.`; emoji = '💛'; }
    }
    setTimeout(() => this.ui.toaster.show(msg, emoji, { ms: 4200 }), 1200);
  }
}

function crestSVG() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="#c9a24b" stroke-width="1" width="60" height="60"><path d="M12 2 L20 6 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V6 Z"/><path d="M12 2 V22 M4 9 H20" stroke-width=".6" opacity=".5"/></svg>`;
}
