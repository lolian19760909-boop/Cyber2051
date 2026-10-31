'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../../卡片源码/运行时/chat-save-guard.js');
const copy=x=>JSON.parse(JSON.stringify(x)),delay=ms=>new Promise(r=>setTimeout(r,ms));
const original=()=>[{chat_metadata:{integrity:'keep',unknown:{keep:true}}},...Array.from({length:500},(_,i)=>({mes:'floor '+i,swipe_id:0,swipes:['floor '+i,'unselected '+i],swipe_info:[{}, {foreign:{keep:i}}],variables:[{stat_data:{v:i}},{unknown:i}],extra:{unknown:i}}))];
async function fixture({beforeExport=async()=>{},initialRows=original()}={}){
 const disk=new Map([['old',copy(initialRows)],['other',original()]]),writes=[],events=new Map(),selected={value:'old'};let mode='success',pending=null,characterWrites=0;
 const character={avatar:'test.png',chat:'old'},context={characterId:0,characters:[character],chat:copy(disk.get('old').slice(1)),chatMetadata:copy(disk.get('old')[0].chat_metadata),getCurrentChatId:()=>character.chat,getRequestHeaders:()=>({'Content-Type':'application/json'})};
 context.updateChatMetadata=(m,reset)=>context.chatMetadata=reset?{...m}:{...context.chatMetadata,...m};
 const scope=()=>({characterKey:'test.png',chatId:character.chat});
 const win={document:{querySelector:s=>s==='#selected_chat_pole'?selected:null},location:new URL('https://test.invalid'),Request,Response,Blob,TextDecoder,DecompressionStream,setTimeout,clearTimeout,navigator:{locks:{request:async(_k,_o,fn)=>fn()}}};
 win.fetch=async(input,init)=>{const req=new Request(input,init),name=new URL(req.url).pathname;if(name==='/api/characters/edit'){characterWrites++;return Response.json({});}const p=await req.json();
  if(name==='/api/chats/export'){await beforeExport();const rows=disk.get(p.file.replace(/\.jsonl$/,''));return rows?Response.json({result:rows.map(JSON.stringify).join('\n')}):Response.json({message:'Could not find JSONL file to export.'},{status:404});}
  if(name==='/api/characters/chats')return Response.json([...disk.keys()].map(x=>({file_name:x+'.jsonl'})));
  if(name==='/api/chats/get'){
   if(mode==='hold')await new Promise(r=>pending=r);
   if(mode==='network')throw TypeError('offline');if(mode==='http')return new Response('',{status:500});if(mode==='json')return new Response('{invalid');
   return Response.json(mode==='empty'?[]:disk.get(p.file_name)||[]);
  }
  if(name==='/api/chats/save'){writes.push(copy(p));disk.set(p.file_name,copy(p.chat));return Response.json({ok:true});}
  throw Error(name);
 };
 context.saveChat=()=>win.fetch('https://test.invalid/api/chats/save',{method:'POST',body:JSON.stringify({avatar_url:'test.png',file_name:character.chat,chat:[{chat_metadata:context.chatMetadata},...context.chat]})});
 const api={getCurrentCharacterId:()=>character.avatar,SillyTavern:{getContext:()=>context},tavern_events:{MESSAGE_RECEIVED:'received',MESSAGE_DELETED:'deleted'},eventOn:(e,f)=>events.set(e,f),eventRemoveListener:(e,f)=>{if(events.get(e)===f)events.delete(e);}};
 const service=G.acquire({win,api,loadHostState:async()=>({saveChatConditional:context.saveChat,isChatSaving:false})});await service.guard.ready();
 async function open(id,{swallow=false,firstSave=false,parallelReset=false,afterInstall=()=>{}}={}){
  context.chat.length=0;context.chatMetadata={};character.chat=id;
  try{const response=await win.fetch('https://test.invalid/api/chats/get',{method:'POST',body:JSON.stringify({avatar_url:'test.png',file_name:id})});if(!response.ok)throw Error('get failed');const rows=await response.json();context.chatMetadata=rows[0]?.chat_metadata||{};context.chat.push(...rows.slice(1));}
  catch(error){if(!swallow)throw error;}
  if(!context.chat.length){context.chat.push({mes:'first greeting'});if(firstSave)await context.saveChat();}
  await afterInstall(context);
  await (parallelReset?Promise.all([service.reset({reuseScope:true}),service.reset({reuseScope:true}),service.reset({reuseScope:true})]):service.reset({reuseScope:true}));
 }
 return{win,api,context,scope,service,disk,writes,events,open,selected,get characterWrites(){return characterWrites;},set mode(v){mode=v;},releaseRead:()=>pending?.(),get readPending(){return !!pending;}};
}
test('explicit navigation restores the entire unsaved 500-floor snapshot after swallowed read failures',async()=>{
 for(const mode of ['network','http','json','empty'])for(const target of ['old','other']){
  const f=await fixture();try{f.context.chat[20].mes='unsaved draft';f.context.chat[20].swipes[1]='unsaved alternate';f.context.chatMetadata.extra={draft:true};const before=copy({messages:f.context.chat,metadata:f.context.chatMetadata}),files=copy([...f.disk]);f.mode=mode;
   await assert.rejects(f.service.navigate({target:{characterKey:'test.png',chatId:target},work:()=>f.open(target,{swallow:true,firstSave:true})}));
   assert.deepEqual([...f.disk],files);assert.deepEqual({messages:f.context.chat,metadata:f.context.chatMetadata},before);assert.equal(f.scope().chatId,'old');assert.equal(f.writes.length,0);assert.deepEqual(f.service.recoveryDraft().loaded,before);
  }finally{f.service.release();}
 }
});
test('slow navigation blocks concurrent native autosaves without waiting on the loader',async()=>{
 const f=await fixture();try{await f.context.saveChat();f.mode='hold';const nav=f.service.navigate({target:f.scope(),work:()=>f.open('old')});while(!f.readPending)await delay(2);
  const result=await Promise.race([f.context.saveChat().then(()=> 'written',e=>e.code),delay(100).then(()=> 'deadlock')]);assert.equal(result,'chat-load-pending');await delay(350);assert.equal(f.writes.length,1);assert.equal(f.disk.get('old').length,501);
  f.releaseRead();await nav;assert.equal(f.context.chat.length,500);await f.context.saveChat();assert.equal(f.writes.length,2);
 }finally{f.releaseRead();f.service.release();}
});
test('the 250ms drain stops before /get if the native host has replaced metadata',async()=>{
 const f=await fixture();try{await f.context.saveChat();f.context.chat.length=0;f.context.chatMetadata={};await delay(400);assert.equal(f.writes.length,1);assert.equal(f.disk.get('old').length,501);}finally{f.service.release();}
});
test('native /get failures restore the retained live objects including unsaved edits and message events',async()=>{
 const f=await fixture();try{f.context.chat[10].mes='unsaved edit';f.context.chat[10].variables[1].unknown=99;f.context.chat.push({mes:'unsaved new floor',swipes:['one','two']});f.events.get('received')();const before=copy(f.context.chat);f.mode='network';await f.open('old',{swallow:true,firstSave:true});assert.deepEqual(f.context.chat,before);assert.equal(f.writes.length,0);assert.deepEqual(f.disk.get('old'),original());}finally{f.service.release();}assert.equal(f.events.size,0);
});
test('successful loads preserve all inactive branches and can then delete floors or regenerate normally',async()=>{
 const f=await fixture();try{await f.service.navigate({target:{characterKey:'test.png',chatId:'other'},work:()=>f.open('other')});assert.deepEqual(f.context.chat,f.disk.get('other').slice(1));
  f.context.chat.splice(250);f.events.get('deleted')();await f.context.saveChat();assert.equal(f.disk.get('other').length,251);f.context.chat.at(-1).mes='regenerated';f.context.chat.at(-1).swipes.push('regenerated');await f.context.saveChat();assert.equal(f.disk.get('other').at(-1).swipes[1],'unselected 249');assert.equal(f.disk.get('old').length,501);
 }finally{f.service.release();}
});
test('concurrent CHAT_CHANGED listeners share one native-load verification instead of invalidating each other',async()=>{
 const f=await fixture();try{await f.open('other',{parallelReset:true});assert.equal(f.service.status().phase,'load-ready');assert.equal(f.context.chat.length,500);await f.context.saveChat();assert.equal(f.writes.length,1);}finally{f.service.release();}
});

