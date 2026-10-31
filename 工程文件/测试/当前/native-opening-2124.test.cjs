'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../../卡片源码/运行时/item-model.js'),L=require('../../卡片源码/运行时/loadout.js'),P=require('../../卡片源码/Gal/parser.js');
const {fixture}=require('../lib/fixture-loader.cjs')('../当前/save.test.cjs',['fixture']);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('custom item display names become stable classifications and survive repeated opening normalization',()=>{
 for(const [category,part,want,slot]of [['义体','额皮质','cyberware','frontal'],[' WEAPON ','武器','weapon','weapon'],['衣物','外套','clothing','outer'],['文字物品',null,'text',null]]){
  const item=M.draft({name:'确认测试',category,part,numericEffects:[{kind:'ramMax',value:11}]});assert.equal(item.category,want);assert.equal(item.part,slot);
  const setup=L.normalizeSetup('custom',{items:[{...item,quantity:2,status:'inventory'}]});assert.deepEqual(L.normalizeSetup('custom',setup),setup);const saved=L.initial('custom',setup);assert.equal(Object.values(saved.inventory)[0].quantity,2);assert.equal(Object.values(saved.itemDefinitions)[0].numericEffects[0].value,11);
 }
 assert.throws(()=>M.draft({name:'不猜类别',category:'装备',part:'arms'}),/类别无效：装备/);
 assert.throws(()=>M.draft({name:'不猜部位',category:'义体',part:'外套'}),/身体部位/);
});
test('start waits for selected MVU branch, preserves its authored data and applies custom items once',async()=>{
 const f=fixture('custom');try{
  f.choice.loadoutSetup=L.normalizeSetup('custom',{items:[{custom:true,name:'测试磁盘',category:'义体',part:'额皮质',quantity:1,status:'installed',numericEffects:[{kind:'ramMax',value:5}]}]});
  await f.player.prepareOpening();const target=structuredClone(f.row.variables[10]);target.stat_data.terminal.unknown={target:10};delete f.row.variables[10];
  const work=f.player.completeOpening({value:f.choice,swipe:10});await delay(35);assert.equal(f.stats().writes,0);f.row.variables[10]=target;await work;await f.player.waitForSaved();
  assert.equal(f.row.swipe_id,10);assert.deepEqual(f.row.variables[10].stat_data.terminal.unknown,{target:10});const game=structuredClone(f.row.variables[10].stat_data.terminal.gameplay);assert.equal(Object.values(game.inventory)[0].quantity,1);
  await f.player.completeOpening({value:f.choice,swipe:10});await f.player.waitForSaved();assert.deepEqual(f.row.variables[10].stat_data.terminal.gameplay,game);
 }finally{f.player.stop();}
});
test('MVU warm-up does not permanently cache readiness and rejects a replaced opening row',async()=>{
 const f=fixture();try{await f.player.prepareOpening();delete f.row.variables[1];const work=f.player.prepareOpening();await delay(10);f.c.chat[0]=structuredClone(f.row);await assert.rejects(work,/开场已经变化/);assert.equal(f.stats().writes,0);}finally{f.player.stop();}
});
test('switching the active reply while awaiting MVU cannot submit the old opening choice',async()=>{
 const f=fixture();try{const target=f.row.variables[10];delete f.row.variables[10];const work=f.player.completeOpening({value:f.choice,swipe:10});await delay(15);f.row.swipe_id=2;f.row.variables[10]=target;await assert.rejects(work,/开场或人设已变化/);assert.equal(f.stats().writes,0);}finally{f.player.stop();}
});
test('Analyze explanation and empty JSONPatch are display-valid, malformed updates stay rejected',()=>{
 for(const label of ['Analysis','Analyze','ANALYZE'])for(const patch of ['[]','[{"op":"replace","path":"/terminal/wallet/yen","value":100}]']){
  const raw='正文仍然显示。\n<UpdateVariable><'+label+'>无需额外变更。</'+label+'><JSONPatch>'+patch+'</JSONPatch></UpdateVariable>';
  const result=P.parseMessage(raw);assert.equal(result.diagnostics.length,0);assert.ok(result.paragraphs.some(p=>p.text.includes('正文仍然显示')));assert.ok(result.paragraphs.every(p=>!p.text.includes('UpdateVariable')&&!p.text.includes('JSONPatch')));assert.equal(result.raw,raw);
 }
 for(const body of ['<Analyze>说明</Analysis><JSONPatch>[]</JSONPatch>','<Analyze>说明</Analyze><JSONPatch>{}</JSONPatch>','<Analyze>说明</Analyze><JSONPatch>[{"op":"replace","path":"/a"}]</JSONPatch>'])assert.ok(P.parseMessage('<UpdateVariable>'+body+'</UpdateVariable>').diagnostics.length);
});
