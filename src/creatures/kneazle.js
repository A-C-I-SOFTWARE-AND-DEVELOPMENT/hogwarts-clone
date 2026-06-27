// ─────────────────────────────────────────────────────────────────────────────
//  kneazle.js — a lithe, cat-like beast: slender feline body, oversized tufted
//  ears, a plumed lion-like tail and flecked, spotted fur. Aloof but fiercely
//  loyal; an uncanny judge of character. Kneads and purrs once it bonds.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU } from '../core/util.js';

export const meta = {
  id: 'kneazle',
  archetype: 'beast',
  name: 'Kneazle',
  latin: 'Felis sagax',
  rarity: 'uncommon',
  blurb: 'A slender, spotted cat-beast with enormous tufted ears and a plumed lion-like tail. Aloof to strangers, devoted to those it trusts — and a peerless judge of bad intent.',
  size: 0.7,
  speed: 2.2,
  roam: 9,
  habitat: 'meadow',
  diet: ['fresh_fish', 'raw_meat', 'beetle'],
  favorite: 'fresh_fish',
  produces: { item: 'Kneazle whisker', amount: 10, every: 80 },
  unlockCost: 180,
  palette: {
    fur: 0x6b5a3e, furTip: 0x8a7656, spot: 0x3a3024,
    earInner: 0xc98f86, eye: 0xd8a13c, paw: 0x4a3f2d, spark: 0xe8c878,
  },
  care: {
    feed: 'Fresh fish & meat',
    play: 'Chase the feather wand',
    note: 'Senses bad people — trust its instincts.',
  },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  const fur = furTexture(128, P.fur, P.furTip, 0.7);
  const furMat = creatureMat(P.fur, { rough: 0.7, map: fur });
  const spotMat = creatureMat(P.spot, { rough: 0.72 });
  const innerMat = creatureMat(P.earInner, { rough: 0.6 });
  const pawMat = creatureMat(P.paw, { rough: 0.55 });
  const noseMat = creatureMat(0x4a2f30, { rough: 0.4 });
  const whiskerMat = creatureMat(0xe8e1cf, { rough: 0.3 });
  const tuftMat = creatureMat(P.furTip, { rough: 0.78, map: fur });

  // ── slender feline torso (lean, low to the ground) ──
  const torso = blob(0.36, 0.34, 0.6, furMat);
  torso.position.set(0, 0.52, 0.02);
  c.add(torso);

  // shoulders / haunches give the cat its arched feline silhouette
  const shoulders = blob(0.32, 0.34, 0.32, furMat);
  shoulders.position.set(0, 0.56, 0.32);
  c.add(shoulders);
  const haunches = blob(0.34, 0.36, 0.34, furMat);
  haunches.position.set(0, 0.55, -0.3);
  c.add(haunches);

  // pale spotted belly
  const belly = blob(0.3, 0.26, 0.5, spotMat);
  belly.position.set(0, 0.38, 0.04);
  belly.scale.z = 0.9;
  c.add(belly);

  // scattered dark dapple-spots along the flanks and back
  const spotData = [
    [0.3, 0.62, 0.18], [-0.3, 0.6, 0.0], [0.28, 0.58, -0.18],
    [-0.28, 0.64, 0.26], [0.12, 0.74, 0.0], [-0.14, 0.72, -0.24],
    [0.32, 0.5, -0.34], [-0.3, 0.52, -0.36], [0.0, 0.78, 0.3],
  ];
  spotData.forEach(([x, y, z]) => {
    const s = blob(0.07, 0.05, 0.08, spotMat, 10);
    s.position.set(x, y, z);
    c.add(s);
  });

  // ── neck rising to the head ──
  const neck = limb(0.16, 0.18, 0.34, furMat);
  neck.position.set(0, 0.78, 0.46);
  neck.rotation.x = -0.7;
  c.add(neck);

  // ── head ──
  const head = new THREE.Group();
  head.position.set(0, 0.92, 0.62);
  c.parts.head = head;
  c.body.add(head);

  const skull = blob(0.27, 0.26, 0.27, furMat);
  head.add(skull);

  // cheek ruff (slightly wider face)
  for (const sx of [-1, 1]) {
    const cheek = blob(0.13, 0.14, 0.12, furMat, 12);
    cheek.position.set(sx * 0.2, -0.04, 0.06);
    head.add(cheek);
  }

  // small muzzle + animatable lower jaw
  const muzzle = blob(0.15, 0.12, 0.16, spotMat);
  muzzle.position.set(0, -0.08, 0.2);
  head.add(muzzle);
  const jaw = blob(0.12, 0.07, 0.12, spotMat, 12);
  jaw.geometry.translate(0, 0, 0.06);
  jaw.position.set(0, -0.16, 0.18);
  c.parts.jaw = jaw;
  head.add(jaw);

  // pink triangular nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.06, 4), noseMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.04, 0.34);
  head.add(nose);

  // almond amber eyes (slanted, feline)
  for (const sx of [-1, 1]) {
    const e = eyeball(0.12, P.eye, true);
    e.position.set(sx * 0.15, 0.06, 0.2);
    e.rotation.z = -sx * 0.3;       // slant the almond shape
    e.rotation.y = sx * 0.18;
    e.scale.set(1.0, 0.78, 1.0);    // narrow → almond
    e.userData.baseY = 0.78;
    c.registerEye(e);
    head.add(e);
  }

  // whiskers — thin cylinders fanning from the muzzle
  const whiskerAngles = [-0.25, 0, 0.25];
  for (const sx of [-1, 1]) {
    whiskerAngles.forEach((a, k) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.002, 0.3, 5), whiskerMat);
      w.geometry.translate(0, -0.15, 0);
      w.position.set(sx * 0.1, -0.06 + a * 0.18, 0.28);
      w.rotation.z = sx * (Math.PI / 2 - 0.2);
      w.rotation.x = a * 0.5;
      head.add(w);
    });
  }

  // ── oversized pointed ears with tufts (the Kneazle signature) ──
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.18, 0.22, -0.02);
    ear.userData.rest = sx * 0.12;

    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 10), furMat);
    outer.geometry.translate(0, 0.2, 0);
    outer.castShadow = true;
    ear.add(outer);

    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 10), innerMat);
    inner.geometry.translate(0, 0.18, 0);
    inner.position.z = 0.03;
    ear.add(inner);

    // wispy ear-tip tuft (lynx-like)
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 6), tuftMat);
    tuft.geometry.translate(0, 0.08, 0);
    tuft.position.y = 0.4;
    tuft.castShadow = true;
    ear.add(tuft);

    ear.rotation.z = ear.userData.rest;
    c.parts.ears.push(ear);
    head.add(ear);
  }

  // ── four proper legs (all pushed into parts.legs so it walks) ──
  // [x, z, front?] — front legs forward, hind legs back
  const legPos = [
    [-0.22, 0.34], [0.22, 0.34],   // front
    [-0.24, -0.32], [0.24, -0.32], // hind
  ];
  legPos.forEach(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.46, z);
    const upper = limb(0.08, 0.07, 0.32, furMat);
    leg.add(upper);
    const lower = limb(0.06, 0.05, 0.18, furMat);
    lower.position.y = -0.3;
    leg.add(lower);
    const paw = blob(0.09, 0.06, 0.11, pawMat, 10);
    paw.position.set(0, -0.46, 0.04);
    leg.add(paw);
    c.parts.legs.push(leg);
    c.body.add(leg);
  });

  // ── plumed, lion-like tail with a dark tuft at the tip ──
  const tail = new THREE.Group();
  tail.position.set(0, 0.6, -0.5);
  tail.userData.rest = 0.4;

  const tailBase = limb(0.08, 0.05, 0.5, furMat);
  tailBase.rotation.x = 1.0;        // sweeps up and back
  tail.add(tailBase);

  // plume — soft fan along the latter half of the tail
  const plume = blob(0.1, 0.1, 0.22, tuftMat, 12);
  plume.position.set(0, 0.18, -0.4);
  tail.add(plume);

  // dark lion-tuft at the very tip
  const tipTuft = blob(0.11, 0.13, 0.13, spotMat, 12);
  tipTuft.position.set(0, 0.28, -0.5);
  tail.add(tipTuft);

  c.parts.tail = tail;
  c.body.add(tail);

  // ── species idle: ears swivel, slow tail-lash, kneading + purr when bonded ──
  let lashTimer = 5 + c.rng() * 5;
  let lash = 0;          // 0..1 active tail-lash
  let kneadTimer = 6 + c.rng() * 6;
  c.onIdle = (t, dt, env) => {
    const m = c.mood();
    const happy = m > 0.6 || c.bond > 40;

    // ears swivel independently, alert and twitchy (on top of base ear-flop)
    c.parts.ears.forEach((ear, i) => {
      const swivel = Math.sin(t * 1.7 + i * 2.1) * 0.14 + Math.sin(t * 5.3 + i) * 0.04;
      ear.rotation.y = swivel;
    });

    // occasional slow, deliberate tail-lash in idle
    if (c.state === 'idle') {
      lashTimer -= dt;
      if (lashTimer <= 0 && lash <= 0) { lash = 1; lashTimer = 6 + c.rng() * 7; }
    }
    if (lash > 0) {
      lash = Math.max(0, lash - dt * 0.8);
      const k = Math.sin((1 - lash) * Math.PI);     // ease in/out of the lash
      tail.rotation.y = Math.sin(t * 4) * 0.5 * k;
      tail.rotation.z = Math.sin(t * 4 + 1) * 0.18 * k;
    }

    // contented kneading + purr-squash when bonded/happy and resting
    if (happy && c.state === 'idle') {
      kneadTimer -= dt;
      if (kneadTimer <= 0) { c.command('pet', 2.4); kneadTimer = 8 + c.rng() * 8; }
    }
    if (c.state === 'pet') {
      // alternating front-paw knead
      const kn = Math.sin(t * 6);
      if (c.parts.legs[0]) c.parts.legs[0].rotation.x = -0.3 + kn * 0.35;
      if (c.parts.legs[1]) c.parts.legs[1].rotation.x = -0.3 - kn * 0.35;
      // gentle purr squash through the body
      const purr = Math.sin(t * 24) * 0.012;
      c.body.scale.x = 1 + purr;
      c.body.scale.z = 1 + purr;
      // half-lidded blissful eyes
      c.parts.eyes.forEach(e => { e.scale.y = 0.4 * (e.userData.baseY || 0.78); });
    }

    // eyes catch the light faintly — amber gleam scales with mood
    c.parts.eyes.forEach(e => {
      const iris = e.children[1];
      if (iris) iris.material.emissiveIntensity = 0.18 + m * 0.3;
    });
  };

  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      // a pleased flick of the tail and an alert ear-prick
      lash = 1;
      c.parts.ears.forEach(ear => { ear.rotation.x = -0.2; });
    }
  };

  return c;
}
