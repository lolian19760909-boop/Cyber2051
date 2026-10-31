'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Library=require('../../卡片源码/运行时/story-library.js'),Core=require('../../卡片源码/运行时/core.js'),Backup=require('../../卡片源码/运行时/backup.js');
const clone=structuredClone,hash=v=>Core.sha256(v),K=Library.KEY;
function fixture(){let current='A',seq=0,badWrite=false;const db={A:[{chat_metadata:{variables:{summary:'过去',news:'旧新闻'},unknown:{keep:true}}},{mes:'旧剧情',swipe_id:0,swipes:['旧剧情','另一条回复'],variables:[{stat_data:{hp:30,ammo:7,combat:{round:2}}},{stat_data:{hp:99}}]}]};
 const adapter={current:async()=>({chatId:current,rows:clone(db[current])}),tagCurrent:async m=>{db[current][0].chat_metadata[K]=clone(m);},list:async()=>Object.entries(db).map(([chatId,rows])=>({chatId,meta:Library.metadata(rows)})),exists:async id=>!!db[id],read:async id=>clone(db[id]),write:async(id,rows)=>{db[id]=clone(rows);if(badWrite)db[id][1].mes='写入截断';},flush:async()=>{},capture:async()=>({format:1,type:'cyber2051.migration',source:{workId:'cyber2051'},sourceContext:{chatId:current},payload:{header:clone(db[current][0]),messages:clone(db[current].slice(1)),archive:{keep:true}}}),validateExport:async d=>{const value=clone(d),h=value.sha256;delete value.sha256;assert.equal(await hash(value),h);return clone(d);},importDocument:async d=>{const id='route'+(++seq);db[id]=[clone(d.payload.header),...clone(d.payload.messages)];return {chatId:id};},open:async id=>{current=id;},newChat:async()=>{current='route'+(++seq);db[current]=[{chat_metadata:{}},{mes:'新开场'}];}};
 const store=Library.createStore({adapter,hash,uuid:()=>crypto.randomUUID(),now:()=> '2051-04-01T00:00:00.000Z'});return {store,db,adapter,current:()=>current,setBad:v=>badWrite=v};}
test('checkpoint restores all branches, combat and old summaries into a new route',async()=>{const f=fixture();const saved=await f.store.point('街口');const original=clone(f.db.A);f.db.A[0].chat_metadata.variables.summary='未来';f.db.A[1].variables[0].stat_data.hp=1;const result=await f.store.restore(saved.chatId);assert.notEqual(result.chatId,'A');assert.equal(f.db.A[0].chat_metadata.variables.summary,'未来');assert.deepEqual(f.db[result.chatId].slice(1),original.slice(1));assert.equal(f.db[result.chatId][0].chat_metadata.variables.summary,'过去');assert.equal(f.db[result.chatId][0].chat_metadata[K].parentPointId,saved.meta.pointId);});
test('quicksave pointer changes only after verified write, named points remain',async()=>{const f=fixture(),named=await f.store.point('保留'),one=await f.store.point('',true);f.setBad(true);await assert.rejects(f.store.point('',true),/读回/);assert.equal(f.db.A[0].chat_metadata[K].quickPoint,one.chatId);f.setBad(false);const two=await f.store.point('',true),list=await f.store.list();assert.ok(list.some(x=>x.chatId===named.chatId));assert.ok(list.some(x=>x.chatId===two.chatId));assert.ok(!list.some(x=>x.chatId===one.chatId));});
test('modified checkpoint is rejected; import carries unknown fields',async()=>{const f=fixture(),point=await f.store.point('一');const doc=await f.store.exportPoint(point.chatId);const result=await f.store.importDocument(doc);assert.deepEqual(f.db[result.chatId][0].chat_metadata.unknown,{keep:true});f.db[point.chatId][1].mes='被修改';await assert.rejects(f.store.restore(point.chatId),/校验失败/);});
test('story-owned unknown metadata survives checkpoint and route import',async()=>{const f=fixture();await f.store.ensureRoute();f.db.A[0].chat_metadata[K].futureFeature={keep:42};const point=await f.store.point('扩展数据'),doc=await f.store.exportPoint(point.chatId),restored=await f.store.restore(point.chatId);assert.deepEqual(f.db[restored.chatId][0].chat_metadata[K].futureFeature,{keep:42});const imported=await f.store.importDocument(doc);assert.deepEqual(f.db[imported.chatId][0].chat_metadata[K].futureFeature,{keep:42});assert.equal(f.db[imported.chatId][0].chat_metadata[K].rowsHash,undefined);});
test('new story has no cloned character state and current route rename persists',async()=>{const f=fixture();await f.store.newStory('二');assert.equal(f.db[f.current()][1].variables,undefined);await f.store.rename('第二条路线');assert.equal(f.db[f.current()][0].chat_metadata[K].name,'第二条路线');await f.store.switchStory('A');assert.equal(f.current(),'A');});
test('invalid new-story and checkpoint names reject before any chat or metadata write',async()=>{const f=fixture(),before=clone(f.db);let flushed=0;f.adapter.flush=async()=>{flushed++;};await assert.rejects(f.store.newStory('   '),/名称/);await assert.rejects(f.store.point(''),/名称/);assert.equal(f.current(),'A');assert.equal(flushed,0);assert.deepEqual(f.db,before);});
test('opening a read-only list never registers or switches a story',async()=>{const f=fixture(),before=clone(f.db);await f.store.list();assert.deepEqual(f.db,before);assert.equal(f.current(),'A');});

