'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Adapter=require('../../卡片源码/长期记忆/adapter.js'),M=require('../../卡片源码/长期记忆/material.js'),S=require('../../卡片源码/运行时/context-source.js'),parser=require('../../卡片源码/Gal/parser.js'),bundle=require('../../卡片源码/长期记忆/package.cjs').data();
const KEY=M.KEY,scope={character:'fixture.png',chat:'story',group:null};
async function fixture({laterReply=false}={}){
 const control={actorId:'wb_10',viewpointActorId:'wb_10',revision:1},actors={player:{actorId:'player',name:'原玩家'},wb_10:{actorId:'wb_10',name:'丰川祥子'},wb_6:{actorId:'wb_6',name:'千早爱音'}};
 const body='祥子把银色钥匙交给了爱音。爱音说钥匙在楼下，实际仍在阁楼。祥子因为这次交付而信任爱音。';
 const seed={mes:body,is_user:false,variables:[{stat_data:{terminal:{ensemble:{schema:1,actors,control},wallet:{yen:7654}}}}]},messages=laterReply?[seed,{mes:'稍后再见。',is_user:true},{...structuredClone(seed),mes:'爱音确认稍后会再来取另一把钥匙。'}]:[seed],handlers={},injections=[];
 const c={characters:[{avatar:scope.character}],characterId:0,chatMetadata:{},chat:S.plan(messages,{resolveBinding:()=>({...control,evidence:'fixture'})}).chat,getCurrentChatId:()=>scope.chat,saveChat:async()=>{},eventTypes:{},eventSource:{on(e,fn){(handlers[e]||=[]).push(fn);},removeListener(e,fn){handlers[e]=handlers[e].filter(f=>f!==fn);}}};
 for(const e of ['GENERATION_STARTED','WORLDINFO_ENTRIES_LOADED','GENERATE_AFTER_DATA','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_EDITED','MESSAGE_DELETED'])c.eventTypes[e]=e;
 let index=await S.snapshot(c.chat,scope),vars={[KEY]:{schema:1,enabled:true,book:'book',notes:[],controls:{},tableVersion:1}},tables=structuredClone(bundle.template),snapshots=null,imports=0,corrupt=false;
 const ref=(floor=0)=>{const r=index.rows[floor];return r?{scope:structuredClone(index.scope),messageId:r.messageId,variantId:r.variantId,digest:r.digest,ancestry:r.ancestry}:null;},source={story:[scope.character,scope.chat],floor:0,swipe:0,quote:'祥子把银色钥匙交给了爱音。',ref:ref()};
 function add(name,cells){const t=Object.values(tables).find(t=>t.name===name);t.content.push(t.content[0].map(h=>h==='row_id'?t.content.length:cells[h]??''));}
 add('纪要表',{'编码索引':'AM0001','概览':'私密旧纪要','纪要':'不能给当前人物的旧全景内容<cxx-source>'+JSON.stringify(source)+'</cxx-source>'});
 add('事件记录',{'事件编号':'EV0001','类别':'已发生','内容':'钥匙实际在阁楼','参与人物':'["wb_10","wb_6"]','关联纪要':'AM0001','来源':JSON.stringify(source)});
 add('人物认知',{'认知编号':'KN0001','人物编号':'wb_10','事件编号':'EV0001','认知类型':'亲历','所知内容':'我已经交出钥匙。','获知途径':'亲手交付','来源':JSON.stringify(source)});
 add('人物认知',{'认知编号':'KN0002','人物编号':'wb_6','事件编号':'EV0001','认知类型':'误解','所知内容':'钥匙在楼下。','获知途径':'听人说起','来源':JSON.stringify(source)});
 add('关系变化',{'变化编号':'RL0001','起点人物':'wb_10','指向人物':'wb_6','关系描述':'这次交付让我更信任爱音。','标签':'["信任"]','事件编号':'EV0001','来源':JSON.stringify(source)});
 const db={exportTableAsJson:()=>tables,importTemplateFromData:async(template,options)=>{assert.equal(options.dataMode,'seed');assert.equal(options.conflictPolicy,'keep-current');imports++;const after=structuredClone(template);for(const [k,t]of Object.entries(tables))if(t?.content)after[k].content=structuredClone(t.content);tables=after;snapshots=structuredClone(tables);if(corrupt)snapshots.sheet_cxx_chronicle.content.pop();return {success:true};},exportTableSnapshotsAtMessages:async()=>({success:true,snapshots:[{data:snapshots}]}),importPlotPresetFromData:async()=>({success:true})};
 const currentControl=()=>c.chat.findLast(m=>m.variables)?.variables[0].stat_data.terminal.ensemble.control;
 const host={AutoCardUpdaterAPI:db,EjsTemplate:{evalTemplate(){}},CxxContext:{reference:ref,validSource:r=>S.valid(r,index),binding:currentControl,generationBinding:type=>S.generationBinding(c.chat,{type,current:{...currentControl(),evidence:'fixture'}})}},api={SillyTavern:{getContext:()=>c},getVariables:()=>vars,updateVariablesWith:async fn=>{vars=fn(vars);},getWorldbook:async()=>[{name:'TavernDB-ACU-CustomExport-纪要索引',content:'AM0001'}],getOrCreateChatWorldbook:async()=> 'book',injectPrompts:rows=>{const record={rows:structuredClone(rows),active:true};injections.push(record);return {uninject(){record.active=false;}};}};
 const create=()=>Adapter.create({api,host,parser,bundle,material:M});return {c,control:currentControl(),host,api,source,create,add,injections,emit:async(e,...args)=>{for(const fn of [...(handlers[e]||[])])await fn(...args);},vars:()=>vars,tables:()=>tables,imports:()=>imports,setCorrupt:value=>{corrupt=value;},refresh:async()=>{index=await S.snapshot(c.chat,scope);}};
}
test('limited recall uses only current cognition and directed relations; legacy summaries and other minds remain out',async()=>{
 const f=await fixture(),s=f.create(),raw=await s.recallContext();assert(raw.includes('我已经交出钥匙'));assert(raw.includes('更信任爱音'));for(const text of ['阁楼','楼下','私密旧纪要','旧全景内容','7654','祥子把银色钥匙交给了爱音'])assert(!raw.includes(text),text);
 const view=s.narrative({actorId:'wb_10'});assert.equal(view.knowledge.length,1);assert.equal(view.relations.length,1);assert.throws(()=>s.narrative({actorId:'wb_6'}),/其他人物/);assert.equal(s.narrative({actorId:'wb_6',mode:'author'}).knowledge[0].kind,'误解');assert(s.fillContext().includes('"ref"'));assert(s.fillContext().includes('阁楼'));s.destroy();
});
test('editing text outside a still matching quote invalidates strong references and all dependent views',async()=>{
 const f=await fixture(),s=f.create();assert.equal(s.narrative().knowledge.length,1);f.c.chat[0].mes+='另一段被编辑的内容。';await f.refresh();assert.equal(s.narrative().knowledge.length,0);assert.equal(s.narrative().relations.length,0);assert.equal(s.list().length,0);s.destroy();
});
test('six-table configuration is non-destructive, uses native readback and does not repeat a successful upgrade',async()=>{
 const f=await fixture(),s=f.create(),before=structuredClone(f.tables()),stat=structuredClone(f.c.chat[0].variables);await s.install();for(const [k,t]of Object.entries(before))if(t?.content)assert.deepEqual(f.tables()[k].content,t.content);assert.equal(f.vars()[KEY].tableVersion,2);await s.install();assert.equal(f.imports(),1);assert.deepEqual(f.c.chat[0].variables,stat);s.destroy();
});
test('failed native template readback does not acknowledge the upgrade; retry preserves rows',async()=>{
 const f=await fixture(),s=f.create(),before=structuredClone(f.tables());f.setCorrupt(true);await assert.rejects(s.install(),/原记录尚未读回一致/);assert.equal(f.vars()[KEY].tableVersion,1);f.setCorrupt(false);await s.install();assert.equal(f.vars()[KEY].tableVersion,2);assert.equal(f.imports(),2);for(const [k,t]of Object.entries(before))if(t?.content)assert.deepEqual(f.tables()[k].content,t.content);s.destroy();
});
test('notes carry the chosen actor and branch; switching actors does not grant the old notes',async()=>{
 const f=await fixture(),s=f.create();await s.addNote('仅祥子视角的手记');assert.equal(f.vars()[KEY].notes[0].actorId,'wb_10');assert((await s.recallContext()).includes('仅祥子视角的手记'));s.destroy();f.control.actorId='wb_6';f.control.viewpointActorId='wb_6';f.control.revision++;const next=f.create();const raw=await next.recallContext();assert(!raw.includes('仅祥子视角的手记'));assert(raw.includes('钥匙在楼下'));assert(!raw.includes('误解'));assert(!raw.includes('阁楼'));next.destroy();
});
test('a cached recall cannot continue after the control binding changes',async()=>{
 const f=await fixture(),s=f.create();await s.recallContext();f.control.actorId='wb_6';f.control.viewpointActorId='wb_6';f.control.revision++;await assert.rejects(s.recallContext(),/本轮回复来源已变化/);s.destroy();
});

