(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxPlayerHost=api;})(globalThis,function(root){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):globalThis.CxxCrypto;
  const Art=typeof module==='object'&&module.exports?require('./item-art.js'):root.CxxItemArt;const copy=v=>structuredClone(v);
  const actors=()=>typeof module==='object'&&module.exports?require('./ensemble-state.js'):root.CxxEnsembleState;
  const same=(a,b)=>a===b||!!(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
  const failure=(code,message)=>Object.assign(Error(message),{code});
  // Player reads never acquire the installer lock or read the character card.
  const createReader=(typeof module==='object'&&module.exports?require('./player-reader.js'):root.CxxPlayerReader).create;
  function create({api=root,host,read,assertIdle=()=>{},waitForInstall,operations:O=root.CxxPlayerOperations,ui:UI=root.CxxPlayerUI,identities:I=root.CxxIdentity,saveTimeout=10000,openingReadyTimeout=10000}){
    const top=root.parent||root,ctx=()=>api.SillyTavern.getContext(),owner=ctx().characters?.[ctx().characterId]?.avatar;
    let stopped=false,epoch=0,state=null,refreshTimer=null,preparation=null,sendPreparation=null,sendPermit=null;
    const mounted=new Set(),subscribers=new Set(),disposers=[];
    const revisions=new WeakMap();let revisionId=0;
    const stamp=messages=>messages.map(m=>{let r=revisions.get(m);if(!r||r.raw!==m.mes||r.swipe!==(m.swipe_id||0)||r.user!==m.is_user){r={raw:m.mes,swipe:m.swipe_id||0,user:m.is_user,id:++revisionId};revisions.set(m,r);}return r.id;}).join(':');
    const scope=()=>{const c=ctx();return !stopped&&!c.groupId&&owner===c.characters?.[c.characterId]?.avatar&&c.getCurrentChatId()?JSON.stringify([owner,c.getCurrentChatId()]):'';};
    const identity=()=>api.getVariables({type:'chat'}).__cxx_identity;
    const actorStamp=()=>JSON.stringify(actors().selected(read.local().stat).binding);
    const isOpening=()=>!ctx().chat.some(m=>m.is_user);
    function idle(){assertIdle();if(!scope())throw Error('当前聊天不可用。');if(ctx().isGenerating||api.builtin?.duringGenerating?.())throw Error('请等待当前正文生成结束。');}
    function current(s){return !stopped&&s===state&&s.scope===scope()&&s.epoch===epoch;}
    function assertCurrent(s){if(!current(s))throw failure('context-changed','聊天已切换，原开局回调已停止。');}
    function getState(){
      const key=scope();if(!key)throw Error('当前聊天尚未就绪。');
      if(!state||state.scope!==key)state={scope:key,epoch,status:'idle',error:'',revision:0,savedRevision:0,queue:Promise.resolve(),flight:null,opening:null,signature:null,saved:null,needsSave:false};
      return state;
    }
    function saveState(){if(!state||!current(state))return {status:'idle',pending:false,error:''};return {status:state.status,pending:!!state.flight,error:state.error,revision:state.revision,savedRevision:state.savedRevision,timings:copy(state.timings||{})};}
    function publish(s,status,error=''){if(!current(s))return;s.status=status;s.error=error;for(const fn of subscribers)try{fn(saveState());}catch(e){console.error('[人物保存状态]',e);}}
    function subscribe(fn){subscribers.add(fn);fn(saveState());return()=>subscribers.delete(fn);}
    function localSignature(){const row=ctx().chat[0];return row?JSON.stringify([row.swipe_id||0,identity(),row.variables?.[row.swipe_id||0]?.stat_data?.terminal?.gameplay]):null;}
    
    async function writable(s){assertCurrent(s);if(typeof host.assertPlayerWritable!=='function')throw Error('请完整导入 2.1.4，人物保存接口尚未更新。');try{await host.assertPlayerWritable(read.location());}catch(error){if(error.code!=='migration-pending-install'||!waitForInstall)throw error;await waitForInstall();assertCurrent(s);await host.assertPlayerWritable(read.location());}assertCurrent(s);}
    // A timeout changes the notice, never releases an unfinished native request.
    // Short local mutations and slow persistence have separate queues.
    const Save=typeof module==='object'&&module.exports?require('./player-save.js'):root.CxxPlayerSave;
    const Refresh=typeof module==='object'&&module.exports?require('./player-refresh.js'):root.CxxPlayerRefresh;
    const QuestHost=typeof module==='object'&&module.exports?require('./quest-host.js'):root.CxxQuestHost;
    const notify=Refresh.create({top,views:mounted,context:()=>({character:owner,chat:ctx().getCurrentChatId()})}).publish;
    const {enqueue,dirty,flush,background,retrySave,waitForSaved}=Save.create({getState,assertCurrent,current,idle,writable,context:ctx,read,publish,notify,localSignature,saveTimeout,withChatSave:host.withChatSave?.bind(host)});
    const quests=QuestHost.create({context:ctx,scope,read,top,commit:commitRaw,saveTimeout});
    const commit=request=>request.action.startsWith('quest-')?quests.commit(request):commitRaw(request);
    function applyVariables(value,request,operation){
      const started=Date.now(),fresh=O.plan(value.stat_data,request,operation);if(state)state.timings={...(state.timings||{}),prepareMs:Date.now()-started};const guard=top.Cxx236VariableGuard;
      if(!guard?.validateProgram)throw Error('变量保存服务尚未就绪。');guard.validateProgram(value.stat_data,fresh,{engineOperation:operation});
      const applied=copy(value);applied.stat_data=fresh;
      if(request.action.startsWith('quest-'))(typeof module==='object'&&module.exports?require('./quests.js'):root.CxxQuests).extendSchema(applied.schema);
      const props=applied.schema?.properties?.terminal?.properties;if(props)props.gameplay={...(props.gameplay||{}),type:'object',extensible:true,recursiveExtensible:true,required:false};
      if(fresh.terminal?.ensemble)actors().extendSchema(applied.schema);
      return applied;
    }
    async function commitRaw(request,trace){
      request=copy(request);
      const A=actors(),requestedStat=read.local().stat,registered=requestedStat.terminal?.ensemble!==undefined;
      if(registered&&!A)throw Error('人物状态服务尚未就绪。');
      const actorBinding=registered?A.binding(requestedStat,request.actorId||(request.action==='initialize'?'player':A.registry(requestedStat).control.actorId)):undefined;
      const s=getState(),requestedBranch=stamp(ctx().chat);await enqueue(s,async()=>{
        await writable(s);if(stamp(ctx().chat)!==requestedBranch)throw Error('回复分支已变化，请从当前分支重新操作。');const snapshot=read.local(),branches=stamp(ctx().chat),floor=snapshot.floor,choice=copy(snapshot.growthIdentity),newChat=isOpening(),operation={request:copy(request),identity:choice,newChat};
        if(actorBinding){A.assertBinding(snapshot.stat,actorBinding);operation.actorBinding=copy(actorBinding);if(request.actorBinding&&!same(request.actorBinding,actorBinding))throw Error('人物操作草稿已过期，请重新打开当前人物。');}
        if(request.floor!==undefined&&(request.floor!==floor||request.swipe!==(ctx().chat[floor].swipe_id||0)))throw Error('结算目标楼层或分支已变化。');
        if(request.action==='profile-portrait'){
          if(request.storyContext&&!same(request.storyContext,snapshot.expected))throw Error('故事已切换，人物图片草稿已保留。');
          const P=typeof module==='object'&&module.exports?require('./story-profile.js'):root.CxxStoryProfile;
          if(!P)throw Error('故事人物服务未就绪。');
          const profile=P.withPortrait(snapshot.storyProfile,request),table=request.artAsset?await Art.merge(snapshot.itemArt,[request.artAsset]):snapshot.itemArt;
          assertCurrent(s);idle();if(stamp(ctx().chat)!==branches)throw Error('回复分支已变化，图片草稿已保留。');
          if(!same(ctx().chatMetadata[P.KEY],snapshot.storyProfile)||!same(ctx().chatMetadata[Art.key]||{schema:1,assets:{}},snapshot.itemArt))throw Error('人物或图片资源在保存前已变化，请重新核对后保存。');
          if(request.artAsset&&profile.portrait?.id!==request.artAsset.id)throw Error('人物图片与引用不匹配。');
          if(profile.portrait?.kind==='asset'&&!table.assets?.[profile.portrait.id])throw Error('人物图片资源缺失，请重新选择图片。');
          if(!same(profile,snapshot.storyProfile)||!same(table,snapshot.itemArt)){ctx().chatMetadata[Art.key]=table;ctx().chatMetadata[P.KEY]=profile;ctx().chatMetadata.tainted=true;dirty(s);}
          return;
        }
        if(request.action.startsWith('quest-')){trace?.stage('validating');Object.assign(operation,quests.authorize(request,snapshot));}
        top.__cxx_battle__?.assertOperation?.(request);
        if(request.action.startsWith('tactical-'))top.__cxx_tactical__?.assertOperation(request,snapshot);
        if(['tactical-start','tactical-scene-update'].includes(request.action))operation.tacticalScene=top.__cxx_tactical__?.authorizeScene(request.sceneId);
        if(request.action==='battle-roster')operation.battleRoster=top.__cxx_battle__?.authorizeRoster(request.rosterId);
        if(request.action==='battle-close'&&request.reason==='narrative_end')operation.battleClosure=top.__cxx_battle__?.authorizeClosure();
        if(request.action==='battle-start'&&(request.mode||'system')==='system'){
          const battle=top.__cxx_battle__;if(!battle?.authorizeEncounter)throw Error('战况识别服务尚未就绪。');
          // Resolve the scene receipt here, not from editable UI request data.
          // Repeated save attempts for an already-started battle stay idempotent.
          const c=(registered?A.selected(snapshot.stat,actorBinding.actorId).gameplay:snapshot.stat.terminal?.gameplay)?.numeric?.combat;
          if(!c?.active||c.id!==request.id)operation.battleEncounter=battle.authorizeEncounter(request.encounterId);
        }
        if(request.action==='initialize'&&!snapshot.stat.terminal?.gameplay?.growth&&snapshot.priorGrowth)throw Error('此前已有成长快照，请恢复已有存档，不按新号重建。');
        if(request.artAsset){const table=await Art.merge(ctx().chatMetadata?.[Art.key],[request.artAsset]);assertCurrent(s);if(stamp(ctx().chat)!==branches)throw Error('回复分支已变化，图片草稿已保留。');if(request.definition?.appearance?.id!==request.artAsset.id)throw Error('图片引用不匹配。');ctx().chatMetadata[Art.key]=table;}if(request.definition?.appearance?.kind==='asset'&&!ctx().chatMetadata?.[Art.key]?.assets?.[request.definition.appearance.id])throw Error('上传图片资源尚未保存，请重新选择或重试。');
        trace?.stage('applying');await api.updateVariablesWith(value=>{
          assertCurrent(s);idle();if(stamp(ctx().chat)!==branches||!same(identity(),choice))throw Error('聊天、分支或开局选择已变化，请重新操作。');
          let applied;try{applied=applyVariables(value,request,operation);}catch(error){error.diagnosticKind='rule-rejected';throw error;}
          if(trace){const before=value.stat_data.terminal||{},after=applied.stat_data.terminal||{};trace.stage('planned',{writes:['terminal.quests','terminal.questJournal','terminal.wallet'].filter(key=>!same(before[key.split('.').at(-1)],after[key.split('.').at(-1)])),revision:after.questJournal?.revision||0});trace.stage('applying');}
          return applied;
        },{type:'message',message_id:floor});assertCurrent(s);dirty(s);trace?.stage('applied');
      });return flush(s,{trace});
    }
    async function ensureReady(){const s=getState();if(s.flight||s.needsSave)return waitForSaved();const snapshot=read.local();if(!snapshot.stat.terminal?.gameplay?.growth||snapshot.stat.terminal.gameplay.numeric?.rulesRef?.version===1)return commit({action:'initialize'});if(snapshot.stat.terminal?.roster?.seedVersion!=='2051-npc-1')return commit({action:'roster-initialize'});return read({reuse:true});}
    async function waitOpeningRow(s){
      const deadline=Date.now()+openingReadyTimeout;
      while(current(s)){assertCurrent(s);idle();const row=ctx().chat[0];if(row)return row;
        if(Date.now()>=deadline)throw failure('opening-message-pending','新故事的开场消息尚未载入；草稿已保留，可重试创建。');
        await new Promise(resolve=>setTimeout(resolve,100));
      }throw failure('context-changed','聊天已切换，原开局回调已停止。');
    }
    // MVU registers its CHAT_CHANGED listener only after the first chat is initialized;
    // a chat created inside that window is never initialized. Re-apply the greeting
    // initvar once (MVU public API), and keep the fact in the failure report.
    function mvuApi(){try{return top.Mvu||null;}catch(error){return null;}}
    function guard236(){try{return top.Cxx236VariableGuard||null;}catch(error){return null;}}
    // 本地状态层（数据库表快照）——MVU 已被卡内解析器取代，开局就绪看这里，而不是宿主的 variables[].stat_data。
    function localState(){const g=guard236();try{return g&&typeof g.localState==='function'?g.localState():null;}catch(error){return null;}}
    function localRoot(row,target){const local=localState();if(local&&local.terminal)return local;
      const stat=row?.variables?.[target]?.stat_data;return stat&&stat.terminal?{terminal:stat.terminal}:null;}
    function initPending(row){return !localRoot(row,1)&&!row?.variables?.some(v=>v?.stat_data?.terminal);}
    async function reinitOpening(row,target){const mvu=mvuApi();
      if(mvu?.reloadInitVar){try{await mvu.reloadInitVar(mvu.getCurrentMvuData?.()||{});return "reloaded";}catch(error){return "reload-failed:"+String(error?.message||error);}}
      const g=guard236();if(!g||typeof g.settle!=='function')return "guard-missing";
      try{const r=await g.settle(row?.mes!==undefined?0:0);return r&&r.ok?"local-settled":"local-failed:"+String(r&&r.reason||"unknown");}catch(error){return "local-failed:"+String(error?.message||error);}}
    function openingReport(row,reinit,target){const list=Array.isArray(row?.variables)?row.variables:[];const ready=list.filter(v=>v?.stat_data?.terminal).length;const mvu=!!mvuApi();const local=localState();
      return "（Mvu 接口"+(mvu?"已加载":"未加载")+"；变量服务"+(guard236()?"已就绪":"未就绪")+"；本地状态 "+(local&&local.terminal?"已就绪":"未就绪")+"；已初始化分支 "+ready+"/"+list.length+" 条；本分支 "+(localRoot(row,target)?"有":"无")+"基础变量；消息 "+String(ctx().chat?.length??0)+" 条；补初始化 "+reinit+"）";}
    // MVU initializes every greeting and applies its static patches once.
    // Warm those existing variables, never fabricate another starting state.
    // 旧版存档（MVU 把整棵 stat_data 写进每个 swipe）不再接管：状态已改存数据库表，
// 旧档里的 variables[*].stat_data.terminal 只读不回写，避免同一项数值两处写。
function legacySave236(row){
  try{
    const list=Array.isArray(row&&row.variables)?row.variables:[];
    return list.some(item=>item&&item.stat_data&&item.stat_data.terminal);
  }catch(error){return false;}
}
function assertNotLegacy236(row){
  if(!legacySave236(row))return;
  const error=Error('这是旧版本存档（状态存在 MVU 变量里），新版本改用数据库保存，不能在本档继续写入；请新开一局，或用「旧版续玩导出」把进度搬到新档。');
  error.code='legacy-save-unsupported';
  throw error;
}
function prepareOpening(value,target=1){
      const s=getState();let row=ctx().chat[0];
      if(!Number.isInteger(target)||target<1||target>11||row&&!row.swipes?.[target])return Promise.reject(Error('请选择有效的剧情开场。'));
      if(preparation?.state===s&&preparation.row===row&&preparation.target===target)return preparation.promise;
      const p=(async()=>{if(!row)row=await waitOpeningRow(s);if(!row.swipes?.[target])throw Error('请选择有效的剧情开场。');await writable(s);const started=Date.now(),span=openingReadyTimeout>0?openingReadyTimeout:10000,deadline=started+span;let tries=0,reinit='idle';while(current(s)){
        const live=ctx().chat[0];if(live!==row||!isOpening())throw Error('开场已经变化，请重新操作。');
        const root=localRoot(live,target);
        if(root&&guard236()){if(value)O.plan(root,{action:'initialize'},{identity:{...value,setupToken:identity()?.setupToken||'preview'},newChat:true});return true;}
        const waited=Date.now()-started;
        if(tries<2&&waited>=(tries?span*0.4:span*0.15)&&initPending(live)){tries++;reinit=await reinitOpening(live,target);if(!current(s))break;continue;}
        if(Date.now()>=deadline)throw Error('开局状态尚未就绪，请稍后重试；当前配置已保留。'+openingReport(live,reinit,target));
        await new Promise(r=>setTimeout(r,100));
      }throw Error('聊天已切换。');})();preparation={state:s,row,target,promise:p};p.finally(()=>{if(preparation?.promise===p)preparation=null;}).catch(()=>{});return p;
    }
    function choiceFor(value){
      if(!value)return copy(identity());const next=I.snapshot(value.id,value.id==='custom'?value.background:'',value.growthSetup,value.loadoutSetup),prior=identity();
      const equal=I.valid(prior)&&same(next,I.snapshot(prior.id,prior.id==='custom'?prior.background:'',prior.growthSetup,prior.loadoutSetup));
      const built=ctx().chat[0]?.variables?.some(v=>v?.stat_data?.terminal?.gameplay?.growth);
      if(built&&!equal)throw Error('当前开局已经建档；请继续当前配置，或新建聊天重新选择。');
      next.setupToken=equal&&prior.setupToken?prior.setupToken:'start_'+CryptoCompat.uuid().replaceAll('-','');return equal?{...prior,...next}:next;
    }
    function completeOpening({value,resume=false,swipe,preferences,profile,openingText}={}){
      if(openingText!==undefined&&(typeof openingText!=='string'||!openingText.trim()||openingText.length>50000||openingText.includes('\0')||swipe!==1))return Promise.reject(Error('第一幕正文或开场分支无效。'));
      if(preferences&&(!['high','medium','low'].includes(preferences.level)||!['auto','mobile','desktop'].includes(preferences.device)||typeof preferences.gal!=='boolean'||preferences.mirror!==undefined&&typeof preferences.mirror!=='boolean'||preferences.nsfw!==undefined&&typeof preferences.nsfw!=='boolean'||preferences.nsfwChosen!==undefined&&typeof preferences.nsfwChosen!=='boolean'||preferences.battleMode!==undefined&&!['fast','text','tactical'].includes(preferences.battleMode)))return Promise.reject(Error('显示设置无效。'));
      const s=getState(),targetRequested=swipe??(resume?(ctx().chat[0]?.swipe_id||0):1),requestKey=JSON.stringify([targetRequested,value||null,preferences||null,profile||null,openingText??null]);
      if(s.opening){if(s.openingKey===requestKey)return s.opening;return s.opening.then(()=>{assertCurrent(s);return completeOpening({value,swipe:targetRequested,preferences,profile,openingText});});}
      s.openingKey=requestKey;
      const work=enqueue(s,async()=>{
        if(!isOpening())throw Error('正文已经开始，不能重新切换开场。');
        const waitingPersona=ctx().name1,waitingRow=await waitOpeningRow(s),waitingSwipe=waitingRow.swipe_id||0;
        await prepareOpening(value,targetRequested);await writable(s);idle();assertCurrent(s);
        if(ctx().chat[0]!==waitingRow||(waitingRow.swipe_id||0)!==waitingSwipe||ctx().name1!==waitingPersona)throw Error('开场或人设已变化，配置已保留，请重新确认。');
        const uploads=(value?.loadoutSetup?.items||[]).map(r=>r.artUpload).filter(Boolean);if(uploads.length){const table=await Art.merge(ctx().chatMetadata?.[Art.key],uploads);assertCurrent(s);if(ctx().chat[0]!==waitingRow||(waitingRow.swipe_id||0)!==waitingSwipe)throw Error('开场分支已变化。');ctx().chatMetadata[Art.key]=table;}const clean=value?copy(value):value;for(const row of clean?.loadoutSetup?.items||[])delete row.artUpload;const choice=choiceFor(clean);if(!choice?.growthSetup||!choice.setupToken)throw Error('请先确认开局配置。');
        if(preferences){choice.openingScenario=targetRequested;if(openingText!==undefined)choice.openingKind='written';else delete choice.openingKind;}
        const row=ctx().chat[0],from=row.swipe_id||0,target=swipe??(resume?from:1);
        if(!Number.isInteger(target)||target<1||target>(resume?23:11)||!row.swipes?.[target])throw Error('请选择有效的剧情开场。');
        const base=copy(row.variables?.[target]);if(!base?.stat_data?.terminal)throw Error('此开场的 MVU 基础变量尚未就绪，请稍后重试。');
        if(profile){if(!root.CxxStoryProfile)throw Error('故事人物服务未就绪。');dirty(s);await root.CxxStoryProfile.bind(top,{...profile,origin:{id:choice.id,name:choice.name,background:choice.background}},{art:Art,assertCurrent:()=>assertCurrent(s)});assertCurrent(s);}if(from===target&&s.signature===localSignature()&&base.stat_data.terminal.gameplay?.growth&&(openingText===undefined||row.mes===openingText))return read.local();
        const request={action:'initialize'},operation={request,identity:choice,newChat:true,startGame:copy(row.variables?.[from]?.stat_data?.terminal?.gameplay)};
        const applied=applyVariables(base,request,operation);
        if(!same(identity(),choice)||preferences)await api.updateVariablesWith(v=>{assertCurrent(s);if(ctx().chat[0]!==row||(row.swipe_id||0)!==from)throw Error('开场分支已变化。');const next={...v,__cxx_identity:choice};if(preferences){next.__cxx_ui_preferences={...v.__cxx_ui_preferences,schemaVersion:1,effects:preferences.level,device:preferences.device,...(preferences.mirror===undefined?{}:{mirror:preferences.mirror,mirrorGuidePending:preferences.mirror===true}),...(preferences.nsfw===undefined?{}:{nsfw:preferences.nsfw}),...(preferences.nsfwChosen===undefined?{}:{nsfwChosen:preferences.nsfwChosen}),...(preferences.battleMode===undefined?{}:{battleMode:preferences.battleMode}),setupVersion:1,completed:true};next.__cxx_gal_mode={...v.__cxx_gal_mode,schemaVersion:1,enabled:preferences.gal};}return next;},{type:'chat'});
        assertCurrent(s);if(ctx().chat[0]!==row||(row.swipe_id||0)!==from||!same(row.variables[target],base))throw Error('开场分支已变化，请重新操作。');
        const data=Array.from({length:row.swipes.length},(_,i)=>i===target?applied:copy(row.variables?.[i]||{}));
        // affected: ST refreshOneMessage / TT refreshManagedChatSurface.
        // A committed opening is no longer an untouched greeting. ST uses this flag
        // to avoid rebuilding the first message on persona changes.
        if(ctx().chatMetadata)ctx().chatMetadata.tainted=true;
        dirty(s);await api.setChatMessages([{message_id:0,swipe_id:target,swipes_data:data,...(openingText!==undefined?{swipes:row.swipes.map((text,i)=>i===target?openingText:text)}:{})}],{refresh:'affected'});
        assertCurrent(s);s.signature=localSignature();const result=read.local();notify(result);return result;
      });
      s.opening=work.finally(()=>{s.opening=null;if(current(s)&&s.needsSave)background(s);});s.opening.catch(()=>{});return s.opening;
    }
    async function setOpeningMessages(messages,options){
      if(messages.length===1&&messages[0].message_id===0&&Number.isInteger(messages[0].swipe_id)&&messages[0].swipe_id>=1&&messages[0].swipe_id<=23&&Object.keys(messages[0]).every(k=>['message_id','swipe_id'].includes(k))&&identity()?.setupToken)return completeOpening({swipe:messages[0].swipe_id});
      return api.setChatMessages(messages,options);
    }
    function openingSaved(){
      if(top.Cxx236OpeningHost?.hasUnconfirmed())return false;
      if(!scope()||!identity()?.setupToken||!isOpening())return true;
      const s=getState();return s.status==='saved'&&s.savedRevision===s.revision&&s.signature===localSignature();
    }
    function assertOpeningSaved(){
      if(openingSaved())return true;
      const s=getState();if(s.status==='idle')recover();
      throw failure('player-save-unconfirmed',s.status==='error'?'开局保存失败；草稿已保留，请在开场页重试保存。':s.status==='timeout'?'开局保存响应较慢；草稿已保留，请等待原请求完成。':'开局正在保存；草稿已保留，保存完成后即可发送。');
    }
    function prepareSend(dispatch,{type='normal'}={}){
      const field=top.document?.querySelector('#send_textarea'),draft=field?.value||'',key=scope(),branches=stamp(ctx().chat),actor=actorStamp();
      if(sendPreparation&&sendPreparation.scope===key&&sendPreparation.branches===branches&&sendPreparation.actor===actor&&sendPreparation.draft===draft&&sendPreparation.type===type)return sendPreparation.promise;
      if(sendPreparation)top.__cxx_battle__?.cancelPreparation?.();
      const intent={scope:key,branches,actor,draft,type,promise:null};sendPreparation=intent;
      intent.promise=(async()=>{
        const s=getState();if(s.flight||s.needsSave)await waitForSaved();
        await top.__cxx_battle__?.preflight?.({type,draft});
        await top.__cxx_tactical__?.prepare(type,true);
        if(sendPreparation!==intent||scope()!==key||stamp(ctx().chat)!==branches||actorStamp()!==actor||(field?.value||'')!==draft)throw failure('player-send-cancelled','聊天、人物、分支或草稿已变化，输入已保留。');
        sendPermit={scope:key,branches,actor,draft,type};try{return dispatch();}finally{sendPermit=null;}
      })().finally(()=>{if(sendPreparation===intent)sendPreparation=null;});return intent.promise;
    }
    function requestSend(dispatch,options={}){
      const ready=()=>prepareSend(dispatch,options);
      if(top.Cxx236OpeningHost?.hasUnconfirmed())return top.Cxx236OpeningHost.requestSend(ready);
      if(openingSaved())return ready();
      const s=getState(),input=top.document?.querySelector('#send_textarea');
      if(s.status==='error')return Promise.reject(failure('player-save-unconfirmed','开局保存失败；草稿已保留，请先重试保存。'));
      if(s.sendIntent&&!s.sendIntent.cancelled)return s.sendIntent.promise;
      const intent={branches:stamp(ctx().chat),draft:input?.value||'',cancelled:false};s.sendIntent=intent;
      intent.promise=(s.flight||flush(s,{verifyOnly:!s.needsSave})).then(()=>{
        assertCurrent(s);
        if(intent.cancelled||stamp(ctx().chat)!==intent.branches||(input?.value||'')!==intent.draft)throw failure('player-send-cancelled','聊天、分支或草稿已变化，已取消待发送操作。');
        assertOpeningSaved();s.sendIntent=null;return ready();
      }).finally(()=>{if(s.sendIntent===intent)s.sendIntent=null;});
      return intent.promise;
    }
    function mountSaveStatus(doc,parent=doc.body){
      const el=doc.createElement('aside');el.className='cxx-opening-save cxx-feedback-theme';el.setAttribute('role','status');const sheet=doc.createElement('style');sheet.textContent=globalThis.CxxFeedbackStyle||'';
      const text=doc.createElement('span'),retry=doc.createElement('button');retry.type='button';retry.textContent='重试保存';retry.onclick=()=>{void retrySave().catch(()=>{});};el.append(sheet,text,retry);parent.prepend(el);
      const off=subscribe(s=>{el.style.display=s.status==='idle'||!identity()?.setupToken?'none':'flex';text.textContent=s.status==='saved'?'开局已保存':s.status==='error'?'保存失败：'+s.error:s.status==='timeout'?s.error:'开局保存中，可以继续选择剧情；首次发送前需完成保存。';retry.hidden=s.status!=='error';});
      return()=>{off();el.remove();};
    }
    function draft(text){const input=top.document.querySelector('#send_textarea');if(!input)throw Error('聊天输入框暂不可用。');input.value=(input.value.trim()?input.value+'\n':'')+text;input.dispatchEvent(new top.Event('input',{bubbles:true}));return '已加入聊天草稿，发送后由正文继续。';}
    function mount(parent,tab='人物',options={}){
      if(tab==='战斗'&&top.__cxx_tactical__&&!actors().selected(read.local().stat).gameplay?.numeric?.combat?.active)return top.__cxx_tactical__.mount(parent);
      const entry=UI.mount({document:parent.ownerDocument,parent,tab,...options,read:async()=>{const s=getState();if(s.flight||s.needsSave)return waitForSaved();const local=read.local();if(local.stat.terminal?.gameplay?.numeric?.rulesRef?.version===1)return commit({action:'initialize'});return local;},commit,draft});mounted.add(entry);const destroy=entry.destroy;
      const Observer=parent.ownerDocument.defaultView?.MutationObserver;const observer=Observer?new Observer(()=>{if(!parent.isConnected)entry.destroy();}):null;observer?.observe(parent.ownerDocument.documentElement,{childList:true,subtree:true});
      entry.destroy=()=>{observer?.disconnect();mounted.delete(entry);destroy();};return entry;
    }
    function close(){const terminal=top.Cxx233Terminal;if(['characters','operations'].includes(terminal?.frame?.contentWindow?.CxxTerminalApp?.page))terminal.close();}
    function open(tab='人物'){
      const terminal=top.Cxx233Terminal;if(!terminal?.openPage)throw Error('终端尚未就绪，请稍后再试。');
      if(tab==='行动记录')return terminal.openPage('operations');
      const target=({'人物资料':'人物','出身开场':'人物','装备':'物品栏','库存':'物品栏'})[tab]||tab;
      return terminal.openPage('characters',target);
    }
    function start(){
      top.__cxx_player__?.stop?.();top.__cxx_player__=service;top.CxxIdentity=I;
      const on=(name,fn)=>{if(!name||!api.eventOn)return;api.eventOn(name,fn);disposers.push(()=>api.eventRemoveListener(name,fn));};
      on(api.tavern_events?.CHAT_CHANGED,()=>{epoch++;state=null;preparation=null;sendPreparation=null;sendPermit=null;top.__cxx_battle__?.cancelPreparation?.();close();for(const v of [...mounted])v.destroy();recover();});
      on(api.tavern_events?.CHARACTER_MESSAGE_RENDERED,()=>recover());
      for(const name of [api.tavern_events?.MESSAGE_SWIPED,api.tavern_events?.GENERATION_ENDED,'mag_variable_update_ended'])on(name,()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{notify();recover();},100);});
      // Capture before Generate: the host's event emitter swallows exceptions.
      const doc=top.document,block=e=>{if(e.isComposing||e.keyCode===229)return;const target=e.target;
        const editing=target?.closest?.('.edit_textarea,.reasoning_edit_textarea,dialog');
        const send=e.type==='click'?target?.closest?.('#send_but,#option_continue,#mes_continue,#option_regenerate,.swipe_right'):!editing&&e.key==='Enter'&&(e.ctrlKey||e.metaKey||target?.id==='send_textarea'&&!e.shiftKey&&!e.altKey);
        if(!send)return;
        const type=send?.matches?.('.swipe_right')?'swipe':send?.matches?.('#option_regenerate')||(e.ctrlKey||e.metaKey)&&!doc.querySelector('#send_textarea')?.value.trim()?'regenerate':send?.matches?.('#option_continue,#mes_continue')?'continue':'normal';
        if(type==='swipe'){const row=ctx().chat.at(-1);if((row?.swipe_id||0)+1<(row?.swipes?.length||0))return;}
        const permitted=sendPermit&&sendPermit.scope===scope()&&sendPermit.branches===stamp(ctx().chat)&&sendPermit.actor===actorStamp()&&sendPermit.draft===(doc.querySelector('#send_textarea')?.value||'')&&sendPermit.type===type;if(permitted){sendPermit=null;return;}
        let battle=false;try{const g=actors().selected(read.local().stat,top.CxxContext?.generationBinding?.(type)?.actorId).gameplay,c=g?.numeric?.combat;battle=!!(c?.manual&&c.active&&!c.paused)||!!g?.tactical?.enabled||!!top.__cxx_battle__?.state?.().received;}catch{}
        if(openingSaved()&&!battle)return;
        e.preventDefault();e.stopImmediatePropagation();
        const button=e.type==='click'?send:doc.querySelector((e.ctrlKey||e.metaKey)&&!doc.querySelector('#send_textarea')?.value.trim()?'#option_regenerate':'#send_but');
        requestSend(()=>{if(!button?.isConnected)throw Error('发送入口已关闭，草稿已保留。');button.click();},{type}).catch(error=>top.toastr?.warning(error.message,'发送前检查'));
      };
      const edit=e=>{if(e.target?.id!=='send_textarea')return;if(state?.sendIntent&&e.target.value!==state.sendIntent.draft)state.sendIntent.cancelled=true;if(sendPreparation&&e.target.value!==sendPreparation.draft){sendPreparation=null;top.__cxx_battle__?.cancelPreparation?.();}};
      if(doc?.addEventListener){doc.addEventListener('click',block,true);doc.addEventListener('keydown',block,true);doc.addEventListener('input',edit,true);disposers.push(()=>{doc.removeEventListener('click',block,true);doc.removeEventListener('keydown',block,true);doc.removeEventListener('input',edit,true);});}
      recover();
    }
    function recover(){
      if(stopped||!scope()||!isOpening()||!identity()?.setupToken)return;
      const s=getState(),swipe=ctx().chat[0]?.swipe_id||0;if(s.opening||s.signature===localSignature()&&s.status!=='idle')return;
      // Resume a previously saved identity left on the configuration branch by
      // an interrupted older submission; reuse its token and original choices.
      if(swipe===24){if(!top.CxxOpeningFlow)void completeOpening({swipe:1}).catch(e=>publish(s,'error',e.message));return;}
      if(swipe>=1&&swipe<=23){
        const game=ctx().chat[0]?.variables?.[swipe]?.stat_data?.terminal?.gameplay;
        if(game?.growth){s.signature=localSignature();s.revision++;publish(s,'saving');background(s,{verifyOnly:true});}
        else if(!top.CxxOpeningFlow)void completeOpening({resume:true}).catch(e=>publish(s,'error',e.message));
      }
    }
    function stop(){quests.destroy();stopped=true;epoch++;sendPreparation=null;sendPermit=null;top.__cxx_battle__?.cancelPreparation?.();clearTimeout(refreshTimer);close();for(const v of [...mounted])v.destroy();subscribers.clear();disposers.splice(0).forEach(fn=>fn());if(top.__cxx_player__===service)delete top.__cxx_player__;}
    const service={menuStatus(){const snapshot=read.local(),L=typeof module==='object'&&module.exports?require('./loadout.js'):root.CxxLoadout;return {load:L.list(actors().selected(snapshot.stat).gameplay||{}).filter(r=>r.definition.category==='cyberware').reduce((sum,r)=>sum+(Number(r.definition.load)||0),0)};},read:ensureReady,commit,quests,prepareOpening,completeOpening,setOpeningMessages,saveState,subscribeSave:subscribe,retrySave,waitForSaved,assertOpeningSaved,requestSend,mountSaveStatus,mount,open,close,start,stop,draft};return service;
  }
  return {create,createReader};
});

