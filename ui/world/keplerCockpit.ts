import * as T from 'three';
import type {RoverVehicle} from '../../game/roverVehicle.ts';
import type {LidarScan} from '../../game/roverLidar.ts';
import {createRoverInstrumentHistory, roverInstrumentValues, ROVER_INSTRUMENT_INTERVAL_MS, ROVER_WHEEL_PARTS} from '../../game/roverInstruments.ts';
import {MARS_LANDMARKS} from '../../content/marsLandmarks.ts';
import {REGION_WORLD_BOUNDS as B} from '../../game/marsRegion.ts';
import {assetUrl} from '../../lib/assetUrl.ts';
import {createInteriorLighting} from './interiorLighting.ts';
import {ROVER_SEATED_EYE} from '../../game/roverSeating.ts';

const SCREEN_NAMES = ['Display 01 Terrain','Display 02 Drive Strip','Display 03 Systems','Display 04 Traction','Aft core spectrum'] as const;
const TEXT = '#dbedf0', MUTED = '#8ba8b7', CYAN = '#67e0ed', AMBER = '#ffc16b';

/** Fits live instruments to the five authored LCD meshes; no extra screen planes. */
export function createKeplerCockpit(model: T.Object3D) {
  const interior = model.getObjectByName('Kepler_Interior');
  const eye = model.getObjectByName('Kepler_DriverEye');
  if(!interior || !eye)throw new Error('Kepler cockpit or driver anchor is missing');
  eye.position.fromArray(ROVER_SEATED_EYE);
  const fill = createInteriorLighting();fill.setActive(true);
  const ownedMaterials = new Set<T.Material>();
  const screens = new Map<string,{canvas:HTMLCanvasElement;context:CanvasRenderingContext2D;texture:T.CanvasTexture;material:T.MeshBasicMaterial}>();
  for(const name of SCREEN_NAMES){
    const canvas=document.createElement('canvas');canvas.width=name===SCREEN_NAMES[1]?1024:512;canvas.height=name===SCREEN_NAMES[1]?128:288;
    const context=canvas.getContext('2d');if(!context)throw new Error('Cockpit canvas unavailable');
    const texture=new T.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;
    texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
    const material=new T.MeshBasicMaterial({map:texture,toneMapped:false});material.name=name;
    ownedMaterials.add(material);
    screens.set(name,{canvas,context,texture,material});
  }
  const boundScreens=new Set<string>();
  interior.traverse(object=>{
    if(!(object instanceof T.Mesh))return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    const replacements=materials.map(material=>{
      const screen=screens.get(material.name);
      if(screen){boundScreens.add(material.name);return screen.material;}
      const lit=fill.materialFor(material);if(lit!==material)ownedMaterials.add(lit);return lit;
    });
    object.material=Array.isArray(object.material)?replacements:replacements[0];
    object.castShadow=false;
  });
  if(boundScreens.size!==5)throw new Error(`Expected five distinct Kepler displays, found ${boundScreens.size}`);

  const mapImage=new Image();
  let finishMap!:()=>void;
  const ready=new Promise<void>(resolve=>{finishMap=resolve;mapImage.onload=()=>resolve();mapImage.onerror=()=>resolve();});
  mapImage.src=assetUrl('/art/mars-mola-overview.webp');
  const history=createRoverInstrumentHistory();
  const seat=eye.position.clone(),angles=new T.Euler(0,0,0,'YXZ'),rotation=new T.Quaternion();
  let lastDraw=-Infinity,active=false,disposed=false;

  function page(name:string,title:string){
    const screen=screens.get(name)!;const c=screen.context;
    c.fillStyle='#07131d';c.fillRect(0,0,screen.canvas.width,screen.canvas.height);
    c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle=CYAN;c.font='bold 17px monospace';c.fillText(title,16,27);
    c.strokeStyle='#254450';c.lineWidth=1;c.beginPath();c.moveTo(16,39);c.lineTo(screen.canvas.width-16,39);c.stroke();
    return c;
  }
  function line(c:CanvasRenderingContext2D,label:string,value:string,y:number){
    c.fillStyle=MUTED;c.font='14px monospace';c.textAlign='left';c.fillText(label,18,y);
    c.fillStyle=TEXT;c.font='bold 17px monospace';c.textAlign='right';c.fillText(value,490,y);c.textAlign='left';
  }
  function plot(c:CanvasRenderingContext2D,values:Float32Array,max:number,y:number,color:string){
    c.strokeStyle=color;c.lineWidth=2;c.beginPath();
    for(let i=0;i<history.count;i++){
      const n=(history.cursor-history.count+i+values.length)%values.length;
      const x=20+i/(values.length-1)*470,py=y-Math.min(1,values[n]/max)*45;
      if(i===0)c.moveTo(x,py);else c.lineTo(x,py);
    }c.stroke();
  }
  function update(rover:RoverVehicle,scan?:LidarScan,curiosity?:{x:number;z:number}|null){
    if(disposed)return;
    const interval=active||rover.driving?ROVER_INSTRUMENT_INTERVAL_MS:1000;
    const now=performance.now();if(now-lastDraw<interval)return;
    lastDraw=now;
    const v=roverInstrumentValues(rover);history.record(rover);
    let c=page(SCREEN_NAMES[1],'');
    c.fillStyle=CYAN;c.font='bold 49px monospace';c.fillText(`${v.speedKmh.toFixed(1)} KM/H`,20,63);
    c.fillStyle=AMBER;c.fillText(v.gear,400,63);c.fillStyle=TEXT;c.fillText(`${v.heading.toFixed(0).padStart(3,'0')}°`,580,63);
    c.font='bold 22px monospace';c.fillText(`${v.battery.toFixed(1)}%`,850,63);
    c.fillStyle=MUTED;c.font='17px monospace';c.fillText(rover.handbrake?'PARK BRAKE SET':rover.boostActive?'BOOST ACTIVE':rover.driving?'DRIVING':'PARKED',20,107);
    c.fillText(v.charging,400,107);c.fillText(`RANGE ${v.rangeKm.toFixed(1)} KM`,745,107);

    c=page(SCREEN_NAMES[0],'MARS MAP / LIVE POSITION');
    const cx=256,cy=152,k=1.25;
    c.save();c.beginPath();c.rect(16,45,480,205);c.clip();
    if(mapImage.complete&&mapImage.naturalWidth)c.drawImage(mapImage,cx+(B.west-rover.x)*k,cy+(B.north-rover.z)*k,(B.east-B.west)*k,(B.south-B.north)*k);
    c.strokeStyle='#91b0b455';c.lineWidth=1;
    for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(cx+i*40,45);c.lineTo(cx+i*40,250);c.moveTo(16,cy+i*40);c.lineTo(496,cy+i*40);c.stroke();}
    c.font='bold 12px monospace';
    for(const place of MARS_LANDMARKS){
      const dx=(place.x-rover.x)*k,dz=(place.z-rover.z)*k,s=Math.min(1,221/Math.max(.001,Math.abs(dx)),86/Math.max(.001,Math.abs(dz)));
      c.fillStyle=AMBER;c.fillRect(cx+dx*s-8,cy+dz*s-8,16,16);c.fillStyle='#07131d';c.fillText(String(place.number),cx+dx*s-4,cy+dz*s+4);
    }
    c.fillStyle=CYAN;c.fillRect(cx-rover.x*k-5,cy+(-65-rover.z)*k-5,10,10);
    c.fillText('BASE',cx-rover.x*k+8,cy+(-65-rover.z)*k+3);
    if(curiosity){c.fillStyle='#d9b5ff';c.fillRect(cx+(curiosity.x-rover.x)*k-3,cy+(curiosity.z-rover.z)*k-3,6,6);}
    for(const contact of scan?.contacts??[]){c.fillStyle=contact.inPath?AMBER:CYAN;c.fillRect(cx+(contact.x-rover.x)*k-2,cy+(contact.z-rover.z)*k-2,4,4);}
    c.save();c.translate(cx,cy);c.rotate(-rover.yaw);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-11);c.lineTo(7,8);c.lineTo(0,4);c.lineTo(-7,8);c.closePath();c.fill();c.restore();c.restore();
    c.fillStyle=TEXT;c.font='14px monospace';c.fillText(`N ↑   X ${rover.x.toFixed(0)}m / Z ${rover.z.toFixed(0)}m`,18,273);

    c=page(SCREEN_NAMES[2],'POWER / VEHICLE SYSTEMS');
    line(c,'BATTERY',`${v.battery.toFixed(1)} %`,69);
    c.fillStyle='#28434b';c.fillRect(18,84,472,14);c.fillStyle=CYAN;c.fillRect(18,84,472*Math.max(0,Math.min(1,v.battery/100)),14);
    line(c,'POWER SOURCE',v.charging,126);
    line(c,'SOLAR GENERATION',`${v.solarRate.toFixed(3)} %/s`,159);
    line(c,'DRIVING DEMAND',`${(rover.driving?v.drainRate:0).toFixed(3)} %/s`,192);
    line(c,'ESTIMATED RANGE',`${v.rangeKm.toFixed(1)} km`,225);
    line(c,'ROOF / SOLAR HEALTH',`${rover.damage.cabin_roof.toFixed(0)} / ${rover.damage.solar_array.toFixed(0)} %`,258);

    c=page(SCREEN_NAMES[3],'TRACTION / SIX WHEEL SUSPENSION');
    for(let i=0;i<6;i++){
      const x=i%2?266:18,y=68+Math.floor(i/2)*56;
      c.fillStyle=rover.damage[ROVER_WHEEL_PARTS[i]]<=25?AMBER:CYAN;c.font='bold 16px monospace';
      c.fillText(`${['FL','FR','ML','MR','RL','RR'][i]}  ${rover.damage[ROVER_WHEEL_PARTS[i]].toFixed(0)}%`,x,y);
      c.fillStyle=MUTED;c.font='13px monospace';c.fillText(`TRAVEL ${(rover.wheelCompression[i]*100).toFixed(1)} cm`,x,y+22);
    }
    line(c,'SLOPE / ROLL',`${v.slope.toFixed(1)}° / ${v.roll.toFixed(1)}°`,238);
    line(c,'STEER / SOFT GROUND',`${v.steering.toFixed(0)}° / ${(rover.mudDepth*100).toFixed(0)}%`,271);

    c=page(SCREEN_NAMES[4],'ROVER / RECENT TELEMETRY');
    line(c,'SPEED',`${v.speedKmh.toFixed(1)} km/h`,66);plot(c,history.speed,50,128,CYAN);
    line(c,'BATTERY',`${v.battery.toFixed(1)} %`,159);plot(c,history.battery,100,218,AMBER);
    line(c,'DRIVE STATE',rover.handbrake?'PARK BRAKE':rover.driving?'CREW DRIVING':'PARKED',255);
    for(const screen of screens.values())screen.texture.needsUpdate=true;
  }
  return {ready,interior,screenCount:boundScreens.size,ownsMaterial:(material:T.Material)=>ownedMaterials.has(material),
    setActive(value:boolean){if(value&&!active)lastDraw=-Infinity;active=value;},
    update,
    positionCamera(camera:T.Camera,root:T.Object3D,yaw:number,pitch:number){
      root.updateWorldMatrix(true,false);camera.position.copy(seat);root.localToWorld(camera.position);
      angles.set(T.MathUtils.clamp(pitch,-1.15,.9),yaw,0,'YXZ');camera.quaternion.setFromEuler(angles);
      camera.quaternion.premultiply(root.getWorldQuaternion(rotation));
    },
    dispose(){disposed=true;finishMap();mapImage.onload=mapImage.onerror=null;fill.dispose();for(const screen of screens.values()){screen.texture.dispose();screen.material.dispose();}screens.clear();ownedMaterials.clear();},
  };
}
