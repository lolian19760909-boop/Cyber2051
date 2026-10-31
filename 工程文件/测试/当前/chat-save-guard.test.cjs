'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const Guard=require(path.join(process.env.CXX_SAVE_SOURCE_ROOT||path.resolve(__dirname,'../../卡片源码'),'运行时/chat-save-guard.js'));
const copy=v=>JSON.parse(JSON.stringify(v));
function fixture(normalize=async value=>value,locksOverride){
 let disk=[{chat_metadata:{integrity:'same',variables:{mvu:1}},unknown:'header'}, {mes:'initial',swipes:['initial','other'],swipe_info:[{date:'2026-01-01T00:00:00.000Z'},{extra:{unknown:2}}],extra:{unknown:3}}],writes=0,queue=Promise.resolve();
 const warnings=[],locks={request(_key,_opts,fn){const p=queue.catch(()=>{}).then(fn);queue=p;return p;}};
 function window(native=false){
  let live=copy(disk),current={characterKey:'card.png',chatId:'story'};
  const guard=Guard.create({scope:()=>current,snapshot:()=>({metadata:live[0].chat_metadata,messages:live.slice(1)}),read:async()=>copy(disk),locks:locksOverride===undefined?locks:locksOverride,native,normalize,notify:()=>{},warn:e=>warnings.push(e)});
  return {guard,get live(){return live;},set live(v){live=v;},scope:()=>current,setScope:v=>{current=v;},
   async save(){const rows=copy(live);return guard.commit(current,rows,async()=>{writes++;disk=rows;return {ok:true};});}};
 }
 return {window,get disk(){return disk;},set disk(v){disk=v;},writes:()=>writes,warnings};
}
test('a chat-loaded event reuses the ticket already claimed by a plugin save',async()=>{
 let release;const gate=new Promise(r=>release=r),f=fixture(async value=>{await gate;return value;}),a=f.window();
 const Host=require('../../卡片源码/运行时/host.js');
 const host=Host.create({api:{parent:{document:{},fetch(){}},SillyTavern:{getContext:()=>({})}},core:{canonical:JSON.stringify},fetch(){},chatSaveGuard:{acquire:()=>({guard:a.guard,reset:({reuseScope=false}={})=>reuseScope?a.guard.ready():a.guard.reset()})}});
 const writing=a.save(),loaded=host.resetChatSaveGuard({reuseScope:true});release();
 await Promise.all([writing,loaded]);assert.equal(f.writes(),1);assert.equal(a.guard.status().epoch,1);assert.equal(a.guard.status().error,null);
 // An explicit reload of this same chat must still reject stale loaded data.
 f.disk[1].mes='external';await assert.rejects(host.resetChatSaveGuard(),{code:'chat-save-conflict'});
});
test('B1 two loaded windows: stale full/metadata/alternate changes cannot overwrite',async()=>{
 for(const change of [r=>r[1].mes='external',r=>r[0].chat_metadata.variables.mvu++,r=>r[1].swipe_info[1].extra.unknown++]){
  const f=fixture(),a=f.window(),b=f.window();await Promise.all([a.guard.reset(),b.guard.reset()]);
  change(b.live);await b.save();const expected=copy(f.disk);a.live[1].mes='unsaved in old window';
  await assert.rejects(a.guard.run(a.scope(),()=>a.save()),{code:'chat-save-conflict'});
  assert.deepEqual(f.disk,expected);assert.equal(a.live[1].mes,'unsaved in old window');assert.equal(f.writes(),1);
 }
});
test('B1 shared lock rechecks competing writes after the lock is acquired',async()=>{
 const f=fixture(),a=f.window(),b=f.window();await Promise.all([a.guard.reset(),b.guard.reset()]);
 a.live[1].mes='a';b.live[1].mes='b';const results=await Promise.allSettled([a.save(),b.save()]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.writes(),1);
});
test('B1 first disk read cannot legitimize an already stale window',async()=>{
 const f=fixture(),a=f.window();f.disk[1].mes='written before script starts';
 await assert.rejects(a.guard.reset(),{code:'chat-save-conflict'});await assert.rejects(a.save(),{code:'chat-save-conflict'});assert.equal(f.writes(),0);
});
test('card-owned additive load initialization is writable but persisted variable edits and foreign additions are conflicts',async()=>{
 const f=fixture(),a=f.window();a.live[0].chat_metadata.variables.__cxx_gal_mode={schemaVersion:1,enabled:true};await a.guard.reset();await a.save();assert(f.disk[0].chat_metadata.variables.__cxx_gal_mode.enabled);
 for(const change of [v=>v.mvu=2,v=>delete v.mvu,v=>v.foreign=1]){const f=fixture(),a=f.window();change(a.live[0].chat_metadata.variables);await assert.rejects(a.guard.reset(),{code:'chat-save-conflict'});assert.equal(f.writes(),0);}
 const empty=fixture(),b=empty.window();delete empty.disk[0].chat_metadata.variables;b.live=copy(empty.disk);b.live[0].chat_metadata.variables={};await b.guard.reset();await b.save();
});
test('transient load failures share a bounded retry with the original loaded snapshot, never washing a real conflict',async()=>{
 let clock=0,reads=0,fail=true;const scope={characterKey:'c',chatId:'x'},disk=[{chat_metadata:{}},{mes:'original'}],live=copy(disk);
 const g=Guard.create({scope:()=>scope,snapshot:()=>({metadata:live[0].chat_metadata,messages:live.slice(1)}),read:async()=>{reads++;if(fail)throw Object.assign(Error('offline'),{code:'chat-save-read'});return copy(disk);},now:()=>clock,locks:{request:async(_k,_o,fn)=>fn()}});
 await assert.rejects(g.reset());fail=false;live[1].mes='unsaved draft';await assert.rejects(g.ready());assert.equal(reads,1);clock=1001;await Promise.all([g.ready(),g.ready()]);assert.equal(reads,2);assert.equal(live[1].mes,'unsaved draft');assert.equal(g.status().error,null);
 disk[1].mes='external';const check=await g.retry();assert.equal(check.code,'chat-save-conflict');assert.equal(live[1].mes,'unsaved draft');
});
test('B1 one window can save consecutive unsaved edits and recognizes Date/ISO',async()=>{
 const f=fixture(),a=f.window();a.live[1].swipe_info[0].date=new Date('2026-01-01T00:00:00.000Z');await a.guard.reset();
 for(let i=0;i<3;i++){a.live[1].mes=String(i);await a.guard.run(a.scope(),()=>a.save());}
 assert.equal(f.writes(),3);
});

