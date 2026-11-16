import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {assetUrl} from '../../lib/assetUrl.ts';
import {OUTPOST_SITE} from '../../game/outpostSite.ts';
import {createOutpostState,nearestOutpostDoor,stepOutpostDoor,toggleOutpostDoor,type OutpostLayout} from '../../game/outpost.ts';
import type {CollisionObstacle} from '../../game/collision.ts';
import {createInstanceVisibility} from './instanceVisibility.ts';
import {withinDetailRange} from './distanceVisibility.ts';
import {createInteriorLighting} from './interiorLighting.ts';
import {loadSolarPanelAsset, createOutpostSolarMesh} from './createSolarPanels.ts';

const roomLights = [
  [0,0],[-19,0],[18,0],[-11,-22],[12,-22],[0,-13],[-8.5,0],[9,0],[0,-8],
] as const;

/** Bounding region of legacy solar array mounting frames, backplates and support poles */
export const SOLAR_LEGACY_BOUNDS = new T.Box3(new T.Vector3(-20, -1, 11), new T.Vector3(-5, 4, 18));

/**
 * Strips legacy solar panel support frames, backplates and mounting poles from campus hull seam meshes.
 * This completely removes the overriding legacy structures so the 2K 3D model stands on its own stand.
 */
export function stripLegacySolarGeometry(mesh: T.Mesh, campusScene?: T.Object3D): number {
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  const idx = geom.index;
  if (!idx || !pos) return 0;
  mesh.updateMatrixWorld(true);
  const m = mesh.matrixWorld.clone();
  if (campusScene) {
    campusScene.updateMatrixWorld(true);
    const invCampus = campusScene.matrixWorld.clone().invert();
    m.premultiply(invCampus);
  } else if (mesh.parent) {
    let top: T.Object3D = mesh;
    while (top.parent && top.parent.type !== 'Scene' && top.parent.name !== 'TARUKH Elysium Outpost') {
      top = top.parent;
    }
    if (top !== mesh) {
      top.updateMatrixWorld(true);
      const invTop = top.matrixWorld.clone().invert();
      m.premultiply(invTop);
    }
  }
  const v = new T.Vector3();
  const newIndices: number[] = [];
  let stripped = 0;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
    v.fromBufferAttribute(pos, a).applyMatrix4(m);
    if (SOLAR_LEGACY_BOUNDS.containsPoint(v)) {
      stripped++;
      continue;
    }
    newIndices.push(a, b, c);
  }
  geom.setIndex(newIndices);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return stripped;
}

