import * as T from 'three';

const lightChunk = '#include <lights_fragment_end>';
const illumination = `
// A steady room fill, independent of camera, sun and moving lamp positions.
reflectedLight.indirectDiffuse += tarukhInteriorFill * diffuseColor.rgb;
`;
const specularUniforms = `
uniform float tarukhInteriorSpecularStrength;
uniform vec3 tarukhInteriorSpecularPositions[2];
uniform vec3 tarukhInteriorSpecularColors[2];
`;
const specularIllumination = `
// Room fixtures affect only the interior materials carrying this hook.
if (tarukhInteriorSpecularStrength > 0.0) {
  for (int i = 0; i < 2; i++) {
    vec3 tarukhLightVector = tarukhInteriorSpecularPositions[i] - geometryPosition;
    float tarukhLightDistance = max(length(tarukhLightVector), 0.001);
    vec3 tarukhLightDirection = tarukhLightVector / tarukhLightDistance;
    float tarukhLightRange = i == 0 ? 11.0 : 9.0;
    vec3 tarukhIrradiance = tarukhInteriorSpecularColors[i]
      * tarukhInteriorSpecularStrength
      * getDistanceAttenuation(tarukhLightDistance, tarukhLightRange, 2.0)
      * saturate(dot(geometryNormal, tarukhLightDirection));
    reflectedLight.directSpecular += tarukhIrradiance
      * BRDF_GGX(tarukhLightDirection, geometryViewDir, geometryNormal, material);
  }
}
`;

/** Shared room fill and optional Ultra highlights, scoped to cloned interior materials. */
export function createInteriorLighting() {
  const color = new T.Color('#e6efff').multiplyScalar(.65);
  const uniform = {value:new T.Color(0,0,0)};
  const specularStrength = {value:0};
  const worldPositions = [new T.Vector3(-.65,2.65,0),new T.Vector3(.65,1.95,-1.2)];
  const specularPositions = {value:[new T.Vector3(),new T.Vector3()]};
  const specularColors = {value:[new T.Color('#e5efff').multiplyScalar(28),new T.Color('#d6c6ef').multiplyScalar(10)]};
  const clones = new Set<T.MeshStandardMaterial>();
  let cache = new WeakMap<T.Material,{diffuse?:T.MeshStandardMaterial;specular?:T.MeshStandardMaterial}>();
  let active=false,ultra=false;

  function materialFor(source:T.Material,localSpecular=false):T.Material {
    if(!(source instanceof T.MeshStandardMaterial))return source;
    const kind=localSpecular?'specular':'diffuse';
    const entry=cache.get(source)??{};
    const cached=entry[kind];
    if(cached)return cached;
    const material=source.clone();
    const previousCompile=source.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      previousCompile.call(material,shader,renderer);
      if(!shader.fragmentShader.includes(lightChunk))throw new Error('Outpost interior material is missing its lighting chunk');
      shader.uniforms.tarukhInteriorFill=uniform;
      if(localSpecular){
        shader.uniforms.tarukhInteriorSpecularStrength=specularStrength;
        shader.uniforms.tarukhInteriorSpecularPositions=specularPositions;
        shader.uniforms.tarukhInteriorSpecularColors=specularColors;
      }
      shader.fragmentShader='uniform vec3 tarukhInteriorFill;\n'+(localSpecular?specularUniforms:'')
        +shader.fragmentShader.replace(lightChunk,lightChunk+illumination+(localSpecular?specularIllumination:''));
    };
    material.customProgramCacheKey=()=>source.customProgramCacheKey()+'|tarukh-interior-fill-v2'+(localSpecular?'|tarukh-interior-specular-v1':'');
    entry[kind]=material;cache.set(source,entry);clones.add(material);
    return material;
  }

  return {materialFor,
    setActive(value:boolean){
      active=value;
      if(active)uniform.value.copy(color);else uniform.value.setRGB(0,0,0);
      specularStrength.value=active&&ultra?1:0;
    },
    setUltra(value:boolean){ultra=value;specularStrength.value=active&&ultra?1:0;},
    setRoomCenter(x:number,y:number,z:number){
      worldPositions[0].set(x-.65,y+2.65,z);
      worldPositions[1].set(x+.65,y+1.95,z-1.2);
    },
    updateView(camera:T.Camera){
      for(let i=0;i<worldPositions.length;i++)specularPositions.value[i].copy(worldPositions[i]).applyMatrix4(camera.matrixWorldInverse);
    },
    dispose(){
      for(const material of clones)material.dispose();
      clones.clear();cache=new WeakMap();
    },
  };
}
