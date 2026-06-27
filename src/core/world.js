// ─────────────────────────────────────────────────────────────────────────────
//  world.js — the living vivarium. Hogwarts grounds with the castle on the
//  horizon, a grassy paddock where the beasts roam, a pond, decor anchors,
//  full day/night + weather, and the particle systems (hearts/sparkles/coins/
//  dust) that creatures trigger through callbacks.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TAU, clamp, lerp, smooth, makeRng, rngRange, fbm,
  paintTexture, normalFromHeight,
} from './util.js';

const PAD_R = 24;          // paddock radius (soft bounds for beasts)
const WATER_Y = -0.35;

export class World {
  constructor(stage) {
    this.stage = stage;
    this.scene = stage.scene;
    this.Q = stage.Q;
    this.renderer = stage.renderer;
    this.hour = 17.5;
    this.weather = 'clear';
    this.season = 'summer';
    this.sunVec = new THREE.Vector3();
    this.rng = makeRng(20240601);
    this.decorAnchors = [];
    this.decorObjs = {};
    this.lit = [];           // lit window / lantern materials
    this.boundR = PAD_R;
    this._tmp = new THREE.Vector3();
  }

  // smooth, berm-free bowl: flat interior, pond basin, gentle rise into the grounds
  groundAt(x, z) {
    const d = Math.hypot(x, z);
    // subtle interior micro-relief
    let y = (fbm(x * 0.05 + 10, z * 0.05 + 10, 3, 5) - 0.5) * 0.55;
    // pond basin to the +x/+z
    const pd = Math.hypot(x - 14, z - 8);
    y -= smooth(7, 2, pd) * 1.0;
    // gentle grounds rising away from the paddock — long, smooth, no wall
    y += smooth(PAD_R - 2, PAD_R + 46, d) * 3.0;
    return y;
  }

  async build() {
    this._buildSky();
    this._buildLights();
    this._buildTerrain();
    this._buildWater();
    this._buildCastle();
    this._buildSurround();
    this._buildHabitat();
    this._buildParticles();
    this.setTime(this.hour);
    this.setWeather(this.weather);
  }

