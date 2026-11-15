import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createStarbase} from './createStarbase.ts';
import {createStarbaseState,resetStarbase,setRigControl,setArticulation,startCatch,stepStarbase,STARBASE,RIG_LIMITS,type NumericRigControl,type VehicleView} from '../../game/starbaseRig.ts';

const element=<E=HTMLElement>(id:string)=>document.getElementById(id) as E;
const standaloneSource='<!doctype html>\n'+document.documentElement.outerHTML;
const nextFrame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const viewport=element('viewport'),loading=element('loading'),fallback=element('fallback');
const media=matchMedia('(prefers-reduced-motion: reduce)');
const startQuality=new URL(location.href).searchParams.get('quality');
const quality=element<HTMLSelectElement>('quality');if(startQuality==='performance')quality.value='performance';
const calm=element<HTMLInputElement>('calm');calm.checked=media.matches;
const narrowLayout=matchMedia('(max-width: 730px)'),controlsPanel=element('controls');
function syncControlDrawer(){controlsPanel.inert=narrowLayout.matches&&!controlsPanel.classList.contains('open');}
syncControlDrawer();narrowLayout.addEventListener('change',syncControlDrawer);
element('retry').addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.set('quality','performance');location.href=url.href;});
element('toggle-controls').addEventListener('click',()=>{
  const open=controlsPanel.classList.toggle('open');element('toggle-controls').setAttribute('aria-expanded',String(open));syncControlDrawer();
  if(open)element('vehicle').focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&element('controls').classList.contains('open')){
    controlsPanel.classList.remove('open');syncControlDrawer();element('toggle-controls').setAttribute('aria-expanded','false');element('toggle-controls').focus();
  }
});

type StarbaseWindow=Window&{starbaseControls?:Record<string,unknown>;starbaseRig?:ReturnType<typeof createStarbase>};

