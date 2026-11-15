import * as T from 'three';

/** Split a sampled plane without changing its triangles or shared-edge normals. */
export function terrainPatches(source: T.PlaneGeometry, columns: number, rows: number) {
  const width = source.parameters.widthSegments, depth = source.parameters.heightSegments;
  if (width % columns || depth % rows) throw new Error('Terrain patches must divide the source grid');
  const patchWidth = width / columns, patchDepth = depth / rows;
  const patches: T.BufferGeometry[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const patch = new T.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const size = attribute.itemSize;
      const data = new Float32Array((patchWidth + 1) * (patchDepth + 1) * size);
      const values = attribute.array as Float32Array;
      for (let z = 0; z <= patchDepth; z++) {
        const start = ((row * patchDepth + z) * (width + 1) + column * patchWidth) * size;
        data.set(values.subarray(start, start + (patchWidth + 1) * size), z * (patchWidth + 1) * size);
      }
      patch.setAttribute(name, new T.BufferAttribute(data, size, attribute.normalized));
    }
    const indices = new Uint16Array(patchWidth * patchDepth * 6);
    let offset = 0;
    for (let z = 0; z < patchDepth; z++) for (let x = 0; x < patchWidth; x++) {
      const a = z * (patchWidth + 1) + x, b = a + patchWidth + 1;
      indices[offset++] = a; indices[offset++] = b; indices[offset++] = a + 1;
      indices[offset++] = b; indices[offset++] = b + 1; indices[offset++] = a + 1;
    }
    patch.setIndex(new T.BufferAttribute(indices, 1));
    patch.computeBoundingBox(); patch.computeBoundingSphere();
    patches.push(patch);
  }
  return patches;
}
