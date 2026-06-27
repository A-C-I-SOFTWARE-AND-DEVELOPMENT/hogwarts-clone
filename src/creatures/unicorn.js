// ─────────────────────────────────────────────────────────────────────────────
//  unicorn.js — UNICORN FOAL. A slender, radiant horse foal of pure gold (foals
//  are born gold and silver with age). Fine legs, an arched neck, a small
//  spiralled brow-horn, large kind blue eyes, and a flowing shimmering mane and
//  tail. Glows warmly and scatters gentle sparkles when loved. LEGENDARY.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU, clamp, lerp } from '../core/util.js';

export const meta = {
  id: 'unicorn',
  archetype: 'equine',
  name: 'Unicorn Foal',
  latin: 'Equus monoceros infans',
  rarity: 'legendary',
  blurb: 'A young unicorn, pure shimmering gold — for foals are born gold and only silver with age. It trusts only the pure of heart, and grows radiant when truly loved.',
  size: 1.0,
  speed: 1.4,
  roam: 10,
  habitat: 'meadow',
  diet: ['leafy_greens', 'berries', 'honey_pot'],
  favorite: 'honey_pot',
  produces: { item: 'Unicorn hair', amount: 24, every: 120 },
  unlockCost: 1200,
  palette: {
    coat: 0xe8c66a, coatLight: 0xf6e6b0, mane: 0xfff4cf,
    horn: 0xfffaf0, hoof: 0xd8a86a, eye: 0x3a5bd0, spark: 0xfff2c0,
  },
  care: {
    feed: 'Sweet greens & honey',
    play: 'Walk gently beside it',
    note: 'Trusts only the pure of heart. Radiant when loved.',
  },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  // soft warm fur texture + faint golden self-glow on the coat
  const coatTex = furTexture(128, P.coat, P.coatLight, 0.4);
  const coatMat = creatureMat(P.coat, { rough: 0.5, map: coatTex, emissive: 0xb88c2a, emissiveIntensity: 0.05 });
  const coatLightMat = creatureMat(P.coatLight, { rough: 0.45, emissive: 0xcaa647, emissiveIntensity: 0.04 });
  const maneMat = creatureMat(P.mane, { rough: 0.35, metal: 0.05, emissive: 0xfff0c0, emissiveIntensity: 0.18 });
  const hornMat = creatureMat(P.horn, { rough: 0.2, metal: 0.25, emissive: 0xfff4d8, emissiveIntensity: 0.3 });
  const hoofMat = creatureMat(P.hoof, { rough: 0.35, metal: 0.2, emissive: 0x7a5526, emissiveIntensity: 0.12 });
  const muzzleMat = creatureMat(P.coatLight, { rough: 0.55 });

  // keep handles to all emissive bits so mood can brighten the glow
  const glowParts = [coatMat, coatLightMat, maneMat, hornMat];

  // ── slender barrel body, slightly tucked at the flank ──
  const torso = blob(0.4, 0.42, 0.66, coatMat);
  torso.position.set(0, 0.74, -0.04);
  c.add(torso);
  // chest swells forward
  const chest = blob(0.36, 0.38, 0.34, coatMat);
  chest.position.set(0, 0.78, 0.34);
  c.add(chest);
  // pale soft belly
  const belly = blob(0.34, 0.3, 0.5, coatLightMat);
  belly.position.set(0, 0.58, 0.02);
  belly.scale.z = 0.9;
  c.add(belly);
  // rounded haunch
  const haunch = blob(0.36, 0.4, 0.34, coatMat);
  haunch.position.set(0, 0.72, -0.4);
  c.add(haunch);

  // ── arched neck rising forward to the head ──
  const neck = limb(0.2, 0.15, 0.62, coatMat, 12);
  neck.position.set(0, 0.92, 0.5);
  neck.rotation.x = -0.85;
  c.add(neck);
  // soft fill at the crest of the neck
  const crest = blob(0.16, 0.26, 0.2, coatMat);
  crest.position.set(0, 1.22, 0.66);
  c.add(crest);

  // ── head: gentle tapered muzzle ──
  const head = new THREE.Group();
  head.position.set(0, 1.34, 0.82);
  head.userData.rest = 0.12; // tipped slightly down — gentle gaze
  c.parts.head = head; c.body.add(head);

  const skull = blob(0.2, 0.22, 0.26, coatMat, 18);
  skull.position.set(0, 0.04, 0);
  head.add(skull);
  // long delicate muzzle
  const muzzle = blob(0.15, 0.15, 0.26, coatMat, 16);
  muzzle.position.set(0, -0.08, 0.26);
  muzzle.scale.set(0.92, 0.92, 1);
  head.add(muzzle);
  // soft pale nose tip + animatable jaw
  const noseTip = blob(0.13, 0.12, 0.12, muzzleMat, 14);
  noseTip.position.set(0, -0.1, 0.44);
  head.add(noseTip);
  for (const sx of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), creatureMat(0x3a2a1c, { rough: 0.5 }));
    nostril.position.set(sx * 0.06, -0.12, 0.52); head.add(nostril);
  }
  const jaw = blob(0.12, 0.07, 0.2, muzzleMat, 12);
  jaw.geometry.translate(0, 0, 0.12);
  jaw.position.set(0, -0.16, 0.2);
  c.parts.jaw = jaw; head.add(jaw);

  // ── large kind blue eyes ──
  for (const sx of [-1, 1]) {
    const e = eyeball(0.13, P.eye, true);
    e.position.set(sx * 0.17, 0.06, 0.14);
    e.rotation.y = sx * 0.5;
    c.registerEye(e); head.add(e);
    // long delicate lash line above the eye
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 14, Math.PI), maneMat);
    lash.position.set(sx * 0.17, 0.16, 0.14);
    lash.rotation.set(-0.4, sx * 0.5, 0);
    head.add(lash);
  }

  // ── ears: small, pricked, alert ──
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), coatLightMat);
    ear.geometry.translate(0, 0.11, 0);
    ear.position.set(sx * 0.15, 0.22, -0.02);
    ear.rotation.z = sx * -0.25;
    ear.rotation.x = -0.15;
    ear.userData.rest = sx * -0.25;
    ear.castShadow = true;
    c.parts.ears.push(ear); head.add(ear);
  }

  // ── the horn: a slim spiralled cone on the brow ──
  const horn = new THREE.Group();
  horn.position.set(0, 0.24, 0.18);
  horn.rotation.x = -0.32;
  const hornCone = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 10), hornMat);
  hornCone.geometry.translate(0, 0.21, 0);
  hornCone.castShadow = true;
  horn.add(hornCone);
  // approximate the spiral with a few thin torus rings climbing the cone
  for (let i = 0; i < 4; i++) {
    const f = i / 4;
    const r = lerp(0.055, 0.018, f);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 14), hornMat);
    ring.position.y = lerp(0.04, 0.36, f);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = f * 0.9; // gentle twist
    horn.add(ring);
  }
  head.add(horn);
  c.horn = horn;

  // ── mane: soft shimmering strands down the neck & forelock ──
  const maneStrands = [];
  function makeStrand(len, w) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(w, len, 6), maneMat);
    s.geometry.translate(0, -len / 2, 0); // hangs from its top
    s.castShadow = true;
    return s;
  }
  // forelock between the ears, draping over the brow
  for (let i = -1; i <= 1; i++) {
    const fl = makeStrand(0.3, 0.05);
    fl.position.set(i * 0.07, 0.34, 0.12);
    fl.rotation.x = 0.5;
    fl.userData.phase = i * 0.7;
    fl.userData.amp = 0.18;
    head.add(fl);
    maneStrands.push(fl);
  }
  // crest mane running down the arched neck
  const maneRow = 6;
  for (let i = 0; i < maneRow; i++) {
    const f = i / (maneRow - 1);
    const len = lerp(0.34, 0.5, Math.sin(f * Math.PI) * 0.5 + 0.5);
    const st = makeStrand(len, 0.055);
    // place along the neck from crest down toward the withers
    st.position.set(lerp(0, 0, f), lerp(1.34, 0.96, f), lerp(0.74, 0.18, f));
    st.rotation.x = lerp(-1.0, 0.2, f);
    st.userData.phase = f * 3.0;
    st.userData.amp = lerp(0.1, 0.26, f);
    c.body.add(st);
    maneStrands.push(st);
  }

  // ── four fine legs with rose-gold hooves ──
  // [frontL, frontR, hindL, hindR]
  const legPos = [[-0.22, 0.42], [0.22, 0.42], [-0.24, -0.42], [0.24, -0.42]];
  legPos.forEach(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.62, z);
    const thigh = limb(0.09, 0.06, 0.42, coatMat, 8);
    leg.add(thigh);
    const shin = limb(0.05, 0.04, 0.24, coatLightMat, 8);
    shin.position.y = -0.42;
    leg.add(shin);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 10), hoofMat);
    hoof.position.y = -0.7;
    hoof.castShadow = true;
    leg.add(hoof);
    c.parts.legs.push(leg); c.body.add(leg);
  });

  // ── flowing tail of shimmering strands ──
  const tail = new THREE.Group();
  tail.position.set(0, 0.66, -0.66);
  tail.userData.rest = -0.3;
  const tailStrands = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 4 - 0.5);
    const len = lerp(0.5, 0.66, 1 - Math.abs(a) * 1.4);
    const st = makeStrand(len, 0.06);
    st.position.set(a * 0.12, 0, 0);
    st.rotation.x = 0.5;
    st.userData.phase = i * 0.8;
    st.userData.amp = 0.2 + Math.abs(a) * 0.12;
    tail.add(st);
    tailStrands.push(st);
  }
  c.parts.tail = tail; c.body.add(tail);

  // ── soft warm point-light "aura" that brightens with mood ──
  const aura = new THREE.PointLight(0xffe9a8, 0.0, 4.2, 2);
  aura.position.set(0, 0.95, 0.1);
  c.body.add(aura);

  // ── graceful species idle ──
  let pawTimer = 5 + c.rng() * 6;
  let sparkleTimer = 6 + c.rng() * 6;
  c.onIdle = (t, dt, env) => {
    const m = c.mood();

    // radiant glow rises with mood; gentle breathing pulse
    const pulse = 0.5 + Math.sin(t * 1.4) * 0.5;
    const glow = 0.05 + m * 0.16;
    glowParts.forEach(mat => { mat.emissiveIntensity = glow * (0.85 + pulse * 0.3); });
    hornMat.emissiveIntensity = 0.22 + m * 0.3 + pulse * 0.1; // horn shines brightest
    aura.intensity = lerp(aura.intensity, 0.3 + m * 1.1, clamp(dt * 3));

    // soft head dips, as if grazing the air / nuzzling
    if (c.state === 'idle' || c.state === 'walk') {
      head.rotation.x += Math.sin(t * 0.8 + 0.5) * 0.05;
    }

    // mane & tail sway softly, more when moving or playful
    const energy = (c.state === 'walk' ? 1.4 : 1) * (c.state === 'play' ? 1.8 : 1);
    maneStrands.forEach(st => {
      const ph = st.userData.phase || 0, amp = (st.userData.amp || 0.2) * energy;
      st.rotation.z = Math.sin(t * 2.2 + ph) * amp;
      st.rotation.y = Math.cos(t * 1.7 + ph) * amp * 0.5;
    });
    tailStrands.forEach(st => {
      const ph = st.userData.phase || 0, amp = (st.userData.amp || 0.2) * energy;
      st.rotation.z = Math.sin(t * 2.0 + ph) * amp;
      st.rotation.x = 0.5 + Math.sin(t * 1.6 + ph) * 0.12;
    });

    // occasionally paws the ground and tosses its head (only when content & idle)
    if (c.state === 'idle') {
      pawTimer -= dt;
      if (pawTimer <= 0) { c.command('paw', 1.8); pawTimer = 7 + c.rng() * 7; }
    }
    if (c.state === 'paw') {
      const k = Math.abs(Math.sin(t * 7));
      // front-left leg scrapes the ground
      if (c.parts.legs[0]) c.parts.legs[0].rotation.x = Math.sin(t * 9) * 0.5 - 0.1;
      // proud head toss at the peak
      head.rotation.x = 0.12 - k * 0.45;
      c.body.position.y += k * 0.03;
    }

    // emits gentle sparkles now and then when happy
    if (m > 0.6) {
      sparkleTimer -= dt;
      if (sparkleTimer <= 0) { c.react('sparkle'); sparkleTimer = 5 + c.rng() * 7; }
    } else {
      sparkleTimer = Math.max(sparkleTimer, 3);
    }
  };

  c.onReact = (kind) => {
    if (kind === 'sparkle') {
      // a brief radiant flare from the horn
      hornMat.emissiveIntensity = 1.4;
    }
    if (kind === 'happy' || kind === 'love') {
      // a graceful little head toss and extra sparkle
      c.react('sparkle');
      c.heading += 0.4;
    }
  };

  return c;
}
