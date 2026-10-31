/** Keep the original 1.3 plugin; adapt only its fixed host module locations and UI wait. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {WEB} from './workspace-paths.mjs';
export function buildDatabase(out){
 const source=path.join(WEB,'vendor/database'),receipt=JSON.parse(fs.readFileSync(path.join(source,'sources.json'))),target=path.join(out,'database');fs.mkdirSync(target,{recursive:true});
 for(const row of receipt.files){const bytes=fs.readFileSync(path.join(source,row.file));if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('数据库维护文件指纹不符：'+row.file);fs.writeFileSync(path.join(target,row.file),bytes);}
 const stateBridge=fs.readFileSync(path.join(WEB,'src/database/sqlite-bridge.mjs'),'utf8').replace(/^export /gm,'');
 const rewrites=[
  ['return t.loadFromData(o.data||null)','return t.loadFromData(m.CxxDatabaseHost.prepareTables(o.data||null))'],
  ['l.loadFromData(t.data)','l.loadFromData(m.CxxDatabaseHost.prepareTables(t.data))'],
  ['m.AutoCardUpdaterAPI=$B','m.AutoCardUpdaterAPI=$B;'+stateBridge+`;attachSqlState(m.CxxDatabaseHost,()=>{const p=getActiveStorageProvider();if(p?.mode!=='sqlite'||!p.engine.db)throw Error('SQLite运行时尚未就绪');return p.engine.db})`],
  ['new URL("/scripts/world-info.js",t)','new URL("./world-info.mjs",t)'],
  ["import('/scripts/extensions.js')","import('./extensions.mjs')"],["import('/script.js')","import('./script.mjs')"],
  ['import("./data/storage/script.js")','import("./script.mjs")'],['import("./data/storage/scripts/extensions.js")','import("./extensions.mjs")'],
  ['return i&&await new Promise(t=>setTimeout(t,800)),o','return o'],
  ['function ensureAcuV2AppMounted(){ensureMounted()}()','function ensureAcuV2AppMounted(){}()'],
  ['registerAcuV2MenuButton(),function ensureAcuV2AppMounted','function ensureAcuV2AppMounted'],
  ['if(Ve&&Ve.chatId)setTimeout(async()=>{await initWithChatIdSafely(Ve.chatId)},1e3);else{','if(window.parent.CxxDatabaseHost){}else if(Ve&&Ve.chatId)setTimeout(async()=>{await initWithChatIdSafely(Ve.chatId)},1e3);else{']
 ];
 let plugin=fs.readFileSync(path.join(target,'shujuku-1.3.js'),'utf8');for(const [from,to]of rewrites){if(plugin.split(from).length!==2)throw Error('数据库宿主适配锚点变化：'+from);plugin=plugin.replace(from,to);}
 const B=createRequire(import.meta.url)('../../工具/lib/card-ast.cjs'),delays=[];
 B.walk(B.acorn.parse(plugin,{ecmaVersion:'latest'}),node=>{if(node.type==='CallExpression'&&node.callee?.property?.name==='on'&&plugin.slice(node.arguments[0]?.start,node.arguments[0]?.end)==='Ve.eventTypes.CHAT_CHANGED')B.walk(node.arguments[1],call=>{if(call.type==='CallExpression'&&call.callee?.name==='setTimeout'&&call.arguments[1]?.value===1200&&call.arguments[0]?.async)delays.push(call);});});
 if(delays.length!==1)throw Error('数据库聊天切换接点变化');const delay=delays[0];plugin=plugin.slice(0,delay.start)+'await ('+plugin.slice(delay.arguments[0].start,delay.arguments[0].end)+')()'+plugin.slice(delay.end);
 fs.writeFileSync(path.join(target,'shujuku-1.3.js'),plugin);
 fs.copyFileSync(path.join(WEB,'src/database/host.html'),path.join(target,'host.html'));
 for(const name of ['world-info','extensions','script'])fs.copyFileSync(path.join(WEB,'src/database',name+'.mjs'),path.join(target,name+'.mjs'));
 const state=JSON.parse(fs.readFileSync(path.join(WEB,'../数据/表格模板-cxx15.json'))),memory=JSON.parse(fs.readFileSync(path.join(WEB,'generated/memory-contract.json')));
 fs.writeFileSync(path.join(target,'template.json'),JSON.stringify({...state,...memory.nativeTemplate})+'\n');
 fs.writeFileSync(path.join(target,'source.json'),JSON.stringify({...receipt,adaptation:{rewrites:rewrites.map(([from,to])=>({from,to})),chatChanged:'await the original 1200 ms delayed reload immediately; local story binding already owns complete saved rows',sha256:createHash('sha256').update(plugin).digest('hex'),scope:'browser-local host modules, explicit story lifecycle, lazy original admin UI, removal of fixed UI waits; original tables, CRUD, history, prompts and update engine retained'}})+'\n');
}
