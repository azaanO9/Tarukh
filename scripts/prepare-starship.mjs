// Offline preparation using the existing glTF Transform / Sharp tool workspace.
// node scripts/prepare-starship.mjs <source.glb> [tools-directory] [output-directory]
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';

const sourceArgument = process.argv[2];
if (!sourceArgument) throw new Error('Provide the user-supplied spacex_starship.glb path.');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(sourceArgument);
const tools = path.resolve(process.argv[3] ?? path.join(repo, 'outputs/garage-v1/tools'));
const out = path.resolve(process.argv[4] ?? path.join(repo, 'public/models/starship'));
const pathKey = value => process.platform === 'win32' ? value.toLowerCase() : value;
for (const filename of ['starship.glb', 'source.json']) {
  assert.notEqual(pathKey(source), pathKey(path.join(out, filename)), 'Output must not overwrite the supplied source.');
}
const require = createRequire(path.join(tools, 'package.json'));
const {NodeIO} = require('@gltf-transform/core');
const {ALL_EXTENSIONS} = require('@gltf-transform/extensions');
const {textureCompress, draco} = require('@gltf-transform/functions');
const dracoModule = require('draco3dgltf');
const sharp = require('sharp');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await dracoModule.createEncoderModule(),
  'draco3d.decoder': await dracoModule.createDecoderModule(),
});

const raw = await fs.readFile(source);
assert.ok(raw.length >= 20, 'Source must contain a GLB header and JSON chunk.');
assert.equal(raw.readUInt32LE(0), 0x46546c67, 'Source must be a GLB file.');
assert.equal(raw.readUInt32LE(4), 2, 'Source must use glTF 2.0.');
assert.equal(raw.readUInt32LE(8), raw.length, 'GLB length must match its header.');
assert.equal(raw.readUInt32LE(16), 0x4e4f534a, 'The first GLB chunk must be JSON.');
const jsonLength = raw.readUInt32LE(12);
assert.ok(jsonLength <= raw.length - 20, 'Source JSON chunk exceeds the GLB.');
const sourceJson = JSON.parse(raw.subarray(20, 20 + jsonLength));
const doc = await io.readBinary(raw), root = doc.getRoot(), scene = root.listScenes()[0];
assert.ok(scene, 'Source must contain a scene.');
const point = new T.Vector3(), bounds = new T.Box3(), partReport = [];
const worldPoints = new Map();
let triangles = 0;

for (const node of root.listNodes()) if (node.getMesh()) {
  const matrix = new T.Matrix4().fromArray(node.getWorldMatrix());
  const points = [], partBounds = new T.Box3();
  let count = 0;
  for (const primitive of node.getMesh().listPrimitives()) {
    const positions = primitive.getAttribute('POSITION');
    count += (primitive.getIndices()?.getCount() ?? positions.getCount()) / 3;
    const array = positions.getArray();
    for (let i = 0; i < array.length; i += 3) {
      point.set(array[i], array[i + 1], array[i + 2]).applyMatrix4(matrix);
      partBounds.expandByPoint(point);
      points.push(point.toArray());
    }
  }
  triangles += count;
  bounds.union(partBounds);
  worldPoints.set(node.getName(), points);
  partReport.push({name: node.getName(), triangles: count});
}

const center = bounds.getCenter(new T.Vector3()), height = bounds.max.y - bounds.min.y;
assert.ok(Number.isFinite(height) && height > 0, 'Source must have a finite positive height.');
const normalize = p => [(p[0] - center.x) / height, (p[1] - bounds.min.y) / height, (p[2] - center.z) / height];
const normalization = doc.createNode('TARUKH_Starship_Normalized')
  .setTranslation([-center.x / height, -bounds.min.y / height, -center.z / height])
  .setScale([1 / height, 1 / height, 1 / height]);
for (const child of [...scene.listChildren()]) {
  scene.removeChild(child);
  normalization.addChild(child);
}
scene.addChild(normalization);

