// Explicit message-floor adapter for the isolated candidate. No whole-table replacement.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxTerminalHost=api;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const hash=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
 function create(deps){
  let epoch=0,serial=0;const branches=new WeakMap(),changed=()=>{epoch++;};
  const branchOf=m=>{let old=branches.get(m);if(!old||old.raw!==m.mes||old.swipe!==(m.swipe_id||0)||old.user!==m.is_user||old.hidden!==m.is_system){old={raw:m.mes,swipe:m.swipe_id||0,user:m.is_user,hidden:m.is_system,id:++serial};branches.set(m,old);}return old.id;};
  function context(){try{return deps.getContext?.()||null;}catch{return null;}}
  const initialContext=context(),owner=initialContext?.characters?.[initialContext.characterId]?.avatar;
  function readState(){
   const c=context(),chatId=c?.getCurrentChatId?.(),avatar=c?.characters?.[c.characterId]?.avatar;
   const eligible=c?avatar===owner&&!c.groupId:owner===undefined;
   const scope=eligible&&chatId&&avatar?JSON.stringify([avatar,'',chatId]):null;
   let floor=-1,sourceFloor=-1,statData=null;
   try{floor=deps.getLastMessageId?.()??-1;if(eligible)for(let i=floor;i>=0;i--){if(c?.chat?.[i]&&!c.chat[i].variables?.[c.chat[i].swipe_id||0]?.stat_data)continue;const v=deps.getVariables({type:'message',message_id:i});if(v?.stat_data&&typeof v.stat_data==='object'){statData=v.stat_data;sourceFloor=i;break;}}}catch{statData=null;sourceFloor=-1;}
   // Local fingerprints only. Message text and private variables never enter the news prompt.
   const branch=c?.chat?epoch+':'+c.chat.map(branchOf).join(':'):null;
   const {net,...terminal}=statData?.terminal||{};
   const revision=(deps.revision?.()||'')+':'+hash(JSON.stringify({...statData,terminal}));
   const opening=statData?.terminal?.opening;
   const hasStarted=Boolean(!eligible||c?.chat?.some(m=>m.is_user)||c?.chat?.length>1||opening?.token);
   return {scope,floor,sourceFloor,branch,statData,revision,hasStarted,openingToken:opening?.token||null};
  }
  function read(){const state=readState();return {...state,quests:deps.definitions?.(state.statData)||[]};}
  function same(expected,current){return expected.scope===current.scope&&expected.floor===current.floor&&expected.branch===current.branch;}
  function mutate(guard,update){
   const before=read();if(deps.busy?.() || !before.statData || !before.scope||before.floor<0||!guard(before)||typeof deps.updateVariablesWith!=='function')return false;
   // A synchronous updater prevents helper's async updater from writing after a chat/swipe switch.
   deps.updateVariablesWith(v=>{if(deps.busy?.() || !same(before,read())||!guard(read()))throw Error('聊天、消息或数值处理状态已变化，请重新操作。');v.stat_data=v.stat_data||structuredClone(before.statData||{});const t=v.stat_data.terminal=v.stat_data.terminal||{};const prior=structuredClone(before.statData);update(t,before);const protection=globalThis.parent?.Cxx236VariableGuard;if(!protection)throw Error('变量校验尚未就绪，请等待本卡脚本加载。');protection.validateProgram(prior,v.stat_data);return v;},{type:'message',message_id:before.floor});
   return same(before,read());
  }
  function writeNews(dyn,guard){
   try{return mutate(guard,(t,before)=>{t.net={...t.net,schemaVersion:1,updatedAt:'最近',scopeHash:hash(before.scope),sourceFloor:before.sourceFloor,
    news:dyn.news.slice(0,3).map(n=>((n.outlet||'都营新闻')+'：'+n.title).slice(0,240)),threads:dyn.threads.slice(0,3).map(n=>('帖子：'+n.title).slice(0,240))};});}catch{return false;}
  }
  function updateLedger(update){
   if(typeof update!=='function')return false;
   try{return mutate(()=>true,(t,before)=>{t.quests=t.quests||{};update(t,before.floor);});}catch{return false;}
  }
  function commitOpening(tx){
   try{
    if(typeof deps.validateOpening!=='function')return {ok:false,reason:'开局校验器不可用，未写入设置。'};
    tx=deps.validateOpening(tx);
    if(!same(tx.expectedContext,read()))return {ok:false,reason:'聊天或消息已变化，请重新选择。'};
    if(read().openingToken===tx.token)return {ok:true,token:tx.token};
    const ok=mutate(c=>same(tx.expectedContext,c)&&!c.hasStarted,(t,c)=>{t.opening={schemaVersion:1,token:tx.token,scopeHash:hash(c.scope),manifestVersion:tx.manifestVersion,...structuredClone(tx.opening),initialState:structuredClone(tx.initialState),timelineEvents:structuredClone(tx.timelineEvents),confirmedFloor:c.floor};});
    return {ok:ok&&read().openingToken===tx.token,token:tx.token,reason:ok?'':'当前聊天已开始或宿主不支持安全写入。'};
   }catch(e){return {ok:false,reason:e.message};}
  }
  return Object.freeze({read,readState,updateLedger,writeNews,commitOpening,changed,hash});
 }
 return Object.freeze({create,hash});
});
