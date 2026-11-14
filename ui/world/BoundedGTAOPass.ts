import * as T from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";

export function occlusionSize(width: number, height: number) {
  const scale = Math.min(.5, 768 / Math.max(1, width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))] as const;
}

/** The composer resizes every pass; enforce the AO budget on every resize. */
export class BoundedGTAOPass extends GTAOPass {
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
  override setSize(width: number, height: number) { super.setSize(...occlusionSize(width, height)); }

  override render(renderer: T.WebGLRenderer, writeBuffer: T.WebGLRenderTarget, readBuffer: T.WebGLRenderTarget, deltaTime = 0, maskActive = false) {
    const autoUpdate = renderer.shadowMap.autoUpdate, needsUpdate = renderer.shadowMap.needsUpdate;
    const autoClear = renderer.autoClear, overrideMaterial = this.scene.overrideMaterial;
    this.scene.traverseVisible(this.hideUnsupported);
    for(const object of this.hidden)object.visible=false;
    // The preceding beauty pass already rendered shadows; don't draw them again for normals.
    renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
    try { super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive); }
    finally {
      for(const object of this.hidden)object.visible=true;
      this.hidden.length=0;
      renderer.shadowMap.autoUpdate = autoUpdate; renderer.shadowMap.needsUpdate = needsUpdate;
      renderer.autoClear = autoClear; this.scene.overrideMaterial = overrideMaterial;
    }
  }
}
