'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Host=require('../../卡片源码/运行时/context-host.js'),Controller=require('../../卡片源码/运行时/context-controller.js');
async function fixture(memoryModes=null){
 const {createBridge}=await import('../../配套扩展/tavern-runtime-suite/context/bridge.mjs'),events=new Map(),prompts=new Map(),names=['GENERATION_AFTER_COMMANDS','MESSAGE_SENT','MESSAGE_RECEIVED','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED','WORLDINFO_ENTRIES_LOADED','CHAT_COMPLETION_PROMPT_READY'];
 const c={characters:[{avatar:'a.png',name:'fixture'}],characterId:0,groupId:null,getCurrentChatId:()=>c.chatId,chatId:'a',mainApi:'openai',chatCompletionSettings:{openai_max_context:20000,openai_max_tokens:1000,chat_completion_source:'fixture'},getTokenCountAsync:async s=>s.length,chat:Array.from({length:10},(_,i)=>({name:i%2?'fixture':'player',is_user:i%2===0,mes:'scene '+i+' '+('detail '.repeat(300)),extra:{keep:i}})),chatMetadata:{__cxx_story_profile:{schema:1,id:'story'},variables:{__cxx_identity:{name:'player'},__cxx_long_memory:{schema:1,enabled:false,unknown:17}}},eventTypes:Object.fromEntries(names.map(n=>[n,n])),eventSource:{on(n,fn){if(!events.has(n))events.set(n,new Set());events.get(n).add(fn);},removeListener(n,fn){events.get(n)?.delete(fn);}},setExtensionPrompt:(id,text)=>prompts.set(id,text),stopGeneration:()=>{f.stopped=true;}};
 const f={c,calls:0,writes:0,stopped:false,network:[]};let disk;const save=()=>{disk={chat:structuredClone(c.chat),meta:structuredClone(c.chatMetadata)};};save();c.saveChat=async()=>{f.writes++;save();};
 let lock=Promise.resolve();const host={withChatSave(expected,fn){const next=lock.catch(()=>{}).then(fn);lock=next;return next;},assertPlayerWritable:async()=>{}};
 const api={SillyTavern:{getContext:()=>c},updateVariablesWith:async fn=>{c.chatMetadata.variables=fn(c.chatMetadata.variables);}},top={};
 const bridge=createBridge({context:()=>c,memoryModes,auxiliary:async input=>{f.calls++;f.network.push(structuredClone(input.messages));const data=JSON.parse(input.messages[1].content);return {text:JSON.stringify({covered:data.messages.map(m=>m.sourceId),items:[{kind:'未结事项',text:'约定仍未履行。',sourceIds:data.messages.map(m=>m.sourceId)}]}),usage:{input:25,output:10,total:35,source:'provider'},model:'fixture',provider:'fixture'};}});top.CxxContextBridge=bridge;
 const source=Host.create({api,top,host,readDisk:async()=>structuredClone(disk.chat)});top.CxxContext=source;
 const parser=require('../../卡片源码/Gal/parser.js'),controller=Controller.create({api,top,host,source,parser,readDisk:async()=>structuredClone(disk.meta.variables.__cxx_long_memory.context),settings:{recentTurns:2,maxCalls:1}});top.CxxContextCompression=controller;source.use(controller).start();
 Object.assign(f,{top,source,controller,bridge,prompts,async emit(name,...args){for(const fn of events.get(name)||[])await fn(...args);},dispose(){source.destroy();controller.destroy();bridge.destroy();},disk:()=>disk});return f;
}
test('formal controller compacts the native copy, verifies chat save and supplies exactly one reusable summary',async()=>{
 const f=await fixture(),original=f.c.chat.map(r=>r.mes);await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));let abort=false;await f.bridge.intercept(rows,20000,()=>abort=true,'normal');assert(!abort);assert.equal(rows.length,4);assert.equal(f.calls,1);assert.deepEqual(f.c.chat.map(r=>r.mes),original);assert.equal(f.c.chat.length,10);assert.equal(f.controller.status().records.length,1);assert.equal(f.disk().meta.variables.__cxx_long_memory.context.compactions.length,1);assert.equal(f.disk().meta.variables.__cxx_long_memory.unknown,17);
 const prompt=[...f.prompts.values()].filter(Boolean);assert.equal(prompt.length,1);await f.emit('CHAT_COMPLETION_PROMPT_READY',{chat:[{role:'system',content:'rules '+prompt[0]},...rows.map(r=>({role:r.is_user?'user':'assistant',content:r.mes}))]});assert(!f.stopped);assert(f.controller.status().lastRun.finalInputEstimate>0);await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');assert([...f.prompts.values()].every(v=>v===''));
 await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const second=f.c.chat.map(r=>({...r}));await f.bridge.intercept(second,20000,()=>assert.fail(),'normal');assert.equal(f.calls,1);assert.equal(second.length,4);await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');f.dispose();
});
test('excluded summaries retain their original messages and are not regenerated immediately',async()=>{const f=await fixture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await f.bridge.intercept(f.c.chat.map(r=>({...r})),20000,()=>assert.fail(),'normal');await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');const id=f.controller.status().records[0].id;await f.controller.exclude(id);await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));await f.bridge.intercept(rows,20000,()=>assert.fail(),'normal');assert.equal(rows.length,10);assert.equal(f.calls,1);assert.equal(f.controller.status().records[0].status,'excluded');await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');await f.controller.include(id);assert.equal(f.controller.status().records[0].status,'ready');f.dispose();});
test('retry permission is persisted and exposed without making another request',async()=>{const f=await fixture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await f.bridge.intercept(f.c.chat.map(r=>({...r})),20000,()=>assert.fail(),'normal');await assert.rejects(f.controller.allowRetry(),/回复结束/);await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');const before=f.controller.status();await f.controller.allowRetry();const after=f.controller.status();assert.equal(after.retryRevision,before.retryRevision+1);assert.equal(f.disk().meta.variables.__cxx_long_memory.context.retryRevision,after.retryRevision);assert.deepEqual(after.receipts,before.receipts);assert.equal(f.calls,1);f.dispose();});
test('editing an ancestor invalidates existing summaries while the original chat is retained',async()=>{const f=await fixture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await f.bridge.intercept(f.c.chat.map(r=>({...r})),20000,()=>assert.fail(),'normal');await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');f.c.chat[0].mes+=' edit';assert.equal(f.controller.status().records[0].status,'stale');assert.equal(f.c.chat.length,10);f.dispose();});
test('old bridge and non-chat-completion paths stay untouched; fixed prompt excess stops rather than silently losing recent turns',async()=>{
 const f=await fixture();f.c.mainApi='novel';await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));await f.bridge.intercept(rows,20000,()=>assert.fail(),'normal');await f.emit('CHAT_COMPLETION_PROMPT_READY',{chat:[{role:'system',content:'x'.repeat(50000)}]});assert.equal(rows.length,10);assert.equal(f.calls,0);assert(!f.stopped);await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');
 f.c.mainApi='openai';await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const kept=f.c.chat.map(r=>({...r}));await f.bridge.intercept(kept,20000,()=>assert.fail(),'normal');await assert.rejects(f.emit('CHAT_COMPLETION_PROMPT_READY',{chat:[{role:'system',content:'x'.repeat(50000)+[...f.prompts.values()].join('')},...kept.map(r=>({role:r.is_user?'user':'assistant',content:r.mes}))]}),/预算/);assert(f.stopped);assert.equal(f.c.chat.length,10);f.dispose();
});
test('final prompt catches native history pruning and removes all temporary markers from successful requests',async()=>{
 const f=await fixture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));await f.bridge.intercept(rows,20000,()=>assert.fail(),'normal');const payload={chat:[{role:'system',content:[...f.prompts.values()].join('')},...rows.map(r=>({role:r.is_user?'user':'assistant',content:r.mes}))]};assert(payload.chat[0].content.includes('[CXXCTX_'));const auxiliary={chat:[{role:'user',content:'unrelated recall request'}]};await f.emit('CHAT_COMPLETION_PROMPT_READY',auxiliary);assert.equal(auxiliary.chat[0].content,'unrelated recall request');assert(!f.stopped);await f.emit('CHAT_COMPLETION_PROMPT_READY',payload);assert(!JSON.stringify(payload).includes('[CXXCTX_'));assert(!JSON.stringify(f.c.chat).includes('[CXXCTX_'));await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');
 await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const next=f.c.chat.map(r=>({...r}));await f.bridge.intercept(next,20000,()=>assert.fail(),'normal');const truncated={chat:[{role:'system',content:[...f.prompts.values()].join('')},...next.slice(1).map(r=>({role:r.is_user?'user':'assistant',content:r.mes}))]};await assert.rejects(f.emit('CHAT_COMPLETION_PROMPT_READY',truncated),/裁掉或改写/);assert(f.stopped);assert(!JSON.stringify(truncated).includes('[CXXCTX_'));assert.equal(f.c.chat.length,10);f.dispose();
});

