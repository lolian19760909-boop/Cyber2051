'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {E,G,state,stat,profiles,encounter,battle,applyPatches}=require('./helpers.cjs'),{mvu:M,story:S}=require("../../卡片源码/数值引擎/index.cjs");
const input=events=>[{op:'add',path:M.inputPath,value:events}],reward=(extra={})=>({id:'training_one',kind:'reward',source:{kind:'training',id:'actual_training'},xp:2050,attributePoints:3,perkPoints:4,...extra});

test('one event settles XP crossings and direct points; old growth and custom values round-trip',()=>{
  const s=state(40),old=structuredClone(s);const result=E.settle(s,[reward()]);const g=result.state.growth;assert.equal(g.level,3);assert.equal(g.xp,2050);assert.equal(g.attributePoints,105);assert.equal(g.perkPoints,306);assert.deepEqual(g.attributes,s.growth.attributes);assert.deepEqual(s,old);assert.deepEqual(G.read(JSON.parse(JSON.stringify(g))),g);
  assert.deepEqual(E.settle(result.state,[reward()]).state,result.state);assert.throws(()=>E.settle(result.state,[reward({xp:3000})]),{code:'growth-reward-conflict'});
});
test('high custom levels keep their offset without retroactive points and curve versions stay explicit',()=>{
  const s=state();s.growth=G.initialize({...s.growth,level:999,initial:undefined,rewards:undefined},'custom');const g=E.settle(s,[reward({xp:1000,attributePoints:0,perkPoints:0})]).state.growth;assert.equal(g.level,1000);assert.equal(g.perkPoints,301);
  const bad=structuredClone(g);bad.rulesRef.version='unknown';assert.throws(()=>G.read(bad),{code:'growth-rules-ref'});
});
test('allocation still observes official gates and point budgets',()=>{
  const s=state(3),draft=G.build(s.growth);draft.perks.Body_Central_Milestone_1=1;assert.throws(()=>G.allocate(s.growth,draft),{code:'talent-prerequisite'});draft.attributes.body=4;const next=G.allocate(s.growth,draft);assert.equal(next.attributePoints,99);assert.equal(next.perkPoints,299);assert.equal(next.perks.Body_Central_Milestone_1,1);assert.equal(s.growth.perks.Body_Central_Milestone_1,undefined);
});
test('MVU input becomes exact numeric patches without retaining the temporary input',()=>{
  const before=stat(),t=M.prepare(before,input([reward(),{id:'hurt',kind:'resource',resource:'hp',amount:-12.5,reason:'擦伤'}]),{profiles});
  const after=applyPatches(before,t.patches);assert.equal(M.checkPrepared(t,before,after),true);assert.equal(after.terminal.gameplay.numeric.vitals.hp,E.maximums({},E.rules,[],after.terminal.gameplay.growth).hp-12.5);assert.equal(after.terminal.gameplay.growth.xp,2050);assert.equal(after.terminal.gameplay.numericInput,undefined);assert.deepEqual(after.other,before.other);assert.deepEqual(after.terminal.wallet,before.terminal.wallet);
  const again=M.prepare(after,input([reward(),{id:'hurt',kind:'resource',resource:'hp',amount:-12.5,reason:'擦伤'}]),{profiles});assert.deepEqual(again.patches,[]);assert.equal(again.duplicates.length,2);
  const incomplete=structuredClone(after);incomplete.terminal.gameplay.growth=before.terminal.gameplay.growth;assert.throws(()=>M.checkPrepared(t,before,incomplete),/完整保存/);
});
test('unrelated wallet updates do not invalidate a numeric commit or confirmed allocation',()=>{
  const before=stat(),patches=[...input([reward()]),{op:'replace',path:'/terminal/wallet/yen',value:120},{op:'replace',path:'/terminal/wallet/earned',value:120}],tx=M.prepare(before,patches),after=applyPatches(before,tx.patches);assert.equal(M.checkPrepared(tx,before,after),true);
  const draft=G.build(before.terminal.gameplay.growth);draft.attributes.body++;const plan=M.allocation(before,draft),ticket={id:'act_saved',requestHash:'same',plan};const saved=applyPatches(before,plan.changes.map(c=>({op:'replace',path:'/'+c.path.join('/'),value:c.after})));saved.terminal.wallet={yen:90,earned:100,spent:10};saved.terminal.gameplay.results={act_saved:{requestHash:'same',status:'success'}};
  assert.equal(M.verifyAction(ticket,saved).status,'success');saved.terminal.gameplay.growth.attributePoints++;assert.equal(M.verifyAction(ticket,saved).status,'unconfirmed');
});
test('the MVU model cannot supply computed growth/odds or combine conflicting parent writes',()=>{
  const before=stat();assert.throws(()=>M.prepare(before,[{op:'replace',path:'/terminal/gameplay/growth/xp',value:9999}]),/数值模块/);
  assert.throws(()=>M.prepare(before,[...input([reward()]),{op:'replace',path:'/terminal/gameplay',value:{}}]),/整层替换/);
  assert.throws(()=>E.settle(state(),[{id:'odd',kind:'feature'}]),/未支持的数值事件/);
});
test('story reads the selected swipe; regenerate uses its predecessor and cannot inherit discarded rewards',()=>{
  const before=stat(),after=structuredClone(before);before.terminal.gameplay=E.settle(before.terminal.gameplay,[{id:'seed',kind:'resource',resource:'hp',amount:-1,reason:'擦伤'}]).state;after.terminal.gameplay=E.settle(before.terminal.gameplay,[reward()],{profiles}).state;
  const messages=[{mes:'prior',variables:[{stat_data:before}]},{is_user:true,mes:'行动'},{mes:'discarded',swipe_id:1,variables:[{stat_data:before},{stat_data:after}]}];
  assert.equal(S.snapshot(messages).swipe,1);assert.equal(S.snapshot(messages).stat.terminal.gameplay.growth.xp,2050);assert.equal(S.snapshot(messages,'regenerate').stat.terminal.gameplay.growth.xp,0);
  assert.equal(S.prompt(messages,{type:'normal',owner:'mvu',profiles}),'');assert.equal(S.prompt(messages,{type:'regenerate',profiles}),'');
  delete messages[0].variables;assert.equal(S.snapshot(messages,'regenerate'),null);assert.equal(S.prompt(messages,{type:'regenerate',profiles}),'');
});
test('same circumstances retain the same advice across rewrites without scripting the winner',()=>{
  const s=battle(),a=E.evaluateCombat(s,{profiles}),b=E.evaluateCombat(s,{profiles});assert.deepEqual(a,b);assert.equal(a.winner,undefined);assert.equal(E.shortPrompt(a),E.shortPrompt(b));assert.ok(E.shortPrompt(a).includes('若玩家无明确要求'));
});
