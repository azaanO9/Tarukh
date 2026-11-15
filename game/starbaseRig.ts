/** Dimensions follow the supplied concept brief, not a flight-certified vehicle. */
export const STARBASE = Object.freeze({
  towerX: -18, towerHeight: 145, towerWidth: 12, bays: 9,
  armLength: 35, hingeX: -10.5, hingeZ: 5.8, railInset: .65,
  carriageMin: 25, carriageMax: 120, catchHeight: 96,
  boosterHeight: 71, shipHeight: 50, radius: 4.5, mountHeight: 20,
  pinHeight: 64.8, pinRadius: .28, pinZ: 5.15,
  catchSeconds: 32,
});

export type VehicleView = 'stack' | 'booster' | 'ship';
export type RigPose = {
  carriageHeight: number; leftArmAngle: number; rightArmAngle: number; qd: number;
  rocketPosX: number; rocketPosY: number; rocketPosZ: number;
  rocketPitch: number; rocketYaw: number; rocketRoll: number; engineThrust: number;
  gridFins: number[]; flaps: number[];
};
export type NumericRigControl = Exclude<keyof RigPose, 'gridFins' | 'flaps'>;
export const RIG_LIMITS: Record<NumericRigControl, readonly [number, number]> = {
  carriageHeight: [25,120], leftArmAngle: [0,35], rightArmAngle: [0,35], qd: [0,1],
  rocketPosX: [-80,80], rocketPosY: [0,250], rocketPosZ: [-80,80],
  rocketPitch: [-90,90], rocketYaw: [-180,180], rocketRoll: [-90,90], engineThrust: [0,1],
};
const radians = Math.PI / 180;
const controlKeys = Object.keys(RIG_LIMITS) as NumericRigControl[];
const articulationParts = ['gridFins','flaps'] as const;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const smooth = (t: number) => { t=clamp(t,0,1); return t*t*t*(t*(t*6-15)+10); };
const mix = (a: number, b: number, t: number) => a+(b-a)*t;

function pose(): RigPose {
  return {carriageHeight:100,leftArmAngle:18,rightArmAngle:18,qd:0,
    rocketPosX:0,rocketPosY:20.5,rocketPosZ:0,rocketPitch:0,rocketYaw:0,rocketRoll:0,engineThrust:0,
    gridFins:[0,0,0,0],flaps:[0,0,0,0]};
}

export function createStarbaseState() {
  return {current:pose(),target:pose(),view:'stack' as VehicleView,paused:false,
    running:false,secured:false,elapsed:0,phase:'On the launch mount',
    initialCarriage:100,initialLeft:18,initialRight:18,initialQd:0,
    velocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0}};
}
export type StarbaseState = ReturnType<typeof createStarbaseState>;

export function setRigControl(state:StarbaseState,key:NumericRigControl,value:number) {
  if(!Number.isFinite(value))return false;
  const [low,high]=RIG_LIMITS[key];
  state.target[key]=clamp(value,low,high);state.running=false;
  if(key!=='carriageHeight'&&key!=='qd')state.secured=false;
  state.phase=state.secured?'Secured on catch rails':'Manual control';
  return true;
}

export function setArticulation(state:StarbaseState,part:'gridFins'|'flaps',index:number,angle:number) {
  if(!Number.isInteger(index)||index<0||index>3||!Number.isFinite(angle))return false;
  state.target[part][index]=clamp(angle,part==='gridFins'?-30:-20,part==='gridFins'?30:70);
  state.running=false;state.phase=state.secured?'Secured on catch rails':'Manual control';return true;
}

export function resetStarbase(state:StarbaseState,view:VehicleView='stack') {
  const fresh=pose();state.view=view;state.running=false;state.secured=false;state.elapsed=0;
  state.phase=view==='stack'?'On the launch mount':view==='booster'?'Booster approach':'Upper-stage rig';
  if(view==='booster'){fresh.rocketPosY=150;fresh.engineThrust=.65;fresh.qd=1;}
  if(view==='ship'){fresh.rocketPosY=36;fresh.engineThrust=0;fresh.flaps.fill(45);fresh.qd=1;}
  for(const key of controlKeys)state.target[key]=state.current[key]=fresh[key];
  for(const part of articulationParts)for(let i=0;i<4;i++)state.target[part][i]=state.current[part][i]=fresh[part][i];
  state.velocity.x=state.velocity.y=state.velocity.z=0;
  state.angularVelocity.x=state.angularVelocity.y=state.angularVelocity.z=0;
}

