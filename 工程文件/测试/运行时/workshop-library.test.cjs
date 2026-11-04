'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../../卡片源码/运行时/core.js'),Content=require('../../卡片源码/运行时/content.js'),Controller=require('../../卡片源码/运行时/controller.js'),Discovery=require('../../卡片源码/运行时/discovery.js'),Tools=require('../../工具/发布/packages.cjs');
const F=require('../lib/fixture-loader.cjs')('controller.test.cjs',['fixture','signedRelease','definition','quest']);
const id='community.contract.94001',pack=version=>F.definition({id,version,optional:true,activation:'opt_in',content:{quests:[F.quest('workshop-quest',version==='1.0.1'?100:200)],gallery:[],worldbook:[]}});
const copy=structuredClone,bytes=value=>Buffer.from(Tools.canonical(value));
function fixture(release,options={}){return F.fixture(release,{catalogUrl:Controller.COMPONENT_CATALOG,...options});}
const action=(h,value)=>h.controller.command({instanceId:h.getState().instanceId,id,...value});
function publish(h,release){h.responses.set(Controller.COMPONENT_CATALOG,release.catalogBytes);for(const file of release.files)h.responses.set(file.entry.url,file.bytes);}
const options=release=>({Core,trustedKeys:release.trusted,fetch:async()=>new Response(release.files[0].bytes)});
test('内容目录无需core：下载订阅、固定旧版、手动换版、停用与撤回保留历史',async()=>{
 const first=F.signedRelease([pack('1.0.1')]),h=fixture(first);
 try{
  await h.controller.check(false);const initial=await h.controller.workshop({refresh:true});assert.equal(initial.loaded,true);assert.equal(initial.items[0].id,id);assert.equal(initial.installed.length,0);
  await action(h,{command:'subscribe',enabled:true,version:'1.0.1'});assert.equal(h.getState().installed[id].version,'1.0.1');assert.equal(h.commits.length,0);assert.equal(h.writes.length,0);assert.equal(h.getState().registry.packages[id].version,'1.0.1');assert.equal(h.getState().subscriptions[id],true);assert.equal(h.chat.__cxx_content_pins?.[id],undefined);
  await action(h,{command:'enable',enabled:true,version:'1.0.1'});assert.equal((await h.controller.workshop()).installed[0].enabledVersion,'1.0.1');
  const second=Tools.buildRelease({packages:[pack('1.0.2')],privateKey:first.keys.privateKey,keyId:'test-publisher'});publish(h,second);
  await action(h,{command:'subscribe',enabled:true,version:'1.0.2'});assert.equal(h.getState().installed[id].version,'1.0.2');assert.equal(h.chat.__cxx_content_pins[id],'1.0.1');assert.deepEqual(new Set((await h.controller.workshop()).installed[0].versions),new Set(['1.0.1','1.0.2']));
  const choices=()=>Content.view({quests:[]},h.getState().registry,{}, {subscriptions:h.getState().subscriptions,pins:h.chat.__cxx_content_pins});assert.equal(choices().quests[0].pay,100);
  await action(h,{command:'enable',enabled:true,version:'1.0.2'});assert.equal(choices().quests[0].pay,200);
  await action(h,{command:'enable',enabled:false});assert.equal(h.chat.__cxx_content_pins[id],undefined);assert.equal(choices().quests.length,0);
  await action(h,{command:'enable',enabled:true,version:'1.0.1'});
  h.responses.set(Controller.COMPONENT_CATALOG,bytes(Tools.signDocument({...first.catalog,packages:[]},first.keys.privateKey,'test-publisher')));assert.equal((await h.controller.workshop({refresh:true})).items.length,0);assert.equal(choices().quests[0].pay,100);assert.equal(h.getState().installed[id].version,'1.0.2');
 }finally{h.controller.stop();}
});
test('旧档独有内容可见、可停用和取消订阅，写回保留原档与全局注册表',async()=>{
 const firstRelease=F.signedRelease([pack('1.0.1')]),first=JSON.parse(firstRelease.files[0].bytes),release=F.signedRelease([pack('1.0.2')]),archive=Core.mergeRegistry({format:1,packages:{}},first,{subscriptions:[id]}).registry,h=fixture(release);
 try{
  h.chat.__cxx_migration={format:1,archive:{packages:copy(archive.packages),legacyQuests:[]},preferences:{subscriptions:{[id]:true}}};h.chat.__cxx_content_pins={[id]:'1.0.1'};const original=copy(h.chat.__cxx_migration);
  await h.controller.check(false);const view=await h.controller.workshop();assert.equal(view.subscriptions[id],true);assert.equal(view.installed[0].scope,'story');assert.equal(view.installed[0].installed,false);assert.equal(view.installed[0].enabledVersion,'1.0.1');
  await action(h,{command:'enable',enabled:false});await action(h,{command:'subscribe',enabled:false});assert.equal(h.getState().subscriptions[id],false);assert.equal(Content.withMigration(h.getState(),h.chat).subscriptions[id],false);assert.deepEqual(h.getState().registry.packages,{});assert.deepEqual(h.chat.__cxx_migration,original);
  await action(h,{command:'subscribe',enabled:true});await action(h,{command:'enable',enabled:true,version:'1.0.1'});assert.equal(h.chat.__cxx_content_pins[id],'1.0.1');assert.deepEqual(h.getState().registry.packages,{});
 }finally{h.controller.stop();}
});
test('异步下载中切换聊天保持新旧存档和安装记录',async()=>{
 const h=fixture(F.signedRelease([pack('1.0.1')]));try{await h.controller.check(false);const before=copy(h.getState()),pending=action(h,{command:'subscribe',enabled:true,version:'1.0.1'});h.currentContext.chatId='another-story';await assert.rejects(pending,{code:'context-changed'});assert.deepEqual(h.getState(),before);assert.equal(h.writes.length,0);assert.deepEqual(h.chat.__cxx_content_pins,{});}finally{h.controller.stop();}
});
test('内容包实际字节、签名与目录身份均参与验证',async()=>{
 const release=F.signedRelease([pack('1.0.1')]),entry=release.catalog.packages[0],valid=options(release);assert.equal((await Discovery.downloadContent(entry,valid)).pack.id,id);
 const corrupt=Buffer.from(release.files[0].bytes);corrupt[10]^=1;await assert.rejects(Discovery.downloadContent(entry,{...valid,fetch:async()=>new Response(corrupt)}),{code:'package-digest-mismatch'});
 await assert.rejects(Discovery.downloadContent(entry,{...valid,trustedKeys:{}}),{code:'untrusted-signature'});
 for(const change of [{id:'another.content'},{version:'1.0.9'},{optional:false},{activation:'compatible'},{requires:{engine:'1.0.1',packages:[]}}])await assert.rejects(Discovery.downloadContent({...entry,...change},valid),{code:'package-entry-mismatch'});
});

