'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../卡片源码'),source=file=>fs.readFileSync(path.join(root,file),'utf8');
const lines=require('../../卡片源码/剧情/build.cjs').load(source),plot=require('../../卡片源码/长期记忆/plot.js').create({chapter:JSON.parse(source('剧情/盗芯之夜.json')),quests:JSON.parse(source('终端/content/quests.json')).quests.filter(q=>q.id!=='q_heist'),detection:JSON.parse(source('长期记忆/detection.json')),lines});
const Q=require('../../卡片源码/运行时/quests.js'),F=require('../当前/police.test.cjs');
test('one strict MVU batch commits plot facts, police, fine, custody and items; correction restores the complete transaction',async()=>{
 const before=F.state(),id='q_main_pre_heist';
 const police=[F.report('shared_case'),F.event('shared_fine','assess-fine',{caseId:'shared_case'}),F.event('shared_pay','pay-fine',{caseId:'shared_case',amount:30000}),F.event('shared_detain','detain',{detentionId:'shared_cell',caseIds:['shared_case'],facility:'荒川警署',durationMinutes:5}),F.event('shared_seize','seize',{caseId:'shared_case',detentionId:'shared_cell',keeper:'荒川警署保管柜',items:[{itemId:'pistol_t1',quantity:1,type:'ordinary'}]})];
 const patch={op:'add',path:'/terminal/quests/'+id+'/events',value:[{event:'progress',node:'P1',kind:'happened',evidence:[{fact:'fact1',quote:F.quote}]}]};
 const after=await F.run(before,police,F.baseTime,'shared',[patch],{plot,questDefinition:x=>plot.definition(x),questRegistered:x=>plot.owns(x)});
 assert(after.terminal.quests[id].line.nodes.P1.facts.fact1);assert(after.terminal.police.cases.shared_case);assert.equal(after.terminal.wallet.yen,570000);assert.equal(after.terminal.gameplay.inventory.pistol_t1.quantity,0);assert.equal(after.terminal.gameplay.equipment.weapon_1,null);
 const receipt=after.terminal.questJournal.receipts.fact_shared;assert.equal(receipt.civic,true);assert(receipt.changes.some(x=>x.parts.join('/')==='terminal/police'));
 const corrected=Q.plan(after,{id:'undo_shared',action:'quest-correct',receiptId:'fact_shared',expectedRevision:1},{questDefinitions:plot.definitions});
 assert.deepEqual(corrected.terminal.quests,before.terminal.quests);assert.deepEqual(corrected.terminal.wallet,before.terminal.wallet);assert.deepEqual(corrected.terminal.gameplay,before.terminal.gameplay);assert.equal(corrected.terminal.police,undefined);assert.deepEqual(corrected.unknown,before.unknown);
});
