import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {prepareWorldBuffers,prepareWorldMaterials} from '../ui/world/prepareWorldBuffers.ts';

test('loading pre-upload includes off-camera terrain and furnishings, restoring culling, viewport and shadows on success or failure',()=>{
  for(const updateShadows of [false,true])for(const fail of [false,true]){
    const scene=new T.Scene(),camera=new T.Camera(),geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();
    const meshes=['mars-ground','mars-ground-patch-4','MOLA regional relief 1','streamed-ground','streamed-rocks','furniture'].map(name=>{
      const mesh=new T.Mesh(geometry,material);mesh.name=name;scene.add(mesh);return mesh;
    });
    const hidden=meshes[3];hidden.visible=false;
    const viewport=new T.Vector4(3,4,800,600),original=viewport.clone();
    const renderer={shadowMap:{autoUpdate:true,needsUpdate:true},getViewport:target=>target.copy(viewport),
      setViewport:(...v)=>v[0] instanceof T.Vector4?viewport.copy(v[0]):viewport.set(...v),
      render:()=>{
        assert.deepEqual(viewport.toArray(),[0,0,1,1]);
        assert.equal(renderer.shadowMap.autoUpdate,updateShadows);assert.equal(renderer.shadowMap.needsUpdate,updateShadows);
        for(const mesh of meshes)assert.equal(mesh.frustumCulled,mesh===hidden);
        if(fail)throw new Error('GPU interrupted');
      }};
    if(fail)assert.throws(()=>prepareWorldBuffers(renderer,scene,camera,updateShadows),/GPU interrupted/);
    else prepareWorldBuffers(renderer,scene,camera,updateShadows);
    assert.deepEqual(viewport,original);assert.deepEqual(renderer.shadowMap,{autoUpdate:true,needsUpdate:true});
    assert.ok(meshes.every(mesh=>mesh.frustumCulled));assert.equal(hidden.visible,false);
    geometry.dispose();material.dispose();
  }
});

function materialRenderer(scene,camera,target,{compile,render}={}) {
  const viewport=new T.Vector4(5,6,640,480),events=[];
  let currentTarget=target;
  const renderer={
    shadowMap:{autoUpdate:false,needsUpdate:true},
    getViewport:out=>out.copy(viewport),
    setViewport:(...values)=>values[0] instanceof T.Vector4?viewport.copy(values[0]):viewport.set(...values),
    getRenderTarget:()=>currentTarget,
    setRenderTarget:value=>{currentTarget=value;events.push(['target',value]);},
    compileAsync:async (s,c)=>{
      assert.equal(s,scene);assert.equal(c,camera);
      events.push(['compile',currentTarget]);await compile?.();events.push(['compiled',currentTarget]);
    },
    render:(s,c)=>{
      assert.equal(s,scene);assert.equal(c,camera);
      events.push(['draw',currentTarget]);render?.(renderer);
    },
  };
  return {renderer,events,viewport};
}

test('material warmup awaits compilation in the requested output target before drawing, without owning borrowed targets',async()=>{
  for(const direct of [false,true]){
    const scene=new T.Scene(),camera=new T.Camera(),previous=new T.WebGLRenderTarget(8,8),borrowed=new T.WebGLRenderTarget(1,1);
    const target=direct?null:borrowed;
    let disposals=0,finishCompile;
    previous.addEventListener('dispose',()=>disposals++);borrowed.addEventListener('dispose',()=>disposals++);
    const compilation=new Promise(resolve=>{finishCompile=resolve;});
    const {renderer,events,viewport}=materialRenderer(scene,camera,previous,{compile:()=>compilation,render:r=>{
      assert.deepEqual(r.shadowMap,{autoUpdate:!direct,needsUpdate:!direct});
    }});
    const pending=direct?prepareWorldMaterials(renderer,scene,camera):prepareWorldMaterials(renderer,scene,camera,target,true);
    assert.deepEqual(events,[['target',target],['compile',target]]);
    assert.equal(renderer.getRenderTarget(),target);
    finishCompile();await pending;
    assert.deepEqual(events,[['target',target],['compile',target],['compiled',target],['draw',target],['target',previous]]);
    assert.equal(renderer.getRenderTarget(),previous);
    assert.deepEqual(viewport.toArray(),[5,6,640,480]);
    assert.deepEqual(renderer.shadowMap,{autoUpdate:false,needsUpdate:true});
    assert.equal(disposals,0);
    previous.dispose();borrowed.dispose();
  }
});

test('material warmup restores the prior render target after asynchronous compile rejection or draw failure',async()=>{
  for(const failAt of ['compile','draw'])for(const updateShadows of [false,true]){
    const scene=new T.Scene(),camera=new T.Camera(),previous=new T.WebGLRenderTarget(8,8),borrowed=new T.WebGLRenderTarget(1,1);
    let disposals=0;
    previous.addEventListener('dispose',()=>disposals++);borrowed.addEventListener('dispose',()=>disposals++);
    const error=new Error(`${failAt} failed`);
    const {renderer,events,viewport}=materialRenderer(scene,camera,previous,{
      compile:async()=>{await Promise.resolve();if(failAt==='compile')throw error;},
      render:()=>{throw error;},
    });
    await assert.rejects(prepareWorldMaterials(renderer,scene,camera,borrowed,updateShadows),error);
    assert.equal(events.some(([event])=>event==='draw'),failAt==='draw');
    assert.deepEqual(events.at(-1),['target',previous]);
    assert.equal(renderer.getRenderTarget(),previous);
    assert.deepEqual(viewport.toArray(),[5,6,640,480]);
    assert.deepEqual(renderer.shadowMap,{autoUpdate:false,needsUpdate:true});
    assert.equal(disposals,0);
    previous.dispose();borrowed.dispose();
  }
});
