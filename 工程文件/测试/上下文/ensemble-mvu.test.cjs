'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../../卡片源码/运行时/ensemble-state.js'),E=require('../../卡片源码/数值引擎/src/engine.js'),O=require('../../卡片源码/运行时/player-operations.js');
const schema=require('../../卡片源码/MVU/schema.js').build(require('../../独立制卡器/node_modules/zod'));
const Guard=require('../../卡片源码/MVU/variables.js'),{executor}=require('../MVU/mvu-fixture.cjs');
const copy=structuredClone,prefix=id=>'/terminal/ensemble/actors/'+id;
const event=(id,amount)=>({id,kind:'resource',target:'player',resource:'hp',amount,reason:'合成测试中已确认的擦伤'});
const input=(id,events)=>({op:'add',path:prefix(id)+'/gameplay/numericInput',value:events});
const patch=(path,value,op='replace')=>({op,path,value});
function fixture(t){
  const game=E.loadout.base();game.growth=E.growth.initialize({level:1,xp:0,attributePoints:7,perkPoints:0,attributes:{body:3,reflexes:3,intelligence:3,technical:3,cool:3}},'legacy');game.numeric=E.initialNumeric(game);
  const stat=require('../../卡片源码/运行时/roster.js').initialize(A.initialize({terminal:{gameplay:{...game,future:false},wallet:{yen:333,earned:0,spent:0}},future:{keep:1}}));
  stat.terminal.gameplay.sanity.checkModifier=0; // Already initialized neutral SAN modifier, before narrative settlement.
  const handlers=new Map(),c={chat:[{mes:'合成开场'},{is_user:true,mes:'合成动作'}],eventTypes:{}},api={SillyTavern:{getContext:()=>c},eventOn(n,f){if(!handlers.has(n))handlers.set(n,new Set());handlers.get(n).add(f);},eventRemoveListener:(n,f)=>handlers.get(n)?.delete(f)};
  const emit=async(n,...args)=>{for(const f of handlers.get(n)||[])await f(...args);},ex=executor(emit);api.Mvu={events:{COMMAND_PARSED:Guard.events.parsed,VARIABLE_UPDATE_ENDED:Guard.events.ended},parseMessage:ex.run};
  const data={stat_data:stat,schema:copy(ex.schema(copy(stat))),other:{keep:true}};data.schema.strictSet=true;data.schema.strictTemplate=false;
  data.schema.properties.terminal.properties.gameplay.extensible=true;data.schema.properties.terminal.properties.gameplay.recursiveExtensible=true;
  data.schema.properties.terminal.properties.ensemble.extensible=true;data.schema.properties.terminal.properties.ensemble.recursiveExtensible=true;
  c.chat[0].variables=[data];const win={},guard=Guard.create({api,win,runtime:{key:()=> 'ensemble-test'},schema,policy:()=>({mapIndex:{central:['clinic','plaza']}})});t.after(()=>guard.destroy());
  async function run(patches,before=data){const next=copy(before);await ex.run('<UpdateVariable><JSONPatch>'+JSON.stringify(patches)+'</JSONPatch></UpdateVariable>',next);return copy(next);}
  return {data,run,guard,api,win};
}
test('pinned MVU executor settles player and both actors together with isolated receipts',async t=>{
  const f=fixture(t),patches=[patch('/terminal/gameplay/numericInput',[event('same_id',-3)],'add'),input('wb_10',[event('same_id',-7)]),input('wb_6',[event('same_id',-11)])];
  const after=await f.run(patches);assert.equal(f.guard.state().lastError,'');assert.equal(after.stat_data.terminal.gameplay.numeric.vitals.hp,92);assert.equal(A.project(after.stat_data,'wb_10').vitals.hp,118);assert.equal(A.project(after.stat_data,'wb_6').vitals.hp,112);
  assert.equal(after.stat_data.terminal.gameplay.numericInput,undefined);assert.equal(A.read(after.stat_data,'wb_10').gameplay.numericInput,undefined);assert.deepEqual(after.stat_data.future,{keep:1});assert.deepEqual(after.other,{keep:true});
  assert.deepEqual((await f.run(patches,after)).stat_data,after.stat_data);
});
test('an invalid actor keeps its prior state while valid player and NPC changes save',async t=>{
  const f=fixture(t),patches=[patch('/terminal/gameplay/numericInput',[event('player_valid',-4)],'add'),input('wb_10',[event('npc_valid',-6)]),input('missing',[event('missing',-2)])];
  const after=await f.run(patches);assert.equal(f.guard.state().lastError,'');assert.equal(after.stat_data.terminal.gameplay.numeric.vitals.hp,f.data.stat_data.terminal.gameplay.numeric.vitals.hp-4);assert.equal(A.project(after.stat_data,'wb_10').vitals.hp,A.project(f.data.stat_data,'wb_10').vitals.hp-6);assert.equal(after.stat_data.terminal.ensemble.actors.missing,undefined);
  const supplied=await f.run([input('wb_10',[event('npc',-1)]),patch(prefix('wb_6')+'/wallet/yen',9000)]);assert.equal(A.read(supplied.stat_data,'wb_6').wallet.yen,9000);assert.equal(f.guard.state().lastError,'');
});
test('actor purchase debits its own wallet once and original wallet remains unchanged',async t=>{
  const f=fixture(t),gain={id:'purchase',kind:'item-gain',item:{template:'pistol',tier:1},quantity:1,reason:'合成交易已交钱拿到手枪'},changes=[input('wb_6',[gain]),patch(prefix('wb_6')+'/wallet/yen',1500),patch(prefix('wb_6')+'/wallet/spent',500)];
  const after=await f.run(changes);assert.equal(f.guard.state().lastError,'');assert.equal(A.read(after.stat_data,'wb_6').wallet.yen,1500);assert.equal(A.read(after.stat_data,'wb_6').gameplay.inventory.pistol_t1.quantity,1);assert.deepEqual(after.stat_data.terminal.wallet,f.data.stat_data.terminal.wallet);
  assert.deepEqual((await f.run(changes.map(p=>p.path.endsWith('/yen')?{...p,value:1000}:p.path.endsWith('/spent')?{...p,value:1000}:p),after)).stat_data,after.stat_data);
});
test('new actor equipment and its purchase commit directly while other actor progress stays independent',async t=>{
  const f=fixture(t),changes=[input('wb_6',[{id:'unknown_buy',kind:'item-gain',item:{id:'actor_story_weapon',name:'测试未登记型号',category:'weapon',tier:2},reason:'合成交易'}]),patch(prefix('wb_6')+'/wallet/yen',1000),patch(prefix('wb_6')+'/wallet/spent',1000),input('wb_10',[event('other_damage',-5)])];
  const after=await f.run(changes);assert.equal(f.guard.state().lastError,'');const actor=A.read(after.stat_data,'wb_6');assert.equal(actor.gameplay.inventory.actor_story_weapon.quantity,1);assert.equal(actor.gameplay.loadout.pendingTransactions,undefined);assert.equal(actor.wallet.yen,1000);assert.equal(actor.wallet.spent,1000);assert.equal(A.project(after.stat_data,'wb_10').vitals.hp,120);assert.deepEqual(after.stat_data.terminal.wallet,f.data.stat_data.terminal.wallet);
  assert.deepEqual((await f.run(changes,after)).stat_data,after.stat_data);
  const request={action:'equip',actorId:'wb_6',id:'actor_story_weapon',slot:'weapon_1'},options={request,actorBinding:A.binding(after.stat_data,'wb_6')},equipped=O.plan(after.stat_data,request,options);schema.program(after.stat_data,equipped,{engineOperation:options});assert.equal(A.read(equipped,'wb_6').gameplay.equipment.weapon_1.itemId,'actor_story_weapon');assert.deepEqual(A.read(equipped,'wb_10'),A.read(after.stat_data,'wb_10'));
});
test('actor locations accept registered values; unreadable owned fields retain their values',async t=>{
  const f=fixture(t),changes=[patch(prefix('wb_10')+'/gameplay/location',{mapId:'central',placeId:'clinic'},'add')],after=await f.run(changes);assert.equal(f.guard.state().lastError,'');assert.deepEqual(A.project(after.stat_data,'wb_10').location,{mapId:'central',placeId:'clinic'});
  for(const p of [patch(prefix('wb_10')+'/gameplay/location',{mapId:'central',placeId:'invented'},'add'),patch(prefix('wb_10')+'/gameplay/growth/level',50),patch('/terminal/ensemble/control/actorId','wb_10'),patch(prefix('wb_10'),{})]){const value=await f.run([p]);assert.equal(f.guard.state().lastError,'');assert.equal(A.read(value.stat_data,'wb_10').gameplay.growth.level,A.read(f.data.stat_data,'wb_10').gameplay.growth.level);assert.equal(value.stat_data.terminal.ensemble.control.actorId,f.data.stat_data.terminal.ensemble.control.actorId);assert.deepEqual(A.project(value.stat_data,'wb_10').location,A.project(f.data.stat_data,'wb_10').location);}
});

