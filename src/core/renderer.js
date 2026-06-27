// ─────────────────────────────────────────────────────────────────────────────
//  renderer.js — WebGL renderer, camera and the post-processing stack.
//  Quality presets scale pixel ratio, shadows, bloom and scatter density.
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || matchMedia('(max-width:760px)').matches;

export const PRESETS = {
  cinematic:  { px: 2,   shadow: 2048, grass: 46000, trees: 320, rocks: 120, bloom: 0.42, sky: 1024 },
  balanced:   { px: 1.6, shadow: 1536, grass: 24000, trees: 200, rocks: 80,  bloom: 0.38, sky: 512 },
  performance:{ px: 1,   shadow: 1024, grass: 9000,  trees: 110, rocks: 36,  bloom: 0,    sky: 256 },
};

export class Stage {
  constructor(quality) {
    this.quality = quality;
    this.Q = PRESETS[quality];

    if (!window.WebGL2RenderingContext) throw new Error('WebGL2 is not available in this browser.');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.Q.px));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.4, 4000);
    this.camera.position.set(0, 7, 26);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), this.Q.bloom, 0.5, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.quality = q; this.Q = PRESETS[q];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.Q.px));
    this.bloom.strength = this.Q.bloom;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  render() {
    if (this.Q.bloom > 0) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
