'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,deferred}=require('../lib/fixture-loader.cjs')('../当前/save.test.cjs',['fixture','deferred']);
const View=require('../../卡片源码/运行时/quest-view.js'),Controller=require('../../卡片源码/终端/quest-controller.js'),Diagnostics=require('../../卡片源码/运行时/diagnostics.js'),Refresh=require('../../卡片源码/运行时/player-refresh.js');
const defs=[{id:'q1',title:'交付零件',goal:'送达指定地点',pay:300},{id:'q2',title:'另一份委托'}],delay=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(options){const f=fixture('street',options);await f.player.completeOpening({value:f.choice});await f.player.waitForSaved();global.Cxx236VariableGuard.questDefinition=id=>defs.find(d=>d.id===id);const diagnostics=Diagnostics.create();global.CxxDiagnostics=diagnostics;return {...f,diagnostics};}
const request=(f,action='accept',id='q1')=>({action:'quest-'+action,id:'test_'+action+'_'+id,questId:id,expectedRevision:f.read.local().stat.terminal.questJournal?.revision||0,...f.player.quests.source()});
const snapshot=f=>View.project(f.read.local().stat,defs,{chatId:f.c.getCurrentChatId(),floor:0,swipe:f.row.swipe_id});
test('host reads are readonly; commit logs input, plan, disk confirmation and view acknowledgement without player text',async()=>{
 const f=await setup(),before=f.stats(),observer=f.player.quests.registerView();f.player.quests.read();assert.deepEqual(f.stats(),before);const req=request(f);await f.player.commit(req);
 assert.equal(f.read.local().stat.terminal.quests.q1.state,'已接取');assert.equal(f.player.quests.status().pendingViews,1);observer.observed(snapshot(f));assert.equal(f.player.quests.status().pendingViews,0);
 const events=f.diagnostics.read().rows,phases=events.map(e=>e.stage);for(const phase of ['reading','validating','planned','applied','persisting','confirming','confirmed','view-refreshed','saved'])assert.ok(phases.includes(phase),phase);
 assert.equal(new Set(events.map(e=>e.context.operation)).size,1);const planned=JSON.parse(events.find(e=>e.stage==='planned').detail);assert.deepEqual(planned.writes,['terminal.quests','terminal.questJournal']);assert.equal(planned.input.id,req.id);
 assert.ok(!JSON.stringify(f.player.quests.status()).includes('questContext'));assert.ok(!JSON.stringify(events).includes('OpeningPage'));assert.equal(f.read.local().stat.terminal.wallet.yen,500);assert.deepEqual(f.read.local().stat.terminal.unknown,{keep:true});observer.destroy();f.player.stop();
});
test('same request joins while timeout remains locked; another request is refused and late confirmation saves once',async()=>{
 const f=await setup({timeout:8}),gate=deferred(),entered=deferred();f.delaySave(()=>{entered.resolve();return gate.promise;});const req=request(f),before=f.stats(),a=f.player.commit(req),b=f.player.commit({...req});assert.equal(a,b);await entered.promise;await delay(20);
 assert.equal(f.player.saveState().status,'timeout');assert.equal(f.player.quests.status().operation.pending,true);await assert.rejects(f.player.commit({...req,id:'other'}),/仍在核对/);assert.equal(f.stats().saves,before.saves+1);
 gate.resolve();await a;assert.equal(f.stats().maxActive,1);assert.equal(f.stats().reads,before.reads+1);assert.equal(f.player.quests.status().operation.phase,'saved');f.player.stop();
});
test('failed disk readback retries the same receipt and never repeats business settlement',async()=>{
 const f=await setup(),req=request(f);f.failSave(true);await assert.rejects(f.player.commit(req),e=>e.diagnosticKind==='commit-unconfirmed');const state=structuredClone(f.read.local().stat);f.failSave(false);await f.player.commit(req);assert.deepEqual(f.read.local().stat,state);assert.ok(f.diagnostics.read().rows.filter(r=>r.context.classification==='commit-unconfirmed').every(r=>r.resolved));assert.equal(Object.keys(state.terminal.questJournal.receipts).length,1);f.player.stop();
});
test('stale source, changed branch in queue and late chat switch cannot commit into another context',async()=>{
 const f=await setup(),req=request(f),before=f.stats();f.row.mes+=' changed';await assert.rejects(f.player.commit(req),e=>e.diagnosticKind==='source-expired');assert.equal(f.stats().writes,before.writes);
 const gate=deferred(),original=f.lock.host.assertPlayerWritable;f.lock.host.assertPlayerWritable=async x=>{await gate.promise;return original(x);};const current=request(f),pending=f.player.commit(current);await delay(0);f.row.swipe_id=2;gate.resolve();await assert.rejects(pending,e=>e.diagnosticKind==='source-expired');assert.equal(f.stats().writes,before.writes);f.player.stop();
 const g=await setup(),d=deferred();g.delaySave(()=>d.promise);const save=g.player.commit(request(g));await delay(0);g.switchChat();d.resolve();await assert.rejects(save,e=>e.code==='context-changed');assert.ok(!g.diagnostics.read().rows.some(r=>r.stage==='confirmed'));g.player.stop();
});
test('rule rejection is distinguishable and controller releases the rejected request while retaining unconfirmed retries',async()=>{
 const f=await setup(),req={...request(f),expectedRevision:99},before=f.stats();await assert.rejects(f.player.commit(req),e=>e.diagnosticKind==='rule-rejected');assert.equal(f.stats().writes,before.writes);
 let fail='rule-rejected';const c=Controller.create({read:()=>f.read.local().stat,source:()=>f.player.quests.source(),uuid:()=> 'id',commit:async()=>{throw Object.assign(Error('test'),{diagnosticKind:fail});}});await c.run(c.request('accept','q1'));assert.equal(c.state().pending,null);fail='commit-unconfirmed';const retry=c.request('accept','q1');await c.run(retry);assert.equal(c.state().pending,retry);f.row.mes+='new';c.reconcile();assert.equal(c.state().pending,null);c.destroy();f.player.stop();
});
test('refresh failures never turn confirmed storage into failure; asynchronous view failure is diagnosed',async()=>{
 const f=await setup(),old=global.dispatchEvent;global.dispatchEvent=()=>{throw Error('DOM unavailable');};try{await f.player.commit(request(f));assert.equal(f.player.saveState().status,'saved');assert.ok(f.diagnostics.read().rows.some(r=>r.context.classification==='view-not-refreshed'));}finally{global.dispatchEvent=old;}
 Refresh.create({top:{CxxDiagnostics:f.diagnostics},views:new Set([{refresh:()=>Promise.reject(Error('view render failed'))}])}).publish({});await delay(0);assert.ok(f.diagnostics.read().rows.some(r=>r.message==='view render failed'));f.player.stop();
});
test('operation records remain distinct across actions and closed views release pending acknowledgement',async()=>{
 const f=await setup(),view=f.player.quests.registerView();await f.player.commit(request(f));await f.player.commit(request(f,'track'));const rows=f.diagnostics.read().rows.filter(r=>r.stage==='confirmed');assert.equal(rows.length,2);assert.equal(new Set(rows.map(r=>r.context.operation)).size,2);view.destroy();assert.equal(f.player.quests.status().pendingViews,0);f.player.stop();
});
