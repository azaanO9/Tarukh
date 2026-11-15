import test from "node:test";
import assert from "node:assert/strict";
import { boxObstacle, overlapBody } from "../game/collision.ts";
import { createExplorationBoundaryObstacles } from "../game/explorationBounds.ts";
import {
  CURIOSITY_SCAN_DURATION,
  curiosityFootprint,
  spawnCuriosityRover,
  stepCuriosityRover,
} from "../game/curiosityRover.ts";

const flatTerrain = () => 0;

test("distant structures do not change Curiosity's local driving trajectory", () => {
  const nearby = [{ x: -22, z: 9, radius: 1.8 }];
  const distant = Array.from({ length: 1000 }, (_, index) =>
    boxObstacle(1000 + index * 4, -1000, 1.5, 2, `distant-${index}`),
  );
  let local = { ...spawnCuriosityRover(nearby, flatTerrain), nextScanAfter: 1000 };
  let full = structuredClone(local);
  for (let frame = 0; frame < 240; frame++) {
    local = stepCuriosityRover(local, 1 / 60, nearby, flatTerrain);
    full = stepCuriosityRover(full, 1 / 60, [...nearby, ...distant], flatTerrain);
    assert.deepEqual(full, local, `trajectory diverged at frame ${frame}`);
  }
});

test("a remote-centered boundary wall still blocks Curiosity when its edge is nearby", () => {
  const wall = boxObstacle(0, -1000, 1000, 996, "boundary-north");
  let state = {
    ...spawnCuriosityRover([], flatTerrain),
    x: 0, z: 0, yaw: 0,
    targetX: 0, targetZ: -80,
    nextScanAfter: 1000,
  };
  for (let frame = 0; frame < 300; frame++) {
    state = stepCuriosityRover(state, 0.05, [wall], flatTerrain);
    assert.equal(overlapBody(state.x, state.z, curiosityFootprint(0, 0, state.yaw), wall), null);
    assert.ok(state.z > -4, "rover crossed the near edge of the wall");
  }
});

test("far perimeter walls do not influence Curiosity's heading inside the colony", () => {
  const walls = createExplorationBoundaryObstacles();
  let withoutWalls = spawnCuriosityRover([], flatTerrain);
  let withWalls = structuredClone(withoutWalls);
  for (let frame = 0; frame < 300; frame++) {
    withoutWalls = stepCuriosityRover(withoutWalls, 1 / 60, [], flatTerrain);
    withWalls = stepCuriosityRover(withWalls, 1 / 60, walls, flatTerrain);
    assert.deepEqual(withWalls, withoutWalls, `perimeter changed driving at frame ${frame}`);
  }
});

test("destination selection checks structures outside Curiosity's local probe range", () => {
  const state = {
    ...spawnCuriosityRover([], flatTerrain, { allowColonyTargets: true, seed: 234 }),
    phase: "scanning",
    scanTimer: CURIOSITY_SCAN_DURATION,
  };
  const withoutBlocker = stepCuriosityRover(state, 0.05, [], flatTerrain);
  const blocker = boxObstacle(withoutBlocker.targetX, withoutBlocker.targetZ, 8, 8, "remote-habitat");
  assert.ok(Math.hypot(blocker.x - state.x, blocker.z - state.z) > blocker.radius + 20);
  const withBlocker = stepCuriosityRover(state, 0.05, [blocker], flatTerrain);
  assert.equal(overlapBody(withBlocker.targetX, withBlocker.targetZ, curiosityFootprint(0, 0, 0), blocker), null);
  assert.notDeepEqual([withBlocker.targetX, withBlocker.targetZ], [withoutBlocker.targetX, withoutBlocker.targetZ]);
});

test("Curiosity still selects traversable science rocks from the complete obstacle list", () => {
  const rock = { x: 0, z: -53, radius: 0.4, traversable: true };
  const state = {
    ...spawnCuriosityRover([], flatTerrain),
    x: 0, z: -50, yaw: 0,
    targetX: 0, targetZ: -100,
    driveTimer: 100,
    nextScanAfter: 1,
  };
  const scanning = stepCuriosityRover(state, 0.05, [rock], flatTerrain);
  assert.equal(scanning.phase, "scanning");
  assert.equal(scanning.scanTargetX, rock.x);
  assert.equal(scanning.scanTargetZ, rock.z);
});
