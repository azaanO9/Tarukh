import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createDetailDistanceCulling} from '../ui/world/detailDistanceCulling.ts';

function cameraAt(x=0,y=0,z=0,yaw=0){
  const camera=new T.PerspectiveCamera(58,16/9,.08,2600);
  camera.position.set(x,y,z);camera.rotation.y=yaw;camera.updateMatrixWorld();return camera;
}
const onMainLayer=object=>(object.layers.mask&1)!==0;
function disposeScene(scene){
  const geometries=new Set(),materials=new Set();
  scene.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
  });
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
}

test('detail range uses the original far plane and keeps side/behind geometry available to native frusta and shadows',()=>{
  const scene=new T.Scene(),geometry=new T.SphereGeometry(1,8,6),material=new T.MeshBasicMaterial();
  const mesh=(x,z)=>{const object=new T.Mesh(geometry,material);object.position.set(x,0,z);scene.add(object);return object;};
  const near=mesh(0,-99),edge=mesh(0,-100.5),far=mesh(0,-102),side=mesh(1000,-50),behind=mesh(0,1000);
  const camera=cameraAt();scene.updateMatrixWorld();
  const culling=createDetailDistanceCulling(scene);
  try{
    culling.update(camera,100);
    assert.equal(culling.count,5);assert.equal(culling.culled,1);
    assert.ok(onMainLayer(near));assert.ok(onMainLayer(edge));assert.ok(!onMainLayer(far));
    assert.ok(onMainLayer(side),'Euclidean distance must not remove lateral shadow casters');
    assert.ok(onMainLayer(behind),'the helper does not duplicate the native near/back frustum');
    camera.rotation.y=Math.PI;camera.updateMatrixWorld();culling.update(camera,100);
    assert.ok(onMainLayer(far),'turning around restores geometry now behind the camera');
    assert.ok(!onMainLayer(behind),'the newly forward object obeys the original range');
    culling.update(camera,1500);assert.ok(onMainLayer(behind));
  }finally{culling.dispose();disposeScene(scene);}
});

test('parent transforms, nonuniform scale and moving cameras are included in the world bounding sphere',()=>{
  const scene=new T.Scene(),group=new T.Group(),mesh=new T.Mesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial());
  group.position.set(25,0,-200);group.scale.set(5,2,3);group.add(mesh);scene.add(group);scene.updateMatrixWorld();
  const camera=cameraAt(25,0,-100),culling=createDetailDistanceCulling(scene);
  try{
    culling.update(camera,96);assert.ok(onMainLayer(mesh),'scaled sphere intersects the far plane');
    culling.update(camera,94);assert.ok(!onMainLayer(mesh));
    group.position.z=-190;scene.updateMatrixWorld();culling.update(camera,94);assert.ok(onMainLayer(mesh));
    camera.position.z=-80;camera.updateMatrixWorld();culling.update(camera,94);assert.ok(!onMainLayer(mesh));
  }finally{culling.dispose();disposeScene(scene);}
});

test('empty instance pools acquire valid bounds on activation and current instance bounds are read after relocation',()=>{
  const scene=new T.Scene(),mesh=new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial(),1);
  mesh.count=0;scene.add(mesh);scene.updateMatrixWorld();
  const camera=cameraAt(),transform=new T.Matrix4(),compute=mesh.computeBoundingSphere.bind(mesh);
  let computes=0;mesh.computeBoundingSphere=()=>{computes++;compute();};
  const culling=createDetailDistanceCulling(scene);
  try{
    culling.update(camera,100);assert.equal(computes,0);assert.equal(mesh.boundingSphere,null);
    mesh.setMatrixAt(0,transform.makeTranslation(0,0,-150));mesh.count=1;
    culling.update(camera,100);assert.equal(computes,1);assert.ok(!onMainLayer(mesh));
    const bound=mesh.boundingSphere;assert.ok(!bound.isEmpty());
    mesh.setMatrixAt(0,transform.makeTranslation(0,0,-30));mesh.computeBoundingSphere();
    culling.update(camera,100);assert.equal(mesh.boundingSphere,bound);assert.ok(onMainLayer(mesh));
    mesh.count=0;mesh.computeBoundingSphere();assert.ok(bound.isEmpty());
    culling.update(camera,100);assert.equal(computes,3,'empty pools are not repeatedly recomputed');
    mesh.setMatrixAt(0,transform.makeTranslation(0,0,-180));mesh.count=1;
    culling.update(camera,100);assert.equal(mesh.boundingSphere,bound);assert.ok(!bound.isEmpty());assert.ok(!onMainLayer(mesh));
  }finally{culling.dispose();mesh.dispose();disposeScene(scene);}
});

