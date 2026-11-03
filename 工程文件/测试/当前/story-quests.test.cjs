'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Q=require('../../卡片源码/运行时/quests.js'),V=require('../../卡片源码/运行时/quest-view.js'),S=require('../../卡片源码/MVU/schema.js').build(require('../../卡片源码/数据/validator.js').z);
const start=()=>({terminal:{wallet:{yen:100,earned:100,spent:0},gameplay:{keep:7},quests:{},unknown:{keep:true}},unknown:{future:9}});
const patch=(path,value,op='replace')=>({op,path,value});
function settle(before,patches,key='story-create'){
 const policy={questDefinition:()=>null,questRegistered:()=>false,numericOptions:{factBatch:key,source:{floor:3,swipe:0,story:key}}},tx=S.prepare(patches,before,policy),after=structuredClone(before);
 for(const p of tx.patches){const keys=p.path.slice(1).split('/');let target=after;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)]=structuredClone(p.value);}
 S.check(tx,before,after);return after;
}
const gain=(value={state:'已接取',title:'雨夜送药',objective:'将冷藏药箱送到南街诊所',agreedYen:'300',future:{keep:7}})=>patch('/terminal/quests/q_rain_medicine',value,'add');
const act=(state,action)=>Q.plan(state,{action,questId:'q_rain_medicine',id:'ui-'+action,expectedRevision:Q.journal(state).revision},{questSource:{floor:4,swipe:0}});
test('a story-created commission stores its definition and progress without a catalog entry',()=>{
 const before=start(),after=settle(before,[gain()]),r=after.terminal.quests.q_rain_medicine;
 assert.equal(r?.state,'已接取');assert.equal(r.definition.title,'雨夜送药');assert.equal(r.definition.goal,'将冷藏药箱送到南街诊所');assert.equal(r.agreedYen,300);assert.equal(r.paidYen,0);assert.equal(r.ownerActorId,'player');assert.deepEqual(r.future,{keep:7});assert.deepEqual(after.terminal.wallet,before.terminal.wallet);assert.deepEqual(before,start());
});
test('a new offer defaults to published and uses the existing journal and player operations',()=>{
 let state=settle(start(),[gain({title:'雨夜送药',objective:'将冷藏药箱送到南街诊所',agreedYen:300})]);
 assert.equal(state.terminal.quests.q_rain_medicine?.state,'已发布');let view=V.project(state,[]);assert.equal(view.items[0].title,'雨夜送药');assert.equal(view.items[0].legacy,false);
 state=act(state,'accept');state=act(state,'start');state=act(state,'track');view=V.project(state,[]);assert.equal(view.tracked.title,'雨夜送药');assert.equal(view.tracked.objective,'将冷藏药箱送到南街诊所');state=act(state,'pause');state=act(state,'resume');assert.equal(state.terminal.quests.q_rain_medicine.state,'进行中');assert.equal(state.terminal.wallet.yen,100);
});
test('a saved story commission advances and settles once through the normal narrative wallet path',()=>{
 let state=settle(start(),[gain()]);assert.ok(state.terminal.quests.q_rain_medicine,'Story commission must be saved before continuing');state=JSON.parse(JSON.stringify(state));
 const changes=[patch('/terminal/quests/q_rain_medicine/state','完成'),patch('/terminal/quests/q_rain_medicine/paidYen',300),patch('/terminal/wallet/yen',400),patch('/terminal/wallet/earned',400)];
 state=settle(state,changes,'medicine-paid');assert.equal(state.terminal.quests.q_rain_medicine.state,'完成');assert.equal(state.terminal.quests.q_rain_medicine.paidYen,300);assert.equal(state.terminal.wallet.yen,400);assert.deepEqual(settle(state,changes,'medicine-paid'),state);assert.deepEqual(state.terminal.quests.q_rain_medicine.future,{keep:7});
});
test('a story commission also creates the missing quest container',()=>{const before=start();delete before.terminal.quests;const after=settle(before,[gain()]);assert.equal(after.terminal.quests.q_rain_medicine.state,'已接取');assert.equal(before.terminal.quests,undefined);});
test('whole-record story updates merge progress while retaining the saved definition and unknown fields',()=>{
 let state=settle(start(),[gain()]);state=settle(state,[patch('/terminal/quests/q_rain_medicine',{state:'进行中',objective:'已到诊所门口'})],'medicine-progress');
 assert.equal(state.terminal.quests.q_rain_medicine.state,'进行中');assert.equal(state.terminal.quests.q_rain_medicine.objective,'已到诊所门口');assert.equal(state.terminal.quests.q_rain_medicine.definition.title,'雨夜送药');assert.deepEqual(state.terminal.quests.q_rain_medicine.future,{keep:7});
});
test('a saved story offer can record the player accepting it in the next reply',()=>{
 let state=settle(start(),[gain({title:'雨夜送药',objective:'将冷藏药箱送到南街诊所'})]);state=settle(state,[patch('/terminal/quests/q_rain_medicine/state','已接取')],'medicine-accepted');
 assert.equal(state.terminal.quests.q_rain_medicine.state,'已接取');assert.equal(state.terminal.quests.q_rain_medicine.ownerActorId,'player');assert.equal(state.terminal.quests.q_rain_medicine.acceptedFloor,3);
});
test('a short story commission can be created and paid in the same reply without duplicate income',()=>{
 const before=start(),changes=[gain({title:'雨夜送药',objective:'药箱已经交付',state:'完成',agreedYen:300,paidYen:300,settled:true}),patch('/terminal/wallet/yen',400),patch('/terminal/wallet/earned',400)];
 const after=settle(before,changes,'medicine-same-turn');assert.equal(after.terminal.quests.q_rain_medicine.state,'完成');assert.equal(after.terminal.quests.q_rain_medicine.settled,true);assert.equal(after.terminal.wallet.yen,400);assert.deepEqual(settle(after,changes,'medicine-same-turn'),after);
});

