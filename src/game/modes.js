// ─────────────────────────────────────────────────────────────────────────────
//  modes.js — two alternate interaction modes:
//   • FlightController — mount a broom and soar over the grounds and castle
//     (the iconic Hogwarts Legacy flight), with a chase camera.
//   • BuildController — Room-of-Requirement style habitat editor: pick decor
//     from a palette and tap the ground to place / rotate / remove it.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { el, $, clamp } from '../core/util.js';
import { ITEMS } from './items-data.js';

const PAD_LIMIT = 21;

// ── Broom flight ──────────────────────────────────────────────────────────────
export class FlightController {
  constructor(game) {
    this.game = game; this.active = false;
    this.pos = new THREE.Vector3(0, 16, 40);
    this.yaw = Math.PI; this.pitch = -0.04; this.speed = 0; this.bank = 0;
    this.keys = {}; this.drag = false; this.last = new THREE.Vector2();
    this._fwd = new THREE.Vector3(); this._cam = new THREE.Vector3();
    this._bind();
  }

  _bind() {
    const dom = this.game.stage.renderer.domElement;
    addEventListener('keydown', e => { if (this.active) this.keys[e.code] = true; });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    dom.addEventListener('pointerdown', e => { if (!this.active) return; this.drag = true; this.last.set(e.clientX, e.clientY); });
    addEventListener('pointermove', e => {
      if (!this.active || !this.drag) return;
      this.yaw -= (e.clientX - this.last.x) * 0.004;
      this.pitch = clamp(this.pitch - (e.clientY - this.last.y) * 0.004, -0.85, 0.7);
      this.last.set(e.clientX, e.clientY);
    });
    addEventListener('pointerup', () => this.drag = false);
  }

  _buildBroom() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.7, metalness: 0.1 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 8), wood);
    handle.rotation.z = Math.PI / 2; g.add(handle);
    const bind = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a14, roughness: 0.8 }));
    bind.rotation.z = Math.PI / 2; bind.position.x = -0.9; g.add(bind);
    const bristleMat = new THREE.MeshStandardMaterial({ color: 0xb8923a, roughness: 0.9 });
    for (let i = 0; i < 9; i++) {
      const br = new THREE.Mesh(new THREE.ConeGeometry(0.04, 1.1, 5), bristleMat);
      br.rotation.z = -Math.PI / 2; br.position.set(-1.6, (i - 4) * 0.06, (i % 3 - 1) * 0.08); g.add(br);
    }
    // a hooded little rider
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0x2a2740, roughness: 0.85 }));
    robe.position.set(0.1, 0.45, 0); g.add(robe);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe2b98c, roughness: 0.7 }));
    head.position.set(0.1, 0.95, 0); g.add(head);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  toggle() { this.active ? this.exit() : this.enter(); }

  enter() {
    if (this.active) return;
    this.active = true;
    this.game.controls.enabled = false;
    this.game.controls.autoRotate = false;
    if (!this.broom) { this.broom = this._buildBroom(); this.game.world.scene.add(this.broom); }
    this.broom.visible = true;
    const c = this.game.stage.camera;
    this.pos.set(c.position.x, Math.max(14, c.position.y + 6), c.position.z + 6);
    this.yaw = Math.atan2(-c.position.x, -c.position.z) + Math.PI; this.pitch = -0.05; this.speed = 16;
    this.hint = this.hint || el('div', { id: 'flyhint', style: 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:14;pointer-events:none;font-style:italic;color:var(--parchment-dim);background:var(--backing);border:1px solid var(--line-soft);border-radius:999px;padding:8px 16px;backdrop-filter:blur(8px)' });
    this.hint.textContent = 'Drag to steer · W/↑ climb · S/↓ dive · Fly button to land';
    document.body.append(this.hint); this.hint.style.display = '';
    this.game.audio?.sfx('open');
  }

  exit() {
    this.active = false;
    if (this.broom) this.broom.visible = false;
    if (this.hint) this.hint.style.display = 'none';
    this.game.controls.enabled = true;
    this.game.audio?.sfx('click');
  }

  update(dt) {
    if (!this.active) return;
    const k = this.keys;
    if (k.KeyW || k.ArrowUp) this.pitch = clamp(this.pitch + dt * 0.9, -0.85, 0.7);
    if (k.KeyS || k.ArrowDown) this.pitch = clamp(this.pitch - dt * 0.9, -0.85, 0.7);
    let turn = 0;
    if (k.KeyA || k.ArrowLeft) turn += 1;
    if (k.KeyD || k.ArrowRight) turn -= 1;
    this.yaw += turn * dt * 1.2;
    this.bank += ((turn * 0.5) - this.bank) * (1 - Math.exp(-5 * dt));
    // speed eases to cruise
    this.speed += (24 - this.speed) * (1 - Math.exp(-1.5 * dt));

    this._fwd.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).normalize();
    this.pos.addScaledVector(this._fwd, this.speed * dt);

    // soft bounds: keep within the valley and above the ground
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > 150) { this.pos.x *= 150 / r; this.pos.z *= 150 / r; }
    const gy = this.game.world.groundAt(this.pos.x, this.pos.z);
    this.pos.y = clamp(this.pos.y, gy + 3, 85);

    // place broom
    this.broom.position.copy(this.pos);
    this.broom.rotation.set(0, this.yaw - Math.PI / 2, 0);
    this.broom.rotateZ(this.bank);
    this.broom.rotateX(-this.pitch * 0.6);

    // chase camera behind & above
    const cam = this.game.stage.camera;
    this._cam.copy(this._fwd).multiplyScalar(-7); this._cam.y += 2.6;
    const want = this.pos.clone().add(this._cam);
    cam.position.lerp(want, 1 - Math.exp(-6 * dt));
    cam.lookAt(this.pos.x + this._fwd.x * 6, this.pos.y + this._fwd.y * 6 + 0.5, this.pos.z + this._fwd.z * 6);
  }
}

