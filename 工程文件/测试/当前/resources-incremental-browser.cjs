'use strict';
// Real browser DOM + IndexedDB, real local images and controlled HTTP.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../..');
const pack=require('../../工具/lib/offline-resources.cjs')(root),entries=pack.manifest.entries.filter(e=>/^image\//.test(e.mime)&&e.bytes<10000).slice(0,2);
const source=process.env.CXX_RESOURCE_SOURCE||path.join(root,'卡片源码/运行时/resources.js'),out=process.env.CXX_RESOURCE_OUT||path.join(root,'.cache/resources230/incremental.json');
const report={source,checks:[],errors:[],boundary:'isolated Edge DOM, IndexedDB and controlled requests; not real ST/TT acceptance'};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let release;
try{for(const mode of ['independent','shadow','edited','removed','adopted','updated','destroyed','retry','offline']){
 const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push(e.message));let requests=0,fail=mode==='retry';release=null;
 await page.route('http://localhost/incremental',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main id="visible">Visible</main>'}));
 await page.route('http://localhost/assets/**',async r=>{const file=new URL(r.request().url()).pathname.split('/').at(-1),entry=entries.find(e=>e.file===file);requests++;if(entry===entries[1]&&mode!=='retry'&&mode!=='offline')await new Promise(done=>release=done);await r.fulfill(fail&&entry===entries[1]?{status:503,body:'fixture unavailable'}:{body:pack.entries.get(file),contentType:entry.mime}).catch(()=>{});});
 await page.goto('http://localhost/incremental');await page.evaluate(()=>{window.resourceReports=[];window.CxxDiagnostics={report:event=>resourceReports.push(event)};});await page.addScriptTag({content:fs.readFileSync(source,'utf8')});
 await page.evaluate(({entries,mode})=>{window.entryFixture=entries;const t=CxxResourceRuntime.token,s=document.createElement('style');s.id='fixture-style';s.textContent='#visible{width:80px;height:80px;background-image:url("'+t(entries[0].id)+'")} .unused{background-image:url("'+t(entries[1].id)+'")}';document.head.append(s);window.fixtureStyle=s;window.fixtureVisible=document.querySelector('#visible');window.resourceManifest={schema:1,id:'incremental-fixture',version:'2.3.0',baseUrl:'http://localhost/assets/',entries};if(mode==='shadow'){const host=document.createElement('div');document.body.append(host);const shadow=host.attachShadow({mode:'open'});shadow.append(s,fixtureVisible);CxxResourceRuntime.install(window,resourceManifest);CxxResources.mount(shadow);}else CxxResourceRuntime.install(window,resourceManifest);},{entries,mode});
 await page.waitForFunction(()=>CxxResources.read().traffic.requests===2);
 // This is the R1 regression: fast image appears while the other request is held.
 await page.waitForFunction(()=>getComputedStyle(fixtureVisible).backgroundImage.includes('blob:'));
 if(mode==='independent'){
  assert.equal(await page.evaluate(()=>document.querySelectorAll('.unused').length),0);assert(await page.evaluate(()=>fixtureStyle.textContent.includes('#cxxasset-')));
  release();release=null;await page.waitForFunction(()=>!fixtureStyle.textContent.includes('#cxxasset-'));assert.equal(requests,2);
  await page.evaluate(()=>{const t=CxxResourceRuntime.token(entryFixture[0].id);const img=document.createElement('img');img.src=t;document.body.append(img);const inline=document.createElement('div');inline.id='inline';inline.style.backgroundImage='url("'+t+'")';document.body.append(inline);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),image=document.createElementNS(svg.namespaceURI,'image');image.setAttribute('href',t);svg.append(image);document.body.append(svg);});
  await page.waitForFunction(()=>document.images[0]?.naturalWidth>0&&document.querySelector('#inline').style.backgroundImage.includes('blob:')&&document.querySelector('image').getAttribute('href').startsWith('blob:'));assert.equal(requests,2);
 }else if(mode==='shadow'){
  release();release=null;await page.waitForFunction(()=>!fixtureStyle.textContent.includes('#cxxasset-'));assert.equal(requests,2);
 }else if(['edited','removed','adopted','updated','destroyed'].includes(mode)){
  await page.evaluate(mode=>{if(mode==='edited')fixtureStyle.textContent='#visible{background:rgb(1, 2, 3)}';if(mode==='removed')fixtureStyle.remove();if(mode==='adopted'){const d=document.implementation.createHTMLDocument();d.head.append(d.adoptNode(fixtureStyle));}if(mode==='updated')CxxResources.update({...resourceManifest,entries:[entryFixture[0]],id:'changed-manifest'});if(mode==='destroyed')CxxResources.destroy();window.expectedStyle=fixtureStyle.textContent;},mode);
  release();release=null;
  if(mode!=='destroyed')await page.waitForFunction(()=>CxxResources.read().active===0&&CxxResources.read().leased===0);
  // Two animation frames ensure observer and resolution microtasks have run.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert(await page.evaluate(()=>fixtureStyle.textContent===expectedStyle));
 }else if(mode==='retry'){
  await page.waitForFunction(()=>CxxResources.read().failed===1);assert(await page.evaluate(()=>fixtureStyle.textContent.includes('#cxxasset-')));const diagnostic=await page.evaluate(()=>resourceReports.at(-1));assert.equal(diagnostic.stage,'图片下载');assert.equal(diagnostic.context.code,'resource-http');assert.equal(diagnostic.context.status,503);assert.equal(diagnostic.context.asset,entries[1].file);assert.equal(diagnostic.context.url,'http://localhost/assets/'+entries[1].file);fail=false;await page.evaluate(()=>CxxResources.retry());await page.waitForFunction(()=>!fixtureStyle.textContent.includes('#cxxasset-'));assert.equal(requests,3);assert.equal(await page.evaluate(()=>CxxResources.read().failed),0);
 }else if(mode==='offline'){
  await page.waitForFunction(()=>!fixtureStyle.textContent.includes('#cxxasset-'));assert.equal(requests,2);await context.setOffline(true);await page.evaluate(()=>{CxxResources.destroy();fixtureStyle.textContent='#visible{background-image:url("'+CxxResourceRuntime.token(entryFixture[0].id)+'")}';CxxResourceRuntime.install(window,resourceManifest);});await page.waitForFunction(()=>!fixtureStyle.textContent.includes('#cxxasset-'));assert.equal(requests,2);
 }
 if(mode!=='destroyed')assert.equal(await page.evaluate(()=>CxxResources.read().leased),0);report.checks.push({mode,requests});await context.close();
}
// The fallback must be able to show an image again after its 32 MiB memory cache evicts it.
const inventory=JSON.parse(fs.readFileSync(path.join(root,'卡片源码/Gal/standing-inventory.json'),'utf8'));
const originals=[...inventory.assets].sort((a,b)=>b.bytes-a.bytes).slice(0,24),pressure=originals.map(a=>({id:a.sha256,mime:'image/png',bytes:a.bytes,file:a.sha256+'.png',aliases:[a.remoteUrl]}));
assert(originals.reduce((n,a)=>n+a.bytes,0)>40*1048576);
const isolated=await browser.newContext(),view=await isolated.newPage();view.on('pageerror',e=>report.errors.push(e.message));let pressureRequests=0;
await view.route('http://localhost/eviction',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'}));
await view.route('http://localhost/assets/**',r=>{const name=new URL(r.request().url()).pathname.split('/').at(-1),i=pressure.findIndex(e=>e.file===name);pressureRequests++;return r.fulfill({contentType:'image/png',body:fs.readFileSync(path.resolve(root,'..',inventory.sourceDirectory,originals[i].source.path))});});
await view.goto('http://localhost/eviction');await view.evaluate(()=>{Object.defineProperty(window,'indexedDB',{value:{open(){throw new DOMException('Storage is unavailable','InvalidStateError');}}});window.evictionDiagnostics=[];window.CxxDiagnostics={report:event=>evictionDiagnostics.push(event)};});await view.addScriptTag({content:fs.readFileSync(source,'utf8')});
const eviction=await view.evaluate(async entries=>{
 const service=CxxResourceRuntime.install(window,{schema:1,id:'eviction-fixture',version:'audit',baseUrl:'http://localhost/assets/',entries});
 const show=async entry=>{const lease=await service.acquire(CxxResourceRuntime.token(entry.id));try{const bitmap=await createImageBitmap(await(await fetch(lease.url)).blob());const size=[bitmap.width,bitmap.height];bitmap.close();return size;}finally{lease.release();service.collect();}};
 for(const entry of entries)await show(entry);
 const before=service.read();let revisited,error;try{revisited=await show(entries[0]);}catch(e){error=e.message;}
 const after=service.read();service.destroy();return {beforeRequests:before.traffic.requests,requests:after.traffic.requests,memoryBytes:after.memoryBytes,failed:after.failed,revisited,error,diagnostic:evictionDiagnostics.at(-1)};
},pressure);
report.eviction=eviction;assert(eviction.revisited?.[0]>0,eviction.error);assert.equal(eviction.failed,0);assert.equal(pressureRequests,pressure.length+1);assert.equal(eviction.memoryBytes<=32*1048576,true);assert.equal(eviction.diagnostic.stage,'缓存写入');assert.equal(eviction.diagnostic.context.code,'resource-cache-write');assert.equal(eviction.diagnostic.context.cause,'InvalidStateError');report.checks.push({mode:'cache-denied-eviction',decoded:pressure.length+1,requests:pressureRequests});await isolated.close();
assert.deepEqual(report.errors,[]);report.pass=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{release?.();await browser.close();fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}})();
