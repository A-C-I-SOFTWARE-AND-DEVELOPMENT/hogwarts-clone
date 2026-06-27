// ─────────────────────────────────────────────────────────────────────────────
//  builder.js — the PARAMETRIC creature factory. Turns a compact data spec into
//  a detailed, textured, distinctive 3-D beast and wires it to the base rig so
//  it animates. This is what lets us ship 100+ recognisable creatures: every
//  beast is a config of archetype + parts + skin + palette, not a bespoke blob.
//
//  spec.build = {
//    archetype, skin, palette{base,belly,accent,eye,spark,pattern},
//    body{len,girth,hump,neck}, head{shape,size}, eyes{count,size,glow},
//    horns{type,size}, wings{type,span}, tail{type,len}, legs{count,type},
//    ears{type}, extras[], pattern
//  }
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Creature, eyeball, blob, limb } from './base.js';
import {
  creatureMat, applyRim, furTexture, scaleNormal, featherTexture, chitinNormal,
  hideNormal, barkNormal, spottedTexture, furNormal, skinNormal, TAU, clamp, lerp, rngRange, makeRng,
} from '../core/util.js';
import { archProfile } from './behavior.js';

// ── shared texture cache (keyed) so 100 creatures don't regenerate maps ──
const _texCache = new Map();
function cached(key, make) { let t = _texCache.get(key); if (!t) { t = make(); _texCache.set(key, t); } return t; }
const SCALE_N = () => cached('scaleN', () => scaleNormal(256, 24, 3));
const CHITIN_N = () => cached('chitinN', () => chitinNormal(256, 9, 2.6));
const HIDE_N = () => cached('hideN', () => hideNormal(256, 2));
const BARK_N = () => cached('barkN', () => barkNormal(256, 2.6));
const FUR_N = () => cached('furN', () => furNormal(256, 1.7));
const SKIN_N = () => cached('skinN', () => skinNormal(256, 1.1));