test('install backups never occupy a slot or become continue targets, and remain readable for recovery',async()=>{const f=fixture();await f.store.remember();const id='cxx-backup-7d01711b-d011-49b5-90a1-342f1ed549a6';f.db[id]=clone(f.db.A);const before=clone(f.db),list=await f.store.list();assert.deepEqual(list.map(x=>[x.chatId,x.slot]),[['A',1]]);assert.deepEqual(Library.slotIndex(await f.adapter.list()).map(x=>[x.chatId,x.slot]),[['A',1]]);assert.deepEqual((await f.store.details(id)).meta,f.db.A[0].chat_metadata[K]);assert.deepEqual(f.db,before);await f.store.newStory('新故事');assert.equal(f.db[f.current()][0].chat_metadata[K].slot,2);assert.deepEqual(f.db[id],before[id]);});

test('explicitly restored copies remain playable and an arbitrary backup-like name is not hidden',async()=>{const f=fixture();for(const id of ['cxx-restored-7d01711b-d011-49b5-90a1-342f1ed549a6','cxx-backup-my-story'])f.db[id]=clone(f.db.A);assert.deepEqual((await f.store.list()).map(x=>x.chatId),['A','cxx-restored-7d01711b-d011-49b5-90a1-342f1ed549a6','cxx-backup-my-story']);});
test('slot indexing excludes greetings and checkpoints and preserves occupied slots',()=>{const all=[{chatId:'empty',playable:false},{chatId:'point',meta:{kind:'checkpoint'}},{chatId:'old',meta:{kind:'route',slot:1,createdAt:'2000'}},{chatId:'import',meta:{kind:'route',slot:1,createdAt:'2001'}},{chatId:'unassigned'}];assert.deepEqual(Library.slotIndex(all).map(x=>[x.chatId,x.slot]),[['old',1],['import',2],['unassigned',3]]);assert.equal(Library.playable([{chat_metadata:{}},{mes:'<OpeningForm/>'}]),false);assert.equal(Library.playable([{chat_metadata:{}},{is_user:true,mes:'继续'}]),true);});
test('occupied slot rejects before chat creation; registration retry reuses only one chat',async()=>{const f=fixture();await f.store.ensureRoute();const before=clone(f.db);await assert.rejects(f.store.newStory('占用',null,1),/占用/);assert.deepEqual(f.db,before);const save=f.adapter.tagCurrent;let fail=true;f.adapter.tagCurrent=async m=>{if(fail)throw Error('登记失败');return save(m);};await assert.rejects(f.store.newStory('新的故事',null,2),/登记失败/);const id=f.current();assert.equal(Object.keys(f.db).length,2);fail=false;await f.store.newStory('新的故事',null,2);assert.equal(f.current(),id);assert.equal(Object.keys(f.db).length,2);assert.equal(f.db[id][0].chat_metadata[K].slot,2);await f.store.finishCreation();assert.equal(f.db[id][0].chat_metadata[K].stage,'playing');});
test('remembering a legacy route persists its allocated slot without changing its state',async()=>{const f=fixture(),before=clone(f.db.A[1]);await f.store.remember();assert.equal(f.db.A[0].chat_metadata[K].slot,1);assert.equal(f.db.A[0].chat_metadata[K].lastPlayedAt,'2051-04-01T00:00:00.000Z');assert.deepEqual(f.db.A[1],before);});
test('cover edit preserves snapshot branches and unknown fields, recalculates integrity, and travels in export',async()=>{const f=fixture(),saved=await f.store.point('雨夜'),before=clone(f.db[saved.chatId]);const cover={schema:1,kind:'gallery',id:'ring'};await f.store.decorate(saved.chatId,cover);assert.deepEqual(f.db[saved.chatId].slice(1),before.slice(1));assert.deepEqual(f.db[saved.chatId][0].chat_metadata.unknown,{keep:true});assert.notEqual(f.db[saved.chatId][0].chat_metadata[K].rowsHash,before[0].chat_metadata[K].rowsHash);const doc=await f.store.exportPoint(saved.chatId);assert.deepEqual(doc.payload.header.chat_metadata[K].cover,cover);const restored=await f.store.restore(saved.chatId);assert.deepEqual(f.db[restored.chatId][0].chat_metadata[K].cover,cover);});
test('cover edits reject a modified checkpoint rather than blessing its changed content',async()=>{const f=fixture(),saved=await f.store.point('安全点');f.db[saved.chatId][1].mes='外部更改';await assert.rejects(f.store.decorate(saved.chatId,{schema:1,kind:'gallery',id:'ring'}),/校验失败/);});
test('checkpoint captures preview at its own time and does not reuse later live scene',async()=>{const f=fixture();f.db.A[1].mes='<cxx-story>雨停了。</cxx-story><ztl>{"location":"暗池","time":"21:00","characters":[{"name":"高松灯"}]}</ztl>';const saved=await f.store.point('雨后');f.db.A[1].mes='<ztl>{"location":"皇核","time":"08:00"}</ztl>';assert.equal(f.db[saved.chatId][0].chat_metadata[K].preview.location,'暗池');assert.equal(f.db[saved.chatId][0].chat_metadata[K].preview.excerpt,'雨停了。');assert.equal(Library.describe(f.db.A).location,'皇核');});
test('serialized cover saves block duplicate actions and failed validation does not modify records',async()=>{const f=fixture(),saved=await f.store.point('原点');let release;const hold=new Promise(resolve=>{release=resolve;}),store=Library.createStore({adapter:f.adapter,hash,uuid:()=>crypto.randomUUID(),validateCover:async()=>{await hold;throw Error('坏图片');}});const before=clone(f.db),job=store.decorate(saved.chatId,{schema:1,kind:'upload'});await assert.rejects(store.newStory('误点'),/正在进行/);release();await assert.rejects(job,/坏图片/);assert.deepEqual(f.db,before);});
test('complete snapshot reads cold TT swipes from disk and verifies selected variables',async()=>{
 const full=[{chat_metadata:{foreign:1}},{mes:'当前',swipe_id:0,is_user:false,swipes:['当前','未加载分支'],variables:[{stat_data:{hp:2}},{stat_data:{hp:91}}]}],c={chat:[{mes:'当前',swipe_id:0,is_user:false,variables:[{stat_data:{hp:2}}]}],chatMetadata:{foreign:1},saveChat:async()=>{},getRequestHeaders:()=>({})};
 const host={assertContext(){},readState:()=>({keep:true})};const adapters=Backup.nativeAdapters({api:{SillyTavern:{getContext:()=>c},getTavernVersion:()=> '1.18.0',getTavernHelperVersion:()=> '4.11.2'},host,root:{parent:{location:{origin:'http://localhost'}}},fetch:async()=>({ok:true,json:async()=>({result:full.map(JSON.stringify).join('\n')})})});
 const value=await adapters.completeSnapshot({characterKey:'card',chatId:'A'});assert.equal(value.messages[0].variables[1].stat_data.hp,91);assert.deepEqual(value.messages[0].swipes,['当前','未加载分支']);c.chat[0].variables[0].stat_data.hp=7;await assert.rejects(adapters.completeSnapshot({characterKey:'card',chatId:'A'}),/尚未保存/);
});
test('incomplete cold branches and unsaved inactive variables cannot claim a complete snapshot',async()=>{const c={chat:[{mes:'当前',is_user:false,swipe_id:0,swipes:['当前',null],swipe_info:[{known:1},null],variables:[{stat_data:{hp:2}},{stat_data:{hp:9}}],tt_swipe_cold:{sourceId:4,record:1}}],chatMetadata:{x:1},saveChat:async()=>{},getRequestHeaders:()=>({})};const full=[{chat_metadata:{x:1}},{...clone(c.chat[0]),swipes:['当前','旧分支'],swipe_info:[{known:1},{unknown:2}]}];delete full[1].tt_swipe_cold;const host={assertContext(){},readState:()=>({})},a=Backup.nativeAdapters({api:{SillyTavern:{getContext:()=>c},getTavernVersion:()=> '2.3.0',getTavernHelperVersion:()=> '4.11.3'},host,root:{parent:{location:{origin:'http://localhost'}}},fetch:async()=>({ok:true,json:async()=>({result:full.map(JSON.stringify).join('\n')})})});assert.equal((await a.completeSnapshot({characterKey:'card',chatId:'A'})).messages[0].swipes[1],'旧分支');full[1].tt_swipe_cold={sourceId:4,record:1};await assert.rejects(a.completeSnapshot({characterKey:'card',chatId:'A'}),/延迟加载标记/);delete full[1].tt_swipe_cold;full[1].variables[1].stat_data.hp=8;await assert.rejects(a.completeSnapshot({characterKey:'card',chatId:'A'}),/未选中回复/);});

