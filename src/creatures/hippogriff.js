// ─────────────────────────────────────────────────────────────────────────────
//  hippogriff.js — EPIC half-eagle, half-horse. A proud beast: steel-grey
//  feathered eagle front (hooked beak, fierce orange eye, taloned forelegs)
//  flowing into equine hindquarters with hooved hind legs and a horse tail,
//  crowned by a pair of great folding wings. It warms only to those who bow.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU, lerp, clamp, damp } from '../core/util.js';

export const meta = {
  id: 'hippogriff',
  archetype: 'avian',
  name: 'Hippogriff',
  latin: 'Equus aquila',
  rarity: 'epic',
  blurb: 'An immensely proud beast — eagle before, horse behind — that suffers no insult and warms only to those who bow. Treat it with respect and it will carry you on the wind.',
  size: 1.5,
  speed: 1.5,
  roam: 11,
  habitat: 'meadow',
  diet: ['fresh_fish', 'raw_meat', 'beetle'],
  favorite: 'fresh_fish',
  produces: { item: 'Hippogriff feather', amount: 16, every: 100 },
  unlockCost: 520,
  palette: {
    feather: 0x8d96a3,      // steel-grey body feathers
    featherTip: 0xc2c8d2,   // pale feather tips
    beak: 0xb8a76a,         // gold-grey beak & talons
    eye: 0xe0a13c,          // fierce orange eye
    hide: 0x5a5048,         // horse hide
    spark: 0xc2c8d2,
  },
  care: {
    feed: 'Fresh dead ferrets... or fish',
    play: 'Bow, then fly together',
    note: 'Always bow first. Never insult it.',
  },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  const featherTex = furTexture(128, P.feather, P.featherTip, 0.7);
  const featherMat = creatureMat(P.feather, { rough: 0.6, map: featherTex });
  const featherPale = creatureMat(P.featherTip, { rough: 0.55 });
  const beakMat = creatureMat(P.beak, { rough: 0.42, metal: 0.12 });
  const talonMat = creatureMat(0x7d7152, { rough: 0.4, metal: 0.1 });
  const hideTex = furTexture(128, P.hide, 0x6e6256, 0.5);
  const hideMat = creatureMat(P.hide, { rough: 0.72, map: hideTex });
  const hideDark = creatureMat(0x453d36, { rough: 0.7 });
  const hoofMat = creatureMat(0x2a2520, { rough: 0.45 });

  // helper: an overlapping flattened feather plane (scale-like)
  const featherPlane = (w, h, mat) => {
    const g = new THREE.SphereGeometry(1, 8, 6);
    g.scale(w, h, 0.05);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    return m;
  };

  // ── EAGLE FRONT: powerful feathered chest, raised forward ──
  const chest = blob(0.6, 0.66, 0.6, featherMat);
  chest.position.set(0, 1.0, 0.46);
  c.add(chest);

  // HORSE HINDQUARTERS: broad equine rump, lower and back
  const rump = blob(0.66, 0.6, 0.74, hideMat);
  rump.position.set(0, 0.86, -0.5);
  c.add(rump);

  // mid-barrel joining the two halves (feather-to-hide blend)
  const barrel = blob(0.58, 0.56, 0.5, hideMat);
  barrel.position.set(0, 0.92, -0.02);
  c.add(barrel);

  // ── feathered neck, rising proud and forward ──
  const neck = new THREE.Group();
  neck.position.set(0, 1.32, 0.62);
  neck.rotation.x = -0.5;
  c.body.add(neck);
  const neckCore = limb(0.26, 0.2, 0.62, featherMat, 12);
  neckCore.rotation.x = Math.PI; // taper upward
  neck.add(neckCore);

  // layered overlapping feathers down the neck & chest
  for (let row = 0; row < 5; row++) {
    const ry = row / 4;
    const count = 5 - Math.floor(row / 2);
    for (let i = 0; i < count; i++) {
      const a = (i / (count - 1 || 1) - 0.5) * 1.5;
      const f = featherPlane(0.13, 0.2, row > 2 ? featherPale : featherMat);
      f.position.set(Math.sin(a) * 0.24, 0.18 + ry * 0.5, Math.cos(a) * 0.22 + 0.05);
      f.rotation.set(0.5, a, 0);
      neck.add(f);
    }
  }
  // a few chest feathers fanning over the breast
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - 0.5) * 1.7;
    const f = featherPlane(0.16, 0.26, i % 2 ? featherPale : featherMat);
    f.position.set(Math.sin(a) * 0.4, 0.88 + Math.cos(a * 0.6) * 0.06, 0.78);
    f.rotation.set(0.7, a * 0.6, a * 0.3);
    c.body.add(f);
  }

  // ── EAGLE HEAD ──
  const head = new THREE.Group();
  head.position.set(0, 1.86, 0.78);
  head.userData.rest = -0.15; // naturally held high & proud
  c.parts.head = head; c.body.add(head);

  const skull = blob(0.3, 0.3, 0.34, featherMat);
  head.add(skull);
  // smooth feathered crown
  const crown = blob(0.32, 0.26, 0.3, featherMat);
  crown.position.set(0, 0.1, -0.04);
  head.add(crown);
  // brow ridges (fierce look)
  for (const sx of [-1, 1]) {
    const brow = featherPlane(0.16, 0.07, featherMat);
    brow.position.set(sx * 0.18, 0.12, 0.16);
    brow.rotation.set(0.2, sx * 0.4, sx * 0.5);
    head.add(brow);
  }

  // hooked beak — upper (curved down to a hook) + lower jaw
  const beakUpper = new THREE.Group();
  beakUpper.position.set(0, -0.02, 0.24);
  head.add(beakUpper);
  const beakBase = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 10), beakMat);
  beakBase.geometry.rotateX(Math.PI / 2);
  beakBase.geometry.translate(0, 0, 0.17);
  beakBase.castShadow = true;
  beakUpper.add(beakBase);
  const hook = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), beakMat);
  hook.geometry.rotateX(Math.PI / 1.5);
  hook.position.set(0, -0.06, 0.32);
  hook.castShadow = true;
  beakUpper.add(hook);
  // nostril cere
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), creatureMat(0x141008));
    n.position.set(sx * 0.05, 0.03, 0.18);
    beakUpper.add(n);
  }
  // lower jaw (animatable for eating / calls)
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 10), beakMat);
  jaw.geometry.rotateX(Math.PI / 2);
  jaw.geometry.translate(0, 0, 0.14);
  jaw.position.set(0, -0.1, 0.22);
  jaw.castShadow = true;
  c.parts.jaw = jaw; head.add(jaw);

  // fierce orange eyes set forward, predatory
  for (const sx of [-1, 1]) {
    const e = eyeball(0.13, P.eye, false);
    e.position.set(sx * 0.2, 0.06, 0.18);
    e.rotation.y = sx * 0.35;
    c.registerEye(e); head.add(e);
  }

  // small feather ear-tufts (use ears slot so the rig flicks them)
  for (const sx of [-1, 1]) {
    const tuft = new THREE.Group();
    tuft.position.set(sx * 0.22, 0.22, 0.0);
    const t1 = featherPlane(0.05, 0.16, featherPale);
    t1.rotation.set(-0.3, 0, sx * 0.3);
    tuft.add(t1);
    tuft.userData.rest = sx * 0.25;
    c.parts.ears.push(tuft); head.add(tuft);
  }

  // ── GREAT FOLDING WINGS (default folded, spread when happy/playing) ──
  // Each wing is a group of layered flight feathers. Push the wing groups to
  // c.parts.wings; onIdle reads c.wingOpen (0 folded .. 1 spread).
  c.wingOpen = 0;
  const wings = [];
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.42, 1.18, -0.02);
    // shoulder coverts
    const shoulder = blob(0.18, 0.16, 0.24, featherMat);
    wing.add(shoulder);
    // the feather fan lives in a sub-group we pivot to fold/spread
    const fan = new THREE.Group();
    wing.add(fan);
    wing.userData.fan = fan;
    // long primary/secondary flight feathers
    const N = 7;
    for (let i = 0; i < N; i++) {
      const tf = i / (N - 1);
      const len = lerp(0.5, 0.95, tf);
      const f = featherPlane(0.09, len, i % 2 ? featherPale : featherMat);
      // along the wing, pivot from the shoulder
      f.position.set(0, -len, 0);
      f.geometry.translate(0, len, 0); // pivot at top so it fans from shoulder
      const fp = new THREE.Group();
      fp.add(f);
      fp.userData.spread = lerp(0.15, 1.15, tf); // outward spread angle when open
      fp.userData.fold = lerp(0.05, 0.5, tf);     // tucked angle when folded
      fan.add(fp);
    }
    wing.userData.sx = sx;
    c.body.add(wing);
    wings.push(wing);
    c.parts.wings.push(wing);
  }

  // ── FOUR LEGS — front: eagle taloned; hind: horse hooved (all to legs[]) ──
  // Front taloned legs (scaled, with three forward talons + dewclaw)
  const frontLegs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.36, 0.84, 0.5);
    const thigh = limb(0.13, 0.1, 0.42, featherMat); // feathered upper
    thigh.rotation.x = 0.15;
    leg.add(thigh);
    const shank = limb(0.07, 0.06, 0.42, talonMat); // scaled lower
    shank.position.set(0, -0.4, 0.05);
    leg.add(shank);
    // taloned foot
    const foot = new THREE.Group();
    foot.position.set(0, -0.8, 0.06);
    leg.add(foot);
    const pad = blob(0.1, 0.05, 0.12, talonMat);
    foot.add(pad);
    for (let k = -1; k <= 1; k++) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 6), beakMat);
      talon.position.set(k * 0.06, -0.03, 0.12);
      talon.rotation.x = Math.PI / 2.1;
      talon.castShadow = true;
      foot.add(talon);
    }
    const dew = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.12, 6), beakMat);
    dew.position.set(0, -0.02, -0.08);
    dew.rotation.x = -Math.PI / 2.4;
    foot.add(dew);
    c.parts.legs.push(leg); c.body.add(leg);
    frontLegs.push(leg);
  }
  // Hind horse legs with hocks + hooves
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.4, 0.82, -0.56);
    const thigh = limb(0.18, 0.13, 0.46, hideMat);
    leg.add(thigh);
    const cannon = limb(0.09, 0.07, 0.42, hideDark);
    cannon.position.set(0, -0.44, 0.02);
    leg.add(cannon);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 10), hoofMat);
    hoof.position.set(0, -0.86, 0.02);
    hoof.castShadow = true;
    leg.add(hoof);
    c.parts.legs.push(leg); c.body.add(leg);
  }

  // ── flowing HORSE TAIL ──
  const tail = new THREE.Group();
  tail.position.set(0, 1.0, -1.12);
  tail.userData.rest = 0.35;
  c.parts.tail = tail; c.body.add(tail);
  const dock = limb(0.1, 0.05, 0.3, hideDark);
  dock.rotation.x = 0.9;
  tail.add(dock);
  // hair strands
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * 0.8;
    const strand = limb(0.025, 0.012, 0.7, hideDark, 5);
    strand.position.set(Math.sin(a) * 0.08, -0.18, -0.14);
    strand.rotation.set(1.0 + Math.cos(a) * 0.1, a * 0.4, 0);
    tail.add(strand);
  }

  // ── species idle: proud bearing, slow head turns, preening, wing ruffle ──
  let preenTimer = 5 + c.rng() * 5;
  let preening = 0;
  let ruffle = 0;

  c.onIdle = (t, dt, env) => {
    const m = c.mood();

    // wings spread when playing/happy, otherwise folded (ruffle adds life)
    const wantOpen = (c.state === 'play' || c.state === 'happy') ? 1
      : (0.06 + ruffle * 0.5);
    c.wingOpen = damp(c.wingOpen, clamp(wantOpen), 6, dt);

    // periodic feather ruffle in idle
    if (c.state === 'idle') {
      ruffle = Math.max(0, ruffle - dt);
      if (c.rng() < dt * 0.25) ruffle = 0.8 + c.rng() * 0.4;
    } else ruffle = 0;

    // drive each wing's fan: fold vs spread per-feather
    c.parts.wings.forEach((wing) => {
      const sx = wing.userData.sx;
      const fan = wing.userData.fan;
      // whole wing lifts away from body as it opens
      wing.rotation.z = sx * lerp(0.1, 1.05, c.wingOpen);
      wing.rotation.y = sx * lerp(0.2, -0.1, c.wingOpen);
      const flap = (c.state === 'play' || c.state === 'happy')
        ? Math.sin(t * 6) * 0.25 : 0;
      fan.children.forEach((fp) => {
        const open = lerp(fp.userData.fold, fp.userData.spread, c.wingOpen);
        fp.rotation.z = sx * (open + flap * 0.4);
        fp.rotation.x = Math.sin(t * 2 + fp.userData.spread) * 0.04 * (1 - c.wingOpen);
      });
    });

    // proud, slow head raises & turns when idle (overrides base glance subtly)
    if (c.state === 'idle' || c.state === 'walk') {
      const raise = Math.sin(t * 0.4 + c.bobPhase) * 0.12;
      head.position.y = 1.86 + raise * 0.18 + Math.max(0, raise) * 0.1;
    }

    // preening: dips the beak to the chest/wing feathers
    if (c.state === 'idle') {
      preenTimer -= dt;
      if (preenTimer <= 0 && preening <= 0) { preening = 2.2; preenTimer = 8 + c.rng() * 8; }
    }
    if (preening > 0) {
      preening -= dt;
      const p = Math.sin((2.2 - preening) / 2.2 * Math.PI); // 0..1..0 arc
      head.rotation.x = head.userData.rest + p * 1.1;
      head.rotation.y = damp(head.rotation.y, Math.sin(c.bobPhase) * 0.5 * p, 6, dt);
      if (c.parts.jaw) c.parts.jaw.rotation.x = Math.abs(Math.sin(t * 12)) * p * 0.4;
    }

    // tail sways gracefully
    if (c.parts.tail) c.parts.tail.rotation.z = Math.sin(t * 1.3) * 0.08;
  };

  // ── react: spread wings wide and rear slightly on delight ──
  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      c.command('happy', 3.5);
      c.wingOpen = 1;
      // a proud little rear: front legs lift briefly
      frontLegs.forEach((leg) => { leg.rotation.x = -0.7; });
      c.react('sparkle');
    }
  };

  return c;
}