// ── surface materials per skin type ──
function surfaceMats(skin, P) {
  const base = P.base, belly = P.belly ?? P.base, accent = P.accent ?? P.base;
  const rim = { color: P.rim ?? 0xbfd4ff, strength: 0.3 };
  let bodyMat, bellyMat;
  switch (skin) {
    case 'fur': {
      const t = cached('fur' + base + (P.tip ?? belly), () => furTexture(128, base, P.tip ?? belly, 0.6));
      bodyMat = creatureMat(base, { rough: 0.78, map: t, normalMap: FUR_N(), rimColor: P.rim ?? 0xffe6c0, rimStrength: 0.34 });
      bodyMat.normalScale = new THREE.Vector2(0.85, 0.85);
      bellyMat = creatureMat(belly, { rough: 0.66, normalMap: FUR_N() });
      bellyMat.normalScale = new THREE.Vector2(0.6, 0.6);
      break;
    }
    case 'scale': {
      // wet, faintly iridescent reptilian scales
      bodyMat = creatureMat(base, { rough: 0.34, metal: 0.14, normalMap: SCALE_N(), rimColor: P.spark ?? 0xa6f0d8, rimStrength: 0.55, emissive: accent, emissiveIntensity: 0.04 });
      bodyMat.normalScale = new THREE.Vector2(0.9, 0.9);
      bellyMat = creatureMat(belly, { rough: 0.3, metal: 0.1 });
      break;
    }
    case 'feather': {
      const t = cached('feat' + base + accent, () => featherTexture(128, base, accent));
      // plumage with a soft iridescent sheen along the edge
      bodyMat = creatureMat(base, { rough: 0.5, metal: 0.08, map: t, normalMap: SKIN_N(), rimColor: P.spark ?? 0xbfe0ff, rimStrength: 0.5, emissive: accent, emissiveIntensity: 0.05 });
      bodyMat.normalScale = new THREE.Vector2(0.5, 0.5);
      bellyMat = creatureMat(belly, { rough: 0.56, normalMap: SKIN_N() });
      bellyMat.normalScale = new THREE.Vector2(0.4, 0.4);
      break;
    }
    case 'chitin': {
      bodyMat = creatureMat(base, { rough: 0.22, metal: 0.25, normalMap: CHITIN_N(), rimColor: 0xead9a0, rimStrength: 0.5 });
      bellyMat = creatureMat(belly, { rough: 0.3, metal: 0.2 });
      break;
    }
    case 'hide': {
      bodyMat = creatureMat(base, { rough: 0.85, normalMap: HIDE_N(), rimColor: 0xcdb88a });
      bodyMat.normalScale = new THREE.Vector2(0.6, 0.6);
      bellyMat = creatureMat(belly, { rough: 0.9 });
      break;
    }
    case 'bark': {
      bodyMat = creatureMat(base, { rough: 0.95, normalMap: BARK_N(), rimColor: 0x9ad17a });
      bellyMat = creatureMat(belly, { rough: 0.95 });
      break;
    }
    case 'bone': {
      bodyMat = creatureMat(base, { rough: 0.6, normalMap: SKIN_N(), rimColor: 0xffffff, rimStrength: 0.5 });
      bodyMat.normalScale = new THREE.Vector2(0.7, 0.7);
      bellyMat = creatureMat(belly, { rough: 0.65 });
      break;
    }
    case 'slime': {
      bodyMat = creatureMat(base, { rough: 0.15, metal: 0.0, rimColor: 0xffffff, rimStrength: 0.6, emissive: accent, emissiveIntensity: 0.12 });
      bodyMat.transparent = true; bodyMat.opacity = 0.9;
      bellyMat = bodyMat;
      break;
    }
    case 'ethereal': {
      bodyMat = creatureMat(base, { rough: 0.4, rimColor: P.spark ?? 0x9fb0ff, rimStrength: 0.7, emissive: P.spark ?? 0x3a4a7a, emissiveIntensity: 0.3 });
      bodyMat.transparent = true; bodyMat.opacity = 0.86;
      bellyMat = bodyMat;
      break;
    }
    default: { // smooth skin — still give it fine pores so it isn't a glassy ball
      bodyMat = creatureMat(base, { rough: 0.52, normalMap: SKIN_N(), rimColor: rim.color });
      bodyMat.normalScale = new THREE.Vector2(0.6, 0.6);
      bellyMat = creatureMat(belly, { rough: 0.5, normalMap: SKIN_N() });
      bellyMat.normalScale = new THREE.Vector2(0.4, 0.4);
    }
  }
  // pattern overlay (spots/stripes) via albedo map when no map already set
  if (P.pattern && (P.pattern === 'spots' || P.pattern === 'speckle') && !bodyMat.map) {
    bodyMat.map = cached('spot' + base + accent, () => spottedTexture(128, base, accent, P.pattern === 'speckle' ? 0.25 : 0.4));
  }
  const accentMat = creatureMat(accent, { rough: 0.55 });
  const hornMat = creatureMat(P.horn ?? 0xd8d2bc, { rough: 0.45, metal: 0.05 });
  const clawMat = creatureMat(P.claw ?? 0x2a2620, { rough: 0.4 });
  // tag roles so genetics can shift body vs. accent colours independently (two-tone)
  bodyMat.userData.role = 'body'; bellyMat.userData.role = 'belly';
  accentMat.userData.role = 'accent'; hornMat.userData.role = 'horn'; clawMat.userData.role = 'claw';
  return { body: bodyMat, belly: bellyMat, accent: accentMat, horn: hornMat, claw: clawMat };
}

// ── part builders ──────────────────────────────────────────────────────────────
function buildEyes(c, head, cfg, P, place) {
  const n = cfg.count ?? 2, r = (cfg.size ?? 0.16) * 1.3;   // bigger, more expressive eyes read as a face
  for (let i = 0; i < n; i++) {
    const e = eyeball(r, P.eye ?? 0x141a2c, true);
    const sx = (i % 2 === 0 ? -1 : 1);
    const ring = Math.floor(i / 2);
    place(e, sx, ring, i);
    if (cfg.glow) { const iris = e.children[1]; if (iris) { iris.material.emissive = new THREE.Color(P.eye ?? 0x88aaff); iris.material.emissiveIntensity = 0.6; } }
    c.registerEye(e); head.add(e);
  }
}

