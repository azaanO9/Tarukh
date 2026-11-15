/** Bundle the separate preview into one offline HTML file using installed tooling. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'vite';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const result=await build({
  configFile:false,publicDir:false,logLevel:'warn',
  build:{write:false,minify:true,target:'es2022',lib:{entry:path.resolve('ui/starbase/main.ts'),name:'StarbasePreview',formats:['iife']}},
});
const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output??[]);
const chunk=outputs.find(o=>o.type==='chunk');
if(!chunk||outputs.some(o=>o!==chunk))throw new Error('Preview must have exactly one inline script');
const license=await fs.readFile('node_modules/three/LICENSE','utf8');
const template=await fs.readFile('ui/starbase/preview.html','utf8');
const script='/* Three.js and example utilities\n'+license.replaceAll('*/','* /')+'\n*/\n'+chunk.code.replaceAll('</script','<\\/script');
const hash=createHash('sha256');
for(const file of ['game/starbaseRig.ts','game/reusableRocket.ts','ui/starbase/createStarbase.ts','ui/starbase/main.ts','ui/starbase/preview.html','scripts/build-starbase.mjs'])hash.update(file+'\0'+(await fs.readFile(file,'utf8')).replaceAll('\r\n','\n'));
const html=template.replace('<head>','<head>\n<!-- Source SHA256: '+hash.digest('hex')+' -->').replace('/* STARBASE_BUNDLE */',()=>script).replace(/[ \t]+$/gm,'');
await fs.writeFile('public/starbase.html',html);
console.log(JSON.stringify({file:'public/starbase.html',bytes:Buffer.byteLength(html),gzipBytes:gzipSync(html).length,externalModels:0,externalScripts:0}));
