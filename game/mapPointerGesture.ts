type Point = { x: number; y: number };

export type MapMotion =
  | { kind: "pan"; dx: number; dy: number }
  | { kind: "pinch"; scale: number }
  | null;

const dragThreshold = 8;

/** One gesture owns its pointers until release; hovering and cancellation never place a pin. */
export function createMapPointerGesture() {
  const points = new Map<number, Point>();
  let travel = 0;
  let pinched = false;
  const distance = () => {
    const pair = points.values();
    const a = pair.next().value;
    const b = pair.next().value;
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  return {
    start(id: number, x: number, y: number) {
      if (!points.size) { travel = 0; pinched = false; }
      if (points.size >= 2) return false;
      points.set(id, { x, y });
      if (points.size === 2) pinched = true;
      return true;
    },
    move(id: number, x: number, y: number): MapMotion {
      const point = points.get(id);
      if (!point) return null;
      const before = distance();
      const dx = x - point.x;
      const dy = y - point.y;
      travel += Math.hypot(dx, dy);
      point.x = x;
      point.y = y;
      if (points.size === 2) return before > 0 ? { kind: "pinch", scale: distance() / before } : null;
      return travel >= dragThreshold ? { kind: "pan", dx, dy } : null;
    },
    end(id: number, cancelled = false) {
      if (!points.delete(id)) return false;
      if (cancelled) pinched = true;
      return !points.size && !cancelled && !pinched && travel < dragThreshold;
    },
    reset() { points.clear(); travel = 0; pinched = false; },
  };
}
