import * as T from 'three';

/** Prepare loaded meshes in every direction while the existing loading screen covers the world. */
export function prepareWorldBuffers(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,updateShadows=false) {
  const patches:T.Mesh[]=[];
  scene.traverse(object=>{
    if(object instanceof T.Mesh&&object.visible&&object.frustumCulled)patches.push(object);
  });
  const viewport=renderer.getViewport(new T.Vector4());
  const autoUpdate=renderer.shadowMap.autoUpdate,needsUpdate=renderer.shadowMap.needsUpdate;
  try {
    for(const patch of patches)patch.frustumCulled=false;
    renderer.shadowMap.autoUpdate=updateShadows;renderer.shadowMap.needsUpdate=updateShadows;
    renderer.setViewport(0,0,1,1);
    renderer.render(scene,camera);
  } finally {
    for(const patch of patches)patch.frustumCulled=true;
    renderer.shadowMap.autoUpdate=autoUpdate;renderer.shadowMap.needsUpdate=needsUpdate;
    renderer.setViewport(viewport);
  }
}

/** Direct and composer targets use different tone-mapping and colour-space shader variants. */
export async function prepareWorldMaterials(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera,target:T.WebGLRenderTarget|null=null,updateShadows=false) {
  const previousTarget=renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    await renderer.compileAsync(scene,camera);
    prepareWorldBuffers(renderer,scene,camera,updateShadows);
  } finally {
    renderer.setRenderTarget(previousTarget);
  }
}
