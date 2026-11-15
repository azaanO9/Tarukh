import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { occlusionSize, BoundedGTAOPass } from '../ui/world/BoundedGTAOPass.ts';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

function rendererState() {
  const color=new T.Color(0x18334d);let alpha=.4;
  return {
    shadowMap:{autoUpdate:true,needsUpdate:true},autoClear:true,
    getClearColor(target){return target.copy(color);},getClearAlpha(){return alpha;},
    setClearColor(value,nextAlpha){color.set(value);if(nextAlpha!==undefined)alpha=nextAlpha;},
  };
}

function depthBuffer() {
  return new T.WebGLRenderTarget(64,64,{depthTexture:new T.DepthTexture(64,64)});
}

test('contact shading remains bounded at laptop, retina and narrow-screen sizes',()=>{
  for(const [w,h] of [[1280,720],[3840,2160],[390,844],[1,1]]) {
    const [x,y]=occlusionSize(w,h);
    assert.ok(x>=1&&y>=1&&Math.max(x,y)<=768);
    assert.ok(x*y<=Math.max(1,w*h*.251));
    assert.ok(Math.abs(x/y-w/h)<.02);
  }
});

test('distant relief skips AO before normal reconstruction while preserving the detail boundary',()=>{
  const camera=new T.PerspectiveCamera(58,16/9,.08,2600);
  const pass=new BoundedGTAOPass(new T.Scene(),camera,64,64);
  try{
    const shader=pass.gtaoMaterial.fragmentShader;
    const condition=shader.match(/if \(([^\n]+aoDetailDistance)\) \{\s*gl_FragColor = vec4\(1\.0\);\s*return;\s*\}/);
    assert.ok(condition,'far fragments must return neutral AO');
    assert.ok(shader.indexOf(condition[0])>shader.indexOf('vec3 viewPos = getViewPosition(vUv, depth);'));
    assert.ok(shader.indexOf(condition[0])<shader.indexOf('vec3 viewNormal = getViewNormal(vUv);'));
    assert.equal((shader.match(/uniform float aoDetailDistance;/g)??[]).length,1);
    const outsideDetail=new Function('viewPos','aoDetailDistance',`return ${condition[1]};`);
    for(const distance of [320,420,520,650]){
      pass.setDetailDistance(distance);
      const limit=pass.gtaoMaterial.uniforms.aoDetailDistance.value;
      assert.equal(limit,distance);
      assert.equal(outsideDetail({x:1000,y:1000,z:-distance+.01},limit),false,'use the original far plane, not radial distance');
      assert.equal(outsideDetail({x:0,y:0,z:-distance},limit),false,'the boundary retains existing near shading');
      assert.equal(outsideDetail({x:0,y:0,z:-distance-.01},limit),true);
    }
    assert.equal(camera.far,2600,'the horizon projection must remain intact');
    assert.ok(shader.includes('return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);'));
    assert.ok(shader.includes('for (int j = 0; j < STEPS; ++j)'),'near AO sampling is unchanged');
  }finally{pass.dispose();}
});

test('AO detail distance stays finite, preserves its uniform through resizes and avoids tier recompiles',()=>{
  const pass=new BoundedGTAOPass(new T.Scene(),new T.PerspectiveCamera(58,1,.08,2600),64,64);
  const source=depthBuffer(),renderer=rendererState();
  pass._renderOverride=()=>{};pass._renderPass=()=>{};
  try{
    const uniform=pass.gtaoMaterial.uniforms.aoDetailDistance,unbounded=uniform.value;
    assert.ok(Number.isFinite(unbounded)&&Math.fround(unbounded)>2600);
    const version=pass.gtaoMaterial.version,shader=pass.gtaoMaterial.fragmentShader;
    for(const [value,expected] of [[650,650],[0,0],[-1,0],[Infinity,unbounded],[-Infinity,unbounded],[NaN,unbounded],[Number.MAX_VALUE,unbounded],[420,420]]){
      pass.setDetailDistance(value);
      assert.equal(uniform.value,expected);
      assert.ok(Number.isFinite(Math.fround(uniform.value)));
      assert.equal(pass.gtaoMaterial.version,version,'distance changes must only update a uniform');
      assert.equal(pass.gtaoMaterial.fragmentShader,shader);
    }
    pass.setSize(3840,2160);
    assert.equal(pass.gtaoMaterial.uniforms.aoDetailDistance,uniform);assert.equal(uniform.value,420);
    for(const shared of [false,true,false]){
      pass.setReuseSceneDepth(shared);pass.render(renderer,source,source);
      assert.equal(pass.gtaoMaterial.uniforms.aoDetailDistance,uniform);assert.equal(uniform.value,420);
      assert.equal(pass.gtaoMaterial.uniforms.cameraFar.value,2600);
      assert.equal(pass.gtaoMaterial.fragmentShader,shader);
    }
  }finally{pass.dispose();source.depthTexture.dispose();source.dispose();}
});

