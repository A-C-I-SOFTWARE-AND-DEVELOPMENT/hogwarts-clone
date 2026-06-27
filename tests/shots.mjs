// shots.mjs — small, viewable screenshots for visual self-assessment.
// Usage: node tests/shots.mjs [tag]   → writes /tmp scratch shot-<tag>-*.png
import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PROXY = process.env.HTTPS_PROXY || '';
const TAG = process.argv[2] || 'cur';
const OUT = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-hogwarts-clone/37333efe-e924-5a58-b8d2-d68db9be46b0/scratchpad';
const errs = [];
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--ignore-certificate-errors', '--no-sandbox', ...(PROXY ? ['--proxy-server=' + PROXY] : [])] });
const p = await b.newPage({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 1 });
p.on('pageerror', e => errs.push('PAGEERR: ' + (e.message || e)));
p.on('console', m => { if (m.type() === 'error' && !/fonts.googleapis|favicon/.test(m.text())) errs.push(m.text()); });
await p.addInitScript(() => localStorage.clear());
const SPECIES = (process.env.SHOT_SPECIES || '').split(',').filter(Boolean);
if (SPECIES.length) await p.addInitScript((sp) => { window.__SPECIES = sp; }, SPECIES);
await p.goto('http://localhost:8099/index.html', { waitUntil: 'load', timeout: 45000 });
await p.waitForTimeout(7000);
await p.evaluate(() => document.querySelector('#intro .bigbtn')?.click());
await p.waitForTimeout(1500);
// populate the paddock with a few visually-distinct beasts
await p.evaluate(() => {
  const g = window.__game; g.state.addCoins(999999);
  const want = (window.__SPECIES || ['unicorn', 'phoenix', 'niffler', 'hippogriff', 'kneazle', 'mooncalf']);
  want.forEach(s => { try { g.state.rescue(s, null, true); } catch (e) {} });
  // grow them to adult + full needs so we judge the real design, not baby scale
  g.state.data.beasts.forEach(b => { b.level = 12; b.needs = { hunger: 90, energy: 90, joy: 90, hygiene: 90 }; });
  g.director.sync();
  // force-place them in a tidy front-facing row so each is clearly visible
  let i = 0; const live = [...g.director.live.values()];
  for (const c of live) { const x = (i - (live.length - 1) / 2) * 3.2; c.pos.set(x, 0, 2); c.home.set(x, 0, 2); c.target.set(x, 0, 2); c.heading = 0; c.faceAngle = 0; c.enter('idle', 999); c.nextDecision = 999; i++; }
  window.__live = live;
});
await p.waitForTimeout(1500);

// hide UI chrome once so we judge the 3D, not the HUD
await p.evaluate(() => {
  const s = document.createElement('style');
  s.textContent = '#hud,.topbar,#beastCard,.dock,.tray,#toasts,.hud,header,footer{opacity:0 !important;pointer-events:none}';
  document.head.appendChild(s);
});
async function shot(name, setup) {
  try {
    await p.evaluate(setup);
    await p.waitForTimeout(1500);
    const path = `${OUT}/shot-${TAG}-${name}.png`;
    await p.screenshot({ path, timeout: 60000, animations: 'disabled', caret: 'hide' });
    console.log('wrote', path);
  } catch (e) { console.log('SHOT FAIL', name, e.message.split('\n')[0]); }
}

// golden-hour establishing
await shot('golden', () => {
  const g = window.__game; g.setTime(17.6); g.setTimePaused?.(true); g.setWeather('clear');
  if (g.controls) { g.controls.autoRotate = false; }
  g.stage.camera.position.set(6, 7.5, 20); g.controls?.target.set(0, 1.4, 0); g.controls?.update();
});
// midday wide toward the castle
await shot('midday', () => {
  const g = window.__game; g.setTime(11);
  g.stage.camera.position.set(-2, 12, 22); g.controls?.target.set(-3, 2, -10); g.controls?.update();
});
// night
await shot('night', () => {
  const g = window.__game; g.setTime(22.5);
  g.stage.camera.position.set(5, 6, 16); g.controls?.target.set(0, 1.2, 0); g.controls?.update();
});
// front lineup of all creatures (judge silhouettes)
await shot('lineup', () => {
  const g = window.__game; g.setTime(14); g.setTimePaused?.(true);
  g.stage.camera.position.set(0, 3.2, 13); g.controls?.target.set(0, 1.1, 2); g.controls?.update();
});
// creature close-up — front 3/4 of the first beast
await shot('closeup', () => {
  const g = window.__game; g.setTime(15);
  const c = (window.__live || [...g.director.live.values()])[0];
  if (c) { const pos = c.group.position; g.stage.camera.position.set(pos.x - 2.2, pos.y + 0.8, pos.z + 2.8); g.controls?.target.set(pos.x, pos.y + 0.45, pos.z); g.controls?.update(); }
});
console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('  ' + e));
await b.close();
