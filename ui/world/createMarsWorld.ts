import * as T from "three";
import { createMarsTerrain } from "./marsTerrain";
import type { MarsSurfaceTextures } from "./marsSurfaceTextures";

export function createMarsWorld(scene: T.Scene, surface?: MarsSurfaceTextures, lightTracks = false) {
  const root = new T.Group();
  scene.add(root);
  const terrain = createMarsTerrain(root, surface, lightTracks, true);
  return { root, ...terrain, targets: [] as T.Group[] };
}
