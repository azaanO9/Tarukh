import * as T from 'three';

/** Cull static instances individually while retaining their shared draw call. */
export function createInstanceVisibility(mesh:T.InstancedMesh) {
  const count=mesh.count;
  const matrices=new Float32Array(mesh.instanceMatrix.array);
  const colors=mesh.instanceColor?new Float32Array(mesh.instanceColor.array):null;
  const previous=Int32Array.from({length:count},(_,i)=>i),next=new Int32Array(count);
  const transform=new T.Matrix4();
  if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
  const bounds=Array.from({length:count},(_,i)=>{
    transform.fromArray(matrices,i*16).premultiply(mesh.matrixWorld);
    const sphere=mesh.geometry.boundingSphere!.clone().applyMatrix4(transform);
    sphere.radius+=.15; // Conservative overlap at the screen edge.
    return sphere;
  });
  // Keep the original aggregate bound: every compacted subset is inside it.
  if(!mesh.boundingSphere)mesh.computeBoundingSphere();
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.instanceColor?.setUsage(T.DynamicDrawUsage);
  return {
    update(frustum:T.Frustum) {
      let visible=0,changed=false;
      for(let i=0;i<count;i++)if(frustum.intersectsSphere(bounds[i])){
        next[visible]=i;
        if(previous[visible]!==i)changed=true;
        visible++;
      }
      changed ||= visible!==mesh.count;
      mesh.visible=visible>0;
      if(!changed)return;
      const target=mesh.instanceMatrix.array,colorTarget=mesh.instanceColor?.array;
      for(let i=0;i<visible;i++){
        const source=next[i];previous[i]=source;
        for(let j=0;j<16;j++)target[i*16+j]=matrices[source*16+j];
        if(colors&&colorTarget)for(let j=0;j<3;j++)colorTarget[i*3+j]=colors[source*3+j];
      }
      mesh.count=visible;
      if(visible){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    },
  };
}
