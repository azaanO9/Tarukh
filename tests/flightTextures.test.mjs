import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlightTextures} from '../ui/starbase/flightTextures.ts';

test('flight textures release GPU textures and decoded bitmaps exactly once',async()=>{
  const fetch=globalThis.fetch,decode=globalThis.createImageBitmap;
  let closes=0,disposes=0,applied=0;
  globalThis.fetch=async()=>new Response(new Blob(['image']));
  globalThis.createImageBitmap=async()=>({width:1,height:1,close(){closes++;}});
  const images=createFlightTextures();
  try{
    images.load('test.webp',texture=>{applied++;texture.addEventListener('dispose',()=>disposes++);});
    await images.ready();assert.equal(images.loaded,1);assert.equal(applied,1);
    images.dispose();images.dispose();assert.equal(closes,1);assert.equal(disposes,1);
  }finally{images.dispose();globalThis.fetch=fetch;globalThis.createImageBitmap=decode;}
});
test('late decode after leaving the opening is closed without being attached',async()=>{
  const fetch=globalThis.fetch,decode=globalThis.createImageBitmap;
  let finishDecode,closes=0,applied=0;
  globalThis.fetch=async()=>new Response(new Blob(['image']));
  globalThis.createImageBitmap=()=>new Promise(resolve=>{finishDecode=resolve;});
  const images=createFlightTextures();
  try{
    images.load('test.webp',()=>applied++);
    while(!finishDecode)await new Promise(resolve=>setImmediate(resolve));
    images.dispose();finishDecode({width:1,height:1,close(){closes++;}});
    await images.ready();assert.equal(closes,1);assert.equal(applied,0);assert.equal(images.loaded,0);
  }finally{images.dispose();globalThis.fetch=fetch;globalThis.createImageBitmap=decode;}
});
test('a failed texture request settles so the existing fallback can keep playing',async()=>{
  const fetch=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:404});
  const images=createFlightTextures();
  try{
    images.load('missing.webp',()=>assert.fail('Missing texture cannot be attached'));
    await images.ready();assert.equal(images.loaded,0);
  }finally{images.dispose();globalThis.fetch=fetch;}
});