test('initial mismatch and later disk edits expose distinct, text-free field evidence',async()=>{
 const f=fixture(),a=f.window();f.disk[1].mes='private changed content';
 const initial=await a.guard.reset().then(()=>null,e=>e);
 assert.equal(initial.details.phase,'load');assert.equal(initial.details.differences[0].path,'/messages/0/mes');
 assert.equal(initial.details.differences[0].left.sha256.length,64);assert(!JSON.stringify(initial.details).includes('private changed content'));
 assert.equal((await a.guard.inspect()).kind,'blocked');assert.equal(a.guard.status().error,'chat-save-conflict');
 const b=f.window();await b.guard.reset();f.disk[0].chat_metadata.variables.mvu=2;
 const changed=await b.guard.inspect();assert.equal(changed.details.phase,'changed');assert.equal(changed.details.differences[0].path,'/0/chat_metadata/variables/mvu');
 assert.equal(f.writes(),0);assert(!JSON.stringify(changed).includes('private changed content'));
});

test('a successful retry clears the previous error and records confirmed readback',async()=>{
 const f=fixture(),a=f.window();await a.guard.reset();
 await assert.rejects(a.guard.commit(a.scope(),a.live,async()=>({ok:false,status:503})),{code:'chat-save-http'});
 assert.equal(a.guard.status().error,'chat-save-http');await a.save();
 assert.equal(a.guard.status().error,null);assert.equal(a.guard.status().phase,'save-confirmed');
 assert(a.guard.status().timeline.some(x=>x.phase==='save-response'&&x.status===503));
 assert.equal((await a.guard.inspect()).kind,'ready');
});
test('B1 a read does not reset baseline; actual reload does',async()=>{
 const f=fixture(),a=f.window(),b=f.window();await Promise.all([a.guard.reset(),b.guard.reset()]);
 b.live[1].mes='b';await b.save();void f.disk;await assert.rejects(a.save(),{code:'chat-save-conflict'});
 a.live=copy(f.disk);await a.guard.reset();a.live[1].mes='a now';await a.save();assert.equal(f.disk[1].mes,'a now');
});
test('B1 swallowed host error still rejects the enclosing card operation',async()=>{
 const f=fixture(),a=f.window();await a.guard.reset();
 await assert.rejects(a.guard.run(a.scope(),async()=>{try{await a.guard.commit(a.scope(),a.live,async()=>({ok:false,status:500}));}catch{}}),{code:'chat-save-http'});
 assert.equal(f.writes(),0);
});
test('the same failed save reported by nested boundaries notifies once',async()=>{
 const expected={characterKey:'c',chatId:'x'},notices=[];
 const g=Guard.create({scope:()=>expected,snapshot:()=>({metadata:{},messages:[]}),read:async()=>[],notify:e=>notices.push(e),locks:{request:async(_k,_o,fn)=>fn()}});
 await g.reset();await assert.rejects(g.run(expected,()=>g.commit(expected,[],async()=>({ok:false,status:500}))),{code:'chat-save-http'});
 assert.equal(notices.length,1);await g.reset();assert.equal(g.status().error,null);
});
test('cancelled work from the prior chat does not report an error on the newly loaded chat',async()=>{
 let current={characterKey:'c',chatId:'old'};const notices=[];
 const g=Guard.create({scope:()=>current,snapshot:()=>({metadata:{},messages:[]}),read:async()=>[],notify:e=>notices.push(e)});
 await g.reset();const old={...current};current={...current,chatId:'new'};await g.reset();
 await assert.rejects(g.run(old,async()=>{}),{code:'context-changed'});
 assert.equal(notices.length,0);assert.equal(g.status().error,null);
});
test('B1 a late read does not initialize a different chat',async()=>{
 let finish;const scope={characterKey:'c',chatId:'old'},g=Guard.create({scope:()=>scope,snapshot:()=>({metadata:{},messages:[]}),read:()=>new Promise(r=>finish=r)});
 const p=g.reset();await Promise.resolve();scope.chatId='new';finish([{chat_metadata:{}}]);await assert.rejects(p,{code:'context-changed'});
});
test('B1 destroyed guard rejects queued writes',async()=>{
 const f=fixture(),a=f.window();await a.guard.reset();a.guard.destroy();await assert.rejects(a.save(),{code:'context-changed'});assert.equal(f.writes(),0);
});
test('B1 post-write read failure can confirm the same successful write on retry',async()=>{
 let disk=[{chat_metadata:{}},{mes:'old'}],failRead=false,calls=0;
 const scope={characterKey:'c',chatId:'x'},live=copy(disk),g=Guard.create({scope:()=>scope,snapshot:()=>({metadata:live[0].chat_metadata,messages:live.slice(1)}),read:async()=>{if(failRead){failRead=false;throw Error('read failed');}return copy(disk);},locks:{request:async(_k,_o,f)=>f()}});
 await g.reset();live[1].mes='new';
 const send=async()=>{calls++;disk=copy(live);failRead=true;return {ok:true};};
 await assert.rejects(g.commit(scope,live,send),/read failed/);
 await g.run(scope,async()=>{});assert.equal(calls,1);assert.equal(disk[1].mes,'new');
});
test('an overlapping check cannot erase the in-flight commit readback target',async()=>{
 let disk=[{chat_metadata:{}},{mes:'old'}],sent,finish;
 const started=new Promise(r=>sent=r),response=new Promise(r=>finish=r),scope={characterKey:'c',chatId:'x'};
 const g=Guard.create({scope:()=>scope,snapshot:()=>({metadata:{},messages:copy(disk.slice(1))}),read:async()=>copy(disk),locks:{request:async(_k,_o,fn)=>fn()}});
 await g.reset();const rows=[{chat_metadata:{}},{mes:'new',variables:[{unknown:42}]}];
 const writing=g.commit(scope,rows,async()=>{disk=copy(rows);sent();return response;});
 await started;await g.run(scope,async()=>{});finish({ok:true});
 await writing;assert.deepEqual(disk,rows);assert.equal(g.status().error,null);
});