for(const type of ['regenerate','swipe','continue'])test(type+' recalls and pins the original reply actor while the table keeps its selected viewpoint',async()=>{
 const f=await fixture({laterReply:true}),s=f.create().start();
 try{
  f.add('关系变化',{'变化编号':'RL0002','起点人物':'wb_10','指向人物':'wb_6','关系描述':'仍愿意合作。','标签':'[]','未解问题':'还需要确认下次见面的地点。','事件编号':'EV0001','取代变化':'RL0001','来源':JSON.stringify(f.source)});
  const tailSource={...f.source,floor:2,quote:'爱音确认稍后会再来取另一把钥匙。',ref:f.host.CxxContext.reference(2)};
  f.add('事件记录',{'事件编号':'EV0002','类别':'已发生','内容':'这条将被重写的回复。','参与人物':'["wb_10"]','来源':JSON.stringify(tailSource)});
  f.add('人物认知',{'认知编号':'KN0003','人物编号':'wb_10','事件编号':'EV0002','认知类型':'亲历','所知内容':'这条旧回复才产生的记忆。','获知途径':'当面听到','来源':JSON.stringify(tailSource)});
  await s.addNote('祥子的早先手记。',{mode:'permanent'});f.vars()[KEY].notes[0].branchRef=f.host.CxxContext.reference(0);
  await s.addNote('这条旧回复之后写下的手记。');
  f.control.actorId='wb_6';f.control.viewpointActorId='wb_6';f.control.revision++;
  await f.emit('GENERATION_STARTED',type,{},false);
  assert.equal(s.narrative().actorId,'wb_6');assert.throws(()=>s.narrative({actorId:'wb_10'}),/其他人物/);
  const oldReply=f.c.chat.at(-1);
  if(type==='regenerate'){f.c.chat.pop();await f.emit('MESSAGE_DELETED',f.c.chat.length);await f.refresh();}
  const recalled=JSON.parse(await s.recallContext());assert.equal(recalled.viewpoint.actorId,'wb_10');assert(recalled.candidates.some(r=>r.id==='KN0001'));assert(!recalled.candidates.some(r=>r.id==='KN0002'));
  assert.equal(recalled.candidates.some(r=>r.id==='KN0003'),type==='continue');assert.equal(JSON.stringify(recalled).includes('这条旧回复之后写下的手记'),type==='continue');
  assert.equal(s.contextPins('wb_10')[0].text,'还需要确认下次见面的地点。');assert.throws(()=>s.contextPins('wb_6'),/其他人物/);
  assert(f.injections.some(r=>r.active&&JSON.stringify(r.rows).includes('祥子的早先手记')));
  assert(!JSON.stringify(recalled).includes('钥匙在楼下'));assert(!JSON.stringify(recalled).includes('阁楼'));
  if(type==='regenerate')f.c.chat.push({...oldReply,mes:'重新生成的回复。'});
  else if(type==='swipe'){oldReply.swipes=[oldReply.mes,'另一个回复分支。'];oldReply.swipe_id=1;oldReply.variables[1]=structuredClone(oldReply.variables[0]);oldReply.mes=oldReply.swipes[1];}
  else oldReply.mes+='继续写出的后文。';
  await f.emit('GENERATION_ENDED');assert(f.injections.every(r=>!r.active));
  await f.emit('GENERATION_STARTED','normal',{},false);assert.equal(JSON.parse(await s.recallContext()).viewpoint.actorId,'wb_6');assert(!JSON.stringify(f.injections.filter(r=>r.active)).includes('祥子的早先手记'));
 }finally{s.destroy();}
});

