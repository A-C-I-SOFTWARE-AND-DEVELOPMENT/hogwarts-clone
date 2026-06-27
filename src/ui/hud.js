// ─────────────────────────────────────────────────────────────────────────────
//  hud.js — the always-on interface: top bar (coins/day/clock + menu buttons),
//  the active-beast card (mood, bond, needs, produce), the care dock, the food
//  tray and the roster of rescued beasts.
// ─────────────────────────────────────────────────────────────────────────────
import { el, $, $$, fmtNum, titleCase } from '../core/util.js';
import { NEED_KEYS, NEED_META, moodValue, moodLabel, needBadges } from '../game/needs.js';
import { stageOf, personalityOf } from '../game/genetics.js';
import { metaOf, RARITY } from '../creatures/index.js';
import { ITEMS } from '../game/items-data.js';

export const SPECIES_EMOJI = {
  niffler: '🦫', mooncalf: '🌙', puffskein: '🐹', kneazle: '🐈', jobberknoll: '🐦',
  fwooper: '🦜', diricawl: '🦤', graphorn: '🦏', hippogriff: '🦅', thestral: '🐴', unicorn: '🦄',
};

const CARE_BUTTONS = [
  { kind: 'pet', icon: '🤚', label: 'Pet', primary: true },
  { kind: 'feed', icon: '🍖', label: 'Feed', tray: 'food' },
  { kind: 'play', icon: '🎾', label: 'Play', tray: 'toy' },
  { kind: 'groom', icon: '🧹', label: 'Brush' },
  { kind: 'wash', icon: '🫧', label: 'Bathe' },
  { kind: 'rest', icon: '😴', label: 'Rest' },
];

export class HUD {
  constructor(game, ui) {
    this.game = game; this.ui = ui; this.state = game.state;
    this.trayMode = null;
    this._build();
    this._wireBus();
    this.refresh();
  }

