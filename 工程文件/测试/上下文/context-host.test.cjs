'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),H=require('../../卡片源码/运行时/context-host.js');
async function fixture({rendered=false}={}){const {createBridge}=await import('../../配套扩展/tavern-runtime-suite/context/bridge.mjs'),events=new Map(),names=['GENERATION_AFTER_COMMANDS','MESSAGE_SENT','MESSAGE_RECEIVED','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED','WORLDINFO_ENTRIES_LOADED','CHAT_COMPLETION_PROMPT_READY','STREAM_TOKEN_RECEIVED',...(rendered?['CHARACTER_MESSAGE_RENDERED']:[])];
 const c={characters:[{avatar:'fixture.png',name:'fixture'}],characterId:0,chatId:'a',getCurrentChatId:()=>c.chatId,chat:[{name:'role',mes:'opening',is_user:false,swipe_id:0,swipes:['opening'],swipe_info:[{extra:{unknown:9}}],extra:{unknown:9},variables:[{stat_data:{terminal:{gameplay:{keep:1}}}}]},{name:'player',mes:'input',is_user:true,extra:{unknown:7}}],chatMetadata:{__cxx_story_profile:{schema:1,id:'profile_test'},variables:{__cxx_identity:{keep:1},__cxx_long_memory:{unknown:9}}},eventTypes:Object.fromEntries(names.map(n=>[n,n])),eventSource:{on(n,f){if(!events.has(n))events.set(n,new Set());events.get(n).add(f);},removeListener(n,f){events.get(n)?.delete(f);}},setExtensionPrompt(){},stopGeneration(){}};
 const f={c,writes:0,fail:false,corrupt:false,blocked:null};f.disk=structuredClone(c.chat);c.saveChat=async()=>{f.writes++;if(f.blocked)await f.blocked;if(f.fail)throw Error('disk failed');f.disk=structuredClone(c.chat);if(f.corrupt)delete f.disk[0].cxx_context;};
 const api={SillyTavern:{getContext:()=>c}},bridge=createBridge({context:()=>c}),top={CxxContextBridge:bridge};let lock=Promise.resolve();
 const host={assertPlayerWritable:async()=>{},withChatSave(expected,fn){const next=lock.catch(()=>{}).then(()=>{assert.equal(c.chatId,expected.chatId);return fn();});lock=next;return next;}};
 const service=H.create({api,top,host,readDisk:async()=>structuredClone(f.disk)}).start();return Object.assign(f,{service,bridge,host,top,emit:async(n,...args)=>{for(const fn of events.get(n)||[])await fn(...args);},dispose(){service.destroy();bridge.destroy();}});
}
test('the creation form greeting waits for player identity instead of reporting a missing actor',async()=>{
 const f=await fixture();try{
  f.c.chat=[{mes:'<OpeningForm/>\n',is_user:false}];f.c.chatMetadata={__cxx_story_v1:{schema:1,kind:'route',stage:'creating'}};
  await f.emit('MESSAGE_RECEIVED',0,'first_message');assert.equal(f.bridge.status().error,null);assert.equal(f.writes,0);
  f.c.chat[0].mes='An actual unattributed reply';await f.emit('MESSAGE_RECEIVED',0,'normal');assert(f.bridge.status().error);assert.equal(f.writes,0);
 }finally{f.dispose();}
});
test('formal source writer preserves shared message/extra/swipe/variable objects and verifies native disk',async()=>{
 const f=await fixture(),m=f.c.chat[0],extra=m.extra,info=m.swipe_info[0],infoExtra=info.extra,variables=m.variables,vars=f.c.chatMetadata.variables;const result=await f.service.capture();
 assert.strictEqual(f.c.chat[0],m);assert.strictEqual(m.extra,extra);assert.strictEqual(m.swipe_info[0],info);assert.strictEqual(info.extra,infoExtra);assert.strictEqual(m.variables,variables);assert.strictEqual(f.c.chatMetadata.variables,vars);
 assert.equal(extra.unknown,9);assert.equal(infoExtra.unknown,9);assert.equal(vars.__cxx_long_memory.unknown,9);assert.equal(result.unresolved.length,0);assert.equal(f.writes,1);
 const ids=result.index.rows.map(r=>r.variantId);assert.deepEqual((await f.service.capture()).index.rows.map(r=>r.variantId),ids);assert.equal(f.writes,1);f.dispose();
});