test('skinned mesh bounds and updated geometry bounds take precedence over stale geometry or transform snapshots',()=>{
  const scene=new T.Scene(),geometry=new T.SphereGeometry(1,8,6),material=new T.MeshBasicMaterial();
  const skin=new T.SkinnedMesh(geometry,material);skin.boundingSphere=new T.Sphere(new T.Vector3(0,0,-150),2);
  const points=new T.Points(geometry.clone(),new T.PointsMaterial());
  scene.add(skin,points);scene.updateMatrixWorld();
  const camera=cameraAt(),culling=createDetailDistanceCulling(scene);
  try{
    culling.update(camera,100);assert.ok(!onMainLayer(skin));assert.ok(onMainLayer(points));
    skin.boundingSphere.center.z=-20;
    points.geometry.boundingSphere=new T.Sphere(new T.Vector3(0,0,-200),3);
    culling.update(camera,100);assert.ok(onMainLayer(skin));assert.ok(!onMainLayer(points));
  }finally{culling.dispose();disposeScene(scene);}
});

test('exclusions, visibility, group/light layers and non-owned layer bits survive updates and disposal',()=>{
  const scene=new T.Scene(),geometry=new T.BoxGeometry(),material=new T.MeshBasicMaterial();
  const hidden=new T.Mesh(geometry,material);hidden.position.z=-200;hidden.visible=false;hidden.layers.enable(3);
  const excluded=new T.Mesh(geometry,material);excluded.position.z=-200;excluded.name='regional';
  const otherLayer=new T.Mesh(geometry,material);otherLayer.position.z=-200;otherLayer.layers.set(2);
  const group=new T.Group(),light=new T.PointLight();group.layers.enable(4);light.layers.enable(5);group.add(hidden);
  const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,-200),new T.Vector3(1,0,-200)]),new T.LineBasicMaterial());
  scene.add(group,light,excluded,otherLayer,line);scene.updateMatrixWorld();
  const originalGroup=group.layers.mask,originalLight=light.layers.mask,camera=cameraAt();
  const culling=createDetailDistanceCulling(scene,object=>object.name==='regional');
  try{
    culling.update(camera,100);
    assert.equal(culling.count,2);assert.equal(culling.culled,2);
    assert.ok(!onMainLayer(hidden));assert.ok(!onMainLayer(line));assert.ok(onMainLayer(excluded));
    assert.equal(hidden.visible,false);assert.equal(hidden.layers.mask,1<<3);
    assert.equal(otherLayer.layers.mask,1<<2);assert.equal(group.layers.mask,originalGroup);assert.equal(light.layers.mask,originalLight);
    hidden.layers.enable(6);hidden.layers.disable(3);
    culling.dispose();
    assert.equal(hidden.layers.mask,1|(1<<6));assert.ok(onMainLayer(line));assert.equal(hidden.visible,false);
    assert.equal(otherLayer.layers.mask,1<<2);assert.equal(group.layers.mask,originalGroup);assert.equal(light.layers.mask,originalLight);
    assert.equal(culling.count,0);assert.equal(culling.culled,0);
    culling.update(camera,10);culling.dispose();assert.equal(hidden.layers.mask,1|(1<<6));
  }finally{culling.dispose();disposeScene(scene);}
});
