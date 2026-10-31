'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('../lib/fixture-loader.cjs'),F=load('host.test.cjs',['fakeBackend','finish','installedCommit']),M=load('migration.test.cjs',['fixture']);
const Core=require('../../卡片源码/运行时/core.js'),Host=require('../../卡片源码/运行时/host.js'),Controller=require('../../卡片源码/运行时/controller.js'),Backup=require('../../卡片源码/运行时/backup.js');
const copy=structuredClone,ns=Host.NAMESPACE;
const controller=h=>Controller.create({api:h.api,host:h.host,core:Core,hostModule:Host,seed:{cardId:'cyber2051',baseVersion:'2.0.46',engineVersion:Core.ENGINE_VERSION,catalogUrl:Controller.CATALOG}});
async function orphan(t){const config={neverSave:true},h=F.fakeBackend(t,config),before=await h.host.snapshot();
 const journal={format:2,id:'orphan-2127',context:h.host.getContext(),before,after:copy(before),stages:[],attempted:[],completed:[],installed:F.installedCommit(before),commitAttempted:false,status:'prepared'};
 await assert.rejects(F.finish(t,h.host.withLock(()=>h.host.createStorage().claim('journal',journal))),{code:'save-not-confirmed'});
 h.state.raw=copy(h.state.disk);h.state.pending=null;config.neverSave=false;h.host=h.createHost();t.mock.timers.tick(2500);return h;}
test('initialization recovers its durable missing-pointer journal before writing metadata',async t=>{
 const h=await orphan(t),chat=copy(h.state.messageFloors),original=copy(h.state.raw.extensions.tavern_helper.variables.existingPlayerVar);
 assert.equal((await h.host.inspectInstall()).kind,'pending');assert.equal(h.host.readState().journalName,undefined);
 await F.finish(t,h.host.withLock(()=>controller(h).initialize()));await h.host.assertNoPendingInstall();assert.equal(h.host.readState().engineVersion,Core.ENGINE_VERSION);assert.equal(h.host.readState().installed['official.core'].version,'1.0.1');
 assert.deepEqual(h.state.messageFloors,chat);assert.deepEqual(h.state.raw.extensions.tavern_helper.variables.existingPlayerVar,original);
});
test('TT recovery is independent of full installation and repeated recovery is a no-op',async t=>{
 const h=await orphan(t);h.api.getTavernVersion=()=> '1.18.0';await h.host.ready();
 const c=controller(h);assert.equal((await F.finish(t,c.recoverPending())).status,'committed');const events=h.state.events.length;assert.equal((await c.recoverPending()).status,'none');assert.equal(h.state.events.length,events);await h.host.assertNoPendingInstall();
});
test('recovery mode cannot claim a new install or write an unrelated component',async t=>{
 const h=F.fakeBackend(t);h.api.getTavernVersion=()=> '1.18.0';await h.host.ready('recover');
 await assert.rejects(h.host.withLock(()=>h.host.createStorage().claim('journal',{context:h.host.getContext()})),{code:'recovery-write-scope'});
 await assert.rejects(h.host.withLock(()=>h.host.writeStage('scripts',{trees:[]},{})),{code:'recovery-write-scope'});
});
test('a missing pointer is adopted before a partial registry rollback, preserving chat data',async t=>{
 const h=F.fakeBackend(t),before=await h.host.snapshot(),after=copy(before);after.regex.scripts[0].replace_string='updated';after.registry.note='pending';after.scripts.trees[0].content='not-written';
 const j={format:2,id:'partial-2127',context:h.host.getContext(),before,after,stages:['regex','registry','scripts'],attempted:['regex','registry'],completed:['regex','registry'],installed:F.installedCommit(after),commitAttempted:false,status:'interrupted'};
 await F.finish(t,h.host.withLock(async()=>{assert.equal(await h.host.createStorage().claim('journal',j),true);await h.host.writeStage('regex',after.regex,before);await h.host.writeStage('registry',after.registry,await h.host.snapshot());}));
 delete h.state.raw.extensions.tavern_helper.variables[ns].journalName;delete h.state.disk.extensions.tavern_helper.variables[ns].journalName;
 h.host=h.createHost();t.mock.timers.tick(2500);h.api.getTavernVersion=()=> '1.18.0';const chat=copy(h.state.messageFloors);
 assert.equal((await F.finish(t,controller(h).recoverPending())).status,'rolled-back');assert.deepEqual(await h.host.snapshot(),before);assert.deepEqual(h.state.messageFloors,chat);await h.host.assertNoPendingInstall();
});
test('a foreign instance never blocks read-only export and is not adopted or erased',async t=>{
 const h=await orphan(t),state=h.state.raw.extensions.tavern_helper.variables[ns];state.instanceId='new-instance';state.characterKey=h.state.avatar;state.engineVersion=Core.ENGINE_VERSION;h.state.disk=copy(h.state.raw);
 const inspect=await h.host.inspectInstall();assert.equal(inspect.kind,'none');await h.host.assertNoPendingInstall();assert.equal((await controller(h).recoverPending()).status,'none');
 state.instanceId='test-instance';h.state.disk=copy(h.state.raw);assert.equal((await h.host.inspectInstall()).kind,'pending');
});
test('missing backup gives actionable diagnosis and preserves the active mirror',async t=>{
 const h=await orphan(t),first=await h.host.inspectInstall();h.state.rawBooks.delete(first.record.journalName);const checked=await h.host.inspectInstall();assert.equal(checked.kind,'blocked');assert.equal(checked.code,'backup-missing');
 const writes=h.state.events.filter(x=>/persisted:|helper-returned/.test(x)).length;await assert.rejects(controller(h).recoverPending(),{code:'backup-missing'});assert.equal(h.state.events.filter(x=>/persisted:|helper-returned/.test(x)).length,writes);assert.equal((await h.host.inspectInstall()).record.id,first.record.id);
});

