import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {createPressureCollar, crossesObservatoryAperture} from '../scripts/outpost-repairs.mjs';

const {doors} = JSON.parse(readFileSync(new URL('../public/models/outpost/layout.json', import.meta.url), 'utf8'));

function intersections(data, door, lateral, height) {
  const nx = door.normal[0], nz = -door.normal[1], tx = -nz, tz = nx;
  const ray = new T.Ray(new T.Vector3(door.position[0] + tx * lateral - nx,
    door.position[2] + height, -door.position[1] + tz * lateral - nz), new T.Vector3(nx, 0, nz));
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), hit = new T.Vector3();
  let count = 0;
  for (let i = 0; i < data.indices.length; i += 3) {
    a.fromArray(data.position, data.indices[i] * 3);
    b.fromArray(data.position, data.indices[i + 1] * 3);
    c.fromArray(data.position, data.indices[i + 2] * 3);
    if (ray.intersectTriangle(a, b, c, false, hit)) count++;
  }
  return count;
}

test('all internal pressure collars retain the original aperture and seal the canopy corners', () => {
  for (const door of doors.filter(door => door.id !== 'entrance')) {
    const geometry = createPressureCollar(door);
    for (const data of Object.values(geometry)) {
      for (const lateral of [-.874, -.5, 0, .5, .874]) {
        for (const height of [.02, .4, 1, 1.7, 2.199]) {
          assert.equal(intersections(data, door, lateral, height), 0, `${door.id} passage must stay clear`);
        }
      }
      assert.ok([...data.position, ...data.normal, ...data.uv].every(Number.isFinite));
      for (let i = 0; i < data.normal.length; i += 3) {
        assert.ok(Math.abs(Math.hypot(...data.normal.subarray(i, i + 3)) - 1) < 1e-5);
      }
      for (let i = 0; i < data.indices.length; i += 3) {
        const a = new T.Vector3().fromArray(data.position, data.indices[i] * 3);
        const b = new T.Vector3().fromArray(data.position, data.indices[i + 1] * 3);
        const c = new T.Vector3().fromArray(data.position, data.indices[i + 2] * 3);
        const normal = new T.Vector3().fromArray(data.normal, data.indices[i] * 3);
        assert.ok(b.sub(a).cross(c.sub(a)).normalize().dot(normal) > .999, 'surface winding must agree with its lighting normal');
      }
    }
    for (const [lateral, height] of [[-1.47, 1], [1.47, 1], [-1.2, 2.3], [1.2, 2.3], [0, 2.85]]) {
      assert.ok(intersections(geometry.shell, door, lateral, height) > 0, `${door.id} canopy perimeter must be sealed`);
    }
    assert.ok(intersections(geometry.interior, door, 1.3, 1) > 0, 'inner faces cover the narrow side gaps');
    assert.equal(intersections(geometry.interior, door, 1.5, 1), 0, 'exposed outer edges remain white');
    assert.equal(intersections(geometry.shell, door, 0, 3), 0, 'collar must not project above the canopy');
  }
});

test('observatory trim removal is limited to the entrance arc below the lintel', () => {
  const door = doors.find(door => door.id === 'observatory_dome');
  assert.ok(crossesObservatoryAperture([[12, 1.98, -17.38], [12.2, 1.98, -17.39], [12.1, 2, -17.39]], door));
  assert.equal(crossesObservatoryAperture([[12, 1.98, -26], [12.2, 1.98, -26], [12.1, 2, -26]], door), false);
  assert.equal(crossesObservatoryAperture([[13.5, 1.98, -17.38], [13.6, 1.98, -17.39], [13.6, 2, -17.39]], door), false);
  assert.equal(crossesObservatoryAperture([[12, 3, -17.38], [12.2, 3, -17.39], [12.1, 3.02, -17.39]], door), false);
});
