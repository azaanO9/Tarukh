/** Offline asset preparation; no source servers are contacted by the game. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
// Reuse Next's existing image toolchain; do not add an asset-only runtime dependency.
const sharp = process.env.SHARP_MODULE
  ? require(process.env.SHARP_MODULE)
  : createRequire(require.resolve('next/package.json'))('sharp');
const output = path.resolve('public/art/flight');
const cache = path.resolve('outputs/arrival-sources');
await fs.mkdir(output, {recursive:true});
await fs.mkdir(cache, {recursive:true});
const sources = [
  {name:'earth', url:'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x5400x2700.jpg', credit:'NASA Earth Observatory / Reto Stockli, Blue Marble Next Generation, July 2004', page:'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/', license:'NASA media usage guidelines'},
  {name:'mars', url:'https://www.solarsystemscope.com/textures/download/8k_mars.jpg', credit:'Solar System Scope / INOVE, based on NASA elevation and imagery; artist-adjusted colours and gap filling', page:'https://www.solarsystemscope.com/textures/', license:'CC BY 4.0'},
  {name:'clouds', url:'https://github.com/matteason/daily-cloud-maps/releases/download/2022-07-27/4096x2048-clouds.jpg', credit:'Matt Eason, NASA-derived daily cloud map, 27 July 2022', page:'https://github.com/matteason/daily-cloud-maps', license:'CC0 1.0'},
  {name:'sky',url:'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/kloppenheim_06_puresky.jpg',credit:'Greg Zaal / Jarod Guest / Poly Haven, Kloppenheim 06 Pure Sky',page:'https://polyhaven.com/a/kloppenheim_06_puresky',license:'CC0 1.0'},
  {name:'coastal-ground',url:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg',credit:'Rob Tuytel / Poly Haven, Aerial Grass Rock',page:'https://polyhaven.com/a/aerial_grass_rock',license:'CC0 1.0'},
];
const manifest=[];
for (const source of sources) {
  const file = path.join(cache, source.name+'-source.jpg');
  let bytes;
  try { bytes=await fs.readFile(file); } catch {
    const response=await fetch(source.url);
    if(!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
    bytes=Buffer.from(await response.arrayBuffer());await fs.writeFile(file,bytes);
  }
  const derivatives=[];
  for(const width of source.name==='coastal-ground'?[512,1024]:source.name==='clouds'||source.name==='sky'?[1024,2048]:[1024,4096]) {
    const name=`${source.name}-${width}.webp`;
    const image=await sharp(bytes).rotate().resize(width,source.name==='coastal-ground'?width:width/2,{fit:'fill',withoutEnlargement:true}).webp({quality:source.name==='clouds'?82:87,effort:6}).toBuffer();
    await fs.writeFile(path.join(output,name),image);
    derivatives.push({file:name,bytes:image.length,sha256:createHash('sha256').update(image).digest('hex')});
  }
  manifest.push({...source,sha256:createHash('sha256').update(bytes).digest('hex'),derivatives});
}
await fs.writeFile(path.join(output,'sources.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(manifest.map(s=>({name:s.name,files:s.derivatives.map(d=>({file:d.file,bytes:d.bytes}))})));
