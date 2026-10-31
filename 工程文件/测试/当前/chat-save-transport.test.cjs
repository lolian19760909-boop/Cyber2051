'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),zlib=require('node:zlib');
const G=require(path.join(process.env.CXX_SAVE_SOURCE_ROOT||path.resolve(__dirname,'../../卡片源码'),'运行时/chat-save-guard.js'));
const copy=v=>JSON.parse(JSON.stringify(v)),initial=()=>[{chat_metadata:{integrity:'one'},legacyHeader:'keep'},{mes:'old',extra:{custom:1},swipes:['old','unused'],swipe_info:[{},{}]}];
function mutex(){let tail=Promise.resolve();return {request(_key,_opts,fn){const p=tail.catch(()=>{}).then(fn);tail=p;return p;}};}
function nativeFixture(){
 let disk=initial(),id=0,commits=0;const stages=new Map(),locks=mutex();
 function window({beforeWrite=null}={}){
  let live=copy(disk),scope={characterKey:'Card.with spaces.png',chatId:'story'},normalize=async r=>r;
  const guard=G.create({scope:()=>scope,snapshot:()=>({metadata:live[0].chat_metadata,messages:live.slice(1)}),read:async()=>copy(disk),locks});
  const original=Object.freeze({extra:'preserved',async invoke(command,args,options){
   if(command==='begin_chat_commit'){const sessionId=String(++id);stages.set(sessionId,[]);return {sessionId,maxFrameBytes:32};}
   if(command==='append_chat_commit_chunk'){const h=new Headers(options.headers),frames=stages.get(h.get('session-id'));if(!frames)throw Error('missing session');frames.push(h.get('chunk-encoding')==='base64'?Buffer.from(args.data,'base64'):Buffer.from(args));return Buffer.concat(frames).length;}
   if(command==='finish_chat_commit'){const frames=stages.get(args.sessionId);if(!frames)throw Error('missing session');disk=Buffer.concat(frames).toString().trim().split('\n').map(JSON.parse);stages.delete(args.sessionId);commits++;return {acceptedSize:args.expectedSize};}
   if(command==='abort_chat_commit'){stages.delete(args.sessionId);return;}
   if(command==='commit_chat_metadata'){disk[0].chat_metadata=copy(args.chatMetadata);commits++;return;}
   return {unchanged:command};
  }});
  const bridge={core:original},release=G.wrapNative({bridge,guard,scope:()=>scope,beforeWrite,normalizeRows:r=>normalize(r)});
  const target=()=>({kind:'character',characterId:scope.characterKey.replace(/\.png$/,''),fileName:scope.chatId});
  async function stage(android=false){
   const bytes=Buffer.from(live.map(JSON.stringify).join('\n')),begin=await bridge.core.invoke('begin_chat_commit',{target:target(),force:false});
   for(let i=0;i<bytes.length;i+=32){const chunk=bytes.subarray(i,i+32),headers={'session-id':begin.sessionId,offset:String(i),...(android?{'chunk-encoding':'base64'}:{})};await bridge.core.invoke('append_chat_commit_chunk',android?{data:chunk.toString('base64')}:chunk,{headers});}
   return {sessionId:begin.sessionId,expectedSize:bytes.length,commitReason:'mutation'};
  }
  return {guard,bridge,release,original,stage,target,get live(){return live;},set live(v){live=v;},setScope:v=>scope=v,setNormalize:fn=>normalize=fn,
   save:async(android=false)=>bridge.core.invoke('finish_chat_commit',await stage(android))};
 }
 return {window,stages,get disk(){return disk;},set disk(v){disk=v;},begins:()=>id,commits:()=>commits};
}
test('TT current-target begin and metadata requests cannot become off-target copies or cross a reload while awaiting beforeWrite',async()=>{
 for(const command of ['begin_chat_commit','commit_chat_metadata'])for(const transition of ['other','reload','ABA','release']){
  let resume,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>resume=r),f=nativeFixture(),a=f.window({beforeWrite:()=>{entered();return gate;}});await a.guard.reset();
  const pending=a.bridge.core.invoke(command,{target:a.target(),chatMetadata:{integrity:'one',stale:true}});await started;
  if(transition==='release')a.release();else{
   if(transition!=='reload'){a.setScope({characterKey:'Card.with spaces.png',chatId:'other'});await a.guard.reset();}
   if(transition!=='other'){a.setScope({characterKey:'Card.with spaces.png',chatId:'story'});f.disk[0].chat_metadata={integrity:'one',newLoad:true};a.live=copy(f.disk);await a.guard.reset();}
  }
  const before=copy(f.disk);resume();await assert.rejects(pending,{code:'context-changed'});assert.deepEqual(f.disk,before);assert.equal(f.begins(),0);assert.equal(f.commits(),0);assert.equal(f.stages.size,0);a.release();
 }
});
test('TT genuinely different-target copies stay available and do not wait on the current chat',async()=>{
 const f=nativeFixture(),a=f.window({beforeWrite:()=>assert.fail('copy must not enter current-chat wait')});await a.guard.reset();
 const target={...a.target(),fileName:'copied-story'},rows=initial(),bytes=Buffer.from(rows.map(JSON.stringify).join('\n'));
 const begin=await a.bridge.core.invoke('begin_chat_commit',{target});await a.bridge.core.invoke('append_chat_commit_chunk',bytes,{headers:{'session-id':begin.sessionId,offset:'0'}});
 await a.bridge.core.invoke('finish_chat_commit',{sessionId:begin.sessionId,expectedSize:bytes.length});assert.equal(f.begins(),1);assert.equal(f.commits(),1);a.release();
});
test('TT awaiting a same-ticket save snapshots request metadata and target before caller mutation',async()=>{
 let resume,entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>resume=r),f=nativeFixture(),a=f.window({beforeWrite:()=>{entered();return gate;}});await a.guard.reset();
 const args={target:a.target(),chatMetadata:{integrity:'one',expected:true}},pending=a.bridge.core.invoke('commit_chat_metadata',args);await started;args.target.fileName='other';args.chatMetadata.expected=false;resume();await pending;
 assert.deepEqual(f.disk[0].chat_metadata,{integrity:'one',expected:true});assert.equal(f.commits(),1);a.release();
});
test('TT actual frozen core shape supports finish, metadata, Android frames and cleanup',async()=>{
 const f=nativeFixture(),a=f.window();assert.notEqual(a.bridge.core,a.original);assert.equal(a.bridge.core.extra,'preserved');await a.guard.reset();
 a.live[1].mes='中文😀';await a.save(true);assert.equal(f.disk[1].mes,'中文😀');
 const m={integrity:'one',tag:'metadata'};a.live[0].chat_metadata=m;await a.bridge.core.invoke('commit_chat_metadata',{target:a.target(),chatMetadata:m});
 assert.equal(f.disk[0].legacyHeader,'keep');assert.deepEqual(f.disk[0].chat_metadata,m);
 a.live[1].mes='next automatic save';await a.save();assert.equal(f.commits(),3);
 assert.deepEqual(await a.bridge.core.invoke('other-command',{}),{unchanged:'other-command'});
 a.release();assert.equal(a.bridge.core,a.original);assert.equal(f.stages.size,0);
});
test('TT old window full and metadata submissions are rejected before publishing',async()=>{
 const f=nativeFixture(),a=f.window(),b=f.window();await Promise.all([a.guard.reset(),b.guard.reset()]);
 a.live[1].mes='unsaved old';const staged=await a.stage();b.live[1].mes='new';await b.save();
 await assert.rejects(a.bridge.core.invoke('finish_chat_commit',staged),{code:'chat-save-conflict'});assert.equal(f.stages.size,0);
 await assert.rejects(a.bridge.core.invoke('commit_chat_metadata',{target:a.target(),chatMetadata:{integrity:'one',old:true}}),{code:'chat-save-conflict'});
 assert.equal(f.disk[1].mes,'new');assert.equal(f.commits(),1);
});
test('TT cold hydration delay and A B A reload cannot publish an old staged commit',async()=>{
 const f=nativeFixture(),a=f.window();await a.guard.reset();a.live[1].mes='stale';const staged=await a.stage();
 let continueHydration;a.setNormalize(rows=>new Promise(resolve=>continueHydration=()=>resolve(rows)));
 const finish=a.bridge.core.invoke('finish_chat_commit',staged);await Promise.resolve();
 a.setScope({characterKey:'Card.with spaces.png',chatId:'other'});a.guard.reset().catch(()=>{});
 a.setScope({characterKey:'Card.with spaces.png',chatId:'story'});a.live=copy(f.disk);await a.guard.reset();
 continueHydration();await assert.rejects(finish,{code:'context-changed'});assert.equal(f.commits(),0);assert.equal(f.stages.size,0);
});
test('TT release aborts staged sessions and preserves another wrapper owner',async()=>{
 const f=nativeFixture(),a=f.window();await a.guard.reset();await a.stage();const later={...a.bridge.core};a.bridge.core=later;
 a.release();await Promise.resolve();assert.equal(f.stages.size,0);assert.equal(a.bridge.core,later);
});
test('TT release during begin aborts its late session instead of returning it to unwrapped transport',async()=>{
 let finish,aborted;
 const scope={characterKey:'c.png',chatId:'x'},guard=G.create({scope:()=>scope,snapshot:()=>({metadata:{},messages:[]}),read:async()=>[{chat_metadata:{}}]});
 await guard.reset();
 const original=Object.freeze({invoke:async(command,args)=>command==='begin_chat_commit'?new Promise(r=>finish=r):aborted=args.sessionId});
 const bridge={core:original},release=G.wrapNative({bridge,guard,scope:()=>scope});
 const p=bridge.core.invoke('begin_chat_commit',{target:{kind:'character',characterId:'c',fileName:'x'}});
 release();finish({sessionId:'late'});await assert.rejects(p,{code:'context-changed'});assert.equal(aborted,'late');assert.equal(bridge.core,original);
});
test('TT first save of a new chat before CHAT_CHANGED initializes its own load scope',async()=>{
 const f=nativeFixture(),a=f.window();await a.guard.reset();a.setScope({characterKey:'Card.with spaces.png',chatId:'new'});f.disk=[];
 a.live=initial();await a.save();assert.equal(f.commits(),1);
});
async function httpFixture({loaded=()=>{},native=false}={}){
 let disk=initial(),writes=0;const live=copy(disk),locks=mutex();loaded(live);
 async function fetcher(input,init){
  const req=new Request(typeof input?.clone==='function'?input.clone():new URL(String(input),'https://host.test'),init);let bytes=Buffer.from(await req.arrayBuffer());
  if(req.headers.get('content-encoding')==='gzip')bytes=zlib.gunzipSync(bytes);
  const payload=JSON.parse(bytes.toString());
  if(new URL(req.url).pathname==='/api/chats/export')return Response.json({result:disk.map(JSON.stringify).join('\n')});
  if(new URL(req.url).pathname==='/api/chats/save'){disk=copy(payload.chat);writes++;return Response.json({});}
  return Response.json([]);
 }
 const win={fetch:fetcher,document:{},location:new URL('https://host.test/'),navigator:{locks},Request,Response,Blob,TextDecoder,DecompressionStream,URL};
 if(native)win.__TAURI_INTERNALS__={};
 const ctx={chat:live.slice(1),chatMetadata:live[0].chat_metadata,getCurrentChatId:()=> 'story',getRequestHeaders:()=>({'Content-Type':'application/json'})};
 const api={getCurrentCharacterId:()=> 'card.png',SillyTavern:{getContext:()=>ctx}},service=G.acquire({win,api});await service.guard.ready();
 return {win,live,ctx,service,get disk(){return disk;},set disk(v){disk=v;},writes:()=>writes,fetcher};
}
test('ST save decoding cannot adopt a newer load ticket after same-chat reload or A B A navigation',async()=>{
 for(const transition of ['reload','ABA']){
  const f=await httpFixture();let entered,resume,id='story';f.ctx.getCurrentChatId=()=>id;const started=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);
  f.win.Request=class extends Request{async arrayBuffer(){entered();await gate;return super.arrayBuffer();}};
  const pending=f.win.fetch('https://host.test/api/chats/save',{method:'POST',body:JSON.stringify({avatar_url:'card.png',file_name:'story',chat:f.live})});await started;
  if(transition==='ABA'){id='other';await f.service.reset();id='story';}
  f.disk[0].chat_metadata.newLoad=true;f.ctx.chatMetadata=copy(f.disk[0].chat_metadata);await f.service.reset();const before=copy(f.disk);resume();await assert.rejects(pending,{code:'context-changed'});assert.equal(f.writes(),0);assert.deepEqual(f.disk,before);f.service.release();
 }
});
test('ST gzip Request and Headers preserve transport and get the same guard',async()=>{
 const f=await httpFixture();f.live[1].mes='large gzip';
 const payload={avatar_url:'card.png',file_name:'story',chat:f.live},request=new Request('https://host.test/api/chats/save',{method:'POST',headers:new Headers({'Content-Type':'application/json','Content-Encoding':'gzip'}),body:zlib.gzipSync(JSON.stringify(payload))});
 await f.service.run({characterKey:'card.png',chatId:'story'},()=>f.win.fetch(request));
 assert.equal(f.disk[1].mes,'large gzip');assert.equal(f.writes(),1);assert.equal(request.bodyUsed,false);
 f.disk[1].extra.custom=99;await assert.rejects(f.win.fetch(request),{code:'chat-save-conflict'});assert.equal(f.writes(),1);
 f.service.release();assert.equal(f.win.fetch,f.fetcher);
});