test('ST proves the installed response once, preserving subsequent MVU initialization and real local edits for the first save',async()=>{
 const f=await fixture();try{const disk=copy(f.disk.get('old'));let intended;
  await f.open('old',{afterInstall(c){const m=c.chat[0];m.variables[0].display_data=copy(m.variables[0].stat_data);m.mes+='\n\n<StatusPlaceHolderImpl/>';m.swipes[0]=m.mes;
   c.chat[23].mes='player edited this loaded message';c.chat[23].variables[1].unknown={edited:true};c.chat[23].swipes[1]='edited inactive reply';c.chat[23].extra.unrecognized={preserve:true};c.chatMetadata.unrecognized={local:true};delete c.chatMetadata.unknown;
   intended=copy({messages:c.chat,metadata:c.chatMetadata});}});
  assert.equal(f.service.status().phase,'load-ready');assert.deepEqual(f.disk.get('old'),disk);assert.equal(f.writes.length,0);assert.deepEqual({messages:f.context.chat,metadata:f.context.chatMetadata},intended);
  await f.context.saveChat();assert.deepEqual(f.disk.get('old'),[{chat_metadata:intended.metadata},...G.slimChat(intended.messages)]);assert.equal(f.disk.get('old')[1].variables[0].display_data,undefined);assert.equal(f.writes.length,1);assert.equal(f.context.chat.length,500);assert.equal(f.context.chat[499].swipes[1],disk[500].swipes[1]);
 }finally{f.service.release();}
});

