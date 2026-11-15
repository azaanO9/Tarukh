import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarsTrackSystem} from '../ui/world/marsTrackDeformation.ts';
import {uploadTrackRectangle} from '../ui/world/trackTextureUpload.ts';

function trackRenderer() {
  const stores=new Map(),images=new Map();let bound=null;
  const gl={};
  for(const key of ['TEXTURE_2D','UNPACK_ALIGNMENT','UNPACK_FLIP_Y_WEBGL','UNPACK_PREMULTIPLY_ALPHA_WEBGL',
    'UNPACK_ROW_LENGTH','UNPACK_IMAGE_HEIGHT','UNPACK_SKIP_PIXELS','UNPACK_SKIP_ROWS','UNPACK_SKIP_IMAGES','RGBA','UNSIGNED_BYTE'])gl[key]=key;
  gl.getParameter=()=>{throw new Error('Track updates must not synchronously query the GPU');};
  gl.pixelStorei=(key,value)=>stores.set(key,value);
  gl.texSubImage2D=(_target,_level,dx,dy,w,h,_format,_type,data)=>{
    assert.ok(bound,'texture binding is managed by the renderer');
    const image=images.get(bound),stride=stores.get(gl.UNPACK_ROW_LENGTH)||w;
    const sx=stores.get(gl.UNPACK_SKIP_PIXELS)||0,sy=stores.get(gl.UNPACK_SKIP_ROWS)||0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<4;c++)
      image.data[((dy+y)*image.width+dx+x)*4+c]=data[((sy+y)*stride+sx+x)*4+c];
  };
  const renderer={
    initTexture(texture){if(!images.has(texture))images.set(texture,{width:texture.image.width,data:texture.image.data.slice()});},
    getContext:()=>gl,properties:{get:texture=>({__webglTexture:texture})},
    state:{bindTexture:(_target,texture)=>{bound=texture;},unbindTexture:()=>{bound=null;}},
  };
  return {renderer,images,stores,gl,bound:()=>bound};
}

test('track uploads preserve wheel marks across atlas seams and page recycling without GPU queries',t=>{
  let now=0;t.mock.method(performance,'now',()=>now+=100);
  for(const light of [true,false]){
    const system=createMarsTrackSystem(light),mock=trackRenderer(),size=system.texture.image.width;
    const drain=(x,z)=>{for(let i=0;i<64;i++)system.update(mock.renderer,x,z,light);};
    mock.renderer.initTexture(system.texture);
    for(const [x,z] of [[0,0],[2,3],[size*.1875/2-.5,size*.1875/2-1],[125,-121],[-214,311]]){
      drain(x,z);
      system.stampRover(mock.renderer,{x,z,yaw:.4,steerAngle:.2},()=>.3);
      system.stampCuriosity(mock.renderer,{x:x+4,z:z-4,yaw:1.1,steerAngle:-.1},()=>0);
      assert.ok(system.texture.image.data.some(v=>v>0),'wheel marks were actually stamped');
      assert.deepEqual(mock.images.get(system.texture).data,system.texture.image.data,'GPU atlas matches CPU tracks after wrapping and clearing');
    }
    assert.equal(mock.bound(),null);
    for(const key of ['UNPACK_ROW_LENGTH','UNPACK_SKIP_PIXELS','UNPACK_SKIP_ROWS'])assert.equal(mock.stores.get(key),0);
    system.dispose();
  }
});

test('track upload restores unpack offsets and renderer binding even when the upload fails',()=>{
  const mock=trackRenderer(),texture={image:{width:8,data:new Uint8Array(8*8*4)}};
  mock.gl.texSubImage2D=()=>{throw new Error('context interrupted');};
  assert.throws(()=>uploadTrackRectangle(mock.renderer,texture,new Uint8Array(4*4*4),4,1,1,2,2,0,0),/context interrupted/);
  assert.equal(mock.bound(),null);
  for(const key of ['UNPACK_ROW_LENGTH','UNPACK_SKIP_PIXELS','UNPACK_SKIP_ROWS'])assert.equal(mock.stores.get(key),0);
});
