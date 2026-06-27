// ─────────────────────────────────────────────────────────────────────────────
//  puffskein.js — a tiny, almost-perfect ball of custard-cream fluff. No visible
//  legs (it rolls), just two stub feet peeking out below. Big round dark eyes, a
//  little smile and a long thin pink tongue that periodically darts forward. It
//  purrs — a gentle exaggerated squash-breathing — and bounces when happy.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, furTexture, TAU } from '../core/util.js';

export const meta = {
  id: 'puffskein',
  archetype: 'amorphous',
  name: 'Puffskein',
  latin: 'Pilus mollis',
  rarity: 'common',
  blurb: 'A spherical puff of custard-cream fluff with no discernible front or back. Utterly placid, endlessly cuddly, and forever poking out its long pink tongue for a sweet.',
  size: 0.5,
  speed: 1.0,
  roam: 6,
  habitat: 'meadow',
  diet: ['sweet_truffle', 'berries', 'honey_pot', 'beetle'],
  favorite: 'honey_pot',
  // produces omitted — it just exists to be adored
  unlockCost: 60,
  palette: { fluff: 0xf3e3b0, fluffDeep: 0xd8c074, tongue: 0xe88aa0, foot: 0xcdb469, spark: 0xffeec2 },
  care: { feed: 'Almost anything sweet', play: 'Roll it gently', note: 'Loves a cuddle above all.' },
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;

  const fur = furTexture(128, P.fluff, P.fluffDeep, 0.7);
  const fluffMat = creatureMat(P.fluff, { rough: 0.92, map: fur });
  const tuftMat = creatureMat(P.fluffDeep, { rough: 0.95, map: fur });
  const footMat = creatureMat(P.foot, { rough: 0.6 });
  const tongueMat = creatureMat(P.tongue, { rough: 0.5 });
  const mouthMat = creatureMat(0x5a2f3a, { rough: 0.5 });

  // ── body: an almost perfect fuzzy sphere, centred low so it sits on the ground ──
  const ball = blob(0.5, 0.48, 0.5, fluffMat);
  ball.position.y = 0.5;
  c.add(ball);
  c.parts.head = ball; // the whole ball IS the head — base rig glances/blinks with it

  // a scatter of little fluff tufts to break the perfect silhouette and read as fur
  const tuftRng = c.rng;
  for (let i = 0; i < 9; i++) {
    const a = tuftRng() * TAU;
    const el = (tuftRng() * 0.6 + 0.2) * Math.PI; // avoid the very bottom
    const r = 0.5;
    const tx = Math.sin(el) * Math.cos(a) * r;
    const tz = Math.sin(el) * Math.sin(a) * r;
    const ty = Math.cos(el) * 0.48;
    const tuft = blob(0.12, 0.12, 0.12, tuftMat, 8);
    tuft.position.set(tx, ty, tz);
    tuft.scale.multiplyScalar(0.7 + tuftRng() * 0.5);
    ball.add(tuft);
  }

  // ── face: clustered near the front-top of the ball ──
  // big round dark eyes
  for (const sx of [-1, 1]) {
    const e = eyeball(0.13, 0x1a1410, true);
    e.position.set(sx * 0.17, 0.14, 0.42);
    e.rotation.y = sx * 0.18;
    c.registerEye(e);
    ball.add(e);
  }

  // tiny smile — a shallow curved mouth recess
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 16, Math.PI), mouthMat);
  smile.position.set(0, -0.03, 0.49);
  smile.rotation.z = Math.PI; // open side up → upturned smile
  ball.add(smile);

  // ── the long thin pink tongue: rests retracted, darts straight forward in onIdle ──
  const tongue = new THREE.Group();
  tongue.position.set(0, -0.03, 0.5);
  const tongueStrip = limb(0.035, 0.025, 0.34, tongueMat, 6);
  tongueStrip.rotation.x = Math.PI / 2; // point forward along +Z
  tongueStrip.position.z = 0; // limb extends along -local-y → now +Z after rotation
  const tongueTip = blob(0.045, 0.025, 0.06, tongueMat, 8);
  tongueTip.position.set(0, 0, 0.34);
  tongue.add(tongueStrip, tongueTip);
  tongue.scale.z = 0.02; // start fully retracted
  tongue.visible = false;
  c.parts.extra.push(tongue); // store the tongue on c.parts.extra
  ball.add(tongue);

  // ── two tiny stub feet peeking out the bottom (no real legs — it rolls) ──
  for (const sx of [-1, 1]) {
    const foot = blob(0.11, 0.07, 0.13, footMat, 10);
    foot.position.set(sx * 0.18, 0.06, 0.06);
    c.body.add(foot);
    // register as legs so the base rig gives them a faint waddle on the move
    c.parts.legs.push(foot);
  }

  // ── species idle: purring squash-breath + periodic tongue dart + happy wobble ──
  let tongueTimer = 2.5 + c.rng() * 3;
  let tongueT = -1; // <0 = inactive; 0..1 = dart progress
  c.onIdle = (t, dt, env) => {
    // PURR: gentle, slightly exaggerated sinusoidal squash breathing on the ball.
    // Layered on top of the base body squash so it always feels alive & content.
    const purr = Math.sin(t * 3.2 + c.bobPhase) * 0.06;
    ball.scale.set(1 + purr * 0.5, 1 - purr, 1 + purr * 0.5);

    // tongue dart timer (skip while eating/sleeping)
    if (tongueT < 0 && c.state !== 'sleep' && c.state !== 'eat') {
      tongueTimer -= dt;
      if (tongueTimer <= 0) { tongueT = 0; tongueTimer = 3 + c.rng() * 4; }
    }
    if (tongueT >= 0) {
      tongueT += dt * 2.4;
      // out-and-back: extend on the first half, retract on the second
      const phase = tongueT < 0.5 ? tongueT * 2 : (1 - tongueT) * 2;
      const ext = Math.max(0, phase);
      tongue.visible = ext > 0.01;
      tongue.scale.z = 0.02 + ext * 1.0;
      // a little eager up-tilt as it pokes out
      tongue.rotation.x = -0.15 * ext;
      if (tongueT >= 1) { tongueT = -1; tongue.visible = false; tongue.scale.z = 0.02; tongue.rotation.x = 0; }
    }

    // HAPPY BOUNCE: the base 'play'/'happy' state already hops — add a giddy wobble.
    if (c.state === 'play' || c.state === 'happy') {
      c.body.rotation.z += Math.sin(t * 14) * 0.18;
      c.body.rotation.x += Math.cos(t * 11) * 0.1;
      // an excited extra tongue dart on the up-beat
      if (tongueT < 0 && Math.sin(t * 7) > 0.96) { tongueT = 0; }
    }
  };

  c.onReact = (kind) => {
    if (kind === 'happy' || kind === 'love') {
      tongueT = 0;            // delighted little lick
      c.command('play', 3);   // bounce with joy
    }
  };

  return c;
}
