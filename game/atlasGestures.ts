import type {AtlasBounds} from './marsAtlas.ts';

export const ATLAS_MAX_ZOOM = 8;
export const ATLAS_DRAG_THRESHOLD = 8;

/** Keep the surveyed crop in view while zooming around the gesture midpoint. */
export function moveAtlas(bounds: AtlasBounds, region: AtlasBounds, dx: number, dz: number, scale = 1, anchorX = .5, anchorZ = .5): AtlasBounds {
  const regionWidth = region.east-region.west, regionHeight = region.south-region.north;
  const oldWidth = bounds.east-bounds.west, oldHeight = bounds.south-bounds.north;
  const aspect = oldWidth/oldHeight;
  const fullWidth = Math.min(regionWidth,regionHeight*aspect);
  const zoom = Math.max(1, Math.min(ATLAS_MAX_ZOOM, fullWidth/oldWidth * (Number.isFinite(scale) ? scale : 1)));
  const width = fullWidth/zoom, height = width/aspect;
  const west = Math.max(region.west, Math.min(region.east-width, bounds.west+oldWidth*anchorX-width*anchorX+dx));
  const north = Math.max(region.north, Math.min(region.south-height, bounds.north+oldHeight*anchorZ-height*anchorZ+dz));
  return {west,east:west+width,north,south:north+height};
}
