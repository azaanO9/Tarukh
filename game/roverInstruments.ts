import {getRoverGear, type RoverVehicle} from './roverVehicle.ts';

export const ROVER_INSTRUMENT_INTERVAL_MS = 250;
export const ROVER_WHEEL_PARTS = ['wheel_fl','wheel_fr','wheel_ml','wheel_mr','wheel_rl','wheel_rr'] as const;

/** Read the simulation without changing movement, battery or damage state. */
export function roverInstrumentValues(rover: RoverVehicle) {
  return {
    speedKmh: Math.abs(rover.speed) * 3.6,
    gear: getRoverGear(rover.speed, rover.boostActive),
    heading: ((-rover.yaw * 180 / Math.PI) % 360 + 360) % 360,
    battery: rover.battery,
    rangeKm: rover.estimatedRangeKm,
    charging: rover.garageCharging ? 'GARAGE DOCK' : rover.solarCharging ? 'SOLAR ARRAY' : rover.driving ? 'BATTERY SUPPLY' : 'STANDBY',
    solarRate: rover.solarRate,
    drainRate: rover.powerDrainRate,
    slope: rover.slopeAngle * 180 / Math.PI,
    roll: rover.roll * 180 / Math.PI,
    steering: rover.steerAngle * 180 / Math.PI,
  };
}

/** A fixed-size telemetry trace; no growth during a long expedition. */
export function createRoverInstrumentHistory(capacity = 64) {
  const speed = new Float32Array(capacity), battery = new Float32Array(capacity);
  let cursor = 0, count = 0;
  return {speed, battery, get cursor(){return cursor;}, get count(){return count;},
    record(rover: RoverVehicle) {
      speed[cursor] = Math.abs(rover.speed) * 3.6;
      battery[cursor] = rover.battery;
      cursor = (cursor + 1) % capacity;
      count = Math.min(capacity, count + 1);
    },
  };
}
