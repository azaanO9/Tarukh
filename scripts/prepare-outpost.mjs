/** Offline game derivative. Requires glTF-Transform 4.2.1, Meshoptimizer 0.22
 * and Sharp; these tools are not runtime dependencies. Original v9 is untouched.
 * node scripts/prepare-outpost.mjs <tool-directory> <sharp-module-directory>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';
import {isOutpostInterior} from './outpost-classification.mjs';
import {repairOutpost} from './outpost-repairs.mjs';

const toolDir=path.resolve(process.argv[2]??'outputs/garage-v1/tools');
const require=createRequire(path.join(toolDir,'package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS,EXTMeshGPUInstancing}=require('@gltf-transform/extensions');
const {dedup,join,meshopt,prune,simplify,textureCompress,weld}=require('@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier}=require('meshoptimizer');
const sharp=require(path.resolve(process.argv[3]??'node_modules/.pnpm/sharp@0.35.5_@types+node@22.19.19/node_modules/sharp'));
sharp.concurrency(2);sharp.cache({memory:64});
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const source='outputs/outpost-v9/final/tarukh-outpost-full.glb';
const destination='public/models/outpost/campus.glb';
const raw=await fs.readFile(source),doc=await io.read(source),root=doc.getRoot(),scene=root.listScenes()[0];
const {doors}=JSON.parse(await fs.readFile('public/models/outpost/layout.json','utf8'));
const repairs=repairOutpost(doc,doors);
const removed=[];
for(const node of [...root.listNodes()])if(/^(MARS \/|Basalt \/)/.test(node.getName())){removed.push(node.getName());node.dispose();}
const moving=new Set();
for(const animation of root.listAnimations())for(const channel of animation.listChannels())channel.getTargetNode().traverse(n=>moving.add(n));
const sectors=new Map();
const centres={command:[0,0],crew:[-19,0],lab:[18,0],botany:[-11,-22],observatory:[12,-22],transit:[0,-13]};
const sectorNodes=new Set();
const interiorNodes=new Set();
// Classify before changing any parents: imported props can themselves parent
// other meshes, and their authored room ancestry must remain authoritative.
for(const node of root.listNodes()){
  let parent=node;
  while(parent){if(isOutpostInterior(parent.getName())){interiorNodes.add(node);break;}parent=parent.getParentNode();}
}
let beforeTriangles=0;
const point=new T.Vector3(),matrix=new T.Matrix4();
for(const node of [...root.listNodes()]) {
  const mesh=node.getMesh();if(!mesh)continue;
  for(const p of mesh.listPrimitives())beforeTriangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3;
  if(moving.has(node))continue;
  const interior=interiorNodes.has(node);
  const bounds=new T.Box3();matrix.fromArray(node.getWorldMatrix());
  for(const p of mesh.listPrimitives()){
    const a=p.getAttribute('POSITION'),min=a.getMin([]),max=a.getMax([]);
    bounds.union(new T.Box3(new T.Vector3(...min),new T.Vector3(...max)).applyMatrix4(matrix));
  }
  bounds.getCenter(point);
  let region='command',distance=Infinity;
  for(const [name,[x,z]] of Object.entries(centres)){const d=(point.x-x)**2+(point.z-z)**2;if(d<distance){distance=d;region=name;}}
  const key=(interior?'interior':'shell')+' / '+region;
  if(!sectors.has(key)){
    const group=doc.createNode('OUTPOST / '+key).setExtras({outpostSector:region,interior});
    scene.addChild(group);sectors.set(key,group);sectorNodes.add(group);
  }
  const world=node.getWorldMatrix();node.getParentNode()?.removeChild(node);scene.removeChild(node);
  sectors.get(key).addChild(node);node.setMatrix(world);
}
await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:.55,error:.0002,lockBorder:true}),dedup());
// Instance only static siblings. Animated leaves keep their original hierarchy,
// and every building retains a separate culling bound.
const instances=doc.createExtension(EXTMeshGPUInstancing).setRequired(true);
let instanceBatches=0;
for(const sector of sectors.values()){
  const groups=new Map();
  for(const node of sector.listChildren())if(node.getMesh()){
    const mesh=node.getMesh();const nodes=groups.get(mesh)??[];nodes.push(node);groups.set(mesh,nodes);
  }
  for(const [mesh,nodes] of groups){
    if(nodes.length<2)continue;
    const vertices=mesh.listPrimitives().reduce((sum,p)=>sum+p.getAttribute('POSITION').getCount(),0);
    // Merge tiny repeated fittings into their material batch. Instancing them
    // individually saves few bytes but adds a draw call for each small mesh.
    if(vertices*(nodes.length-1)<2000)continue;
    const buffer=root.listBuffers()[0];
    const batch=instances.createInstancedMesh();
    for(const [key,type,size,method] of [['TRANSLATION','VEC3',3,'getTranslation'],['ROTATION','VEC4',4,'getRotation'],['SCALE','VEC3',3,'getScale']]){
      const values=new Float32Array(nodes.length*size);nodes.forEach((n,i)=>values.set(n[method](),i*size));
      batch.setAttribute(key,doc.createAccessor().setType(type).setArray(values).setBuffer(buffer));
    }
    sector.addChild(doc.createNode(sector.getName()+' / instances '+instanceBatches++).setMesh(mesh).setExtension('EXT_mesh_gpu_instancing',batch));
    for(const node of nodes)node.setMesh(null);
  }
}
if(!instanceBatches)instances.dispose();
await doc.transform(join({filter:n=>sectorNodes.has(n.getParentNode()),cleanup:false}));
await doc.transform(prune({keepLeaves:false,keepAttributes:true}));
await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:90,effort:65}));
await doc.transform(prune({keepLeaves:false,keepAttributes:true}));
await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeTexcoord:14}));
await io.write(destination,doc);
const decoded=await io.read(destination);
let triangles=0,draws=0,badVertices=0;
for(const n of decoded.getRoot().listNodes())for(const p of n.getMesh()?.listPrimitives()??[]){
  const count=n.getExtension('EXT_mesh_gpu_instancing')?.getAttribute('TRANSLATION')?.getCount()??1;
  triangles+=(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3*count;draws++;
  for(const v of p.getAttribute('POSITION').getArray())if(!Number.isFinite(v))badVertices++;
}
assert.equal(badVertices,0);assert.equal(decoded.getRoot().listAnimations().length,11);
assert.ok(!decoded.getRoot().listNodes().some(n=>/^(MARS \/|Basalt \/)/.test(n.getName())));
const output=await fs.readFile(destination);
let maxTextureSize=0;
for(const texture of decoded.getRoot().listTextures()){
  const meta=await sharp(texture.getImage()).metadata();maxTextureSize=Math.max(maxTextureSize,meta.width,meta.height);
}
assert.ok(maxTextureSize<=1024);
const report={source,sourceSha256:createHash('sha256').update(raw).digest('hex'),destination,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex'),removedGroundObjects:removed.length,repairs,beforeTriangles,triangles,primitives:draws,sectors:sectors.size,instanceBatches,animations:11,maxTextureSize,quality:90,simplificationErrorFraction:.0002,positionBits:16};
await fs.writeFile('outputs/outpost-integration/asset-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
