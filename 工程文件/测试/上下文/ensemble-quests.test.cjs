'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../../卡片源码/运行时/ensemble-state.js'),Q=require('../../卡片源码/运行时/quests.js'),O=require('../../卡片源码/运行时/player-operations.js');
const S=require('../../卡片源码/MVU/schema.js').build(require('../../.cache/dependencies/zod-4.4.3/index.cjs'));
const Controller=require('../../卡片源码/终端/quest-controller.js');
const {fixture}=require('../lib/fixture-loader.cjs')('../上下文/ensemble-save.test.cjs',['fixture']);
const defs=[{id:'q1',title:'零件交付',goal:'确认交付',pay:500,requirements:{level:4}},{id:'q2',title:'街头跑腿',pay:300},{id:'q3',title:'第二单',pay:200}];
const initial=()=>A.initialize({future:{keep:true},terminal:{wallet:{yen:777,earned:0,spent:0},gameplay:{},quests:{},custom:false}});
const switchTo=(s,id)=>A.preview(s,A.planControl(s,id));
const request=(s,action,id,nonce=action+'_'+id)=>({action:'quest-'+action,id:nonce,questId:id,expectedRevision:Q.journal(s).revision});
const plan=(s,r)=>O.plan(s,r,{actorBinding:A.binding(s,A.registry(s).control.actorId),questDefinitions:defs,questSource:{floor:2,swipe:0}});
const accept=(s,id)=>plan(s,request(s,'accept',id));
const patch=(path,value,op='replace')=>({op,path,value});
const wallet=(id,key)=>'/terminal/ensemble/actors/'+id+'/wallet/'+key;
const policy=(key='test_batch')=>({questDefinition:id=>defs.find(q=>q.id===id),questRegistered:id=>defs.some(q=>q.id===id),numericOptions:{factBatch:key,source:{floor:3,swipe:0,story:key}}});
function apply(s,patches,key){const tx=S.prepare(patches,s,policy(key)),after=structuredClone(s);for(const p of tx.patches){const keys=p.path.slice(1).split('/');let at=after;for(const k of keys.slice(0,-1))at=at[k];at[keys.at(-1)]=structuredClone(p.value);}S.check(tx,s,after);return {after,tx};}
function twoOwners(){let s=accept(switchTo(initial(),'wb_10'),'q1');return accept(switchTo(s,'wb_6'),'q2');}

test('new acceptance uses the controlled level and freezes ownership without moving any state',()=>{
  let s=switchTo(initial(),'wb_6');assert.match(Q.available(s,defs[0],'accept',defs),/要求等级/);assert.throws(()=>accept(s,'q1'),/要求等级/);
  s=switchTo(s,'wb_10');const before=structuredClone(s);s=accept(s,'q1');assert.equal(s.terminal.quests.q1.ownerActorId,'wb_10');assert.deepEqual(s.terminal.ensemble,before.terminal.ensemble);assert.deepEqual(s.terminal.wallet,before.terminal.wallet);
  s=switchTo(s,'wb_6');assert.throws(()=>plan(s,request(s,'start','q1')),/丰川祥子/);assert.equal(s.terminal.quests.q1.ownerActorId,'wb_10');
});

test('legacy unowned records stay with the original player; reads and reacceptance cannot reassign them',()=>{
  let s=initial();s.terminal.quests.q2={id:'q2',state:'已放弃',future:{keep:7}};s=switchTo(s,'wb_10');const before=structuredClone(s);
  assert.equal(Q.owner(s,'q2').actorId,'player');assert.deepEqual(s,before);
  assert.throws(()=>Q.plan(s,request(s,'accept','q2'),{questDefinitions:defs}),/玩家/);
  assert.throws(()=>apply(s,[patch('/terminal/quests/q2/ownerActorId','wb_10','add')]),/公开进展|程序维护|尚未开放/);assert.deepEqual(s,before);
  s.terminal.quests.q2.ownerActorId=null;assert.throws(()=>Q.owner(s,'q2'),/编号无效/);assert.throws(()=>A.selected(s,null),/编号无效/);
});

test('mixed actor payments and numeric facts remain atomic, balanced and idempotent',()=>{
  const s=twoOwners(),original=structuredClone(s.terminal.wallet),changes=[
    patch('/terminal/quests/q1/paidYen',500),patch('/terminal/quests/q2/paidYen','300'),
    patch(wallet('wb_10','yen'),12500),patch(wallet('wb_10','earned'),500),patch(wallet('wb_6','yen'),'2300'),patch(wallet('wb_6','earned'),'300'),
    patch('/terminal/ensemble/actors/wb_10/gameplay/numericInput',[{id:'bruise',kind:'resource',target:'player',resource:'hp',amount:-2,reason:'合成擦伤'}],'add')
  ];
  const {after}=apply(s,changes,'two_payments');assert.equal(A.read(after,'wb_10').wallet.yen,12500);assert.equal(A.read(after,'wb_6').wallet.yen,2300);assert.equal(A.read(after,'wb_10').gameplay.numeric.vitals.hp,123);assert.deepEqual(after.terminal.wallet,original);
  assert.deepEqual(apply(after,changes,'two_payments').after,after);assert.equal(Q.record(after,'q1').ownerActorId,'wb_10');
  const refunded=apply(after,[patch('/terminal/quests/q1/refundedYen',100),patch(wallet('wb_10','yen'),12400),patch(wallet('wb_10','spent'),100)],'refund').after;
  assert.equal(A.read(refunded,'wb_10').wallet.spent,100);assert.equal(A.read(refunded,'wb_6').wallet.yen,2300);
});