  _build() {
    const g = this.game;
    // ── top bar ──
    this.coins = el('b', { id: 'coinval', text: fmtNum(this.state.coins) });
    this.dayval = el('b', { text: 'Day ' + this.state.data.day });
    this.clockTime = el('b', { text: '—' });
    this.clockPh = el('div', { class: 'ph', text: '' });

    this.questDot = el('span', { class: 'dot', style: 'display:none' });
    this.eggDot = el('span', { class: 'dot', style: 'display:none;background:var(--joy)' });
    const topbar = el('div', { id: 'topbar', class: 'pe' }, [
      el('div', { class: 'pill', id: 'coins' }, [el('span', { class: 'ic', text: '🪙' }), this.coins]),
      el('div', { class: 'pill hide-sm' }, [el('span', { class: 'ic', text: '📅' }), this.dayval]),
      el('div', { class: 'pill', id: 'clock', onclick: () => this.ui.openSettings('world') }, [
        el('span', { class: 'ic', text: '🕯️' }),
        el('div', {}, [this.clockTime, this.clockPh]),
      ]),
      el('div', { class: 'spacer' }),
      el('button', { class: 'iconbtn', title: 'Sanctuary (adopt beasts)', onclick: () => this.ui.openSanctuary() }, '🐾'),
      el('button', { class: 'iconbtn', title: 'Bestiary & Workbench', onclick: () => this.ui.openCompendium() }, '📖'),
      el('button', { class: 'iconbtn badge', title: 'Breeding', onclick: () => this.ui.openBreeding() }, ['💞', this.eggDot]),
      el('button', { class: 'iconbtn', title: 'Shop', onclick: () => this.ui.openShop() }, '🛒'),
      el('button', { class: 'iconbtn', title: 'Build habitat', onclick: () => this.game.toggleBuild() }, '🔨'),
      el('button', { class: 'iconbtn', title: 'Fly over the castle', onclick: () => this.game.toggleFly() }, '🧹'),
      el('button', { class: 'iconbtn badge', title: 'Quests', onclick: () => this.ui.openQuests() }, ['📜', this.questDot]),
      el('button', { class: 'iconbtn', title: 'Settings', onclick: () => this.ui.openSettings() }, '⚙️'),
    ]);

    // ── beast card ──
    this.cardName = el('div', { class: 'nm', text: '—' });
    this.cardSpecies = el('div', { class: 'sp' });
    this.cardTraits = el('div', { class: 'sp', style: 'margin-top:3px;gap:6px;flex-wrap:wrap' });
    this.cardMoodEm = el('div', { class: 'em', text: '🙂' });
    this.cardMoodW = el('div', { class: 'mw', text: '' });
    this.bondFill = el('i');
    this.bondTop = el('div', { class: 'lvtop' }, [el('span', { text: 'Bond' }), el('b', { text: 'Lv 1' })]);
    this.needsWrap = el('div', { class: 'needs' });
    this.produce = el('button', { id: 'produce', class: 'pe', onclick: () => this.game.action('collect') }, '');
    this.cardCollapse = el('button', { class: 'cardcollapse', title: 'Show / hide details', onclick: (e) => {
      e.stopPropagation();
      const c = this.card.classList.toggle('collapsed');
      this.cardCollapse.textContent = c ? '▸' : '▾';
    } }, '▾');
    this.card = el('div', { id: 'beastcard', class: 'pe' }, [
      el('div', { class: 'row' }, [
        this.cardCollapse,
        el('div', { style: 'min-width:0;flex:1' }, [this.cardName, this.cardSpecies, this.cardTraits]),
        el('div', { class: 'mood' }, [this.cardMoodEm, this.cardMoodW]),
      ]),
      el('div', { class: 'lvwrap' }, [this.bondTop, el('div', { class: 'bar bond' }, [this.bondFill])]),
      this.needsWrap,
      this.produce,
    ]);

    // ── care dock ──
    this.dock = el('div', { id: 'dock', class: 'pe' });
    this.careBtns = {};
    CARE_BUTTONS.forEach(b => {
      const mini = el('span', { class: 'mini', style: 'display:none' });
      const btn = el('button', { class: 'care' + (b.primary ? ' primary' : ''), title: b.label, onclick: (e) => this._care(b, e) }, [
        el('span', { class: 'cic', text: b.icon }), el('span', { class: 'cl', text: b.label }), mini,
      ]);
      btn._mini = mini;
      this.careBtns[b.kind] = btn;
      this.dock.append(btn);
    });

    // ── food / toy tray ──
    this.tray = el('div', { id: 'tray', class: 'pe' });

    // ── roster ──
    this.roster = el('div', { id: 'roster', class: 'pe' });

    // ── tip ──
    this.tip = el('div', { id: 'tip' });

    $('#hud').append(topbar, this.card, this.dock, this.tray, this.roster, this.tip);

    // tap empty space closes tray
    addEventListener('pointerdown', (e) => {
      if (this.trayMode && !e.target.closest('#tray') && !e.target.closest('.care')) this._closeTray();
    });
  }

  _wireBus() {
    const b = this.game.bus;
    b.on('coins', v => { this.coins.textContent = fmtNum(v); });
    b.on('inventory', () => { if (this.trayMode) this._openTray(this.trayMode); this._refreshDockMinis(); });
    b.on('active-changed', () => this.refresh());
    b.on('rescued', () => this.refreshRoster());
    b.on('newday', d => { this.dayval.textContent = 'Day ' + d; });
    b.on('quests', list => this._refreshQuestDot(list));
    b.on('decor', () => {});
    b.on('egg', () => this._refreshEggDot());
    b.on('hatched', () => { this._refreshEggDot(); this.refreshRoster(); });
    b.on('egg-ready', () => { this._refreshEggDot(); this.game.toaster.show('An egg is ready to hatch! 🐣', '🥚', { tone: 'gold' }); });
    b.on('materials', () => {});
  }

  _care(b, ev) {
    this.game.audio.ensure();
    if (b.tray) { this._toggleTray(b.tray); return; }
    this._closeTray();
    this.game.action(b.kind);
  }