function buildHorns(type, size, mat, P) {
  const g = new THREE.Group();
  const s = size ?? 0.3;
  const cone = (rr, h, seg = 8) => new THREE.Mesh(new THREE.ConeGeometry(rr, h, seg), mat);
  switch (type) {
    case 'single': { const h = cone(s * 0.5, s * 2.4); h.position.set(0, s * 0.6, 0.5); h.rotation.x = -0.5; g.add(h); break; }
    case 'pair': for (const sx of [-1, 1]) { const h = cone(s * 0.5, s * 2.2, 7); h.position.set(sx * s * 0.9, s * 0.4, 0.3); h.rotation.set(-1.0, 0, sx * 0.3); g.add(h); } break;
    case 'ram': for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(s * 0.9, s * 0.28, 8, 16, Math.PI * 1.4), mat); h.position.set(sx * s, s * 0.3, 0); h.rotation.set(0, sx * 1.4, Math.PI * 0.5); g.add(h); } break;
    case 'antler': for (const sx of [-1, 1]) { const base = cone(s * 0.3, s * 1.8, 6); base.position.set(sx * s * 0.7, s, 0); base.rotation.z = sx * 0.5; g.add(base); for (let k = 0; k < 2; k++) { const t = cone(s * 0.15, s * 0.8, 5); t.position.set(sx * (s * 0.7 + s * 0.5 * k), s * 1.4 + k * 0.3, 0); t.rotation.z = sx * 1.0; g.add(t); } } break;
    case 'frill': { const f = new THREE.Mesh(new THREE.CircleGeometry(s * 2.2, 16, 0, Math.PI), mat); f.material = mat; f.position.set(0, s, -0.2); f.rotation.x = -0.6; f.material.side = THREE.DoubleSide; g.add(f); break; }
    default: return null;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildWings(type, span, mats, P) {
  const out = [];
  const sp = span ?? 1.2;
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    if (type === 'feather') {
      const arm = limb(0.08, 0.05, sp, mats.body); arm.rotation.z = sx * 1.1; w.add(arm);
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, sp * (0.5 + i * 0.08), 4, 6), mats.accent);
        f.position.set(sx * sp * 0.5, -i * 0.12, -0.1 - i * 0.05); f.rotation.z = sx * (0.6 + i * 0.12); f.scale.z = 0.25; w.add(f);
      }
    } else if (type === 'bat') {
      const memMat = new THREE.MeshStandardMaterial({ color: P.wing ?? 0x20222e, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
      applyRim(memMat, { color: 0x6f7a9c, strength: 0.4 });
      for (let k = 0; k < 3; k++) { const strut = limb(0.05, 0.02, sp * (1 - k * 0.18), mats.horn); strut.position.set(0, 0, 0); strut.rotation.z = sx * (0.9 - k * 0.4); w.add(strut); }
      const mem = new THREE.Mesh(new THREE.CircleGeometry(sp * 0.8, 12, 0, Math.PI), memMat); mem.rotation.set(Math.PI / 2, 0, sx * 0.4); mem.position.set(sx * sp * 0.4, -0.1, 0); w.add(mem);
    } else if (type === 'insect') {
      const wMat = new THREE.MeshStandardMaterial({ color: P.wing ?? 0xbfe6ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide, emissive: P.spark ?? 0x88ccff, emissiveIntensity: 0.15 });
      const v = new THREE.Mesh(new THREE.CircleGeometry(sp * 0.7, 14), wMat); v.scale.set(0.5, 1, 1); v.position.set(sx * sp * 0.4, 0.1, -0.1); v.rotation.set(1.4, 0, sx * 0.5); w.add(v);
    }
    w.position.set(sx * 0.35, 0, -0.1);
    w.userData.side = sx;
    out.push(w);
  }
  return out;
}

function buildTail(type, len, mats, P) {
  const g = new THREE.Group();
  const L = len ?? 0.6;
  switch (type) {
    case 'tuft': { const t = limb(0.1, 0.06, L, mats.body); t.rotation.x = 1.2; g.add(t); const tuft = blob(0.16, 0.16, 0.16, mats.accent); tuft.position.set(0, 0, -L * 0.8); g.add(tuft); break; }
    case 'flat': { const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, L), mats.body); t.geometry.translate(0, 0, -L / 2); g.add(t); break; }
    case 'serpent': { for (let i = 0; i < 5; i++) { const s = blob(0.16 - i * 0.025, 0.16 - i * 0.025, 0.18, mats.body); s.position.set(0, Math.sin(i) * 0.05, -0.18 * i - 0.1); g.add(s); } break; }
    case 'plume': for (let i = -2; i <= 2; i++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, L, 4, 6), mats.accent); f.position.set(i * 0.06, 0, -L * 0.4); f.rotation.x = 1.4; f.rotation.z = i * 0.2; f.scale.z = 0.3; g.add(f); } break;
    case 'fish': { const f = new THREE.Mesh(new THREE.ConeGeometry(L * 0.7, L, 4), mats.accent); f.rotation.x = -Math.PI / 2; f.scale.set(1, 0.15, 1); f.position.z = -L * 0.5; g.add(f); break; }
    case 'scorpion': { for (let i = 0; i < 4; i++) { const s = blob(0.1, 0.1, 0.12, mats.body); s.position.set(0, i * 0.12, -0.1 - i * 0.04); g.add(s); } const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), mats.horn); stinger.position.set(0, 0.5, -0.18); stinger.rotation.x = 0.6; g.add(stinger); break; }
    case 'lizard': { for (let i = 0; i < 6; i++) { const s = blob(0.13 - i * 0.018, 0.13 - i * 0.018, 0.16, mats.body); s.position.set(0, 0, -0.16 * i - 0.1); g.add(s); } break; }
    default: return null;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.rest = 0.1;
  return g;
}

