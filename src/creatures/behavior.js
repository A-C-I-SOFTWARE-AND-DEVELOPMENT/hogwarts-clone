// ─────────────────────────────────────────────────────────────────────────────
//  behavior.js — what makes the beasts feel ALIVE. Defines per-archetype
//  movement gaits + ambient action repertoires, and per-personality drives
//  (how active, how far they roam, what they seek). The base rig and the
//  parametric builder read these so no creature ever just sits there: birds
//  peck and flutter, serpents slither and tongue-flick, dragons snort and sweep,
//  insects skitter and hover, cats prowl and pounce, horses graze and toss.
// ─────────────────────────────────────────────────────────────────────────────

// gait = locomotion style; actions = short ambient behaviours it performs.
export const ARCHETYPES = {
  avian:     { gait: 'hop',     speed: 1.25, rest: 0.10, actions: ['peck', 'preen', 'flutter', 'hop', 'look'] },
  dragon:    { gait: 'stalk',   speed: 0.95, rest: 0.14, actions: ['snort', 'wingstretch', 'headsweep', 'tailswish', 'roar'] },
  wyvern:    { gait: 'stalk',   speed: 1.0,  rest: 0.14, actions: ['snort', 'wingstretch', 'headsweep', 'tailswish'] },
  serpent:   { gait: 'slither', speed: 1.1,  rest: 0.10, actions: ['tongue', 'coil', 'rise', 'look'] },
  insectoid: { gait: 'skitter', speed: 1.6,  rest: 0.06, actions: ['buzz', 'antennae', 'hover', 'dart'] },
  arachnid:  { gait: 'scuttle', speed: 1.4,  rest: 0.08, actions: ['legtap', 'scuttle', 'rear', 'antennae'] },
  amphibian: { gait: 'hop',     speed: 1.15, rest: 0.14, actions: ['throat', 'tongue', 'hop', 'blink'] },
  equine:    { gait: 'trot',    speed: 1.25, rest: 0.14, actions: ['graze', 'headtoss', 'tailswish', 'paw', 'rear'] },
  aquatic:   { gait: 'bob',     speed: 1.0,  rest: 0.16, actions: ['finflick', 'bob', 'splash', 'look'] },
  rodent:    { gait: 'scurry',  speed: 1.35, rest: 0.08, actions: ['snuffle', 'dig', 'situp', 'groom'] },
  beast:     { gait: 'prowl',   speed: 1.15, rest: 0.12, actions: ['prowl', 'groom', 'earswivel', 'tailflick', 'stretch', 'pounce'] },
  humanoid:  { gait: 'amble',   speed: 1.15, rest: 0.10, actions: ['gesture', 'hop', 'caper', 'look'] },
  plant:     { gait: 'root',    speed: 0.5,  rest: 0.30, actions: ['sway', 'reach', 'shiver'] },
  amorphous: { gait: 'drift',   speed: 0.85, rest: 0.20, actions: ['pulse', 'ooze', 'wobble', 'rise'] },
};

// personality drives — how busy the beast is and what it heads toward.
export const PERSONA = {
  curious: { activity: 0.88, roam: 1.4, speed: 1.1,  bias: 'explore' },
  playful: { activity: 0.96, roam: 1.15, speed: 1.3, bias: 'play' },
  shy:     { activity: 0.66, roam: 0.7,  speed: 0.9, bias: 'edge' },
  greedy:  { activity: 0.82, roam: 1.0,  speed: 1.0, bias: 'food' },
  calm:    { activity: 0.58, roam: 0.95, speed: 0.85, bias: 'graze' },
  brave:   { activity: 0.86, roam: 1.25, speed: 1.1, bias: 'center' },
};

export function archProfile(key) { return ARCHETYPES[key] || ARCHETYPES.beast; }
export function personaProfile(key) { return PERSONA[key] || PERSONA.curious; }

// pick a wander destination shaped by the beast's personality bias
export function chooseTarget(c, env, out) {
  const p = c.personaProfile || PERSONA.curious;
  const rng = c.rng;
  const bound = (env.bounds || 24) - 1.5;
  const home = c.home;
  let x, z;
  switch (p.bias) {
    case 'food': // head for the feeding trough now and then
      if (env.troughPos && rng() < 0.5) { x = env.troughPos.x + (rng() - 0.5) * 3; z = env.troughPos.z + (rng() - 0.5) * 3; break; }
    /* falls through to explore */
    case 'explore': { const a = rng() * Math.PI * 2, r = rng() * bound * 0.9; x = Math.cos(a) * r; z = Math.sin(a) * r; break; }
    case 'center': { const a = rng() * Math.PI * 2, r = rng() * bound * 0.4; x = Math.cos(a) * r; z = Math.sin(a) * r; break; }
    case 'edge': { const a = rng() * Math.PI * 2, r = bound * (0.7 + rng() * 0.3); x = Math.cos(a) * r; z = Math.sin(a) * r; break; }
    case 'graze':
    default: { const a = rng() * Math.PI * 2, r = rng() * (c.roam || 7) * p.roam; x = home.x + Math.cos(a) * r; z = home.z + Math.sin(a) * r; }
  }
  const d = Math.hypot(x, z); if (d > bound) { x *= bound / d; z *= bound / d; }
  out.set(x, 0, z);
  return out;
}
