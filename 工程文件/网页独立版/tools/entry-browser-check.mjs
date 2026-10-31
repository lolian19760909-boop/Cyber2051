/** Execute the real generated entry, not just its HTTP status or syntax. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {createPackagedServer} from './local-runtime.mjs';
const arg=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const root=path.resolve(arg('--root')||'工程文件/.cache/web-performance-20261028/candidate'),prefix=arg('--prefix')||'',expectedFailure=process.argv.includes('--expect-failure'),choiceOnly=process.argv.includes('--choice-only');
const out=path.resolve(arg('--out')||'工程文件/.cache/web-entry-fix-20261029/entry-browser.json'),current=JSON.parse(fs.readFileSync(path.join(root,'current.json')));
const server=arg('--base')?null:createPackagedServer({root});if(prefix&&server)server.prependListener('request',req=>{if(req.url.startsWith(prefix+'/'))req.url=req.url.slice(prefix.length);});
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=arg('--base')||'http://127.0.0.1:'+server.address().port;
const report={at:new Date().toISOString(),buildId:current.release,prefix,expectedFailure,choiceOnly,scope:'Isolated browser context, real generated entry and local resource packs; no user story or paid model',errors:[],failedRequests:[],zipRequests:[],checks:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>report.errors.push({message:e.message,stack:e.stack}));page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));context.on('request',r=>{if(r.url().includes('.zip'))report.zipRequests.push({url:r.url(),range:r.headers().range||null});});
 await page.goto(base+prefix+'/?mode=local',{waitUntil:'domcontentloaded'});
 if(expectedFailure){
  await page.waitForFunction(()=>document.body.innerText.includes('Invalid base URL'));
  report.failure=await page.evaluate(async()=>({url:location.href,text:document.querySelector('#cxx-entry-loading')?.innerText,error:await window.CxxEntryLoading.ready.then(()=>null,e=>({message:e.message,stack:e.stack}))}));
  assert.ok(!report.failure.url.includes('/releases/'));assert.match(report.failure.error.message,/Invalid base URL/);report.checks.push('Old root entry reproduces Invalid base URL before release redirect');
 }else{
  await page.waitForURL('**/releases/'+current.release+'/index.html?mode=local');
  await page.locator('.cxx-pack-choice[open]').waitFor();report.checks.push('Root redirects to current release; application reaches quality choice');
  const images=await page.evaluate(async()=>{const view=await window.CxxEntryLoading.ready;await view.ready;return view.metrics();});assert.equal(images.assetError,null);report.checks.push('Entry map, logo and default sprite URL load and decode');
  if(!choiceOnly){
   await page.locator('.cxx-pack-choice button').click();
   await page.waitForFunction(()=>!!window.CxxOpeningPage&&!document.querySelector('.cxx-boot')||document.getElementById('status-line')?.textContent.includes('启动失败'),{},{timeout:180000});
   report.menu=await page.evaluate(()=>({url:location.href,status:document.getElementById('status-line')?.textContent,buttons:[...document.querySelectorAll('.game-navigation button')].map(e=>e.textContent),boot:!!document.querySelector('.cxx-boot')}));
   assert.ok(report.menu.buttons.some(text=>text.includes('新游戏')));assert.ok(!report.menu.status?.includes('启动失败'));report.checks.push('Real standard resource install finishes and main menu is constructed');
   const later=page.getByRole('button',{name:'稍后再说',exact:true});if(await later.isVisible())await later.click();
   const title=page.locator('.cx77-splash[data-phase=title]');if(await title.isVisible())await title.click();
   await page.locator('.cx77-splash').waitFor({state:'detached'});
   if(await later.isVisible())await later.click();await page.getByRole('button',{name:'新游戏',exact:true}).click({trial:true});
   report.checks.push('Title/notice can be dismissed and New Game is visible, enabled and unobstructed');
   const before=report.zipRequests.length;await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.CxxOpeningPage&&!document.querySelector('.cxx-boot'),{},{timeout:30000});
   report.reloadZipRequests=report.zipRequests.length-before;assert.equal(report.reloadZipRequests,0);report.checks.push('Direct release reload reaches menu without another ZIP request');
   report.cache=await page.evaluate(async()=>{const cache=await caches.open('cxx2051-official-media-v1'),keys=await cache.keys();return {blobs:keys.filter(r=>r.url.includes('/blob/')).length,complete:keys.filter(r=>r.url.includes('/complete/')).length};});
  }
  assert.deepEqual(report.errors,[]);report.checks.push('No uncaught page errors');
 }
 report.ok=true;
}catch(error){report.ok=false;report.failureMessage=error.stack;throw error;}
finally{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');await browser?.close();if(server)await new Promise(r=>server.close(r));console.log(JSON.stringify(report,null,2));}
