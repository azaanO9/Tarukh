import test from 'node:test';
import assert from 'node:assert/strict';
import {createArrivalFrame,sampleStarshipArrival,STARSHIP_RETURN_CUT} from '../game/starshipArrival.ts';
import {FLIGHT_DURATION,FLIGHT_LANDING,FLIGHT_READY_HOLD,advanceDeparture,landingPlaybackTime,sampleDepartureSequence} from '../game/departureSequence.ts';

const frame=()=>({...createArrivalFrame(),shot:'launch'});
test('added orbital shots leave every original Mars landing pose intact',()=>{
  const original=createArrivalFrame(),extended=frame();
  for(let t=STARSHIP_RETURN_CUT;t<=32;t+=1/60){
    sampleStarshipArrival(t,original);sampleDepartureSequence(t+FLIGHT_LANDING-STARSHIP_RETURN_CUT,extended);
    for(const key of Object.keys(original)){
      if(key==='progress')continue;
      if(typeof original[key]==='number')assert.ok(Math.abs(original[key]-extended[key])<1e-10,`${key} at ${t}`);
      else assert.equal(extended[key],original[key],`${key} at ${t}`);
    }
  }
});
test('Earth launch, Earth departure and Mars entry are separate covered shots',()=>{
  const out=frame();
  for(const [time,shot] of [[2,'launch'],[8,'earth-orbit'],[15,'mars-entry'],[20,'landing']]){
    sampleDepartureSequence(time,out);assert.equal(out.shot,shot);
  }
  for(const cut of [6,12,19]){
    sampleDepartureSequence(cut-.00001,out);assert.ok(out.fade>.999);
    sampleDepartureSequence(cut,out);assert.equal(out.fade,1);
  }
  for(let t=0;t<FLIGHT_LANDING;t+=.01)assert.ok(landingPlaybackTime(t)<STARSHIP_RETURN_CUT);
});
test('preparation holds before landing; pause and invalid deltas cannot advance it',()=>{
  let elapsed=0;for(let i=0;i<6000;i++)elapsed=advanceDeparture(elapsed,1/60,false,false);
  assert.equal(elapsed,FLIGHT_READY_HOLD);
  assert.equal(advanceDeparture(elapsed,.1,true,true),elapsed);
  assert.equal(advanceDeparture(elapsed,NaN,false,true),elapsed);
  assert.equal(advanceDeparture(elapsed,-1,false,true),elapsed);
  assert.ok(advanceDeparture(elapsed,.1,false,true)>elapsed);
  for(const fps of [30,60,120]){
    let time=0;for(let i=0;i<fps*(FLIGHT_DURATION+1);i++)time=advanceDeparture(time,1/fps,false,true);
    assert.ok(time>=FLIGHT_DURATION);
  }
});
