import * as T from "three";
import { createSuitMaterials, suitBuilder } from "./suitMaterials";
import { batchStaticMeshes } from "./batchStaticMeshes";

export function createMarsAstronaut() {
  const root=new T.Group(),m=createSuitMaterials(),b=suitBuilder(m);
  const fabric=m.ceramic.clone();fabric.roughness=.95;fabric.metalness=0;fabric.bumpScale=.024;
  const visor=new T.MeshStandardMaterial({color:0x1b292d,metalness:.92,roughness:.13,envMapIntensity:1.7});
  const torso=b.add(root,new T.CapsuleGeometry(.285,.36,8,24),fabric,0,1.23,0);torso.scale.set(1.18,1,.84);
  b.box(root,.56,.1,.39,0,.96,0,m.graphite);
  b.box(root,.47,.19,.09,0,1.39,-.22,m.orange);
  b.box(root,.3,.25,.07,0,1.24,-.26,m.alloy);
  for(const x of [-.205,.205])b.box(root,.052,.48,.04,x,1.25,.23,m.graphite);
  // Life-support pack, shaped corner guards, fasteners and a legible status screen.
  b.box(root,.49,.6,.27,0,1.26,.31,m.alloy);
  b.box(root,.39,.48,.055,0,1.26,.47,m.ceramic);
  b.box(root,.24,.27,.035,0,1.3,.51,m.graphite);
  for(let i=0;i<4;i++)b.box(root,.13,.018,.015,0,1.23+i*.045,.535,m.light,false);
  for(const x of [-.22,.22]){b.box(root,.075,.48,.1,x,1.28,.43,m.orange);b.bolts(root,.05,.43,x,1.28,.491);}
  b.pipe(root,[[-.25,1.35,.33],[-.36,1.23,.31],[-.35,1.05,.05],[-.26,1.1,-.16]],.028,m.orange);
  for(const x of [-.12,.12])b.cylinder(root,.024,.11,x,1.65,.35,m.alloy);
  b.add(root,new T.TorusGeometry(.193,.034,8,24).rotateX(Math.PI/2),m.orange,0,1.62,0);
  const helmet=b.add(root,new T.SphereGeometry(.295,32,22),fabric,0,1.88,0);helmet.scale.set(1.04,1,.98);
  const face=b.add(root,new T.SphereGeometry(.268,32,20),visor,0,1.88,-.083);face.scale.set(.95,.77,.87);
  for(const x of [-.3,.3]){
    const ear=b.cylinder(root,.092,.075,x,1.87,.015,m.graphite);ear.rotation.z=Math.PI/2;
    const cover=b.cylinder(root,.072,.085,x,1.87,.015,m.alloy);cover.rotation.z=Math.PI/2;
  }
  b.box(root,.13,.055,.07,0,2.13,-.04,m.alloy);
  b.add(root,new T.TorusGeometry(.257,.012,6,28).rotateX(Math.PI/2),m.alloy,0,1.72,0);
  b.box(root,.17,.055,.025,0,1.9,.286,m.alloy);
  for(const x of [-.09,-.03,.03,.09])b.box(root,.015,.06,.018,x,1.82,.284,m.graphite,false);
  // Wrinkled fabric profiles give arms and legs natural volume rather than straight rods.
  const sleeve=(length:number,radius:number)=>{
    const profile:T.Vector2[]=[];
    for(let i=0;i<=18;i++){
      const t=i/18;const taper=.78+.22*Math.sin(t*Math.PI);
      const crease=1+Math.sin(t*Math.PI*12)*.043*Math.sin(t*Math.PI);
      profile.push(new T.Vector2(radius*taper*crease,-t*length));
    }
    return new T.LatheGeometry(profile,18);
  };
  const limbs:T.Group[]=[];
  for(const side of [-1,1]){
    const leg=new T.Group();leg.position.set(side*.19,.96,0);root.add(leg);limbs.push(leg);
    b.add(leg,sleeve(.73,.145),fabric,0,0,0);
    b.box(leg,.2,.17,.07,0,-.42,-.13,fabric);
    for(const y of [-.36,-.53])b.add(leg,new T.TorusGeometry(.146,.012,6,18).rotateX(Math.PI/2),fabric,0,y,0);
    b.box(leg,.30,.2,.43,0,-.81,-.065,m.graphite);
    b.box(leg,.305,.05,.44,0,-.9,-.065,m.alloy);
    b.box(leg,.2,.13,.13,0,-.74,.06,fabric);
    const arm=new T.Group();arm.position.set(side*.37,1.5,0);arm.rotation.z=side*.065;root.add(arm);limbs.push(arm);
    b.add(arm,sleeve(.47,.11),fabric,side*.04,-.025,0);
    b.box(arm,.205,.12,.21,side*.04,-.075,0,m.orange);
    b.add(arm,new T.TorusGeometry(.11,.012,6,18).rotateX(Math.PI/2),m.graphite,side*.04,-.3,0);
    b.cylinder(arm,.1,.1,side*.04,-.48,0,m.alloy);
    const glove=b.add(arm,new T.SphereGeometry(.104,16,10),m.graphite,side*.04,-.58,-.01);glove.scale.set(.8,1.14,.9);
    batchStaticMeshes(leg,new Set());batchStaticMeshes(arm,new Set());
  }
  batchStaticMeshes(root,new Set(limbs));
  const seatedLegs=new T.Group();seatedLegs.visible=false;root.add(seatedLegs);
  for(const side of [-1,1]){
    const thigh=new T.Group();thigh.position.set(side*.19,.96,0);thigh.rotation.x=1.8;seatedLegs.add(thigh);
    b.add(thigh,sleeve(.35,.145),fabric,0,0,0);
    const shin=new T.Group();shin.position.y=-.35;shin.rotation.x=-1.65;thigh.add(shin);
    b.add(shin,sleeve(.37,.14),fabric,0,0,0);
    b.box(shin,.30,.2,.43,0,-.4,-.065,m.graphite);
    b.box(shin,.305,.05,.44,0,-.49,-.065,m.alloy);
  }
  let seated=false;
  return {root,animate(stride:number,airborne:boolean){
    if(seated){limbs[1].rotation.x=limbs[3].rotation.x=.4;return;}
    limbs[0].rotation.x=stride;limbs[2].rotation.x=-stride;
    limbs[1].rotation.x=airborne?-.4:-stride*.65;limbs[3].rotation.x=airborne?-.4:stride*.65;
  },setSeated(value:boolean){
    seated=value;seatedLegs.visible=value;limbs[0].visible=limbs[2].visible=!value;
    root.position.y=value?-.96:0;
  }};
}
