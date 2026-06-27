// ─────────────────────────────────────────────────────────────────────────────
//  audio.js — fully procedural sound via WebAudio. A gentle ambient bed that
//  shifts between day birdsong-ish shimmer and night crickets, plus short SFX
//  for every care action. No audio files; everything is synthesised.
// ─────────────────────────────────────────────────────────────────────────────
export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.enabledMusic = true; this.enabledSfx = true; this.started = false;
  }

  // must be called from a user gesture
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.enabledMusic ? 0.32 : 0; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.enabledSfx ? 0.7 : 0; this.sfxGain.connect(this.master);
    this._startAmbience();
    this.started = true;
  }

  setMusic(on) { this.enabledMusic = on; if (this.musicGain) ramp(this.musicGain.gain, on ? 0.32 : 0, 0.5, this.ctx); }
  setSfx(on) { this.enabledSfx = on; if (this.sfxGain) this.sfxGain.gain.value = on ? 0.7 : 0; }

  _startAmbience() {
    const c = this.ctx;
    // soft evolving pad: two detuned triangle oscillators through a slow filter
    const pad = c.createGain(); pad.gain.value = 0.5; pad.connect(this.musicGain);
    const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 2; filt.connect(pad);
    [220, 277, 330].forEach((f, i) => {
      const o = c.createOscillator(); o.type = i === 2 ? 'sine' : 'triangle';
      o.frequency.value = f; o.detune.value = (i - 1) * 6;
      const g = c.createGain(); g.gain.value = 0.16; o.connect(g); g.connect(filt); o.start();
    });
    // slow LFO on the filter for shimmer
    const lfo = c.createOscillator(); lfo.frequency.value = 0.06;
    const lfoG = c.createGain(); lfoG.gain.value = 300; lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
    this._padFilter = filt;

    // night layer: filtered noise "crickets/wind" gated low by default
    const noise = this._noiseBuffer(2);
    const src = c.createBufferSource(); src.buffer = noise; src.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2400; nf.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.value = 0.0; src.connect(nf); nf.connect(ng); ng.connect(this.musicGain); src.start();
    this._nightGain = ng;
  }

  setNight(night) {
    if (!this.ctx) return;
    ramp(this._nightGain.gain, night ? 0.10 : 0.0, 2, this.ctx);
    if (this._padFilter) ramp(this._padFilter.frequency, night ? 500 : 800, 2, this.ctx);
  }

  _noiseBuffer(sec) {
    const c = this.ctx; const buf = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    return buf;
  }

  // ── one-shot tones ──
  _blip(freq, dur = 0.12, type = 'sine', gain = 0.5, slideTo = null) {
    if (!this.ctx || !this.enabledSfx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  _arp(freqs, step = 0.07, type = 'triangle', gain = 0.45) {
    freqs.forEach((f, i) => setTimeout(() => this._blip(f, 0.18, type, gain), i * step * 1000));
  }

  sfx(kind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'click': this._blip(520, 0.05, 'square', 0.18); break;
      case 'pet': this._blip(660, 0.14, 'sine', 0.4, 880); break;
      case 'feed': this._arp([523, 659], 0.06, 'sine', 0.4); break;
      case 'fav': this._arp([659, 784, 988], 0.06, 'triangle', 0.45); break;
      case 'play': this._arp([784, 988, 1175], 0.05, 'square', 0.3); break;
      case 'groom': this._blip(880, 0.2, 'sine', 0.3, 1320); break;
      case 'wash': this._blip(1200, 0.25, 'sine', 0.3, 1800); break;
      case 'coin': this._arp([988, 1319], 0.05, 'square', 0.35); break;
      case 'levelup': this._arp([523, 659, 784, 1047], 0.09, 'triangle', 0.5); break;
      case 'rescue': this._arp([392, 523, 659, 784, 1047], 0.1, 'triangle', 0.5); break;
      case 'buy': this._arp([659, 880], 0.06, 'sine', 0.4); break;
      case 'error': this._blip(180, 0.18, 'sawtooth', 0.3, 120); break;
      case 'open': this._blip(440, 0.1, 'sine', 0.25, 620); break;
      default: this._blip(600, 0.08, 'sine', 0.3);
    }
  }
}

function ramp(param, to, time, ctx) {
  if (!ctx) return;
  param.cancelScheduledValues(ctx.currentTime);
  param.setValueAtTime(Math.max(0.0001, param.value), ctx.currentTime);
  param.linearRampToValueAtTime(to, ctx.currentTime + time);
}