test('one actor or the original wallet cannot cover another actors task payment; totals aggregate per owner',()=>{
  const s=twoOwners();assert.throws(()=>apply(s,[patch('/terminal/quests/q1/paidYen',500),patch('/terminal/quests/q2/paidYen',300),patch(wallet('wb_6','yen'),2800),patch(wallet('wb_6','earned'),800)]),/接单人的钱包/);
  assert.throws(()=>apply(s,[patch('/terminal/quests/q1/paidYen',500),patch('/terminal/wallet/yen',1277),patch('/terminal/wallet/earned',500)]),/接单人的钱包/);
  const same=accept(switchTo(s,'wb_10'),'q3');assert.throws(()=>apply(same,[patch('/terminal/quests/q1/paidYen',500),patch('/terminal/quests/q3/paidYen',200),patch(wallet('wb_10','yen'),12500),patch(wallet('wb_10','earned'),500)]),/同一批/);
});

test('reversible payment receipt restores both actor wallets and keeps unknown data',()=>{
  const s=twoOwners(),after=apply(s,[patch('/terminal/quests/q1/paidYen',500),patch(wallet('wb_10','yen'),12500),patch(wallet('wb_10','earned'),500),patch('/terminal/quests/q2/paidYen',300),patch(wallet('wb_6','yen'),2300),patch(wallet('wb_6','earned'),300)],'pay').after;
  const fixed=plan(after,{...request(after,'correct','q1'),receiptId:'pay'});assert.deepEqual(fixed.terminal.quests,s.terminal.quests);assert.deepEqual(fixed.terminal.ensemble,s.terminal.ensemble);assert.deepEqual(fixed.future,s.future);assert.deepEqual(fixed.terminal.wallet,s.terminal.wallet);
});

test('native strict MVU executor commits NPC task payment and ownership survives the transaction',async()=>{
  const {executor}=require('../MVU/mvu-fixture.cjs'),before=twoOwners(),changes=[patch('/terminal/quests/q2/paidYen',300),patch(wallet('wb_6','yen'),2300),patch(wallet('wb_6','earned'),300)];let tx;
  const ex=executor(async(name,data,commands)=>{if(name==='mag_command_parsed'){tx=S.prepare(changes,before,policy('strict'));Q.extendSchema(data.schema);A.extendSchema(data.schema);commands.splice(0,commands.length,...S.commands(tx.patches));}if(name==='mag_variable_update_ended')S.check(tx,before,data.stat_data);});
  const data={stat_data:structuredClone(before),schema:structuredClone(ex.schema(structuredClone(before)))};data.schema.strictSet=true;data.schema.strictTemplate=false;
  await ex.run('<UpdateVariable><JSONPatch>'+JSON.stringify(changes)+'</JSONPatch></UpdateVariable>',data);
  assert.equal(A.read(data.stat_data,'wb_6').wallet.yen,2300);assert.equal(data.stat_data.terminal.quests.q2.ownerActorId,'wb_6');assert.equal(data.stat_data.terminal.questJournal.receipts.strict.changes.filter(c=>c.parts[1]==='ensemble').length,2);
});

test('actual player host persists NPC acceptance and invalidates an old controller request after switching',async t=>{
  const f=fixture(t);global.Cxx236VariableGuard.questDefinition=id=>defs.find(q=>q.id===id);
  await f.player.commit({action:'ensemble-initialize'});await f.player.commit({action:'actor-switch',actorId:'wb_10'});
  const first={...request(f.stat(),'accept','q1'),...f.player.quests.source()};await f.player.commit(first);
  assert.equal(f.disk()[2].variables[0].stat_data.terminal.quests.q1.ownerActorId,'wb_10');const stale={...request(f.stat(),'accept','q3'),...f.player.quests.source()},oldContext=stale.questContext;
  await f.player.commit({action:'actor-switch',actorId:'wb_6'});assert.notEqual(f.player.quests.source().questContext,oldContext);const writes=f.stats().writes;
  await assert.rejects(f.player.commit(stale),/草稿已过期|人物已变化|来源已变化/);assert.equal(f.stats().writes,writes);
  const c=Controller.create({read:()=>f.stat(),source:()=>f.player.quests.source(),commit:async()=>{throw Object.assign(Error('readback pending'),{diagnosticKind:'commit-unconfirmed'});},uuid:()=> 'one'});
  await c.run(c.request('accept','q2'));assert(c.state().pending);await f.player.commit({action:'actor-switch',actorId:'wb_10'});c.reconcile();assert.equal(c.state().pending,null);c.destroy();
});
