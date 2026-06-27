// ─────────────────────────────────────────────────────────────────────────────
//  director.js — the conductor. Spawns the live creatures for the beasts you've
//  rescued, keeps their on-screen mood synced to the save, advances the in-game
//  clock, drains needs over time, accrues passive produce, and answers "which
//  beast did the player just tap?".
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildCreature } from '../creatures/index.js';
import { tickNeeds, moodValue } from './needs.js';
import { applyGenesToCreature, personalityOf, stageOf } from './genetics.js';
import { personaProfile } from '../creatures/behavior.js';

const VISIBLE_CAP = 6;
const DAY_LENGTH_S = 600;            // a full 24h cycle in ~10 real minutes
const HOUR_PER_S = 24 / DAY_LENGTH_S;

export class Director {
  constructor(stage, world, state, bus) {
    this.stage = stage; this.world = world; this.state = state; this.bus = bus;
    this.live = new Map();            // beastId -> Creature
    this.ray = new THREE.Raycaster();
    this.ray.params.Points.threshold = 0.5;
    this.activeId = null;
    this.timePaused = false;
    this.auraBonus = 0;

    bus.on('rescued', () => this.sync());
    bus.on('decor', (list) => this._applyDecor(list));
    bus.on('active-changed', (b) => this.setActive(b?.id));
  }

  start() {
    this.world.setTime(this.state.data.dayTime ?? 16);
    this._applyDecor(this.state.data.decor || []);
    this.sync();
    this.setActive(this.state.active?.id);
  }

  _applyDecor(list) {
    this.world.setDecor(list || []);
    // aura: sum of decor auras, capped — slows need drift in the habitat
    let aura = 0;
    (list || []).forEach(did => { aura += (AURA[did] || 0); });
    this.auraBonus = Math.min(0.5, aura / 30);
  }

  // build/destroy live creatures to match the (capped) owned roster
  sync() {
    const beasts = this.state.data.beasts.slice(0, VISIBLE_CAP);
    const wanted = new Set(beasts.map(b => b.id));
    // remove stale
    for (const [id, c] of this.live) {
      if (!wanted.has(id)) { this.world.scene.remove(c.group); c.dispose(); this.live.delete(id); }
    }
    // add new, fanned out in front of centre so the active beast frames well
    beasts.forEach((b, i) => {
      if (this.live.has(id(b))) return;
      const a = (i * 2.39996) + 0.5;           // golden-angle spread
      const r = 2.0 + i * 1.5;                  // first beast near centre, group stays framed
      const x = Math.cos(a) * r, z = Math.sin(a) * r + 1.5;
      const c = buildCreature(b.species, { id: b.id, name: b.name, x, z, seed: b.seed, needs: b.needs });
      c.needs = b.needs;                       // SHARE the save's needs object
      c.bond = b.bond; c.level = b.level;
      c.sparkleCb = (pos, n, col) => this.world.spawnSparkles(pos, n, col);
      c.heartCb = (pos, n) => this.world.spawnHearts(pos, n);
      // genes: colour/size variation, shiny, growth stage
      applyGenesToCreature(c, b.genes, b.level);
      const pers = personalityOf(b.genes);
      c.speed *= pers.speed;
      // drive movement style + how busy/where it roams from the beast's personality
      c.personaProfile = personaProfile(b.genes?.personality);
      c._targetScale = c.scaleMul * (c.sizeMod || 1) * stageOf(b.level).scale;
      this.world.scene.add(c.group);
      this.live.set(b.id, c);
      if (b._produce == null) b._produce = 0;
    });
    // Pre-compile the newly-spawned creatures' shaders up front so their custom
    // rim/cel programs are fully linked before the next frame draws them. This
    // removes a software-GL warm-up race where a just-added material could be
    // drawn a frame before its program finished, throwing mid-render.
    try { this.stage.renderer.compile(this.world.scene, this.stage.camera); } catch (e) { /* non-fatal */ }
  }

