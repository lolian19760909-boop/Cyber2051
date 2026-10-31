'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const F=require('../lib/tactical-fixtures.cjs'),T=require('../../卡片源码/运行时/tactical-engine.js'),V=require('../../卡片源码/运行时/growth-feedback.js'),R=require('../../卡片源码/运行时/roster.js'),Hud=require('../../卡片源码/Gal/hud.js'),P=require('../../卡片源码/MVU/preferences.js');
let sequence=0;
const op=(g,action,fields={},scene)=>T.operation(g,{action,id:'gf_'+(++sequence),expected:T.stamp(g),...fields},{scene});
function scene({remote=false,hidden=false,hostile=false}={}){return {hostile,playerZone:'room',zones:[{id:'room',name:'门厅',known:true,cover:0},{id:'hall',name:'走廊',known:true,cover:0}],edges:[{a:'room',b:'hall',open:true,los:true}],actors:[{id:'enemy',name:'安保',template:'guard',zone:remote?'hall':'room',visible:!hidden,networked:true}],nodes:[]};}
function setup(type='pistol',{deck=false,programs=['short_circuit'],supplies={light:60,heavy:60,precision:60,shell:60,med:2},perks={}}={}){let g=F.equip(F.game(),type,1,'weapon_1');if(deck)g=F.equip(g,'cyberdeck',1,'cyber_os_1');for(const [id,n]of Object.entries(perks))g=F.allocate(g,id,n);const weapon=T.activeWeapon(g).profile;g=op(g,'tactical-initialize',{supplies,programs,magazines:{weapon_1:Math.min(weapon.magazine,supplies[weapon.ammo]||0)}});return op(g,'tactical-enable',{enabled:true});}
const start=(g,s=scene(),seed=55)=>op(g,'tactical-start',{seed,encounterId:'fight_'+(++sequence)},s);
const player=g=>g.tactical.encounter.actors.find(a=>a.id==='player');
test('an old custom weapon without a battle category keeps growth UI readable',()=>{
 let g=F.game();const d=F.L.customDefinition({id:'old_custom',name:'旧档自定义武器',category:'weapon',tier:1,tags:[],numericEffects:[]});g.itemDefinitions[d.id]=d;g.inventory[d.id]={quantity:1,definitionRef:d.definitionRef};g=F.op(g,{action:'loadout-save',id:'old_custom_equip',expected:F.L.stamp(g),operations:[{action:'equip',id:d.id,slot:'weapon_1'},{action:'active-weapon',slot:'weapon_1'}]});const original=structuredClone(g);assert.match(T.buildStats(g).unavailable,/确认战斗类别/);assert.deepEqual(V.compare(g,g),[]);assert.equal(V.perk(g,'Cool_Left_Milestone_3',1).rows[0].state,'武器类别待确认');assert.deepEqual(g,original);
});

