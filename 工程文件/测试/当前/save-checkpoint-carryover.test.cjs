'use strict';
// Regression fixtures derived from the original B3/B4 audit; actual maintained Backup parser/importer.
const test=require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=process.env.CXX_SAVE_SOURCE_ROOT || path.resolve(__dirname,'../../卡片源码');
const Story=require(path.join(base,'运行时/story-library.js'));
const copy=v=>JSON.parse(JSON.stringify(v));
const sandbox={TextEncoder,Uint8Array,ArrayBuffer,console,CxxGameplay:{},CxxPhoneCore:{},CxxCrypto:{create:()=>({digest:async b=>crypto.createHash('sha256').update(b).digest('hex'),randomUUID:()=>crypto.randomUUID()})}};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(base,'运行时/core.js'),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(base,'运行时/backup.js'),'utf8'),sandbox);
const Core=sandbox.CxxUpdateCore,Backup=sandbox.CxxUpdateBackup;
const hash=v=>Core.sha256(v,b=>crypto.createHash('sha256').update(b).digest('hex'));
const canonical=v=>Core.canonical(v);
function fixture({realBackup=false}={}){
 let id=0,tick=0,current='route-main',tagFailures=0,readFailures=0,corruptWrites=0;
 const KEY=Story.KEY,route={schema:1,kind:'route',storyId:'story-1',routeId:'route-1',name:'主线',slot:1,indexVersion:1,createdAt:'2026-01-01T00:00:00.000Z',quickPoint:null,stage:'playing'};
 const messages=[{mes:'<OpeningForm/>',is_user:false,is_system:false,send_date:'0',swipe_id:0,swipes:['<OpeningForm/>'],variables:[{}]},...Array.from({length:4},(_,i)=>({mes:'<cxx-story>正文'+i+'</cxx-story>',is_user:false,is_system:false,send_date:String(i+1),swipe_id:1,swipes:['旧回复'+i,'<cxx-story>正文'+i+'</cxx-story>'],variables:[{stat_data:{hp:10+i}},{stat_data:{hp:20+i},unknown:{preserved:i}}],unknownMessage:'kept'}))];
 const chats=new Map([[current,[{user_name:'玩家',character_name:'角色',unknownHeader:{preserved:true},chat_metadata:{[KEY]:route,variables:{opaque:{a:1}}}},...messages]]]);
 const context=()=>({cardId:'cyber2051',characterKey:'test.png',chatId:current});
 const state={instanceId:'fixture-1',registry:{packages:{}}};
 const full=()=>({header:copy(chats.get(current)[0]),messages:copy(chats.get(current).slice(1)),updateState:copy(state),diskJSONL:chats.get(current).map(JSON.stringify).join('\n'),versions:{st:'1.19.0',helper:'4.0.0'}});
 const seed={cardId:'cyber2051',baseline:{test:true},baseVersion:'2.3.0',migration:{contract:'cyber2051.raw-save.v1',buildId:'fixture-build',saveSchema:1,accepts:[],playerStores:[]}};
 const host={getContext:context,readState:()=>copy(state),assertContext(e){assert.equal(e.chatId,current);},ready:async()=>{},withLock:async fn=>fn(),withReadLock:async fn=>fn(),saveState:async next=>{Object.assign(state,copy(next));},assertNoPendingInstall:async()=>{}};
 const backup=Backup.create({core:Core,host,seed,readOnlyExport:true,adapters:{completeSnapshot:async()=>full(),snapshot:()=>({messages:full().messages,metadata:full().header.chat_metadata,updateState:copy(state),versions:full().versions}),readCurrent:async()=>({header:full().header,jsonl:full().diskJSONL}),initializationBooks:async()=>['init-book'],copyExists:async(_,chatId)=>chats.has(chatId),readCopy:async(_,chatId)=>copy(chats.get(chatId)||[]),writeCopy:async(_,chatId,rows)=>chats.set(chatId,copy(rows))}});
 const makeDoc=async()=>{const data=full();return {format:1,type:'cyber2051.migration',createdAt:'2026-01-01T00:00:00.000Z',source:{workId:'cyber2051',buildId:'fixture-build',saveSchema:1,baseVersion:'2.3.0',contract:'cyber2051.raw-save.v1'},sourceContext:context(),payload:{header:data.header,messages:data.messages,archive:{packages:{},legacyQuests:[]},playerStores:{},preferences:{subscriptions:{},mediaPreferences:{}},dependencies:[]}};};
 const adapter={
  current:async()=>({chatId:current,rows:copy(chats.get(current))}),
  async list(){return [...chats].map(([chatId,rows])=>({chatId,meta:copy(rows[0].chat_metadata[KEY]),playable:true}));},
  exists:async chatId=>chats.has(chatId),
  read:async chatId=>{if(readFailures-- >0)throw Error('simulated read timeout');return copy(chats.get(chatId));},
  write:async(chatId,rows)=>{const value=copy(rows);if(corruptWrites-- >0)value.at(-1).mes='corrupt';chats.set(chatId,value);},
  tagCurrent:async meta=>{if(tagFailures-- >0)throw Error('simulated tag failure');chats.get(current)[0].chat_metadata[KEY]=copy(meta);},
  flush:async()=>copy(chats.get(current)),
  capture:async()=>realBackup?(await backup.captureMigration({completeDisk:true})).document:makeDoc(),
  validateExport:async doc=>realBackup?backup.parseMigration(doc):copy(doc),
  async importDocument(doc){if(realBackup){const preview=await backup.previewMigration(doc,{completeDisk:true});return backup.importMigration(doc,{preview,confirm:'migrate-copy',completeDisk:true});}const chatId='import-'+(++id);chats.set(chatId,[copy(doc.payload.header),...copy(doc.payload.messages)]);return {chatId};},
  open:async chatId=>{current=chatId;},
  removePoint:async chatId=>{chats.delete(chatId);}
 };
 const store=Story.createStore({adapter,hash,uuid:()=>String(++id).padStart(32,'0'),now:()=>new Date(Date.UTC(2026,0,1,0,0,tick++)).toISOString()});
 return {store,adapter,chats,backup,current:()=>current,route:()=>chats.get(current)[0].chat_metadata[KEY],failTag:n=>{tagFailures=n;},failRead:n=>{readFailures=n;},corruptWrite:n=>{corruptWrites=n;}};
}