test('real host rescue read lock permits unresolved records while normal export stays blocked',async t=>{
 const h=await orphan(t),check=await h.host.inspectInstall();h.state.rawBooks.delete(check.record.journalName);
 let locked=false;h.locks.request=async(name,options,fn)=>{assert.ok(options.ifAvailable===true||options.signal);if(locked)return fn(null);locked=true;try{return await fn({name,mode:options.mode});}finally{locked=false;}};
 const f=M.fixture(),host={...f.host,withRescueReadLock:h.host.withRescueReadLock,inspectInstall:h.host.inspectInstall},client=Backup.create({host,core:Core,seed:f.seed,adapters:f.adapters});
 await assert.rejects(h.host.withReadLock(()=>{}),{code:'migration-pending-install'});
 const doc=await client.captureRescue();assert.equal(doc.payload.recovery.inspection.code,'backup-missing');assert.deepEqual(doc.payload.messages,f.messages);assert.equal(f.writes,0);
 let release;const held=h.host.withLock(()=>new Promise(r=>release=r));while(!release)await new Promise(r=>setImmediate(r));
 await assert.rejects(h.host.withRescueReadLock(()=>{}),{code:'update-already-running'});release();await held;
});
test('wrong chat, damaged journal and player component edits cannot be overwritten during recovery',async t=>{
 const h=await orphan(t),check=await h.host.inspectInstall(),book=h.state.rawBooks.get(check.record.journalName),j=book.extensions.__cxx_update_journals[h.host.readState().instanceId].active.journal;
 h.state.chatId='other-chat';await assert.rejects(controller(h).recoverPending(),{code:'recovery-original-chat'});h.state.chatId='save-a';
 j.stages=['unrecognized'];await assert.rejects(F.finish(t,controller(h).recoverPending()),{code:'invalid-journal'});j.stages=[];
 h.state.runtimeRegex[0].replace_string='player-edit';h.state.raw.extensions.regex_scripts=Host.toRawRegexes(h.state.runtimeRegex);h.state.disk=copy(h.state.raw);
 await assert.rejects(F.finish(t,controller(h).recoverPending()),{code:'recovery-needed'});assert.equal(h.state.runtimeRegex[0].replace_string,'player-edit');assert.equal((await h.host.inspectInstall()).kind,'pending');
});
test('rescue carries all branches, unknown fields and unresolved materials without writes or normal import eligibility',async()=>{
 const f=M.fixture(),original=copy(f.messages);f.state.journalName='missing-backup';f.host.inspectInstall=async()=>({kind:'blocked',code:'backup-missing',state:copy(f.state),record:{id:'keep'},backup:null});
 const doc=await f.client.captureRescue();assert.equal(doc.type,'cyber2051.recovery');assert.deepEqual(doc.payload.messages,original);assert.equal(doc.payload.recovery.needsReview,true);assert.equal(doc.payload.recovery.inspection.record.id,'keep');assert.equal(f.writes,0);
 const prepared=await f.client.prepareExportFile(doc);assert.match(prepared.filename,/rescue/);prepared.revoke();
 await assert.rejects(f.client.parseMigration(doc));await assert.rejects(f.client.parse(doc));assert.deepEqual(f.messages,original);assert.equal(f.state.journalName,'missing-backup');
});
test('rescue records unavailable ancillary data, but aborts on a chat change',async()=>{
 const f=M.fixture();f.seed.migration.playerStores=[{kind:'character',name:'future'}];f.host.inspectInstall=async()=>{throw Error('unavailable');};let captured;
 const doc=await f.client.captureRescue();assert.equal(doc.payload.recovery.issues.length,2);assert.equal(f.writes,0);
 f.host.inspectInstall=async()=>{captured=copy(f.ctx);f.ctx.chatId='changed';return {kind:'none'};};await assert.rejects(f.client.captureRescue(),{code:'context-changed'});assert.equal(captured.chatId,'old-chat');
});

