import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium} from 'playwright';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,executablePath:EDGE});
const context=await browser.newContext({viewport:{width:1400,height:900}});
const page=await context.newPage();
const logs=[];
page.on('console',m=>{if(m.type()==='error')logs.push('console '+m.text());});
page.on('pageerror',e=>logs.push('pageerror '+String(e)));
page.on('requestfailed',r=>logs.push('failed '+r.url()+' '+(r.failure()?.errorText||'')));
page.on('response',r=>{if(r.status()>=400)logs.push('HTTP '+r.status()+' '+r.url());});
await page.goto('http://127.0.0.1:8826/play/?mode=local',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('dialog.cxx-pack-choice',{timeout:60000});
await page.locator('dialog.cxx-pack-choice input[value="standard"]').check();
await page.locator('dialog.cxx-pack-choice button.primary').click();
await page.waitForSelector('dialog.cxx-pack-choice',{state:'detached',timeout:60000});
const state=async()=>page.evaluate(async()=>{
 const rel=(await (await fetch('/play/current.json',{cache:'no-store'})).json()).release;
 const base=new URL('/play/releases/'+rel+'/',location.origin);
 const data=await (await fetch(base+'data/player-pack.json',{cache:'no-store'})).json();
 const cache=await caches.open('cxx2051-official-media-v1');
 const keys=(await cache.keys()).map(r=>r.url);
 const has=id=>keys.some(u=>u.includes('/complete/'+id));
 const bad=performance.getEntriesByType('resource').filter(e=>e.responseStatus>=400).map(e=>({name:e.name,status:e.responseStatus,init:e.initiatorType}));
 return {status:document.querySelector('#status-line')?.textContent,quality:localStorage.getItem('cxx2051:pack-quality:v1'),keys:keys.length,complete:{common:has(data.layers.common.id),webp:has(data.layers.webp.id)},bad};
});
let s;
for(let i=0;i<60;i++){await page.waitForTimeout(2000);try{s=await state();}catch(e){s={error:String(e)}}console.log(i,s);if((s.complete?.common&&s.complete?.webp)||s.status?.includes('失败'))break;}
await page.waitForTimeout(1000);
const more=await page.evaluate(async()=>{
 const rel=(await (await fetch('/play/current.json',{cache:'no-store'})).json()).release;
 const data=await (await fetch('/play/releases/'+rel+'/data/player-pack.json',{cache:'no-store'})).json();
 const row=data.layers.webp.entries.find(e=>e.aliases?.some(a=>a.startsWith('assets/')));
 const alias=row.aliases.find(a=>a.startsWith('assets/'));
 try{const resolved=CxxResources.resolve(alias);const buffer=await CxxResources.load(alias,{type:'buffer'});return{alias,resolved,bytes:buffer.byteLength,mime:CxxResources.record(alias)?.mime,quality:CxxResources.quality};}catch(e){return{error:String(e)}}
});
console.log('MORE',more);
console.log('LOGS',JSON.stringify(logs,null,2));
await page.screenshot({path:path.join(HERE,'..','..','.cache','play-loading-20261027','checks','pack-real-debug.png')});
await browser.close();