  // ── sky + IBL ──
  _buildSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 7; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.82;
    this.scene.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    this.skyScene = new THREE.Scene();
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x8aa0c8, 0x35472a, 0.7);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.Q.shadow, this.Q.shadow);
    // frustum large enough that its boundary never falls inside the visible paddock
    const d = 95, c = this.sun.shadow.camera;
    c.left = -d; c.right = d; c.top = d; c.bottom = -d; c.near = 1; c.far = 320;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 1.4;
    this.scene.add(this.sun, this.sun.target);
    // cool moonlight — keeps the vivarium readable after dark
    this.moon = new THREE.DirectionalLight(0xaec4ff, 0);
    this.moon.position.set(-30, 60, -20);
    this.scene.add(this.moon);
    // warm fill near the player so beasts read well at night
    this.fill = new THREE.PointLight(0xffd9a0, 0, 60, 2);
    this.fill.position.set(2, 9, 16);
    this.scene.add(this.fill);
  }

  // ── ground ──
  _buildTerrain() {
    const g = new THREE.PlaneGeometry(220, 220, 200, 200);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // beyond the paddock, let the land roll up into the grounds
      let y = this.groundAt(x, z);
      const d = Math.hypot(x, z);
      // big, gentle hills only far away (>30u) so nothing walls off the paddock or castle
      if (d > PAD_R + 6) {
        const far = smooth(PAD_R + 6, 150, d);
        y += (fbm(x * 0.012, z * 0.012, 4, 9) - 0.5) * 11 * far;
      }
      p.setY(i, y);
    }
    g.computeVertexNormals();

    const grassTex = paintTexture(256, (data, n) => {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const f = fbm(x / n * 7, y / n * 7, 4, 3);
        const blade = (Math.sin(x * 0.9) * 0.5 + 0.5) * 0.1;
        const g0 = 0.16 + f * 0.22 + blade * 0.1;
        const i = (y * n + x) * 4;
        data[i] = (0.18 + f * 0.12) * 255;
        data[i + 1] = (g0 + 0.18) * 255;
        data[i + 2] = (0.08 + f * 0.08) * 255;
        data[i + 3] = 255;
      }
    }, { repeat: 26 });
    const grassN = normalFromHeight(128, (x, y, n) => fbm(x / n * 16, y / n * 16, 4, 4), 1.6);
    grassN.repeat.set(26, 26);
    this.groundMat = new THREE.MeshStandardMaterial({
      map: grassTex, normalMap: grassN, normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 1, metalness: 0, color: SEASON_GROUND[this.season],
    });
    this.ground = new THREE.Mesh(g, this.groundMat);
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // worn dirt ring path inside the paddock
    const ringTex = paintTexture(128, (data, n) => {
      for (let i = 0; i < n * n; i++) {
        const v = 0.32 + fbm((i % n) / n * 8, ((i / n) | 0) / n * 8, 3, 6) * 0.3;
        data[i * 4] = v * 255 * 1.1; data[i * 4 + 1] = v * 255 * 0.85; data[i * 4 + 2] = v * 255 * 0.6; data[i * 4 + 3] = 255;
      }
    }, { repeat: 8 });
    const path = new THREE.Mesh(new THREE.RingGeometry(PAD_R - 6, PAD_R - 3.5, 64),
      new THREE.MeshStandardMaterial({ map: ringTex, color: 0x6b5638, roughness: 1, transparent: true, opacity: 0.6 }));
    path.rotateX(-Math.PI / 2); path.position.y = 0.04; path.receiveShadow = true;
    this.scene.add(path);

    this._buildGrassBlades();
  }

  _buildGrassBlades() {
    const count = this.Q.grass;
    const w = 0.075, h = 0.46;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -w / 2, 0, 0, w / 2, 0, 0, w * 0.3, h * 0.5, 0, -w * 0.3, h * 0.5, 0, 0, h, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 0.5, 0, 0.5, 0.5, 1]), 2));
    geo.setIndex([0, 1, 2, 0, 2, 3, 3, 2, 4]);
    const [base, tip] = SEASON_GRASS[this.season];
    this.grassMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 }, uDay: { value: 1 }, uWind: { value: 1 },
        uBase: { value: new THREE.Color(base) }, uTip: { value: new THREE.Color(tip) },
        uFog: { value: new THREE.Color(0x223) }, uFogD: { value: 0.01 },
      },
      vertexShader: `uniform float uTime,uWind; varying float vH,vR,vFog;
        float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5);}
        void main(){ vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.); float hf=uv.y; vH=hf;
          vR=hash(floor(wp.xz));
          float sway=sin(wp.x*0.2+wp.z*0.14+uTime*1.7+vR*6.28)*uWind;
          wp.x+=sway*hf*(0.32+vR*0.22); wp.z+=cos(wp.z*0.16+uTime*1.4+vR*6.28)*hf*0.16*uWind;
          vec4 mv=viewMatrix*wp; vFog=length(mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uDay; uniform vec3 uBase,uTip,uFog; uniform float uFogD;
        varying float vH,vR,vFog;
        void main(){ vec3 c=mix(uBase,uTip,vH); c*=0.45+0.55*vH; c*=mix(0.5,1.0,uDay);
          c*=0.85+vR*0.3; c=mix(c,c*vec3(0.5,0.6,0.9),(1.0-uDay)*0.5);
          float f=1.0-exp(-uFogD*uFogD*vFog*vFog); c=mix(c,uFog,clamp(f,0.0,1.0));
          gl_FragColor=vec4(c,1.0); }`,
    });
    const dummy = new THREE.Object3D();
    const mesh = new THREE.InstancedMesh(geo, this.grassMat, count);
    mesh.frustumCulled = false;
    let n = 0;
    for (let i = 0; i < count * 3 && n < count; i++) {
      const a = this.rng() * TAU, r = Math.sqrt(this.rng()) * (PAD_R + 26);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - 14, z - 8) < 7) continue;     // not in pond
      const y = this.groundAt(x, z);
      if (y < WATER_Y + 0.2) continue;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, this.rng() * TAU, 0);
      const s = 0.55 + this.rng() * 0.95;
      dummy.scale.set(s, s * (0.55 + this.rng() * 0.45), s);
      dummy.updateMatrix(); mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    this.grass = mesh; this.scene.add(mesh);
  }

  _buildWater() {
    const g = new THREE.CircleGeometry(8, 40);
    // procedural water-normals (no external texture needed)
    const wn = normalFromHeight(256, (x, y, n) =>
      fbm(x / n * 5, y / n * 5, 4, 21) * 0.6 + fbm(x / n * 13 + 4, y / n * 13, 3, 31) * 0.4, 2.4);
    wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
    this.water = new Water(g, {
      textureWidth: 512, textureHeight: 512, waterNormals: wn,
      sunDirection: new THREE.Vector3(), sunColor: 0xffffff, waterColor: 0x12303a,
      distortionScale: 2.2, fog: true,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(14, WATER_Y, 8);
    this.scene.add(this.water);
    // low mossy stone rim (kept subtle so it never dominates the frame)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(8, 0.28, 6, 44),
      new THREE.MeshStandardMaterial({ color: 0x47433a, roughness: 1, envMapIntensity: 0.3 }));
    rim.rotation.x = Math.PI / 2; rim.position.set(14, -0.05, 8); rim.receiveShadow = true;
    this.scene.add(rim);
  }

  // ── Hogwarts castle on the horizon ──
  _buildCastle() {
    const C = new THREE.Group();
    C.position.set(-6, 0, -82);
    C.rotation.y = 0.22;
    C.scale.setScalar(1.18);
    this.scene.add(C);
    const stone = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.6 });
    const stoneD = new THREE.MeshStandardMaterial({ color: 0x534e46, roughness: 0.95, envMapIntensity: 0.5 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x2c2a33, roughness: 0.7, metalness: 0.1 });
    this.litMat = new THREE.MeshStandardMaterial({ color: 0xffce80, emissive: 0xffaa3c, emissiveIntensity: 1.2, roughness: 0.4 });
    this.lit.push(this.litMat);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(34, 44, 30, 22), stoneD);
    plinth.position.y = -2; plinth.scale.set(1, 1, 0.7); C.add(plinth);

    const tower = (x, z, r, h, rh) => {
      const t = new THREE.Group(); t.position.set(x, 12, z);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 14), stone);
      body.position.y = h / 2; t.add(body);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r * 1.3, rh, 14), roof);
      cone.position.y = h + rh / 2; t.add(cone);
      for (let a = 0; a < TAU; a += Math.PI / 5) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.6), stoneD);
        m.position.set(Math.cos(a) * r * 1.1, h + 0.3, Math.sin(a) * r * 1.1); t.add(m);
      }
      // lit windows
      for (let row = 0; row < Math.max(2, (h / 8) | 0); row++) {
        const aa = row * 1.6;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.5), this.litMat);
        win.position.set(Math.cos(aa) * (r + 0.02), 5 + row * 6, Math.sin(aa) * (r + 0.02));
        win.lookAt(win.position.clone().multiplyScalar(2)); t.add(win);
      }
      C.add(t); return t;
    };
    // central keep
    const keep = new THREE.Mesh(new THREE.BoxGeometry(20, 24, 16), stone);
    keep.position.set(0, 24, 0); C.add(keep);
    const greatHall = new THREE.Mesh(new THREE.BoxGeometry(12, 18, 26), stone);
    greatHall.position.set(-18, 18, 4); C.add(greatHall);
    // pitched roof on the hall
    for (const s of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 26), roof);
      slope.position.set(-18 + s * 3, 30, 4); slope.rotation.z = s * 0.7; C.add(slope);
    }
    // facade lit windows on keep + hall
    for (let i = -2; i <= 2; i++) for (let r = 0; r < 3; r++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4), this.litMat);
      w.position.set(i * 3.6, 14 + r * 6, 8.1); C.add(w);
    }
    for (let i = -4; i <= 4; i++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 6), this.litMat);
      w.position.set(-11.9, 16, 4 + i * 2.6); w.rotation.y = -Math.PI / 2; C.add(w);
    }
    // ring of towers
    tower(11, -4, 3.4, 44, 12);
    tower(-9, -8, 3.8, 34, 10);
    tower(14, 10, 3.2, 30, 9);
    tower(-26, 12, 2.8, 26, 8);
    tower(6, 14, 2.6, 24, 7);
    tower(-2, -16, 3, 38, 11);
    keep.castShadow = greatHall.castShadow = true;
    this.castle = C;
  }

  // ── distant grounds: forest ring, mountains, hedges ──
  _buildSurround() {
    // mountains
    for (let i = 0; i < 16; i++) {
      const a = Math.PI * 0.6 + (i / 15) * Math.PI * 1.8;
      const r = 240 + this.rng() * 90;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 60;
      const h = 60 + this.rng() * 90;
      const mt = new THREE.Mesh(new THREE.ConeGeometry(45 + this.rng() * 40, h, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 1 }));
      mt.position.set(x, h / 2 - 16, z); mt.rotation.y = this.rng() * TAU;
      this.scene.add(mt);
    }
    // pine forest ring (instanced)
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.22, 0.4, 3, 6); trunk.translate(0, 1.5, 0); paint(trunk, 0x49362a);
    parts.push(trunk);
    for (let i = 0; i < 3; i++) { const c = new THREE.ConeGeometry(2 - i * 0.45, 2.6, 7); c.translate(0, 3.2 + i * 1.5, 0); paint(c, 0x21401c); parts.push(c); }
    const treeGeo = BufferGeometryUtils.mergeGeometries(parts, false);
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const trees = new THREE.InstancedMesh(treeGeo, treeMat, this.Q.trees);
    trees.castShadow = true; trees.receiveShadow = true;
    const dummy = new THREE.Object3D(); let n = 0;
    const castleAng = Math.atan2(-82, -6);                  // direction from paddock to the castle
    for (let i = 0; i < this.Q.trees * 6 && n < this.Q.trees; i++) {
      const a = this.rng() * TAU;
      // smooth wedge opening toward the castle (no straight tree-wall edges)
      const da = Math.abs(((a - castleAng + Math.PI) % TAU) - Math.PI);
      if (da < 0.6) continue;
      const r = PAD_R + 16 + this.rng() * 74;               // a distant backdrop ring, never foreground
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = this.groundAt(x, z);
      dummy.position.set(x, y, z); dummy.rotation.set(0, this.rng() * TAU, 0);
      const s = 0.9 + this.rng() * 1.5; dummy.scale.set(s, s * (0.95 + this.rng() * 0.5), s);
      dummy.updateMatrix(); trees.setMatrixAt(n++, dummy.matrix);
    }
    trees.count = n; trees.instanceMatrix.needsUpdate = true; this.scene.add(trees); this.trees = trees;

    // rounded mossy boulders, sparse and kept out beyond the paddock
    const rg = new THREE.IcosahedronGeometry(1, 2); const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) { const v = 0.86 + this.rng() * 0.22; rp.setXYZ(i, rp.getX(i) * v, rp.getY(i) * v * 0.78, rp.getZ(i) * v); }
    rg.computeVertexNormals();
    const rockCount = Math.max(18, Math.floor(this.Q.rocks * 0.4));
    const rocks = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x4b463d, roughness: 1, metalness: 0, envMapIntensity: 0.25, flatShading: true }), rockCount);
    rocks.castShadow = rocks.receiveShadow = true; n = 0;
    for (let i = 0; i < rockCount * 5 && n < rockCount; i++) {
      const a = this.rng() * TAU, r = PAD_R + 12 + this.rng() * 64;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = this.groundAt(x, z); if (y < WATER_Y) continue;
      dummy.position.set(x, y + 0.1, z); dummy.rotation.set(this.rng() * 0.4, this.rng() * TAU, this.rng() * 0.4);
      dummy.scale.setScalar(0.8 + this.rng() * 1.8); dummy.updateMatrix(); rocks.setMatrixAt(n++, dummy.matrix);
    }
    rocks.count = n; this.scene.add(rocks);

    function paint(geo, hex) {
      const col = new THREE.Color(hex); const a = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < geo.attributes.position.count; i++) col.toArray(a, i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    }
  }

  // ── habitat dressing: fence ring, gate arch, feeding trough, decor anchors ──
  _buildHabitat() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.9 });
    const woodD = new THREE.MeshStandardMaterial({ color: 0x3f2a18, roughness: 0.92 });
    // low rustic fence around the paddock with gaps toward the castle
    const posts = 46;
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * TAU;
      // leave an opening at the front (toward camera/castle)
      if (Math.sin(a) < -0.78) continue;
      const x = Math.cos(a) * (PAD_R - 1.2), z = Math.sin(a) * (PAD_R - 1.2);
      const y = this.groundAt(x, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.4, 6), wood);
      post.position.set(x, y + 0.6, z); post.castShadow = true; this.scene.add(post);
      // rail to next post
      const a2 = ((i + 1) / posts) * TAU;
      if (Math.sin(a2) < -0.78) continue;
      const x2 = Math.cos(a2) * (PAD_R - 1.2), z2 = Math.sin(a2) * (PAD_R - 1.2);
      const y2 = this.groundAt(x2, z2);
      const mid = new THREE.Vector3((x + x2) / 2, (y + y2) / 2 + 0.7, (z + z2) / 2);
      const len = Math.hypot(x2 - x, z2 - z);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.12), woodD);
      rail.position.copy(mid); rail.rotation.y = Math.atan2(z2 - z, x2 - x); rail.castShadow = true; this.scene.add(rail);
    }

    // wooden feeding trough near the front
    const trough = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1.1), wood);
    base.position.y = 0.3; trough.add(base);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 0.12), woodD); side.position.set(0, 0.55, s * 0.5); trough.add(side); }
    trough.position.set(-6, this.groundAt(-6, 9), 9);
    trough.traverse(o => o.castShadow = true);
    this.scene.add(trough);
    this.troughPos = new THREE.Vector3(-6, 0.6, 9);

    // 6 decor anchor points around the paddock
    const ang = [0.4, 1.3, 2.2, 3.1, 4.0, 5.2];
    ang.forEach(a => {
      const x = Math.cos(a) * (PAD_R - 6), z = Math.sin(a) * (PAD_R - 6);
      this.decorAnchors.push(new THREE.Vector3(x, this.groundAt(x, z), z));
    });
  }

  // ── particle systems (hearts / sparkles / coins / dust) ──
  _buildParticles() {
    this.fields = {
      heart: new ParticleField(this.scene, 120, heartTexture(), { blend: THREE.NormalBlending, gravity: 1.4, size: 1.1 }),
      spark: new ParticleField(this.scene, 240, dotTexture(0xffffff), { blend: THREE.AdditiveBlending, gravity: -0.2, size: 0.7 }),
      coin: new ParticleField(this.scene, 120, coinTexture(), { blend: THREE.NormalBlending, gravity: 5.5, size: 0.8 }),
      dust: new ParticleField(this.scene, 160, dotTexture(0xbda47a), { blend: THREE.NormalBlending, gravity: 0.6, size: 0.9 }),
    };
  }

  spawnHearts(pos, n = 3) {
    for (let i = 0; i < n; i++) this.fields.heart.emit(pos, {
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6 + Math.random(), (Math.random() - 0.5) * 0.8),
      life: 1.6 + Math.random() * 0.6, color: new THREE.Color().setHSL(0.96, 0.7, 0.6 + Math.random() * 0.1), size: 0.9 + Math.random() * 0.5,
    });
  }
  spawnSparkles(pos, n = 12, color = 0xffe9b0) {
    const col = new THREE.Color(color);
    for (let i = 0; i < n; i++) this.fields.spark.emit(pos, {
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 2.2, (Math.random() - 0.5) * 2.4),
      life: 0.8 + Math.random() * 0.7, color: col.clone(), size: 0.4 + Math.random() * 0.5,
    });
  }
  spawnCoins(pos, n = 6) {
    for (let i = 0; i < n; i++) this.fields.coin.emit(pos, {
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.6, 2.4 + Math.random() * 1.6, (Math.random() - 0.5) * 2.6),
      life: 1.3 + Math.random() * 0.4, color: new THREE.Color(0xffdf80), size: 0.7 + Math.random() * 0.4,
    });
  }
  spawnDust(pos, n = 10, color = 0xbda47a) {
    const col = new THREE.Color(color);
    for (let i = 0; i < n; i++) this.fields.dust.emit(pos, {
      vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 0.8, (Math.random() - 0.5) * 2),
      life: 0.9 + Math.random() * 0.5, color: col.clone(), size: 0.6 + Math.random() * 0.8,
    });
  }

  // ── decor placement (called by game when player owns/places decor) ──
  setDecor(list) {
    // list: array of item ids to place at successive anchors
    for (const k in this.decorObjs) { this.scene.remove(this.decorObjs[k]); }
    this.decorObjs = {};
    list.slice(0, this.decorAnchors.length).forEach((id, i) => {
      const obj = buildDecor(id, this);
      if (!obj) return;
      obj.position.copy(this.decorAnchors[i]);
      this.scene.add(obj);
      this.decorObjs[i] = obj;
    });
  }

  // ── time / sun / fog ──
  setTime(hour) {
    this.hour = ((hour % 24) + 24) % 24;
    const t = clamp((this.hour - 6) / 12);
    const elev = Math.sin(clamp(t) * Math.PI) * 60 - (this.hour < 6 || this.hour > 18 ? 14 : 0);
    const azim = 190 - (this.hour - 12) * 12;
    this.sunVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
    this.sky.material.uniforms.sunPosition.value.copy(this.sunVec);
    if (this.water) this.water.material.uniforms.sunDirection.value.copy(this.sunVec).normalize();

    const day = smooth(-0.05, 0.16, this.sunVec.y);
    this.day = day; this.night = day < 0.34;
    this.sun.position.copy(this.sunVec).multiplyScalar(120);
    this.sun.intensity = lerp(0.08, 3.3, day);
    this.sun.color.setHSL(0.09, 0.5, lerp(0.58, 0.93, day));
    this.hemi.intensity = lerp(0.78, 1.05, day);
    this.hemi.color.setHSL(0.62, 0.5, lerp(0.4, 0.66, day));
    this.hemi.groundColor.setHSL(0.27, 0.45, lerp(0.18, 0.24, day));
    this.moon.intensity = lerp(1.1, 0.0, smooth(0.0, 0.34, day));   // moonlight fades as day breaks
    this.fill.intensity = lerp(3.2, 0.0, day);
    this.renderer.toneMappingExposure = lerp(0.78, 0.9, day) * (this.lumos ? 1.4 : 1);
    if (this.grassMat) { this.grassMat.uniforms.uDay.value = day; }
    this.lit.forEach(m => m.emissiveIntensity = lerp(2.4, 0.25, day));

    // rebuild IBL from sky — throttled, PMREM is expensive (skip on tiny deltas)
    if (this._lastEnvHour == null || Math.abs(this.hour - this._lastEnvHour) > 0.4 ||
        Math.abs(this.hour - this._lastEnvHour) > 12) {
      this._lastEnvHour = this.hour;
      this.skyScene.add(this.sky);
      if (this.envRT) this.envRT.dispose();
      this.envRT = this.pmrem.fromScene(this.skyScene);
      this.scene.environment = this.envRT.texture;
      this.scene.add(this.sky);
    }
    this._refreshFog();
  }

  _refreshFog() {
    const day = this.day ?? 1;
    const base = new THREE.Color().setHSL(0.6, 0.4, lerp(0.05, 0.6, day));
    base.lerp(new THREE.Color(0x0a0814), 1 - day);
    const wd = WEATHER[this.weather].fog;
    if (!this.scene.fog) this.scene.fog = new THREE.FogExp2(base, wd);
    this.scene.fog.color.copy(base); this.scene.fog.density = wd;
    this.renderer.setClearColor(base);
    if (this.grassMat) { this.grassMat.uniforms.uFog.value.copy(base); this.grassMat.uniforms.uFogD.value = wd; }
  }

  setWeather(w) {
    this.weather = w;
    this._refreshFog();
    this._setPrecip(w === 'snow' ? 'snow' : w === 'rain' ? 'rain' : null);
    if (this.grassMat) this.grassMat.uniforms.uWind.value = w === 'rain' || w === 'mist' ? 1.7 : 1;
  }

  setSeason(s) {
    this.season = s;
    if (this.groundMat) this.groundMat.color.set(SEASON_GROUND[s]);
    if (this.grassMat) {
      const [b, t] = SEASON_GRASS[s];
      this.grassMat.uniforms.uBase.value.set(b); this.grassMat.uniforms.uTip.value.set(t);
    }
  }

  _setPrecip(kind) {
    if (this.precip) { this.scene.remove(this.precip); this.precip.geometry.dispose(); this.precip.material.dispose(); this.precip = null; }
    this.precipKind = kind; if (!kind) return;
    const N = kind === 'snow' ? 1800 : 1600;
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { p[i * 3] = (Math.random() - 0.5) * 140; p[i * 3 + 1] = Math.random() * 70; p[i * 3 + 2] = (Math.random() - 0.5) * 140; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = kind === 'snow'
      ? new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.85, depthWrite: false })
      : new THREE.PointsMaterial({ color: 0x9fb4c8, size: 0.14, transparent: true, opacity: 0.55, depthWrite: false });
    this.precip = new THREE.Points(g, m); this.scene.add(this.precip);
  }

  // free-placed decor props (build mode)
  setProps(list) {
    if (!this._propGroup) { this._propGroup = new THREE.Group(); this.scene.add(this._propGroup); }
    while (this._propGroup.children.length) {
      const o = this._propGroup.children.pop();
      o.traverse(n => { if (n.geometry) n.geometry.dispose(); });
      this._propGroup.remove(o);
    }
    (list || []).forEach(p => {
      const o = buildDecor(p.id, this);
      if (!o) return;
      o.position.set(p.x, this.groundAt(p.x, p.z), p.z);
      o.rotation.y = p.rot || 0;
      this._propGroup.add(o);
    });
  }

  // env passed to every creature each frame
  envState(timeScale = 1) {
    return {
      night: this.night, day: this.day,
      groundAt: (x, z) => this.groundAt(x, z),
      bounds: this.boundR, timeScale,
      troughPos: this.troughPos,
    };
  }

  update(t, dt) {
    if (this.water) this.water.material.uniforms.time.value += dt * 0.5;
    if (this.grassMat) this.grassMat.uniforms.uTime.value = t;
    for (const k in this.fields) this.fields[k].update(dt);
    if (this.precip) {
      const p = this.precip.geometry.attributes.position;
      const fall = this.precipKind === 'snow' ? 0.12 : 0.7;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - fall * 60 * dt;
        let x = p.getX(i) + (this.precipKind === 'snow' ? Math.sin(t + i) * 0.02 : 0.12);
        if (y < -2) { y = 70; x = (Math.random() - 0.5) * 140; }
        p.setX(i, x); p.setY(i, y);
      }
      p.needsUpdate = true;
    }
  }
}

