// ─────────────────────────────────────────────────────────────────────────────
//  fwooper.js — a vividly coloured African bird whose maddening song must be
//  silenced. Lime body, magenta head, a fanned crest of bright feathers and a
//  great decorative tail it spreads and bobs while strutting proudly. It 'sings'
//  by opening its golden beak in rhythm.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, TAU, lerp, clamp } from '../core/util.js';

export const meta = {
  id: 'fwooper',
  name: 'Fwooper',
  latin: 'Avis dementia',
  rarity: 'rare',
  blurb: 'An outrageously plumed African bird, all lime and magenta, that struts and fans its tail to be admired. Its song will drive a listener to madness — keep a Silencing Charm handy.',
  size: 0.65,
  speed: 1.5,
  roam: 7,
  habitat: 'meadow',
  diet: ['berries', 'beetle', 'leafy_greens'],
  favorite: 'berries',
  produces: { item: 'Fwooper feather', amount: 12, every: 85 },
  unlockCost: 260,
  palette: {
    body: 0xb6e04b,   // lime
    head: 0xe0468f,   // magenta
    wing: 0xf08a2a,   // orange
    beak: 0xffcf5a,   // golden
    eye: 0x2a2a2a,
    spark: 0xffcf5a,
  },
  care: { feed: 'Bright berries', play: 'Admire its plumage', note: 'A Silencing Charm keeps its song in check.' },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  const bodyMat = creatureMat(P.body, { rough: 0.55 });
  const headMat = creatureMat(P.head, { rough: 0.5 });
  const wingMat = creatureMat(P.wing, { rough: 0.5 });
  const beakMat = creatureMat(P.beak, { rough: 0.35, metal: 0.05 });
  const legMat  = creatureMat(0xd98a2a, { rough: 0.5 });
  const crestMat = creatureMat(P.head, { rough: 0.45, emissive: P.head, emissiveIntensity: 0.12 });

  // ── plump rounded body, sitting low ──
  const torso = blob(0.42, 0.46, 0.5, bodyMat);
  torso.position.y = 0.5;
  c.add(torso);
  // soft pale breast accent
  const breast = blob(0.32, 0.36, 0.3, creatureMat(0xd6ef86, { rough: 0.5 }));
  breast.position.set(0, 0.46, 0.34);
  breast.scale.z = 0.5;
  c.add(breast);

  // ── long elegant neck (lime, blending up toward the magenta head) ──
  const neck = limb(0.16, 0.2, 0.46, bodyMat);
  neck.position.set(0, 1.0, 0.12);
  neck.rotation.x = -0.18;
  c.add(neck);

  // ── head (magenta), set forward atop the neck ──
  const head = new THREE.Group();
  head.position.set(0, 1.18, 0.2);
  head.userData.rest = -0.08;
  c.parts.head = head;
  c.body.add(head);

  const skull = blob(0.26, 0.26, 0.28, headMat);
  head.add(skull);

  // big golden beak — upper fixed, lower jaw animatable so it 'sings'
  const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 10), beakMat);
  upperBeak.geometry.rotateX(Math.PI / 2);
  upperBeak.geometry.translate(0, 0.0, 0.17);
  upperBeak.position.set(0, 0.0, 0.26);
  head.add(upperBeak);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 10), beakMat);
  jaw.geometry.rotateX(Math.PI / 2);
  jaw.geometry.translate(0, 0, 0.15);
  jaw.position.set(0, -0.07, 0.24);
  c.parts.jaw = jaw;
  head.add(jaw);

  // round dark eyes set wide on the magenta head
  for (const sx of [-1, 1]) {
    const e = eyeball(0.1, P.eye, false);
    e.position.set(sx * 0.18, 0.08, 0.16);
    e.rotation.y = sx * 0.4;
    c.registerEye(e);
    head.add(e);
  }

  // ── crest: a fan of bright feather cones rising from the head ──
  const crest = new THREE.Group();
  crest.position.set(0, 0.24, -0.02);
  c.crest = crest;
  for (let i = -2; i <= 2; i++) {
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.34, 6), crestMat);
    feather.castShadow = true;
    feather.position.set(i * 0.07, 0.16, -i * i * 0.015);
    feather.rotation.z = -i * 0.22;
    feather.rotation.x = -0.25 + Math.abs(i) * 0.05;
    crest.add(feather);
  }
  // alternating orange tips for contrast
  for (let i = -1; i <= 1; i++) {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.26, 6), wingMat);
    tip.castShadow = true;
    tip.position.set(i * 0.13, 0.18, 0.02);
    tip.rotation.z = -i * 0.34;
    tip.rotation.x = -0.2;
    crest.add(tip);
  }
  head.add(crest);

  // ── decorative wings (orange accents) folded along the body ──
  c.parts.wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), wingMat);
    wing.scale.set(0.16, 0.34, 0.42);
    wing.castShadow = true;
    wing.receiveShadow = true;
    wing.position.set(sx * 0.42, 0.52, -0.02);
    wing.rotation.z = sx * 0.18;
    wing.userData.rest = sx * 0.18;
    c.parts.wings.push(wing);
    c.body.add(wing);
    // a couple of lime covert feathers laid over each wing
    for (let k = 0; k < 2; k++) {
      const cov = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6), bodyMat);
      cov.geometry.rotateX(Math.PI / 2);
      cov.castShadow = true;
      cov.position.set(sx * 0.46, 0.56 - k * 0.12, -0.12 - k * 0.08);
      cov.rotation.x = 0.5;
      cov.rotation.z = sx * 0.2;
      c.body.add(cov);
    }
  }

  // ── big decorative tail: a fan of long flat feather planes ──
  const tail = new THREE.Group();
  tail.position.set(0, 0.46, -0.46);
  tail.userData.rest = 0.0;
  c.parts.tail = tail;
  c.tailFeathers = [];
  const tailCols = [P.wing, P.head, P.body, P.head, P.wing];
  for (let i = -2; i <= 2; i++) {
    const idx = i + 2;
    const fmat = creatureMat(tailCols[idx], { rough: 0.5 });
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.78, 6), fmat);
    feather.castShadow = true;
    // pivot at base: shift geometry back so it sweeps from the tail root
    feather.geometry.rotateX(Math.PI / 2);
    feather.geometry.translate(0, 0, -0.39);
    feather.scale.x = 1.4; // flatten into a broad plane
    feather.scale.y = 0.5;
    feather.userData.spread = i; // -2..2
    c.tailFeathers.push(feather);
    tail.add(feather);
  }
  c.body.add(tail);

  // ── strong bird legs (push to c.parts.legs so the rig steps them) ──
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.18, 0.34, -0.02);
    const thigh = limb(0.06, 0.05, 0.34, legMat);
    leg.add(thigh);
    // foot with three forward toes
    const foot = new THREE.Group();
    foot.position.set(0, -0.34, 0);
    for (let toe = -1; toe <= 1; toe++) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.18, 6), legMat);
      t.geometry.translate(0, -0.09, 0);
      t.castShadow = true;
      t.position.set(toe * 0.05, 0, 0.07);
      t.rotation.x = Math.PI / 2.3;
      t.rotation.z = toe * 0.25;
      foot.add(t);
    }
    leg.add(foot);
    c.parts.legs.push(leg);
    c.body.add(leg);
  }

  // ── species idle: struts proudly, fans its tail on a timer, bobs its crest,
  //    turns its head to show off, and 'sings' by opening its beak rhythmically ──
  let fanTimer = 2 + c.rng() * 3;
  let fanTarget = 0;        // 0 = folded, 1 = fully fanned
  let fan = 0;             // current smoothed spread
  let songTimer = 4 + c.rng() * 4;
  let singing = 0;        // 0..1 song intensity envelope
  c.onIdle = (t, dt, env) => {
    const m = c.mood();

    // ── tail-fan timer: periodically spread the great tail feathers ──
    if (c.state === 'idle' || c.state === 'play') {
      fanTimer -= dt;
      if (fanTimer <= 0) {
        fanTarget = fanTarget > 0.5 ? 0 : 1;
        fanTimer = fanTarget > 0.5 ? 2.5 + c.rng() * 2 : 3 + c.rng() * 4;
      }
    } else {
      fanTarget = 0;
    }
    const proud = c.state === 'play' ? 1 : 0.6 + m * 0.4;
    fan = lerp(fan, fanTarget * proud, 1 - Math.exp(-5 * dt));
    c.tailFeathers.forEach(f => {
      const s = f.userData.spread; // -2..2
      f.rotation.y = s * (0.12 + fan * 0.34);
      f.rotation.x = -0.2 - fan * 0.45 + Math.sin(t * 2 + s) * 0.03 * fan;
    });

    // ── crest bob: the bright feathers wobble as it shows off ──
    if (c.crest) {
      c.crest.rotation.x = Math.sin(t * 3.2) * 0.1 * (0.5 + fan) + fan * 0.15;
      c.crest.scale.setScalar(1 + fan * 0.12 + Math.sin(t * 4) * 0.02);
    }

    // ── proud strut: gentle side-to-side sway and a chest-up posture ──
    if (c.state === 'idle' || c.state === 'walk') {
      c.body.rotation.z += Math.sin(t * (c.state === 'walk' ? 9 : 2.4)) * 0.04;
    }

    // ── show off: extra head turn when fanned, beyond the base glance ──
    if (head && fan > 0.3 && !c.lookAt) {
      head.rotation.y += Math.sin(t * 1.3) * 0.18 * fan;
    }

    // ── the maddening song: open the golden beak rhythmically ──
    if (c.state !== 'sleep' && c.state !== 'eat') {
      songTimer -= dt;
      if (songTimer <= 0) {
        singing = 1;
        songTimer = 5 + c.rng() * 5;
        if (c.rng() < 0.5) c.react('sparkle');
      }
    }
    singing = Math.max(0, singing - dt * 0.5);
    if (c.parts.jaw && c.state !== 'eat') {
      const warble = singing > 0 ? (Math.sin(t * 13) * 0.5 + 0.5) * singing : 0;
      c.parts.jaw.rotation.x = lerp(c.parts.jaw.rotation.x, warble * 0.55, 1 - Math.exp(-12 * dt));
      // crest flares with each note
      if (c.crest) c.crest.scale.y = 1 + warble * 0.2;
    }

    // wings shiver a touch when singing or proud
    c.parts.wings.forEach((w, i) => {
      const sx = i ? 1 : -1;
      w.rotation.z = w.userData.rest + Math.sin(t * 10 + i) * (0.04 + singing * 0.1) * sx;
    });
  };

  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      // a delighted full fan + a proud quarter-turn to be admired
      fanTarget = 1;
      fanTimer = 3;
      singing = 1;
      c.heading += 0.5;
    }
  };

  return c;
}