test('changing the selected actor during a prepared request invalidates recall and compression pins',async()=>{
 const f=await fixture({laterReply:true}),s=f.create().start();try{await f.emit('GENERATION_STARTED','normal',{},false);await s.recallContext();f.control.actorId='wb_6';f.control.viewpointActorId='wb_6';f.control.revision++;await assert.rejects(s.recallContext(),/本轮回复来源已变化/);assert.throws(()=>s.contextPins('wb_10'),/本轮回复来源已变化/);}finally{s.destroy();}
});

test('a rewrite without original actor evidence stops before injecting memories',async()=>{
 const f=await fixture({laterReply:true}),s=f.create().start();try{f.c.chat.at(-1).extra.cxx_context.binding=null;f.control.actorId='wb_6';f.control.viewpointActorId='wb_6';f.control.revision++;await assert.rejects(f.emit('GENERATION_STARTED','regenerate',{},false),/没有可确认的扮演人物/);assert.equal(f.injections.length,0);assert.equal(JSON.parse(await s.recallContext()).viewpoint.actorId,'wb_6');}finally{s.destroy();}
});

test('disabled long memory contributes no pins to an original-actor rewrite',async()=>{
 const f=await fixture(),s=f.create();try{f.vars()[KEY].enabled=false;assert.deepEqual(s.contextPins('wb_6'),[]);}finally{s.destroy();}
});