test('confirmed card commit uses three full reads; work without commit still checks disk at exit',async()=>{
 let disk=[{chat_metadata:{}},{mes:'old'}],reads=0;
 const scope={characterKey:'c',chatId:'x'},live=copy(disk),g=Guard.create({scope:()=>scope,snapshot:()=>({metadata:{},messages:live.slice(1)}),read:async()=>{reads++;return copy(disk);},locks:{request:async(_k,_o,f)=>f()}});
 await g.reset();reads=0;live[1].mes='new';
 await g.run(scope,()=>g.commit(scope,live,async()=>{disk=copy(live);return {ok:true};}));
 assert.equal(reads,3);
 await assert.rejects(g.run(scope,async()=>{disk[1].mes='external';}),{code:'chat-save-conflict'});
});
test('one-pass canonical keeps JSON semantics for Dates, unknown fields and property order',()=>{
 const a={z:undefined,a:[undefined,NaN,new Date('2026-01-01')],nested:{b:2,a:1},toJSON(){return {a:this.a,nested:this.nested};}};
 const b={nested:{a:1,b:2},a:[null,null,'2026-01-01T00:00:00.000Z']};
 assert.equal(Guard.canonical(a),Guard.canonical(b));
 assert.notEqual(Guard.canonical({...b,unknown:1}),Guard.canonical(b));
});