// ── pooled GPU particle field ──
class ParticleField {
  constructor(scene, capacity, map, { blend = THREE.NormalBlending, gravity = 1, size = 1 } = {}) {
    this.cap = capacity; this.gravity = gravity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.aSize = new Float32Array(capacity);
    this.aLife = new Float32Array(capacity);   // 0..1 remaining
    this.vel = []; this.maxLife = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) { this.vel.push(new THREE.Vector3()); this.aLife[i] = 0; this.aSize[i] = 0; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.aSize, 1));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.aLife, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: blend,
      uniforms: { uMap: { value: map }, uSize: { value: size } },
      vertexShader: `attribute vec3 aColor; attribute float aSize,aLife; uniform float uSize;
        varying vec3 vC; varying float vL;
        void main(){ vC=aColor; vL=aLife; vec4 mv=modelViewMatrix*vec4(position,1.);
          gl_PointSize=aSize*uSize*180.0/(-mv.z)*smoothstep(0.0,0.25,aLife); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec3 vC; varying float vL;
        void main(){ vec4 t=texture2D(uMap,gl_PointCoord); if(t.a<0.02)discard;
          gl_FragColor=vec4(vC,t.a*clamp(vL*1.4,0.0,1.0)); }`,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false;
    scene.add(this.points); this.geo = g; this.cursor = 0;
  }
  emit(p, { vel, life, color, size }) {
    let i = -1;
    for (let k = 0; k < this.cap; k++) { const idx = (this.cursor + k) % this.cap; if (this.aLife[idx] <= 0) { i = idx; break; } }
    if (i < 0) { i = this.cursor; }
    this.cursor = (i + 1) % this.cap;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i].copy(vel);
    this.maxLife[i] = life; this.aLife[i] = 1; this.aSize[i] = size;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.aLife[i] <= 0) continue; any = true;
      this.aLife[i] -= dt / this.maxLife[i];
      this.vel[i].y -= this.gravity * dt;
      this.pos[i * 3] += this.vel[i].x * dt;
      this.pos[i * 3 + 1] += this.vel[i].y * dt;
      this.pos[i * 3 + 2] += this.vel[i].z * dt;
      if (this.aLife[i] <= 0) this.aSize[i] = 0;
    }
    if (any) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aLife.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
    }
  }
}

