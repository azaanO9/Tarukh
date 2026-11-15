import * as T from 'three';
import {MARS_CATCH_SITE,marsCatchObstacles} from '../../game/marsCatchSite.ts';
import {MARS_CATCH_GROUND_HEIGHT} from '../../game/marsExpeditionTerrain.ts';
import {createArrivalFrame,sampleStarshipArrival,STARSHIP_ARRIVAL_DURATION} from '../../game/starshipArrival.ts';
import type {CollisionObstacle} from '../../game/collision.ts';
import {createStarbase} from '../starbase/createStarbase.ts';
import {createArrivalRigPose} from '../starbase/arrivalRig.ts';
import {createLandingDust} from '../starbase/landingDust.ts';
import {applyTerrainHaze} from './terrainHaze.ts';
import {batchStaticMeshes} from './batchStaticMeshes.ts';
import {createStarshipVisual,type StarshipModelLoader} from '../starbase/starshipVisual.ts';

/** The cinematic and exploration use this same tower, ship and graded game ground. */
export function createMarsCatchSite(scene:T.Scene,obstacles:CollisionObstacle[],performance:boolean,loadStarship?:StarshipModelLoader){
  const site=MARS_CATCH_SITE,root=new T.Group();root.name='Mars arrival tower and secured Starship';
  root.position.set(site.x,MARS_CATCH_GROUND_HEIGHT,site.z);root.scale.setScalar(site.scale);scene.add(root);
  root.rotation.y=site.yaw;
  const moving=new T.Group();root.add(moving);
  const rig=createStarbase(moving,{reusableRocket:true,ground:false});
  const starship=createStarshipVisual(rig,loadStarship);
  rig.orbitalLaunchMount.visible=false;rig.exhaustLight.removeFromParent();
  const apply=createArrivalRigPose(rig),frame=createArrivalFrame();
  const dust=createLandingDust(scene,performance?24:48);dust.mesh.position.y=MARS_CATCH_GROUND_HEIGHT;
  const cameraTarget=new T.Vector3();
  const ownObstacles=marsCatchObstacles();obstacles.push(...ownObstacles);
  const parked=new T.Group();parked.name='Batched secured Starship';
  const parkedGeometry=new Set<T.BufferGeometry>(),parkedInstances:T.InstancedMesh[]=[];
  let settled=false,disposed=false;
  function pose(time:number,reduced=false){sampleStarshipArrival(time,frame);apply(frame,time,reduced);rig.superHeavyBooster.visible=false;}
  // Bake once while loading, retaining the same vehicle geometry and shared materials.
  // Exploration pays only the merged static draw calls, with no work at handoff.
  function bakeParked(){
    pose(STARSHIP_ARRIVAL_DURATION);root.updateWorldMatrix(true,true);
    const inverse=root.matrixWorld.clone().invert(),relative=new T.Matrix4();
    moving.traverseVisible(object=>{
      if(!(object instanceof T.Mesh))return;
      relative.multiplyMatrices(inverse,object.matrixWorld);
      if(object instanceof T.InstancedMesh){
        const copy=object.clone();copy.matrix.copy(relative);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);
        copy.matrixAutoUpdate=false;parked.add(copy);parkedInstances.push(copy);
      }else{
        const copy=new T.Mesh(object.geometry.clone().applyMatrix4(relative),object.material);
        copy.receiveShadow=object.receiveShadow;parked.add(copy);
      }
    });
    batchStaticMeshes(parked,new Set());
    parked.traverse(object=>{if(object instanceof T.Mesh&&!(object instanceof T.InstancedMesh))parkedGeometry.add(object.geometry);});
    // The animated rig is only used by a framed cinematic. Avoid registering its
    // hidden pieces in the exploration detail-culling loop; the parked batches suffice.
    moving.traverse(object=>{if(object instanceof T.Mesh)object.frustumCulled=false;});
  }
  root.add(parked);
  function settle(){if(settled)return;pose(STARSHIP_ARRIVAL_DURATION);moving.visible=false;parked.visible=true;dust.mesh.visible=false;settled=true;}
  function cinematic(time:number,dt:number,camera:T.PerspectiveCamera,reduced:boolean){
    settled=false;moving.visible=true;parked.visible=false;pose(time,reduced);
    const near=reduced?1:Math.max(0,Math.min(1,(time-12)/12)),blend=near*near*(3-2*near);
    // Approach from the open side of the arms, keeping the truss clear of the vehicle.
    const altitude=frame.shipY*site.scale;
    camera.position.set(site.x-46+22*blend,MARS_CATCH_GROUND_HEIGHT+altitude+20-10*blend,site.z+76-36*blend);
    cameraTarget.set(site.x-12,MARS_CATCH_GROUND_HEIGHT+altitude+6,site.z-14);
    camera.lookAt(cameraTarget);camera.updateMatrixWorld();
    dust.update(dt,reduced?0:frame.dust,site.x+frame.shipX*site.scale*Math.cos(site.yaw),site.z,camera,reduced);
  }
  const ready=starship.ready.then(()=>{
    if(disposed)return;
    const metals=new Set<T.MeshStandardMaterial>();
    moving.traverse(object=>{if(object instanceof T.Mesh){object.castShadow=false;for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof T.MeshStandardMaterial)metals.add(material);}});
    for(const material of metals)applyTerrainHaze(material);
    bakeParked();
    // Imported materials and both rig variants enter the existing hidden shader warm-up.
    pose(22);dust.mesh.visible=true;
  });
  return {root,rig,ready,get modelStatus(){return starship.status;},cinematic,settle,dispose(){
    if(disposed)return;disposed=true;dust.dispose();starship.dispose();rig.dispose();root.removeFromParent();
    for(const geometry of parkedGeometry)geometry.dispose();for(const instance of parkedInstances)instance.dispose();
    for(const obstacle of ownObstacles){const index=obstacles.indexOf(obstacle);if(index>=0)obstacles.splice(index,1);}
  }};
}