test('工坊人设作为自定义出身模板完成原生建档，保持定义、pin、资金和原分支',async()=>{
 const C=require('../../网站/gateway/workshop-contract.cjs'),P=C.library(),d=require('../网站/examples.cjs').sample('user_identity'),payload=JSON.stringify(d.payload),compiled=C.compile({...d,id:94003,revision:1,publisher_id:'3333333333333333',author_name:'合成作者',tags:JSON.stringify(d.tags),payload,content_hash:P.sha256(payload)},{publisher_id:'3333333333333333',status:'active'},P).package;
 const release=F.signedRelease([compiled]),signed=JSON.parse(release.files[0].bytes),mapIndex=Object.fromEntries(C.schema().maps.map(m=>[m.id,m.places.map(p=>p.id)])),registry=Core.mergeRegistry({format:1,packages:{}},signed,{mapIndex,subscriptions:[signed.id]}).registry,state={registry,subscriptions:{[signed.id]:true}},starts=Content.storyChoices(registry,{subscriptions:state.subscriptions,pins:{[signed.id]:signed.version}}).starts;
 const h=require('../lib/opening-fixture.cjs').fixture({hostState:state,readStarts:()=>starts});try{
  h.flow.chooseStart(starts[0].id);assert.equal(h.flow.state().draft.origin,'custom');assert.equal(h.flow.state().draft.openingText,starts[0].opening);h.flow.next();h.flow.next();h.flow.next();h.flow.patch({openingFunds:0,loadout:{items:[]}});h.flow.next();h.flow.review();const untouched=copy(h.row.variables[2]);await h.flow.commit();
  const vars=h.ctx.chatMetadata.variables;assert.equal(vars.__cxx_identity.name,starts[0].name);assert.equal(vars.__cxx_content_pins[signed.id],signed.version);assert.equal(h.row.variables[1].stat_data.terminal.wallet.yen,0);assert.deepEqual(h.row.variables[1].stat_data.terminal.gameplay.origin.definitionRef,starts[0].definitionRef);assert.deepEqual(h.row.variables[2],untouched);assert.equal(h.row.mes,starts[0].opening);assert.deepEqual(h.disk()[0].chat_metadata.variables.__cxx_identity.communityStart,starts[0]);
  const route=require('../lib/fixture-loader.cjs')('content-routing.test.cjs',['fixture']).fixture(),oldContent=copy(signed.content);route.state.registry={format:1,packages:{[signed.id]:{version:'1.0.2',optional:true,activation:'opt_in',content:{...copy(oldContent),worldbook:[{...copy(oldContent.worldbook[0]),content:'新版人设资料'}]},history:{'1.0.1':oldContent}}}};route.state.subscriptions={[signed.id]:false};route.options.api.getVariables=({type})=>type==='message'?{stat_data:{terminal:{gameplay:{origin:{definitionRef:starts[0].definitionRef}}}}}:{__cxx_content_pins:{[signed.id]:'1.0.2'}};await route.sync();assert.equal(route.book.entries.filter(e=>e.content===oldContent.worldbook[0].content).length,1);assert.equal(route.book.entries.find(e=>e.content===oldContent.worldbook[0].content).strategy.type,'constant');assert.equal(oldContent.worldbook[0].strategy.type,'selective');assert(!route.book.entries.some(e=>e.content==='新版人设资料'));

 }finally{h.player.stop();h.flow.destroy();}
});

