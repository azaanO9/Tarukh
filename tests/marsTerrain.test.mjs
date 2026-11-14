import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createMarsTerrain} from '../ui/world/marsTerrain.ts';
import {marsExpeditionHeight} from '../game/marsExpeditionTerrain.ts';
test("free exploration removes invisible hardware floors while keeping natural terrain collisions", () => {
  const root = new T.Group();
  const terrain = createMarsTerrain(root);
  try {
    for (const [x, z] of [[17, 10], [-21, -23], [-2, -19], [-48, 24]]) {
      assert.ok(Math.abs(terrain.heightAt(x, z) - marsExpeditionHeight(x, z)) < 1e-5, `visible terrain supports feet at ${x},${z}`);
    }
    assert.equal(terrain.roverHeightAt(17, 10), 0, "no floating service pad under the crew rover");
    assert.ok(terrain.obstacles.length > 0, "natural rocks retain collision");
    assert.ok(terrain.obstacles.some(o=>Math.abs(o.x)>150 || Math.abs(o.z)>150), "distant original rocks remain solid");
    assert.ok(terrain.obstacles.every(o=>Number.isFinite(o.topY)), "rock tops allow height-aware jumps");
    assert.ok(root.children.length > 0, "terrain still renders");
  } finally {
    terrain.disposeTracks();
    root.traverse(object => {
      object.geometry?.dispose();
      for (const material of object.material ? [].concat(object.material) : []) material.dispose();
    });
  }
});
