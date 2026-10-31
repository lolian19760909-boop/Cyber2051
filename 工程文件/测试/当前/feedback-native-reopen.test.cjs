'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const G=require('../../卡片源码/运行时/chat-save-guard.js');
const copy=x=>JSON.parse(JSON.stringify(x)),scope={characterKey:'card.png',chatId:'story'},target={kind:'character',characterId:'card',fileName:'story'};
const rows=(n=2)=>[{unknownHeader:{keep:1},chat_metadata:{integrity:'one',variables:{preset:n}}},{mes:'disk text',swipes:['disk text','unused'],swipe_info:[{}, {custom:9}],variables:[{}, {stat_data:{keep:'branch'}}]}];
const serialize=items=>new TextEncoder().encode(items.map(JSON.stringify).join('\n'));
function frame(data){const out=new Uint8Array(data.length+8);out.set(data);new DataView(out.buffer).setBigUint64(data.length,BigInt(data.length));return out;}
function feed(o,command,args,value,error){const t=o.before(command,args);o.after(t,value,error);}
function file(o,items=rows(),{incomplete=false,invalidLength=false}={}){
 const data=serialize(items);feed(o,'get_chat_payload_path',{characterName:'card',fileName:'story'},'/store/card/story.jsonl');feed(o,'plugin:fs|open',{path:'/store/card/story.jsonl',options:{read:true}},7);feed(o,'plugin:fs|fstat',{rid:7},{size:data.length});
 const body=frame(data.subarray(0,incomplete?data.length-3:data.length));if(invalidLength)new DataView(body.buffer).setBigUint64(body.length-8,BigInt(body.length+100));feed(o,'plugin:fs|read',{rid:7,len:data.length},body);
 feed(o,'plugin:resources|close',{rid:7});
}
test('TT native explicit-load observer handles the real fs frame length trailer',()=>{
 const o=G.createNativeOpenObserver(),id=o.start(scope);file(o);assert.deepEqual(o.finish(id),{scope,rows:rows()});
});
test('TT native explicit-load observer assembles cold streams only through EOF',()=>{
 const o=G.createNativeOpenObserver(),id=o.start(scope),data=serialize(rows());feed(o,'open_cold_chat',{target,allowNotFound:false},{readerId:8,sourceId:9});feed(o,'read_chat_bytes',{rid:8},data.subarray(0,20));feed(o,'read_chat_bytes',{rid:8},data.subarray(20));feed(o,'read_chat_bytes',{rid:8},new Uint8Array());feed(o,'plugin:resources|close',{rid:8});assert.deepEqual(o.finish(id).rows,rows());
});
test('TT missing stream, incomplete file, invalid lengths and errors cannot yield opened evidence',()=>{
 for(const kind of ['missing','incomplete','length','error']){const o=G.createNativeOpenObserver(),id=o.start(scope);if(kind==='incomplete')file(o,rows(),{incomplete:true});if(kind==='length')file(o,rows(),{invalidLength:true});if(kind==='error')feed(o,'get_chat_payload_path',{characterName:'card',fileName:'story'},null,Error('disk offline'));assert.throws(()=>o.finish(id),{code:'chat-reopen-evidence'});}
 const o=G.createNativeOpenObserver(),id=o.start(scope);feed(o,'open_cold_chat',{target},{readerId:8,sourceId:9});feed(o,'read_chat_bytes',{rid:8},serialize(rows()));assert.throws(()=>o.finish(id),{code:'chat-reopen-evidence'});
});
test('TT concurrent /export, duplicate targets, unknown readers, wrong scope and cancellation are rejected',()=>{
 for(const kind of ['export','duplicate','unknown','wrong','cancel']){const o=G.createNativeOpenObserver({excluded:()=>kind==='export'}),id=o.start(scope);if(kind==='wrong')feed(o,'get_chat_payload_path',{characterName:'card',fileName:'other'},'/other');else file(o);if(kind==='duplicate')file(o);if(kind==='unknown')feed(o,'read_chat_bytes',{rid:88},new Uint8Array());if(kind==='cancel')o.cancel();assert.throws(()=>o.finish(id),{code:'chat-reopen-evidence'});}
});
async function fixture(){
 let disk=rows(),writes=0,reloads=0,mode='normal',retained=null;const mutableScope={...scope};let fileBytes=null,composer='unsent input',characterVariables={unknown:'character vars'};
 const ctx={chat:copy(rows(1).slice(1)),chatMetadata:copy(rows(1)[0].chat_metadata),getCurrentChatId:()=>mutableScope.chatId,getRequestHeaders:()=>({'Content-Type':'application/json'})};
 const original=Object.freeze({async invoke(command,args){
  if(command==='get_chat_payload_path')return'/store/card/story.jsonl';if(command==='plugin:fs|open'){fileBytes=serialize(disk);return 7;}if(command==='plugin:fs|fstat')return{size:fileBytes.length};if(command==='plugin:fs|read')return frame(fileBytes);if(command==='plugin:resources|close')return;
  if(command==='commit_chat_metadata'){disk[0].chat_metadata=copy(args.chatMetadata);writes++;return;}
  return null;
 }});
 const win={__TAURI__:{core:original},__TAURI_INTERNALS__:{},document:{querySelector:()=>({value:composer})},location:new URL('https://host.test/'),navigator:{locks:{request:async(_k,_o,fn)=>fn()}},Request,Response,Blob,TextDecoder,DecompressionStream,setTimeout};
 async function loadNative(){const invoke=(...args)=>win.__TAURI__.core.invoke(...args);const filename=await invoke('get_chat_payload_path',{characterName:'card',fileName:'story',allowNotFound:false});const rid=await invoke('plugin:fs|open',{path:filename,options:{read:true}});const {size}=await invoke('plugin:fs|fstat',{rid});const bytes=await invoke('plugin:fs|read',{rid,len:size});await invoke('plugin:resources|close',{rid});return JSON.parse('['+new TextDecoder().decode(bytes.subarray(0,size)).split('\n').join(',')+']');}
 win.fetch=async(input,init)=>{const request=new Request(input,init),payload=await request.json();if(new URL(request.url).pathname==='/api/chats/export')return Response.json({result:disk.map(JSON.stringify).join('\n')});return Response.json([]);};
 ctx.reloadCurrentChat=async()=>{
  reloads++;if(mode==='no-replace')return;if(mode==='disk-changed')disk[0].chat_metadata.variables.preset=3;
  const fresh=await loadNative();if(mode==='duplicate')await loadNative();if(mode==='scope')mutableScope.chatId='other';
  ctx.chatMetadata=fresh[0].chat_metadata;ctx.chat.splice(0,ctx.chat.length,...fresh.slice(1));ctx.chatMetadata.variables.preset=1;
  if(mode==='await-reset')await service.reset();
 };
 const api={getCurrentCharacterId:()=>mutableScope.characterKey,getVariables:()=>copy(characterVariables),SillyTavern:{getContext:()=>ctx}};
 const service=G.acquire({win,api});await assert.rejects(service.guard.ready(),{code:'chat-save-conflict'});
 return{win,ctx,service,get disk(){return disk;},set mode(v){mode=v;},set composer(v){composer=v;},set characterVariables(v){characterVariables=v;},writes:()=>writes,reloads:()=>reloads,preserve:async draft=>retained=copy(draft),retained:()=>retained};
}
test('S03 TT explicit reopen retains all current branches and variables before replacing memory',async()=>{
 const f=await fixture();f.ctx.chat[0].mes='unsaved current text';f.ctx.chat[0].swipe_info[1].custom=17;
 const result=await f.service.reopen({preserve:f.preserve});assert.equal(result.kind,'ready');assert.equal(f.reloads(),1);assert.equal(f.writes(),0);const backup=f.retained();assert.equal(backup.loaded.messages[0].mes,'unsaved current text');assert.equal(backup.completeLoaded.messages[0].swipe_info[1].custom,17);assert.equal(backup.completeLoaded.messages[0].variables[1].stat_data.keep,'branch');assert.equal(backup.loaded.metadata.variables.preset,1);assert.equal(backup.disk[0].chat_metadata.variables.preset,2);assert.equal(backup.composer,'unsent input');assert.deepEqual(backup.characterVariables,{unknown:'character vars'});
 await f.win.__TAURI__.core.invoke('commit_chat_metadata',{target,chatMetadata:copy(f.ctx.chatMetadata)});assert.equal(f.writes(),1);assert.equal(f.disk[0].chat_metadata.variables.preset,1);f.service.release();
});
test('S03 preservation failure or a concurrent local edit prevents any reload',async()=>{
 for(const kind of ['failure','edit']){const f=await fixture();await assert.rejects(f.service.reopen({preserve:async()=>{if(kind==='failure')throw Error('storage full');f.ctx.chat[0].mes='typed meanwhile';}}));assert.equal(f.reloads(),0);assert.equal(f.writes(),0);if(kind==='edit')assert.equal(f.ctx.chat[0].mes,'typed meanwhile');f.service.release();}
});
test('S03 disk changes, duplicate reads, unchanged live objects and scope changes leave preserved rescue data',async()=>{
 for(const mode of ['disk-changed','duplicate','no-replace','scope']){const f=await fixture();f.mode=mode;await assert.rejects(f.service.reopen({preserve:f.preserve}));assert(f.retained());assert.equal(f.writes(),0);f.service.release();}
});
test('S03 successful native reopen keeps rejecting an external write before the next commit',async()=>{
 const f=await fixture();await f.service.reopen({preserve:f.preserve});f.disk[0].chat_metadata.variables.preset=9;await assert.rejects(f.win.__TAURI__.core.invoke('commit_chat_metadata',{target,chatMetadata:copy(f.ctx.chatMetadata)}),{code:'chat-save-conflict'});assert.equal(f.writes(),0);assert.equal(f.disk[0].chat_metadata.variables.preset,9);f.service.release();
});
test('S03 a host awaiting CHAT_CHANGED reset cannot create a reopen promise cycle',async()=>{
 const f=await fixture();f.mode='await-reset';const result=await Promise.race([f.service.reopen({preserve:f.preserve}),new Promise((_,reject)=>setTimeout(()=>reject(Error('reopen deadlock')),300))]);assert.equal(result.kind,'ready');f.service.release();
});
test('S03 composer and character-variable edits made during preservation abort before reload',async()=>{
 for(const kind of ['composer','characterVariables']){const f=await fixture();await assert.rejects(f.service.reopen({preserve:async()=>{f[kind]=kind==='composer'?'newly typed input':{unknown:'new value'};}}),{code:'context-changed'});assert.equal(f.reloads(),0);assert.equal(f.writes(),0);f.service.release();}
});
