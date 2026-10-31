'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../../卡片源码/运行时/reroll.js');
function fixture(error){let tick=0,mark,flushed=false;const row={mes:'old',swipe_id:0,swipes:['old']},c={characters:[{avatar:'test.png'}],characterId:0,getCurrentChatId:()=> 'test',chat:[{is_user:true},row]};
 const top={setTimeout(fn){tick++;queueMicrotask(fn);},dispatchEvent(){},CustomEvent:class{},Cxx236VariableGuard:{state:()=>({lastError:''})},CxxContextBridge:{status:()=>({session:tick<6?'pending':null,error:tick>=6?error:null})},CxxContext:{status:()=>({pending:tick<6})},Cxx233Updater:{host:{getContext:()=>({busy:tick<5})}},__cxx_stories__:{store:{point:async()=>({chatId:'checkpoint'}),flush:async()=>{assert(tick>=6,'must wait for host quiet and source readback');flushed=true;}}}};
 c.swipe={to:async()=>{row.swipe_id=1;row.swipes.push('new');row.mes='new';mark();}};
 const api={SillyTavern:{getContext:()=>c},eventOn:(_,fn)=>mark=fn,eventRemoveListener(){}};
 return {service:R.create({api,top,runtime:{invalidateSnapshots(){},scheduleMessages(){}}}),flushed:()=>flushed};
}
test('reroll waits for completed source persistence and the host post-generation quiet period',async()=>{const f=fixture(null),r=await f.service.run('rewrite');assert.equal(r.swipe,1);assert(f.flushed());assert(!f.service.busy());});
test('source failure keeps the recovery checkpoint and does not report a saved reroll',async()=>{const f=fixture({message:'readback failed'});await assert.rejects(f.service.run('rewrite'),/readback failed/);assert(!f.flushed());assert(!f.service.busy());});
