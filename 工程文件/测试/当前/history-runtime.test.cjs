'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../../卡片源码/正文/history-runtime.js');
function fixture(options={}){
  const workers=[],created=[],revoked=[];
  const platform={setTimeout,clearTimeout,Blob:class{constructor(parts){this.parts=parts;}},URL:{createObjectURL:b=>{created.push(b);return 'blob:'+created.length;},revokeObjectURL:u=>revoked.push(u)},Worker:class{
    constructor(url){this.url=url;this.jobs=[];workers.push(this);}
    postMessage(job){this.jobs.push(structuredClone(job));}
    terminate(){this.terminated=true;}
    respond(value,index=0){this.onmessage({data:{id:this.jobs[index].id,value}});}
  }};
  const service=H.create({workerSource:'fixture',platform,run:(kind,payload)=>({kind,...payload}),...options});
  return {service,workers,created,revoked,platform};
}
test('duplicate requests share execution; subscriber invalidation does not cancel another reader',async t=>{
  const f=fixture();t.after(()=>f.service.destroy());const opts={key:'same',revision:1,scope:'A'};
  const one=f.service.submit('parse',{raw:'one'},{...opts,isCurrent:()=>false}),rejected=assert.rejects(one,{code:'cxx-history-stale'});
  const two=f.service.submit('parse',{raw:'one'},opts);assert.equal(f.workers[0].jobs.length,1);f.workers[0].respond({raw:'one'});await rejected;assert.deepEqual(await two,{raw:'one'});
  assert.deepEqual(await f.service.submit('parse',{},opts),{raw:'one'});assert.equal(f.service.stats().cacheHits,1);
});
test('editing text or changing swipe invalidates an in-flight source without caching the old reply',async t=>{
  for(const mutation of [m=>m.mes='new',m=>m.swipe_id=1,m=>m.is_user=true,m=>m.is_system=true]){
    const f=fixture();t.after(()=>f.service.destroy());const m={mes:'old',swipe_id:0};const one=f.service.submit('parse',{raw:m.mes},f.service.messageSource(m,'A')),rejected=assert.rejects(one,{code:'cxx-history-stale'});
    mutation(m);f.workers[0].respond('old');await rejected;assert.equal(f.service.stats().entries,0);
    const next=f.service.submit('parse',{raw:m.mes},f.service.messageSource(m,'A'));f.workers[0].respond('new',1);assert.equal(await next,'new');
  }
});
test('new revision of the same message rejects the pending request and waits for its replacement',async t=>{
  const f=fixture();t.after(()=>f.service.destroy());const m={mes:'old'},first=f.service.submit('parse',{raw:m.mes},f.service.messageSource(m,'A')),rejected=assert.rejects(first,{code:'cxx-history-stale'});
  m.mes='new';const second=f.service.submit('parse',{raw:m.mes},f.service.messageSource(m,'A'));f.workers[0].respond('old');await rejected;assert.equal(f.workers[0].jobs.length,2);f.workers[0].respond('new',1);assert.equal(await second,'new');
});
test('clearing a chat rejects running and queued jobs, ignores late replies and starts the other chat',async t=>{
  const f=fixture();t.after(()=>f.service.destroy());const a=f.service.submit('parse',{}, {key:'a',revision:1,scope:'A'}),b=f.service.submit('parse',{}, {key:'b',revision:1,scope:'A'});
  const rejects=Promise.all([assert.rejects(a,{code:'cxx-history-stale'}),assert.rejects(b,{code:'cxx-history-stale'})]);
  const c=f.service.submit('parse',{}, {key:'c',revision:1,scope:'B'});f.service.clearScope('A');await rejects;
  assert.equal(f.workers[0].terminated,true);assert.deepEqual(f.revoked,['blob:1']);f.workers[0].respond('late');assert.equal(f.service.stats().pending,1);
  f.workers[1].respond('B');assert.equal(await c,'B');assert.equal(f.service.stats().entries,1);
});
test('scope epochs reject obsolete source tokens even when the same message is reused',async t=>{
  const f=fixture();t.after(()=>f.service.destroy());const m={mes:'text'},source=f.service.messageSource(m,'A');f.service.clearScope('A');
  await assert.rejects(f.service.submit('parse',{},source),{code:'cxx-history-stale'});assert.equal(f.workers.length,0);
});
test('unavailable Worker and Worker failure use the existing deferred fallback',async t=>{
  const noWorker=fixture({platform:{setTimeout,clearTimeout}});t.after(()=>noWorker.service.destroy());assert.deepEqual(await noWorker.service.submit('parse',{raw:'fallback'},{key:'a',revision:1}),{kind:'parse',raw:'fallback'});assert.equal(noWorker.service.stats().fallback,1);
  const f=fixture();t.after(()=>f.service.destroy());const pending=f.service.submit('parse',{raw:'recovered'},{key:'a',revision:1});f.workers[0].onerror();assert.deepEqual(await pending,{kind:'parse',raw:'recovered'});assert.equal(f.workers[0].terminated,true);assert.equal(f.revoked.length,1);
});
test('parse errors are returned without caching; a subsequent valid task can run',async t=>{
  const f=fixture();t.after(()=>f.service.destroy());const p=f.service.submit('parse',{}, {key:'bad',revision:1});const rejected=assert.rejects(p,{message:'invalid',code:'fixture-error'});
  f.workers[0].onmessage({data:{id:1,error:{message:'invalid',code:'fixture-error'}}});await rejected;assert.equal(f.service.stats().entries,0);
  const next=f.service.submit('parse',{}, {key:'good',revision:1});f.workers[0].respond('ok',1);assert.equal(await next,'ok');
});
test('cache keeps its existing entry and byte budgets; destroy releases jobs, cache and URL',async()=>{
  const f=fixture({maxEntries:2,maxBytes:1024});f.service.put('a',1,'a','A');f.service.put('b',1,'b','B');f.service.put('c',1,'c','C');assert.equal(f.service.get('a',1),undefined);
  f.service.put('huge',1,'x'.repeat(1024),'A');assert.equal(f.service.get('huge',1),undefined);assert.ok(f.service.stats().bytes<=1024);
  const p=f.service.submit('parse',{}, {key:'pending',revision:1}),rejected=assert.rejects(p,{code:'cxx-history-stale'});f.service.destroy();await rejected;
  assert.equal(f.workers[0].terminated,true);assert.equal(f.revoked.length,1);assert.equal(f.service.stats().entries,0);assert.equal(f.service.stats().pending,0);assert.equal(f.service.stats().bytes,0);
  await assert.rejects(f.service.submit('parse',{}),{code:'cxx-history-stale'});f.service.destroy();assert.equal(f.revoked.length,1);
});
