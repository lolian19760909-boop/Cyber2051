const test=require('node:test'),assert=require('node:assert/strict');
const Startup=require('../../卡片源码/MVU/opening-startup.js'),Diagnostics=require('../../卡片源码/运行时/diagnostics.js');
test('creation starts without a reader and retries a failed initialization once requested',()=>{
 const rows=[],registry=new Map(),win={CxxDiagnostics:{report:e=>rows.push(e),resolve:()=>{}}};let fail=true,creates=0,destroys=0;
 win.Cxx236OpeningMap={create(){creates++;if(fail)throw Error('test: initialization failed');const service={beginDraft(){},destroy(){destroys++;if(win.Cxx236OpeningHost===service)delete win.Cxx236OpeningHost;}};win.Cxx236OpeningHost=service;return service;}};
 const runtime={alive:true,register(name,value,dispose){registry.get(name)?.dispose?.();registry.set(name,{value,dispose});win[name]=value;}};
 const startup=Startup.install({win,runtime,pages:[],api:{}});assert.equal(startup.read().ready,false);assert.match(rows[0].message,/initialization/);
 fail=false;const service=startup.ensure();assert.equal(typeof service.beginDraft,'function');assert.equal(startup.ensure(),service);assert.equal(creates,2);assert.equal(startup.read().ready,true);startup.destroy();assert(destroys);assert.throws(()=>startup.ensure(),/已卸载/);
});
function fixture(){
 const api=new EventTarget(),top=new EventTarget(),storage=new Map();let chat=[{mes:'<OpeningForm/>'},{is_user:true,mes:'走进大楼'},{mes:'破损正文',swipe_id:1}],current='one';
 api.SillyTavern={getContext:()=>({chat,characterId:0,characters:[{avatar:'test.png'}],getCurrentChatId:()=>current,eventTypes:{}})};
 api.getScriptTrees=()=>[{id:'native',name:'原生阅读与终端',enabled:false,type:'script'}];top.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};top.Cxx236VariableGuard={state:()=>({ready:true,lastError:''})};top.CxxResources={read:()=>({error:'',failed:0})};top.Cxx236OpeningHost={beginDraft(){}};top.__cxx_player__={completeOpening(){}};top.__cxx_gal_g1__={};top.Cxx233NativeComponents={};
 const service=Diagnostics.install(top,api,[{id:'native',name:'原生阅读与终端'}],{version:'2.2.7'});
 return {service,top,api,chat,setChat:x=>{current=x;}};
}
function cacheFixture(){
 const f=fixture(),cache={name:'卡',character_version:'2.2.10',extensions:{tavern_helper:{variables:{playerNote:'私人文本'},scripts:[]}}};
 let reads=0,disk=structuredClone(cache);disk.name='磁盘新卡名';f.top.location={origin:'http://tauri.localhost'};
 f.api.getCharData=()=>({data:structuredClone(cache),json_data:JSON.stringify({spec:'chara_card_v2',character_version:'2.2.10',data:cache})});f.api.getTavernVersion=()=> '1.18.0';
 f.api.SillyTavern.getContext=(()=>{const get=f.api.SillyTavern.getContext;return()=>({...get(),getRequestHeaders:()=>({})});})();
 f.api.fetch=async(url,options)=>{assert.match(url,/\/api\/characters\/get$/);assert.equal(JSON.parse(options.body).avatar_url,'test.png');reads++;return {ok:true,json:async()=>({data:structuredClone(disk),json_data:JSON.stringify({spec:'chara_card_v2',character_version:'2.2.10',data:disk})})};};
 return {...f,cache,getReads:()=>reads};
}
test('integrated cache check joins repeated requests, exports field paths and preserves player text',async()=>{
 const f=cacheFixture(),before=structuredClone(f.cache),p=f.service.checkCharacterCache({wait:async()=>{}});assert.equal(p,f.service.checkCharacterCache());const result=await p;
 assert.equal(f.getReads(),2);assert.equal(result.reads.at(-1).difference.changes[0].path,'/name');assert(result.outer.cacheKeys.includes('character_version'));
 assert.deepEqual(f.cache,before);const exported=f.service.export();assert.deepEqual(exported.characterCache.result,result);assert(!JSON.stringify(exported.characterCache).includes('私人文本'));
 assert(exported.rows.some(r=>r.module==='角色缓存'&&r.level==='warning'));f.setChat('two');assert.equal(f.service.read().characterCache,null);f.service.destroy();
});
test('integrated cache result cannot cross chats or survive a destroyed diagnostic service',async()=>{
 const f=cacheFixture();await assert.rejects(f.service.checkCharacterCache({wait:async()=>f.setChat('other')}),/切换/);assert.equal(f.getReads(),1);assert.equal(f.service.read().characterCache,null);assert(!f.service.read().rows.some(r=>r.module==='角色缓存'));f.service.destroy();
 const old=cacheFixture(),pending=old.service.checkCharacterCache({wait:async()=>old.service.destroy()});await assert.rejects(pending,/取消/);assert.equal(old.getReads(),1);assert(!old.service.read().rows.some(r=>r.module==='角色缓存'));await assert.rejects(old.service.checkCharacterCache(),/已卸载/);assert.equal(old.getReads(),1);
});
test('opening diagnostics scans loaded assistant messages and missing services together without a floor input',async()=>{
 const f=fixture();await f.service.scan();const data=f.service.read();assert.equal(data.scan.checked,1);assert.equal(data.scan.scanned,1);assert(data.rows.some(r=>r.module==='正文'));assert(data.rows.some(r=>r.module==='原生阅读与终端'&&/停用/.test(r.message)));const counts=data.rows.map(r=>[r.id,r.count]);await f.service.scan();assert.equal(f.service.read().scan.scanned,0);for(const [id,count]of counts)assert.equal(f.service.read().rows.find(r=>r.id===id).count,count);f.service.destroy();
});

