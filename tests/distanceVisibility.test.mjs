import test from 'node:test';
import assert from 'node:assert/strict';
import {withinDetailRange} from '../ui/world/distanceVisibility.ts';

test('interior details stay visible through small movements around the entry distance',()=>{
  let visible=false;
  for(const distance of [18,17.1,17])visible=withinDetailRange(distance,visible,17);
  assert.equal(visible,false);
  visible=withinDetailRange(16.9,visible,17);
  for(const distance of [17.1,16.9,17.2,18,20.9]){
    visible=withinDetailRange(distance,visible,17);
    assert.equal(visible,true);
  }
  visible=withinDetailRange(21,visible,17);
  assert.equal(visible,false);
  assert.equal(withinDetailRange(20.9,visible,17),false,'Exit jitter must not re-enable details');
  assert.equal(withinDetailRange(16.9,visible,17),true,'Returning to the building restores details');
});

test('exterior distance culling remains bounded and inside-room details remain visible',()=>{
  assert.equal(withinDetailRange(0,false,8),true);
  assert.equal(withinDetailRange(239,true,220,20),true);
  assert.equal(withinDetailRange(240,true,220,20),false);
  assert.equal(withinDetailRange(219,false,220,20),true);
});
