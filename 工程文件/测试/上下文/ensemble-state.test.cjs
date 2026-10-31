'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const A=require('../../卡片源码/运行时/ensemble-state.js');
const E=require('../../卡片源码/数值引擎/src/engine.js');
const checks=[];
function test(name,work){work();checks.push(name);}
const original={futureRoot:{keep:1},terminal:{wallet:{yen:777,earned:0,spent:0,futureWallet:4},gameplay:{...E.loadout.base(),growth:E.growth.initialize({level:1,xp:0,attributePoints:7,perkPoints:0,attributes:{body:3,reflexes:3,intelligence:3,technical:3,cool:3}},'old-player'),futureGameplay:{keep:true}},futureTerminal:'keep'}};
original.terminal.gameplay.numeric=E.initialNumeric(original.terminal.gameplay);
let state;
test('register-approved-profiles-without-copying-player',()=>{
  const before=structuredClone(original);state=A.initialize(original);
  assert.deepEqual(original,before);assert.deepEqual(state.terminal.gameplay,before.terminal.gameplay);assert.deepEqual(state.terminal.wallet,before.terminal.wallet);
  assert.equal(state.terminal.ensemble.actors.player.gameplay,undefined);assert.deepEqual(state.futureRoot,{keep:1});
  assert.deepEqual(Object.keys(state.terminal.ensemble.actors),['player','wb_10','wb_6']);
});
test('approved-growth-equipment-resource-and-wallet-results',()=>{
  const s=A.project(state,'wb_10'),a=A.project(state,'wb_6');
  assert.deepEqual(s.maxima,{hp:125,stamina:100,ram:10});assert.deepEqual(a.maxima,{hp:123,stamina:100,ram:10});
  assert.equal(s.wallet.yen,12000);assert.equal(a.wallet.yen,2000);assert.equal(s.growth.xp,4250);assert.equal(a.growth.xp,1000);
  assert.equal(s.growth.attributePoints,0);assert.equal(s.growth.perkPoints,0);
  const weapons=s.equipment.filter(x=>x.slot.startsWith('weapon_'));assert.equal(weapons.length,3);assert.notEqual(weapons[0].record.instanceId,weapons[1].record.instanceId);
  assert.equal(E.loadout.effects(A.read(state,'wb_10').gameplay).flatMap(x=>x.effects).filter(x=>x.kind==='powerFlat').reduce((sum,x)=>sum+x.value,0),8);
});
const event={id:'same_turn_damage',kind:'resource',target:'player',resource:'hp',amount:-7,reason:'本轮已确认擦伤。'};
test('npc-event-remaps-only-selected-actor-and-preserves-unknowns',()=>{
  const old=structuredClone(state),transaction=A.planNumeric(state,'wb_10',[event]);
  assert(transaction.changes.every(x=>x.path.slice(0,4).join('.')==='terminal.ensemble.actors.wb_10'));
  state=A.preview(state,transaction);assert.equal(A.project(state,'wb_10').vitals.hp,118);
  assert.deepEqual(state.terminal.gameplay,old.terminal.gameplay);assert.deepEqual(state.terminal.ensemble.actors.wb_6,old.terminal.ensemble.actors.wb_6);assert.deepEqual(state.futureRoot,old.futureRoot);
});
test('repeat-fact-does-not-damage-or-reinitialize-twice',()=>{
  const repeat=A.planNumeric(state,'wb_10',[event]);assert.deepEqual(repeat.duplicates,['same_turn_damage']);assert.deepEqual(A.preview(state,repeat),state);assert.deepEqual(A.initialize(state),state);
});
test('same-receipt-id-is-independent-between-actors',()=>{
  const next=A.preview(state,A.planNumeric(state,'wb_6',[event]));assert.equal(A.project(next,'wb_6').vitals.hp,116);assert.equal(A.project(next,'wb_10').vitals.hp,118);
});
test('legacy-player-event-keeps-existing-path',()=>{
  const p=A.planNumeric(state,'player',[event]);assert(p.changes.every(x=>x.path.slice(0,2).join('.')==='terminal.gameplay'));const next=A.preview(state,p);assert.equal(next.terminal.gameplay.numeric.vitals.hp,88);assert.deepEqual(next.terminal.gameplay.futureGameplay,{keep:true});
});
test('control-switch-changes-binding-only',()=>{
  const before=structuredClone(state),pending=A.planNumeric(state,'wb_10',[{...event,id:'later'}]);state=A.preview(state,A.planControl(state,'wb_10'));
  assert.deepEqual(state.terminal.ensemble.actors,before.terminal.ensemble.actors);assert.deepEqual(state.terminal.wallet,before.terminal.wallet);assert.deepEqual(state.terminal.gameplay,before.terminal.gameplay);
  assert.equal(state.terminal.ensemble.control.viewpointActorId,'wb_10');assert.equal(state.terminal.ensemble.control.revision,1);assert.throws(()=>A.preview(state,pending),/扮演身份已经变化/);
  assert.deepEqual(A.preview(state,A.planControl(state,'wb_10')),state);
});
test('stale-state-rejects-the-whole-planned-transaction',()=>{
  const pending=A.planNumeric(state,'wb_10',[{...event,id:'stale'}]),changed=structuredClone(state);changed.terminal.ensemble.actors.wb_10.gameplay.numeric.vitals.hp=117;
  assert.throws(()=>A.preview(changed,pending),/人物状态已经变化/);assert.equal(changed.terminal.ensemble.actors.wb_10.gameplay.numeric.vitals.hp,117);
});
test('unknown-and-uninitialized-actors-are-not-zero-filled',()=>{
  assert.equal(A.project(state,'missing').status,'unregistered');assert.throws(()=>A.planNumeric(state,'missing',[event]),/尚未登记/);
  const incomplete=structuredClone(state);delete incomplete.terminal.ensemble.actors.wb_6.gameplay.numeric;
  assert.equal(A.project(incomplete,'wb_6').vitals,null);assert.throws(()=>A.planControl(incomplete,'wb_6'),/完整数值/);assert.deepEqual(A.initialize(incomplete),incomplete);
});
test('invalid-identity-and-schema-are-preserved-by-rejection',()=>{
  assert.throws(()=>A.read(state,'__proto__'),/编号无效/);const bad=structuredClone(state);bad.terminal.ensemble.schema=99;assert.throws(()=>A.initialize(bad),/版本/);assert.equal(bad.terminal.ensemble.schema,99);
});
test('active-combat-cannot-be-detached-by-control-switch',()=>{
  const fighting=structuredClone(state);fighting.terminal.ensemble.actors.wb_10.gameplay.numeric.combat.active=true;assert.throws(()=>A.planControl(fighting,'wb_6'),/结束当前人物交锋/);
  const tactical=structuredClone(state);tactical.terminal.ensemble.actors.wb_6.gameplay.tactical={encounter:{active:true}};assert.throws(()=>A.planControl(tactical,'wb_6'),/结束当前人物交锋/);
});
const out=path.resolve(__dirname,'../../.cache/context-s0/ensemble-state.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({pass:true,checks,scope:'pure current-engine actor state; no host write or UI integration'},null,2));
console.log(JSON.stringify({pass:true,checks:checks.length,out}));
