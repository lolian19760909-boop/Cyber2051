'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../../卡片源码/运行时/ensemble-state.js'),V=require('../../卡片源码/运行时/ensemble-view.js');
function snapshot(){return {stat:A.initialize({terminal:{gameplay:{future:1},wallet:{yen:0,earned:0,spent:0}}}),storyProfile:{name:'原玩家',history:'原玩家私人经历'},floor:3,messages:[{},{},{},{swipe_id:2}]};}
test('default projection does not leak other actor names, IDs, totals, equipment or wallets',()=>{
  const s=snapshot(),before=structuredClone(s),p=V.project(s);assert.deepEqual(p.rows.map(r=>r.actorId),['player']);assert.equal(p.rows[0].wallet.yen,0);assert.equal(p.rows[0].vitals.hp.value,null);assert(!JSON.stringify(p).includes('丰川祥子'));assert(!JSON.stringify(p).includes('wb_6'));assert(!JSON.stringify(p).includes('12000'));assert.deepEqual(s,before);
});
test('author view uses approved state and cannot teach the viewpoint by browsing',()=>{
  const s=snapshot(),before=structuredClone(s),p=V.project(s,{mode:'author'});assert.equal(p.rows.length,3);const row=p.rows.find(r=>r.actorId==='wb_10');assert.equal(row.level,5);assert.equal(row.vitals.hp.max,125);assert.equal(row.wallet.yen,12000);assert.equal(row.perks[0].name,'飘忽不定');assert.equal(row.equipment.length,6);assert.deepEqual(s,before);assert.deepEqual(V.project(s).rows.map(r=>r.actorId),['player']);
});
test('controlled actor snapshot leaves canonical player paths intact and does not inherit their profile',()=>{
  const s=snapshot();s.stat=A.preview(s.stat,A.planControl(s.stat,'wb_6'));const p=V.selected(s);assert.equal(p.actor.id,'wb_6');assert.equal(p.actor.gameplay.numeric.vitals.hp,123);assert.deepEqual(p.stat.terminal.gameplay,{future:1});assert.deepEqual(p.actor.profile,{name:'千早爱音'});assert.equal(V.project(s).rows.length,1);assert.equal(V.project(s).rows[0].name,'千早爱音');
});
test('search and corrupt numeric state remain scoped to the selected view',()=>{
  const s=snapshot();assert.equal(V.project(s,{query:'祥子'}).rows.length,0);assert.equal(V.project(s,{mode:'author',query:'祥子'}).rows.length,1);s.stat.terminal.ensemble.actors.wb_10.gameplay.numeric.vitals.hp=-1;assert.equal(V.project(s,{mode:'author'}).rows.find(r=>r.actorId==='wb_10').status,'invalid');assert.equal(V.project(s).rows[0].status,'uninitialized');
});

test('task money is projected only for its owner and missing legacy ownership remains player',()=>{
  const s=snapshot();s.stat.terminal.quests={old:{state:'完成',paidYen:50},sakiko:{ownerActorId:'wb_10',state:'进行中',agreedYen:500,paidYen:100,refundedYen:0,objective:'只属于祥子的委托目标'},anon:{ownerActorId:'wb_6',state:'已接取',agreedYen:200},public:{state:'已发布'}};
  const before=structuredClone(s),player=V.project(s);assert.deepEqual(player.rows[0].quests.map(q=>q.id),['old']);assert(!JSON.stringify(player).includes('只属于祥子'));
  const author=V.project(s,{mode:'author'}),q=author.rows.find(r=>r.actorId==='wb_10').quests[0];assert.equal(q.paidYen,100);assert.equal(q.settled,false);q.objective='changed';assert.deepEqual(s,before);
  s.stat=A.preview(s.stat,A.planControl(s.stat,'wb_6'));assert.deepEqual(V.project(s).rows[0].quests.map(q=>q.id),['anon']);
});