test('内容namespace保存失败保留完整旧账本，同一签名动作可以重试',async()=>{
 const h=fixture(F.signedRelease([pack('1.0.1')]));try{await h.controller.check(false);const prior=copy(h.getState()),save=h.host.saveState;h.host.saveState=async()=>{throw Object.assign(Error('injected namespace write'),{code:'persistence-http-error'});};await assert.rejects(action(h,{command:'subscribe',enabled:true,version:'1.0.1'}),{code:'persistence-http-error'});assert.deepEqual(h.getState(),prior);assert.equal(h.writes.length,0);h.host.saveState=save;const count=h.saves.length;await action(h,{command:'subscribe',enabled:true,version:'1.0.1'});assert.equal(h.saves.length-count,1);assert.equal(h.getState().registry.packages[id].version,'1.0.1');assert.equal(h.getState().installed[id].version,'1.0.1');assert.equal(h.getState().subscriptions[id],true);assert.deepEqual(h.getState().policy,prior.policy);assert.deepEqual(h.getState().baseline,prior.baseline);}finally{h.controller.stop();}
});
test('旧跨组件pending先恢复，再原子保存新的内容目标',async()=>{
 const h=fixture(F.signedRelease([pack('1.0.1')]));try{await h.controller.check(false);const before=await h.host.snapshot(),prior=copy(h.getState()),journal={format:2,id:'legacy-content-journal',context:h.host.getContext(),before,after:copy(before),stages:[],attempted:[],completed:[],installed:{installed:prior.installed,baseline:prior.baseline,conflicts:[],scope:'character',registry:before.registry},commitAttempted:false,status:'prepared'};await h.host.withLock(()=>h.storage.claim('cxx-update-journal',journal));let cleared=false;const save=h.host.saveState;h.host.saveState=async value=>{if(value.installed[id])cleared=await h.storage.get('cxx-update-journal')===null;return save(value);};await action(h,{command:'subscribe',enabled:true,version:'1.0.1'});assert.equal(cleared,true);assert.equal(h.commits.length,1);assert.equal(h.getState().installed[id].version,'1.0.1');assert.equal(h.getState().registry.packages[id].version,'1.0.1');}finally{h.controller.stop();}
});

