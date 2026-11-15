import {createStarbaseState} from '../../game/starbaseRig.ts';
import type {ArrivalFrame} from '../../game/starshipArrival.ts';
import type {createStarbase} from './createStarbase.ts';

/** One articulated pose for the opening and the persistent Mars vehicle. */
export function createArrivalRigPose(rig:ReturnType<typeof createStarbase>) {
  const pose=createStarbaseState().current;
  return (frame:ArrivalFrame,time:number,reduced:boolean)=>{
    pose.rocketPosX=frame.boosterX;pose.rocketPosY=frame.boosterY;pose.rocketPosZ=0;pose.rocketRoll=frame.boosterRoll;
    pose.carriageHeight=frame.carriageHeight;pose.leftArmAngle=pose.rightArmAngle=frame.armAngle;pose.qd=1;pose.engineThrust=0;
    pose.flaps.fill(frame.flapAngle);
    if(frame.separated&&!rig.stagesSeparated)rig.separateStages();
    if(!frame.separated&&rig.stagesSeparated)rig.joinStages();
    rig.applyPose(pose,'stack',time,reduced);
    if(rig.stagesSeparated){
      rig.starshipUpperStage.position.set(frame.shipX,frame.shipY,0);
      rig.starshipUpperStage.rotation.set(0,0,frame.shipRoll*Math.PI/180);
    }
    rig.superHeavyBooster.visible=frame.boosterVisible;
    rig.setPropulsion(frame.boosterThrust,frame.shipThrust,time,reduced,false,frame.landingEngines);
    for(const engine of rig.shipEngines.gimbals)engine.rotation.z=-Math.max(-5,Math.min(5,frame.shipRoll*.07))*Math.PI/180;
  };
}
