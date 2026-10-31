'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Core=require("../../卡片源码/运行时/core.js"),Host=require("../../卡片源码/运行时/host.js"),Release=require("../../卡片源码/运行时/release.js"),Controller=require("../../卡片源码/运行时/controller.js"),Publisher=require("../../工具/发布/release-package.cjs"),Safety=require("../../卡片源码/运行时/release-safety.js"),Discovery=require("../../卡片源码/运行时/discovery.js");
const F=require("../lib/fixture-loader.cjs")('controller.test.cjs',['fixture','officialComponents','lifecycleDocument']);
const copy=structuredClone,keys=crypto.generateKeyPairSync('ed25519'),trusted={test:keys.publicKey.export({type:'spki',format:'der'}).toString('base64')};
async function setup(extra={}){
 const before={...F.officialComponents(),registry:{format:1,packages:{}}};before.scripts.trees=before.scripts.trees.map(Host.normalizeScript);before.scripts.trees.unshift(Host.normalizeScript({id:Release.UPDATER,type:'script',enabled:true,content:'updater',name:'更新器',data:{keep:1}}));before.worldbook.entries.push({...copy(before.worldbook.entries[0]),uid:2,content:'second'});
 const seed={cardId:'cyber2051',baseVersion:'2.0.45',engineVersion:'1.4.0',catalogUrl:Controller.RELEASE_CATALOG,trustedKeys:trusted,baseline:await Core.fingerprints(before),release:{protocol:1,owned:Release.ownership(before)},registry:copy(before.registry),initialContent:{quests:[],gallery:[],worldbook:[]},migration:{buildId:'card:old',saveSchema:1,contract:'cyber2051.raw-save.v1',accepts:[],playerStores:[]},installed:{[Release.ID]:{version:'2.0.45',kind:'core'}},characterIds:[],mapIndex:{}};
 const components=copy(before);delete components.registry;components.scripts.trees=components.scripts.trees.filter(s=>s.id!==Release.UPDATER);components.worldbook.entries[0].content='new one';components.worldbook.entries[1].content='new two';components.scripts.trees[0].content='new script';
 const pack={format:3,cardId:'cyber2051',id:Release.ID,version:'2.1.6',kind:'core',optional:false,requires:{engine:'1.4.0',packages:[]},components,release:{protocol:1,updaterId:Release.UPDATER,minBaseVersion:'2.0.41',buildId:'card:new',saveSchema:1,notes:'new',seed:{registry:copy(before.registry),migration:{...seed.migration,buildId:'card:new'}},groups:[{id:'a',members:{worldbook:[1]},requires:[]},{id:'b',members:{worldbook:[2]},requires:[]},{id:'program',members:{regex:['regex-a'],scripts:['script-a']},requires:['a','b']}]}};
 const h=F.fixture({catalog:{packages:[]},files:[],trusted},{state:{engineVersion:'1.4.0',installed:copy(seed.installed),baseline:copy(seed.baseline),registry:copy(seed.registry)}});h.controller.stop();Object.assign(h.snapshot,copy(before));
 const controller=Controller.create({core:Core,hostModule:Host,host:h.host,api:h.api,seed,backup:{beforeContentInstall:async()=>({backupId:'saved'})},crypto:crypto.webcrypto,discoveryStorage:{getItem:()=>'{"enabled":false}',setItem(){}},...extra});
 const sign=p=>Publisher.sign({pack:p,privateKey:keys.privateKey,keyId:'test'}).bytes.toString();return {before,seed,pack,h,controller,sign};
}
test('valid A then invalid JSON B clears install candidate',async t=>{const f=await setup();t.after(()=>f.controller.stop());await f.controller.previewLocalPackage(f.sign(f.pack));await assert.rejects(f.controller.previewLocalPackage('{bad'));await assert.rejects(f.controller.getPackages(f.h.currentContext),{code:'local-package-required'});assert.equal(f.h.writes.length,0);});
test('preview is bound to exact character and component snapshot',async t=>{const f=await setup();t.after(()=>f.controller.stop());await f.controller.previewLocalPackage(f.sign(f.pack));f.h.snapshot.worldbook.entries[0].content='edited after preview';await f.controller.check(true,'manual');assert.equal(f.h.writes.length,0);assert.match(f.controller.getStatus(),/重新选择/);});
test('clean cumulative install keeps data, unknown fields and private additions',async t=>{const f=await setup();t.after(()=>f.controller.stop());f.h.snapshot.scripts.trees[1].data={player:'keep'};f.h.snapshot.worldbook.entries[1].future={zero:0};f.h.snapshot.worldbook.entries.push({...copy(f.before.worldbook.entries[0]),uid:900,content:'private'});await f.controller.previewLocalPackage(f.sign(f.pack));await f.controller.check(true,'manual');assert.equal(f.h.getState().installed[Release.ID].version,'2.1.6',f.controller.getStatus());assert.equal(f.h.snapshot.scripts.trees[1].data.player,'keep');assert.deepEqual(f.h.snapshot.worldbook.entries.find(x=>x.uid===2).future,{zero:0});assert.equal(f.h.snapshot.worldbook.entries.find(x=>x.uid===900).content,'private');assert.deepEqual(f.h.mvudata,f.h.originalMvu);});
test('conflict skips dependent program, persists partial receipt and completes using the identical package',async t=>{const f=await setup();t.after(()=>f.controller.stop());f.h.snapshot.worldbook.entries[0].content='player';const bytes=f.sign(f.pack);await f.controller.previewLocalPackage(bytes);await f.controller.check(true,'manual');let state=f.h.getState();assert.equal(state.installed[Release.ID].version,'2.0.45');assert.deepEqual(state.installed[Release.ID].release.releaseProgress.blockedGroups.sort(),['a','program']);assert.equal(f.h.snapshot.worldbook.entries[0].content,'player');assert.equal(f.h.snapshot.worldbook.entries[1].content,'new two');assert.equal(f.h.snapshot.scripts.trees[1].content,'old script');assert.match(f.controller.getStatus(),/部分更新/);const mutated=copy(f.pack);mutated.release.notes='different';await assert.rejects(f.controller.previewLocalPackage(f.sign(mutated)),{code:'version-collision'});f.h.snapshot.worldbook.entries[0].content=f.before.worldbook.entries[0].content;await f.controller.previewLocalPackage(bytes);await f.controller.check(true,'manual');state=f.h.getState();assert.equal(state.installed[Release.ID].version,'2.1.6',f.controller.getStatus());assert.equal(state.installed[Release.ID].release.releaseProgress,undefined);});
test('upstream unchanged player text is retained without inventing a conflict',async()=>{const f=await setup();f.controller.stop();f.pack.components.worldbook.entries[0].content=f.before.worldbook.entries[0].content;f.h.snapshot.worldbook.entries[0].content='player-only';const plan=await Release.plan({pack:f.pack,sha256:'a'.repeat(64),before:f.h.snapshot,state:f.h.getState(),seed:f.seed,Core,Host});assert.equal(plan.releaseProgress,null);assert.equal(plan.after.worldbook.entries[0].content,'player-only');});
test('invalid dependency cycle and duplicate group ownership reject before writes',async()=>{const f=await setup();f.controller.stop();f.pack.release.groups[0].requires=['program'];await assert.rejects(Release.plan({pack:f.pack,sha256:'a'.repeat(64),before:f.h.snapshot,state:f.h.getState(),seed:f.seed,Core,Host}),{code:'invalid-release-groups'});});
test('rollback preserves new private records and later script data, blocks changed program content',async()=>{const f=await setup();f.controller.stop();const plan=await Release.plan({pack:f.pack,sha256:'a'.repeat(64),before:f.h.snapshot,state:f.h.getState(),seed:f.seed,Core,Host}),current=copy(plan.after);current.worldbook.entries.push({...copy(current.worldbook.entries[0]),uid:900,content:'later note'});current.scripts.trees[1].data={later:'keep'};const journal={before:f.before,after:plan.after};let result=Release.rollback({before:current,journal,Core});assert.equal(result.blocked,false);assert.equal(result.after.worldbook.entries.find(x=>x.uid===900).content,'later note');assert.deepEqual(result.after.scripts.trees[1].data,{later:'keep'});current.scripts.trees[1].content='later custom code';result=Release.rollback({before:current,journal,Core});assert.equal(result.blocked,true);assert.deepEqual(result.after,current);});
test('every write-stage interruption is recovered without deleting player history',async t=>{for(const stage of ['worldbook','regex','registry','scripts']){const f=await setup();t.after(()=>f.controller.stop());f.pack.components.regex.scripts[0].replace_string='new';f.pack.release.seed.registry.packages['test.data']={version:'1.0.0',optional:false,activation:'compatible',content:{quests:[],gallery:[],worldbook:[]},history:{}};const original=f.h.host.writeStage;let fired=false;f.h.host.writeStage=async(k,...a)=>{await original(k,...a);if(k===stage&&!fired){fired=true;throw Error('injected after '+stage);}};await f.controller.previewLocalPackage(f.sign(f.pack));await f.controller.check(true,'manual');assert.ok(fired,stage);assert.deepEqual(f.h.mvudata,f.h.originalMvu);assert.equal(await f.h.storage.get('cxx-update-journal'),null);const state=f.h.getState();assert.ok(state.installed[Release.ID].version==='2.0.45'||state.installed[Release.ID].version==='2.1.6');}});
test('auto discovery verifies manifest, requests no package, deduplicates for 24h and can be disabled',async()=>{const f=await setup();f.controller.stop();const r=Publisher.sign({pack:f.pack,privateKey:keys.privateKey,keyId:'test'}),requested=[],cache=new Map();let clock=Discovery.DAY*2;const d=Discovery.create({Core,seed:()=>f.seed,currentVersion:()=>f.seed.baseVersion,verify:(doc,k)=>Controller.verifyDocument(doc,k,Core,crypto.webcrypto),now:()=>clock,storage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v)},fetch:async(url,o)=>{requested.push(url);assert.equal(o.credentials,'omit');return new Response(JSON.stringify(r.catalog));}});await d.check();await d.check();assert.equal(requested.length,1);assert.deepEqual(requested,[Discovery.URL]);assert.equal(d.state().latest.version,'2.1.6');d.setEnabled(false);clock+=Discovery.DAY;await d.check();assert.equal(requested.length,1);await d.check(true);assert.equal(requested.length,2);d.stop();});
test('invalid discovery signature and offline state never claim latest or install',async()=>{const f=await setup();f.controller.stop();const d=Discovery.create({Core,seed:()=>f.seed,currentVersion:()=>f.seed.baseVersion,verify:async()=>{throw Error('bad signature');},fetch:async()=>new Response('{}')});await d.check(true);assert.match(d.state().status,/检查失败/);assert.equal(d.state().latest,null);assert.equal(f.h.writes.length,0);d.stop();});
module.exports={setup};
test('identical player-created ID is never silently claimed by the updater',async()=>{const f=await setup();f.controller.stop();const record={...copy(f.pack.components.worldbook.entries[1]),uid:901};f.h.snapshot.worldbook.entries.push(record);f.pack.components.worldbook.entries.push(copy(record));const plan=await Release.plan({pack:f.pack,sha256:'a'.repeat(64),before:f.h.snapshot,state:f.h.getState(),seed:f.seed,Core,Host});assert.ok(plan.conflicts.some(x=>x.id===901&&x.reason==='unowned-id-collision'));assert.ok(!plan.installed[Release.ID].release.owned.worldbook.includes(901));assert.deepEqual(plan.after.worldbook.entries.find(x=>x.uid===901),record);});
test('malformed recovery stage lists reject before any host read or write',async()=>{const ctx={cardId:'cyber2051',characterKey:'a.png',chatId:'old',busy:false};for(const fields of [{attempted:['bogus'],completed:[]},{attempted:['worldbook','worldbook'],completed:[]},{attempted:['worldbook'],completed:['worldbook','worldbook']}]){const journal={format:2,id:'transaction',context:ctx,before:{},after:{},stages:['worldbook'],...fields};await assert.rejects(Core.recover({storage:{get:async()=>journal},host:{getContext(){throw Error('host must not be touched');}}}),{code:'invalid-journal'});}});

 test('cumulative deletion fingerprints retain worldbook metadata and preserve player edits',async()=>{
  for(const dirty of [false,true]){const f=await setup();f.controller.stop();f.pack.components.worldbook.entries=f.pack.components.worldbook.entries.filter(e=>e.uid!==2);delete f.pack.release.groups;
   if(dirty)f.h.snapshot.worldbook.entries.find(e=>e.uid===2).content='player edited deferred entry';
   const plan=await Release.plan({pack:f.pack,sha256:'a'.repeat(64),before:f.h.snapshot,state:f.h.getState(),seed:f.seed,Core,Host});
   assert.equal(plan.after.worldbook.internalName,f.before.worldbook.internalName);
   if(dirty){assert(plan.conflicts.some(e=>e.id===2&&e.reason==='deleted-upstream-local-dirty'));assert.equal(plan.after.worldbook.entries.find(e=>e.uid===2).content,'player edited deferred entry');assert(plan.releaseProgress);}else{assert.equal(plan.after.worldbook.entries.some(e=>e.uid===2),false);assert.equal(plan.releaseProgress,null);assert.equal(plan.counts.deleted,1);}
  }
 });

