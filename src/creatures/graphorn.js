// ─────────────────────────────────────────────────────────────────────────────
//  graphorn.js — the last of a proud, near-extinct line. A huge, hump-backed
//  grey mountain beast: massive low-slung quadruped with a pronounced muscular
//  shoulder hump, a broad armoured head bearing two long forward-curving bone
//  horns, a wide tentacled lower lip, four sturdy four-toed legs and a row of
//  bony plates down the spine. Slow but fierce; fiercely loyal once tamed.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU } from '../core/util.js';

export const meta = {
  id: 'graphorn',
  archetype: 'beast',
  name: 'Graphorn',
  latin: 'Cornu montanus',
  rarity: 'legendary',
  blurb: 'A hump-backed grey giant of the high crags, hide tough as slate and two great horns curving forward like battering rams. Slow to trust, but once it bows its head to you, it is loyal unto the end.',
  size: 1.7,
  speed: 0.8,
  roam: 6,
  habitat: 'mountain',
  diet: ['raw_meat', 'leafy_greens', 'fresh_fish'],
  favorite: 'raw_meat',
  produces: { item: 'Graphorn dust', amount: 20, every: 110 },
  unlockCost: 600,
  palette: { hide: 0x6a6b72, hideDark: 0x4a4b52, horn: 0xd8d2bc, eye: 0x2a1f14, spark: 0xcdb88a },
  care: { feed: 'Plenty of meat', play: 'Earn its respect, then its love', note: 'The last of a proud, near-extinct line.' },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  // Rough rocky hide — low fur density gives a mottled stony look, not soft fluff.
  const hideTex = furTexture(128, P.hide, P.hideDark, 0.28);
  const hideMat = creatureMat(P.hide, { rough: 0.92, map: hideTex });
  const hideDarkMat = creatureMat(P.hideDark, { rough: 0.95 });
  const plateMat = creatureMat(P.hideDark, { rough: 0.85, metal: 0.04 });
  const hornMat = creatureMat(P.horn, { rough: 0.55, metal: 0.06 });
  const lipMat = creatureMat(0x55454a, { rough: 0.7 });
  const clawMat = creatureMat(0x2f2a24, { rough: 0.5 });

  // ── massive low-slung torso, broad and barrel-chested ──
  const torso = blob(0.86, 0.66, 1.12, hideMat);
  torso.position.y = 0.78;
  c.add(torso);

  // pronounced muscular shoulder HUMP rising over the front legs
  const hump = blob(0.66, 0.62, 0.62, hideMat);
  hump.position.set(0, 1.16, 0.42);
  hump.scale.y = 1.18;
  c.add(hump);

  // heavy haunches at the rear
  const rump = blob(0.7, 0.58, 0.6, hideMat);
  rump.position.set(0, 0.74, -0.78);
  c.add(rump);

  // pale-grey under-belly
  const belly = blob(0.7, 0.4, 0.92, hideDarkMat);
  belly.position.set(0, 0.5, -0.04);
  belly.scale.z = 0.9;
  c.add(belly);

  // ── row of bony spine plates (low cones, tallest over the hump) ──
  const plateZ = [0.6, 0.32, 0.04, -0.26, -0.56, -0.86];
  plateZ.forEach((z, i) => {
    const k = 1 - Math.abs(i - 1) / 5;            // peak near the hump
    const h = 0.16 + k * 0.26;
    const plate = new THREE.Mesh(new THREE.ConeGeometry(0.13 + k * 0.06, h, 6), plateMat);
    plate.castShadow = true;
    const arc = Math.sin((i / (plateZ.length - 1)) * Math.PI);
    plate.position.set(0, 1.28 + arc * 0.18 - i * 0.02, z);
    plate.rotation.x = -0.25;
    c.add(plate);
    // small flanking ridge bumps
    for (const sx of [-1, 1]) {
      const bump = new THREE.Mesh(new THREE.ConeGeometry(0.07, h * 0.5, 5), plateMat);
      bump.castShadow = true;
      bump.position.set(sx * 0.18, 1.2 + arc * 0.14 - i * 0.02, z);
      bump.rotation.x = -0.2;
      c.add(bump);
    }
  });

  // ── thick neck dropping forward to the lowered head ──
  const neck = limb(0.42, 0.5, 0.6, hideMat, 12);
  neck.position.set(0, 1.04, 0.92);
  neck.rotation.x = 1.35;
  c.add(neck);

  // ── broad armoured head, carried low and forward ──
  const head = new THREE.Group();
  head.position.set(0, 0.78, 1.28);
  head.userData.rest = 0.12;
  c.parts.head = head; c.body.add(head);

  const skull = blob(0.46, 0.42, 0.52, hideMat, 18);
  head.add(skull);

  // bony brow ridge / armoured forehead plate
  const brow = blob(0.44, 0.18, 0.3, plateMat, 14);
  brow.position.set(0, 0.24, 0.18);
  head.add(brow);

  // broad muzzle
  const muzzle = blob(0.34, 0.3, 0.42, hideDarkMat, 14);
  muzzle.position.set(0, -0.08, 0.42);
  head.add(muzzle);

  // wide lipped / tentacled lower jaw
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.22, 0.3);
  c.parts.jaw = jaw; head.add(jaw);
  const jawBase = blob(0.34, 0.16, 0.36, lipMat, 14);
  jawBase.position.set(0, 0, 0.12);
  jaw.add(jawBase);
  // fleshy tentacle-feelers hanging from the lower lip
  for (let i = 0; i < 5; i++) {
    const sx = (i - 2) / 2;
    const tent = limb(0.045, 0.015, 0.2 + Math.abs(sx) * -0.04 + 0.06, lipMat, 6);
    tent.position.set(sx * 0.22, -0.04, 0.28 - Math.abs(sx) * 0.04);
    tent.rotation.x = 0.5;
    tent.userData.idx = i;
    jaw.add(tent);
    c.parts.extra.push(tent);
  }

  // nostrils
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), creatureMat(0x161213, { rough: 0.4 }));
    n.position.set(sx * 0.12, 0.0, 0.62); head.add(n);
  }

  // ── two long forward-curving bone horns ──
  for (const sx of [-1, 1]) {
    const horn = new THREE.Group();
    horn.position.set(sx * 0.24, 0.18, 0.34);
    // root
    const seg0 = limb(0.1, 0.085, 0.34, hornMat, 8);
    seg0.rotation.set(0.5, sx * 0.18, sx * 0.12);
    horn.add(seg0);
    // mid — curving forward
    const seg1 = limb(0.085, 0.06, 0.34, hornMat, 8);
    seg1.position.set(sx * 0.04, 0.28, 0.18);
    seg1.rotation.set(1.1, sx * 0.1, sx * 0.06);
    horn.add(seg1);
    // tip — sharp, pointing ahead
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 8), hornMat);
    tip.castShadow = true;
    tip.position.set(sx * 0.06, 0.42, 0.5);
    tip.rotation.set(1.5, 0, 0);
    horn.add(tip);
    head.add(horn);
  }

  // small deep-set dark eyes, tucked under the brow
  for (const sx of [-1, 1]) {
    const e = eyeball(0.1, P.eye, false);
    e.position.set(sx * 0.34, 0.06, 0.3);
    e.rotation.y = sx * 0.35;
    e.scale.setScalar(0.95);
    c.registerEye(e); head.add(e);
  }

  // small rounded ears set behind the horns
  for (const sx of [-1, 1]) {
    const ear = blob(0.1, 0.13, 0.05, hideDarkMat, 10);
    ear.position.set(sx * 0.4, 0.26, -0.12);
    ear.userData.rest = sx * 0.3;
    c.parts.ears.push(ear); head.add(ear);
  }

  // ── four thick, four-toed legs ──
  // [0]=front-left [1]=front-right [2]=back-left [3]=back-right
  const legPos = [[-0.56, 0.6], [0.56, 0.6], [-0.56, -0.78], [0.56, -0.78]];
  legPos.forEach(([x, z], li) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.78, z);
    const thigh = limb(0.26, 0.2, 0.5, hideMat, 10);
    leg.add(thigh);
    const shin = limb(0.2, 0.18, 0.34, hideDarkMat, 10);
    shin.position.set(0, -0.5, 0.02);
    leg.add(shin);
    // broad foot
    const foot = blob(0.26, 0.13, 0.3, hideDarkMat, 12);
    foot.position.set(0, -0.84, 0.06);
    leg.add(foot);
    // four sturdy toe-claws
    for (let k = 0; k < 4; k++) {
      const tx = (k - 1.5) * 0.13;
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), clawMat);
      claw.castShadow = true;
      claw.position.set(tx, -0.9, 0.26);
      claw.rotation.x = Math.PI / 2.1;
      leg.add(claw);
    }
    leg.userData.idx = li;
    c.parts.legs.push(leg); c.body.add(leg);
  });

  // ── short thick tail ──
  const tail = new THREE.Group();
  tail.position.set(0, 0.74, -1.28);
  tail.userData.rest = 0.1;
  c.parts.tail = tail; c.body.add(tail);
  const tailBase = limb(0.2, 0.12, 0.42, hideMat, 8);
  tailBase.rotation.x = 1.3;
  tail.add(tailBase);
  const tailTip = blob(0.13, 0.11, 0.16, hideDarkMat, 10);
  tailTip.position.set(0, -0.1, -0.34);
  tail.add(tailTip);

  // ── species idle: heavy breathing, low head sweeps, horn-tosses, pawing ──
  let pawTimer = 6 + c.rng() * 6;
  let snortTimer = 9 + c.rng() * 8;
  c.onIdle = (t, dt, env) => {
    // slow, large heaving breath through the whole chest
    const breath = Math.sin(t * 0.9) * 0.5 + 0.5;
    torso.scale.set(0.86 + breath * 0.03, 0.66 - breath * 0.012, 1.12 + breath * 0.02);
    hump.scale.y = 1.18 + breath * 0.04;

    // gentle tentacle-feeler sway under the jaw
    c.parts.extra.forEach((tn) => {
      tn.rotation.z = Math.sin(t * 1.6 + tn.userData.idx) * 0.12;
      tn.rotation.x = 0.5 + Math.sin(t * 1.3 + tn.userData.idx * 0.7) * 0.06;
    });

    if (c.state === 'idle') {
      // slow low head sweeps, scanning the ground
      head.rotation.y += Math.sin(t * 0.4) * 0.0015;

      // occasional pawing / scrape with a front leg
      pawTimer -= dt;
      if (pawTimer <= 0) { c.command('paw', 2.0); pawTimer = 8 + c.rng() * 8; }

      // occasional snort that kicks up dust (sparkle)
      snortTimer -= dt;
      if (snortTimer <= 0) {
        head.rotation.x = (head.userData.rest || 0) - 0.18;
        c.react('sparkle');
        snortTimer = 11 + c.rng() * 9;
      }
    }

    if (c.state === 'paw') {
      // front-left leg scrapes the ground, head tosses with the effort
      const s = Math.sin(t * 7);
      c.parts.legs[0].rotation.x = -0.2 + Math.max(0, s) * 0.7;
      head.rotation.x = (head.userData.rest || 0) + Math.abs(Math.sin(t * 3.5)) * 0.22;
      c.body.rotation.z = Math.sin(t * 3.5) * 0.03;
      if (c.stateT > c.stateDur && c.rng() < 0.6) c.react('sparkle');
    }
  };

  // ── reactions: a defiant horn-toss when pleased or challenged ──
  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      // proud horn toss: head rears up, then settles
      head.rotation.x = (head.userData.rest || 0) - 0.5;
      c.command('happy', 2.2);
    }
  };

  return c;
}
