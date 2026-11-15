import test from 'node:test';
import assert from 'node:assert/strict';
import {createGraphicsSamplingGate,updateGraphicsSamplingGate,OUTDOOR_GRAPHICS_SETTLE_MS} from '../game/graphicsSampling.ts';
import {createAutoGraphics,adaptAutoGraphics} from '../game/autoGraphics.ts';
import {createBackgroundGraphics} from '../game/backgroundGraphics.ts';

test('indoor and exit-transition frames are excluded; outdoor sampling resumes without a latch',()=>{
  const gate=createGraphicsSamplingGate();
  assert.equal(updateGraphicsSamplingGate(gate,false,0),true);
  assert.equal(updateGraphicsSamplingGate(gate,true,100),false);
  assert.equal(updateGraphicsSamplingGate(gate,true,20000),false);
  assert.equal(updateGraphicsSamplingGate(gate,false,20100),false);
  assert.equal(updateGraphicsSamplingGate(gate,false,20100+OUTDOOR_GRAPHICS_SETTLE_MS-1),false);
  assert.equal(updateGraphicsSamplingGate(gate,false,20100+OUTDOOR_GRAPHICS_SETTLE_MS),true);
  assert.ok(OUTDOOR_GRAPHICS_SETTLE_MS>550,'settling covers the existing chase-camera blend');
});

test('brief reentry restarts settling and cheap room frames cannot raise the outdoor render scale',()=>{
  const gate=createGraphicsSamplingGate(),cap=()=>1;
  let state={...createAutoGraphics('high',1),scale:.7};
  for(let second=0;second<15;second++)state=adaptAutoGraphics(state,90,updateGraphicsSamplingGate(gate,true,second*1000),second*1000,cap);
  assert.equal(state.scale,.7);assert.equal(state.profile,'high');assert.equal(state.fast,0);
  assert.equal(updateGraphicsSamplingGate(gate,false,15000),false);
  assert.equal(updateGraphicsSamplingGate(gate,true,15400),false);
  assert.equal(updateGraphicsSamplingGate(gate,false,15500),false);
  assert.equal(updateGraphicsSamplingGate(gate,false,16000),false,'earlier exit deadline must not reopen sampling');
  assert.equal(updateGraphicsSamplingGate(gate,false,16500),true);
});

test('calibration started inside waits safely and resumes trials after returning outdoors',()=>{
  const gate=createGraphicsSamplingGate(),probe=createBackgroundGraphics(1,()=>1);
  for(let i=0;i<180;i++)assert.equal(probe.frame(16,8,updateGraphicsSamplingGate(gate,true,i*16)),null);
  assert.equal(probe.trials().length,0);assert.equal(probe.candidate().profile,'performance');
  let decision=null;
  for(let i=0;i<180&&!decision;i++)decision=probe.frame(16,8,updateGraphicsSamplingGate(gate,false,3000+i*16));
  assert.ok(decision);assert.equal(decision.trial.profile,'performance');assert.equal(decision.trial.meetsTarget,true);
});
