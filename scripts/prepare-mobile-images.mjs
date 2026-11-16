/** Recreate lossless web derivatives using Sharp already supplied by Next. */
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=createRequire(require.resolve('next/package.json'))('sharp');
const files=['public/team/tarukh-blue-arc-logo.png','public/art/mars-atlas/map-base.png'];
for(const source of files){
  const input=await fs.readFile(source);
  const output=await sharp(input).webp({lossless:true,effort:6}).toBuffer();
  const before=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const after=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(before.info.width!==after.info.width||before.info.height!==after.info.height)throw new Error(`Dimensions changed: ${source}`);
  // RGB beneath fully transparent pixels may be canonicalized by the encoder.
  for(let i=0;i<before.data.length;i+=4){
    if(before.data[i+3]!==after.data[i+3]||before.data[i+3]&&
      (before.data[i]!==after.data[i]||before.data[i+1]!==after.data[i+1]||before.data[i+2]!==after.data[i+2])){
      throw new Error(`Visible pixels changed: ${source}`);
    }
  }
  const destination=source.replace(/\.png$/,'.webp');
  await fs.writeFile(destination,output);
  console.log(`${destination}: ${input.length} → ${output.length} bytes; original resolution, visible pixels and alpha verified`);
}