test('first opening with Prompt Template empty variables and render flags can save',async()=>{
 const f=await httpFixture({loaded:rows=>Object.assign(rows[1],{variables:[{}],variables_initialized:[],is_ejs_processed:[true]})});
 f.live[1].variables[0]={stat_data:{money:42},unknown:'keep'};
 const payload={avatar_url:'card.png',file_name:'story',chat:f.live};
 await f.win.fetch('https://host.test/api/chats/save',{method:'POST',body:JSON.stringify(payload)});
 assert.deepEqual(f.disk,f.live);assert.equal(f.writes(),1);f.service.release();
});
test('template defaults do not hide subsequent external writes or remove fields from saves',async()=>{
 const f=await httpFixture({loaded:rows=>Object.assign(rows[1],{variables:[{}],variables_initialized:[],is_ejs_processed:[true]})});
 f.disk[1].is_ejs_processed=[false];
 const before=copy(f.disk);
 await assert.rejects(f.win.fetch('https://host.test/api/chats/save',{method:'POST',body:JSON.stringify({avatar_url:'card.png',file_name:'story',chat:f.live})}),{code:'chat-save-conflict'});
 assert.deepEqual(f.disk,before);assert.equal(f.writes(),0);f.service.release();
});
test('TT first opening receives the same author-note defaults as ST',async()=>{
 const f=await httpFixture({native:true,loaded:rows=>{G.normalizeAuthorNote(rows[0].chat_metadata);Object.assign(rows[1],{variables:[{}],variables_initialized:[],is_ejs_processed:[true]});}});
 assert.equal(f.service.status().error,null);assert.equal(f.writes(),0);
 let commits=0;
 const bridge={core:Object.freeze({invoke:async(command,args)=>{assert.equal(command,'commit_chat_metadata');const rows=copy(f.disk);rows[0].chat_metadata=copy(args.chatMetadata);f.disk=rows;commits++;}})};
 const release=G.wrapNative({bridge,guard:f.service.guard,scope:()=>({characterKey:'card.png',chatId:'story'})});
 f.ctx.chatMetadata.opening='saved';
 await bridge.core.invoke('commit_chat_metadata',{target:{kind:'character',characterId:'card',fileName:'story'},chatMetadata:f.ctx.chatMetadata});
 assert.deepEqual(f.disk[0].chat_metadata,f.ctx.chatMetadata);assert.equal(f.disk[0].legacyHeader,'keep');assert.equal(commits,1);
 release();f.service.release();
});
test('template compatibility keeps nonempty variables, unknown fields and branch data in initial comparison',async()=>{
 for(const patch of [{variables:[{money:42}]},{variables_initialized:[true]},{is_ejs_processed:['unknown']},{unknown:1},{swipes:['changed','unused']}])
  await assert.rejects(httpFixture({loaded:rows=>Object.assign(rows[1],patch)}),{code:'chat-save-conflict'});
});