test('pinned MVU applies a frozen actor round only to that actor alongside other actor facts',async t=>{
 const f=fixture(t),B=require('../../卡片源码/运行时/battle.js'),state=f.data.stat_data,game=A.read(state,'wb_10').gameplay;
 state.terminal.ensemble.actors.wb_10.gameplay=B.operation(game,{action:'battle-start',id:'actor_fight',mode:'cheat',draft:{...B.seed(game),enemies:[B.actor({id:'enemy',template:'thug'})]}});
 const before=copy(state),ticket={...B.prepare(A.read(state,'wb_10').gameplay,{id:'actor_round',roll:0.9,source:{floor:2,swipe:0}}),actorId:'wb_10'};f.win.__cxx_battle__={pendingFor:()=>ticket};f.api.SillyTavern.getContext().chat.push({mes:'祥子完成本轮交锋后取得了现场留下的物品。<ztl>{"characters":[{"name":"丰川祥子"},{"name":"千早爱音"}]}</ztl>',is_user:false,swipe_id:0});
 const patches=[input('wb_10',[{id:'post_round_item',kind:'item-gain',item:{template:'pistol',tier:1},quantity:1,reason:'已取得物品'}]),input('wb_6',[event('other_actor_hit',-3)]),patch('/terminal/gameplay/numericInput',[event('original_player_hit',-2)],'add')],after=await f.run(patches);
 assert.equal(f.guard.state().lastError,'');const expected=B.operation(A.read(before,'wb_10').gameplay,{action:'battle-resolve',pending:ticket});assert.equal(A.read(after.stat_data,'wb_10').gameplay.numeric.vitals.hp,expected.numeric.vitals.hp);assert.equal(A.read(after.stat_data,'wb_10').gameplay.numeric.combat.round,1);assert.equal(A.read(after.stat_data,'wb_10').gameplay.inventory.pistol_t1.quantity,1);assert.equal(A.read(after.stat_data,'wb_6').gameplay.numeric.vitals.hp,120);assert.equal(after.stat_data.terminal.gameplay.numeric.vitals.hp,before.terminal.gameplay.numeric.vitals.hp-2);for(const id of ['player','wb_6'])assert.equal(A.read(after.stat_data,id).gameplay.numeric.receipts.actor_round,undefined);assert.deepEqual((await f.run(patches,after)).stat_data,after.stat_data);
});

