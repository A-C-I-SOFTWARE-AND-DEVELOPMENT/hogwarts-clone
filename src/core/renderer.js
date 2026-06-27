// ─────────────────────────────────────────────────────────────────────────────
//  renderer.js — WebGL renderer, camera and a layered post-processing stack:
//  SSAO (contact ambient occlusion) → Bloom → cinematic colour-grade + vignette
//  → SMAA anti-alias. Quality presets scale resolution, shadows and which of
//  these passes are active.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(max-width:760px)').matches;

export const PRESETS = {
  cinematic:  { px: 2,   shadow: 2048, grass: 50000, trees: 340, rocks: 130, bloom: 0.5,  sky: 1024, aa: 'smaa' },
  balanced:   { px: 1.6, shadow: 1536, grass: 26000, trees: 210, rocks: 84,  bloom: 0.42, sky: 512,  aa: 'smaa' },
  performance:{ px: 1,   shadow: 1024, grass: 9000,  trees: 110, rocks: 36,  bloom: 0.3,  sky: 256,  aa: 'fxaa' },
};

// cinematic colour-grade: lift/contrast/saturation, warm/cool split-tone, vignette, grain
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uContrast: { value: 1.06 }, uSaturation: { value: 1.12 },
    uVignette: { value: 0.42 }, uLift: { value: new THREE.Color(0x0a0c14) },
    uWarm: { value: 0.06 }, uTime: { value: 0 }, uGrain: { value: 0.035 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uContrast,uSaturation,uVignette,uWarm,uTime,uGrain;
    uniform vec3 uLift; uniform vec2 uResolution; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      c = max(c + uLift*(1.0 - c), 0.0);                       // soft lift in shadows
      c = (c - 0.5) * uContrast + 0.5;                          // contrast
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, uSaturation);                        // saturation
      c.r += uWarm * (1.0 - l); c.b -= uWarm * 0.6 * (1.0 - l);// warm highlights / cool shadows
      c.b += uWarm * 0.4 * l;
      float d = distance(vUv, vec2(0.5));
      c *= smoothstep(0.95, 0.35, d * uVignette + (1.0 - uVignette) * 0.0);
      c *= 1.0 - uVignette * smoothstep(0.3, 0.95, d) * 0.6;   // vignette darkening
      c += (hash(vUv * uResolution + uTime) - 0.5) * uGrain;   // fine film grain
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export class Stage {
  constructor(quality) {
    this.quality = quality;
    this.Q = PRESETS[quality];

    if (!window.WebGL2RenderingContext) throw new Error('WebGL2 is not available in this browser.');
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.Q.px));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.4, 4000);
    this.camera.position.set(0, 7, 26);

    this._buildComposer();
    addEventListener('resize', () => this.resize());
  }

  _buildComposer() {
    const w = innerWidth, h = innerHeight;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), this.Q.bloom, 0.5, 0.85);
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.uResolution.value.set(w, h);
    this.composer.addPass(this.grade);

    this.composer.addPass(new OutputPass());

    if (this.Q.aa === 'smaa') {
      this.aaPass = new SMAAPass(w, h);
    } else {
      this.aaPass = new ShaderPass(FXAAShader);
      this.aaPass.material.uniforms.resolution.value.set(1 / w, 1 / h);
    }
    this.composer.addPass(this.aaPass);
  }

  setQuality(q) {
    this.quality = q; this.Q = PRESETS[q];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.Q.px));
    // rebuild the whole composer so SSAO/AA passes match the new preset
    this.composer.dispose?.();
    this._buildComposer();
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.grade.uniforms.uResolution.value.set(w, h);
    if (this.aaPass?.material?.uniforms?.resolution) this.aaPass.material.uniforms.resolution.value.set(1 / w, 1 / h);
  }

  render(t = 0) {
    this.grade.uniforms.uTime.value = t;
    this.composer.render();
  }
}
