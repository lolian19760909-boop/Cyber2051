/** ST 1.19 extension entry. Uses the installed host and Helper, never fabricates their globals. */
import {createNativeHostGenerator,createNativeHostTokenCounter} from './host-generation.mjs';
import {preserveRowMetadata} from './rows.mjs';
import {worldbookSources,patchNativeBook} from './worldbook.mjs';
import {nativeBook} from './app/src/app/content-settings.mjs';
import {createStProjection} from './app/src/platform/st-projection.mjs';
import {nativeFingerprint} from './app/src/store/tavern.mjs';
import {createStMedia} from './app/src/platform/st-media.mjs';
import {cardLens,lensText,lensDrift,sha256Hex} from './app/src/platform/identity.mjs';
const context=()=>globalThis.SillyTavern.getContext();
const NS='cxx2051_web',clone=value=>structuredClone(value);
const error=(code,message)=>Object.assign(new Error(message),{code});
const digest=value=>JSON.stringify(value);
let panel,bridge,frame,releaseNativeViews,releaseStory,appReady=false,identityCheck=null,identityFlight=null;
/** 酒馆自己正在出字时不允许抢聊天；只是收尾保存/静默冷却时，等它一下再开，别拿一句报错把玩家挡回去。 */
const hostBusy=()=>globalThis.Cxx233Updater?.host?.getContext?.().busy===true;
async function waitHostQuiet(limit=6000){
  const refuse=()=>error('host_generation_busy','酒馆正在生成或保存，请完成当前操作后再打开网页');
  const until=Date.now()+limit;
  while(hostBusy()){
    if(context().generating===true||Date.now()>until)throw refuse();
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  if(hostBusy())throw refuse();
}
export function createHostBridge(){
  const start=context(),avatar=start.characters[start.characterId]?.avatar,chatId=start.getCurrentChatId();
  if(!avatar||!chatId||start.groupId)throw error('host_chat_required','请先选择东京都2051的单角色聊天');
  if(globalThis.Cxx233Updater?.host?.getContext?.().busy)throw error('host_generation_busy','酒馆正在生成或保存，请完成当前操作后再打开网页');
  const helper=globalThis.TavernHelper;
  if(!helper?.getVariables||!helper?.replaceVariables||!helper?.getCharWorldbookNames)throw error('helper_missing','需要酒馆助手 4.11.3 的变量与世界书接口');
  let account=start.accountStorage.getItem('cxx2051_web_identity');if(!account){account='st-'+crypto.randomUUID();start.accountStorage.setItem('cxx2051_web_identity',account);}
  const identity={accountId:account,runId:'st:'+avatar+':'+chatId},nativeScope=JSON.stringify([avatar,chatId]);let ended=false,busy=false,baseline=null,diskBaseline=null,baselineValue=null,lastConflict=null,generationPhase='idle',waiting=null,lastGenerate=null;
  function differences(a,b,path='',out=[],limit=12){if(out.length>=limit||JSON.stringify(a)===JSON.stringify(b))return out;if(!a||!b||typeof a!=='object'||typeof b!=='object'){out.push(path);return out;}for(const key of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[key],b[key],path+'/'+key,out,limit);return out;}
  const at=(value,pointer)=>pointer.slice(1).split('/').reduce((row,key)=>row?.[key],value);
  const sourceInitialization=(before,after,paths,scopePrefix)=>paths.length&&paths.every(p=>new RegExp('^'+scopePrefix+'/\\d+/(cxx_context|extra/cxx_context|swipe_info/\\d+/extra/cxx_context)$').test(p)&&at(before,p)===undefined&&at(after,p)&&typeof at(after,p)==='object');
  function assertScope(){const c=context();if(ended||c.characters[c.characterId]?.avatar!==avatar||c.getCurrentChatId()!==chatId)throw error('host_changed','当前酒馆聊天已变化，请重新打开网页界面');return c;}
  // 角色卡自己在生成结束/存档后会锁住聊天约 2 秒（host.js 的 quietUntil）。网页的读、写、发都排在同一队里，先安静下来再动手，
  // 否则中断后立刻重发会撞上 host-busy，玩家看到“正在生成或刚结束写入，更新已排队”。
  const hostBusyNow=()=>globalThis.Cxx233Updater?.host?.getContext?.().busy===true;
  async function quiet(limit=20000,signal){const until=Date.now()+limit;while(hostBusyNow()){if(signal?.aborted)throw new DOMException('已停止','AbortError');if(Date.now()>until)return;await new Promise(resolve=>setTimeout(resolve,120));}}
  const nativeQueue=async work=>{assertScope();await quiet();const host=globalThis.Cxx233Updater?.host;if(!host?.withChatSave)throw error('card_runtime_missing','请等待角色卡的更新与存档服务就绪，再打开网页界面');const q=globalThis.__cxxQ=globalThis.__cxxQ||[];const id=String(Date.now()%1e6)+':'+q.length;q.push({id,phase:'start',at:Date.now()});if(q.length>60)q.shift();const once=()=>host.withChatSave({characterKey:avatar,chatId},async()=>{try{return await work();}finally{const r=globalThis.__cxxQ=globalThis.__cxxQ||[];r.push({id,phase:'end',at:Date.now()});if(r.length>60)r.shift();}});
    // 角色卡的存档守卫还会在“生成刚结束”的窗口里挡一次；那不是数据冲突，等它开门再重来，别把错误丢给玩家。
    const deadline=Date.now()+20000;
    for(;;){try{return await once();}catch(cause){const log=globalThis.__cxxBusyLog=globalThis.__cxxBusyLog||[];log.push({at:Date.now(),code:cause?.code,message:cause?.message,busy:hostBusyNow(),stack:String(cause?.stack||'').slice(0,300)});if(log.length>20)log.shift();if(cause?.code!=='host-busy'||Date.now()>deadline)throw cause;await quiet(20000);}}};
  async function waitForReady(signal){
    assertScope();if(signal?.aborted)throw new DOMException('已停止','AbortError');
    const updater=globalThis.Cxx233Updater;if(!updater?.host||typeof updater.whenIdle!=='function')throw error('card_runtime_missing','角色卡运行服务尚未就绪');
    if(hostBusyNow())waiting={phase:'host-busy',activity:updater.activity?.()??null};
    await quiet(20000,signal);assertScope();
    // 角色卡自己的 assertPlayerWritable 会在忙时经 journalOrphan 直接抛 host-busy；这是“等一等”，不是玩家数据坏了。
    const deadline=Date.now()+30000;
    for(;;){try{await updater.host.assertPlayerWritable({characterKey:avatar,chatId});waiting=null;return;}catch(cause){
      if(cause.code==='host-busy'&&Date.now()<deadline){waiting={phase:'host-busy',activity:updater.activity?.()??null};await quiet(20000,signal);assertScope();continue;}
      if(cause.code!=='migration-pending-install')throw cause;break;}}
    // A full-card recovery can exceed 30 seconds while its durable stages keep
    // advancing. Let the installed controller finish its own recovery contract.
    let done=false,failure;
    const idle=updater.whenIdle().then(()=>{done=true;},cause=>{failure=cause;done=true;});
    while(!done){assertScope();if(signal?.aborted)throw new DOMException('已停止','AbortError');const installed=updater.host.readState();waiting={activity:updater.activity(),journal:installed.journalName||null,pendingRegistry:!!installed.pendingRegistry,status:updater.getStatus()};
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    await idle;assertScope();if(signal?.aborted)throw new DOMException('已停止','AbortError');if(failure)throw failure;
    await updater.host.assertPlayerWritable({characterKey:avatar,chatId});waiting=null;
  }
  async function api(path,body){const response=await fetch(path,{method:'POST',headers:context().getRequestHeaders(),body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!response.ok)throw error('host_save_failed','酒馆聊天接口返回 '+response.status);return response;}
  const disk=async()=>{const rows=await(await api('/api/chats/get',{avatar_url:avatar,file_name:chatId})).json();return Array.isArray(rows)?rows:[];};
  function live(){const c=assertScope();return {rows:clone(c.chat),metadata:clone(c.chatMetadata)};}
  async function readUnlocked(){const value=live(),stamp=digest(value);if(baseline!==null&&stamp!==baseline){const allPaths=differences(baselineValue,value,'',[],Infinity);lastConflict={paths:allPaths.slice(0,80),count:allPaths.length,contextChanges:allPaths.filter(p=>p.includes('cxx_context')).slice(0,5).map(p=>({path:p,before:at(baselineValue,p)===undefined?'absent':typeof at(baselineValue,p),after:typeof at(value,p)}))};
    // The installed card finishes content pin initialization after opening a fresh chat.
    // Before any web run exists these two additive fields are adopted and preserved by the first save.
    const initializing=!baselineValue.metadata?.[NS]?.run&&!value.metadata?.[NS]?.run&&allPaths.length&&allPaths.every(p=>['/metadata/variables/__cxx_content_pins','/metadata/variables/__cxx_content_origin'].some(prefix=>p===prefix||p.startsWith(prefix+'/')));
    const stamped=sourceInitialization(baselineValue,value,allPaths,'/rows');
    // 启动窗口期与空闲期：角色卡自己还会写凭据、成长点、正文变量，这些都不是"网页被覆盖"。
    // 只要网页这一侧没有正在进行的回合、变化也不落在网页自有命名空间里，就采纳原生最新状态当基线。
    const adopting=allPaths.length&&generationPhase==='idle'&&!allPaths.some(p=>p.startsWith('/metadata/variables/'+NS));
    if(!initializing&&!stamped&&!adopting)throw error('host_changed','酒馆正文、swipe 或插件状态已改变，请重新打开界面；当前候选仍可导出');
    baseline=null;
  }if(baseline===null){baseline=stamp;baselineValue=clone(value);diskBaseline=digest(await disk());}return value;}
  // 让角色卡知道网页这一轮正在生成：忙闲窗口按同一个 id 开合，中断后两秒内就能再发，而不是卡在“正在生成或刚结束写入”。
  const cardGeneration=(phase,id)=>{try{const host=globalThis.Cxx233Updater?.host;(phase==='start'?host?.generationStarted:host?.generationEnded)?.(id);}catch{}};
  const read=()=>nativeQueue(readUnlocked);
  const captureNativeState=options=>nativeQueue(async()=>{
    const value=await readUnlocked(),floor=options?.floor??value.rows.findLastIndex(row=>!row.is_user&&!row.is_system),row=value.rows[floor],swipe=row?.swipe_id||0,fingerprint=nativeFingerprint(media.original(row));
    if(options?.swipe!==undefined&&options.swipe!==swipe||options?.fingerprint&&options.fingerprint!==fingerprint)throw error('host_changed','读取原生状态时正文来源已改变');
    const guard=globalThis.Cxx236VariableGuard;if(!guard?.captureNativeState)return {ok:false,code:'host_state_unavailable',reason:'当前原生组件没有可验证的完整状态捕获接口，请先完整更新角色卡运行组件'};
    const captured=await guard.captureNativeState({floor});assertScope();const after=live(),selected=after.rows[floor];
    if(captured?.ok&&(!captured.complete||captured.scope!==nativeScope||captured.floor!==floor||captured.swipe!==swipe||captured.fingerprint!==fingerprint||nativeFingerprint(media.original(selected))!==fingerprint||(selected.swipe_id||0)!==swipe))throw error('host_changed','原生完整状态的来源核对失败');
    const saved=await disk();assertScope();if(digest(saved)!==diskBaseline){const paths=differences(JSON.parse(diskBaseline),saved,'',[],Infinity);lastConflict={kind:'capture',paths:paths.slice(0,80),count:paths.length};throw error('host_conflict','原生存档在状态捕获期间发生变化，请重新打开后读取');}return clone(captured);
  });
  async function writeUnlocked({rows,document,notify=true}){
    const c=assertScope();await readUnlocked();
    rows=preserveRowMetadata(rows,c.chat,{original:row=>media.original(row)});
    const beforeDisk=await disk();assertScope();
    if(digest(beforeDisk)!==diskBaseline){
      const saved=beforeDisk[0]?.chat_metadata?.[NS];
      // A lost HTTP acknowledgement is recoverable without generating again.
      if(saved&&digest(saved)===digest(document)){c.chat.splice(0,c.chat.length,...clone(beforeDisk.slice(1)));c.updateChatMetadata(clone(beforeDisk[0].chat_metadata),true);baselineValue=live();baseline=digest(baselineValue);diskBaseline=digest(beforeDisk);return;}
      const paths=differences(JSON.parse(diskBaseline),beforeDisk),prefixes=['/0/chat_metadata/variables/__cxx_content_pins','/0/chat_metadata/variables/__cxx_content_origin'];
      const initializing=!baselineValue.metadata?.[NS]?.run&&!saved?.run&&paths.length&&paths.every(p=>prefixes.some(prefix=>p===prefix||p.startsWith(prefix+'/')));
      if(!initializing){lastConflict={paths};throw error('host_conflict','磁盘聊天已被其他页面更新；原候选未覆盖新聊天');}
      diskBaseline=digest(beforeDisk);
    }
    const metadata={...clone(c.chatMetadata)},selected=rows.at(-1)?.variables?.[rows.at(-1)?.swipe_id||0]?.stat_data;
    if(document.run?.profile){const previous=metadata[NS]?.run?.profile,native=metadata.__cxx_story_profile,changed=digest(previous)!==digest(document.run.profile);if(changed)metadata.__cxx_story_profile={...(native?.id===document.run.profile.id?native:{}),...clone(document.run.profile)};else if(native)document.run.profile=clone(native);}
    metadata[NS]=clone(document);
    if(selected?.__cxx_identity){metadata.variables={...metadata.variables,__cxx_identity:clone(selected.__cxx_identity)};const p=document.run?.profile?.preferences;if(p){metadata.variables.__cxx_ui_preferences={...metadata.variables.__cxx_ui_preferences,effects:p.level,device:p.device,mirror:p.mirror,nsfw:p.nsfw,nsfwChosen:p.nsfwChosen,battleMode:p.battleMode||'fast',setupVersion:1,completed:true};metadata.variables.__cxx_gal_mode={...metadata.variables.__cxx_gal_mode,schemaVersion:1,enabled:p.gal};}}
    const before=live();c.chat.splice(0,c.chat.length,...clone(rows));c.updateChatMetadata(metadata,true);
    // The native saver and its drain observe this intended live document. Sending a
    // separate /save while leaving old live rows installed could drain the old rows back.
    let saved;
    try{
      await c.saveChat();saved=await disk();assertScope();
      if(digest(saved[0]?.chat_metadata?.[NS])!==digest(document)||digest(saved.slice(1))!==digest(rows))throw error('host_readback_failed','酒馆磁盘读回与候选不同，请保留候选后重新读取');
    }catch(cause){
      assertScope();
      if(saved&&digest(saved)===digest(beforeDisk)&&digest(live())===digest({rows,metadata})){c.chat.splice(0,c.chat.length,...clone(before.rows));c.updateChatMetadata(before.metadata,true);}
      throw cause;
    }
    baselineValue=live();baseline=digest(baselineValue);diskBaseline=digest(saved);
    // Native surfaces/plugins re-read the committed document. A matching floor receipt suppresses re-application.
    if(notify)await c.eventSource.emit('cxx2051_web_committed',{chatId,nodeId:document.run?.headNodeId,revision:document.run?.revision});
  }
  const write=async value=>{await waitForReady();return nativeQueue(()=>writeUnlocked(value));};
  const protectedValue=value=>({rows:value.rows.map(row=>({mes:row.mes,user:row.is_user,system:row.is_system,swipe:row.swipe_id,swipes:row.swipes,variables:row.variables})),document:value.metadata?.[NS]});
  const writeTask=async(record,{adoptProjection=false,assertCurrent}={})=>nativeQueue(async()=>{
    if(adoptProjection){if(typeof assertCurrent!=='function')throw error('projection_source','投影采用缺少来源检查');assertCurrent();const value=live(),onDisk=await disk();assertCurrent();
      if(digest(protectedValue(value))!==digest(protectedValue(baselineValue))||digest(protectedValue(value))!==digest(protectedValue({rows:onDisk.slice(1),metadata:onDisk[0]?.chat_metadata})))throw error('host_conflict','投影期间正文或权威状态已改变');
      baselineValue=clone(value);baseline=digest(value);diskBaseline=digest(onDisk);
    }
    const current=await readUnlocked(),document=clone(current.metadata?.[NS]);if(!document?.run)throw error('projection_source','尚无已保存故事');const map=new Map((document.records?.tasks||[]).map(row=>[row.taskId||row.id,row]));map.set(record.taskId,{...clone(record),runId:document.run.runId});document.records||={};document.records.tasks=[...map.values()];await writeUnlocked({rows:current.rows,document,notify:false});
  });
  const nativeGenerate=createNativeHostGenerator({context,assertScope});
  async function generate({payload,signal,onDelta,onReasoning,onUsage,onProgress}){
    assertScope();generationPhase='preflight';await waitForReady(signal);assertScope();
    const generationId='cxx2051:'+crypto.randomUUID();cardGeneration('start',generationId);
    const releaseMemory=globalThis.CxxLongMemory?.acquireWebGeneration?.({generationId});
    const stopped=()=>{generationPhase='stopped';};signal?.addEventListener('abort',stopped,{once:true});
    const aborted=()=>new DOMException('已停止','AbortError');
    const abortable=promise=>{if(!signal)return promise;if(signal.aborted)return Promise.reject(aborted());return new Promise((resolve,reject)=>{const onAbort=()=>reject(aborted());signal.addEventListener('abort',onAbort,{once:true});promise.then(value=>{signal.removeEventListener('abort',onAbort);resolve(value);},cause=>{signal.removeEventListener('abort',onAbort);reject(cause);});});};
    try{if(signal?.aborted)throw aborted();generationPhase='requested';const result=await abortable(nativeGenerate({payload,signal,onDelta:delta=>{generationPhase='streaming';assertScope();onDelta?.(delta);},onReasoning,onUsage,onProgress}));assertScope();if(signal?.aborted)throw aborted();generationPhase='returned';lastGenerate={streamEmpty:!result.text.trim(),retried:false};return result;}
    finally{cardGeneration('end',generationId);signal?.removeEventListener('abort',stopped);releaseMemory?.();}
  }
 const tokenCounter=createNativeHostTokenCounter({context,assertScope});
 // Native documents preserve independent flags and extension fields that Helper's
 // nested export cannot represent. Only the selected fields are changed on save.
 const nativeWorldInfo=()=>import('/scripts/world-info.js');
 const bookSources=()=>{const names=helper.getCharWorldbookNames('current');return worldbookSources({global:helper.getGlobalWorldbookNames(),chat:helper.getChatWorldbookName('current'),persona:context().powerUserSettings.persona_description_lorebook,character:[names.primary,...names.additional]});};
 const bookNames=()=>bookSources().map(book=>book.name);
 const readRawBook=async name=>(await nativeWorldInfo()).loadWorldInfo(name);
 const worldInfoSettings=async()=>{assertScope();const [native,{getCharaFilename}]=await Promise.all([nativeWorldInfo(),import('/scripts/utils.js')]),c=assertScope(),character=c.characters[c.characterId];return {...clone(native.getWorldInfoSettings()),characterId:c.characterId,characterFilename:getCharaFilename(c.characterId),characterTags:clone(c.tagMap?.[character?.avatar]||[]),mainApi:c.mainApi,chatCompletionSource:c.chatCompletionSettings?.chat_completion_source};};
 const worldbook={
   available:true,canRead:true,canWrite:true,
   books(){return bookNames();},
   async hostBooks(){assertScope();const scanningSettings=await worldInfoSettings();return Promise.all(bookSources().map(async book=>{const data=await readRawBook(book.name);return {...nativeBook(data||{entries:{}},book),...book,scanningSettings};}));},
   async read({bookId}={}){assertScope();const name=String(bookId||helper.getCharWorldbookNames('current').primary||bookNames()[0]||'');if(!name)throw error('worldbook_missing','当前聊天没有绑定世界书');const data=await readRawBook(name);return nativeBook(data||{entries:{}},{bookId:name,name});},
   async apply({bookId,patches=[],restore=false}={}){assertScope();const name=String(bookId||'');if(!name)throw error('worldbook_missing','写回需要世界书编号');
     const current=await readRawBook(name);if(!current)throw error('worldbook_missing','世界书不存在：'+name);const next=patchNativeBook(current,patches),native=await nativeWorldInfo();await native.saveWorldInfo(name,next,true);assertScope();native.worldInfoCache.delete(name);
     const readback=await readRawBook(name),expected=new Map(Object.values(next.entries).map(entry=>[String(entry.uid),entry])),actual=new Map(Object.values(readback?.entries||{}).map(entry=>[String(entry.uid),entry]));
     for(const patch of patches)if(JSON.stringify(actual.get(String(patch.entryId)))!==JSON.stringify(expected.get(String(patch.entryId))))throw error('worldbook_readback_mismatch','世界书写回与目标不同：'+patch.entryId);
     return {ok:true,bookId:name,count:patches.length,restore:!!restore};}
 };
 const media=createStMedia({context,assertScope,setup:()=>{const service=globalThis.CxxMirrorSetupService;closeWeb();service?.open();}});
  return {...identity,nativeScope,captureNativeState,ready:waitForReady,media,worldbook,worldInfoSettings,hostBooks:()=>worldbook.hostBooks(),original:row=>media.original(row),userName:start.name1,characterName:start.name2,assertScope,read,write,writeTask,generate,tokenCounter,models:async()=>[],
    readMacroGlobals(){assertScope();return clone(helper.getVariables({type:'global'}));},writeMacroGlobals(value){assertScope();helper.replaceVariables(clone(value),{type:'global'});return clone(helper.getVariables({type:'global'}));},
    diagnostics:()=>({lastConflict,generationPhase,waiting,lastGenerate,identity:identityCheck}),
    async withLock(fn){assertScope();if(busy)throw error('turn_busy','此聊天已有回合正在处理');busy=true;try{return navigator.locks?await navigator.locks.request(identity.runId,{ifAvailable:true},lock=>{if(!lock)throw error('turn_busy','另一网页界面正在处理此聊天');return fn();}):await fn();}finally{busy=false;}},
    close(){media.dispose();ended=true;},capabilities:{chat:true,saveReadback:true,swipeVariables:true,nativeGeneration:true,plugins:true,compareAndSwap:false}};
}
export function closeWeb({refresh=true}={}){let native;try{native=bridge?.assertScope();}catch{}globalThis.Cxx2051StProjection?.dispose();delete globalThis.Cxx2051StProjection;frame?.contentWindow?.dispatchEvent(new Event('cxx-host-close'));bridge?.close();panel?.remove();releaseNativeViews?.();releaseStory?.();releaseStory=releaseNativeViews=null;panel=frame=bridge=null;delete globalThis.Cxx2051WebHost;if(refresh&&native)Promise.resolve(native.printMessages()).catch(cause=>globalThis.toastr?.error(cause.message));}
/** 构建身份自检：这份扩展、它内嵌的 app、角色卡里的世界书，是不是同一版。只读，不碰聊天。 */
export async function verifyIdentity(){
  const base=new URL('./',import.meta.url),read=async name=>{const response=await fetch(new URL(name,base),{cache:'no-store'});if(!response.ok)throw error('identity_missing',name+' 读取失败（'+response.status+'）');return response;};
  if(identityFlight)return identityFlight;
  identityFlight=(async()=>{
    let manifest;
    try{manifest=await (await read('identity.json')).json();}catch(cause){
      // 旧安装里没有 identity.json：不当作损坏，只报“这份安装没有构建回执”。
      identityCheck={status:'missing',reason:cause.message,at:new Date().toISOString()};return identityCheck;
    }
    const hashFile=async path=>{try{const response=await read(path);const bytes=new Uint8Array(await response.arrayBuffer());return {path,bytes:bytes.length,sha256:await sha256Hex(bytes)};}catch(cause){return {path,error:cause.code||'read_failed',message:cause.message};}};
    const files=[];
    for(const row of manifest.extension?.files||[]){const seen=await hashFile(row.path);files.push({...seen,expected:row.sha256,ok:seen.sha256===row.sha256});}
    const app={};
    if(manifest.app?.entry){const seen=await hashFile(manifest.app.entry.path);app.entry={...seen,expected:manifest.app.entry.sha256,ok:seen.sha256===manifest.app.entry.sha256};}
    if(manifest.app?.releaseManifest){
      const seen=await hashFile(manifest.app.releaseManifest.path);let declared=null;
      try{declared=JSON.parse(await (await read(manifest.app.releaseManifest.path)).text()).buildId??null;}catch{}
      app.releaseManifest={...seen,expected:manifest.app.releaseManifest.sha256,buildId:declared,ok:seen.sha256===manifest.app.releaseManifest.sha256&&declared===manifest.buildId};
    }
    const current=context(),character=current.characters?.[current.characterId]??null;
    const lens=character?await cardLens(character):null;
    const card=lens?{character:character.avatar??null,lens,expected:manifest.card?.lens??null,ok:lensText(lens)===lensText(manifest.card?.lens),drift:lensDrift(lens,manifest.card?.lens),components:character.data?.extensions?.tavern_helper?.variables?.__cxx_update_state?.installed??null}:null;
    const mismatches=[...files.filter(row=>row.ok!==true).map(row=>row.path),...(app.entry?.ok===false?['app/index.html']:[]),...(app.releaseManifest?.ok===false?['app/release-manifest.json']:[]),...(card&&card.ok===false?['card/lens']:[])];
    identityCheck={status:mismatches.length?'mismatch':card?.ok===true?'ok':'partial',at:new Date().toISOString(),buildId:manifest.buildId,engineVersion:manifest.engineVersion,contentVersion:manifest.contentVersion,sourceHash:manifest.sourceHash,files,app,card,mismatches};
    return identityCheck;
  })().finally(()=>{identityFlight=null;});
  return identityFlight;
}
let openFlight=null;
/** 宿主重绘或玩家连点都会再调一次；同一时刻只留一个打开流程，后来者复用结果。 */
export async function openWeb(){
  if(openFlight)return openFlight;
  openFlight=openWebOnce().finally(()=>{openFlight=null;});
  return openFlight;
}
async function openWebOnce(){if(!appReady)throw error('host_loading','酒馆正在初始化，请等待首页就绪');if(document.querySelector('dialog[open],.TH-popup'))throw error('host_dialog_open','请先完成酒馆当前提示，再打开网页界面');await waitHostQuiet();closeWeb({refresh:false});bridge=createHostBridge();const own=bridge;try{await own.ready();const release=await globalThis.Cxx233Updater.pauseForStory();if(bridge!==own){release();throw error('host_changed','打开期间聊天已切换');}releaseStory=release;await bridge.read();globalThis.Cxx2051WebHost=bridge;globalThis.Cxx2051StProjection=createStProjection({context,assertScope:bridge.assertScope,writeTask:bridge.writeTask,fingerprint:nativeFingerprint,original:bridge.original});
  panel=document.createElement('div');panel.id='cxx2051-web-panel';panel.style.cssText='position:fixed;inset:0;z-index:9000;background:#0c0d13;display:flex;flex-direction:column';
  // Reuse the card's existing layer lease: native Gal/terminal popovers yield and restore together.
  releaseNativeViews=globalThis.__cxx_ui_layers__?.suspend({except:[panel]});
  const close=document.createElement('button');close.textContent='返回酒馆';close.style.cssText='align-self:flex-end;min-height:32px';close.onclick=()=>closeWeb();
  frame=document.createElement('iframe');frame.title='东京都2051';frame.src=new URL('./app/index.html?mode=tavern',import.meta.url).href;frame.style.cssText='border:0;flex:1;width:100%;min-height:0';panel.append(close,frame);document.body.append(panel);return bridge;}catch(cause){if(bridge===own)closeWeb({refresh:false});throw cause;}
}
const button=document.createElement('button');button.id='cxx2051-open-web';button.textContent='东京都2051 · 网页界面';button.disabled=true;button.className='menu_button';button.onclick=()=>openWeb().catch(e=>globalThis.toastr?.error(e.message));
(document.getElementById('extensions_settings2')||document.getElementById('extensions_settings')||document.body).append(button);
const ctx=context(),changed=()=>closeWeb({refresh:false});ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED,changed);
const ready=()=>{appReady=true;button.disabled=false;};ctx.eventSource.on(ctx.eventTypes.APP_READY,ready);
// 构建身份自检先跑一遍：打开网页之前就知道这份安装配的是哪一版 app 与角色卡。
globalThis.Cxx2051WebExtension={verify:verifyIdentity,get identity(){return identityCheck;}};
verifyIdentity().catch(()=>{});
export function disposeWebExtension(){closeWeb();ctx.eventSource.removeListener(ctx.eventTypes.APP_READY,ready);ctx.eventSource.removeListener(ctx.eventTypes.CHAT_CHANGED,changed);button.remove();}
globalThis.addEventListener('pagehide',changed,{once:true});
