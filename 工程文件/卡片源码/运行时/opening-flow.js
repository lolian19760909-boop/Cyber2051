/* One chat owns one draft and one final submission. Views never write game state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxOpeningFlow=api;})(globalThis,function(){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const copy=structuredClone,steps=['origin','profile','growth','loadout','scenario','review'];
  const directOrigins={'origin-street':'street','origin-corpo':'corpo','origin-student':'student','custom-opening':null};
  const isDirect=id=>Object.hasOwn(directOrigins,id),validScenario=id=>Number.isInteger(id)&&id>=2&&id<=11||isDirect(id);
  function create({key,scope,resumeDraft,creationId,identity:I,loadout:L,readIdentity,readPreferences,readProfile=()=>null,readOpening=()=>'',storage,prepare,submit,verify,send,recover,inspect,openRecovery,rescue,onPreview=()=>{},onFailure=()=>{},onComplete=()=>{}}){
    const legacyKey='cxx-opening-draft:'+key,indexKey=scope?'cxx-opening-draft:v2:'+JSON.stringify([scope.instanceId,key]):legacyKey,listeners=new Set();let storageKey=indexKey,restoreChoice=null;
    let ended=false,flight=null,dispatched=false,locked=false,restored=false,creationStarted=!!(resumeDraft||creationId);
    const saved=readIdentity(),prefs=readPreferences();
    let draft={schema:1,creationId:creationId||globalThis.crypto?.randomUUID?.()||'create-'+Date.now()+'-'+Math.random().toString(36).slice(2),step:'origin',completed:[],profile:readProfile(),origin:'street',custom:'',openingText:'',growth:{},loadouts:{},preferences:{level:prefs.level,device:prefs.device,gal:prefs.gal,mirror:prefs.complete?prefs.mirror!==false:false,nsfw:prefs.nsfw===true,nsfwChosen:prefs.nsfwChosen===true,battleMode:['fast','text','tactical'].includes(prefs.battleMode)?prefs.battleMode:'fast'},scenario:null,scenarioState:{},pendingCommand:null};
    const valid=d=>d&&[1,2].includes(d.schema)&&(steps.includes(d.step)||d.step==='settings')&&['street','corpo','student','custom'].includes(d.origin);
    function adopt(cached){draft={...draft,...copy(cached),schema:2,preferences:{...draft.preferences,...cached.preferences},growth:cached.growth||{},loadouts:cached.loadouts||{},scenarioState:cached.scenarioState||{}};if(draft.step==='settings')draft.step='origin';if(cached.schema===1){draft.completed=['origin'];draft.step='profile';}if(draft.scenario!==null&&!validScenario(draft.scenario)){draft.scenario=null;draft.pendingCommand=null;draft.step='scenario';}dispatched=!!draft.dispatchStarted;restored=true;}
    try{let cached;if(scope){const id=JSON.parse(storage?.getItem(indexKey)||'null');cached=typeof id==='string'?JSON.parse(storage?.getItem(indexKey+':'+id)||'null'):null;if(cached?.owner?.instanceId!==scope.instanceId)cached=null;if(!cached)cached=JSON.parse(storage?.getItem(legacyKey)||'null');}else cached=JSON.parse(storage?.getItem(storageKey)||'null');if(valid(resumeDraft)&&(!creationId||resumeDraft.creationId===creationId)){adopt(resumeDraft);}else if(valid(cached)){if(creationId&&cached.creationId===creationId)adopt(cached);else if(scope)restoreChoice={draft:cached,legacy:cached.owner?.instanceId!==scope.instanceId||!!creationId};else adopt(cached);}}catch{}
    if(scope)storageKey=indexKey+':'+draft.creationId;
    draft.schema=2;draft.owner=scope?copy(scope):draft.owner;
    draft.completed=steps.filter((s,i)=>i<5&&Array.isArray(draft.completed)&&steps.slice(0,i+1).every(k=>draft.completed.includes(k)));
    if(steps.indexOf(draft.step)>draft.completed.length)draft.step=steps[draft.completed.length];
    if(I.valid(saved)&&!restored){draft.origin=saved.id;draft.custom=saved.id==='custom'?saved.background:'';if(saved.growthSetup)draft.growth[saved.id]=copy(saved.growthSetup);if(saved.loadoutSetup)draft.loadouts[saved.id]=copy(saved.loadoutSetup);}
    if(I.valid(saved)&&saved.setupToken){
      locked=true;draft.origin=saved.id;draft.custom=saved.id==='custom'?saved.background:'';
      if(saved.growthSetup)draft.growth[saved.id]=copy(saved.growthSetup);
      if(saved.loadoutSetup)draft.loadouts[saved.id]=copy(saved.loadoutSetup);
      draft.step='scenario';draft.completed=steps.slice(0,4);
    }
    let status='editing',error='',lastError=null,guidance=null,guidanceRevision=0;
    const stats={draftChanges:0,submissions:0,sends:0};
    const state=()=>({draft:copy(draft),status,error,lastError:lastError?copy(lastError):null,guidance:guidance?copy(guidance):null,locked,busy:!!flight,restoreChoice:restoreChoice?{legacy:restoreChoice.legacy,name:restoreChoice.draft.profile?.name||'未命名人物'}:null,stats:{...stats}});
    function notify(){for(const fn of listeners)fn(state());}
    function cache(required=false){try{if(!storage?.setItem)throw Error('草稿存储不可用');storage.setItem(storageKey,JSON.stringify(draft));if(scope)storage.setItem(indexKey,JSON.stringify(draft.creationId));return true;}catch(e){error='草稿保存失败：'+(e.message||String(e))+'。内容仍在当前页面，请重试。';if(required)throw Error(error);return false;}}
    function clearCache(){storage?.removeItem(storageKey);if(scope)storage?.removeItem(indexKey);}
    function active(){if(ended)throw Error('聊天已切换，原开场操作已停止。');}
    function editable(){active();if(restoreChoice)throw Error('请先选择继续草稿或重新填写。');if(flight||status==='saved'||status==='saving'||status==='error'&&locked)throw Error('请先完成或重试当前开局保存。');}
    function growth(){return draft.growth[draft.origin]||(draft.growth[draft.origin]=I.initialSetup(draft.origin));}
    function choice(){return I.snapshot(draft.origin,draft.custom,growth(),draft.loadouts[draft.origin]||{});}
    function inputHint(message,step,field,label){throw Object.assign(Error(message),{code:'opening-input',guidance:{step,field,label}});}
    function validate(step){
      if(steps.indexOf(step)>=1){
        if(draft.profile&&!String(draft.profile.name||'').trim())inputHint('请在基本资料填写人物姓名。','profile','name','姓名');
        if(draft.origin==='custom')I.snapshot(draft.origin,draft.custom);
      }
      if(steps.indexOf(step)>=2)I.normalizeSetup(draft.origin,growth());
      if(steps.indexOf(step)>=3)choice();
      if(steps.indexOf(step)>=4&&isDirect(draft.scenario))directText();
    }
    function directText(){const id=draft.scenario;if(!isDirect(id))return undefined;if(directOrigins[id]&&directOrigins[id]!==draft.origin)inputHint('请选择与你当前出身对应的开场。','scenario','','出身开场');const text=id==='custom-opening'?draft.openingText:readOpening(id);if(typeof text!=='string'||!text.trim())inputHint('请先写好第一幕正文。','scenario','openingText','第一幕正文');if(text.length>50000||text.includes('\0'))inputHint('第一幕请使用不超过50,000字的正文，并去除空字符。','scenario','openingText','第一幕正文');return text;}
    function invalidate(step){draft.completed=draft.completed.slice(0,steps.indexOf(step));draft.pendingCommand=null;}
    function change(fn){editable();fn(draft);stats.draftChanges++;error='';lastError=null;guidance=null;cache();notify();}
    function patch(fields){change(d=>{if(fields.profile&&!locked){d.profile={...d.profile,...copy(fields.profile)};invalidate('profile');}if(fields.preferences)d.preferences={...d.preferences,...fields.preferences};if(fields.openingText!==undefined){d.openingText=fields.openingText;invalidate('scenario');}if(fields.custom!==undefined&&!locked){d.custom=fields.custom;invalidate('profile');}if(fields.growth&&!locked){d.growth[d.origin]=copy(fields.growth);invalidate('growth');}if(fields.loadout&&!locked){d.loadouts[d.origin]=copy(fields.loadout);invalidate('loadout');}});if(fields.preferences)onPreview(copy(draft.preferences));}
    function chooseOrigin(id){if(!['street','corpo','student','custom'].includes(id))throw Error('身份编号无效。');if(locked)throw Error('已有开局配置，继续选择剧情即可。');change(d=>{if(d.origin!==id)invalidate('origin');d.origin=id;growth();});}
    function canGo(step){return !restoreChoice&&steps.includes(step)&&steps.indexOf(step)<=draft.completed.length&&(!locked||['scenario','review'].includes(step));}
    function go(step){editable();if(!canGo(step))throw Error('请先保存并完成前面的步骤。');change(d=>{d.step=step;});if(step==='growth')void Promise.resolve(prepare()).catch(markError);}
    function advance(command){editable();const i=steps.indexOf(draft.step);if(i>=5)throw Error('请在确认页开始游戏。');if(i>draft.completed.length)throw Error('请先保存并完成前面的步骤。');validate(draft.step);if(i===4&&!draft.scenario)inputHint('请先选择想体验的剧情。','scenario','','剧情');const prior={step:draft.step,completed:[...draft.completed],pendingCommand:draft.pendingCommand};draft.completed=steps.slice(0,i+1);draft.step=steps[i+1];if(i===4)draft.pendingCommand=command??null;try{cache(true);}catch(e){Object.assign(draft,prior);notify();throw e;}error='';lastError=null;guidance=null;notify();if(draft.step==='growth')void Promise.resolve(prepare()).catch(markError);}
    function selectScenario(id){if(id!==null&&!validScenario(id))throw Error('剧情编号无效。');if(isDirect(id)&&directOrigins[id]&&directOrigins[id]!==draft.origin)throw Error('请选择与你当前出身对应的开场。');if(!canGo('scenario'))throw Error('请先保存初始装备。');change(d=>{d.scenario=id;invalidate('scenario');});}
    function rememberScenario(id,value){if(ended||flight||status==='saved')return;draft.scenarioState[id]=copy(value);cache();}
    function commit(command=null){
      active();if(flight)return flight;if(status==='saved')return Promise.resolve();
      if(draft.step!=='review'||draft.completed.length<5)throw Error('请逐步保存开局配置，再确认开始。');validate('scenario');if(!validScenario(draft.scenario))inputHint('请先选择想体验的剧情。','scenario','','剧情');
      if(command!==null&&(typeof command!=='string'||!command.startsWith('/send ')||!command.endsWith('|/trigger')))throw Error('开场发送内容无效。');
      if(status!=='error')draft.pendingCommand=isDirect(draft.scenario)?null:command;
      const selection=choice(),openingText=directText(),target=isDirect(draft.scenario)?1:draft.scenario,preferences=copy(draft.preferences),profile=copy(draft.profile);
      cache(true);status='saving';error='';lastError=null;guidance=null;locked=true;creationStarted=true;
      flight=Promise.resolve().then(async()=>{
        active();stats.submissions++;await submit({value:selection,swipe:target,...(openingText!==undefined?{openingText}:{}),preferences,profile,creationId:draft.creationId,draft:copy(draft)});active();await verify();active();
        // Only retry saving. Never automatically resend a command whose dispatch began.
        status='saved';notify();
        if(draft.pendingCommand&&!dispatched){draft.dispatchStarted=true;cache(true);dispatched=true;stats.sends++;await send(draft.pendingCommand);}
        try{clearCache();}catch{}onComplete({preferences});
      }).catch(e=>{if(!ended){lastError={message:e.message||String(e),code:e.code||'opening-save-failed',detail:e.stack||'',...(e.details?{saveCheck:copy(e.details)}:{}),creationId:draft.creationId};try{onFailure(e);}catch{}error=e.message||'开局保存失败。';if(status!=='saved')status='error';else error='开局已保存；发送未确认，请检查聊天后手动继续。';notify();}throw e;}).finally(()=>{flight=null;if(!ended)notify();});
      notify();return flight;
    }
    function markError(e){
      if(ended)return;error=e.message||String(e);const target=e.code==='opening-input'?e.guidance:e.code==='identity-setup-input'?{step:'growth',field:e.field,label:e.label}:e.code==='identity-background-input'?{step:'profile',field:'custom',label:'自定义出身背景'}:null;
      guidance=!locked&&!flight&&target&&canGo(target.step)?{...target,revision:++guidanceRevision}:null;
      if(guidance){lastError=null;draft.step=guidance.step;if(!cache())guidance=null;}else lastError={message:error,code:e.code||'opening-action-failed',detail:e.stack||'',...(e.details?{saveCheck:copy(e.details)}:{}),creationId:draft.creationId};notify();
    }
    return {state,patch,chooseOrigin,go,canGo,markError,next:()=>advance(),selectScenario,rememberScenario,review(command=null){if(draft.step!=='scenario')throw Error('请先进入乐队与开局。');advance(command);},commit,retry:()=>commit(draft.pendingCommand),choice,wait:()=>flight||Promise.reject(Error('请先确认开局配置。')),
      resolveDraft(use){active();if(!restoreChoice)return;const old=restoreChoice,oldKey=indexKey+':'+old.draft.creationId;if(use){const freshId=draft.creationId;adopt(old.draft);if(old.legacy){draft.creationId=freshId;draft.dispatchStarted=false;dispatched=false;draft.completed=['origin'];draft.step='profile';}draft.owner=copy(scope);storageKey=indexKey+':'+draft.creationId;draft.completed=steps.filter((s,i)=>i<5&&steps.slice(0,i+1).every(k=>draft.completed?.includes(k)));if(steps.indexOf(draft.step)>draft.completed.length)draft.step=steps[draft.completed.length];}cache(true);if(!use&&!old.legacy)storage?.removeItem(oldKey);restoreChoice=null;notify();},
      inspect:()=>inspect?inspect():Promise.resolve({code:'creation-unavailable',action:'rescue',message:'尚未取得创建记录，请打开救援与导出查看详细诊断。'}),
      openRecovery:id=>openRecovery?.(id),rescue:()=>rescue?.(),
      async recover(){active();if(flight)throw Error('当前操作仍在执行。');if(!recover)throw Error('恢复服务未就绪，请打开更新与存档。');const result=await recover({creationId:draft.creationId,slot:draft.owner?.slot});active();if(result.action==='retry'&&draft.step==='review'){await commit(draft.pendingCommand);return {code:'creation-complete',action:'none',message:'人物与故事已保存。'};}error=result.message||'';notify();return result;},
      subscribe(fn){listeners.add(fn);fn(state());return()=>listeners.delete(fn);},
      restoreScenario(id){return copy(draft.scenarioState[id]||{});},
      discard(){editable();if(locked||creationStarted)throw Error('此档位已开始创建，请返回选档继续创建；删除故事使用酒馆聊天管理。');clearCache();ended=true;listeners.clear();},
      destroy(){ended=true;listeners.clear();},get key(){return key;}};
  }
  return {create,steps,isDirect};
});
