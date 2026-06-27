// ─────────────────────────────────────────────────────────────────────────────
//  index.js — the UI controller. Owns the toaster + HUD, provides the modal
//  "sheet" scaffold, and routes the Shop / Sanctuary / Quests / Settings panels.
// ─────────────────────────────────────────────────────────────────────────────
import { el, $ } from '../core/util.js';
import { Toaster } from './toast.js';
import { HUD } from './hud.js';
import { renderShop, renderSanctuary } from './shop.js';
import { renderQuests } from './quests.js';
import { renderSettings } from './settings.js';
import { renderCompendium } from './compendium.js';
import { renderBreeding } from './breeding.js';
import { Onboarding } from './onboarding.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.toaster = new Toaster();
    game.toaster = this.toaster;
    this._buildScrim();
    this.hud = new HUD(game, this);
    this.onboard = new Onboarding(game, this);
    this.current = null;
  }

  _buildScrim() {
    this.body = el('div', { class: 'mbody' });
    this.title = el('div', { class: 'mt', text: '' });
    this.sub = el('div', { class: 'ms', text: '' });
    this.tabsRow = el('div', { class: 'tabs', style: 'display:none' });
    this.modal = el('div', { class: 'modal' }, [
      el('div', { class: 'mhead' }, [
        el('div', {}, [this.title, this.sub]),
        el('button', { class: 'x', title: 'Close', onclick: () => this.close() }, '✕'),
      ]),
      this.tabsRow,
      this.body,
    ]);
    this.scrim = el('div', { id: 'scrim', onpointerdown: (e) => { if (e.target === this.scrim) this.close(); } }, [this.modal]);
    document.body.append(this.scrim);
  }

  sheet({ title, sub = '', tabs = [], active = null, render }) {
    this.game.audio?.ensure();
    this.game.audio?.sfx('open');
    this.title.textContent = title;
    this.sub.textContent = sub;
    this._render = render;
    this._tabs = tabs;
    if (tabs.length) {
      this.tabsRow.style.display = '';
      this.tabsRow.innerHTML = '';
      this.activeTab = active || tabs[0].id;
      tabs.forEach(t => {
        const b = el('button', { class: 'tab', role: 'tab', onclick: () => { this.activeTab = t.id; this._paint(); } }, t.label);
        b._id = t.id;
        this.tabsRow.append(b);
      });
    } else {
      this.tabsRow.style.display = 'none';
      this.activeTab = null;
    }
    this.scrim.classList.add('show');
    this.current = title;
    this._paint();
  }

  _paint() {
    this.body.innerHTML = '';
    if (this._tabs?.length) {
      [...this.tabsRow.children].forEach(b => b.setAttribute('aria-selected', b._id === this.activeTab));
    }
    this._render?.(this.body, this.activeTab);
  }

  repaint() { if (this.scrim.classList.contains('show')) this._paint(); }

  close() { this.scrim.classList.remove('show'); this.current = null; this.game.audio?.sfx('click'); }

  // ── routes ──
  openShop() {
    this.sheet({
      title: 'Eeylops & Co.', sub: 'Magical menagerie supplies',
      tabs: [{ id: 'food', label: 'Food' }, { id: 'care', label: 'Care' }, { id: 'toy', label: 'Toys' }, { id: 'decor', label: 'Decor' }],
      render: (body, tab) => renderShop(this.game, this, body, tab),
    });
  }
  openSanctuary() {
    this.sheet({ title: 'The Sanctuary', sub: 'Rescue a new magical beast', render: (body) => renderSanctuary(this.game, this, body) });
  }
  openQuests() {
    this.sheet({
      title: 'Keeper\'s Tasks', sub: 'Daily duties & lifelong milestones',
      tabs: [{ id: 'daily', label: 'Daily' }, { id: 'mile', label: 'Milestones' }],
      render: (body, tab) => renderQuests(this.game, this, body, tab),
    });
  }
  openCompendium(section = 'beasts') {
    this.sheet({
      title: 'Bestiary', sub: 'Your menagerie, materials & workbench',
      tabs: [{ id: 'beasts', label: 'Beasts' }, { id: 'materials', label: 'Materials' }, { id: 'craft', label: 'Workbench' }],
      active: section,
      render: (body, tab) => renderCompendium(this.game, this, body, tab),
    });
  }
  openBreeding() {
    this.sheet({ title: 'Breeding Bower', sub: 'Pair beasts & raise the next generation', render: (body) => renderBreeding(this.game, this, body) });
  }
  openSettings(section = 'world') {
    this.sheet({
      title: 'Settings', sub: 'World, sound & fidelity',
      tabs: [{ id: 'world', label: 'World' }, { id: 'sound', label: 'Sound' }, { id: 'graphics', label: 'Graphics' }, { id: 'save', label: 'Save' }],
      active: section,
      render: (body, tab) => renderSettings(this.game, this, body, tab),
    });
  }

  refresh() { this.hud.refresh(); }
  refreshStats() { this.hud.refreshStats(); }
}
