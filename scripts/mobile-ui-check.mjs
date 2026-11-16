/** Browser checks for the real launch screen, game HUD, handset and atlas. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const engine=arg('browser')??'chromium';
const url=arg('url')??'http://127.0.0.1:4211/Tarukh/';
const output=path.resolve(arg('output')??`outputs/mobile-ui-${engine}`);
const baseline=arg('baseline')==='1';
const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
await fs.mkdir(output,{recursive:true});
const report={engine,baseline,checks:[],screens:[],errors:[],failures:[]};
const sizes=[[360,640],[375,667],[390,844],[412,915],[430,932],[768,1024],[1024,768],[844,390],[926,428],[667,375],[568,320]];
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce',...(engine==='firefox'?{}:{isMobile:true})});
const page=await context.newPage();
page.setDefaultTimeout(60000);
const downloads=[];
page.on('request',request=>downloads.push(request.url()));
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&/shader|THREE|WebGL/i.test(message.text()))report.errors.push(message.text());});
async function capture(label,scope){
  await page.waitForTimeout(200);
  const metrics=await page.evaluate(scope=>{
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return !el.closest('[inert]')&&s.display!=='none'&&s.visibility==='visible'&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
    const rect=el=>{const r=el.getBoundingClientRect();return {label:el.getAttribute('aria-label')||el.className||el.textContent?.slice(0,40),x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const root=document.querySelector(scope),issues=[];
    if(!root)return {issues:[`Missing ${scope}`]};
    const zones=scope==='.roam-root'?['.roam-header b','.roam-header-actions','.roam-minimap','.sv-look-controls','.mars-phone-mobile-pill','.flight-pad','.flight-actions','.wheel-steering','.wheel-pedals','.sv-outpost-prompt','.ely-hud','.sv-rover-hud']:scope==='.tarukh-home'?['.tarukh-home-header','.tarukh-home-copy','.tarukh-home-menu','.tarukh-home-slideshow','.tarukh-home-footer']:[];
    const elements=zones.flatMap(selector=>[...root.querySelectorAll(selector)].filter(visible));
    const boxes=elements.map(rect);
    if(scope==='.roam-root'&&boxes.length<5)issues.push('HUD is obscured or not ready; expected at least five visible playfield zones');
    for(const box of boxes)if(box.x<-.5||box.y<-.5||box.right>innerWidth+.5||box.bottom>innerHeight+.5)issues.push(`Outside viewport: ${box.label}`);
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      if(elements[i].contains(elements[j])||elements[j].contains(elements[i]))continue;
      const a=boxes[i],b=boxes[j];
      if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)issues.push(`Overlapping zones: ${a.label} / ${b.label}`);
    }
    const targets=[];
    for(const button of root.querySelectorAll('button,select,input[type="range"]')){
      // Geographic pins may overlap at low zoom; every destination also has a
      // separately reachable, full-size button in Places. Inspect chrome here.
      if(!visible(button)||button.disabled||button.classList.contains('pin'))continue;
      const box=rect(button);let clipped=false;
      for(let parent=button.parentElement;parent&&parent!==root.parentElement;parent=parent.parentElement){
        const ps=getComputedStyle(parent),pr=parent.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(ps.overflowY)&& (box.y+box.height/2>=pr.bottom||box.y+box.height/2<=pr.top))clipped=true;
      }
      if(clipped)continue;
      targets.push(box);
      if(box.width<47.5||box.height<47.5)issues.push(`Small target: ${box.label} (${Math.round(box.width)}×${Math.round(box.height)})`);
      const hit=document.elementFromPoint(box.x+box.width/2,Math.min(innerHeight-1,box.y+box.height/2));
      if(hit&&!button.contains(hit)&&!hit.contains(button)&&box.y>=0&&box.bottom<=innerHeight&&!button.classList.contains('marker'))issues.push(`Blocked target: ${box.label}`);
    }
    if(document.documentElement.scrollWidth>innerWidth+1)issues.push('Horizontal page overflow');
    if(root.scrollWidth>root.clientWidth+1)issues.push(`Horizontal content overflow: ${scope} (${root.scrollWidth}/${root.clientWidth})`);
    return {size:[innerWidth,innerHeight],boxes,targets,issues};
  },scope);
  await page.screenshot({path:path.join(output,label+'.png')});report.screens.push({label,...metrics});
  report.failures.push(...metrics.issues.map(issue=>`${label}: ${issue}`));
}
async function openPause(){
  if(!await page.locator('.flight-menu[open]').isVisible())await page.getByRole('button',{name:'Pause',exact:true}).click();
}
async function resumeForViewport(){
  // Changing the emulated screen can asynchronously finish a native fullscreen
  // exit. Close that expected pause before asserting the actual playfield.
  await page.waitForTimeout(300);
  if(await page.locator('.flight-menu[open]').isVisible())await page.getByRole('button',{name:'Close flight console',exact:true}).click();
  await page.locator('.flight-menu[open]').waitFor({state:'detached'});
  await page.waitForFunction(()=>!document.querySelector('.sv-world')?.closest('[inert]'));
}
try{
  await page.goto(url+'?debug=1&device=mobile');
  await page.getByRole('button',{name:'Start Free Explorer, open terrain'}).waitFor();
  await page.locator('.tarukh-valley-world img').first().waitFor();
  for(const [width,height] of sizes){await page.setViewportSize({width,height});await capture(`menu-${width}x${height}`,'.tarukh-home');}
  for(const name of ['Settings, controls and display','About the mission']){
    await page.getByRole('button',{name,exact:true}).click();
    await capture(name.startsWith('Settings')?'menu-settings':'menu-about','.tarukh-home-dialog');
    await page.getByRole('button',{name:'Close panel',exact:true}).click();
  }
  await page.setViewportSize({width:844,height:390});
  await page.getByRole('button',{name:'Start Free Explorer, open terrain'}).click();
  await page.locator('.starship-arrival').waitFor();
  await page.getByRole('button',{name:/^Skip (animation|to Mars)$/}).click();
  await page.waitForFunction(()=>document.querySelector('.sv-world')?.dataset.catchSite==='ready',null,{timeout:240000});
  await page.locator('.starship-arrival').waitFor({state:'detached',timeout:240000});
  // Gecko's headless fullscreen uses the host screen size. Exit before emulating
  // different physical displays, and verify the intentional pause on exit.
  await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
  await page.waitForTimeout(200);
  if(await page.locator('.flight-menu[open]').isVisible())await page.getByRole('button',{name:'Close flight console',exact:true}).click();
  for(const [width,height] of sizes.filter(([w,h])=>w>h)){await page.setViewportSize({width,height});await resumeForViewport();await capture(`hud-${width}x${height}`,'.roam-root');}
  for(const [width,height] of sizes.filter(([w,h])=>w<h)){
    await page.setViewportSize({width,height});await page.locator('.sv-rotate-gate').waitFor();
    await capture(`rotation-${width}x${height}`,'.sv-rotate-gate');
  }
  await page.setViewportSize({width:568,height:320});
  await page.locator('.sv-rotate-gate').waitFor({state:'detached'});
  await openPause();
  for(const section of ['Camera','Graphics','Main menu']){
    await page.locator('.flight-menu-sectors').getByRole('button',{name:section,exact:true}).click();
    await capture(`pause-${section.replace(' ','-')}`,'.flight-menu');
  }
  await page.getByRole('button',{name:'Keep playing',exact:true}).click();
  await page.setViewportSize({width:844,height:390});
  await page.getByRole('button',{name:'Open Mars Telemetry Communicator'}).click();
  await page.locator('.mars-phone-modal[open]').waitFor();
  for(const [width,height] of [[568,320],[844,390],[1024,768]]){await page.setViewportSize({width,height});await capture(`phone-${width}x${height}`,'.mars-phone-modal');}
  await page.setViewportSize({width:844,height:390});
  for(const app of ['Radiation','Systems','Archive','Settings']){
    await page.getByRole('button',{name:app,exact:true}).click();await capture(`phone-${app.toLowerCase()}`,'.mars-phone-modal');
    await page.getByRole('button',{name:'Home',exact:true}).click();
  }
  await page.getByRole('button',{name:'Science guide',exact:true}).click();await capture('phone-guide','.mars-sep-modal-backdrop');
  await page.getByRole('button',{name:'Close guide',exact:true}).click();
  await page.getByRole('button',{name:'Field map',exact:true}).click();
  await page.locator('.atlas-expedition-wrap').waitFor();
  for(const [width,height] of [[568,320],[844,390],[1024,768]]){await page.setViewportSize({width,height});await capture(`atlas-${width}x${height}`,'.atlas-expedition-wrap');}
  assert.ok(!downloads.some(url=>url.includes('mola-32ppd.bin')),'Plan view does not download optional 3D heights');
  await page.setViewportSize({width:568,height:320});
  await page.getByRole('button',{name:'Places',exact:true}).click();
  await capture('atlas-places','.atlas-expedition-wrap');
  const site=page.locator('.atlas-expedition-wrap .site').first();
  await site.scrollIntoViewIfNeeded();await site.click();
  await page.getByRole('button',{name:'Map',exact:true}).click();
  await page.getByRole('button',{name:'Map controls',exact:true}).click();
  await capture('atlas-help','#guide');await page.locator('#guide').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'3D relief',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.atlas-relief-map')?.style.display==='block',{},{timeout:60000});
  await capture('atlas-relief','.atlas-expedition-wrap');
  assert.ok(downloads.some(url=>url.includes('mola-32ppd.bin')),'3D relief requests full detail on demand');
  await page.getByRole('button',{name:'Close Atlas',exact:true}).click();
  await page.setViewportSize({width:844,height:390});
  await openPause();
  await page.locator('.flight-menu-sectors').getByRole('button',{name:'Main menu',exact:true}).click();
  await page.getByRole('button',{name:'Return to main menu',exact:true}).click();
  await page.getByRole('button',{name:'New Story, begin transmission',exact:true}).click();
  await page.locator('[data-ely-panel=prologue]').waitFor();
  await capture('story-prologue','.ely-dialog');
  await page.getByRole('button',{name:'Skip prologue · travel to Mars',exact:true}).click();
  await page.getByRole('button',{name:'Wake up · begin commissioning',exact:true}).waitFor({timeout:240000});
  await page.getByRole('button',{name:'Wake up · begin commissioning',exact:true}).click();
  await capture('story-brief','.ely-dialog');
  await page.getByRole('button',{name:'Explore · follow the station marker',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.sv-world')?.dataset.catchSite==='ready',null,{timeout:240000});
  await page.evaluate(async()=>{if(document.fullscreenElement)await document.exitFullscreen();});
  await page.waitForTimeout(300);
  if(await page.locator('.flight-menu[open]').isVisible())await page.getByRole('button',{name:'Close flight console',exact:true}).click();
  for(const [width,height] of [[568,320],[844,390],[1024,768]]){await page.setViewportSize({width,height});await resumeForViewport();await capture(`story-hud-${width}x${height}`,'.roam-root');}
  await page.getByRole('button',{name:'Next step →',exact:true}).click();await capture('story-next-step','.ely-dialog');
  report.checks.push('Launch, game, handset and atlas open through real controls');
  await context.close();
  if(engine==='chromium'){
    for(const name of ['iPhone SE','iPhone 14','iPhone 15','Pixel 7','Galaxy S9+','iPad (gen 7)']){
      const device=await browser.newContext({...pw.devices[name],reducedMotion:'reduce'}),tab=await device.newPage();
      await tab.goto(url);await tab.waitForFunction(()=>document.querySelector('.tarukh-home')?.dataset.controls==='mobile');
      assert.equal(await tab.getByRole('button',{name:/Choose Mobile|Choose PC/}).count(),0);
      await tab.screenshot({path:path.join(output,`device-${name.replace(/[^a-z0-9]/gi,'-')}.png`)});
      report.checks.push(`${name}: automatic touch UI without an override`);await device.close();
    }
    const desktop=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),tab=await desktop.newPage();
    await tab.goto(url);await tab.waitForFunction(()=>document.querySelector('.tarukh-home')?.dataset.controls==='pc');
    assert.equal(await tab.locator('.flight-pad,.wheel-controls').count(),0);
    await tab.screenshot({path:path.join(output,'desktop-menu.png')});
    report.checks.push('Desktop retains keyboard/mouse UI');await desktop.close();
  }
}catch(error){report.failures.push(error.stack??String(error));}
finally{await browser.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({engine,screens:report.screens.length,errors:report.errors,failures:report.failures},null,2));
if(!baseline&&(report.failures.length||report.errors.length))process.exitCode=1;