test('build preview follows the actual weapon attribute and does not mutate, roll or heal',()=>{
 const g=setup(),original=structuredClone(g),base=T.buildStats(g);const changed=key=>({...g,growth:F.E.growth.allocate(g.growth,{attributes:{...g.growth.attributes,[key]:16},perks:g.growth.perks})});
 assert.equal(T.buildStats(changed('intelligence')).damage,base.damage);assert.equal(T.buildStats(changed('cool')).damage,base.damage+.8);
 const hp=F.allocate(g,'Body_Central_Milestone_3',1);assert.equal(T.buildStats(hp).damage,base.damage);assert.equal(T.buildStats(hp).maxima.hp,base.maxima.hp+20);assert.equal(hp.numeric.vitals.hp,g.numeric.vitals.hp);assert.deepEqual(g,original);
});
test('weapon benefit matches fixed-seed actual attack and names its applied talent',()=>{
 const a=setup(),b=F.allocate(a,'Cool_Left_Milestone_3',2),hit=g=>{const after=op(start(g),'tactical-act',{intent:{kind:'attack',target:'enemy',shots:1}});return {line:after.tactical.encounter.log.find(r=>r.text.startsWith('玩家攻击')),log:after.tactical.encounter.log.map(x=>x.text).join('\n')};};
 const x=hit(a),y=hit(b);assert.match(x.log,/35\.37 伤害/);assert.match(y.log,/37\.13 伤害/);assert.match(y.log,/龙争虎斗 伤害加成项 \+5%/);assert.equal(T.buildStats(b).damage,45.68);assert.doesNotMatch(x.log,/天赋生效/);
});
test('preview applies single-strike stamina cost before resource conditions',()=>{
 let g=setup('shotgun');g=F.allocate(g,'Body_Left_Milestone_2',2);g.numeric.vitals.stamina=50;const low=T.buildStats(g);g.numeric.vitals.stamina=60;const high=T.buildStats(g);assert.ok(low.damage>high.damage);assert.equal(low.actor.vitals.stamina,50-T.activeWeapon(g).profile.stamina);
});
test('stale tactical slot cannot override the saved weapon outside a fight',()=>{
 let g=setup();g=F.equip(g,'blade',1,'weapon_2');g.tactical.weaponSlot='weapon_1';assert.equal(T.activeWeapon(g).slot,'weapon_2');const active=start(g);assert.equal(player(active).weapon.type,'blade');
});
test('talent feedback distinguishes conditions, unsuitable equipment and deferred crafting',()=>{
 const g=setup();assert.ok(V.perk(g,'Cool_Left_Milestone_3',2).rows.some(x=>x.state==='条件待触发'));assert.ok(V.perk(g,'Cool_Left_Milestone_3',2).rows.some(x=>x.state==='当前生效'));
 assert.ok(V.perk(setup('blade'),'Cool_Left_Milestone_3',2).rows.every(x=>x.state==='装备不适用'));assert.equal(V.perk(g,'Tech_Central_Perk_2_3',1).pending,true);assert.match(V.perk(g,'Tech_Central_Perk_2_3',1).note,/尚未开放/);
});
test('hacker preview uses owned programs and never applies hacker damage bonuses to guns',()=>{
 const g=setup('pistol',{deck:true}),a=T.buildStats(g),b=T.buildStats(F.allocate(g,'Intelligence_Central_Milestone_3',2));assert.ok(a.programs.length);assert.equal(a.damage,b.damage);assert.ok(b.programs[0].damage>a.programs[0].damage);assert.equal(T.buildStats(setup()).programs.length,0);
});
test('growth summaries require a saved receipt for this actor and aggregate only new reward IDs',()=>{
 let g=F.game();g.growth=F.E.growth.initialize({schema:1,level:1,xp:0,attributes:F.attrs(3),attributePoints:7,perkPoints:0});for(let i=1;i<=3;i++)g.growth=F.E.growth.planAchievement(g.growth,{id:'award'+i,kind:'achievement',category:'small',completed:true,source:{kind:'training',id:'training'+i},reason:'独立训练'+i}).state;
 const original=structuredClone(g),receipt={phase:'saved',growth:{actorId:'player',rewardIds:['award3']}};const current=R.progress(g,{receipt});assert.equal(current.currentSummary.xp,350);assert.equal(current.currentSummary.fromLevel,1);assert.equal(current.currentSummary.toLevel,2);assert.equal(current.currentSummary.hpMax,5);assert.equal(current.currentSummary.attributePoints,1);assert.equal(current.remaining,990);
 for(const phase of ['applied','parsed','rejected','missing'])assert.equal(R.progress(g,{receipt:{...receipt,phase}}).currentSummary,null);assert.equal(R.progress(g,{receipt,actorId:'npc'}).currentSummary,null);assert.equal(R.progress(g).currentSummary,null);assert.deepEqual(g,original);
 const model=Hud.read({messageId:7,getVariables:()=>({stat_data:{terminal:{gameplay:g}}}),receipt});assert.deepEqual(model.growth.summary,current.currentSummary);assert.equal(Hud.read({messageId:8,getVariables:()=>({})}).growth,null);
});
test('custom level offset and max level remain readable without new point allocation',()=>{
 let g=F.game();assert.equal(R.progress(g).level,10);assert.equal(R.progress(g).into,0);g.growth=F.E.growth.initialize({schema:1,unrestricted:true,level:999,xp:F.E.growth.rules.levels.at(-1).xp,attributes:F.attrs(3),attributePoints:2,perkPoints:3});const p=R.progress(g);assert.equal(p.required,null);assert.equal(p.level,999);assert.equal(p.attributePoints,2);
});
test('fast hacking consumes real RAM; weapon priority and missing deck use weapons',()=>{
 const g=start(setup('pistol',{deck:true})),before=structuredClone(g);const hacked=op(g,'tactical-resolve',{strategy:'hack',maxRounds:4});assert.ok(hacked.tactical.lastReport.choices.some(x=>x.kind==='hack'));assert.match(hacked.tactical.lastReport.lines.join('\n'),/消耗 4 RAM/);assert.deepEqual(g,before);
 const weapon=op(g,'tactical-resolve',{strategy:'weapon',maxRounds:4});assert.ok(!weapon.tactical.lastReport.choices.some(x=>x.kind==='hack'));assert.equal(T.count(weapon,'supply','med'),2);
 const none=op(start(setup()),'tactical-resolve',{strategy:'hack'});assert.ok(!none.tactical.lastReport.choices.some(x=>x.kind==='hack'));
});
test('fast melee moves or dashes to a visible opponent; hidden remote foes are never attacked',()=>{
 const g=start(setup('blade',{perks:{Reflexes_Central_Milestone_2:2}}),scene({remote:true})),next=op(g,'tactical-resolve',{strategy:'weapon',maxRounds:3});assert.ok(next.tactical.lastReport.choices.some(x=>x.kind==='move'&&x.style==='dash'));assert.ok(next.tactical.lastReport.choices.some(x=>x.kind==='attack'));
 const hidden=op(start(setup(),scene({remote:true,hidden:true})),'tactical-resolve',{maxRounds:2});assert.ok(!hidden.tactical.lastReport.choices.some(x=>['hack','attack','finisher'].includes(x.kind)));assert.equal(hidden.tactical.lastReport.outcome,'stalemate');
});
test('fast choice execution equals manual actions and idempotent replay does not spend twice',()=>{
 const g=start(setup('pistol',{deck:true})),request={action:'tactical-resolve',id:'fast_replay',expected:T.stamp(g),strategy:'hack',maxRounds:3},fast=T.operation(g,request);let manual=structuredClone(g);
 for(const intent of fast.tactical.lastReport.choices){if(manual.tactical.encounter.narrativePending)manual=op(manual,'tactical-ack');manual=op(manual,'tactical-act',{intent});}
 assert.deepEqual(manual.numeric.vitals,fast.numeric.vitals);assert.deepEqual(manual.inventory,fast.inventory);assert.equal(manual.tactical.encounter.randomState,fast.tactical.encounter.randomState);assert.deepEqual(T.operation(fast,request),fast);
});
test('fast resolve respects bounds and a new batch can continue beyond battle round 10',()=>{
 const g=start(setup(),scene({remote:true,hidden:true}));g.tactical.encounter.round=12;const next=op(g,'tactical-resolve',{maxRounds:2});assert.ok(next.tactical.lastReport.actions>0);assert.ok(next.tactical.encounter.round<=14);assert.throws(()=>op(g,'tactical-resolve',{strategy:'invalid'}),/策略/);assert.throws(()=>op(g,'tactical-resolve',{maxRounds:10000}),/数量/);
 assert.equal(P.read({}).fastStrategy,'auto');assert.equal(P.read({[P.KEY]:{fastStrategy:'hack'}}).fastStrategy,'hack');assert.equal(P.read({[P.KEY]:{fastStrategy:'bad'}}).fastStrategy,'auto');
});
test('fast precision aiming reaches a shot and blade finisher uses the actual threshold',()=>{
 const aimed=op(start(setup('pistol',{perks:{Cool_Left_Milestone_2:2}})),'tactical-resolve',{strategy:'weapon',maxRounds:6});assert.ok(aimed.tactical.lastReport.choices.some(x=>x.kind==='aim'));assert.ok(aimed.tactical.lastReport.choices.some(x=>x.kind==='attack'&&x.aimed));
 const g=start(setup('blade',{perks:{Reflexes_Right_Milestone_3:3}}));g.tactical.encounter.actors.find(a=>a.id==='enemy').vitals.hp=1;const ended=op(g,'tactical-resolve',{strategy:'weapon'});assert.equal(ended.tactical.lastReport.choices[0].kind,'finisher');assert.equal(ended.tactical.lastReport.outcome,'victory');
});
test('empty ammunition and RAM never create resources or consume reserved medkits',()=>{
 const g=start(setup('pistol',{deck:true,supplies:{light:0,heavy:0,med:2}}));player(g).vitals.ram=0;const next=op(g,'tactical-resolve',{strategy:'hack',maxRounds:1});assert.ok(next.tactical.lastReport.choices.every(x=>!['attack','hack'].includes(x.kind)));assert.equal(T.count(next,'supply','light'),0);assert.equal(T.count(next,'supply','med'),2);
});
test('fast technical weapon charges and shoots even with precision aiming learned',()=>{
 const g=start(setup('cp_w_achilles_x_mod2',{perks:{Tech_Right_Milestone_3:3,Cool_Left_Milestone_2:2}})),next=op(g,'tactical-resolve',{strategy:'weapon',maxRounds:8});assert.ok(next.tactical.lastReport.choices.some(x=>x.kind==='charge'));assert.ok(next.tactical.lastReport.choices.some(x=>x.kind==='attack'&&x.charged));
});
test('a full battle log retains new fast-resolution lines after rotation',()=>{
 const g=start(setup());g.tactical.encounter.log=Array.from({length:200},()=>({round:0,text:'old'}));const next=op(g,'tactical-resolve',{maxRounds:2});assert.ok(next.tactical.lastReport.lines.length);assert.ok(next.tactical.lastReport.lines.every(x=>x!=='old'));
});
