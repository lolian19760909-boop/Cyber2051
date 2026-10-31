/* Narrative tables remain in shujuku. This module validates and projects them. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):root.CxxDataClone);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxMemoryKnowledge=api;})(globalThis,function(Clone){
 'use strict';
 const copy=v=>Clone.clone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const names=['事件记录','人物认知','关系变化'];
 const headers={
  事件记录:['事件编号','类别','内容','参与人物','关联纪要','来源'],
  人物认知:['认知编号','人物编号','事件编号','认知类型','所知内容','获知途径','告知者','取代认知','来源'],
  关系变化:['变化编号','起点人物','指向人物','关系描述','标签','未解问题','事件编号','取代变化','来源']
 };
 const id=s=>typeof s==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(s),str=s=>typeof s==='string'&&s.trim().length>0;
 function source(raw){try{const s=String(raw||''),m=[...s.matchAll(/<cxx-source>([\s\S]*?)<\/cxx-source>/g)].at(-1);return JSON.parse(m?m[1]:s);}catch{return null;}}
 function rows(data,name){const out=[];for(const t of Object.values(data||{}))if(t?.name===name&&Array.isArray(t.content?.[0]))for(const r of t.content.slice(1))if(Array.isArray(r))out.push(Object.fromEntries(t.content[0].map((h,i)=>[h,r[i]??''])));return out;}
 function collect(data,{validSource,actors=[]}={}){
  const actorIds=new Set(actors),issues=[],events=[],knowledge=[],relations=[];
  const actor=value=>id(value)&&actorIds.has(value);
  const issue=(table,row,reason)=>issues.push({table,rowId:row.row_id,reason});
  const valid=(table,row)=>{const s=source(row.来源);if(!s?.ref||!validSource?.(s)){issue(table,row,'来源缺少稳定编号或已失效');return null;}return s;};
  function unique(values,table){const count=new Map();for(const v of values)count.set(v.id,(count.get(v.id)||0)+1);return values.filter(v=>{if(count.get(v.id)===1)return true;issue(table,{row_id:v.rowId},'稳定编号重复');return false;});}
  for(const row of rows(data,names[0])){
   const s=valid(names[0],row);if(!s)continue;let participants;try{participants=JSON.parse(row.参与人物);}catch{}
   if(!id(row.事件编号)||!['已发生','计划','传闻','心声','未确认'].includes(row.类别)||!str(row.内容)||!Array.isArray(participants)||participants.some(a=>!actor(a))||new Set(participants).size!==participants.length){issue(names[0],row,'事件字段无效或人物未登记');continue;}
   events.push({id:row.事件编号,kind:row.类别,text:row.内容,actors:participants,memoryIds:String(row.关联纪要).match(/AM\d{4,}/g)||[],source:s,rowId:row.row_id});
  }
  const ev=unique(events,names[0]),byEvent=new Map(ev.map(e=>[e.id,e]));
  function dependency(row,s){const e=byEvent.get(row.事件编号);return e&&e.source.floor<=s.floor?e:null;}
  for(const row of rows(data,names[1])){
   const s=valid(names[1],row);if(!s)continue;const e=dependency(row,s);
   if(!id(row.认知编号)||!actor(row.人物编号)||!e||!['亲历','知道','听说','怀疑','误解'].includes(row.认知类型)||!str(row.所知内容)||!str(row.获知途径)||row.告知者&&!actor(row.告知者)||row.取代认知&&!id(row.取代认知)){issue(names[1],row,'认知字段、获知事件或人物无效');continue;}
   knowledge.push({id:row.认知编号,actorId:row.人物编号,eventId:e.id,kind:row.认知类型,text:row.所知内容,via:row.获知途径,informant:row.告知者||null,supersedes:row.取代认知||null,source:s,rowId:row.row_id});
  }
  for(const row of rows(data,names[2])){
   const s=valid(names[2],row);if(!s)continue;const e=dependency(row,s);let tags;try{tags=JSON.parse(row.标签);}catch{}
   if(!id(row.变化编号)||!actor(row.起点人物)||!actor(row.指向人物)||row.起点人物===row.指向人物||!e||e.kind!=='已发生'||!str(row.关系描述)||!Array.isArray(tags)||tags.some(t=>!str(t))||row.取代变化&&!id(row.取代变化)){issue(names[2],row,'关系字段、已发生互动或方向无效');continue;}
   relations.push({id:row.变化编号,fromActorId:row.起点人物,toActorId:row.指向人物,text:row.关系描述,tags,unresolved:String(row.未解问题||''),eventId:e.id,supersedes:row.取代变化||null,source:s,rowId:row.row_id});
  }
  function chain(values,table,key){
   const uniqueRows=unique(values,table),map=new Map(uniqueRows.map(v=>[v.id,v])),invalid=new Set();
   for(const v of uniqueRows){let p=v,seen=new Set([v.id]);while(p.supersedes){const prior=map.get(p.supersedes);if(!prior||seen.has(prior.id)||key(prior)!==key(p)||prior.source.floor>p.source.floor){invalid.add(v.id);break;}seen.add(prior.id);p=prior;}}
   let changed=true;while(changed){changed=false;for(const v of uniqueRows)if(v.supersedes&&invalid.has(v.supersedes)&&!invalid.has(v.id)){invalid.add(v.id);changed=true;}}
   const valid=uniqueRows.filter(v=>{if(!invalid.has(v.id))return true;issue(table,{row_id:v.rowId},'取代链缺失、跨人物或成环');return false;}),replaced=new Set(valid.map(v=>v.supersedes).filter(Boolean)),current=valid.filter(v=>!replaced.has(v.id)),counts=new Map();
   for(const v of current)counts.set(key(v),(counts.get(key(v))||0)+1);
   return valid.map(v=>({...v,current:!replaced.has(v.id),conflicted:!replaced.has(v.id)&&counts.get(key(v))>1}));
  }
  return {events:ev,knowledge:chain(knowledge,names[1],v=>v.actorId+'\0'+v.eventId),relations:chain(relations,names[2],v=>v.fromActorId+'\0'+v.toActorId),issues};
 }
 function project(records,{mode='player',actorId}={}){
  if(!['player','author'].includes(mode)||!id(actorId))throw Error('记忆视角无效。');
  // Never attach an event's full text or a second person's private assessment to a cognition.
  const cognition=records.knowledge.filter(k=>k.actorId===actorId).map(k=>mode==='author'?copy(k):{id:k.id,actorId:k.actorId,eventId:k.eventId,kind:k.kind==='误解'?'认为':k.kind,text:k.text,via:k.via,informant:k.informant,supersedes:k.supersedes,current:k.current,conflicted:k.conflicted,source:{floor:k.source.floor,swipe:k.source.swipe}});
  const relations=records.relations.filter(r=>r.fromActorId===actorId).map(r=>mode==='author'?copy(r):{id:r.id,fromActorId:r.fromActorId,toActorId:r.toActorId,text:r.text,tags:copy(r.tags),unresolved:r.unresolved,eventId:r.eventId,supersedes:r.supersedes,current:r.current,conflicted:r.conflicted,source:{floor:r.source.floor,swipe:r.source.swipe}});
  return {actorId,mode,knowledge:cognition,relations,events:mode==='author'?copy(records.events.filter(e=>e.actors.includes(actorId))):[],issues:mode==='author'?copy(records.issues):[]};
 }
 function upgrade(current,template){
  const out=copy(current||{});out.mate={...copy(template.mate),...out.mate};
  for(const [key,t]of Object.entries(template)){if(!key.startsWith('sheet_'))continue;const hits=Object.entries(out).filter(([,v])=>v?.name===t.name);if(hits.length>1)throw Error('存在同名记忆表，请先核对：'+t.name);
   if(!hits.length){if(out[key]!==undefined)throw Error('记忆表编号已被其他数据使用：'+key);out[key]=copy(t);continue;}
   const [oldKey,old]=hits[0];if(!Array.isArray(old.content?.[0])||t.content[0].some(h=>!old.content[0].includes(h)))throw Error('记忆表缺少既有列，未自动改写：'+t.name);
   const exact=same(old.content[0],t.content[0]);out[oldKey]={...old,sourceData:{...old.sourceData,...copy(t.sourceData),ddl:exact?t.sourceData.ddl:old.sourceData?.ddl},exportConfig:{...old.exportConfig,...copy(t.exportConfig)}};
  }
  // Template import uses seed mode; passing populated rows here would seed them again.
  for(const t of Object.values(out))if(Array.isArray(t?.content))t.content=[t.content[0]];
  return out;
 }
 function preserved(before,after){for(const [key,old]of Object.entries(before||{})){if(!Array.isArray(old?.content))continue;const next=after?.[key];if(!next||next.name!==old.name||!same(next.content,old.content))throw Error('记忆模板更新后的原记录尚未读回一致：'+old.name);}return true;}
 return {names,headers,source,rows,collect,project,upgrade,preserved};
});
