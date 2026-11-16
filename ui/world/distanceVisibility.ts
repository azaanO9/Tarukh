/** Retain nearby detail through a small exit band so boundary jitter cannot toggle it every frame. */
export function withinDetailRange(distance: number, visible: boolean, enterDistance: number, exitMargin = 4) {
  return distance < enterDistance + (visible ? exitMargin : 0);
}