test('模型资料投影先保存冲突，书写失败保留原书和证据，重试成功',async()=>{
 const h=fixture(F.signedRelease([]));try{await h.controller.check(false);const before=copy(h.snapshot.worldbook),after={...before,entries:[{uid:1,name:'投影条目',content:'实际资料',extra:{}}]},registry=copy(h.getState().registry),conflicts=[{scope:'chat',id:'keep-local'}],write=h.host.writeStage;h.host.writeStage=async()=>{throw Object.assign(Error('injected worldbook write'),{code:'persistence-http-error'});};await assert.rejects(h.host.withLock(()=>h.controller.writeContentProjection(before,after,{registry,conflicts})),{code:'persistence-http-error'});assert.deepEqual(h.snapshot.worldbook,before);assert.deepEqual(h.getState().conflicts,conflicts);assert.deepEqual(h.getState().registry,registry);h.host.writeStage=write;await h.host.withLock(()=>h.controller.writeContentProjection(before,after,{registry,conflicts}));assert.deepEqual(h.snapshot.worldbook,after);assert.equal(h.commits.length,0);assert.equal(await h.storage.get('cxx-update-journal'),null);}finally{h.controller.stop();}
});
test('旧档内容只进入资料投影，写入比较使用原始registry，archive和角色库保持',async()=>{
 const h=fixture(F.signedRelease([]));try{await h.controller.check(false);const Host=require('../../卡片源码/运行时/host.js'),entry=Host.normalizeEntry({uid:7,name:'旧档背景',content:'保留的旧档资料',enabled:true,strategy:{type:'selective',keys:['旧档'],keys_secondary:{logic:'and_any',keys:[]},scan_depth:'same_as_global'},position:{type:'before_character_definition',role:'system',depth:0,order:100},effect:{},recursion:{},extra:{}}),packageId='archive.story';h.chat.__cxx_migration={format:1,archive:{packages:{[packageId]:{version:'1.0.0',optional:true,activation:'opt_in',content:{quests:[],gallery:[],worldbook:[entry]},history:{}}}},preferences:{subscriptions:{[packageId]:true}}};h.chat.__cxx_content_pins={[packageId]:'1.0.0'};const archive=copy(h.chat.__cxx_migration),raw=copy(h.getState().registry),calls=[],sync=require('../../卡片源码/运行时/business-content-sync.js').create({api:h.api,Core,Content,Host,host:h.host,readSeed:()=>({characterIds:[],mapIndex:{}}),writeProjection:(...args)=>{calls.push(copy(args[2].registry));return h.controller.writeContentProjection(...args);}});await h.host.withLock(()=>sync());assert(h.snapshot.worldbook.entries.some(row=>row.content===entry.content));assert.deepEqual(calls,[raw]);assert.deepEqual(h.getState().registry,raw);assert.deepEqual(h.chat.__cxx_migration,archive);assert.equal(h.commits.length,0);}finally{h.controller.stop();}
});

test('忙态命令返回实际失败，原记录保持，空闲后单次保存成功',async()=>{
 const h=fixture(F.signedRelease([pack('1.0.1')]));try{await h.controller.check(false);const before=copy(h.getState());h.currentContext.busy=true;await assert.rejects(action(h,{command:'subscribe',enabled:true}),{code:'host-busy'});assert.deepEqual(h.getState(),before);h.currentContext.busy=false;const pending=action(h,{command:'subscribe',enabled:true,version:'1.0.1'});await assert.rejects(action(h,{command:'subscribe',enabled:false}),{code:'update-already-running'});await pending;assert.equal(h.getState().subscriptions[id],true);assert.equal(h.getState().installed[id].version,'1.0.1');}finally{h.controller.stop();}
});

test('订阅等待既有宿主短锁，排队后核对原聊天再保存',async()=>{
 for(const switched of [false,true]){const h=fixture(F.signedRelease([pack('1.0.1')]));let release;try{await h.controller.check(false);const prior=copy(h.getState()),gate=new Promise(resolve=>release=resolve),lock=h.host.withLock;let requested=false;h.host.withLock=async(work,options={})=>{requested=true;if(!options.waitForIdle)throw Object.assign(Error('background host lock'),{code:'update-already-running'});await gate;return lock(work);};const job=action(h,{command:'subscribe',enabled:true,version:'1.0.1'});job.catch(()=>{});while(!requested)await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.getState(),prior);if(switched)h.currentContext.chatId='another-chat';release();if(switched){await assert.rejects(job,{code:'context-changed'});assert.deepEqual(h.getState(),prior);}else{await job;assert.equal(h.getState().subscriptions[id],true);}}finally{release?.();h.controller.stop();}}
});

