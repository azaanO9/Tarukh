/** Pure exploration rover vehicle physics, 6-wheel rocker-bogie suspension, and open-world kinematics. */
import { boxObstacle, moveAndSlide, overlapBody, overlapDisc, type CollisionObstacle } from "./collision.ts";
export const ROVER_LIMIT = 173;
export const ROVER_ENTER_RADIUS = 4.8;
export const ROVER_MAX_FORWARD = 50 / 3.6; // Authored crew rover top speed: 50 km/h (~13.89 m/s), not a NASA rover specification.
export const ROVER_BOOST_MAX_FORWARD = 50 / 3.6; // In Boost Mode, speed limit stays 50 km/h (~13.89 m/s); motor torque is increased
export const ROVER_MAX_REVERSE = 10 / 3.6; // Authored exploration rover reverse limit: 10 km/h (~2.78 m/s)
export const ROVER_ACCELERATION = 1.6; // Authored gradual acceleration in m/s^2
export const ROVER_BOOST_ACCELERATION = 4.2; // Boost mode motor acceleration in m/s^2 (2.6x torque)
export const ROVER_BRAKE = 4.5;        // m/s^2 active service brake
export const ROVER_HANDBRAKE = 7.5;    // m/s^2 emergency stop
export const ROVER_COAST_DRAG = 0.85;  // rolling friction m/s^2
export const ROVER_STEER_MAX = 0.52;   // ~30 degrees max front wheel turn
export const ROVER_STEER_SPEED = 3.4;  // rad/s steering response
export const ROVER_WHEEL_BASE = 2.849;   // meters between front and rear axles
export const ROVER_TRACK_WIDTH = 2.85;  // meters between left and right wheel track
export const ROVER_WHEEL_RADIUS = 0.3206;// meters inner tire radius
export const ROVER_WHEEL_OUTER_RADIUS = 0.3206; // tire + tread rib outer radius
export const ROVER_COLLISION_RADIUS = Math.hypot(1.69, 2.475);
export const roverFootprint = (x:number,z:number,yaw:number) => boxObstacle(x,z,1.69,2.475,"parked-rover",yaw);
export const ROVER_CHASSIS_CLEARANCE = 0.024; // anti-Z-fighting surface clearance bias

// Physical Constants & Power Grid
export const ROVER_MASS = 3200; // kg - NASA Space Exploration Vehicle (MMSEV) realistic dry+crew mass
export const MARS_GRAVITY = 3.72; // m/s^2 - Martian surface gravity
export const ROVER_NOMINAL_RANGE_KM = 85.0; // Nominal distance at standard cruise on full 100% battery
export const ROVER_BASE_DRAIN_RATE = 0.005; // % per second base avionics & life support drain while driving
export const ROVER_DRIVE_DRAIN_RATE = 0.075; // % per second standard cruise consumption at full throttle
export const ROVER_BOOST_DRAIN_MULT = 3.0; // 3x battery consumption multiplier during Boost Mode
export const ROVER_PARKED_RECHARGE_RATE = 0.035; // % per second rest replenishment from internal power cell
export const ROVER_SOLAR_MAX_RATE = 0; // Deprecated: solar panels removed from rover

// Component Damage & EVA Maintenance
export type RoverPartId =
  | "wheel_fl"
  | "wheel_fr"
  | "wheel_ml"
  | "wheel_mr"
  | "wheel_rl"
  | "wheel_rr"
  | "cabin_roof"
  | "solar_array"; // alias retained for backward-compatibility

export type RoverDamageState = {
  wheel_fl: number;
  wheel_fr: number;
  wheel_ml: number;
  wheel_mr: number;
  wheel_rl: number;
  wheel_rr: number;
  cabin_roof: number;
  solar_array: number;
};

export const INITIAL_ROVER_DAMAGE: RoverDamageState = {
  wheel_fl: 100,
  wheel_fr: 100,
  wheel_ml: 100,
  wheel_mr: 100,
  wheel_rl: 100,
  wheel_rr: 100,
  cabin_roof: 100,
  solar_array: 100,
};

export const ROVER_SAFE_IMPACT_FORCE = 85; // kN safe threshold before collision causes mechanical damage
export const ROVER_DAMAGE_FORCE_SCALE = 18; // kN per 1% damage reduction