function engineExits(name) {
  const points = worldPoints.get(name);
  assert.ok(points?.length, `Missing source engine part: ${name}`);
  const y = Math.min(...points.map(p => p[1]));
  const rim = points.filter(p => p[1] < y + 2);
  // Cluster the three separated nozzle rims in X/Z. Farthest-point seeding
  // avoids a preference for the supplied vertex ordering.
  let seeds = [rim[0]], clusters = [];
  while (seeds.length < 3) {
    let best = rim[0], score = -1;
    for (const p of rim) {
      const distance = Math.min(...seeds.map(s => (p[0] - s[0]) ** 2 + (p[2] - s[2]) ** 2));
      if (distance > score) {best = p; score = distance;}
    }
    seeds.push(best);
  }
  for (let pass = 0; pass < 30; pass++) {
    clusters = [[], [], []];
    for (const p of rim) {
      let nearest = 0, distance = Infinity;
      for (let i = 0; i < 3; i++) {
        const candidate = (p[0] - seeds[i][0]) ** 2 + (p[2] - seeds[i][2]) ** 2;
        if (candidate < distance) {nearest = i; distance = candidate;}
      }
      clusters[nearest].push(p);
    }
    assert.ok(clusters.every(cluster => cluster.length), 'Each engine must have a measurable nozzle rim.');
    seeds = clusters.map(cluster => cluster.reduce((sum, p) =>
      [sum[0] + p[0] / cluster.length, y, sum[2] + p[2] / cluster.length], [0, y, 0]));
  }
  return clusters.map(points => {
    const xs = points.map(p => p[0]), zs = points.map(p => p[2]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2;
    return {
      position: normalize([x, y, z]),
      radius: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / (2 * height),
      sourceRimVertices: points.length,
    };
  }).sort((a, b) => a.position[0] - b.position[0]);
}

const anchors = {
  seaLevelEngines: engineExits('SeaLev_Raptors_LP.001_Starship_0'),
  vacuumEngines: engineExits('Vacuum_Raptors_LP.001_Starship_0'),
};
const hull = worldPoints.get('Primary_Hull.001_Starship_0');
assert.ok(hull?.length, 'Missing the supplied primary hull.');
const bodyBand = hull.filter(p => {const y = (p[1] - bounds.min.y) / height; return y > .40 && y < .50;});
assert.ok(bodyBand.length, 'The primary hull must contain the measured cylinder band.');
const bodyRadius = Math.max(...bodyBand.map(p => Math.hypot(p[0] - center.x, p[2] - center.z))) / height;
sharp.concurrency(2);
sharp.cache({memory: 64});
await doc.transform(
  textureCompress({encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], slots: /baseColorTexture|emissiveTexture/, quality: 94, effort: 65}),
  textureCompress({encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], slots: /normalTexture|metallicRoughnessTexture/, lossless: true, effort: 65}),
  draco({method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5, quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 16, quantizeGeneric: 12}),
);
const bytes = await io.writeBinary(doc), check = await io.readBinary(bytes);
assert.equal(check.getRoot().listMeshes().length, 8);
assert.equal(check.getRoot().listMaterials().length, 1);
assert.equal(check.getRoot().listTextures().length, 4);
assert.equal(check.getRoot().listAnimations().length, 0);
let checkTriangles = 0;
for (const mesh of check.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  checkTriangles += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
}
assert.equal(checkTriangles, triangles);
assert.deepEqual(check.getRoot().getAsset().extras, sourceJson.asset.extras);
const report = {
  sourceFile: path.basename(source), sourceBytes: raw.length,
  sourceSha256: createHash('sha256').update(raw).digest('hex'), sourceAsset: sourceJson.asset,
  bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
  triangles, parts: partReport, materialCount: 1, textureCount: 4, maxTextureSize: 1024,
  normalized: {
    height: 1,
    min: [-(bounds.max.x - bounds.min.x) / (2 * height), 0, -(bounds.max.z - bounds.min.z) / (2 * height)],
    max: [(bounds.max.x - bounds.min.x) / (2 * height), 1, (bounds.max.z - bounds.min.z) / (2 * height)],
    bodyRadius, anchors,
  },
  adaptation: 'All eight source parts and all triangles retained. Y-up, X/Z centred, feet at Y=0; uniform height=1 for runtime fitting. Four embedded PBR textures resized from 4096 to 1024px WebP; normal and metallic-roughness maps use lossless WebP after resizing. Existing materials and original author/license metadata retained. Draco geometry compression; no new external dependencies at runtime.',
};
assert.equal(createHash('sha256').update(await fs.readFile(source)).digest('hex'), report.sourceSha256);
await fs.mkdir(out, {recursive: true});
await fs.writeFile(path.join(out, 'starship.glb'), bytes);
await fs.writeFile(path.join(out, 'source.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