test('ST response baselines still reject replaced message objects and wrong scopes before the first save',async()=>{
 for(const scenario of ['replacement','scope-after-install','scope-during-verification']){let count=0,f;f=await fixture({beforeExport:async()=>{if(++count===3&&scenario==='scope-during-verification')f.context.characters[0].chat='other';}});try{const before=copy([...f.disk]);
  await assert.rejects(f.open('old',{afterInstall(c){if(scenario==='replacement')c.chat[20]=copy(c.chat[20]);if(scenario==='scope-after-install')c.characters[0].chat='other';}}),{code:scenario==='replacement'?'chat-load-pending':'context-changed'});
  assert.equal(f.writes.length,0);assert.deepEqual([...f.disk],before);
 }finally{f.service.release();}}
});

test('ST disk changes at either verification read cannot be blessed by a previously installed response',async()=>{
 for(const changedRead of [3,4]){let count=0,f;f=await fixture({beforeExport:async()=>{if(++count===changedRead)f.disk.get('old')[31].extra.unknown='changed in another window';}});try{
  await assert.rejects(f.open('old',{afterInstall(c){c.chat[0].variables[0].display_data={initialized:true};}}),{code:'chat-save-conflict'});
  assert.equal(f.writes.length,0);assert.equal(f.disk.get('old')[31].extra.unknown,'changed in another window');assert.equal(f.disk.get('old').length,501);
 }finally{f.service.release();}}
});

test('ordinary reset without an installed-response receipt still rejects memory differing from disk',async()=>{
 const f=await fixture();try{f.context.chat[0].variables[0].display_data={changed:true};await assert.rejects(f.service.reset(),{code:'chat-save-conflict'});assert.equal(f.writes.length,0);assert.deepEqual(f.disk.get('old'),original());}finally{f.service.release();}
});

