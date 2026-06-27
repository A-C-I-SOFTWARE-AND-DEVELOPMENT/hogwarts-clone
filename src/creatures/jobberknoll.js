// ─────────────────────────────────────────────────────────────────────────────
//  jobberknoll.js — a tiny blue speckled songbird that never makes a sound until
//  the moment of its death, when it pours out every noise it ever heard. In life
//  it is utterly silent: a plump, perched fluff of blue feathers, flecked with
//  paler speckles, that hops and flutters with delicate, soundless energy.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU } from '../core/util.js';

export const meta = {
  id: 'jobberknoll',
  archetype: 'avian',
  name: 'Jobberknoll',
  latin: 'Avis taciturna',
  rarity: 'uncommon',
  blurb: 'A tiny blue speckled songbird that lives its whole life in perfect silence. It hops and flutters between perches, bright-eyed and gentle, never once uttering a note.',
  size: 0.5,
  speed: 1.7,
  roam: 7,
  habitat: 'meadow',
  diet: ['berries', 'beetle', 'leafy_greens'],
  favorite: 'berries',
  produces: { item: 'Jobberknoll feather', amount: 8, every: 75 },
  unlockCost: 150,
  palette: { blue: 0x3a6bd0, speckle: 0x8fb6ff, belly: 0xcfe0ff, beak: 0xe0b24b, spark: 0x8fb6ff },
  care: { feed: 'Berries and bugs', play: 'Let it flit and perch', note: 'Silent all its life — a peaceful companion.' },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  const plumage = furTexture(128, P.blue, P.speckle, 0.45);
  const blueMat = creatureMat(P.blue, { rough: 0.62, map: plumage });
  const bellyMat = creatureMat(P.belly, { rough: 0.6 });
  const speckMat = creatureMat(P.speckle, { rough: 0.55 });
  const beakMat = creatureMat(P.beak, { rough: 0.4, metal: 0.05 });
  const legMat = creatureMat(0xb88a3a, { rough: 0.5 });

  // ── body: small plump egg, leaning into a perched stance ──
  const torso = blob(0.42, 0.5, 0.46, blueMat);
  torso.position.y = 0.5;
  torso.rotation.x = -0.18;          // chest up, tail down — perched poise
  c.add(torso);

  // pale belly patch on the chest
  const belly = blob(0.32, 0.4, 0.3, bellyMat);
  belly.position.set(0, 0.46, 0.26);
  belly.rotation.x = -0.18;
  belly.scale.z = 0.55;
  c.add(belly);

  // ── speckles: scatter small lighter dots over back & flanks ──
  const speckRng = c.rng;
  const speckles = [];
  for (let i = 0; i < 16; i++) {
    const a = speckRng() * TAU;
    const v = speckRng() * 0.7 + 0.15;          // vertical band on the body
    const r = 0.4 + speckRng() * 0.05;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.03 + speckRng() * 0.025, 8, 8), speckMat);
    dot.position.set(
      Math.cos(a) * r * 0.95,
      0.34 + v * 0.42,
      Math.sin(a) * r * 0.95 - 0.02);
    dot.scale.set(1, 1, 0.5);                     // press flat against feathers
    dot.lookAt(0, dot.position.y, 0);
    speckles.push(dot);
    c.add(dot);
  }

  // ── head: round, set close on the body (little neck) ──
  const head = new THREE.Group();
  head.position.set(0, 0.92, 0.16);
  head.userData.rest = -0.05;
  c.parts.head = head; c.body.add(head);

  const skull = blob(0.3, 0.29, 0.3, blueMat);
  head.add(skull);

  // a few speckles on the crown too
  for (let i = 0; i < 5; i++) {
    const a = speckRng() * TAU;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), speckMat);
    dot.position.set(Math.cos(a) * 0.24, 0.16 + speckRng() * 0.08, Math.sin(a) * 0.2 - 0.02);
    dot.scale.set(1, 1, 0.5);
    head.add(dot);
  }

  // short conical beak (upper fixed wedge + animatable lower as 'jaw')
  const beakTop = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), beakMat);
  beakTop.geometry.rotateX(Math.PI / 2);
  beakTop.geometry.translate(0, 0.01, 0.11);
  beakTop.position.set(0, 0.0, 0.28);
  head.add(beakTop);
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 8), beakMat);
  jaw.geometry.rotateX(Math.PI / 2);
  jaw.geometry.translate(0, -0.01, 0.09);
  jaw.position.set(0, -0.05, 0.27);
  c.parts.jaw = jaw; head.add(jaw);

  // beady bright eyes, set wide on the round head
  for (const sx of [-1, 1]) {
    const e = eyeball(0.1, 0x10233f, true);
    e.position.set(sx * 0.2, 0.08, 0.18);
    e.rotation.y = sx * 0.4;
    c.registerEye(e); head.add(e);
  }

  // ── two foldable wings (registered so the rig knows them) ──
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(sx * 0.36, 0.56, -0.02);
    const feather = blob(0.1, 0.26, 0.34, blueMat);
    feather.scale.x = 0.45;                         // thin folded plate
    feather.position.set(sx * 0.04, -0.1, -0.06);
    feather.rotation.z = sx * 0.2;
    wing.add(feather);
    // speckled wing tips
    for (let k = 0; k < 3; k++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), speckMat);
      dot.position.set(sx * 0.06, -0.24 + k * 0.08, -0.16 - k * 0.04);
      dot.scale.set(1, 1, 0.6);
      wing.add(dot);
    }
    wing.userData.rest = sx * 0.2;                  // resting fold angle
    wing.userData.side = sx;
    c.parts.wings.push(wing); c.body.add(wing);
  }

  // ── short fan tail ──
  const tail = new THREE.Group();
  tail.position.set(0, 0.34, -0.4);
  tail.userData.rest = 0.35;
  const fanMat = blueMat;
  for (let i = -2; i <= 2; i++) {
    const feather = blob(0.05, 0.04, 0.26, fanMat);
    feather.position.set(i * 0.07, 0, -0.16);
    feather.rotation.y = i * 0.18;
    tail.add(feather);
  }
  c.parts.tail = tail; c.body.add(tail);

  // ── little stick legs with tiny perching feet ──
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.14, 0.26, 0.04);
    const shin = limb(0.025, 0.02, 0.26, legMat, 6);
    leg.add(shin);
    const foot = blob(0.07, 0.025, 0.1, legMat, 8);
    foot.position.set(0, -0.26, 0.03);
    leg.add(foot);
    // toes
    for (let k = -1; k <= 1; k++) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.08, 5), legMat);
      toe.geometry.translate(0, -0.04, 0);
      toe.rotation.x = Math.PI / 2.1;
      toe.position.set(k * 0.04, -0.27, 0.08);
      leg.add(toe);
    }
    c.parts.legs.push(leg); c.body.add(leg);
  }

  // ── species idle: frequent delicate hops, head tilts, soundless flutters ──
  let hopTimer = 2 + c.rng() * 3;
  let tiltTimer = 1.5 + c.rng() * 2;
  let tilt = 0, tiltTarget = 0;
  let flutter = 0;                                   // 0..1 wing-flap envelope

  c.onIdle = (t, dt, env) => {
    // ── tiny restless head tilts (very birdlike) ──
    tiltTimer -= dt;
    if (tiltTimer <= 0) {
      tiltTarget = (c.rng() - 0.5) * 0.7;
      tiltTimer = 0.8 + c.rng() * 2.2;
    }
    tilt += (tiltTarget - tilt) * Math.min(1, dt * 8);
    head.rotation.z = tilt;

    // quick alert jerks of the head left/right
    head.rotation.y += Math.sin(t * 0.9 + c.bobPhase) * 0.0;  // base rig drives yaw

    // ── occasional little hops: nudge into a brief 'play' bounce ──
    if (c.state === 'idle') {
      hopTimer -= dt;
      if (hopTimer <= 0) {
        c.command('play', 0.7 + c.rng() * 0.5);
        flutter = 1;                                  // flick wings on take-off
        hopTimer = 2.5 + c.rng() * 3.5;
      }
    }

    // ── wing flutter: continuous gentle idle flick + bigger bursts on hop/play ──
    flutter = Math.max(0, flutter - dt * 2.2);
    const playFlap = (c.state === 'play') ? 1 : 0;
    const idleFlick = 0.12 + Math.sin(t * 1.3 + c.bobPhase) * 0.04;
    const flap = idleFlick + flutter * 1.1 + playFlap * (Math.abs(Math.sin(t * 16)) * 0.9);
    c.parts.wings.forEach(w => {
      const s = w.userData.side;
      w.rotation.z = w.userData.rest + s * flap;     // open/close the fold
      w.rotation.x = -flap * 0.25;                   // sweep forward as it flaps
    });

    // tail fans a touch wider when fluttering / happy
    const fan = 1 + flutter * 0.25 + c.mood() * 0.1;
    tail.scale.x = fan;

    // delicate breast-puff with mood (content birds fluff up)
    belly.scale.setScalar(1 + c.mood() * 0.06 + Math.sin(t * 2.2) * 0.01);
    // keep it locked to its lean
    belly.rotation.x = -0.18;
  };

  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      // a silent, delighted flit: little hop + a hopeful head-cock
      c.command('play', 1.4);
      flutter = 1;
      tiltTarget = (c.rng() < 0.5 ? -1 : 1) * 0.5;
    }
  };

  return c;
}