test('save preview ignores planning mentions and reads the real scene and story',()=>{const raw='正在考虑 <ztl> 与状态信息。\n</konatan_planning~>\n<cxx-story>雨后的街道恢复平静。</cxx-story><ztl>{"location":"暗池","date":"2051-10-23","time":"21:00","characters":[]}</ztl>';const preview=Library.describe([{}, {mes:raw}]);assert.equal(preview.location,'暗池');assert.equal(preview.excerpt,'雨后的街道恢复平静。');assert.equal(preview.time,'2051-10-23 21:00');});

function downloadFixture(prepare){
 const source=require('node:fs').readFileSync(require.resolve('../../卡片源码/运行时/story-library.js'),'utf8'),tree=require('acorn').parse(source,{ecmaVersion:'latest'});let node;
 const walk=value=>{if(!value||typeof value!=='object')return;if(value.type==='FunctionDeclaration'&&value.id?.name==='download')node=value;for(const part of Object.values(value))if(Array.isArray(part))part.forEach(walk);else if(part&&typeof part==='object')walk(part);};walk(tree);assert.ok(node);
 const calls={checked:0,prepared:0,clicked:0,revoked:0,timers:[]},backup={assertExportCurrent(){calls.checked++;},async prepareExportFile(doc){calls.prepared++;await prepare?.(backup,doc);return {url:'blob:verified',revoke(){calls.revoked++;}};}},top={document:{createElement(){return {click(){calls.clicked++;}};}}};
 const download=new Function('top','metadata','backup','setTimeout','return ('+source.slice(node.start,node.end)+')')(top,Library.metadata,backup,fn=>calls.timers.push(fn));
 return {calls,backup,download};
}
test('story and checkpoint downloads use the same validated export preparation',async()=>{
 const f=downloadFixture();await f.download({payload:{header:{chat_metadata:{__cxx_story_v1:{kind:'route'}}}}});assert.equal(f.calls.checked,2);assert.equal(f.calls.prepared,1);assert.equal(f.calls.clicked,1);
 await f.download({payload:{header:{chat_metadata:{__cxx_story_v1:{kind:'checkpoint'}}}}});assert.equal(f.calls.checked,2);assert.equal(f.calls.prepared,2);assert.equal(f.calls.clicked,2);f.calls.timers.forEach(fn=>fn());assert.equal(f.calls.revoked,2);
});
test('failed or stale export preparation cannot start a download',async()=>{
 const failed=downloadFixture(()=>{throw Error('invalid hash');});await assert.rejects(failed.download({}),/invalid hash/);assert.equal(failed.calls.clicked,0);
 const changed=downloadFixture(backup=>{backup.assertExportCurrent=()=>{throw Error('story changed');};});await assert.rejects(changed.download({}),/story changed/);assert.equal(changed.calls.clicked,0);assert.equal(changed.calls.revoked,1);assert.equal(changed.calls.timers.length,0);
});

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { map, getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) };
}