test('ST rechecks installed message identities after the asynchronous baseline read',async()=>{
 for(const scenario of ['replacement','clear','truncate']){let count=0,f;f=await fixture({beforeExport:async()=>{if(++count===4){if(scenario==='replacement')f.context.chat[0]=copy(f.context.chat[0]);else f.context.chat.splice(scenario==='clear'?0:1);}}});try{
  await assert.rejects(f.open('old'),{code:'chat-load-pending'});await assert.rejects(f.context.saveChat(),{code:'chat-load-pending'});assert.equal(f.writes.length,0);assert.equal(f.disk.get('old').length,501);
  await f.open('old');assert.equal(f.context.chat.length,500);await f.context.saveChat();assert.equal(f.writes.length,1);
 }finally{f.service.release();}}
});
test('a deliberate new chat and a verified empty file can save a first greeting without a load/save deadlock',async()=>{
 for(const kind of ['missing','header-only']){const f=await fixture();try{if(kind==='header-only')f.disk.set('new',[{chat_metadata:{integrity:'empty'}}]);await f.service.navigate({...(kind==='missing'?{allowNew:true}:{target:{characterKey:'test.png',chatId:'new'}}),work:()=>f.open('new',{firstSave:true})});assert.equal(f.disk.get('new').length,2);assert.equal(f.disk.get('old').length,501);}finally{f.service.release();}}
});
test('a ticket staged before even a failed navigation is obsolete after rollback',async()=>{
 const f=await fixture();try{const ticket=f.service.guard.ticket();f.mode='network';await assert.rejects(f.service.navigate({target:f.scope(),work:()=>f.open('old')}));await assert.rejects(f.service.guard.commit(f.scope(),original(),async()=>({ok:true}),ticket),{code:'context-changed'});assert.equal(f.writes.length,0);await f.context.saveChat();assert.equal(f.writes.length,1);}finally{f.service.release();}
});
test('ST swallowed cross-story load failure cannot persist its failed destination in the trailing character form save',async()=>{
 const f=await fixture();try{f.mode='http';await assert.rejects(f.service.navigate({target:{characterKey:'test.png',chatId:'other'},work:async()=>{
  await f.open('other',{swallow:true});f.selected.value='other';const form=new FormData();form.set('avatar_url','test.png');form.set('chat','other');
  await assert.rejects(f.win.fetch('https://test.invalid/api/characters/edit',{method:'POST',body:form}));assert.equal(f.service.status().phase,'load-transition');
 }}));assert.equal(f.characterWrites,0);assert.equal(f.selected.value,'old');assert.equal(f.scope().chatId,'old');
 const form=new FormData();form.set('avatar_url','test.png');form.set('chat','old');await f.win.fetch('https://test.invalid/api/characters/edit',{method:'POST',body:form});assert.equal(f.characterWrites,1);await f.context.saveChat();assert.equal(f.disk.get('old').length,501);
 }finally{f.service.release();}
});

