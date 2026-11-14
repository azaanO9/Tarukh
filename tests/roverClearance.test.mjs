import test from 'node:test';
import assert from 'node:assert/strict';
import {ROVER_CHASSIS_CLEARANCE,getRoverGear} from '../game/roverVehicle.ts';
test("roverVehicle clearance stays above terrain Z-fighting threshold and gear reports D/N/R", () => {
  assert.ok(ROVER_CHASSIS_CLEARANCE >= 0.02);
  assert.equal(getRoverGear(2.4), "D");
  assert.equal(getRoverGear(0), "N");
  assert.equal(getRoverGear(-1.5), "R");
});
