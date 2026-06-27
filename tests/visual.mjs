import { chromium } from 'playwright-core';
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8099/index.html';
const PROXY = process.env.HTTPS_PROXY || '';

const errors = [];
const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--ignore-certificate-errors', '--no-sandbox',
    ...(PROXY ? ['--proxy-server=' + PROXY] : [])],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 });
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.message || e)));
page.on('console', m => { if (m.type() === 'error' && !/fonts.googleapis|favicon/.test(m.text())) errors.push(m.text()); });

await page.addInitScript(() => localStorage.clear());
await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(7000);
// dismiss onboarding
await page.evaluate(() => document.querySelector('#intro .bigbtn')?.click());
await page.waitForTimeout(2500);

async function frame(fn) { await page.evaluate(fn); await page.waitForTimeout(1400); }

// 1) HERO — midday, clear, framed north toward the castle
await frame(() => {
  const g = window.__game; g.setTime(11); g.setTimePaused(true); g.setWeather('clear');
  g.controls.autoRotate = false;
  g.stage.camera.position.set(3, 6, 17);
  g.controls.target.set(0, 1.6, 0);
  g.controls.update();
});
await page.waitForTimeout(800);
await page.screenshot({ path: 'shot-1-hero.png' });

// 1b) WIDE establishing — pull back & up to see the castle on the grounds
await frame(() => {
  const g = window.__game;
  g.stage.camera.position.set(5, 10, 19);
  g.controls.target.set(-2, 2.5, -14);
  g.controls.update();
});
await page.waitForTimeout(700);
await page.screenshot({ path: 'shot-1b-wide.png' });

// 2) CLOSEUP on the active beast (verify the model)
await frame(() => {
  const g = window.__game; const c = g.director.liveActive();
  const p = c.group.position;
  g.controls.autoRotate = false;
  g.stage.camera.position.set(p.x + 2.2, p.y + 2.0, p.z + 3.4);
  g.controls.target.set(p.x, p.y + 1.0, p.z);
  g.controls.update();
});
await page.screenshot({ path: 'shot-2-closeup.png' });

// 3) SANCTUARY modal
await frame(() => window.__game.ui.openSanctuary());
await page.screenshot({ path: 'shot-3-sanctuary.png' });
await frame(() => window.__game.ui.close());

// 4) MENAGERIE — grant coins, adopt several, pull camera back
const adopted = await page.evaluate(() => {
  const g = window.__game; g.state.addCoins(5000);
  ['mooncalf', 'puffskein', 'kneazle', 'fwooper', 'graphorn'].forEach(s => g.adopt(s));
  g.setActive(g.state.data.beasts[0].id);
  g.controls.autoRotate = false;
  g.stage.camera.position.set(1, 9, 16);
  g.controls.target.set(0, 1.2, 1);
  g.controls.update();
  return { beasts: g.state.data.beasts.length, live: g.director.live.size };
});
await page.waitForTimeout(1600);
await page.screenshot({ path: 'shot-4-menagerie.png' });

// 5) NIGHT
await frame(() => { const g = window.__game; g.setTime(22); g.setTimePaused(true); g.stage.camera.position.set(4, 7, 16); g.controls.target.set(0, 1.5, 1.5); g.controls.update(); });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shot-5-night.png' });

const summary = await page.evaluate(() => ({ beasts: window.__game.state.data.beasts.length, live: window.__game.director.live.size, coins: window.__game.state.coins }));
console.log('SUMMARY', JSON.stringify(summary), '| adopted', JSON.stringify(adopted));
console.log('ERRORS', errors.length); errors.slice(0, 20).forEach(e => console.log(' -', e));
await browser.close();
