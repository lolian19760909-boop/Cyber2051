/** U07 host-side worldbook bridge: read the bound book, write one entry and restore it. */
import fs from 'node:fs';
import {chromium} from 'playwright';
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base='http://127.0.0.1:22351';
const report={schema:1,at:new Date().toISOString()};
const browser=await chromium.launch({executablePath:EDGE,headless:true});
const page=await browser.newPage({viewport:{width:1184,height:800}});
const errors=[];page.on('pageerror',error=>errors.push(String(error.message).slice(0,200)));
try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>globalThis.SillyTavern?.getContext,null,{timeout:180000});
 await page.waitForFunction(()=>globalThis.Cxx233Updater?.host?.getContext,null,{timeout:180000});
 await page.evaluate(async()=>{const chars=globalThis.SillyTavern.getContext().characters;const i=chars.findIndex(row=>/^WEB_HOST_TEST_.*\.png$/.test(row.avatar));if(i<0)throw new Error('夹具角色缺失');await globalThis.SillyTavern.getContext().selectCharacterById(i);});
 await page.waitForTimeout(1200);
 await page.evaluate(async()=>{for(const d of document.querySelectorAll('dialog[open],.TH-popup')){const buttons=[...d.querySelectorAll('button')];const hit=buttons.find(b=>/确定|确认|知道了|关闭|好的|继续/.test(b.textContent||''))||buttons[buttons.length-1];hit?.click();}await new Promise(r=>setTimeout(r,300));});
 const opened=await page.evaluate(async()=>{const mod=await import('/scripts/extensions/third-party/Cyber2051-Web/index.mjs');await mod.openWeb();return globalThis.Cxx2051WebHost?.worldbook?{available:true}:{available:false};});
 report.opened=opened;
 await page.waitForFunction(()=>{const f=document.getElementById('cxx2051-web-panel')?.querySelector('iframe');const w=f?.contentWindow;return w?.CxxWebApp?.read?.().booted===true;},null,{timeout:300000});
 report.web=await page.evaluate(()=>{const f=document.getElementById('cxx2051-web-panel').querySelector('iframe');const read=f.contentWindow.CxxWebApp.read();return {phase:read.phase,world:read.world};});
 report.host=await page.evaluate(async()=>{const host=globalThis.Cxx2051WebHost;const names=host.worldbook.books();const books=await host.hostBooks();const first=books[0];const before=first?first.entries.length:0;let write=null;
  if(first){const target=first.entries.find(entry=>entry.content&&entry.content.length<400)||first.entries[0];const original=String(target.content||'');
   const applied=await host.worldbook.apply({bookId:first.bookId,patches:[{entryId:target.id,config:{},content:original+' '}]});
   const readback=await host.worldbook.read({bookId:first.bookId});
   const changed=String(readback.entries.find(entry=>String(entry.id)===String(target.id))?.content||'');
   const restored=await host.worldbook.apply({bookId:first.bookId,patches:[{entryId:target.id,config:{},content:original}]});
   const final=await host.worldbook.read({bookId:first.bookId});
   write={entryId:target.id,applied:applied.ok,changedTrailingSpace:changed.endsWith(' '),restored:restored.ok,backToOriginal:String(final.entries.find(entry=>String(entry.id)===String(target.id))?.content||'')===original};}
  return {canRead:host.worldbook.canRead,canWrite:host.worldbook.canWrite,names,books:books.map(book=>({bookId:book.bookId,entries:book.entries.length})),firstEntries:before,write};});
 report.pageErrors=errors.slice(0,6);
}catch(error){report.error=String(error&&error.message||error);report.pageErrors=errors.slice(0,6);}
finally{await browser.close();}
fs.writeFileSync('reports/u07-host-worldbook.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,1));