test('pre-send materialization retries with stable IDs while ordinary capture still rejects concurrent edits',async()=>{
 const f=await fixture();try{await f.service.capture();const id=f.c.chat[0].extra.cxx_context.variantId,save=f.c.saveChat;let edited=false;f.c.chat[1].mes+=' queued';f.c.saveChat=async()=>{await save();if(!edited){edited=true;f.c.chat[1].mes+=' materialized';}};await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);assert.equal(f.bridge.status().error,null);assert.equal(f.c.chat[0].extra.cxx_context.variantId,id);assert.deepEqual(f.disk,f.c.chat);assert.equal(f.service.status().pending,false);}finally{f.dispose();}
});
test('save or readback failure retries persistence with the same IDs instead of replaying migration',async()=>{
 for(const failure of ['fail','corrupt']){const f=await fixture();f[failure]=true;await assert.rejects(f.service.capture());const id=f.c.chat[0].extra.cxx_context.variantId;assert(f.service.status().pending);f[failure]=false;await f.service.retry();assert.equal(f.c.chat[0].extra.cxx_context.variantId,id);assert.equal(f.disk[0].extra.cxx_context.variantId,id);assert.equal(f.writes,2);assert(!f.service.status().pending);f.dispose();}
});
test('an independent MVU variable update during persistence is preserved by the provenance writer',async()=>{
 const f=await fixture();let release;f.blocked=new Promise(r=>release=r);const flight=f.service.capture();while(!f.writes)await new Promise(r=>setTimeout(r,0));f.c.chat[0].variables[0].stat_data.terminal.gameplay.keep=2;f.c.chat[0].extra.shujuku={known:'new'};release();await flight;
 assert.equal(f.disk[0].variables[0].stat_data.terminal.gameplay.keep,2);assert.equal(f.disk[0].extra.shujuku.known,'new');f.dispose();
});

