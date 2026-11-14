import test from "node:test";
import assert from "node:assert/strict";
import { generateTopoContours } from "../game/topoContours.ts";

test("generateTopoContours produces valid contour paths within range bounds", () => {
  const result = generateTopoContours(0, 12, 30, 188, 138);
  assert.ok(typeof result.minHeight === "number");
  assert.ok(typeof result.maxHeight === "number");
  assert.ok(result.maxHeight >= result.minHeight);
  assert.ok(Array.isArray(result.contours));
  assert.ok(result.contours.length <= 10, "Contours should be bounded for clean minimal rendering");
  
  for (const c of result.contours) {
    assert.ok(typeof c.level === "number");
    assert.ok(typeof c.path === "string");
    assert.ok(c.path.startsWith("M "), "Path should contain valid SVG path commands");
  }
});

test("generateTopoContours adapts to plains and mountains", () => {
  // Near Elysium Mons coordinates
  const mountains = generateTopoContours(500, -500, 80, 188, 138);
  assert.ok(mountains.maxHeight > -100);
  assert.ok(Array.isArray(mountains.contours));
});