test('copyable issue joins build, host, plugins, save phase and the original structured error',async()=>{
 const f=fixture(),save={kind:'blocked',code:'chat-save-conflict',details:{phase:'load',differences:[{path:'/messages/0/mes',left:{length:12},right:{length:13}}]}};
 f.top.__TAURI_INTERNALS__={};f.api.getTavernVersion=()=> '1.18.0';
 f.top.__cxx_chat_save_guard_v1={inspect:async()=>save,status:()=>({phase:'load-failed',error:save.code,timeline:[{phase:'load-start'},{phase:'load-failed'}]})};
 f.top.Cxx233Updater={readSeed:()=>({migration:{buildId:'exact-build',saveSchema:1}})};
 f.top.CxxPlugins={read:()=>({installed:[{name:'ST-Prompt-Template',version:'1.17.9',disabled:false}],rows:[]})};
 const error={message:'保存失败',code:save.code,saveCheck:save.details},result=await f.service.issue(error);
 assert.equal(result.schema,'cyber2051.issue.v1');assert.equal(result.card.buildId,'exact-build');assert.equal(result.host.type,'TauriTavern');
 assert.deepEqual(result.error,error);assert.deepEqual(result.save.check,save);assert.equal(result.plugins.installed[0].version,'1.17.9');
 assert(!JSON.stringify(result).includes('走进大楼'));assert.equal(result.context.chat,'one');assert.equal(result.contextChanged,false);f.service.destroy();
});
test('overview isolates current chat and active branches; corrected text clears its prior errors',async()=>{
 const f=fixture();await f.service.scan();f.chat[2].swipe_id=0;let data=f.service.read();assert(!Diagnostics.activeRows(data).some(r=>r.module==='正文'));
 f.chat[2].swipe_id=1;f.chat[2].mes='<cxx-story>街区亮着灯。</cxx-story><ztl>{"date":"2051-01-01","time":"12:30","location":"街区","characters":[]}</ztl><xuan>1. 走近\n2. 等待\n3. 调查\n4. 询问\n5. 离开</xuan>';await f.service.scan();assert(!Diagnostics.activeRows(f.service.read()).some(r=>r.module==='正文'&&!r.resolved));f.setChat('two');assert.equal(Diagnostics.activeRows(f.service.read()).length,0);f.service.destroy();
});
test('diagnostics uses renderer scopes and excludes planning, auxiliary examples and quoted protocol',()=>{
 const good='<cxx-story>街区亮着灯。<cxx-say speaker="丰川祥子" expression="normal">走吧。</cxx-say></cxx-story><ztl>{"date":"2051-01-01","time":"12:30","location":"街区","characters":[]}</ztl><xuan>1. 走近\n2. 等待\n3. 调查\n4. 询问\n5. 离开</xuan>';
 const sample='<cxx-story><cxx-say speaker="丰川祥子" expression="..." kind="thought">示例</cxx-say></cxx-story><ztl>状态</ztl><xuan>选项</xuan>';
 for(const extra of ['<think>'+sample+'</think>','<tucao>'+sample+'</tucao>','```html\n'+sample+'\n```','> '+sample,'`'+sample+'`'])assert.deepEqual(Diagnostics.inspect(extra+'\n\n'+good),[],extra);
 const broken=good.replace('"characters":[]','"characters":');const detail=Diagnostics.inspectDetailed(broken).find(i=>i.message.includes('JSON'));assert.match(detail.detail,/解析正文第/);assert.match(detail.detail,/characters/);
 assert(Diagnostics.inspect(good.replace('expression="normal"','expression="..."')).some(x=>x.includes('台词人物')));
});

 test('copyable issue records installation owner and phase after switching to a new chat',async()=>{
 const f=fixture(),installation={kind:'pending',id:'transaction-1',phase:'awaiting-verification',scope:'character',chatId:'old-story',stages:['scripts'],otherChat:true};
 f.top.Cxx233Updater={inspectRecovery:async()=>structuredClone(installation)};f.setChat('new-story');const result=await f.service.issue({code:'migration-pending-install',message:'仍有未完成的安装记录'});
 assert.deepEqual(result.updater.installation,installation);assert.equal(result.context.chat,'new-story');assert(!JSON.stringify(result).includes('走进大楼'));f.service.destroy();
 });
 test('copyable issue preserves installation read failure rather than reporting no pending work',async()=>{
 const f=fixture();f.top.Cxx233Updater={inspectRecovery:async()=>{throw Object.assign(Error('备份无法读取'),{code:'backup-unreadable'});}};const result=await f.service.issue({message:'恢复失败'});
 assert.equal(result.updater.installation.kind,'blocked');assert.equal(result.updater.installation.code,'backup-unreadable');f.service.destroy();
 });