test('an assistant receipt retries a skipped conditional save without changing its source identity',async()=>{
 const f=await fixture();try{f.c.chat.pop();await f.service.capture();const id=f.c.chat[0].extra.cxx_context.variantId;await f.emit('GENERATION_AFTER_COMMANDS','continue',{},false);const m=f.c.chat[0];m.mes+=' continuation';m.swipes[0]=m.mes;const save=f.c.saveChat;let skipped=false;f.c.saveChat=async()=>{if(!skipped){skipped=true;return;}return save();};await f.emit('MESSAGE_RECEIVED',0,'continue');await f.emit('GENERATION_ENDED');assert(skipped);assert.equal(f.bridge.status().error,null);assert.equal(f.service.status().pending,false);assert.equal(f.disk[0].mes,m.mes);assert.equal(f.disk[0].extra.cxx_context.variantId,id);}finally{f.dispose();}
});
test('queued source work cannot mutate another chat or an edited story',async()=>{
 for(const change of ['chat','body']){const f=await fixture();let release;const held=f.host.withChatSave(f.service.location(),()=>new Promise(r=>release=r));while(!release)await new Promise(r=>setTimeout(r,0));const flight=f.service.capture();if(change==='chat')f.c.chatId='b';else f.c.chat[0].mes+=' edited';release();await held;await assert.rejects(flight);assert.equal(f.c.chat[0].cxx_context,undefined);assert.equal(f.writes,0);f.dispose();}
});
test('legacy attribution remains unknown after an unproven earlier control switch',async()=>{
 const f=await fixture();f.c.chat[0].variables[0].stat_data.terminal.ensemble={control:{actorId:'wb_10',viewpointActorId:'wb_10',revision:1}};const result=await f.service.capture();assert.equal(result.unresolved.length,2);assert.equal(f.c.chat[1].extra.cxx_context.binding,null);f.dispose();
});
test('bridge captures user and assistant sources using frozen control without replacing host objects',async()=>{
 const f=await fixture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);
 // A later unrelated view change cannot relabel this turn.
 f.c.chat[0].variables[0].stat_data.terminal.ensemble={control:{actorId:'wb_6',viewpointActorId:'wb_6',revision:1}};
 const user={name:'player',mes:'new input',is_user:true,extra:{keep:1}};f.c.chat.push(user);await f.emit('MESSAGE_SENT',2);assert.strictEqual(f.c.chat[2],user);assert.equal(user.extra.cxx_context.binding.actorId,'player');
 const rows=f.c.chat.map(m=>({...m}));let aborted=false;await f.bridge.intercept(rows,1000,()=>aborted=true,'normal');assert(!aborted);
 const response={name:'role',mes:'new response',is_user:false,extra:{keep:2}};f.c.chat.push(response);await f.emit('MESSAGE_RECEIVED',3,'normal');assert.strictEqual(f.c.chat[3],response);assert.equal(response.extra.cxx_context.binding.actorId,'player');await f.emit('GENERATION_ENDED');f.dispose();
});
test('memory references verify live ancestry without rejecting later messages or variable updates',async()=>{
 const f=await fixture();await f.service.capture();const ref=f.service.reference(1);assert(f.service.validSource(ref));
 assert(f.service.validSource({ancestry:ref.ancestry,digest:ref.digest,variantId:ref.variantId,messageId:ref.messageId,scope:{chat:ref.scope.chat,group:ref.scope.group,character:ref.scope.character}}));
 f.c.chat.push({mes:'a new turn',is_user:false});f.c.chat[0].variables[0].stat_data.extra='numeric changed';assert(f.service.validSource(ref));
 f.c.chat[0].mes='earlier text edited';assert(!f.service.validSource(ref));assert.equal(f.service.reference(1),null);f.c.chat[0].mes='opening';assert(f.service.validSource(ref));f.c.chatId='other';assert(!f.service.validSource(ref));f.dispose();
});
test('explicit continuation lineage preserves old references; unrelated copies and changed ancestors do not',async()=>{
 const f=await fixture();await f.service.capture();const ref=f.service.reference(1);f.c.chatId='continued';f.c.chatMetadata.variables.__cxx_long_memory={schema:1,owner:['fixture.png','continued'],origins:[['fixture.png','a']],unknown:9};await f.service.capture();
 assert(f.service.validSource(ref));assert.equal(f.service.reference(1).scope.chat,'continued');assert.equal(f.c.chatMetadata.variables.__cxx_long_memory.unknown,9);
 f.c.chatMetadata.variables.__cxx_long_memory.owner=['fixture.png','unrelated'];assert(!f.service.validSource(ref));f.c.chatMetadata.variables.__cxx_long_memory.owner=['fixture.png','continued'];assert(f.service.validSource(ref));
 f.c.chat[0].mes='edited earlier';f.c.chat[0].swipes[0]=f.c.chat[0].mes;await f.service.capture();assert(!f.service.validSource(ref));f.dispose();
});
test('batch source validation checks shared ancestry once and preserves valid prefixes',async()=>{const f=await fixture();await f.service.capture();const first=f.service.reference(0),second=f.service.reference(1);assert.deepEqual(f.service.validSources([first,second]),[true,true]);f.c.chat[1].mes+=' edit';assert.deepEqual(f.service.validSources([first,second]),[true,false]);f.c.chatId='other';assert.deepEqual(f.service.validSources([first,second]),[false,false]);f.dispose();});

test('regeneration and continuation retain the original reply actor after a later control switch',async()=>{
 for(const type of ['regenerate','swipe','continue']){const f=await fixture();try{f.c.chat.pop();await f.service.capture();const original=structuredClone(f.c.chat[0].extra.cxx_context);f.c.chat[0].variables[0].stat_data.terminal.ensemble={control:{actorId:'wb_10',viewpointActorId:'wb_10',revision:1}};assert.equal(f.service.binding().actorId,'wb_10');assert.equal(f.service.generationBinding(type).actorId,'player');await f.emit('GENERATION_AFTER_COMMANDS',type,{},false);assert.equal(f.bridge.status().error,null);const row=f.c.chat[0];row.swipe_id=1;row.variables[1]=copyForTest(row.variables[0]);row.swipes.push('重写完成');row.swipe_info.push({extra:{cxx_context:copyForTest(original)}});row.extra={cxx_context:copyForTest(original)};row.mes='重写完成';await f.emit('MESSAGE_RECEIVED',0,type);assert.equal(row.extra.cxx_context.binding.actorId,'player');assert.equal(row.swipe_info[0].extra.cxx_context.variantId,original.variantId);await f.emit('GENERATION_ENDED');assert.equal(f.service.binding().actorId,'wb_10');assert.equal(f.service.generationBinding('normal').actorId,'wb_10');}finally{f.dispose();}}
 function copyForTest(value){return structuredClone(value);}
});

