'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Guard=require('../../卡片源码/MVU/variables.js'),Schema=require('../../卡片源码/MVU/schema.js'),V=require('../../卡片源码/数据/validator.js'),E=require('../../卡片源码/数值引擎/src/engine.js'),R=require('../../卡片源码/运行时/roster.js');
const clone=structuredClone,schema=Schema.build(V.z),key=JSON.stringify(['native.png','story']);
function state(){const game=E.loadout.base();game.growth=E.growth.initialize({level:1,xp:0,attributes:{body:4,reflexes:4,intelligence:4,technical:4,cool:4},attributePoints:0,perkPoints:0},'native');game.numeric=E.initialNumeric(game);return R.initialize({future:{keep:true},terminal:{wallet:{yen:0,earned:0,spent:0},gameplay:game}});}
const reply=amount=>'<cxx-story>实际收入记录为'+amount+'。</cxx-story><UpdateVariable><JSONPatch>'+JSON.stringify([{op:'replace',path:'/terminal/wallet/yen',value:amount},{op:'replace',path:'/terminal/wallet/earned',value:amount}])+'</JSONPatch></UpdateVariable>';
function fixture({projection=true,failSaveOnce=false}={}){
 const c={chat:[{mes:'<cxx-story>开场。</cxx-story>',variables:[{stat_data:state()}],swipe_id:0}],chatMetadata:{},eventTypes:{},async saveChat(){saves++;if(failSaveOnce){failSaveOnce=false;throw Error('合成一次保存失败');}disk=clone(c.chat);}};let disk=clone(c.chat),saves=0,mirrors=0,writes=0,wrongPush=0;const receipts=new Set();
 const api={eventOn(){},eventRemoveListener(){},SillyTavern:{getContext:()=>c}},win={CxxDataWrite:{state:key=>receipts.has(key)?{state:'applied'}:null,async apply({receipt}){if(receipts.has(receipt))return {ok:true,state:'duplicate'};receipts.add(receipt);writes++;disk=clone(c.chat);return {ok:true,state:'applied'};}},CxxDataSync:{push(){wrongPush++;throw Error('镜像需要terminal参数');},pushAll(terminal){assert(terminal.wallet);assert.equal(terminal.terminal,undefined);mirrors++;return {ok:true};}}};
 const reader={snapshot:()=>projection?{ok:true,empty:false,terminal:{ensemble:{actors:{player:{name:'显示投影'}}}}}:null};
 const create=()=>Guard.create({api,win,runtime:{key:()=>key},schema,reader});
 return {c,create,append(amount){c.chat.push({is_user:true,mes:'继续'},{mes:reply(amount),swipe_id:0,variables:[{}]});return c.chat.length-1;},reload(){c.chat=clone(disk);},disk:()=>clone(disk),counts:()=>({saves,mirrors,writes,wrongPush})};
}
test('native continuation reads the complete saved floor before the display table projection',()=>{
 const f=fixture(),service=f.create();try{assert.deepEqual(service.localState(),f.c.chat[0].variables[0].stat_data);}finally{service.destroy();}
});

for(const [name,raw]of [['plain-body','<cxx-story>雨停了，你在店里等候。</cxx-story>'],['empty-array','<cxx-story>雨停了，你在店里等候。</cxx-story><UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>'],['display-only','<ztl>{"date":"2051-01-01","time":"12:00","location":{"name":"店内"},"characters":[]}</ztl>']])test('native '+name+' owns a complete zero-delta snapshot after reload',async()=>{
 const f=fixture({projection:false});let service=f.create();try{const before=service.localState(),floor=f.append(0);f.c.chat[floor].mes=raw;await f.c.saveChat();const result=await service.settle(floor),saved=f.disk()[floor].variables[0];assert.equal(result.status,'skipped');assert.equal(result.floorSaved,true);assert.deepEqual(saved.stat_data,before);assert.deepEqual(saved.__cxx_native_commit.patches,[]);assert.deepEqual(f.counts(),{saves:2,mirrors:0,writes:0,wrongPush:0});service.destroy();f.reload();service=f.create();assert.deepEqual(service.localState(),before);assert.equal(service.captureNativeState({floor}).ok,true);}finally{service.destroy();}
});
test('an opening without a complete parent keeps its uninitialized state',async()=>{const f=fixture({projection:false});f.c.chat.splice(0,f.c.chat.length,{mes:'<cxx-story>空开局正文。</cxx-story>',swipe_id:0,variables:[{}]});const service=f.create();try{await f.c.saveChat();await service.settle(0);assert.equal(f.disk()[0].variables[0].__cxx_native_commit,undefined);}finally{service.destroy();}});