test('saved story definitions and later edits take precedence over a same-id catalog default',()=>{
 let state=settle(start(),[gain()]);state=settle(state,[patch('/terminal/quests/q_rain_medicine',{title:'诊所急送',description:'医生改为在后门接收',objective:'赶往后门'})],'medicine-renamed');
 const stale={id:'q_rain_medicine',title:'旧目录',goal:'旧目标',pay:999,track:'main'};
 assert.equal(Q.definitions(state,[stale])[0].title,'诊所急送');const view=V.project(state,[stale]);assert.equal(view.items[0].title,'诊所急送');assert.equal(view.items[0].definition.brief,'医生改为在后门接收');assert.equal(view.items[0].definition.goal,'将冷藏药箱送到南街诊所');
});

test('native and web content consumers resolve the same saved story definition',async()=>{
 const state=settle(start(),[gain()]),r=state.terminal.quests.q_rain_medicine,stale={id:r.id,title:'旧目录',goal:'旧目标',pay:999},seed={registry:{packages:{}},initialContent:{quests:[stale]},mapIndex:{}};
 const content=require('../../卡片源码/运行时/content.js'),native=require('../../卡片源码/MVU/variable-policy.js').create({api:{getVariables:({type})=>type==='script'?{__cxx_update_seed:seed}:{},SillyTavern:{getContext:()=>({chat:[]})}},win:{CxxQuests:Q},content})();
 const {createGameplayContent}=await import('../../网页独立版/src/gameplay/content.mjs'),web=await createGameplayContent({runtimePolicy:seed,state:()=>state});
 for(const q of [native.questDefinition(r.id,r),web.definition(r.id,r),web.definitions()[0],web.view().quests[0]]){assert.equal(q.title,'雨夜送药');assert.equal(q.pay,300);}
 assert(native.questRegistered(r.id,r));assert(web.policy().questRegistered(r.id,r));
});