test('unattributed old replies cannot be regenerated under a newly selected actor',async()=>{const f=await fixture();try{f.c.chat.pop();f.c.chat[0].variables[0].stat_data.terminal.ensemble={control:{actorId:'wb_6',viewpointActorId:'wb_6',revision:1}};await f.service.capture();assert.throws(()=>f.service.generationBinding('regenerate'),/没有可确认的扮演人物/);await f.emit('GENERATION_AFTER_COMMANDS','regenerate',{},false);assert(f.bridge.status().error);assert.equal(f.c.chat[0].extra.cxx_context.binding,null);}finally{f.dispose();}});

test('all four transport/variable modes preserve a single reroll receipt through native UI end and repeated events',async()=>{
 for(const streaming of [false,true])for(const extra of [false,true]){const f=await fixture();try{
  f.c.chat.pop();await f.service.capture();const row=f.c.chat[0],old=row.extra.cxx_context.variantId;
  await f.emit('GENERATION_AFTER_COMMANDS','swipe',{},false);
  row.swipe_id=1;row.mes='new response';row.swipes.push(row.mes);row.swipe_info.push({extra:structuredClone(row.extra)});
  if(streaming)await f.emit('GENERATION_ENDED');
  const id=f.bridge.status().session.id;
  await f.emit('MESSAGE_RECEIVED',0,'swipe');assert.equal(f.bridge.status().error,null);
  const next=row.extra.cxx_context.variantId;assert.notEqual(next,old);assert.equal(row.swipe_info[0].extra.cxx_context.variantId,old);
  await f.emit('MESSAGE_RECEIVED',0,'swipe');assert.equal(row.extra.cxx_context.variantId,next);
  if(extra){await f.emit('GENERATION_AFTER_COMMANDS','quiet',{},false);await f.emit('GENERATION_ENDED');row.variables[1]={stat_data:{terminal:{wallet:{yen:120},gameplay:{xp:100}}}};await f.service.capture();}
  await f.emit('GENERATION_ENDED');assert.equal(f.bridge.status().session,null);assert.equal(f.disk[0].extra.cxx_context.variantId,next);
  assert(id>0);
 }finally{f.dispose();}}
});
test('stopping a stream retains provenance for its partial response but cancels policy work and clears on scope change',async()=>{
 const f=await fixture();try{f.c.chat.pop();await f.service.capture();let paused=0;f.service.use({finish(){paused++;}});
 await f.emit('GENERATION_AFTER_COMMANDS','swipe',{},false);await f.emit('GENERATION_STOPPED');assert.equal(paused,1);f.service.use(null);
 const row=f.c.chat[0],old=row.extra.cxx_context.variantId;row.swipe_id=1;row.mes='partial';row.swipes.push(row.mes);row.swipe_info.push({extra:structuredClone(row.extra)});
 await f.emit('MESSAGE_RECEIVED',0,'swipe');assert.notEqual(row.extra.cxx_context.variantId,old);assert.equal(f.bridge.status().session,null);
 await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await f.emit('GENERATION_ENDED');f.c.chatId='other';await f.emit('CHAT_CHANGED');assert.equal(f.bridge.status().session,null);
 }finally{f.dispose();}
});

