'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../../卡片源码/运行时/police.js'),C=require('../../卡片源码/运行时/civic.js');
const S=require('../../卡片源码/MVU/schema.js'),E=require('../../卡片源码/数值引擎/src/engine.js'),A=require('../../卡片源码/运行时/ensemble-state.js');
const I=require('../../卡片源码/运行时/identity.js'),O=require('../../卡片源码/运行时/player-operations.js');
const {executor}=require('../MVU/mvu-fixture.cjs');
const schema=S.build(require('../../独立制卡器/node_modules/zod'));
const quote='当班警员确认了现场经过，并在当事人面前登记本次处理的实际结果。';
const baseTime=P.minute('2051-05-01','12:00');
const event=(id,event,rest={})=>({id,event,actorId:'player',kind:'happened',quote,...rest});
const report=(id,rest={})=>event('report_'+id,'report',{caseId:id,district:'lowtown',knownVia:'onscene',identityKnown:true,charges:[{category:'assault',struck:true,harm:'injury'}],...rest});
function state(){const game=E.loadout.initial('street',{weapon:'pistol'}),identity=I.snapshot('street','',I.initialSetup('street'));game.growth=E.growth.initialize(identity.growthSetup,identity.id);game.numeric=E.initialNumeric(game,undefined,E.loadout.effects(game));game.location={mapId:'tokyo-central',placeId:'akabane'};return {terminal:{gameplay:game,wallet:{yen:600000,earned:600000,spent:0},quests:{}},unknown:{keep:false}};}
function raw(now){const d=new Date(now*60000);return quote+'<ztl>'+JSON.stringify({date:d.toISOString().slice(0,10),time:d.toISOString().slice(11,16)})+'</ztl>';}
function policy(now,tag){return {mapIndex:{'tokyo-central':['akabane']},numericOptions:{storyText:quote,rawStory:raw(now),source:{floor:2,swipe:0,story:tag},factBatch:'fact_'+tag}};}
async function run(before,events=[],now=baseTime,tag='one',more=[],extraPolicy={}){
 const patches=[...(events.length?[{op:'add',path:'/terminal/policeInput',value:events}]:[]),...more];let tx;
 const ex=executor(async(name,data,commands)=>{
  if(name==='mag_command_parsed'){tx=schema.prepare(patches,before,{...policy(now,tag),...extraPolicy});C.extendSchema(data.schema);A.extendSchema(data.schema);require('../../卡片源码/运行时/quests.js').extendSchema(data.schema);commands.splice(0,commands.length,...schema.commands(tx.patches));}
  if(name==='mag_variable_update_ended')schema.check(tx,before,data.stat_data);
 });
 const data={stat_data:structuredClone(before),schema:ex.schema(structuredClone(before))};data.schema.strictSet=true;data.schema.strictTemplate=false;
 for(const key of ['gameplay']){data.schema.properties.terminal.properties[key].extensible=true;data.schema.properties.terminal.properties[key].recursiveExtensible=true;}
 await ex.run('<UpdateVariable><JSONPatch>'+JSON.stringify(patches)+'</JSONPatch></UpdateVariable>',data);schema.check(tx,before,data.stat_data);return structuredClone(data.stat_data);
}
test('five-star hiding takes 60 story minutes and preserves a major warrant',async()=>{
 let s=await run(state(),[report('mass',{charges:[{category:'assault',struck:true,harm:'mass'}]}),event('hide_mass','hide',{caseId:'mass'})]);
 for(const [elapsed,stars]of [[19,5],[20,4],[39,4],[40,3],[49,3],[50,2],[55,1],[60,0]]){s=await run(s,[],baseTime+elapsed,'tick'+elapsed);assert.equal(P.view(s).stars,stars);}
 assert.equal(P.view(s).longTerm.length,1);assert.equal(s.terminal.police.cases.mass.weight,16);assert.deepEqual(s.unknown,{keep:false});
 s=await run(s,[event('seen_mass','locate',{caseId:'mass',recognition:'visual'})],baseTime+70,'seen');assert.equal(P.view(s).stars,5);
});
test('ordinary closed cases do not reopen; rediscovery resets unfinished search',async()=>{
 let s=await run(state(),[report('harm'),event('hide_harm','hide',{caseId:'harm'})]);
 s=await run(s,[],baseTime+10,'ten');assert.equal(P.view(s).stars,2);
 s=await run(s,[event('locate_harm','locate',{caseId:'harm',recognition:'scan'})],baseTime+11,'seen');assert.equal(P.view(s).stars,3);
 s=await run(s,[event('hide_again','hide',{caseId:'harm'})],baseTime+12,'hide');
 s=await run(s,[],baseTime+31,'later');assert.equal(P.view(s).stars,1);
 s=await run(s,[],baseTime+32,'done');assert.equal(P.view(s).stars,0);assert.equal(s.terminal.police.cases.harm.ordinary,false);
 await assert.rejects(run(s,[event('old_seen','locate',{caseId:'harm',recognition:'visual'})],baseTime+33,'old'),/已结束/);
});
test('same case max, independent fines sum, one payment, civilian NPC ownership',async()=>{
 let s=A.initialize(state());s=await run(s,[report('one',{charges:[{category:'assault',struck:true,harm:'injury'},{category:'robbery',threat:true}]}),report('two',{actorId:'wb_6',district:'underpool'}),event('fine_one','assess-fine',{caseId:'one'}),event('fine_two','assess-fine',{caseId:'two',actorId:'wb_6'})]);
 assert.equal(s.terminal.police.cases.one.level,3);assert.equal(s.terminal.police.cases.one.fineDue,30000);assert.equal(s.terminal.police.cases.two.fineDue,24000);assert.equal(P.view(s,'wb_6').stars,3);
 const before=structuredClone(s),pay=event('pay_one','pay-fine',{caseId:'one',amount:30000});s=await run(s,[pay],baseTime+1,'pay');assert.equal(s.terminal.wallet.yen,before.terminal.wallet.yen-30000);assert.equal(s.terminal.wallet.spent,30000);assert.equal(P.view(s).stars,3);
 const retry=await run(s,[pay],baseTime+1,'pay');assert.deepEqual(retry,s);
 const wrong=P.correction(s,'one'),corrected=O.plan(s,{action:'police-correct',id:'fix_one',...wrong},{actorBinding:A.binding(s,'player')});assert.equal(P.view(corrected).stars,0);assert.equal(P.view(corrected,'wb_6').stars,3);assert.equal(corrected.terminal.wallet.spent,30000);
});
test('registered archived cases count once toward a persistent 30-day warrant',async()=>{
 let s=state();for(let n=0;n<5;n++)s=await run(s,[report('case'+n),event('end'+n,'response-end',{caseId:'case'+n})],baseTime+n,'case'+n);
 assert.equal(P.view(s).stars,0);assert.equal(P.view(s).longTerm.length,1);assert.equal(P.view(s).longTerm[0].scope,'tokyo');
 s=await run(s,[],baseTime+31*1440,'aged');assert.equal(P.view(s).longTerm.length,1);
 const id=P.view(s).longTerm[0].id;s=await run(s,[event('settle','resolve-longterm',{warrantId:id,basis:'judgment'})],baseTime+31*1440+1,'settled');assert.equal(P.view(s).longTerm.length,0);
});
test('zero ordinary coverage is real; retries retain the same roll; unknown crimes are rejected',async()=>{
 let s=await run(state(),[report('underground',{placeId:'ring-basement-bar',district:'underpool',knownVia:'report'})]);assert.equal(s.terminal.police.cases.underground.probability,0);assert.equal(P.view(s).stars,0);
 const roll=s.terminal.police.cases.underground.roll;s=await run(s,[report('underground',{placeId:'ring-basement-bar',district:'underpool',knownVia:'report'})]);assert.equal(s.terminal.police.cases.underground.roll,roll);
 await assert.rejects(run(state(),[report('secret',{knownVia:'guess'})]),/警方须先/);
 for(const charge of [{category:'theft',taken:false,owner:'other',permission:false},{category:'theft',taken:true,owner:'other',permission:false,loot:true},{category:'intrusion',domain:'digital',action:'remained',authorization:'revoked'}])assert.throws(()=>P.classify(charge));
});
test('seizure and normal release move exact inventory once without re-equipping',async()=>{
 let s=await run(state(),[report('custody'),event('detain','detain',{detentionId:'detention',caseIds:['custody'],facility:'荒川警署',durationMinutes:30}),event('seize','seize',{caseId:'custody',detentionId:'detention',keeper:'荒川警署保管柜',items:[{itemId:'pistol_t1',quantity:1,type:'ordinary'}]})]);
 assert.equal(s.terminal.gameplay.inventory.pistol_t1.quantity,0);assert.equal(s.terminal.gameplay.equipment.weapon_1,null);
 await assert.rejects(run(s,[event('early','release',{detentionId:'detention',basis:'term'})],baseTime+1,'early'),/刑期未满/);
 const release=event('released','release',{detentionId:'detention',basis:'term'});s=await run(s,[release],baseTime+30,'release');assert.equal(s.terminal.gameplay.inventory.pistol_t1.quantity,1);assert.equal(s.terminal.gameplay.equipment.weapon_1,null);
 assert.deepEqual(await run(s,[release],baseTime+30,'release'),s);
});
test('detention restrictions disable installed effects and player activation until actual release',async()=>{
 let s=state(),game=s.terminal.gameplay,slot=E.loadout.list(game).find(x=>x.definition.template==='subdermal_armor').slot;
 const original=E.loadout.effects(game);s=await run(s,[report('restrict'),event('arrest','detain',{detentionId:'cell',caseIds:['restrict'],facility:'荒川警署',durationMinutes:5}),event('lock','restrict',{detentionId:'cell',slots:[slot]})]);
 assert(E.loadout.restricted(s.terminal.gameplay,slot));assert(E.loadout.effects(s.terminal.gameplay).length<original.length);assert(s.terminal.gameplay.equipment[slot]);
 assert.throws(()=>E.loadout.action(s.terminal.gameplay,{action:'unequip',slot}),/拘押限制/);
 s=await run(s,[event('normal_release','release',{detentionId:'cell',basis:'term'})],baseTime+5,'release');assert(!E.loadout.restricted(s.terminal.gameplay,slot));assert.equal(E.loadout.effects(s.terminal.gameplay).length,original.length);
});
module.exports={run,state,event,report,baseTime,quote};

test('police clock shares narrative boundaries instead of consuming planning tag mentions',()=>{assert.equal(P.clock('先考虑 <ztl>。\n</konatan_planning~>\n<cxx-story>警员记录了现场发生的事情。</cxx-story><ztl>{"date":"2051-05-01","time":"12:00"}</ztl>'),baseTime);assert.equal(P.clock('<tucao><ztl>{"date":"2051-05-01","time":"13:00"}</ztl></tucao>'),null);});