test('a frozen actor tactical narrative is inherited even with no model patch and keeps all other actors intact',async t=>{
 const f=fixture(t),pair=require('../lib/fixture-loader.cjs')('../当前/tactical-narrative.test.cjs',['pair']).pair(),before=f.data.stat_data;before.terminal.ensemble.actors.wb_10.gameplay=copy(pair.before);f.win.__cxx_tactical__={narrativeBase:()=>({actorId:'wb_10',game:pair.after,source:{floor:2,hash:'new_actor_scene'}})};f.api.SillyTavern.getContext().chat.push({mes:'已保存的战术行动在本轮正文中展开。<ztl>{"characters":[{"name":"丰川祥子"}]}</ztl>',is_user:false});const original=copy(before),after=await f.run([]);assert.equal(f.guard.state().lastError,'');assert.equal(A.read(after.stat_data,'wb_10').gameplay.tactical.encounter.source.hash,'new_actor_scene');assert.equal(A.read(after.stat_data,'wb_10').gameplay.inventory.tac_supply_light.quantity,28);assert.deepEqual(A.read(after.stat_data,'player'),A.read(original,'player'));assert.deepEqual(A.read(after.stat_data,'wb_6'),A.read(original,'wb_6'));assert.deepEqual((await f.run([])).stat_data,after.stat_data);
});

test('duplicate model damage keeps the owning actor committed tactical action',async t=>{
 const f=fixture(t),pair=require('../lib/fixture-loader.cjs')('../当前/tactical-narrative.test.cjs',['pair']).pair(),before=f.data.stat_data;before.terminal.ensemble.actors.wb_10.gameplay=copy(pair.before);f.win.__cxx_tactical__={narrativeBase:()=>({actorId:'wb_10',game:pair.after,source:{floor:2,hash:'kept_actor_scene'}})};f.api.SillyTavern.getContext().chat.push({mes:'已结算的伤害不应由正文重复扣除。<ztl>{"characters":[{"name":"丰川祥子"}]}</ztl>',is_user:false});const original=copy(before),after=await f.run([input('wb_10',[event('duplicate_loss',-9)])]);
 assert.equal(f.guard.state().lastError,'');const game=A.read(after.stat_data,'wb_10').gameplay;assert.equal(game.inventory.tac_supply_light.quantity,28);assert.equal(game.numeric.vitals.hp,pair.after.numeric.vitals.hp);assert.equal(game.tactical.encounter.source.hash,'kept_actor_scene');assert.equal(game.numeric.receipts.duplicate_loss,undefined);for(const id of ['player','wb_6'])assert.deepEqual(A.read(after.stat_data,id),A.read(original,id));
});