async function slowHost({direct=false}={}){
 let disk=initial(),saving=false,skip=0,writes=0,hold,started;const began=new Promise(r=>started=r),gate=new Promise(r=>hold=r),live=copy(disk),locks=mutex();
 const win={document:{},location:new URL('https://host.test/'),navigator:{locks},Request,Response,Blob,TextDecoder,DecompressionStream,URL,setTimeout,clearTimeout};
 win.fetch=async(input,init)=>{const req=new Request(new URL(String(input),'https://host.test'),init),p=await req.json();if(req.url.endsWith('/export'))return Response.json({result:disk.map(JSON.stringify).join('\n')});if(req.url.endsWith('/save')){writes++;if(writes===1){started();await gate;}disk=copy(p.chat);return Response.json({ok:true});}return Response.json([]);};
 const ctx={chat:live.slice(1),chatMetadata:live[0].chat_metadata,getCurrentChatId:()=> 'story',getRequestHeaders:()=>({'Content-Type':'application/json'}),async saveChat(){if(ctx.forbidConditional)throw Error('conditional repair must not poll');if(saving){skip++;return;}saving=true;try{await win.fetch('/api/chats/save',{method:'POST',headers:ctx.getRequestHeaders(),body:JSON.stringify({avatar_url:'card.png',file_name:'story',chat:[{...live[0],chat_metadata:ctx.chatMetadata},...ctx.chat]})});}finally{saving=false;}}};
 const native={saveChatConditional:ctx.saveChat,get isChatSaving(){return saving;},...(direct?{saveChat:async()=>win.fetch('/api/chats/save',{method:'POST',headers:ctx.getRequestHeaders(),body:JSON.stringify({avatar_url:'card.png',file_name:'story',chat:[{...live[0],chat_metadata:ctx.chatMetadata},...ctx.chat]})})}:{})},api={getCurrentCharacterId:()=> 'card.png',SillyTavern:{getContext:()=>ctx}},service=G.acquire({win,api,loadHostState:async()=>native});await service.guard.ready();
 return {ctx,service,began,hold,get disk(){return disk;},get skip(){return skip;},get writes(){return writes;}};
}
const until=async fn=>{const end=Date.now()+4000;while(!fn()){if(Date.now()>end)throw Error('save drain did not finish');await new Promise(r=>setTimeout(r,20));}};
test('native skipped save is reconciled from latest memory including all swipes and unknown fields',async()=>{const f=await slowHost();try{f.ctx.chat[0].mes='first';const first=f.ctx.saveChat();await f.began;f.ctx.chat[0].mes='latest';f.ctx.chat[0].swipes[1]='latest unused branch';f.ctx.chat[0].foreign={keep:7};await f.ctx.saveChat();assert.equal(f.skip,1);f.hold();await first;await until(()=>f.disk[1].mes==='latest');assert.equal(f.disk[1].swipes[1],'latest unused branch');assert.deepEqual(f.disk[1].foreign,{keep:7});await new Promise(r=>setTimeout(r,350));assert.equal(f.writes,2);}finally{f.hold();f.service.release();}});
test('card save waits through active native write and does not hit the host skip path',async()=>{const f=await slowHost();try{f.ctx.chat[0].mes='first';const first=f.ctx.saveChat();await f.began;let ran=false;const second=f.service.run({characterKey:'card.png',chatId:'story'},async()=>{ran=true;f.ctx.chat[0].mes='card final';await f.ctx.saveChat();});await new Promise(r=>setTimeout(r,30));assert.equal(ran,false);f.hold();await Promise.all([first,second]);assert.equal(f.skip,0);assert.equal(f.disk[1].mes,'card final');}finally{f.hold();f.service.release();}});
test('save reconciliation stops after release',async()=>{const f=await slowHost();f.ctx.chat[0].mes='first';const first=f.ctx.saveChat();await f.began;f.hold();await first;f.ctx.chat[0].mes='unsaved';f.service.release();await new Promise(r=>setTimeout(r,350));assert.equal(f.writes,1);assert.equal(f.disk[1].mes,'first');});

