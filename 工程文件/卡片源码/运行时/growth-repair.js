(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxGrowthRepair=value;})(globalThis,function(){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 function create({api,top,runtime}){let preview=null;const ctx=()=>api.SillyTavern.getContext(),stamp=()=>JSON.stringify([ctx().characters?.[ctx().characterId]?.avatar,ctx().getCurrentChatId(),ctx().chat.map(m=>[m.swipe_id||0,m.mes])]);
  async function inspect(from,to){if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>=ctx().chat.length)throw Error('请选择已有正文的起止楼层。');if(to-from>39)throw Error('每次检查最多40层，请分段核对。');const key=stamp(),player=top.__cxx_player__,before=await player.read(),sources=[];
   for(let i=from;i<=to;i++){const m=ctx().chat[i];if(m.is_user||m.is_system)continue;const text=await top.CxxSource.text(i);if(stamp()!==key)throw Error('剧情已经变化，请重新选择范围。');sources.push({floor:i,swipe:m.swipe_id||0,text});}
   if(!sources.length)throw Error('范围内没有可分析的助手正文。');const receipts=before.stat.terminal.gameplay.growth?.rewards||{},result=await top.__cxx_utility__.request({id:'growth-repair',kind:'growth',input:{sources,alreadyAwarded:receipts},system:'检查指定旧正文里已完成但未结算的独立成长成果。只返回{events:[{floor,id,source:{kind:"story|training|activity|quest",id:稳定成果编号},category:"small|stage|gig|major",completed:true,reason:正文依据}]}。小事实质成果small、独立阶段stage、小委托gig、大委托major。已奖励的同一事实即便旧编号不同也不能再补发；计划、回顾、空泛描述不算成果。不得编造经验数或属性点。只提取给出的有效原文。'});
   if(stamp()!==key)throw Error('剧情已变化，旧补算结果已弃用。');if(!Array.isArray(result.events))throw Error('模型未返回成果清单。');let growth=before.stat.terminal.gameplay.growth;const events=[],rows=[];for(const raw of result.events){if(!sources.some(s=>s.floor===raw.floor))throw Error('补算包含范围外楼层。');const {floor,...fields}=raw,event={...fields,kind:'achievement'},planned=api.CxxNumericGrowth.planAchievement(growth,event);growth=planned.state;events.push(event);rows.push({floor,reason:event.reason,xp:planned.earned.xp,duplicate:planned.duplicate,level:growth.level});}
   preview={id:'growth_repair_'+Date.now().toString(36),key,from,to,base:structuredClone(before.stat.terminal.gameplay.growth),events,rows};return structuredClone({id:preview.id,from,to,rows,level:growth.level});
  }
  async function apply(id){const p=preview;if(!p||p.id!==id||p.key!==stamp())throw Error('补算预览已失效，请重新检查。');const result=await top.__cxx_player__.commit({action:'growth-repair',id:p.id,expected:p.base,events:p.events,range:{from:p.from,to:p.to}});preview=null;return result;}
  return {inspect,apply,destroy(){preview=null;top.__cxx_utility__?.cancel('growth-repair');}};
 }
 return {create};
});
