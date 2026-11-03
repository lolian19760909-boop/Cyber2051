/** Signed balances across the actual bundled SQLite plugin and legacy templates. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createPackagedServer} from './local-runtime.mjs';
const root=path.resolve(process.argv[2]||'.cache/feedback-batch1-20261101/package');
const out=path.resolve(process.argv[3]||'.cache/feedback-batch1-20261101/signed-balance-plugin.json');
const release=JSON.parse(fs.readFileSync(path.join(root,'current.json'))).release;
const app=createPackagedServer({root}),server=http.createServer((req,res)=>{
 if(req.url==='/balance-check')return res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end('<!doctype html><title>SQLite balance check</title>');
 if(req.url==='/favicon.ico')return res.writeHead(204).end();app.emit('request',req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const report={buildId:release,scope:'Actual bundled SQLite/API and shared store; synthetic tables, 0 model requests',checks:[],errors:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const mode of ['fresh','template-upgrade','cold-restore','cold-restore-partial']){
  const page=await browser.newPage();page.on('pageerror',error=>report.errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port+'/balance-check');
  const checked=await page.evaluate(async({release,mode})=>{
   const {prepareDatabase}=await import('/releases/'+release+'/src/database/runtime.mjs'),{stateTemplate}=await import('/releases/'+release+'/src/database/sqlite-state.mjs');
   const {host,template}=await prepareDatabase(),S=globalThis.CxxDataStore,R=globalThis.CxxDataRows,Y=globalThis.CxxDataSync;
   const binding={chatId:'balance-'+mode,rows:[{mes:'合成余额验证',name:'检查',swipe_id:0}],save:async()=>{},request:async()=>{throw Error('Unexpected model request');}};
   await host.bind(binding);const seed=structuredClone(template);
   if(mode!=='fresh')for(const name of ['cxx_actor_stat','cxx_wallet']){const sheet=seed['sheet_'+name];sheet.sourceData.ddl=sheet.sourceData.ddl.replace(/yen INTEGER NOT NULL DEFAULT 0(?:\s*CHECK\(yen >= 0\))?/,'yen INTEGER NOT NULL DEFAULT 0 CHECK(yen >= 0)');}
   seed.sheet_cxx_wallet.content.push([8,'chat',123,140,17,6]);
   seed.sheet_balance_notes={...structuredClone(seed.sheet_cxx_pref),uid:'sheet_balance_notes',name:'余额验证私人表',sourceData:{...structuredClone(seed.sheet_cxx_pref.sourceData),ddl:'CREATE TABLE balance_notes (\n row_id INTEGER PRIMARY KEY, -- 行号\n note TEXT -- 备注\n);'},content:[['行号','备注'],[9,'保留自用记录']]};
   if(mode==='cold-restore-partial')for(const key of ['note','updateConfig','exportConfig','orderNo'])delete seed.sheet_balance_notes[key];
   const imported=await host.api.importTemplateFromData(seed,{scope:'chat',dataMode:'seed'});if(!imported.success)throw Error(imported.message);
   if(!await host.api.importTableAsJson(JSON.stringify(seed)))throw Error('Synthetic baseline rows were not stored');
   const before=host.api.exportTableAsJson();
   const beforeNotes=Object.values(before).find(t=>t?.name==='余额验证私人表');if(beforeNotes?.content?.[1]?.[1]!=='保留自用记录')throw Error('Synthetic private row is missing before migration');
   if(mode.startsWith('cold-restore')){
    const saved=host.snapshot();
    await host.bind({...binding,rows:structuredClone(saved.rows),metadata:structuredClone(saved.metadata),settings:structuredClone(saved.settings),worldbooks:structuredClone(saved.worldbooks),prepareTables:tables=>S.upgradeSchema(stateTemplate(tables),template)});
   }
   const store=S.create({scope:{AutoCardUpdaterAPI:host.api},template}),ready=await store.ensureSchema({wait:8,step:25});if(!ready.ok)throw Error(ready.reason);
   const originalWallet=S.tablesOf({exportTableAsJson:()=>before},template).cxx_wallet,keptWallet=S.tablesOf(host.api,template).cxx_wallet;
   if(JSON.stringify(originalWallet.content)!==JSON.stringify(keptWallet.content))throw Error('Existing wallet rows changed during migration');
   const notes=Object.values(host.api.exportTableAsJson()).find(t=>t?.name==='余额验证私人表');if(notes?.content?.[1]?.[1]!=='保留自用记录')throw Error('Private table changed');
   const sync=Y.create({store,rows:R});
   for(const yen of [-100,0,250]){
    const terminal={wallet:{yen,earned:Math.max(100,yen+100),spent:Math.max(100,yen+100)-yen},ensemble:{actors:{player:{actorId:'player',name:'玩家',wallet:{yen}},debt:{actorId:'debt',name:'欠款人物',wallet:{yen:-37}}}}};
    const result=await sync.pushAll(terminal,7);if(!result.ok)throw Error(result.reason);
    const tables=S.tablesOf(host.api,template),wallet=tables.cxx_wallet.content.slice(1).find(row=>row[1]==='chat'),player=tables.cxx_actor_stat.content.slice(1).find(row=>row[1]==='player'),debt=tables.cxx_actor_stat.content.slice(1).find(row=>row[1]==='debt');
    if(Number(wallet?.[2])!==yen||Number(player?.[5])!==yen||Number(debt?.[5])!==-37)throw Error('Saved balances differ from formal state');
   }
   if(mode==='fresh'){
    await import('/releases/'+release+'/card/共享/data-clone.js');await import('/releases/'+release+'/card/长期记忆/material.js');
    const current=host.api.exportTableAsJson(),[collisionKey,privateTable]=Object.entries(current).find(([,table])=>table?.name==='余额验证私人表'),memory={...structuredClone(privateTable),name:'纪要表',sourceData:{...structuredClone(privateTable.sourceData),ddl:'CREATE TABLE collision_memory (row_id INTEGER PRIMARY KEY, code TEXT, period TEXT, summary TEXT, memory TEXT, dialogue TEXT);'},content:[['row_id','编码索引','时间跨度','概览','纪要','重要对话'],[1,'AM0001','2051','旧记忆','旧故事的已确认经历','']]};
    const merged=CxxMemoryMaterial.merge(current,{[collisionKey]:memory});if(!await host.api.importTableAsJson(JSON.stringify(merged)))throw Error('Merged memory tables were not stored');const restored=host.api.exportTableAsJson();if(!Object.values(restored).some(t=>t?.name==='余额验证私人表'&&t.content[1][1]==='保留自用记录'))throw Error('Memory import overwrote the private table');if(!Object.values(restored).some(t=>t?.name==='纪要表'&&t.content.length===2))throw Error('Restored memory table was lost');
   }
   return {mode,balances:[-100,0,250],npc:-37,oldRowsPreserved:true,privateTablePreserved:true,...(mode==='fresh'?{memoryCollisionPreserved:true}:{})};
  },{release,mode});report.checks.push(checked);await page.close();console.log('PASS '+mode);
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.error=error.message;process.exitCode=1;console.error(error.stack);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,out}));