test('save drain rejects a newer external disk revision without replaying local memory',async()=>{const f=await slowHost();try{f.ctx.chat[0].mes='first';const first=f.ctx.saveChat();await f.began;f.hold();await first;f.ctx.chat[0].mes='old window edit';f.disk[1].mes='new external edit';await new Promise(r=>setTimeout(r,600));assert.equal(f.disk[1].mes,'new external edit');assert.equal(f.writes,1);assert.equal(f.service.status().error,'chat-save-conflict');}finally{f.service.release();}});

test('native repair uses the public direct saver while preserving guarded readback and all branches',async()=>{const f=await slowHost({direct:true});try{f.ctx.chat[0].mes='first';const first=f.ctx.saveChat();await f.began;f.ctx.chat[0].mes='latest';f.ctx.chat[0].swipes[1]='branch preserved';f.ctx.chat[0].foreign={keep:1};f.hold();await first;f.ctx.forbidConditional=true;await until(()=>f.disk[1].mes==='latest');assert.equal(f.disk[1].swipes[1],'branch preserved');assert.deepEqual(f.disk[1].foreign,{keep:1});assert.equal(f.service.status().error,null);await new Promise(r=>setTimeout(r,350));assert.equal(f.writes,2);}finally{f.hold();f.service.release();}});

