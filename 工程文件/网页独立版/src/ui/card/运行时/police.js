/* Derived from 卡片源码/运行时/police.js; source SHA256 abb793c25d89d521a77f07c44011e2fab6d7fe6bd7eb77f2b53c8ac0d8867643. Rebuild with tools/p3a-adapt-views.mjs. */
/* Police decisions are pure calculations; the existing MVU transaction owns saving. */
(function(root,factory){const local=typeof module==='object'&&module.exports;
 const api=factory(local?require('./police-rules.json'):root.CxxPoliceRules,local?require('../地图/places.json'):root.CxxCityData);
 if(local)module.exports=api;else {root.CxxPolice=api;if(root)root.CxxPolice=api;}
})(globalThis,function(rules,city){
 'use strict';
 const Parser=()=>typeof module==='object'&&module.exports?require('../Gal/parser.js'):globalThis.CxxGalParser;
 const copy=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const fail=message=>{throw Error(message);};
 function id(value){if(typeof value!=='string'||!/^[a-zA-Z][\w-]{0,79}$/.test(value)||['constructor','prototype','__proto__'].includes(value))fail('警情编号无效。');return value;}
 function amount(v,min=0){if(!Number.isSafeInteger(v)||v<min)fail('警方款项或数量无效。');return v;}
 function text(v,max=200){if(typeof v!=='string'||!v.trim()||v.length>max)fail('警情缺少明确事实。');return v;}
 function hash(v){let n=2166136261;for(const ch of String(v))n=Math.imul(n^ch.charCodeAt(0),16777619);return (n>>>0).toString(16);}
 function minute(date,time){const d=String(date||'').trim().match(/^(\d{4})(?:年|-|\/)(\d{1,2})(?:月|-|\/)(\d{1,2})日?(?:\s*(?:星期|周)[一二三四五六日天])?$/),t=String(time||'').trim().match(/^(\d{1,2}):(\d{2})$/);if(!d||!t)return null;
  const [y,m,day,h,min]=[+d[1],+d[2],+d[3],+t[1],+t[2]],stamp=Date.UTC(y,m-1,day,h,min),check=new Date(stamp);
  if(m<1||m>12||day<1||day>31||h>23||min>59||check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==day)return null;return stamp/60000;
 }
 function clock(raw){try{const v=Parser().settlementParts(raw).scene;return v?minute(v.date,v.time):null;}catch{return null;}}
 const fresh=()=>({schema:1,rulesVersion:rules.version,clock:null,cases:{},warrants:{},detentions:{},events:{},corrections:{},targets:{}});
 function read(stat){const value=stat?.terminal?.police;if(value===undefined)return fresh();if(value.schema!==1||!value.cases||!value.events||!value.warrants||!value.detentions)fail('警情记录版本不匹配。');return copy(value);}
 function district(placeId,value){const p=city.places.find(p=>p.id===placeId),key=p?.group||value;if(!rules.districts[key]||p&&value&&p.group!==value)fail('警情所在地区未登记或与地点不符。');return key;}
 function classify(c){
  if(!c||typeof c!=='object')fail('警情缺少行为分类。');
  const harm={none:0,injury:3,death:4,mass:5}[c.harm||'none'];if(harm===undefined)fail('伤害分类无效。');
  const value=amount(c.valueYen??0),valueLevel=value<rules.valueBandsYen[0]?1:value<rules.valueBandsYen[1]?2:value<rules.valueBandsYen[2]?3:4;
  let level=0;
  switch(c.category){
   case 'theft': if(c.taken!==true||c.owner!=='other'||c.permission!==false||c.loot===true)fail('盗窃须已拿走未经许可的有主财物；明确战利品不在此列。');level=Math.max(valueLevel,c.sensitive===true?3:1);break;
   case 'robbery': if(c.force!==true&&c.threat!==true)fail('抢劫须已实施强索财物的暴力或明确伤害威胁。');level=Math.max(2,c.weapon||c.hostage?3:0,harm);break;
   case 'property': if(c.damaged!==true||c.owner!=='other'||c.permission!==false||c.deliberate!==true&&c.negligent!==true)fail('财物破坏须有实际损害、他人产权及故意或过失依据。');level=Math.max(c.deliberate?valueLevel:Math.min(2,valueLevel),c.sensitive?3:0,harm);break;
   case 'intrusion': if(!['physical','digital'].includes(c.domain)||!['entered','attempted','remained'].includes(c.action)||!['none','exceeded','revoked'].includes(c.authorization))fail('入侵须说明具体权限及已实施的进入、突破或滞留。');if(c.authorization==='revoked'&&(c.notified!==true||c.exitOpportunity!==true||c.action!=='remained'))fail('撤权后须已获通知、有机会退出却仍滞留。');level=c.sensitive?3:c.action==='attempted'?1:2;if(c.mistake===true&&!c.sensitive)level=1;break;
   case 'assault': if(c.struck!==true&&c.threat!==true)fail('袭击须有已实施的攻击或明确伤害威胁。');level=Math.max(2,harm);break;
   case 'plotting': if(c.prepared!==true||!c.target||!c.means||!c.act)fail('策划暴力须有具体目标、手段和已经实施的准备行为。');level=c.massTarget===true?5:2;break;
   case 'escape': if(c.escaped!==true||!c.detentionId)fail('越狱须已实际脱离拘押。');level=Math.max(2,harm);break;
   default:fail('犯罪类别未登记。');
  }
  if(c.publicImpact==='major')level=Math.max(4,level);if(c.publicImpact==='mass')level=5;
  return {category:c.category,level,major:c.harm==='mass'||['major','mass'].includes(c.publicImpact),weight:rules.weight[level],facts:copy(c)};
 }
 function severity(c){c.level=Math.max(...c.charges.map(x=>x.level));c.major=c.charges.some(x=>x.major);c.weight=rules.weight[c.level];c.scope=c.major?'tokyo':c.district;c.fineDue=c.fineAssessed?Math.round(rules.fineBase[c.level]*rules.districts[c.district].fineFactor):0;}
 function activeLong(state,c){return Object.values(state.warrants).some(w=>w.active&&w.actorId===c.actorId&&w.caseIds.includes(c.id));}
 function dispatch(c,now,source){
  if(c.special||c.level<5&&!c.major)return;
  const roll=parseInt(hash(c.id+'|special|'+JSON.stringify(source)),16)%100,threshold=c.major?rules.specialChance.major:rules.specialChance.fiveStars;
  c.special={roll,threshold,state:roll<threshold?'dispatched':'not-dispatched',requestedAt:now,earliestArrival:now+rules.districts[c.district].specialMinutes,team:'special'};
 }
 function accrue(state,actorId,now){
  const valid=Object.values(state.cases).filter(c=>c.valid&&c.actorId===actorId&&!c.covered&&now-c.registeredAt<=rules.windowMinutes&&now>=c.registeredAt);
  for(const c of valid.filter(c=>c.major&&!Object.values(state.warrants).some(w=>w.origin==='major'&&w.caseIds.includes(c.id)))){
   const key='major_'+c.id;state.warrants[key]={id:key,actorId,origin:'major',scope:'tokyo',active:true,caseIds:[c.id],registeredAt:now};
  }
  if(valid.reduce((n,c)=>n+c.weight,0)<rules.longTermThreshold||Object.values(state.warrants).some(w=>w.actorId===actorId&&w.origin==='cumulative'&&w.active))return;
  const caseIds=valid.map(c=>c.id).sort(),key='cumulative_'+hash(JSON.stringify([actorId,caseIds]));if(state.warrants[key])return;
  state.warrants[key]={id:key,actorId,origin:'cumulative',scope:'tokyo',active:true,caseIds,registeredAt:now};
 }
 function tick(state,now){
  if(now===null||now===undefined)return;if(!Number.isSafeInteger(now)||state.clock!==null&&now<state.clock)fail('故事时间早于当前警情记录，请核对本轮日期与时间。');
  state.clock=now;
  for(const c of Object.values(state.cases)){if(!c.valid||!c.response||c.hiddenAt===null||c.hiddenAt===undefined||c.hold)continue;
   let remaining=now-c.hiddenAt,level=c.hideLevel;
   while(level>0&&remaining>=rules.hideStepMinutes[level]){remaining-=rules.hideStepMinutes[level];level--;}
   c.current=level;if(level===0){c.response=false;c.tracking='ended';c.ordinary=false;}
  }
 }
 function calculate(before,events,{now:finalNow,source,quote,actor,inventory}){
  const state=read(before),operations=[];state.targets||={};
  if(!Array.isArray(events)||events.length>32)fail('本轮警情事件须为最多32项数组。');
  for(const e of events){
   if(!e||e.kind!=='happened')fail('只登记本轮已经发生的警情事实。');id(e.id);quote(e.quote);
   const previous=state.events[e.id];if(previous){if(!same(previous.event,e))fail('同一警情事件不能改写内容。');continue;}
   if(finalNow===null||finalNow===undefined)fail('警情更新需要本轮ztl的故事日期与时间。');
   const now=e.at?minute(e.at.date,e.at.time):finalNow;if(now===null||now>finalNow)fail('警情事件时间须对应本轮正文，且不晚于ztl时点。');tick(state,now);
   const actorId=id(e.actorId),person=actor(actorId,e,state);
   let c=e.caseId?state.cases[id(e.caseId)]:null;
   if(c&&c.actorId!==actorId)fail('案件属于另一人物。');
   if(e.event==='report'){
    if(person.external)state.targets[actorId]={name:person.record.name,source:copy(source)};
    if(!['witness','camera','report','investigation','onscene'].includes(e.knownVia))fail('警方须先有目击、监控、报案或调查依据。');
    if(e.identityKnown!==true&&(!Array.isArray(e.features)||!e.features.length||e.features.some(v=>typeof v!=='string'||!v.trim()||v.length>120)))fail('身份未明时须有实际获知的可识别特征。');
    if(!Array.isArray(e.charges)||!e.charges.length||e.charges.length>8)fail('案件须有已成立的行为分类。');
    const charges=e.charges.map(classify),where=district(e.placeId,e.district);
    if(!e.caseId)fail('独立案件需要稳定caseId。');
    if(c){
     if(!c.valid||c.district!==where)fail('已纠正案件不能复述重开，同案不随移动更换原辖区。');
     if(e.newConsequence!==true)fail('同案只在新的实际后果成立时补充分类；复述不用再次report。');
     const old=c.level;if(Math.max(...charges.map(row=>row.level))<old)fail('新增后果不能降低原案严重度，请按实际撤控或纠正处理。');c.charges=charges;severity(c);if(c.level>old){c.covered=false;if(c.response){c.current=c.level;c.hiddenAt=null;c.tracking='pursuit';}}c.evidence.push({quote:e.quote,source:copy(source)});
    }else{
     for(const charge of charges)if(charge.category==='escape'&&(!state.detentions[charge.facts.detentionId]?.escaped||state.detentions[charge.facts.detentionId].actorId!==actorId))fail('尚未登记此人物的实际越狱过程。');
     const probability=rules.placeCoverage[e.placeId]??rules.districts[where].response,roll=parseInt(hash(e.caseId+'|ordinary|'+JSON.stringify(source)),16)%100;
     c=state.cases[e.caseId]={id:e.caseId,actorId,valid:true,covered:false,rulesVersion:rules.version,district:where,placeId:e.placeId||'',registeredAt:now,charges,knownVia:e.knownVia,identityKnown:e.identityKnown===true,features:copy(e.features||[]),allegation:e.allegation===true,public:{},fineAssessed:false,finePaid:0,fineWaived:0,compensation:{},seizures:{},evidence:[{quote:e.quote,source:copy(source)}],ordinary:true,response:e.knownVia==='onscene'||e.responseEstablished===true||roll<probability,roll,probability,hiddenAt:null};severity(c);c.current=c.response?c.level:0;c.tracking=c.response?'pursuit':'filed';
    }
    dispatch(c,now,source);accrue(state,actorId,now);
   }else if(e.event==='detain'){
    const dId=id(e.detentionId);if(state.detentions[dId])fail('这次拘押已经登记。');if(!Array.isArray(e.caseIds)||!e.caseIds.length||e.caseIds.some(key=>!state.cases[key]?.valid||state.cases[key].actorId!==actorId))fail('拘押须关联当前人物的有效案件。');
    if(Object.values(state.detentions).some(d=>d.actorId===actorId&&d.held))fail('该人物已有当前拘押记录。');
    state.detentions[dId]={id:dId,actorId,caseIds:copy(e.caseIds),facility:text(e.facility),startedAt:now,durationMinutes:amount(e.durationMinutes),held:true,escaped:false,source:copy(source)};
    for(const key of e.caseIds){const row=state.cases[key];row.response=false;row.current=0;row.tracking='detained';row.hiddenAt=null;}
   }else if(['release','escape','restrict','unrestrict'].includes(e.event)){
    const d=state.detentions[id(e.detentionId)];if(!d||d.actorId!==actorId)fail('拘押记录不存在或属于另一人物。');
    if(e.event==='restrict'){
     if(!d.held||!Array.isArray(e.slots)||!e.slots.length)fail('限制义体须在实际拘押中指明已安装部位。');
     for(const slot of e.slots){const item=inventory(actorId,slot,true);if(!item||item.definition.category!=='cyberware')fail('只能限制实际已安装的义体。');}
     operations.push({kind:'restrict',actorId,detentionId:d.id,slots:[...new Set(e.slots)],source:copy(source)});d.restrictedSlots=[...new Set(e.slots)];
    }else if(e.event==='unrestrict'){
     operations.push({kind:'unrestrict',actorId,detentionId:d.id});d.restrictedSlots=[];
    }else{
     if(!d.held)fail('该人物已不在这次拘押中。');
     if(e.event==='release'&&now<d.startedAt+d.durationMinutes&&!['bail','acquittal','order'].includes(e.basis))fail('刑期未满，提前获释须有保释、撤控或正式命令的事实。');
     d.held=false;d.endedAt=now;d.escaped=e.event==='escape';d.endSource={quote:e.quote,source:copy(source)};
     if(e.event==='release'){
      operations.push({kind:'unrestrict',actorId,detentionId:d.id});d.restrictedSlots=[];
      for(const row of Object.values(state.cases).filter(row=>row.actorId===actorId))for(const seizure of Object.values(row.seizures))if(seizure.detentionId===d.id&&seizure.type==='ordinary'&&!seizure.returned){
       operations.push({kind:'item',actorId,event:{id:'police_return_'+hash(e.id+'|'+seizure.id),kind:'item-gain',itemId:seizure.itemId,quantity:seizure.quantity,reason:e.quote}});seizure.returned=true;seizure.returnSource=copy(source);
      }
     }
    }
   }else if(e.event==='resolve-longterm'){
    const w=state.warrants[id(e.warrantId)];if(!w||!w.active||w.actorId!==actorId||!['acquittal','judgment','official-deal','identity-cleared'].includes(e.basis))fail('长期通缉须有对应案件认可的正式化解。');
    w.active=false;w.resolution={basis:e.basis,quote:e.quote,source:copy(source)};for(const key of w.caseIds){const row=state.cases[key];row.covered=true;if(!row.response)row.ordinary=false;if(['acquittal','identity-cleared'].includes(e.basis)){row.valid=false;row.current=0;row.response=false;row.ordinary=false;row.tracking='resolved';row.fineDue=row.finePaid+row.fineWaived;}reconcile(state,key);}
   }else{
    if(!c)fail('警情尚未登记。');
    switch(e.event){
     case 'hide':if(!c.valid||!c.response)fail('当前没有需要脱离的本案追踪。');if(c.hiddenAt===null||c.hiddenAt===undefined){c.hiddenAt=now;c.hideLevel=c.current;}c.tracking='search';break;
     case 'locate':{
      if(!c.valid||!c.ordinary&&!activeLong(state,c))fail('已结束普通案件不能因看到警察而重开。');if(!['visual','scan','verified-report'].includes(e.recognition))fail('重新发现需要真实识别依据。');
      const placeId=e.placeId||person.gameplay?.location?.placeId||c.placeId,where=district(placeId,e.district||(!placeId?c.district:undefined));
      if(where!==c.district&&c.scope!=='tokyo'&&!activeLong(state,c)&&!(c.response&&['continued-pursuit','handoff'].includes(e.crossDistrict)))fail('普通案件跨区响应须有现有追兵继续追击或实际交接。');
      c.response=true;c.current=c.level;c.hiddenAt=null;c.tracking='pursuit';c.lastKnown={placeId:placeId||'',district:where,quote:e.quote,source:copy(source)};dispatch(c,now,source);break;
     }
     case 'hold':if(e.active!==true&&e.active!==false)fail('持续追踪限制须说明是否生效。');c.hold=e.active;c.hiddenAt=null;break;
     case 'response-end':c.current=0;c.response=false;c.tracking='ended';c.hiddenAt=null;c.ordinary=false;break;
     case 'resolve':if(!['accepted-restitution','warning-exit','judgment','acquittal','official-deal'].includes(e.basis))fail('普通案件需要明确处置依据。');if(['accepted-restitution','warning-exit'].includes(e.basis)&&(c.level>1||c.charges.some(x=>!['theft','intrusion','property'].includes(x.category))))fail('退赔或驱离不能自动结清严重案件。');c.ordinary=false;c.current=0;c.response=false;c.tracking='resolved';c.resolution={basis:e.basis,quote:e.quote,source:copy(source)};if(e.basis==='acquittal'){c.valid=false;c.fineDue=c.finePaid+c.fineWaived;reconcile(state,c.id);}break;
     case 'assess-fine':if(!c.valid)fail('已撤控或纠正的案件不再产生应付罚款。');c.fineAssessed=true;severity(c);break;
     case 'waive-fine':c.fineWaived=amount(e.amount);if(c.fineWaived+c.finePaid>c.fineDue)fail('减免超过尚未缴纳的罚款。');break;
     case 'pay-fine':{const paid=amount(e.amount,1);if(!c.valid||!c.fineAssessed||c.finePaid+paid+c.fineWaived>c.fineDue)fail('实付罚款超过当前应付金额。');if(!person.external)operations.push({kind:'pay',actorId,amount:paid});c.finePaid+=paid;break;}
     case 'compensate':{const lossId=id(e.lossId),paid=amount(e.amount,1);if(c.compensation[lossId])fail('这笔损失赔偿已经登记。');if(!person.external)operations.push({kind:'pay',actorId,amount:paid});c.compensation[lossId]={paid,quote:e.quote,source:copy(source)};break;}
     case 'seize':{
      const d=state.detentions[id(e.detentionId)];if(!d?.held||d.actorId!==actorId||!d.caseIds.includes(c.id)||!Array.isArray(e.items)||!e.items.length)fail('扣押须关联当前拘押及具体物品。');
      for(const [index,item]of e.items.entries()){
       id(item.itemId);amount(item.quantity,1);if(!['ordinary','evidence','contraband'].includes(item.type))fail('扣押类型无效。');
       const owned=inventory(actorId,item.itemId);if(!owned||owned.record.quantity<item.quantity||owned.installed)fail('扣押数量超过持有，或该物品仍是已安装义体。');
       const key=e.id+'_'+index;c.seizures[key]={id:key,detentionId:d.id,itemId:item.itemId,quantity:item.quantity,type:item.type,keeper:text(e.keeper),record:copy(owned.record),definition:copy(owned.definition),source:copy(source),returned:false};
       operations.push({kind:'item',actorId,event:{id:'police_seize_'+hash(key),kind:'item-loss',itemId:item.itemId,quantity:item.quantity,reason:e.quote}});
      }break;
     }
     case 'return-seizure':{const item=c.seizures[e.seizureId];if(!item||item.returned)fail('这件扣押物已返还或不存在。');if(item.type!=='ordinary'&&e.authorized!==true)fail('涉案或违禁物须有明确返还决定。');operations.push({kind:'item',actorId,event:{id:'police_return_'+hash(e.id),kind:'item-gain',itemId:item.itemId,quantity:item.quantity,reason:e.quote}});item.returned=true;item.returnSource=copy(source);break;}
     case 'special-arrival':if(!c.valid)fail('已撤控或纠正的案件不再产生特别队响应。');if(c.special?.state!=='dispatched'||now<c.special.earliestArrival)fail('特别队尚未派出或行程未完成。');c.special.state='arrived';c.special.arrivedAt=now;c.response=true;c.current=Math.max(c.current,c.level);break;
     case 'identify':if(e.confirmed!==true)fail('查明身份需要实际确认事实。');c.identityKnown=true;c.identitySource={quote:e.quote,source:copy(source)};break;
     case 'learn':c.public={...c.public,identity:e.identity===true?c.identityKnown:c.public.identity,clue:e.clue?text(e.clue,400):c.public.clue};break;
     default:fail('警情事件未登记。');
    }
   }
   state.events[e.id]={event:copy(e),source:copy(source),at:now};
  }
  tick(state,finalNow);return {state,operations};
 }
 function reconcile(state,caseId){for(const w of Object.values(state.warrants).filter(w=>w.active&&w.caseIds.includes(caseId))){const valid=w.caseIds.filter(key=>state.cases[key]?.valid&&!state.cases[key]?.covered);if(w.origin==='major'&&!valid.length||w.origin==='cumulative'&&valid.reduce((n,key)=>n+state.cases[key].weight,0)<rules.longTermThreshold){w.active=false;w.invalidatedBy=caseId;}}}
 function correction(stat,caseId){const c=read(stat).cases[caseId];if(!c?.valid||c.allegation)return null;return {caseId,expected:hash(JSON.stringify(c)),level:c.level,fineDue:c.fineDue,weight:c.weight,finePaid:c.finePaid,evidence:copy(c.evidence),message:'纠正本案的犯罪识别及其警星、应罚额与累计分；已实际付款、拘押、扣押和其他案件保留。'};}
 function correct(stat,request){const next=copy(stat),state=read(stat),c=state.cases[id(request.caseId)];id(request.id);if(state.corrections[request.id])return next;if(!c?.valid||hash(JSON.stringify(c))!==request.expected)fail('本案已有后续变化，请重新核对纠正范围。');if(c.allegation)fail('这是正文已发生的误报或栽赃，请在剧情中澄清指控。');c.valid=false;c.ordinary=false;c.response=false;c.current=0;c.tracking='corrected';c.fineDue=c.finePaid+c.fineWaived;reconcile(state,c.id);state.corrections[request.id]={caseId:c.id,evidence:copy(c.evidence)};next.terminal.police=state;return next;}
 function view(stat,actorId='player'){
  const state=read(stat),cases=Object.values(state.cases).filter(c=>c.actorId===actorId),warrants=Object.values(state.warrants).filter(w=>w.actorId===actorId&&w.active),held=Object.values(state.detentions).find(d=>d.actorId===actorId&&d.held);
  return {stars:Math.max(0,...cases.filter(c=>c.valid&&c.response).map(c=>c.current)),longTerm:warrants.map(w=>({id:w.id,scope:w.scope,origin:w.origin})),held:held?{facility:held.facility,remainingMinutes:Math.max(0,held.startedAt+held.durationMinutes-(state.clock||held.startedAt))}:null,
   cases:cases.map(c=>({id:c.id,valid:c.valid,level:c.level,current:c.current,ordinary:c.valid&&c.ordinary,scope:c.scope,district:c.district,tracking:c.tracking,identity:c.public.identity,clue:c.public.clue,fineDue:c.fineDue,finePaid:c.finePaid,fineWaived:c.fineWaived,special:c.special?.state,heldItems:Object.values(c.seizures).filter(s=>!s.returned).map(s=>({id:s.id,name:s.definition.name,quantity:s.quantity,keeper:s.keeper,type:s.type}))}))};
 }
 function context(stat,{analyzes=false}={}){const state=read(stat),active=Object.values(state.cases).filter(c=>c.valid&&(c.response||c.ordinary||activeLong(state,c)||c.fineDue>c.finePaid+c.fineWaived||Object.values(c.seizures).some(s=>!s.returned))),teams=c=>({ordinary:c.response?rules.teams[String(c.current)]||[]:[],special:c.special?.state==='arrived'?rules.teams.special:[]});
  const current={clock:state.clock,cases:active.map(c=>({...c,evidence:c.evidence.slice(-1),teams:teams(c)})),warrants:Object.values(state.warrants).filter(w=>w.active),detentions:Object.values(state.detentions).filter(d=>d.held||d.restrictedSlots?.length),targets:state.targets};
  return '【警方与故事时钟】当前保存：'+JSON.stringify(current)+'\n当前已登记有效留档的30日累计分：'+JSON.stringify(Object.fromEntries([...new Set(Object.values(state.cases).map(c=>c.actorId))].map(actorId=>[actorId,Object.values(state.cases).filter(c=>c.valid&&!c.covered&&c.actorId===actorId&&state.clock-c.registeredAt<=rules.windowMinutes).reduce((n,c)=>n+c.weight,0)])))+'\n警力固定预制档位：'+JSON.stringify(rules.units)+'。队伍列表是本次响应配置，只有正文实际到场且参与交战者才进入战斗，不按玩家等级缩放。\n公开暴力须警方实际获知；秘密行为不自动登记。地图浏览、玩家意图、假设与未选项不构成犯罪。NPC案件使用其actorId，不能记到玩家。低星可警告、盘查或接受投降；派遣与实际到场分开。换装、伪装、车辆更换影响实际识别，旧线索不等于实时定位。\n'+(analyzes?protocol():'');}
 function protocol(){return '【警情事实输入】只提交 add /terminal/policeInput 数组，每项必须 {id:"稳定事件ID",event,actorId:"player或已登记人物",kind:"happened",quote:"本轮正文8—400字原句"}。未建人物档案的现场NPC用npc_开头稳定编号，首次report加actorName；不得省略actorId。日期时间默认本轮ztl；本轮跨多个时点时按发生顺序附at:{date,time}，不得晚于ztl。不要直接写police、警星、罚额或警情造成的钱包/物品变化。\n'+
  '新案event:"report",caseId,placeId或district,knownVia:"witness|camera|report|investigation|onscene",identityKnown:boolean,features:[已获知特征],charges:[行为事实]；非现场响应若已实际出警可带responseEstablished:true。同案只在新后果时用同caseId、newConsequence:true和完整charges。分类：theft{taken:true,owner:"other",permission:false,valueYen,loot:false}；robbery{force或threat:true,weapon/hostage:boolean,harm:"none|injury|death|mass"}；property{damaged:true,owner:"other",permission:false,deliberate或negligent:true,valueYen}；intrusion{domain:"physical|digital",action:"entered|attempted|remained",authorization:"none|exceeded|revoked",sensitive:boolean,mistake:boolean}，撤权滞留另需notified、exitOpportunity为true；assault{struck或threat:true,harm}；plotting{prepared:true,target,means,act,massTarget:boolean}；escape{escaped:true,detentionId,harm}。明确重大公共影响可带publicImpact:"major|mass"。误报/栽赃用allegation:true，指控不自动结算资产或伤害。\n'+
  '已登记案件用caseId：hide实际脱离追踪；locate真实重新识别并给recognition:"visual|scan|verified-report"和placeId或district；普通案跨区继续追击或交接需crossDistrict:"continued-pursuit|handoff"；response-end本次响应实际结束；hold附active表示剧情限制生效/解除；resolve附basis:"accepted-restitution|warning-exit|judgment|acquittal|official-deal"。退赔/驱离仅适用已接受处置的轻微案。长期化解event:"resolve-longterm",warrantId,basis:"acquittal|judgment|official-deal|identity-cleared"。\n'+
  '正式罚款event:"assess-fine"，脚本按案情计算；实际缴纳pay-fine附amount，实际损失赔偿compensate附lossId、amount；正式减免waive-fine附累计amount。付款由程序同批扣对应人物钱包，不再重复输出钱包扣款。付钱不自动释放或结束案件。\n'+
  '实际拘押detain附detentionId,caseIds,facility,durationMinutes；扣押seize附caseId,detentionId,keeper,items:[{itemId,quantity,type:"ordinary|evidence|contraband"}]；restrict附detentionId,slots:[实际已装义体槽]；解除限制unrestrict附detentionId。实际正常获释release附detentionId,basis:"term|bail|acquittal|order"，普通扣押物自动同批归还；escape附detentionId仅登记实际脱逃，再据警方获知提报新的escape罪名案件。越狱不自动归还物品或解除义体限制。个别返还return-seizure附caseId,seizureId，涉案物另需authorized:true。物品由程序同批结算，不重复numericInput。\n'+
  '特别队确已抵达special-arrival附caseId；警方实际查明身份identify附caseId,confirmed:true；玩家实际获知身份暴露或警方线索learn附caseId,identity:true或clue。追捕/搜索/普通及长期标记为面板公开项，其他警方内幕不自动告诉玩家。';}
 return {rules,read,clock,minute,classify,calculate,tick,view,context,correction,correct,hash};
});
