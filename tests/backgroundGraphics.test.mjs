import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackgroundGraphics} from '../game/backgroundGraphics.ts';
import {graphicsTier} from '../ui/world/graphicsTiers.ts';

const cap=profile=>graphicsTier(profile).resolutionCap;
function measure(probe,fps){
  for(let i=0;i<200;i++){
    const decision=probe.frame(1000/fps,1000/fps,true);
    if(decision)return decision;
  }
  assert.fail('A bounded active sample must finish');
}

test('passive checking starts light and reaches Ultra without a second render loop',()=>{
  const probe=createBackgroundGraphics(2,cap),seen=[];
  while(!probe.done()){
    seen.push(probe.candidate().profile);
    const decision=measure(probe,60);
    if(decision.complete){assert.equal(decision.selected.profile,'ultra');assert.ok(decision.selected.meetsTarget);}
  }
  assert.deepEqual(seen,['performance','auto','high','ultra']);
  assert.equal(probe.frame(17,5,true),null,'completed trials never restart on their own');
});

test('a failed upgrade restores the best measured preset',()=>{
  const probe=createBackgroundGraphics(2,cap);
  measure(probe,60);measure(probe,55);
  const result=measure(probe,32);
  assert.equal(result.complete,true);assert.equal(result.next.profile,'auto');
  assert.equal(result.selected.profile,'auto');assert.equal(probe.trials().length,3);
});

test('Performance reduces pixels only when its native resolution cannot meet target',()=>{
  const probe=createBackgroundGraphics(2,cap);
  assert.equal(measure(probe,30).next.scale,.85);
  assert.equal(measure(probe,35).next.scale,.7);
  const result=measure(probe,45);
  assert.equal(result.complete,true);assert.equal(result.selected.scale,.7);
  assert.equal(result.selected.profile,'performance');
  const slow=createBackgroundGraphics(2,cap);
  while(!slow.done())measure(slow,20);
  assert.equal(slow.candidate().scale,.55);assert.equal(slow.trials().at(-1).meetsTarget,false);
});

test('menus, manual selection, shader preparation, scale ramps and occluded tabs cannot decide a tier',()=>{
  const probe=createBackgroundGraphics(1.25,cap);
  for(let i=0;i<35;i++)probe.frame(16.7,5,true);
  for(let i=0;i<180;i++)assert.equal(probe.frame(100,5,false),null);
  for(let i=0;i<180;i++)assert.equal(probe.frame(1000,5,true),null);
  for(const invalid of [0,-1,NaN,Infinity])assert.equal(probe.frame(invalid,5,true),null);
  assert.equal(probe.trials().length,0);
  for(let i=0;i<35;i++)assert.equal(probe.frame(16.7,5,true),null,'old partial window was discarded');
  assert.ok(measure(probe,60).trial.meetsTarget);
});

test('sample count stays bounded at very high refresh rates and identical High is skipped',()=>{
  const probe=createBackgroundGraphics(1,cap);
  while(!probe.done())measure(probe,360);
  assert.deepEqual(probe.trials().map(t=>t.profile),['performance','auto','ultra']);
  assert.ok(probe.trials().every(t=>t.frames===180));
});

test('browser zoom below the scale floor still has a native Performance candidate',()=>{
  const probe=createBackgroundGraphics(.4,cap);
  assert.deepEqual(probe.candidate(),{profile:'performance',scale:.55});
  const result=measure(probe,20);
  assert.equal(result.complete,true);assert.equal(result.selected.meetsTarget,false);
});