test('contact shading restores visibility and shadow state even if rendering fails',()=>{
  const scene=new T.Scene(), pane=new T.Mesh(new T.PlaneGeometry(),new T.MeshBasicMaterial({transparent:true}));
  const particles=new T.Points(), line=new T.Line(), override=new T.MeshNormalMaterial();
  scene.add(pane,particles,line);
  const pass=new BoundedGTAOPass(scene,new T.PerspectiveCamera(),64,64);
  const renderer=rendererState();
  const original=GTAOPass.prototype.render;
  GTAOPass.prototype.render=function(){
    assert.equal(renderer.shadowMap.autoUpdate,false);assert.equal(renderer.shadowMap.needsUpdate,false);
    assert.equal(pane.visible,false);assert.equal(particles.visible,false);assert.equal(line.visible,false);
    renderer.autoClear=false;scene.overrideMaterial=override;
    throw new Error('simulated context failure');
  };
  try {assert.throws(()=>pass.render(renderer,null,null),/simulated context failure/);}
  finally {GTAOPass.prototype.render=original;pass.dispose();for(const o of [pane,particles,line]){o.geometry.dispose();o.material.dispose();}override.dispose();}
  assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.shadowMap.needsUpdate,true);assert.equal(pane.visible,true);
  assert.equal(particles.visible,true);assert.equal(line.visible,true);
  assert.equal(renderer.autoClear,true);assert.equal(scene.overrideMaterial,null);
});

test('shared scene depth alternates composer targets without recompiling or traversing geometry',()=>{
  const scene=new T.Scene(),pass=new BoundedGTAOPass(scene,new T.PerspectiveCamera(),64,64);
  const renderer=rendererState(),a=depthBuffer(),b=depthBuffer(),write=new T.WebGLRenderTarget(64,64);
  let normalDraws=0,fullscreenDraws=0;
  pass._renderOverride=()=>normalDraws++;
  pass._renderPass=()=>fullscreenDraws++;
  scene.traverseVisible=()=>{throw new Error('shared depth must not traverse visible geometry');};
  scene.traverse=()=>{throw new Error('shared depth must not traverse the scene');};
  const ownedTarget=pass.normalRenderTarget,ownedDepth=pass.depthTexture;
  try{
    pass.setReuseSceneDepth(true);
    pass.render(renderer,write,a);
    assert.equal(pass.reusingSceneDepth,true);assert.equal(pass._renderGBuffer,false);
    assert.equal(pass.gtaoMaterial.defines.NORMAL_VECTOR_TYPE,0);
    assert.equal(pass.pdMaterial.defines.NORMAL_VECTOR_TYPE,0);
    const gtaoVersion=pass.gtaoMaterial.version,pdVersion=pass.pdMaterial.version;
    for(let frame=0;frame<12;frame++){
      const source=frame%2?a:b;
      pass.setReuseSceneDepth(true);pass.render(renderer,write,source);
      assert.equal(pass.depthTexture,source.depthTexture);
      for(const material of [pass.gtaoMaterial,pass.pdMaterial,pass.depthRenderMaterial])assert.equal(material.uniforms.tDepth.value,source.depthTexture);
      assert.equal(pass.gtaoMaterial.version,gtaoVersion);assert.equal(pass.pdMaterial.version,pdVersion);
      assert.equal(pass.normalRenderTarget,ownedTarget);assert.equal(ownedTarget.depthTexture,ownedDepth);
    }
    assert.equal(normalDraws,0);assert.equal(fullscreenDraws,13*4);
    pass.setSize(1920,1080);
    assert.deepEqual([pass.width,pass.height],[768,432]);
    assert.equal(ownedTarget.depthTexture,ownedDepth);
    assert.equal(a.depthTexture.image.width,64);assert.equal(b.depthTexture.image.width,64);
  }finally{pass.dispose();for(const target of [a,b,write]){target.depthTexture?.dispose();target.dispose();}}
});

