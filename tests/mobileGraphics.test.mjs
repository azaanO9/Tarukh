import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileGraphicsTier, mobileAutoPixelCap, createMobileAutoGraphics, MOBILE_TARGET_FPS, MOBILE_MIN_RENDER_SCALE, createRenderPacer, renderFrameDue} from '../game/mobileGraphics.ts';
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

test('mobile Auto keeps readable quality at 45 FPS, rejects a slow upgrade and never probes Ultra',()=>{
  const probe=createBackgroundGraphics(1.25,cap,{mobile:true});
  assert.equal(measure(probe,60).next.profile,'auto');
  assert.equal(measure(probe,45).next.profile,'high');
  const result=measure(probe,32);
  assert.equal(result.complete,true);
  assert.equal(result.selected.profile,'auto');
  assert.equal(probe.trials().some(t=>t.profile==='ultra'),false);
  const lowDpr=createBackgroundGraphics(.85,cap,{mobile:true});
  while(!lowDpr.done())measure(lowDpr,60);
  assert.equal(lowDpr.candidate().profile,'high','Detail remains measurable even on a low-pixel-budget device');
});

test('mobile hints constrain pixel cost while sustained slow frames adapt and recover',()=>{
  assert.equal(mobileAutoPixelCap(8,8,'Apple GPU',false),1.25);
  for(const hints of [[4,8,'',false],[8,4,'',false],[8,8,'SwiftShader',false],[8,8,'',true]])assert.equal(mobileAutoPixelCap(...hints),1);
  let state=createAutoGraphics('high',1.25);
  state=adaptAutoGraphics(state,30,true,1000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  state=adaptAutoGraphics(state,30,true,2000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  assert.ok(state.scale<1.25);
  for(let second=3;second<=80;second++)state=adaptAutoGraphics(state,60,true,second*1000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  assert.equal(state.scale,1.25);
  assert.equal(state.profile,'high');
});

test('mobile sampling and adaptation never fall back to the old half-resolution image',()=>{
  const probe=createBackgroundGraphics(1.25,cap,{mobile:true});
  while(!probe.done())measure(probe,20);
  assert.equal(probe.candidate().scale,MOBILE_MIN_RENDER_SCALE);
  assert.equal(probe.trials().every(trial=>trial.scale>=MOBILE_MIN_RENDER_SCALE),true);
  let state=createAutoGraphics('high',1.25);
  for(let second=0;second<90;second++)state=adaptAutoGraphics(state,20,true,second*1000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  assert.equal(state.profile,'performance');
  assert.equal(state.scale,MOBILE_MIN_RENDER_SCALE);
  for(let second=90;second<120;second++)state=adaptAutoGraphics(state,45,true,second*1000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  assert.equal(state.scale,MOBILE_MIN_RENDER_SCALE,'Stable 45 FPS does not trigger more resizing');
  for(let second=120;second<240;second++)state=adaptAutoGraphics(state,60,true,second*1000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  assert.equal(state.profile,'high');
  assert.equal(state.scale,1.25);
  const zoomed=createBackgroundGraphics(.4,cap,{mobile:true});
  assert.equal(measure(zoomed,20).complete,true,'Browser zoom keeps a valid candidate below the ordinary floor');
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

test('a slow loading probe recovers quality after sustained spare frame time',()=>{
  let state=createMobileAutoGraphics('performance',.85,1.25);
  for(let second=0;second<100;second++)state=adaptAutoGraphics(state,60,true,second*1000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  assert.equal(state.profile,'high');
  assert.equal(state.scale,1.25);
  state=createMobileAutoGraphics('performance',.85,1);
  for(let second=0;second<100;second++)state=adaptAutoGraphics(state,60,true,second*1000,cap,MOBILE_TARGET_FPS,MOBILE_MIN_RENDER_SCALE);
  assert.equal(state.scale,1,'Recovery still honours the lower mobile pixel budget');
  assert.equal(state.profile,'high');
});