export const ROVER_PART_LABELS: Record<RoverPartId, string> = {
  wheel_fl: "Front-Left Wheel",
  wheel_fr: "Front-Right Wheel",
  wheel_ml: "Mid-Left Wheel",
  wheel_mr: "Mid-Right Wheel",
  wheel_rl: "Rear-Left Wheel",
  wheel_rr: "Rear-Right Wheel",
  cabin_roof: "Cabin Roof & Avionics",
  solar_array: "Cabin Roof & Avionics",
};

export const ROVER_PART_WHEEL_INDICES: Record<string, number> = {
  wheel_fl: 0,
  wheel_fr: 1,
  wheel_ml: 2,
  wheel_mr: 3,
  wheel_rl: 4,
  wheel_rr: 5,
};

export const ROVER_WHEEL_OFFSETS: readonly (readonly [number, number])[] = [
  [-1.425, -1.0313], // 0: Front Left
  [1.425, -1.0313],  // 1: Front Right
  [-1.425, 0.3934],  // 2: Mid Left
  [1.425, 0.3934],   // 3: Mid Right
  [-1.425, 1.8179],  // 4: Rear Left
  [1.425, 1.8179],   // 5: Rear Right
];

export type RoverGear = "D" | "R" | "N" | "B";

export type RoverObstacle = CollisionObstacle;

export type RoverVehicle = {
  x: number;
  z: number;
  yaw: number;
  speed: number;        // forward positive, reverse negative (m/s)
  steerAngle: number;   // radians, positive left, negative right
  wheelRoll: number;    // cumulative wheel rotation in radians
  pitch: number;        // chassis terrain slope pitch in radians (positive = nose up)
  roll: number;         // chassis terrain slope roll in radians (positive = right side up)
  chassisY: number;     // anti-clipped world Y position of rover root
  wheelContacts: [number, number, number, number, number, number];
  wheelCompression: [number, number, number, number, number, number];
  leftRockerAngle: number;
  rightRockerAngle: number;
  leftBogieAngle: number;
  rightBogieAngle: number;
  mudDepth: number;     // 0..1 current soft regolith/mud factor under rover
  driving: boolean;     // whether astronaut is seated inside driving
  handbrake: boolean;   // whether handbrake is active
  upgrades?: readonly string[];
  battery: number;          // 0..100 (%) onboard rover battery charge
  boostActive: boolean;     // whether Boost Mode drivetrain is engaged
  solarCharging: boolean;   // whether solar panels are actively generating net charge
  solarRate: number;        // current solar generation rate (%/sec)
  powerDrainRate: number;   // current battery consumption rate (%/sec)
  estimatedRangeKm: number; // dynamically computed live estimated range in km
  slopeAngle: number;       // incline angle in radians along heading
  damage: RoverDamageState; // component-level health diagnostics
};

export function getRoverPartWorldPosition(rover: RoverVehicle, partId: RoverPartId): { x: number; y: number; z: number } {
  const cosY = Math.cos(rover.yaw);
  const sinY = Math.sin(rover.yaw);
  if (partId === "cabin_roof" || partId === "solar_array") {
    const lx = 0, lz = 0.45;
    const wx = rover.x + lx * cosY + lz * sinY;
    const wz = rover.z - lx * sinY + lz * cosY;
    return { x: wx, y: rover.chassisY + 1.8, z: wz };
  }
  const wheelIndex = ROVER_PART_WHEEL_INDICES[partId] ?? 0;
  const [lx, lz] = ROVER_WHEEL_OFFSETS[wheelIndex];
  const wx = rover.x + lx * cosY + lz * sinY;
  const wz = rover.z - lx * sinY + lz * cosY;
  const wy = rover.wheelContacts?.[wheelIndex] ?? rover.chassisY;
  return { x: wx, y: wy, z: wz };
}

export function getNearestRoverPart(
  position: { x: number; z: number },
  rover: RoverVehicle,
): { id: RoverPartId; name: string; distance: number; health: number } | null {
  const allParts: RoverPartId[] = [
    "wheel_fl", "wheel_fr", "wheel_ml", "wheel_mr", "wheel_rl", "wheel_rr", "cabin_roof"
  ];
  let nearest: RoverPartId | null = null;
  let minDistance = Infinity;

  for (const partId of allParts) {
    const worldPos = getRoverPartWorldPosition(rover, partId);
    const dist = Math.hypot(position.x - worldPos.x, position.z - worldPos.z);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = partId;
    }
  }

  if (!nearest) return null;
  const currentHealth = rover.damage?.[nearest] ?? (nearest === "cabin_roof" ? rover.damage?.solar_array : undefined) ?? 100;
  return {
    id: nearest,
    name: ROVER_PART_LABELS[nearest],
    distance: minDistance,
    health: currentHealth,
  };
}

