// Offline asset preparation; uses the existing glTF Transform 4.2.1 / Sharp tools.
// node scripts/prepare-kepler-rover.mjs <source.glb> <tools-directory>
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {partitionRoverMesh} from '../ui/world/roverWheelAssembly.ts';

const source=process.argv[2];
if(!source)throw new Error('Provide the user-supplied Kepler GLB path.');
const require=createRequire(path.resolve(process.argv[3]??'outputs/garage-v1/tools','package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {mergeDocuments,prune,dedup,quantize,reorder,unpartition,textureCompress}=require('@gltf-transform/functions');
const {MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer');
const draco=require('draco3dgltf'),sharp=require('sharp');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
 'draco3d.decoder':await draco.createDecoderModule(),'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder,
});
const raw=await fs.readFile(source),doc=await io.readBinary(raw),scene=doc.getRoot().listScenes()[0];
const nodes=[...doc.getRoot().listNodes()],meshes=[...doc.getRoot().listMeshes()];
const scale=4.95/5.91002;
const normalization=new T.Matrix4().compose(new T.Vector3(0,2.24213*scale,-.39988*scale),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI),new T.Vector3(scale,scale,scale));
const driver=nodes.find(n=>n.getName()==='Driver view');assert.ok(driver);
const eye=new T.Vector3().setFromMatrixPosition(new T.Matrix4().fromArray(driver.getWorldMatrix()).premultiply(normalization));
const groups=new Map(),buffer=doc.getRoot().listBuffers()[0];
let sourceTriangles=0,removedWheelTriangles=0;
for(const node of nodes){
 const mesh=node.getMesh();if(!mesh)continue;
 const transform=new T.Matrix4().fromArray(node.getWorldMatrix()).premultiply(normalization);
 const runningGear=node.getName()==='NASA SEV / exterior body and running gear';
 for(const primitive of mesh.listPrimitives()){
  const geometry=new T.BufferGeometry();
  for(const [semantic,attribute] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){
   const accessor=primitive.getAttribute(semantic);
   if(accessor)geometry.setAttribute(attribute,new T.BufferAttribute(accessor.getArray().slice(),accessor.getElementSize()));
  }
  if(primitive.getIndices())geometry.setIndex(new T.BufferAttribute(primitive.getIndices().getArray().slice(),1));
  geometry.applyMatrix4(transform);
  sourceTriangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
  let prepared=geometry;
  if(runningGear){
   const rig=partitionRoverMesh(new T.Mesh(geometry));assert.ok(rig,'Supplied running gear must match existing wheel envelopes');
   prepared=rig.chassisMesh.geometry;
   removedWheelTriangles=(geometry.index.count-prepared.index.count)/3;
  }
  const material=primitive.getMaterial();assert.ok(material);
  const display=/^Display 0[1-4] |^Aft core spectrum$/.test(material.getName());
  const category=runningGear?'exterior':node.getName().startsWith('Vision glass')?'glazing':display?'screen':'interior';
  const key=category+'|'+material.getName();
  if(!groups.has(key))groups.set(key,{category,material,geometries:[]});
  groups.get(key).geometries.push(prepared);
 }
}
for(const node of nodes)node.dispose();for(const mesh of meshes)mesh.dispose();
const exterior=doc.createNode('Kepler_Exterior'),interior=doc.createNode('Kepler_Interior');scene.addChild(exterior).addChild(interior);
for(const {category,material,geometries} of groups.values()){
 const geometry=mergeGeometries(geometries,false);assert.ok(geometry);
 const primitive=doc.createPrimitive().setMaterial(material);
 for(const [semantic,name] of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']]){
  const a=geometry.getAttribute(name);if(a)primitive.setAttribute(semantic,doc.createAccessor().setType(a.itemSize===2?'VEC2':'VEC3').setArray(a.array).setBuffer(buffer));
 }
 primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(geometry.index.array).setBuffer(buffer));
 const node=doc.createNode(category==='exterior'?'MMSEV_Chassis':category+' / '+material.getName()).setMesh(doc.createMesh().addPrimitive(primitive));
 node.setExtras({keplerCategory:category});
 (category==='exterior'||category==='glazing'?exterior:interior).addChild(node);
}
await doc.transform(prune(),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:14}));

// Keep the exact existing tire/upright meshes, steering pivots and suspension locations.
const old=await io.read('public/models/space-exploration-vehicle-ready.glb');
const copied=mergeDocuments(doc,old);
for(let i=0;i<6;i++){
 const sourcePivot=old.getRoot().listNodes().find(n=>n.getName()===`suspension-${i}`);assert.ok(sourcePivot);
 scene.addChild(copied.get(sourcePivot));
}
for(const oldScene of old.getRoot().listScenes())copied.get(oldScene).dispose();

// Static sample values are replaced by live canvas displays at runtime.
let screenId=0;
for(const material of doc.getRoot().listMaterials())if(/^Display 0[1-4] |^Aft core spectrum$/.test(material.getName())){
 // Unique placeholders stop dedup from collapsing different live instruments.
 const blank=await sharp({create:{width:2,height:2,channels:3,background:{r:8+screenId++*24,g:19,b:29}}}).webp({lossless:true}).toBuffer();
 const texture=material.getBaseColorTexture();if(texture)texture.setImage(blank).setMimeType('image/webp');
}
await doc.transform(prune(),dedup());
sharp.concurrency(2);
await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:92,effort:65}));
for(const extension of doc.getRoot().listExtensionsUsed())if(['KHR_draco_mesh_compression','KHR_lights_punctual'].includes(extension.extensionName))extension.dispose();
await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}),unpartition());
// Add semantic anchors after pruning: they deliberately have no mesh.
scene.addChild(doc.createNode('Kepler_DriverEye').setTranslation(eye.toArray()));
// Lossless buffer compression keeps the original tire vertices and pivot origins.
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
const out='public/models/kepler-rover';await fs.mkdir(out,{recursive:true});
const bytes=await io.writeBinary(doc);await fs.writeFile(out+'/rover.glb',bytes);
const check=await io.readBinary(bytes);
for(let i=0;i<6;i++)assert.ok(check.getRoot().listNodes().find(n=>n.getName()===`tire-${i}`));
assert.equal(check.getRoot().listMaterials().filter(m=>/^Display 0[1-4] |^Aft core spectrum$/.test(m.getName())).length,5);
assert.ok(check.getRoot().listNodes().find(n=>n.getName()==='Kepler_DriverEye'));
const report={sourceFile:path.basename(source),sourceSha256:createHash('sha256').update(raw).digest('hex'),sourceBytes:raw.length,bytes:bytes.length,sourceTriangles,removedWheelTriangles,driverEye:eye.toArray(),drawGroups:groups.size,sha256:createHash('sha256').update(bytes).digest('hex'),adaptation:'Normalized to existing 4.95m vehicle; supplied body and complete cabin retained. Existing wheel/steering/suspension meshes and pivots reused. Static fittings batched by material, embedded lights omitted, textures capped at 1024px WebP, five LCD textures replaced at runtime. No simulation changes.'};
await fs.writeFile(out+'/source.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
