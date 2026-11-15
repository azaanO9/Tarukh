import {boxObstacle,overlapBody,type CollisionObstacle,type CollisionDisc} from './collision.ts';
import {GARAGE_SITE} from './garageSite.ts';
import {ROVER_WHEEL_OUTER_RADIUS,solveRockerBogieSuspension,type RoverVehicle} from './roverVehicle.ts';

export type GaragePhase='parked'|'opening-out'|'rolling-out'|'closing-out'|'outside'|'opening-in'|'rolling-in'|'closing-in';
export type GarageState=ReturnType<typeof createGarageState>;
const angleDifference=(from:number,to:number)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));
const noMud=()=>0;

export function createGarageState() {
  const {x,z}=GARAGE_SITE;
  const door=boxObstacle(x,z+4.8,3.11,.39,'garage-door');
  const obstacles=[
    boxObstacle(x-3.8,z,.9,4.8,'garage-west-wall'),
    boxObstacle(x+3.8,z,.9,4.8,'garage-east-wall'),
    boxObstacle(x,z-4.47,4.7,.47,'garage-back-wall'),
    boxObstacle(x-3.83,z+4.8,.82,.65,'garage-west-jamb'),
    boxObstacle(x+3.83,z+4.8,.82,.65,'garage-east-jamb'),
    boxObstacle(x+7.83,z+.5,2.28,3.08,'garage-solar-racks'),
    door,
  ];
  return {phase:'parked' as GaragePhase,doorAmount:0,door,obstacles,blocked:'',
    startX:x as number,startZ:z+GARAGE_SITE.parkedZ,startYaw:Math.PI,targetYaw:Math.PI,
    batteryWh:4200,solarWatts:1200,lightsOn:true,
    body:{x:0,z:0,halfX:1.74,halfZ:2.525,radius:3.07,yaw:Math.PI} as CollisionDisc,
  };
}

export function garageControlsRover(state:GarageState) {return state.phase!=='outside';}
export function garageIndoors(x:number,z:number) {
  return Math.abs(x-GARAGE_SITE.x)<4.4&&z>GARAGE_SITE.z-4.6&&z<GARAGE_SITE.z+5.3;
}

export function roverReturnIssue(rover:RoverVehicle) {
  const x=rover.x-GARAGE_SITE.x,z=rover.z-GARAGE_SITE.z;
  if(Math.abs(x)>1.5||z<12.6||z>17)return 'Drive the rover into the marked return bay';
  if(Math.abs(rover.speed)>.35)return 'Stop the rover before parking';
  if(Math.abs(Math.sin(rover.yaw))>Math.sin(Math.PI/7))return 'Align the rover with the bay arrows';
  if(rover.driving)return 'Exit the rover to start garage parking';
  return '';
}

export function garagePrompt(state:GarageState,x:number,z:number,rover:RoverVehicle) {
  const lx=x-GARAGE_SITE.x,lz=z-GARAGE_SITE.z;
  if(Math.abs(lx)>8||lz < -5||lz>20)return null;
  if(state.blocked)return{text:state.blocked,enabled:false};
  if(state.phase==='parked')return{text:'Open garage · Bring rover out',enabled:true};
  if(state.phase==='outside'){
    const issue=roverReturnIssue(rover);
    return{text:issue||'Open garage · Park rover inside',enabled:!issue};
  }
  const text=state.phase.startsWith('opening')?'Opening garage door…'
    :state.phase==='rolling-out'?'Rover rolling out…'
    :state.phase==='rolling-in'?'Rover parking inside…':'Closing garage door…';
  return{text,enabled:false};
}

export function requestGarageCycle(state:GarageState,rover:RoverVehicle) {
  if(state.phase!=='parked'&&(state.phase!=='outside'||roverReturnIssue(rover)))return false;
  state.startX=rover.x;state.startZ=rover.z;state.startYaw=rover.yaw;
  // Return nose-first or reverse in. Keep that orientation for the next exit;
  // never teleport or spin the full-size rover inside a narrow garage.
  state.targetYaw=Math.cos(rover.yaw)>=0?0:Math.PI;
  state.phase=state.phase==='parked'?'opening-out':'opening-in';
  state.blocked='';rover.speed=0;rover.handbrake=true;
  return true;
}

function inCanopySweep(x:number,z:number,radius:number) {
  const lx=x-GARAGE_SITE.x,lz=z-GARAGE_SITE.z;
  return Math.abs(lx)<3.25+radius&&lz+radius>4.05&&lz-radius<9.75;
}