test('B3 quick registration retry reuses frozen copy after route metadata changes',async()=>{
 const f=fixture({realBackup:true}),old=await f.store.point('',true);
 f.failTag(1);await assert.rejects(f.store.point('',true),/simulated tag failure/);
 assert.equal((await f.store.inspectPending()).code,'point-written');
 const id=[...f.chats.keys()].find(id=>id.startsWith('cxxpoint_')&&id!==old.chatId),frozen=copy(f.chats.get(id));
 await f.store.remember();await f.store.rename('后来改的名称');const route=copy(f.route());
 const result=await f.store.point('',true);
 assert.equal(result.chatId,id);assert.deepEqual(f.chats.get(id),frozen);
 assert.equal(f.route().name,route.name);assert.equal(f.route().lastPlayedAt,route.lastPlayedAt);
 assert.equal(f.route().quickPoint,id);assert(!f.chats.has(old.chatId));
});
test('B3 genuinely changed copy stays rejected on registration retry',async()=>{
 const f=fixture();f.failTag(1);await assert.rejects(f.store.point('',true));
 const id=[...f.chats.keys()].find(id=>id.startsWith('cxxpoint_'));
 f.chats.get(id).at(-1).mes='external change';await f.store.remember();
 await assert.rejects(f.store.point('',true),/副本编号已存在且内容不同/);
 assert.equal(f.route().quickPoint,null);
});
test('B3 corrupt readback retries using a new id with a valid checkpoint hash',async()=>{
 const f=fixture({realBackup:true});f.corruptWrite(1);
 await assert.rejects(f.store.point('named'),/读回核对失败/);
 const point=await f.store.point('named');await f.store.exportPoint(point.chatId);
});
test('B4 actual parse preview import reuses completed route after one failed open',async()=>{
 const f=fixture({realBackup:true}),p=await f.store.point('named'),open=f.adapter.open;let first=true;
 f.adapter.open=async id=>{if(first){first=false;throw Error('simulated open failure');}return open(id);};
 await assert.rejects(f.store.restore(p.chatId),/simulated open failure/);
 const before=[...f.chats.keys()].filter(id=>id.startsWith('cxx-migrated-'));assert.equal(before.length,1);
 const result=await f.store.restore(p.chatId),after=[...f.chats.keys()].filter(id=>id.startsWith('cxx-migrated-'));
 assert.deepEqual(after,before);assert.equal(result.chatId,before[0]);assert.equal(f.current(),result.chatId);
 assert(f.chats.has('route-main'));assert(f.chats.has(p.chatId));
 const next=await f.store.restore(p.chatId);assert.notEqual(next.chatId,result.chatId);
});

test('B4 retry saves edits made after a failed open and keeps the one imported route',async()=>{
 const f=fixture({realBackup:true}),p=await f.store.point('named'),open=f.adapter.open;
 let live=copy(f.chats.get(f.current())),flushes=0,failFlush=false,opens=0;
 f.adapter.flush=async()=>{flushes++;if(failFlush)throw Error('flush failed');f.chats.set(f.current(),copy(live));};
 f.adapter.open=async id=>{if(++opens===1)throw Error('open failed');await open(id);live=copy(f.chats.get(id));};
 await assert.rejects(f.store.restore(p.chatId),/open failed/);
 live.at(-1).mes='第一次打开失败后继续写的内容';
 failFlush=true;await assert.rejects(f.store.restore(p.chatId),/flush failed/);assert.equal(opens,1);
 failFlush=false;await f.store.restore(p.chatId);
 assert.equal(flushes,3);assert.equal(f.chats.get('route-main').at(-1).mes,'第一次打开失败后继续写的内容');
 assert.equal([...f.chats.keys()].filter(id=>id.startsWith('cxx-migrated-')).length,1);
});