test('completed receipt accepts only a public mirror projection of the same original and alternative',async()=>{
 for(const change of ['translation','source','other-floor','other-swipe','conflict']){const f=await fixture();try{
  await f.service.capture();const m=f.c.chat[0],id=m.extra.cxx_context.variantId;
  f.top.__JINGYI__={features:['reading'],reading:{apiVersion:2,async get(){return {schema:1,state:change==='conflict'?'conflict':'ready',owner:{chatId:f.c.chatId,messageId:0,swipeId:m.swipe_id??0},sourceMessage:change==='source'?m.mes:'opening',sourceRevision:change==='source'?m.mes:'source-v1'};}}};
  f.host.assertPlayerWritable=async()=>{m.mes='opening<mirror>译文</mirror>';m.swipes[0]=m.mes;if(change==='other-floor')f.c.chat[1].mes+=' edit';if(change==='other-swipe')m.swipe_id=1;};
  const result=f.service.capture({completedFloor:0});
  if(change==='translation'){await result;assert.equal(f.disk[0].mes,m.mes);assert.equal(m.extra.cxx_context.variantId,id);assert.equal(f.service.status().error,'');}
  else {await assert.rejects(result,{code:'source-stale'});assert(!JSON.stringify(f.service.status().details).includes('译文'));}
 }finally{f.dispose();}}
});
test('readback diagnostics identify provenance paths without including story or variable contents',async()=>{const f=await fixture();try{f.corrupt=true;await assert.rejects(f.service.capture(),e=>e.code==='source-readback'&&e.details.phase==='readback'&&e.details.differences.some(d=>d.path.includes('metadata')));const text=JSON.stringify(f.service.status().details);assert(!text.includes('opening'));assert(!text.includes('input'));assert(!text.includes('unknown'));}finally{f.dispose();}});

// Native streaming unlocks before its asynchronous source receipt completes.
test('streaming immediate native swipe supersedes the old receipt and saves unique stable branch IDs',async()=>{
 const f=await fixture(),tick=()=>new Promise(r=>setImmediate(r));try{
  await f.service.capture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);
  const row={name:'role',mes:'streamed response',is_user:false,swipe_id:0,swipes:['streamed response'],swipe_info:[{extra:{keep:1}}],extra:{keep:1},variables:[{stat_data:{preserve:8}}]};f.c.chat.push(row);await f.emit('GENERATION_ENDED');
  let release;f.blocked=new Promise(r=>release=r);const n=f.writes,receipt=f.emit('MESSAGE_RECEIVED',2,'normal');while(f.writes===n)await tick();const old=row.extra.cxx_context.variantId;
  row.swipe_id=1;const next=f.emit('GENERATION_AFTER_COMMANDS','swipe',{},false);await tick();f.blocked=null;release();await receipt;
  row.swipes[1]=row.mes;row.swipe_info[1]={extra:structuredClone(row.extra)};await next;
  assert.equal(f.bridge.status().error,null);assert.equal(f.service.status().error,'');assert.equal(row.swipe_info[0].extra.cxx_context.variantId,old);assert.notEqual(row.extra.cxx_context.variantId,old);const fresh=row.extra.cxx_context.variantId;assert.deepEqual(row.variables,[{stat_data:{preserve:8}}]);
  row.mes='regenerated text';row.swipes[1]=row.mes;await f.emit('MESSAGE_RECEIVED',2,'swipe');await f.service.retry();assert.equal(row.extra.cxx_context.variantId,fresh);assert.deepEqual(f.disk,f.c.chat);assert(!f.service.status().pending);
 }finally{f.dispose();}
});
test('native new-slot hint retains the original actor after the active control changes',async()=>{
 const f=await fixture();try{f.c.chat.pop();await f.service.capture();const m=f.c.chat[0],old=m.extra.cxx_context.variantId;m.variables[0].stat_data.terminal.ensemble={control:{actorId:'wb_10',viewpointActorId:'wb_10',revision:1}};
 m.swipe_id=1;m.swipes[1]=m.mes;m.swipe_info[1]={extra:structuredClone(m.extra)};await f.emit('GENERATION_AFTER_COMMANDS','swipe',{},false);assert.equal(f.bridge.status().error,null);assert.equal(m.extra.cxx_context.binding.actorId,'player');assert.notEqual(m.extra.cxx_context.variantId,old);assert.equal(m.swipe_info[0].extra.cxx_context.variantId,old);
 }finally{f.dispose();}
});
test('an existing duplicated branch is not made fresh merely by starting swipe generation',async()=>{
 const f=await fixture();try{f.c.chat.pop();const m=f.c.chat[0];m.swipes.push('prior alternative');m.swipe_info.push({extra:{}});await f.service.capture();const first=structuredClone(m.swipe_info[0].extra.cxx_context);m.swipe_id=1;m.swipe_info[1].extra.cxx_context=structuredClone(first);m.extra.cxx_context=structuredClone(first);const before=structuredClone(m);await f.emit('GENERATION_AFTER_COMMANDS','swipe',{},false);assert.equal(f.bridge.status().error.code,'source-duplicate');assert.deepEqual(m,before);
 }finally{f.dispose();}
});
test('superseding a receipt does not turn a failed save into successful persistence',async()=>{
 const f=await fixture(),tick=()=>new Promise(r=>setImmediate(r));try{await f.service.capture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);f.c.chat.push({mes:'reply',is_user:false});let release;f.blocked=new Promise(r=>release=r);const n=f.writes,receipt=f.emit('MESSAGE_RECEIVED',2,'normal');while(f.writes===n)await tick();const next=f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);await tick();f.fail=true;f.blocked=null;release();await receipt;await next;assert.match(f.service.status().error,/disk failed/);assert(f.service.status().pending);assert(f.bridge.status().error);
 }finally{f.dispose();}
});

