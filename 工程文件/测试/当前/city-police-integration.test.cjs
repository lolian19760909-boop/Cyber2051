'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {run,state,event,report,baseTime,quote}=require('./police.test.cjs');
const City=require('../../卡片源码/运行时/city.js'),P=require('../../卡片源码/运行时/police.js'),A=require('../../卡片源码/运行时/ensemble-state.js'),O=require('../../卡片源码/运行时/player-operations.js'),B=require('../../卡片源码/运行时/battle.js');
const input=events=>({op:'add',path:'/terminal/cityInput',value:events.map(e=>({kind:'happened',quote,...e}))});
test('ordinary jurisdiction requires current pursuers or handoff while major warrants remain Tokyo-wide',async()=>{
 let s=await run(state(),[report('boundary')]);
 await assert.rejects(run(s,[event('outside','locate',{caseId:'boundary',placeId:'ring-live',recognition:'visual'})],baseTime+1,'outside'),/跨区/);
 s=await run(s,[event('handoff','locate',{caseId:'boundary',placeId:'ring-live',recognition:'visual',crossDistrict:'handoff'})],baseTime+1,'handoff');assert.equal(s.terminal.police.cases.boundary.lastKnown.district,'underpool');
 s=await run(s,[event('end','response-end',{caseId:'boundary'})],baseTime+2,'end');await assert.rejects(run(s,[event('ended_handoff','locate',{caseId:'boundary',placeId:'ring-live',recognition:'visual',crossDistrict:'handoff'})],baseTime+3,'again'),/已结束/);
});
test('same reply custody uses explicit story timestamps and nonregistered NPC money never hits player',async()=>{
 let s=await run(state(),[report('clock',{at:{date:'2051年5月1日星期一',time:'12:00'}}),event('start','detain',{detentionId:'short',caseIds:['clock'],facility:'荒川警署',durationMinutes:30,at:{date:'2051-05-01',time:'12:00'}}),event('finish','release',{detentionId:'short',basis:'term',at:{date:'2051-05-01',time:'12:30'}})],baseTime+30,'span');assert.equal(P.view(s).held,null);
 s=await run(s,[report('npc',{actorId:'npc_vendor',actorName:'现场商贩'}),event('fine','assess-fine',{caseId:'npc',actorId:'npc_vendor'}),event('paid','pay-fine',{caseId:'npc',actorId:'npc_vendor',amount:30000})],baseTime+31,'npc');assert.equal(s.terminal.wallet.spent,0);assert.equal(s.terminal.police.targets.npc_vendor.name,'现场商贩');
});
test('identity is learned separately; acquittal clears unpaid fine without undoing actual payments',async()=>{
 let s=await run(state(),[report('identity',{identityKnown:false,features:['红外套']}),event('identify','identify',{caseId:'identity',confirmed:true}),event('fine','assess-fine',{caseId:'identity'}),event('part','pay-fine',{caseId:'identity',amount:3000})]);assert.equal(P.view(s).cases[0].identity,undefined);
 s=await run(s,[event('learn','learn',{caseId:'identity',identity:true}),event('clear','resolve',{caseId:'identity',basis:'acquittal'})],baseTime+1,'clear');assert.equal(P.view(s).cases[0].identity,true);assert.equal(s.terminal.wallet.spent,3000);assert.equal(P.view(s).cases[0].fineDue,3000);
});
test('five-star planning uses the ordinary special threshold, not major public impact',async()=>{
 const s=await run(state(),[report('plot',{charges:[{category:'plotting',prepared:true,target:'广场',means:'爆炸物',act:'已安装装置',massTarget:true}]})]);assert.equal(s.terminal.police.cases.plot.special.threshold,60);assert.equal(P.view(s).longTerm.length,0);
 for(const [kind,unit]of Object.entries(P.rules.units)){const a=B.recognized({id:'police_'+kind,name:unit.name,template:unit.template,rank:'elite',equipment:[]},state().terminal.gameplay,{system:true});assert.equal(a.level,unit.level);assert.equal(a.equipment.length,unit.equipment.length);}
});
test('private address, permission and character knowledge are distinct; buttons only make drafts',async()=>{
 let s=A.initialize(state());const initial=structuredClone(s),home='rana-shifune-home';assert(!City.known(s,home));assert.deepEqual(City.actions(s,home).map(a=>a.id),['ask']);assert.deepEqual(s,initial);
 s=await run(s,[],baseTime,'known',[input([{id:'know_home',event:'discover',actorId:'player',placeId:home}])]);assert(City.known(s,home));assert(City.actions(s,home).some(a=>a.id==='request'));
 s=await run(s,[],baseTime+1,'access',[input([{id:'allow_home',event:'access',actorId:'player',placeId:home,allowed:true},{id:'meet',event:'contact',actorId:'player',placeId:home,person:'要乐奈'}])]);assert(!City.actions(s,home).some(a=>a.id==='request'));
 const other=A.preview(s,A.planControl(s,'wb_6'));assert(!City.known(other,home));assert(!City.context(other).includes('"person":"要乐奈"'));
 s=await run(s,[],baseTime+2,'closed',[input([{id:'closed_shop',event:'status',placeId:'service-underpool-weapon',status:'closed'}])]);assert.deepEqual(City.actions(s,'service-underpool-weapon').map(a=>a.id),['go','check']);
});
test('confirmed temporary place accepts later actual arrival; confirmation retry is idempotent',async()=>{
 let s=await run(state(),[],baseTime,'candidate',[input([{id:'new_place',event:'candidate',name:'临时避雨处',description:'正文已经确认的临时停留地点。',group:'lowtown',parentId:'akabane'}])]);
 const candidate=s.terminal.city.candidates.new_place,arrival={op:'replace',path:'/terminal/gameplay/location/placeId',value:candidate.id};
 await assert.rejects(run(s,[],baseTime+1,'unconfirmed',[arrival]),/未登记/);
 const request={action:'city-confirm-place',id:'confirm_new',candidateId:'new_place',expected:JSON.stringify(candidate)},beforeLocation=structuredClone(s.terminal.gameplay.location);s=O.plan(s,request);assert.deepEqual(s.terminal.gameplay.location,beforeLocation);assert.deepEqual(O.plan(s,request),s);
 s=await run(s,[],baseTime+1,'arrive',[arrival]);assert.equal(s.terminal.gameplay.location.placeId,candidate.id);
});
test('actual treatment and narrative credit settle in the original numeric and wallet transaction',async()=>{
 const before=state();before.terminal.gameplay.numeric.vitals.hp=10;
 const s=await run(before,[],baseTime,'treatment',[{op:'add',path:'/terminal/gameplay/numericInput',value:[{id:'treatment',kind:'resource',resource:'hp',amount:25,reason:quote}]},{op:'replace',path:'/terminal/wallet/yen',value:-100},{op:'replace',path:'/terminal/wallet/spent',value:600100}]);assert.equal(s.terminal.gameplay.numeric.vitals.hp,35);assert.equal(s.terminal.wallet.yen,-100);
 assert.deepEqual(await run(state(),[],baseTime,'empty',[{op:'add',path:'/terminal/policeInput',value:[]},input([])]),state());
});

test('a corrected crime cannot restart detention or a pending special response',async()=>{
 let s=await run(A.initialize(state()),[report('correctable',{charges:[{category:'assault',struck:true,harm:'mass'}]})]);
 assert.equal(s.terminal.police.cases.correctable.special.state,'dispatched');
 s=O.plan(s,{action:'police-correct',id:'correct_crime',...P.correction(s,'correctable')},{actorBinding:A.binding(s,'player')});
 await assert.rejects(run(s,[event('invalid_arrest','detain',{detentionId:'new_cell',caseIds:['correctable'],facility:'荒川警署',durationMinutes:30})],baseTime+10,'invalid_arrest'),/有效案件/);
 await assert.rejects(run(s,[event('invalid_special','special-arrival',{caseId:'correctable'})],baseTime+10,'invalid_special'),/已撤控或纠正/);
 assert.equal(P.view(s).stars,0);assert.equal(P.view(s).longTerm.length,0);
});
