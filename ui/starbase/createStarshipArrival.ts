import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createStarbase} from './createStarbase.ts';
import {createLandingDust} from './landingDust.ts';
import {STARBASE} from '../../game/starbaseRig.ts';
import {advanceArrivalWithReadiness,canEnterMars,createArrivalFrame,sampleStarshipArrival,STARSHIP_ARRIVAL_DURATION,type ArrivalPlayback} from '../../game/starshipArrival.ts';
import {createArrivalRigPose} from './arrivalRig.ts';
import {createEarthDeparture} from './earthDeparture.ts';

type ArrivalOptions={
  ready:()=>boolean;onComplete:()=>void;onFrame:(frame:ReturnType<typeof createArrivalFrame>,elapsed:number,paused:boolean,dust:number)=>void;
  onFailure:()=>void;performance:boolean;reduced:boolean;previewTime?:number;
  playback:ArrivalPlayback;
};

/** Earth and orbit use this renderer; descent uses the prepared game world behind the overlay. */
export function createStarshipArrival(host:HTMLDivElement,options:ArrivalOptions){
  const cleanups:Array<()=>void>=[];let disposed=false,frameId=0;
  function dispose(){
    if(disposed)return;disposed=true;cancelAnimationFrame(frameId);
    for(let i=cleanups.length-1;i>=0;i--)cleanups[i]();
  }
  try{
  const renderer=new T.WebGLRenderer({antialias:!options.performance,powerPreference:'high-performance'});
  cleanups.push(()=>{renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();});
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
  renderer.shadowMap.enabled=!options.performance;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio,options.performance?1:1.25));
  renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(46,1,.2,5000);
  scene.background=new T.Color('#c8d4d5');scene.fog=new T.Fog('#c8d4d5',240,900);
  const ambient=new T.HemisphereLight('#d7e9f5','#74685a',1.1);scene.add(ambient);
  const sun=new T.DirectionalLight('#ffead1',2.7);sun.position.set(75,145,-85);sun.target.position.set(0,65,0);scene.add(sun,sun.target);
  sun.castShadow=!options.performance;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0002;sun.shadow.normalBias=.06;
  cleanups.push(()=>sun.shadow.dispose());
  Object.assign(sun.shadow.camera,{left:-85,right:85,top:150,bottom:-70,near:1,far:430});
  const generator=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
  let environment:T.WebGLRenderTarget;
  try{environment=generator.fromScene(room,.04);}finally{room.dispose();generator.dispose();}
  cleanups.push(()=>environment.dispose());scene.environment=environment.texture;scene.environmentIntensity=.95;
  const rig=createStarbase(scene,{shipCatchPins:true,ground:false});cleanups.push(()=>rig.dispose());
  const earth=createEarthDeparture(scene,options.performance);cleanups.push(()=>earth.dispose());
  const dust=createLandingDust(scene,options.performance?32:80);cleanups.push(()=>dust.dispose());
  // Lift pins stop above the launch table; catching is a mid-air operation, not a pad touchdown.
  rig.chopstickCarriage.visible=false;
  const shipBurnLight=new T.PointLight('#b7ccff',0,85,2);shipBurnLight.position.y=-3;rig.starshipUpperStage.add(shipBurnLight);
  cleanups.push(()=>shipBurnLight.dispose());
  const applyRig=createArrivalRigPose(rig),frameData=createArrivalFrame();
  const cameraPosition=new T.Vector3(),cameraTarget=new T.Vector3();
  const dayColor=new T.Color('#91bdd4'),spaceColor=new T.Color('#03060e'),earthFog=scene.fog;
  options.playback.active=true;options.playback.time=0;options.playback.marsRendered=false;
  cleanups.push(()=>{options.playback.active=false;});
  let last=0,elapsed=0,paused=false,skipped=false,started=false,lastUi=0,lastDraw=0,completed=false;
  function pose(time:number,dt:number){
    sampleStarshipArrival(time,frameData);
    options.playback.time=time;applyRig(frameData,time,options.reduced);
    const space=frameData.environment!=='earth';earth.setSpace(space);
    scene.background=space?spaceColor:dayColor;scene.fog=space?null:earthFog;
    rig.mechazillaTower.visible=rig.orbitalLaunchMount.visible=!space;
    renderer.domElement.style.visibility=frameData.returning?'hidden':'visible';
    rig.exhaustLight.intensity=frameData.boosterThrust*1000;shipBurnLight.intensity=frameData.shipThrust*1300;
    if(frameData.environment==='earth'){
      cameraPosition.set(190,120+time*22,-245);cameraTarget.set(0,90+time*30,0);
    }else{cameraPosition.set(95,235,-210);cameraTarget.set(-12,245,0);}
    camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);camera.updateMatrixWorld();
    dust.update(dt,options.reduced?0:frameData.dust,frameData.shipX,0,camera,options.reduced);
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  cleanups.push(()=>observer.disconnect());
  function finish(){if(!completed&&!disposed){completed=true;options.onComplete();}}
  function animate(now:number){
    if(disposed)return;frameId=requestAnimationFrame(animate);
    const dt=last?Math.min(.1,Math.max(0,(now-last)/1000)):0;last=now;
    if(document.hidden)return;
    elapsed=advanceArrivalWithReadiness(elapsed,dt,paused,options.ready());
    const preview=options.previewTime;
    const time=preview??(options.reduced||skipped?(options.ready()?STARSHIP_ARRIVAL_DURATION:7.1):elapsed);
    if(!paused&&preview===undefined&&canEnterMars(options.ready(),elapsed,skipped,options.reduced)){finish();return;}
    if((paused||elapsed>=36)&&now-lastDraw<100)return;
    pose(time,paused?0:dt);if(!frameData.returning)renderer.render(scene,camera);lastDraw=now;
    if(now-lastUi>100){lastUi=now;options.onFrame(frameData,elapsed,paused,dust.active);host.dataset.drawCalls=String(renderer.info.render.calls);host.dataset.triangles=String(renderer.info.render.triangles);}
  }
  const lost=(event:Event)=>{event.preventDefault();dispose();options.onFailure();};renderer.domElement.addEventListener('webglcontextlost',lost);
  cleanups.push(()=>renderer.domElement.removeEventListener('webglcontextlost',lost));
  async function start(){
    // Compile the staging flames and landing scene before presenting motion.
    for(const time of [0,4.5,6]){pose(time,0);await renderer.compileAsync(scene,camera);if(disposed)return;}
    rig.joinStages();pose(options.reduced?7.1:0,0);renderer.render(scene,camera);
    if(disposed)return;started=true;host.dataset.ready='true';frameId=requestAnimationFrame(animate);
  }
  void start().catch(()=>{if(!disposed){dispose();options.onFailure();}});
  return {dispose,skip(){skipped=true;paused=false;if(options.ready())finish();},togglePause(){paused=!paused;return paused;},get started(){return started;},get pins(){return STARBASE.shipPinHeight;}};
  }catch(error){dispose();throw error;}
}