test('another viewpoint and unknown old ownership never enter the outgoing copy, even with compression off',async()=>{
 for(const known of [true,false])for(const enabled of [true,false]){
  const f=await fixture(),original=f.c.chat.map(r=>r.mes);if(known)await f.source.capture();
  f.c.chat.at(-1).variables={0:{stat_data:{terminal:{ensemble:{control:{actorId:'wb_6',viewpointActorId:'wb_6',revision:1}}}}}};
  if(!enabled)await f.controller.setEnabled(false);
  await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);
  f.c.chat.push({is_user:true,name:'千早爱音',mes:'现在从爱音的视角继续。',extra:{}});await f.emit('MESSAGE_SENT',10);
  const rows=f.c.chat.map(r=>({...r}));await f.bridge.intercept(rows,20000,()=>assert.fail(f.bridge.status().error?.message),'normal');
  assert.equal(rows.length,1);assert(rows[0].mes.includes('现在从爱音'));assert(!rows[0].mes.includes('detail'));assert.equal(f.calls,0);assert.equal(f.controller.status().lastRun.projection.withheldMessages,10);assert.deepEqual(f.c.chat.slice(0,10).map(r=>r.mes),original);
  await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');f.dispose();
 }
});

test('database mode keeps viewpoint projection while leaving database prompt ownership and original records intact',async()=>{
 const memoryModes={resolve:()=>({mode:'database',provider:{id:'shujuku'}}),status:()=>({mode:'database'})};
 const f=await fixture(memoryModes);f.c.chatMetadata.variables.__cxx_identity.name='丰川祥子';
 f.c.chat[1].mes+='<cxx-say speaker="爱音" kind="thought">PRIVATE_DB_TEST</cxx-say>';
 f.c.chat[9].mes+='<cxx-say speaker="祥子" kind="thought">OWN_DB_TEST</cxx-say>';
 const original=f.c.chat.map(row=>row.mes);
 try{
  await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(row=>({...row}));
  await f.bridge.intercept(rows,20000,()=>assert.fail(f.bridge.status().error?.message),'normal');
  assert.equal(rows.length,10);assert.equal(f.calls,0);assert.equal(f.controller.status().lastRun.mode,'database');
  assert(!JSON.stringify(rows).includes('PRIVATE_DB_TEST'));assert(JSON.stringify(rows).includes('OWN_DB_TEST'));
  assert(!JSON.stringify(rows).includes('CXXCTX_'));assert([...f.prompts.values()].every(value=>!value));
  const payload={chat:[{role:'system',content:'DB_TABLE_AND_RECALL'},{role:'user',content:'填表独立请求'}]};
  await f.emit('CHAT_COMPLETION_PROMPT_READY',payload);assert.equal(payload.chat[0].content,'DB_TABLE_AND_RECALL');assert(!f.stopped);
  assert.deepEqual(f.c.chat.map(row=>row.mes),original);assert.equal(f.controller.status().records.length,0);
 }finally{await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');f.dispose();}
});

test('explicit private thoughts are removed from summary input and recent raw copies, with own thoughts and spoken text retained',async()=>{
 const f=await fixture();f.c.chatMetadata.variables.__cxx_identity.name='丰川祥子';
 const privateText='<cxx-say speaker="爱音" kind="thought">PRIVATE_ANON_SECRET</cxx-say>',own='<cxx-say speaker="祥子" kind="thought">OWN_SAKIKO_THOUGHT</cxx-say>',spoken='<cxx-say speaker="爱音">PUBLIC_SPOKEN_WORDS</cxx-say>';
 f.c.chat[1].mes+='\n'+privateText;f.c.chat[9].mes+='\n'+privateText+'\n'+own+'\n'+spoken;const original=f.c.chat.map(r=>r.mes);
 await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));await f.bridge.intercept(rows,20000,()=>assert.fail(f.bridge.status().error?.message),'normal');
 assert.equal(f.calls,1);assert(!JSON.stringify(f.network).includes('PRIVATE_ANON_SECRET'));assert(!JSON.stringify(rows).includes('PRIVATE_ANON_SECRET'));assert(rows.at(-1).mes.includes('OWN_SAKIKO_THOUGHT'));assert(rows.at(-1).mes.includes('PUBLIC_SPOKEN_WORDS'));assert.equal(f.controller.status().lastRun.projection.hiddenThoughts,2);assert.deepEqual(f.c.chat.map(r=>r.mes),original);assert.equal(f.controller.status().records[0].projectionVersion,2);
 await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');f.dispose();
});