test('a story commission stays with its original actor and pays that actor after control changes',()=>{
 const A=require('../../卡片源码/运行时/ensemble-state.js'),switchTo=(s,id)=>A.preview(s,A.planControl(s,id));
 let state=settle(switchTo(A.initialize(start()),'wb_10'),[gain()]);assert.equal(state.terminal.quests.q_rain_medicine.ownerActorId,'wb_10');state=switchTo(state,'wb_6');const before=structuredClone(state),wallet=A.read(state,'wb_10').wallet;
 assert.throws(()=>act(state,'start'),/接取/);state=settle(state,[patch('/terminal/quests/q_rain_medicine',{state:'完成',paidYen:300,settled:true,ownerActorId:'wb_6'}),patch('/terminal/ensemble/actors/wb_10/wallet/yen',wallet.yen+300),patch('/terminal/ensemble/actors/wb_10/wallet/earned',wallet.earned+300)],'medicine-npc-paid');
 assert.equal(state.terminal.quests.q_rain_medicine.ownerActorId,'wb_10');assert.equal(A.read(state,'wb_10').wallet.yen,wallet.yen+300);assert.deepEqual(A.read(state,'wb_6').wallet,A.read(before,'wb_6').wallet);assert.deepEqual(state.terminal.wallet,before.terminal.wallet);
});

test('the pinned strict MVU executor retains a new story definition and its unknown fields',async()=>{
 const {executor}=require('../MVU/mvu-fixture.cjs'),before=start(),patches=[gain()];let tx;
 const ex=executor(async(name,data,commands)=>{if(name==='mag_command_parsed'){tx=S.prepare(patches,before,{questDefinition:()=>null,questRegistered:()=>false,numericOptions:{factBatch:'strict-story',source:{floor:3,swipe:0}}});Q.extendSchema(data.schema);commands.splice(0,commands.length,...S.commands(tx.patches));}if(name==='mag_variable_update_ended')S.check(tx,before,data.stat_data);});
 const data={stat_data:structuredClone(before),schema:structuredClone(ex.schema(structuredClone(before)))};data.schema.strictSet=true;data.schema.strictTemplate=false;await ex.run('<UpdateVariable><JSONPatch>'+JSON.stringify(patches)+'</JSONPatch></UpdateVariable>',data);
 assert.equal(data.stat_data.terminal.quests.q_rain_medicine.definition.title,'雨夜送药');assert.equal(data.stat_data.terminal.quests.q_rain_medicine.future.keep,7);
});

test('correcting a same-turn story creation and payment restores the task and wallet together',()=>{
 const before=start(),after=settle(before,[gain({title:'雨夜送药',state:'完成',agreedYen:300,paidYen:300,settled:true}),patch('/terminal/wallet/yen',400),patch('/terminal/wallet/earned',400)],'medicine-correctable');
 const corrected=Q.plan(after,{action:'correct',id:'correct-story-payment',receiptId:'medicine-correctable',expectedRevision:Q.journal(after).revision});assert.deepEqual(corrected.terminal.quests,before.terminal.quests);assert.deepEqual(corrected.terminal.wallet,before.terminal.wallet);assert.deepEqual(corrected.unknown,before.unknown);assert.equal(Q.journal(corrected).receipts['medicine-correctable'].reverted,true);
});

test('whole-record progress retains the agreed payment when a supplied amount is unreadable',()=>{
 const before=settle(start(),[gain()]);for(const [index,value]of [null,false,true,'','  ','未谈妥'].entries()){
  const after=settle(before,[patch('/terminal/quests/q_rain_medicine',{objective:'已进入诊所',agreedYen:value})],'medicine-unreadable-'+index);assert.equal(after.terminal.quests.q_rain_medicine.agreedYen,300);assert.equal(after.terminal.quests.q_rain_medicine.objective,'已进入诊所');
 }
});
