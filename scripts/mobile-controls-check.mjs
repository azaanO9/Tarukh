/** Real touch input, cancellation, rover rollout and safe-area regression checks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const arg=name=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const output=path.resolve(arg('output')??'outputs/mobile-controls');
await fs.mkdir(output,{recursive:true});
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
page.setDefaultTimeout(60000);
const report={checks:[],errors:[]};page.on('pageerror',error=>report.errors.push(error.message));
const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:4,radiusY:4,force:1}))});
const point=async locator=>{const b=await locator.boundingBox();assert.ok(b);return [b.x+b.width/2,b.y+b.height/2];};
try{
  await page.goto((arg('url')??'http://127.0.0.1:4211/Tarukh/')+'?device=mobile&debug=1&sitePreview=garage');
  await page.getByRole('button',{name:'Start Free Explorer, open terrain',exact:true}).click();
  await page.locator('.starship-arrival').waitFor();
  if(await page.evaluate(()=>Boolean(document.fullscreenElement))){
    await page.evaluate(()=>document.exitFullscreen());
    await page.locator('.flight-menu[open]').waitFor();
    assert.equal(await page.locator('.flight-menu').evaluate(el=>Boolean(el.closest('[inert]'))),false);
    await page.getByRole('button',{name:'Close flight console',exact:true}).click();
    report.checks.push('Exiting fullscreen during the opening leaves Pause operable and resumes the opening');
  }
  await page.getByRole('button',{name:/^Skip (animation|to Mars)$/}).click();
  await page.waitForFunction(()=>document.querySelector('.sv-world')?.dataset.catchSite==='ready',null,{timeout:240000});
  await page.locator('.starship-arrival').waitFor({state:'detached'});
  await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
  await page.waitForTimeout(300);
  if(await page.locator('.flight-menu[open]').isVisible())await page.getByRole('button',{name:'Close flight console',exact:true}).click();
  const stick=page.locator('.flight-pad'),jump=page.getByRole('button',{name:'Jump',exact:true});
  const [sx,sy]=await point(stick),[jx,jy]=await point(jump);
  await touch('touchStart',[[1,sx,sy],[2,jx,jy]]);await touch('touchMove',[[1,sx+20,sy],[2,jx,jy]]);
  assert.notEqual(await stick.getAttribute('data-held'),null);assert.notEqual(await jump.getAttribute('data-held'),null);
  await touch('touchCancel',[]);await page.waitForTimeout(150);
  assert.equal(await stick.getAttribute('data-held'),null);assert.equal(await jump.getAttribute('data-held'),null);
  report.checks.push('Two-finger walking + jump, then cancellation releases both controls');
  await page.locator('.sv-outpost-prompt button').filter({hasText:'Bring rover out'}).click();
  await page.waitForFunction(()=>document.querySelector('.sv-world')?.dataset.garagePhase==='outside',null,{timeout:90000});
  if(!await page.getByRole('button',{name:'Drive rover',exact:true}).isVisible()){
    await page.locator('.sv-world').focus();await page.keyboard.down('KeyD');await page.waitForTimeout(550);await page.keyboard.up('KeyD');
  }
  await page.getByRole('button',{name:'Drive rover',exact:true}).click();
  await page.locator('.wheel-pedals').waitFor();
  const gas=page.getByRole('button',{name:'Forward',exact:true}),left=page.getByRole('button',{name:'Steer left',exact:true});
  const [gx,gy]=await point(gas),[lx,ly]=await point(left);
  await touch('touchStart',[[3,gx,gy],[4,lx,ly]]);await page.waitForTimeout(500);
  assert.notEqual(await gas.getAttribute('data-held'),null);assert.notEqual(await left.getAttribute('data-held'),null);
  await touch('touchCancel',[]);await page.waitForTimeout(150);
  assert.equal(await gas.getAttribute('data-held'),null);assert.equal(await left.getAttribute('data-held'),null);
  report.checks.push('Garage deploy, touch boarding and simultaneous steering/throttle release');
  for(const [width,height] of [[568,320],[844,390],[1024,768]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(300);
    await page.screenshot({path:path.join(output,`rover-${width}x${height}.png`)});
    const boxes=await page.evaluate(()=>[...document.querySelectorAll('.wheel-steering,.wheel-pedals,.roam-minimap,.sv-rover-hud,.roam-header-actions,.mars-phone-mobile-pill,.mars-shield-popup')].filter(el=>getComputedStyle(el).visibility==='visible').map(el=>{
      const r=el.getBoundingClientRect();return {name:el.className,x:r.x,y:r.y,w:r.width,h:r.height};
    }).filter(r=>r.w&&r.h));
    for(const r of boxes)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1,JSON.stringify(r));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<=0||Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)<=0,`${width}: ${a.name} overlaps ${b.name}`);
    }
  }
  await page.setViewportSize({width:844,height:390});
  await page.waitForTimeout(5200);
  await page.screenshot({path:path.join(output,'rover-status.png')});
  await page.addStyleTag({content:'main.roam-root[data-controls="mobile"]{--ui-left:44px;--ui-right:8px;--ui-top:8px;--ui-bottom:21px}'});
  await page.getByRole('button',{name:'Open Mars Telemetry Communicator',exact:true}).click();
  const bounds=await page.locator('.mars-phone-modal').boundingBox();
  assert.ok(bounds.x>=43&&bounds.x+bounds.width<=837&&bounds.y+bounds.height<=370,'Phone respects asymmetric notch and home indicator');
  await page.screenshot({path:path.join(output,'phone-safe-area.png')});
  report.checks.push('Rover layouts fit 320px landscape, phone and tablet; asymmetric handset safe areas verified');
  await page.getByRole('button',{name:'Close phone',exact:true}).click();
  const requested=[];page.on('request',request=>requested.push(request.url()));
  await page.route('**/art/mars-atlas/map-base.webp',route=>route.abort());
  await page.route('**/art/mars-atlas/mola-32ppd.bin',route=>route.abort());
  await page.getByRole('button',{name:'Open full map',exact:true}).click();
  await page.locator('.atlas-expedition-wrap').waitFor();
  await page.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('map-base.png')));
  assert.ok(requested.some(url=>url.endsWith('map-base.png')),'Original raster is a fallback if WebP fails');
  assert.ok(!requested.some(url=>url.endsWith('mola-32ppd.bin')),'Plan never requests relief data');
  const map=await page.locator('#map').boundingBox();
  const tx=map.x+120,ty=map.y+100;
  const initialScale=await page.locator('#scale').evaluate(el=>el.style.width);
  await touch('touchStart',[[5,tx,ty],[6,tx+80,ty]]);
  await touch('touchMove',[[5,tx-20,ty],[6,tx+120,ty]]);
  await touch('touchEnd',[[5,tx-20,ty]]);
  await touch('touchMove',[[5,tx+5,ty+15]]);
  await touch('touchEnd',[]);await page.waitForTimeout(200);
  assert.notEqual(await page.locator('#scale').evaluate(el=>el.style.width),initialScale,'Real two-finger input zooms the atlas');
  assert.equal(await page.locator('.waypoint-pin').count(),0,'Pinch followed by pan does not place a waypoint');
  await touch('touchStart',[[7,tx,ty]]);await touch('touchCancel',[]);
  assert.equal(await page.locator('.waypoint-pin').count(),0,'Cancelled map touches do not place a waypoint');
  await page.getByRole('button',{name:'3D relief',exact:true}).click();
  await page.getByRole('status').filter({hasText:'3D relief unavailable'}).waitFor();
  assert.ok(await page.locator('.atlas-base-map').isVisible(),'Plan raster remains visible after a failed relief request');
  await page.screenshot({path:path.join(output,'atlas-recovery.png')});
  await page.getByRole('button',{name:'Plan',exact:true}).click();
  await page.getByRole('button',{name:'Places',exact:true}).click();
  await page.locator('.atlas-expedition-wrap .site').first().click();
  report.checks.push('Actual atlas pinch/pan/cancel, WebP fallback, deferred relief and failed-relief recovery');
}catch(error){report.errors.push(error.stack??String(error));await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1;