function buildLeg(type, mats, P, h = 0.5) {
  const leg = new THREE.Group();
  switch (type) {
    case 'hoof': { const shin = limb(0.09, 0.06, h, mats.body); leg.add(shin); const hoof = blob(0.1, 0.08, 0.12, mats.claw); hoof.position.y = -h; leg.add(hoof); break; }
    case 'talon': { const shin = limb(0.08, 0.06, h * 0.8, mats.accent); leg.add(shin); for (let k = -1; k <= 1; k++) { const toe = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 5), mats.claw); toe.position.set(k * 0.08, -h * 0.8, 0.08); toe.rotation.x = Math.PI / 2.2; leg.add(toe); } break; }
    case 'stick': { const shin = limb(0.05, 0.04, h, mats.body); leg.add(shin); const foot = blob(0.09, 0.05, 0.14, mats.belly); foot.position.set(0, -h, 0.05); leg.add(foot); break; }
    case 'webbed': { const shin = limb(0.08, 0.06, h, mats.belly); leg.add(shin); const foot = blob(0.14, 0.04, 0.2, mats.belly); foot.position.set(0, -h, 0.06); leg.add(foot); break; }
    default: { // paw
      const shin = limb(0.11, 0.08, h, mats.body); leg.add(shin);
      const paw = blob(0.14, 0.1, 0.18, mats.body); paw.position.set(0, -h, 0.06); leg.add(paw);
      for (let k = -1; k <= 1; k++) { const claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.1, 5), mats.claw); claw.position.set(k * 0.06, -h - 0.02, 0.22); claw.rotation.x = Math.PI / 2.2; leg.add(claw); }
    }
  }
  leg.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return leg;
}

function buildEars(type, mats, P) {
  if (!type || type === 'none') return [];
  const out = [];
  for (const sx of [-1, 1]) {
    let ear;
    if (type === 'long') { ear = blob(0.08, 0.22, 0.05, mats.body); }
    else if (type === 'point') { ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 5), mats.body); }
    else if (type === 'fin') { ear = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10, 0, Math.PI), mats.accent); ear.material.side = THREE.DoubleSide; }
    else if (type === 'tuft') { ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), mats.body); }
    else { ear = blob(0.12, 0.13, 0.06, mats.body); } // round
    ear.userData.rest = sx * 0.2;
    ear.userData.side = sx;
    out.push(ear);
  }
  return out;
}