function nativeReadFixture(mode='normal'){
 const disk=initial();disk[1].mes='中文🙂'.repeat(60000);disk[1].swipes[0]=disk[1].mes;
 const bytes=Buffer.from('\uFEFF'+disk.map(JSON.stringify).join('\n')),calls=[],resources=new Set();let offset=0,http=0,unblock;
 const invoke=async(command,args)=>{calls.push({command,args});
  if(command==='get_chat_payload_path'){
   if(mode==='old-api')throw Error('Command get_chat_payload_path not found');
   if(mode==='path-failed')throw Error('get_chat_payload_path: file not found due to storage failure');
   return '/owned/story.jsonl';
  }
  if(command==='plugin:fs|open'){
   if(mode==='open-failed')throw Error('open failed');
   if(mode==='bad-rid')return -1;
   if(mode==='late-open')await new Promise(r=>unblock=r);
   resources.add(17);return 17;
  }
  if(command==='plugin:fs|fstat'){if(mode==='stat-failed')throw Error('stat failed');return{size:bytes.length};}
  if(command==='plugin:fs|read'){
   if(mode==='read-failed')throw Error('read failed');
   if(mode==='late-read')await new Promise(r=>unblock=r);
   if(mode==='short-footer')return new Uint8Array(4);
   const count=Math.min(args.len,bytes.length-offset),out=new Uint8Array(count+8);out.set(bytes.subarray(offset,offset+count));offset+=count;
   new DataView(out.buffer).setBigUint64(count,BigInt(mode==='truncated'?0:mode==='bad-count'?count+1:count));
   if(mode==='bad-utf8')out[0]=255;
   return out;
  }
  if(command==='plugin:resources|close'){assert.equal(resources.delete(args.rid),true,'resource must close exactly once');return;}
  throw Error('unexpected command '+command);
 };
 const win={__TAURI_INTERNALS__:{},__TAURI__:{core:Object.freeze({invoke})},document:{},location:new URL('https://host.test/'),Request,Response,Blob,TextDecoder,DecompressionStream,URL,navigator:{locks:mutex()},setTimeout:(fn,ms)=>setTimeout(fn,ms===15000&&mode.startsWith('late-')?15:ms),clearTimeout,fetch:async()=>{http++;return Response.json({result:disk.map(JSON.stringify).join('\n')});}};
 const ctx={chat:copy(disk.slice(1)),chatMetadata:copy(disk[0].chat_metadata),getCurrentChatId:()=> 'story',getRequestHeaders:()=>({'Content-Type':'application/json'})};
 const service=G.acquire({win,api:{getCurrentCharacterId:()=> 'card.png',SillyTavern:{getContext:()=>ctx}}});
 return{service,ctx,disk,bytes,calls,resources,get http(){return http;},unblock:()=>unblock?.()};
}
test('TT internal readback uses isolated raw resources and preserves multi-frame UTF-8, header and every branch',async()=>{
 const f=nativeReadFixture();try{await f.service.guard.ready();assert.equal(f.http,0);assert.equal(f.calls.filter(x=>x.command==='plugin:fs|read').length,Math.ceil(f.bytes.length/262144));assert.equal(f.calls.filter(x=>x.command==='plugin:resources|close').length,1);assert.equal(f.resources.size,0);assert.deepEqual(f.ctx.chat,f.disk.slice(1));assert.equal(f.service.status().phase,'load-ready');}finally{f.service.release();}
});
test('TT incomplete internal reads fail without writes and close only successfully opened resources',async()=>{
 for(const mode of ['path-failed','open-failed','bad-rid','stat-failed','read-failed','short-footer','truncated','bad-count','bad-utf8','late-open','late-read']){
  const f=nativeReadFixture(mode);try{await assert.rejects(f.service.guard.ready());f.unblock();await new Promise(r=>setTimeout(r,5));assert.equal(f.http,0,mode+' must not silently switch transports');assert.equal(f.resources.size,0,mode);assert.deepEqual(f.ctx.chat,f.disk.slice(1),mode);assert.equal(f.calls.filter(x=>x.command==='plugin:resources|close').length,['path-failed','open-failed','bad-rid'].includes(mode)?0:1,mode);}finally{f.unblock();f.service.release();}
 }
});
test('TT missing payload-path capability keeps its existing HTTP readback and does not claim a native resource',async()=>{
 const f=nativeReadFixture('old-api');try{await f.service.guard.ready();assert.equal(f.http,1);assert.equal(f.resources.size,0);assert.equal(f.calls.some(x=>x.command==='plugin:fs|open'),false);assert.equal(f.service.status().phase,'load-ready');}finally{f.service.release();}
});

test('native reload clears memory before /api/chats/get and never overwrites the file with a header-only chat',async()=>{
 const f=await slowHost();
 try{
  f.ctx.chat[0].mes='first';const first=f.ctx.saveChat();await f.began;f.hold();await first;assert.equal(f.writes,1);
  const before=copy(f.disk);
  f.ctx.chat.length=0;                       // ST clearChat({clearData:true}) at the start of a reload
  await assert.rejects(f.ctx.saveChat(),{code:'chat-save-loading'});
  assert.deepEqual(f.disk,before);
  assert.equal(f.writes,1);
 }finally{f.hold();f.service.release();}
});
