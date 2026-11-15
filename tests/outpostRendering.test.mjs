import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutpostRendering,updateOutpostRendering} from '../ui/world/outpostRendering.ts';

test('indoor effects switch once on entry and restore only after sustained exit',()=>{
  const state=createOutpostRendering();
  assert.equal(updateOutpostRendering(state,true,.016),true);
  for(let i=0;i<30;i++)assert.equal(updateOutpostRendering(state,true,.016),false);
  assert.equal(updateOutpostRendering(state,false,.1),false);
  assert.equal(updateOutpostRendering(state,false,.1),false);
  assert.equal(state.active,true);
  assert.equal(updateOutpostRendering(state,false,.06),true);
  assert.equal(state.active,false);
  assert.equal(updateOutpostRendering(state,false,.1),false);
});

test('doorway jitter, pauses and invalid frame time cannot flicker the room lights',()=>{
  const state=createOutpostRendering();updateOutpostRendering(state,true,.016);
  for(let i=0;i<20;i++){
    updateOutpostRendering(state,false,.1);updateOutpostRendering(state,true,.016);
    assert.equal(state.active,true);assert.equal(state.outsideSeconds,0);
  }
  for(const dt of [0,NaN,-1,Infinity]){
    assert.equal(updateOutpostRendering(state,false,dt),false);assert.equal(state.outsideSeconds,0);
  }
  assert.equal(updateOutpostRendering(state,false,30),false);
  assert.equal(state.outsideSeconds,.1,'long frame gaps are capped like the simulation');
});