/** The campus has no landscape of its own: only the game surface is rendered. */
export function createMarsOutpost(scene:T.Scene,groundY:number,obstacles:CollisionObstacle[]) {
  const baseY=groundY+OUTPOST_SITE.foundationOffset;
  const root=new T.Group();root.name='TARUKH outpost';root.position.set(OUTPOST_SITE.x,baseY,OUTPOST_SITE.z);scene.add(root);
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let state:ReturnType<typeof createOutpostState>|null=null,mixer:T.AnimationMixer|null=null,disposed=false;
  let loaded=false,ultraLighting=false;
  const actions:{action:T.AnimationAction;duration:number}[]=[];
  const sectors:{object:T.Object3D;bounds:T.Box3;interior:boolean}[]=[];
  const instanceVisibility:{sector:T.Object3D;update:(frustum:T.Frustum)=>void}[]=[];
  const viewMatrix=new T.Matrix4(),frustum=new T.Frustum();
  const cameraBoxes:{obstacle:CollisionObstacle;box:T.Box3}[]=[];
  const interiorLighting=createInteriorLighting();
  interiorLighting.setRoomCenter(OUTPOST_SITE.x,baseY,OUTPOST_SITE.z);
  const ray=new T.Ray(),hit=new T.Vector3(),origin=new T.Vector3(),direction=new T.Vector3();
  const resources={geometries:new Set<T.BufferGeometry>(),materials:new Set<T.Material>(),textures:new Set<T.Texture>(),instances:new Set<T.InstancedMesh>()};
  function remember(object:T.Object3D) {
    object.traverse(o=>{
      if(!(o instanceof T.Mesh))return;
      if(o instanceof T.InstancedMesh)resources.instances.add(o);
      resources.geometries.add(o.geometry);
      for(const material of Array.isArray(o.material)?o.material:[o.material]){
        resources.materials.add(material);
        for(const value of Object.values(material))if(value instanceof T.Texture)resources.textures.add(value);
      }
    });
  }
  function freeResources(){
    interiorLighting.dispose();
    for(const instance of resources.instances)instance.dispose();
    for(const g of resources.geometries)g.dispose();
    for(const m of resources.materials)m.dispose();
    for(const t of resources.textures)t.dispose();
    resources.geometries.clear();resources.materials.clear();resources.textures.clear();resources.instances.clear();
  }
  const modelReady=loader.loadAsync(assetUrl('/models/outpost/campus.glb')).then(gltf=>{
    remember(gltf.scene);if(disposed)freeResources();return gltf;
  });
  const ready=Promise.all([
    modelReady,
    fetch(assetUrl('/models/outpost/layout.json')).then(response=>{
      if(!response.ok)throw new Error('Outpost floor plan could not load');
      return response.json() as Promise<OutpostLayout>;
    }),
    loadSolarPanelAsset(),
  ]).then(([gltf,layout,solarAsset])=>{
    if(disposed){freeResources();return;}
    // The review's refractive glass makes Three render the entire Mars world a
    // second time. Reflective alpha glazing retains visibility into the rooms
    // without that scene-wide transmission pass on integrated/mobile GPUs.
    for(const material of resources.materials){
      if(material instanceof T.MeshPhysicalMaterial && material.transmission>0){
        material.transmission=0;material.opacity=Math.min(material.opacity,.32);
        material.transparent=true;material.depthWrite=false;material.forceSinglePass=true;
      }
    }
    root.add(gltf.scene);root.updateMatrixWorld(true);
    state=createOutpostState(layout,baseY);
    mixer=new T.AnimationMixer(gltf.scene);
    const gateMeshes=new Set<T.Mesh>();
    for(const door of state.doors){
      const clip=gltf.animations.find(animation=>animation.name===door.clip);
      if(!clip)throw new Error('Missing outpost gate animation: '+door.id);
      // Moving leaves sit outside the static interior sectors. Link their
      // materials too, without changing the shared exterior wall materials.
      for(const track of clip.tracks){
        const target=T.PropertyBinding.findNode(gltf.scene,T.PropertyBinding.parseTrackName(track.name).nodeName);
        if(target instanceof T.Object3D)target.traverse(o=>{if(o instanceof T.Mesh)gateMeshes.add(o);});
      }
      const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;action.time=0;
      actions.push({action,duration:clip.duration});
    }
    mixer.update(0);
    const toRemoveMeshes: T.Mesh[] = [];
    gltf.scene.traverse(o=>{
      if(o.userData.outpostSector)sectors.push({object:o,bounds:new T.Box3().setFromObject(o),interior:Boolean(o.userData.interior)});
      if(o instanceof T.Mesh){
        // Remove legacy low-res photovoltaic array meshes and strip their support frames/poles
        if(/photovoltaic/i.test(o.name)){o.visible=false;toRemoveMeshes.push(o);return;}
        if(o.name === '02__CREW_LIVING__frame_seams' || o.name === '01__bolted_vertical_seams_and_belt_rails_2'){
          stripLegacySolarGeometry(o, gltf.scene);
        }
        // Interior furnishings are lit locally; they do not need another full
        // rendering pass into the outdoor sun shadow map.
        let parent:T.Object3D|null=o,interior=false,sector:T.Object3D|null=null;
        while(parent){interior ||= Boolean(parent.userData.interior);if(parent.userData.outpostSector)sector=parent;parent=parent.parent;}
        // Interior and exterior share some source materials. Only the interior
        // clones receive the room fill; fixtures keep their authored emission.
        if(interior||gateMeshes.has(o))o.material=Array.isArray(o.material)?o.material.map(material=>interiorLighting.materialFor(material,interior)):interiorLighting.materialFor(o.material,interior);
        o.castShadow=!interior;o.receiveShadow=true;
        o.geometry.computeBoundingSphere();
        if(o instanceof T.InstancedMesh)o.computeBoundingSphere();
        // These authored furnishings are static. Animated gate leaves stay on
        // their existing hierarchy and never have their transforms compacted.
        if(interior&&sector&&o instanceof T.InstancedMesh&&!o.morphTexture){
          instanceVisibility.push({sector,...createInstanceVisibility(o)});
        }
      }
    });
    for (const mesh of toRemoveMeshes) mesh.removeFromParent();
    const crewSector = gltf.scene.getObjectByName('OUTPOST__shell__crew');
    const solarMesh = createOutpostSolarMesh(solarAsset);
    if (crewSector) crewSector.add(solarMesh);
    else root.add(solarMesh);
    remember(solarMesh);
    obstacles.push(...state.obstacles);
    for(const obstacle of state.obstacles)cameraBoxes.push({obstacle,box:new T.Box3(
      new T.Vector3(obstacle.x-obstacle.halfX!,baseY+.72,obstacle.z-obstacle.halfZ!),
      new T.Vector3(obstacle.x+obstacle.halfX!,baseY+3.2,obstacle.z+obstacle.halfZ!))});
    loaded=true;
  });
  function floorAt(x:number,z:number,ground:number){return state?.floorAt(x,z,ground)??ground;}
  function indoors(x:number,z:number){
    return loaded && z-OUTPOST_SITE.z<6.1 && floorAt(x,z,baseY-1)>baseY+.3;
  }
  function updateVisibility(camera:T.Camera){
    if(!loaded)return;
    camera.updateMatrixWorld();viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    if(ultraLighting)interiorLighting.updateView(camera);
    frustum.setFromProjectionMatrix(viewMatrix);
    for(const batch of instanceVisibility)if(batch.sector.visible)batch.update(frustum);
  }
  function ceilingAt(x:number,z:number){
    if(!indoors(x,z))return Infinity;
    const px=x-OUTPOST_SITE.x,pz=z-OUTPOST_SITE.z;
    if(Math.hypot(px,pz)<5.3)return baseY+3.5;
    if(px < -12 || px > 12 && pz > -8)return baseY+3.65;
    if(pz < -17)return baseY+3.75;
    return baseY+2.95;
  }
  function nearby(x:number,y:number,z:number,yaw:number){return state?nearestOutpostDoor(state.doors,x,y,z,yaw):null;}
  function interact(x:number,y:number,z:number,yaw:number){
    const door=nearby(x,y,z,yaw);
    if(!door)return false;
    toggleOutpostDoor(door,x,y,z);return true;
  }
  function update(dt:number,x:number,y:number,z:number,lightTier:boolean,enabled:boolean) {
    if(!loaded||!state)return;
    let changed=false;
    if(enabled)for(let i=0;i<state.doors.length;i++){
      const door=state.doors[i];
      if(stepOutpostDoor(door,dt,x,y,z)){
        actions[i].action.time=door.amount*actions[i].duration;changed=true;
      }
    }
    if(changed){mixer!.update(0);root.updateMatrixWorld(true);}
    origin.set(x,y+1.5,z);
    for(const sector of sectors){
      const range=sector.interior?(lightTier?8:14):(lightTier?220:400);
      sector.object.visible=withinDetailRange(sector.bounds.distanceToPoint(origin),sector.object.visible,range,sector.interior?4:20);
    }
    if(ultraLighting){
      let index=0,distance=Infinity;
      for(let i=0;i<roomLights.length;i++){
        const [rx,rz]=roomLights[i],d=(x-OUTPOST_SITE.x-rx)**2+(z-OUTPOST_SITE.z-rz)**2;
        if(d<distance){distance=d;index=i;}
      }
      const [rx,rz]=roomLights[index];
      interiorLighting.setRoomCenter(OUTPOST_SITE.x+rx,baseY,OUTPOST_SITE.z+rz);
    }
  }
  function constrainCamera(x:number,y:number,z:number,position:T.Vector3) {
    if(!loaded||Math.abs(x-OUTPOST_SITE.x)>34||Math.abs(z-OUTPOST_SITE.z)>35)return;
    origin.set(x,y,z);direction.copy(position).sub(origin);let distance=direction.length();
    if(distance<.01)return;
    direction.divideScalar(distance);ray.set(origin,direction);
    for(const {obstacle,box} of cameraBoxes){
      if(obstacle.disabled||Math.abs(obstacle.x-x)>distance+obstacle.radius||Math.abs(obstacle.z-z)>distance+obstacle.radius)continue;
      if(ray.intersectBox(box,hit))distance=Math.min(distance,Math.max(.35,origin.distanceTo(hit)-.15));
    }
    position.copy(origin).addScaledVector(direction,distance);
    position.y=Math.min(position.y,ceilingAt(position.x,position.z)-.15);
  }
  return {root,ready,floorAt,indoors,ceilingAt,nearby,interact,update,updateVisibility,constrainCamera,
    setInteriorActive:interiorLighting.setActive,
    setUltraLighting(enabled:boolean){ultraLighting=enabled;interiorLighting.setUltra(enabled);},
    get loaded(){return loaded;},get doors(){return state?.doors??[];},
    dispose(){
      disposed=true;mixer?.stopAllAction();if(mixer)mixer.uncacheRoot(mixer.getRoot());
      root.removeFromParent();instanceVisibility.length=0;freeResources();
    }};
}
