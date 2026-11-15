import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** Bloom is soft detail: cap its first mip at 512 pixels without changing scene resolution. */
export class BoundedBloomPass extends UnrealBloomPass {
  override setSize(width:number,height:number) {
    const scale=Math.min(1,1024/Math.max(1,width,height));
    let x=Math.max(1,Math.round(width*scale/2));
    let y=Math.max(1,Math.round(height*scale/2));
    if(this.renderTargetBright.width===x&&this.renderTargetBright.height===y)return;
    this.renderTargetBright.setSize(x,y);
    for(let i=0;i<this.nMips;i++){
      this.renderTargetsHorizontal[i].setSize(x,y);
      this.renderTargetsVertical[i].setSize(x,y);
      this.separableBlurMaterials[i].uniforms.invSize.value.set(1/x,1/y);
      x=Math.max(1,Math.round(x/2));
      y=Math.max(1,Math.round(y/2));
    }
  }
}