test('only certified conversion markers can be absent during official lore deletion',async()=>{
 for(const mode of ['clean','uncertified','player-extra','flag-changed']){const f=await setup();f.controller.stop();const original=f.before.worldbook.entries.find(e=>e.uid===2);original.extra={__cxx_card_extensions:{display_index:2}};const baseline=await Core.fingerprints(f.before),record=baseline.worldbook.entries.records['number:2'];f.pack.components.worldbook.entries=f.pack.components.worldbook.entries.filter(e=>e.uid!==2);delete f.pack.release.groups;
  f.pack.release.worldbookTransportBaselines=[{uid:2,hash:record.hash,extraHash:mode==='uncertified'?'0'.repeat(64):record.retained.extra}];const local=f.h.snapshot.worldbook.entries.find(e=>e.uid===2);delete local.extra;if(mode==='player-extra')local.extra={player:{keep:true}};if(mode==='flag-changed')local.enabled=!original.enabled;
  const plan=await Release.plan({pack:f.pack,sha256:'a'.repeat(64),before:f.h.snapshot,state:{...f.h.getState(),baseline},seed:f.seed,Core,Host});
  if(mode==='clean'){assert.equal(plan.releaseProgress,null);assert(!plan.after.worldbook.entries.some(e=>e.uid===2));}else{assert(plan.releaseProgress);assert.deepEqual(plan.after.worldbook.entries.find(e=>e.uid===2),local);assert(plan.conflicts.some(e=>e.id===2&&e.reason==='deleted-upstream-local-dirty'));}
 }
});

