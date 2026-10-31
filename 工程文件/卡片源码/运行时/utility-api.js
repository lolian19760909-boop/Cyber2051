(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxUtilityApi=api;})(globalThis,function(root){
 'use strict';
 function create({top=root.parent||root,api=root,fetcher=root.fetch?.bind(root)}){const tasks=new Map();let waiting=0,queue=Promise.resolve(),disposed=false;
  const scope=()=>{const c=api.SillyTavern.getContext();return JSON.stringify([c.characters?.[c.characterId]?.avatar,c.getCurrentChatId(),top.Cxx233Runtime?.persona?.(),c.chat.map(m=>[m.swipe_id||0,m.mes])]);};
  function cancel(id){tasks.get(id)?.abort();}
  function request({id,kind,input,system}){if(!['item','battle','growth'].includes(kind))return Promise.reject(Error('未知辅助任务。'));cancel(id);const controller=new AbortController(),expected=scope();tasks.set(id,controller);waiting++;const config=top.__cxx_experience__?.config();if(!config?.apiBase||!config.model){tasks.delete(id);waiting--;return Promise.reject(Error('请先设置共用解析连接的地址、密钥和模型；开局物品页和终端均可设置。'+(kind==='battle'?'开战需识别现场；已开战时也可在战斗面板修正本轮行动后发送。':'也可以直接手填。')));}const unchanged=()=>!disposed&&!controller.signal.aborted&&tasks.get(id)===controller&&scope()===expected&&['apiBase','apiKey','model'].every(k=>config[k]===top.__cxx_experience__?.config()[k]);
   // The deadline includes queue time. Cancellation must release the caller
   // even when a different auxiliary task is still using the connection.
   let aborted;const cancelled=new Promise((_,reject)=>{aborted=()=>reject(Error(controller.signal.reason==='timeout'?'辅助识别等待超时，输入已保留，请重试或手动修正。':'识别已取消，当前输入与手动修改已保留。'));controller.signal.addEventListener('abort',aborted,{once:true});});
   const timeout=setTimeout(()=>controller.abort('timeout'),60000);
   const work=async()=>{if(!unchanged())throw Error('任务或聊天已经变化，返回结果未采用。');const response=await top.__cxx_experience__.request(config,{temperature:.2,messages:[{role:'system',content:system+'\n只返回JSON对象。'},{role:'user',content:JSON.stringify(input)}]},{signal:controller.signal,kind});if(!response.ok)throw Error('辅助接口请求失败（HTTP '+response.status+'）。');const payload=await response.json(),text=payload.choices?.[0]?.message?.content;if(!unchanged())throw Error('旧请求已取消，保留当前输入与手动修改。');if(typeof text!=='string')throw Error('接口未返回可用内容。');try{return JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw Error('解析结果不是有效JSON，原文与草稿已保留。');}};
   const result=queue.then(work);queue=result.catch(()=>{});return Promise.race([result,cancelled]).finally(()=>{clearTimeout(timeout);controller.signal.removeEventListener('abort',aborted);waiting--;if(tasks.get(id)===controller)tasks.delete(id);});
  }
  return {request,cancel,busy:()=>waiting>0,destroy(){disposed=true;for(const c of tasks.values())c.abort();tasks.clear();}};
 }
 return {create};
});
