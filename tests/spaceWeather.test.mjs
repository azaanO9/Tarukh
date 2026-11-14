import test from "node:test";
import assert from "node:assert/strict";
import {
  getStormScale,
  calculateExposureDelta,
  HISTORICAL_SEP_EVENTS,
  SpaceWeatherService,
} from "../game/spaceWeatherService.ts";

test("getStormScale maps proton flux to NOAA solar radiation scales accurately", () => {
  assert.equal(getStormScale(0.2), "S0 NOMINAL");
  assert.equal(getStormScale(9.9), "S0 NOMINAL");
  assert.equal(getStormScale(10), "S1 MINOR");
  assert.equal(getStormScale(99.9), "S1 MINOR");
  assert.equal(getStormScale(100), "S2 MODERATE");
  assert.equal(getStormScale(999), "S2 MODERATE");
  assert.equal(getStormScale(1000), "S3 STRONG");
  assert.equal(getStormScale(9999), "S3 STRONG");
  assert.equal(getStormScale(10000), "S4 EXTREME");
  assert.equal(getStormScale(29500), "S4 EXTREME");
});

test("calculateExposureDelta computes quiet baseline, active storm logarithmic curve and decontamination", () => {
  // 1. Inside shelter: decontaminates at -1.5 mSv/sec regardless of outside flux
  const decontam = calculateExposureDelta(1500, true, 1.0);
  assert.equal(decontam, -1.5);

  // 2. Outside in quiet baseline (< 10 PFU): +0.05 mSv/sec
  const quiet = calculateExposureDelta(0.5, false, 1.0);
  assert.equal(quiet, 0.05);

  // 3. Outside in active storm (>= 10 PFU): 0.6 + log10(PFU) * 1.4 mSv/sec
  // At 10 PFU: 0.6 + 1.0 * 1.4 = 2.0 mSv/s
  const at10 = calculateExposureDelta(10, false, 1.0);
  assert.ok(Math.abs(at10 - 2.0) < 0.001);

  // At 100 PFU: 0.6 + 2.0 * 1.4 = 3.4 mSv/s
  const at100 = calculateExposureDelta(100, false, 1.0);
  assert.ok(Math.abs(at100 - 3.4) < 0.001);

  // At 1000 PFU: 0.6 + 3.0 * 1.4 = 4.8 mSv/s
  const at1000 = calculateExposureDelta(1000, false, 1.0);
  assert.ok(Math.abs(at1000 - 4.8) < 0.001);
});

test("HISTORICAL_SEP_EVENTS has verified NASA DONKI events", () => {
  assert.equal(HISTORICAL_SEP_EVENTS.length, 3);
  const [may2024, sep2017, halloween2003] = HISTORICAL_SEP_EVENTS;

  assert.equal(may2024.id, "2024-05-13T09:33:00-SEP-001");
  assert.equal(may2024.peakPFU, 240);

  assert.equal(sep2017.id, "2017-09-10T16:45:00-SEP-001");
  assert.equal(sep2017.peakPFU, 1490);

  assert.equal(halloween2003.id, "2003-10-28T11:10:00-SEP-001");
  assert.equal(halloween2003.peakPFU, 29500);
});

test("SpaceWeatherService handles mode switching and historical event ramping", () => {
  const service = new SpaceWeatherService();
  assert.equal(service.getMode(), "live");

  // Switch to historical replay
  service.setMode("historical");
  assert.equal(service.getMode(), "historical");

  // Initial update at t=0
  const initial = service.update(0);
  assert.ok(initial.sepFluxPFU >= 0.19 && initial.sepFluxPFU <= 0.25);
  assert.equal(initial.stormScale, "S0 NOMINAL");

  // Advance time past ramp duration (e.g. 25s)
  const event = service.getSelectedEvent();
  const mid = service.update(event.rampDurationSec / 2);
  assert.ok(mid.sepFluxPFU > 1.0);

  const peak = service.update(event.rampDurationSec);
  assert.ok(peak.sepFluxPFU >= event.peakPFU * 0.95);

  // Cycle to next historical event
  service.nextHistoricalEvent();
  const nextEvent = service.getSelectedEvent();
  assert.notEqual(nextEvent.id, event.id);

  service.dispose();
});
