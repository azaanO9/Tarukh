import * as T from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";

// These runtime members are omitted from Three 0.180's type declarations.
type GBufferInternals = { _renderGBuffer: boolean; _restoreVisibility(): void };
const UNBOUNDED_DETAIL_DISTANCE = 1e20;

export function occlusionSize(width: number, height: number) {
  const scale = Math.min(.5, 768 / Math.max(1, width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))] as const;
}

/** The composer resizes every pass; enforce the AO budget on every resize. */
export class BoundedGTAOPass extends GTAOPass {
  private readonly ownedDepthTexture: T.DepthTexture;
  private readonly ownedNormalTexture: T.Texture;
  private readonly savedClearColor = new T.Color();
  private readonly detailDistance = { value: UNBOUNDED_DETAIL_DISTANCE };
  private reuseSceneDepth = false;
  private sharedDepth = false;
  private hidden: T.Object3D[] = [];
  private hideUnsupported = (object:T.Object3D) => {
    if(object instanceof T.Points||object instanceof T.Line||('isLine2' in object&&object.isLine2)){
      this.hidden.push(object);return;
    }
    if(!(object instanceof T.Mesh))return;
    const materials=object.material;
    let transparent=true;
    if(Array.isArray(materials)){for(const material of materials)if(!material.transparent&&material.depthWrite){transparent=false;break;}}
    else transparent=materials.transparent||!materials.depthWrite;
    if(transparent)this.hidden.push(object);
  };

  constructor(...args: ConstructorParameters<typeof GTAOPass>) {
    super(...args);
    this.ownedDepthTexture = this.depthTexture;
    this.ownedNormalTexture = this.normalTexture;
    this.gtaoMaterial.uniforms.aoDetailDistance = this.detailDistance;
    this.gtaoMaterial.fragmentShader = 'uniform float aoDetailDistance;\n' + this.gtaoMaterial.fragmentShader.replace(
      'vec3 viewPos = getViewPosition(vUv, depth);',
      `vec3 viewPos = getViewPosition(vUv, depth);
      // Distant relief replaces sky, which did not need contact-shadow rays.
      if (-viewPos.z > aoDetailDistance) {
        gl_FragColor = vec4(1.0);
        return;
      }`,
    );
  }

  /** Bound contact shading to the detail far plane without changing depth reconstruction. */
  setDetailDistance(distance: number) {
    this.detailDistance.value = Number.isFinite(distance)
      ? Math.max(0, Math.min(distance, UNBOUNDED_DETAIL_DISTANCE))
      : UNBOUNDED_DETAIL_DISTANCE;
  }

  /** Reuse the preceding scene pass's depth when its render target provides it. */
  setReuseSceneDepth(enabled: boolean) { this.reuseSceneDepth = enabled; }

  /** The source used by the last render; a missing depth texture selects the fallback. */
  get reusingSceneDepth() { return this.sharedDepth; }

  private selectDepthSource(depth: T.DepthTexture | null) {
    const shared = this.reuseSceneDepth && depth !== null;
    if (shared !== this.sharedDepth) {
      // Passing the saved textures avoids allocating another normal render target.
      super.setGBuffer(shared ? depth : this.ownedDepthTexture, shared ? undefined : this.ownedNormalTexture);
      (this as unknown as GBufferInternals)._renderGBuffer = !shared;
      this.gtaoMaterial.needsUpdate = true;
      this.pdMaterial.needsUpdate = true;
      this.sharedDepth = shared;
    }
    if (shared && this.depthTexture !== depth) {
      this.depthTexture = depth;
      this.gtaoMaterial.uniforms.tDepth.value = depth;
      this.pdMaterial.uniforms.tDepth.value = depth;
    }
    // GTAOPass.setGBuffer points the diagnostic view at its owned target even
    // with an external source. Keep it consistent with the AO input instead.
    this.depthRenderMaterial.uniforms.tDepth.value = this.depthTexture;
  }

  override setSize(width: number, height: number) { super.setSize(...occlusionSize(width, height)); }

  override render(renderer: T.WebGLRenderer, writeBuffer: T.WebGLRenderTarget, readBuffer: T.WebGLRenderTarget, deltaTime = 0, maskActive = false) {
    this.selectDepthSource(readBuffer?.depthTexture ?? null);
    const autoUpdate = renderer.shadowMap.autoUpdate, needsUpdate = renderer.shadowMap.needsUpdate;
    const autoClear = renderer.autoClear, overrideMaterial = this.scene.overrideMaterial;
    renderer.getClearColor(this.savedClearColor);
    const clearAlpha = renderer.getClearAlpha();
    // The preceding beauty pass already rendered shadows; don't draw them again for normals.
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    try {
      if (!this.sharedDepth) {
        this.scene.traverseVisible(this.hideUnsupported);
        for(const object of this.hidden)object.visible=false;
      }
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    }
    finally {
      if (!this.sharedDepth) {
        // The parent can throw between its own visibility override and restore.
        (this as unknown as GBufferInternals)._restoreVisibility();
        for(const object of this.hidden)object.visible=true;
        this.hidden.length=0;
      }
      renderer.shadowMap.autoUpdate = autoUpdate; renderer.shadowMap.needsUpdate = needsUpdate;
      renderer.autoClear = autoClear; this.scene.overrideMaterial = overrideMaterial;
      renderer.setClearColor(this.savedClearColor, clearAlpha);
    }
  }

  override dispose() {
    this.reuseSceneDepth = false;
    this.selectDepthSource(null);
    super.dispose();
    // Three 0.180's parent disposal omits these two owned shader materials.
    this.gtaoMaterial.dispose();
    this.blendMaterial.dispose();
  }
}