test('host prompt filters and attachment fields survive projection; changed filtered text invalidates old summaries',async()=>{
 const f=await fixture();f.c.chat[1].mes+=' STORED_ONLY_SECRET';f.c.chat[9].extra.files=[{name:'receipt.txt',text:'attachment retained'}];const original=structuredClone(f.c.chat.map(r=>r.mes));
 try{
  await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r,mes:r.mes.replace('STORED_ONLY_SECRET','FILTERED_PROGRESS')}));
  await f.bridge.intercept(rows,20000,()=>assert.fail(f.bridge.status().error?.message),'normal');assert(!JSON.stringify(rows).includes('STORED_ONLY_SECRET'));assert(!JSON.stringify(f.network).includes('STORED_ONLY_SECRET'));assert.deepEqual(rows.at(-1).extra.files,[{name:'receipt.txt',text:'attachment retained'}]);assert.equal(f.calls,1);await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');
  await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const changed=f.c.chat.map(r=>({...r,mes:r.mes.replace('STORED_ONLY_SECRET','CHANGED_FILTERED_PROGRESS')}));
  await f.bridge.intercept(changed,20000,()=>assert.fail(f.bridge.status().error?.message),'normal');assert.equal(f.calls,2,'same raw provenance does not reuse a summary of a different prompt projection');assert.deepEqual(f.c.chat.map(r=>r.mes),original);
 }finally{f.dispose();}
});

