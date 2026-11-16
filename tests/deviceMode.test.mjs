import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveDeviceMode,isTouchPortrait} from '../game/deviceMode.ts';
import {requestGameFullscreen} from '../ui/mobileDevice.ts';

const desktop={coarse:false,fine:true,noHover:false,touchPoints:0,width:1920,height:1080,userAgent:'Windows',platform:'Win32'};
test('device mode follows the primary pointer rather than viewport width or touch availability',()=>{
  assert.equal(resolveDeviceMode(desktop),'pc');
  assert.equal(resolveDeviceMode({...desktop,width:360,height:640}),'pc');
  assert.equal(resolveDeviceMode({...desktop,touchPoints:10}),'pc');
  assert.equal(resolveDeviceMode({...desktop,fine:false,coarse:true,noHover:true,touchPoints:5}),'mobile');
  assert.equal(resolveDeviceMode({...desktop,fine:false,coarse:false,noHover:true,touchPoints:5}),'mobile');
  assert.equal(resolveDeviceMode({...desktop,fine:false,noHover:true,touchPoints:0,width:360}),'pc');
});

test('tablet and mobile hints fill missing pointer support, including desktop-UA iPads',()=>{
  const uncertain={...desktop,fine:false,coarse:false,noHover:false,touchPoints:5};
  assert.equal(resolveDeviceMode({...uncertain,platform:'MacIntel',userAgent:'Macintosh',width:1024,height:1366}),'mobile');
  assert.equal(resolveDeviceMode({...uncertain,userAgent:'iPad'}),'mobile');
  assert.equal(resolveDeviceMode({...uncertain,mobileHint:true}),'mobile');
  assert.equal(resolveDeviceMode({...uncertain,userAgent:'Android Mobile',width:412,height:915}),'mobile');
  assert.equal(resolveDeviceMode({...uncertain,userAgent:'iPad',fine:true}),'pc');
});

test('hidden debug override is explicit and changes no gameplay state',()=>{
  assert.equal(resolveDeviceMode({...desktop,override:'mobile'}),'mobile');
  assert.equal(resolveDeviceMode({...desktop,fine:false,coarse:true,override:'pc'}),'pc');
  for(const override of ['','unknown','tablet',null])assert.equal(resolveDeviceMode({...desktop,override}),'pc');
  assert.equal(isTouchPortrait(768,1024,'mobile'),true);
  assert.equal(isTouchPortrait(390,844,'mobile'),true);
  assert.equal(isTouchPortrait(844,390,'mobile'),false);
  assert.equal(isTouchPortrait(360,640,'pc'),false);
  assert.equal(isTouchPortrait(0,0,'mobile'),false);
});

test('fullscreen failures are recoverable and orientation is requested only for touch play',async()=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const calls=[];
  try{
    globalThis.window={matchMedia:()=>({matches:false}),screen:{orientation:{lock:async mode=>{calls.push(mode);throw Error('unsupported');}}}};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
    globalThis.document={documentElement:{requestFullscreen:async()=>{calls.push('fullscreen');throw Error('declined');}},fullscreenElement:null};
    assert.equal(await requestGameFullscreen('pc'),false);
    assert.deepEqual(calls,['fullscreen']);calls.length=0;
    assert.equal(await requestGameFullscreen('mobile'),false);
    assert.deepEqual(calls,['fullscreen','landscape']);calls.length=0;
    globalThis.document.documentElement={webkitRequestFullscreen:()=>{calls.push('webkit');globalThis.document.webkitFullscreenElement={};}};
    assert.equal(await requestGameFullscreen('pc'),true);
    assert.deepEqual(calls,['webkit']);
    calls.length=0;
    assert.equal(await requestGameFullscreen('pc'),true);
    assert.deepEqual(calls,[],'Already fullscreen does not request again');
  }finally{
    if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
    if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
    if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;
  }
});
