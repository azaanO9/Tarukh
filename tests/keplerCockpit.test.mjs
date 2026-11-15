import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createKeplerCockpit} from '../ui/world/keplerCockpit.ts';
import {spawnRoverVehicle} from '../game/roverVehicle.ts';

const names=['Display 01 Terrain','Display 02 Drive Strip','Display 03 Systems','Display 04 Traction','Aft core spectrum'];

function fixture(t) {
  const canvases=[];
  const previousDocument=globalThis.document,previousImage=globalThis.Image;
  t.after(()=>{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;if(previousImage===undefined)delete globalThis.Image;else globalThis.Image=previousImage;});
  globalThis.document={createElement:()=>{
    const text=[];
    const context=new Proxy({fillText:value=>text.push(value)}, {get:(target,key)=>target[key]??(()=>{})});
    const canvas={width:0,height:0,getContext:()=>context,text};canvases.push(canvas);return canvas;
  }};
  globalThis.Image=class {complete=true;naturalWidth=0;set src(value){queueMicrotask(()=>this.onload?.());}};
  const model=new T.Group(),interior=new T.Group();interior.name='Kepler_Interior';model.add(interior);
  for(const name of [...names,'Cabin trim']){
    const material=new T.MeshStandardMaterial();material.name=name;
    interior.add(new T.Mesh(new T.PlaneGeometry(),material));
  }
  const eye=new T.Object3D();eye.name='Kepler_DriverEye';eye.position.set(-.0075,1.918,.222);model.add(eye);
  const cockpit=createKeplerCockpit(model);
  return {cockpit,model,interior,eye,canvases};
}

test('five authored screens show changing telemetry, refresh at 4 Hz and never add scene lights', async t => {
  let now=0;t.mock.method(performance,'now',()=>now);
  const {cockpit,model,interior,canvases}=fixture(t),rover=spawnRoverVehicle(20,-12,0);
  await cockpit.ready;cockpit.setActive(true);cockpit.update(rover);
  assert.equal(cockpit.screenCount,5);
  const displays=interior.children.slice(0,5);
  assert.ok(displays.every(o=>o.material instanceof T.MeshBasicMaterial));
  assert.ok(displays.every(o=>o.material.map.flipY===false&&o.material.map.generateMipmaps===false));
  assert.ok(canvases[0].text.includes('N ↑   X 20m / Z -12m'));
  for(let i=1;i<=7;i++)assert.ok(canvases[0].text.includes(String(i)));
  const versions=displays.map(o=>o.material.map.version);
  now=240;rover.speed=5;rover.battery=42;rover.garageCharging=true;rover.wheelCompression[0]=.12;rover.damage.wheel_fl=20;
  cockpit.update(rover);assert.deepEqual(displays.map(o=>o.material.map.version),versions);
  now=250;cockpit.update(rover);
  assert.ok(canvases[1].text.includes('18.0 KM/H'));
  assert.ok(canvases[2].text.includes('42.0 %'));assert.ok(canvases[2].text.includes('GARAGE DOCK'));
  assert.ok(canvases[3].text.includes('FL  20%'));assert.ok(canvases[3].text.includes('TRAVEL 12.0 cm'));
  assert.ok(canvases[4].text.includes('18.0 km/h'));
  assert.deepEqual(displays.map(o=>o.material.map.version),versions.map(v=>v+1));
  cockpit.setActive(false);now=500;cockpit.update(rover);
  assert.deepEqual(displays.map(o=>o.material.map.version),versions.map(v=>v+1));
  now=1250;cockpit.update(rover);
  assert.deepEqual(displays.map(o=>o.material.map.version),versions.map(v=>v+2),'parked displays update at 1 Hz');
  let lights=0;model.traverse(o=>{if(o.isLight)lights++;});assert.equal(lights,0);
  const resources=interior.children.map(o=>o.material).concat(displays.map(o=>o.material.map));
  let disposed=0;for(const resource of resources)resource.addEventListener('dispose',()=>disposed++);
  cockpit.dispose();assert.equal(disposed,resources.length);
  now=2000;cockpit.update(rover);assert.equal(disposed,resources.length);
});

test('supplied driver anchor follows unchanged chassis pose and permits a rearward cabin view', async t => {
  const {cockpit,model,eye}=fixture(t);await cockpit.ready;
  model.position.set(10,4,-17);model.rotation.set(.2,1.1,-.15,'YXZ');
  const camera=new T.PerspectiveCamera();cockpit.positionCamera(camera,model,Math.PI,.25);
  const position=eye.position.clone().applyMatrix4(model.matrixWorld);
  const orientation=new T.Quaternion().setFromEuler(new T.Euler(.25,Math.PI,0,'YXZ')).premultiply(model.quaternion);
  assert.ok(camera.position.distanceTo(position)<1e-10);
  assert.ok(camera.quaternion.angleTo(orientation)<1e-7);
  cockpit.dispose();
});

test('disposing a cockpit while its map loads settles readiness', async t => {
  const {cockpit}=fixture(t);cockpit.dispose();await cockpit.ready;
});
