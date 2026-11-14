import test from 'node:test';
import assert from 'node:assert/strict';
import {browserThrottledFrame,summarizeFrames,calibrationCandidates,createAutoGraphics,adaptAutoGraphics,approachRenderScale,AUTO_TARGET_FPS} from '../game/autoGraphics.ts';
import {graphicsTier} from '../ui/world/graphicsTiers.ts';
const cap=profile=>graphicsTier(profile).resolutionCap;
const sample=fps=>summarizeFrames(new Float64Array(60).fill(1000/fps));

test('benchmark uses stable presentation times and reserves some headroom above 40 FPS',()=>{
 assert.equal(AUTO_TARGET_FPS,40);
 assert.ok(sample(45).meetsTarget);assert.equal(sample(39).meetsTarget,false);
 assert.equal(summarizeFrames([NaN,Infinity,0,-2]).meetsTarget,false);
 assert.equal(summarizeFrames(new Float64Array(5).fill(16)).meetsTarget,false);
 const uneven=[...new Array(45).fill(14),...new Array(15).fill(50)];
 assert.ok(summarizeFrames(uneven).fps>40);assert.equal(summarizeFrames(uneven).meetsTarget,false);
});

test('runtime retains Ultra at 40+ FPS and ignores a single hitch, pauses and invalid samples',()=>{
 let state=createAutoGraphics('ultra',1.5);
 for(let second=1;second<=20;second++)state=adaptAutoGraphics(state,42,true,second*1000,cap);
 assert.equal(state.profile,'ultra');assert.equal(state.scale,1.5);
 state=adaptAutoGraphics(state,20,true,21000,cap);assert.equal(state.profile,'ultra');
 state=adaptAutoGraphics(state,10,false,22000,cap);assert.equal(state.slow,0);assert.equal(state.scale,1.5);
 state=adaptAutoGraphics(state,NaN,true,23000,cap);assert.equal(state.profile,'ultra');
});
test('sustained slowdowns adapt with cooldown and recovery never exceeds the measured ceiling',()=>{
 let state=createAutoGraphics('high',1.5);
 state=adaptAutoGraphics(state,22,true,1000,cap);state=adaptAutoGraphics(state,22,true,2000,cap);
 assert.equal(state.profile,'auto');assert.equal(state.scale,1.25);
 for(let second=3;second<7;second++)state=adaptAutoGraphics(state,20,true,second*1000,cap);
 assert.equal(state.profile,'auto');
 for(let second=7;second<=45;second++)state=adaptAutoGraphics(state,60,true,second*1000,cap);
 assert.equal(state.profile,'high');assert.ok(state.scale<=1.5);
});
test('resolution settles in small bounded steps and cannot fall below the emergency floor',()=>{
 let scale=1.5;for(let i=0;i<40;i++){const next=approachRenderScale(scale,.7);assert.ok(Math.abs(next-scale)<=.04001);scale=next;}
 assert.equal(scale,.7);
 let state=createAutoGraphics('performance',.55);
 for(let second=1;second<=30;second++)state=adaptAutoGraphics(state,8,true,second*1000,cap);
 assert.equal(state.scale,.55);
});
test('runtime skips an identical High preset when Ultra is already at the display cap',()=>{
 const displayCap=profile=>Math.min(1.25,cap(profile));
 let state=createAutoGraphics('ultra',1.25);
 state=adaptAutoGraphics(state,25,true,1000,displayCap);state=adaptAutoGraphics(state,25,true,2000,displayCap);
 assert.equal(state.profile,'auto');
});

test('occluded-browser cadence is distinct from expensive slow frames',()=>{
 assert.equal(browserThrottledFrame(1000,8),true);
 assert.equal(browserThrottledFrame(250,10),true);
 assert.equal(browserThrottledFrame(1000,800),false);
 assert.equal(browserThrottledFrame(50,8),false);
 assert.equal(browserThrottledFrame(33,28),false);
});

test('every device can try Ultra; identical High trial is skipped at native 1x scale',()=>{
 assert.deepEqual(calibrationCandidates(1,cap).map(x=>x.profile),['ultra','auto','performance','performance','performance','performance']);
 const retina=calibrationCandidates(3,cap);assert.equal(retina[0].scale,2);assert.equal(retina[1].profile,'high');
 assert.equal(retina.at(-1).scale,.55);
});