async function mount(){
  let renderer:T.WebGLRenderer|undefined;
  const cleanups:Array<()=>void>=[];let disposed=false,frame=0;
  const teardown=()=>{
    if(disposed)return;disposed=true;cancelAnimationFrame(frame);
    for(let i=cleanups.length-1;i>=0;i--)cleanups[i]();
    delete (window as StarbaseWindow).starbaseControls;delete (window as StarbaseWindow).starbaseRig;
  };
  try{
    await nextFrame();
    renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    cleanups.push(()=>renderer!.dispose());
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;
    renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#bac9ca');
    renderer.domElement.setAttribute('aria-label','Orbitable launch tower and rocket');renderer.domElement.tabIndex=0;
    viewport.insertBefore(renderer.domElement,viewport.firstChild);
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(42,1,.2,1800);
    scene.fog=new T.Fog('#c5c9c4',260,950);
    const skyGeometry=new T.SphereGeometry(1200,24,12);
    const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{
      zenith:{value:new T.Color('#5684a4')},horizon:{value:new T.Color('#c5c9c4')},horizonOutput:{value:new T.Color('#c5c9c4').convertLinearToSRGB()},
      sunDirection:{value:new T.Vector3(85,130,70).normalize()},sunTint:{value:new T.Color('#fff5e6')},
    },vertexShader:`varying vec3 worldPoint;void main(){vec4 world=modelMatrix*vec4(position,1.0);worldPoint=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`varying vec3 worldPoint;uniform vec3 zenith,horizon,horizonOutput,sunDirection,sunTint;
      void main(){vec3 direction=normalize(worldPoint-cameraPosition);float elevation=max(0.0,direction.y);
      vec3 color=mix(horizon,zenith,pow(smoothstep(0.0,.25,elevation),.7));
      float sun=max(0.0,dot(direction,sunDirection));color+=sunTint*(pow(sun,80.0)*.055+smoothstep(.99992,.99998,sun)*2.5);
      gl_FragColor=vec4(color,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb=mix(horizonOutput,gl_FragColor.rgb,smoothstep(0.0,.04,elevation));
      }`});
    const sky=new T.Mesh(skyGeometry,skyMaterial);sky.name='coastalSky';sky.frustumCulled=false;scene.add(sky);
    cleanups.push(()=>{skyGeometry.dispose();skyMaterial.dispose();});
    function paintSky(golden:boolean){
      skyMaterial.uniforms.zenith.value.set(golden?'#7895ae':'#5684a4');
      skyMaterial.uniforms.horizon.value.set(golden?'#c6b09d':'#c5c9c4');
      skyMaterial.uniforms.horizonOutput.value.copy(skyMaterial.uniforms.horizon.value).convertLinearToSRGB();
      skyMaterial.uniforms.sunTint.value.set(golden?'#ffd5a1':'#fff5e6');
    }paintSky(false);
    const ambientLight=new T.AmbientLight('#222430',.4);ambientLight.name='ambientLight';scene.add(ambientLight);
    const sunDirectionalLight=new T.DirectionalLight('#fff5e6',2.5);sunDirectionalLight.name='sunDirectionalLight';
    sunDirectionalLight.position.set(85,130,70);sunDirectionalLight.target.position.set(0,60,0);sunDirectionalLight.castShadow=true;
    sunDirectionalLight.shadow.camera.left=-115;sunDirectionalLight.shadow.camera.right=115;
    sunDirectionalLight.shadow.camera.top=145;sunDirectionalLight.shadow.camera.bottom=-95;
    sunDirectionalLight.shadow.camera.near=1;sunDirectionalLight.shadow.camera.far=420;
    sunDirectionalLight.shadow.bias=-.00025;sunDirectionalLight.shadow.normalBias=.09;sunDirectionalLight.shadow.radius=2;
    scene.add(sunDirectionalLight,sunDirectionalLight.target);
    cleanups.push(()=>sunDirectionalLight.shadow.dispose());
    const pmrem=new T.PMREMGenerator(renderer),environmentScene=new RoomEnvironment();
    const environment=pmrem.fromScene(environmentScene,.04,1,500);
    cleanups.push(()=>environment.dispose());
    scene.environment=environment.texture;scene.environmentIntensity=.8;environmentScene.dispose();pmrem.dispose();
    const state=createStarbaseState(),rig=createStarbase(scene);
    cleanups.push(()=>rig.dispose());
    (window as StarbaseWindow).starbaseRig=rig;
    const orbit=new OrbitControls(camera,renderer.domElement);orbit.minDistance=9;orbit.maxDistance=680;orbit.maxPolarAngle=Math.PI*.485;
    cleanups.push(()=>orbit.dispose());
    orbit.enableDamping=!calm.checked;orbit.dampingFactor=.075;orbit.target.set(-2,70,0);
    camera.position.set(160,105,195);orbit.update();
    const cameraDestination=new T.Vector3(),targetDestination=new T.Vector3();let cameraMoving=false;
    orbit.addEventListener('start',()=>{cameraMoving=false;});
    function cameraView(name:string){
      if(name==='catch'){
        cameraDestination.set(56,state.current.carriageHeight+18,68);targetDestination.set(-2,state.current.carriageHeight-8,0);
      }else if(name==='engines'){
        const y=state.current.rocketPosY;cameraDestination.set(26,Math.max(1.5,y-11),25);targetDestination.set(0,y+3,0);
      }else{
        cameraDestination.set(state.view==='booster'?180:160,state.view==='booster'?150:105,state.view==='booster'?235:195);targetDestination.set(-2,state.view==='booster'?110:70,0);
      }
      if(calm.checked){camera.position.copy(cameraDestination);orbit.target.copy(targetDestination);orbit.update();cameraMoving=false;}
      else cameraMoving=true;
      for(const button of document.querySelectorAll<HTMLButtonElement>('[data-camera]'))button.setAttribute('aria-pressed',String(button.dataset.camera===name));
    }
    for(const button of document.querySelectorAll<HTMLButtonElement>('[data-camera]'))button.addEventListener('click',()=>cameraView(button.dataset.camera!));
    const sliders=new Map<string,{input:HTMLInputElement;output:HTMLOutputElement;read:()=>number;units:string}>();
    function slider(parent:string,id:string,label:string,min:number,max:number,step:number,units:string,read:()=>number,write:(value:number)=>void){
      const row=document.createElement('div');row.className='range-row';
      const title=document.createElement('label');title.htmlFor=id;title.appendChild(document.createTextNode(label));
      const output=document.createElement('output');output.setAttribute('for',id);title.appendChild(output);
      const input=document.createElement('input');input.type='range';input.id=id;input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(read());
      input.addEventListener('input',()=>write(input.valueAsNumber));row.appendChild(title);row.appendChild(input);element(parent).appendChild(row);
      sliders.set(id,{input,output,read,units});
    }
    function poseSlider(parent:string,key:NumericRigControl,title:string,units:string,step=.1){
      const [low,high]=RIG_LIMITS[key];slider(parent,key,title,low,high,step,units,()=>state.target[key],value=>{setRigControl(state,key,value);});
    }
    poseSlider('tower-controls','carriageHeight','Carriage elevation','m');
    poseSlider('tower-controls','leftArmAngle','Left arm / outward','°');poseSlider('tower-controls','rightArmAngle','Right arm / outward','°');
    poseSlider('pose-controls','rocketPosX','Lateral / X','m');poseSlider('pose-controls','rocketPosY','Altitude / Y','m');poseSlider('pose-controls','rocketPosZ','Lateral / Z','m');
    poseSlider('pose-controls','rocketPitch','Pitch','°');poseSlider('pose-controls','rocketYaw','Yaw','°');poseSlider('pose-controls','rocketRoll','Roll','°');
    poseSlider('thrust-controls','engineThrust','Thrust command','',.01);
    const finSelect=element<HTMLSelectElement>('fin-select'),flapSelect=element<HTMLSelectElement>('flap-select');
    function writeSurfaces(part:'gridFins'|'flaps',selection:string,value:number){
      if(selection==='all')for(let i=0;i<4;i++)setArticulation(state,part,i,value);else setArticulation(state,part,Number(selection),value);
    }
    slider('fin-controls','gridFinDeflection','Fin deflection',-30,30,.1,'°',()=>state.target.gridFins[finSelect.value==='all'?0:Number(finSelect.value)],value=>writeSurfaces('gridFins',finSelect.value,value));
    slider('flap-controls','flapsBellyFlopAngle','Flap hinge angle',-20,70,.1,'°',()=>state.target.flaps[flapSelect.value==='all'?0:Number(flapSelect.value)],value=>writeSurfaces('flaps',flapSelect.value,value));
    element<HTMLInputElement>('qd').addEventListener('change',e=>setRigControl(state,'qd',(e.target as HTMLInputElement).checked?1:0));
    const commandVelocity=new T.Vector3();let velocityMode=false;
    function stopVelocity(){velocityMode=false;commandVelocity.set(0,0,0);}
    function setView(view:VehicleView){stopVelocity();rig.joinStages();resetStarbase(state,view);state.paused=false;element<HTMLSelectElement>('vehicle').value=view;cameraView('overview');element('stage-info').textContent='';}
    element<HTMLSelectElement>('vehicle').addEventListener('change',e=>setView((e.target as HTMLSelectElement).value as VehicleView));
    element('reset').addEventListener('click',()=>{setView('stack');state.paused=false;});
    element('pause').addEventListener('click',()=>{state.paused=!state.paused;});
    function beginCatch(){stopVelocity();rig.joinStages();startCatch(state);element<HTMLSelectElement>('vehicle').value='booster';cameraView('overview');element('stage-info').textContent='Booster return · upper stage excluded from this sequence';}
    element('catch').addEventListener('click',beginCatch);
    const separatedStart=new T.Vector3(),separationAxis=new T.Vector3();let separationTime=Infinity;
    function separate(){
      if(state.view!=='stack'||state.running)return;
      rig.separateStages();separatedStart.copy(rig.starshipUpperStage.position);separationAxis.set(0,1,0).applyQuaternion(rig.rocketEntity.quaternion);
      separationTime=0;element('stage-info').textContent='Upper stage detached · independent world transform';
    }
    element('separate').addEventListener('click',separate);
    element('join').addEventListener('click',()=>{rig.joinStages();separationTime=Infinity;element('stage-info').textContent='Stages rejoined';});
    const api:Record<string,unknown>={
      startCatchSequence:beginCatch,pause:()=>{state.paused=true;},resume:()=>{state.paused=false;},
      reset:()=>setView('stack'),separateStages:separate,joinStages:()=>rig.joinStages(),
      setGridFin:(index:number,value:number)=>setArticulation(state,'gridFins',index,value),
      setFlap:(index:number,value:number)=>setArticulation(state,'flaps',index,value),
      setVelocity:(x:number,y:number,z:number)=>{if([x,y,z].every(Number.isFinite)){commandVelocity.set(x,y,z);velocityMode=true;state.running=false;state.secured=false;}},
      stopVelocity,
      velocity:state.velocity,angularVelocity:state.angularVelocity,
      rocketEntity:rig.rocketEntity,superHeavyBooster:rig.superHeavyBooster,starshipUpperStage:rig.starshipUpperStage,
    };
    for(const key of Object.keys(RIG_LIMITS) as NumericRigControl[])Object.defineProperty(api,key,{enumerable:true,get:()=>state.target[key],set:(value:number)=>setRigControl(state,key,value)});
    Object.defineProperties(api,{
      chopsticksAngle:{enumerable:true,get:()=>state.target.leftArmAngle,set:(value:number)=>{setRigControl(state,'leftArmAngle',value);setRigControl(state,'rightArmAngle',value);}},
      qdArmOpen:{enumerable:true,get:()=>state.target.qd>.5,set:(value:boolean)=>setRigControl(state,'qd',value?1:0)},
      gridFinDeflection:{enumerable:true,get:()=>state.target.gridFins[0],set:(value:number)=>writeSurfaces('gridFins','all',value)},
      flapsBellyFlopAngle:{enumerable:true,get:()=>state.target.flaps[0],set:(value:number)=>writeSurfaces('flaps','all',value)},
      phase:{enumerable:true,get:()=>state.phase},view:{enumerable:true,get:()=>state.view,set:(value:VehicleView)=>{if(['stack','booster','ship'].includes(value))setView(value);}},
    });(window as StarbaseWindow).starbaseControls=api;
    let currentCap=1.25;
    function resize(){if(!renderer)return;const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setPixelRatio(Math.min(devicePixelRatio,currentCap));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
    function applyQuality(){
      if(!renderer)return;
      const q=quality.value;currentCap=q==='ultra'?2:q==='high'?1.5:q==='performance'?1:1.25;
      renderer.shadowMap.enabled=q!=='performance';
      const size=q==='ultra'?4096:q==='high'?2048:1024;
      if(sunDirectionalLight.shadow.mapSize.x!==size){sunDirectionalLight.shadow.map?.dispose();sunDirectionalLight.shadow.map=null;sunDirectionalLight.shadow.mapSize.set(size,size);}
      resize();
    }quality.addEventListener('change',applyQuality);
    element<HTMLSelectElement>('lighting').addEventListener('change',e=>{
      const golden=(e.target as HTMLSelectElement).value==='golden';paintSky(golden);
      sunDirectionalLight.color.set(golden?'#ffd5a1':'#fff5e6');sunDirectionalLight.position.set(85,golden?42:130,70);
      skyMaterial.uniforms.sunDirection.value.copy(sunDirectionalLight.position).normalize();
      (scene.fog as T.Fog).color.set(golden?'#c6b09d':'#c5c9c4');renderer!.toneMappingExposure=golden?1.06:1.04;
    });
    calm.addEventListener('change',()=>{orbit.enableDamping=!calm.checked;});
    const mediaChange=()=>{calm.checked=media.matches;orbit.enableDamping=!calm.checked;};media.addEventListener('change',mediaChange);
    cleanups.push(()=>media.removeEventListener('change',mediaChange));
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(viewport);applyQuality();
    cleanups.push(()=>resizeObserver.disconnect());
    element('download').addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob([standaloneSource],{type:'text/html'})),link=document.createElement('a');link.href=url;link.download='tarukh-starbase.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    rig.applyPose(state.current,state.view,0,calm.checked);
    element('load-progress').style.width='75%';element('loading-text').textContent='Preparing metal reflections, shadows and shader programs.';
    sky.position.copy(camera.position);await nextFrame();await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
    element('load-progress').style.width='100%';loading.hidden=true;viewport.dataset.ready='true';
    let last=performance.now(),elapsed=0,lastReadout=0,fpsStart=last,frames=0;
    const phaseSteps=[...document.querySelectorAll<HTMLElement>('.track span')];
    function readout(){
      const p=state.current;
      element('altitude').textContent=p.rocketPosY.toFixed(1)+' m';element('velocity').textContent=state.velocity.y.toFixed(2)+' m/s';
      element('rail-height').textContent=p.carriageHeight.toFixed(1)+' m';element('thrust').textContent=Math.round(p.engineThrust*100)+'%';
      const pins=rig.pins(),gap=Math.min(pins.left.y,pins.right.y)-STARBASE.pinRadius-p.carriageHeight;
      element('pin-gap').textContent=state.view==='booster'?gap.toFixed(2)+' m':'—';
      if(element('phase').textContent!==state.phase)element('phase').textContent=state.phase;
      element('phase-sub').textContent=state.secured?'Lift pins resting on both rails':state.running?'Independent rocket · articulated catch rig':'Drag to orbit · adjust the rig controls';
      element('timecode').textContent='T+'+state.elapsed.toFixed(1).padStart(4,'0');
      const step=state.elapsed<15?0:state.elapsed<20?1:state.elapsed<25?2:state.elapsed<32?3:4;
      for(let i=0;i<5;i++)phaseSteps[i].classList.toggle('active',(state.running||state.secured)&&i<=step);
      element('pause').textContent=state.paused?'Resume':'Pause';element('pause').setAttribute('aria-pressed',String(state.paused));
      element('catch').textContent=state.running?'Restart catch':state.secured?'Catch again':'Start catch';
      element('vehicle-caption').textContent=state.view==='stack'?'Starship · Full stack':state.view==='booster'?'Super Heavy · Booster return':'Starship · Upper stage';
      element<HTMLInputElement>('qd').checked=state.target.qd>.5;
      element<HTMLButtonElement>('separate').disabled=state.view!=='stack'||rig.stagesSeparated||state.running;
      element<HTMLButtonElement>('join').disabled=!rig.stagesSeparated;
      for(const {input,output,read,units} of sliders.values()){
        const value=read();if(document.activeElement!==input)input.value=String(value);
        output.value=value.toFixed(units==='m'||units==='°'?1:2)+(units?' '+units:'');
      }
      viewport.dataset.phase=state.phase;viewport.dataset.pinGap=gap.toFixed(5);viewport.dataset.rocketParent=rig.rocketEntity.parent?.name||'scene';
      viewport.dataset.thrust=p.engineThrust.toFixed(4);viewport.dataset.stagesSeparated=String(rig.stagesSeparated);
    }
    function animate(now:number){
      if(disposed||!renderer)return;frame=requestAnimationFrame(animate);
      const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
      if(document.hidden)return;
      if(!state.paused){
        elapsed+=dt;
        if(velocityMode&&!state.running){
          setRigControl(state,'rocketPosX',state.target.rocketPosX+commandVelocity.x*dt);
          setRigControl(state,'rocketPosY',state.target.rocketPosY+commandVelocity.y*dt);
          setRigControl(state,'rocketPosZ',state.target.rocketPosZ+commandVelocity.z*dt);
        }
        stepStarbase(state,dt);
        if(rig.stagesSeparated&&separationTime<6){separationTime=Math.min(6,separationTime+dt);const t=separationTime/6;rig.starshipUpperStage.position.copy(separatedStart).addScaledVector(separationAxis,14*t*t*(3-2*t));}
      }
      rig.applyPose(state.current,state.view,elapsed,calm.checked);
      rig.rocketEntity.userData.velocity.set(state.velocity.x,state.velocity.y,state.velocity.z);
      rig.rocketEntity.userData.angularVelocity.set(state.angularVelocity.x,state.angularVelocity.y,state.angularVelocity.z);
      if(cameraMoving){const speed=1-Math.exp(-4*dt);camera.position.lerp(cameraDestination,speed);orbit.target.lerp(targetDestination,speed);if(camera.position.distanceToSquared(cameraDestination)<.01)cameraMoving=false;}
      orbit.update();sky.position.copy(camera.position);renderer.render(scene,camera);frames++;
      if(now-lastReadout>100){lastReadout=now;readout();}
      if(now-fpsStart>1500){
        const fps=frames*1000/(now-fpsStart);element('stats').textContent=`${fps.toFixed(0)} FPS · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles/1000).toFixed(0)}k tris`;
        viewport.dataset.fps=fps.toFixed(1);viewport.dataset.calls=String(renderer.info.render.calls);viewport.dataset.triangles=String(renderer.info.render.triangles);
        if(quality.value==='auto'&&!state.paused&&fps<36&&currentCap> .8){currentCap=Math.max(.8,currentCap-.1);resize();}
        frames=0;fpsStart=now;
      }
    }
    readout();frame=requestAnimationFrame(animate);
    const lost=(event:Event)=>{event.preventDefault();state.paused=true;loading.hidden=true;fallback.hidden=false;};renderer.domElement.addEventListener('webglcontextlost',lost);
    window.addEventListener('pagehide',event=>{if(!event.persisted)teardown();});
  }catch(error){
    teardown();loading.hidden=true;fallback.hidden=false;
    element('failure-text').textContent='The browser could not prepare this WebGL 2 scene. Try Performance graphics and check that hardware acceleration is enabled.';
    viewport.dataset.failure=error instanceof Error?error.message:'WebGL initialization failed';
  }
}
void mount();
