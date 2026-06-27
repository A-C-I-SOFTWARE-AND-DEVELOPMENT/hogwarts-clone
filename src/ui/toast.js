// ─────────────────────────────────────────────────────────────────────────────
//  toast.js — transient notifications, floating gain numbers and the level-up
//  banner. Pure DOM, no dependencies beyond the document.
// ─────────────────────────────────────────────────────────────────────────────
import { el } from '../core/util.js';

export class Toaster {
  constructor() {
    this.host = el('div', { id: 'toasts' });
    this.lvbanner = el('div', { id: 'levelup' });
    document.body.append(this.host, this.lvbanner);
  }

  show(text, emoji = '✨', { tone = '', ms = 2600 } = {}) {
    const t = el('div', { class: 'toast' + (tone ? ' ' + tone : '') }, [
      el('span', { class: 'te', text: emoji }), el('span', { text }),
    ]);
    this.host.prepend(t);
    while (this.host.children.length > 4) this.host.lastChild.remove();
    setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 420); }, ms);
    return t;
  }

  // a result object from actions.js -> a toast
  fromResult(r) {
    if (!r) return;
    this.show(r.text, r.emoji, { tone: r.fail ? 'bad' : (r.coins ? 'gold' : '') });
  }

  // floating "+N" near screen coords
  floatGain(text, x, y, color = '#ead9a0') {
    const f = el('div', { class: 'floatnum', text });
    f.style.left = x + 'px'; f.style.top = y + 'px'; f.style.color = color;
    document.body.append(f);
    setTimeout(() => f.remove(), 1150);
  }

  levelUp(beastName, level) {
    this.lvbanner.innerHTML = '';
    this.lvbanner.append(
      el('div', { class: 'big', text: 'Level ' + level + '!' }),
      el('div', { class: 'sm', text: beastName + ' grows closer to you' }),
    );
    this.lvbanner.classList.remove('show'); void this.lvbanner.offsetWidth;
    this.lvbanner.classList.add('show');
  }
}
