import {createStarbaseState} from '../../game/starbaseRig.ts';
import type {ArrivalFrame} from '../../game/starshipArrival.ts';
import type {createStarbase} from './createStarbase.ts';

/** One articulated pose for the opening and the persistent Mars vehicle. */
export function createArrivalRigPose(rig:ReturnType<typeof createStarbase>) {
  const pose=createStarbaseState().current;
  return (frame:ArrivalFrame,time:number,reduced:boolean)=>{
    pose.rocketPosX=frame.shipX;pose.rocketPosY=frame.shipY;pose.rocketPosZ=0;pose.rocketRoll=frame.shipRoll;
    pose.carriageHeight=frame.carriageHeight;pose.leftArmAngle=pose.rightArmAngle=frame.armAngle;pose.qd=1;pose.engineThrust=0;
    rig.applyPose(pose,'ship',time,reduced);
    rig.setPropulsion(frame.boosterThrust,frame.shipThrust,time,reduced,false,frame.landingEngines);
    for(const engine of rig.shipEngines.gimbals)engine.rotation.z=-Math.max(-5,Math.min(5,frame.shipRoll*.07))*Math.PI/180;
  };
}
