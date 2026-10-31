const test=require('node:test'),a=require('node:assert/strict'),U=require('../../卡片源码/运行时/unified-update.js'),Core=require('../../卡片源码/运行时/core.js');
async function fixture(minimum='0.3.3'){let version='2.3.5',applied=false,hash='old',reloads=0,installs=0,upgrades=0,verifications=0,rows=[{id:'suite',kind:'ready',version:'0.3.3'}],downloads=0;const values=new Map(),pack={version:'2.3.6',release:{plugins:[{id:'suite',version:minimum,required:true}],updater:{manifest:{targetHash:await Core.sha256('new')},content:'new'}}},text=JSON.stringify(pack),item={version:pack.version,url:'https://cyber2051.top/updates/v3/packages/cyber2051.core/2.3.6.json',bytes:Buffer.byteLength(text),sha256:await Core.sha256(text)},scope={characterKey:'test.png',chatId:'test'};
const config={Core,documentTimeOrigin:1000,scope:()=>scope,currentVersion:()=>version,storage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},fetch:async()=>{downloads++;return new Response(text);},preview:async()=>({pack,summary:{inventory:[]}}),installed:()=>applied,install:async()=>{installs++;applied=true;},plugins:{check:async()=>{},read:()=>({rows,installation:{}}),installMissing:async()=>{rows=[{id:'suite',kind:'reload',version:'0.3.2'}];},updateInstalled:async()=>{rows=[{id:'suite',kind:'reload',version:'0.3.2'}];}},updaterHash:async()=>hash,upgradeUpdater:async()=>{if(hash===pack.release.updater.manifest.targetHash){verifications++;return {status:'complete'};}upgrades++;hash=pack.release.updater.manifest.targetHash;return {status:'awaiting-reload'};},reload:()=>reloads++,wait:async()=>{}};return {config,item,scope,pack,counts:()=>({downloads,installs,upgrades,reloads}),version:v=>version=v,rows:v=>rows=v,verifications:()=>verifications,refresh:()=>config.documentTimeOrigin++,values};}
test('explicit apply upgrades components and updater, resumes after refresh and never repeats writes',async()=>{const f=await fixture(),u=U.create(f.config);await u.prepare(f.item);a.equal(f.counts().installs,0);await Promise.all([u.apply(),u.apply()]);a.deepEqual(f.counts(),{downloads:1,installs:1,upgrades:1,reloads:1});u.stop();f.version('2.3.6');f.refresh();const next=U.create(f.config);await next.resume();a.equal(next.read().phase,'complete');await next.resume();a.equal(f.counts().installs,1);});
test('plugin refresh resumes before component writes and does not refresh indefinitely',async()=>{const f=await fixture();f.rows([{id:'suite',kind:'outdated',version:'0.3.2'}]);const u=U.create(f.config);await u.prepare(f.item);await u.apply();a.equal(f.counts().installs,0);a.equal(f.counts().reloads,1);const next=U.create(f.config);await a.rejects(next.resume(),{code:'plugin-reload-unconfirmed'});a.equal(f.counts().reloads,1);f.rows([{id:'suite',kind:'ready',version:'0.3.3'}]);await next.apply();a.equal(f.counts().installs,1);});
test('hash errors, unknown repositories and story changes prevent writes',async()=>{const f=await fixture(),u=U.create(f.config);await a.rejects(u.prepare({...f.item,sha256:'0'.repeat(64)}),{code:'package-hash-mismatch'});await u.prepare(f.item);f.scope.chatId='another';await a.rejects(u.apply(),{code:'context-changed'});a.equal(f.counts().installs,0);const n=U.create(f.config);await a.rejects(n.prepare({...f.item,url:'https://other.test/2.3.6.json'}),{code:'invalid-url'});});
test('startup busy during refresh preserves the receipt and a later idle resume completes once',async()=>{const f=await fixture(),u=U.create(f.config);await u.prepare(f.item);await u.apply();u.stop();f.version('2.3.6');f.refresh();const preview=f.config.preview;let busy=true;f.config.preview=async(...args)=>{if(busy)throw Object.assign(Error('startup busy'),{code:'host-busy'});return preview(...args);};const next=U.create(f.config);await a.rejects(next.resume(),{code:'host-busy'});a.equal(next.read().phase,'waiting');a.equal(next.read().error,null);a.equal(next.read().receipt.phase,'verify');busy=false;await next.resume();a.equal(next.read().phase,'complete');a.equal(f.counts().installs,1);});

