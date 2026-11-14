import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCuriositySave} from '../game/curiositySave.ts';
import {exportCuriositySave,spawnCuriosityRover} from '../game/curiosityRover.ts';
test('Curiosity position, heading, scans and target survive JSON roundtrip and corrupt saves are rejected',()=>{
  const base=spawnCuriosityRover([],()=>0,{seed:777,allowColonyTargets:true});
  const moved={...base,x:32.5,z:-18.25,yaw:1.4,scanCount:4,recentTargets:[{x:-10,z:12}]};
  const saved=exportCuriositySave(moved);
  const parsed=parseCuriositySave(JSON.stringify(saved));
  assert.deepEqual(parsed,saved);
  const resumed=spawnCuriosityRover([],()=>0,{seed:123,allowColonyTargets:true,saved:parsed});
  assert.equal(resumed.x,32.5);
  assert.equal(resumed.z,-18.25);
  assert.equal(resumed.scanCount,4);
  assert.equal(parseCuriositySave(JSON.stringify({...saved,x:999})),null);
  assert.equal(parseCuriositySave('bad'),null);
});
