import {convexRockOutline,rockContact,rockLiftAt} from "../../game/rockContact.ts";
import * as T from "three";
import {marsExpeditionHeight} from '../../game/marsExpeditionTerrain.ts';
import {marsGroundTint} from "./marsTerrain.ts";
import {CHUNK_SIZE as S, CHUNK_RADIUS as R, TERRAIN_SAMPLE_STEP as STEP, baseBorderSide, chunkKey, isBaseChunk, streamedHeight, streamedRock} from "../../game/terrainStreaming.ts";
import {isExplorationTile} from '../../game/explorationBounds.ts';

import type {CollisionObstacle} from "../../game/collision.ts";

/** A fixed pool, filled a few rows at a time. Shared materials/textures never recompile. */
export function createStreamedMars(root:T.Group, ground:T.Mesh, baseHeight:(x:number,z:number)=>number, options:{radius?:number;rocks?:number;pebbles?:number;obstacles?:CollisionObstacle[];sampleHeight?:(x:number,z:number)=>number;clearings?:readonly {x:number;z:number;radius:number}[]}={}) {
 const sampleHeight=options.sampleHeight??marsExpeditionHeight;
 const clearings=options.clearings??[];
 const radius=options.radius ?? R, rockCount=options.rocks ?? 18;
 const pebbleCount=options.pebbles??(radius<=2?12:32);
 const segments=S/STEP;
 const gridVertices=(segments+1)**2;
 // Fixed edge-index variants add only 35 triangles when adjoining the campus.
 const edgeIndices=Array.from({length:5},(_,side)=>{
  const indices:number[]=[];
  for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){
   const a=row*(segments+1)+col,b=a+segments+1,c=a+1,d=b+1;
   if(side===1&&col===0){const m=gridVertices+row;indices.push(a,m,c,m,b,c);}else if(side===3&&row===0){const m=gridVertices+col;indices.push(a,b,m,m,b,c);}else indices.push(a,b,c);
   if(side===2&&col===segments-1){const m=gridVertices+row;indices.push(b,d,m,b,m,c);}else if(side===4&&row===segments-1){const m=gridVertices+col;indices.push(b,m,c,m,d,c);}else indices.push(b,d,c);
  }
  return new T.BufferAttribute(new Uint16Array(indices),1);
 });
 const obstacles=options.obstacles ?? [], baseObstacleCount=obstacles.length;
 const rockGeometry=new T.DodecahedronGeometry(1,0);
 rockGeometry.computeBoundingBox();
 const rockVertices=rockGeometry.attributes.position;
 const rockOutline=convexRockOutline(Array.from({length:rockVertices.count},(_,i)=>({x:rockVertices.getX(i),z:rockVertices.getZ(i)})));
 const rockTemplate=root.getObjectByName("mars-small-rocks") as T.InstancedMesh|undefined;
 const fallbackMaterial=rockTemplate?null:new T.MeshStandardMaterial({color:0x80604a,roughness:.94,flatShading:true});
 const rockMaterial=rockTemplate?.material??fallbackMaterial!;
 const dummy=new T.Object3D(),tint=new T.Color(),groundTint=new T.Color(),paleRock=new T.Color(1,.90,.77);
 const pool=Array.from({length:(radius*2+1)**2},()=>{
  const geometry=new T.PlaneGeometry(S,S,segments,segments);geometry.rotateX(-Math.PI/2);
  for(const [name,attribute] of Object.entries(geometry.attributes)){
   const values=new Float32Array((gridVertices+segments)*attribute.itemSize);values.set(attribute.array);
   geometry.setAttribute(name,new T.BufferAttribute(values,attribute.itemSize));
  }
  geometry.setIndex(edgeIndices[0]);
  geometry.boundingBox=new T.Box3();geometry.boundingSphere=new T.Sphere();
  const colors=new Float32Array(geometry.attributes.position.count*3);colors.fill(1);
  geometry.setAttribute("color",new T.BufferAttribute(colors,3));
  const mesh=new T.Mesh(geometry,ground.material);mesh.receiveShadow=true;mesh.visible=false;root.add(mesh);
  mesh.name="streamed-ground";
  const rocks=new T.InstancedMesh(rockGeometry,rockMaterial,rockCount+pebbleCount);rocks.visible=false;rocks.name="streamed-rocks";rocks.receiveShadow=true;rocks.castShadow=radius>2;root.add(rocks);
  const contacts:CollisionObstacle[]=[];
  return {mesh,rocks,contacts,key:"",x:0,z:0,edge:0,row:-1,ready:false,minY:Infinity,maxY:-Infinity,heights:new Float64Array((segments+3)**2)};
 });
 let cx=Infinity,cz=Infinity;
 let drawRadius=radius;
 let coverageDirty=true;
 const desired=new Set<string>();
 const queue:typeof pool=[];
 function syncContacts(){obstacles.length=baseObstacleCount;for(const slot of pool)if(slot.ready)for(const contact of slot.contacts)obstacles.push(contact);}
 function finishRocks(slot:typeof pool[number]){
  slot.contacts.length=0;
  for(let i=0;i<rockCount+pebbleCount;i++){
   const r=streamedRock(slot.x,slot.z,i),height=heightAt(r.x,r.z);
   if(i>=rockCount){r.sx*=.1;r.sy*=.1;r.sz*=.1;}
   let clear=false;
   for(const area of clearings)if(Math.hypot(r.x-area.x,r.z-area.z)<area.radius+Math.max(r.sx,r.sz)){clear=true;break;}
   dummy.position.set(r.x-slot.x*S,height+r.sy*.55,r.z-slot.z*S);dummy.rotation.set(0,r.yaw,0);dummy.scale.set(r.sx,r.sy,r.sz);dummy.updateMatrix();slot.rocks.setMatrixAt(i,dummy.matrix);
   if(clear){dummy.scale.setScalar(0);dummy.updateMatrix();slot.rocks.setMatrixAt(i,dummy.matrix);}
   tint.setRGB(.72+r.tint*.25,.75+r.tint*.18,.77+r.tint*.15).lerp(paleRock,r.tint*.35);slot.rocks.setColorAt(i,tint);
   if(i<rockCount&&!clear)slot.contacts.push(rockContact(r.x,r.z,rockOutline,r.sx,r.sz,r.yaw,height,r.sy*(.55+rockGeometry.boundingBox!.max.y)));
  }
  slot.rocks.position.set(slot.x*S,0,slot.z*S);slot.rocks.instanceMatrix.needsUpdate=true;if(slot.rocks.instanceColor)slot.rocks.instanceColor.needsUpdate=true;slot.rocks.computeBoundingSphere();slot.rocks.visible=true;
 }
 function request(x:number,z:number){
  const nx=Math.floor(x/S),nz=Math.floor(z/S);
  if(nx===cx&&nz===cz)return;
  cx=nx;cz=nz;coverageDirty=true;desired.clear();
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)if(!isBaseChunk(cx+dx,cz+dz)&&isExplorationTile(cx+dx,cz+dz,S))desired.add(chunkKey(cx+dx,cz+dz));
  queue.length=0;
  for(const slot of pool)if(!desired.has(slot.key)){slot.key="";slot.ready=false;slot.mesh.visible=false;slot.rocks.visible=false;slot.contacts.length=0;}
  // Nearest missing patches first. Changed coordinates only allocate here.
  const missing=[...desired].filter(key=>!pool.some(s=>s.key===key)).map(key=>key.split(",").map(Number));
  missing.sort((a,b)=>(a[0]-cx)**2+(a[1]-cz)**2-(b[0]-cx)**2-(b[1]-cz)**2);
  for(const [x,z] of missing){const slot=pool.find(s=>!s.key)!;slot.key=chunkKey(x,z);slot.x=x;slot.z=z;slot.edge=baseBorderSide(x,z);slot.mesh.geometry.setIndex(edgeIndices[slot.edge]);slot.row=-1;slot.ready=false;slot.minY=Infinity;slot.maxY=-Infinity;}
  for(const slot of pool)if(slot.key&&!slot.ready)queue.push(slot);
  queue.sort((a,b)=>(a.x-cx)**2+(a.z-cz)**2-(b.x-cx)**2-(b.z-cz)**2);
  syncContacts();
 }
 function update(x:number,z:number,budget=2){
  request(x,z);const end=performance.now()+budget;
  while(queue.length&&performance.now()<end){
   const slot=queue[0],geometry=slot.mesh.geometry,position=geometry.attributes.position;
   const row=slot.row++;
   const colors=geometry.attributes.color,normals=geometry.attributes.normal;
   // A one-cell halo supplies shared-edge normals. Each height is sampled once;
   // completing a tile never triggers a full geometry normal/bounds scan.
   const stride=segments+3;
   for(let col=-1;col<=segments+1;col++)slot.heights[(row+1)*stride+col+1]=sampleHeight(slot.x*S+col*STEP,slot.z*S+row*STEP);
   if(row<1)continue;
   const surfaceRow=row-1;
   for(let col=0;col<=segments;col++){
    const wx=slot.x*S+col*STEP,wz=slot.z*S+surfaceRow*STEP,source=row*stride+col+1,h=slot.heights[source],i=surfaceRow*(segments+1)+col;
    position.setXYZ(i,col*STEP,h,surfaceRow*STEP);slot.minY=Math.min(slot.minY,h);slot.maxY=Math.max(slot.maxY,h);
    const dx=(slot.heights[source+1]-slot.heights[source-1])/(2*STEP),dz=(slot.heights[source+stride]-slot.heights[source-stride])/(2*STEP);
    const inverseLength=1/Math.sqrt(1+dx*dx+dz*dz);
    normals.setXYZ(i,-dx*inverseLength,inverseLength,-dz*inverseLength);
    marsGroundTint(groundTint,wx,wz,1-inverseLength);colors.setXYZ(i,groundTint.r,groundTint.g,groundTint.b);
   }
   if(slot.row>segments+1){
    const uv=geometry.attributes.uv;
    for(let k=0;k<segments;k++){
     const along=k*STEP+1,px=slot.edge===1?0:slot.edge===2?S:along,pz=slot.edge===3?0:slot.edge===4?S:along;
     const i=gridVertices+k;
     if(slot.edge){
      const wx=slot.x*S+px,wz=slot.z*S+pz,h=sampleHeight(wx,wz);
      const dx=(sampleHeight(wx+1,wz)-sampleHeight(wx-1,wz))*.5,dz=(sampleHeight(wx,wz+1)-sampleHeight(wx,wz-1))*.5,inv=1/Math.hypot(dx,1,dz);
      position.setXYZ(i,px,h,pz);normals.setXYZ(i,-dx*inv,inv,-dz*inv);uv.setXY(i,px/S,1-pz/S);
      marsGroundTint(groundTint,wx,wz,1-inv);colors.setXYZ(i,groundTint.r,groundTint.g,groundTint.b);
      slot.minY=Math.min(slot.minY,h);slot.maxY=Math.max(slot.maxY,h);
     }else{position.setXYZ(i,0,position.getY(0),0);normals.setXYZ(i,normals.getX(0),normals.getY(0),normals.getZ(0));}
    }
    uv.needsUpdate=true;
    position.needsUpdate=true;colors.needsUpdate=true;normals.needsUpdate=true;
    geometry.boundingBox!.min.set(0,slot.minY-.001,0);geometry.boundingBox!.max.set(S,slot.maxY+.001,S);
    geometry.boundingSphere!.center.set(S/2,(slot.minY+slot.maxY)/2,S/2);
    geometry.boundingSphere!.radius=Math.hypot(S/2,(slot.maxY-slot.minY)/2,S/2)+.001;
    slot.mesh.position.set(slot.x*S,0,slot.z*S);slot.ready=true;slot.mesh.visible=true;finishRocks(slot);syncContacts();queue.shift();coverageDirty=true;
   }
  }
  const bounds=readyCoverage();
  for(const slot of pool){
   slot.mesh.material=ground.material;slot.rocks.material=rockTemplate?.material??rockMaterial;
   const visible=slot.ready&&slot.x*S>=bounds.x&&slot.z*S>=bounds.y&&(slot.x+1)*S<=bounds.z&&(slot.z+1)*S<=bounds.w;
   slot.mesh.visible=visible;slot.rocks.visible=visible;
  }
 }
 function heightAt(x:number,z:number){return Math.abs(x)<=210&&Math.abs(z)<=210?baseHeight(x,z):streamedHeight(x,z,sampleHeight);}
 function roverHeightAt(x:number,z:number){
  let lift=0;const tileX=Math.floor(x/S),tileZ=Math.floor(z/S);
  for(const slot of pool)if(slot.ready&&Math.abs(slot.x-tileX)<=1&&Math.abs(slot.z-tileZ)<=1){
   for(const contact of slot.contacts)if(Math.abs(x-contact.x)<contact.radius+.2&&Math.abs(z-contact.z)<contact.radius+.2)lift=Math.max(lift,rockLiftAt(x,z,contact));
  }
  return heightAt(x,z)+lift;
 }
 const coverage=new T.Vector4();
 function readyCoverage(){
  if(!coverageDirty)return coverage;
  coverageDirty=false;coverage.set(0,0,0,0);
  if(!Number.isFinite(cx)||!Number.isFinite(cz))return coverage;
  // Hide far relief only where every visible detail tile has finished. Queued
  // tiles, including a newly approached ridge, must retain their far surface.
  for(let r=drawRadius;r>=0;r--){
   let complete=true;
   for(let z=cz-r;z<=cz+r&&complete;z++)for(let x=cx-r;x<=cx+r;x++){
    if(isBaseChunk(x,z)||!isExplorationTile(x,z,S))continue;
    if(!pool.some(slot=>slot.ready&&slot.x===x&&slot.z===z)){complete=false;break;}
   }
   if(complete)return coverage.set((cx-r)*S,(cz-r)*S,(cx+r+1)*S,(cz+r+1)*S);
  }
  return coverage;
 }
 return {update,heightAt,roverHeightAt,pending:()=>queue.length, count:()=>pool.reduce((n,s)=>n+Number(s.ready&&!!s.key),0),
  setPerformance:(light:boolean)=>{const next=light?Math.max(1,radius-1):radius;if(next!==drawRadius){drawRadius=next;coverageDirty=true;}},
  visibleCount:()=>pool.reduce((n,s)=>n+Number(s.mesh.visible),0),
  coverage:readyCoverage,
  dispose:()=>{obstacles.length=baseObstacleCount;for(const s of pool){root.remove(s.mesh,s.rocks);s.mesh.geometry.dispose();s.rocks.dispose();}rockGeometry.dispose();fallbackMaterial?.dispose();}};
}
