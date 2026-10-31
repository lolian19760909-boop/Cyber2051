'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const G=require('../../卡片源码/运行时/chat-save-guard.js');
const copy=v=>JSON.parse(JSON.stringify(v));
const scope={characterKey:'audit.png',chatId:'story'};
const rows=(value=2)=>[{legacyHeader:{keep:true},chat_metadata:{integrity:'one',variables:{preset:value,nested:{keep:true}}}},{mes:'original',swipes:['original','alternate'],swipe_info:[{}, {unknown:9}],extra:{keep:true}}];
const snapshot=live=>({metadata:copy(live[0].chat_metadata),messages:copy(live.slice(1))});
function fixture(){
 let disk=rows(),live=copy(disk),origin=null,writes=0,reopens=0;
 const guard=G.create({scope:()=>scope,snapshot:()=>snapshot(live),read:async()=>copy(disk),opened:()=>origin?{scope,rows:copy(origin)}:null,macros:()=>new Map([['preset',new Set(['1'])]]),reopen:async()=>{reopens++;live=copy(disk);},locks:{request:async(_k,_o,fn)=>fn()}});
 return {guard,get disk(){return disk;},set disk(v){disk=v;},get live(){return live;},set live(v){live=v;},opened:v=>origin=copy(v),writes:()=>writes,reopens:()=>reopens,save:()=>guard.commit(scope,copy(live),async()=>{writes++;disk=copy(live);return{ok:true};})};
}
test('S02 local initialization from the actual opened file permits arbitrary preset variables',async()=>{
 const f=fixture();f.opened(f.disk);f.live[0].chat_metadata.variables={preset:1,dynamic:'not a preset literal',boolean:true,nested:{any:['shape',7]}};
 await f.guard.reset();await f.save();assert.equal(f.writes(),1);assert.deepEqual(f.disk,f.live);assert.equal(f.disk[1].swipe_info[1].unknown,9);assert.deepEqual(f.disk[0].legacyHeader,{keep:true});
});
test('S02 a first-read stale value matching a preset literal never becomes a local write',async()=>{
 for(const provideOrigin of [false,true]){const f=fixture();f.live=rows(1);if(provideOrigin)f.opened(f.live);await assert.rejects(f.guard.reset(),{code:'chat-save-conflict'});await assert.rejects(f.save(),{code:'chat-save-conflict'});assert.equal(f.writes(),0);assert.equal(f.disk[0].chat_metadata.variables.preset,2);}
});
test('S02 actual origin cannot authorize another window change before reset or after readiness',async()=>{
 for(const later of [false,true]){const f=fixture();f.opened(f.disk);f.live[0].chat_metadata.variables.preset=1;if(later)await f.guard.reset();f.disk[0].chat_metadata.variables.preset=3;if(!later)await assert.rejects(f.guard.reset(),{code:'chat-save-conflict'});await assert.rejects(f.save(),{code:'chat-save-conflict'});assert.equal(f.writes(),0);assert.equal(f.disk[0].chat_metadata.variables.preset,3);}
});
test('S02 an origin is frozen together with its snapshot before the async read',async()=>{
 let release,first=true;const gate=new Promise(r=>release=r),live=rows(1),disk=rows(2);let origin=rows(1);
 const g=G.create({scope:()=>scope,snapshot:()=>snapshot(live),opened:()=>({scope,rows:copy(origin)}),normalize:async value=>{if(first){first=false;await gate;}return value;},read:async()=>copy(disk)});
 const reset=g.reset();origin=copy(disk);release();await assert.rejects(reset,{code:'chat-save-conflict'});
});
test('S02 a receipt from a different chat or a local message edit does not justify a variable exception',async()=>{
 const f=fixture();f.opened(f.disk);f.live[0].chat_metadata.variables.preset=1;f.live[1].mes='unsaved message';await assert.rejects(f.guard.reset(),{code:'chat-save-conflict'});assert.equal(f.live[1].mes,'unsaved message');
 const live=rows(1),disk=rows(2);const g=G.create({scope:()=>scope,snapshot:()=>snapshot(live),opened:()=>({scope:{...scope,chatId:'other'},rows:copy(disk)}),read:async()=>copy(disk)});await assert.rejects(g.reset(),{code:'chat-save-conflict'});
});
test('S03 diagnostic retry never reloads or erases a new local draft after initial variable conflict',async()=>{
 const f=fixture();f.live=rows(1);await assert.rejects(f.guard.reset(),{code:'chat-save-conflict'});f.live[1].mes='local unsaved draft';const before=copy(f.live);const result=await f.guard.retry();assert.equal(result.code,'chat-save-conflict');assert.equal(f.reopens(),0);assert.deepEqual(f.live,before);assert.equal(f.writes(),0);
});
async function hostFixture(){
 let disk=rows(),writes=0;const live=copy(disk),transport=[];
 const context={chat:live.slice(1),chatMetadata:live[0].chat_metadata,getCurrentChatId:()=>scope.chatId,getRequestHeaders:()=>({'Content-Type':'application/json'})};
 const original=async(input,init)=>{transport.push({input,path:new URL(typeof input?.url==='string'?input.url:String(input),'https://host.test').pathname});const request=new Request(typeof input?.clone==='function'?input.clone():input,init);const payload=await request.json();const p=new URL(request.url).pathname;if(p==='/api/chats/export')return Response.json({result:disk.map(JSON.stringify).join('\n')});if(p==='/api/chats/get')return Response.json(copy(disk));if(p==='/api/chats/save'){disk=copy(payload.chat);writes++;return Response.json({});}return Response.json([]);};
 const win={fetch:original,document:{},location:new URL('https://host.test/'),navigator:{locks:{request:async(_k,_o,fn)=>fn()}},Request,Response,Blob,TextDecoder,DecompressionStream,setTimeout};
 const api={getCurrentCharacterId:()=>scope.characterKey,SillyTavern:{getContext:()=>context}};
 const service=G.acquire({win,api});await service.guard.ready();
 const load=async install=>{const r=await win.fetch('https://host.test/api/chats/get',{method:'POST',body:JSON.stringify({avatar_url:scope.characterKey,file_name:scope.chatId})});const received=await r.json();if(install){context.chatMetadata=received[0].chat_metadata;context.chat.splice(0,context.chat.length,...received.slice(1));}return received;};
 return {win,service,context,load,transport,writes:()=>writes,get disk(){return disk;},set disk(v){disk=v;},save:()=>win.fetch('https://host.test/api/chats/save',{method:'POST',body:JSON.stringify({avatar_url:scope.characterKey,file_name:scope.chatId,chat:[{...disk[0],chat_metadata:context.chatMetadata},...context.chat]})})};
}
test('S01 all guard endpoint fetch inputs are strings across the iframe/host boundary',async()=>{
 const h=await hostFixture();assert(h.transport.length>0);assert(h.transport.filter(x=>x.path==='/api/chats/export').every(x=>typeof x.input==='string'));h.service.release();
});
test('S02 ST response identity accepts installed raw rows and keeps unknown fields on save',async()=>{
 const h=await hostFixture();await h.load(true);h.context.chatMetadata.variables={preset:1,dynamic:{value:false}};await h.service.reset();await h.save();assert.equal(h.writes(),1);assert.deepEqual(h.disk[0].chat_metadata.variables,{preset:1,dynamic:{value:false}});assert.equal(h.disk[1].swipe_info[1].unknown,9);h.service.release();
});
test('S02 ST background /get is never a load receipt for old memory',async()=>{
 const h=await hostFixture();h.context.chatMetadata.variables.preset=1;h.disk[0].chat_metadata.variables.preset=3;await h.load(false);await assert.rejects(h.service.reset(),{code:'chat-save-conflict'});assert.equal(h.writes(),0);assert.equal(h.disk[0].chat_metadata.variables.preset,3);h.service.release();
});
test('S02 ST installed receipt still rejects a disk edit after the response was parsed',async()=>{
 const h=await hostFixture();await h.load(true);h.context.chatMetadata.variables.preset=1;h.disk[0].chat_metadata.variables.preset=3;await assert.rejects(h.service.reset(),{code:'chat-save-conflict'});assert.equal(h.writes(),0);h.service.release();
});

test('ST public metadata replacement keeps proven message identity for plugin initialization',async()=>{
 const h=await hostFixture();await h.load(true);h.context.chatMetadata={...h.context.chatMetadata,TavernDB_ACU_ScopedConfig:{template:'kept'},TavernDB_ACU_ScopedConfig__chatId:'story'};await h.service.reset();await h.save();assert.equal(h.writes(),1);assert.equal(h.disk[0].chat_metadata.TavernDB_ACU_ScopedConfig.template,'kept');h.service.release();
 const b=await hostFixture();await b.load(false);b.context.chatMetadata={...b.context.chatMetadata,plugin:{added:true}};await assert.rejects(b.service.reset(),{code:'chat-save-conflict'});assert.equal(b.writes(),0);b.service.release();
});
