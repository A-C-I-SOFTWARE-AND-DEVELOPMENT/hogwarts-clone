// ─────────────────────────────────────────────────────────────────────────────
//  dance.js — Romance Dance rhythm mini-game. Two beasts court by dancing in
//  rhythm. Arrows scroll toward a hit-line; tap the matching big button or press
//  the arrow key as each beat lands. Perfect/Good/Miss judging, combo, hearts.
//
//  STRICT INTERFACE:  export function playDance(opts = {}) -> Promise<{
//    success:boolean, score:number, accuracy:number, reward:number }>
//  opts = { beastName, difficulty:1|2|3, themeColor:'#rrggbb', onResult?:fn }
//
//  Pure DOM + Canvas + rAF. Self-contained, leak-free teardown. No external libs.
// ─────────────────────────────────────────────────────────────────────────────
import { el, clamp, lerp, TAU } from '../../core/util.js';

export function playDance(opts = {}) {
  const {
    beastName = 'The Beast',
    difficulty = 1,
    themeColor = '#e07fc0',
    onResult,
  } = opts;

  const diff = clamp(Math.round(difficulty), 1, 3) | 0;

  return new Promise((resolve) => {
    // ── tunables scaled by difficulty ──────────────────────────────────────
    const DURATION = 24000;                       // active play window (ms)
    const SPEED = [0, 720, 880, 1060][diff];      // px / second arrow falls
    const SPAWN_GAP = [0, 760, 600, 460][diff];   // ms between beats
    const THRESH_FRAC = [0, 0.46, 0.55, 0.63][diff]; // score frac to succeed
    const LANES = ['left', 'up', 'down', 'right'];
    const ARROW = { left: '◄', up: '▲', down: '▼', right: '►' };
    const KEYMAP = { ArrowLeft: 0, ArrowUp: 1, ArrowDown: 2, ArrowRight: 3 };
    const PERFECT_MS = 70, GOOD_MS = 150;         // timing windows (± ms)
    const PERFECT_PTS = 100, GOOD_PTS = 50;

    // theme color → rgba helper
    const hex = /^#?([0-9a-f]{6})$/i.test(themeColor) ? themeColor.replace('#', '') : 'e07fc0';
    const TR = parseInt(hex.slice(0, 2), 16), TG = parseInt(hex.slice(2, 4), 16), TB = parseInt(hex.slice(4, 6), 16);
    const tc = (a = 1) => `rgba(${TR},${TG},${TB},${a})`;

    // ── state ───────────────────────────────────────────────────────────────
    let raf = 0;
    let startTime = 0;          // ms timestamp when play begins (after countdown)
    let lastSpawn = -1e9;
    let beats = [];             // {lane, t (hit time ms from start), id, judged}
    let beatId = 0;
    let score = 0, combo = 0, maxCombo = 0;
    let totalBeats = 0, perfects = 0, goods = 0, misses = 0;
    let finished = false;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, lineY = 0;
    let danceBeat = 0;          // for the two dancing beasts bob phase
    const listeners = [];        // [target, type, fn]
    const timers = [];

    const on = (t, e, f, o) => { t.addEventListener(e, f, o); listeners.push([t, e, f]); };
    const later = (f, ms) => { const id = setTimeout(f, ms); timers.push(id); return id; };

    // ── DOM ───────────────────────────────────────────────────────────────
    const root = el('div', { class: 'rd-root' });
    root.style.cssText =
      'position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;' +
      'background:radial-gradient(ellipse at 50% 38%,rgba(28,18,40,.82),rgba(6,4,12,.93));' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);' +
      "font-family:'EB Garamond',Georgia,serif;color:#e8dcc0;animation:rdIn .3s ease;touch-action:none";

    const panel = el('div', { class: 'rd-panel' });
    panel.style.cssText =
      'position:relative;width:min(560px,96vw);height:min(92vh,820px);display:flex;flex-direction:column;' +
      'background:linear-gradient(180deg,rgba(20,18,28,.96),rgba(10,8,16,.98));' +
      'border:1px solid rgba(201,162,75,.42);border-radius:20px;overflow:hidden;' +
      'box-shadow:0 30px 90px rgba(0,0,0,.7),inset 0 0 60px ' + tc(.06);

    // ── header ──
    const header = el('div');
    header.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:14px 16px 10px;' +
      'border-bottom:1px solid rgba(201,162,75,.18);position:relative;z-index:3';
    const title = el('div', { class: 'cz', text: `${beastName}'s Courtship Dance` });
    title.style.cssText =
      "font-family:'Cinzel',serif;font-weight:700;font-size:clamp(.95rem,3.6vw,1.18rem);letter-spacing:.03em;" +
      'background:linear-gradient(180deg,#ead9a0,#c9a24b 60%,#8c7438);-webkit-background-clip:text;background-clip:text;' +
      'color:transparent;line-height:1.15;flex:1;min-width:0';
    const quit = el('button', { class: 'cz', html: '&#10005; Quit', 'aria-label': 'Quit dance' });
    quit.style.cssText =
      "font-family:'Cinzel',serif;font-size:.74rem;color:#e8dcc0;border:1px solid rgba(201,162,75,.3);" +
      'border-radius:10px;padding:8px 13px;background:rgba(255,255,255,.04);white-space:nowrap;transition:all .15s';
    on(quit, 'pointerenter', () => { quit.style.borderColor = 'rgba(201,162,75,.6)'; });
    on(quit, 'pointerleave', () => { quit.style.borderColor = 'rgba(201,162,75,.3)'; });
    header.append(title, quit);

    // ── readout row (score / combo / timer) ──
    const readout = el('div');
    readout.style.cssText =
      'display:flex;align-items:center;gap:10px;padding:9px 16px 6px;position:relative;z-index:3';
    const mkStat = (lbl, big) => {
      const w = el('div');
      w.style.cssText = 'display:flex;flex-direction:column;line-height:1';
      const l = el('div', { class: 'cz', text: lbl });
      l.style.cssText = "font-family:'Cinzel',serif;font-size:.56rem;letter-spacing:.12em;text-transform:uppercase;color:#8c7438";
      const v = el('div', { text: big });
      v.style.cssText = 'font-variant-numeric:tabular-nums;font-weight:700;font-size:1.15rem;color:#ead9a0';
      w.append(l, v); return { w, v };
    };
    const scoreStat = mkStat('Score', '0');
    const comboStat = mkStat('Combo', '0');
    comboStat.v.style.color = tc(1);
    const spacer = el('div'); spacer.style.flex = '1';
    // progress bar
    const progWrap = el('div');
    progWrap.style.cssText =
      'flex:1.4;height:8px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden;align-self:center';
    const progFill = el('div');
    progFill.style.cssText =
      'height:100%;width:0%;border-radius:6px;background:linear-gradient(90deg,' + tc(.6) + ',#ead9a0);transition:width .12s linear';
    progWrap.append(progFill);
    readout.append(scoreStat.w, comboStat.w, spacer, progWrap);

    // ── canvas stage ──
    const stage = el('div');
    stage.style.cssText = 'position:relative;flex:1;min-height:0;overflow:hidden';
    const canvas = el('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    const ctx = canvas.getContext('2d');
    // overlay for DOM pops (hearts / judgement text)
    const pops = el('div');
    pops.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    // center judgement label
    const judge = el('div', { class: 'cz' });
    judge.style.cssText =
      "position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-family:'Cinzel',serif;font-weight:700;" +
      'font-size:clamp(1.4rem,8vw,2.6rem);opacity:0;pointer-events:none;text-shadow:0 2px 12px rgba(0,0,0,.6);white-space:nowrap';
    // countdown
    const countdown = el('div', { class: 'cz' });
    countdown.style.cssText =
      "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;" +
      'font-weight:700;font-size:clamp(3rem,18vw,6rem);color:#ead9a0;text-shadow:0 0 30px ' + tc(.7) + ';z-index:5;pointer-events:none';
    stage.append(canvas, pops, judge, countdown);

    // ── arrow buttons row ──
    const pad = el('div');
    pad.style.cssText =
      'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:10px 12px max(12px,env(safe-area-inset-bottom));' +
      'position:relative;z-index:3;border-top:1px solid rgba(201,162,75,.18)';
    const laneBtns = [];
    LANES.forEach((lane, i) => {
      const b = el('button', { 'aria-label': lane, html: ARROW[lane] });
      b.style.cssText =
        'height:64px;border-radius:14px;font-size:1.8rem;color:#ead9a0;' +
        'border:1px solid rgba(201,162,75,.35);background:linear-gradient(180deg,rgba(201,162,75,.12),rgba(201,162,75,.03));' +
        'display:flex;align-items:center;justify-content:center;transition:transform .08s,background .12s,box-shadow .12s;' +
        'touch-action:none;user-select:none;-webkit-user-select:none';
      const press = (ev) => { ev.preventDefault(); hitLane(i); flashBtn(i); };
      on(b, 'pointerdown', press);
      laneBtns.push(b);
      pad.append(b);
    });

    panel.append(header, readout, stage, pad);
    root.append(panel);

    // keyframes (scoped, removed on teardown)
    const styleTag = el('style');
    styleTag.textContent =
      '@keyframes rdIn{from{opacity:0}}@keyframes rdOut{to{opacity:0}}' +
      '@keyframes rdHeart{0%{transform:translate(-50%,0) scale(.5);opacity:0}' +
      '15%{opacity:1}100%{transform:translate(-50%,-90px) scale(1.2);opacity:0}}' +
      '@keyframes rdPop{0%{transform:translate(-50%,-50%) scale(.6);opacity:0}' +
      '25%{transform:translate(-50%,-50%) scale(1.15);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}';
    root.append(styleTag);
    document.body.append(root);

    // ── sizing ──────────────────────────────────────────────────────────────
    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(40, r.width); H = Math.max(40, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lineY = H - 92;            // hit-line position
    }

    // ── feedback helpers ────────────────────────────────────────────────────
    function flashBtn(i) {
      const b = laneBtns[i];
      b.style.transform = 'scale(.9)';
      b.style.background = 'linear-gradient(180deg,' + tc(.45) + ',' + tc(.12) + ')';
      b.style.boxShadow = '0 0 18px ' + tc(.55);
      later(() => {
        b.style.transform = '';
        b.style.background = 'linear-gradient(180deg,rgba(201,162,75,.12),rgba(201,162,75,.03))';
        b.style.boxShadow = '';
      }, 110);
    }

    function showJudge(text, color) {
      judge.textContent = text;
      judge.style.color = color;
      judge.style.animation = 'none';
      void judge.offsetWidth;
      judge.style.animation = 'rdPop .55s ease forwards';
    }

    function heartPop(x, color) {
      const h = el('div', { text: ['💞', '💕', '💗', '❤️'][Math.floor(Math.random() * 4)] });
      h.style.cssText =
        'position:absolute;bottom:' + (H - lineY + 18) + 'px;left:' + x + 'px;transform:translate(-50%,0);' +
        'font-size:' + (18 + Math.random() * 12).toFixed(0) + 'px;pointer-events:none;' +
        'filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));animation:rdHeart 1s ease-out forwards';
      pops.append(h);
      later(() => h.remove(), 1050);
    }

    function comboBurst(x, color) {
      const f = el('div', { text: '+' + (combo) });
      f.style.cssText =
        "position:absolute;bottom:" + (H - lineY + 6) + 'px;left:' + x + 'px;transform:translate(-50%,0);' +
        "font-family:'Cinzel',serif;font-weight:700;font-size:.85rem;color:" + color + ';pointer-events:none;' +
        'text-shadow:0 2px 6px rgba(0,0,0,.7);animation:rdHeart .9s ease-out forwards';
      pops.append(f);
      later(() => f.remove(), 950);
    }

    function updateReadout() {
      scoreStat.v.textContent = String(score);
      comboStat.v.textContent = combo > 0 ? combo + '×' : '0';
    }

    // ── hit logic ────────────────────────────────────────────────────────────
    function hitLane(laneIdx) {
      if (finished || startTime === 0) return;
      const now = performance.now() - startTime;
      const lane = LANES[laneIdx];
      // find nearest un-judged beat in this lane within GOOD window
      let best = null, bestDt = Infinity;
      for (const beat of beats) {
        if (beat.judged || beat.lane !== lane) continue;
        const dt = Math.abs(beat.t - now);
        if (dt < bestDt) { bestDt = dt; best = beat; }
      }
      if (!best || bestDt > GOOD_MS) {
        // stray tap — break combo lightly (no penalty score)
        combo = 0; updateReadout();
        return;
      }
      best.judged = true;
      const laneX = laneCenterX(laneIdx);
      if (bestDt <= PERFECT_MS) {
        perfects++; score += PERFECT_PTS + combo * 2; combo++;
        showJudge('Perfect!', '#ead9a0');
        heartPop(laneX, tc(1));
      } else {
        goods++; score += GOOD_PTS + combo; combo++;
        showJudge('Good', '#7ec0e8');
      }
      maxCombo = Math.max(maxCombo, combo);
      if (combo >= 3) comboBurst(laneX, '#ead9a0');
      best.hitFx = 1;            // ring flash on the lane target
      updateReadout();
    }

    function registerMiss(beat) {
      beat.judged = true; misses++; combo = 0;
      showJudge('Miss', '#d85a5a');
      updateReadout();
    }

    function laneCenterX(i) { return W * (i + 0.5) / 4; }

    // ── beat scheduling ──────────────────────────────────────────────────────
    // pre-generate the chart so density is deterministic-ish across the window
    function spawnIfDue(elapsed) {
      if (elapsed - lastSpawn < SPAWN_GAP) return;
      if (elapsed > DURATION - 600) return;       // stop spawning near the end
      lastSpawn = elapsed;
      // occasionally double-spawn on hardest difficulty
      const count = (diff === 3 && Math.random() < 0.22) ? 2 : 1;
      const used = new Set();
      for (let k = 0; k < count; k++) {
        let lane;
        do { lane = LANES[Math.floor(Math.random() * 4)]; } while (used.has(lane));
        used.add(lane);
        const travelMs = (lineY - (-40)) / SPEED * 1000; // time from spawn(top) to line
        beats.push({ id: beatId++, lane, t: elapsed + travelMs, judged: false, hitFx: 0 });
        totalBeats++;
      }
    }

    // ── render ────────────────────────────────────────────────────────────────
    function drawDancers(t) {
      // two courting beasts bobbing in rhythm above the hit-line area
      const cx = W / 2, base = lineY * 0.42;
      danceBeat = (t / SPAWN_GAP) * Math.PI;
      const bob1 = Math.sin(danceBeat) * 10;
      const bob2 = Math.sin(danceBeat + Math.PI) * 10;
      const sway = Math.sin(t / 900) * 16;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sz = clamp(W * 0.13, 38, 70);
      ctx.font = sz + "px serif";
      // soft glow puddle
      const g = ctx.createRadialGradient(cx, base, 4, cx, base, sz * 2.4);
      g.addColorStop(0, tc(.22)); g.addColorStop(1, tc(0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, base, sz * 2.4, 0, TAU); ctx.fill();
      ctx.fillText('🦄', cx - sz * 0.66 + sway, base + bob1);
      ctx.fillText('🦌', cx + sz * 0.66 + sway, base + bob2);
      // little floating note/heart between them on the beat
      const beatPulse = (Math.sin(danceBeat) + 1) / 2;
      if (beatPulse > 0.82) {
        ctx.globalAlpha = (beatPulse - 0.82) / 0.18;
        ctx.font = (sz * 0.5) + 'px serif';
        ctx.fillText('💞', cx + sway, base - sz * 0.9);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    function drawLane(i, now) {
      const x = laneCenterX(i);
      // lane guide
      ctx.strokeStyle = 'rgba(201,162,75,.08)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, lineY); ctx.stroke();
    }

    function drawTarget(i) {
      const x = laneCenterX(i), r = clamp(W / 4 * 0.32, 22, 38);
      ctx.save();
      ctx.translate(x, lineY);
      // ring target
      ctx.strokeStyle = tc(.5);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.font = (r * 1.1).toFixed(0) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(234,217,160,.28)';
      ctx.fillText(ARROW[LANES[i]], 0, 1);
      ctx.restore();
    }

    function drawBeat(beat, now) {
      const i = LANES.indexOf(beat.lane);
      const x = laneCenterX(i);
      // y from time: at t === now it's on the line
      const y = lineY - (beat.t - now) / 1000 * SPEED;
      if (y < -50 || y > H + 50) return;
      const r = clamp(W / 4 * 0.34, 22, 40);
      // proximity glow ramps as it nears line
      const near = clamp(1 - Math.abs(beat.t - now) / 500);
      ctx.save();
      ctx.translate(x, y);
      // glow
      ctx.shadowColor = tc(.9);
      ctx.shadowBlur = 12 + near * 22;
      // chevron body
      ctx.fillStyle = beat.judged ? 'rgba(120,192,232,.6)' : tc(.92);
      ctx.font = '700 ' + (r * 1.5).toFixed(0) + 'px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ARROW[beat.lane], 0, 1);
      ctx.restore();
    }

    function drawLine() {
      ctx.save();
      // hit-line glow
      const grad = ctx.createLinearGradient(0, lineY - 24, 0, lineY + 24);
      grad.addColorStop(0, tc(0)); grad.addColorStop(.5, tc(.18)); grad.addColorStop(1, tc(0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, lineY - 24, W, 48);
      ctx.strokeStyle = '#ead9a0';
      ctx.lineWidth = 2;
      ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.moveTo(0, lineY); ctx.lineTo(W, lineY); ctx.stroke();
      ctx.restore();
    }

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, W, H);

      // countdown phase
      if (startTime === 0) { drawDancers(ts); drawLine(); for (let i = 0; i < 4; i++) drawTarget(i); return; }

      const now = ts - startTime;
      const elapsed = now;

      // progress
      const frac = clamp(elapsed / DURATION);
      progFill.style.width = (frac * 100).toFixed(1) + '%';

      spawnIfDue(elapsed);

      // miss detection + cull
      for (const beat of beats) {
        if (!beat.judged && now - beat.t > GOOD_MS) registerMiss(beat);
      }
      beats = beats.filter(b => !(b.judged && (now - b.t) > 260) && (b.t - now < 5000));

      // draw
      drawDancers(ts);
      for (let i = 0; i < 4; i++) drawLane(i, now);
      drawLine();
      for (let i = 0; i < 4; i++) drawTarget(i);
      for (const beat of beats) drawBeat(beat, now);

      // end condition: window elapsed AND no live beats remain
      if (elapsed >= DURATION && beats.every(b => b.judged) && !finished) {
        finishGame();
      }
    }

    // ── keyboard ──────────────────────────────────────────────────────────────
    function onKey(e) {
      if (e.key in KEYMAP) {
        e.preventDefault();
        const i = KEYMAP[e.key];
        hitLane(i); flashBtn(i);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        quitGame();
      }
    }

    // ── finish / teardown ──────────────────────────────────────────────────────
    function computeResult(quit_) {
      const total = Math.max(1, totalBeats);
      const accuracy = clamp(perfects / total);
      // max plausible score ~ total * PERFECT_PTS (combo bonuses ignored for a fair bar)
      const maxScore = total * PERFECT_PTS;
      const threshold = Math.round(maxScore * THRESH_FRAC[diff]);
      const success = !quit_ && score >= threshold;
      // reward: coins scale with score & difficulty, bonus for success
      const reward = quit_ ? 0 : Math.round(score * 0.12 * (1 + (diff - 1) * 0.35) + (success ? 40 * diff : 0));
      return { success, score, accuracy, reward, maxCombo, threshold };
    }

    function teardown() {
      cancelAnimationFrame(raf);
      raf = 0;
      for (const id of timers) clearTimeout(id);
      timers.length = 0;
      for (const [t, type, fn] of listeners) t.removeEventListener(type, fn);
      listeners.length = 0;
      root.remove();
    }

    function endWith(result, splashText, splashColor) {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf); raf = 0;

      // result splash
      const splash = el('div');
      splash.style.cssText =
        'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:6px;background:radial-gradient(ellipse at 50% 45%,rgba(10,8,16,.7),rgba(6,4,12,.92));z-index:9;' +
        'animation:rdIn .25s ease;text-align:center;padding:24px';
      const big = el('div', { class: 'cz', text: splashText });
      big.style.cssText =
        "font-family:'Cinzel',serif;font-weight:700;font-size:clamp(2rem,11vw,3.4rem);color:" + splashColor + ';' +
        'text-shadow:0 0 34px ' + tc(.6) + ';animation:rdPop .6s ease';
      const sub = el('div');
      sub.style.cssText = 'font-size:.95rem;color:#e8dcc0;letter-spacing:.04em';
      sub.textContent = result.success
        ? `Score ${result.score} · ${(result.accuracy * 100) | 0}% perfect · +${result.reward} 🪙`
        : (result.reward > 0
          ? `Score ${result.score} · ${(result.accuracy * 100) | 0}% perfect · +${result.reward} 🪙`
          : 'The dance ended early');
      sub.style.color = '#9c8e6e';
      splash.append(big, sub);
      // a few celebratory hearts
      if (result.success || result.score > 0) {
        for (let k = 0; k < 8; k++) {
          later(() => heartPopAbsolute(splash), k * 70);
        }
      }
      panel.append(splash);

      later(() => {
        teardown();
        try { if (typeof onResult === 'function') onResult(result); } catch (_) { /* noop */ }
        resolve({
          success: result.success,
          score: result.score,
          accuracy: result.accuracy,
          reward: result.reward,
        });
      }, 1400);
    }

    function heartPopAbsolute(container) {
      const h = el('div', { text: ['💞', '💕', '💗', '✨'][Math.floor(Math.random() * 4)] });
      const lx = 15 + Math.random() * 70;
      h.style.cssText =
        'position:absolute;left:' + lx + '%;bottom:10%;transform:translate(-50%,0);font-size:' +
        (20 + Math.random() * 18).toFixed(0) + 'px;pointer-events:none;animation:rdHeart 1.1s ease-out forwards';
      container.append(h);
      later(() => h.remove(), 1150);
    }

    function finishGame() {
      const r = computeResult(false);
      const txt = r.success
        ? (r.accuracy > 0.8 ? 'Perfect!' : 'Great!')
        : 'Try again';
      const col = r.success ? '#ead9a0' : '#d85a5a';
      endWith(r, txt, col);
    }

    function quitGame() {
      const r = computeResult(true);
      endWith(r, 'Try again', '#d85a5a');
    }

    on(quit, 'click', quitGame);
    on(window, 'keydown', onKey);
    on(window, 'resize', resize);

    // ── boot ────────────────────────────────────────────────────────────────
    resize();
    raf = requestAnimationFrame(frame);

    // countdown 3 · 2 · 1 · Dance!
    const seq = ['3', '2', '1', 'Dance!'];
    let ci = 0;
    function tickCountdown() {
      if (finished) return;
      if (ci >= seq.length) {
        countdown.style.display = 'none';
        startTime = performance.now();
        lastSpawn = -1e9;
        return;
      }
      countdown.textContent = seq[ci];
      countdown.style.animation = 'none';
      void countdown.offsetWidth;
      countdown.style.animation = 'rdPop .6s ease';
      ci++;
      later(tickCountdown, ci >= seq.length ? 420 : 650);
    }
    tickCountdown();
  });
}
