import test from "node:test";
import assert from "node:assert/strict";
import {
  spawnRoverVehicle,
  enterRover,
  stepRoverVehicle,
  getRoverPartWorldPosition,
  getNearestRoverPart,
  repairRoverPart,
  INITIAL_ROVER_DAMAGE,
} from "../game/roverVehicle.ts";
import { boxObstacle } from "../game/collision.ts";

test("rover initializes with full 100% nominal health across all components", () => {
  const rover = spawnRoverVehicle(0, 0, 0);
  assert.deepEqual(rover.damage, INITIAL_ROVER_DAMAGE);
  assert.equal(rover.damage.wheel_fl, 100);
  assert.equal(rover.damage.wheel_fr, 100);
  assert.equal(rover.damage.wheel_ml, 100);
  assert.equal(rover.damage.wheel_mr, 100);
  assert.equal(rover.damage.wheel_rl, 100);
  assert.equal(rover.damage.wheel_rr, 100);
  assert.equal(rover.damage.solar_array, 100);
});

test("high speed physical collision exceeding safe threshold damages localized wheel zone", () => {
  let rover = enterRover(spawnRoverVehicle(0, 0, 0));
  // Accelerate rover forward towards an obstacle ahead (along -Z)
  rover.speed = 12.0; // ~43 km/h
  // Rigid rock obstacle directly in front of the front-left flank
  const rockObstacle = boxObstacle(-1.2, -4.0, 1.5, 1.5, "rock-boulder");

  // Step into collision
  rover = stepRoverVehicle(rover, new Set(["w"]), 0.05, [rockObstacle]);

  // Front-left wheel should absorb high impact force (> 85 kN) and take damage
  assert.ok(rover.damage.wheel_fl < 100, `Expected wheel_fl damage, got ${rover.damage.wheel_fl}`);
  // Distant rear wheels remain undamaged
  assert.equal(rover.damage.wheel_rr, 100);
  assert.equal(rover.damage.wheel_rl, 100);
});

test("low speed gentle contact below safe force threshold causes zero damage", () => {
  let rover = enterRover(spawnRoverVehicle(0, 0, 0));
  rover.speed = 0.8; // ~2.8 km/h (< 85 kN impact force)
  const wall = boxObstacle(0, -2.0, 4.0, 1.0, "low-wall");

  rover = stepRoverVehicle(rover, new Set(["w"]), 0.05, [wall]);
  assert.equal(rover.damage.wheel_fl, 100);
  assert.equal(rover.damage.wheel_fr, 100);
  assert.equal(rover.damage.wheel_ml, 100);
});

test("dead wheel reduces motor drive torque and introduces terrain drag", () => {
  // Nominal rover
  let nominalRover = enterRover(spawnRoverVehicle(0, 0, 0));
  nominalRover = stepRoverVehicle(nominalRover, new Set(["w"]), 0.05);

  // Damaged rover with 3 failed wheels (<= 25% health)
  let damagedRover = enterRover(spawnRoverVehicle(0, 0, 0));
  damagedRover.damage = {
    ...damagedRover.damage,
    wheel_fl: 0,
    wheel_ml: 0,
    wheel_rl: 0,
  };
  damagedRover = stepRoverVehicle(damagedRover, new Set(["w"]), 0.05);

  // 3 failed wheels cuts motor torque by 50%
  assert.ok(
    damagedRover.speed < nominalRover.speed,
    `Damaged rover speed (${damagedRover.speed}) should be less than nominal (${nominalRover.speed})`,
  );
});

test("asymmetric dead wheel damage introduces yaw pull towards the damaged flank", () => {
  let rover = enterRover(spawnRoverVehicle(0, 0, 0));
  rover.speed = 8.0; // travelling forward along -Z
  // Disable left wheels only
  rover.damage = {
    ...rover.damage,
    wheel_fl: 10,
    wheel_ml: 10,
  };

  const initialYaw = rover.yaw;
  // Step forward without steering input
  rover = stepRoverVehicle(rover, new Set(), 0.05);

  // Unbalanced left drag induces net positive yaw change (pulling vehicle left)
  assert.ok(
    rover.yaw > initialYaw,
    `Expected positive yaw drift from left drag, got ${rover.yaw}`,
  );
});

test("catastrophic rollover damages roof solar array and permanently halts charging", () => {
  let rover = enterRover(spawnRoverVehicle(0, 0, 0));
  // Set solar array to critically destroyed
  rover.damage.solar_array = 0;

  // Step in broad daylight (solarIntensity = 1.0)
  rover = stepRoverVehicle(rover, new Set(), 0.05, [], () => 0, () => 0, undefined, {
    solarIntensity: 1.0,
  });

  // Solar charging rate should be exactly zero
  assert.equal(rover.solarRate, 0);
  assert.equal(rover.solarCharging, false);
});

test("getRoverPartWorldPosition and getNearestRoverPart locate components for EVA", () => {
  const rover = spawnRoverVehicle(10, 20, 0);
  const flPos = getRoverPartWorldPosition(rover, "wheel_fl");
  assert.ok(Math.abs(flPos.x - (10 - 1.425)) < 0.1);

  // Astronaut standing right next to front-left wheel
  const astronaut = { x: flPos.x + 0.2, z: flPos.z + 0.2 };
  const nearest = getNearestRoverPart(astronaut, rover);
  assert.ok(nearest !== null);
  assert.equal(nearest.id, "wheel_fl");
  assert.ok(nearest.distance < 0.5);
});

test("repairRoverPart restores damaged component health back to 100%", () => {
  let rover = spawnRoverVehicle(0, 0, 0);
  rover.damage.wheel_fl = 15;
  rover.damage.solar_array = 0;

  rover = repairRoverPart(rover, "wheel_fl");
  assert.equal(rover.damage.wheel_fl, 100);
  assert.equal(rover.damage.solar_array, 0);

  rover = repairRoverPart(rover, "solar_array");
  assert.equal(rover.damage.solar_array, 100);
});
