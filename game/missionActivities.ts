/** Bounded, deterministic evidence for the station activities. Nothing here advances time. */
export const WIRE_TERMINALS = [
  { id: 'A', label: 'Power', color: '#f6bd60', shape: 'square' },
  { id: 'B', label: 'Return', color: '#7fc8f8', shape: 'circle' },
  { id: 'C', label: 'Control', color: '#c9a8ff', shape: 'triangle' },
  { id: 'D', label: 'Sensor', color: '#f4f1de', shape: 'diamond' },
] as const;

export type WireConnection = { from: string; to: string };
export type WireRepairProof = { kind: 'wire-repair'; isolated: boolean; connections: WireConnection[] };
export type BrushPoint = { x: number; y: number };
export type PanelCleaningProof = { kind: 'panel-cleaning'; strokes: BrushPoint[][] };
export type ActivityProof = WireRepairProof | PanelCleaningProof;
export const ACTIVITY_TASK_IDS = ['solar-connect', 'solar-clean', 'clear-panels'] as const;
export type ActivityTaskId = typeof ACTIVITY_TASK_IDS[number];

export const SOLAR_BRUSH = {
  columns: 24, rows: 12, aspectRatio: 2, radius: 0.12,
  requiredCoverage: 0.85, requiredQuadrantCoverage: 0.7,
  maxStrokes: 128, maxPoints: 8192,
} as const;

export type BrushCoverage = {
  cells: boolean[];
  cleaned: number;
  total: number;
  ratio: number;
  quadrants: number[];
  complete: boolean;
};

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const terminal = (value: unknown): value is string =>
  typeof value === 'string' && WIRE_TERMINALS.some(item => item.id === value);
const point = (value: unknown): value is BrushPoint => record(value)
  && typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
  && typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1;

export function isActivityTaskId(taskId: unknown): taskId is ActivityTaskId {
  return typeof taskId === 'string' && (ACTIVITY_TASK_IDS as readonly string[]).includes(taskId);
}

function validWireProof(value: unknown): value is WireRepairProof {
  if (!record(value) || value.kind !== 'wire-repair' || typeof value.isolated !== 'boolean'
    || !Array.isArray(value.connections) || value.connections.length > WIRE_TERMINALS.length) return false;
  const sources = new Set<string>(), targets = new Set<string>();
  for (const link of value.connections) {
    if (!record(link) || !terminal(link.from) || !terminal(link.to)
      || sources.has(link.from) || targets.has(link.to)) return false;
    sources.add(link.from);
    targets.add(link.to);
  }
  return true;
}

/** Incorrect pairs can be shown for correction; energized or duplicate links are rejected. */
export function connectWire(proof: WireRepairProof, from: string, to: string): WireRepairProof {
  if (!validWireProof(proof) || !proof.isolated || !terminal(from) || !terminal(to)
    || proof.connections.some(link => link.from === from || link.to === to)) return proof;
  return { ...proof, connections: [...proof.connections, { from, to }] };
}

export function wireRepairComplete(proof: unknown): boolean {
  return validWireProof(proof) && proof.isolated && proof.connections.length === WIRE_TERMINALS.length
    && proof.connections.every(link => link.from === link.to);
}

function summarize(cells: boolean[]): BrushCoverage {
  let cleaned = 0;
  const quadrants = [0, 0, 0, 0];
  const { columns, rows, requiredCoverage, requiredQuadrantCoverage } = SOLAR_BRUSH;
  for (let index = 0; index < cells.length; index++) {
    if (!cells[index]) continue;
    cleaned++;
    const column = index % columns, row = Math.floor(index / columns);
    quadrants[(row >= rows / 2 ? 2 : 0) + (column >= columns / 2 ? 1 : 0)]++;
  }
  const total = columns * rows;
  const fractions = quadrants.map(count => count / (total / 4));
  return { cells, cleaned, total, ratio: cleaned / total, quadrants: fractions,
    complete: cleaned / total >= requiredCoverage && fractions.every(value => value >= requiredQuadrantCoverage) };
}

export function createBrushCoverage(): BrushCoverage {
  return summarize(Array<boolean>(SOLAR_BRUSH.columns * SOLAR_BRUSH.rows).fill(false));
}

function markSegment(cells: boolean[], from: BrushPoint, to: BrushPoint): boolean {
  const { columns, rows, radius, aspectRatio } = SOLAR_BRUSH;
  const ax = from.x * aspectRatio, ay = from.y;
  const dx = (to.x - from.x) * aspectRatio, dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  // Restrict work to the swept brush's rectangle, rather than replaying pointer history.
  const x0 = Math.max(0, Math.floor((Math.min(from.x, to.x) - radius / aspectRatio) * columns));
  const x1 = Math.min(columns - 1, Math.floor((Math.max(from.x, to.x) + radius / aspectRatio) * columns));
  const y0 = Math.max(0, Math.floor((Math.min(from.y, to.y) - radius) * rows));
  const y1 = Math.min(rows - 1, Math.floor((Math.max(from.y, to.y) + radius) * rows));
  let changed = false;
  for (let row = y0; row <= y1; row++) {
    for (let column = x0; column <= x1; column++) {
      const index = row * columns + column;
      if (cells[index]) continue;
      const px = (column + 0.5) / columns * aspectRatio, py = (row + 0.5) / rows;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
      const ex = px - ax - t * dx, ey = py - ay - t * dy;
      if (ex * ex + ey * ey <= radius * radius) { cells[index] = true; changed = true; }
    }
  }
  return changed;
}

/** Incremental UI update; shared geometry with final proof validation. Input is never mutated. */
export function brushSegment(coverage: BrushCoverage, from: BrushPoint, to: BrushPoint = from): BrushCoverage {
  if (!point(from) || !point(to)) return coverage;
  const cells = [...coverage.cells];
  return markSegment(cells, from, to) ? summarize(cells) : coverage;
}

/** Replays bounded gestures. Lifting the brush never connects two separate strokes. */
export function brushCoverage(strokes: unknown): BrushCoverage | null {
  if (!Array.isArray(strokes) || strokes.length > SOLAR_BRUSH.maxStrokes) return null;
  let count = 0;
  for (const stroke of strokes) {
    if (!Array.isArray(stroke) || !stroke.length || (count += stroke.length) > SOLAR_BRUSH.maxPoints) return null;
    for (const sample of stroke) if (!point(sample)) return null;
  }
  const cells = createBrushCoverage().cells;
  for (const stroke of strokes as BrushPoint[][]) {
    markSegment(cells, stroke[0], stroke[0]);
    for (let index = 1; index < stroke.length; index++) markSegment(cells, stroke[index - 1], stroke[index]);
  }
  return summarize(cells);
}

export function validateActivityProof(taskId: unknown, proof: unknown): boolean {
  if (!isActivityTaskId(taskId) || !record(proof)) return false;
  if (taskId === 'solar-connect') return wireRepairComplete(proof);
  return proof.kind === 'panel-cleaning' && brushCoverage(proof.strokes)?.complete === true;
}
