/* 变量服务：不再把执行权交给远端 MVU bundle。
 * 两条路径：
 *  A. 兼容期（检测到宿主里还有 Mvu）：只校验 MVU 解析出来的批次与最终状态，不替它执行——
 *     这是 2.3.26 的行为，保留给迁移窗口与既有回归。
 *  B. 本地结算（没有 Mvu，或 dataStore 已切到 on）：卡内用 Gal/parser.js 抽 <UpdateVariable> 的
 *     JSONPatch，本地校验层（MVU/schema.js + 数据/validator.js）出事务，数据/applier.js 执行并落库。
 *  两条路径共用 schema/policy/诊断，变量权威位置都是数据库表；A 路径是过渡，不是目标态。
 */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.Cxx236Variables=value;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const events={initialized:'mag_variable_initialized',started:'mag_variable_update_started',parsed:'mag_command_parsed',ended:'mag_variable_update_ended',before:'mag_before_message_update'};
 const Parser=typeof module==='object'&&module.exports?require('../Gal/parser.js'):globalThis.CxxGalParser;
 const Applier=()=>typeof module==='object'&&module.exports?require('../数据/applier.js'):globalThis.Cxx236Applier;
 function normalizeResponse(text){
  if(typeof text!=='string')return text;
  const decoded=Parser.variableUpdates(text);
  return decoded.found&&!decoded.issues.length?'<UpdateVariable><JSONPatch>'+JSON.stringify(decoded.patches)+'</JSONPatch></UpdateVariable>':text;
 }
 const copy=v=>structuredClone(v),normal=s=>String(s||'').replace(/\r\n/g,'\n').replace(/<StatusPlaceHolderImpl\/>/g,'').trim();
 function create({api,win,runtime,schema,buildSchema,policy,reader,mirror=false}){
  let ended=false,epoch=0,scope=runtime.key(),lastError='',legacyIssues=[],pending=new WeakMap(),notices=new Set();const disposers=[],receipts=new Map(),completedNative=new Map();let receiptSequence=0,saveTimer=null,saveRead=null;
  const context=()=>api.SillyTavern.getContext(),branches=()=>JSON.stringify(context().chat.map(m=>[m.is_user===true,m.swipe_id||0]));
  const current=tx=>!ended&&tx.scope===runtime.key()&&tx.epoch===epoch&&(tx.branches===undefined||tx.branches===branches());
  let startupTimer=null,engine=null,stateComplete=false;
  const policyOf=()=>{try{return (typeof policy==='function'?policy():policy)||{};}catch{return {};}};
  function mvuReady(){const mvu=win.Mvu||api.Mvu;return typeof mvu?.parseMessage==='function'&&mvu.events?.COMMAND_PARSED===events.parsed&&mvu.events?.VARIABLE_UPDATE_ENDED===events.ended;}
  // 本地结算只要求「解析器 + 校验层」，与 MVU 是否加载无关。
  function localReady(){return !!schema&&typeof Parser?.variableUpdates==='function';}
  function ready(){return !!schema&&(mvuReady()||localReady());}
  function dependencyError(){
   if(!schema)return '变量校验库 Zod 尚未就绪。';
   return mvuReady()?'变量校验库 Zod 尚未就绪。':'变量校验库与本地解析器尚未就绪，请检查本卡脚本。';
  }
  const on=(name,fn)=>{api.eventOn(name,fn);disposers.push(()=>api.eventRemoveListener(name,fn));};
  const rowId=row=>row?.cxx_context?.messageId||row?.cxx_plot_id||null;
  const rawAt=floor=>{const value=win.CxxSource?.peek?.(floor);return String(value?.ok?value.sourceMessage:context().chat[floor]?.mes||'');};
  const textKey=text=>{let hash=2166136261;for(const ch of normal(text))hash=Math.imul(hash^ch.charCodeAt(0),16777619);return (hash>>>0).toString(16)+':'+normal(text).length;};
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  const stateKey=value=>textKey(JSON.stringify(ordered(value)));
  const webChat=()=>[1,2].includes(context().chatMetadata?.cxx2051_web?.schema)&&!!context().chatMetadata.cxx2051_web.run;
  const floorValue=row=>Array.isArray(row?.variables)?row.variables[row.swipe_id||0]:row?.variables;
  function nativeCommit(floor,row,raw=rawAt(floor),checkState=true){
    const value=floorValue(row),r=value?.__cxx_native_commit,own=row?.swipe_info?.[row.swipe_id||0]?.extra?.cxx2051_native_receipt??row?.extra?.cxx2051_native_receipt;
    return r?.schema===1&&r.scope===runtime.key()&&r.floor===floor&&r.swipe===(row?.swipe_id||0)&&r.receipt===own&&r.fingerprint===textKey(raw)&&(!checkState||r.stateFingerprint===stateKey(value?.stat_data))?r:null;
  }
  function rememberNative(floor,row,raw,root,receipt,before,patches,complete=true){
    const value={ok:true,complete,scope:runtime.key(),floor,swipe:row.swipe_id||0,fingerprint:textKey(raw),root:copy(root),receipt,source:'native-applier',beforeFingerprint:stateKey(before),patches:copy(patches||[])};
    const control=before?.terminal?.ensemble?.control;if(control?.actorId&&control.viewpointActorId)try{const actors=typeof module==='object'&&module.exports?require('../运行时/ensemble-state.js'):win.CxxEnsembleState||globalThis.CxxEnsembleState;value.actorBinding={...actors.binding(before,control.actorId),viewpointActorId:control.viewpointActorId};}catch{}
    completedNative.set(floor,value);while(completedNative.size>32)completedNative.delete(completedNative.keys().next().value);return value;
  }
  function captureNativeState(options={}){
    const messages=context().chat,floor=Number.isInteger(options)?options:Number.isInteger(options.floor)?options.floor:messages.findLastIndex(row=>!row.is_user&&!row.is_system),row=messages[floor];if(!row||row.is_user||row.is_system)return {ok:false,reason:'当前没有已完成正文。'};
    const raw=String(win.CxxSource?.sync?.(floor)??rawAt(floor)),r=nativeCommit(floor,row,raw),cached=completedNative.get(floor);
    if(r)return {ok:true,complete:true,scope:r.scope,floor,swipe:r.swipe,fingerprint:r.fingerprint,root:copy(floorValue(row).stat_data),receipt:r.receipt,source:'native-floor',beforeFingerprint:r.beforeFingerprint,patches:copy(r.patches||[]),...(r.actorBinding?{actorBinding:copy(r.actorBinding)}:{})};
    if(cached?.complete&&cached.scope===runtime.key()&&cached.swipe===(row.swipe_id||0)&&cached.fingerprint===textKey(raw))return copy(cached);
    const v=floorValue(row),owned=webCommit(row,v);if(owned?.fingerprint===textKey(raw)&&v.stat_data)return {ok:true,complete:true,scope:runtime.key(),floor,swipe:row.swipe_id||0,fingerprint:textKey(raw),root:copy(v.stat_data),receipt:owned.operationId,source:'web-floor'};
    return {ok:false,reason:'本楼没有可验证的完整结算状态；数据库表投影不代替完整状态。'};
  }
  async function persistNative(floor,row,raw,value,container){
    const expectedScope=runtime.key(),swipe=row.swipe_id||0,current=()=>!ended&&runtime.key()===expectedScope&&context().chat[floor]===row&&(row.swipe_id||0)===swipe&&textKey(String(win.CxxSource?.sync?.(floor)??row.mes))===value.fingerprint;
    const cached=completedNative.get(floor);if(cached?.receipt===value.receipt)cached.savePending=true;
    const save=async()=>{
      if(!current())throw Error('聊天或正文分支已变化，旧楼层快照未写入。');
      const vars=copy(container||floorValue(row)||{});delete vars.__cxx_web_commit;vars.stat_data=copy(value.root);vars.__cxx_native_commit={schema:1,scope:expectedScope,floor,swipe,fingerprint:value.fingerprint,receipt:value.receipt,stateFingerprint:stateKey(value.root),beforeFingerprint:value.beforeFingerprint,patches:copy(value.patches||[])};
      if(value.actorBinding)vars.__cxx_native_commit.actorBinding=copy(value.actorBinding);
      if(container){delete container.__cxx_web_commit;container.stat_data=copy(vars.stat_data);container.__cxx_native_commit=copy(vars.__cxx_native_commit);}
      row.variables||=[];if(Array.isArray(row.variables))row.variables[swipe]=vars;else row.variables=vars;row.variables_initialized||=[];row.variables_initialized[swipe]=true;
      row.extra={...row.extra,cxx2051_native_receipt:value.receipt};if(row.swipe_info?.[swipe])row.swipe_info[swipe].extra={...row.swipe_info[swipe].extra,cxx2051_native_receipt:value.receipt};
      if(typeof context().saveChat!=='function')throw Error('酒馆原生保存接口尚未就绪。');await context().saveChat();if(!current())throw Error('保存期间聊天已变化，请重新打开当前故事。');
    };
    const host=win.Cxx233Updater?.host;let owner;try{owner=JSON.parse(expectedScope);}catch{}
    if(host?.withChatSave&&Array.isArray(owner)&&owner.length===2)await host.withChatSave({characterKey:owner[0],chatId:owner[1]},save);else await save();if(cached?.receipt===value.receipt)cached.savePending=false;
  }
  function matches(r,floor,raw=rawAt(floor)){const row=context().chat[floor];
    if(!r||r.scope!==runtime.key()||r.floor!==floor||r.swipe!==(row?.swipe_id||0)||(r.messageId?rowId(row)!==r.messageId:row!==r.row)||r.raw!==normal(raw))return false;
    const hostRaw=normal(row?.mes);if(r.hostRaw!==hostRaw){
      // The reading service validates the current row, swipe and stored text.
      // A new presentation of the same canonical story is not a new MVU batch.
      const source=win.CxxSource?.peek?.(floor);if(!source?.ok||normal(source.sourceMessage)!==r.raw)return false;
      r.hostRaw=hostRaw;r.hostFingerprint=textKey(row?.mes);
    }return true;
  }
  function publicReceipt(r){if(!r)return null;const {row,raw,hostRaw,expected,...value}=r;return copy(value);}
  function receiptAt(floor=context().chat.length-1){const r=receipts.get(floor);return matches(r,floor)?r:null;}
  function verifySaved(r,attempt=0){
    clearTimeout(saveTimer);saveTimer=null;
    const content=api.CxxContent||win.CxxContent;if(!content?.savedEventMedia||ended||receiptAt(r.floor)!==r||r.phase!=='applied')return;
    saveTimer=setTimeout(async()=>{saveTimer=null;if(ended||receiptAt(r.floor)!==r||r.phase!=='applied')return;
      const controller=new AbortController();saveRead=controller;
      try{await content.savedEventMedia({receipt:true,signal:controller.signal});}catch{}finally{if(saveRead===controller)saveRead=null;}
      if(!ended&&receiptAt(r.floor)===r&&r.phase==='applied'&&attempt<3)verifySaved(r,attempt+1);
    },[250,1000,3000,8000][attempt]);
  }
  function record(tx,phase,message=''){
    if(!tx.receipt||!current(tx))return;
    if(phase==='parsed'){clearTimeout(saveTimer);saveTimer=null;saveRead?.abort();saveRead=null;}
    const r=tx.receipt;r.phase=phase;r.message=message;r.revision=++receiptSequence;
    receipts.set(r.floor,r);while(receipts.size>16)receipts.delete(receipts.keys().next().value);
    runtime.scheduleMessages?.(r.floor,false,'mvu-receipt');
    if(phase==='applied')verifySaved(r);
  }
  function confirmSaved(saved){
    const floor=saved?.floor,r=receiptAt(floor),row=saved?.messages?.[floor];
    if(!r||r.phase!=='applied'||!row||saved.messages.length-1!==floor||(row.swipe_id||0)!==r.swipe||normal(row.mes)!==r.hostRaw||rowId(row)&&rowId(row)!==r.messageId)return false;
    if(saved.expected&&JSON.stringify([saved.expected.characterKey,saved.expected.chatId])!==r.scope)return false;
    const get=(v,path)=>path.slice(1).split('/').map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~')).reduce((v,k)=>v?.[k],v);
    if(!r.expected?.every(p=>JSON.stringify(get(saved.stat,p.path))===JSON.stringify(p.value)))return false;
    delete r.expected;r.phase='saved';r.message='变量已保存并核对。';r.revision=++receiptSequence;
    // Resolve only the repaired floor/branch after its actual disk readback.
    // Keep other failed turns and the original diagnostic history available.
    let owner;try{owner=JSON.parse(r.scope);}catch{}
    if(Array.isArray(owner)&&owner.length===2)win.CxxDiagnostics?.resolve?.(issue=>{
      const c=issue.context||{};if(c.character!==owner[0]||c.chat!==owner[1])return false;
      return issue.module==='MVU'&&issue.stage==='变量结算'&&c.floor===floor&&c.branch===r.swipe
        ||!lastError&&issue.module==='MVU 变量'&&issue.stage==='自动检查';
    });
    runtime.scheduleMessages?.(floor,false,'mvu-receipt');return true;
  }
  function inputIssues(patches){
    const issues=[];for(const patch of patches){if(!/(?:numericInput|rosterInput)$/.test(patch.path)||!Array.isArray(patch.value))continue;
      patch.value.forEach((event,index)=>{if(event?.kind!=='achievement')return;const label=patch.path+'['+index+']'+(event.id?' ('+event.id+')':'');
        if(!event.source||typeof event.source!=='object'||Array.isArray(event.source))issues.push(label+'.source 需要 {kind,id} 对象，不能只写来源字符串。');
        else {if(!['story','training','activity','quest'].includes(event.source.kind))issues.push(label+'.source.kind 只接受 story、training、activity、quest。');if(typeof event.source.id!=='string'||!event.source.id.trim())issues.push(label+'.source.id 需要稳定的成果编号。');}
        if(!['small','stage','gig','major'].includes(event.category))issues.push(label+'.category 只接受 small、stage、gig、major；请按实际成果选择，不自动替换含义。');
        if(event.completed!==true)issues.push(label+'.completed 必须为 true，未完成的计划不结算。');
        if(typeof event.reason!=='string'||!event.reason.trim())issues.push(label+'.reason 需要本轮已完成成果的正文依据。');
      });
    }return issues;
  }
  function report(message){lastError=message;win.CxxDiagnostics?.report({module:"MVU",stage:"变量结算",message});if(notices.has(message))return;notices.add(message);win.toastr?.warning(message,'变量更新未保存');}
  function restore(target,before){for(const key of Object.keys(target))delete target[key];Object.assign(target,copy(before));}
  function inspect(){if(!schema)return;const c=context();let data;for(let i=c.chat.length-1;i>=0;i--){data=c.chat[i].variables?.[c.chat[i].swipe_id||0]?.stat_data;if(data)break;}legacyIssues=data?schema.audit(data):[];if(legacyIssues.length){const text=legacyIssues.slice(0,2).map(x=>x.path).join('、');if(!notices.has('legacy')){notices.add('legacy');win.toastr?.info('旧存档有需检查的值：'+text+'。其他合法字段仍可更新。','变量检查');}}}
  function newOpening(){const c=context();return c.chat.length===1&&!c.chat[0]?.is_user&&!c.chat.some(m=>m.is_user&&!m.is_system);}
  on(events.initialized,(data,swipe)=>{
   if(ended||!runtime.key())return;
   if(!schema)throw Error('变量校验库 Zod 尚未就绪，初始化保护未生效。');
   const issues=schema.audit(data.stat_data);if(issues.length&&newOpening())throw Error('新聊天变量初始化不合规：'+issues[0].path);
  });
  function inheritTactical(stat,tactical){
   if(!tactical?.game?.tactical)return false;
   const actorId=tactical.actorId===undefined?'player':tactical.actorId,A=typeof module==='object'&&module.exports?require('../运行时/ensemble-state.js'):win.CxxEnsembleState||globalThis.CxxEnsembleState;
   let game;
   if(stat?.terminal?.ensemble){if(!A)throw Error('人物状态服务尚未就绪。');game=A.address(stat,actorId).gameplayPath.reduce((value,key)=>value?.[key],stat);}
   else if(actorId==='player')game=stat?.terminal?.gameplay;
   else throw Error('战术行动所属人物尚未登记，不能写入原玩家。');
   if(!game)throw Error('战术行动所属人物的记录尚未就绪。');
   for(const k of ['growth','numeric','inventory','equipment','itemDefinitions','itemReceipts','loadout','tactical'])if(tactical.game[k]!==undefined)game[k]=copy(tactical.game[k]);
   if(game.tactical.encounter)game.tactical.encounter.source=copy(tactical.source);
   return true;
  }
  on(events.started,async data=>{if(ended||!runtime.key())return;if(win.CxxSource)await win.CxxSource.prime();const protectedTactical=inheritTactical(data.stat_data,win.__cxx_tactical__?.narrativeBase?.()),before=copy(data);if(before.stat_data)delete before.stat_data.$internal;pending.set(data,{scope:runtime.key(),epoch,branches:branches(),before,transaction:null,rejected:null,protectedTactical});});
  on(events.parsed,async(data,commands,source)=>{
   const tx=pending.get(data);if(!tx)return;
   try{
    if(win.CxxSource)await win.CxxSource.prime();
    if(!current(tx))throw Error('聊天已切换，旧变量回调已停止。');
    if(!ready())throw Error(dependencyError());
    const floor=context().chat.length-1,row=context().chat[floor],raw=rawAt(floor);
    tx.receipt={scope:runtime.key(),floor,swipe:row?.swipe_id||0,messageId:rowId(row),row,raw:normal(raw),fingerprint:textKey(raw),hostRaw:normal(row?.mes),hostFingerprint:textKey(row?.mes),phase:'parsed',revision:0};record(tx,'parsed','正在解析变量更新。');
    if(!Parser?.variableUpdates)throw Error('变量解析器尚未就绪。');
    if(/_\.(?:set|add|insert|assign|remove|unset|delete)\s*\(/.test(source))throw Error('变量命令须使用 JSONPatch 数组；本卡不执行脚本式变量命令。');
    const decoded=Parser.variableUpdates(source);if(decoded.issues.length)throw Error(decoded.issues.join('；'));
    if(!decoded.found){commands.length=0;tx.skipped=true;record(tx,'missing','本轮未提供可执行的变量更新。');return;}
    const patches=decoded.patches,issues=inputIssues(patches);if(issues.length)throw Error(issues.slice(0,8).join('；'));
    const options={...policyOf()},messages=context().chat,last=messages.at(-1);
    if(last&&!last.is_user&&String(last.mes||'').trim()){
      const raw=String(win.CxxSource?win.CxxSource.sync(messages.length-1):last.mes),story=normal(options.plot?options.plot.story(raw):raw.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gi,''));
      let hash=2166136261;for(const ch of JSON.stringify([runtime.key(),messages.length-1,last.swipe_id||0,story]))hash=Math.imul(hash^ch.charCodeAt(0),16777619);
      let storyHash=2166136261;for(const ch of story)storyHash=Math.imul(storyHash^ch.charCodeAt(0),16777619);
      options.numericOptions={...options.numericOptions,rawStory:raw,storyText:story,factBatch:'story_'+(hash>>>0).toString(16),source:{floor:messages.length-1,swipe:last.swipe_id||0,story:(storyHash>>>0).toString(16)}};
      // A floor is only a position. Keep the message identity when earlier rows
      // are removed; MVU may run before the context service registers this reply.
      const identity=last.cxx_context?.messageId||last.cxx_plot_id;
      if(!identity)last.cxx_plot_id=(typeof module==='object'&&module.exports?require('../运行时/crypto-compat.js'):globalThis.CxxCrypto).uuid();
      options.numericOptions.source.messageId=identity||last.cxx_plot_id;
      if(tx.receipt)tx.receipt.messageId=options.numericOptions.source.messageId;
      const variant=last.extra?.cxx_context;
      if(variant?.messageId===options.numericOptions.source.messageId&&variant.variantId)options.numericOptions.source.variantId=variant.variantId;
      const battleRound=win.__cxx_battle__?.pendingFor?.(options.numericOptions.source);
      if(battleRound)options.numericOptions.battleRound=battleRound;
      const tacticalBase=win.__cxx_tactical__?.narrativeBase?.();
      if(tacticalBase)options.numericOptions.tacticalBase=tacticalBase;
    }
    tx.transaction=schema.prepare(patches,tx.before.stat_data,options);win.CxxDiagnostics?.report({module:"MVU",stage:"指令解析",level:"info",message:"接收 "+patches.length+" 项变量更新",detail:JSON.stringify(patches)});
    if(tx.transaction.ignored?.length)win.CxxDiagnostics?.report({module:'MVU',stage:'旧字段兼容',level:'info',message:'已跳过 '+tx.transaction.ignored.length+' 项停用的关系数值指令'});
    if(tx.transaction.policy.civicTransaction)(typeof module==='object'&&module.exports?require('../运行时/civic.js'):win.CxxCivic||globalThis.CxxCivic).extendSchema(data.schema);
    if(tx.transaction.policy.questTransaction)(typeof module==='object'&&module.exports?require('../运行时/quests.js'):win.CxxQuests||globalThis.CxxQuests).extendSchema(data.schema);
    if(tx.before.stat_data?.terminal?.ensemble||tx.transaction.policy.numericTransaction?.roster)(typeof module==='object'&&module.exports?require('../运行时/ensemble-state.js'):win.CxxEnsembleState||globalThis.CxxEnsembleState).extendSchema(data.schema);
    if(schema.commands)commands.splice(0,commands.length,...schema.commands(tx.transaction.patches));
    else {for(let i=commands.length-1;i>=0;i--)if(!tx.transaction.patches.some(p=>p.path===patches[i].path))commands.splice(i,1);for(let i=0;i<commands.length;i++)commands[i].args[commands[i].args.length-1]=JSON.stringify(tx.transaction.patches[i].value);}
   }catch(e){tx.rejected=e.message;commands.length=0;record(tx,'rejected',e.message);report(e.message);}
  });
  async function finish(data,before,final=false){const tx=pending.get(data);if(!tx)return;
   if(!current(tx)){restore(data,before||tx.before);pending.delete(data);throw Error('聊天已切换，旧变量回调已停止。');}
   if(!tx.rejected)try{if(tx.transaction)schema.check(tx.transaction,tx.before.stat_data,data.stat_data);}catch(e){tx.rejected=e.message;record(tx,'rejected',e.message);report(e.message);}
   if(tx.rejected)restore(data,tx.protectedTactical?tx.before:before||tx.before);else {lastError='';if(final&&!tx.skipped)win.CxxDiagnostics?.report({module:'MVU',stage:'结算完成',level:'info',message:'变量批次已结算',detail:JSON.stringify(win.CxxDiagnostics.difference?.(tx.before.stat_data,data.stat_data)||tx.transaction?.patches||[])});}
   if(final&&!tx.rejected&&!tx.skipped){if(tx.receipt){tx.receipt.expected=copy(tx.transaction?.patches||[]);
     const actorId=data.stat_data?.terminal?.ensemble?.control?.actorId||'player',growth=stat=>actorId==='player'?stat?.terminal?.gameplay?.growth:stat?.terminal?.ensemble?.actors?.[actorId]?.gameplay?.growth,beforeRewards=growth(tx.before.stat_data)?.rewards||{},afterRewards=growth(data.stat_data)?.rewards||{};
     tx.receipt.growth={actorId,rewardIds:Object.keys(afterRewards).filter(id=>afterRewards[id]?.award&&!Object.hasOwn(beforeRewards,id))};
    }record(tx,'applied','变量已应用，保存待核对。');
    const floor=tx.receipt?.floor,row=context().chat[floor];if(row&&!row.is_user){const raw=rawAt(floor),captured=rememberNative(floor,row,raw,data.stat_data,localReceipt(floor,row,raw),tx.before.stat_data,tx.transaction?.patches);if(webChat())try{await persistNative(floor,row,raw,captured,data);}catch(error){report('完整楼层快照保存待恢复：'+error.message);}}
   }
   if(final){tx.finished=true;legacyIssues=schema?schema.audit(data.stat_data):[];}
  }
  on(events.ended,(data,before)=>finish(data,before));
  on(events.ended+'_for_zod',(data,before)=>finish(data,before,true));
  on(events.before,payload=>{const tx=pending.get(payload.variables);if(tx&&!current(tx))throw Error('聊天已切换，旧变量回调已停止。');if(tx?.receipt&&typeof payload.message_content==='string'){const r=tx.receipt;if(r.raw===r.hostRaw){r.raw=normal(payload.message_content);r.fingerprint=textKey(payload.message_content);}r.hostRaw=normal(payload.message_content);r.hostFingerprint=textKey(payload.message_content);}});
  function changed(){const next=runtime.key();if(next===scope)return;scope=next;epoch++;clearTimeout(saveTimer);saveTimer=null;saveRead?.abort();saveRead=null;receipts.clear();completedNative.clear();notices=new Set();legacyIssues=[];lastError='';if(next)inspect();}
  const chatChanged=context().eventTypes?.CHAT_CHANGED;if(chatChanged)on(chatChanged,changed);

  /* ── 本地结算路径（B）：卡内自己执行，MVU 缺席时也完整可用 ────────────── */
  const readOf=()=>reader||win.CxxDataRead||api.CxxDataRead||null;
  function engineOf(){
    if(engine)return engine;
    const A=Applier();if(!A||typeof A.create!=='function')return null;
    const nativeSync=win.CxxDataSync||api.CxxDataSync;
    const sync=nativeSync&&typeof nativeSync.push==='function'?{push(root,turn){if(webChat()){const push=nativeSync.pushAll||nativeSync.push;return push.call(nativeSync,root.terminal,turn);}return nativeSync.push(root,turn);}}:nativeSync;
    engine=A.create({schema,parser:Parser,reader:readOf(),notify:report,report,policy:policyOf(),write:win.CxxDataWrite||api.CxxDataWrite,sync});
    return engine;
  }
  /** 当前权威状态：优先读模型快照，退化到旧 stat_data（迁移期只做兜底，不写）。 */
  function webCommit(row,value){const marker=value?.__cxx_web_commit,identity=row?.swipe_info?.[row.swipe_id||0]?.extra?.cxx2051_node||row?.extra?.cxx2051_node;return marker?.owner==='web'&&identity===marker.nodeId?marker:null;}
  function localState(){
    stateComplete=false;
    // PromptTemplate can copy variables to a new, still-unsettled reply. Only completed floors own
    // their full state; a table display projection must not erase the rest of that state on continuation.
    if(webChat())try{const messages=context().chat;for(let i=messages.length-1;i>=0;i--){const row=messages[i];if(row.is_user||row.is_system)continue;const raw=String(win.CxxSource?.sync?.(i)??rawAt(i)),v=floorValue(row);if(nativeCommit(i,row,raw,false)&&v.stat_data?.terminal){stateComplete=true;return copy(v.stat_data);}const owned=webCommit(row,v);if(owned?.fingerprint===textKey(raw)&&v.stat_data){stateComplete=true;return copy(v.stat_data);}}}catch{}
    // A web-owned selected swipe carries the native authoritative state. Old table projections may lag.
    try{const c=context();for(let i=c.chat.length-1;i>=0;i--){const row=c.chat[i],v=row?.variables?.[row.swipe_id||0];if(webCommit(row,v)&&v.stat_data){stateComplete=true;return copy(v.stat_data);}if(v?.stat_data)break;}}catch{}
    try{const snap=readOf()?.snapshot?.({});if(snap&&snap.ok!==false&&snap.terminal)return copy(snap);}catch{}
    try{const c=context();for(let i=c.chat.length-1;i>=0;i--){const data=c.chat[i]?.variables?.[c.chat[i].swipe_id||0]?.stat_data;if(data)return copy(data);}}catch{}
    return null;
  }
  function localReceipt(floor,row,raw){return [runtime.key(),floor,row?.swipe_id||0,textKey(raw)].join('|');}
  function recordLocal(floor,row,raw,result){
    const r={scope:runtime.key(),floor,swipe:row?.swipe_id||0,messageId:rowId(row),raw:normal(raw),fingerprint:textKey(raw),hostRaw:normal(row?.mes),hostFingerprint:textKey(row?.mes),phase:result.ok?'applied':result.status==='skipped'?'missing':'rejected',message:result.reason||'',revision:++receiptSequence,patches:copy(result.patches||[]),persisted:!!result.persisted};
    receipts.set(floor,r);while(receipts.size>16)receipts.delete(receipts.keys().next().value);
    runtime.scheduleMessages?.(floor,false,'mvu-receipt');
    return r;
  }
  /** 开局：全聊天没有任何状态，且当前层是第一条正文——允许从空根起步，别处一律不接管。 */
  function openingFloor(floor){
    try{
      const messages=context().chat;
      if(messages.some(m=>m?.variables?.[m.swipe_id||0]?.stat_data))return false;
      const first=messages.findIndex(m=>!m.is_user);
      return first>=0&&floor===first;
    }catch{return false;}
  }
  /** 本地结算一层楼：抽块 → 校验 → 执行 → 落库。返回结论，不抛到界面。 */
  async function settle(index){
    if(ended)return {ok:false,status:'ended',reason:'变量服务已停止。'};
    if(!schema)return {ok:false,status:'failed',reason:dependencyError()};
    const runner=engineOf();if(!runner)return {ok:false,status:'failed',reason:'变量应用器尚未就绪。'};
    const messages=context().chat,floor=Number.isInteger(index)?index:messages.length-1,row=messages[floor];
    if(!row||row.is_user)return {ok:false,status:'skipped',reason:'该楼层不是正文消息。'};
    const raw=String(win.CxxSource?.sync?.(floor)??row.mes??'');
    // The independent web controller already validated and committed this selected swipe.
    // Rendering/reloading it must not apply the same model patch a second time.
    const owned=webCommit(row,row.variables?.[row.swipe_id||0]);
    if(owned?.schema===1&&owned.owner==='web'&&owned.operationId&&owned.nodeId){
      if(owned.fingerprint===textKey(raw))return {ok:true,status:'duplicate',persisted:true,reason:'网页回合已提交。'};
      return {ok:false,status:'web-edited',reason:'网页提交正文已被编辑，请在网页界面重新校验；原状态保留。'};
    }
    // Program actions may legitimately change this floor's state after its story settled. Its own
    // source receipt still prevents replaying the story; an inherited receipt never matches this row.
    if(nativeCommit(floor,row,raw,false)&&!completedNative.get(floor)?.savePending)return {ok:true,status:'duplicate',persisted:true,reason:'原生回合已结算。'};
    let state=localState(),complete=stateComplete;
    if(!state&&openingFloor(floor)){const empty=Applier()?.emptyRoot?.();if(empty?.terminal){state={terminal:copy(empty.terminal)};complete=true;}}
    if(webChat()&&!complete)return {ok:false,status:'snapshot-pending',reason:'此网页聊天缺少可验证的完整父状态，未用数据库显示投影继续结算。'};
    let result;
    try{
      result=await runner.apply(raw,{state,policy:policyOf(),receipt:localReceipt(floor,row,raw),turn:floor,kind:'variable',recoverSync:webChat()});
    }catch(error){result={ok:false,status:'failed',reason:error&&error.message?error.message:String(error)};}
    if(result.ok&&result.root)rememberNative(floor,row,raw,result.root,result.receipt||localReceipt(floor,row,raw),state,result.patches,complete);
    if(result.ok&&webChat()){
      const captured=captureNativeState({floor});if(!captured.ok||!captured.complete)result={...result,ok:false,status:'snapshot-pending',reason:captured.reason||'此楼没有完整父状态，未把显示投影保存为完整快照。'};
      else try{await persistNative(floor,row,raw,captured);}catch(error){result={...result,ok:false,status:'snapshot-pending',reason:'原生表已结算，完整楼层快照保存待恢复：'+error.message};}
    }
    recordLocal(floor,row,raw,result);
    if(result.ok){lastError='';}else if(result.status!=='skipped'&&result.status!=='duplicate'){report(result.reason);}
    // 迁移期可选双写：宿主仍在渲染 stat_data 时把新状态镜像回去，权威位置仍是表。
    if(result.ok&&mirror&&result.root){
      try{const stat=row.variables?.[row.swipe_id||0]?.stat_data;if(stat)restore(stat,result.root);}catch{}
    }
    return result;
  }
  const floorOf=payload=>typeof payload==='number'?payload:Number.isInteger(payload?.index)?payload.index:Number.isInteger(payload?.messageIndex)?payload.messageIndex:undefined;
  function watchLocal(){
    const types=context().eventTypes||{};
    for(const name of [types.MESSAGE_RECEIVED,types.CHARACTER_MESSAGE_RENDERED,types.GENERATION_ENDED].filter(Boolean)){
      if(watchers.has(name))continue;watchers.add(name);
      on(name,payload=>{if(ended||mvuReady())return;return settle(floorOf(payload));});
    }
  }
  const watchers=new Set();

  function initialized(){if(ended)return;if(!schema&&buildSchema)try{schema=buildSchema();}catch{}if(ready()){clearTimeout(startupTimer);startupTimer=null;lastError='';inspect();watchLocal();}}
  on('global_Mvu_initialized',initialized);
  initialized();if(!ready())startupTimer=setTimeout(()=>{startupTimer=null;initialized();if(!ready()&&!ended)report(dependencyError());},10000);
  return {normalizeResponse,settle,localState,captureNativeState,state:(options={})=>({ready:ready(),mode:mvuReady()?'mvu':'local',local:localReady(),loading:startupTimer!==null,scope,lastError,legacyIssues:copy(legacyIssues),receipt:publicReceipt(receiptAt(options.floor)),receiptSequence}),confirmSaved,questDefinition:(id,record)=>policyOf().questDefinition(id,record),validateProgram(before,after,options){if(!schema)throw Error('变量校验库 Zod 尚未就绪。');return schema.program(before,after,options);},destroy(){if(ended)return;ended=true;epoch++;clearTimeout(startupTimer);startupTimer=null;disposers.splice(0).forEach(fn=>fn());pending=new WeakMap();notices.clear();receipts.clear();completedNative.clear();watchers.clear();clearTimeout(saveTimer);saveTimer=null;saveRead?.abort();saveRead=null;engine?.destroy?.();engine=null;}};
 }
 return {create,events,normalizeResponse};
});
