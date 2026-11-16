/**
 * Run after build:pages and a Vite preview. No game state is injected.
 * node scripts/mobile-layout-check.mjs --url=http://127.0.0.1:4206/Tarukh/ --output=outputs/mobile-layout
 * Install playwright-core in the ignored tools workspace, or set PLAYWRIGHT_MODULE.
 * CHROME_PATH selects an installed Chrome; otherwise Playwright's Chromium is used.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const option=name=>process.argv.find(arg=>arg.startsWith(`--${name}=`))?.slice(name.length+3);
const url=option('url')??'http://127.0.0.1:4206/Tarukh/';
const output=path.resolve(option('output')??'outputs/mobile-layout');
const modulePath=process.env.PLAYWRIGHT_MODULE??path.resolve('outputs/outpost-tools/node_modules/playwright-core/index.mjs');
const {chromium,devices}=await import(pathToFileURL(modulePath).href);
const executablePath=process.env.CHROME_PATH??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
await fs.mkdir(output,{recursive:true});
const report={url,started:new Date().toISOString(),checks:[],failures:[],consoleErrors:[],viewports:[]};
const browser=await chromium.launch({headless:true,executablePath});
const check=(name,details)=>report.checks.push({name,details});
const viewports=[[360,640],[375,667],[390,844],[412,915],[430,932],[768,1024],[1024,768],[844,390],[926,428],[568,320]];

async function inspectLayout(page,label,{panels=false}={}) {
 const result=await page.evaluate(({panels})=>{
  const visible=element=>{if(element.closest('details:not([open])')&&!element.closest('summary'))return false;const r=element.getBoundingClientRect(),s=getComputedStyle(element);return r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none';};
  const rect=element=>{const r=element.getBoundingClientRect();return {name:element.getAttribute('data-ui-zone')||element.getAttribute('aria-label')||element.className,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const failures=[];
  const gate=document.querySelector('.sv-rotate-gate');
  const activeDialog=document.querySelector('dialog[open],.mars-dialog-backdrop .mars-dialog,.ely-dialog,.sv-look-controls details[open]');
  const selectors=gate?'.sv-rotate-card':panels&&activeDialog?'dialog[open],.mars-dialog-backdrop .mars-dialog,.ely-dialog,.sv-look-controls details[open]':'.roam-header,.roam-minimap,.sv-look-controls,.mars-phone-launcher,.flight-pad,.flight-actions,.wheel-steering,.wheel-pedals,.sv-outpost-prompt,.ely-hud';
  const elements=[...document.querySelectorAll(selectors)].filter(visible),boxes=elements.map(rect);
  const root=document.querySelector('.roam-root'),style=root?getComputedStyle(root):null;
  const probe=document.createElement('div');probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:var(--ui-top,8px) var(--ui-right,8px) var(--ui-bottom,8px) var(--ui-left,8px)';
  (root??document.body).append(probe);const ps=getComputedStyle(probe);
  const safe={left:parseFloat(ps.paddingLeft),right:parseFloat(ps.paddingRight),top:parseFloat(ps.paddingTop),bottom:parseFloat(ps.paddingBottom)};probe.remove();
  for(const box of boxes)if(box.left<safe.left-1||box.top<safe.top-1||box.right>innerWidth-safe.right+1||box.bottom>innerHeight-safe.bottom+1)failures.push(`Outside safe viewport: ${JSON.stringify(box)}`);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   if(elements[i].contains(elements[j])||elements[j].contains(elements[i]))continue;
   const a=boxes[i],b=boxes[j];
   if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)failures.push(`Overlapping zones: ${a.name} / ${b.name}`);
  }
  if(document.documentElement.scrollWidth>innerWidth+1)failures.push('Page has horizontal scrolling');
  const targetRoots=gate?[gate]:activeDialog&&panels?[activeDialog]:elements;
  const targets=[];
  for(const targetRoot of targetRoots)for(const button of targetRoot.querySelectorAll('button,summary,select')){
   if(!visible(button))continue;
   const b=rect(button),parent=button.closest('.mars-phone-content,.roam-atlas-list,.mars-dialog,.ely-dialog,.flight-menu-panel');
   // Scrolled content is permitted; its owning panel must fit the safe viewport.
   if(parent){const p=parent.getBoundingClientRect();if(b.bottom<=p.top||b.top>=p.bottom)continue;}
   targets.push({element:button,...b});
   if(b.width<47.5||b.height<47.5)failures.push(`Small touch target: ${b.name} ${b.width}×${b.height}`);
  }
  for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){
   const a=targets[i],b=targets[j];if(a.element===b.element||a.element.contains(b.element)||b.element.contains(a.element))continue;
   // Radial sectors have overlapping rectangles but distinct clipped hit areas.
   // flight-menu-check.mjs checks their press centres instead of triangle corners.
   if(a.element.matches('.flight-menu-sector')&&b.element.matches('.flight-menu-sector'))continue;
   const xGap=Math.max(a.left-b.right,b.left-a.right),yGap=Math.max(a.top-b.bottom,b.top-a.bottom);
   if(xGap<7.5&&yGap<7.5)failures.push(`Touch targets need 8px spacing: ${a.name} / ${b.name}`);
  }
  for(const element of document.querySelectorAll('.roam-header b,.mars-card-label,.mars-phone-app-title,.sv-rotate-card h2')){
   if(!visible(element))continue;const css=getComputedStyle(element);
   if(css.textOverflow!=='ellipsis'&&element.scrollWidth>element.clientWidth+1)failures.push(`Clipped text: ${element.textContent}`);
  }
  return {boxes,failures,safe,mode:root?.getAttribute('data-controls'),portraitGate:Boolean(gate),size:{width:innerWidth,height:innerHeight},rootStyle:style?.height};
 },{panels});
 report.viewports.push({label,...result});
 report.failures.push(...result.failures.map(failure=>`${label}: ${failure}`));
 await page.screenshot({path:path.join(output,`${label}.png`)});
 return result;
}

try {
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',error=>report.consoleErrors.push(error.message));
 page.on('response',response=>{if(response.status()>=400)report.consoleErrors.push(`HTTP ${response.status()} ${response.url()}`);});
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(`${message.text()} ${message.location().url}`);});
 await page.goto(url+'?debug=1');
 assert.equal(await page.getByText('Choose your controls',{exact:true}).count(),0);
 await page.getByRole('button',{name:/Tap to start.*Explore Mars/}).click();
 await page.locator('.starship-arrival').waitFor({state:'detached',timeout:240000});
 await page.waitForFunction(()=>document.querySelector('.sv-world')?.dataset.catchSite==='ready',null,{timeout:240000});
 for(const [width,height] of viewports){
  await page.setViewportSize({width,height});await page.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height&&Boolean(document.querySelector('.sv-rotate-gate'))===(height>width),{width,height},{timeout:30000});
  const label=`mobile-${width}x${height}`;
  const result=await inspectLayout(page,label);
  assert.equal(result.mode,'mobile',label+' retains touch mode');
  assert.equal(result.portraitGate,height>width,label+' portrait is safely paused');
 }
 await page.setViewportSize({width:844,height:390});await page.waitForFunction(()=>!document.querySelector('.sv-rotate-gate'));await page.locator('.flight-actions').waitFor();
 await page.getByRole('button',{name:'Open radiation phone',exact:true}).click();
 await inspectLayout(page,'mobile-phone-844x390',{panels:true});
 await page.getByRole('button',{name:'Field map',exact:true}).click();
 await page.locator('.roam-atlas-plot').waitFor();
 assert.equal(await page.locator('.mars-phone-modal[open]').count(),0);check('Atlas replaces phone without stacked major panels');
 await inspectLayout(page,'mobile-atlas-844x390',{panels:true});
 const plot=page.locator('.roam-atlas-plot'),initial=await plot.locator('svg').getAttribute('viewBox');
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 assert.notEqual(await plot.locator('svg').getAttribute('viewBox'),initial);check('Atlas zoom changes visible crop');
 await page.getByRole('button',{name:'Continue exploring',exact:true}).first().click();
 await page.getByLabel('Camera and graphics',{exact:true}).click();
 await page.getByRole('dialog',{name:'Flight console'}).waitFor();
 await page.getByRole('button',{name:'Graphics',exact:true}).click();
 await inspectLayout(page,'mobile-settings-844x390',{panels:true});
 await page.getByRole('button',{name:'Close flight console',exact:true}).click();
 await page.locator('.sv-world').focus();await page.keyboard.press('KeyP');
 await page.locator('.mars-phone-modal[open]').waitFor();
 assert.equal(await page.locator('.flight-menu[open]').count(),0);check('Phone and flight console open separately');
 await page.getByRole('button',{name:'Close phone',exact:true}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByRole('button',{name:'Main menu',exact:true}).click();
 await page.getByRole('button',{name:'Return to main menu',exact:true}).click();
 await page.getByRole('button',{name:/Elysium Story/}).click();
 await page.locator('[data-ely-panel=prologue]').waitFor();
 await inspectLayout(page,'mobile-story-briefing-844x390',{panels:true});
 await page.getByRole('button',{name:'Skip prologue · travel to Mars',exact:true}).click();
 await page.getByRole('button',{name:'Wake up · begin commissioning',exact:true}).waitFor({timeout:240000});
 await page.getByRole('button',{name:'Wake up · begin commissioning',exact:true}).click();
 await page.getByRole('button',{name:'Explore · follow the station marker',exact:true}).click();
 await page.locator('.ely-hud').waitFor();
 for(const [width,height] of [[844,390],[568,320]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(350);
  await inspectLayout(page,`mobile-story-${width}x${height}`);
 }
 await context.close();
 const desktop=await browser.newContext({viewport:{width:1280,height:720}}),pc=await desktop.newPage();
 await pc.goto(url);
 await pc.getByRole('button',{name:/Click to start.*Explore Mars/}).waitFor();
 assert.equal(await pc.getByText('Choose your controls',{exact:true}).count(),0);
 assert.equal(await pc.locator('.flight-pad,.flight-actions,.wheel-controls').count(),0);
 check('PC launch has no mode selector or touch buttons');
 await pc.screenshot({path:path.join(output,'pc-launch-1280x720.png')});
 await desktop.close();
 for(const device of ['iPhone SE','iPhone 14','iPhone 15','Pixel 7','Galaxy S9+','iPad (gen 7)']){
  assert.ok(devices[device],`Playwright device profile available: ${device}`);
  const context=await browser.newContext({...devices[device],reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto(url);
  await page.getByRole('button',{name:/Tap to start.*Explore Mars/}).waitFor();
  assert.equal(await page.locator('.roam-launch').getAttribute('data-controls'),'mobile');
  assert.equal(await page.getByText('Choose your controls',{exact:true}).count(),0);
  await page.screenshot({path:path.join(output,`launch-${device.replaceAll(/[^a-z0-9]/gi,'-')}.png`)});
  check(`${device}: automatic touch detection without URL override`);await context.close();
 }
 const overridden=await browser.newContext({viewport:{width:1280,height:720}}),overridePage=await overridden.newPage();
 await overridePage.goto(url+'?device=mobile');await overridePage.getByRole('button',{name:/Tap to start.*Explore Mars/}).waitFor();
 check('Hidden mobile override works for desktop testing');await overridden.close();
}catch(error){report.failures.push(error.stack??String(error));}
finally {await browser.close();report.finished=new Date().toISOString();await fs.writeFile(path.join(output,'layout-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,viewports:report.viewports.length,failures:report.failures,consoleErrors:report.consoleErrors},null,2));
if(report.failures.length||report.consoleErrors.length)process.exitCode=1;
