import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {STARBASE as D,type RigPose,type VehicleView} from '../../game/starbaseRig.ts';

const UP=new T.Vector3(0,1,0),DEG=Math.PI/180;

/** Original procedural geometry; no downloaded models, maps, or scene dependencies. */
export function createStarbase(scene:T.Object3D,options:{shipCatchPins?:boolean;ground?:boolean}={}) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  const own=<G extends T.BufferGeometry>(g:G)=>{geometries.add(g);return g;};
  const material=(color:string,metalness:number,roughness:number,extra:T.MeshStandardMaterialParameters={})=>{
    const m=new T.MeshStandardMaterial({color,metalness,roughness,...extra});materials.add(m);return m;
  };
  const steel=material('#b9c1c8',.95,.28),bright=material('#d0d4d8',.95,.23);
  const dark=material('#35393d',.2,.7),edge=material('#525b62',.7,.4);
  const black=material('#111318',.15,.68),rubber=material('#191b1c',0,.92);
  const copper=material('#8a5838',.9,.32),nozzle=material('#4a4d52',.85,.44);
  const yellow=material('#dda520',.35,.51),white=material('#d6d8d7',.25,.65);
  const tile=material('#121315',0,.85),concrete=material('#a6a397',.03,.95);
  const asphalt=material('#454849',.04,.97),soil=material('#96927d',0,1);
  const railSteel=material('#9caaaf',.86,.3);
  const lightMat=material('#d6f1ff',.15,.3,{emissive:'#abd9f3',emissiveIntensity:2});
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#808080';ctx.fillRect(0,0,256,256);
    for(let y=0;y<256;y++){
      const shade=116+Math.round(18*Math.sin(y*3.17)+5*Math.sin(y*1.31));
      ctx.fillStyle=`rgb(${shade},${shade},${shade})`;ctx.fillRect(0,y,256,1);
    }
    const brushed=new T.CanvasTexture(canvas);brushed.wrapS=brushed.wrapT=T.RepeatWrapping;brushed.repeat.set(4,24);textures.add(brushed);
    steel.bumpMap=bright.bumpMap=brushed;steel.bumpScale=bright.bumpScale=.013;
    if(options.ground!==false){
    const surface=document.createElement('canvas');surface.width=surface.height=512;
    const groundCtx=surface.getContext('2d')!,pixels=groundCtx.createImageData(512,512);
    let seed=34891;
    for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const shade=220+(seed>>>27);pixels.data[i]=shade;pixels.data[i+1]=shade;pixels.data[i+2]=shade-3;pixels.data[i+3]=255;}
    groundCtx.putImageData(pixels,0,0);groundCtx.strokeStyle='#a4a79e';groundCtx.lineWidth=1;
    groundCtx.strokeRect(.5,.5,511,511);groundCtx.strokeRect(3,3,506,506);
    const concreteMap=new T.CanvasTexture(surface);concreteMap.colorSpace=T.SRGBColorSpace;
    concreteMap.wrapS=concreteMap.wrapT=T.RepeatWrapping;concreteMap.repeat.set(7,9);textures.add(concreteMap);
    concrete.map=concreteMap;concrete.bumpMap=concreteMap;concrete.bumpScale=.025;
    const soilCanvas=document.createElement('canvas');soilCanvas.width=soilCanvas.height=512;
    function groundNoise(x:number,y:number,cells:number){
      const gx=x/512*cells,gy=y/512*cells,ix=Math.floor(gx),iy=Math.floor(gy);
      const tx=gx-ix,ty=gy-iy,sx=tx*tx*(3-2*tx),sy=ty*ty*(3-2*ty);
      const hash=(cx:number,cy:number)=>{
        let h=Math.imul(cx%cells+17,73856093)^Math.imul(cy%cells+31,19349663);
        h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;
      };
      const lo=hash(ix,iy)*(1-sx)+hash(ix+1,iy)*sx,hi=hash(ix,iy+1)*(1-sx)+hash(ix+1,iy+1)*sx;
      return lo*(1-sy)+hi*sy;
    }
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      const i=(y*512+x)*4,grain=pixels.data[i]-230;
      const shade=210+grain*.15+20*groundNoise(x,y,4)+8*groundNoise(x,y,16);
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=shade;
    }
    soilCanvas.getContext('2d')!.putImageData(pixels,0,0);
    const soilMap=new T.CanvasTexture(soilCanvas);soilMap.colorSpace=T.SRGBColorSpace;
    soilMap.wrapS=soilMap.wrapT=T.RepeatWrapping;soilMap.repeat.set(240,240);soilMap.anisotropy=4;textures.add(soilMap);
    soil.map=soilMap;soil.bumpMap=soilMap;soil.bumpScale=.08;
    }
  }
  const unitBox=own(new T.BoxGeometry(1,1,1));
  const unitCylinder=own(new T.CylinderGeometry(1,1,1,12));
  const unitSphere=own(new T.SphereGeometry(1,12,8));
  const scratch=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),matrix=new T.Matrix4(),rotation=new T.Quaternion(),scale=new T.Vector3();
  const mesh=(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,name='')=>{
    const o=new T.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  };
  function box(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,name=''){
    const o=mesh(parent,unitBox,m,name);o.position.set(x,y,z);o.scale.set(w,h,d);return o;
  }
  function cylinder(parent:T.Object3D,m:T.Material,x:number,y:number,z:number,r:number,h:number,name=''){
    const o=mesh(parent,unitCylinder,m,name);o.position.set(x,y,z);o.scale.set(r,h,r);return o;
  }
  function beam(parent:T.Object3D,m:T.Material,from:readonly number[],to:readonly number[],width:number,depth=width){
    a.set(from[0],from[1],from[2]);b.set(to[0],to[1],to[2]);scratch.subVectors(b,a);
    const o=mesh(parent,unitBox,m);o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(UP,scratch.clone().normalize());o.scale.set(width,scratch.length(),depth);return o;
  }
  function tube(parent:T.Object3D,m:T.Material,from:readonly number[],to:readonly number[],radius:number){
    a.set(from[0],from[1],from[2]);b.set(to[0],to[1],to[2]);scratch.subVectors(b,a);
    const o=mesh(parent,unitCylinder,m);o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(UP,scratch.clone().normalize());o.scale.set(radius,scratch.length(),radius);return o;
  }
  function group(parent:T.Object3D,name:string){const o=new T.Group();o.name=name;parent.add(o);return o;}
  function ring(parent:T.Object3D,m:T.Material,r:number,t:number,y:number,name=''){
    const o=mesh(parent,own(new T.TorusGeometry(r,t,6,64)),m,name);o.rotation.x=Math.PI/2;o.position.y=y;return o;
  }
  function label(parent:T.Object3D,text:string,w:number,h:number,color='#dae4e5'){
    if(typeof document==='undefined')return new T.Group();
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.font='600 64px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const mat=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});materials.add(mat);
    const o=mesh(parent,own(new T.PlaneGeometry(w,h)),mat);o.castShadow=false;return o;
  }
  /** Merge only explicitly static sections; every articulated pivot survives. */
  function batch(root:T.Group){
    root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();
    const buckets=new Map<T.Material,T.BufferGeometry[]>(),remove:T.Mesh[]=[];
    root.traverse(o=>{
      if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh||Array.isArray(o.material)||o.material.transparent)return;
      let g=o.geometry.clone().applyMatrix4(matrix.copy(inverse).multiply(o.matrixWorld));
      if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
      const list=buckets.get(o.material)??[];list.push(g);buckets.set(o.material,list);remove.push(o);
    });
    for(const [mat,parts] of buckets){
      const merged=mergeGeometries(parts,false);if(!merged)throw new Error('Incompatible static rig geometry');
      mesh(root,own(merged),mat,root.name+' / '+mat.uuid);for(const part of parts)part.dispose();
    }
    for(const o of remove)o.removeFromParent();
  }

  const groundPad=group(scene,'groundPad');
  if(options.ground!==false){
  box(groundPad,soil,0,-1.1,0,5000,2,5000).castShadow=false;
  for(let i=0;i<20;i++){
    const berm=mesh(groundPad,unitSphere,soil);berm.position.set(-160+i*31,-2,-120-Math.sin(i*1.7)*30);
    berm.scale.set(25+i%3*8,5+i%4,16+i%5*4);
  }
  box(groundPad,asphalt,30,-.02,75,360,.15,13);
  box(groundPad,concrete,-48,.15,5,38,.6,140);
  box(groundPad,concrete,25,.15,5,67,.6,140);
  box(groundPad,concrete,-13,.15,-47,34,.6,36);
  box(groundPad,concrete,-13,.15,56,34,.6,38);
  // Open deflector channel: separate deck slabs leave a visible trench.
  box(groundPad,dark,-13,-.2,4,30,.7,68);
  for(const side of [-1,1])box(groundPad,concrete,-13,.8,side*33.5+4,32,1.6,1.4);
  for(let i=0;i<11;i++){
    const slab=box(groundPad,edge,-13,.05+i*.16,20-i*3,21,.3,2.9);slab.rotation.x=-.05;
  }
  for(let i=0;i<40;i++)box(groundPad,white,-140+i*8,.08,75,4,.04,.15);
  for(let i=0;i<8;i++){
    const x=45+i*4;
    tube(groundPad,white,[x,.7,0],[x,.7,-50],.22);
    box(groundPad,edge,x,.6,-22,.8,1.2,.9);
  }
  for(const z of [-42,-34,-26]){
    cylinder(groundPad,white,61,10,z,4,20);
    const dome=mesh(groundPad,unitSphere,white);dome.position.set(61,20,z);dome.scale.set(4,2.2,4);
    ring(groundPad,edge,4,.08,2).position.set(61,2,z);
    const band=ring(groundPad,edge,4.02,.08,8);band.position.set(61,8,z);
    for(let y=5;y<19;y+=3){const seam=ring(groundPad,edge,4.01,.025,y);seam.position.set(61,y,z);}
    for(const dx of [-.32,.32])tube(groundPad,edge,[61+dx,1,z+4.08],[61+dx,19,z+4.08],.06);
    for(let y=1;y<19;y+=.65)tube(groundPad,edge,[60.68,y,z+4.08],[61.32,y,z+4.08],.035);
    tube(groundPad,edge,[61,1,z],[40,1,z],.32);
  }
  // Remove no terrain assets: all slab, trench, plumbing and berm geometry is original.
  for(let i=0;i<13;i++){
    const x=-80+i*12;box(groundPad,yellow,x,.38,-69,.45,.8,.45);
    for(const dz of [-1,1])box(groundPad,edge,x,3,-69+dz*.03,.04,5,.04);
  }
  const padSign=label(groundPad,'CATCH ZONE',18,3,'#d8d5c5');padSign.rotation.x=-Math.PI/2;padSign.position.set(12,.48,40);
  batch(groundPad);
  }

  const orbitalLaunchMount=group(scene,'orbitalLaunchMount');
  const shape=new T.Shape();shape.absarc(0,0,9.3,0,Math.PI*2,false);
  const hole=new T.Path();hole.absarc(0,0,5.35,0,Math.PI*2,true);shape.holes.push(hole);
  const tableGeo=own(new T.ExtrudeGeometry(shape,{depth:2.4,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.12,bevelThickness:.12,curveSegments:48}));
  tableGeo.rotateX(-Math.PI/2).translate(0,D.mountHeight-1.2,0);mesh(orbitalLaunchMount,tableGeo,dark,'launchRingTable');
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,cos=Math.cos(angle),sin=Math.sin(angle);
    tube(orbitalLaunchMount,edge,[cos*13,.6,sin*13],[cos*7.6,19,sin*7.6],1.05);
    box(orbitalLaunchMount,concrete,cos*13,.45,sin*13,4.4,.7,4.4);
    tube(orbitalLaunchMount,dark,[cos*10,8,sin*10],[Math.cos(angle+Math.PI/3)*8,17,Math.sin(angle+Math.PI/3)*8],.28);
  }
  for(let i=0;i<20;i++){
    const theta=i*Math.PI/10,clamp=group(orbitalLaunchMount,'holdDownClamp'+i);
    clamp.position.set(Math.cos(theta)*6.0,21.15,Math.sin(theta)*6.0);clamp.rotation.y=-theta;
    box(clamp,edge,0,0,0,1.8,.8,.65);box(clamp,steel,-.8,.65,0,.5,.9,.6);
    tube(clamp,black,[.8,-1,0],[-.6,.6,0],.19);
  }
  ring(orbitalLaunchMount,white,10.2,.24,2.6,'delugeManifold');
  for(let i=0;i<16;i++){
    const t=i*Math.PI/8;tube(orbitalLaunchMount,steel,[Math.cos(t)*10.2,2.6,Math.sin(t)*10.2],[Math.cos(t)*5,1.6,Math.sin(t)*5],.12);
  }
  batch(orbitalLaunchMount);

  const mechazillaTower=group(scene,'mechazillaTower');mechazillaTower.position.x=D.towerX;
  const towerTrussMesh=group(mechazillaTower,'towerTrussMesh');
  for(const x of [-5.8,5.8])for(const z of [-5.8,5.8]){
    box(towerTrussMesh,dark,x,67.5,z,1.05,135,1.05);
    box(towerTrussMesh,concrete,x,1,z,3.1,2,3.1);
  }
  for(let bay=0;bay<9;bay++){
    const y=bay*15;
    for(const side of [-1,1]){
      box(towerTrussMesh,edge,0,y+1,side*5.8,12,.62,.62);
      box(towerTrussMesh,edge,side*5.8,y+1,0,.62,.62,12);
      beam(towerTrussMesh,dark,[-5.8,y+1,side*5.8],[5.8,y+15,side*5.8],.43);
      beam(towerTrussMesh,dark,[5.8,y+1,side*5.8],[-5.8,y+15,side*5.8],.43);
      beam(towerTrussMesh,dark,[side*5.8,y+1,-5.8],[side*5.8,y+15,5.8],.43);
      beam(towerTrussMesh,dark,[side*5.8,y+1,5.8],[side*5.8,y+15,-5.8],.43);
      // Each bay has a grated service deck and an outer handrail.
      box(towerTrussMesh,edge,-6.7,y+1,0,1.6,.12,12);
      box(towerTrussMesh,yellow,-7.45,y+2.1,0,.08,.08,12);
      for(const z of [-5,0,5])box(towerTrussMesh,edge,-7.45,y+1.55,z,.08,1.2,.08);
    }
    box(towerTrussMesh,edge,-3.9,y+7,4.6,1.5,.12,11).rotation.x=.88;
    const marker=label(towerTrussMesh,String(bay+1).padStart(2,'0'),1.4,.5);marker.position.set(0,y+3,6.36);
  }
  for(const z of [-4.75,4.75]){
    box(towerTrussMesh,railSteel,6.55,75,z,.45,100,.34);
    box(towerTrussMesh,bright,6.82,75,z,.14,100,1.12);
    box(towerTrussMesh,edge,6.28,75,z,.14,100,1.12);
    for(let y=25;y<=125;y+=5)box(towerTrussMesh,edge,6.12,y,z,.7,.3,1.55);
  }
  // Cable trays, lift core and bundled utility risers.
  box(towerTrussMesh,edge,-4,66,-3.9,2.2,130,2.2);
  for(let z=-2;z<=2;z++)cylinder(towerTrussMesh,white,-6.6,66,z,.14,130);
  batch(towerTrussMesh);
  const topCraneAssembly=group(mechazillaTower,'topCraneAssembly');topCraneAssembly.position.y=135;
  box(topCraneAssembly,dark,0,0,0,14,1,14);
  for(const z of [-6.6,6.6])box(topCraneAssembly,yellow,0,1.8,z,14,.1,.1);
  cylinder(topCraneAssembly,edge,0,1.7,0,2.2,2);
  const jib=group(topCraneAssembly,'craneJib');jib.rotation.y=.35;
  for(const z of [-.8,.8]){
    beam(jib,edge,[-8,3,z],[21,8,z],.3);
    beam(jib,edge,[-8,5,z],[21,10,z],.3);
    for(let i=0;i<10;i++)beam(jib,edge,[-8+i*2.9,3+i*.5,z],[-5.1+i*2.9,5+(i+1)*.5,z],.15);
  }
  box(jib,dark,-8,2.4,0,4,3.5,4);
  tube(jib,black,[20,8,0],[20,-7,0],.035);
  cylinder(topCraneAssembly,steel,-4,5,-4,.12,10,'lightningMast');
  batch(topCraneAssembly);

  const quickDisconnectArm=group(mechazillaTower,'quickDisconnectArm');quickDisconnectArm.position.set(6.4,92,-5.6);
  for(const z of [-.65,.65]){
    beam(quickDisconnectArm,edge,[0,0,z],[16,0,z],.32);
    beam(quickDisconnectArm,dark,[0,2,z],[16,2,z],.27);
    for(let i=0;i<8;i++)beam(quickDisconnectArm,dark,[i*2,0,z],[(i+1)*2,2,z],.16);
  }
  box(quickDisconnectArm,edge,8,-.25,0,16,.2,1.7);
  for(const z of [-.4,0,.4])tube(quickDisconnectArm,white,[0,.5,z],[16,.5,z],.11);
  box(quickDisconnectArm,white,16.2,.8,0,1.1,2.7,2.3,'QDsocket');batch(quickDisconnectArm);

  const chopstickCarriage=group(mechazillaTower,'chopstickCarriage');chopstickCarriage.position.set(6.5,100,0);
  const carriageSledMesh=group(chopstickCarriage,'carriageSledMesh');
  for(const y of [-3,3]){
    box(carriageSledMesh,edge,-.5,y,0,3.2,.8,13.6);
    for(const z of [-5.8,5.8])box(carriageSledMesh,dark,-.5,0,z,3.2,6.8,.8);
  }
  for(const z of [-4.75,4.75])for(const y of [-2.6,2.6]){
    const roller=cylinder(carriageSledMesh,black,-.2,y,z,.72,.55);roller.rotation.x=Math.PI/2;
    beam(carriageSledMesh,edge,[-1.8,-3,z],[1,3,-z],.3);
  }
  box(carriageSledMesh,black,1.45,-3.5,0,3,.15,13);
  const sledLabel=label(carriageSledMesh,'LIFT / 01',4.7,.9);sledLabel.rotation.y=Math.PI/2;sledLabel.position.set(1.7,-2,0);
  batch(carriageSledMesh);

  function arm(side:number){
    const pivot=group(chopstickCarriage,side<0?'leftArmPivot':'rightArmPivot');pivot.position.set(1,0,side*D.hingeZ);
    const truss=group(pivot,side<0?'leftArmTrussMesh':'rightArmTrussMesh');
    for(const z of [-.55,.55]){
      beam(truss,edge,[0,-.6,z],[35,-.6,z*.5],.45);
      beam(truss,dark,[0,-4,z],[35,-1.4,z*.5],.38);
      for(let i=0;i<10;i++){
        const lo=-4+2.6*(i/10),endLo=-4+2.6*((i+1)/10);
        beam(truss,dark,[i*3.5,-.6,z],[(i+1)*3.5,endLo,z],.23);
        beam(truss,edge,[i*3.5,lo,z],[i*3.5,-.6,z],.22);
      }
    }
    for(let i=0;i<11;i++)beam(truss,dark,[i*3.5,-.6,-.55],[i*3.5,-.6,.55],.2);
    const pin=cylinder(truss,steel,0,-1.7,0,.8,4.2,'hingePin');pin.rotation.z=0;
    box(truss,lightMat,34.5,-.3,0,.22,.22,.6);
    batch(truss);
    const rail=group(pivot,side<0?'leftCatchRail':'rightCatchRail');
    const inner=-side*D.railInset;
    box(rail,railSteel,17.5,-.16,inner,35,.32,.58,'contactRail');
    for(let i=0;i<35;i++){
      box(rail,rubber,.5+i,-.43,inner,.82,.22,.65);
      const stripe=box(rail,i%2?black:yellow,.5+i,-.1,side*.55,.68,.06,.6);stripe.rotation.y=-side*.6;
    }
    batch(rail);return pivot;
  }
  const leftArmPivot=arm(-1),rightArmPivot=arm(1);
  const hydraulicPistons=group(chopstickCarriage,'hydraulicPistons');
  const pistons:{root:T.Group;barrel:T.Mesh;rod:T.Mesh;base:T.Vector3;tip:T.Vector3;arm:T.Group}[]=[];
  for(const side of [-1,1])for(let row=0;row<2;row++){
    const root=group(hydraulicPistons,`${side<0?'left':'right'}Hydraulic${row}`);
    root.userData.target=new T.Vector3();
    const barrel=cylinder(root,edge,0,4,0,.38,8),rod=cylinder(root,bright,0,10,0,.21,6);
    cylinder(root,black,0,.14,0,.53,.28);cylinder(root,steel,0,8,0,.47,.22);
    pistons.push({root,barrel,rod,base:new T.Vector3(-1.5,-1.1-row*.9,side*3.1),tip:new T.Vector3(10,-1.1-row*.9,0),arm:side<0?leftArmPivot:rightArmPivot});
  }

  const rocketEntity=group(scene,'rocketEntity');
  const superHeavyBooster=group(rocketEntity,'superHeavyBooster');
  const starshipUpperStage=group(rocketEntity,'starshipUpperStage');starshipUpperStage.position.y=D.boosterHeight;
  const boosterHullMesh=group(superHeavyBooster,'boosterHullMesh');
  mesh(boosterHullMesh,own(new T.CylinderGeometry(4.5,4.5,65.4,96,1,true)),steel).position.y=36.4;
  for(let y=4.4;y<69;y+=1.82)ring(boosterHullMesh,edge,4.505,.024,y);
  for(const z of [-4.51,4.51]){
    box(boosterHullMesh,edge,.55,35,z,.45,60,.22);
    for(let y=7;y<65;y+=3)box(boosterHullMesh,steel,.55,y,z,.58,.12,.3);
  }
  ring(boosterHullMesh,dark,4.44,.13,3.75);
  cylinder(boosterHullMesh,nozzle,0,3.75,0,4.4,.24,'thrustPuck');
  const boosterID=label(boosterHullMesh,'SUPER HEAVY',2.8,.6,'#333c42');boosterID.position.set(-.8,48,4.52);
  batch(boosterHullMesh);
  const liftPinsMesh=group(superHeavyBooster,'liftPinsMesh');
  for(const side of [-1,1]){
    box(liftPinsMesh,edge,0,D.pinHeight,side*4.52,1.5,1.5,.65);
    const pin=cylinder(liftPinsMesh,bright,0,D.pinHeight,side*D.pinZ,D.pinRadius,1.65,side<0?'leftLiftPin':'rightLiftPin');pin.rotation.x=Math.PI/2;
    box(liftPinsMesh,black,0,D.pinHeight-.55,side*4.6,1.8,.35,.6);
  }
  batch(liftPinsMesh);
  const hotStageRingMesh=group(superHeavyBooster,'hotStageRingMesh');
  ring(hotStageRingMesh,edge,4.43,.1,69.1);ring(hotStageRingMesh,steel,4.43,.1,70.9);
  for(let i=0;i<48;i++){
    const theta=i*Math.PI/24;
    const rib=box(hotStageRingMesh,steel,Math.sin(theta)*4.42,70,Math.cos(theta)*4.42,.2,1.7,.2);rib.rotation.y=theta;
  }
  batch(hotStageRingMesh);
  const gridFins:T.Group[]=[];
  for(let i=0;i<4;i++){
    const mount=group(superHeavyBooster,'gridFinMount'+i);mount.position.y=66.9;mount.rotation.y=i*Math.PI/2;
    const pivot=group(mount,'gridFin'+i);pivot.position.x=4.48;gridFins.push(pivot);
    const geo=group(pivot,'waffleGrid');
    box(geo,dark,2.5,0,-1.8,5,.25,.18);box(geo,dark,2.5,0,1.8,5,.25,.18);
    box(geo,edge,0,0,0,.4,.6,3.8);box(geo,dark,5,0,0,.18,.25,3.8);
    for(let j=1;j<13;j++)box(geo,nozzle,j*5/13,0,0,.07,.32,3.6);
    for(let j=1;j<10;j++)box(geo,nozzle,2.5,0,-1.8+j*3.6/10,5,.32,.07);
    batch(geo);
  }

  const starshipHullMesh=group(starshipUpperStage,'starshipHullMesh');
  const profile=[new T.Vector2(4.5,2),new T.Vector2(4.5,32)];
  for(let i=1;i<=40;i++){const t=i/40;profile.push(new T.Vector2(4.5*Math.sqrt(1-t*t),32+t*18));}
  mesh(starshipHullMesh,own(new T.LatheGeometry(profile,96)),bright,'stainlessOgive');
  const backing=mesh(starshipHullMesh,own(new T.LatheGeometry(profile,48,-Math.PI/2,Math.PI)),tile,'TPSBacking');
  backing.scale.set(1.007,1,1.007);
  for(let y=3;y<32;y+=1.8)ring(starshipHullMesh,edge,4.51,.022,y);
  const tileMatrices:T.Matrix4[]=[];
  for(let y=3;y<49.7;y+=.46){
    const u=Math.max(0,(y-32)/18),radius=4.5*Math.sqrt(1-u*u)+.025;
    const count=Math.floor(Math.PI*radius/.46),row=Math.round(y/.46),slope=y<32?0:.25*u/Math.sqrt(1-u*u);
    for(let j=0;j<count;j++){
      const theta=-Math.PI/2+(j+.5+(row%2)*.2)/count*Math.PI;
      a.set(Math.sin(theta),slope,Math.cos(theta)).normalize();rotation.setFromUnitVectors(UP,a);
      b.set(Math.sin(theta)*radius,y,Math.cos(theta)*radius);scale.set(1,1,1);
      tileMatrices.push(new T.Matrix4().compose(b,rotation,scale));
    }
  }
  const tiles=new T.InstancedMesh(own(new T.CylinderGeometry(.248,.248,.045,6)),tile,tileMatrices.length);
  tiles.name='windwardHexagonalTPS';for(let i=0;i<tileMatrices.length;i++)tiles.setMatrixAt(i,tileMatrices[i]);tiles.castShadow=false;tiles.receiveShadow=true;starshipHullMesh.add(tiles);
  batch(starshipHullMesh);
  if(options.shipCatchPins){
    const pins=group(starshipUpperStage,'shipCatchPins');
    for(const side of [-1,1]){
      box(pins,edge,0,D.shipPinHeight,side*4.52,1.5,1.5,.65);
      const pin=cylinder(pins,bright,0,D.shipPinHeight,side*D.pinZ,D.pinRadius,1.65);pin.rotation.x=Math.PI/2;
    }
    batch(pins);
  }
  const forwardFlaps:T.Group[]=[],aftFlaps:T.Group[]=[];
  for(const forward of [true,false])for(const side of [-1,1]){
    const mount=group(starshipUpperStage,`${forward?'forward':'aft'}FlapMount${side}`);
    mount.position.set(side*(forward?4.22:4.45),forward?34:5.5,0);mount.rotation.set(0,side*Math.PI/2,Math.PI/2,'YXZ');
    const pivot=group(mount,`${forward?'forward':'aft'}Flap${side<0?0:1}`);(forward?forwardFlaps:aftFlaps).push(pivot);
    const form=new T.Shape();form.moveTo(-1,0);form.lineTo(forward?4:7,0);form.lineTo(forward?3:5,forward?3.2:4.9);form.lineTo(.3,forward?4:5.6);form.closePath();
    const geo=own(new T.ExtrudeGeometry(form,{depth:.2,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:1,steps:1}));geo.rotateX(Math.PI/2);
    mesh(pivot,geo,tile);box(pivot,steel,forward?1.5:3,-.06,0,forward?5:8,.3,.22);
    for(let j=0;j<(forward?4:6);j++)box(pivot,edge,j,.08,1.3,.06,.06,2.5);
    batch(pivot);
  }

  const bell=own(new T.LatheGeometry([new T.Vector2(.76,0),new T.Vector2(.72,.18),new T.Vector2(.57,.8),new T.Vector2(.36,1.6),new T.Vector2(.29,2.25),new T.Vector2(.39,2.6)],24));
  const jacket=own(new T.CylinderGeometry(.42,.39,.65,16));
  const exhaustMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{time:{value:0},motion:{value:1},thrust:{value:0},core:{value:0}},
    vertexShader:`varying vec2 vUv;varying vec3 plumeNormal,plumeView;uniform float time,motion;
      void main(){vUv=uv;vec3 point=position;float axial=1.0-uv.y;
      point.xz*=1.0+axial*axial*(1.1+.26*sin(axial*28.0-time*motion*5.0+position.x*3.0));
      mat3 instanceNormal=mat3(instanceMatrix);vec3 n=normal/vec3(dot(instanceNormal[0],instanceNormal[0]),dot(instanceNormal[1],instanceNormal[1]),dot(instanceNormal[2],instanceNormal[2]));
      plumeNormal=normalMatrix*instanceNormal*n;vec4 mv=modelViewMatrix*instanceMatrix*vec4(point,1.0);plumeView=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec2 vUv;varying vec3 plumeNormal,plumeView;uniform float time,motion,thrust,core;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
      void main(){float axial=1.0-vUv.y;float flow=time*motion;
      float turbulence=noise(vec2(vUv.x*10.0,axial*18.0-flow*4.0))*.7+noise(vec2(vUv.x*23.0,axial*37.0-flow*7.0))*.3;
      float diamonds=pow(max(0.0,cos(axial*53.0-axial*axial*14.0)),10.0);
      vec3 color=mix(vec3(.12,.31,.92),vec3(1.0,.29,.035),smoothstep(.06,.62,axial));
      vec3 hot=mix(vec3(.8,.92,1.0),vec3(1.0,.74,.35),smoothstep(.15,.7,axial));
      color=mix(color,hot,clamp(core*.8+diamonds*.48,0.0,1.0));
      float edge=pow(abs(dot(normalize(plumeNormal),normalize(plumeView))),1.4);
      float tail=1.0-smoothstep(.2+turbulence*.28,.82+turbulence*.18,axial);
      float breakup=mix(.9,smoothstep(.18,.72,turbulence),smoothstep(.05,.85,axial));
      float alpha=edge*tail*(.5+core*.27)*min(1.0,thrust*5.0)*breakup;
      gl_FragColor=vec4(color*(1.3+core*.6+diamonds*.7),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  });materials.add(exhaustMaterial);
  type EngineRig={root:T.Group;gimbals:T.Group[];flame:T.InstancedMesh;core:T.InstancedMesh;plumeMaterials:T.ShaderMaterial[];centres:T.Vector3[];active:T.Group[]};
  function engineCluster(parent:T.Object3D,isBooster:boolean):EngineRig{
    const root=group(parent,isBooster?'raptorCluster33':'raptorCluster6');
    const fixed=group(root,'fixedEngines'),gimbals:T.Group[]=[],centres:T.Vector3[]=[],active:T.Group[]=[];
    const count=isBooster?33:6;
    for(let i=0;i<count;i++){
      const outer=isBooster?i<20:i<3,middle=isBooster&&i>=20&&i<30;
      const ringCount=outer?(isBooster?20:3):middle?10:3,index=outer?i:middle?i-20:i-(isBooster?30:3);
      const angle=index/ringCount*Math.PI*2+(middle?.14:0),radius=outer?(isBooster?3.45:2.7):middle?2.12:.86;
      const point=new T.Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius);centres.push(point);
      const engine=group(outer?fixed:root,'engine'+i);engine.position.set(point.x,3.65,point.z);
      const body=group(engine,'nozzleAssembly');body.position.y=-3.65;
      const factor=!isBooster&&outer?1.45:.68;body.scale.set(factor,1,factor);
      mesh(body,bell,nozzle);
      mesh(body,jacket,copper).position.y=2.35;
      const pipe=tube(body,steel,[.45,.5,0],[.45,2.9,0],.06);pipe.name='coolantFeed';
      ring(body,copper,.38,.055,2);ring(body,copper,.39,.055,2.6);
      cylinder(body,edge,0,3.2,0,.31,1.1);ring(body,steel,.38,.08,3.65);
      batch(body);
      if(!outer)gimbals.push(engine);active.push(engine);
    }
    batch(fixed);
    const plumeMaterial=exhaustMaterial.clone(),coreMaterial=exhaustMaterial.clone();coreMaterial.uniforms.core.value=1;
    materials.add(plumeMaterial);materials.add(coreMaterial);
    const plumeGeometry=own(new T.CylinderGeometry(.52,1,1,20,8,true));
    const flame=new T.InstancedMesh(plumeGeometry,plumeMaterial,count),core=new T.InstancedMesh(plumeGeometry,coreMaterial,count);
    flame.name='exhaustPlumes';flame.frustumCulled=false;flame.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(flame);
    core.name='exhaustCores';core.frustumCulled=false;core.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(core);
    root.userData.engineCount=count;root.userData.fixedEngines=isBooster?20:3;root.userData.gimbalingEngines=gimbals.length;
    return {root,gimbals,flame,core,plumeMaterials:[plumeMaterial,coreMaterial],centres,active};
  }
  const boosterEngines=engineCluster(superHeavyBooster,true),shipEngines=engineCluster(starshipUpperStage,false);
  const exhaustLight=new T.PointLight('#b6c9ff',0,100,2);exhaustLight.position.y=-2;rocketEntity.add(exhaustLight);
  rocketEntity.userData.velocity=new T.Vector3();rocketEntity.userData.angularVelocity=new T.Vector3();
  let detached=false,disposed=false;
  const pinLeft=new T.Vector3(),pinRight=new T.Vector3(),position=new T.Vector3(),direction=new T.Vector3();

  function updatePlumes(rig:EngineRig,thrust:number,landing:boolean,time:number,reduced:boolean,landingCount=3){
    const count=landing?landingCount:rig.centres.length;rig.flame.count=rig.core.count=count;rig.flame.visible=rig.core.visible=thrust>.001;
    for(const material of rig.plumeMaterials){material.uniforms.thrust.value=thrust;material.uniforms.time.value=time;material.uniforms.motion.value=reduced?0:1;}
    if(!rig.flame.visible)return;
    for(let i=0;i<count;i++){
      const index=landing?rig.centres.length-3+i:i,engine=rig.active[index],length=(landing?48:36)*Math.sqrt(thrust);
      position.set(0,-3.65-length/2,0).applyQuaternion(engine.quaternion).add(engine.position);
      scale.set(landing?1.65:1.1,length,landing?1.65:1.1);matrix.compose(position,engine.quaternion,scale);rig.flame.setMatrixAt(i,matrix);
      scale.x*=.32;scale.z*=.32;matrix.compose(position,engine.quaternion,scale);rig.core.setMatrixAt(i,matrix);
    }
    rig.flame.instanceMatrix.needsUpdate=rig.core.instanceMatrix.needsUpdate=true;
  }
  function setPropulsion(boosterThrust:number,shipThrust:number,time:number,reduced=false,boosterLanding=false,shipLandingEngines=0){
    updatePlumes(boosterEngines,boosterThrust,boosterLanding,time,reduced);
    updatePlumes(shipEngines,shipThrust,shipLandingEngines>0,time,reduced,shipLandingEngines);
    exhaustLight.intensity=Math.max(boosterThrust,shipThrust)*1300;
  }
  function applyPose(p:RigPose,view:VehicleView,time:number,reducedMotion=false){
    chopstickCarriage.position.y=p.carriageHeight;
    leftArmPivot.rotation.y=p.leftArmAngle*DEG;rightArmPivot.rotation.y=-p.rightArmAngle*DEG;
    quickDisconnectArm.rotation.y=-p.qd*Math.PI/2;
    leftArmPivot.updateMatrix();rightArmPivot.updateMatrix();
    for(const piston of pistons){
      b.copy(piston.tip).applyMatrix4(piston.arm.matrix);direction.subVectors(b,piston.base);
      const length=direction.length();piston.root.position.copy(piston.base);
      piston.root.quaternion.setFromUnitVectors(UP,direction.multiplyScalar(1/length));
      piston.rod.scale.y=Math.max(.1,length-7);piston.rod.position.y=7+piston.rod.scale.y/2;
      piston.root.userData.extension=length;piston.root.userData.target.copy(b);
    }
    rocketEntity.position.set(p.rocketPosX,p.rocketPosY,p.rocketPosZ);
    rocketEntity.rotation.set(p.rocketPitch*DEG,p.rocketYaw*DEG,p.rocketRoll*DEG,'YXZ');
    superHeavyBooster.visible=view!=='ship';starshipUpperStage.visible=view!=='booster';
    if(!detached)starshipUpperStage.position.y=view==='ship'?0:D.boosterHeight;
    for(let i=0;i<4;i++)gridFins[i].rotation.x=p.gridFins[i]*DEG;
    for(let i=0;i<2;i++){forwardFlaps[i].rotation.x=p.flaps[i]*DEG;aftFlaps[i].rotation.x=p.flaps[i+2]*DEG;}
    for(const engine of boosterEngines.gimbals){engine.rotation.x=-p.rocketPitch*.4*DEG;engine.rotation.z=-p.rocketRoll*.4*DEG;}
    for(const engine of shipEngines.gimbals){engine.rotation.x=-p.rocketPitch*.25*DEG;engine.rotation.z=-p.rocketRoll*.25*DEG;}
    setPropulsion(view==='ship'?0:p.engineThrust,view==='ship'?p.engineThrust:0,time,reducedMotion,view==='booster');
  }
  function separateStages(){
    if(detached)return;scene.updateMatrixWorld(true);scene.attach(starshipUpperStage);detached=true;
    starshipUpperStage.visible=true;
  }
  function joinStages(){
    if(!detached)return;rocketEntity.add(starshipUpperStage);starshipUpperStage.position.set(0,D.boosterHeight,0);starshipUpperStage.rotation.set(0,0,0);detached=false;
  }
  function pins(){
    rocketEntity.updateMatrixWorld(true);
    pinLeft.set(0,D.pinHeight,-D.pinZ).applyMatrix4(rocketEntity.matrixWorld);
    pinRight.set(0,D.pinHeight,D.pinZ).applyMatrix4(rocketEntity.matrixWorld);
    return {left:pinLeft,right:pinRight};
  }
  function dispose(){
    if(disposed)return;disposed=true;
    const roots=[groundPad,orbitalLaunchMount,mechazillaTower,rocketEntity];
    if(detached)roots.push(starshipUpperStage);
    for(const root of roots){
      root.traverse(o=>{if(o instanceof T.InstancedMesh)o.dispose();});root.removeFromParent();
    }
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();exhaustLight.dispose();
  }
  return {groundPad,orbitalLaunchMount,mechazillaTower,towerTrussMesh,topCraneAssembly,quickDisconnectArm,chopstickCarriage,
    leftArmPivot,rightArmPivot,hydraulicPistons,rocketEntity,superHeavyBooster,starshipUpperStage,
    gridFins,forwardFlaps,aftFlaps,boosterEngines,shipEngines,pistons,applyPose,setPropulsion,exhaustLight,separateStages,joinStages,pins,dispose,
    get stagesSeparated(){return detached;}};
}
