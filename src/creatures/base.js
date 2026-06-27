// ─────────────────────────────────────────────────────────────────────────────
//  base.js — the Creature class every species extends through composition.
//
//  A species module only has to:
//    1. build geometry onto `c.group` (and push animated bits into helper slots)
//    2. optionally set `c.onIdle(t, dt, e)` for species-specific motion
//    3. optionally set `c.onReact(kind)` for special reactions
//
//  Everything else — wandering AI, needs decay hooks, mood, selection glow,
//  nameplate, eat/play/sleep/pet animation states, bob, blink — lives here so
//  all beasts feel consistent and polished.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TAU, clamp, lerp, damp, smooth, easeOutBack, easeOutElastic, makeRng, rngRange } from '../core/util.js';
import { archProfile, personaProfile, chooseTarget } from './behavior.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Creature {
  constructor(meta, opts = {}) {
    this.meta = meta;
    this.id = opts.id || meta.id;
    this.name = opts.name || meta.name;
    this.species = meta.id;
    this.scaleMul = (meta.size || 1) * (opts.scaleMul || 1);

    this.group = new THREE.Group();
    this.body = new THREE.Group();          // everything that bobs/squashes
    this.group.add(this.body);

    // Animated rig slots a species can populate (all optional)
    this.parts = {
      head: null, jaw: null, tail: null,
      ears: [], legs: [], eyes: [], lids: [], wings: [], extra: [],
    };

    // ── world placement / wander ──
    this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.home = this.pos.clone();
    this.target = this.pos.clone();
    this.heading = opts.heading ?? Math.random() * TAU;
    this.faceAngle = this.heading;
    this.speed = meta.speed || 1.6;
    this.roam = meta.roam ?? 7;             // wander radius around home
    this.rng = makeRng((opts.seed || 1) * 2654435761 % 2147483647 || 7);

    // ── behaviour state machine ──
    // idle | walk | action | eat | play | sleep | pet | happy | beg | dig
    this.state = 'walk';                     // start in motion — nobody just sits
    this.stateT = 0;
    this.action = null;                      // current ambient action name (state==='action')
    // archetype + personality drives (overridden by builder/hero meta + director)
    this.archetype = meta.archetype || 'beast';
    this.archProfile = archProfile(this.archetype);
    this.personaProfile = personaProfile('curious');
    this.nextDecision = rngRange(this.rng, 0.4, 1.6);
    this.blinkT = rngRange(this.rng, 1, 4);
    this.blink = 0;
    this.bob = 0;                            // 0..1 squash amount for hops
    this.bobPhase = this.rng() * TAU;
    this.lookAt = null;                      // optional THREE.Vector3 to glance toward

    // ── care needs (0..100) — the heart of the game ──
    const n = opts.needs || {};
    this.needs = {
      hunger: n.hunger ?? 60,     // higher = more full
      energy: n.energy ?? 80,
      joy: n.joy ?? 65,
      hygiene: n.hygiene ?? 70,
    };
    this.bond = opts.bond ?? 0;             // 0..100 within current level
    this.level = opts.level ?? 1;
    this.xp = opts.xp ?? 0;

    // ── presentation ──
    this.selected = false;
    this.glow = 0;
    this.reactQueue = [];
    this.sparkleCb = null;                   // set by world to spawn particles
    this.heartCb = null;

    // selection ring (subtle, on the ground)
    const ringGeo = new THREE.RingGeometry(0.62, 0.78, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xead9a0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.ring.position.y = 0.02;
    this.group.add(this.ring);

    this.group.scale.setScalar(this.scaleMul);
    this.group.position.copy(this.pos);

    // hooks a species can override
    this.onIdle = null;     // (t, dt, env) => void
    this.onReact = null;    // (kind) => void
    this.onAction = null;   // (name, t, dt, env) => void — species flourish for an ambient action
    this.eyeMatList = [];   // species register eye materials for blink tinting
  }

  // ── helpers a species calls while building geometry ──
  add(mesh) { this.body.add(mesh); return mesh; }
  registerEye(mesh) { this.parts.eyes.push(mesh); return mesh; }
  registerLid(mesh) { this.parts.lids.push(mesh); return mesh; }

  setSelected(on) {
    this.selected = on;
  }

  // mood is the blended emotional read used by UI + animation
  mood() {
    const { hunger, energy, joy, hygiene } = this.needs;
    return clamp((hunger * 0.3 + energy * 0.2 + joy * 0.35 + hygiene * 0.15) / 100, 0, 1);
  }
  isAsleep() { return this.state === 'sleep'; }
  isUnhappy() { return this.mood() < 0.4; }

  // queue a one-shot reaction the world/animation will play
  react(kind) {
    this.reactQueue.push(kind);
    if (kind === 'happy' || kind === 'love') {
      this.heartCb && this.heartCb(this.headWorld(), kind === 'love' ? 6 : 3);
    }
    if (kind === 'sparkle') this.sparkleCb && this.sparkleCb(this.headWorld(), 14, this.meta.palette?.spark || 0xffe9b0);
    if (this.onReact) this.onReact(kind);
  }

  headWorld(out = new THREE.Vector3()) {
    const h = this.parts.head || this.body;
    h.getWorldPosition(out);
    out.y += 0.2 * this.scaleMul;
    return out;
  }

  // ── behaviour driver ───────────────────────────────────────────────────────
  //  Picks the NEXT thing the beast does. Designed so a creature is almost never
  //  truly idle: it roams (gait by archetype) or performs an archetype-flavoured
  //  ambient action, biased by its personality. Idle is a rare, short breather.
  decide(env) {
    const prof = this.personaProfile;
    const arch = this.archProfile;
    const m = this.mood();
    const r = this.rng();
    let dur;

    // 1) genuinely tired → sleep (active personalities resist; rises at night)
    if (this.needs.energy < 16 || (env.night && this.needs.energy < 46 && r < arch.rest + (1 - prof.activity) * 0.2)) {
      dur = rngRange(this.rng, 5, 10); this.enter('sleep', dur); this.nextDecision = dur; return;
    }
    // 2) rare short breather — calmer beasts/archetypes pause a touch more
    const pause = (1 - prof.activity) * 0.4 + arch.rest * 0.45;
    if (r < pause * 0.6) {
      dur = rngRange(this.rng, 0.6, 1.6); this.enter('idle', dur); this.nextDecision = dur; return;
    }
    // 3) content + playful → a joyful play burst
    if (m > 0.56 && this.rng() < (prof.bias === 'play' ? 0.5 : 0.16)) {
      dur = rngRange(this.rng, 1.8, 3.6); this.enter('play', dur); this.nextDecision = dur; return;
    }
    // 4) otherwise stay busy: roam to a personality-shaped spot, or do an action.
    //    wider-roaming personalities cover more ground; the rest perform actions.
    const roamBias = clamp(0.34 + prof.roam * 0.18, 0.3, 0.72);
    if (this.rng() < roamBias) {
      chooseTarget(this, env, this.target);
      dur = rngRange(this.rng, 1.6, 3.4); this.enter('walk', dur); this.nextDecision = dur;
    } else {
      const acts = arch.actions;
      this.action = acts[(this.rng() * acts.length) | 0];
      dur = rngRange(this.rng, 1.1, 2.4); this.enter('action', dur); this.nextDecision = dur;
    }
  }

  enter(state, dur = 2) {
    if (this.state === state && state !== 'walk' && state !== 'action') return;
    this.state = state; this.stateT = 0; this.stateDur = dur;
    if (state === 'eat' || state === 'play' || state === 'pet' || state === 'happy' || state === 'action') this.bobPhase = 0;
  }

  // perform a named archetype action for a spell
  enterAction(name, dur = 1.6) {
    this.action = name; this.enter('action', dur); this.nextDecision = dur;
  }

  // called by the player-actions system (feed / play / pet …)
  command(state, dur) {
    this.enter(state, dur);
    this.nextDecision = dur + 0.5;
  }

  update(t, dt, env) {
    this.stateT += dt;
    this.nextDecision -= dt;

    // ── locomotion ──
    let moving = false;
    if (this.state === 'walk') {
      _v.subVectors(this.target, this.pos); _v.y = 0;
      const d = _v.length();
      if (d > 0.18) {
        _v.normalize();
        const gaitSpeed = (this.archProfile?.speed || 1) * (this.personaProfile?.speed || 1);
        const sp = this.speed * (this.meta.speed || 1) * gaitSpeed * dt * (env.timeScale || 1);
        this.pos.addScaledVector(_v, Math.min(sp, d));
        this.heading = Math.atan2(_v.x, _v.z);
        moving = true;
      } else {
        // arrived — don't freeze in place, pick the next thing to do shortly
        if (this.nextDecision > 0.12) this.nextDecision = 0.12;
      }
    }

    // keep inside soft bounds of habitat
    const lim = env.bounds || 26;
    const dh = Math.hypot(this.pos.x, this.pos.z);
    if (dh > lim) { this.pos.multiplyScalar(lim / dh); }

    // ground follow
    const gy = env.groundAt ? env.groundAt(this.pos.x, this.pos.z) : 0;
    this.pos.y = gy;
    this.group.position.copy(this.pos);

    // smooth facing
    this.faceAngle = angleLerp(this.faceAngle, this.heading, 1 - Math.exp(-8 * dt));
    this.group.rotation.y = this.faceAngle;

    // ── procedural body motion ──
    let squashY = 1, squashXZ = 1, bodyY = 0, bodyPitch = 0, bodyRoll = 0;
    const breath = Math.sin(t * 1.6 + this.bobPhase) * 0.018;

    if (this.state === 'sleep') {
      const s = Math.sin(t * 1.1) * 0.5 + 0.5;
      squashY = lerp(0.84, 0.9, s); squashXZ = lerp(1.1, 1.05, s);
      bodyY = -0.06 * this.scaleMul;
    } else if (this.state === 'play' || this.state === 'happy') {
      const hop = Math.abs(Math.sin(t * 7));
      bodyY = hop * 0.32 * this.scaleMul;
      squashY = lerp(1.12, 0.9, hop);
      squashXZ = lerp(0.92, 1.08, hop);
      bodyRoll = Math.sin(t * 9) * 0.12;
    } else if (this.state === 'eat') {
      const c = Math.abs(Math.sin(t * 9));
      bodyPitch = 0.35 + c * 0.12;
      squashY = lerp(1.0, 0.92, c);
      if (this.parts.jaw) this.parts.jaw.rotation.x = c * 0.5;
    } else if (this.state === 'pet') {
      const w = Math.sin(t * 4);
      bodyRoll = w * 0.16; bodyY = (Math.sin(t * 2) * 0.5 + 0.5) * 0.04 * this.scaleMul;
      squashY = 0.98 + Math.sin(t * 4) * 0.02;
    } else if (this.state === 'action') {
      const a = this._actionBody(t, dt);
      squashY = a.sy; squashXZ = a.sxz; bodyY = a.by; bodyPitch = a.bp; bodyRoll = a.br;
    } else if (this.state === 'walk') {
      // gait gives each archetype a distinct way of moving across the ground
      const s = this.scaleMul;
      switch (this.archProfile?.gait) {
        case 'hop': { const h = Math.abs(Math.sin(t * 6.5)); bodyY = h * 0.34 * s; squashY = lerp(1.12, 0.9, h); squashXZ = lerp(0.9, 1.08, h); break; }
        case 'slither': { bodyRoll = Math.sin(t * 5) * 0.2; squashXZ = 1 + Math.sin(t * 5) * 0.03; bodyY = 0.0; break; }
        case 'scurry': case 'skitter': case 'scuttle': { const f = Math.abs(Math.sin(t * 14)); bodyY = f * 0.03 * s; bodyRoll = Math.sin(t * 18) * 0.05; break; }
        case 'prowl': case 'stalk': { const f = Math.abs(Math.sin(t * 6)); bodyY = f * 0.03 * s; bodyPitch = 0.05; bodyRoll = Math.sin(t * 6) * 0.06; break; }
        case 'bob': { bodyY = (Math.sin(t * 3) * 0.5 + 0.5) * 0.12 * s; bodyRoll = Math.sin(t * 2) * 0.06; break; }
        case 'drift': { bodyY = (Math.sin(t * 1.6) * 0.5 + 0.5) * 0.1 * s; bodyRoll = Math.sin(t * 1.2) * 0.05; break; }
        case 'root': { bodyY = 0; bodyRoll = Math.sin(t * 1.5) * 0.06; break; }
        case 'amble': { const f = Math.abs(Math.sin(t * 6)); bodyY = f * 0.05 * s; bodyRoll = Math.sin(t * 6) * 0.07; break; }
        default: { const f = Math.abs(Math.sin(t * 9)); bodyY = f * 0.06 * s; bodyRoll = Math.sin(t * 9) * 0.06; } // trot
      }
    } else { // idle
      bodyY = breath * this.scaleMul * 6;
      squashY = 1 + breath; squashXZ = 1 - breath * 0.6;
    }

    this.body.position.y = bodyY + breath * (this.state === 'idle' ? 4 : 1) * this.scaleMul * 0.0;
    this.body.scale.set(squashXZ, squashY, squashXZ);
    this.body.rotation.set(
      damp(this.body.rotation.x, bodyPitch, 12, dt),
      this.body.rotation.y, // species idle may add
      damp(this.body.rotation.z, bodyRoll, 12, dt)
    );

    // ── legs / walking ──
    if (this.parts.legs.length) {
      const k = (this.state === 'walk') ? 9 : (this.state === 'play' ? 13 : 0);
      this.parts.legs.forEach((leg, i) => {
        if (!leg) return;
        const ph = i * Math.PI / 2 + (i % 2) * Math.PI;
        leg.rotation.x = moving || this.state === 'play' ? Math.sin(t * k + ph) * 0.5 : lerp(leg.rotation.x, 0, 0.1);
      });
    }

    // ── ears flop ──
    this.parts.ears.forEach((ear, i) => {
      if (!ear) return;
      const base = ear.userData.rest || 0;
      ear.rotation.z = base + Math.sin(t * 3 + i) * (this.state === 'play' ? 0.35 : 0.12) * (i % 2 ? -1 : 1);
    });

    // ── tail wag (joy-scaled) ──
    if (this.parts.tail) {
      const wag = (this.mood() * 0.6 + (this.state === 'play' ? 0.6 : 0.2)) ;
      this.parts.tail.rotation.y = Math.sin(t * (6 + wag * 6)) * 0.4 * wag;
      this.parts.tail.rotation.x = (this.parts.tail.userData.rest || 0) + Math.sin(t * 5) * 0.08;
    }

    // ── blink ──
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = rngRange(this.rng, 2.2, 6); }
    this.blink = Math.max(0, this.blink - dt * 7);
    const open = this.state === 'sleep' ? 0.04 : (1 - this.blink);
    this.parts.lids.forEach(lid => { if (lid) lid.scale.y = 1 - open; });
    this.parts.eyes.forEach(eye => { if (eye && eye.userData.blinkScale !== false) eye.scale.y = lerp(0.06, eye.userData.baseY || 1, open); });

    // ── head glance ──
    if (this.parts.head) {
      let yaw = Math.sin(t * 0.5 + this.bobPhase) * 0.12;
      let pitch = this.parts.head.userData.rest || 0;
      if (this.lookAt) {
        _v2.copy(this.lookAt).sub(this.headWorld(_v));
        yaw = clamp(Math.atan2(_v2.x, _v2.z) - this.faceAngle, -0.7, 0.7);
      }
      this.parts.head.rotation.y = damp(this.parts.head.rotation.y, yaw, 6, dt);
      if (this.state === 'eat') pitch += 0.3;
      this.parts.head.rotation.x = damp(this.parts.head.rotation.x, pitch, 6, dt);
    }

    // ── archetype ambient action (overrides the generic part poses above) ──
    if (this.state === 'action') {
      this._actionParts(t, dt);
      if (this.onAction) this.onAction(this.action, t, dt, env);
    }

    // ── selection ring pulse ──
    this.glow = damp(this.glow, this.selected ? 1 : 0, 8, dt);
    this.ring.material.opacity = this.glow * (0.45 + Math.sin(t * 3) * 0.15);
    this.ring.scale.setScalar(1 + this.glow * 0.06 + Math.sin(t * 3) * 0.02);

    // species-specific idle
    if (this.onIdle) this.onIdle(t, dt, env);

    // ── decisions ── decide() always re-arms nextDecision, so this is the single
    // heartbeat of the AI: whenever the timer lapses, choose the next behaviour.
    if (this.nextDecision <= 0) this.decide(env);
    // commanded / timed states cut their decision short once they've played out
    if (this.stateT > this.stateDur && (this.state === 'eat' || this.state === 'play' || this.state === 'pet' || this.state === 'happy' || this.state === 'sleep' || this.state === 'action')) {
      if (this.nextDecision > 0) this.nextDecision = 0.01;
    }
  }

  // ── body squash/lean for the current ambient action ──
  _actionBody(t, dt) {
    const s = this.scaleMul;
    const breath = Math.sin(t * 1.6 + this.bobPhase) * 0.02;
    let sy = 1 + breath, sxz = 1 - breath * 0.5, by = 0, bp = 0, br = 0;
    switch (this.action) {
      case 'peck': case 'snuffle': case 'graze': case 'dig': case 'finflick': {
        const d = Math.abs(Math.sin(t * 9)); bp = 0.14 * d; by = -0.02 * d * s; break;
      }
      case 'preen': case 'groom': { br = Math.sin(t * 2.4) * 0.1; bp = 0.08; break; }
      case 'snort': { by = Math.abs(Math.sin(t * 7)) * 0.03 * s; bp = -0.06; break; }
      case 'throat': { const p = Math.abs(Math.sin(t * 5)); sxz = 1 + p * 0.1; sy = 1 - p * 0.04; break; }
      case 'roar': { bp = -0.18; by = 0.04 * s; sy = 1.04; break; }
      case 'situp': case 'rear': case 'rise': case 'coil': {
        const u = smooth(clamp(this.stateT / 0.5, 0, 1)); bp = -0.5 * u; by = 0.12 * u * s; break;
      }
      case 'stretch': case 'reach': { const u = Math.sin(this.stateT * 2.0); bp = 0.18 * u; by = 0.04 * Math.abs(u) * s; break; }
      case 'hop': case 'pounce': case 'dart': case 'caper': case 'splash': case 'bob': {
        const h = Math.abs(Math.sin(t * 7)); by = h * 0.3 * s; sy = lerp(1.12, 0.9, h); sxz = lerp(0.9, 1.08, h); break;
      }
      case 'flutter': case 'buzz': case 'hover': { by = (0.08 + Math.abs(Math.sin(t * 12)) * 0.05) * s; sy = 1 + Math.sin(t * 12) * 0.02; break; }
      case 'sway': { br = Math.sin(t * 1.5) * 0.16; bp = Math.sin(t * 1.1) * 0.06; break; }
      case 'shiver': { br = Math.sin(t * 22) * 0.05; sxz = 1 + Math.sin(t * 22) * 0.02; break; }
      case 'pulse': case 'ooze': case 'wobble': { const p = Math.sin(t * 4); sy = 1 + p * 0.13; sxz = 1 - p * 0.09; by = Math.abs(p) * 0.04 * s; break; }
      case 'tailswish': case 'tailflick': case 'headtoss': case 'paw': case 'gesture': { br = Math.sin(t * 3) * 0.05; break; }
      default: { /* look / headsweep / antennae / earswivel / blink — just breathe */ }
    }
    return { sy, sxz, by, bp, br };
  }

  // ── head / jaw / tail / legs / wings poses for the current ambient action ──
  _actionParts(t, dt) {
    const head = this.parts.head, jaw = this.parts.jaw, tail = this.parts.tail;
    const legs = this.parts.legs, wings = this.parts.wings;
    const headRest = head ? (head.userData.rest || 0) : 0;
    const setJaw = (v) => { if (jaw) jaw.rotation.x = v; };
    const front = () => { const r = []; for (let i = 0; i < legs.length; i++) { const l = legs[i]; if (l && l.position.z > 0) r.push(l); } return r.length ? r : legs.slice(0, 2); };
    switch (this.action) {
      case 'peck': case 'snuffle': case 'finflick': {
        const d = Math.abs(Math.sin(t * 9));
        if (head) head.rotation.x = headRest + 0.5 + d * 0.35;
        setJaw(d * 0.4);
        break;
      }
      case 'graze': {
        if (head) { head.rotation.x = headRest + 0.85 + Math.sin(t * 6) * 0.08; head.rotation.y = Math.sin(t * 0.8) * 0.25; }
        setJaw(Math.abs(Math.sin(t * 7)) * 0.3);
        break;
      }
      case 'dig': {
        const d = Math.abs(Math.sin(t * 11));
        if (head) head.rotation.x = headRest + 0.5 + d * 0.3;
        front().forEach((l, i) => l.rotation.x = 0.5 + Math.sin(t * 16 + i) * 0.45);
        break;
      }
      case 'preen': case 'groom': {
        if (head) { head.rotation.y = Math.sin(t * 4) * 0.6; head.rotation.x = headRest + 0.35 + Math.abs(Math.sin(t * 4)) * 0.25; }
        break;
      }
      case 'look': case 'headsweep': case 'antennae': case 'earswivel': {
        if (head) { head.rotation.y = Math.sin(t * 1.4) * 0.7; head.rotation.x = headRest + Math.sin(t * 0.9) * 0.16; }
        break;
      }
      case 'snort': {
        if (head) head.rotation.x = headRest - 0.06 + Math.sin(t * 18) * 0.06;
        setJaw(0.1 + Math.abs(Math.sin(t * 9)) * 0.12);
        break;
      }
      case 'roar': {
        if (head) head.rotation.x = headRest - 0.35;
        setJaw(0.5 + Math.sin(t * 4) * 0.12);
        break;
      }
      case 'tongue': case 'throat': case 'blink': {
        setJaw((0.5 + Math.sin(t * 9) * 0.5) * 0.45);
        if (head && this.action === 'throat') head.rotation.x = headRest - 0.08;
        break;
      }
      case 'headtoss': {
        if (head) head.rotation.x = headRest - 0.3 + Math.sin(t * 6) * 0.3;
        break;
      }
      case 'tailswish': case 'tailflick': {
        if (tail) { tail.rotation.y = Math.sin(t * (this.action === 'tailflick' ? 9 : 5)) * 0.7; tail.rotation.x = (tail.userData.rest || 0); }
        break;
      }
      case 'paw': case 'legtap': case 'scuttle': {
        const fr = this.action === 'paw' ? front() : legs;
        fr.forEach((l, i) => { if (l) l.rotation.x = Math.sin(t * 12 + i * 1.3) * 0.45; });
        break;
      }
      case 'situp': case 'rear': case 'rise': {
        const u = smooth(clamp(this.stateT / 0.5, 0, 1));
        if (head) head.rotation.x = headRest - 0.3 * u;
        front().forEach(l => { if (l) l.rotation.x = -0.7 * u; });
        break;
      }
      case 'stretch': {
        const u = Math.sin(this.stateT * 2.0);
        if (head) head.rotation.x = headRest + 0.2 * u;
        front().forEach(l => { if (l) l.rotation.x = 0.4 * u; });
        break;
      }
      case 'coil': {
        if (head) { head.rotation.x = headRest - 0.25; head.rotation.y = Math.sin(t * 2.5) * 0.5; }
        setJaw(Math.abs(Math.sin(t * 6)) < 0.15 ? 0.2 : 0);
        break;
      }
      case 'wingstretch': {
        const u = smooth(clamp(this.stateT / 0.4, 0, 1));
        wings.forEach(w => { if (w) w.rotation.z = (w.userData.side || 1) * (0.5 + 0.7 * u); });
        break;
      }
      case 'flutter': case 'buzz': case 'hover': case 'flap': {
        wings.forEach(w => { if (w) w.rotation.z = (w.userData.side || 1) * Math.sin(t * 16) * 0.7; });
        break;
      }
      case 'pounce': case 'dart': {
        // lunge a short hop forward along facing
        const step = (this.action === 'dart' ? 1.1 : 0.7) * dt;
        this.pos.x += Math.sin(this.faceAngle) * step;
        this.pos.z += Math.cos(this.faceAngle) * step;
        if (head) head.rotation.x = headRest + 0.12;
        break;
      }
      case 'reach': {
        const u = Math.sin(this.stateT * 2.0);
        if (head) head.rotation.x = headRest - 0.2 * Math.abs(u);
        break;
      }
      default: { /* sway / shiver / pulse / ooze / wobble / gesture / caper — body-driven */
        if (head && (this.action === 'gesture' || this.action === 'caper')) head.rotation.y = Math.sin(t * 5) * 0.4;
      }
    }
  }

  dispose() {
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
  }
}

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

// ── shared geometry helpers many species reuse ──
export function eyeball(r = 0.12, irisHex = 0x1b2233, big = true) {
  const g = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 16),
    new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 0.35 }));
  const iris = new THREE.Mesh(new THREE.SphereGeometry(r * (big ? 0.74 : 0.5), 16, 14),
    new THREE.MeshStandardMaterial({ color: irisHex, roughness: 0.25, emissive: irisHex, emissiveIntensity: 0.18 }));
  iris.position.z = r * 0.55;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * (big ? 0.42 : 0.26), 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.2 }));
  pupil.position.z = r * 0.78;
  const glint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  glint.position.set(r * 0.22, r * 0.26, r * 0.82);
  g.add(white, iris, pupil, glint);
  g.userData.baseY = 1;
  return g;
}

export function blob(rx, ry, rz, mat, seg = 22) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.8));
  const m = new THREE.Mesh(g, mat);
  m.scale.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function limb(r0, r1, len, mat, seg = 8) {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg);
  g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}
