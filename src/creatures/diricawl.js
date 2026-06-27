// ─────────────────────────────────────────────────────────────────────────────
//  diricawl.js — the magical dodo. A plump, slate-blue, flightless bird with
//  stubby useless wings, thick scaly legs and a great hooked beak. Its signature
//  trick: when content (or startled) it simply Apparates — vanishing in a puff of
//  lilac sparkle and reappearing somewhere else in its roam.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU, clamp, lerp, easeOutBack, easeOutCubic } from '../core/util.js';

export const meta = {
  id: 'diricawl',
  archetype: 'avian',
  name: 'Diricawl',
  latin: 'Raphus evanescens',
  rarity: 'rare',
  blurb: 'A plump, flightless bird Muggles believe extinct — for it simply vanishes whenever it feels threatened. Round, gentle and forever surprised.',
  size: 0.8,
  speed: 1.2,
  roam: 8,
  habitat: 'meadow',
  diet: ['berries', 'leafy_greens', 'sweet_truffle'],
  favorite: 'berries',
  produces: { item: 'Diricawl feather', amount: 11, every: 90 },
  unlockCost: 240,
  palette: {
    plumage: 0x5b6b86,
    plumageTip: 0x6f7e98,
    belly: 0x8a97ac,
    beak: 0xd4b46a,
    leg: 0xb9a98a,
    eye: 0x1a1a1a,
    spark: 0xc9b6e8,
  },
  care: {
    feed: 'Fruit and greens',
    play: 'Catch it before it vanishes',
    note: 'Apparates when startled — do not panic, it returns.',
  },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  const plumeTex = furTexture(128, P.plumage, P.plumageTip, 0.5);
  const plumeMat = creatureMat(P.plumage, { rough: 0.74, map: plumeTex });
  const bellyMat = creatureMat(P.belly, { rough: 0.7 });
  const beakMat = creatureMat(P.beak, { rough: 0.42, metal: 0.08 });
  const legMat = creatureMat(P.leg, { rough: 0.55 });
  const clawMat = creatureMat(0x4a4034, { rough: 0.45 });

  // ── body: fat round dodo torso ──
  const torso = blob(0.66, 0.62, 0.74, plumeMat);
  torso.position.y = 0.62;
  c.add(torso);

  // pale rounded belly
  const belly = blob(0.52, 0.5, 0.46, bellyMat);
  belly.position.set(0, 0.5, 0.36);
  belly.scale.z = 0.55;
  c.add(belly);

  // a soft ruffled collar where neck meets body
  const collar = blob(0.34, 0.28, 0.32, plumeMat);
  collar.position.set(0, 1.0, 0.18);
  c.add(collar);

  // ── long neck ──
  const neck = limb(0.2, 0.26, 0.42, plumeMat);
  neck.position.set(0, 1.36, 0.18);
  neck.rotation.x = -0.18;
  c.add(neck);

  // ── head with the large hooked beak ──
  const head = new THREE.Group();
  head.position.set(0, 1.42, 0.26);
  head.userData.rest = 0.05;
  c.parts.head = head; c.body.add(head);

  const skull = blob(0.32, 0.32, 0.34, plumeMat);
  head.add(skull);

  // pale facial mask around the eyes/beak base
  const mask = blob(0.26, 0.24, 0.22, bellyMat);
  mask.position.set(0, -0.02, 0.18);
  head.add(mask);

  // big curved beak: an upper wedge + hooked tip + animatable lower jaw
  const beakUpper = blob(0.16, 0.14, 0.34, beakMat);
  beakUpper.position.set(0, 0.0, 0.42);
  beakUpper.scale.set(0.85, 0.78, 1);
  head.add(beakUpper);

  // the signature hooked tip curling down
  const hook = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 12), beakMat);
  hook.geometry.translate(0, -0.11, 0);
  hook.position.set(0, -0.02, 0.66);
  hook.rotation.x = 1.15; // curl the tip forward/down
  head.add(hook);

  // lower jaw (opens when eating)
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.34), beakMat);
  jaw.geometry.translate(0, 0, 0.17);
  jaw.position.set(0, -0.14, 0.36);
  c.parts.jaw = jaw; head.add(jaw);

  // nostrils on the beak
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), creatureMat(0x2a2014, { rough: 0.3 }));
    n.position.set(sx * 0.05, 0.06, 0.52);
    head.add(n);
  }

  // small beady dark eyes, set wide — perpetually surprised
  for (const sx of [-1, 1]) {
    const e = eyeball(0.1, P.eye, false);
    e.position.set(sx * 0.24, 0.08, 0.18);
    e.rotation.y = sx * 0.4;
    c.registerEye(e); head.add(e);
  }

  // ── stubby useless wings tucked at the sides ──
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.6, 0.66, 0.04);
    const flap = blob(0.12, 0.3, 0.42, plumeMat);
    flap.scale.set(0.55, 1, 1);
    wing.add(flap);
    wing.rotation.z = sx * 0.18;
    wing.userData.rest = sx * 0.18;
    c.parts.ears.push(wing); // reuse ear slot so the rig gives them a little flutter
    c.parts.wings.push(wing);
    c.body.add(wing);
  }

  // ── thick scaly legs (pushed into c.parts.legs so the rig waddle-walks them) ──
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.26, 0.34, 0.0);
    const thigh = limb(0.12, 0.1, 0.34, legMat);
    leg.add(thigh);
    // big flat three-toed foot
    const foot = blob(0.18, 0.06, 0.24, legMat);
    foot.position.set(0, -0.34, 0.06);
    leg.add(foot);
    for (let k = -1; k <= 1; k++) {
      const toe = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), clawMat);
      toe.position.set(k * 0.1, -0.34, 0.22);
      toe.rotation.x = Math.PI / 2.1;
      leg.add(toe);
    }
    c.parts.legs.push(leg); c.body.add(leg);
  }

  // ── tuft of curly tail feathers at the back ──
  const tail = new THREE.Group();
  tail.position.set(0, 0.78, -0.62);
  tail.userData.rest = 0.25;
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.32;
    const plume = blob(0.06, 0.18, 0.08, plumeMat);
    plume.position.set(Math.sin(a) * 0.18, 0.1 + Math.cos(a) * 0.04, -0.06);
    plume.rotation.z = a * 0.6;
    plume.rotation.x = -0.5 - i * 0.04;
    plume.scale.y = 1.1 + (2 - Math.abs(i - 2)) * 0.3; // longer in the middle
    tail.add(plume);
  }
  c.parts.tail = tail; c.body.add(tail);

  // ── SIGNATURE ABILITY: periodic vanish / Apparate ──
  // phase machine: 'visible' -> 'shrink' -> (teleport) -> 'grow' -> 'visible'
  let vanishPhase = 'visible';
  let vanishT = 8 + c.rng() * 6;   // seconds until next vanish
  let phaseT = 0;                  // progress within shrink/grow phase
  const SHRINK = 0.32, GROW = 0.5; // durations

  const doTeleport = () => {
    const a = c.rng() * TAU;
    const rad = c.rng() * c.roam;
    c.pos.set(c.home.x + Math.cos(a) * rad, 0, c.home.z + Math.sin(a) * rad);
    c.target.copy(c.pos);
    c.group.position.copy(c.pos);
    c.heading = c.rng() * TAU;
    c.faceAngle = c.heading;
  };

  c.onIdle = (t, dt, env) => {
    // gentle plump breathing waddle of the wings is handled by ear rig already.

    if (vanishPhase === 'visible') {
      c.body.visible = true;
      c.body.scale.x = c.body.scale.x; // leave rig's squash untouched
      // only Apparate when calm & not busy (eating/playing/sleeping/petting)
      const busy = c.state === 'eat' || c.state === 'play' || c.state === 'pet' || c.state === 'sleep';
      if (!busy) vanishT -= dt;
      if (vanishT <= 0) {
        vanishPhase = 'shrink';
        phaseT = 0;
        c.react('sparkle');
      }
    } else if (vanishPhase === 'shrink') {
      phaseT += dt;
      const k = clamp(phaseT / SHRINK);
      const s = 1 - easeOutCubic(k);
      c.body.scale.setScalar(Math.max(0.0001, s));
      if (k >= 1) {
        c.body.visible = false;
        doTeleport();
        vanishPhase = 'grow';
        phaseT = 0;
        c.react('sparkle'); // puff at the arrival spot
      }
    } else if (vanishPhase === 'grow') {
      c.body.visible = true;
      phaseT += dt;
      const k = clamp(phaseT / GROW);
      const s = easeOutBack(k);
      c.body.scale.setScalar(s);
      if (k >= 1) {
        c.body.scale.setScalar(1);
        vanishPhase = 'visible';
        vanishT = 8 + c.rng() * 6;
      }
    }

    // a perpetually-curious head bob while idle
    if (c.state === 'idle' && vanishPhase === 'visible') {
      head.rotation.x = (head.userData.rest || 0) + Math.sin(t * 1.7) * 0.07;
    }
  };

  // when startled or delighted, Apparate immediately
  c.onReact = (kind) => {
    if (kind === 'scared' || kind === 'startled') {
      if (vanishPhase === 'visible') { vanishT = 0; }
    }
    if (kind === 'happy' || kind === 'love') {
      // an excited little tail flick + bring the next vanish sooner
      if (vanishPhase === 'visible') vanishT = Math.min(vanishT, 1.5 + c.rng() * 1.5);
    }
  };

  return c;
}
