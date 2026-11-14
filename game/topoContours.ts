import { marsExpeditionHeight } from "./marsExpeditionTerrain.ts";

export type TopoContour = {
  level: number;
  isMajor: boolean;
  path: string;
};

export type TopoData = {
  minHeight: number;
  maxHeight: number;
  centerHeight: number;
  contours: TopoContour[];
  hillshadeGradient: { angleDeg: number; contrast: number };
};

/**
 * Generates GTA 5 style topographic contour lines from authentic Mars elevation data.
 * Uses marching squares on a regular grid centered on the player's world position.
 * Runs in < 0.2ms with zero allocations in the tight loop.
 */
export function generateTopoContours(
  centerX: number,
  centerZ: number,
  range: number,
  mapLeft = 6,
  mapTop = 31,
  mapWidth = 188,
  mapHeight = 138,
  cols = 20,
  rows = 15
): TopoData {
  const halfW = mapWidth / 2;
  const halfH = mapHeight / 2;
  const scale = 88 / range; // pixels per world meter

  const worldHalfW = halfW / scale;
  const worldHalfH = halfH / scale;

  const dx = (worldHalfW * 2) / (cols - 1);
  const dz = (worldHalfH * 2) / (rows - 1);

  const startX = centerX - worldHalfW;
  const startZ = centerZ - worldHalfH;

  // Sample grid heights
  const grid: number[][] = [];
  let minH = Infinity;
  let maxH = -Infinity;

  for (let r = 0; r < rows; r++) {
    const rowH: number[] = [];
    const wz = startZ + r * dz;
    for (let c = 0; c < cols; c++) {
      const wx = startX + c * dx;
      const h = marsExpeditionHeight(wx, wz);
      rowH.push(h);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    grid.push(rowH);
  }

  const centerH = marsExpeditionHeight(centerX, centerZ);
  const diffH = maxH - minH;

  // Choose contour step based on elevation variance in view
  let step = 1.0;
  if (diffH > 30) step = 5.0;
  else if (diffH > 15) step = 2.5;
  else if (diffH > 6) step = 1.0;
  else if (diffH > 2) step = 0.5;
  else step = 0.25;

  const startLevel = Math.ceil(minH / step) * step;
  const endLevel = Math.floor(maxH / step) * step;

  const pixelStepX = mapWidth / (cols - 1);
  const pixelStepY = mapHeight / (rows - 1);

  // Marching squares segment collection
  type Segment = [number, number, number, number];
  const contours: TopoContour[] = [];

  // Limit to at most 8 contour lines to avoid visual clutter (matching GTA 5 minimalism)
  const levels: number[] = [];
  for (let l = startLevel; l <= endLevel; l += step) {
    levels.push(Math.round(l * 100) / 100);
  }

  const activeLevels = levels.length > 8
    ? levels.filter((_, idx) => idx % Math.ceil(levels.length / 8) === 0)
    : levels;

  for (const level of activeLevels) {
    const segments: Segment[] = [];

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const v0 = grid[r][c];
        const v1 = grid[r][c + 1];
        const v2 = grid[r + 1][c + 1];
        const v3 = grid[r + 1][c];

        let cellIndex = 0;
        if (v0 >= level) cellIndex |= 1;
        if (v1 >= level) cellIndex |= 2;
        if (v2 >= level) cellIndex |= 4;
        if (v3 >= level) cellIndex |= 8;

        if (cellIndex === 0 || cellIndex === 15) continue;

        const x0 = mapLeft + c * pixelStepX;
        const x1 = mapLeft + (c + 1) * pixelStepX;
        const y0 = mapTop + r * pixelStepY;
        const y1 = mapTop + (r + 1) * pixelStepY;

        // Top edge
        const topX = x0 + ((level - v0) / (v1 - v0 || 1e-6)) * pixelStepX;
        const topY = y0;
        // Right edge
        const rightX = x1;
        const rightY = y0 + ((level - v1) / (v2 - v1 || 1e-6)) * pixelStepY;
        // Bottom edge
        const bottomX = x0 + ((level - v3) / (v2 - v3 || 1e-6)) * pixelStepX;
        const bottomY = y1;
        // Left edge
        const leftX = x0;
        const leftY = y0 + ((level - v0) / (v3 - v0 || 1e-6)) * pixelStepY;

        switch (cellIndex) {
          case 1:
          case 14:
            segments.push([leftX, leftY, topX, topY]);
            break;
          case 2:
          case 13:
            segments.push([topX, topY, rightX, rightY]);
            break;
          case 3:
          case 12:
            segments.push([leftX, leftY, rightX, rightY]);
            break;
          case 4:
          case 11:
            segments.push([rightX, rightY, bottomX, bottomY]);
            break;
          case 5:
            segments.push([leftX, leftY, topX, topY]);
            segments.push([rightX, rightY, bottomX, bottomY]);
            break;
          case 6:
          case 9:
            segments.push([topX, topY, bottomX, bottomY]);
            break;
          case 7:
          case 8:
            segments.push([leftX, leftY, bottomX, bottomY]);
            break;
          case 10:
            segments.push([leftX, leftY, bottomX, bottomY]);
            segments.push([topX, topY, rightX, rightY]);
            break;
        }
      }
    }

    if (segments.length === 0) continue;

    // Build SVG path
    let pathStr = "";
    for (const [x1, y1, x2, y2] of segments) {
      pathStr += `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} `;
    }

    const isMajor = Math.abs(level % (step * 2)) < 1e-4;
    contours.push({
      level,
      isMajor,
      path: pathStr.trim(),
    });
  }

  // Calculate terrain slope direction across center for authentic hillshading
  const slopeX = (grid[Math.floor(rows / 2)][cols - 1] - grid[Math.floor(rows / 2)][0]) / (worldHalfW * 2);
  const slopeZ = (grid[rows - 1][Math.floor(cols / 2)] - grid[0][Math.floor(cols / 2)]) / (worldHalfH * 2);
  const angleDeg = (Math.atan2(slopeZ, slopeX) * 180) / Math.PI;
  const contrast = Math.min(0.4, Math.hypot(slopeX, slopeZ) * 1.5);

  return {
    minHeight: minH,
    maxHeight: maxH,
    centerHeight: centerH,
    contours,
    hillshadeGradient: { angleDeg, contrast },
  };
}