test('a truncated historical auxiliary block remains uncompressed and never permanently blocks later sends',async()=>{
 const f=await fixture();f.c.chat[1].mes+='\n<UpdateVariable>UNFINISHED_AUXILIARY_ONLY';const original=f.c.chat.map(r=>r.mes);
 try{for(let i=0;i<2;i++){
  await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));await f.bridge.intercept(rows,20000,()=>assert.fail(f.bridge.status().error?.message),'normal');
  assert(rows.some(r=>r.mes.includes('scene 1')));assert(!JSON.stringify(rows).includes('UNFINISHED_AUXILIARY_ONLY'));assert(!JSON.stringify(f.network).includes('scene 1 '));assert.equal(f.controller.status().lastRun.projection.pendingHistoricalRows,1);assert.deepEqual(f.c.chat.map(r=>r.mes),original);await f.emit('MESSAGE_RECEIVED',9,'normal');await f.emit('GENERATION_ENDED');
 }}finally{f.dispose();}
});

test('invalid outgoing bodies still stop the request without changing the stored chat',async()=>{
 const f=await fixture(),original=f.c.chat.map(r=>r.mes);try{await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));rows[1].mes={malformed:true};let stopped=false;await f.bridge.intercept(rows,20000,()=>stopped=true,'normal');assert(stopped);assert.match(f.bridge.status().error.message,/正文不是文本/);assert.deepEqual(f.c.chat.map(r=>r.mes),original);}finally{f.dispose();}
});

test('summary precedes kept history and scans lore; successful main assembly releases injection before later quiet work',async()=>{
 const f=await fixture(),settings=[];f.c.setExtensionPrompt=(id,text,position,depth,scan,role)=>{f.prompts.set(id,text);if(text)settings.push({position,depth,scan,role});};
 try{await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const rows=f.c.chat.map(r=>({...r}));await f.bridge.intercept(rows,20000,()=>assert.fail(),'normal');assert.deepEqual(settings.at(-1),{position:1,depth:rows.length,scan:true,role:0});
  const payload={chat:[{role:'system',content:[...f.prompts.values()].join('')},...rows.map(r=>({role:r.is_user?'user':'assistant',content:r.mes}))]};await f.emit('CHAT_COMPLETION_PROMPT_READY',payload);assert([...f.prompts.values()].every(v=>!v));
  const quiet={chat:[{role:'user',content:'其他扩展的独立辅助请求。'}]};await f.emit('CHAT_COMPLETION_PROMPT_READY',quiet);assert.deepEqual(quiet.chat,[{role:'user',content:'其他扩展的独立辅助请求。'}]);assert(!f.stopped);
 }finally{f.dispose();}
});

test('first 16k send reserves current preset before compaction, including continue prefill',async()=>{
 for(const type of ['normal','continue']){
  const f=await fixture();f.c.chatCompletionSettings.openai_max_context=16000;
  const preset='FIXED '.repeat(650);f.c.chatCompletionSettings.prompts=[{identifier:'rules',content:preset}];
  f.c.chatCompletionSettings.assistant_prefill='接续：';
  for(const row of f.c.chat)row.mes='剧情正文'.repeat(200);
  try{
   await f.emit('GENERATION_AFTER_COMMANDS',type,{},false);const rows=f.c.chat.map(r=>({...r}));
   await f.bridge.intercept(rows,15000,()=>assert.fail(f.bridge.status().error?.message),type);
   assert.equal(f.calls,1);assert.equal(rows.length,4);
   assert(f.controller.status().lastRun.fixedBudget.tokens>7000);
   assert(!('key' in f.controller.status().lastRun.fixedBudget));
   const payload={chat:[{role:'system',content:preset+[...f.prompts.values()].join('')},...rows.map(r=>({role:r.is_user?'user':'assistant',content:r.mes}))]};
   if(type==='continue')payload.chat.at(-1).content+='接续：';
   await f.emit('CHAT_COMPLETION_PROMPT_READY',payload);
   assert(!f.stopped);assert(!JSON.stringify(payload).includes('[CXXCTX_'));
   assert.equal(f.c.chat.length,10);
  }finally{f.dispose();}
 }
});
