import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createInstanceVisibility} from '../ui/world/instanceVisibility.ts';

function frustumAt(x=0){
  const camera=new T.OrthographicCamera(-4,4,4,-4,.1,30);
  camera.position.set(x,0,10);camera.lookAt(x,0,0);camera.updateMatrixWorld();
  return new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
}

test('static instance culling preserves visible transforms and colours, and restores them on reentry',()=>{
  const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial(),mesh=new T.InstancedMesh(geometry,material,3);
  const matrix=new T.Matrix4();
  for(let i=0;i<3;i++){mesh.setMatrixAt(i,matrix.makeTranslation(i*20,0,0));mesh.setColorAt(i,new T.Color().setRGB(i/3,.5,1-i/3));}
  mesh.updateMatrixWorld();
  const matrices=mesh.instanceMatrix.array.slice(),colors=mesh.instanceColor.array.slice();
  const controller=createInstanceVisibility(mesh),originalSphere=mesh.boundingSphere.clone();
  controller.update(frustumAt(20));
  assert.equal(mesh.count,1);assert.ok(mesh.visible);
  assert.deepEqual(mesh.instanceMatrix.array.slice(0,16),matrices.slice(16,32));
  assert.deepEqual(mesh.instanceColor.array.slice(0,3),colors.slice(3,6));
  const version=mesh.instanceMatrix.version,colorVersion=mesh.instanceColor.version;
  controller.update(frustumAt(20));
  assert.equal(mesh.instanceMatrix.version,version,'unchanged visibility must not upload matrices every frame');
  assert.equal(mesh.instanceColor.version,colorVersion);
  controller.update(frustumAt(100));assert.equal(mesh.count,0);assert.equal(mesh.visible,false);
  controller.update(frustumAt(0));assert.equal(mesh.count,1);assert.ok(mesh.visible);
  assert.deepEqual(mesh.instanceMatrix.array.slice(0,16),matrices.slice(0,16));
  const camera=new T.OrthographicCamera(-100,100,100,-100,.1,100);camera.position.z=50;camera.updateMatrixWorld();
  controller.update(new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)));
  assert.equal(mesh.count,3);assert.deepEqual(mesh.instanceMatrix.array,matrices);assert.deepEqual(mesh.instanceColor.array,colors);
  assert.deepEqual(mesh.boundingSphere,originalSphere,'aggregate bound must retain all original instances');
  mesh.dispose();geometry.dispose();material.dispose();
});

test('instance bounds include the building transform, scale and screen-edge overlap',()=>{
  const geometry=new T.BoxGeometry(),material=new T.MeshStandardMaterial(),mesh=new T.InstancedMesh(geometry,material,2);
  mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,0,0));mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(20,0,0));
  const building=new T.Group();building.position.x=20;building.scale.setScalar(2);building.add(mesh);building.updateMatrixWorld(true);
  const controller=createInstanceVisibility(mesh);
  controller.update(frustumAt(20));assert.equal(mesh.count,1);
  controller.update(frustumAt(60));assert.equal(mesh.count,1);assert.equal(mesh.instanceMatrix.array[12],20);
  controller.update(frustumAt(65.8));assert.equal(mesh.count,1,'scaled sphere and small padding retain geometry touching the frame');
  controller.update(frustumAt(67));assert.equal(mesh.count,0);
  mesh.dispose();geometry.dispose();material.dispose();
});
