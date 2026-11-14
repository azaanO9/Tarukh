import { marsExpeditionHeight } from "./marsExpeditionTerrain.ts";

export type TopoContour = {
  level: number;
  isMajor: boolean;
  path: string;
  kind: "high" | "mid" | "low";
  color: string;
};

export type TopoPoint = {
  x: number;
  y: number;
  height: number;
};

export type TopoData = {
  minHeight: number;
  maxHeight: number;
  centerHeight: number;
  minPoint: TopoPoint;
  maxPoint: TopoPoint;
  contours: TopoContour[];
  hillshadeGradient: { angleDeg: number; contrast: number };
};

/**
 * Generates static Mars ground topography and altimeter contours based on actual surface highs and lows.
 * - Uses fixed, static contour intervals tied to absolute elevation so contour lines remain stable during movement.
 * - Categorizes contours by altimeter tiers: Highs (peaks, rims), Mids (plains), Lows (craters, basins).
 * - Tracks exact spot coordinates of the local High and Low for altimeter spot markers.
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

  const pixelStepX = mapWidth / (cols - 1);
  const pixelStepY = mapHeight / (rows - 1);

  // Sample grid heights and locate local High and Low altimeter extremes
  const grid: number[][] = [];
  let minH = Infinity;
  let maxH = -Infinity;
  let minC = 0;
  let minR = 0;
  let maxC = 0;
  let maxR = 0;

  for (let r = 0; r < rows; r++) {
    const rowH: number[] = [];
    const wz = startZ + r * dz;
    for (let c = 0; c < cols; c++) {
      const wx = startX + c * dx;
      const h = marsExpeditionHeight(wx, wz);
      rowH.push(h);
      if (h < minH) {
        minH = h;
        minC = c;
        minR = r;
      }
      if (h > maxH) {
        maxH = h;
        maxC = c;
        maxR = r;
      }
    }
    grid.push(rowH);
  }

  const centerH = marsExpeditionHeight(centerX, centerZ);
  const diffH = maxH - minH;

  // Static contour step tied to map range to ensure contour lines remain static during exploration
  let baseStep = 1.0;
  if (range <= 50) baseStep = 0.5;
  else if (range <= 140) baseStep = 1.0;
  else if (range <= 260) baseStep = 2.5;
  else baseStep = 5.0;

  // If local elevation span is large, scale by clean integer multiples
  let step = baseStep;
  while (diffH / step > 8) {
    step *= 2;
  }

  const startLevel = Math.ceil(minH / step) * step;
  const endLevel = Math.floor(maxH / step) * step;

  // Marching squares segment collection
  type Segment = [number, number, number, number];
  const contours: TopoContour[] = [];

  const levels: number[] = [];
  for (let l = startLevel; l <= endLevel + 1e-6; l += step) {
    levels.push(Math.round(l * 100) / 100);
  }

  // Limit to at most 8 contour lines to avoid visual clutter (GTA 5 minimalism)
  const activeLevels =
    levels.length > 8
      ? levels.filter((_, idx) => idx % Math.ceil(levels.length / 8) === 0)
      : levels;

  for (const level of activeLevels) {
    const segments: Segment[] = [];

    // Classify contour based on altimeter highs and lows
    const ratio = diffH > 0.2 ? (level - minH) / diffH : 0.5;
    const kind: "high" | "mid" | "low" =
      ratio >= 0.62 ? "high" : ratio <= 0.38 ? "low" : "mid";

    // Static color coding by altimeter level:
    // - Highs: Sunlit Gold / Yellow (#fde047)
    // - Mids: Warm Terracotta / Orange (#fb923c)
    // - Lows: Deep Basin Cyan / Ice Blue (#38bdf8)
    const color =
      kind === "high" ? "#fde047" : kind === "low" ? "#38bdf8" : "#fb923c";

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
      kind,
      color,
    });
  }

  // Calculate terrain slope direction across center for authentic hillshading
  const slopeX =
    (grid[Math.floor(rows / 2)][cols - 1] - grid[Math.floor(rows / 2)][0]) /
    (worldHalfW * 2);
  const slopeZ =
    (grid[rows - 1][Math.floor(cols / 2)] - grid[0][Math.floor(cols / 2)]) /
    (worldHalfH * 2);
  const angleDeg = (Math.atan2(slopeZ, slopeX) * 180) / Math.PI;
  const contrast = Math.min(0.4, Math.hypot(slopeX, slopeZ) * 1.5);

  const minPoint: TopoPoint = {
    x: mapLeft + minC * pixelStepX,
    y: mapTop + minR * pixelStepY,
    height: Math.round(minH * 10) / 10,
  };

  const maxPoint: TopoPoint = {
    x: mapLeft + maxC * pixelStepX,
    y: mapTop + maxR * pixelStepY,
    height: Math.round(maxH * 10) / 10,
  };

  return {
    minHeight: minH,
    maxHeight: maxH,
    centerHeight: centerH,
    minPoint,
    maxPoint,
    contours,
    hillshadeGradient: { angleDeg, contrast },
  };
}
