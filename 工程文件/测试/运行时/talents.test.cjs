const test=require('node:test'),assert=require('node:assert/strict');
const T=require("../../卡片源码/运行时/talents.js"),G=require("../../卡片源码/运行时/gameplay.js"),I=require("../../卡片源码/运行时/identity.js"),E=require("../../卡片源码/运行时/talent-effects.js");
const clone=structuredClone,start=(extra={})=>T.initialize({...I.initialSetup('custom'),...extra},'custom');
const earned=(s,extra={})=>G.growth.planReward(s,T.rules,{id:'event_one',source:{kind:'story',id:'scene-1'},xp:1000,...extra}).state;
const stats=growth=>({unrelated:{a:1},terminal:{wallet:{yen:234,earned:300,spent:66},gameplay:{schema:1,inventory:{kept:{quantity:2}},results:{},growth},quests:{existing:true}}});

test('all 179 official nodes have exact rank counts, sprites and in-tree prerequisites',()=>{
  const nodes=T.data.trees.flatMap(t=>t.nodes);assert.equal(nodes.length,179);assert.deepEqual(T.data.trees.map(t=>t.nodes.length),[33,37,38,34,37]);
  for(const n of nodes){assert.equal(E[n.id].length,n.ranks);assert.ok([4,9,15,20].includes(n.required));assert.ok(n.sprite.width>0);for(const id of n.requires)assert.equal(T.node(id).attribute,n.attribute);for(const p of n.paths)assert.ok(T.data.cables[p.name]);}
});
test('confirmed custom starts survive save/reload with unrestricted attributes and no retroactive rewards',()=>{
  const s=start({level:999,xp:35,attributePoints:888,perkPoints:777,attributes:{body:88,reflexes:45,intelligence:3,technical:3,cool:3},unknown:{keep:true}});
  assert.deepEqual(T.read(JSON.parse(JSON.stringify(s))),s);assert.equal(s.level,999);assert.equal(s.attributePoints,888);
  const next=earned(s,{xp:1000});assert.equal(T.read(next).level,1000);assert.equal(next.attributePoints,889);assert.deepEqual(next.unknown,{keep:true});
});
test('XP crossing and direct points coexist and a duplicate receipt cannot award twice',()=>{
  const s=start(),grant={id:'story_test',source:{kind:'story',id:'scene'},xp:2050,attributePoints:3,perkPoints:4};
  const first=G.growth.planReward(s,T.rules,grant);assert.equal(T.read(first.state).level,3);assert.equal(first.state.perkPoints,6);assert.equal(first.state.attributePoints,12);
  assert.deepEqual(G.growth.planReward(first.state,T.rules,grant).state,first.state);
  const bad=clone(first.state);bad.perkPoints++;assert.throws(()=>T.read(bad),{code:'growth-accounting'});
});
test('draft points respect 4/9/15/20 gates and full parent ranks, without mutating saved growth',()=>{
  const s=start({perkPoints:10}),before=clone(s);let d=T.build(s);
  assert.throws(()=>T.edit(s,d,{kind:'perk',id:'Body_Central_Milestone_1',delta:1}),{code:'talent-prerequisite'});
  d=T.edit(s,d,{kind:'attribute',id:'body',delta:1});d=T.edit(s,d,{kind:'perk',id:'Body_Central_Milestone_1',delta:1});
  assert.equal(T.allocate(s,d).perkPoints,9);assert.equal(T.allocate(s,d).attributePoints,6);assert.deepEqual(s,before);
  assert.throws(()=>T.edit(s,d,{kind:'perk',id:'Body_Central_Milestone_3',delta:1}),{code:'talent-prerequisite'});
  const mid=start({attributes:{body:15,reflexes:3,intelligence:3,technical:3,cool:3},perkPoints:10});let m=T.build(mid);m.perks.Body_Right_Milestone_2=1;m.perks.Body_Right_Milestone_3=1;
  assert.throws(()=>T.allocate(mid,m),{code:'talent-prerequisite'});
});
test('refunding a draft parent removes only dependent draft nodes, while saved ranks cannot be refunded',()=>{
  const s=start({attributes:{body:4,reflexes:3,intelligence:3,technical:3,cool:3},perkPoints:4});let d=T.build(s);
  for(const id of ['Body_Central_Milestone_1','Body_Central_Perk_1_1'])d=T.edit(s,d,{kind:'perk',id,delta:1});
  const refunded=T.edit(s,d,{kind:'perk',id:'Body_Central_Milestone_1',delta:-1});assert.deepEqual(refunded.perks,{});assert.equal(T.allocate(s,refunded).perkPoints,4);
  const saved=T.read(T.allocate(s,d));assert.throws(()=>T.edit(saved,T.build(saved),{kind:'perk',id:'Body_Central_Milestone_1',delta:-1}));
  assert.deepEqual(T.reset(saved,T.build(saved)).perks,saved.perks);
});
test('normal attributes stop at 20; custom values are not clamped and budgets still apply',()=>{
  const normal=T.initialize({...I.initialSetup('street'),attributePoints:40});const d=T.build(normal);d.attributes.body=21;assert.throws(()=>T.allocate(normal,d),{code:'talent-attribute'});
  const custom=start({attributePoints:100});const b=T.build(custom);b.attributes.body=40;assert.equal(T.allocate(custom,b).attributes.body,40);b.attributes.body=150;assert.throws(()=>T.allocate(custom,b),{code:'talent-budget'});
});
test('initialization and allocation plans preserve wallet, unrelated tables and unknown growth fields',()=>{
  const stat=stats(undefined);delete stat.terminal.gameplay.growth;const snapshot=I.snapshot('street','',I.initialSetup('street'));
  const init=T.plan(stat,{growthIdentity:snapshot},{action:'growth-initialize',initial:snapshot.growthSetup});assert.equal(init.changes[0].path.join('.'),'terminal.gameplay.growth');
  const s=init.changes[0].after;const saved=stats(s);assert.throws(()=>T.plan(saved,{},init.request),{code:'growth-initialized'});
  const build=T.build(s);build.attributes.body++;const p=T.plan(saved,{}, {action:'talent-allocate',build});const out=clone(saved);out.terminal.gameplay.growth=p.changes[0].after;out.terminal.gameplay.results.act_1={requestHash:'test',status:'success'};
  assert.equal(G.verify({id:'act_1',requestHash:'test',plan:p},out).status,'success');assert.equal(saved.terminal.gameplay.growth.attributes.body,4);assert.deepEqual(out.terminal.wallet,saved.terminal.wallet);assert.deepEqual(out.terminal.gameplay.inventory,saved.terminal.gameplay.inventory);
});
test('learned effects include only learned ranks and context stops repeating initial grants',()=>{
  const s=start({attributes:{body:15,reflexes:3,intelligence:3,technical:3,cool:3},perkPoints:5}),d=T.build(s);d.perks.Body_Right_Milestone_2=1;const saved=T.allocate(s,d);
  assert.equal(T.learned(saved)[0].effects.length,1);const text=T.context(stats(saved),I.snapshot('custom','fixture',I.initialSetup('custom')));assert.ok(text.includes('已保存角色成长'));assert.ok(!text.includes('首次成长保存'));assert.ok(!text.includes('格挡冲刺'));
});
test('missing parent container is proposed without dropping the existing terminal; mismatched curve is not silently migrated',()=>{
  const stat={terminal:{wallet:{yen:40,earned:40,spent:0},other:42}};const p=T.plan(stat,{}, {action:'growth-initialize',initial:I.initialSetup('custom')});assert.deepEqual(p.changes[0].path,['terminal','gameplay']);assert.equal(stat.terminal.other,42);
  const bad=start();bad.rulesRef.version='other';assert.throws(()=>T.read(bad),{code:'growth-rules-ref'});
});