function credentialFixture(){
 const f=M.fixture(),credentials={apiKey:'fixture-only-api-credential',api_key_openai:'fixture-only-provider-credential',proxy_password:'fixture-only-proxy-credential',Authorization:'Bearer fixture-only-header-credential'};
 const character={name:'test',data:{extensions:{tavern_helper:{variables:{connection:copy(credentials),serialized:JSON.stringify({api_key:credentials.apiKey,model:'keep-model'})},scripts:[{id:'keep-script',content:'const apiKey = "'+credentials.apiKey+'"; const api_key = `fixture-only-literal-credential`;'}]}}}};
 f.header.chat_metadata.variables.connection={api_key:credentials.apiKey,model:'keep-model'};
 f.messages[0].variables[1].extension={access_token:'fixture-only-access-credential',refreshToken:'fixture-only-refresh-credential',key:'quest-key',token:23,secret:'剧情秘密',passwordHint:'keep-hint'};
 f.host.inspectInstall=async()=>({kind:'blocked',backup:{before:{character:copy(character)},error:'request rejected: '+credentials.proxy_password}});
 f.seed.migration.playerStores=[{kind:'character',name:'connection'}];
 f.adapters.capturePlayerStores=async()=>({connection:copy(credentials)});
 const blobs=[],client=Backup.create({core:Core,host:f.host,seed:f.seed,adapters:f.adapters,api:{getCharData:()=>character},Blob,urlAPI:{createObjectURL(blob){blobs.push(blob);return 'blob:fixture';},revokeObjectURL(){}}});
 return {f,client,character,credentials,blobs};
}
test('rescue removes credentials from character, journals, stores, nested JSON and raw JSONL without changing source',async()=>{
 const {f,client,character,credentials}=credentialFixture(),before=copy({character,header:f.header,messages:f.messages,seed:f.seed});
 const doc=await client.captureRescue(),text=JSON.stringify(doc);
 for(const value of [...Object.values(credentials),'fixture-only-access-credential','fixture-only-refresh-credential','fixture-only-literal-credential'])assert.equal(text.includes(value),false,'credential must not leave rescue boundary');
 assert.equal(doc.payload.recovery.credentialsRemoved,true);
 assert.equal(doc.payload.recovery.character.data.extensions.tavern_helper.variables.connection.apiKey,'');
 assert.equal(JSON.parse(doc.payload.recovery.character.data.extensions.tavern_helper.variables.serialized).model,'keep-model');
 assert.equal(JSON.parse(doc.payload.diskJSONL.split('\n')[0]).chat_metadata.variables.connection.api_key,'');
 const branch=doc.payload.messages[0].variables[1];assert.equal(branch.stat_data.money,40);assert.deepEqual(branch.extension,{access_token:'',refreshToken:'',key:'quest-key',token:23,secret:'剧情秘密',passwordHint:'keep-hint'});
 assert.deepEqual({character,header:f.header,messages:f.messages,seed:f.seed},before);assert.equal(f.writes,0);
 const digest=doc.sha256;delete doc.sha256;assert.equal(await Core.sha256(doc),digest);
});
test('download sanitizes already sealed legacy rescue files and returns the new valid digest',async()=>{
 const {client,credentials,blobs}=credentialFixture(),doc=await client.captureRescue();
 doc.payload.recovery.legacy={api_key:credentials.apiKey,echo:credentials.apiKey};delete doc.sha256;doc.sha256=await Core.sha256(doc);const before=copy(doc);
 const prepared=await client.prepareExportFile(doc),download=JSON.parse(await blobs[0].text());prepared.revoke();
 assert.equal(JSON.stringify(download).includes(credentials.apiKey),false);assert.equal(download.payload.recovery.legacy.api_key,'');
 assert.equal(prepared.sha256,download.sha256);const digest=download.sha256;delete download.sha256;assert.equal(await Core.sha256(download),digest);assert.notEqual(digest,doc.sha256);assert.deepEqual(doc,before);
 doc.payload.recovery.legacy.api_key='changed';await assert.rejects(client.prepareExportFile(doc),{code:'backup-hash-mismatch'});assert.equal(blobs.length,1);
});
test('rescue credential filtering does not change full local backups or gameplay key and token fields',async()=>{
 const {f,client,credentials}=credentialFixture(),full=await client.captureFull();
 assert.equal(full.payload.header.chat_metadata.variables.connection.api_key,credentials.apiKey);assert.deepEqual(full.payload.messages,f.messages);
 await assert.rejects(client.parse(await client.captureRescue()));await assert.rejects(client.parseMigration(await client.captureRescue()));
});
