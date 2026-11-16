import * as T from 'three';
import {assetUrl} from '../../lib/assetUrl.ts';

/** Bounded local image loading with deterministic cleanup, including late bitmap decodes. */
export function createFlightTextures() {
  const textures:T.Texture[]=[],bitmaps:ImageBitmap[]=[],jobs:Promise<void>[]=[];
  const abort=new AbortController();let disposed=false,loaded=0;
  return {
    load(name:string,apply:(texture:T.Texture)=>void,color=true,anisotropy=4){
      jobs.push((async()=>{
        try {
          const response=await fetch(assetUrl('/art/flight/'+name),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(6000)])});
          if(!response.ok)throw new Error('Flight texture unavailable');
          const bitmap=await createImageBitmap(await response.blob(),{imageOrientation:'flipY',premultiplyAlpha:'none'});
          if(disposed){bitmap.close();return;}
          const map=new T.Texture(bitmap);map.flipY=false;map.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
          map.anisotropy=anisotropy;map.needsUpdate=true;
          textures.push(map);bitmaps.push(bitmap);apply(map);loaded++;
        } catch { /* Keep the procedural fallback if a local image is unavailable. */ }
      })());
    },
    ready(){return Promise.all(jobs);},get loaded(){return loaded;},
    dispose(){if(disposed)return;disposed=true;abort.abort();for(const map of textures)map.dispose();for(const bitmap of bitmaps)bitmap.close();},
  };
}
