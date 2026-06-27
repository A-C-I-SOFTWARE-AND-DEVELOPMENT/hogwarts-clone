// ─────────────────────────────────────────────────────────────────────────────
//  genetics.js — genes, growth stages and trait inheritance. Every beast carries
//  a small gene set (colour shift, size, personality, rare shiny/pattern) that
//  varies its look and behaviour. Breeding mixes two parents' genes with
//  dominant/recessive rules and a mutation chance (à la Palworld/Niche).
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';

export const PERSONALITIES = {
  curious:  { label: 'Curious',  emoji: '🔎', produce: 1.0,  joyDecay: 1.0,  speed: 1.1,  blurb: 'Always exploring its habitat.' },
  playful:  { label: 'Playful',  emoji: '🎈', produce: 1.0,  joyDecay: 1.15, speed: 1.2,  blurb: 'Bounds about and loves to play.' },
  shy:      { label: 'Shy',      emoji: '🌙', produce: 0.95, joyDecay: 0.85, speed: 0.85, blurb: 'Keeps to the quiet corners.' },
  greedy:   { label: 'Greedy',   emoji: '🪙', produce: 1.3,  joyDecay: 1.1,  speed: 1.0,  blurb: 'Produces more — but always hungry.' },
  calm:     { label: 'Calm',     emoji: '🍃', produce: 1.05, joyDecay: 0.8,  speed: 0.9,  blurb: 'Serene and easy to keep content.' },
  brave:    { label: 'Brave',    emoji: '⚔️', produce: 1.1,  joyDecay: 0.95, speed: 1.05, blurb: 'Bold and unflappable.' },
};
export const PERSONALITY_KEYS = Object.keys(PERSONALITIES);

export const PATTERNS = ['plain', 'spotted', 'pale', 'dusky', 'dappled'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// neutral genes (legacy saves / fallback)
export function neutralGenes() {
  return { hue: 0, light: 1, sizeMod: 1, personality: 'curious', shiny: false, pattern: 'plain' };
}

// wild-caught: gentle natural variation
export function randomGenes() {
  return {
    hue: rnd(-0.04, 0.04),
    light: rnd(0.9, 1.12),
    sizeMod: rnd(0.9, 1.1),
    personality: pick(PERSONALITY_KEYS),
    shiny: Math.random() < 0.02,
    pattern: Math.random() < 0.35 ? pick(PATTERNS) : 'plain',
  };
}

// breed two parents -> child genes (dominant/recessive + mutation)
export function rollGenes(a = neutralGenes(), b = neutralGenes()) {
  const mut = () => Math.random();
  const inheritNum = (x, y, lo, hi, mAmt) => {
    let v = Math.random() < 0.5 ? x : y;
    v = lerp(v, (x + y) / 2, 0.3);                 // blend toward midpoint
    if (mut() < 0.16) v += rnd(-mAmt, mAmt);       // mutation
    return clamp(v, lo, hi);
  };
  // shiny is recessive-ish: needs both, or a lucky carrier, or rare mutation
  let shiny = false;
  if (a.shiny && b.shiny) shiny = Math.random() < 0.8;
  else if (a.shiny || b.shiny) shiny = Math.random() < 0.25;
  else shiny = Math.random() < 0.02;

  let hue = inheritNum(a.hue, b.hue, -0.5, 0.5, 0.18);
  if (mut() < 0.06) hue = rnd(-0.5, 0.5);          // rare big colour morph

  return {
    hue,
    light: inheritNum(a.light, b.light, 0.78, 1.28, 0.12),
    sizeMod: inheritNum(a.sizeMod, b.sizeMod, 0.78, 1.25, 0.12),
    personality: mut() < 0.12 ? pick(PERSONALITY_KEYS) : (Math.random() < 0.5 ? a.personality : b.personality),
    shiny,
    pattern: Math.random() < 0.5 ? (a.pattern || 'plain') : (b.pattern || 'plain'),
  };
}

// ── growth stages ──
export function stageOf(level) {
  if (level <= 2) return { key: 'baby', name: 'Baby', scale: 0.62, emoji: '🥚' };
  if (level <= 7) return { key: 'juvenile', name: 'Juvenile', scale: 0.82, emoji: '🌱' };
  if (level <= 14) return { key: 'adult', name: 'Adult', scale: 1.0, emoji: '⭐' };
  return { key: 'elder', name: 'Elder', scale: 1.08, emoji: '👑' };
}

// apply a beast's genes + growth to its live creature (HSL shift + scale + shiny)
export function applyGenesToCreature(creature, genes, level = 1) {
  const g = genes || neutralGenes();
  const stage = stageOf(level);
  creature.stageScale = stage.scale;
  creature.sizeMod = g.sizeMod;
  creature.group.scale.setScalar(creature.scaleMul * g.sizeMod * stage.scale);

  const hsl = { h: 0, s: 0, l: 0 };
  creature.group.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if (!m.color || m.userData._genesApplied) return;
      m.userData._genesApplied = true;
      m.color.getHSL(hsl);
      m.color.setHSL((hsl.h + g.hue + 1) % 1, clamp(hsl.s * (g.pattern === 'pale' ? 0.7 : 1), 0, 1), clamp(hsl.l * g.light, 0, 1));
      if (g.shiny) { m.emissive = m.emissive || new THREE.Color(); m.emissive.setHSL((hsl.h + g.hue + 0.5) % 1, 0.6, 0.18); m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.35); }
    });
  });
  if (g.shiny && creature.sparkleCb) creature._shinyAura = true;
}

export function describeGenes(genes, level) {
  const g = genes || neutralGenes();
  const p = PERSONALITIES[g.personality] || PERSONALITIES.curious;
  const bits = [];
  bits.push(stageOf(level).name);
  bits.push(p.emoji + ' ' + p.label);
  if (g.shiny) bits.push('✨ Shiny');
  if (g.sizeMod > 1.12) bits.push('Runt? no — Large');
  else if (g.sizeMod < 0.9) bits.push('Tiny');
  if (g.pattern && g.pattern !== 'plain') bits.push(g.pattern[0].toUpperCase() + g.pattern.slice(1));
  return bits;
}

export function personalityOf(genes) {
  return PERSONALITIES[(genes && genes.personality) || 'curious'] || PERSONALITIES.curious;
}