test('工坊helper卸载释放原回调并销毁面板，旧入口保持关闭',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),events=new Map(),pageEvents=new Map(),host={document:{getElementById:()=>null}},calls={open:0,destroy:0};let ended=false;const win={parent:host,localStorage:{getItem:()=>null},CxxWorkshopPanel:{create:()=>({open(){if(!ended)calls.open++;},close(){},destroy(){ended=true;calls.destroy++;}})},addEventListener:(name,fn)=>pageEvents.set(name,fn),removeEventListener:(name,fn)=>{if(pageEvents.get(name)===fn)pageEvents.delete(name);}};
 const context={window:win,$:fn=>fn(),getButtonEvent:()=> 'workshop-button',tavern_events:{CHAT_CHANGED:'chat-changed'},eventOn:(name,fn)=>{events.set(name,fn);return {stop(){}};},eventRemoveListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}};vm.runInNewContext(fs.readFileSync(require.resolve('../../卡片源码/运行时/workshop-client.js'),'utf8'),context);const runtime=host.CxxWorkshopWebsite;await runtime.open();runtime.destroy();runtime.destroy();await runtime.open();assert.equal(calls.open,1);assert.equal(calls.destroy,1);assert.equal(events.size,0);assert.equal(pageEvents.size,0);assert.equal(host.CxxWorkshopWebsite,undefined);
});


test('原生委托策略消费本档启用版本，接取后跨换版和迁移仍读原定义',()=>{
 const Policy=require('../../卡片源码/MVU/variable-policy.js'),Q=require('../../卡片源码/运行时/quests.js'),fixture=require('../lib/workshop-runtime-fixture.cjs')(),first=JSON.parse(fixture.releases[0].files[2].bytes),second=JSON.parse(fixture.releases[1].files[2].bytes),qid=first.content.quests[0].id;
 let state={registry:Core.mergeRegistry({format:1,packages:{}},first,{subscriptions:[first.id],mapIndex:fixture.mapIndex}).registry,subscriptions:{[first.id]:true}},vars={__cxx_content_pins:{[first.id]:'1.0.1'}};
 const read=Policy.create({api:{getVariables:()=>vars,SillyTavern:{getContext:()=>({chat:[]})}},win:{CxxQuests:Q,Cxx233Updater:{readSeed:()=>({registry:{packages:{}},initialContent:{quests:[]},mapIndex:{}}),host:{readState:()=>state,getContext:()=>({})}}},content:Content});
 const definition=read().questDefinition(qid);assert.equal(definition.definitionRef.version,'1.0.1');const stat={terminal:{quests:{},wallet:{yen:0},gameplay:{}}},accepted=Q.plan(stat,{id:'workshop_accept',action:'quest-accept',questId:qid,expectedRevision:0},{questDefinitions:[definition]});
 assert.equal(accepted.terminal.quests[qid].definitionRef.version,'1.0.1');state.registry=Core.mergeRegistry(state.registry,second,{subscriptions:[first.id],mapIndex:fixture.mapIndex}).registry;vars.__cxx_content_pins[first.id]='1.0.2';assert.equal(read().questDefinition(qid).definitionRef.version,'1.0.2');
 assert.deepEqual(read().questDefinition(qid,accepted.terminal.quests[qid]),first.content.quests[0]);vars.__cxx_content_pins={};assert.equal(read().questDefinition(qid),undefined);
 vars={__cxx_content_pins:{[first.id]:'1.0.1'},__cxx_migration:{format:1,archive:{packages:state.registry.packages},preferences:{subscriptions:{[first.id]:true}}}};state={registry:{format:1,packages:{}},subscriptions:{}};assert.equal(read().questDefinition(qid).definitionRef.version,'1.0.1');
 state.subscriptions[first.id]=false;assert.equal(read().questDefinition(qid),undefined);
});


test('原生策略读取无ref历史已接委托的归档定义，未接的旧条目保持隐藏',()=>{
 const Policy=require('../../卡片源码/MVU/variable-policy.js'),legacy=F.quest('legacy_side',120),vars={__cxx_migration:{format:1,archive:{packages:{},legacyQuests:[legacy]}}},seed={registry:{format:1,packages:{}},initialContent:{quests:[]}};
 const read=Policy.create({api:{getVariables:()=>vars,SillyTavern:{getContext:()=>({chat:[]})}},win:{Cxx233Updater:{readSeed:()=>seed,host:{readState:()=>({registry:seed.registry,subscriptions:{}}),getContext:()=>({})}}},content:Content});
 assert.equal(read().questDefinition(legacy.id),undefined);const q=read().questDefinition(legacy.id,{state:'已接取',objective:'原档目标'});assert.equal(q.title,legacy.title);assert.equal(q.definitionRef.packageId,'migration.legacy');
});
