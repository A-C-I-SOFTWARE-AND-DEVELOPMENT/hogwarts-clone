// ─────────────────────────────────────────────────────────────────────────────
//  util.js — shared math, RNG, easing, colour and procedural-texture helpers.
//  No game logic here; everything is pure and dependency-light.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, v) => (b === a ? 0 : clamp((v - a) / (b - a)));
export const remap = (v, a, b, c, d) => lerp(c, d, invlerp(a, b, v));
export const smooth = (e0, e1, x) => { x = clamp((x - e0) / (e1 - e0)); return x * x * (3 - 2 * x); };
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export const wrap = (v, m) => ((v % m) + m) % m;

// Easing
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutElastic = t => {
  const c4 = TAU / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};
export const bounce = (t) => Math.abs(Math.sin(t * Math.PI));

// Deterministic seeded RNG (mulberry32) — reproducible scatter / variation
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rngRange = (rng, a, b) => a + (b - a) * rng();
export const rngInt = (rng, a, b) => Math.floor(a + (b - a + 1) * rng());
export const rngPick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// Colour helpers
export const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l);
export const mixCol = (a, b, t) => a.clone().lerp(b, t);

// 2-D hash noise (value noise, cheap, tileable-ish) — for CPU texture gen
export function valueNoise(x, y, seedHash = 1) {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = x - i, fy = y - j;
  const h = (a, b) => {
    let n = (a * 374761393 + b * 668265263 + seedHash * 1442695040) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  };
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4, seedHash = 1) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * valueNoise(x * freq, y * freq, seedHash + o * 17);
    norm += amp; amp *= 0.5; freq *= 2;
  }
  return sum / norm;
}

// Build a CanvasTexture from a per-pixel painter
export function paintTexture(size, painter, { repeat = 1, colorSpace = THREE.SRGBColorSpace } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  painter(img.data, size);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Fur / fuzz texture (soft mottled) used by furry creatures
export function furTexture(size, baseHex, tipHex, density = 0.55) {
  const base = new THREE.Color(baseHex), tip = new THREE.Color(tipHex);
  return paintTexture(size, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const f = fbm(x / n * 6, y / n * 6, 5, 7);
      const streak = valueNoise(x / n * 40, y / n * 4, 11);
      const t = clamp(f * 0.7 + streak * 0.5 * density);
      const col = base.clone().lerp(tip, t);
      const i = (y * n + x) * 4;
      d[i] = col.r * 255; d[i + 1] = col.g * 255; d[i + 2] = col.b * 255; d[i + 3] = 255;
    }
  });
}

// Normal map from a heightfield painter (returns {normal})
export function normalFromHeight(size, heightAt, strength = 2.2) {
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = heightAt(x, y, size);
  return paintTexture(size, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const l = h[y * n + ((x - 1 + n) % n)], r = h[y * n + ((x + 1) % n)];
      const u = h[((y - 1 + n) % n) * n + x], dn = h[((y + 1) % n) * n + x];
      const nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * n + x) * 4;
      d[i] = (nx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }, { colorSpace: THREE.NoColorSpace });
}

// Inject a fresnel rim-light (and optional soft cel quantization) into any
// MeshStandardMaterial via onBeforeCompile — keeps full PBR, shadows and IBL
// but adds the stylized backlit edge glow that reads as "premium cartoon".
export function applyRim(material, { color = 0xbfd4ff, strength = 0.32, power = 2.6, cel = 0 } = {}) {
  material.userData.rim = { color: new THREE.Color(color), strength, power, cel };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: material.userData.rim.color };
    shader.uniforms.uRimStrength = { value: material.userData.rim.strength };
    shader.uniforms.uRimPow = { value: material.userData.rim.power };
    shader.uniforms.uCel = { value: material.userData.rim.cel };
    shader.fragmentShader =
      'uniform vec3 uRimColor; uniform float uRimStrength,uRimPow,uCel;\n' + shader.fragmentShader;
    // soft cel-quantize the diffuse irradiance (optional, subtle)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
       if (uCel > 0.001) {
         float l = dot(reflectedLight.directDiffuse, vec3(0.299,0.587,0.114)) + 1e-4;
         float q = (floor(l * 3.0 + 0.5) / 3.0);
         reflectedLight.directDiffuse *= mix(1.0, q / l, uCel);
       }`
    );
    // fresnel rim added to the final lit colour
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rimDot = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
       outgoingLight += uRimColor * pow(rimDot, uRimPow) * uRimStrength;
       #include <opaque_fragment>`
    );
    material.userData.shader = shader;
  };
  return material;
}

// Standard "soft toon-ish" material used widely for creatures (warm, low metal)
export function creatureMat(hex, { rough = 0.72, metal = 0, map = null, normalMap = null, roughnessMap = null,
  emissive = 0x000000, emissiveIntensity = 0, rim = true, rimColor = 0xbfd4ff, rimStrength = 0.3 } = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: hex, roughness: rough, metalness: metal, map, normalMap, roughnessMap,
    emissive, emissiveIntensity, envMapIntensity: 0.8,
  });
  if (rim) applyRim(m, { color: rimColor, strength: rimStrength, power: 2.8 });
  return m;
}

// Small DOM helpers
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.append(c.nodeType ? c : document.createTextNode(c)));
  return n;
}

// Pretty number for currency
export const fmtNum = n => n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : String(Math.floor(n));
export const titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase()).replace(/_/g, ' ');

// Event bus — tiny pub/sub for decoupling systems
export function makeBus() {
  const map = new Map();
  return {
    on(ev, fn) { (map.get(ev) || map.set(ev, new Set()).get(ev)).add(fn); return () => map.get(ev)?.delete(fn); },
    off(ev, fn) { map.get(ev)?.delete(fn); },
    emit(ev, ...a) { map.get(ev)?.forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }); },
  };
}
