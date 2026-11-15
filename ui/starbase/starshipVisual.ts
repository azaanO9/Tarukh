import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js';
import {assetUrl} from '../../lib/assetUrl.ts';
import {REUSABLE_ROCKET} from '../../game/reusableRocket.ts';
import {STARBASE} from '../../game/starbaseRig.ts';
import type {createStarbase} from './createStarbase.ts';

// Measured nozzle rims in the height-one derivative; see models/starship/source.json.
export const STARSHIP_NOZZLES = [
  [-.0490928273, .0030514717, -.0320425282],
  [0, .0030514717, .0529887508],
  [.0490928279, .0030514717, -.0320425058],
  [-.0161970711, .0028986490, .0056526228],
  [0, .0028986490, -.0224015209],
  [.0161970614, .0028986490, .0056526149],
] as const;
export const STARSHIP_BODY_RADIUS = .0859907239;
type Rig = ReturnType<typeof createStarbase>;
export type StarshipModelLoader = () => Promise<T.Group | null>;

async function loadModel(): Promise<T.Group | null> {
  if (typeof document === 'undefined') return null;
  const decoder = new DRACOLoader();
  decoder.setDecoderPath(assetUrl('/draco/'));decoder.setWorkerLimit(1);
  try {
    return (await new GLTFLoader().setDRACOLoader(decoder).loadAsync(assetUrl('/models/starship/starship.glb'))).scene;
  } finally {
    decoder.dispose();
  }
}

function disposeModel(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  const bitmaps = new Set<ImageBitmap>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    if (typeof texture.image?.close === 'function') bitmaps.add(texture.image);
    texture.dispose();
  }
  for (const bitmap of bitmaps) bitmap.close();
  for (const geometry of geometries) geometry.dispose();
  root.removeFromParent();
}

/** Replace only the visual shell; flight state, engine pivots and tower articulation stay owned by the rig. */
export function createStarshipVisual(rig: Rig, load: StarshipModelLoader = loadModel) {
  let disposed = false;
  let imported: T.Group | null = null;
  let status: 'loading' | 'loaded' | 'fallback' | 'disposed' = 'loading';
  const ready = Promise.resolve().then(load).then(model => {
    if (!model) { if (!disposed) status = 'fallback'; return; }
    if (disposed) { disposeModel(model); return; }
    imported = new T.Group();imported.name = 'Imported Starship';
    imported.add(model);
    const bounds = new T.Box3().setFromObject(model);
    if (Math.abs(bounds.max.y - bounds.min.y - 1) > .001 || Math.abs(bounds.min.y) > .001) {
      throw new Error('Starship asset must use the prepared height-one coordinates.');
    }
    model.scale.setScalar(REUSABLE_ROCKET.height);
    model.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.castShadow = object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value instanceof T.Texture) value.anisotropy = 4;
      }
    });

    // Small fictional docking adapters meet the existing catch rails without stretching the supplied hull.
    const bodyRadius = STARSHIP_BODY_RADIUS * REUSABLE_ROCKET.height;
    const adapterMaterial = new T.MeshStandardMaterial({color: '#aeb8c0', metalness: .85, roughness: .32});
    const pinLength = STARBASE.pinZ - bodyRadius + .825;
    const pinGeometry = new T.CylinderGeometry(STARBASE.pinRadius, STARBASE.pinRadius, pinLength, 16);
    for (const side of [-1, 1]) {
      const pin = new T.Mesh(pinGeometry, adapterMaterial);
      pin.name = `Starship catch adapter ${side}`;
      pin.rotation.x = Math.PI / 2;
      pin.position.set(0, REUSABLE_ROCKET.pinHeight, side * (bodyRadius + pinLength / 2));
      imported.add(pin);
    }
    rig.starshipUpperStage.add(imported);
    // Present the windowed stainless side to the existing cinematic cameras.
    // Rotate the whole stage so its measured engine exits and plumes stay together.
    rig.starshipUpperStage.rotation.y = Math.PI;
    const fallback = rig.starshipUpperStage.getObjectByName('reusableCrewVehicle');
    if (fallback) fallback.visible = false;

    // The file includes its own six Raptors. Keep the existing animated exhaust, not duplicate engine meshes.
    const engines = rig.shipEngines;
    engines.root.traverse(object => {
      if (object instanceof T.Mesh && object !== engines.flame && object !== engines.core) object.visible = false;
    });
    const engineScale = bodyRadius / STARBASE.radius;
    engines.root.scale.setScalar(engineScale);
    STARSHIP_NOZZLES.forEach((point, index) => {
      const x = point[0] * REUSABLE_ROCKET.height / engineScale;
      const y = point[1] * REUSABLE_ROCKET.height / engineScale;
      const z = point[2] * REUSABLE_ROCKET.height / engineScale;
      engines.centres[index].set(x, y, z);
      engines.active[index].position.set(x, y + 3.65, z);
    });
    status = 'loaded';
  }).catch(() => {
    // A missing or unsupported model must not prevent exploring Mars.
    if (imported) { disposeModel(imported); imported = null; }
    if (!disposed) status = 'fallback';
  });
  return {
    ready,
    get status() { return status; },
    dispose() {
      if (disposed) return;
      disposed = true;status = 'disposed';
      if (imported) { disposeModel(imported); imported = null; }
    },
  };
}
