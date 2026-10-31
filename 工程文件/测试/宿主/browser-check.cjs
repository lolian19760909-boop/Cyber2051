'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require(process.env.CXX_PLAYWRIGHT||'C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),cache=path.join(root,'.cache/tt-compat');
async function main(){
  fs.mkdirSync(cache,{recursive:true});const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end('<!doctype html><html><body></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;const cases=[];
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CXX_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
    for(const width of [1280,390]){
      const page=await browser.newPage({viewport:{width,height:844},hasTouch:width===390}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
      await page.addScriptTag({path:path.join(root,'卡片源码/Gal/landscape.js')});
      const result=await page.evaluate(async mobile=>{
        const nativeCalls=[];document.body.innerHTML='<section id="gal"><header class="cxx-gal-header" style="height:44px"></header><nav id="toolbar"></nav><input></section>';
        const root=document.querySelector('#gal');window.Cxx236Preferences={read:()=>({device:mobile?'mobile':'desktop'})};
        Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:()=>{nativeCalls.push('fullscreen');throw Error('unsupported');}});
        Object.defineProperty(HTMLElement.prototype,'showPopover',{configurable:true,value:()=>{nativeCalls.push('popover');throw Error('unsupported');}});
        const originalSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw Error('storage unavailable');};
        const layout=CxxGalLandscape.mount({document,root,toolbar:document.querySelector('#toolbar')});
        const initial=CxxGalViewport.read(),frame=document.createElement('iframe');document.body.append(frame);const restore=CxxGalViewport.place(frame);const placed={transform:frame.style.transform,height:frame.style.height};
        await layout.toggle();await new Promise(requestAnimationFrame);const after=CxxGalViewport.read();restore();const restoreAfter=CxxGalViewport.place(frame);const placedAfter={transform:frame.style.transform,height:frame.style.height};restoreAfter();frame.remove();layout.destroy();await new Promise(requestAnimationFrame);Storage.prototype.setItem=originalSet;
        return {initial,after,placed,placedAfter,nativeCalls,viewports:document.querySelectorAll('#cxx-gal-visible-viewport').length,service:!!window.CxxGalViewport};
      },width===390);
      assert.equal(result.viewports,0);assert.equal(result.service,false);
      // Auto follows the current device orientation; an explicit toggle rotates
      // the CSS viewport. The retired default was forced landscape on entry.
      if(width===390){assert.deepEqual(result.nativeCalls,[]);assert.equal(result.initial.rotated,false);assert.equal(result.after.rotated,true);assert.equal(result.placed.transform,'none');assert.equal(result.placedAfter.transform,'rotate(90deg)');}
      await page.addScriptTag({path:path.join(__dirname,'probe.js')});await page.locator('#cxx-tt-compat-probe').waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.match(await page.locator('#cxx-tt-compat-probe pre').textContent(),/未找到宿主上下文/);
      await page.screenshot({path:path.join(cache,'probe-'+width+'.png')});await page.locator('#cxx-tt-compat-probe button').click();assert.equal(await page.locator('#cxx-tt-compat-probe').count(),0);assert.deepEqual(errors,[]);
      cases.push({width,gal:result,probe:{opens:true,closes:true,overflow:false},errors});await page.close();
    }
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
  const report={at:new Date().toISOString(),cases,realTT:false,realPhone:false};fs.writeFileSync(path.join(cache,'browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
