'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setImmediate:turn}=require('node:timers/promises');
const {fakeBackend}=require('../lib/fixture-loader.cjs')('host.test.cjs',['fakeBackend']);
const Stories=require('../../卡片源码/运行时/story-library.js');
function fixture(t){const h=fakeBackend(t);h.locks.request=(...args)=>navigator.locks.request(...args);return h;}
async function hold(h){let release,started;const ready=new Promise(r=>started=r),key='cxx-update:'+h.host.getContext().characterKey;
 const done=navigator.locks.request(key,async()=>{started();await new Promise(r=>release=r);});await ready;return {release,done};}
test('save read queues behind a short content check and does not run under its exclusive lock',async t=>{
 const h=fixture(t),lock=await hold(h);let reads=0;
 const read=h.host.withReadLock(()=>++reads);await turn();assert.equal(reads,0);lock.release();await lock.done;
 assert.equal(await read,1);assert.equal(reads,1);
});
test('waiting save read rechecks the selected chat after acquiring the lock',async t=>{
 const h=fixture(t),lock=await hold(h);let reads=0;const pending=h.host.withReadLock(()=>++reads),checked=assert.rejects(pending,{code:'context-changed'});
 await turn();h.state.chatId='different';lock.release();await lock.done;await checked;assert.equal(reads,0);
});
test('a busy read lock has a bounded wait and includes its failure stage',async t=>{
 const h=fixture(t),lock=await hold(h);let reads=0;const pending=h.host.withReadLock(()=>++reads),checked=assert.rejects(pending,e=>e.code==='update-already-running'&&e.details.phase==='read-lock'&&e.details.waitMs===5000);
 await turn();t.mock.timers.tick(5001);await checked;lock.release();await lock.done;assert.equal(reads,0);
});
test('story actions wait for updater coordination and always release it after a failed write',async()=>{
 let start,reads=0,released=0;const ready=new Promise(r=>start=r);
 const store=Stories.createStore({adapter:{begin:()=>ready,end:()=>released++,flush:()=>{reads++;throw Error('write failed');}},hash:async()=>'',uuid:()=>''});
 const task=store.flush(),checked=assert.rejects(task,/write failed/);await turn();assert.equal(reads,0);assert.equal(store.busy(),true);start();await checked;
 assert.equal(reads,1);assert.equal(released,1);assert.equal(store.busy(),false);
});
