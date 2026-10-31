(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxQuestController=api;})(globalThis,function(){
 'use strict';
 function create({read,source,commit,uuid,changed=()=>{},observer}){
  let dead=false,busy=false,message='',error=false,pending=null;
  const state=()=>({busy,message,error,pending});
  function reconcile(){if(!busy&&pending?.questContext&&pending.questContext!==source().questContext){pending=null;message='回复分支已变化。原分支记录保留，当前进度已重新读取。';error=false;}}
  function request(action,questId,extra={}){return {action:'quest-'+action,questId,id:'quest_'+uuid().replaceAll('-',''),expectedRevision:read()?.terminal?.questJournal?.revision||0,...source(),...extra};}
  function notice(text,failed=false){message=text;error=failed;changed();}
  async function run(req){if(dead||busy)return;if(pending&&pending!==req){notice('请先重试尚未确认的保存。',true);return;}pending=req;busy=true;notice('正在保存委托记录…');try{await commit(req);if(dead)return;pending=null;message='已保存，并从聊天文件读回确认。';}catch(e){if(dead)return;if(['rule-rejected','source-expired'].includes(e.diagnosticKind))pending=null;message=e.message||'保存未确认，请重试。';error=true;}finally{busy=false;if(!dead)changed();}}
  return {state,request,run,reconcile,notice,observed:snapshot=>observer?.observed(snapshot),destroy(){dead=true;observer?.destroy();}};
 }
 return {create};
});