test('a ready plugin below the target package minimum updates before any card writes',async()=>{
 const f=await fixture('0.4.0'),calls=[];f.rows([{id:'suite',kind:'ready',version:'0.3.4',installedVersion:'0.3.4',runtimeVersion:'0.3.4'}]);
 f.config.plugins.updateInstalled=async(ids,minimums)=>{calls.push({ids,minimums});f.rows([{id:'suite',kind:'ready',version:'0.4.0',installedVersion:'0.4.0',runtimeVersion:'0.3.4'}]);};
 const u=U.create(f.config);await u.prepare(f.item);await u.apply();a.deepEqual(calls,[{ids:['suite'],minimums:{suite:'0.4.0'}}]);a.equal(f.counts().installs,0);a.equal(f.counts().reloads,1);
 const next=U.create(f.config);await a.rejects(next.resume(),{code:'plugin-reload-unconfirmed'});a.equal(calls.length,1,'already downloaded target must not be downloaded again');a.equal(f.counts().reloads,1);
 f.rows([{id:'suite',kind:'ready',version:'0.4.0+build.7',installedVersion:'0.4.0+build.7',runtimeVersion:'0.4.0+build.7'}]);await next.apply();a.equal(f.counts().installs,1);a.equal(calls.length,1);
});
test('downloaded target with an older ready runtime refreshes without another plugin update',async()=>{
 const f=await fixture('0.4.0');f.rows([{id:'suite',kind:'ready',version:'0.4.0',installedVersion:'0.4.0',runtimeVersion:'0.3.4'}]);f.config.plugins.updateInstalled=async()=>a.fail('target is already on disk');
 const u=U.create(f.config);await u.prepare(f.item);await u.apply();a.equal(f.counts().installs,0);a.equal(f.counts().reloads,1);a.equal(u.read().phase,'awaiting-reload');
});
test('a nominally ready plugin still below the target never permits component installation',async()=>{
 const f=await fixture('0.4.0');let calls=0;f.rows([{id:'suite',kind:'ready',version:'0.3.4',installedVersion:'0.3.4',runtimeVersion:'0.3.4'}]);f.config.plugins.updateInstalled=async()=>{calls++;};
 const u=U.create(f.config);await u.prepare(f.item);await a.rejects(u.apply(),e=>e.code==='plugin-not-ready'&&e.message.includes('0.4.0'));a.equal(calls,1);a.equal(f.counts().installs,0);a.equal(f.counts().reloads,0);
});
test('target minimum reaches the actual plugin updater even when its own checker reports ready',async t=>{
 const P=require('../../卡片源码/运行时/plugin-check.js'),f=await fixture('0.5.0'),calls=[],entries=[{name:'third-party/SillyTavern-Runtime-Suite',version:'0.4.0'}];
 const win={setInterval:()=>1,clearInterval(){},TavernRuntimeSuite:{api:1,version:'0.4.0',status:()=>({context:{wanted:false},visual:{wanted:false}})}};
 const p=P.create({win,loadRegistry:async()=>({entries}),loadInstaller:async()=>({supported:true,update:async(name,global)=>{calls.push({name,global});entries[0].version='0.5.0';return {};}})});t.after(()=>p.destroy());f.config.plugins=p;
 await p.check();a.equal(p.read().rows.find(r=>r.id==='suite').kind,'ready');const u=U.create(f.config);await u.prepare(f.item);await u.apply();a.equal(calls.length,1);a.equal(calls[0].name,'SillyTavern-Runtime-Suite');a.equal(f.counts().installs,0);a.equal(f.counts().reloads,1);
 win.TavernRuntimeSuite.version='0.5.0';const next=U.create(f.config);await next.resume();a.equal(f.counts().installs,1);a.equal(calls.length,1);
});
test('self replacement in the same parent document cannot announce completion; a full refresh verifies the updater once',async()=>{
 const f=await fixture(),u=U.create(f.config);await u.prepare(f.item);await u.apply();f.version('2.3.6');u.stop();
 const samePage=U.create(f.config);await samePage.resume();a.equal(samePage.read().phase,'awaiting-reload');a.equal(samePage.read().receipt.phase,'verify');a.equal(f.verifications(),0);a.equal(f.counts().installs,1);a.equal(f.counts().upgrades,1);
 samePage.stop();f.refresh();const newPage=U.create(f.config);await newPage.resume();a.equal(newPage.read().phase,'complete');a.equal(f.verifications(),1);await newPage.resume();a.equal(f.verifications(),1);a.equal(f.counts().reloads,2);
});
test('legacy verify receipt missing the document marker refreshes once and preserves unknown receipt data',async()=>{
 const f=await fixture(),u=U.create(f.config);await u.prepare(f.item);await u.apply();u.stop();f.version('2.3.6');
 const [key,text]=[...f.values][0],receipt=JSON.parse(text);delete receipt.reloadDocument;receipt.future={zero:0,no:false};f.values.set(key,JSON.stringify(receipt));
 const samePage=U.create(f.config);await samePage.resume();a.equal(samePage.read().phase,'awaiting-reload');a.deepEqual(samePage.read().receipt.future,receipt.future);a.equal(f.counts().reloads,2);samePage.stop();f.refresh();
 const newPage=U.create(f.config);await newPage.resume();a.equal(newPage.read().phase,'complete');a.equal(f.counts().reloads,2);a.deepEqual(newPage.read().receipt.future,receipt.future);a.deepEqual(newPage.read().receipt.owner,receipt.owner);
});
test('updater disk verification failure after refresh retains the verify receipt and exact error',async()=>{
 const f=await fixture(),u=U.create(f.config);await u.prepare(f.item);await u.apply();u.stop();f.version('2.3.6');f.refresh();const before=[...f.values.values()][0],original=Object.assign(Error('disk mismatch'),{code:'upgrade-save-unconfirmed'}),verify=f.config.upgradeUpdater;
 f.config.upgradeUpdater=async()=>{throw original;};const next=U.create(f.config);await a.rejects(next.resume(),e=>e===original);a.equal([...f.values.values()][0],before);a.deepEqual(next.read().error,{code:original.code,message:original.message});a.equal(f.counts().upgrades,1);
 f.config.upgradeUpdater=verify;const retry=U.create(f.config);await retry.resume();a.equal(retry.read().phase,'complete');a.equal(f.verifications(),1);
});
test('a fresh document with the wrong running version or incomplete updater verification cannot complete',async()=>{
 const f=await fixture(),u=U.create(f.config);await u.prepare(f.item);await u.apply();u.stop();f.refresh();const next=U.create(f.config);await a.rejects(next.resume(),{code:'release-readback'});a.equal(next.read().receipt.phase,'verify');
 f.version('2.3.6');f.config.upgradeUpdater=async()=>({status:'awaiting-reload'});const pending=U.create(f.config);await a.rejects(pending.resume(),{code:'updater-verification-pending'});a.equal(pending.read().receipt.phase,'verify');
});
test('no parent document identity prevents installation rather than pretending a refresh occurred',async()=>{
 const f=await fixture();delete f.config.documentTimeOrigin;const u=U.create(f.config);await u.prepare(f.item);await a.rejects(u.apply(),{code:'update-document-unknown'});a.equal(f.counts().installs,0);a.equal(f.counts().upgrades,0);
});
test('actual upgrader completes its pending acknowledgement only after the parent document changes',async()=>{
 const make=require('../lib/fixture-loader.cjs')('../更新/upgrader.test.cjs',['fixture']).fixture,real=await make(),f=await fixture();
 f.config.updaterHash=()=>Core.sha256(real.trees()[1].content);const phases=[];f.config.upgradeUpdater=async()=>{const r=await real.create('iframe-'+phases.length).run();phases.push(r.status);return r;};
 // Keep package hash and its updater manifest tied to this real fixture.
 const originalPreview=f.config.preview;f.config.preview=async()=>{const result=await originalPreview();result.pack.release.updater={manifest:real.manifest,content:'new updater code'};return result;};
 const beforeChat=structuredClone(real.api.SillyTavern.getContext().chat),beforeMetadata=structuredClone(real.api.SillyTavern.getContext().chatMetadata),u=U.create(f.config);await u.prepare(f.item);await u.apply();u.stop();f.version('2.3.6');
 a.equal(real.state.updaterUpgrade.status,'awaiting-reload');const pendingRecord=structuredClone(real.state.updaterUpgrade),samePage=U.create(f.config);await samePage.resume();a.deepEqual(real.state.updaterUpgrade,pendingRecord);a.deepEqual(phases,['awaiting-reload']);samePage.stop();f.refresh();
 const newPage=U.create(f.config);await newPage.resume();a.equal(newPage.read().phase,'complete');a.deepEqual(real.state.updaterUpgrade,{...pendingRecord,status:'complete'});a.deepEqual(phases,['awaiting-reload','complete']);a.equal(real.events.filter(e=>e==='write-script').length,1);a.equal(real.books.size,1);a.deepEqual(real.trees()[1],{...real.original,content:'new updater code'});a.deepEqual(real.api.SillyTavern.getContext().chat,beforeChat);a.deepEqual(real.api.SillyTavern.getContext().chatMetadata,beforeMetadata);
});
test('old iframe fetch abort stays visible while the new updater resumes its exact saved verify receipt without another apply',async()=>{
 const f=await fixture(),upgrade=f.config.upgradeUpdater,abort=TypeError('Failed to fetch');f.config.upgradeUpdater=async()=>{await upgrade();throw abort;};
 const old=U.create(f.config);await old.prepare(f.item);await a.rejects(old.apply(),e=>e===abort);a.deepEqual(old.read().error,{code:'update-failed',message:'Failed to fetch'});a.equal(old.read().receipt.phase,'verify');old.stop();f.version('2.3.6');
 // Old 2.3.11 wrote this same verify receipt before replacing its own frame,
 // but did not know the new optional document marker.
 const [key,text]=[...f.values][0],saved=JSON.parse(text);delete saved.reloadDocument;f.values.set(key,JSON.stringify(saved));f.config.upgradeUpdater=upgrade;
 const replacement=U.create(f.config);await replacement.resume();a.equal(replacement.read().phase,'awaiting-reload');a.deepEqual(replacement.read().receipt.item,saved.item);a.deepEqual(replacement.read().receipt.owner,saved.owner);replacement.stop();f.refresh();
 const refreshed=U.create(f.config);await refreshed.resume();a.equal(refreshed.read().phase,'complete');a.equal(f.counts().installs,1);a.equal(f.counts().upgrades,1);a.equal(f.verifications(),1);a.deepEqual(old.read().error,{code:'update-failed',message:'Failed to fetch'});
});
test('switching stories while the updater hash is read cannot store the old receipt under the new story',async()=>{
 const f=await fixture();let delay=false,release,entered;const waiting=new Promise(r=>entered=r);f.config.updaterHash=async()=>{if(!delay)return 'old';entered();return new Promise(r=>release=r);};
 const u=U.create(f.config);await u.prepare(f.item);delay=true;const job=u.apply();await waiting;f.scope.chatId='another-chat';release(f.pack.release.updater.manifest.targetHash);await a.rejects(job,{code:'context-changed'});a.equal(f.values.size,1);a.equal(f.counts().reloads,0);a.equal(f.counts().upgrades,0);a.equal([...f.values.keys()].some(k=>k.includes('another-chat')),false);
});
test('a story switch during updater replacement cannot reload the newly selected story',async()=>{
 const f=await fixture();let entered,release;const waiting=new Promise(r=>entered=r),upgrade=f.config.upgradeUpdater;f.config.upgradeUpdater=async()=>{await upgrade();entered();return new Promise(r=>release=r);};
 const u=U.create(f.config);await u.prepare(f.item);const job=u.apply();await waiting;f.scope.chatId='another-chat';release({status:'awaiting-reload'});await a.rejects(job,{code:'context-changed'});a.equal(f.counts().reloads,0);a.equal(f.values.size,1);a.equal([...f.values.keys()].some(k=>k.includes('another-chat')),false);
});
test('stopping the old controller during its own same-story replacement does not prevent the full refresh handoff',async()=>{
 const f=await fixture(),upgrade=f.config.upgradeUpdater;let u;f.config.upgradeUpdater=async()=>{u.stop();return upgrade();};u=U.create(f.config);await u.prepare(f.item);await u.apply();a.equal(u.read().phase,'awaiting-reload');a.equal(f.counts().reloads,1);
});
