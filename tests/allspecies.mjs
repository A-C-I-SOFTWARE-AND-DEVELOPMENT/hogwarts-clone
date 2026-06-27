import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PROXY = process.env.HTTPS_PROXY || '';
const errors = [];
const b = await chromium.launch({ executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--ignore-certificate-errors','--no-sandbox', ...(PROXY?['--proxy-server='+PROXY]:[])] });
const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
p.on('pageerror', e => errors.push('PAGEERROR: ' + (e.message || e)));
p.on('console', m => { if (m.type() === 'error' && !/fonts|favicon/.test(m.text())) errors.push(m.text()); });
await p.addInitScript(() => localStorage.clear());
await p.goto('http://localhost:8099/index.html', { waitUntil: 'load', timeout: 45000 });
await p.waitForTimeout(7000);
await p.evaluate(() => document.querySelector('#intro .bigbtn')?.click());
await p.waitForTimeout(1500);
// build every species individually and run a few update frames
const result = await p.evaluate(async () => {
  const mod = await import('./src/creatures/index.js');
  const out = [];
  const env = window.__game.world.envState();
  for (const meta of mod.SPECIES_LIST) {
    try {
      const c = mod.buildCreature(meta.id, { x: 0, z: 0, seed: 3, needs: { hunger: 70, energy: 70, joy: 70, hygiene: 70 } });
      // run 30 update ticks across states
      for (let i = 0; i < 30; i++) { c.update(i * 0.1, 0.1, env); if (i === 5) c.command('eat', 1); if (i === 12) c.command('play', 1); if (i === 20) c.command('sleep', 1); }
      let count = 0; c.group.traverse(o => { if (o.isMesh) count++; });
      out.push({ id: meta.id, ok: true, meshes: count });
      c.dispose();
    } catch (e) { out.push({ id: meta.id, ok: false, err: e.message }); }
  }
  return out;
});
console.log('SPECIES BUILD CHECK:');
result.forEach(r => console.log(' ', r.ok ? '✓' : '✗', r.id, r.ok ? `(${r.meshes} meshes)` : r.err));
console.log('FAILS:', result.filter(r => !r.ok).length);
console.log('PAGE ERRORS:', errors.length); errors.slice(0, 15).forEach(e => console.log('  -', e));
await b.close();