function buildExtras(c, body, head, extras, mats, P, scale) {
  (extras || []).forEach(ex => {
    if (ex === 'mane') for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.2; const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 5), mats.accent); s.position.set(Math.sin(a) * 0.34, 0.1, Math.cos(a) * 0.2 - 0.1); s.rotation.set(0.4, a, 0); head.add(s); }
    else if (ex === 'spikes') for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 5), mats.horn); s.position.set(0, 0.3 - i * 0.02, 0.4 - i * 0.16); s.rotation.x = -0.2; body.add(s); }
    else if (ex === 'whiskers') for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const w = limb(0.008, 0.004, 0.3, mats.belly); w.position.set(sx * 0.18, 0.02 - i * 0.04, 0.36); w.rotation.set(0, sx * 0.8, 0.1 + i * 0.1); head.add(w); }
    else if (ex === 'antennae') for (const sx of [-1, 1]) { const a = limb(0.02, 0.012, 0.32, mats.accent); a.position.set(sx * 0.1, 0.28, 0.18); a.rotation.set(-0.5, 0, sx * 0.3); const tip = blob(0.045, 0.045, 0.045, mats.accent); tip.position.set(sx * 0.24, 0.55, 0.05); head.add(a, tip); }
    else if (ex === 'shell') { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14, 0, TAU, 0, Math.PI * 0.62), mats.accent); sh.position.set(0, 0.5, -0.05); sh.castShadow = true; body.add(sh); }
    else if (ex === 'frill') { const f = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 6, 16, Math.PI), mats.accent); f.position.set(0, 0.1, -0.1); f.rotation.x = Math.PI / 2; head.add(f); }
    else if (ex === 'tusks') for (const sx of [-1, 1]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 6), mats.horn); t.position.set(sx * 0.16, -0.12, 0.34); t.rotation.set(0.4, 0, sx * 0.2); head.add(t); }
    else if (ex === 'beard') for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.3, 3, 5), mats.belly); s.position.set((i - 2) * 0.05, -0.24, 0.3); s.rotation.x = 0.3; head.add(s); }
    else if (ex === 'gem') { const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), creatureMat(P.spark ?? 0xffd86a, { rough: 0.1, metal: 0.6, emissive: P.spark ?? 0xffd86a, emissiveIntensity: 0.4 })); g.position.set(0, 0.3, 0.5); head.add(g); }
    else if (ex === 'wisps') { c._wisps = true; }
    else if (ex === 'crest') for (let i = -2; i <= 2; i++) { const cr = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3 - Math.abs(i) * 0.05, 5), mats.accent); cr.position.set(i * 0.05, 0.34, 0.1); cr.rotation.x = -0.3; head.add(cr); }
  });
}

