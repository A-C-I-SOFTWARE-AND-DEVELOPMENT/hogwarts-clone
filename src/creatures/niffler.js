// ─────────────────────────────────────────────────────────────────────────────
//  niffler.js — REFERENCE creature. Velvety blue-black treasure hunter with a
//  duck-like bill, a bottomless belly-pouch and digging paws. Loves anything
//  shiny; "produces" coins when content. Use this as the pattern for new beasts.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU } from '../core/util.js';

export const meta = {
  id: 'niffler',
  name: 'Niffler',
  latin: 'Aurum fossor',
  rarity: 'common',
  blurb: 'A mischievous burrower with an insatiable love of anything that glitters. Tuck a coin in its paw and watch the joy.',
  size: 0.82,
  speed: 1.9,
  roam: 9,
  habitat: 'meadow',
  diet: ['gold_coin', 'shiny_gem', 'sweet_truffle'],
  favorite: 'gold_coin',
  produces: { item: 'coins', amount: 14, every: 70 }, // passive trickle while content
  unlockCost: 0,
  palette: { fur: 0x2b3450, furTip: 0x46587f, bill: 0x1a1712, paw: 0x14110d, spark: 0xffd86a },
  care: { feed: 'Coins, gems & truffles', play: 'Hide-and-seek with shinies', note: 'Empty its pouch daily or it hoards!' },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;
  const fur = furTexture(128, P.fur, P.furTip, 0.6);
  const furMat = creatureMat(P.fur, { rough: 0.62, map: fur });
  const bellyMat = creatureMat(0x3a4a72, { rough: 0.55 });
  const billMat = creatureMat(P.bill, { rough: 0.4, metal: 0.1 });
  const pawMat = creatureMat(P.paw, { rough: 0.5 });

  // ── body: plump teardrop ──
  const torso = blob(0.62, 0.56, 0.78, furMat);
  torso.position.y = 0.52;
  c.add(torso);

  // soft pale belly patch
  const belly = blob(0.5, 0.42, 0.5, bellyMat);
  belly.position.set(0, 0.42, 0.4);
  belly.scale.z = 0.4;
  c.add(belly);

  // treasure pouch (rounded under-belly) — subtle gold shimmer when full
  const pouchMat = creatureMat(0x241a10, { rough: 0.6, emissive: 0x3a2606, emissiveIntensity: 0.15 });
  const pouch = blob(0.46, 0.34, 0.4, pouchMat);
  pouch.position.set(0, 0.26, 0.46);
  c.pouch = pouch; c.add(pouch);

  // ── head ──
  const head = new THREE.Group();
  head.position.set(0, 0.92, 0.5);
  c.parts.head = head; c.body.add(head);

  const skull = blob(0.4, 0.38, 0.42, furMat);
  head.add(skull);

  // duck-like bill (flattened wedge) + animatable lower jaw
  const billTop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.46), billMat);
  billTop.position.set(0, -0.02, 0.42); billTop.scale.set(1, 1, 1);
  head.add(billTop);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), billMat);
  jaw.geometry.translate(0, 0, 0.2);
  jaw.position.set(0, -0.12, 0.24);
  c.parts.jaw = jaw; head.add(jaw);
  // nostrils
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), creatureMat(0x000000, { rough: 0.3 }));
    n.position.set(sx * 0.08, 0.02, 0.62); head.add(n);
  }

  // big dark glossy eyes
  for (const sx of [-1, 1]) {
    const e = eyeball(0.16, 0x141a2c, true);
    e.position.set(sx * 0.24, 0.1, 0.28);
    e.rotation.y = sx * 0.3;
    c.registerEye(e); head.add(e);
  }

  // tiny round ears
  for (const sx of [-1, 1]) {
    const ear = blob(0.12, 0.13, 0.06, furMat);
    ear.position.set(sx * 0.3, 0.34, 0.04);
    ear.userData.rest = sx * 0.2;
    c.parts.ears.push(ear); head.add(ear);
  }

  // ── digging paws (front) with little claws ──
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.42, 0.5, 0.34);
    const upper = limb(0.12, 0.1, 0.34, furMat); upper.rotation.x = 0.5;
    arm.add(upper);
    const paw = blob(0.16, 0.12, 0.2, pawMat);
    paw.position.set(0, -0.32, 0.12); arm.add(paw);
    for (let k = -1; k <= 1; k++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), creatureMat(0xcfc6b0, { rough: 0.3 }));
      claw.position.set(k * 0.06, -0.4, 0.26); claw.rotation.x = Math.PI / 2.2; arm.add(claw);
    }
    c.parts.legs.push(arm); c.body.add(arm);
  }
  // hind feet
  for (const sx of [-1, 1]) {
    const foot = blob(0.18, 0.1, 0.24, pawMat);
    foot.position.set(sx * 0.34, 0.12, -0.2);
    c.body.add(foot);
  }

  // ── flat beaver-ish tail ──
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.5), furMat);
  tail.geometry.translate(0, 0, -0.25);
  tail.position.set(0, 0.4, -0.66);
  tail.userData.rest = -0.2;
  c.parts.tail = tail; c.body.add(tail);

  // ── species idle: snuffles at the ground hunting for treasure ──
  let digTimer = 4 + c.rng() * 4;
  c.onIdle = (t, dt, env) => {
    // belly/pouch shimmers brighter the happier (fuller of treasure) it is
    const m = c.mood();
    pouch.material.emissiveIntensity = 0.1 + m * 0.5;
    pouch.scale.setScalar(1 + m * 0.12 + Math.sin(t * 2) * 0.01);

    // occasional snuffle dig in idle
    if (c.state === 'idle') {
      digTimer -= dt;
      if (digTimer <= 0) { c.command('dig', 1.6); digTimer = 6 + c.rng() * 6; }
    }
    if (c.state === 'dig') {
      const d = Math.abs(Math.sin(t * 11));
      head.rotation.x = 0.5 + d * 0.25;
      c.body.position.y = -d * 0.05;
      c.parts.legs.forEach((l, i) => l.rotation.x = 0.5 + Math.sin(t * 16 + i) * 0.4);
      if (c.stateT > c.stateDur && c.rng() < 0.5) c.react('sparkle');
    }
  };

  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      // delighted little spin
      c.heading += 0.6;
    }
  };

  return c;
}
