'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const B=require('./build.cjs'),output=path.join(B.root,'.cache/launcher-ui/media-checks.json');
async function main(){
 const png=fs.readFileSync(path.join(B.root,'卡片源码/主题/assets/Tokyo2051-logo-v223.png'));let hits=0;
 const server=http.createServer((req,res)=>{if(req.url.startsWith('/asset/')){hits++;res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public,max-age=31536000,immutable'});res.end(png);}else{res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8">');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),checks=[];
 try{
  const page=await browser.newPage();await page.goto(origin);const source=B.source('运行时/media-preload.js');
  // The public URL allowlist stays unchanged in the actual source; test URLs map via Image.src only.
  const setup=async()=>{await page.addScriptTag({content:source});await page.evaluate(origin=>{window.NativeImage=Image;window.Image=class extends NativeImage{set src(v){super.src=v.replace('https://cyber2051.top/img/galgame/',origin+'/asset/');}get src(){return super.src;}};window.manifest={id:'fixture',files:[{url:'https://cyber2051.top/img/galgame/one.png',file:'one.png',bytes:123,common:true},{url:'https://cyber2051.top/img/galgame/two.png',file:'two.png',bytes:456,common:false}]};window.preload=CxxMediaPreload.create({win:window,manifest});},origin);};
  await setup();assert.equal(hits,0);assert.equal(await page.evaluate(()=>preload.read().offered),false);await page.evaluate(()=>preload.skip());assert.equal(hits,0);checks.push('First-visit prompt and Skip do not download images');
  await page.evaluate(()=>preload.start('all'));assert.equal(hits,2);assert.equal(await page.evaluate(()=>preload.read().completed),2);checks.push('Both selected images load successfully before completion is recorded');
  await page.reload();await setup();assert.equal(await page.evaluate(()=>preload.read().last.count),2);await page.evaluate(()=>preload.start('all'));assert.equal(hits,2);checks.push('Reload and repeat preload reuse native HTTP cache, with zero new asset requests');
  await page.evaluate(async()=>{preload.destroy();window.Image=class{set src(v){this.v=v;this.naturalWidth=0;setTimeout(()=>this.onerror?.(),0);}removeAttribute(){}};preload=CxxMediaPreload.create({win:window,manifest:{...manifest,id:'new-version'}});await preload.start('all');});assert.equal(await page.evaluate(()=>preload.read().completed),0);assert.equal(await page.evaluate(()=>preload.read().failed.length),2);assert.equal(await page.evaluate(()=>preload.read().last),null);checks.push('Failed image requests and changed manifests never report a complete installation');
  await page.evaluate(()=>{preload.destroy();window.Image=class{set src(v){}removeAttribute(){}};preload=CxxMediaPreload.create({win:window,manifest});window.pending=preload.start('all');preload.stop();});await page.evaluate(()=>pending);assert.equal(await page.evaluate(()=>preload.read().running),false);await page.evaluate(()=>preload.destroy());checks.push('Pause and teardown settle in-flight work without late success');
  fs.writeFileSync(output,JSON.stringify({boundary:'Native browser HTTP cache against local immutable image server; no VPS deployment, no permanent-offline guarantee',checks,hits},null,2));console.log(JSON.stringify({checks,hits}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