test('prepared online install waits for the current save and is not silently dropped',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());await f.controller.previewLocalPackage(f.sign(f.pack));const release=await f.controller.pauseForStory();let settled=false;const job=f.controller.installPrepared().finally(()=>{settled=true;});await new Promise(r=>setTimeout(r,150));assert.equal(settled,false);assert.equal(f.h.writes.length,0);release();await job;assert.equal(f.h.getState().installed[Release.ID].version,'2.1.6');assert.deepEqual(f.h.mvudata,f.h.originalMvu);
});
test('queued prepared install cannot follow a changed story',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());await f.controller.previewLocalPackage(f.sign(f.pack));const release=await f.controller.pauseForStory(),job=f.controller.installPrepared();f.h.currentContext.chatId='other';release();await assert.rejects(job,{code:'context-changed'});assert.equal(f.h.writes.length,0);
});

test('first package preview initializes the confirmed ledger before planning and remains installable',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());await f.h.host.saveState({});f.h.saves.length=0;
 const preview=await f.controller.previewLocalPackage(f.sign(f.pack));
 assert.equal(preview.pack.version,'2.1.6');assert.equal(f.h.saves.length,1);assert.deepEqual(f.h.getState().installed,f.seed.installed);assert.deepEqual(f.h.getState().baseline,f.seed.baseline);assert.equal(f.h.getState().characterKey,f.h.currentContext.characterKey);assert(f.h.getState().instanceId);assert.equal(f.h.writes.length,0);assert.deepEqual(f.h.mvudata,f.h.originalMvu);
 await f.controller.installPrepared();assert.equal(f.h.getState().installed[Release.ID].version,'2.1.6',f.controller.getStatus());assert.deepEqual(f.h.mvudata,f.h.originalMvu);
});

