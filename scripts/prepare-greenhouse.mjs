/** Offline derivative of the supplied greenhouse. Uses the same optional local
 * glTF-Transform 4.2.1, Meshoptimizer 0.22 and Sharp tools as prepare-outpost.mjs.
 * node scripts/prepare-greenhouse.mjs <source-file> [tool-dir] [sharp-module-dir]
 * Originals are read only. No source models are downloaded during play.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';

const source = process.argv[2] ?? 'C:/Users/azaan/Downloads/Greenhouse_enclosed';
const require = createRequire(path.resolve(process.argv[3] ?? 'outputs/garage-v1/tools', 'package.json'));
const {NodeIO} = require('@gltf-transform/core');
const {ALL_EXTENSIONS} = require('@gltf-transform/extensions');
const {dedup, join, meshopt, prune, textureCompress, weld} = require('@gltf-transform/functions');
const {MeshoptEncoder, MeshoptDecoder} = require('meshoptimizer');
const sharp = require(path.resolve(process.argv[4] ?? 'node_modules/.pnpm/sharp@0.35.5_@types+node@22.19.19/node_modules/sharp'));
sharp.concurrency(2);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const raw = await fs.readFile(source), doc = await io.readBinary(raw), root = doc.getRoot(), scene = root.listScenes()[0];
const dest = 'public/models/greenhouse';
await fs.mkdir(dest, {recursive: true});
await fs.mkdir('outputs/greenhouse-integration', {recursive: true});
const originalNodes = [...root.listNodes()];
const transforms = new Map(originalNodes.map(n => [n, n.getWorldMatrix()]));
const sections = new Map();
const doorDefinitions = [];
const colliders = [];
let deckOutline = [], triangles = 0, removedGroundObjects = 0;
const point = new T.Vector3();

function convexHull(points) {
  const sorted = [...new Map(points.map(p => [p[0].toFixed(4) + ',' + p[1].toFixed(4), p])).values()].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const lower = [], upper = [];
  for (const p of sorted) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= .0001) lower.pop(); lower.push(p); }
  for (const p of sorted.reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= .0001) upper.pop(); upper.push(p); }
  return lower.slice(0,-1).concat(upper.slice(0,-1)).map(p => p.map(v => +v.toFixed(4)));
}

for (const node of originalNodes) {
  if (/^(MARS \/|Basalt \/|Terrain \/|Ground \/)/i.test(node.getName())) { node.dispose(); removedGroundObjects++; continue; }
  // Keep the authored emissive fixtures; six copies of seven real-time lights
  // would otherwise add 42 lights to every material in the Mars scene.
  node.setExtension('KHR_lights_punctual', null);
  const mesh = node.getMesh();
  if (!mesh) continue;
  const name = node.getName(), matrix = new T.Matrix4().fromArray(transforms.get(node));
  const leaf = /Lock (3|5) \/ sliding door - (left|right)/.exec(name);
  const part = leaf ? `door-${leaf[1] === '3' ? 'main' : 'service'}-${leaf[2]}`
    : /^(Hull \/|Roof \/|Dock \/|Deck \/ ceramic|Deck \/ external)/.test(name) ? 'shell' : 'interior';
  if (!sections.has(part)) {
    const extras = {greenhousePart: part};
    if (leaf) {
      const parentMatrix = new T.Matrix4().fromArray(transforms.get(node.getParentNode()));
      const travel = new T.Vector3(node.getExtras().openOffsetLocalXMetres, 0, 0).transformDirection(parentMatrix).multiplyScalar(.985);
      extras.travel = travel.toArray();
      extras.door = leaf[1] === '3' ? 'main' : 'service';
    }
    const group = doc.createNode('GREENHOUSE / ' + part).setExtras(extras);
    scene.addChild(group); sections.set(part, group);
  }
  if (/^Dock \/ (transfer|service) airlock$/.test(name)) {
    const normal = new T.Vector3(0,0,-1).transformDirection(matrix);
    const centre = new T.Vector3(0,.03,-.048).applyMatrix4(matrix);
    doorDefinitions.push({id: name.includes('transfer') ? 'main' : 'service', label: name.includes('transfer') ? 'Main airlock' : 'Service airlock', x: centre.x, z: centre.z, nx: normal.x, nz: normal.z, halfWidth: .89, halfDepth: .16, travel: .985});
  }
  const points = [];
  for (const primitive of mesh.listPrimitives()) {
    const positions = primitive.getAttribute('POSITION');
    triangles += (primitive.getIndices()?.getCount() ?? positions.getCount()) / 3;
    for (let i = 0; i < positions.getCount(); i++) {
      point.fromArray(positions.getElement(i, [])).applyMatrix4(matrix);
      points.push([point.x, point.z]);
    }
  }
  if (name.startsWith('Deck / ceramic')) deckOutline = convexHull(points);
  if (/^(Trough |Vessel |Propagation rack|Locker case|05 \/ Botanical|Wash |Feed header)/.test(name)) colliders.push({name, hull: convexHull(points)});
  node.getParentNode()?.removeChild(node); scene.removeChild(node);
  sections.get(part).addChild(node); node.setMatrix(transforms.get(node));
}
root.listExtensionsUsed().find(e => e.extensionName === 'KHR_lights_punctual')?.dispose();
assert.equal(doorDefinitions.length, 2);
assert.ok(deckOutline.length >= 6);
// Hull construction is regular hexagonal. Keep two clear door apertures and
// use oriented wall rectangles instead of hundreds of stair-stepped grid cells.
const walls = [], radius = 4.48, halfSide = 2.59, opening = 1.02;
for (let i = 0; i < 6; i++) {
  const yaw = i * Math.PI / 3, nx = Math.sin(yaw), nz = Math.cos(yaw);
  const spans = i === 0 || i === 4 ? [[-(halfSide+opening)/2, (halfSide-opening)/2],[(halfSide+opening)/2, (halfSide-opening)/2]] : [[0,halfSide]];
  for (const [along, halfWidth] of spans) walls.push([nx*radius+nz*along,nz*radius-nx*along,halfWidth,.22,yaw]);
}
const layout = {version: 1, deckHeight: .0275, deckOutline, walls, furniture: colliders, doors: doorDefinitions, ramp: {start:.12,length:2.4,halfWidth:1.02}};
await fs.writeFile(dest+'/layout.json', JSON.stringify(layout));
await doc.transform(weld(),dedup(),join({filter: n => [...sections.values()].includes(n.getParentNode()),cleanup:false}),prune({keepLeaves:false,keepAttributes:true}));
await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:90,effort:65}));
await doc.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeTexcoord:14}));
await io.write(dest+'/cultivation.glb',doc);
const encoded = await fs.readFile(dest+'/cultivation.glb');
const report = {source:path.basename(source),sourceSha256:createHash('sha256').update(raw).digest('hex'),sourceBytes:raw.length,bytes:encoded.length,sha256:createHash('sha256').update(encoded).digest('hex'),triangles,sections:sections.size,materials:root.listMaterials().length,textures:root.listTextures().length,removedGroundObjects,doors:doorDefinitions,wallProxies:walls.length,furnitureProxies:colliders.length};
await fs.writeFile('outputs/greenhouse-integration/asset-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
