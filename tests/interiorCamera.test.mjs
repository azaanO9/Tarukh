import test from 'node:test';
import assert from 'node:assert/strict';
import {createInteriorCamera,updateInteriorCamera,createCameraBlend,updateCameraBlend} from '../game/interiorCamera.ts';

test('entering a building selects eye view and leaving restores either outdoor preference',()=>{
  for(const preference of [true,false]){
    const state=createInteriorCamera();
    assert.equal(updateInteriorCamera(state,false,preference,1/60),preference);
    assert.equal(updateInteriorCamera(state,true,preference,1/60),false);
    assert.equal(updateInteriorCamera(state,true,false,1),false);
    assert.equal(updateInteriorCamera(state,false,false,.1),false);
    assert.equal(updateInteriorCamera(state,false,false,.16),preference);
    assert.equal(state.inside,false);
  }
});

test('doorway jitter does not restore third person or lose the original preference',()=>{
  const state=createInteriorCamera();
  updateInteriorCamera(state,true,true,.016);
  for(let i=0;i<20;i++){
    assert.equal(updateInteriorCamera(state,false,false,.1),false);
    assert.equal(updateInteriorCamera(state,true,false,.1),false);
  }
  assert.equal(updateInteriorCamera(state,false,false,.26),true);
});

test('manual V remains available indoors, and each new entry starts in eye view',()=>{
  const state=createInteriorCamera();
  updateInteriorCamera(state,true,true,.016);
  assert.equal(updateInteriorCamera(state,true,true,.1),true);
  assert.equal(updateInteriorCamera(state,false,true,.3),true);
  assert.equal(updateInteriorCamera(state,true,true,.016),false);
});

test('camera blends finish at the same time across frame rates without overshoot',()=>{
  for(const fps of [20,30,60,120]){
    const state=createCameraBlend(true);let previous=1;
    for(let i=0;i<fps;i++){
      const value=updateCameraBlend(state,false,1/fps,false);
      assert.ok(value>=0&&value<=previous);previous=value;
    }
    assert.equal(state.value,0);
    for(let i=0;i<fps;i++)updateCameraBlend(state,true,1/fps,false);
    assert.equal(state.value,1);
  }
});

test('camera reversals are continuous; pause and reduced motion are respected',()=>{
  const state=createCameraBlend(true);
  const mid=updateCameraBlend(state,false,.2,false);
  assert.ok(mid>0&&mid<1);
  assert.equal(updateCameraBlend(state,false,0,false),mid);
  assert.equal(updateCameraBlend(state,true,0,false),mid);
  assert.ok(updateCameraBlend(state,true,.1,false)>mid);
  assert.equal(updateCameraBlend(state,false,.016,true),0);
  assert.equal(updateCameraBlend(state,false,.016,false),0,'disabling reduced motion never restarts a completed blend');
});
