// behavior.mjs — verifies every creature is ALIVE: runs each species autonomously
// (no player commands) for a simulated stretch and checks it spends most of its
// time moving / performing archetype actions rather than sitting idle, that it
// actually travels across the ground, and that it cycles through several states.
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PROXY = process.env.HTTPS_PROXY || '';
const errs = [];
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors', '--no-sandbox', ...(PROXY ? ['--proxy-server=' + PROXY] : [])] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('pageerror', e => errs.push('PAGEERR: ' + (e.message || e)));
await p.addInitScript(() => localStorage.clear());
await p.goto('http://localhost:8099/index.html', { waitUntil: 'load', timeout: 45000 });
await p.waitForTimeout(8000);
await p.evaluate(() => document.querySelector('#intro .bigbtn')?.click());
await p.waitForTimeout(1200);

const res = await p.evaluate(async () => {
  const mod = await import('./src/creatures/index.js');
  const beh = await import('./src/creatures/behavior.js');
  const env = window.__game.world.envState();
  env.night = false; // daytime so we test active behaviour, not sleeping
  const PERSON = ['curious', 'playful', 'shy', 'greedy', 'calm', 'brave'];
  const out = [];
  for (const meta of mod.SPECIES_LIST) {
    try {
      const c = mod.buildCreature(meta.id, { x: 2, z: 2, seed: 7, needs: { hunger: 75, energy: 85, joy: 75, hygiene: 80 } });
      // give it a personality profile the way the director would
      c.personaProfile = beh.personaProfile(PERSON[(meta.id.length) % PERSON.length]);
      const hist = {}; let lastX = c.pos.x, lastZ = c.pos.z, dist = 0; const actions = new Set();
      const T = 60, dt = 0.05; // 60s of life
      for (let i = 0; i < T / dt; i++) {
        c.update(i * dt, dt, env);
        hist[c.state] = (hist[c.state] || 0) + 1;
        if (c.state === 'action') actions.add(c.action);
        dist += Math.hypot(c.pos.x - lastX, c.pos.z - lastZ); lastX = c.pos.x; lastZ = c.pos.z;
      }
      const frames = T / dt;
      const idlePct = (hist.idle || 0) / frames;
      const sleepPct = (hist.sleep || 0) / frames;
      const movingPct = ((hist.walk || 0) + (hist.action || 0) + (hist.play || 0)) / frames;
      out.push({
        id: meta.id, arch: c.archetype, idlePct: +idlePct.toFixed(2), sleepPct: +sleepPct.toFixed(2),
        movingPct: +movingPct.toFixed(2), dist: +dist.toFixed(1), nActions: actions.size,
        states: Object.keys(hist).length,
      });
      c.dispose();
    } catch (e) { out.push({ id: meta.id, err: e.message }); }
  }
  return out;
});

let bad = 0;
for (const r of res) {
  if (r.err) { console.log('  ✗', r.id, r.err); bad++; continue; }
  // "alive" criteria: idle < 30% of the time, it travelled, and it used >1 state
  const alive = r.idlePct < 0.30 && r.dist > 1.0 && r.movingPct > 0.5 && r.states >= 3;
  if (!alive) { bad++; console.log('  ✗ NOT ALIVE', r.id, JSON.stringify(r)); }
}
// summary stats
const ok = res.filter(r => !r.err);
const avg = k => (ok.reduce((s, r) => s + r[k], 0) / ok.length).toFixed(2);
console.log('SPECIES:', res.length, ' NOT-ALIVE/ERR:', bad);
console.log('avg idle%:', avg('idlePct'), ' avg moving%:', avg('movingPct'), ' avg dist:', avg('dist'), ' avg distinct actions:', avg('nActions'));
console.log('PAGE ERRORS:', errs.length); errs.slice(0, 8).forEach(e => console.log('  ' + e));
await b.close();
process.exit(bad > 0 || errs.length ? 1 : 0);
