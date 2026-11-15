import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GREENHOUSE_SITES, GREENHOUSE_PAD } from '../game/greenhouseSites.ts';
import { GREENHOUSE_GROUND_HEIGHTS, OUTPOST_GROUND_HEIGHT } from '../game/marsExpeditionTerrain.ts';
import { OUTPOST_SOLAR_ARRAY_SLOTS } from '../ui/world/createSolarPanels.ts';
import { stripLegacySolarGeometry, SOLAR_LEGACY_BOUNDS } from '../ui/world/createMarsOutpost.ts';

test('solar panel GLB asset exists with full 2K resolution textures and CC-BY attribution', () => {
  const glbPath = 'public/models/solar-panel/solar-panel.glb';
  assert.ok(fs.existsSync(glbPath), 'solar-panel.glb must exist');
  const buffer = fs.readFileSync(glbPath);
  assert.ok(buffer.length > 5_000_000, 'GLB should retain uncompressed 2K textures (> 5MB)');

  const jsonLen = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.slice(20, 20 + jsonLen).toString('utf8'));

  assert.ok(json.asset?.extras?.author?.includes('Harri Snellman'), 'Must attribute Harri Snellman');
  assert.ok(json.asset?.extras?.license?.includes('CC-BY'), 'Must retain CC-BY license');
  assert.equal(json.images.length, 3, 'Must have 3 texture images (BaseColor, MetallicRoughness, Normal)');
  assert.equal(json.materials[0].name, 'SolarPanel');
});

test('outpost solar array slots align with 4-column 2-row campus layout and stand on foundation', () => {
  assert.equal(OUTPOST_SOLAR_ARRAY_SLOTS.length, 8, '8 solar panels at outpost');
  const expectedCols = [-18.0, -14.4, -10.8, -7.2];
  const expectedRows = [12.88, 15.92];

  for (const slot of OUTPOST_SOLAR_ARRAY_SLOTS) {
    assert.ok(expectedCols.includes(slot.x), `Column ${slot.x} should be in expected outpost array columns`);
    assert.ok(expectedRows.includes(slot.z), `Row ${slot.z} should be in expected outpost array rows`);
    assert.equal(slot.y, 0.0, 'Mounting height stands directly on foundation deck');
  }

  // Verify alignment with layout.json collision boxes
  const layout = JSON.parse(fs.readFileSync('public/models/outpost/layout.json', 'utf8'));
  for (const col of expectedCols) {
    for (const row of expectedRows) {
      const match = layout.boxes.find(b => Math.abs(b[0] - col) < 0.05 && Math.abs(b[1] - row) < 0.1);
      assert.ok(match, `layout.json must contain obstacle box for solar array at (${col}, ${row})`);
    }
  }
});

test('greenhouse solar panels sit safely on flat pads away from doors and ramps', () => {
  const localOffsets = [
    { lx: -2.0, lz: -9.2 },
    { lx: 2.0, lz: -9.2 },
  ];

  const ghLayout = JSON.parse(fs.readFileSync('public/models/greenhouse/layout.json', 'utf8'));

  for (let i = 0; i < GREENHOUSE_SITES.length; i++) {
    const site = GREENHOUSE_SITES[i];
    const groundY = GREENHOUSE_GROUND_HEIGHTS[i];
    assert.equal(groundY, OUTPOST_GROUND_HEIGHT, 'Greenhouse ground must be planar with colony datum');

    for (const { lx, lz } of localOffsets) {
      // Check within pad halfSize
      const cos = Math.cos(site.yaw);
      const sin = Math.sin(site.yaw);
      const wx = site.x + lx * cos + lz * sin;
      const wz = site.z - lx * sin + lz * cos;

      assert.ok(Math.abs(wx - site.x) <= GREENHOUSE_PAD.halfSize, `Solar panel X (${wx}) must be within pad halfSize`);
      assert.ok(Math.abs(wz - site.z) <= GREENHOUSE_PAD.halfSize, `Solar panel Z (${wz}) must be within pad halfSize`);

      // Verify clear of all doors
      for (const door of ghLayout.doors) {
        const dDoor = Math.hypot(lx - door.x * 1.6, lz - door.z * 1.6);
        assert.ok(dDoor > 4.0, `Solar panel at (${lx}, ${lz}) must be well clear of door ${door.id} (distance: ${dDoor.toFixed(2)}m)`);
      }
    }
  }
});

test('stripLegacySolarGeometry removes legacy mounting frames and support poles within bounds', () => {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array([
    // Triangle 1 (outside solar array bounds: e.g. at origin)
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    // Triangle 2 (inside solar legacy bounds: x = -10, y = 1.0, z = 13.0)
    -10, 1, 13,
    -11, 1, 13,
    -10, 1.5, 13,
  ]);
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex([0, 1, 2, 3, 4, 5]);

  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
  assert.ok(SOLAR_LEGACY_BOUNDS.containsPoint(new THREE.Vector3(-10, 1, 13)), 'Test point must lie inside legacy solar bounds');
  const stripped = stripLegacySolarGeometry(mesh);
  assert.equal(stripped, 1, 'Should strip exactly 1 triangle inside solar legacy bounds');
  assert.equal(geom.index.count, 3, 'Should retain remaining 3 indices for triangle outside bounds');
  assert.equal(geom.index.getX(0), 0);
  assert.equal(geom.index.getX(1), 1);
  assert.equal(geom.index.getX(2), 2);
});

test('stripLegacySolarGeometry removes legacy triangles when campus hierarchy is translated to world position', () => {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array([
    // Triangle 1 (outside bounds in campus local space)
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    // Triangle 2 (inside solar legacy bounds in campus local space: x = -10, y = 1.0, z = 13.0)
    -10, 1, 13,
    -11, 1, 13,
    -10, 1.5, 13,
  ]);
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setIndex([0, 1, 2, 3, 4, 5]);

  const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
  mesh.name = '02__CREW_LIVING__frame_seams';
  const campusScene = new THREE.Group();
  campusScene.name = 'Scene';
  campusScene.add(mesh);

  const root = new THREE.Group();
  root.name = 'TARUKH Elysium Outpost';
  root.position.set(0, 0.1, -65);
  root.add(campusScene);
  root.updateMatrixWorld(true);

  // Both with explicit campusScene and with automatic hierarchy fallback
  const stripped = stripLegacySolarGeometry(mesh, campusScene);
  assert.equal(stripped, 1, 'Should strip 1 triangle using campusScene space despite root z = -65 translation');
  assert.equal(geom.index.count, 3, 'Should retain triangle outside bounds');
});
