import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '../../lib/assetUrl.ts';
import { GREENHOUSE_SITES } from '../../game/greenhouseSites.ts';
import { GREENHOUSE_GROUND_HEIGHTS } from '../../game/marsExpeditionTerrain.ts';
import { boxObstacle, type CollisionObstacle } from '../../game/collision.ts';

export type SolarPanelAsset = {
  geometry: T.BufferGeometry;
  material: T.Material;
  textures: T.Texture[];
};

export type GreenhouseSolarResult = {
  mesh: T.InstancedMesh;
  cameraBoxes: { obstacle: CollisionObstacle; inverse: T.Matrix4; box: T.Box3 }[];
};

let cachedAssetPromise: Promise<SolarPanelAsset> | null = null;

/**
 * Loads and caches the standalone 2K solar panel model.
 * Bakes source hierarchy transforms, normalizes dimensions to meters (scale 0.02),
 * and centers the stand feet flush to ground y = 0.
 * Preserves full 2048x2048 texture quality with anisotropic filtering.
 */
export function loadSolarPanelAsset(): Promise<SolarPanelAsset> {
  if (cachedAssetPromise) return cachedAssetPromise;

  const loader = new GLTFLoader();
  cachedAssetPromise = loader.loadAsync(assetUrl('/models/solar-panel/solar-panel.glb')).then(gltf => {
    gltf.scene.updateMatrixWorld(true);
    const sourceMesh = gltf.scene.getObjectByName('SolarPanel_SolarPanel_0');
    if (!(sourceMesh instanceof T.Mesh)) {
      throw new Error('SolarPanel_SolarPanel_0 mesh missing from solar-panel.glb');
    }

    const geometry = sourceMesh.geometry.clone();
    geometry.applyMatrix4(sourceMesh.matrixWorld);

    // Stand feet lowest vertex is at y = 10.215252 cm, stand center is at z = 7.542927 cm
    geometry.translate(0, -10.215252, -7.542927);
    // Scale 0.02 converts cm to meters (165.26cm -> 3.305m width, 65.13cm -> 1.303m height, 66.43cm -> 1.329m depth)
    geometry.scale(0.02, 0.02, 0.02);

    if (geometry.attributes.tangent) {
      const normalMatrix = new T.Matrix3().getNormalMatrix(sourceMesh.matrixWorld);
      const tangentAttr = geometry.attributes.tangent;
      const t = new T.Vector3();
      for (let i = 0; i < tangentAttr.count; i++) {
        t.set(tangentAttr.getX(i), tangentAttr.getY(i), tangentAttr.getZ(i));
        t.applyMatrix3(normalMatrix).normalize();
        tangentAttr.setXYZ(i, t.x, t.y, t.z);
      }
      tangentAttr.needsUpdate = true;
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // Preserve 2K PBR materials and textures
    const material = (Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material).clone() as T.MeshPhysicalMaterial;
    material.roughness = 0.35;
    material.metalness = 0.85;
    material.envMapIntensity = 1.0;

    const textures: T.Texture[] = [];
    for (const val of Object.values(material)) {
      if (val instanceof T.Texture) {
        val.anisotropy = 8;
        val.minFilter = T.LinearMipmapLinearFilter;
        val.magFilter = T.LinearFilter;
        val.generateMipmaps = true;
        val.needsUpdate = true;
        textures.push(val);
      }
    }
    material.needsUpdate = true;

    return { geometry, material, textures };
  });

  return cachedAssetPromise;
}

/** Outpost solar array positions relative to OUTPOST_SITE.
 * Standing directly on the foundation ground level (y = 0.0) on the 3D model's own stand feet.
 */
export const OUTPOST_SOLAR_ARRAY_SLOTS = [
  // Front row (z = 12.88)
  { x: -18.0, y: 0.0, z: 12.88 },
  { x: -14.4, y: 0.0, z: 12.88 },
  { x: -10.8, y: 0.0, z: 12.88 },
  { x: -7.2, y: 0.0, z: 12.88 },
  // Rear row (z = 15.92)
  { x: -18.0, y: 0.0, z: 15.92 },
  { x: -14.4, y: 0.0, z: 15.92 },
  { x: -10.8, y: 0.0, z: 15.92 },
  { x: -7.2, y: 0.0, z: 15.92 },
] as const;

/**
 * Creates the 8-unit photovoltaic array replacing the legacy low-res meshes at the Elysium Outpost.
 * Accurately aligns with existing foundation heights and collision obstacles.
 */
export function createOutpostSolarMesh(asset: SolarPanelAsset): T.InstancedMesh {
  const mesh = new T.InstancedMesh(asset.geometry, asset.material, OUTPOST_SOLAR_ARRAY_SLOTS.length);
  mesh.name = 'Outpost / 2K solar array';
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const matrix = new T.Matrix4();
  for (let i = 0; i < OUTPOST_SOLAR_ARRAY_SLOTS.length; i++) {
    const slot = OUTPOST_SOLAR_ARRAY_SLOTS[i];
    matrix.setPosition(slot.x, slot.y, slot.z);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Creates 2 dedicated solar panels near the rear of each greenhouse on their level foundation pads,
 * oriented outward towards open Martian sky away from entrance doors and ramps.
 */
export function createGreenhouseSolarMesh(asset: SolarPanelAsset, obstacles: CollisionObstacle[]): GreenhouseSolarResult {
  const panelsPerGreenhouse = 2;
  const totalPanels = GREENHOUSE_SITES.length * panelsPerGreenhouse;
  const mesh = new T.InstancedMesh(asset.geometry, asset.material, totalPanels);
  mesh.name = 'Cultivation / 2K solar arrays';
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const cameraBoxes: { obstacle: CollisionObstacle; inverse: T.Matrix4; box: T.Box3 }[] = [];
  const matrix = new T.Matrix4();
  const localOffsets = [
    { lx: -2.0, lz: -9.2 },
    { lx: 2.0, lz: -9.2 },
  ];

  let index = 0;
  for (let i = 0; i < GREENHOUSE_SITES.length; i++) {
    const site = GREENHOUSE_SITES[i];
    const groundY = GREENHOUSE_GROUND_HEIGHTS[i];
    const cos = Math.cos(site.yaw);
    const sin = Math.sin(site.yaw);
    const panelYaw = site.yaw + Math.PI; // Face outward away from dome

    for (let p = 0; p < localOffsets.length; p++) {
      const { lx, lz } = localOffsets[p];
      const wx = site.x + lx * cos + lz * sin;
      const wz = site.z - lx * sin + lz * cos;

      matrix.makeRotationY(panelYaw).setPosition(wx, groundY, wz);
      mesh.setMatrixAt(index, matrix);

      // Add collision obstacle matching the 3.3m x 1.33m panel
      const obstacle = boxObstacle(wx, wz, 1.65, 0.66, `greenhouse-solar-${site.id}-${p + 1}`, panelYaw);
      obstacles.push(obstacle);

      const inverse = new T.Matrix4().makeRotationY(panelYaw).setPosition(wx, groundY, wz).invert();
      cameraBoxes.push({
        obstacle,
        inverse,
        box: new T.Box3(new T.Vector3(-1.65, 0, -0.66), new T.Vector3(1.65, 1.35, 0.66)),
      });

      index++;
    }
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return { mesh, cameraBoxes };
}
