import * as T from 'three';
import assert from 'node:assert/strict';

const apertureHeight = 2.22;
const shellDepth = .215;
const faceDepth = .225;

function canopyProfile() {
  const points = [[-1.52, -.035]];
  for (let i = 0; i <= 24; i++) {
    const angle = Math.PI - i * Math.PI / 24;
    points.push([1.52 * Math.cos(angle), 1.55 + 1.34 * Math.sin(angle)]);
  }
  points.push([1.52, -.035]);
  return points;
}

const linerProfile = [
  [-1.02, -.035], [-1.42, .405], [-1.42, 1.71], [-.59, 2.54],
  [.59, 2.54], [1.42, 1.71], [1.42, .405], [1.02, -.035],
];

function collarPolygon(profile, halfWidth) {
  return [...profile, [halfWidth, -.035], [halfWidth, apertureHeight],
    [-halfWidth, apertureHeight], [-halfWidth, -.035]];
}

/** An open-bottom collar leaves the original threshold and lift envelope intact. */
export function createPressureCollar(door) {
  assert.equal(door.halfWidth, .875, 'Internal pressure collar expects the authored gate width');
  assert.equal(Math.hypot(...door.normal), 1, 'Gate normal must be unit length');
  const halfWidth = door.halfWidth + .02;
  const nx = door.normal[0], nz = -door.normal[1], tx = -nz, tz = nx;
  const [cx, cy, floor] = door.position;

  function build(profile, depth, edges) {
    const polygon = collarPolygon(profile, halfWidth);
    const triangles = T.ShapeUtils.triangulateShape(polygon.map(([x, y]) => new T.Vector2(x, y)), []);
    const position = [], normal = [], uv = [], indices = [];
    function vertex(x, y, z, ax, ay, az) {
      const index = position.length / 3;
      position.push(cx + tx * x + nx * z, floor + y, -cy + tz * x + nz * z);
      normal.push(tx * ax + nx * az, ay, tz * ax + nz * az);
      uv.push(x, y);
      return index;
    }
    for (const side of [-1, 1]) {
      const start = position.length / 3;
      for (const [x, y] of polygon) vertex(x, y, side * depth, 0, 0, side);
      for (const triangle of triangles) {
        const [a, b, c] = triangle;
        const pa = polygon[a], pb = polygon[b], pc = polygon[c];
        const orientation = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
        // Lateral/up/outward uses a reflected basis in glTF's Y-up coordinates.
        indices.push(start + a, start + (orientation * side < 0 ? b : c), start + (orientation * side < 0 ? c : b));
      }
    }
    if (edges) {
      // White perimeter returns meet the canopy. The aperture's upper edge
      // stays open in depth so the animated leaf can enter its existing pocket.
      for (let i = 0; i < profile.length - 1; i++) {
        const [ax, ay] = profile[i], [bx, by] = profile[i + 1];
        const length = Math.hypot(bx - ax, by - ay), ux = -(by - ay) / length, uy = (bx - ax) / length;
        const a = vertex(ax, ay, -depth, ux, uy, 0), b = vertex(bx, by, -depth, ux, uy, 0);
        const c = vertex(bx, by, depth, ux, uy, 0), d = vertex(ax, ay, depth, ux, uy, 0);
        indices.push(a, b, c, a, c, d);
      }
    }
    return {position: new Float32Array(position), normal: new Float32Array(normal),
      uv: new Float32Array(uv), indices: new Uint16Array(indices)};
  }
  return {shell: build(canopyProfile(), shellDepth, true), interior: build(linerProfile, faceDepth, false)};
}

/** Clip only the front arc hidden behind the observatory gate's existing jambs. */
export function crossesObservatoryAperture(vertices, door) {
  const nx = door.normal[0], nz = -door.normal[1], tx = -nz, tz = nx;
  return vertices.some(([x, y, z]) => {
    const dx = x - door.position[0], dz = z + door.position[1];
    const lateral = dx * tx + dz * tz, depth = dx * nx + dz * nz;
    const height = y - door.position[2];
    return Math.abs(lateral) < door.halfWidth + .25 && depth > -.1 && depth < .8
      && height > -.05 && height < 2.23;
  });
}

/** Repair the game derivative before batching; the reviewed v9 source is never written. */
export function repairOutpost(doc, doors) {
  const root = doc.getRoot(), scene = root.listScenes()[0], buffer = root.listBuffers()[0];
  const animationCount = root.listAnimations().length;
  const observatory = doors.find(door => door.id === 'observatory_dome');
  const trim = root.listNodes().find(node => node.getName() === '05 / glazing mullions');
  if (!observatory || !trim?.getMesh()) throw new Error('Expected observatory doorway trim is missing');
  const matrix = new T.Matrix4().fromArray(trim.getWorldMatrix()), point = new T.Vector3();
  let removedTriangles = 0, retainedTriangles = 0;
  for (const primitive of trim.getMesh().listPrimitives()) {
    const attribute = primitive.getAttribute('POSITION'), index = primitive.getIndices();
    const kept = [], vertices = [[], [], []], world = [[], [], []];
    const count = index?.getCount() ?? attribute.getCount();
    for (let offset = 0; offset < count; offset += 3) {
      const corners = [0, 1, 2].map(i => index ? index.getScalar(offset + i) : offset + i);
      for (let i = 0; i < 3; i++) {
        attribute.getElement(corners[i], vertices[i]);
        point.fromArray(vertices[i]).applyMatrix4(matrix).toArray(world[i]);
      }
      if (crossesObservatoryAperture(world, observatory)) removedTriangles++;
      else { kept.push(...corners); retainedTriangles++; }
    }
    primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(kept)).setBuffer(buffer));
  }
  if (!removedTriangles) throw new Error('Observatory aperture repair did not find its crossing trim');
  assert.ok(retainedTriangles > removedTriangles, 'Doorway trim repair must preserve the rest of the observatory');
  const white = root.listMaterials().find(material => material.getName() === 'V7 / white ceramic thermal paint');
  const slate = root.listMaterials().find(material => material.getName() === 'V8 / slate');
  if (!white || !slate) throw new Error('Outpost pressure-collar materials are missing');
  let collars = 0;
  for (const door of doors) {
    if (door.id === 'entrance') continue;
    const geometry = createPressureCollar(door);
    for (const [kind, material] of [['shell', white], ['interior', slate]]) {
      const data = geometry[kind];
      const primitive = doc.createPrimitive().setMaterial(material)
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(data.position).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(data.normal).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(data.uv).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(data.indices).setBuffer(buffer));
      // Interior classification is deliberately separate from the white shell:
      // local room lighting must never reach externally exposed collar edges.
      const name = (kind === 'interior' ? 'V8 / INNER BULKHEADS / ' : 'LINK / sealed pressure collar / ') + door.id;
      scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(primitive)));
    }
    collars++;
  }
  assert.equal(collars, 10, 'All ten internal gates require a sealed collar');
  assert.equal(root.listAnimations().length, animationCount, 'Pressure-collar repairs must not alter door animations');
  return {removedTriangles, collars};
}