test('preview never plans from a seeded fallback when initialization cannot be saved',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());await f.h.host.saveState({});f.h.saves.length=0;
 f.h.host.saveState=async()=>{throw Object.assign(Error('initial ledger readback rejected'),{code:'state-readback-mismatch'});};
 await assert.rejects(f.controller.previewLocalPackage(f.sign(f.pack)),{code:'state-readback-mismatch'});await assert.rejects(f.controller.getPackages(f.h.currentContext),{code:'local-package-required'});assert.deepEqual(f.h.getState(),{});assert.equal(f.h.writes.length,0);
});

test('preview queues behind startup initialization and snapshots only its confirmed result',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());await f.h.host.saveState({});f.h.saves.length=0;
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r),save=f.h.host.saveState;let queue=Promise.resolve(),locked=false,readWhileSaving=false;
 f.h.host.withLock=(work,options={})=>{const run=queue.then(async()=>{locked=true;try{return await work();}finally{locked=false;}});queue=run.catch(()=>{});return run;};
 f.h.host.saveState=async value=>{entered();await gate;return save(value);};const snapshot=f.h.host.snapshot;f.h.host.snapshot=async()=>{if(!f.h.getState().installed)readWhileSaving=true;assert(locked);return snapshot();};
 const startup=f.controller.check();await started;let settled=false;const preview=f.controller.previewLocalPackage(f.sign(f.pack)).finally(()=>settled=true);await new Promise(r=>setImmediate(r));assert.equal(settled,false);assert.equal(readWhileSaving,false);release();await startup;await preview;assert.equal(readWhileSaving,false);assert.equal(f.h.saves.length,1);assert.equal(f.h.writes.length,0);
});

