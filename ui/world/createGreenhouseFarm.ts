import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {assetUrl} from '../../lib/assetUrl.ts';
import {GREENHOUSE_GROUND_HEIGHTS} from '../../game/marsExpeditionTerrain.ts';
import {GREENHOUSE_PAD, GREENHOUSE_SCALE, GREENHOUSE_SITES} from '../../game/greenhouseSites.ts';
import {createGreenhouseStates, type GreenhouseLayout, type GreenhouseState} from '../../game/greenhouses.ts';
import {nearestOutpostDoor, stepOutpostDoor, toggleOutpostDoor, type OutpostDoor} from '../../game/outpost.ts';
import type {CollisionObstacle} from '../../game/collision.ts';

type Batch = {
  mesh: T.InstancedMesh; part: string; template: T.Matrix4; travel: T.Vector3;
  doors: (OutpostDoor | undefined)[]; previous: Float64Array; mask: number;
};

/** One shared greenhouse asset, six placements, and no imported terrain. */
export function createGreenhouseFarm(scene: T.Scene, obstacles: CollisionObstacle[]) {
  const root = new T.Group(); root.name = 'TARUKH cultivation district'; scene.add(root);
  const batches: Batch[] = [];
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  const scale = new T.Vector3().setScalar(GREENHOUSE_SCALE);
  const matrices = GREENHOUSE_SITES.map((site,i) => new T.Matrix4().makeRotationY(site.yaw).scale(scale).setPosition(site.x,GREENHOUSE_GROUND_HEIGHTS[i]+GREENHOUSE_PAD.foundationOffset,site.z));
  const matrix = new T.Matrix4(), translation = new T.Matrix4();
  const viewMatrix = new T.Matrix4(), frustum = new T.Frustum();
  const bounds = matrices.map(transform => new T.Sphere(new T.Vector3(0,2.2,0).applyMatrix4(transform),8 * GREENHOUSE_SCALE));
  const ray = new T.Ray(), localRay = new T.Ray(), hit = new T.Vector3(), origin = new T.Vector3(), direction = new T.Vector3();
  const cameraBoxes: {obstacle: CollisionObstacle; inverse: T.Matrix4; box: T.Box3}[] = [];
  let states: GreenhouseState[] = [], doors: OutpostDoor[] = [], disposed = false, loaded = false;
  let layout: GreenhouseLayout;

  function remember(object: T.Object3D) {
    object.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
      }
    });
  }
  function freeResources() {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    geometries.clear(); materials.clear(); textures.clear();
  }
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const modelReady = loader.loadAsync(assetUrl('/models/greenhouse/cultivation.glb')).then(model => {
    remember(model.scene); if (disposed) freeResources(); return model;
  });
  const ready = Promise.all([modelReady, fetch(assetUrl('/models/greenhouse/layout.json')).then(response => {
    if (!response.ok) throw new Error('Greenhouse floor plan could not load');
    return response.json() as Promise<GreenhouseLayout>;
  })]).then(([model, data]) => {
    if (disposed) { freeResources(); return; }
    layout = data; states = createGreenhouseStates(layout,GREENHOUSE_GROUND_HEIGHTS);
    doors = states.flatMap(state => state.doors);
    model.scene.updateMatrixWorld(true);
    for (const material of materials) {
      if (material instanceof T.MeshStandardMaterial && material.name === 'Smoked sight glass') {
        material.transparent = true; material.opacity = .32; material.depthWrite = false; material.forceSinglePass = true;
      }
    }
    model.scene.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      let parent: T.Object3D | null = node;
      while (parent && !parent.userData.greenhousePart) parent = parent.parent;
      if (!parent) return;
      const part = String(parent.userData.greenhousePart);
      const mesh = new T.InstancedMesh(node.geometry,node.material,GREENHOUSE_SITES.length);
      mesh.name = 'Greenhouses / ' + part;
      mesh.castShadow = part === 'shell'; mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      root.add(mesh);
      batches.push({mesh, part, template:node.matrixWorld.clone(), travel:new T.Vector3(...(parent.userData.travel ?? [0,0,0]) as [number,number,number]),
        doors:states.map(state => state.doors.find(door => door.clip === parent!.userData.door)), previous:new Float64Array(states.length).fill(-1), mask:-1});
    });
    for (const state of states) {
      obstacles.push(...state.obstacles);
      for (const obstacle of state.obstacles) {
        let hx = obstacle.halfX, hz = obstacle.halfZ;
        if (hx === undefined || hz === undefined) {
          hx = Math.max(...obstacle.hull!.map(p => Math.abs(p.x)));
          hz = Math.max(...obstacle.hull!.map(p => Math.abs(p.z)));
        }
        const inverse = new T.Matrix4().makeRotationY(obstacle.yaw ?? 0).setPosition(obstacle.x,state.baseY,obstacle.z).invert();
        cameraBoxes.push({obstacle,inverse,box:new T.Box3(new T.Vector3(-hx,-.1 * GREENHOUSE_SCALE,-hz),new T.Vector3(hx,(obstacle.id?.includes('equipment')?2.4:3.1) * GREENHOUSE_SCALE,hz))});
      }
    }
    buildRamps(); buildLabels();
    loaded = true;
    // Populate every batch once before shader/texture warmup. Distance culling
    // starts with the ordinary game loop; nothing uploads on first approach.
    updateBatches((1 << states.length)-1,(1 << states.length)-1);
  });

  function buildRamps() {
    const material = new T.MeshStandardMaterial({color:'#6a716f',metalness:.65,roughness:.58});
    materials.add(material);
    for (const door of layout.doors) {
      const {start,length,halfWidth} = layout.ramp;
      const groundY = -GREENHOUSE_PAD.foundationOffset / GREENHOUSE_SCALE;
      const corners = [[-halfWidth,start,layout.deckHeight],[halfWidth,start,layout.deckHeight],[-halfWidth,start+length,groundY],[halfWidth,start+length,groundY]];
      const positions = corners.flatMap(([side,forward,y]) => [door.x+door.nz*side+door.nx*forward,y,door.z-door.nx*side+door.nz*forward]);
      const geometry = new T.BufferGeometry(); geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.setIndex([0,2,1,1,2,3]); geometry.computeVertexNormals(); geometries.add(geometry);
      const mesh = new T.InstancedMesh(geometry,material,states.length);
      mesh.name = 'Greenhouses / access ramps'; mesh.receiveShadow = true;
      for (let i=0;i<states.length;i++) mesh.setMatrixAt(i,matrices[i]);
      mesh.computeBoundingSphere(); root.add(mesh);
    }
  }

  function buildLabels() {
    const canvas = document.createElement('canvas'); canvas.width=512; canvas.height=256;
    const context = canvas.getContext('2d'); if (!context) return;
    const pieces: T.BufferGeometry[] = [];
    for (let i=0;i<states.length;i++) {
      const col=i%2,row=Math.floor(i/2),x=col*256,y=row*80;
      context.fillStyle='#142e32';context.fillRect(x,y,256,80);
      context.fillStyle='#effbe9';context.font='bold 27px system-ui';context.fillText(`GH ${String(i+1).padStart(2,'0')}`,x+14,y+33);
      context.fillStyle='#c2df9c';context.font='16px system-ui';context.fillText('FOOD CULTIVATION',x+14,y+60);
      const d=states[i].doors.find(door => door.clip==='main')!;
      const geometry=new T.PlaneGeometry(1.65 * GREENHOUSE_SCALE,.5 * GREENHOUSE_SCALE),uv=geometry.getAttribute('uv');
      for(let j=0;j<uv.count;j++)uv.setXY(j,(x+uv.getX(j)*256)/512,1-(y+(1-uv.getY(j))*80)/256);
      matrix.makeRotationY(Math.atan2(d.nx,d.nz)).setPosition(d.x+d.nx*.31 * GREENHOUSE_SCALE,states[i].baseY+2.65 * GREENHOUSE_SCALE,d.z+d.nz*.31 * GREENHOUSE_SCALE);
      geometry.applyMatrix4(matrix);pieces.push(geometry);
    }
    const geometry=mergeGeometries(pieces);for(const piece of pieces)piece.dispose();
    if (!geometry) return;
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);
    const material=new T.MeshBasicMaterial({map:texture});materials.add(material);geometries.add(geometry);
    const mesh=new T.Mesh(geometry,material);mesh.name='Cultivation bay labels';root.add(mesh);
  }

  function updateBatches(shellMask: number, interiorMask: number) {
    for(const batch of batches) {
      const mask=batch.part==='interior'?interiorMask:shellMask;
      let changed=batch.mask!==mask;
      for(let i=0;i<states.length;i++)if(batch.previous[i] !== (batch.doors[i]?.amount ?? 0))changed=true;
      if(!changed)continue;
      batch.mask=mask;let count=0;
      for(let i=0;i<states.length;i++) {
        const amount=batch.doors[i]?.amount ?? 0;batch.previous[i]=amount;
        if(!(mask & (1<<i)))continue;
        translation.makeTranslation(batch.travel.x*amount,batch.travel.y*amount,batch.travel.z*amount);
        matrix.copy(matrices[i]).multiply(translation).multiply(batch.template);
        batch.mesh.setMatrixAt(count++,matrix);
      }
      batch.mesh.count=count;batch.mesh.visible=count>0;batch.mesh.instanceMatrix.needsUpdate=true;
      if(count)batch.mesh.computeBoundingSphere();
    }
  }

  function update(dt: number,x: number,y: number,z: number,enabled: boolean) {
    if(!loaded)return;
    if(enabled)for(const door of doors)stepOutpostDoor(door,dt,x,y,z);
  }
  function updateVisibility(camera: T.Camera,x: number,z: number,performance: boolean) {
    if(!loaded)return;
    camera.updateMatrixWorld();
    viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewMatrix);
    let shellMask=0,interiorMask=0;
    for(let i=0;i<states.length;i++) {
      const {site}=states[i],distance=(x-site.x)**2+(z-site.z)**2;
      // InstancedMesh culls its combined bounds. Cull each building as well,
      // so looking into one bay does not submit all six shells to the GPU.
      if(!frustum.intersectsSphere(bounds[i]))continue;
      if(distance<(performance?220:400)**2)shellMask|=1<<i;
      if(distance<(performance?12:18)**2)interiorMask|=1<<i;
    }
    updateBatches(shellMask,interiorMask);
  }
  function floorAt(x: number,z: number,ground: number) {for(const state of states)ground=state.floorAt(x,z,ground);return ground;}
  function indoors(x: number,z: number) {return states.some(state=>state.inside(x,z));}
  function ceilingAt(x: number,z: number) {
    for(const state of states)if(state.inside(x,z))return state.baseY+(Math.hypot(x-state.site.x,z-state.site.z)<2.5 * GREENHOUSE_SCALE?2.25:3.08) * GREENHOUSE_SCALE;
    return Infinity;
  }
  function nearby(x: number,y: number,z: number,yaw: number) {return nearestOutpostDoor(doors,x,y,z,yaw);}
  function interact(x: number,y: number,z: number,yaw: number) {
    const door=nearby(x,y,z,yaw);if(!door)return false;toggleOutpostDoor(door,x,y,z);return true;
  }
  function constrainCamera(x: number,y: number,z: number,position: T.Vector3) {
    if(!states.some(state=>Math.abs(x-state.site.x)<10 * GREENHOUSE_SCALE&&Math.abs(z-state.site.z)<10 * GREENHOUSE_SCALE))return;
    origin.set(x,y,z);direction.copy(position).sub(origin);let distance=direction.length();if(distance<.01)return;
    direction.divideScalar(distance);ray.set(origin,direction);
    for(const entry of cameraBoxes) {
      if(entry.obstacle.disabled||Math.hypot(x-entry.obstacle.x,z-entry.obstacle.z)>distance+entry.obstacle.radius)continue;
      localRay.copy(ray).applyMatrix4(entry.inverse);
      if(localRay.intersectBox(entry.box,hit))distance=Math.min(distance,Math.max(.35,localRay.origin.distanceTo(hit)-.15));
    }
    position.copy(origin).addScaledVector(direction,distance);position.y=Math.min(position.y,ceilingAt(position.x,position.z)-.15);
  }
  return {ready,update,updateVisibility,floorAt,indoors,ceilingAt,nearby,interact,constrainCamera,
    get loaded(){return loaded;},get doors(){return doors;},
    dispose(){disposed=true;root.removeFromParent();root.traverse(node=>{if(node instanceof T.InstancedMesh)node.dispose();});freeResources();},
  };
}