async function nativeFixture({beforeNative=()=>{},beforeExport=async()=>{},initialRows=original()}={}){
 let disk=copy(initialRows),writes=0,pending=null,mode='success',staged=null,coldTools=null;
 const character={chat:'old'},context={characterId:0,characters:[character],chat:copy(disk.slice(1)),chatMetadata:copy(disk[0].chat_metadata),getCurrentChatId:()=>character.chat,getRequestHeaders:()=>({'Content-Type':'application/json'}),updateChatMetadata(m){this.chatMetadata=m;}};
 const target={kind:'character',characterId:'test',fileName:'old'},scope={characterKey:'test.png',chatId:'old'};
 const bytes=()=>new TextEncoder().encode(disk.map(JSON.stringify).join('\n'));
 const win={__TAURI_INTERNALS__:{},__TAURI__:{core:Object.freeze({async invoke(command,args){
  beforeNative(command,args);
  if(command==='get_chat_payload_path'){if(args.allowNotFound){await beforeExport();return disk.length?'/memory/readback/old.jsonl':null;}if(mode==='failure')throw Error('native read failed');return '/memory/old.jsonl';}
  if(command==='plugin:fs|open')return args.path.includes('/readback/')?9:8;
  if(command==='plugin:fs|fstat')return{size:bytes().length};
  if(command==='plugin:fs|read'){if(mode==='hold'&&args.rid===8)await new Promise(r=>pending=r);const b=bytes(),out=new Uint8Array(b.length+8);out.set(b);new DataView(out.buffer).setBigUint64(b.length,BigInt(b.length));return out;}
  if(command==='plugin:resources|close')return;
  if(command==='begin_chat_commit'){staged=[];return{sessionId:'staged'};}
  if(command==='append_chat_commit_chunk'){staged.push(new Uint8Array(args));return staged.reduce((n,b)=>n+b.length,0);}
  if(command==='abort_chat_commit'){staged=null;return;}
  if(command==='finish_chat_commit'){disk=Buffer.concat(staged.map(x=>Buffer.from(x))).toString().trim().split('\n').map(JSON.parse);staged=null;writes++;return{};}
  if(command==='commit_chat_metadata'){disk[0].chat_metadata=copy(args.chatMetadata);writes++;return;}
  throw Error(command);
 }})},document:{querySelector:()=>null,createElement:()=>({remove(){}}),head:{append(){queueMicrotask(()=>{const key=Object.keys(win).find(k=>k.startsWith('__cxx_cold_tools_'));win[key](coldTools);});}}},location:new URL('https://test.invalid'),Request,Response,Blob,TextDecoder,DecompressionStream,setTimeout,clearTimeout,navigator:{locks:{request:async(_k,_o,fn)=>fn()}},fetch:async url=>{if(String(url).endsWith('/characters/chats'))return Response.json(disk.length?[{file_name:character.chat+'.jsonl'}]:[]);await beforeExport();return disk.length?Response.json({result:disk.map(JSON.stringify).join('\n')}):Response.json({message:'Could not find JSONL file to export.'},{status:404});}};
 const api={getCurrentCharacterId:()=>scope.characterKey,SillyTavern:{getContext:()=>context}},service=G.acquire({win,api});await service.guard.ready();
 const invoke=(...args)=>win.__TAURI__.core.invoke(...args);
 async function load({afterInstall=()=>{}}={}){context.chat.length=0;context.chatMetadata={};const path=await invoke('get_chat_payload_path',{characterName:'test',fileName:'old'}),rid=await invoke('plugin:fs|open',{path,options:{read:true}}),stat=await invoke('plugin:fs|fstat',{rid}),data=await invoke('plugin:fs|read',{rid,len:stat.size});await invoke('plugin:resources|close',{rid});const rows=new TextDecoder().decode(data.subarray(0,stat.size)).split('\n').map(JSON.parse);context.chatMetadata=rows[0].chat_metadata;context.chat.push(...rows.slice(1));await afterInstall(context);await service.reset({reuseScope:true});}
 return{win,service,context,scope,target,invoke,load,get disk(){return disk;},set disk(v){disk=v;},set storyId(v){character.chat=v;},get writes(){return writes;},get pending(){return !!pending;},releaseRead:()=>pending?.(),set mode(v){mode=v;},get coldTools(){return coldTools;},set coldTools(v){coldTools=v;},get staged(){return staged;},bytes};
}
test('TT complete and metadata commits cannot publish during a delayed native load; EOF still completes normally',async()=>{
 const f=await nativeFixture();try{const before=copy(f.disk),b=f.bytes();await f.invoke('begin_chat_commit',{target:f.target});await f.invoke('append_chat_commit_chunk',b,{headers:{'session-id':'staged',offset:'0'}});f.mode='hold';
  const nav=f.service.navigate({target:f.scope,work:f.load});while(!f.pending)await delay(2);
  await assert.rejects(f.invoke('finish_chat_commit',{sessionId:'staged',expectedSize:b.length}),{code:'chat-load-pending'});assert.equal(f.staged,null);
  await assert.rejects(f.invoke('commit_chat_metadata',{target:f.target,chatMetadata:{}}),{code:'chat-load-pending'});assert.equal(f.writes,0);assert.deepEqual(f.disk,before);
  f.releaseRead();await nav;assert.deepEqual(f.context.chat,before.slice(1));await f.invoke('commit_chat_metadata',{target:f.target,chatMetadata:copy(f.context.chatMetadata)});assert.equal(f.writes,1);
 }finally{f.releaseRead();f.service.release();}
});
test('TT explicit and directly observed native read failures retain unsaved memory and every inactive branch',async()=>{
 for(const explicit of [true,false]){const f=await nativeFixture();try{f.context.chat[10].mes='unsaved native draft';f.context.chat[10].swipes[1]='unsaved alternate';const before=copy(f.context.chat),disk=copy(f.disk);f.mode='failure';await assert.rejects(explicit?f.service.navigate({target:f.scope,work:f.load}):f.load());await delay(0);assert.deepEqual(f.context.chat,before);assert.deepEqual(f.disk,disk);assert.equal(f.writes,0);}finally{f.service.release();}}
});

