// ─────────────────────────────────────────────────────────────────────────────
//  main.js — bootstrap + the Game facade. Builds the stage/world/state, wires
//  every system together, owns the camera rig, pointer picking, the render loop
//  and the high-level verbs (action/adopt/buy/…) the UI calls.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { makeBus, $ } from './core/util.js';
import { Stage, PRESETS, isMobile } from './core/renderer.js';
import { World, WEATHER } from './core/world.js';
import { Audio } from './core/audio.js';
import { GameState } from './game/state.js';
import { Director } from './game/director.js';
import { Quests } from './game/quests.js';
import * as Actions from './game/actions.js';
import { ITEMS } from './game/items-data.js';
import { metaOf } from './creatures/index.js';
import { UI } from './ui/index.js';

const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const LOADER_HINTS = [
  'Nifflers will empty your pockets if you let them.',
  'A well-loved beast pays you back in Galleons.',
  'Mooncalves only dance once the sun has set.',
  'Always bow to a Hippogriff before you approach.',
  'Brush, bathe, feed, play — a happy beast is a healthy beast.',
  'Thestrals are gentle, whatever their fearsome look.',
  'Unicorn foals are gold; they silver with age and trust.',
];

function fail(e) {
  console.error(e);
  const err = $('#err'); if (err) err.classList.add('show');
  $('#loader')?.classList.add('gone');
  const c = $('#errCode'); if (c) c.textContent = (e && e.message) ? e.message : String(e);
}
window.addEventListener('error', ev => fail(ev.error || ev.message));
window.addEventListener('unhandledrejection', ev => fail(ev.reason));

class Game {
  constructor() {
    this.bus = makeBus();
    this.audio = new Audio();
    this.clock = new THREE.Clock();
    this._saveT = 0;
    this._tmp = new THREE.Vector3();
    this._camTarget = new THREE.Vector3(0, 2, 0);
  }

  prog(p) { const t = $('#thread'); if (t) t.style.width = p + '%'; const pc = $('#pct'); if (pc) pc.textContent = Math.round(p); }

  async boot() {
    // ── state first (decides quality default) ──
    this.state = new GameState(this.bus);
    this.state.load();
    const q = this.state.data.settings.quality || (isMobile ? 'balanced' : 'cinematic');
    this.state.data.settings.quality = q;
    this.prog(8);

    this.stage = new Stage(q);
    this.prog(16);
    this.world = new World(this.stage);
    await this.world.build();
    this.prog(64);

    this.director = new Director(this.stage, this.world, this.state, this.bus);
    this.quests = new Quests(this.state, this.bus);
    this.prog(72);

    this._buildCamera();
    this._buildInput();
    this.prog(80);

    this.ui = new UI(this);
    this.audio.enabledMusic = this.state.data.settings.music;
    this.audio.enabledSfx = this.state.data.settings.sfx;
    this.prog(90);

    this._wireBus();
    this.director.start();
    this.prog(98);

    this._reveal();
    this.ui.onboard.maybeShow();
    this.prog(100);
    this._loop();

    // first user gesture starts audio
    const startAudio = () => { this.audio.ensure(); removeEventListener('pointerdown', startAudio); removeEventListener('keydown', startAudio); };
    addEventListener('pointerdown', startAudio); addEventListener('keydown', startAudio);
  }

  _buildCamera() {
    const c = this.stage.camera;
    c.position.set(4.5, 6.5, 15);
    this.controls = new OrbitControls(c, this.stage.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 5; this.controls.maxDistance = 32;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minPolarAngle = 0.2;
    this.controls.enablePan = false;
    this.controls.target.set(1.5, 1.4, 1.5);
    this.controls.autoRotate = !reduced;
    this.controls.autoRotateSpeed = 0.18;
  }

  _buildInput() {
    const el = this.stage.renderer.domElement;
    let downPos = null, downT = 0, moved = false;
    el.addEventListener('pointerdown', e => { downPos = { x: e.clientX, y: e.clientY }; downT = performance.now(); moved = false; });
    el.addEventListener('pointermove', e => { if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 8) moved = true; });
    el.addEventListener('pointerup', e => {
      if (!downPos || moved || performance.now() - downT > 500) { downPos = null; return; }
      downPos = null;
      const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
      const id = this.director.pick(nx, ny);
      if (!id) return;
      this.controls.autoRotate = false;
      if (id === this.state.active?.id) this.action('pet');
      else { this.setActive(id); this.audio.sfx('click'); }
    });
    el.addEventListener('pointerdown', () => { this.controls.autoRotate = false; });
  }

  _wireBus() {
    this.bus.on('levelup', b => { this.ui.toaster.levelUp(b.name, b.level); this.audio.sfx('levelup'); this.ui.refreshStats(); });
    this.bus.on('milestone', m => { if (m.reward) this.ui.toaster.show(`Milestone: ${m.text} (+🪙${m.reward})`, '🏅', { tone: 'gold', ms: 3800 }); this.audio.sfx('rescue'); });
    this.bus.on('newday', () => { this.quests.ensureDaily(); this.ui.toaster.show(`A new day dawns over the vivarium.`, '🌅', { ms: 3000 }); });
    this.bus.on('active-changed', () => this.ui.refresh());
  }

  _reveal() {
    setTimeout(() => { $('#loader')?.classList.add('gone'); $('#hud')?.classList.add('show'); }, 500);
  }