// ── Habitat build mode ─────────────────────────────────────────────────────────
const PLACEABLE = ['cozy_nest', 'toy_chest', 'pumpkin_patch', 'lantern', 'fountain', 'crystal', 'luck_charm', 'breeding_pen'];

export class BuildController {
  constructor(game) {
    this.game = game; this.active = false; this.selected = null; this.mode = 'place';
    this.ray = new THREE.Raycaster(); this._bound = false;
  }

  _ensureUI() {
    if (this.panel) return;
    this.palette = el('div', { id: 'buildpalette' });
    this.bar = el('div', { id: 'buildbar', class: 'pe' }, [
      el('div', { class: 'bh', text: '🔨 Habitat Builder' }),
      this.palette,
      el('div', { class: 'brow' }, [
        el('button', { class: 'bmode', onclick: () => this._setMode('place') }, '➕ Place'),
        el('button', { class: 'bmode', onclick: () => this._setMode('rotate') }, '🔄 Rotate'),
        el('button', { class: 'bmode', onclick: () => this._setMode('remove') }, '🗑 Remove'),
        el('button', { class: 'bdone', onclick: () => this.exit() }, 'Done'),
      ]),
    ]);
    this.panel = el('div', { id: 'buildmode' }, [this.bar]);
    document.body.append(this.panel);
    this._injectStyle();
  }

  _injectStyle() {
    if ($('#buildstyle')) return;
    const s = el('style', { id: 'buildstyle' });
    s.textContent = `
      #buildmode{position:fixed;left:0;right:0;bottom:0;z-index:16;display:none;justify-content:center;pointer-events:none;padding:0 10px max(12px,env(safe-area-inset-bottom))}
      #buildmode.on{display:flex}
      #buildbar{pointer-events:auto;width:min(680px,96vw);background:var(--backing-2);border:1px solid var(--line);border-radius:16px 16px 0 0;padding:10px 12px;backdrop-filter:blur(12px);box-shadow:0 -10px 40px rgba(0,0,0,.5)}
      #buildbar .bh{font-family:'Cinzel';font-size:.72rem;letter-spacing:.12em;color:var(--gold-hi);text-align:center;margin-bottom:8px}
      #buildpalette{display:flex;gap:7px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
      #buildpalette::-webkit-scrollbar{display:none}
      .pitem{min-width:60px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px;border:1px solid var(--line-soft);border-radius:11px;background:rgba(255,255,255,.03)}
      .pitem.sel{border-color:var(--gold-hi);box-shadow:0 0 12px rgba(201,162,75,.4)}
      .pitem .pe{font-size:1.5rem}.pitem .pn{font-size:.54rem;color:var(--parchment-dim);text-align:center}
      .pitem.locked{opacity:.4}
      .brow{display:flex;gap:6px;margin-top:8px;justify-content:center;flex-wrap:wrap}
      .bmode,.bdone{font-family:'Cinzel';font-size:.7rem;color:var(--parchment);border:1px solid var(--line-soft);border-radius:9px;padding:7px 12px}
      .bmode.on{color:var(--ink);background:var(--gold)}
      .bdone{color:var(--gold-hi);border-color:var(--line)}
      #buildhint{position:fixed;left:50%;top:74px;transform:translateX(-50%);z-index:16;pointer-events:none;font-style:italic;color:var(--parchment-dim);background:var(--backing);border:1px solid var(--line-soft);border-radius:999px;padding:7px 15px;backdrop-filter:blur(8px)}`;
    document.head.append(s);
  }