test('TT byte evidence alone does not exempt a changed parsed message from its fully hydrated live-state comparison',async()=>{
 const f=await nativeFixture();try{const before=copy(f.disk);await assert.rejects(f.load({afterInstall(c){c.chat[0].mes='different parsed content';}}),{code:'chat-save-conflict'});assert.equal(f.writes,0);assert.deepEqual(f.disk,before);}finally{f.service.release();}
});
test('TT first greeting can transfer from the owned new-chat barrier into its verified commit ticket',async()=>{
 const f=await nativeFixture();try{await f.service.navigate({allowNew:true,work:async()=>{
  f.storyId='new';f.disk=[];f.context.chat.splice(0,f.context.chat.length,{mes:'first greeting',swipes:['first greeting'],foreign:{keep:1}});f.context.chatMetadata={integrity:'new'};
  const rows=[{chat_metadata:f.context.chatMetadata},...f.context.chat],bytes=new TextEncoder().encode(rows.map(JSON.stringify).join('\n')),begin=await f.invoke('begin_chat_commit',{target:{...f.target,fileName:'new'}});
  await f.invoke('append_chat_commit_chunk',bytes,{headers:{'session-id':begin.sessionId,offset:'0'}});await f.invoke('finish_chat_commit',{sessionId:begin.sessionId,expectedSize:bytes.length});
 }});assert.equal(f.writes,1);assert.equal(f.disk.length,2);assert.deepEqual(f.disk[1],f.context.chat[0]);assert.equal(f.service.status().phase,'save-confirmed');}finally{f.service.release();}
});
test('TT clearChat closes a cold source only after rollback snapshots contain its inactive branches',async()=>{
 for(const explicit of [true,false]){
  let closed=false,closeTask=null,reads=0;const f=await nativeFixture({beforeNative:(command,args)=>{if(command==='plugin:resources|close'&&args.rid===42)closed=true;}});
  try{
   const saved=copy(f.disk[1]),message=f.context.chat[0];message.tt_swipe_cold={sourceId:42,record:1};message.swipes[1]=null;message.swipe_info[1]=null;message.mes='unsaved current branch';message.swipes.push('unsaved new branch');message.swipe_info.push({new:true});
   // Host hydrateMessageSwipes semantics: only unloaded slots are filled;
   // live values, appended branches and unknown fields remain authoritative.
   f.coldTools={async readColdSwipeRecord(){assert.equal(closed,false,'host source was closed before branch recovery');reads++;message.swipes[2]='different live branch';message.swipe_info[2]={live:true};message.extra.live=true;await delay(2);return copy(saved);},async hydrateMessageSwipes(m){if(!m?.tt_swipe_cold)return;assert.equal(closed,false,'host source was closed before branch recovery');for(const key of ['swipes','swipe_info']){if(m[key].length<saved[key].length)throw Error('Cold swipe array shortened');for(let i=0;i<saved[key].length;i++)m[key][i]??=copy(saved[key][i]);}delete m.tt_swipe_cold;}};
   f.mode='failure';const work=()=>{closeTask=f.invoke('plugin:resources|close',{rid:42});return f.load();};
   await assert.rejects(explicit?f.service.navigate({target:f.scope,work}):work());await closeTask;for(let i=0;i<100&&f.context.chat.length!==500;i++)await delay(2);
   const restored=f.context.chat[0];assert.equal(closed,true);assert.equal(reads,1);assert.equal(restored.tt_swipe_cold,undefined);assert.equal(restored.swipes[1],saved.swipes[1]);assert.deepEqual(restored.swipe_info[1],saved.swipe_info[1]);assert.equal(restored.mes,'unsaved current branch');assert.equal(restored.swipes[2],'unsaved new branch');assert.deepEqual(restored.swipe_info[2],{new:true});assert.equal(restored.extra.live,undefined);assert.equal(message.swipes[2],'different live branch');assert.deepEqual(message.swipe_info[2],{live:true});assert.equal(message.extra.live,true);message.swipe_info[1].foreign.keep=99;assert.equal(restored.swipe_info[1].foreign.keep,0);assert.deepEqual(f.disk,original());assert.equal(f.writes,0);
   await f.coldTools?.hydrateMessageSwipes?.(restored);await f.service.guard.ready();await f.invoke('commit_chat_metadata',{target:f.target,chatMetadata:copy(f.context.chatMetadata)});assert.equal(f.writes,1);
  }finally{await closeTask?.catch(()=>{});f.service.release();}
 }
});
test('rapid ST and TT reloads cannot replace a newly installed 500-floor chat with an older one-floor checkpoint',{timeout:10000},async()=>{
 for(const native of [false,true])for(const scenario of ['success','next-read-fails','old-verification-fails','explicit',...(!native?['other-story']:[])]){
  let count=0,resume,failRead,held=false;const options={initialRows:original().slice(0,2),beforeExport:async()=>{if(++count===(native?3:4)){held=true;await new Promise((resolve,reject)=>{resume=resolve;failRead=reject;});}}},f=native?await nativeFixture(options):await fixture(options);
  try{
   if(native)f.disk=original();else f.disk.set('old',original());
   const first=(native?f.load():f.open('old',{swallow:true})).then(()=>null,e=>e);
   while(!held)await delay(2);assert.equal(f.context.chat.length,500);assert.equal(f.service.status().phase,'load-start');
   if(scenario==='next-read-fails')f.mode=native?'failure':'network';
   const second=(scenario==='explicit'?f.service.navigate({target:native?f.scope:f.scope(),work:()=>assert.fail('overlapping explicit navigation must not clear live rows')}):native?f.load():f.open(scenario==='other-story'?'other':'old',{swallow:true})).then(()=>null,e=>e);
   await delay(5);if(scenario==='explicit')assert.equal(f.context.chat.length,500);else assert.equal(f.context.chat.length,0,`${native?'TT':'ST'} ${scenario} before release`);
   if(scenario==='old-verification-fails')failRead(TypeError('verification temporarily offline'));else resume();
   const results=await Promise.all([first,second]);if(scenario==='explicit')assert.equal(results[1]?.code,'chat-load-pending');
   await f.service.guard.ready();assert.deepEqual(f.context.chat,original().slice(1),`${native?'TT':'ST'} ${scenario}`);assert.deepEqual(native?f.disk:f.disk.get('old'),original());assert.equal(native?f.writes:f.writes.length,0);assert.equal(f.service.status().phase,'load-ready');
   if(native)await f.invoke('commit_chat_metadata',{target:f.target,chatMetadata:copy(f.context.chatMetadata)});else await f.context.saveChat();assert.equal(native?f.writes:f.writes.length,1);
  }finally{resume?.();f.service.release();}
 }
});