// ── archetype assemblers (return the body group + register parts) ──
function assemble(c, B, mats, P) {
  const arch = B.archetype || 'beast';
  const body = c.body;
  const head = new THREE.Group();
  c.parts.head = head;
  const bd = B.body || {};
  const len = bd.len ?? 0.7, girth = bd.girth ?? 0.55;

  // ── torso + head placement per archetype ──
  if (arch === 'rodent') {
    const torso = blob(girth, girth * 0.9, len, mats.body); torso.position.y = girth * 0.85; body.add(torso);
    const belly = blob(girth * 0.8, girth * 0.7, len * 0.7, mats.belly); belly.position.set(0, girth * 0.6, len * 0.4); belly.scale.z = 0.5; body.add(belly);
    head.position.set(0, girth * 1.4, len * 0.7);
    const skull = blob(girth * 0.66, girth * 0.62, girth * 0.7, mats.body); head.add(skull);
  } else if (arch === 'avian') {
    const torso = blob(girth * 0.8, girth, len, mats.body); torso.position.y = len * 0.9; torso.rotation.x = 0.4; body.add(torso);
    const belly = blob(girth * 0.66, girth * 0.7, len * 0.5, mats.belly); belly.position.set(0, len * 0.75, girth * 0.4); body.add(belly);
    const neck = limb(girth * 0.4, girth * 0.3, len * 0.5, mats.body); neck.position.set(0, len * 1.3, girth * 0.1); neck.rotation.x = -0.2; body.add(neck);
    head.position.set(0, len * 1.5, girth * 0.2);
    const skull = blob(girth * 0.5, girth * 0.5, girth * 0.55, mats.body); head.add(skull);
  } else if (arch === 'serpent') {
    for (let i = 0; i < 7; i++) { const s = blob(girth * (1 - i * 0.09), girth * (1 - i * 0.09), girth * 0.7, mats.body); s.position.set(0, girth + Math.sin(i * 0.6) * 0.1, -i * girth * 0.7 + len); body.add(s); }
    head.position.set(0, girth * 1.1, len + girth * 0.3);
    const skull = blob(girth * 0.7, girth * 0.55, girth * 0.9, mats.body); head.add(skull);
  } else if (arch === 'dragon' || arch === 'wyvern') {
    const torso = blob(girth * 1.1, girth, len * 1.2, mats.body); torso.position.y = girth * 1.3; body.add(torso);
    const neck = limb(girth * 0.5, girth * 0.3, len * 0.8, mats.body); neck.position.set(0, girth * 1.9, len * 0.7); neck.rotation.x = -0.7; body.add(neck);
    head.position.set(0, girth * 2.3, len * 1.1);
    const skull = blob(girth * 0.6, girth * 0.5, girth * 0.9, mats.body); head.add(skull);
  } else if (arch === 'insectoid' || arch === 'arachnid') {
    const thorax = blob(girth, girth * 0.9, len * 0.7, mats.body); thorax.position.y = girth * 0.9; body.add(thorax);
    const abdomen = blob(girth * 0.95, girth * 0.85, len * 0.9, mats.body); abdomen.position.set(0, girth * 0.85, -len * 0.7); body.add(abdomen);
    head.position.set(0, girth * 1.0, len * 0.6);
    const skull = blob(girth * 0.55, girth * 0.5, girth * 0.6, mats.body); head.add(skull);
  } else if (arch === 'amphibian') {
    const torso = blob(girth * 1.1, girth * 0.7, len, mats.body); torso.position.y = girth * 0.55; body.add(torso);
    const belly = blob(girth * 0.9, girth * 0.5, len * 0.7, mats.belly); belly.position.set(0, girth * 0.35, len * 0.2); body.add(belly);
    head.position.set(0, girth * 0.75, len * 0.6);
    const skull = blob(girth * 0.85, girth * 0.45, girth * 0.7, mats.body); head.add(skull);
  } else if (arch === 'plant') {
    const trunk = limb(girth * 0.4, girth * 0.5, len * 1.6, mats.body); trunk.position.y = len * 1.6; trunk.rotation.x = Math.PI; body.add(trunk);
    head.position.set(0, len * 1.5, 0);
    const skull = blob(girth * 0.4, girth * 0.55, girth * 0.4, mats.body); head.add(skull);
  } else if (arch === 'amorphous') {
    const blobby = blob(girth, girth * 0.9, girth, mats.body); blobby.position.y = girth * 0.8; body.add(blobby);
    head.position.set(0, girth * 1.0, girth * 0.3);
    const skull = blob(girth * 0.5, girth * 0.5, girth * 0.5, mats.body); skull.visible = false; head.add(skull);
  } else if (arch === 'humanoid') {
    const torso = blob(girth * 0.7, len, girth * 0.5, mats.body); torso.position.y = len; body.add(torso);
    head.position.set(0, len * 1.9, 0);
    const skull = blob(girth * 0.5, girth * 0.55, girth * 0.5, mats.body); head.add(skull);
  } else if (arch === 'aquatic') {
    const torso = blob(girth * 0.8, girth * 0.8, len * 1.3, mats.body); torso.position.y = girth; body.add(torso);
    head.position.set(0, girth * 1.1, len * 0.9);
    const skull = blob(girth * 0.55, girth * 0.55, girth * 0.6, mats.body); head.add(skull);
  } else { // beast / equine / feline — quadruped
    const tall = arch === 'equine';
    // sit the barrel up on its legs (raised) so the legs are clearly visible —
    // a creature standing on four legs reads as an animal, not a dome on the ground
    const yb = tall ? girth * 1.95 : girth * 1.42;
    // a long, lower barrel (wider than tall) reads as a four-legged animal, not a ball
    const torso = blob(girth * 0.96, girth * (tall ? 0.8 : 0.78), len * 1.4, mats.body); torso.position.y = yb; body.add(torso);
    // chest/shoulder swell forward for a defined front
    const chest = blob(girth * 0.9, girth * 0.82, len * 0.5, mats.body); chest.position.set(0, yb + girth * 0.04, len * 0.6); body.add(chest);
    const belly = blob(girth * 0.82, girth * 0.62, len * 0.85, mats.belly); belly.position.set(0, yb - girth * 0.34, len * 0.2); body.add(belly);
    if (bd.hump) { const hump = blob(girth * 0.7, girth * 0.6, girth * 0.8, mats.body); hump.position.set(0, yb + girth * 0.5, len * 0.4); body.add(hump); }
    // raise the head clear of the barrel and push it forward on a real neck so the
    // face always reads (a head sunk into the body is what makes a beast a "blob")
    const neck = limb(girth * 0.5, girth * 0.34, len * (tall ? 0.78 : 0.6), mats.body); neck.position.set(0, yb + girth * (tall ? 0.35 : 0.5), len * 0.72); neck.rotation.x = tall ? -0.5 : -0.55; body.add(neck);
    head.position.set(0, yb + girth * (tall ? 0.85 : 0.82), len * (tall ? 0.92 : 0.98));
    const sh = B.head?.shape;
    const skull = blob(girth * 0.6, girth * 0.62, girth * (sh === 'equine' || sh === 'draconic' ? 0.95 : 0.72), mats.body); head.add(skull);
  }

  body.add(head);

  // ── snout / beak / muzzle on the head ──
  const sh = B.head?.shape || 'round';
  if (sh === 'snout') { const sn = blob(0.2, 0.14, 0.28, mats.belly); sn.position.set(0, -0.04, 0.34); body.children, head.add(sn); const jaw = blob(0.16, 0.05, 0.2, mats.belly); jaw.position.set(0, -0.14, 0.3); jaw.geometry.translate(0, 0, 0.1); c.parts.jaw = jaw; head.add(jaw); const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mats.claw); nose.position.set(0, 0.0, 0.5); head.add(nose); }
  else if (sh === 'beak') { const top = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 6), mats.horn); top.rotation.x = Math.PI / 2; top.position.set(0, 0.0, 0.4); head.add(top); const jaw = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 6), mats.horn); jaw.rotation.x = Math.PI / 2; jaw.position.set(0, -0.08, 0.34); c.parts.jaw = jaw; head.add(jaw); }
  else if (sh === 'draconic') { const sn = blob(0.18, 0.13, 0.34, mats.body); sn.position.set(0, -0.02, 0.4); head.add(sn); const jaw = blob(0.15, 0.06, 0.26, mats.belly); jaw.position.set(0, -0.14, 0.36); jaw.geometry.translate(0, 0, 0.12); c.parts.jaw = jaw; head.add(jaw); for (const sx of [-1, 1]) { const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), mats.claw); nostril.position.set(sx * 0.06, 0.02, 0.66); head.add(nostril); } }
  else if (sh === 'equine') { const sn = blob(0.16, 0.16, 0.3, mats.body); sn.position.set(0, -0.06, 0.36); head.add(sn); const nose = blob(0.14, 0.1, 0.1, mats.belly); nose.position.set(0, -0.1, 0.5); head.add(nose); }
  else if (sh === 'frog') { const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 18, Math.PI), mats.claw); mouth.position.set(0, -0.16, 0.2); mouth.rotation.set(0.2, 0, 0); head.add(mouth); }
  else if (sh === 'skull') { const sn = blob(0.16, 0.12, 0.34, mats.body); sn.position.set(0, -0.04, 0.38); head.add(sn); const jaw = blob(0.13, 0.05, 0.24, mats.body); jaw.position.set(0, -0.14, 0.34); c.parts.jaw = jaw; head.add(jaw); }
  else { const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mats.claw); nose.position.set(0, -0.02, 0.42); head.add(nose); }

  // ── eyes ──
  const eyeY = sh === 'beak' || sh === 'frog' ? 0.16 : 0.1;
  buildEyes(c, head, B.eyes || { count: 2, size: 0.15 }, P, (e, sx, ring, i) => {
    const er = (B.eyes?.size ?? 0.15);
    if ((B.eyes?.count ?? 2) > 2) { const a = (i / (B.eyes.count - 1) - 0.5) * 1.6; e.position.set(Math.sin(a) * 0.34, 0.14 - ring * 0.12, 0.2 + Math.cos(a) * 0.08); }
    else e.position.set(sx * (0.22 + er), eyeY, 0.26);
    e.rotation.y = sx * 0.3;
  });

  // ── ears ──
  const ears = buildEars(B.ears?.type, mats, P);
  ears.forEach((ear, i) => { const sx = ear.userData.side; ear.position.set(sx * 0.26, 0.32, 0.0); c.parts.ears.push(ear); head.add(ear); });

  // ── horns ──
  if (B.horns && B.horns.type && B.horns.type !== 'none') { const hg = buildHorns(B.horns.type, B.horns.size, mats.horn, P); if (hg) head.add(hg); }

  // ── wings ──
  if (B.wings && B.wings.type && B.wings.type !== 'none') {
    const wings = buildWings(B.wings.type, B.wings.span, mats, P);
    wings.forEach(w => { w.position.y += (bd.girth ?? 0.55) * 1.4; w.position.z -= len * 0.2; c.parts.wings.push(w); body.add(w); });
  }

  // ── legs ──
  const legCfg = B.legs || { count: 4, type: 'paw' };
  if (legCfg.type !== 'none' && legCfg.count > 0) {
    // legs reach from the body down to the ground (attach height ≈ leg length) so
    // there is real, visible leg between the belly and the grass
    const yb = (arch === 'equine') ? girth * 1.72 : (arch === 'avian' || arch === 'humanoid' || arch === 'plant') ? len * 0.82 : girth * 1.22;
    const hLen = (arch === 'equine') ? girth * 1.72 : (arch === 'avian') ? len * 0.64 : girth * 1.18;
    const count = legCfg.count;
    const rows = (count <= 2) ? 1 : (count <= 4 ? 2 : Math.ceil(count / 2));
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      const perRow = Math.min(2, count - idx);
      const z = (arch === 'serpent') ? len - r * girth : lerp(len * 0.5, -len * 0.5, rows === 1 ? 0.5 : r / (rows - 1));
      for (let s = 0; s < perRow; s++) {
        const sx = perRow === 1 ? 0 : (s === 0 ? -1 : 1);
        const leg = buildLeg(legCfg.type, mats, P, hLen);
        leg.position.set(sx * girth * 0.8, yb, z);
        c.parts.legs.push(leg); body.add(leg); idx++;
      }
    }
  }

  // ── tail ──
  if (B.tail && B.tail.type && B.tail.type !== 'none') {
    const tg = buildTail(B.tail.type, B.tail.len, mats, P);
    if (tg) { const yb = (arch === 'equine') ? girth * 1.85 : (arch === 'beast' || arch === 'feline') ? girth * 1.45 : girth * 0.95; tg.position.set(0, yb, -len * 0.8); c.parts.tail = tg; body.add(tg); }
  }

  // ── extras ──
  buildExtras(c, body, head, B.extras, mats, P, 1);

  body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