export function repairRoverPart(rover: RoverVehicle, partId: RoverPartId): RoverVehicle {
  const currentDamage = rover.damage ?? INITIAL_ROVER_DAMAGE;
  const isRoof = partId === "cabin_roof" || partId === "solar_array";
  return {
    ...rover,
    damage: {
      ...currentDamage,
      [partId]: 100,
      ...(isRoof ? { cabin_roof: 100, solar_array: 100 } : {}),
    },
  };
}

export function getRoverGear(speed: number, isBoost = false): RoverGear {
  if (isBoost && speed > 0.12) return "B";
  if (speed > 0.12) return "D";
  if (speed < -0.12) return "R";
  return "N";
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function solveRockerBogieSuspension(
  x: number,
  z: number,
  yaw: number,
  prevChassisY: number,
  prevPitch: number,
  prevRoll: number,
  prevCompression: readonly number[],
  heightAt: (wx: number, wz: number) => number,
  mudAt: (wx: number, wz: number) => number,
  dt: number,
) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);

  const contacts: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  let mudSum = 0;

  for (let i = 0; i < 6; i++) {
    const [lx, lz] = ROVER_WHEEL_OFFSETS[i];
    const wx = x + lx * cosY + lz * sinY;
    const wz = z - lx * sinY + lz * cosY;
    const mud = clamp(mudAt(wx, wz), 0, 1);
    mudSum += mud;
    // Tires press slightly into soft mud while hard regolith holds zero sinkage
    const sink = mud * 0.075;
    contacts[i] = heightAt(wx, wz) - sink;
  }

  const mudDepth = mudSum / 6;
  const centerGround = heightAt(x, z) - mudDepth * 0.05;

  const frontAvg = 0.5 * (contacts[0] + contacts[1]);
  const rearAvg = 0.5 * (contacts[4] + contacts[5]);
  const leftAvg = (contacts[0] + contacts[2] + contacts[4]) / 3;
  const rightAvg = (contacts[1] + contacts[3] + contacts[5]) / 3;

  // Corrected right-handed Euler("YXZ") signs:
  // +pitch lifts -Z (front) UP; +roll lifts +X (right) UP.
  const targetPitch = Math.atan2(frontAvg - rearAvg, ROVER_WHEEL_BASE);
  const targetRoll = Math.atan2(rightAvg - leftAvg, ROVER_TRACK_WIDTH);

  const orientBlend = dt > 0 ? 1 - Math.exp(-14 * dt) : 1;
  const pitch = prevPitch + (targetPitch - prevPitch) * orientBlend;
  const roll = prevRoll + (targetRoll - prevRoll) * orientBlend;

  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  const sinR = Math.sin(roll);
  const verticalScale = cosP * Math.cos(roll);

  // Prevent belly skid frame (bottom at +0.34m) from clipping crests,
  // and prevent any individual wheel from exceeding maximum upward suspension travel (+0.32m).
  const maxComp = 0.32;
  let minChassisFromWheels = -Infinity;
  let supportHeight = 0;
  for (let i = 0; i < 6; i++) {
    const [lx, lz] = ROVER_WHEEL_OFFSETS[i];
    const planeOffset = lx * sinR * cosP - lz * sinP;
    supportHeight += (contacts[i] - planeOffset + ROVER_WHEEL_OUTER_RADIUS * (1 - verticalScale)) / 6;
    const req = contacts[i] - planeOffset + ROVER_WHEEL_OUTER_RADIUS * (1 - verticalScale) - maxComp * verticalScale;
    if (req > minChassisFromWheels) minChassisFromWheels = req;
  }
  const bellyGuardY = centerGround - 0.10;
  const targetChassisY = Math.max(supportHeight, bellyGuardY, minChassisFromWheels) + ROVER_CHASSIS_CLEARANCE;

  const heightBlend = dt > 0 ? 1 - Math.exp(-18 * dt) : 1;
  // Never lag below the required ground support height when climbing slopes or rocks
  const blendedY = prevChassisY + (targetChassisY - prevChassisY) * heightBlend;
  const chassisY = Math.max(blendedY, targetChassisY);

  const compression: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const suspBlend = dt > 0 ? 1 - Math.exp(-22 * dt) : 1;
  for (let i = 0; i < 6; i++) {
    const [lx, lz] = ROVER_WHEEL_OFFSETS[i];
    const nominalWheelBottomY = chassisY + lx * sinR * cosP - lz * sinP
      + ROVER_WHEEL_OUTER_RADIUS * (verticalScale - 1);
    const rawDelta = clamp((contacts[i] - nominalWheelBottomY) / Math.max(.1, verticalScale), -0.26, maxComp);
    const previous = prevCompression[i] ?? 0;
    const damped = previous + (rawDelta - previous) * suspBlend;
    compression[i] = Math.max(rawDelta, damped);
  }

  // Bogie pivots between Mid (z=0.0) and Rear (z=1.6), Rocker connects Front (z=-1.6) to Bogie pivot (z=+0.8)
  const leftBogieAngle = Math.atan2(compression[2] - compression[4], 1.6);
  const rightBogieAngle = Math.atan2(compression[3] - compression[5], 1.6);
  const leftBogieLift = 0.5 * (compression[2] + compression[4]);
  const rightBogieLift = 0.5 * (compression[3] + compression[5]);
  const leftRockerAngle = Math.atan2(compression[0] - leftBogieLift, 2.4);
  const rightRockerAngle = Math.atan2(compression[1] - rightBogieLift, 2.4);

  return {
    chassisY,
    pitch,
    roll,
    contacts,
    compression,
    leftRockerAngle,
    rightRockerAngle,
    leftBogieAngle,
    rightBogieAngle,
    mudDepth,
  };
}

