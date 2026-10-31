'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'.cache/iteration225/resources');
(async()=>{
 const bytes=fs.readFileSync(path.join(root,'.cache/build/赛博小祥2051-V2.2.5-排错交互迭代候选.json'));
 const bootstrap=JSON.parse(bytes).data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-runtime-bootstrap').content;
 const report={card:crypto.createHash('sha256').update(bytes).digest('hex'),checks:[]};
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const page=await browser.newPage();
  await page.route('http://localhost/recovery',r=>r.fulfill({body:'<!doctype html><main></main>',contentType:'text/html'}));
  await page.goto('http://localhost/recovery');await page.addScriptTag({content:bootstrap});
  const base='https://cyber2051.top/resources/2.2.5/2fe37c628c97dc81c66583e5222c5076b6eded4ea2c380780494955b958923e2/';
  const manifest=await(await page.request.get(base+'manifest.json')).json();
  const entries=manifest.entries.slice().sort((a,b)=>a.bytes-b.bytes).filter(e=>e.bytes>10000).slice(0,4);
  await page.evaluate(({manifest,entries,base})=>{
   CxxResources.update({...manifest,baseUrl:base,entries:entries.slice(0,3)});
   for(const e of entries.slice(0,3)){const img=document.createElement('img');img.src=CxxResourceRuntime.token(e.id);document.querySelector('main').append(img);}
   window.preloading=CxxResources.preload();
  },{manifest,entries,base});
  await page.evaluate(()=>preloading);
  await page.waitForFunction(()=>[...document.images].length===3&&[...document.images].every(i=>i.src.startsWith('blob:')&&i.naturalWidth>0));
  assert.equal(await page.evaluate(()=>CxxResources.read().installed),3);
  report.checks.push('Visible image loading and full preload share requests without revoking newly assigned URLs');
  const failedURL=base+entries[3].file;
  await page.route(failedURL,r=>r.fulfill({status:503,body:'fixture unavailable'}));
  await page.evaluate(({manifest,entries,base})=>{
   window.resourceReports=[];window.CxxDiagnostics={report:event=>resourceReports.push(event)};
   CxxResources.update({...manifest,entries,baseUrl:base});
   const img=document.createElement('img');img.id='retry-image';img.src=CxxResourceRuntime.token(entries[3].id);document.querySelector('main').append(img);
  },{manifest,entries,base});
  await page.waitForFunction(()=>CxxResources.read().failed===1);
  assert.equal(await page.getByRole('button',{name:'美术加载失败 · 查看',exact:true}).count(),1);
  const events=await page.evaluate(()=>resourceReports);
  assert.equal(events.length,1);assert.equal(events[0].detail,entries[3].file);assert(events[0].message.includes('503'));
  await page.unroute(failedURL);await page.evaluate(()=>CxxResources.retry());
  await page.waitForFunction(()=>document.querySelector('#retry-image').src.startsWith('blob:')&&document.querySelector('#retry-image').naturalWidth>0);
  assert.equal(await page.evaluate(()=>CxxResources.read().failed),0);
  assert.equal(await page.getByRole('button',{name:'美术加载失败 · 查看',exact:true}).count(),0);
  report.checks.push('HTTP 503 appears in the resource panel and diagnostics; retry loads the image and clears the failure prompt');
 }catch(e){report.failure=e.stack;throw e;}finally{await browser.close();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'recovery-checks.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