function journalAdapter(existing) {
  const rows = [{ chat_metadata: {} }, { mes: '旧剧情' }];
  return {
    current: async () => ({ chatId: 'A', rows }),
    list: async () => [{ chatId: 'A', meta: Library.metadata(rows) }],
    exists: async () => existing,
    read: async () => rows,
    flush: async () => {},
    newChat: async () => ({ chatId: 'cxxstory_new' }),
    write: async () => {},
    tagCurrent: async () => {}
  };
}

test('a stale creation journal is dropped when its chat is gone, and kept while it is alive', async () => {
  const seed = { 'cxx-story-creation': JSON.stringify({ signature: '["旧名字",null,1]', slot: 1, creationId: 'old-id', chatId: 'cxxstory_old', created: false }) };

  const storage = memoryStorage(seed);
  const store = Library.createStore({ adapter: journalAdapter(false), hash, uuid: () => crypto.randomUUID(), now: () => '2051-04-01T00:00:00.000Z', storage });
  let rejected = null;
  try { await store.newStory('新名字', null, 2, 'new-id'); } catch (caught) { rejected = caught; }
  assert.ok(!rejected || !/档位 1 的创建尚未完成/.test(rejected.message), '旧日志不能永久挡住新建');

  const alive = memoryStorage(seed);
  const store2 = Library.createStore({ adapter: journalAdapter(true), hash, uuid: () => crypto.randomUUID(), now: () => '2051-04-01T00:00:00.000Z', storage: alive });
  await assert.rejects(store2.newStory('新名字', null, 2, 'new-id'), /档位 1 的创建尚未完成/);
  assert.ok(alive.getItem('cxx-story-creation'), '聊天还在时必须保留日志');
});