  _paintPalette() {
    this.palette.innerHTML = '';
    PLACEABLE.forEach(id => {
      const it = ITEMS[id];
      const placed = this.game.state.data.props.filter(p => p.id === id).length;
      const node = el('button', { class: 'pitem' + (this.selected === id ? ' sel' : ''), title: it.name, onclick: () => { this.selected = id; this.mode = 'place'; this._setMode('place'); this._paintPalette(); } }, [
        el('span', { class: 'pe', text: it.emoji }),
        el('span', { class: 'pn', text: it.name + (placed ? ` ·${placed}` : '') }),
      ]);
      this.palette.append(node);
    });
  }

  _setMode(m) {
    this.mode = m;
    [...this.bar.querySelectorAll('.bmode')].forEach((b, i) => b.classList.toggle('on', ['place', 'rotate', 'remove'][i] === m));
    this._setHint();
  }

  _setHint() {
    if (!this.hint) { this.hint = el('div', { id: 'buildhint' }); document.body.append(this.hint); }
    this.hint.style.display = this.active ? '' : 'none';
    this.hint.textContent = this.mode === 'place' ? (this.selected ? `Tap the ground to place ${ITEMS[this.selected].name}` : 'Pick a decor below, then tap the ground')
      : this.mode === 'rotate' ? 'Tap a placed decor to rotate it' : 'Tap a placed decor to remove it';
  }

  _bind() {
    if (this._bound) return; this._bound = true;
    this.game.stage.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      if (e.target.closest('#buildbar')) return;
      const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
      this._tap(nx, ny);
    });
  }

  _tap(nx, ny) {
    this.ray.setFromCamera({ x: nx, y: ny }, this.game.stage.camera);
    const props = this.game.world._propGroup;
    if (this.mode !== 'place' && props) {
      const hit = this.ray.intersectObject(props, true)[0];
      if (hit) {
        let o = hit.object; while (o.parent && o.parent !== props) o = o.parent;
        const idx = props.children.indexOf(o);
        if (idx >= 0) {
          if (this.mode === 'remove') { this.game.state.data.props.splice(idx, 1); this.game.audio?.sfx('click'); }
          else { this.game.state.data.props[idx].rot = (this.game.state.data.props[idx].rot || 0) + Math.PI / 4; this.game.audio?.sfx('click'); }
          this.game.world.setProps(this.game.state.data.props); this.game.state.save(); this._paintPalette();
        }
        return;
      }
    }
    if (this.mode === 'place') {
      if (!this.selected) { this.game.ui.toaster.show('Pick a decor first.', '🔨'); return; }
      const hit = this.ray.intersectObject(this.game.world.ground, false)[0];
      if (!hit) return;
      let x = Math.round(hit.point.x), z = Math.round(hit.point.z);
      const r = Math.hypot(x, z);
      if (r > PAD_LIMIT) { this.game.ui.toaster.show('Place it inside the paddock.', '🚧', { tone: 'bad' }); return; }
      if (Math.hypot(x - 14, z - 8) < 8.5) { this.game.ui.toaster.show('Not in the pond!', '💧', { tone: 'bad' }); return; }
      if (this.game.state.data.props.length >= 16) { this.game.ui.toaster.show('That\'s plenty of decor!', '🔨'); return; }
      this.game.state.data.props.push({ id: this.selected, x, z, rot: 0 });
      this.game.world.setProps(this.game.state.data.props);
      this.game.state.save(); this.game.audio?.sfx('buy'); this._paintPalette();
    }
  }

  toggle() { this.active ? this.exit() : this.enter(); }

  enter() {
    if (this.game.flight?.active) this.game.flight.exit();
    this._ensureUI(); this._bind();
    this.active = true;
    this.panel.classList.add('on');
    this.selected = this.selected || PLACEABLE[0];
    this._paintPalette(); this._setMode('place');
    this.game.audio?.sfx('open');
  }

  exit() {
    this.active = false;
    if (this.panel) this.panel.classList.remove('on');
    if (this.hint) this.hint.style.display = 'none';
    this.game.audio?.sfx('click');
  }
}