test('preview waiting for the host lock cannot initialize or select a different story',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());await f.h.host.saveState({});f.h.saves.length=0;
 let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);f.h.host.withLock=async(work,options)=>{assert.equal(options.waitForIdle,true);entered();await gate;return work();};
 const preview=f.controller.previewLocalPackage(f.sign(f.pack));await started;f.h.currentContext.chatId='other';release();await assert.rejects(preview,{code:'context-changed'});assert.equal(f.h.saves.length,0);assert.equal(f.h.writes.length,0);await assert.rejects(f.controller.getPackages(f.h.currentContext),{code:'local-package-required'});
});

test('preview leaves an unfinished installation belonging to another story untouched',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());const journal={id:'other-install',context:{...f.h.currentContext,chatId:'other'},installed:{scope:'character'}};await f.h.storage.set('cxx-update-journal',journal);
 await assert.rejects(f.controller.previewLocalPackage(f.sign(f.pack)),{code:'recovery-original-chat'});assert.deepEqual(await f.h.storage.get('cxx-update-journal'),journal);assert.equal(f.h.saves.length,0);assert.equal(f.h.writes.length,0);
});

test('preview requires explicit recovery of the current story instead of resuming its transaction',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());const journal={id:'current-install',context:{...f.h.currentContext},installed:{scope:'character'}};await f.h.storage.set('cxx-update-journal',journal);
 const state=copy(f.h.getState()),snapshot=copy(f.h.snapshot);await assert.rejects(f.controller.previewLocalPackage(f.sign(f.pack)),{code:'recovery-needed'});assert.deepEqual(await f.h.storage.get('cxx-update-journal'),journal);assert.deepEqual(f.h.getState(),state);assert.deepEqual(f.h.snapshot,snapshot);assert.equal(f.h.saves.length,0);assert.equal(f.h.writes.length,0);
});