export const spawnRoverVehicle = (
  x = 17,
  z = 10,
  yaw = 0,
  heightAt: (wx: number, wz: number) => number = () => 0,
): RoverVehicle => {
  const initialY = heightAt(x, z) + ROVER_CHASSIS_CLEARANCE;
  const settled = solveRockerBogieSuspension(
    x,
    z,
    yaw,
    initialY,
    0,
    0,
    [0, 0, 0, 0, 0, 0],
    heightAt,
    () => 0,
    0,
  );
  return {
    x,
    z,
    yaw,
    speed: 0,
    steerAngle: 0,
    wheelRoll: 0,
    pitch: settled.pitch,
    roll: settled.roll,
    chassisY: settled.chassisY,
    wheelContacts: settled.contacts,
    wheelCompression: settled.compression,
    leftRockerAngle: settled.leftRockerAngle,
    rightRockerAngle: settled.rightRockerAngle,
    leftBogieAngle: settled.leftBogieAngle,
    rightBogieAngle: settled.rightBogieAngle,
    mudDepth: 0,
    driving: false,
    handbrake: false,
    battery: 100,
    boostActive: false,
    solarCharging: false,
    solarRate: 0,
    powerDrainRate: 0,
    estimatedRangeKm: ROVER_NOMINAL_RANGE_KM,
    slopeAngle: settled.pitch,
    damage: { ...INITIAL_ROVER_DAMAGE },
  };
};

export function canEnterRover(
  walker: { x: number; z: number },
  rover: { x: number; z: number; driving: boolean },
  radius = ROVER_ENTER_RADIUS,
): boolean {
  if (rover.driving) return false;
  return Math.hypot(walker.x - rover.x, walker.z - rover.z) <= radius;
}

export function enterRover(rover: RoverVehicle): RoverVehicle {
  return {
    ...rover,
    driving: true,
    speed: 0,
    handbrake: false,
  };
}

export function exitRover(
  rover: RoverVehicle,
  obstacles: readonly RoverObstacle[] = [],
  worldLimit = ROVER_LIMIT,
): { rover: RoverVehicle; exitPosition: { x: number; z: number } | null } {
  // Exit to the driver's side (left flank of the vehicle)
  let exitPosition: {x:number;z:number}|null=null;
  for(const [side,end] of [[-2.4,0],[2.4,0],[-2.4,1.5],[2.4,1.5],[0,3.2],[0,-3.2]]){
    const x=rover.x+Math.cos(rover.yaw)*side+Math.sin(rover.yaw)*end;
    const z=rover.z-Math.sin(rover.yaw)*side+Math.cos(rover.yaw)*end;
    if(Math.abs(x)>worldLimit||Math.abs(z)>worldLimit)continue;
    if(!obstacles.some(o=>o.id!=="rover"&&overlapDisc(x,z,.36,o))){exitPosition={x,z};break;}
  }
  if(!exitPosition)return {rover,exitPosition:null};
  return {
    rover: {
      ...rover,
      driving: false,
      speed: 0,
      handbrake: true,
      boostActive: false,
    },
    exitPosition,
  };
}

