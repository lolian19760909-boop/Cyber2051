'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const H=require('../../卡片源码/运行时/player-host.js'),O=require('../../卡片源码/运行时/player-operations.js');
const A=require('../../卡片源码/运行时/ensemble-state.js'),E=require('../../卡片源码/数值引擎/src/engine.js');
const S=require('../../卡片源码/MVU/schema.js').build(require('D:/SillyTavern/node_modules/zod'));
const {executor}=require('../MVU/mvu-fixture.cjs');
const clone=structuredClone,pause=()=>new Promise(r=>setImmediate(r));
function gate(){let release;const promise=new Promise(r=>release=r);return {promise,release};}
function fixture(t){
  const game=E.loadout.base();game.growth=E.growth.initialize({level:1,xp:0,attributePoints:7,perkPoints:0,attributes:{body:3,reflexes:3,intelligence:3,technical:3,cool:3}},'legacy');game.numeric=E.initialNumeric(game);
  const stat={futureRoot:{keep:false},terminal:{wallet:{yen:777,earned:0,spent:0,external:'keep'},gameplay:{...game,external:7},external:{zero:0}}};
  const ex=executor(async()=>{}),value={stat_data:stat,schema:clone(ex.schema(clone(stat))),external:{keep:true}};
  value.schema.strictSet=true;value.schema.strictTemplate=false;
  const row={mes:'合成测试正文',swipe_id:0,swipes:['合成测试正文','另一个分支'],variables:[clone(value),clone(value)]};
  let disk,writes=0,saves=0,reads=0,saveGate,writeGate,corrupt=false,chatId='ensemble-test';
  const c={characters:[{avatar:'ensemble-test.png',name:'合成测试'}],characterId:0,chat:[{is_user:true,mes:'仅测试'},row],chatMetadata:{variables:{external:1}},getCurrentChatId:()=>chatId,getRequestHeaders:()=>({}),async saveChat(){saves++;if(saveGate)await saveGate.promise;disk=clone([{chat_metadata:c.chatMetadata},...c.chat]);if(corrupt)delete disk[2].variables[0].stat_data.terminal.ensemble;}};
  disk=clone([{chat_metadata:c.chatMetadata},...c.chat]);
  const api={SillyTavern:{getContext:()=>c},getVariables:()=>clone(c.chatMetadata.variables),async updateVariablesWith(fn,{message_id}){const m=c.chat[message_id];m.variables[m.swipe_id||0]=fn(clone(m.variables[m.swipe_id||0]));writes++;}};
  const read=H.createReader({api,readDisk:async()=>{reads++;return clone(disk);}});
  const host={async assertPlayerWritable(){if(writeGate)await writeGate.promise;},withChatSave:async(_,fn)=>fn()};
  const prior=global.Cxx236VariableGuard;global.Cxx236VariableGuard={validateProgram:S.program};
  const player=H.create({api,host,read,operations:O,ui:{},saveTimeout:1000});
  t.after(()=>{player.stop();global.Cxx236VariableGuard=prior;});
  return {player,row,c,read,ex,value,stat:()=>row.variables[row.swipe_id].stat_data,disk:()=>clone(disk),stats:()=>({writes,saves,reads}),holdSave:g=>saveGate=g,holdWrite:g=>writeGate=g,corrupt:v=>corrupt=v,switchChat:()=>chatId='other'};
}
test('approved actors persist through existing host, strict MVU schema and disk readback',async t=>{
  const f=fixture(t),before=clone(f.row.variables),g=gate();f.holdSave(g);
  let finished=false;const saving=f.player.commit({action:'ensemble-initialize'}).then(x=>{finished=true;return x;});
  await pause();assert.equal(finished,false);assert.equal(f.player.saveState().status,'saving');assert.equal(f.stats().writes,1);
  g.release();const saved=await saving;assert.equal(f.player.saveState().status,'saved');assert.deepEqual(saved.stat,f.disk()[2].variables[0].stat_data);
  assert.deepEqual(f.stat().terminal.gameplay,before[0].stat_data.terminal.gameplay);assert.deepEqual(f.stat().terminal.wallet,before[0].stat_data.terminal.wallet);assert.deepEqual(f.row.variables[1],before[1]);assert.deepEqual(f.row.variables[0].external,{keep:true});
  assert.equal(f.row.variables[0].schema.properties.terminal.properties.ensemble.recursiveExtensible,true);
  const initial=clone(f.stat());await f.player.commit({action:'ensemble-initialize'});assert.deepEqual(f.stat(),initial);
  const reopening=O.plan(initial,{action:'initialize'});assert.deepEqual(reopening.terminal.ensemble,initial.terminal.ensemble);assert.deepEqual(reopening.terminal.wallet,initial.terminal.wallet);
});
test('actor equipment uses actual operations/guard and preserves other actors and original player',async t=>{
  const f=fixture(t);await f.player.commit({action:'ensemble-initialize'});const old=clone(f.stat());
  await f.player.commit({action:'unequip',actorId:'wb_10',actorBinding:A.binding(f.stat(),'wb_10'),slot:'weapon_1'});
  assert.equal(A.read(f.stat(),'wb_10').gameplay.equipment.weapon_1,null);assert.deepEqual(f.stat().terminal.gameplay,old.terminal.gameplay);assert.deepEqual(f.stat().terminal.wallet,old.terminal.wallet);assert.deepEqual(f.stat().terminal.ensemble.actors.wb_6,old.terminal.ensemble.actors.wb_6);
  assert.deepEqual(f.disk()[2].variables[0].stat_data,f.stat());
});
test('control switch is branch-local; prior panel drafts reject without writes',async t=>{
  const f=fixture(t);await f.player.commit({action:'ensemble-initialize'});const old=clone(f.stat()),draft={action:'unequip',actorId:'wb_10',actorBinding:A.binding(f.stat(),'wb_10'),slot:'weapon_1'};
  await f.player.commit({action:'actor-switch',actorId:'wb_6'});assert.equal(A.registry(f.stat()).control.actorId,'wb_6');assert.deepEqual(f.stat().terminal.ensemble.actors,old.terminal.ensemble.actors);
  const count=f.stats().writes;await assert.rejects(f.player.commit(draft),/草稿已过期/);assert.equal(f.stats().writes,count);
  const after=clone(f.stat());await f.player.commit({action:'unequip',slot:'weapon_1'});assert.equal(A.read(f.stat(),'wb_6').gameplay.equipment.weapon_1,null);assert.deepEqual(f.stat().terminal.ensemble.actors.wb_10,after.terminal.ensemble.actors.wb_10);
  assert.equal(f.row.variables[1].stat_data.terminal.ensemble,undefined);
});
test('queued operation cannot cross a control change, response branch, or chat',async t=>{
  for(const change of ['control','branch','chat'])await t.test(change,async t=>{
    const f=fixture(t);await f.player.commit({action:'ensemble-initialize'});const g=gate();f.holdWrite(g);const before=f.stats().writes;
    const saving=f.player.commit({action:'unequip',actorId:'wb_10',slot:'weapon_1'});await pause();
    if(change==='control')f.row.variables[0].stat_data=A.preview(f.stat(),A.planControl(f.stat(),'wb_6'));
    if(change==='branch'){f.row.swipe_id=1;f.row.mes=f.row.swipes[1];}
    if(change==='chat')f.switchChat();
    g.release();await assert.rejects(saving,/身份已经变化|分支已变化|聊天已切换/);assert.equal(f.stats().writes,before);
  });
});
test('failed readback retries persistence without reinitializing or repeating equipment operation',async t=>{
  const f=fixture(t);await f.player.commit({action:'ensemble-initialize'});f.corrupt(true);
  await assert.rejects(f.player.commit({action:'unequip',actorId:'wb_10',slot:'weapon_1'}),/尚未读回/);assert.equal(f.player.saveState().status,'error');
  const state=clone(f.stat()),writes=f.stats().writes;f.corrupt(false);await f.player.retrySave();
  assert.equal(f.stats().writes,writes);assert.deepEqual(f.stat(),state);assert.deepEqual(f.disk()[2].variables[0].stat_data,state);assert.equal(f.player.saveState().status,'saved');
});
test('program guard refuses direct registry replacement and forged cross-actor results',()=>{
  const before=A.initialize({terminal:{gameplay:{},wallet:{yen:1,earned:0,spent:0}}}),changed=clone(before);changed.terminal.ensemble.control.actorId='wb_6';
  assert.throws(()=>S.program(before,changed),/已校验的人物操作/);
  const request={action:'unequip',actorId:'wb_10',slot:'weapon_1'},operation={request,actorBinding:A.binding(before,'wb_10')},after=O.plan(before,request,operation);
  after.terminal.ensemble.actors.wb_6.wallet.yen=50000;assert.throws(()=>S.program(before,after,{engineOperation:operation}),/引擎计算不一致/);
});

test('a delayed send preparation cannot send the input under a newly selected actor',async t=>{
 const f=fixture(t);await f.player.commit({action:'ensemble-initialize'});await f.player.commit({action:'actor-switch',actorId:'wb_10'});const prior=global.__cxx_battle__,g=gate();global.__cxx_battle__={preflight:()=>g.promise};t.after(()=>{if(prior===undefined)delete global.__cxx_battle__;else global.__cxx_battle__=prior;});let sends=0;
 const pending=f.player.requestSend(()=>sends++);await pause();await f.player.commit({action:'actor-switch',actorId:'wb_6'});g.release();await assert.rejects(pending,/人物.*变化/);assert.equal(sends,0);assert.equal(A.registry(f.stat()).control.actorId,'wb_6');
});
