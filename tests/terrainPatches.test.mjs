import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {terrainPatches} from '../ui/world/terrainPatches.ts';
import {createMarsTerrain} from '../ui/world/marsTerrain.ts';
import {createMarsRegionalLandscape} from '../ui/world/marsRegionalLandscape.ts';
import {graphicsTiers} from '../ui/world/graphicsTiers.ts';

test('terrain partition preserves every triangle, attribute and shared edge exactly',()=>{
 const source=new T.PlaneGeometry(12,8,12,8);source.rotateX(-Math.PI/2);
 const p=source.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,Math.sin(p.getX(i))*.4+Math.cos(p.getZ(i))*.2);
 source.computeVertexNormals();
 const patches=terrainPatches(source,3,2);
 try{
  assert.equal(patches.reduce((sum,g)=>sum+g.index.count,0),source.index.count);
  const originals=new Map();
  for(let i=0;i<p.count;i++)originals.set(`${p.getX(i)},${p.getZ(i)}`,i);
  for(const patch of patches){
   const pos=patch.attributes.position;
   assert.ok(patch.boundingBox&&patch.boundingSphere);
   for(let i=0;i<pos.count;i++){
    const index=originals.get(`${pos.getX(i)},${pos.getZ(i)}`);assert.notEqual(index,undefined);
    for(const [name,a] of Object.entries(patch.attributes))for(let c=0;c<a.itemSize;c++){
     assert.equal(a.array[i*a.itemSize+c],source.attributes[name].array[index*a.itemSize+c]);
    }
   }
   for(let i=0;i<patch.index.count;i+=3){
    const a=new T.Vector3().fromBufferAttribute(pos,patch.index.getX(i));
    const b=new T.Vector3().fromBufferAttribute(pos,patch.index.getX(i+1));
    const c=new T.Vector3().fromBufferAttribute(pos,patch.index.getX(i+2));
    assert.ok(b.sub(a).cross(c.sub(a)).y>0,'Triangles still face up');
   }
  }
 }finally{source.dispose();patches.forEach(p=>p.dispose());}
});

test('base and regional patches reduce submitted triangles without changing local floor samples',()=>{
 const root=new T.Group(),terrain=createMarsTerrain(root);createMarsRegionalLandscape(root);
 try{
  const base=root.children.filter(o=>o.name.startsWith('mars-ground'));
  const far=root.children.filter(o=>o.name.startsWith('MOLA regional relief'));
  assert.equal(base.length,36);assert.equal(far.length,48);
  assert.equal(base.reduce((sum,m)=>sum+m.geometry.index.count/3,0),352800);
  assert.equal(far.reduce((sum,m)=>sum+m.geometry.index.count/3,0),98304);
  const camera=new T.PerspectiveCamera(58,16/9,.08,320),frustum=new T.Frustum(),matrix=new T.Matrix4();
  camera.position.set(0,4,21);camera.lookAt(0,2,-20);camera.updateMatrixWorld();root.updateMatrixWorld();
  for(const tier of Object.values(graphicsTiers)){
   camera.far=tier.viewDistance;camera.updateProjectionMatrix();
   frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   const triangles=[...base,...far].filter(m=>frustum.intersectsObject(m)).reduce((sum,m)=>sum+m.geometry.index.count/3,0);
   assert.ok(triangles<300000,'Visible terrain submits fewer triangles in every tier');
  }
  for(const patch of base){
   const p=patch.geometry.attributes.position;
   for(const i of [0,70,5040])assert.ok(Math.abs(terrain.heightAt(p.getX(i),p.getZ(i))-p.getY(i))<1e-5);
  }
  terrain.setLightSurfaces(true);assert.ok(base.every(m=>m.material===base[0].material));
  terrain.setLightSurfaces(false);assert.ok(base.every(m=>m.material===base[0].material));
 }finally{
  terrain.disposeTracks();root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
 }
});