  // ── high-level verbs the UI calls ──
  action(kind, arg) {
    const ctx = this.director.ctx();
    if (!ctx.live || !ctx.beast) return;
    const fn = { pet: Actions.pet, feed: Actions.feed, play: Actions.play, groom: Actions.groom, wash: Actions.wash, rest: Actions.rest, collect: Actions.collect }[kind];
    if (!fn) return;
    const res = fn(ctx, arg);
    if (!res) return;
    // sound
    let sk = kind;
    if (kind === 'feed' && arg === metaOf(ctx.beast.species).favorite) sk = 'fav';
    if (kind === 'collect') sk = 'coin';
    if (kind === 'rest') sk = 'click';
    this.audio.sfx(res.fail ? 'error' : sk);
    this.ui.toaster.fromResult(res);
    if (!res.fail) {
      this.quests.track(res.kind, { favorite: sk === 'fav' });
      const sp = this.screenPos(this.director.activeWorldPos(this._tmp));
      if (sp) {
        if (res.coins) this.ui.toaster.floatGain('+' + res.coins + '🪙', sp.x, sp.y, '#ead9a0');
        else if (['pet', 'feed', 'play', 'groom', 'wash'].includes(kind)) this.ui.toaster.floatGain(res.emoji, sp.x, sp.y - 10, '#e07fc0');
      }
    }
    this.ui.refreshStats();
    this._queueSave();
  }

  setActive(id) {
    this.state.setActive(id);
    this.director.setActive(id);
    // ease camera toward the new beast
    this.controls.autoRotate = false;
    this.ui.refresh();
  }

  adopt(species) {
    const meta = metaOf(species);
    const b = this.state.rescue(species, null, meta.unlockCost === 0);
    if (!b) { this.audio.sfx('error'); this.ui.toaster.show(`Not enough Galleons to adopt a ${meta.name}.`, '🪙', { tone: 'bad' }); return false; }
    this.audio.sfx('rescue');
    this.ui.toaster.show(`You rescued a ${meta.name}! Welcome ${b.name}.`, '🥚', { tone: 'gold', ms: 3600 });
    this.setActive(b.id);
    this.quests.checkMilestones();
    this._queueSave();
    return true;
  }

  buy(id) {
    const it = ITEMS[id];
    if (!it) return false;
    if (!this.state.spend(it.cost)) { this.audio.sfx('error'); this.ui.toaster.show('Not enough Galleons.', '🪙', { tone: 'bad' }); return false; }
    this.state.addItem(id);
    this.audio.sfx('buy');
    this.ui.toaster.show(`Bought ${it.name}.`, it.emoji);
    this._queueSave();
    return true;
  }

  placeDecor(id) {
    const it = ITEMS[id];
    if (!this.state.spend(it.cost)) { this.audio.sfx('error'); this.ui.toaster.show('Not enough Galleons.', '🪙', { tone: 'bad' }); return false; }
    this.state.placeDecor(id);
    this.audio.sfx('buy');
    this.ui.toaster.show(`Placed ${it.name} in the vivarium.`, it.emoji, { tone: 'gold' });
    this._queueSave();
    return true;
  }

  setTime(h) { this.world.setTime(h); }
  setTimePaused(b) { this.director.timePaused = b; }
  setWeather(w) { this.world.setWeather(w); this.audio.sfx('click'); }
  setSeason(s) { this.world.setSeason(s); this.audio.sfx('click'); }
  setQuality(q) {
    this.state.data.settings.quality = q;
    this.stage.setQuality(q);
    this.world.Q = PRESETS[q];
    this.sun = this.world.sun;
    this.world.sun.shadow.mapSize.set(PRESETS[q].shadow, PRESETS[q].shadow);
    if (this.world.sun.shadow.map) { this.world.sun.shadow.map.dispose(); this.world.sun.shadow.map = null; }
    this.ui.toaster.show('Fidelity: ' + q, '🎚️');
    this.state.save();
  }

  hardReset() {
    this.state.reset();
    this.director.sync();
    this.director.setActive(this.state.active?.id);
    this.world.setDecor([]);
    this.ui.refresh();
    this.ui.close();
    this.ui.toaster.show('A fresh start. Welcome back, Keeper.', '✨');
  }

  screenPos(v) {
    const p = v.clone().project(this.stage.camera);
    if (p.z > 1) return null;
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
  }

  _queueSave() { this._dirty = true; }

  _loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, this.clock.getDelta());
      const t = this.clock.getElapsedTime();

      this.director.update(t, dt);
      this.world.update(t, dt);

      // camera follows active beast (gentle)
      this.director.activeWorldPos(this._camTarget);
      this.controls.target.lerp(this._camTarget, 1 - Math.exp(-3 * dt));
      this.controls.update();

      // night ambience + audio
      this.audio.setNight?.(this.world.night);

      // HUD clock + periodic stat refresh
      this._hudT = (this._hudT || 0) + dt;
      if (this._hudT > 0.25) {
        this._hudT = 0;
        const h = this.world.hour;
        this.ui.hud.setClock(fmtH(h), phaseWord(h));
        this.ui.refreshStats();
      }

      // autosave every ~12s if dirty
      this._saveT += dt;
      if (this._saveT > 12 && this._dirty) { this._saveT = 0; this._dirty = false; this.state.save(); }

      this.stage.render(t);
    };
    tick();
  }
}

const fmtH = h => { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
function phaseWord(h) { return h < 5 ? 'deep night' : h < 8 ? 'dawn' : h < 11 ? 'morning' : h < 14 ? 'midday' : h < 17 ? 'afternoon' : h < 20 ? 'dusk' : 'night'; }

// rotate loader hints
let hintI = 0;
const hintEl = () => $('#hint');
setInterval(() => { const h = hintEl(); if (h && !$('#loader')?.classList.contains('gone')) { h.style.opacity = 0; setTimeout(() => { h.textContent = LOADER_HINTS[hintI++ % LOADER_HINTS.length]; h.style.opacity = 1; }, 400); } }, 3200);

const game = new Game();
window.__game = game;
try { game.boot(); } catch (e) { fail(e); }
