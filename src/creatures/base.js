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
    // idle | walk | eat | play | sleep | pet | happy | beg | dig
    this.state = 'idle';
    this.stateT = 0;
    this.nextDecision = rngRange(this.rng, 1.2, 3.5);
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

  // ── behaviour driver ──
  decide(env) {
    const m = this.mood();
    const r = this.rng();
    // tired creatures sleep, especially at night
    if (this.needs.energy < 22 || (env.night && r < 0.25 && this.needs.energy < 55)) {
      this.enter('sleep', rngRange(this.rng, 6, 12)); return;
    }
    if (m > 0.62 && r < 0.4) { this.enter('play', rngRange(this.rng, 2.5, 4.5)); return; }
    if (r < 0.5) {
      // pick a new wander target inside roam radius
      const a = this.rng() * TAU, rad = this.rng() * this.roam;
      this.target.set(this.home.x + Math.cos(a) * rad, 0, this.home.z + Math.sin(a) * rad);
      this.enter('walk', rngRange(this.rng, 1.5, 3.5));
    } else {
      this.enter('idle', rngRange(this.rng, 1.5, 3.5));
    }
  }

  enter(state, dur = 2) {
    if (this.state === state && state !== 'walk') return;
    this.state = state; this.stateT = 0; this.stateDur = dur;
    if (state === 'eat' || state === 'play' || state === 'pet' || state === 'happy') this.bobPhase = 0;
  }

  // called by actions system
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
        const sp = this.speed * (this.meta.speed || 1) * dt * (env.timeScale || 1);
        this.pos.addScaledVector(_v, Math.min(sp, d));
        this.heading = Math.atan2(_v.x, _v.z);
        moving = true;
      }
    } else if (this.state === 'play') {
      // little excited hops around home
      moving = false;
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
    } else if (this.state === 'walk') {
      const stepF = Math.abs(Math.sin(t * 9));
      bodyY = stepF * 0.06 * this.scaleMul;
      bodyRoll = Math.sin(t * 9) * 0.05;
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

    // ── selection ring pulse ──
    this.glow = damp(this.glow, this.selected ? 1 : 0, 8, dt);
    this.ring.material.opacity = this.glow * (0.45 + Math.sin(t * 3) * 0.15);
    this.ring.scale.setScalar(1 + this.glow * 0.06 + Math.sin(t * 3) * 0.02);

    // species-specific idle
    if (this.onIdle) this.onIdle(t, dt, env);

    // ── decisions ──
    if (this.nextDecision <= 0 && (this.state === 'idle' || this.state === 'walk')) {
      this.decide(env);
    } else if (this.nextDecision <= 0) {
      // timed states return to idle
      this.enter('idle', rngRange(this.rng, 1, 2.5));
      this.nextDecision = rngRange(this.rng, 1.2, 3);
    }
    if (this.stateT > this.stateDur && (this.state === 'eat' || this.state === 'play' || this.state === 'pet' || this.state === 'happy' || this.state === 'sleep')) {
      if (this.nextDecision > 0) this.nextDecision = 0.01;
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