  setActive(id) {
    this.activeId = id;
    for (const [bid, c] of this.live) c.setSelected(bid === id);
  }

  liveActive() { return this.live.get(this.activeId) || this.live.values().next().value || null; }

  ctx() {
    const beast = this.state.active;
    const live = beast ? this.live.get(beast.id) : null;
    return { state: this.state, world: this.world, live, beast };
  }

  ctxFor(id) {
    const beast = this.state.beast(id);
    return { state: this.state, world: this.world, live: this.live.get(id), beast };
  }

  // pointer pick -> beast id (or null)
  pick(nx, ny) {
    this.ray.setFromCamera({ x: nx, y: ny }, this.stage.camera);
    let best = null, bestD = Infinity;
    for (const [bid, c] of this.live) {
      const hit = this.ray.intersectObject(c.group, true);
      if (hit.length && hit[0].distance < bestD) { bestD = hit[0].distance; best = bid; }
    }
    return best;
  }

  update(t, dt) {
    // advance clock
    if (!this.timePaused) {
      let h = (this.state.data.dayTime ?? 16) + HOUR_PER_S * dt;
      if (h >= 24) { h -= 24; this.state.advanceDay(); }
      this.state.data.dayTime = h;
      this.world.setTime(h);
    }
    const env = this.world.envState();

    // tick needs for ALL owned beasts (off-screen ones drain slower)
    const visible = new Set(this.live.keys());
    for (const b of this.state.data.beasts) {
      const onScreen = visible.has(b.id);
      const c = this.live.get(b.id);
      const asleep = c ? c.isAsleep() : (env.night);
      tickNeeds(b, dt * (onScreen ? 1 : 0.35), this.auraBonus + (onScreen ? 0 : 0.2), asleep);
      // passive produce while content
      const mood = moodValue(b.needs);
      const meta = c?.meta;
      if (meta?.produces && mood > 0.5) {
        const pmul = personalityOf(b.genes).produce;
        const rate = meta.produces.amount / meta.produces.every;
        b._produce = (b._produce || 0) + rate * dt * pmul * (onScreen ? 1 : 0.5) * (0.5 + mood);
      }
    }

    // advance breeding eggs (progress while their parents are content)
    this._tickEggs(dt);

    // update live creatures + sync bond/level, animate growth + shiny
    for (const [bid, c] of this.live) {
      const b = this.state.beast(bid);
      if (b) { c.bond = b.bond; c.level = b.level; }
      c.update(t, dt, env);
      // smooth growth toward the current life-stage scale
      const target = c.scaleMul * (c.sizeMod || 1) * stageOf(b ? b.level : 1).scale;
      const s = c.group.scale.x + (target - c.group.scale.x) * (1 - Math.exp(-2 * dt));
      c.group.scale.setScalar(s);
      // shiny twinkle
      if (c._shinyAura && Math.random() < dt * 1.5) this.world.spawnSparkles(c.headWorld(this._tmp), 2, 0xfff0b0);
    }
  }

  _tickEggs(dt) {
    const now = Date.now();
    for (const egg of this.state.data.eggs) {
      const span = Math.max(1, egg.hatchAt - egg.laidAtMs);
      egg.progress = Math.min(1, (now - egg.laidAtMs) / span);
      const wasReady = egg.ready;
      egg.ready = now >= egg.hatchAt;
      if (egg.ready && !wasReady) this.bus.emit('egg-ready', egg);
    }
  }

  // where the active beast is, for camera focus
  activeWorldPos(out = new THREE.Vector3()) {
    const c = this.liveActive();
    if (c) { c.group.getWorldPosition(out); out.y += 1; }
    else out.set(0, 2, 0);
    return out;
  }
}

const id = (b) => b.id;

// decor aura values (kept here so director doesn't import items for one number)
const AURA = {
  lantern: 2, fountain: 4, pumpkin_patch: 3, toy_chest: 3, cozy_nest: 3, crystal: 6,
};