test('ST initial load defaults do not create a false other-window conflict',async()=>{
 for(const settings of [{},{default:'custom default',defaultInterval:0,defaultPosition:2,defaultDepth:0,defaultRole:1}]){
  const normalize=async value=>{Guard.normalizeAuthorNote(value.metadata,settings);return value;},f=fixture(normalize),a=f.window();
  Guard.normalizeAuthorNote(a.live[0].chat_metadata,settings);
  const original=copy(f.disk);await a.guard.reset();assert.deepEqual(f.disk,original);
  a.live[1].mes='created story';await a.guard.run(a.scope(),()=>a.save());assert.equal(f.writes(),1);assert.deepEqual(f.disk,a.live);
 }
});

test('ST loaded defaults preserve explicit author notes and reject stale values',async()=>{
 const normalize=async value=>{Guard.normalizeAuthorNote(value.metadata,{default:'default'});return value;};
 for(const [key,value]of Object.entries({note_prompt:'edited',note_interval:7,note_position:2,note_depth:8,note_role:1,unknown:'external'})){
  const f=fixture(normalize),a=f.window();Guard.normalizeAuthorNote(a.live[0].chat_metadata,{default:'default'});f.disk[0].chat_metadata[key]=value;
  await assert.rejects(a.guard.reset(),{code:'chat-save-conflict'});assert.equal(f.writes(),0);
 }
 const explicit={note_prompt:'',note_interval:0,note_position:0,note_depth:0,note_role:0};
 assert.deepEqual(Guard.normalizeAuthorNote(copy(explicit),{default:'custom',defaultInterval:9}),explicit);
});

test('ST equivalent default materialization in another window still changes the raw baseline',async()=>{
 const normalize=async value=>{Guard.normalizeAuthorNote(value.metadata);return value;},f=fixture(normalize),a=f.window(),b=f.window();
 Guard.normalizeAuthorNote(a.live[0].chat_metadata);Guard.normalizeAuthorNote(b.live[0].chat_metadata);
 await Promise.all([a.guard.reset(),b.guard.reset()]);await b.save();
 await assert.rejects(a.save(),{code:'chat-save-conflict'});assert.equal(f.writes(),1);
});

test('chat navigation waits for loaded rows and still rejects a different disk snapshot',async()=>{
 for(const changed of [false,true]){
  const scope={characterKey:'c',chatId:'next'},disk=[{chat_metadata:{route:'next'}},{mes:'saved'}];let load;
  const g=Guard.create({scope:()=>scope,snapshot:()=>({messages:[],metadata:{}}),read:async()=>copy(disk),waitLoaded:()=>new Promise(r=>load=r)});
  const ready=g.reset();await new Promise(r=>setImmediate(r));load({messages:[{mes:changed?'changed':'saved'}],metadata:{route:'next'}});
  if(changed)await assert.rejects(ready,{code:'chat-save-conflict'});else{await ready;assert.equal(g.status().error,null);}
 }
});

test('whenIdle waits through the real write and readback and propagates HTTP failure',async()=>{
 for(const failed of [false,true]){const f=fixture(),a=f.window();await a.guard.reset();let release,sent=false,settled=false;const blocked=new Promise(r=>release=r),rows=copy(a.live);rows[1].mes='pending write';const saving=a.guard.commit(a.scope(),rows,async()=>{sent=true;await blocked;if(!failed)f.disk=rows;return {ok:!failed,status:failed?500:200};});saving.catch(()=>{});while(!sent)await new Promise(r=>setImmediate(r));const idle=a.guard.whenIdle().then(()=>{settled=true;});idle.catch(()=>{});await new Promise(r=>setImmediate(r));assert.equal(settled,false);release();if(failed){await assert.rejects(saving,{code:'chat-save-http'});await assert.rejects(idle,{code:'chat-save-http'});}else{await saving;await idle;assert.equal(a.guard.status().commits,1);assert.equal(a.guard.status().pending,false);}await a.guard.whenIdle();a.guard.destroy();}
});

test('failed readback identifies exact changed fields without storing player text or writing a retry',async()=>{const f=fixture(),a=f.window();await a.guard.ready();a.live[1].mes='private intended words';const intended=copy(a.live);let calls=0;await assert.rejects(a.guard.commit(a.scope(),intended,async()=>{calls++;f.disk=copy(intended);f.disk[1].mes='private persisted words';return {ok:true};}),e=>{assert.equal(e.code,'chat-save-unconfirmed');assert.equal(e.details.phase,'save-readback');assert.equal(e.details.differences[0].path,'/1/mes');assert.doesNotMatch(JSON.stringify(e.details),/private/);return true});assert.equal(calls,1);assert.equal(a.live[1].mes,'private intended words');assert.equal(f.disk[1].mes,'private persisted words');});

