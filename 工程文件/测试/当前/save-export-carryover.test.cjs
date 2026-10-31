// Regression fixtures derived from the original B1-B5 audit; execute current maintained source.
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const base = process.env.CXX_SAVE_SOURCE_ROOT || path.resolve(__dirname, '../../卡片源码');
const sandbox = vm.createContext({ crypto: webcrypto, TextEncoder, URL, ArrayBuffer, Uint8Array, setTimeout, clearTimeout, console, CxxGameplay: {} });
for (const file of ['运行时/crypto-compat.js','运行时/core.js','通讯/phone-core.js','运行时/backup.js']) {
  vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'), sandbox, {filename:file});
}
const Core = sandbox.CxxUpdateCore, Backup = sandbox.CxxUpdateBackup;
const clone = x => JSON.parse(JSON.stringify(x));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function fixture({digestHook}={}) {
  const expected = {cardId:'cyber2051',characterKey:'test.png',chatId:'original'};
  let state = {instanceId:'instance-1',registry:{packages:{}}};
  const c = {chat:[{mes:'hello',is_user:false,is_system:false,swipe_id:0,swipes:['hello','alt'],swipe_info:[{send_date:'date0'},{send_date:'date1'}],variables:[{stat_data:{hp:10}},{stat_data:{hp:20}}],extra:{customSave:{score:10}}}],chatMetadata:{variables:{},world_info:'custom-chat-book'},getRequestHeaders:()=>({}),getCurrentChatId:()=>expected.chatId};
  const disk = new Map();
  const currentRows=()=>[{chat_metadata:clone(c.chatMetadata),user_name:'Tester',character_name:'Test'},...clone(c.chat)];
  c.saveChat=async()=>{disk.set(expected.chatId,currentRows());};
  disk.set(expected.chatId,currentRows());
  const host={getContext:()=>clone(expected),assertContext:e=>assert.ok(same(e,expected)),ready:async()=>{},readState:()=>clone(state),saveState:async value=>{state=clone(value);},withLock:work=>work(),withReadLock:work=>work(),assertNoPendingInstall:async()=>{}};
  let exportHook;
  const fetch=async(url,request)=>{
    const req=JSON.parse(request.body),route=new URL(url).pathname;
    if(route==='/api/chats/export'){
      const rows=clone(disk.get(req.file.replace(/\.jsonl$/,'')));
      if(exportHook){const fn=exportHook;exportHook=null;await fn();}
      return {ok:true,json:async()=>({result:rows.map(x=>JSON.stringify(x)).join('\n')+'\n'})};
    }
    if(route==='/api/characters/chats')return {ok:true,json:async()=>[...disk.keys()].map(id=>({file_name:id+'.jsonl'}))};
    if(route==='/api/chats/save'){disk.set(req.file_name,clone(req.chat));return {ok:true,json:async()=>({ok:true})};}
    if(route==='/api/chats/get')return {ok:true,json:async()=>clone(disk.get(req.file_name)||[])};
    throw Error('Unexpected mock route '+route);
  };
  const api={SillyTavern:{getContext:()=>c},getTavernVersion:()=> '1.19.0',getTavernHelperVersion:()=> '4.11.2',getChatMessages:()=>c.chat.map((m,i)=>({message_id:i,swipe_id:m.swipe_id??0,swipes:m.swipes||[m.mes],swipes_data:(m.swipes||[m.mes]).map((_,j)=>m.variables?.[j]||{})})),getGlobalWorldbookNames:()=>['Init'],getCharWorldbookNames:()=>({primary:null,additional:[]})};
  const seed={cardId:'cyber2051',baseline:{test:1},baseVersion:'2.3.0',migration:{buildId:'frozen-test',saveSchema:1,contract:'cyber2051.raw-save.v1',accepts:[],playerStores:[]}};
  const surface={parent:{location:{origin:'http://mock.invalid'}}};
  const adapters=Backup.nativeAdapters({api,host,fetch,root:surface});
  let digestCalls=0; const cryptoProvider=digestHook?{subtle:{digest:async(...args)=>{const result=await webcrypto.subtle.digest(...args);if(digestHook){digestHook(c,++digestCalls);}return result;}},randomUUID:()=>webcrypto.randomUUID(),getRandomValues:array=>webcrypto.getRandomValues(array)}:webcrypto;
  const service=Backup.create({core:Core,host,api,adapters,seed,readOnlyExport:true,wait:async()=>{},crypto:cryptoProvider});
  return {service,adapters,c,disk,expected,hook:fn=>{exportHook=fn;},state:()=>clone(state)};
}

test('B2 unchanged complete export preserves all replies and unknown data',async()=>{
 const f=fixture(),{document:doc}=await f.service.captureMigration({completeDisk:true});
 assert.deepEqual(clone(doc.payload.messages),clone(f.c.chat));f.service.assertExportCurrent(doc);
});
for(const [name,change]of [
 ['MVU',c=>{c.chat[0].variables[0].stat_data.hp=999;}],
 ['extension',c=>{c.chat[0].extra.customSave.score=999;}],
]){
 test('B2 '+name+' change during disk read rejects complete capture',async()=>{
  const f=fixture();f.hook(()=>change(f.c));
  await assert.rejects(f.service.captureMigration({completeDisk:true}),e=>['backup-chat-not-persisted','backup-source-changed','migration-export-stale'].includes(e.code));
 });
 for(const phase of [1,3])test('B2 '+name+' change during SHA phase '+phase+' rejects export',async()=>{
  const f=fixture({digestHook:(c,n)=>{if(n===phase)change(c);}});
  await assert.rejects(f.service.captureMigration({completeDisk:true}),e=>['backup-source-changed','migration-export-stale'].includes(e.code));
 });
}
test('B2 final download guard rejects later alternate-branch or context changes',async()=>{
 const f=fixture(),{document:doc}=await f.service.captureMigration({completeDisk:true});
 f.c.chat[0].variables[1].stat_data.hp=999;
 assert.throws(()=>f.service.assertExportCurrent(doc),{code:'migration-export-stale'});
 f.expected.chatId='different';assert.throws(()=>f.service.assertExportCurrent(doc));
});
for(const bad of [undefined,null,[],{},'wrong',{cardId:'cyber2051',characterKey:7,chatId:'original'},{cardId:'',characterKey:'test.png',chatId:'original'},{cardId:'cyber2051',characterKey:'test.png',chatId:' '}])
 test('B5 rejects malformed sourceContext '+JSON.stringify(bad)+' before preview or import writes',async()=>{
  const f=fixture(),{document:doc}=await f.service.captureMigration({completeDisk:true});
  if(bad===undefined)delete doc.sourceContext;else doc.sourceContext=bad;
  delete doc.sha256;doc.sha256=await Core.sha256(doc);
  const before=clone([...f.disk]),state=f.state();
  await assert.rejects(f.service.parseMigration(doc),{code:'migration-format'});
  await assert.rejects(f.service.previewMigration(doc,{completeDisk:true}),{code:'migration-format'});
  await assert.rejects(f.service.importMigration(doc,{preview:{},confirm:'migrate-copy',completeDisk:true}),{code:'migration-format'});
  assert.deepEqual(clone([...f.disk]),before);assert.deepEqual(f.state(),state);
 });
