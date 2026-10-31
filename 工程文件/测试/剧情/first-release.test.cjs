'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../卡片源码'),lines=require('../../卡片源码/剧情/build.cjs').load(file=>fs.readFileSync(path.join(root,file),'utf8'));
const Engine=require('../../卡片源码/剧情/line-engine.js'),Model=require('../../卡片源码/剧情/line-model.js'),A=require('../../卡片源码/运行时/ensemble-state.js'),Q=require('../../卡片源码/运行时/quests.js'),F=require('./fixtures.cjs');
const {plot,run}=require('./lines.test.cjs'),e=Engine.create(lines),quote='当事人当面核对了本段事实与实际结果，记录依照这次交接确认。';
const event=(node,facts,extra={})=>({event:'progress',kind:'happened',node,evidence:facts.map(fact=>({fact,quote})),...extra});
const transact=(state,id,events,floor=2)=>({...state,terminal:{...state.terminal,quests:{...state.terminal.quests,[id]:e.advance(state,id,events,{source:{floor,swipe:0},storyText:quote})}}});
const regional=lines.filter(x=>x.id.startsWith('catalog-'));
test('four regional cases retain source prose, place identity, all outcomes and actual-payment contracts',async()=>{
 const {contentBatch}=await import(require('node:url').pathToFileURL(path.join(root,'地图/content-batch-01.mjs')));
 assert.equal(regional.length,4);
 for(const line of regional){const original=contentBatch.find(x=>x.id===line.id),def=e.definitions.find(x=>x.id===line.id);assert.equal(def.placeId,line.id);assert.equal(def.mapId,'tokyo-central');
  for(const node of line.nodes){assert(node.content.includes(original.desc));for(const [,body]of original.sections)assert(node.content.includes(body));}
  for(const value of Object.keys(line.nodes[2].endings)){let s=F.state();s.terminal.gameplay.location={mapId:line.mapId,placeId:line.placeId};const wallet=structuredClone(s.terminal.wallet);
   s=transact(s,line.id,line.nodes.slice(0,2).map(n=>event(n.id,Object.keys(n.conditions))));
   s=transact(s,line.id,[event('P3',['reported']),event('P3',['resolution_'+value],{event:'choice',choice:'resolution',value})],3);
   assert.equal(s.terminal.quests[line.id].line.ending.id,value);assert.deepEqual(s.terminal.wallet,wallet);assert.equal(s.terminal.quests[line.id].paidYen,0);
  }
 }
});
test('regional first entry requires actual arrival, and refusal closes only the played result',()=>{
 for(const line of regional){let s=F.state();assert(!e.entries(s).some(x=>x.lineId===line.id));assert.throws(()=>transact(s,line.id,[event('P1',Object.keys(line.nodes[0].conditions))]),/未开启/);
  s.terminal.gameplay.location={mapId:line.mapId,placeId:line.placeId};s=transact(s,line.id,[event('P1',['decline'],{event:'outcome',outcome:'decline'}),event('P3',['reported']),event('P3',['resolution_withdrawn'],{event:'choice',choice:'resolution',value:'withdrawn'})]);
  assert.equal(s.terminal.quests[line.id].line.ending.id,'withdrawn');assert.notEqual(s.terminal.quests[line.id].line.nodes.P2?.state,'complete');
 }
});
test('wallet and location gates belong to the controlled actor, while legacy ownership remains player',()=>{
 let s=A.initialize(F.state());s.terminal.ensemble.control.actorId='wb_6';s.terminal.ensemble.control.viewpointActorId='wb_6';s.terminal.ensemble.actors.wb_6.wallet.yen=100;s.terminal.ensemble.actors.wb_6.gameplay.location={mapId:'tokyo',placeId:'station'};
 assert(!Model.matches(s,{check:'wallet',op:'>=',value:2000}));assert(!Model.matches(s,{check:'location',mapId:'tokyo',placeId:'shop'}));
 const engine=Engine.create([F.line]);s.terminal.quests.sample_parcel=engine.advance(s,'sample_parcel',[F.event('P1',['agreed'])],{source:{floor:2},storyText:F.body});assert.equal(s.terminal.quests.sample_parcel.ownerActorId,'wb_6');assert(!engine.entries(s).some(n=>n.nodeId==='P2'));
 s.terminal.ensemble.actors.wb_6.wallet.yen=5000;assert(engine.entries(s).some(n=>n.nodeId==='P2'));
 delete s.terminal.quests.sample_parcel.ownerActorId;assert(!engine.entries(s).some(n=>n.lineId==='sample_parcel'));assert.throws(()=>engine.advance(s,'sample_parcel',[F.event('P2',['found'])],{source:{floor:3},storyText:F.body}),/另一位人物/);
 s.terminal.ensemble.control.actorId='player';s.terminal.ensemble.control.viewpointActorId='player';assert(engine.entries(s).some(n=>n.nodeId==='P2'));
});
test('cross-line first payment initializes its ledger before the same-batch wallet settlement and can be corrected',async()=>{
 const follow={schema:1,id:'paid_followup',title:'后续款项',summary:'核对后续款项',track:'commission',nodes:[{id:'P1',title:'交接',content:'当面核对结果和款项。',requires:[{line:F.line.id,node:'Good'}],conditions:{checked:'同伴实际核对收据'},ending:{id:'done',title:'交接完毕'}}]};
 const p=plot([F.line,follow]),s=F.state(),patches=[{op:'add',path:'/terminal/quests/sample_parcel/events',value:[F.event('P1',['agreed']),F.event('P2',['found','recovered']),F.event('Good',['returned'])]},{op:'add',path:'/terminal/quests/paid_followup/events',value:[F.event('P1',['checked'])]},{op:'add',path:'/terminal/quests/paid_followup/agreedYen',value:500},{op:'add',path:'/terminal/quests/paid_followup/paidYen',value:500},{op:'add',path:'/terminal/quests/paid_followup/settled',value:true},{op:'replace',path:'/terminal/wallet/yen',value:3500},{op:'replace',path:'/terminal/wallet/earned',value:3500}];
 const after=await run(s,patches,p);assert.equal(after.terminal.quests.paid_followup.paidYen,500);assert.equal(after.terminal.wallet.yen,3500);
 const corrected=Q.plan(after,{id:'correct_cross_payment',action:'quest-correct',receiptId:'line_2_0',expectedRevision:1},{questDefinitions:p.definitions});assert.deepEqual(corrected.terminal.wallet,s.terminal.wallet);assert.deepEqual(corrected.terminal.quests,s.terminal.quests);
});
test('legacy history replay explicitly keeps the old chapter gate and never opens the author main route',()=>{
 const p=plot(lines),body='玩家与同行少女共同处理了委托收尾，并答应接受她提出的新工作邀请。';
 const next=p.advance({terminal:{quests:{}}},'q_chip_night',[{event:'accept',stage:1,kind:'happened',evidence:[{fact:'invitation',quote:body}]}],{Q,source:{floor:4,swipe:0},storyText:body,historyRoute:'legacy'});
 assert.equal(next.state,'已接取');assert(!p.entries({terminal:{quests:{}}},{historyRoute:'legacy'}).some(x=>x.lineId==='q_main_pre_heist'));
 assert.throws(()=>p.advance({terminal:{quests:{}}},'q_chip_night',[{event:'accept',stage:1,kind:'happened',evidence:[{fact:'invitation',quote:body}]}],{Q,source:{floor:4,swipe:0},storyText:body}),/新故事/);
});

