import * as T from 'three';

type Renderable = T.Mesh | T.Points | T.Line;

/** Retain the detail far plane when the camera also draws a more distant landscape. */
export function createDetailDistanceCulling(scene:T.Object3D,exclude:(object:T.Object3D)=>boolean=()=>false) {
  const entries:{object:Renderable;fallback:T.Sphere}[]=[];
  const farPlane=new T.Plane(),worldSphere=new T.Sphere();
  let culled=0;
  scene.traverse(object=>{
    if(!(object instanceof T.Mesh||object instanceof T.Points||object instanceof T.Line)
      ||!(object.layers.mask&1)||exclude(object))return;
    const fallback=new T.Sphere();
    if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
    if(object instanceof T.InstancedMesh){
      // A zero-count pool has no instance positions to bound yet. Its first
      // populated frame computes into the already allocated fallback sphere.
      if(object.count>0&&(!object.boundingSphere||object.boundingSphere.isEmpty()))object.computeBoundingSphere();
    }else if(object instanceof T.SkinnedMesh&&!object.boundingSphere)object.computeBoundingSphere();
    entries.push({object,fallback});
  });

  return {
    update(camera:T.Camera,detailDistance:number) {
      const view=camera.matrixWorldInverse.elements;
      // Camera-space z is negative in front of the eye. This inward-facing
      // world plane excludes only objects wholly beyond the old far distance.
      farPlane.setComponents(view[2],view[6],view[10],view[14]+detailDistance).normalize();
      culled=0;
      for(const entry of entries){
        const object=entry.object;
        let beyond=false;
        if(!(object instanceof T.InstancedMesh&&object.count===0)){
          const owner=object instanceof T.InstancedMesh||object instanceof T.SkinnedMesh?object:object.geometry;
          if(!owner.boundingSphere){owner.boundingSphere=entry.fallback;owner.computeBoundingSphere();}
          else if(owner.boundingSphere.isEmpty())owner.computeBoundingSphere();
          const local=owner.boundingSphere;
          if(local&&!local.isEmpty()){
            worldSphere.copy(local).applyMatrix4(object.matrixWorld);
            beyond=farPlane.distanceToPoint(worldSphere.center)<-worldSphere.radius;
          }
        }
        if(beyond){object.layers.mask&=~1;culled++;}
        else object.layers.mask|=1;
      }
    },
    get count(){return entries.length;},
    get culled(){return culled;},
    dispose(){
      // Only layer zero belongs to this helper. Other systems can freely
      // change visibility or any other layer while distance culling is active.
      for(const {object} of entries)object.layers.mask|=1;
      entries.length=0;culled=0;
    },
  };
}
