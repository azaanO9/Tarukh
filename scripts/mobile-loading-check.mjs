import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const option=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
const page=await context.newPage(),cdp=await context.newCDPSession(page);
await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await page.addInitScript(()=>{window.__metrics={lcp:0,cls:0};new PerformanceObserver(list=>{for(const e of list.getEntries())window.__metrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__metrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});});
try{
  await page.goto(option('url')??'http://127.0.0.1:4211/Tarukh/',{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByRole('button',{name:'Start Free Explorer, open terrain'}).waitFor({timeout:120000});
  const interactive=await page.evaluate(()=>performance.now());
  await page.waitForTimeout(16000);
  const data=await page.evaluate(()=>({metrics:window.__metrics,paints:performance.getEntriesByType('paint').map(e=>({name:e.name,ms:e.startTime})),resources:performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),transfer:e.transferSize,bytes:e.decodedBodySize,duration:e.duration}))}));
  const output=path.resolve(option('output')??'outputs/mobile-loading.json');await fs.mkdir(path.dirname(output),{recursive:true});
  await fs.writeFile(output,JSON.stringify({profile:'Chrome, 4x CPU, 1.6 Mbit/s down, 150 ms latency, cold cache, 844×390',interactive,...data},null,2));
  console.log(JSON.stringify({interactive,...data.metrics,paints:data.paints,transferred:data.resources.reduce((n,r)=>n+r.transfer,0)}));
}finally{await browser.close();}