test('a proven host load admits additive plugin metadata but preserves persisted fields and the disk baseline',async()=>{
 for(const mode of ['add','no-receipt','changed-field','changed-text','changed-disk']){
  const scope={characterKey:'card.png',chatId:'chat'},disk=[{chat_metadata:{integrity:'x',existing:7}},{mes:'story',swipes:['story','other']}],receipt=copy(disk),live=copy(disk);let writes=0;
  live[0].chat_metadata.TavernDB_ACU_ScopedConfig={schema:1,template:'private'};
  live[0].chat_metadata.TavernDB_ACU_ScopedConfig__chatId='chat';
  if(mode==='changed-field')live[0].chat_metadata.existing=8;
  if(mode==='changed-text')live[1].mes='changed';
  if(mode==='changed-disk')disk[0].chat_metadata.external=true;
  const g=Guard.create({scope:()=>scope,snapshot:()=>({metadata:live[0].chat_metadata,messages:live.slice(1)}),read:async()=>copy(disk),opened:()=>mode==='no-receipt'?null:{scope,rows:receipt},locks:{request:async(_k,_o,fn)=>fn()}});
  if(mode!=='add'){await assert.rejects(g.reset(),{code:'chat-save-conflict'});assert.equal(writes,0);continue;}
  await g.reset();await g.commit(scope,live,async()=>{writes++;disk.splice(0,disk.length,...copy(live));return {ok:true};});assert.equal(writes,1);assert.deepEqual(disk,live);
  disk[0].chat_metadata.external=true;await assert.rejects(g.commit(scope,live,async()=>{writes++;return {ok:true};}),{code:'chat-save-conflict'});assert.equal(writes,1);
 }
});

test('without Web Locks the guard queues saves in this window instead of refusing',async()=>{
 const f=fixture(async value=>value,null),a=f.window();
 await a.guard.reset();
 await a.guard.commit(a.scope(),copy(a.live),async()=>{f.disk=copy(a.live);return {ok:true};});
 assert.equal(a.guard.status().commits,1);
 assert.equal(a.guard.status().error,null);
 assert.deepEqual(f.warnings.map(x=>x.code),['chat-save-lock-local']);
 assert.equal((await a.guard.inspect()).kind,'ready');
});

test('the missing-lock warning is emitted once per window',async()=>{
 const f=fixture(async value=>value,null),a=f.window();
 await a.guard.reset();
 for(let i=0;i<2;i++)await a.guard.commit(a.scope(),copy(a.live),async()=>{f.disk=copy(a.live);return {ok:true};});
 assert.equal(f.warnings.length,1);
 assert.equal(f.warnings[0].code,'chat-save-lock-local');
});

test('local queue serializes two saves in the same window',async()=>{
 let release;const gate=new Promise(r=>release=r),order=[];
 const f=fixture(async value=>value,null),a=f.window();
 await a.guard.reset();
 const first=a.guard.commit(a.scope(),copy(a.live),async()=>{order.push('first:start');await gate;order.push('first:end');f.disk=copy(a.live);return {ok:true};});
 const second=a.guard.commit(a.scope(),copy(a.live),async()=>{order.push('second:start');f.disk=copy(a.live);return {ok:true};});
 await new Promise(r=>setTimeout(r,20));
 assert.deepEqual(order,['first:start'],'第二次保存必须等第一次写完');
 release();
 await Promise.all([first,second]);
 assert.deepEqual(order,['first:start','first:end','second:start']);
});

test('a scalar anchor added by a plugin after load is not a content change',async()=>{
 const f=fixture(),a=f.window();
 a.live[0].chat_metadata.yuziTableUpdateReviewAnchor=42;
 await a.guard.reset();
 assert.equal(a.guard.status().phase,'load-ready');
});

test('an edited or removed persisted metadata field is still a conflict',async()=>{
 for(const change of [v=>{v.mvu=2;},v=>{delete v.mvu;}]){
  const f=fixture(),a=f.window();change(a.live[0].chat_metadata.variables);
  await assert.rejects(a.guard.reset(),{code:'chat-save-conflict'});
 }
 const g=fixture(),b=g.window();delete b.live[0].chat_metadata.variables;
 await assert.rejects(b.guard.reset(),{code:'chat-save-conflict'});
});