// ── particle textures ──
function dotTexture(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const col = new THREE.Color(hex);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(255,255,255,1)`);
  g.addColorStop(0.4, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},0.9)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function heartTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.beginPath();
  const s = 26, cx = 32, cy = 26;
  x.moveTo(cx, cy + s * 0.7);
  x.bezierCurveTo(cx + s, cy - s * 0.2, cx + s * 0.5, cy - s, cx, cy - s * 0.3);
  x.bezierCurveTo(cx - s * 0.5, cy - s, cx - s, cy - s * 0.2, cx, cy + s * 0.7);
  x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function coinTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#e8c04a'; x.beginPath(); x.arc(32, 32, 26, 0, TAU); x.fill();
  x.strokeStyle = '#fff1b8'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 26, 0, TAU); x.stroke();
  x.fillStyle = '#b8902a'; x.font = 'bold 30px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('G', 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── decor builders (used by setDecor) ──
function buildDecor(id, world) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x6a655c, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3d22, roughness: 0.9 });
  switch (id) {
    case 'lantern': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 }));
      pole.position.y = 1.2; g.add(pole);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xffce80, emissive: 0xffb24c, emissiveIntensity: 2, roughness: 0.4 });
      world.lit.push(lampMat);
      const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), lampMat); lamp.position.y = 2.5; g.add(lamp);
      const pl = new THREE.PointLight(0xffb24c, 6, 14, 2); pl.position.y = 2.5; g.add(pl); break;
    }
    case 'fountain': {
      const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.6, 18), stone); basin.position.y = 0.3; g.add(basin);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.2, 10), stone); stem.position.y = 1; g.add(stem);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.3, 14), stone); top.position.y = 1.7; g.add(top); break;
    }
    case 'pumpkin_patch': {
      for (let i = 0; i < 5; i++) {
        const pk = new THREE.Mesh(new THREE.SphereGeometry(0.3 + Math.random() * 0.25, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd87a1e, roughness: 0.8 }));
        pk.scale.y = 0.8; pk.position.set((Math.random() - 0.5) * 2.4, 0.3, (Math.random() - 0.5) * 2.4); g.add(pk);
      } break;
    }
    case 'toy_chest': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), wood); box.position.y = 0.45; g.add(box);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.4, 0.95), new THREE.MeshStandardMaterial({ color: 0x6e4a28, roughness: 0.85 })); lid.position.y = 1; g.add(lid); break;
    }
    case 'cozy_nest': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.35, 10, 22), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 18), new THREE.MeshStandardMaterial({ color: 0xc8a96a, roughness: 1 })); pad.position.y = 0.25; g.add(pad); break;
    }
    case 'crystal': {
      const m = new THREE.MeshStandardMaterial({ color: 0x9bb6ff, emissive: 0x4466cc, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 });
      world.lit.push(m);
      for (let i = 0; i < 4; i++) { const sh = new THREE.Mesh(new THREE.ConeGeometry(0.2 + Math.random() * 0.1, 1 + Math.random(), 6), m); sh.position.set((Math.random() - 0.5), 0.6, (Math.random() - 0.5)); sh.rotation.z = (Math.random() - 0.5) * 0.5; g.add(sh); }
      const pl = new THREE.PointLight(0x6688ff, 5, 12, 2); pl.position.y = 1; g.add(pl); break;
    }
    default: return null;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export const SEASON_GROUND = { summer: 0x46632a, autumn: 0x5a4a22, winter: 0x7c828e, spring: 0x4a6526 };
export const SEASON_GRASS = {
  summer: [0x37591f, 0x86ad42], autumn: [0x6a4f1c, 0xc28a32],
  winter: [0x767c84, 0xc2c8ce], spring: [0x335c1c, 0x8cba3c],
};
export const WEATHER = {
  clear: { fog: 0.003, label: 'Clear' }, mist: { fog: 0.018, label: 'Misty' },
  rain: { fog: 0.013, label: 'Rain' }, snow: { fog: 0.011, label: 'Snow' },
};
