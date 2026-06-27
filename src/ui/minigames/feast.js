// ─────────────────────────────────────────────────────────────────────────────
//  feast.js — "Feeding Frenzy" catch mini-game for Hogwarts Beasts.
//  Self-contained overlay: pure DOM + Canvas + rAF. No external libs, no assets.
//
//    export function playFeast(opts = {}) -> Promise<{success,score,accuracy,reward}>
//
//  opts = { beastName, difficulty:1|2|3, themeColor:'#rrggbb', onResult?:fn }
//
//  Treats fall; the beast's bowl slides L/R (drag or ← → / A D) to catch them.
//  Good treats score (with combo multiplier); bad items cost points. 25s timer.
// ─────────────────────────────────────────────────────────────────────────────

// Tiny inlined helpers (kept local so the module stays free of the three.js
// pull-in that lives in core/util.js).
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else if (k === 'html') n.innerHTML = attrs[k];
    else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'style') n.style.cssText = attrs[k];
    else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c => c && n.append(c.nodeType ? c : document.createTextNode(c)));
  return n;
}

// hex -> {r,g,b}
function hexRgb(hex) {
  let h = (hex || '#c9a24b').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const rgba = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`;

export function playFeast(opts = {}) {
  const beastName = opts.beastName || 'the beast';
  const difficulty = clamp(Math.round(opts.difficulty || 1), 1, 3);
  const theme = hexRgb(opts.themeColor || '#c9a24b');
  const onResult = typeof opts.onResult === 'function' ? opts.onResult : null;

  return new Promise((resolve) => {
    // ── Tunables scaled by difficulty ────────────────────────────────────────
    const DURATION = 25;                                   // seconds
    const spawnEvery = [0.78, 0.60, 0.46][difficulty - 1]; // seconds between spawns
    const fallBase = [180, 230, 290][difficulty - 1];      // px/s baseline fall speed
    const fallVar = [120, 160, 210][difficulty - 1];       // px/s extra variance
    const badChance = [0.16, 0.22, 0.28][difficulty - 1];  // fraction of spawns that are bad
    const threshold = [22, 30, 38][difficulty - 1];        // score needed to succeed

    const GOOD = ['🍎', '🍯', '🍬', '🪙', '🐟', '🫐'];
    const BAD = ['🪨', '🥀'];

    // ── DOM scaffold ─────────────────────────────────────────────────────────
    const overlay = el('div', { class: 'feast-overlay', role: 'dialog', 'aria-label': 'Feeding mini-game' });
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:120', 'display:flex',
      'align-items:center', 'justify-content:center', 'padding:16px',
      'background:rgba(6,5,12,.72)', 'backdrop-filter:blur(5px)',
      '-webkit-backdrop-filter:blur(5px)',
      "font-family:'EB Garamond',Georgia,serif", 'color:#e8dcc0',
      'touch-action:none', '-webkit-user-select:none', 'user-select:none',
      'opacity:0', 'transition:opacity .25s ease',
    ].join(';');

    const panel = el('div', { class: 'feast-panel' });
    panel.style.cssText = [
      'position:relative', 'width:min(560px,96vw)', 'max-height:96vh',
      'display:flex', 'flex-direction:column', 'gap:10px',
      'padding:16px 16px 18px', 'border-radius:18px',
      'border:1px solid rgba(201,162,75,.30)',
      'background:linear-gradient(180deg,rgba(20,18,28,.96),rgba(10,8,16,.97))',
      'box-shadow:0 30px 80px rgba(0,0,0,.7)',
      `--theme:${rgba(theme, 1)}`,
      'transform:scale(.94)', 'transition:transform .3s cubic-bezier(.2,.9,.3,1.1)',
    ].join(';');

    // Header: title + score + quit
    const title = el('div', {
      class: 'cz', text: `Feed ${beastName}!`,
      style: "font-family:'Cinzel',serif;font-weight:700;font-size:clamp(1.05rem,4.4vw,1.35rem);" +
        'letter-spacing:.04em;color:#ead9a0;line-height:1.1;flex:1;min-width:0;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
    });

    const scoreVal = el('b', { text: '0', style: 'color:#ead9a0;font-variant-numeric:tabular-nums' });
    const scorePill = el('div', {
      style: 'display:flex;align-items:center;gap:6px;background:rgba(11,10,18,.74);' +
        'border:1px solid rgba(201,162,75,.30);border-radius:999px;padding:6px 13px;white-space:nowrap',
    }, [
      el('span', { text: '🍽️', style: 'font-size:1rem' }),
      scoreVal,
      el('span', {
        text: 'pts',
        style: "font-size:.6rem;letter-spacing:.12em;color:#8c7438;text-transform:uppercase;font-family:'Cinzel',serif",
      }),
    ]);

    const comboPill = el('div', {
      text: '',
      style: 'display:none;align-items:center;gap:4px;border-radius:999px;padding:6px 12px;white-space:nowrap;' +
        "font-family:'Cinzel',serif;font-size:.78rem;font-weight:700;" +
        `color:${rgba(theme, 1)};border:1px solid ${rgba(theme, .55)};background:${rgba(theme, .12)}`,
    });

    const quitBtn = el('button', {
      type: 'button', 'aria-label': 'Quit mini-game', text: '✕ Quit',
      style: "font-family:'Cinzel',serif;font-size:.74rem;letter-spacing:.05em;color:#e8dcc0;" +
        'border:1px solid rgba(201,162,75,.30);border-radius:10px;padding:9px 14px;' +
        'min-height:40px;background:rgba(11,10,18,.6);cursor:pointer',
    });
    quitBtn.addEventListener('mouseenter', () => { quitBtn.style.borderColor = 'rgba(201,162,75,.6)'; });
    quitBtn.addEventListener('mouseleave', () => { quitBtn.style.borderColor = 'rgba(201,162,75,.30)'; });

    const header = el('div', {
      style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap',
    }, [title, scorePill, comboPill, quitBtn]);

    // Timer / progress bar
    const timeFill = el('i', {
      style: `position:absolute;left:0;top:0;height:100%;width:100%;border-radius:6px;` +
        `background:linear-gradient(90deg,${rgba(theme, .85)},#ead9a0);transition:width .12s linear`,
    });
    const timeBar = el('div', {
      style: 'position:relative;height:8px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden',
    }, [timeFill]);

    // Canvas play-field
    const stage = el('div', {
      style: 'position:relative;width:100%;border-radius:14px;overflow:hidden;' +
        'border:1px solid rgba(201,162,75,.18);' +
        'background:radial-gradient(120% 90% at 50% 0%,#1b1730,#0a0613);touch-action:none',
    });
    const canvas = el('canvas', { style: 'display:block;width:100%;height:100%' });
    stage.append(canvas);

    // hint line
    const hint = el('div', {
      text: 'Drag, or use ← → / A D — catch treats, dodge 🪨 & 🥀',
      style: 'text-align:center;font-style:italic;font-size:.76rem;color:#9c8e6e;line-height:1.3',
    });

    // popup layer (DOM score pops over canvas)
    const popLayer = el('div', { style: 'position:absolute;inset:0;pointer-events:none;overflow:hidden' });
    stage.append(popLayer);

    panel.append(header, timeBar, stage, hint);
    overlay.append(panel);
    document.body.append(overlay);

    // ── Canvas sizing (responsive, retina) ───────────────────────────────────
    const ctx = canvas.getContext('2d');
    let DPR = 1, W = 0, H = 0;
    function resize() {
      // target ~4:3-ish but bounded by available height
      const maxW = Math.min(panel.clientWidth - 2, 540);
      const maxH = Math.min(window.innerHeight * 0.62, 460);
      let cw = maxW;
      let ch = Math.min(maxH, Math.round(cw * 1.05));
      if (ch < 240) ch = Math.max(220, Math.min(maxH, 240));
      stage.style.height = ch + 'px';
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cw; H = ch;
      canvas.width = Math.round(cw * DPR);
      canvas.height = Math.round(ch * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      bowl.x = clamp(bowl.x, bowl.w / 2, W - bowl.w / 2);
    }

    // ── Game state ───────────────────────────────────────────────────────────
    const bowl = { x: 0, w: 96, h: 60, vx: 0, targetX: 0 };
    let treats = [];     // {x,y,vx,vy,emoji,good,rot,spin,size,caught,missAnim}
    let bursts = [];     // canvas particle bursts {x,y,vx,vy,life,max,col,size}
    let score = 0;
    let combo = 0;       // consecutive good catches
    let bestCombo = 0;
    let spawnedGood = 0;
    let caughtGood = 0;
    let timeLeft = DURATION;
    let spawnTimer = 0;
    let shake = 0;
    let bowlPulse = 0;   // catch squash animation 0..1
    let rngSeed = 2;
    const rng = () => {
      rngSeed |= 0; rngSeed = (rngSeed + 0x6D2B79F5) | 0;
      let t = Math.imul(rngSeed ^ (rngSeed >>> 15), 1 | rngSeed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    let running = true;
    let finished = false;
    let rafId = 0;
    let last = 0;
    const keys = { left: false, right: false };
    const timeouts = new Set();
    const safeTimeout = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); return id; };

    // ── Input ────────────────────────────────────────────────────────────────
    let dragging = false;
    function stageX(clientX) {
      const r = stage.getBoundingClientRect();
      return clamp(clientX - r.left, 0, W);
    }
    function onPointerDown(e) {
      dragging = true;
      bowl.targetX = stageX(e.clientX);
      if (stage.setPointerCapture && e.pointerId != null) {
        try { stage.setPointerCapture(e.pointerId); } catch (_) { }
      }
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      bowl.targetX = stageX(e.clientX);
      e.preventDefault();
    }
    function onPointerUp() { dragging = false; }
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);

    function onKeyDown(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
      else if (e.key === 'Escape') { e.preventDefault(); endGame(false); }
    }
    function onKeyUp(e) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);

    quitBtn.addEventListener('click', () => endGame(false));

    // ── Spawning ─────────────────────────────────────────────────────────────
    function spawn() {
      const good = rng() > badChance;
      const emoji = good ? GOOD[(rng() * GOOD.length) | 0] : BAD[(rng() * BAD.length) | 0];
      const size = good ? 30 + rng() * 8 : 30 + rng() * 6;
      const x = lerp(size, W - size, rng());
      const vy = fallBase + rng() * fallVar + (good ? 0 : 20);
      treats.push({
        x, y: -size, vx: (rng() - 0.5) * 26, vy,
        emoji, good, size,
        rot: rng() * TAU, spin: (rng() - 0.5) * 2.2,
        caught: false, dead: false,
      });
      if (good) spawnedGood++;
    }

    // ── Catch resolution ─────────────────────────────────────────────────────
    function popText(text, x, y, col, big) {
      const p = el('div', {
        text,
        style: "position:absolute;font-family:'Cinzel',serif;font-weight:700;pointer-events:none;" +
          `left:${x}px;top:${y}px;transform:translate(-50%,-50%);color:${col};` +
          `font-size:${big ? 1.25 : 0.95}rem;text-shadow:0 2px 8px rgba(0,0,0,.7);` +
          'will-change:transform,opacity;transition:transform .65s cubic-bezier(.2,.8,.2,1),opacity .65s ease',
      });
      popLayer.append(p);
      requestAnimationFrame(() => {
        p.style.transform = 'translate(-50%,-150%) scale(1.15)';
        p.style.opacity = '0';
      });
      safeTimeout(() => p.remove(), 680);
    }

    function burst(x, y, col, n) {
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const sp = 60 + rng() * 160;
        bursts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: 0, max: 0.5 + rng() * 0.3, size: 2 + rng() * 3, col,
        });
      }
    }

    function catchTreat(t) {
      t.dead = true;
      const cx = t.x, cy = bowl.y - bowl.h * 0.4;
      if (t.good) {
        combo++;
        bestCombo = Math.max(bestCombo, combo);
        caughtGood++;
        const mult = 1 + Math.floor(combo / 3); // x1, then x2 at 3 streak, x3 at 6, ...
        const gain = mult;
        score += gain;
        bowlPulse = 1;
        burst(cx, cy, rgba(theme, 1), 12 + combo);
        popText('+' + gain + (mult > 1 ? ` ×${mult}` : ''), cx, cy, '#ead9a0', mult > 1);
        flashCombo();
      } else {
        combo = 0;
        score = Math.max(0, score - 2);
        shake = 1;
        burst(cx, cy, 'rgba(216,90,90,1)', 14);
        popText('−2', cx, cy, '#d85a5a', true);
        comboPill.style.display = 'none';
      }
      updateHud();
    }

    function flashCombo() {
      if (combo >= 2) {
        const mult = 1 + Math.floor(combo / 3);
        comboPill.textContent = mult > 1 ? `🔥 Combo ×${mult}` : `🔥 Combo ${combo}`;
        comboPill.style.display = 'flex';
        comboPill.style.transform = 'scale(1.18)';
        requestAnimationFrame(() => { comboPill.style.transition = 'transform .25s cubic-bezier(.2,.9,.3,1.1)'; comboPill.style.transform = 'scale(1)'; });
      }
    }

    function updateHud() {
      scoreVal.textContent = String(score);
    }

    // ── Main loop ────────────────────────────────────────────────────────────
    function frame(ts) {
      if (!running) return;
      if (!last) last = ts;
      let dt = (ts - last) / 1000;
      last = ts;
      dt = Math.min(dt, 0.05); // clamp big gaps

      // timer
      timeLeft -= dt;
      if (timeLeft <= 0) { timeLeft = 0; update(0); render(); endGame(score >= threshold); return; }

      update(dt);
      render();
      rafId = requestAnimationFrame(frame);
    }

    function update(dt) {
      // spawn
      spawnTimer -= dt;
      if (spawnTimer <= 0 && timeLeft > 0.4) {
        spawn();
        // slight ramp: spawn a touch faster as time runs out
        const ramp = lerp(1, 0.78, 1 - timeLeft / DURATION);
        spawnTimer = spawnEvery * ramp * (0.8 + rng() * 0.5);
      }

      // bowl movement: keyboard nudges target, drag sets target, ease toward it
      const kbSpeed = 620;
      if (keys.left) bowl.targetX -= kbSpeed * dt;
      if (keys.right) bowl.targetX += kbSpeed * dt;
      bowl.targetX = clamp(bowl.targetX, bowl.w / 2, W - bowl.w / 2);
      const nx = lerp(bowl.x, bowl.targetX, 1 - Math.exp(-18 * dt));
      bowl.vx = (nx - bowl.x) / Math.max(dt, 1e-4);
      bowl.x = nx;
      bowl.y = H - 14;

      if (bowlPulse > 0) bowlPulse = Math.max(0, bowlPulse - dt * 3.2);
      if (shake > 0) shake = Math.max(0, shake - dt * 2.6);

      // treats
      const catchTop = bowl.y - bowl.h;       // mouth height
      const catchHalf = bowl.w * 0.5;
      for (const t of treats) {
        if (t.dead) continue;
        t.vy += 60 * dt; // mild gravity for juice
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        t.rot += t.spin * dt;
        if (t.x < t.size * 0.5) { t.x = t.size * 0.5; t.vx = Math.abs(t.vx); }
        if (t.x > W - t.size * 0.5) { t.x = W - t.size * 0.5; t.vx = -Math.abs(t.vx); }

        // catch test: treat enters bowl mouth region
        if (t.y >= catchTop && t.y <= bowl.y + 6 && Math.abs(t.x - bowl.x) <= catchHalf) {
          catchTreat(t);
          continue;
        }
        // missed off bottom
        if (t.y - t.size > H) {
          t.dead = true;
          if (t.good) combo = 0; // breaking streak on a missed good treat
          if (t.good) { comboPill.style.display = 'none'; }
        }
      }
      treats = treats.filter(t => !t.dead);

      // bursts
      for (const b of bursts) {
        b.life += dt;
        b.vy += 280 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      bursts = bursts.filter(b => b.life < b.max);

      // hud bar
      timeFill.style.width = (timeLeft / DURATION * 100) + '%';
    }

    function render() {
      ctx.clearRect(0, 0, W, H);

      // background wash + soft theme glow at bottom (where bowl is)
      const g = ctx.createRadialGradient(W / 2, H, H * 0.1, W / 2, H, H * 0.9);
      g.addColorStop(0, rgba(theme, 0.16));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // faint falling guide lines / sparkle dots for depth
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#ead9a0';
      for (let i = 0; i < 6; i++) {
        const px = ((i * 97.13 + (last * 0.01)) % W);
        const py = ((i * 53.7 + (last * 0.03)) % H);
        ctx.beginPath(); ctx.arc(px, py, 1.4, 0, TAU); ctx.fill();
      }
      ctx.restore();

      // screen shake offset
      let sx = 0, sy = 0;
      if (shake > 0) {
        const m = shake * 6;
        sx = (rng() - 0.5) * m; sy = (rng() - 0.5) * m;
      }
      ctx.save();
      ctx.translate(sx, sy);

      // treats
      for (const t of treats) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(Math.sin(t.rot) * 0.25);
        if (!t.good) {
          // danger halo
          ctx.beginPath();
          ctx.arc(0, 0, t.size * 0.62, 0, TAU);
          ctx.fillStyle = 'rgba(216,90,90,.16)';
          ctx.fill();
        }
        ctx.font = `${t.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji, 0, 0);
        ctx.restore();
      }

      // bursts
      for (const b of bursts) {
        const a = 1 - b.life / b.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = b.col;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // bowl + beast face
      drawBowl();

      ctx.restore();
    }

    function drawBowl() {
      const squash = bowlPulse > 0 ? easeOutBack(1 - bowlPulse) : 1;
      const sw = bowl.w * lerp(1.08, 1, squash);
      const sh = bowl.h * lerp(0.9, 1, squash);
      const bx = bowl.x;
      const by = bowl.y;

      ctx.save();
      ctx.translate(bx, by);

      // tilt slightly with velocity for life
      const tilt = clamp(bowl.vx / 1600, -0.18, 0.18);
      ctx.rotate(tilt);

      // catch glow ring when recently caught
      if (bowlPulse > 0) {
        ctx.globalAlpha = bowlPulse * 0.5;
        ctx.beginPath();
        ctx.ellipse(0, -sh * 0.55, sw * 0.62, sh * 0.5, 0, 0, TAU);
        ctx.strokeStyle = rgba(theme, 1);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // bowl body
      ctx.beginPath();
      ctx.moveTo(-sw / 2, -sh * 0.55);
      ctx.bezierCurveTo(-sw / 2, sh * 0.55, sw / 2, sh * 0.55, sw / 2, -sh * 0.55);
      ctx.closePath();
      const bg = ctx.createLinearGradient(0, -sh * 0.55, 0, sh * 0.55);
      bg.addColorStop(0, rgba(theme, 0.95));
      bg.addColorStop(1, 'rgba(11,10,18,.95)');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = '#ead9a0';
      ctx.lineWidth = 2;
      ctx.stroke();

      // rim
      ctx.beginPath();
      ctx.ellipse(0, -sh * 0.55, sw / 2, sh * 0.16, 0, 0, TAU);
      ctx.fillStyle = '#ead9a0';
      ctx.fill();
      ctx.strokeStyle = rgba(theme, 1);
      ctx.lineWidth = 2;
      ctx.stroke();

      // little hungry beast peeking over the rim (emoji)
      ctx.font = `${Math.round(sh * 0.62)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const mouth = bowlPulse > 0.2 ? '😋' : '🐾';
      ctx.fillText(mouth, 0, -sh * 0.78);

      ctx.restore();
    }

    // ── End / teardown ───────────────────────────────────────────────────────
    function teardown() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      timeouts.forEach(clearTimeout);
      timeouts.clear();
    }

    function endGame(success) {
      if (finished) return;
      finished = true;
      running = false; // stop loop updates
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }

      const accuracy = spawnedGood > 0 ? clamp(caughtGood / spawnedGood, 0, 1) : 0;
      const reward = Math.max(0, Math.round(score * (1.5 + difficulty * 0.5) + (success ? 10 * difficulty : 0)));

      // result splash
      const won = success;
      const perfect = won && accuracy >= 0.9;
      const label = perfect ? 'Perfect!' : won ? 'Great!' : 'Try again';
      const sub = won
        ? `${beastName} is delighted — ${score} treats, ${reward} coins`
        : `${beastName} is still peckish — ${score} treats`;
      const splashCol = won ? '#ead9a0' : '#d85a5a';

      const splash = el('div', {
        style: 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'gap:8px;text-align:center;padding:18px;border-radius:14px;background:rgba(8,6,14,.62);' +
          'backdrop-filter:blur(3px);opacity:0;transition:opacity .25s ease;z-index:5',
      }, [
        el('div', {
          text: won ? (perfect ? '🌟' : '🎉') : '🍂',
          style: 'font-size:2.6rem;line-height:1',
        }),
        el('div', {
          class: 'cz', text: label,
          style: "font-family:'Cinzel',serif;font-weight:700;font-size:clamp(1.6rem,7vw,2.4rem);" +
            `color:${splashCol};text-shadow:0 0 30px ${won ? 'rgba(201,162,75,.5)' : 'rgba(216,90,90,.4)'}`,
        }),
        el('div', {
          text: sub,
          style: 'font-size:.86rem;color:#e8dcc0;font-style:italic;letter-spacing:.02em;max-width:90%',
        }),
        bestCombo >= 3 ? el('div', {
          text: `Best streak ×${1 + Math.floor(bestCombo / 3)}`,
          style: "font-family:'Cinzel',serif;font-size:.74rem;color:#c9a24b;letter-spacing:.06em",
        }) : null,
      ]);
      stage.append(splash);
      requestAnimationFrame(() => {
        splash.style.opacity = '1';
        splash.firstChild.animate
          ? splash.firstChild.animate(
            [{ transform: 'scale(.4)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
            { duration: 500, easing: 'cubic-bezier(.2,.9,.3,1.1)' })
          : null;
      });

      const result = { success: !!success, score, accuracy: Math.round(accuracy * 1000) / 1000, reward };

      safeTimeout(() => {
        overlay.style.opacity = '0';
        panel.style.transform = 'scale(.96)';
        safeTimeout(() => {
          teardown();
          overlay.remove();
          if (onResult) { try { onResult(result); } catch (e) { console.error(e); } }
          resolve(result);
        }, 240);
      }, 1400);
    }

    // ── Boot ─────────────────────────────────────────────────────────────────
    // initial bowl placement before first resize
    bowl.x = 270; bowl.targetX = 270; bowl.y = 300;
    resize();
    bowl.x = W / 2; bowl.targetX = W / 2;
    updateHud();

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      panel.style.transform = 'scale(1)';
    });
    rafId = requestAnimationFrame(frame);
  });
}