export type RoverAnalogInput = {
  throttle?: number;
  steer?: number;
  handbrake?: boolean;
  boost?: boolean;
};

export function stepRoverVehicle(
  rover: RoverVehicle,
  keys: ReadonlySet<string>,
  seconds: number,
  obstacles: readonly RoverObstacle[] = [],
  heightAt: (x: number, z: number) => number = () => 0,
  mudAt: (x: number, z: number) => number = () => 0,
  analog?: RoverAnalogInput,
  options?: {
    speedMultiplier?: number;
    worldLimit?: number;
    daylightElapsed?: number;
    solarIntensity?: number;
  },
): RoverVehicle {
  const worldLimit = options?.worldLimit ?? ROVER_LIMIT;
  const dt = Math.max(0, Math.min(seconds, 0.05));
  if (dt <= 0) return rover;

  const currentBattery = rover.battery ?? 100;
  const isShift = keys.has("shift") || keys.has("Shift");
  const boostRequested = isShift || Boolean(analog?.boost);
  const boostActive = rover.driving && boostRequested && currentBattery > 0.05;

  const damage: RoverDamageState = rover.damage
    ? { ...rover.damage }
    : { ...INITIAL_ROVER_DAMAGE };

  // Rover internal power cell: rest replenishment when parked (solar panels removed)
  const solarRate = 0;
  const solarCharging = false;

  if (!rover.driving) {
    // When parked, friction holds the rover stationary and suspension settles on terrain
    const speed = Math.abs(rover.speed) < 0.05 ? 0 : rover.speed * Math.exp(-14 * dt);
    const settled = solveRockerBogieSuspension(
      rover.x,
      rover.z,
      rover.yaw,
      rover.chassisY,
      rover.pitch,
      rover.roll,
      rover.wheelCompression,
      heightAt,
      mudAt,
      dt,
    );
    // Parked passive replenishment from internal power cell (zero motor drain)
    const parkedBattery = clamp(currentBattery + ROVER_PARKED_RECHARGE_RATE * dt, 0, 100);
    const nominalRange = (parkedBattery / 100) * ROVER_NOMINAL_RANGE_KM;
    return {
      ...rover,
      speed,
      handbrake: true,
      steerAngle: rover.steerAngle * Math.exp(-6 * dt),
      chassisY: settled.chassisY,
      pitch: settled.pitch,
      roll: settled.roll,
      wheelContacts: settled.contacts,
      wheelCompression: settled.compression,
      leftRockerAngle: settled.leftRockerAngle,
      rightRockerAngle: settled.rightRockerAngle,
      leftBogieAngle: settled.leftBogieAngle,
      rightBogieAngle: settled.rightBogieAngle,
      mudDepth: settled.mudDepth,
      battery: parkedBattery,
      boostActive: false,
      solarCharging: false,
      solarRate: 0,
      powerDrainRate: 0,
      estimatedRangeKm: nominalRange,
      slopeAngle: settled.pitch,
      damage,
    };
  }

  const forwardKey = keys.has("w") || keys.has("arrowup");
  const reverseKey = keys.has("s") || keys.has("arrowdown");
  const leftKey = keys.has("a") || keys.has("arrowleft");
  const rightKey = keys.has("d") || keys.has("arrowright");
  const analogThrottle = clamp(analog?.throttle ?? 0, -1, 1);
  const handbrakeKey =
    keys.has(" ") ||
    keys.has("space") ||
    keys.has("handbrake") ||
    Boolean(analog?.handbrake);

  const forwardMag = forwardKey ? 1 : analogThrottle > 0.12 ? analogThrottle : 0;
  const reverseMag = reverseKey ? 1 : analogThrottle < -0.12 ? -analogThrottle : 0;
  const throttleMag = Math.max(forwardMag, reverseMag);

  // Power Consumption & Drain
  // Idle avionics drain + driving drain. In Boost Mode, consumption increases 3x!
  const hasPower = currentBattery > 0.05;
  const idleDrain = ROVER_BASE_DRAIN_RATE;
  const speedRatio = Math.abs(rover.speed) / (boostActive ? ROVER_BOOST_MAX_FORWARD : ROVER_MAX_FORWARD);
  const baseDriveDrain = throttleMag * (ROVER_DRIVE_DRAIN_RATE * (0.6 + 0.4 * clamp(speedRatio, 0, 1)));
  const driveDrain = boostActive ? baseDriveDrain * ROVER_BOOST_DRAIN_MULT : baseDriveDrain;
  const powerDrainRate = idleDrain + driveDrain;
  const battery = clamp(currentBattery + (solarRate - powerDrainRate) * dt, 0, 100);

  // Dynamic live estimated range: instantly drops by half when shifting into Boost Mode
  const nominalRange = (battery / 100) * ROVER_NOMINAL_RANGE_KM;
  const estimatedRangeKm = battery <= 0.05 ? 0 : boostActive ? nominalRange * 0.5 : nominalRange;

  const currentMaxForward = boostActive ? ROVER_BOOST_MAX_FORWARD : ROVER_MAX_FORWARD;
  let speed = clamp(rover.speed, -ROVER_MAX_REVERSE, currentMaxForward);
  const handbrake = handbrakeKey;

  // Mechanical failures from component damage
  const wheelKeys: readonly RoverPartId[] = [
    "wheel_fl",
    "wheel_fr",
    "wheel_ml",
    "wheel_mr",
    "wheel_rl",
    "wheel_rr",
  ];
  let activeWheelCount = 0;
  let deadWheelCount = 0;
  let leftDeadCount = 0;
  let rightDeadCount = 0;

  for (let i = 0; i < 6; i++) {
    const key = wheelKeys[i];
    const hp = damage[key] ?? 100;
    if (hp <= 25) {
      deadWheelCount++;
      if (i % 2 === 0) leftDeadCount++;
      else rightDeadCount++;
    } else {
      activeWheelCount++;
    }
  }

  // Active wheel torque ratio: independent hub motors deliver power only through functional wheels
  const activeTorqueRatio = activeWheelCount / 6;

  // Off-road regolith & mud factor
  const hasMudTires = rover.upgrades?.includes("mud_tires") ?? false;
  const mudFactor = clamp(rover.mudDepth * (hasMudTires ? 0.15 : 1.0), 0, 1);
  const baseSpeedMul = clamp(options?.speedMultiplier ?? 1.0, 0.8, 1.4);

  // Incline slope angle along heading:
  // In our coordinate system, forward is along -Z. +pitch lifts -Z (nose) up.
  // Driving forward with +pitch is climbing uphill.
  const slopeAngle = rover.pitch;
  const sinSlope = Math.sin(slopeAngle);
  // Gravitational force component along the incline: F = m * g * sin(theta)
  // Deceleration opposing forward motion = g * sin(theta)
  const inclineDecel = MARS_GRAVITY * sinSlope;

  // Steep mountain slope reduces achievable top speed, dead wheels drag regolith and reduce top speed
  const slopeResistanceFactor = Math.max(0.12, 1.0 - 0.72 * Math.max(0, sinSlope));
  const deadWheelSpeedPenalty = Math.max(0.2, 1 - 0.12 * deadWheelCount);
  const mudSpeedPenalty = boostActive ? 0.06 : (hasMudTires ? 0.05 : 0.28);
  const effectiveMaxForward = currentMaxForward * baseSpeedMul * (1 - mudFactor * mudSpeedPenalty) * slopeResistanceFactor * deadWheelSpeedPenalty;
  const deadWheelDrag = deadWheelCount * 1.35;
  const effectiveCoastDrag = (ROVER_COAST_DRAG + deadWheelDrag) * (1 + mudFactor * (hasMudTires ? 0.2 : 1.15));

  // Motor acceleration: standard 1.6 m/s^2, Boost Mode 4.2 m/s^2 (2.6x torque), scaled by functioning hub motors
  const baseMotorAcc = boostActive ? ROVER_BOOST_ACCELERATION : ROVER_ACCELERATION;
  const motorAcceleration = (hasPower ? baseMotorAcc : 0) * (hasMudTires ? 1.35 : 1.0) * activeTorqueRatio;

  // Steering angle rate of change
  const analogSteer = clamp(analog?.steer ?? 0, -1, 1);
  const steerInput = clamp((Number(leftKey) - Number(rightKey)) + analogSteer, -1, 1);
  const steerLimit = Math.atan2(Math.tan(ROVER_STEER_MAX),
    1 + speed * speed * Math.tan(ROVER_STEER_MAX) / (4 * ROVER_WHEEL_BASE));
  const targetSteer = steerInput * steerLimit;
  const steerDiff = targetSteer - rover.steerAngle;
  const steerStep = ROVER_STEER_SPEED * dt;
  let steerAngle = rover.steerAngle;
  if (Math.abs(steerDiff) <= steerStep) {
    steerAngle = targetSteer;
  } else {
    steerAngle += Math.sign(steerDiff) * steerStep;
  }

  // Throttle, braking, and gravity-incline physics
  if (handbrakeKey) {
    if (speed > 0) {
      speed = Math.max(0, speed - ROVER_HANDBRAKE * dt);
    } else if (speed < 0) {
      speed = Math.min(0, speed + ROVER_HANDBRAKE * dt);
    }
  } else if (forwardMag > 0 && reverseMag === 0) {
    if (speed < 0) {
      speed = Math.min(0, speed + ROVER_BRAKE * forwardMag * dt);
    } else if (hasPower) {
      const motorPull = motorAcceleration * (1 - 0.3 * speed / Math.max(0.1, effectiveMaxForward));
      // Net forward acceleration = motor pull minus incline gravitational resistance
      const netAcc = motorPull - inclineDecel;
      if (netAcc > 0) {
        speed = Math.min(effectiveMaxForward, speed + netAcc * forwardMag * dt);
      } else {
        // Motor torque cannot overcome steep mountain slope: speed realistically decelerates
        speed = Math.max(0, speed + netAcc * forwardMag * dt);
      }
    }
  } else if (reverseMag > 0 && forwardMag === 0) {
    if (speed > 0) {
      speed = Math.max(0, speed - ROVER_BRAKE * reverseMag * dt);
    } else if (hasPower) {
      // Incline resistance opposes reversing uphill (when pitch < 0)
      const reverseMotor = motorAcceleration * 0.75;
      const netReverse = reverseMotor + inclineDecel;
      speed = Math.max(-ROVER_MAX_REVERSE, speed - netReverse * reverseMag * dt);
    }
  } else {
    // Coasting / idle rolling on slope
    if (Math.abs(speed) > 0.05) {
      if (speed > 0) {
        speed = Math.max(0, speed - (effectiveCoastDrag + inclineDecel * 0.5) * dt);
      } else {
        speed = Math.min(0, speed + (effectiveCoastDrag - inclineDecel * 0.5) * dt);
      }
    } else if (Math.abs(sinSlope) > 0.35 && !handbrake) {
      // Steep slope exceeding static regolith friction causes rolling
      speed -= inclineDecel * 0.3 * dt;
    } else {
      speed = 0;
    }
  }

  // Turn rate: Ackermann bicycle kinematics + asymmetric yaw pull from locked wheels
  // Forward in this coordinate system is along (-sin(yaw), -cos(yaw))
  let yaw = rover.yaw;
  if (Math.abs(speed) > 0.05) {
    const turnRate = (speed / ROVER_WHEEL_BASE) * Math.tan(steerAngle);
    const deadYawPull = (leftDeadCount - rightDeadCount) * 0.26 * (speed / ROVER_MAX_FORWARD);
    yaw += (turnRate + deadYawPull) * dt;
    while (yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw < -Math.PI) yaw += Math.PI * 2;
  }

  // Pre-collision velocity vector in world coordinates
  const preVx = -Math.sin(rover.yaw) * rover.speed;
  const preVz = -Math.cos(rover.yaw) * rover.speed;

  // Only nearby geometry needs precise outline tests; keep the swept travel margin.
  const contactReach=ROVER_COLLISION_RADIUS+Math.abs(speed)*dt+.2;
  const solid = obstacles.filter(o=>o.id!=="rover"&&!o.traversable
    &&Math.abs(o.x-rover.x)<=o.radius+contactReach&&Math.abs(o.z-rover.z)<=o.radius+contactReach);
  // Reject rotation into nearby hardware instead of letting the rear swing through it.
  const turn=Math.atan2(Math.sin(yaw-rover.yaw),Math.cos(yaw-rover.yaw));
  let safeYaw=rover.yaw;
  const turns=Math.max(1,Math.ceil(Math.abs(turn)/.015));
  for(let i=1;i<=turns;i++){
    const candidate=rover.yaw+turn*i/turns, shape=roverFootprint(0,0,candidate);
    if(solid.some(o=>overlapBody(rover.x,rover.z,shape,o)))break;
    safeYaw=candidate;
  }
  yaw=safeYaw;
  const shape=roverFootprint(0,0,yaw);
  const moved=moveAndSlide(rover.x,rover.z,-Math.sin(yaw)*speed*dt,-Math.cos(yaw)*speed*dt,[shape],solid,worldLimit);
  let x=moved.x,z=moved.z;
  const travelled=(x-rover.x)*-Math.sin(yaw)+(z-rover.z)*-Math.cos(yaw);
  if(moved.normals.length) {
    speed=Math.sign(speed)*Math.min(Math.abs(speed),Math.max(0,travelled*Math.sign(speed)/dt));

    // Collision impact force calculation and localized hitbox damage
    for (const norm of moved.normals) {
      // Relative impact speed along contact normal
      const vRel = -(preVx * norm.nx + preVz * norm.nz);
      if (vRel > 0.08) {
        // Impact force in kN: F = (mass * vRel) / dt_impact (dt_impact ~ 0.05s => 3200 / 50 = 64 * vRel)
        const impactForceKn = (ROVER_MASS * vRel) / 50;
        if (impactForceKn > ROVER_SAFE_IMPACT_FORCE) {
          const excessForce = impactForceKn - ROVER_SAFE_IMPACT_FORCE;
          const damageAmount = excessForce / ROVER_DAMAGE_FORCE_SCALE;

          // Map contact normal to local rover coordinate space
          const cosY = Math.cos(rover.yaw);
          const sinY = Math.sin(rover.yaw);
          const localNormX = norm.nx * cosY - norm.nz * sinY;
          const localNormZ = norm.nx * sinY + norm.nz * cosY;

          // Impact location on outer hull in opposing direction of collision normal
          const impactLocalX = -localNormX * 1.6;
          const impactLocalZ = -localNormZ * 2.0;

          // Map to closest wheel assembly
          let closestWheelIndex = 0;
          let minDist = Infinity;
          for (let i = 0; i < 6; i++) {
            const [wx, wz] = ROVER_WHEEL_OFFSETS[i];
            const dist = Math.hypot(impactLocalX - wx, impactLocalZ - wz);
            if (dist < minDist) {
              minDist = dist;
              closestWheelIndex = i;
            }
          }
          const targetPart = wheelKeys[closestWheelIndex];
          damage[targetPart] = Math.max(0, damage[targetPart] - damageAmount);
        }
      }
    }
  }

  // Boundary limits
  if (x < -worldLimit || x > worldLimit) {
    x = Math.max(-worldLimit, Math.min(worldLimit, x));
    speed = 0;
  }
  if (z < -worldLimit || z > worldLimit) {
    z = Math.max(-worldLimit, Math.min(worldLimit, z));
    speed = 0;
  }

  // Wheel rolling rotation (subtle extra wheel spin in soft mud!)
  const slipRatio = 1 + mudFactor * 0.25;
  const wheelRoll = rover.wheelRoll + travelled * slipRatio / ROVER_WHEEL_OUTER_RADIUS;

  // 6-wheel Rocker-Bogie terrain clamping & articulation
  const suspension = solveRockerBogieSuspension(
    x,
    z,
    yaw,
    rover.chassisY,
    rover.pitch,
    rover.roll,
    rover.wheelCompression,
    heightAt,
    mudAt,
    dt,
  );

  // Rollover / catastrophic pitch/roll impact damage to cabin roof
  const absPitch = Math.abs(suspension.pitch);
  const absRoll = Math.abs(suspension.roll);
  if (absPitch > 0.82 || absRoll > 0.82) {
    // Flipped on side or roof: apply severe cabin roof damage
    const rollDamage = 60 * dt;
    const currentRoof = damage.cabin_roof ?? damage.solar_array ?? 100;
    damage.cabin_roof = Math.max(0, currentRoof - rollDamage);
    damage.solar_array = damage.cabin_roof;
  }

  return {
    x,
    z,
    yaw,
    speed,
    steerAngle,
    wheelRoll,
    pitch: suspension.pitch,
    roll: suspension.roll,
    chassisY: suspension.chassisY,
    wheelContacts: suspension.contacts,
    wheelCompression: suspension.compression,
    leftRockerAngle: suspension.leftRockerAngle,
    rightRockerAngle: suspension.rightRockerAngle,
    leftBogieAngle: suspension.leftBogieAngle,
    rightBogieAngle: suspension.rightBogieAngle,
    mudDepth: suspension.mudDepth,
    driving: true,
    handbrake,
    battery,
    boostActive,
    solarCharging,
    solarRate,
    powerDrainRate,
    estimatedRangeKm,
    slopeAngle,
    damage,
  };
}