test('preview inspects an orphaned journal without calling the getter that would adopt it',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());const journal={id:'missing-pointer-install',context:{...f.h.currentContext},installed:{scope:'character'}};await f.h.storage.set('cxx-update-journal',journal);assert.equal(f.h.getState().journalName,undefined);
 f.h.storage.get=async()=>{assert.fail('preview must not adopt the missing journal pointer');};
 await assert.rejects(f.controller.previewLocalPackage(f.sign(f.pack)),{code:'recovery-needed'});assert.equal(f.h.getState().journalName,undefined);assert.equal(f.h.saves.length,0);assert.equal(f.h.writes.length,0);
});

test('preview of an initialized ledger never enters transaction recovery',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());await f.h.host.saveState({...f.h.getState(),characterKey:f.h.currentContext.characterKey,engineVersion:Core.ENGINE_VERSION});f.h.saves.length=0;
 f.h.storage.get=async()=>{assert.fail('a normal preview must not enter recovery');};
 await f.controller.previewLocalPackage(f.sign(f.pack));assert.equal(f.h.saves.length,0);assert.equal(f.h.writes.length,0);
});

test('a partially loaded existing ledger is not replaced with the bundled installation baseline',async t=>{
 const f=await setup();t.after(()=>f.controller.stop());const state={...f.h.getState(),characterKey:f.h.currentContext.characterKey,engineVersion:Core.ENGINE_VERSION};delete state.installed;await f.h.host.saveState(state);f.h.saves.length=0;
 await assert.rejects(f.controller.previewLocalPackage(f.sign(f.pack)),{code:'update-state-not-ready'});assert.deepEqual(f.h.getState(),state);assert.equal(f.h.saves.length,0);assert.equal(f.h.writes.length,0);
});