  _toggleTray(mode) {
    if (this.trayMode === mode) { this._closeTray(); return; }
    this._openTray(mode);
  }

  _openTray(mode) {
    this.trayMode = mode;
    this.tray.innerHTML = '';
    const beast = this.state.active;
    const meta = beast ? metaOf(beast.species) : null;
    const title = mode === 'food' ? 'Choose food' : 'Choose a toy';
    this.tray.append(el('div', { class: 'th', text: title }));
    const ids = mode === 'food'
      ? Object.keys(ITEMS).filter(id => ['food', 'treat'].includes(ITEMS[id].kind))
      : Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'toy');
    let any = false;
    ids.forEach(id => {
      const it = ITEMS[id]; const have = this.state.inv(id);
      if (have <= 0 && !it.persistent) return;
      if (it.persistent && have <= 0) return;
      any = true;
      const fav = meta && id === meta.favorite;
      const liked = meta && meta.diet?.includes(id);
      const node = el('button', { class: 'fitem' + (fav ? ' fav' : ''), title: it.name + ' — ' + it.blurb, onclick: () => {
        this._closeTray();
        if (mode === 'food') this.game.action('feed', id);
        else this.game.action('play', id);
      } }, [
        fav ? el('span', { class: 'heart', text: '❤️' }) : (liked ? el('span', { class: 'heart', text: '💛' }) : null),
        el('span', { class: 'fe', text: it.emoji }),
        el('span', { class: 'fn', text: it.name }),
        it.persistent ? el('span', { class: 'fc', text: 'owned' }) : el('span', { class: 'fc', text: '×' + have }),
      ]);
      this.tray.append(node);
    });
    // also allow plain play with no toy + the feeding mini-game
    if (mode === 'toy') {
      any = true;
      this.tray.append(el('button', { class: 'fitem', onclick: () => { this._closeTray(); this.game.action('play'); } }, [
        el('span', { class: 'fe', text: '🤸' }), el('span', { class: 'fn', text: 'Romp' }), el('span', { class: 'fc', text: 'free' }),
      ]));
      this.tray.append(el('button', { class: 'fitem', onclick: () => { this._closeTray(); this.game.miniFeast(); } }, [
        el('span', { class: 'fe', text: '🎮' }), el('span', { class: 'fn', text: 'Frenzy' }), el('span', { class: 'fc', text: 'game' }),
      ]));
    }
    if (!any) {
      this.tray.append(el('div', { style: 'color:var(--parchment-dim);font-style:italic;padding:6px 12px', text: 'Nothing here — visit the shop 🛒' }));
    }
    this.tray.classList.add('show');
  }

  _closeTray() { this.trayMode = null; this.tray.classList.remove('show'); }

  // ── refreshers ──
  refresh() {
    const beast = this.state.active;
    if (!beast) return;
    const meta = metaOf(beast.species);
    this.cardName.textContent = beast.name;
    const rar = RARITY[meta.rarity] || RARITY.common;
    this.cardSpecies.innerHTML = '';
    this.cardSpecies.append(
      document.createTextNode((SPECIES_EMOJI[beast.species] || '🐾') + ' ' + meta.name + ' '),
      el('span', { class: 'rar', style: `color:${rar.color}`, text: rar.label }),
    );
    // genes & growth traits
    const stg = stageOf(beast.level), pers = personalityOf(beast.genes);
    const chip = (text, gold) => el('span', { class: 'rar', style: gold ? 'color:var(--gold-hi);border-color:var(--gold)' : 'color:var(--parchment-dim);border-color:var(--line-soft)', text });
    this.cardTraits.innerHTML = '';
    this.cardTraits.append(chip(stg.emoji + ' ' + stg.name), chip(pers.emoji + ' ' + pers.label));
    if (beast.genes?.shiny) this.cardTraits.append(chip('✨ Shiny', true));
    if (beast.bred) this.cardTraits.append(chip('🥚 Bred'));
    this.refreshStats();
    this.refreshRoster();
    this._refreshDockMinis();
    this._refreshEggDot();
    this._refreshQuestDot();
  }

  refreshStats() {
    const beast = this.state.active;
    if (!beast) return;
    const m = moodValue(beast.needs);
    const ml = moodLabel(m);
    this.cardMoodEm.textContent = ml.emoji;
    this.cardMoodW.textContent = ml.word;
    this.cardMoodW.style.color = ml.color;

    this.bondTop.children[1].textContent = 'Lv ' + beast.level;
    this.bondFill.style.width = beast.bond + '%';

    // needs
    this.needsWrap.innerHTML = '';
    needBadges(beast.needs).forEach(n => {
      const fill = el('i', { style: `width:${n.value}%;background:${n.color}` });
      this.needsWrap.append(el('div', { class: 'need' + (n.urgent ? ' urgent' : '') }, [
        el('div', { class: 'nl' }, [
          el('span', { text: n.icon }), el('span', { text: n.label }),
          el('span', { class: 'v', text: Math.round(n.value) }),
        ]),
        el('div', { class: 'bar' }, [fill]),
      ]));
    });

    // produce ready?
    const live = this.game.director.live.get(beast.id);
    const pend = Math.floor(beast._produce || 0);
    if (pend >= 1 && live?.meta.produces) {
      this.produce.innerHTML = '';
      this.produce.append(el('span', { text: '🪙' }), el('span', { text: `Collect ${pend} ${live.meta.produces.item}` }));
      this.produce.classList.add('show');
    } else {
      this.produce.classList.remove('show');
    }
  }

  _refreshDockMinis() {
    // show remaining count of favourite food on Feed, energy warning on Rest, etc.
    const beast = this.state.active; if (!beast) return;
    const meta = metaOf(beast.species);
    const favCount = this.state.inv(meta.favorite);
    const feed = this.careBtns.feed;
    if (favCount > 0) { feed._mini.style.display = ''; feed._mini.textContent = meta.palette ? '❤' + favCount : favCount; }
    else feed._mini.style.display = 'none';
  }

  refreshRoster() {
    this.roster.innerHTML = '';
    const active = this.state.active;
    this.state.data.beasts.forEach(b => {
      const meta = metaOf(b.species);
      const m = moodValue(b.needs);
      const low = m < 0.4;
      const chip = el('button', { class: 'rchip' + (active && b.id === active.id ? ' active' : ''),
        title: b.name + ' — ' + meta.name, onclick: () => this.game.setActive(b.id) }, [
        low ? el('span', { class: 'needdot' }) : null,
        el('span', { class: 'rn', text: b.name }),
        el('span', { class: 'av', text: SPECIES_EMOJI[b.species] || '🐾' }),
      ]);
      this.roster.append(chip);
    });
    // adopt button
    this.roster.append(el('button', { class: 'rchip adopt', title: 'Adopt a new beast', onclick: () => this.ui.openSanctuary() }, [
      el('span', { class: 'rn', text: 'Adopt' }), el('span', { class: 'av', text: '＋' }),
    ]));
  }

  _refreshQuestDot(list) {
    const claimable = (list || this.game.quests.list()).some(q => q.done && !q.claimed);
    this.questDot.style.display = claimable ? '' : 'none';
  }

  _refreshEggDot() {
    const eggs = this.game.state.data.eggs || [];
    this.eggDot.style.display = eggs.length ? '' : 'none';
    this.eggDot.style.background = eggs.some(e => e.ready) ? 'var(--good)' : 'var(--joy)';
  }

  setClock(time, phase) { this.clockTime.textContent = time; this.clockPh.textContent = phase; }

  showTip(text, ms = 4200) {
    this.tip.textContent = text; this.tip.classList.add('show');
    clearTimeout(this._tipT); this._tipT = setTimeout(() => this.tip.classList.remove('show'), ms);
  }
}
