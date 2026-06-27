// ─────────────────────────────────────────────────────────────────────────────
//  thestral.js — a gaunt, skeletal black winged horse, visible only to those
//  who have seen death. Ribbed near-black hide stretched over suggested bone,
//  a dragon-skull head with blank GLOWING white eyes, leathery bat-like wings
//  and four spindly legs. Eerie but gentle; glides with unsettling grace.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, TAU } from '../core/util.js';

export const meta = {
  id: 'thestral',
  archetype: 'equine',
  name: 'Thestral',
  latin: 'Equus mortis',
  rarity: 'rare',
  blurb: 'A skeletal, leather-winged horse seen only by those who have witnessed death. Frightening to behold, yet uncommonly gentle and loyal once it trusts you.',
  size: 1.3,
  speed: 1.5,
  roam: 10,
  habitat: 'forest',
  diet: ['raw_meat', 'fresh_fish'],
  favorite: 'raw_meat',
  produces: { item: 'Thestral tail-hair', amount: 18, every: 105 },
  unlockCost: 480,
  palette: {
    hide: 0x14151c, bone: 0x2a2c38, membrane: 0x20222e,
    eye: 0xe8eef0, spark: 0x6f7a9c,
  },
  care: {
    feed: 'Raw meat — it smells blood',
    play: 'Sit quietly; it senses calm',
    note: 'Gentle, despite the frightening look.',
  },
  nocturnal: true,
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  // Dark, faintly translucent materials — the beast half-fades into the gloom.
  const hideMat = creatureMat(P.hide, { rough: 0.62, metal: 0.04, emissive: 0x05060a, emissiveIntensity: 0.12 });
  hideMat.transparent = true; hideMat.opacity = 0.92;
  const boneMat = creatureMat(P.bone, { rough: 0.5, metal: 0.06, emissive: 0x080a12, emissiveIntensity: 0.1 });
  boneMat.transparent = true; boneMat.opacity = 0.92;
  const membraneMat = creatureMat(P.membrane, { rough: 0.7, metal: 0, emissive: 0x06070c, emissiveIntensity: 0.08 });
  membraneMat.transparent = true; membraneMat.opacity = 0.82; membraneMat.side = THREE.DoubleSide;
  // Blank milky-white eye with strong emissive glow.
  const eyeGlowMat = new THREE.MeshStandardMaterial({
    color: P.eye, roughness: 0.3, emissive: P.eye, emissiveIntensity: 0.9,
  });

  // ── gaunt torso: a thin, slightly sunken barrel ──
  const torso = blob(0.46, 0.42, 0.78, hideMat, 20);
  torso.position.y = 0.92;
  c.add(torso);
  // hollow flank shadow (pulls the belly in to look starved)
  const flank = blob(0.36, 0.3, 0.6, hideMat, 16);
  flank.position.set(0, 0.82, 0.02); flank.scale.x = 0.86;
  c.add(flank);

  // ── ribs: ridged half-hoops along the barrel suggest a skeletal cage ──
  for (let i = 0; i < 5; i++) {
    const z = 0.42 - i * 0.22;
    const taper = 1 - Math.abs(i - 2) * 0.1;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.42 * taper, 0.035, 6, 16, Math.PI * 1.1), boneMat);
    rib.position.set(0, 0.92, z);
    rib.rotation.z = Math.PI; // open side down, arched over the back
    rib.rotation.y = Math.PI / 2;
    c.parts.extra.push(rib); c.body.add(rib);
  }
  // spine ridge running the back
  for (let i = 0; i < 6; i++) {
    const vert = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), boneMat);
    vert.position.set(0, 1.32 - Math.abs(i - 2.5) * 0.01, 0.48 - i * 0.2);
    c.body.add(vert);
  }
  // jutting hip and shoulder bones
  for (const sz of [0.5, -0.46]) {
    for (const sx of [-1, 1]) {
      const bone = blob(0.1, 0.14, 0.1, boneMat, 10);
      bone.position.set(sx * 0.4, 1.18, sz);
      c.body.add(bone);
    }
  }

  // ── long arched neck (thin, sinewy) ──
  const neck = new THREE.Group();
  neck.position.set(0, 1.18, 0.62);
  c.body.add(neck);
  const neckLow = limb(0.18, 0.13, 0.62, hideMat, 10);
  neckLow.rotation.x = -0.95; neck.add(neckLow);
  const neckUp = limb(0.13, 0.1, 0.46, hideMat, 10);
  neckUp.position.set(0, 0.5, 0.32); neckUp.rotation.x = -0.35; neck.add(neckUp);
  // neck vertebrae ridge
  for (let i = 0; i < 5; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), boneMat);
    v.position.set(0, 0.12 + i * 0.12, 0.04 + i * 0.085); neck.add(v);
  }

  // ── head: long dragon/skull-like wedge, no flesh to spare ──
  const head = new THREE.Group();
  head.position.set(0, 1.86, 1.0);
  head.userData.rest = -0.1;
  c.parts.head = head; c.body.add(head);

  const skull = blob(0.18, 0.2, 0.26, hideMat, 16);
  skull.position.z = 0.02; head.add(skull);
  // elongated muzzle tapering to the nostrils
  const muzzle = limb(0.14, 0.07, 0.4, hideMat, 10);
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, -0.02, 0.18); head.add(muzzle);
  // bony brow ridges over the eyes
  for (const sx of [-1, 1]) {
    const brow = blob(0.1, 0.05, 0.12, boneMat, 8);
    brow.position.set(sx * 0.14, 0.12, 0.06); head.add(brow);
  }
  // animatable lower jaw
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.34), hideMat);
  jaw.geometry.translate(0, 0, 0.17);
  jaw.position.set(0, -0.1, 0.06);
  c.parts.jaw = jaw; head.add(jaw);
  // nostril slits
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), creatureMat(0x000000, { rough: 0.3 }));
    n.position.set(sx * 0.05, 0.0, 0.55); head.add(n);
  }

  // ── blank GLOWING white eyes (no iris/pupil — a milky void) ──
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), eyeGlowMat);
    eye.position.set(sx * 0.16, 0.08, 0.12);
    eye.userData.baseY = 1;
    eyes.push(eye);
    c.registerEye(eye); head.add(eye);
  }

  // ── twin swept-back horns / skull crests ──
  for (const sx of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.3, 8), boneMat);
    horn.position.set(sx * 0.12, 0.22, -0.1);
    horn.rotation.set(-0.7, 0, sx * 0.25);
    head.add(horn);
  }
  // ears (thin, flicking) registered for the rig's ear-flop
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), hideMat);
    ear.position.set(sx * 0.16, 0.24, -0.02);
    ear.rotation.set(-0.2, 0, sx * 0.5);
    ear.userData.rest = sx * 0.5;
    c.parts.ears.push(ear); head.add(ear);
  }

  // ── leathery bat-like wings: membrane stretched between bone struts ──
  const wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.4, 1.28, 0.16);
    wing.userData.side = sx;
    wing.userData.rest = sx * 0.15;
    c.body.add(wing);

    // primary arm bone out from the shoulder
    const armBone = limb(0.05, 0.035, 0.7, boneMat, 8);
    armBone.rotation.z = sx * Math.PI / 2.1;
    armBone.rotation.x = -0.15;
    wing.add(armBone);

    // three finger struts fanning from the wrist
    const wrist = new THREE.Group();
    wrist.position.set(sx * 0.66, 0.12, -0.04);
    wing.add(wrist);
    const fingerAngles = [0.55, 0.15, -0.35];
    const fingerLen = [0.78, 0.92, 0.7];
    const tips = [];
    fingerAngles.forEach((a, i) => {
      const strut = limb(0.03, 0.015, fingerLen[i], boneMat, 6);
      strut.rotation.z = sx * (Math.PI / 2 - 0.2);
      strut.rotation.x = a;
      wrist.add(strut);
      // record approximate strut tip in wing-local space for the membrane fan
      const len = fingerLen[i];
      tips.push(new THREE.Vector3(
        sx * (0.66 + Math.cos(a) * len * 0.92),
        0.12 + Math.sin(a) * len,
        -0.04 - Math.sin(a) * 0.05,
      ));
    });

    // membrane: dark semi-transparent panels webbing shoulder -> finger tips
    const shoulder = new THREE.Vector3(0, 0.02, 0.02);
    const elbow = new THREE.Vector3(sx * 0.33, 0.06, -0.02);
    const fan = [shoulder, ...tips, new THREE.Vector3(sx * 0.5, -0.18, -0.04)];
    const pts = [shoulder, elbow, ...fan];
    // build a simple triangle fan from the shoulder across the finger tips
    const verts = [];
    const anchor = shoulder;
    const rim = [elbow, ...tips, new THREE.Vector3(sx * 0.5, -0.16, -0.04)];
    for (let i = 0; i < rim.length - 1; i++) {
      const a0 = sx > 0 ? rim[i] : rim[i + 1];
      const a1 = sx > 0 ? rim[i + 1] : rim[i];
      verts.push(anchor.x, anchor.y, anchor.z);
      verts.push(a0.x, a0.y, a0.z);
      verts.push(a1.x, a1.y, a1.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    const membrane = new THREE.Mesh(geo, membraneMat);
    membrane.castShadow = true;
    wing.add(membrane);

    wings.push(wing);
    c.parts.wings.push(wing);
  }

  // ── four spindly legs ending in cloven, bony feet ──
  const legPos = [[-0.32, 0.5], [0.32, 0.5], [-0.3, -0.42], [0.3, -0.42]];
  legPos.forEach(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.86, z);
    const thigh = limb(0.09, 0.06, 0.5, hideMat, 8);
    leg.add(thigh);
    const shin = limb(0.055, 0.04, 0.42, hideMat, 8);
    shin.position.set(0, -0.5, 0.02); shin.rotation.x = 0.12; leg.add(shin);
    // knee/hock joint bump
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), boneMat);
    knee.position.set(0, -0.5, 0.01); leg.add(knee);
    // small cloven hoof
    const hoof = blob(0.07, 0.06, 0.11, boneMat, 8);
    hoof.position.set(0, -0.92, 0.04); leg.add(hoof);
    c.parts.legs.push(leg); c.body.add(leg);
  });

  // ── thin, sparsely tufted tail ──
  const tail = new THREE.Group();
  tail.position.set(0, 1.04, -0.74);
  tail.userData.rest = 0.35;
  c.parts.tail = tail; c.body.add(tail);
  const tailBone = limb(0.06, 0.02, 0.62, hideMat, 8);
  tailBone.rotation.x = Math.PI / 2.1; tail.add(tailBone);
  // wispy tuft of tail-hair at the tip
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const strand = limb(0.012, 0.004, 0.22, boneMat, 5);
    strand.position.set(Math.cos(a) * 0.03, -0.02, -0.58);
    strand.rotation.set(Math.PI / 2 + 0.3, 0, a);
    tail.add(strand);
  }

  // ── species idle: slow ghostly sway, wings rustle, eyes pulse ──
  c.onIdle = (t, dt, env) => {
    const night = env.night ? 1 : 0;
    const calm = c.mood();

    // eerie pulsing glow in the blank eyes (brighter at night and when trusting)
    const pulse = 0.7 + Math.sin(t * 1.4) * 0.25 + night * 0.4 + calm * 0.25;
    eyeGlowMat.emissiveIntensity = pulse;
    // the hide itself fades a touch in daylight — ghostlier
    hideMat.opacity = 0.92 - (1 - night) * 0.06;
    membraneMat.opacity = 0.82 - (1 - night) * 0.06;

    // slow ghostly vertical drift, as if gliding rather than standing
    const drift = Math.sin(t * 0.8 + c.bobPhase) * 0.04;
    c.body.position.y += drift * c.scaleMul;
    // gentle sway of the whole frame
    c.body.rotation.z += Math.sin(t * 0.7) * 0.02;

    // wings: settle folded, shifting and rustling now and then
    const flapState = (c.state === 'play' || c.state === 'happy');
    c.parts.wings.forEach((wing, i) => {
      const sx = wing.userData.side;
      const rest = wing.userData.rest;
      if (flapState) {
        // slow powerful flaps when excited
        const f = Math.sin(t * 4 + i) * 0.6;
        wing.rotation.z = rest + sx * (0.5 + f);
        wing.rotation.x = -0.1 + Math.sin(t * 4) * 0.15;
      } else {
        // furled, with a faint leathery rustle
        const rustle = Math.sin(t * 1.6 + i * 1.3) * 0.06 + Math.sin(t * 0.5) * 0.04;
        wing.rotation.z = rest + sx * (0.12 + rustle);
        wing.rotation.x = -0.05 + rustle * 0.4;
      }
    });

    // neck dips and rises slowly, a watchful glance
    neck.rotation.x = Math.sin(t * 0.6) * 0.07;
  };

  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      // a single slow wing-mantle and quiet approach
      c.command('play', 4);
    }
  };

  return c;
}
