import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {applyTerrainHaze} from '../ui/world/terrainHaze.ts';

test('height haze preserves existing material hooks, uniforms and cache identity', () => {
  const material = new T.MeshStandardMaterial();
  const priorUniform = {value: 42};
  material.customProgramCacheKey = () => 'tracks-and-regolith';
  material.onBeforeCompile = function (shader) {
    assert.equal(this, material);
    shader.uniforms.track = priorUniform;
    shader.vertexShader = '// Existing displacement\n' + shader.vertexShader;
  };
  applyTerrainHaze(material);
  const shader = {uniforms: {}, vertexShader: T.ShaderLib.standard.vertexShader, fragmentShader: T.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader, null);
  assert.equal(shader.uniforms.track, priorUniform);
  assert.ok(shader.vertexShader.includes('// Existing displacement'));
  assert.ok(shader.vertexShader.includes('#include <project_vertex>'));
  assert.ok(shader.vertexShader.includes('instanceMatrix * hazePosition'));
  assert.ok(shader.vertexShader.includes('batchingMatrix * hazePosition'));
  assert.ok(shader.fragmentShader.includes('terrainWorldHeight - cameraPosition.y'));
  assert.ok(shader.fragmentShader.includes('smoothstep(fogNear, fogFar, vFogDepth)'));
  assert.ok(!shader.fragmentShader.includes('#include <fog_fragment>'));
  assert.match(material.customProgramCacheKey(), /^tracks-and-regolith\|/);
  assert.equal(material.depthTest, true);
  assert.equal(material.depthWrite, true);
  material.dispose();
});
