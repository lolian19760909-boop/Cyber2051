'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
async function fixture(auxiliary=null){const {createBridge}=await import('../../配套扩展/cxx-context-bridge/bridge.mjs'),listeners=new Map(),prompts=new Map(),errors=[];const names=['GENERATION_AFTER_COMMANDS','MESSAGE_SENT','MESSAGE_RECEIVED','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED','WORLDINFO_ENTRIES_LOADED','CHAT_COMPLETION_PROMPT_READY'];
 const ctx={characters:[{avatar:'a.png'}],characterId:0,groupId:null,getCurrentChatId:()=>ctx.chatId,chatId:'a',eventTypes:Object.fromEntries(names.map(x=>[x,x])),eventSource:{on(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeListener(n,f){listeners.get(n).delete(f);}},setExtensionPrompt:(id,text)=>prompts.set(id,text),stopGeneration:()=>{ctx.stopped=true;}};
 const bridge=createBridge({context:()=>ctx,report:e=>errors.push(e),auxiliary}),scope={character:'a.png',chat:'a',group:null},emit=async(n,...args)=>{for(const fn of listeners.get(n)||[])await fn(...args);};return {bridge,ctx,scope,emit,listeners,prompts,errors};}
test('inactive bridge leaves unrelated chats and auxiliary generation alone',async()=>{
 const f=await fixture(),rows=[{mes:'keep'}];await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await f.bridge.intercept(rows,100,()=>assert.fail(),'normal');assert.deepEqual(rows,[{mes:'keep'}]);
 f.bridge.connect({scope:f.scope,before:()=>assert.fail()});await f.emit('GENERATION_AFTER_COMMANDS','quiet',{},false);await f.bridge.intercept(rows,100,()=>assert.fail(),'quiet');assert.equal(f.bridge.status().session,null);f.bridge.destroy();assert([...f.listeners.values()].every(s=>s.size===0));
});
test('card preparation, history cut, worldbook filter and prompt cleanup use actual array identities',async()=>{
 const f=await fixture(),calls=[];f.bridge.connect({scope:f.scope,prepare:()=>calls.push('prepare'),message:()=>calls.push('message'),before:({rows})=>({rows:rows.slice(1),prompt:'summary'}),worldinfo:()=>({exclude:[{world:'book',uid:1}]}),final:()=>calls.push('final')});
 await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await f.emit('MESSAGE_SENT',5);const rows=[{mes:'old'},{mes:'recent'}],sameRows=rows;await f.bridge.intercept(rows,100,()=>assert.fail(),'normal');assert.strictEqual(rows,sameRows);assert.deepEqual(rows,[{mes:'recent'}]);assert([...f.prompts.values()].includes('summary'));
 const lore=[{world:'book',uid:1},{world:'other',uid:1}],payload={chatLore:lore};await f.emit('WORLDINFO_ENTRIES_LOADED',payload);assert.strictEqual(payload.chatLore,lore);assert.deepEqual(lore,[{world:'other',uid:1}]);await f.emit('CHAT_COMPLETION_PROMPT_READY',{});assert.deepEqual(calls,['prepare','message','final']);await f.emit('GENERATION_ENDED');assert([...f.prompts.values()].every(x=>x===''));f.bridge.destroy();
});
test('preparation failures and stale async policy explicitly abort native interceptor',async()=>{
 const f=await fixture();let aborts=0,release;const disconnect=f.bridge.connect({scope:f.scope,prepare:()=>{throw Error('save failed');},before:()=>assert.fail()});
 await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await f.bridge.intercept([],100,()=>aborts++,'normal');assert.equal(aborts,1);assert.equal(f.bridge.status().error.message,'save failed');disconnect();
 f.bridge.connect({scope:f.scope,before:({rows})=>new Promise(r=>release=()=>r({rows,prompt:'stale'}))});await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const flight=f.bridge.intercept([],100,()=>aborts++,'normal');f.ctx.chatId='b';release();await flight;assert.equal(aborts,2);assert([...f.prompts.values()].every(x=>x===''));f.bridge.destroy();
});
test('foreign rows, repeated rows and invalid world filters fail without quiet fallback',async()=>{
 const f=await fixture();let aborted=false;f.bridge.connect({scope:f.scope,before:()=>({rows:[{mes:'invented'}]})});await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=[{mes:'original'}];await f.bridge.intercept(rows,100,()=>aborted=true,'normal');assert(aborted);assert.deepEqual(rows,[{mes:'original'}]);f.bridge.destroy();
});
test('separate auxiliary requests abort on stop, chat change and disconnect without invoking narrative callbacks',async()=>{
 for(const reason of ['stop','chat','disconnect']){let signal;const f=await fixture(value=>{signal=value.signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));});const detach=f.bridge.connect({scope:f.scope,before:()=>assert.fail('native interceptor'),prepare:()=>assert.fail('native preparation'),message:()=>assert.fail('native message'),final:()=>assert.fail('native final')});
 const request=f.bridge.request({scope:f.scope,messages:[{role:'user',content:'one actor'}]});assert(signal);if(reason==='stop')await f.emit('GENERATION_STOPPED');if(reason==='chat'){f.ctx.chatId='b';await f.emit('CHAT_CHANGED');}if(reason==='disconnect')detach();await assert.rejects(request,/停止/);assert(signal.aborted);assert.equal(f.bridge.status().session,null);f.bridge.destroy();assert([...f.listeners.values()].every(s=>s.size===0));}
});