test('pre-send waits for an existing native write before asking the host to save new IDs',async()=>{
 const f=await fixture();try{await f.service.capture();f.c.chat[1].mes+=' changed';let release,waiting=false;const blocked=new Promise(r=>release=r);f.top.__cxx_chat_save_guard_v1={whenIdle:async()=>{waiting=true;await blocked;}};const n=f.writes,work=f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);while(!waiting)await new Promise(r=>setImmediate(r));assert.equal(f.writes,n);release();await work;assert.equal(f.bridge.status().error,null);assert.deepEqual(f.disk,f.c.chat);
 }finally{f.dispose();}
});

test('a new generation waits for all old MESSAGE_RECEIVED consumers before prompt preparation',async()=>{
 const f=await fixture({rendered:true});try{await f.service.capture();await f.emit('GENERATION_AFTER_COMMANDS','normal',{},false);const row={mes:'old reply',is_user:false,swipe_id:0,swipes:['old reply'],swipe_info:[{extra:{}}],extra:{}};f.c.chat.push(row);await f.emit('GENERATION_ENDED');await f.emit('MESSAGE_RECEIVED',2,'normal');const old=row.extra.cxx_context.variantId;
 row.swipe_id=1;let prepared=false;const next=f.emit('GENERATION_AFTER_COMMANDS','swipe',{},false).then(()=>prepared=true);await new Promise(r=>setImmediate(r));assert.equal(prepared,false);
 // A later native/MVU listener materializes its suffix before rendered is emitted.
 row.mes+=' suffix';row.swipes[1]=row.mes;row.swipe_info[1]={extra:structuredClone(row.extra)};await f.emit('CHARACTER_MESSAGE_RENDERED',2);await next;assert.equal(f.bridge.status().error,null);assert.equal(row.swipe_info[0].extra.cxx_context.variantId,old);assert.notEqual(row.extra.cxx_context.variantId,old);assert.deepEqual(f.disk,f.c.chat);
 }finally{f.dispose();}
});

test('native streaming removes only the proven duplicate reservation hole, retaining every populated branch',async()=>{
 for(const keep of ['hole','text','empty','variables','extra','null']){const f=await fixture();try{f.c.chat.pop();await f.service.capture();const m=f.c.chat[0];m.swipe_id=1;m.swipes[1]=m.mes;m.swipe_info[1]={extra:structuredClone(m.extra)};await f.emit('GENERATION_AFTER_COMMANDS','swipe',{},false);const before=structuredClone(m),ids=m.swipe_info.map(v=>v.extra.cxx_context.variantId);m.swipes.length++;if(keep==='text')m.swipes[2]='real alternative';if(keep==='empty')m.swipes[2]='';if(keep==='variables')m.variables[2]={unknown:4};if(keep==='extra')m.swipe_info[2]={extra:{unknown:4}};if(keep==='null')m.swipes[2]=null;await f.emit('STREAM_TOKEN_RECEIVED','token');assert.equal(m.swipes.length,keep==='hole'?2:3);assert.deepEqual(m.swipe_info.slice(0,2).map(v=>v.extra.cxx_context.variantId),ids);if(keep==='hole')assert.deepEqual(m,before);
 }finally{f.dispose();}}
});
