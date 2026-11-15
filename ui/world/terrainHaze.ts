import type { Material } from 'three';

/** Keep surface dust dense while allowing raised terrain to emerge above it.
 * The same shader is used by the regional surface and its detailed replacements.
 */
export function applyTerrainHaze(material: Material) {
  const compile = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.vertexShader = 'varying float terrainWorldHeight;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      #include <project_vertex>
      vec4 hazePosition = vec4(transformed, 1.0);
      #ifdef USE_BATCHING
        hazePosition = batchingMatrix * hazePosition;
      #endif
      #ifdef USE_INSTANCING
        hazePosition = instanceMatrix * hazePosition;
      #endif
      terrainWorldHeight = (modelMatrix * hazePosition).y;
    `);
    shader.fragmentShader = 'varying float terrainWorldHeight;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        #ifdef FOG_EXP2
          float aboveDust = smoothstep(0.0, 36.0, terrainWorldHeight - cameraPosition.y);
          float terrainDensity = mix(fogDensity, min(fogDensity, 0.00065), aboveDust);
          float fogFactor = 1.0 - exp(-terrainDensity * terrainDensity * vFogDepth * vFogDepth);
        #else
          float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        #endif
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
      #endif
    `);
  };
  material.customProgramCacheKey = () => `${cacheKey}|terrain-height-haze-v1`;
}