test('missing scene depth and disabled reuse restore the original owned normal pass',()=>{
  const scene=new T.Scene(),pass=new BoundedGTAOPass(scene,new T.PerspectiveCamera(),64,64);
  const renderer=rendererState(),withDepth=depthBuffer(),withoutDepth=new T.WebGLRenderTarget(64,64);
  const ownedDepth=pass.depthTexture,ownedNormal=pass.normalTexture,ownedTarget=pass.normalRenderTarget;
  let normalDraws=0;pass._renderOverride=()=>normalDraws++;pass._renderPass=()=>{};
  try{
    pass.render(renderer,withoutDepth,withDepth);
    assert.equal(normalDraws,1);assert.equal(pass.reusingSceneDepth,false,'default still renders normals');
    pass.setReuseSceneDepth(true);pass.render(renderer,withoutDepth,withDepth);
    assert.equal(normalDraws,1);assert.equal(pass.reusingSceneDepth,true);
    const sharedVersion=pass.gtaoMaterial.version;
    pass.render(renderer,withoutDepth,withoutDepth);
    assert.equal(normalDraws,2);assert.equal(pass.reusingSceneDepth,false);assert.equal(pass._renderGBuffer,true);
    assert.equal(pass.gtaoMaterial.defines.NORMAL_VECTOR_TYPE,1);assert.equal(pass.pdMaterial.defines.NORMAL_VECTOR_TYPE,1);
    assert.equal(pass.gtaoMaterial.version,sharedVersion+1);
    assert.equal(pass.depthTexture,ownedDepth);assert.equal(pass.normalTexture,ownedNormal);
    assert.equal(pass.normalRenderTarget,ownedTarget);
    for(const material of [pass.gtaoMaterial,pass.pdMaterial]){
      assert.equal(material.uniforms.tDepth.value,ownedDepth);assert.equal(material.uniforms.tNormal.value,ownedNormal);
    }
    const fallbackVersion=pass.gtaoMaterial.version;
    pass.render(renderer,withoutDepth,withoutDepth);
    assert.equal(pass.gtaoMaterial.version,fallbackVersion);assert.equal(normalDraws,3);
    pass.render(renderer,withoutDepth,withDepth);assert.equal(pass.reusingSceneDepth,true);
    pass.setReuseSceneDepth(false);pass.render(renderer,withoutDepth,withDepth);
    assert.equal(pass.reusingSceneDepth,false);assert.equal(pass._renderGBuffer,true);assert.equal(normalDraws,4);
    assert.equal(pass.depthTexture,ownedDepth);assert.equal(pass.normalTexture,ownedNormal);
  }finally{pass.dispose();withDepth.depthTexture.dispose();withDepth.dispose();withoutDepth.dispose();}
});

test('disposing shared-depth AO releases owned resources without disposing borrowed composer depth',()=>{
  const pass=new BoundedGTAOPass(new T.Scene(),new T.PerspectiveCamera(),64,64),source=depthBuffer();
  const ownedDepth=pass.depthTexture,ownedNormal=pass.normalTexture,disposed=[];
  pass._renderPass=()=>{};
  source.depthTexture.addEventListener('dispose',()=>disposed.push('borrowed'));
  for(const [label,object] of [['normalTarget',pass.normalRenderTarget],['gtaoTarget',pass.gtaoRenderTarget],['denoiseTarget',pass.pdRenderTarget],['gtaoMaterial',pass.gtaoMaterial],['blendMaterial',pass.blendMaterial]])object.addEventListener('dispose',()=>disposed.push(label));
  try{
    pass.setReuseSceneDepth(true);pass.render(rendererState(),source,source);
    assert.equal(pass.depthTexture,source.depthTexture);assert.equal(pass.normalRenderTarget.depthTexture,ownedDepth);
  }finally{pass.dispose();}
  assert.equal(pass.depthTexture,ownedDepth);assert.equal(pass.normalTexture,ownedNormal);
  assert.equal(pass.reusingSceneDepth,false);assert.equal(disposed.includes('borrowed'),false);
  assert.deepEqual(disposed.sort(),['blendMaterial','denoiseTarget','gtaoMaterial','gtaoTarget','normalTarget'].sort());
  source.depthTexture.dispose();source.dispose();
});

test('normal and shared-depth failures restore clear state and the parent visibility cache',()=>{
  for(const shared of [false,true]){
    const scene=new T.Scene(),hiddenGroup=new T.Group(),points=new T.Points();
    hiddenGroup.visible=false;hiddenGroup.add(points);scene.add(hiddenGroup);
    const pass=new BoundedGTAOPass(scene,new T.PerspectiveCamera(),64,64),source=depthBuffer(),renderer=rendererState();
    const initialColor=renderer.getClearColor(new T.Color()).clone(),override=new T.MeshNormalMaterial();
    const fail=()=>{renderer.setClearColor(0xff0000,1);renderer.autoClear=false;scene.overrideMaterial=override;throw new Error('failed draw');};
    pass._renderOverride=fail;pass._renderPass=fail;
    if(shared){scene.traverseVisible=()=>assert.fail('shared traversal');scene.traverse=()=>assert.fail('shared traversal');}
    try{
      pass.setReuseSceneDepth(shared);
      assert.throws(()=>pass.render(renderer,source,source),/failed draw/);
      assert.equal(points.visible,true);assert.equal(hiddenGroup.visible,false);
      assert.equal(pass._visibilityCache.length,0);assert.equal(scene.overrideMaterial,null);
      assert.equal(renderer.autoClear,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.shadowMap.needsUpdate,true);
      assert.ok(renderer.getClearColor(new T.Color()).equals(initialColor));assert.equal(renderer.getClearAlpha(),.4);
    }finally{pass.dispose();source.depthTexture.dispose();source.dispose();points.geometry.dispose();points.material.dispose();override.dispose();}
  }
});