async function panelFixture(extra={}){
 const document=F.lifecycleDocument(),create=document.createElement;document.createElement=tag=>({...create(tag),removeAttribute(){}});const view={};
 const f=await setup({document,panelModule:{render(panel,model,actions){Object.assign(view,{panel,model,actions});}},...extra});
 await f.controller.start();f.controller.openPanel('update');await new Promise(resolve=>setImmediate(resolve));return {...f,view};
}
test('controller forwards the signed target plugin minimum through its real unified update proxy',async t=>{
 let bytes='',reloads=0;const f=await setup({fetch:async()=>new Response(bytes)});t.after(()=>f.controller.stop());f.pack.release.plugins=[{id:'suite',version:'0.5.0',required:true}];bytes=f.sign(f.pack);
 const calls=[],storage=new Map();let row={id:'suite',kind:'ready',version:'0.4.0',installedVersion:'0.4.0',runtimeVersion:'0.4.0'};
 Object.assign(f.h.api,{performance:{timeOrigin:1000},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{reload:()=>reloads++},CxxPlugins:{updateProtocol:1,check:async()=>{},read:()=>({rows:[row],installation:{}}),updateInstalled:async(ids,minimums)=>{calls.push({ids,minimums});row={...row,version:'0.5.0',installedVersion:'0.5.0'};}}});
 await f.controller.start();await new Promise(resolve=>setImmediate(resolve));await f.controller.prepareOnline({version:f.pack.version,url:'https://cyber2051.top/updates/v3/packages/cyber2051.core/'+f.pack.version+'.json',bytes:Buffer.byteLength(bytes),sha256:await Core.sha256(bytes)});
 await f.controller.online().apply();assert.deepEqual(calls,[{ids:['suite'],minimums:{suite:'0.5.0'}}]);assert.equal(reloads,1);assert.equal(f.h.writes.length,0);assert.equal(f.controller.online().read().phase,'awaiting-reload');
});
test('controller replaces a legacy plugin service lacking minimum-version support and reuses a current one',async t=>{
 const P=require('../../卡片源码/运行时/plugin-check.js'),calls=[];t.mock.method(P,'install',(win,owner)=>{calls.push({win,owner});win.CxxPlugins={updateProtocol:1,minimumVersionProtocol:1};});
 for(const current of [false,true]){const f=await setup();t.after(()=>f.controller.stop());const service={updateProtocol:1,...(current?{minimumVersionProtocol:1}:{})};Object.assign(f.h.api,{document:{createElement(){}},CxxPlugins:service});
  await f.controller.start();assert.equal(calls.length,1);assert.equal(f.h.api.CxxPlugins.minimumVersionProtocol,1);assert.equal(f.h.api.CxxPlugins===service,current);if(!current){assert.equal(calls[0].win,f.h.api);assert.equal(calls[0].owner,f.h.api);}
 }
});
test('selecting a signed formatted update package preserves its official raw-byte fingerprint',async t=>{
 const f=await panelFixture();t.after(()=>f.controller.stop());const raw=JSON.stringify(JSON.parse(f.sign(f.pack)),null,2)+'\n',expected=await Core.sha256(raw);
 await f.view.actions.packageFile(new Blob([raw]));const [item]=await f.controller.getPackages(f.h.currentContext);assert.equal(item.sha256,expected);
 await f.controller.check(true,'manual');assert.equal(f.h.getState().installed[Release.ID].sha256,expected);await f.controller.previewLocalPackage(raw,{allowInstalled:true});
 assert.equal(f.h.getState().installed[Release.ID].sha256,expected);
});
test('an update file finishing after a chat switch cannot replace a newer package preview',async t=>{
 const f=await panelFixture();t.after(()=>f.controller.stop());let release,entered;const began=new Promise(r=>entered=r),gate=new Promise(r=>release=r),raw=f.sign(f.pack);
 const old=f.view.actions.packageFile({size:raw.length,async text(){entered();await gate;return raw;}});await began;
 f.h.currentContext.chatId='new-story';await f.h.emit(f.h.api.tavern_events.CHAT_CHANGED);f.controller.openPanel('update');
 const newer={...f.pack,version:'2.1.7'};await f.controller.previewLocalPackage(f.sign(newer));release();await assert.rejects(old);
 assert.equal((await f.controller.getPackages(f.h.currentContext))[0].pack.version,'2.1.7');assert.equal(f.h.writes.length,0);
});
for(const kind of ['migration','backup'])for(const stage of ['read','parse','preview'])test(kind+' file cannot repopulate previews after switching away and back during '+stage,async t=>{
 let release,entered;const began=new Promise(r=>entered=r),gate=new Promise(r=>release=r),calls={read:0,parse:0,preview:0};let delayed=true;
 const step=async(name,result)=>{calls[name]++;if(delayed&&name===stage){entered();await gate;}return result;};
 const backup={readImportFile:()=>step('read','{}'),parseMigration:()=>step('parse',{from:'old-file'}),parse:()=>step('parse',{from:'old-file'}),previewMigration:()=>step('preview',{from:'old-file'}),previewRestore:()=>step('preview',{from:'old-file'}),beforeContentInstall:async()=>({backupId:'saved'})};
 const f=await panelFixture({backup});t.after(()=>f.controller.stop());const old=f.view.actions[kind+'File'](new Blob(['{}']));await began;
 const original=f.h.currentContext.chatId;f.h.currentContext.chatId='another';await f.h.emit(f.h.api.tavern_events.CHAT_CHANGED);f.h.currentContext.chatId=original;await f.h.emit(f.h.api.tavern_events.CHAT_CHANGED);f.controller.openPanel('migration');
 release();await assert.rejects(old,{code:'migration-preview-stale'});assert.equal(f.view.model.migration,null);assert.equal(f.view.model.restore,null);assert.equal(f.h.writes.length,0);
 assert.equal(calls.read,1);assert.equal(calls.parse,stage==='read'?0:1);assert.equal(calls.preview,stage==='preview'?1:0);
 delayed=false;await f.view.actions[kind+'File'](new Blob(['{}']));assert.deepEqual(kind==='migration'?f.view.model.migration:f.view.model.restore,{from:'old-file'});
});
