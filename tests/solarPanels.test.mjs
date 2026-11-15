import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GREENHOUSE_SITES, GREENHOUSE_PAD } from '../game/greenhouseSites.ts';
import { GREENHOUSE_GROUND_HEIGHTS, OUTPOST_GROUND_HEIGHT } from '../game/marsExpeditionTerrain.ts';
import { OUTPOST_SITE } from '../game/outpostSite.ts';
import { OUTPOST_SOLAR_ARRAY_SLOTS } from '../ui/world/createSolarPanels.ts';

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

test('outpost solar array slots align with 4-column 2-row campus layout and foundation height', () => {
  assert.equal(OUTPOST_SOLAR_ARRAY_SLOTS.length, 8, '8 solar panels at outpost');
  const expectedCols = [-18.0, -14.4, -10.8, -7.2];
  const expectedRows = [12.88, 15.92];

  for (const slot of OUTPOST_SOLAR_ARRAY_SLOTS) {
    assert.ok(expectedCols.includes(slot.x), `Column ${slot.x} should be in expected outpost array columns`);
    assert.ok(expectedRows.includes(slot.z), `Row ${slot.z} should be in expected outpost array rows`);
    assert.equal(slot.y, 1.1014, 'Mounting height matches foundation deck');
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
