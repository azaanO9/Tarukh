/** Layout fixture for every existing activity, served by the local Vite dev server. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const option=name=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=path.resolve('static-app'),entry=path.join(root,'mobile-qa-fixture.tsx'),html=path.join(root,'mobile-qa-fixture.html');
const output=path.resolve(option('output')??'outputs/mobile-activities');
const created=[];
const report={screens:0,activities:[],errors:[],failures:[]};
let browser;
try{
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(entry,`
import React from 'react';import {createRoot} from 'react-dom/client';
import MissionActivity from '../ui/MissionActivity';import Workshop from '../ui/TrainingWorkshop';import Life from '../ui/LifeSupportGames';
import {TRAINING_IDS,trainingDefinition} from '../game/trainingActivities';
import '../app/globals.css';import '../ui/world.css';import '../ui/mars.css';import '../ui/freeRoam.css';import '../ui/elysium.css';import '../ui/mobileInterface.css';
const root=createRoot(document.getElementById('root')!);window.qaIds=['wire','solar',...TRAINING_IDS];
window.showActivity=(id)=>{const solar=id==='wire'||id==='solar';const Comp=solar?MissionActivity:trainingDefinition(id).screen==='life'?Life:Workshop;
root.render(<main className="roam-root sv-root" data-controls="mobile" data-phase="story"><div className="ely-shell"><div className="ely-backdrop"><section className="ely-dialog" role="dialog"><header><h2>{id}</h2><button className="ely-close">×</button></header><div className="ely-dialog-body"><Comp key={id} {...(solar?{kind:id==='wire'?'wire-repair':'panel-cleaning',taskId:id==='wire'?'solar-connect':'solar-clean'}:{activityId:id})} onComplete={()=>document.body.dataset.complete='true'} onCancel={()=>{}}/></div><footer><span>Kaelen Reeves · Sol 1</span><button>Return to station</button></footer></section></div></div></main>);};
window.showActivity('wire');
`,{flag:'wx'});created.push(entry);
  await fs.writeFile(html,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="./mobile-qa-fixture.tsx"></script></body></html>',{flag:'wx'});created.push(html);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:568,height:320},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto((option('url')??'http://127.0.0.1:4210/Tarukh/')+'mobile-qa-fixture.html');
  await page.waitForFunction(()=>typeof window.showActivity==='function');
  const ids=await page.evaluate(()=>window.qaIds);
  for(const [width,height] of [[568,320],[844,390],[1024,768]]){
    await page.setViewportSize({width,height});
    for(const id of ids){
      await page.evaluate(id=>window.showActivity(id),id);await page.waitForTimeout(60);
      const failures=await page.evaluate(()=>{
        const issues=[],dialog=document.querySelector('.ely-dialog'),body=document.querySelector('.ely-dialog-body'),r=dialog.getBoundingClientRect();
        if(r.x<0||r.y<0||r.right>innerWidth+1||r.bottom>innerHeight+1)issues.push('Dialog outside screen');
        if(body.scrollWidth>body.clientWidth+1)issues.push('Horizontal activity overflow');
        for(const button of dialog.querySelectorAll('button,input[type="range"]')){
          const b=button.getBoundingClientRect();if(b.width&&b.height&&(b.width<47.5||b.height<47.5))issues.push('Small target: '+(button.getAttribute('aria-label')||button.textContent));
        }
        return issues;
      });
      report.failures.push(...failures.map(e=>`${id} ${width}x${height}: ${e}`));
      await page.screenshot({path:path.join(output,`${id}-${width}x${height}.png`)});report.screens++;
    }
  }
  report.activities=ids;
}catch(error){report.errors.push(error.stack??String(error));}
finally{
  await browser?.close();
  for(const file of created)await fs.unlink(file);
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report,null,2));if(report.errors.length||report.failures.length)process.exitCode=1;