test('native local settlement gives story quests the same source context as the MVU route',async()=>{
 const f=fixture({projection:false}),service=f.create();try{
  const floor=f.append(0);f.c.chat[floor].mes='<cxx-story>医生请你雨夜送药，你接下了委托。</cxx-story><UpdateVariable><JSONPatch>'+JSON.stringify([{op:'add',path:'/terminal/quests/q_native_medicine',value:{title:'雨夜送药',objective:'送达诊所',state:'已接取',agreedYen:'300'}}])+'</JSONPatch></UpdateVariable>';
  const result=await service.settle(floor);assert.equal(result.ok,true,result.reason);const task=f.disk()[floor].variables[0].stat_data.terminal.quests.q_native_medicine;assert.equal(task?.state,'已接取');assert.equal(task.definition.title,'雨夜送药');assert.equal(task.acceptedFloor,floor);const receipts=Object.values(f.disk()[floor].variables[0].stat_data.terminal.questJournal.receipts);assert.equal(receipts.length,1);assert.equal(receipts[0].source.floor,floor);assert(receipts[0].source.messageId);assert.equal((await service.settle(floor)).status,'duplicate');
  const nextFloor=f.append(0);f.c.chat[nextFloor].mes='<cxx-story>你已到达诊所。</cxx-story><UpdateVariable><JSONPatch>'+JSON.stringify([{op:'replace',path:'/terminal/quests/q_native_medicine/objective',value:'在后门交付药箱'}])+'</JSONPatch></UpdateVariable>';assert.equal((await service.settle(nextFloor)).ok,true);assert.equal(f.disk()[nextFloor].variables[0].stat_data.terminal.quests.q_native_medicine.objective,'在后门交付药箱');
 }finally{service.destroy();}
});
test('an existing SQL receipt recovers a failed native floor save after reload',async()=>{
 const f=fixture({projection:false,failSaveOnce:true});let service=f.create();try{
  const floor=f.append(13),failed=await service.settle(floor);assert.equal(failed.ok,false);assert.equal(failed.status,'snapshot-pending');assert.equal(service.state({floor}).receipt.phase,'applied');assert.match(failed.reason,/合成一次保存失败/);assert.equal(f.disk().at(-1).variables[0].stat_data,undefined);
  service.destroy();f.reload();service=f.create();const recovered=await service.settle(floor);assert.equal(recovered.ok,true,recovered.reason);assert.equal(f.disk().at(-1).variables[0].stat_data.terminal.wallet.yen,13);assert.deepEqual(f.counts(),{saves:2,mirrors:2,writes:1,wrongPush:0});
 }finally{service.destroy();}
});
test('native settlement mirrors terminal, persists the full floor and resumes once after reload',async()=>{
 const f=fixture({projection:false});let service=f.create();try{
  const floor=f.append(13),first=await service.settle(floor);assert.equal(first.ok,true,first.reason);assert.equal(service.state({floor}).receipt.phase,'saved');assert.equal(f.disk().at(-1).variables[0].stat_data.terminal.wallet.yen,13);assert.deepEqual(f.disk().at(-1).variables[0].stat_data.future,{keep:true});assert.deepEqual(f.counts(),{saves:1,mirrors:1,writes:1,wrongPush:0});
  service.destroy();f.reload();service=f.create();assert.equal(service.localState().terminal.wallet.yen,13);assert.equal(service.state({floor}).receipt.phase,'saved');assert.equal((await service.settle(floor)).status,'duplicate');assert.deepEqual(f.counts(),{saves:1,mirrors:1,writes:1,wrongPush:0});
  const nextFloor=f.append(20),next=await service.settle(nextFloor);assert.equal(next.ok,true,next.reason);assert.equal(f.disk().at(-1).variables[0].stat_data.terminal.wallet.yen,20);assert.deepEqual(f.disk().at(-1).variables[0].stat_data.future,{keep:true});assert.deepEqual(f.counts(),{saves:2,mirrors:2,writes:2,wrongPush:0});
  f.c.chat[nextFloor].mes+='修改原文';assert.equal(service.state({floor:nextFloor}).receipt,null);
 }finally{service.destroy();}
});