export function startCatch(state:StarbaseState) {
  const {carriageHeight,leftArmAngle,rightArmAngle,qd}=state.current;
  resetStarbase(state,'booster');state.paused=false;state.running=true;state.phase='Descent burn';
  state.initialCarriage=carriageHeight;state.initialLeft=leftArmAngle;state.initialRight=rightArmAngle;
  state.initialQd=qd;state.current.qd=qd;
  state.current.carriageHeight=carriageHeight;
  state.current.leftArmAngle=leftArmAngle;state.current.rightArmAngle=rightArmAngle;
  state.current.rocketPosX=4;state.current.rocketPosZ=-2;
  state.current.rocketPitch=2.2;state.current.rocketRoll=-1.4;
}

/** Allocation-free kinematic sequence. The rocket remains a world-space entity. */
export function stepStarbase(state:StarbaseState,seconds:number) {
  if(state.paused||!Number.isFinite(seconds)||seconds<=0)return;
  const dt=Math.min(seconds,.1),p=state.current,t=state.target;
  const x=p.rocketPosX,y=p.rocketPosY,z=p.rocketPosZ;
  const pitch=p.rocketPitch,yaw=p.rocketYaw,roll=p.rocketRoll;
  if(state.running){
    state.elapsed=Math.min(STARBASE.catchSeconds,state.elapsed+dt);
    const time=state.elapsed,finalY=STARBASE.catchHeight-STARBASE.pinHeight+STARBASE.pinRadius;
    p.carriageHeight=mix(state.initialCarriage,STARBASE.catchHeight,smooth(time/8));
    const close=smooth((time-20)/5);
    p.leftArmAngle=mix(mix(state.initialLeft,18,smooth(time/4)),0,close);
    p.rightArmAngle=mix(mix(state.initialRight,18,smooth(time/4)),0,close);
    p.qd=mix(state.initialQd,1,smooth(time/3));
    const aligned=smooth(time/19);
    p.rocketPosX=4*(1-aligned);p.rocketPosZ=-2*(1-aligned);
    p.rocketPitch=2.2*(1-aligned);p.rocketRoll=-1.4*(1-aligned);p.rocketYaw=0;
    p.rocketPosY=time<15?mix(150,finalY+6,smooth(time/15))
      :time<20?finalY+6:time<25?mix(finalY+6,finalY+1.5,smooth((time-20)/5))
      :mix(finalY+1.5,finalY,smooth((time-25)/7));
    p.engineThrust=time<15?mix(.8,.3,smooth(time/15))
      :time<25?.3:mix(.3,0,smooth((time-25)/7));
    for(let i=0;i<4;i++)p.gridFins[i]=(i%2?1:-1)*12*(1-aligned);
    state.phase=time<15?'Descent burn':time<20?'Hover and align':time<25?'Closing catch arms':'Settling lift pins';
    for(const key of controlKeys)t[key]=p[key];
    for(let i=0;i<4;i++)t.gridFins[i]=p.gridFins[i];
    if(time>=STARBASE.catchSeconds){state.running=false;state.secured=true;state.phase='Secured on catch rails';}
  }else{
    const response=1-Math.exp(-7*dt);
    for(const key of controlKeys)p[key]=mix(p[key],t[key],response);
    for(const part of articulationParts)for(let i=0;i<4;i++)p[part][i]=mix(p[part][i],t[part][i],response);
    if(state.secured){p.rocketPosY=p.carriageHeight-STARBASE.pinHeight+STARBASE.pinRadius;t.rocketPosY=p.rocketPosY;}
  }
  state.velocity.x=(p.rocketPosX-x)/dt;state.velocity.y=(p.rocketPosY-y)/dt;state.velocity.z=(p.rocketPosZ-z)/dt;
  state.angularVelocity.x=(p.rocketPitch-pitch)*radians/dt;
  state.angularVelocity.y=(p.rocketYaw-yaw)*radians/dt;
  state.angularVelocity.z=(p.rocketRoll-roll)*radians/dt;
}

/** World-space rail centre at a given X; positive side is the right arm. */
export function catchRailZ(side:number,angleDegrees:number,worldX:number) {
  const angle=-side*angleDegrees*radians,c=Math.cos(angle),s=Math.sin(angle),inner=-side*STARBASE.railInset;
  const along=(worldX-STARBASE.hingeX-s*inner)/c;
  return side*STARBASE.hingeZ-s*along+c*inner;
}
