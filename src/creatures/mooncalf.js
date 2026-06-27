// ─────────────────────────────────────────────────────────────────────────────
//  mooncalf.js — REFERENCE creature #2. Shy, smooth blue-grey beast with
//  enormous moon-round eyes set high on its head and four spindly legs. Only
//  truly comes alive at night, when it performs its courtship dance.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import { creatureMat, TAU } from '../core/util.js';

export const meta = {
  id: 'mooncalf',
  archetype: 'beast',
  name: 'Mooncalf',
  latin: 'Luna vitulus',
  rarity: 'uncommon',
  blurb: 'A bashful, smooth-skinned creature that hides by day and dances on its hind legs beneath the moon. Its silvery dung makes turnips grow vast.',
  size: 0.95,
  speed: 1.3,
  roam: 8,
  habitat: 'meadow',
  diet: ['moon_pellet', 'sweet_truffle', 'leafy_greens'],
  favorite: 'moon_pellet',
  produces: { item: 'fertiliser', amount: 1, every: 90 },
  unlockCost: 220,
  palette: { skin: 0x8a96b4, skinDark: 0x5a6685, eye: 0x3f6fd6, spark: 0xbcd2ff },
  care: { feed: 'Moon-pellets after dusk', play: 'Dance with it under the moon', note: 'Shy in daylight — be gentle.' },
  nocturnal: true,
};

export function build(opts = {}) {
  const c = new Creature(meta, opts);
  const P = meta.palette;
  const skin = creatureMat(P.skin, { rough: 0.5 });
  const skinDark = creatureMat(P.skinDark, { rough: 0.55 });

  // ── pear-shaped body, narrow at top ──
  const torso = blob(0.46, 0.6, 0.46, skin);
  torso.position.y = 0.78; torso.scale.y = 1.05;
  c.add(torso);
  const belly = blob(0.4, 0.46, 0.3, skinDark);
  belly.position.set(0, 0.66, 0.28); c.add(belly);

  // ── long neck ──
  const neck = limb(0.16, 0.2, 0.5, skin); neck.position.set(0, 1.34, 0.04); neck.rotation.x = -0.1;
  c.add(neck);

  // ── head: domed, with the two huge moon eyes set high & forward ──
  const head = new THREE.Group();
  head.position.set(0, 1.5, 0.06);
  c.parts.head = head; c.body.add(head);
  const skull = blob(0.34, 0.32, 0.36, skin);
  head.add(skull);
  // small snout
  const snout = blob(0.16, 0.13, 0.2, skinDark);
  snout.position.set(0, -0.06, 0.32); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), creatureMat(0x20242e));
  nose.position.set(0, -0.04, 0.5); head.add(nose);

  // the signature giant eyes (flat-facing, almost touching, pale blue)
  for (const sx of [-1, 1]) {
    const e = eyeball(0.26, P.eye, true);
    e.position.set(sx * 0.18, 0.18, 0.18);
    e.rotation.x = -0.25;
    e.scale.setScalar(1.05);
    c.registerEye(e); head.add(e);
    // pale eye-ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.03, 8, 22), skinDark);
    ring.position.copy(e.position); ring.rotation.x = -0.25 + Math.PI / 2; head.add(ring);
  }

  // ── four spindly legs with little webbed feet ──
  const legPos = [[-0.26, 0.34], [0.26, 0.34], [-0.24, -0.3], [0.24, -0.3]];
  legPos.forEach(([x, z]) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.5, z);
    const shin = limb(0.07, 0.05, 0.52, skinDark); leg.add(shin);
    const foot = blob(0.13, 0.05, 0.2, skinDark); foot.position.set(0, -0.52, 0.06); leg.add(foot);
    c.parts.legs.push(leg); c.body.add(leg);
  });

  // stubby tail
  const tail = blob(0.1, 0.1, 0.16, skin); tail.position.set(0, 0.7, -0.42);
  c.parts.tail = tail; tail.userData.rest = 0.2; c.body.add(tail);

  // ── night dancing: rears onto hind legs and sways ──
  c.onIdle = (t, dt, env) => {
    const dance = env.night ? 1 : 0;
    // shy: tucks low in daylight
    const shy = env.night ? 0 : (c.bond < 30 ? 1 : 0.3);
    c.body.position.y += -shy * 0.08;
    if (env.night && c.state === 'play') {
      // courtship sway dance
      c.body.rotation.z = Math.sin(t * 3) * 0.3;
      c.body.position.y = 0.1 + Math.abs(Math.sin(t * 3)) * 0.18;
      head.rotation.z = Math.sin(t * 3 + 1) * 0.2;
      // front legs lift
      c.parts.legs[0].rotation.x = -0.8 + Math.sin(t * 6) * 0.3;
      c.parts.legs[1].rotation.x = -0.8 + Math.cos(t * 6) * 0.3;
    }
    // eyes glow faintly at night
    c.parts.eyes.forEach(e => {
      const iris = e.children[1];
      if (iris) iris.material.emissiveIntensity = 0.18 + dance * 0.5;
    });
  };

  c.onReact = (kind) => {
    if ((kind === 'happy' || kind === 'love') && opts.env?.night) c.command('play', 5);
  };

  return c;
}
