import test from "node:test";
import assert from "node:assert/strict";
import {nightAmount,daylightPhase,helmetLightAmount,DAYLIGHT_CYCLE_SECONDS} from "../game/daylightCycle.ts";
test("ten-minute daylight keeps changing smoothly through sunset, night and sunrise",()=>{
 assert.equal(DAYLIGHT_CYCLE_SECONDS,600);
 assert.equal(daylightPhase(0),"Day");assert.equal(daylightPhase(150),"Sunset");assert.equal(daylightPhase(300),"Night");assert.equal(daylightPhase(450),"Sunrise");
 assert.equal(nightAmount(0),0);assert.equal(nightAmount(300),1);assert.equal(nightAmount(600),0);
 assert.ok(nightAmount(10)>0);assert.ok(nightAmount(20)>nightAmount(10));
 for(let t=0;t<1200;t+=.1){const n=nightAmount(t);assert.ok(n>=0&&n<=1);assert.ok(Math.abs(n-nightAmount(t+.1))<.0006);}
 for(let t=0;t<300;t++)assert.ok(nightAmount(t+1)>nightAmount(t));
 for(let t=300;t<600;t++)assert.ok(nightAmount(t+1)<nightAmount(t));
 for(const t of [100,250,300,400,550,600])assert.ok(Math.abs(nightAmount(t-.001)-nightAmount(t+.001))<.00002);
 assert.equal(daylightPhase(600),'Day');assert.equal(nightAmount(-2),0);
});

test('helmet lighting stays off in daylight and fades smoothly to full nighttime output',()=>{
 for(const t of [0,30,60,100,500,550,600])assert.equal(helmetLightAmount(nightAmount(t)),0);
 assert.equal(helmetLightAmount(nightAmount(300)),1);
 for(let t=111;t<300;t++)assert.ok(helmetLightAmount(nightAmount(t+1))>helmetLightAmount(nightAmount(t)));
 for(let t=300;t<488;t++)assert.ok(helmetLightAmount(nightAmount(t+1))<helmetLightAmount(nightAmount(t)));
 for(let t=0;t<600;t+=.1){
  const amount=helmetLightAmount(nightAmount(t));
  assert.ok(amount>=0&&amount<=1);
  assert.ok(Math.abs(amount-helmetLightAmount(nightAmount(t+.1)))<.0012,'No light flashes at dusk or dawn');
 }
 assert.ok(Math.abs(helmetLightAmount(.3+.000001)-helmetLightAmount(.3-.000001))<1e-10);
});
