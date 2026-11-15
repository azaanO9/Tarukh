import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnRoverVehicle} from '../game/roverVehicle.ts';
import {createRoverInstrumentHistory, roverInstrumentValues} from '../game/roverInstruments.ts';

test('instruments read live vehicle data without modifying the simulation', () => {
  const rover=spawnRoverVehicle(10,20,-Math.PI/2);
  Object.assign(rover,{speed:-2,battery:34.5,driving:true,solarCharging:false,estimatedRangeKm:12.5,
    solarRate:.004,powerDrainRate:.06,steerAngle:.2,slopeAngle:.1,roll:-.1});
  const original=structuredClone(rover), values=roverInstrumentValues(rover);
  assert.equal(values.speedKmh,7.2);
  assert.equal(values.gear,'R');
  assert.equal(values.heading,90);
  assert.equal(values.battery,34.5);
  assert.equal(values.rangeKm,12.5);
  assert.equal(values.solarRate,.004);
  assert.equal(values.drainRate,.06);
  assert.equal(values.charging,'BATTERY SUPPLY');
  assert.equal(values.steering,.2*180/Math.PI);
  assert.equal(values.slope,.1*180/Math.PI);
  assert.equal(values.roll,-.1*180/Math.PI);
  assert.deepEqual(rover,original);
  rover.garageCharging=true;rover.solarCharging=true;
  assert.equal(roverInstrumentValues(rover).charging,'GARAGE DOCK');
  rover.garageCharging=false;
  assert.equal(roverInstrumentValues(rover).charging,'SOLAR ARRAY');
  rover.solarCharging=false;rover.driving=false;
  assert.equal(roverInstrumentValues(rover).charging,'STANDBY');
});

test('recent telemetry history has a fixed allocation and overwrites the oldest sample', () => {
  const rover=spawnRoverVehicle(0,0,0), history=createRoverInstrumentHistory(4);
  const speed=history.speed, battery=history.battery;
  for(let i=0;i<10;i++){rover.speed=i;rover.battery=100-i;history.record(rover);}
  assert.equal(history.speed,speed);assert.equal(history.battery,battery);
  assert.equal(history.count,4);assert.equal(history.cursor,2);
  assert.deepEqual([...history.battery],[92,91,94,93]);
  assert.ok(Math.abs(history.speed[1]-32.4)<1e-5);
});
