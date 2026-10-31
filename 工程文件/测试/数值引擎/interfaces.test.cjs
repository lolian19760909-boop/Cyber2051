'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {E,state,stat,profiles,encounter,applyPatches,attributes}=require('./helpers.cjs'),{mvu:M}=require("../../卡片源码/数值引擎/index.cjs");
test('equipment resource limits participate once in both evaluation and event settlement',()=>{
  const item={id:'medical_implant',effects:[{id:'hp',kind:'hpMax',value:20},{id:'ram',kind:'ramMax',value:2}]},options={playerEquipment:[item,item]};
  const growth=state().growth,hpMax=E.maximums({},E.rules,options.playerEquipment,growth).hp;
  const s=E.settle(state(),[{id:'hurt',kind:'resource',resource:'hp',amount:-20,reason:'受伤'}],options).state;assert.equal(s.numeric.vitals.hp,hpMax-20);assert.equal(s.numeric.vitals.ram,12);
  assert.equal(E.maximums({},E.rules,options.playerEquipment).hp,120);const healed=E.settle(s,[{id:'heal',kind:'resource',resource:'hp',amount:hpMax,reason:'治疗'}],options).state;assert.equal(healed.numeric.vitals.hp,hpMax);
  const bare=E.resolveEffects({attributes:attributes(10)}),power=E.resolveEffects({attributes:attributes(10),equipment:options.playerEquipment});assert.equal(power.power,bare.power);
  assert.throws(()=>E.resolveEffects({attributes:attributes(10),equipment:[item,{...item,effects:[]}]}),{code:'numeric-effect-conflict'});
});
test('different event kinds cannot reuse an already consumed event ID',()=>{
  const r={id:'one',kind:'reward',source:{kind:'story',id:'scene'},xp:1},cost={id:'one',kind:'resource',resource:'hp',amount:-1,reason:'受伤'};
  assert.throws(()=>E.settle(E.settle(state(),[r]).state,[cost]),{code:'numeric-event-conflict'});
  assert.throws(()=>E.settle(E.settle(state(),[cost]).state,[r]),{code:'numeric-event-conflict'});
});
test('a prepared result is bound to its supplied chat and swipe context',()=>{
  const before=stat(),context={characterKey:'character',chatId:'chat',floor:4,swipe:0};
  const tx=M.prepare(before,[{op:'add',path:M.inputPath,value:[{id:'hurt',kind:'resource',resource:'hp',amount:-1,reason:'擦伤'}]}],{profiles,context}),after=applyPatches(before,tx.patches);
  assert.equal(M.checkPrepared(tx,before,after,context),true);assert.throws(()=>M.checkPrepared(tx,before,after,{...context,swipe:1}),/分支/);
  const ticket={id:'a',requestHash:'h',context,plan:{changes:[]}},saved={terminal:{gameplay:{results:{a:{status:'success',requestHash:'h'}}}}};assert.equal(M.verifyAction(ticket,saved,{...context,chatId:'another'}).status,'unconfirmed');assert.equal(M.verifyAction(ticket,saved,context).status,'success');
});
test('partial authored vitals inherit defined resource maxima, not another actor state',()=>{
  const actor=E.actorFrom({id:'boss',profileId:'wounded'},{profiles:{wounded:{attributes:attributes(10),vitals:{hp:40}}}});assert.deepEqual(actor.vitals,{hp:40,stamina:100,ram:10});
});
test('all browser modules load in a clean VM without DOM, network, or a card host',()=>{
  const root=path.resolve(__dirname,'../../卡片源码/数值引擎'),context=vm.createContext({structuredClone});
  for(const file of ['src/numeric-rules.js','src/talent-rules.js','src/talent-data.js','src/growth-rules.js','src/talent-effects.js','src/growth-base.js','src/growth.js','src/engine.js','adapters/mvu.js','adapters/story.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  assert.ok(context.CxxNumericEngine);assert.ok(context.CxxNumericMvu);assert.ok(context.CxxNumericStory);assert.equal(context.CxxNumericEngine.winChance(10,10),.5);assert.equal(Object.keys(context.CxxTalentEffects).length,179);
});
test('MVU protocol requests events and only the currently relevant condition vocabulary',()=>{
  const s=state();s.growth.perks={Body_Right_Perk_2_2:1};const protocol=M.protocol(s,{profiles});assert.ok(protocol.includes('recent_block'));assert.ok(!protocol.includes('air_dash'));assert.ok(protocol.includes('numericInput'));assert.ok(protocol.includes('不得自行计算'));assert.ok(!protocol.includes('门槛依次='));
});
test('a failed later event leaves the complete input snapshot and earlier receipts untouched',()=>{
  const before=state(),copy=structuredClone(before);assert.throws(()=>E.settle(before,[{id:'first',kind:'resource',resource:'hp',amount:-20,reason:'受伤'},{id:'bad',kind:'unknown'}]));assert.deepEqual(before,copy);assert.equal(before.numeric,undefined);
});
