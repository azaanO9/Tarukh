import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileGraphicsTier, mobileAutoPixelCap, createRenderPacer, renderFrameDue} from '../game/mobileGraphics.ts';
import {createBackgroundGraphics} from '../game/backgroundGraphics.ts';
import {createAutoGraphics, adaptAutoGraphics} from '../game/autoGraphics.ts';
import {graphicsTier} from '../ui/world/graphicsTiers.ts';
import {roverHiddenByGarage} from '../ui/world/garageVisibility.ts';

const cap = name => mobileGraphicsTier(name).resolutionCap;
test('garage occlusion removes only an unseen, parked rover and never a rollout or driver',()=>{
  assert.equal(roverHiddenByGarage('parked',0,false,false),true);
  for(const phase of ['opening-out','rolling-out','closing-out','outside','opening-in','rolling-in','closing-in'])assert.equal(roverHiddenByGarage(phase,0,false,false),false);
  assert.equal(roverHiddenByGarage('parked',.001,false,false),false);
  assert.equal(roverHiddenByGarage('parked',0,true,false),false);
  assert.equal(roverHiddenByGarage('parked',0,false,true),false);
});
function measure(probe, fps) {
  for (let frame=0;frame<200;frame++) {
    const decision=probe.frame(1000/fps,1000/fps,true);
    if(decision)return decision;
  }
  assert.fail('The probe must complete its bounded sample');
}

test('mobile budgets lower optional geometry and fill cost, with manual Ultra retained',()=>{
  for(const name of ['performance','auto','high','ultra']) {
    const mobile=mobileGraphicsTier(name), desktop=graphicsTier(name);
    assert.ok(mobile.smallRocks<desktop.smallRocks);
    assert.ok(mobile.particles<desktop.particles);
    assert.ok(mobile.viewDistance<desktop.viewDistance);
    assert.ok(mobile.resolutionCap<=1.5);
    assert.equal(mobileGraphicsTier(name,true).shadows,false);
    assert.equal(mobileGraphicsTier(name,true).ssao,false);
  }
  assert.equal(mobileGraphicsTier('ultra').ssao,true);
  assert.equal(mobileGraphicsTier('high').shadows,true);
});

test('mobile Auto accepts stable 60 FPS, rejects 45 FPS upgrades and never probes Ultra',()=>{
  const probe=createBackgroundGraphics(1.25,cap,{mobile:true});
  assert.equal(measure(probe,60).next.profile,'auto');
  assert.equal(measure(probe,60).next.profile,'high');
  const result=measure(probe,45);
  assert.equal(result.complete,true);
  assert.equal(result.selected.profile,'auto');
  assert.equal(probe.trials().some(t=>t.profile==='ultra'),false);
  const lowDpr=createBackgroundGraphics(.85,cap,{mobile:true});
  while(!lowDpr.done())measure(lowDpr,60);
  assert.equal(lowDpr.candidate().profile,'high','Detail remains measurable even on a low-pixel-budget device');
});

test('mobile hints constrain pixel cost while sustained slow frames adapt and recover',()=>{
  assert.equal(mobileAutoPixelCap(8,8,'Apple GPU',false),1.25);
  for(const hints of [[4,8,'',false],[8,4,'',false],[8,8,'SwiftShader',false],[8,8,'',true]])assert.equal(mobileAutoPixelCap(...hints),.85);
  let state=createAutoGraphics('high',1.25);
  state=adaptAutoGraphics(state,50,true,1000,cap,60);
  state=adaptAutoGraphics(state,50,true,2000,cap,60);
  assert.ok(state.scale<1.25);
  for(let second=3;second<=80;second++)state=adaptAutoGraphics(state,60,true,second*1000,cap,60);
  assert.equal(state.scale,1.25);
  assert.equal(state.profile,'high');
});

test('mobile cadence averages 60 Hz on 60, 90 and 120 Hz screens without drift',()=>{
  for(const refresh of [60,90,120]) {
    const state=createRenderPacer(); let draws=0;
    for(let frame=0;frame<refresh*10;frame++)if(renderFrameDue(frame*1000/refresh,true,false,state))draws++;
    assert.ok(Math.abs(draws-600)<=2,`${refresh} Hz produced ${draws} draws`);
  }
  const state=createRenderPacer();let draws=0;
  for(let frame=0;frame<600;frame++)if(renderFrameDue(frame*1000/60,true,true,state))draws++;
  assert.ok(Math.abs(draws-100)<=1);
  assert.equal(renderFrameDue(10001,true,false,state),true,'Leaving a paused panel responds immediately');
  assert.equal(renderFrameDue(300000,true,false,state),true,'A long suspended interval never schedules a catch-up burst');
  assert.equal(renderFrameDue(300001,true,false,state),false);
});
