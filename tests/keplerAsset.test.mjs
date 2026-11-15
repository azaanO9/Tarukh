import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';

function readGlb(name) {
  const bytes=fs.readFileSync(new URL('../public/models/'+name,import.meta.url));
  const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
  return {json,bin:bytes.subarray(28+length),bytes};
}

function readAccessor(asset,index) {
  const a=asset.json.accessors[index],view=asset.json.bufferViews[a.bufferView],compressed=view.extensions?.EXT_meshopt_compression;
  let bytes;
  if(compressed){
    bytes=new Uint8Array(compressed.count*compressed.byteStride);
    MeshoptDecoder.decodeGltfBuffer(bytes,compressed.count,compressed.byteStride,asset.bin.subarray(compressed.byteOffset,compressed.byteOffset+compressed.byteLength),compressed.mode,compressed.filter);
  }else bytes=asset.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2}[a.componentType];
  assert.ok(size,'wheel attributes stay float32 / unsigned indices');
  const data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),values=[];
  const getter={5126:'getFloat32',5125:'getUint32',5123:'getUint16'}[a.componentType];
  for(let i=0;i<a.count;i++)for(let c=0;c<components;c++)values.push(data[getter]((a.byteOffset??0)+i*(view.byteStride??size*components)+c*size,true));
  return values;
}

async function dracoDecoder() {
  const decoderModule={exports:{}};
  vm.runInNewContext(fs.readFileSync(new URL('../public/draco/draco_wasm_wrapper.js',import.meta.url),'utf8'),{
    module:decoderModule,exports:decoderModule.exports,require:createRequire(import.meta.url),__dirname:'.',process,console,Buffer,WebAssembly,TextDecoder,setTimeout,clearTimeout,
  });
  return decoderModule.exports({wasmBinary:fs.readFileSync(new URL('../public/draco/draco_decoder.wasm',import.meta.url))});
}

function decodeOriginal(asset,primitive,draco) {
  const ext=primitive.extensions.KHR_draco_mesh_compression,view=asset.json.bufferViews[ext.bufferView];
  const bytes=asset.bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  const decoder=new draco.Decoder(),buffer=new draco.DecoderBuffer(),mesh=new draco.Mesh(),values=new draco.DracoFloat32Array(),face=new draco.DracoInt32Array();
  try{
    buffer.Init(bytes,bytes.length);assert.ok(decoder.DecodeBufferToMesh(buffer,mesh).ok());
    decoder.GetAttributeFloatForAllPoints(mesh,decoder.GetAttributeByUniqueId(mesh,ext.attributes.POSITION),values);
    const positions=Array.from({length:values.size()},(_,i)=>values.GetValue(i)),indices=[];
    for(let i=0;i<mesh.num_faces();i++){decoder.GetFaceFromMesh(mesh,i,face);indices.push(face.GetValue(0),face.GetValue(1),face.GetValue(2));}
    return {positions,indices};
  }finally{for(const object of [face,values,mesh,buffer,decoder])draco.destroy(object);}
}

function shapeHash({positions,indices}) {
  const vertices=[];
  for(let i=0;i<positions.length;i+=3)vertices.push(positions.slice(i,i+3).join(','));
  const faces=[];
  for(let i=0;i<indices.length;i+=3){
    const triangle=indices.slice(i,i+3).map(j=>vertices[j]);
    // Reordering the vertex buffer is permitted; changing any triangle is not.
    faces.push(triangle.sort().join('|'));
  }
  return createHash('sha256').update(faces.sort().join('\n')).digest('hex');
}

test('Kepler asset retains all six exact tire/upright shapes and steering/suspension pivots', async () => {
  await MeshoptDecoder.ready;const draco=await dracoDecoder();
  const original=readGlb('space-exploration-vehicle-ready.glb'),prepared=readGlb('kepler-rover/rover.glb');
  for(let i=0;i<6;i++){
    for(const prefix of ['suspension','steering','tire','upright']){
      const name=`${prefix}-${i}`,a=original.json.nodes.find(n=>n.name===name),b=prepared.json.nodes.find(n=>n.name===name);
      assert.ok(a&&b,name);
      for(const field of ['translation','rotation','scale'])assert.deepEqual(b[field],a[field],name+' '+field);
      assert.deepEqual((b.children??[]).map(j=>prepared.json.nodes[j].name),(a.children??[]).map(j=>original.json.nodes[j].name),name+' parents');
      if(a.mesh===undefined)continue;
      const oldPart=original.json.meshes[a.mesh].primitives[0],newPart=prepared.json.meshes[b.mesh].primitives[0];
      const before=decodeOriginal(original,oldPart,draco),after={positions:readAccessor(prepared,newPart.attributes.POSITION),indices:readAccessor(prepared,newPart.indices)};
      assert.equal(after.positions.length,before.positions.length,name+' vertex count');
      assert.equal(after.indices.length,before.indices.length,name+' triangle count');
      assert.equal(shapeHash(after),shapeHash(before),name+' geometry');
    }
  }
});

test('prepared cabin includes five distinct displays, driver anchor and self-contained compressed assets', () => {
  const {json,bytes}=readGlb('kepler-rover/rover.glb');
  const names=['Display 01 Terrain','Display 02 Drive Strip','Display 03 Systems','Display 04 Traction','Aft core spectrum'];
  for(const name of names)assert.equal(json.materials.filter(m=>m.name===name).length,1,name);
  const screenMaterialIds=new Set(json.meshes.flatMap(m=>m.primitives).filter(p=>names.includes(json.materials[p.material]?.name)).map(p=>p.material));
  assert.equal(screenMaterialIds.size,5,'compression must not merge instruments');
  assert.ok(json.nodes.find(n=>n.name==='Kepler_Interior'));
  const eye=json.nodes.find(n=>n.name==='Kepler_DriverEye');assert.ok(eye);
  assert.ok(eye.translation[1]>1.8&&eye.translation[1]<2.1);
  assert.ok(!json.extensions?.KHR_lights_punctual,'no extra dynamic cabin lights');
  assert.ok(json.images.every(image=>!image.uri&&image.mimeType==='image/webp'));
  assert.ok(json.buffers.every(buffer=>!buffer.uri));
  assert.ok(bytes.length<15_000_000,'prepared model stays below 15 MB');
});