test('regenerating the first reply retains its actor but none of its discarded memories',async()=>{
 const f=await fixture(),s=f.create().start();try{f.control.actorId='wb_6';f.control.viewpointActorId='wb_6';f.control.revision++;await f.emit('GENERATION_STARTED','regenerate',{},false);f.c.chat.pop();await f.emit('MESSAGE_DELETED',0);await f.refresh();const recalled=JSON.parse(await s.recallContext());assert.equal(recalled.viewpoint.actorId,'wb_10');assert.deepEqual(recalled.candidates,[]);assert.deepEqual(s.contextPins('wb_10'),[]);}finally{s.destroy();}
});

test('empty first install verifies the saved template without requiring a history checkpoint',async()=>{
 const f=await fixture();f.vars()[KEY].enabled=false;for(const t of Object.values(f.tables()))if(t?.content)t.content=t.content.slice(0,1);let reads=0;f.host.AutoCardUpdaterAPI.exportTableSnapshotsAtMessages=async()=>{reads++;return {success:false,code:'replay_failed',error:'no formal baseline'};};f.host.AutoCardUpdaterAPI.getTableTemplate=()=>structuredClone(f.tables());const s=f.create();await s.install();assert.equal(reads,0);assert.equal(f.vars()[KEY].enabled,true);assert.equal(f.vars()[KEY].tableVersion,2);s.destroy();
});
test('a missing column in the saved empty template cannot acknowledge configuration',async()=>{const f=await fixture();f.vars()[KEY].enabled=false;for(const t of Object.values(f.tables()))if(t?.content)t.content=t.content.slice(0,1);f.host.AutoCardUpdaterAPI.getTableTemplate=()=>{const out=structuredClone(f.tables());Object.values(out).find(t=>t?.name==='人物认知').content[0].pop();return out;};const s=f.create();await assert.rejects(s.install(),/表与列：人物认知/);assert.equal(f.vars()[KEY].enabled,false);s.destroy();});
test('a populated database never falls back to template-only success on replay failure',async()=>{const f=await fixture(),before=structuredClone(f.tables());f.host.AutoCardUpdaterAPI.exportTableSnapshotsAtMessages=async()=>({success:false,code:'replay_failed',error:'damaged frame'});f.host.AutoCardUpdaterAPI.getTableTemplate=()=>f.tables();const s=f.create();await assert.rejects(s.install(),e=>e.code==='memory-template-readback'&&e.message.includes('damaged frame'));assert.equal(f.vars()[KEY].tableVersion,1);for(const [k,t]of Object.entries(before))if(t?.content)assert.deepEqual(f.tables()[k].content,t.content);s.destroy();});
test('concurrent configuration clicks share one native import transaction',async()=>{const f=await fixture(),s=f.create();await Promise.all([s.install(),s.install()]);assert.equal(f.imports(),1);s.destroy();});
