import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { createMarsTerrain } from '../ui/world/marsTerrain.ts';
import { spawnCuriosityRover, stepCuriosityRover, exportCuriositySave } from '../game/curiosityRover.ts';

const hash = value => createHash('sha256')
  .update(typeof value === 'string' ? value : Buffer.from(value.buffer, value.byteOffset, value.byteLength))
  .digest('hex');

test('retiring mission modes preserves the shipped terrain, contacts, traction and rover trajectory', () => {
  const root = new T.Group();
  const terrain = createMarsTerrain(root);
  try {
    const geometry = [];
    root.traverse(object => {
      if (!object.geometry || !object.visible) return;
      geometry.push({
        name: object.name, type: object.type, visible: object.visible, count: object.count,
        position: object.position.toArray(), rotation: object.rotation.toArray(), scale: object.scale.toArray(),
        index: object.geometry.index ? hash(object.geometry.index.array) : null,
        attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([name, attribute]) => [name, hash(attribute.array)])),
        instances: object.instanceMatrix ? hash(object.instanceMatrix.array) : null,
        colors: object.instanceColor ? hash(object.instanceColor.array) : null,
      });
    });
    const samples = [];
    for (let x = -200; x <= 200; x += 5.25) for (let z = -200; z <= 200; z += 5.25) {
      samples.push([x, z, terrain.heightAt(x, z), terrain.roverHeightAt(x, z), terrain.mudAt(x, z)]);
    }
    let rover = spawnCuriosityRover(terrain.obstacles, terrain.roverHeightAt, { seed: 4132 });
    const trajectory = [];
    for (let frame = 0; frame < 2400; frame++) {
      rover = stepCuriosityRover(rover, 1 / 30, terrain.obstacles, terrain.roverHeightAt);
      if (frame % 30 === 0) trajectory.push(exportCuriositySave(rover));
    }
    // Captured from the existing playable baseline before migration.
    // The invisible historical backdrop is deliberately excluded from visible geometry.
    assert.equal(hash(JSON.stringify(geometry)), 'ecee13864050f6b25c75fa81b7fe09a8834f915d7001f4a5066d06864f09233c');
    assert.equal(terrain.obstacles.length, 469);
    assert.equal(hash(JSON.stringify(terrain.obstacles)), 'fb72b081f8e718666c6d990c0ecddd0387d76aa459bfce882ea8788251ea49b2');
    assert.equal(hash(JSON.stringify(samples)), '07968d711ec2ec0551a6d55db5aae9cedead6f22e7e2bdef98c1415f5749a131');
    assert.equal(hash(JSON.stringify(trajectory)), '0b3fbc020ad67b30a52a5e03fc6991310d5a83748a637e0a9d9a3828a8647c56');
  } finally {
    terrain.disposeTracks();
    root.traverse(object => {
      object.geometry?.dispose();
      for (const material of object.material ? [].concat(object.material) : []) material.dispose();
    });
  }
});
