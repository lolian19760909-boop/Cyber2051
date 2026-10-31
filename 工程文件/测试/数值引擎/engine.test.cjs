'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {E,G,attributes,state,profiles,encounter,battle}=require('./helpers.cjs');
const {talentRules:R,talentEffects:UI}=require("../../卡片源码/数值引擎/index.cjs"),catalog=require("../../卡片源码/数值引擎/src/talent-data.js");
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('official 179 nodes retain IDs, ranks and gates; every adapted rank is visible and executable',()=>{
  const nodes=catalog.trees.flatMap(t=>t.nodes);assert.equal(nodes.length,179);assert.equal(Object.keys(R.definitions).length,179);
  const kinds=new Set(['powerPct','powerFlat','critChance','critDamage','hpMax','staminaMax','ramMax','ability']);
  for(const node of nodes){assert.equal(R.definitions[node.id].length,node.ranks);assert.equal(UI[node.id].length,node.ranks);for(const [i,effects]of R.definitions[node.id].entries()){
    assert.ok(effects.length);assert.equal(UI[node.id][i],effects.map(R.describe).join(''));assert.ok(!/undefined|NaN/.test(UI[node.id][i]));
    for(const e of effects){assert.ok(kinds.has(e.kind));if(e.kind==='ability')assert.ok(e.text.length);else assert.ok(Number.isFinite(e.value));for(const token of e.when.split(/[&|]/).filter(Boolean)){assert.ok(/^(hp|stamina)[<>]\d+$/.test(token)||R.labels[token.replace(/^enemy:/,'')],`${node.id}: ${token}`);}}
  }}
});
test('base power, cubic odds, symmetry and large custom attributes are stable',()=>{
  close(E.winChance(300,200),27/35);close(E.winChance(200,300)+E.winChance(300,200),1);assert.equal(E.winChance(200,200),.5);
  const small=E.resolveEffects({attributes:attributes(5)}).power,middle=E.resolveEffects({attributes:attributes(15)}).power,large=E.resolveEffects({attributes:attributes(30)}).power;
  assert.ok(small>0);close(middle,small*3);close(large,middle*2);
  close(E.resolveEffects({attributes:attributes(15),level:3}).power-middle,E.rules.attack.level*2);
  const high=attributes(Number.MAX_SAFE_INTEGER),actor={attributes:high};assert.ok(Number.isFinite(E.resolveEffects(actor).power));assert.deepEqual(actor.attributes,high);close(E.winChance(1e300,1e300),.5);assert.equal(E.winChance(0,0),.5);assert.equal(E.winChance(0,10),0);assert.equal(E.winChance(10,0),1);
});
test('fixed, additive and independent effects compose once; equipment duplicates cannot stack',()=>{
  const item={id:'test_weapon',effects:[{id:'flat',kind:'powerFlat',value:20},{id:'a',kind:'powerPct',value:.1},{id:'b',kind:'powerPct',value:.2},{id:'situational',kind:'multiplier',value:1.5}]};
  const bare=E.resolveEffects({attributes:attributes(10)}),once=E.resolveEffects({attributes:attributes(10),equipment:[item]}),twice=E.resolveEffects({attributes:attributes(10),equipment:[item,item]});
  close(twice.power,once.power);assert.equal(once.active.length,4);assert.equal(twice.active.length,4);
  const flatOnly={id:'test_weapon',effects:[{id:'flat',kind:'powerFlat',value:20}]},withFlat=E.resolveEffects({attributes:attributes(10),equipment:[flatOnly]}).power;
  const scaled=E.resolveEffects({attributes:attributes(10),equipment:[{id:'test_weapon',effects:[item.effects[0],...item.effects.slice(2)]}]}).power;
  assert.ok(withFlat>bare.power);close(scaled,withFlat*1.2*1.5);
  const conflicts={id:'bad',effects:[{id:'same',kind:'powerPct',value:.1},{id:'same',kind:'powerPct',value:.2}]};assert.throws(()=>E.resolveEffects({attributes:attributes(10),equipment:[conflicts]}),{code:'numeric-effect-conflict'});
});
test('critical effects have exactly one expected offense contribution and do not roll',()=>{
  const actor={attributes:attributes(10),equipment:[{id:'critical',effects:[{kind:'critChance',value:.5},{kind:'critDamage',value:.5}]}]};
  const bare=E.resolveEffects({attributes:attributes(10)}).power,one=E.resolveEffects(actor).power;
  assert.ok(one>bare);assert.equal(E.resolveEffects(actor).power,one);
  actor.equipment[0].effects[1].value=1;assert.ok(E.resolveEffects(actor).power>one);
});
test('only learned ranks apply; absent equipment and stale conditions do not activate a perk',()=>{
  const tagged={attributes:attributes(15),perks:{Body_Right_Milestone_2:1},tags:['blunt']},plain={attributes:attributes(15),perks:{Body_Right_Milestone_2:1},tags:[]};
  const withTag=E.resolveEffects(tagged).power,withoutTag=E.resolveEffects(plain).power;assert.ok(withTag>withoutTag);
  tagged.perks.Body_Right_Milestone_2=2;tagged.tags=['blunt','charging'];assert.ok(E.resolveEffects(tagged).power>withTag);
  const max=E.maximums({},E.rules,[],{attributes:attributes(15)}).hp;
  const low={attributes:attributes(15),perks:{Body_Central_Perk_1_2:1},vitals:{hp:1,stamina:100,ram:10}};
  assert.ok(E.resolveEffects(low).active.some(e=>e.id.includes('Body_Central_Perk_1_2')));
  low.vitals.hp=max;assert.equal(E.resolveEffects(low).active.length,0);
});
test('enemy templates depend on district; authored profiles override district scaling',()=>{
  const low=E.actorFrom({id:'g',template:'guard',district:'ordinary'}),high=E.actorFrom({id:'g',template:'guard',district:'corporate'});assert.deepEqual(low.attributes,high.attributes);assert.equal(high.regionFactor,1.15);
  const authored=E.actorFrom({id:'g',profileId:'weaker',district:'corporate'},{profiles});assert.equal(authored.regionFactor,1);assert.equal(E.actorFrom({id:'g',profileId:'missing'},{profiles}),null);
});
test('resource events clamp continuously, preserve unknown fields and replay once',()=>{
  const before=state(),max=E.maximums({},E.rules,[],before.growth),events=[{id:'hurt',kind:'resource',resource:'hp',amount:-29.25,reason:'擦伤'}];
  const result=E.settle(before,events);close(result.state.numeric.vitals.hp,max.hp-29.25);assert.equal(before.numeric,undefined);assert.deepEqual(result.state.extension,before.extension);
  const replay=E.settle(result.state,events);assert.deepEqual(replay.state,result.state);assert.deepEqual(replay.duplicates,['hurt']);assert.deepEqual(replay.changes,[]);
  assert.throws(()=>E.settle(result.state,[{...events[0],amount:-30}]),{code:'numeric-event-conflict'});
  const healed=E.settle(result.state,[{id:'heal',kind:'resource',resource:'hp',amount:999,reason:'治疗'}]).state;assert.equal(healed.numeric.vitals.hp,max.hp);
  const down=E.settle(healed,[{id:'down',kind:'resource',resource:'hp',amount:-999,reason:'失去战斗能力'}]).state;assert.equal(down.numeric.vitals.hp,0);assert.equal(down.dead,undefined);
});
test('player confirmed battles retain real wounds, refuse encounter events and clear the hint when ended',()=>{
  let s=battle(15,{paused:true});
  s=E.settle(s,[{id:'enemy_hurt',kind:'resource',target:'enemy_one',resource:'hp',amount:-40,reason:'受伤'}],{profiles}).state;assert.equal(s.numeric.combat.enemies[0].vitals.hp,60);
  assert.throws(()=>E.settle(s,[encounter()],{profiles}),{code:'battle-player'});
  assert.throws(()=>E.settle({...s,numeric:{...s.numeric,combat:{...s.numeric.combat,paused:false}}},[{id:'player_hurt',kind:'resource',resource:'hp',amount:-10,reason:'擦伤'}],{profiles}),{code:'battle-owned'});
  assert.equal(s.numeric.combat.enemies[0].vitals.hp,60);
  const live={...s,numeric:{...s.numeric,combat:{...s.numeric.combat,paused:false}}};assert.ok(E.context({terminal:{gameplay:live}}).includes('逐轮战斗'));
  const ended={...live,numeric:{...live.numeric,combat:{...live.numeric.combat,active:false}}};assert.equal(E.context({terminal:{gameplay:ended}}),'');
});
