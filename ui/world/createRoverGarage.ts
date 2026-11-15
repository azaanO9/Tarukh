import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {assetUrl} from '../../lib/assetUrl.ts';
import {GARAGE_SITE,garageFloorAt} from '../../game/garageSite.ts';
import {garageIndoors,type GarageState} from '../../game/roverGarage.ts';
import type {CollisionObstacle} from '../../game/collision.ts';

/** Loads only the reviewed shelter. The existing game rover supplies the vehicle. */
export function createRoverGarage(scene:T.Scene,state:GarageState,datum:number,obstacles:CollisionObstacle[]) {
  const root=new T.Group();root.name='TARUKH rover garage';root.position.set(GARAGE_SITE.x,datum,GARAGE_SITE.z);scene.add(root);
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  const interiors:T.Object3D[]=[];
  const light=new T.PointLight('#e5efff',24,10,2),accent=new T.PointLight('#9784ed',5,6,2);
  light.visible=accent.visible=false;
  light.position.set(0,3.7,1.4);accent.position.set(0,3.2,-2.5);root.add(light,accent);
  const ray=new T.Ray(),origin=new T.Vector3(),direction=new T.Vector3(),hit=new T.Vector3();
  const cameraBoxes=state.obstacles.map(obstacle=>({obstacle,box:new T.Box3(
    new T.Vector3(obstacle.x-obstacle.halfX!,datum,obstacle.z-obstacle.halfZ!),
    new T.Vector3(obstacle.x+obstacle.halfX!,datum+(obstacle.id==='garage-solar-racks'?1.6:4.1),obstacle.z+obstacle.halfZ!))}));
  let mixer:T.AnimationMixer|null=null,action:T.AnimationAction|null=null,duration=4,previous=-1,disposed=false,loaded=false;
  const free=()=>{
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
    geometries.clear();materials.clear();textures.clear();
  };
  const decoder=new DRACOLoader().setDecoderPath(assetUrl('/draco/')).setWorkerLimit(1);
  const ready=new GLTFLoader().setDRACOLoader(decoder).loadAsync(assetUrl('/models/garage/garage.glb')).then(gltf=>{
    gltf.scene.traverse(node=>{
      if(node.userData.garageSection==='interior')interiors.push(node);
      if(!(node instanceof T.Mesh))return;
      geometries.add(node.geometry);
      let interior=false,parent:T.Object3D|null=node;
      while(parent){interior ||= parent.userData.garageSection==='interior';parent=parent.parent;}
      node.castShadow=!interior;node.receiveShadow=true;
      for(const material of Array.isArray(node.material)?node.material:[node.material]){
        materials.add(material);for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);
      }
    });
    if(disposed){free();return;}
    const clip=gltf.animations.find(a=>a.name==='Garage_Door_Open');
    if(!clip)throw new Error('Garage door animation is missing');
    root.add(gltf.scene);mixer=new T.AnimationMixer(gltf.scene);action=mixer.clipAction(clip);
    action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();action.paused=true;duration=clip.duration;
    action.time=0;mixer.update(0);root.updateMatrixWorld(true);
    obstacles.push(...state.obstacles);buildReturnBay();loaded=true;
  }).finally(()=>decoder.dispose());

  function buildReturnBay() {
    const points:number[]=[];
    const segment=(x1:number,z1:number,x2:number,z2:number)=>points.push(x1,.022,z1,x2,.022,z2);
    // Static paint on the game's graded soil, not another landscape mesh.
    for(const side of [-1,1]){
      segment(side*3.1,12.6,side*3.1,17);segment(side*3.1,12.6,side*2.2,12.6);segment(side*3.1,17,side*2.2,17);
      for(const z of [14,16]){segment(side*.7,z,0,z-.7);}
    }
    const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(points,3));
    const material=new T.LineBasicMaterial({color:'#f3cf89',transparent:true,opacity:.8});
    geometries.add(geometry);materials.add(material);root.add(new T.LineSegments(geometry,material));
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const context=canvas.getContext('2d');if(!context)return;
    context.fillStyle='#f5ddaa';context.font='bold 38px system-ui';context.textAlign='center';
    context.fillText('ROVER RETURN BAY',256,55);context.font='23px system-ui';context.fillText('STOP · EXIT · E TO PARK',256,98);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const labelMat=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
    const labelGeo=new T.PlaneGeometry(4,.95);labelGeo.rotateX(-Math.PI/2);labelGeo.rotateY(Math.PI);
    const label=new T.Mesh(labelGeo,labelMat);label.position.set(0,.025,17.5);root.add(label);geometries.add(labelGeo);materials.add(labelMat);
  }

  function setPerformance(performance:boolean) {
    // Zero-intensity lights still add a lighting loop to every lit material.
    // Performance keeps the source emissive fixtures without two extra lights.
    light.visible=accent.visible=!performance;
  }
  function update(x:number,z:number,performance:boolean) {
    if(!loaded)return;
    setPerformance(performance);
    if(previous!==state.doorAmount){previous=state.doorAmount;action!.time=duration*previous;mixer!.update(0);root.updateMatrixWorld(true);}
    const distance=Math.hypot(x-GARAGE_SITE.x,z-GARAGE_SITE.z);
    root.visible=distance<(performance?220:400);
    // The opaque closed door hides the high-detail workshop from outside.
    const workshopVisible=state.doorAmount>0||garageIndoors(x,z);
    for(const interior of interiors)interior.visible=workshopVisible&&distance<(performance?17:24);
    const lit=state.lightsOn&&workshopVisible&&distance<22;
    light.intensity=lit?24:0;accent.intensity=lit?(performance?3:5):0;
  }
  function ceilingAt(x:number,z:number){return garageIndoors(x,z)?datum+3.95:Infinity;}
  function constrainCamera(x:number,y:number,z:number,position:T.Vector3) {
    if(Math.abs(x-GARAGE_SITE.x)>12||Math.abs(z-GARAGE_SITE.z)>12)return;
    origin.set(x,y,z);direction.copy(position).sub(origin);let distance=direction.length();if(distance<.01)return;
    direction.divideScalar(distance);ray.set(origin,direction);
    for(const {obstacle,box} of cameraBoxes){
      if(obstacle.disabled)continue;
      if(ray.intersectBox(box,hit))distance=Math.min(distance,Math.max(.35,origin.distanceTo(hit)-.15));
    }
    position.copy(origin).addScaledVector(direction,distance);position.y=Math.min(position.y,ceilingAt(position.x,position.z)-.15);
  }
  return{ready,update,setPerformance,ceilingAt,constrainCamera,floorAt:(x:number,z:number,ground:number)=>garageFloorAt(x,z,ground,datum),
    get loaded(){return loaded;},
    dispose(){disposed=true;root.removeFromParent();mixer?.stopAllAction();if(mixer)mixer.uncacheRoot(mixer.getRoot());free();light.dispose();accent.dispose();},
  };
}
