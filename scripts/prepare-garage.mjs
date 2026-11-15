/** Offline derivative of the reviewed garage. Source model and clips stay intact. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve(process.argv[2]??'outputs/garage-v1/tools','package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {weld,dedup,join,prune,textureCompress,draco,simplifyPrimitive}=require('@gltf-transform/functions');
const {MeshoptSimplifier}=require('meshoptimizer');
const dracoModule=require('draco3dgltf');
const sharp=require(path.resolve(process.argv[3]??'node_modules/.pnpm/sharp@0.35.5_@types+node@22.19.19/node_modules/sharp'));
sharp.concurrency(2);sharp.cache({memory:64});
await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder':await dracoModule.createEncoderModule(),
  'draco3d.decoder':await dracoModule.createDecoderModule(),
});
const source='outputs/garage-v1/final/tarukh-rover-garage.glb',dest='public/models/garage/garage.glb';
const raw=await fs.readFile(source),doc=await io.readBinary(raw),root=doc.getRoot(),scene=root.listScenes()[0];
assert.ok(!root.listNodes().some(n=>/ROVER_FIT_PREVIEW|PRESENTATION_GROUND|Mars_ground/.test(n.getName())));
const moving=new Set(),protectedMeshes=new Set(),sections=new Map();
for(const animation of root.listAnimations())for(const channel of animation.listChannels())channel.getTargetNode().traverse(n=>moving.add(n));
const original=[...root.listNodes()],matrices=new Map(original.map(n=>[n,n.getWorldMatrix()]));
const classifications=new Map();let sourceTriangles=0;
for(const node of original){
  const name=node.getName(),mesh=node.getMesh();if(!mesh)continue;
  if(name.startsWith('Source_door_')||name.startsWith('SUPPLIED_SOLAR_PANEL'))protectedMeshes.add(mesh);
  for(const p of mesh.listPrimitives())sourceTriangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
  let interior=/^Ceiling|Floor (captive|machined|removable)|Edge drain/.test(name),parent=node;
  while(parent){if(parent.getName()==='INDUSTRIAL_INTERIOR')interior=true;parent=parent.getParentNode();}
  classifications.set(node,interior?'interior':'shell');
}
for(const node of original){
  if(!node.getMesh()||moving.has(node))continue;
  const part=classifications.get(node);
  if(!sections.has(part)){const group=doc.createNode('GARAGE / '+part).setExtras({garageSection:part});scene.addChild(group);sections.set(part,group);}
  node.getParentNode()?.removeChild(node);scene.removeChild(node);sections.get(part).addChild(node);node.setMatrix(matrices.get(node));
}
// Blender's procedural fittings contain tiny float differences between shared
// corners. Sub-pixel UV rounding lets welding/compression recognize them,
// including repeating UVs outside 0..1 that glTF quantization cannot pack.
const rounded=new Set();
for(const mesh of root.listMeshes())for(const p of mesh.listPrimitives())for(const semantic of ['POSITION','NORMAL','TANGENT','TEXCOORD_0']){
  const a=p.getAttribute(semantic);if(!a||rounded.has(a))continue;rounded.add(a);
  const values=a.getArray();
  const precision=semantic==='POSITION'?100000:semantic==='TEXCOORD_0'?2048:10000;
  for(let i=0;i<values.length;i++)values[i]=Math.round(values[i]*precision)/precision;
  if(semantic==='NORMAL'||semantic==='TANGENT'){
    const stride=a.getElementSize();
    for(let i=0;i<values.length;i+=stride){const length=Math.hypot(values[i],values[i+1],values[i+2])||1;for(let j=0;j<3;j++)values[i+j]/=length;}
  }
}
await doc.transform(weld());
// Keep the supplied door and solar geometry; simplify only original fittings,
// with a tight error limit so chamfers, grilles and pipe silhouettes survive.
for(const mesh of root.listMeshes())if(!protectedMeshes.has(mesh))for(const p of mesh.listPrimitives())simplifyPrimitive(p,{simplifier:MeshoptSimplifier,ratio:.5,error:.0002,lockBorder:false});
await doc.transform(dedup(),join({filter:n=>[...sections.values()].includes(n.getParentNode()),cleanup:false}),prune({keepLeaves:false,keepAttributes:true}));
await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:90,effort:65}));
await doc.transform(draco({method:'edgebreaker',encodeSpeed:5,decodeSpeed:5,quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16,quantizeGeneric:12}));
await fs.mkdir(path.dirname(dest),{recursive:true});await fs.mkdir('outputs/garage-integration',{recursive:true});
await io.write(dest,doc);
const decoded=await io.read(dest),output=await fs.readFile(dest);
assert.equal(decoded.getRoot().listAnimations().length,1);
assert.equal(decoded.getRoot().listAnimations()[0].getName(),'Garage_Door_Open');
let triangles=0;
for(const node of decoded.getRoot().listNodes())for(const p of node.getMesh()?.listPrimitives()??[])triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
const report={source,sourceBytes:raw.length,sourceSha256:createHash('sha256').update(raw).digest('hex'),bytes:output.length,sha256:createHash('sha256').update(output).digest('hex'),sourceTriangles,triangles,materials:root.listMaterials().length,textures:root.listTextures().length,maxTextureSize:1024,doorAnimation:'Garage_Door_Open',embeddedRovers:0,importedTerrain:false};
await fs.writeFile('outputs/garage-integration/asset-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
