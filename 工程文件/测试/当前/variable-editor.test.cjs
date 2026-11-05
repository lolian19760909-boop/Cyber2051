'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {E,G,state}=require('../数值引擎/helpers.cjs');
const V=require('../../卡片源码/运行时/variable-editor.js'),O=require('../../卡片源码/运行时/player-operations.js'),Schema=require('../../卡片源码/MVU/schema.js'),{z}=require('../../卡片源码/数据/validator.js');
function editorFixture(){const game={...E.loadout.base(state(15)),numeric:E.initialNumeric(state(15))};return {__cxx_identity:{setupToken:'preserve'},future:{flag:true},terminal:{wallet:{yen:100,earned:100,spent:0},quests:{known:{state:'进行中',objective:'旧目标'}},gameplay:game}};}
const request=(before,change,id='edit_one')=>{const value=V.editable(before);change(value);return {action:'variables-edit',id,changes:V.differences(V.editable(before),value)};};
const R=require('../../卡片源码/运行时/roster.js'),A=require('../../卡片源码/运行时/ensemble-state.js');
function rosterFixture(){const before=editorFixture(),game=before.terminal.gameplay,L=E.loadout,d=L.customDefinition({id:'fixture_neural',name:'验收神经义体',category:'cyberware',part:'nervous',tier:1,description:'验收物品',numericEffects:[]});game.itemDefinitions[d.id]=d;game.inventory[d.id]={quantity:1,definitionRef:d.definitionRef};game.equipment.cyber_nervous_1={itemId:d.id,instanceId:'fixture_neural_1',definitionRef:d.definitionRef};return R.initialize(before);}
test('manual growth corrections retain reward receipts and still support later allocation and rewards',()=>{
 const award={id:'earned_first',kind:'reward',source:{kind:'training',id:'completed-training'},xp:2050,attributePoints:3,perkPoints:4},earned=E.settle(state(40),[award]).state.growth,before=structuredClone(earned);
 const edited=G.correct(earned,{xp:500,attributePoints:7,perkPoints:8,attributes:{...earned.attributes,body:3}},'manual_one');
 assert.equal(edited.xp,500);assert.equal(edited.level,1);assert.equal(edited.attributes.body,3);assert.equal(edited.attributePoints,7);assert.deepEqual(edited.rewards,before.rewards);assert.deepEqual(earned,before);assert.deepEqual(G.read(JSON.parse(JSON.stringify(edited))),edited);
 const allocated=G.allocate(edited,{attributes:{...edited.attributes,body:4},perks:edited.perks});assert.equal(allocated.attributePoints,6);assert.equal(G.read(allocated).attributes.body,4);
 const next=G.planReward(allocated,{id:'earned_next',source:{kind:'story',id:'next-scene'},xp:4000});assert.equal(next.state.xp,4500);assert.deepEqual(G.read(next.state),next.state);assert.deepEqual(G.planReward(next.state,{id:'earned_next',source:{kind:'story',id:'next-scene'},xp:4000}).state,next.state);
 const restored=G.correct(edited,before,'manual_undo');for(const key of ['xp','level','attributes','perks','attributePoints','perkPoints'])assert.deepEqual(restored[key],before[key]);assert.deepEqual(restored.rewards,before.rewards);assert.equal(Object.keys(restored.corrections).length,2);
});
test('growth edits retain official prerequisites and reject altered accounting',()=>{
 const base=state(3).growth;assert.throws(()=>G.correct(base,{perks:{Body_Central_Milestone_1:1}},'invalid_perk'),/前置/);assert.throws(()=>G.correct(base,{xp:-1},'invalid_xp'),/整数/);
 const edited=G.correct(base,{attributePoints:0},'manual_points');assert.deepEqual(G.correct(edited,{attributePoints:0},'manual_points'),edited);assert.throws(()=>G.correct(edited,{attributePoints:1},'manual_points'),/已使用/);
 const bad=structuredClone(edited);bad.corrections.manual_points.attributePoints++;assert.throws(()=>G.read(bad),/不一致/);assert.equal(base.attributePoints,100);
});
test('correction can lower already allocated attributes and refund a saved talent without losing the edit',()=>{
 const base=state(3).growth,allocated=G.allocate(base,{attributes:{...base.attributes,body:20},perks:{Body_Central_Milestone_1:1}});
 const refunded=G.correct(allocated,{perks:{},perkPoints:allocated.perkPoints+1},'refund_talent');assert.deepEqual(refunded.perks,{});assert.equal(refunded.perkPoints,base.perkPoints);assert.deepEqual(G.read(refunded),refunded);
 const lowered=G.correct(refunded,{attributes:{...refunded.attributes,body:3}},'lower_attribute');assert.equal(lowered.attributes.body,3);assert.equal(lowered.attributePoints,allocated.attributePoints);assert.deepEqual(G.read(lowered),lowered);
});
test('common and advanced edits use the shared program plan, preserve storage fields and are idempotent',()=>{
 const before=editorFixture(),edit=request(before,value=>{value.terminal.wallet.yen=-250;value.terminal.gameplay.numeric.vitals.hp=12;value.future.flag=false;value.terminal.quests.known.objective='新目标';});
 const after=O.plan(before,edit);assert.equal(after.terminal.wallet.yen,-250);assert.equal(after.terminal.gameplay.numeric.vitals.hp,12);assert.equal(after.future.flag,false);assert.equal(after.terminal.quests.known.objective,'新目标');assert.deepEqual(after.__cxx_identity,before.__cxx_identity);assert.deepEqual(after.terminal.gameplay.growth.initial,before.terminal.gameplay.growth.initial);assert.equal(after.terminal.variableEdits.edit_one.changes.length,4);assert.deepEqual(Schema.build(z).program(before,after,{engineOperation:{request:edit}}),after);assert.deepEqual(O.plan(after,edit),after);
 assert.throws(()=>O.plan(after,{...edit,changes:edit.changes.slice(1)}),/编号已用于/);assert.equal(before.terminal.wallet.yen,100);
 const restored=O.plan(after,{action:'variables-edit',id:'undo_one',undoOf:edit.id,changes:V.undo(after,edit.id)});assert.deepEqual(V.editable(restored),V.editable(before));assert.equal(restored.terminal.variableEdits.edit_one.undoneBy,'undo_one');assert.throws(()=>V.undo(restored,edit.id),/已经撤回/);
});
test('conflicts, protected containers and malformed values fail before changing the original state',()=>{
 const before=editorFixture(),edit=request(before,value=>{value.terminal.wallet.yen=200;}),moved=structuredClone(before);moved.terminal.wallet.yen=300;assert.throws(()=>O.plan(moved,edit),/后续变化/);assert.equal(moved.terminal.wallet.yen,300);
 assert.throws(()=>O.plan(before,request(before,value=>{delete value.terminal.gameplay;})),/保存记录/);assert.throws(()=>O.plan(before,request(before,value=>{value.terminal.gameplay.growth.initial={xp:0};})),/保存系统|保存记录/);assert.throws(()=>O.plan(before,request(before,value=>{value.terminal.wallet.earned=-1;})),/钱包|wallet/);
 assert.throws(()=>O.plan(before,request(before,value=>{value.terminal.gameplay.numeric.vitals.hp=-1;})),/数值/);assert.equal(before.terminal.wallet.earned,100);
});
test('growth edits normalize the level, retain rewards, and undo through a second recorded correction',()=>{
 const before=editorFixture(),edit=request(before,value=>{value.terminal.gameplay.growth.xp=2050;value.terminal.gameplay.growth.attributes.body=3;value.terminal.gameplay.growth.attributePoints=2;}),after=O.plan(before,edit);assert.equal(after.terminal.gameplay.growth.level,3);assert.equal(after.terminal.gameplay.growth.attributes.body,3);assert.deepEqual(after.terminal.gameplay.growth.rewards,before.terminal.gameplay.growth.rewards);
 const restored=O.plan(after,{action:'variables-edit',id:'undo_growth',undoOf:edit.id,changes:V.undo(after,edit.id)});assert.deepEqual(V.editable(restored),V.editable(before));assert.equal(Object.keys(restored.terminal.gameplay.growth.corrections).length,2);
 const changed=structuredClone(after);changed.terminal.wallet.yen+=5;const reversed=O.plan(changed,{action:'variables-edit',id:'undo_unrelated',undoOf:edit.id,changes:V.undo(changed,edit.id)});assert.equal(reversed.terminal.wallet.yen,105);
});
test('equipment undo and redo restore recorded implantation effects without charging SAN again',()=>{
 const before=rosterFixture(),edit=request(before,value=>{value.terminal.gameplay.equipment=E.loadout.editEquipment(value.terminal.gameplay,{slot:'cyber_nervous_1',id:''}).equipment;}),after=O.plan(before,edit),reverse={action:'variables-edit',id:'restore_implant',undoOf:edit.id,changes:V.undo(after,edit.id)},restored=O.plan(after,reverse);
 assert.deepEqual(V.editable(restored),V.editable(before));assert.deepEqual(restored.terminal.gameplay.sanity.implants,before.terminal.gameplay.sanity.implants);assert.equal(restored.terminal.gameplay.sanity.value,100);
 const redone=O.plan(restored,{action:'variables-edit',id:'redo_implant',undoOf:reverse.id,changes:V.undo(restored,reverse.id)});assert.deepEqual(V.editable(redone),V.editable(after));assert.deepEqual(redone.terminal.gameplay.sanity.implants,after.terminal.gameplay.sanity.implants);
 assert.equal(V.editable(before).terminal.gameplay.sanity.receipts,undefined);assert.throws(()=>O.plan(before,request(before,value=>{value.terminal.gameplay.sanity.receipts={};})),/保存系统|保存记录/);
});
test('advanced numeric inputs are normalized for player, NPC, resources and quests, with other actors preserved',()=>{
 const before=rosterFixture(),actorId='wb_4',edit=request(before,value=>{value.terminal.wallet.yen='200';value.terminal.ensemble.actors[actorId].wallet.yen='7';value.terminal.ensemble.actors[actorId].gameplay.numeric.vitals.hp=10;value.terminal.quests.known.agreedYen='300';value.terminal.gameplay.resources={fixture_supply:'2'};});edit.actorId=actorId;edit.actorBinding=A.binding(before,actorId);const after=O.plan(before,edit,{actorBinding:edit.actorBinding});
 assert.equal(after.terminal.wallet.yen,200);assert.equal(after.terminal.ensemble.actors[actorId].wallet.yen,7);assert.equal(after.terminal.ensemble.actors[actorId].gameplay.numeric.vitals.hp,10);assert.equal(after.terminal.quests.known.agreedYen,300);assert.equal(after.terminal.gameplay.resources.fixture_supply,2);assert.deepEqual(after.terminal.ensemble.actors.wb_6,before.terminal.ensemble.actors.wb_6);assert.doesNotThrow(()=>require('../../卡片源码/运行时/gameplay.js').read(after));
 const view=V.editable(before);assert(view.terminal.ensemble.actors[actorId].gameplay);assert.equal(view.terminal.ensemble.control,undefined);assert.equal(view.terminal.ensemble.actors[actorId].stateRef,undefined);assert.throws(()=>O.plan(before,request(before,value=>{value.terminal.ensemble.actors.new_actor={name:'新人物'};})),/人物登记/);
});
test('editing a valid workshop story preserves qualified quest and content package references',()=>{
 const Q=require('../../卡片源码/运行时/quests.js'),before=Q.plan(editorFixture(),{action:'quest-accept',id:'accept_qualified',questId:'ugc.contract.98014.01',expectedRevision:0},{questDefinitions:[{id:'ugc.contract.98014.01',title:'已登记工坊委托'}],questSource:{floor:1,swipe:0}});
 before.terminal.quests['ugc.contract.98014.01'].definitionRef={packageId:'community.contract.98014',version:'1.0.1',questId:'ugc.contract.98014.01'};before.terminal.gameplay.inventory.ugc_item_fixture={quantity:1,definitionRef:{packageId:'community.shop_item.98017',version:'1.0.1',kind:'items',id:'ugc_item_fixture'}};
 const after=O.plan(before,request(before,value=>{value.terminal.wallet.yen='80';value.terminal.quests['ugc.contract.98014.01'].objective='修正后的目标';}));assert.equal(after.terminal.wallet.yen,80);assert.equal(after.terminal.quests['ugc.contract.98014.01'].objective,'修正后的目标');assert.deepEqual(after.terminal.gameplay.inventory,before.terminal.gameplay.inventory);assert.deepEqual(after.terminal.questJournal,before.terminal.questJournal);
});

test('native prompt projection keeps corrected player and present NPC values while storage retains edit ledgers',()=>{
 const before=rosterFixture();before.terminal.roster.present=['player','wb_4'];
 const after=O.plan(before,request(before,value=>{value.terminal.wallet.yen=-250;value.terminal.gameplay.growth.xp=2050;value.terminal.ensemble.actors.wb_4.gameplay.growth.xp=2050;})),saved=structuredClone(after),projected=R.promptState(after);
 assert.equal(projected.terminal.wallet.yen,-250);assert.equal(projected.terminal.gameplay.growth.xp,2050);assert.equal(projected.terminal.ensemble.actors.wb_4.gameplay.growth.xp,2050);
 assert.equal(projected.terminal.variableEdits,undefined);assert.equal(projected.terminal.gameplay.growth.corrections,undefined);assert.equal(projected.terminal.ensemble.actors.wb_4.gameplay.growth.corrections,undefined);
 assert.deepEqual(after,saved);assert(after.terminal.variableEdits.edit_one);assert(after.terminal.gameplay.growth.corrections.edit_one);assert(after.terminal.ensemble.actors.wb_4.gameplay.growth.corrections.edit_one);
});
