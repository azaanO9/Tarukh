import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,createReadStream} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {Plugin} from 'vite';

/** A small shell installs first; models are cached only when the game requests them. */
export function pwaPlugin(): Plugin {
  let base='/';
  return {
    name:'tarukh-offline-shell',
    configResolved(config){base=config.base;},
    async generateBundle(_,bundle){
      const hash=createHash('sha256');
      const shell=['./','manifest.webmanifest','pwa/icon-192.png'];
      const visited=new Set<string>();
      const addLaunchChunk=(name:string)=>{
        if(visited.has(name))return;visited.add(name);
        const item=bundle[name];if(!item||item.type!=='chunk')return;
        shell.push(name);
        const metadata=item as typeof item&{viteMetadata?:{importedCss?:Set<string>}};
        shell.push(...(metadata.viteMetadata?.importedCss??[]));
        for(const dependency of item.imports)addLaunchChunk(dependency);
      };
      for(const [name,item] of Object.entries(bundle)){
        hash.update(name).update(item.type==='chunk'?item.code:String(item.source));
        if(item.type==='chunk'&&(item.isEntry||item.name==='MarsFreeRoam'))addLaunchChunk(name);
      }
      // Stable model URLs must also invalidate the offline cache after an asset-only release.
      async function hashAssets(directory:string):Promise<void>{
        for(const entry of readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
          const path=join(directory,entry.name);hash.update(entry.name);
          if(entry.isDirectory())await hashAssets(path);
          else for await(const bytes of createReadStream(path))hash.update(bytes);
        }
      }
      await hashAssets(fileURLToPath(new URL('../../public',import.meta.url)));
      const template=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
      this.emitFile({type:'asset',fileName:'sw.js',source:template
        .replace('__VERSION__',hash.digest('hex').slice(0,16))
        .replace('__SHELL__',JSON.stringify([...new Set(shell)].map(url=>base+url.replace(/^\.\//,''))))});
    },
  };
}
