const test=require('node:test');
const assert=require('node:assert/strict');
const G=require("../../卡片源码/运行时/gameplay.js");
const growth=G.growth;
const clone=value=>JSON.parse(JSON.stringify(value));
// Isolated arithmetic values, not the authored curve for the actual card.
const rules={schema:1,id:'growth_fixture',version:'fixture-1',levels:[
  {level:1,xp:0,attributePoints:0,perkPoints:0},
  {level:2,xp:100,attributePoints:1,perkPoints:1},
  {level:3,xp:300,attributePoints:1,perkPoints:2},
  {level:4,xp:600,attributePoints:0,perkPoints:1}
]};
const start=(extra={})=>growth.initialize(rules,{level:1,xp:0,attributePoints:7,perkPoints:0,...extra});
const reward=(extra={})=>({id:'quest_delivery_complete',source:{kind:'quest',id:'delivery-instance-1',definitionRef:{packageId:'fixture-pack',version:'1',kind:'contracts',id:'delivery'}},...extra});

test('experience and direct points are both awarded by one completed event',()=>{
  const before=start({xp:80}),result=growth.planReward(before,rules,reward({xp:40,attributePoints:2,perkPoints:3}));
  assert.deepEqual(result.earned,{xp:40,attributePoints:3,perkPoints:4,levels:1});
  assert.equal(result.state.level,2);assert.equal(result.state.xp,120);
  assert.equal(result.state.attributePoints,10);assert.equal(result.state.perkPoints,4);
  assert.equal(before.xp,80);assert.deepEqual(before.rewards,{});
});

test('one award can cross multiple different level rewards without losing remaining experience',()=>{
  const result=growth.planReward(start(),rules,reward({xp:650}));
  assert.deepEqual(result.earned,{xp:650,attributePoints:2,perkPoints:4,levels:3});
  assert.equal(result.state.level,4);assert.equal(result.state.xp,650);
});

test('direct training rewards do not require gaining experience or a level',()=>{
  const result=growth.planReward(start(),rules,{id:'training_a',source:{kind:'training',id:'session-a'},perkPoints:2});
  assert.equal(result.state.level,1);assert.equal(result.state.xp,0);
  assert.equal(result.state.perkPoints,2);assert.equal(result.state.attributePoints,7);
});

test('replaying a saved reward is a no-op; changing its values or source is rejected',()=>{
  const grant=reward({xp:100,perkPoints:2}),first=growth.planReward(start(),rules,grant);
  const replay=growth.planReward(first.state,rules,clone(grant));
  assert.equal(replay.duplicate,true);assert.deepEqual(replay.changes,[]);
  assert.deepEqual(replay.state,first.state);
  assert.throws(()=>growth.planReward(first.state,rules,{...grant,xp:200}),{code:'growth-reward-conflict'});
  assert.throws(()=>growth.planReward(first.state,rules,{...grant,source:{kind:'quest',id:'another-instance'}}),{code:'growth-reward-conflict'});
});

test('a later reward instance is independent and unrelated character fields survive',()=>{
  const source=start({attributes:{body:4,custom:'keep'},perks:{existing:1},custom:{note:'keep'}});
  const snapshot=clone(source),first=growth.planReward(source,rules,reward({xp:50}));
  const second=growth.planReward(first.state,rules,{...reward({xp:50}),id:'quest_delivery_second',source:{kind:'quest',id:'delivery-instance-2'}});
  assert.equal(second.state.level,2);assert.equal(Object.keys(second.state.rewards).length,2);
  assert.deepEqual(second.state.attributes,source.attributes);assert.deepEqual(second.state.perks,source.perks);
  assert.deepEqual(second.state.custom,source.custom);assert.deepEqual(source,snapshot);
});

test('at the configured level cap, direct points still work and no extra level rewards appear',()=>{
  const result=growth.planReward(start({level:4,xp:600,attributePoints:0}),rules,reward({xp:200,attributePoints:2,perkPoints:1}));
  assert.equal(result.state.level,4);assert.equal(result.state.xp,800);
  assert.deepEqual(result.earned,{xp:200,attributePoints:2,perkPoints:1,levels:0});
});

test('confirmed higher-level starts do not retroactively grant earlier rewards',()=>{
  const state=start({level:3,xp:350,attributePoints:4,perkPoints:2});
  assert.equal(state.attributePoints,4);assert.equal(state.perkPoints,2);assert.deepEqual(state.rewards,{});
  assert.deepEqual(growth.planReward(state,rules,reward({xp:250})).earned,{xp:250,attributePoints:0,perkPoints:1,levels:1});
});

test('missing starts, inconsistent levels, changed rules and invalid amounts do not fabricate progression',()=>{
  assert.throws(()=>growth.read(undefined,rules),{code:'growth-uninitialized'});
  assert.throws(()=>start({level:2,xp:0}),{code:'growth-state'});
  assert.throws(()=>growth.read(start(),{...rules,version:'fixture-2'}),{code:'growth-rules-ref'});
  assert.throws(()=>growth.planReward(start(),rules,reward({xp:-1})),{code:'gameplay-number'});
  assert.throws(()=>growth.planReward(start(),rules,reward({perkPoints:1.5})),{code:'gameplay-number'});
  const invalid=clone(rules);invalid.levels[2].xp=100;
  assert.throws(()=>growth.validateRules(invalid),{code:'growth-rules'});
  const awarded=growth.planReward(start(),rules,reward({xp:10})).state;
  assert.throws(()=>growth.initialize(rules,awarded),{code:'growth-initial'});
});

test('custom origins can keep cheat-level starts while earning only their new growth',()=>{
  const state=start({unrestricted:true,level:999,xp:0,attributePoints:10000000000,perkPoints:9999,attributes:{body:999}});
  assert.equal(state.level,999);assert.equal(state.levelOffset,998);
  const result=growth.planReward(state,rules,reward({xp:100,perkPoints:3}));
  assert.equal(result.state.level,1000);assert.equal(result.state.attributePoints,10000000001);
  assert.equal(result.state.perkPoints,10003);assert.equal(result.state.attributes.body,999);
  assert.deepEqual(result.earned,{xp:100,attributePoints:1,perkPoints:4,levels:1});
  assert.deepEqual(growth.read(result.state,rules),result.state);
});

test('custom initial experience and level can be chosen independently without retroactive points',()=>{
  const state=start({unrestricted:true,level:10,xp:350,perkPoints:55});
  assert.equal(state.levelOffset,7);assert.equal(state.perkPoints,55);
  const result=growth.planReward(state,rules,reward({xp:250}));
  assert.equal(result.state.level,11);assert.equal(result.state.perkPoints,56);
  assert.deepEqual(result.earned,{xp:250,attributePoints:0,perkPoints:1,levels:1});
});
