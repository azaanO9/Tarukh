import * as T from 'three';

const lightChunk = '#include <lights_fragment_end>';
const illumination = `
// A steady room fill, independent of camera, sun and moving lamp positions.
reflectedLight.indirectDiffuse += tarukhInteriorFill * diffuseColor.rgb;
`;

/** One inexpensive diffuse fill, linked only to interior material clones. */
export function createInteriorLighting() {
  const color = new T.Color('#e6efff').multiplyScalar(.65);
  const uniform = {value:new T.Color(0,0,0)};
  const clones = new Set<T.MeshStandardMaterial>();
  let cache = new WeakMap<T.Material,T.MeshStandardMaterial>();

  function materialFor(source:T.Material):T.Material {
    if(!(source instanceof T.MeshStandardMaterial))return source;
    const cached=cache.get(source);
    if(cached)return cached;
    const material=source.clone();
    const previousCompile=source.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      previousCompile.call(material,shader,renderer);
      if(!shader.fragmentShader.includes(lightChunk))throw new Error('Outpost interior material is missing its lighting chunk');
      shader.uniforms.tarukhInteriorFill=uniform;
      shader.fragmentShader='uniform vec3 tarukhInteriorFill;\n'+shader.fragmentShader.replace(lightChunk,lightChunk+illumination);
    };
    material.customProgramCacheKey=()=>source.customProgramCacheKey()+'|tarukh-interior-fill-v2';
    cache.set(source,material);clones.add(material);
    return material;
  }

  return {materialFor,
    setActive(active:boolean){if(active)uniform.value.copy(color);else uniform.value.setRGB(0,0,0);},
    dispose(){
      for(const material of clones)material.dispose();
      clones.clear();cache=new WeakMap();
    },
  };
}
