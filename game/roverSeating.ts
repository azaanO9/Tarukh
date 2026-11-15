import type {MarsGaitPose} from './marsGait.ts';

// Measured against the supplied Kepler port seat, in the vehicle's local metres.
export const ROVER_DRIVER_SEAT = [-0.479, 1.40, -0.44] as const;
export const ROVER_SEATED_EYE = [-0.479, 2.12, -0.52] as const;

/** Relaxed seated EVA pose; vehicle motion still comes entirely from roverVehicle. */
export const ROVER_SEATED_POSE: Readonly<MarsGaitPose> = {
  hipOffsetX:0, hipOffsetY:0, hipPitch:0, hipRoll:0, hipYaw:0,
  spinePitch:.04, spineRoll:0, spineYaw:0,
  leftThighPitch:1.8, leftThighRoll:0, leftKneePitch:1.65, leftAnklePitch:.05,
  rightThighPitch:1.8, rightThighRoll:0, rightKneePitch:1.65, rightAnklePitch:.05,
  leftArmPitch:.3, leftArmRoll:0, leftArmYaw:0, leftForearmPitch:.65,
  rightArmPitch:.3, rightArmRoll:0, rightArmYaw:0, rightForearmPitch:.65,
};