test('switching actors cannot continue, resume or use another actors story prerequisite and does not leak its facts',()=>{
 const follow={schema:1,id:'owned_followup',title:'后续',summary:'仍由原接取人继续',track:'commission',nodes:[{id:'P1',title:'继续',content:'继续原来的工作。',requires:[{line:F.line.id,node:'Good'}],conditions:{checked:'核对'},ending:{id:'done',title:'完成'}}]},p=plot([F.line,follow]);
 let s=A.initialize(F.state());const engine=Engine.create([F.line,follow]);s.terminal.quests.sample_parcel=engine.advance(s,'sample_parcel',[F.event('P1',['agreed']),F.event('P2',['found','recovered']),F.event('Good',['returned'])],{source:{floor:2},storyText:F.body});s.terminal.quests.sample_parcel.knownFacts='PRIVATE_PLAYER_CASE_FACT';
 s.terminal.quests.q01={state:'进行中',ownerActorId:'player',knownFacts:'PRIVATE_COMMISSION_FACT',plot:{schema:1,facts:{},history:[]}};
 s.terminal.ensemble.control.actorId='wb_6';s.terminal.ensemble.control.viewpointActorId='wb_6';
 assert(!p.entries(s).some(n=>n.lineId==='owned_followup'));assert(!p.context(s,{analyzes:true}).includes('PRIVATE_'));assert.throws(()=>p.advance(s,'q01',[{event:'progress',kind:'happened',evidence:[{fact:'started',quote}]}],{Q,source:{floor:3},storyText:quote}),/另一位人物/);
});

test('all six author branch combinations preserve partner outcomes and require actual self implantation for the dual-soul line',()=>{
 const main=lines.filter(x=>x.route==='author-20261018');assert.equal(main.length,3);assert.equal(main.reduce((sum,x)=>sum+x.nodes.length,0),13);
 for(const chip of ['player','other','external'])for(const partner of ['alive','dead']){
  let s=F.state();for(const line of main){
   if(line.id==='q_main_dual_soul'&&chip!=='player'){assert(!e.entries(s).some(n=>n.lineId===line.id));assert.throws(()=>transact(s,line.id,[event('P1',Object.keys(line.nodes[0].conditions))]),/未开启/);continue;}
   for(const node of line.nodes){
    if(line.id==='q_main_pre_heist'){s=transact(s,line.id,[event(node.id,['wait'],{event:'outcome',outcome:'wait'})]);assert.equal(s.terminal.quests[line.id].line.nodes[node.id].state,'paused');s=transact(s,line.id,[event(node.id,['resume'],{event:'resume'})]);}
    const events=[event(node.id,Object.keys(node.conditions))];for(const choice of Object.keys(node.choices||{})){const value=choice==='chip_host'?chip:partner;events.push(event(node.id,[choice+'_'+value],{event:'choice',choice,value}));}s=transact(s,line.id,events);
   }
  }
  assert.equal(s.terminal.quests.q_main_heist.line.ending.id,'partner_'+partner);assert.equal(!!s.terminal.quests.q_main_dual_soul,chip==='player');assert.equal(s.terminal.wallet.yen,3000);
 }
 const legacy=F.state();legacy.terminal.quests.q_heist={state:'进行中',knownFacts:'旧路线实际进度'};assert(!e.entries(legacy).some(n=>n.lineId.startsWith('q_main_')));assert.equal(legacy.terminal.quests.q_heist.knownFacts,'旧路线实际进度');
});
