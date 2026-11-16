/** Production-preview checks: node scripts/flight-cinematic-check.mjs --url=http://127.0.0.1:4210/Tarukh/ */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const url=option('url')??'http://127.0.0.1:4210/Tarukh/';
const output=path.resolve(option('output')??'outputs/arrival-review');await fs.mkdir(output,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report={shots:[],errors:[],checks:[]};
try {
  for(const [name,time,width,height,mobile] of (option('journey')==='1'?[]:[['launch',2,1440,900,false],['earth-orbit',8,1440,900,false],['mars-entry',16,1440,900,false],['mobile-orbit',8,844,390,true]])){
    const context=await browser.newContext({viewport:{width,height},hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});
    await page.goto(`${url}?debug=1&device=${mobile?'mobile':'pc'}&arrivalPreview=${time}`);
    await page.getByRole('button',{name:'Start Free Explorer, open terrain'}).click();
    await page.waitForSelector('.starship-arrival-world[data-ready="true"]',{timeout:240000});
    await page.waitForTimeout(1200);
    const data=await page.locator('.starship-arrival-world').evaluate(e=>({...e.dataset}));
    assert.equal(data.rocketModel,'loaded');assert.equal(data.planetTextures,'3');assert.equal(data.coastTextures,'2');
    await page.screenshot({path:path.join(output,`${name}.png`)});
    report.shots.push({name,width,height,...data});
    console.log(name,data);
    await context.close();
  }
  if(option('journey')==='1'){
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});
    await page.goto(`${url}?debug=1&device=pc`);
    await page.getByRole('button',{name:'Start Free Explorer, open terrain'}).click();
    await page.waitForSelector('.starship-arrival-world[data-ready="true"]',{timeout:240000});
    const arrival=page.locator('.starship-arrival');
    await arrival.getByRole('button',{name:'Pause',exact:true}).click();
    await page.waitForTimeout(300);const pausedTime=Number(await arrival.getAttribute('data-time'));
    await page.waitForTimeout(700);assert.equal(Number(await arrival.getAttribute('data-time')),pausedTime);report.checks.push('Pause freezes the sequence');
    await arrival.getByRole('button',{name:'Resume',exact:true}).click();
    for(const shot of ['earth-orbit','mars-entry','landing']){
      await page.waitForFunction(shot=>document.querySelector('.starship-arrival')?.getAttribute('data-shot')===shot,shot,{timeout:240000});
      report.checks.push(`Natural playback reaches ${shot}`);
      if(shot==='landing'){
        await page.waitForFunction(()=>Number(document.querySelector('.sv-world')?.getAttribute('data-arrival-time'))>14,null,{timeout:120000});
        await page.screenshot({path:path.join(output,'preserved-mars-landing.png')});
      }
    }
    await arrival.waitFor({state:'detached',timeout:120000});
    assert.equal(await page.locator('.sv-world').getAttribute('data-catch-site'),'ready');
    await page.screenshot({path:path.join(output,'exploration-handoff.png')});report.checks.push('Natural completion enters the prepared Mars game');
    await context.close();
    for(const reduced of [false,true]){
      const mobile=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,reducedMotion:reduced?'reduce':'no-preference'});
      const p=await mobile.newPage();p.on('pageerror',e=>report.errors.push(e.message));
      await p.route('**/art/flight/**',route=>route.abort());
      await p.goto(`${url}?device=mobile&debug=1`);
      await p.getByRole('button',{name:'Start Free Explorer, open terrain'}).tap();
      if(!reduced){await p.locator('.starship-arrival').getByRole('button',{name:/Skip/}).click();}
      await p.locator('.starship-arrival').waitFor({state:'detached',timeout:240000});
      await p.waitForFunction(()=>document.querySelector('.sv-world')?.dataset.catchSite==='ready',null,{timeout:240000});
      report.checks.push(`${reduced?'Reduced motion':'Early skip'} reaches Mars with all new image requests blocked`);
      await mobile.close();
    }
  }
  assert.deepEqual(report.errors,[]);
}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));await browser.close();}
