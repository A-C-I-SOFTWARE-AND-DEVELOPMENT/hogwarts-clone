import { chromium } from 'playwright-core';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8099/index.html';
const PROXY = process.env.HTTPS_PROXY || '';

const logs = [], errors = [];
const browser = await chromium.launch({
  executablePath: EXE,
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--ignore-certificate-errors', '--no-sandbox',
    ...(PROXY ? ['--proxy-server=' + PROXY] : []),
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', m => { const t = m.text(); logs.push(m.type() + ': ' + t); if (m.type() === 'error') errors.push(t); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + (e.message || e)));
page.on('requestfailed', r => logs.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
} catch (e) { errors.push('GOTO: ' + e.message); }

// give it time to build the scene + reveal HUD
await page.waitForTimeout(9000);

const info = await page.evaluate(() => {
  const g = window.__game;
  const errShown = document.getElementById('err')?.classList.contains('show');
  const errCode = document.getElementById('errCode')?.textContent || '';
  const hudKids = document.getElementById('hud')?.children.length || 0;
  const loaderGone = document.getElementById('loader')?.classList.contains('gone');
  let beasts = null, live = null, active = null, coins = null, canvas = null;
  try {
    beasts = g?.state?.data?.beasts?.length;
    live = g?.director?.live?.size;
    active = g?.state?.active?.name + ' (' + g?.state?.active?.species + ')';
    coins = g?.state?.coins;
    canvas = !!document.querySelector('canvas');
  } catch (e) {}
  return { errShown, errCode, hudKids, loaderGone, beasts, live, active, coins, canvas, hasGame: !!g };
});

// dismiss onboarding to reveal the actual play UI, then screenshot
await page.evaluate(() => {
  const begin = document.querySelector('#intro .bigbtn');
  if (begin) begin.click();
});
await page.waitForTimeout(2500);

// try a care action to verify the loop responds
const action = await page.evaluate(() => {
  try {
    const g = window.__game;
    const before = JSON.stringify(g.state.active.needs);
    g.action('pet');
    g.action('feed', 'gold_coin');
    return { ok: true, before, after: JSON.stringify(g.state.active.needs), coins: g.state.coins };
  } catch (e) { return { ok: false, err: e.message }; }
});

await page.screenshot({ path: 'smoke-shot.png' });

console.log('=== SMOKE RESULT ===');
console.log(JSON.stringify(info, null, 2));
console.log('=== ACTION TEST ===');
console.log(JSON.stringify(action, null, 2));
console.log('=== ERRORS (' + errors.length + ') ===');
errors.slice(0, 30).forEach(e => console.log(e));
console.log('=== REQFAILS ===');
logs.filter(l => l.startsWith('REQFAIL')).slice(0, 10).forEach(l => console.log(l));

await browser.close();