// derive the registry meta from a spec (no geometry — cheap)
export function specMeta(spec) {
  return {
    id: spec.id, name: spec.name, latin: spec.latin, rarity: spec.tier, blurb: spec.blurb,
    size: spec.size ?? 0.9, speed: spec.speed ?? 1.5, roam: spec.roam ?? 8, habitat: spec.habitat ?? 'meadow',
    diet: spec.diet, favorite: spec.favorite, produces: spec.produces, unlockCost: spec.unlockCost ?? 0,
    palette: spec.build?.palette || {}, care: spec.care || {}, nocturnal: spec.nocturnal,
  };
}

// ── public: build a Creature from a spec ──
export function buildFromSpec(spec, opts = {}) {
  const meta = specMeta(spec);
  const c = new Creature(meta, opts);
  const P = spec.build?.palette || { base: 0x888888 };
  const mats = surfaceMats(spec.build?.skin || 'smooth', P);
  assemble(c, spec.build || {}, mats, P);

  // tag the live beast with its archetype so the base rig drives gait + actions
  const arch = spec.build?.archetype || 'beast';
  c.archetype = arch;
  c.archProfile = archProfile(arch);

  // always-on ambient motion so a beast is alive even between deliberate actions
  c.onIdle = (t, dt, env) => {
    // wing beats: gentle when resting, eager at play; base.js owns wing *actions*
    if (c.parts.wings.length && c.state !== 'action') {
      const winged = arch === 'avian' || arch === 'dragon' || arch === 'wyvern' || arch === 'insectoid';
      const playing = c.state === 'play' || c.state === 'happy';
      const flutter = (arch === 'insectoid') ? Math.sin(t * 18) * 0.6
        : playing ? Math.sin(t * 11) * 0.5
        : (c.state === 'walk' && winged) ? Math.sin(t * 6) * 0.22
        : Math.sin(t * 2) * 0.1;
      c.parts.wings.forEach(w => { w.rotation.z = (w.userData.side || 1) * flutter; });
    }
    // serpents and aquatics ripple their segmented bodies constantly
    if (arch === 'serpent' || arch === 'aquatic') {
      const amp = (c.state === 'walk') ? 0.16 : 0.1;
      c.body.children.forEach((s, i) => { if (s.geometry?.type === 'SphereGeometry') s.position.x = Math.sin(t * 3 + i * 0.6) * amp; });
    }
    // plants breathe with a slow sway in their leaves/trunk even at rest
    if (arch === 'plant' && c.parts.head) c.parts.head.rotation.z = Math.sin(t * 1.3) * 0.08;
    // amorphous oozers never hold still — a constant gelatinous wobble
    if (arch === 'amorphous' && c.state !== 'action') c.body.scale.x = c.body.scale.x * (1 + Math.sin(t * 3.5) * 0.015);
    // wisp emitters trail little motes as they go
    if (c._wisps && c.sparkleCb && Math.random() < dt * 1.2) c.sparkleCb(c.headWorld(), 2, P.spark || 0xbcd2ff);
  };
  return c;
}
