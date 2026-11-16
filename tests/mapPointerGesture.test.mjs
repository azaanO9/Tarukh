import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapPointerGesture} from '../game/mapPointerGesture.ts';
test('hovering, cancelled touches and duplicate releases never create a waypoint',()=>{
  const gesture=createMapPointerGesture();assert.equal(gesture.move(1,20,30),null);
  gesture.start(1,0,0);assert.equal(gesture.end(1,true),false);assert.equal(gesture.end(1),false);
  gesture.start(2,0,0);gesture.move(2,3,2);assert.equal(gesture.end(2),true);
});
test('pinch can return to dragging without a jump or accidental waypoint',()=>{
  const g=createMapPointerGesture();g.start(1,0,0);g.start(2,100,0);
  assert.deepEqual(g.move(2,150,0),{kind:'pinch',scale:1.5});assert.equal(g.end(2),false);
  assert.deepEqual(g.move(1,10,5),{kind:'pan',dx:10,dy:5});assert.equal(g.end(1),false);
  g.start(3,0,0);g.move(3,10,0);g.reset();assert.equal(g.end(3),false);
});
