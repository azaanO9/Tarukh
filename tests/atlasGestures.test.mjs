import test from 'node:test';
import assert from 'node:assert/strict';
import {moveAtlas} from '../game/atlasGestures.ts';
const region={west:-100,east:100,north:-50,south:50};
test('atlas zoom stays bounded and preserves its gesture anchor',()=>{
  const zoomed=moveAtlas(region,region,0,0,2,.25,.25);
  assert.deepEqual(zoomed,{west:-75,east:25,north:-37.5,south:12.5});
  assert.equal(moveAtlas(region,region,0,0,100).east-moveAtlas(region,region,0,0,100).west,25);
  assert.deepEqual(moveAtlas(zoomed,region,0,0,.01),region);
});
test('dragging cannot lose the map beyond its surveyed crop',()=>{
  const zoomed=moveAtlas(region,region,0,0,2);
  assert.deepEqual(moveAtlas(zoomed,region,1000,-1000),{west:0,east:100,north:-50,south:0});
  assert.deepEqual(moveAtlas(region,region,1000,1000),region);
});
test('panning nearby square view preserves its scale and aspect ratio',()=>{
  const nearby={west:-20,east:20,north:-20,south:20};
  const moved=moveAtlas(nearby,region,10,5);
  assert.deepEqual(moved,{west:-10,east:30,north:-15,south:25});
});
