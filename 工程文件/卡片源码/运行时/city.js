/* District prose lives in worldbook entries; actions only compose an editable draft. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(local?require('../地图/places.json'):root.CxxCityData);if(local)module.exports=api;else {root.CxxCity=api;if(root.parent)root.parent.CxxCity=api;}})(globalThis,function(data){
 'use strict';
 const copy=v=>JSON.parse(JSON.stringify(v)),byId=new Map(data.places.map(p=>[p.id,p]));
 const actors=()=>typeof module==='object'&&module.exports?require('./ensemble-state.js'):globalThis.CxxEnsembleState||globalThis.parent?.CxxEnsembleState;
 const identity=stat=>actors()?.selected(stat)?.actorId||'player';
 function place(stat,id){const base=byId.get(id)||stat?.terminal?.city?.temporary?.[id];return base?{...base,...stat?.terminal?.city?.places?.[id]}:null;}
 function actorLocation(stat){const A=actors();if(A)return A.selected(stat).gameplay?.location;return stat?.terminal?.gameplay?.location;}
 function known(stat,id){const p=place(stat,id);return p?.kind!=='private'||stat?.terminal?.city?.known?.[identity(stat)]?.[id]===true||actorLocation(stat)?.placeId===id;}
 function registered(stat,mapId,id){return mapId==='tokyo-central'&&!!stat?.terminal?.city?.temporary?.[id];}
 function actions(stat,id){const p=place(stat,id);if(!p)return [];const at=actorLocation(stat),here=at?.mapId==='tokyo-central'&&at.placeId===id,status=p.status||p.defaultStatus;
  if(!known(stat,id))return [{id:'ask',label:'询问地址',draft:'我想联系'+p.name+'的住户，询问是否方便拜访，以及如何前往。'}];
  const result=[{id:'go',label:here?'查看周围':'前往此处',draft:here?'我在'+p.name+'留意周围现在的情况。':'我准备前往'+p.name+'，先确认路线和通行情况。'}];
  if(['private','school'].includes(p.kind)&&stat?.terminal?.city?.access?.[identity(stat)]?.[id]?.allowed!==true){result.push({id:'request',label:'尝试拜访／交涉',draft:'我想拜访'+p.name+'，先联系相关人员或向门口询问能否进入。'});return result;}
  if(status==='destroyed'||status==='closed'){result.push({id:'check',label:'了解现状',draft:'我想了解'+p.name+'目前的'+(status==='destroyed'?'损毁':'停业')+'情况，看看能否在允许进入的范围内查看。'});return result;}
  for(const a of p.actions||[])result.push({...a,draft:(here?'在'+p.name+'，':'到达'+p.name+'并确认可以进入后，')+a.draft});return result;
 }
 function evaluate(before,events,{source,quote}){const state=copy(before.terminal?.city||{schema:1,places:{},contacts:{},events:{}});if(state.schema!==1)throw Error('地点状态版本不匹配。');
  for(const e of events){if(!e||e.kind!=='happened'||!['status','owner','contact','access','discover','candidate'].includes(e.event)||e.event!=='candidate'&&!place(before,e.placeId)||!/^[a-zA-Z][\w-]{0,79}$/.test(e.id||'')||['constructor','prototype','__proto__'].includes(e.id))throw Error('地点事件未登记。');quote(e.quote);const prior=state.events[e.id];if(prior){if(JSON.stringify(prior.event)!==JSON.stringify(e))throw Error('同一地点事件不能改写。');continue;}
   if(e.event==='status'){if(!['open','closed','destroyed'].includes(e.status))throw Error('地点状态无效。');state.places[e.placeId]={...state.places[e.placeId],status:e.status,source:copy(source)};}
   if(e.event==='owner'){if(typeof e.owner!=='string'||!e.owner.trim()||e.owner.length>120)throw Error('地点经营者需有明确正文。');state.places[e.placeId]={...state.places[e.placeId],owner:e.owner,source:copy(source)};}
   if(['contact','access','discover'].includes(e.event)){
    if(typeof e.actorId!=='string')throw Error('地点知情或访问资格需要对应人物编号。');const person=actors().selected(before,e.actorId);
    if(e.event==='contact'){if(typeof e.person!=='string'||!e.person.trim()||e.person.length>80||['constructor','prototype','__proto__'].includes(e.person))throw Error('会面线索缺少人物。');state.contacts[person.actorId+'__'+e.person]={actorId:person.actorId,person:e.person,placeId:e.placeId,quote:e.quote,source:copy(source)};}
    if(e.event==='access'){if(typeof e.allowed!=='boolean')throw Error('访问资格须说明授予或撤回。');state.access||={};state.access[person.actorId]||={};state.access[person.actorId][e.placeId]={allowed:e.allowed,quote:e.quote,source:copy(source)};}
    if(e.event==='discover'){state.known||={};state.known[person.actorId]||={};state.known[person.actorId][e.placeId]=true;}
   }
   if(e.event==='candidate'){
    if(typeof e.name!=='string'||!e.name.trim()||e.name.length>80||typeof e.description!=='string'||!e.description.trim()||e.description.length>2000||!data.regions.some(r=>r.id===e.group)||e.parentId&&!byId.has(e.parentId))throw Error('临时地点须有名称、已知地区和正文中的说明。');
    if(e.id.length>70)throw Error('临时地点事件编号最多70字符。');state.candidates||={};state.candidates[e.id]={id:'temporary_'+e.id,name:e.name,desc:e.description,group:e.group,parentId:e.parentId||'',kind:'street',defaultStatus:'open',actions:[{id:'visit',label:'询问现场',draft:'留意现场情况，再向能够接触到的人询问。'}],quote:e.quote,source:copy(source)};
   }
   state.events[e.id]={event:copy(e),source:copy(source)};
  }return state;
 }
 function plan(stat,request){const next=copy(stat),state=next.terminal.city;if(!state)throw Error('尚无待确认地点。');if(state.confirmations?.[request.id]){if(state.confirmations[request.id]!==request.action+'|'+request.expected)throw Error('同一地点操作不能改写。');return next;}const candidate=state.candidates?.[request.candidateId];if(!candidate||JSON.stringify(candidate)!==request.expected)throw Error('临时地点来源已变化，请重新查看。');
  if(request.action==='city-confirm-place'){state.temporary||={};state.temporary[candidate.id]=copy(candidate);}
  else if(request.action!=='city-dismiss-place')throw Error('地点操作未登记。');if(typeof request.id!=='string'||!/^[a-zA-Z][\w-]{0,79}$/.test(request.id)||['constructor','prototype','__proto__'].includes(request.id))throw Error('地点操作编号无效。');state.confirmations||={};state.confirmations[request.id]=request.action+'|'+request.expected;delete state.candidates[request.candidateId];return next;
 }
 function context(stat,{analyzes=false}={}){const at=actorLocation(stat),p=at?.mapId==='tokyo-central'&&place(stat,at.placeId),city=stat?.terminal?.city,actorId=identity(stat);
  return '【地点行动】地图按钮只填可编辑草稿；按正文实际到达、许可和成交更新位置、钱包及numericInput。私宅地址获知与进入许可分开，学校按实际访问权限；停业或损毁后不提供原服务。诊疗按实际治疗更新资源，修理完成按实际成果登记经验；餐饮、租赁、交通按已成交费用、消耗物品与故事耗时处理，费用以本轮确认报价为准。\n'+
   (p?'当前位置功能：'+JSON.stringify({id:p.id,name:p.name,status:p.status||p.defaultStatus,owner:p.owner,actions:actions(stat,p.id).map(a=>a.label)}):'')+
   (city?'\n已保存地点变化与本人物线索：'+JSON.stringify({places:city.places,contacts:Object.values(city.contacts||{}).filter(c=>c.actorId===actorId),known:city.known?.[actorId],access:city.access?.[actorId],temporary:city.temporary}):'')+
   (analyzes?'\n明确发生停业、重开、损毁、易主或人物实际获知会面线索时，提交 add /terminal/cityInput 数组：{id,event:"status",placeId,status:"open|closed|destroyed",kind:"happened",quote}；易主 event:"owner",owner；已知会面 event:"contact",actorId,person；实际获知私宅地址 event:"discover",actorId；实际授予/撤回访问资格 event:"access",actorId,allowed。quote逐字引用本轮正文8—400字。新临时地点用event:"candidate",name,description,group:"underpool|lowtown",parentId可省略；等待玩家在地点记录中确认后才加入。不得将猜测、远景或地图浏览当作事实。\n服务结算沿当前人物原接口：实际到达写其gameplay.location:{mapId:"tokyo-central",placeId}；费用/收入同步wallet.yen及spent/earned，正文赊账允许yen为负。实际购买或出售提交numericInput的item-gain/item-loss并使用同一批钱包更新，已装义体拆装按原物品协议。治疗用{id,kind:"resource",resource:"hp|stamina|ram",amount:实际增减,reason}，只恢复正文明确已恢复的量。有效修理成果沿原achievement经验协议，不加独立工程熟练度。不因点击、询价或浏览自动结算。':'');
 }
 return {data,place,known,registered,actions,evaluate,context,plan,actorLocation,identity,selected:stat=>actors().selected(stat)};
});