/** Advances the existing vehicle, not a decorative duplicate. All motion pauses with the game. */
export function stepGarage(state:GarageState,rover:RoverVehicle,seconds:number,enabled:boolean,
  walker:CollisionObstacle,obstacles:readonly CollisionObstacle[],heightAt:(x:number,z:number)=>number,
  sunlight:number,reducedMotion=false) {
  if(!enabled)return;
  const dt=Math.max(0,Math.min(seconds,.05));
  state.solarWatts=Math.max(0,Math.min(1,sunlight))*1200;
  const motor=state.phase.startsWith('opening')||state.phase.startsWith('closing');
  const motorAvailable=state.batteryWh>1||state.solarWatts>=820;
  state.lightsOn=state.batteryWh>1||state.solarWatts>=170;
  const load=(state.lightsOn?170:10)+(motor&&motorAvailable?650:0);
  state.batteryWh=Math.max(0,Math.min(6000,state.batteryWh+(state.solarWatts-load)*dt/3600));
  state.blocked='';
  if(state.phase==='parked'||state.phase==='outside')return;
  rover.speed=0;

  if(motor){
    if(!motorAvailable){state.blocked='Garage battery needs daylight to recharge';return;}
    const occupied=inCanopySweep(walker.x,walker.z,walker.radius)
      ||inCanopySweep(rover.x,rover.z,2.75)
      ||obstacles.some(o=>o.id==='curiosity'&&inCanopySweep(o.x,o.z,o.radius));
    if(state.phase.startsWith('opening')){
      if(occupied){state.blocked='Step clear of the garage door';return;}
      state.doorAmount=Math.min(1,state.doorAmount+dt/GARAGE_SITE.doorSeconds);
      if(state.doorAmount>=1)state.phase=state.phase==='opening-out'?'rolling-out':'rolling-in';
    }else if(occupied||garageIndoors(walker.x,walker.z)){
      // Reopen if someone enters the sweep during closure; do not trap a visitor.
      state.doorAmount=Math.min(1,state.doorAmount+dt/GARAGE_SITE.doorSeconds);
      state.blocked='Step outside and clear of the garage door';
    }else{
      state.doorAmount=Math.max(0,state.doorAmount-dt/GARAGE_SITE.doorSeconds);
      if(state.doorAmount<=0)state.phase=state.phase==='closing-in'?'parked':'outside';
    }
    state.door.disabled=state.doorAmount>=1;
    return;
  }

  const targetZ=GARAGE_SITE.z+(state.phase==='rolling-out'?GARAGE_SITE.stagingZ:GARAGE_SITE.parkedZ);
  const remaining=Math.abs(targetZ-rover.z),travelled=Math.abs(rover.z-state.startZ);
  const speed=Math.min(reducedMotion?1.1:1.65,.35+travelled*1.5,.35+remaining*1.5);
  const nextZ=rover.z+Math.sign(targetZ-rover.z)*Math.min(remaining,speed*dt);
  const align=Math.min(1,Math.abs(nextZ-state.startZ)/4);
  const eased=align*align*(3-2*align);
  const nextX=state.startX+(GARAGE_SITE.x-state.startX)*eased;
  const nextYaw=state.startYaw+angleDifference(state.startYaw,state.targetYaw)*eased;
  state.body.yaw=nextYaw;
  if(overlapBody(nextX,nextZ,state.body,walker)||obstacles.some(o=>!o.disabled&&overlapBody(nextX,nextZ,state.body,o))){
    state.blocked='Clear the rover path · Movement paused';return;
  }
  const distance=-(nextX-rover.x)*Math.sin(nextYaw)-(nextZ-rover.z)*Math.cos(nextYaw);
  rover.x=nextX;rover.z=nextZ;rover.yaw=nextYaw;
  rover.speed=dt>0?distance/dt:0;rover.wheelRoll+=distance/ROVER_WHEEL_OUTER_RADIUS;rover.steerAngle=0;
  const suspension=solveRockerBogieSuspension(rover.x,rover.z,rover.yaw,rover.chassisY,rover.pitch,rover.roll,rover.wheelCompression,heightAt,noMud,dt);
  rover.chassisY=suspension.chassisY;rover.pitch=suspension.pitch;rover.roll=suspension.roll;
  rover.wheelContacts=suspension.contacts;rover.wheelCompression=suspension.compression;
  rover.leftRockerAngle=suspension.leftRockerAngle;rover.rightRockerAngle=suspension.rightRockerAngle;
  rover.leftBogieAngle=suspension.leftBogieAngle;rover.rightBogieAngle=suspension.rightBogieAngle;
  if(Math.abs(targetZ-rover.z)<1e-6){rover.speed=0;state.phase=state.phase==='rolling-out'?'closing-out':'closing-in';}
}
