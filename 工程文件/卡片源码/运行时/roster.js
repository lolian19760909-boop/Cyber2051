/* Scene-local NPC settlement. Actor records remain the sole numeric owner. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(local?require('./ensemble-state.js'):root.CxxEnsembleState,local?require('../数值引擎/src/engine.js'):root.CxxNumericEngine,local?require('./ensemble-content.js'):root.CxxEnsembleContent,local?require('../共享/data-clone.js'):root.CxxDataClone);if(local)module.exports=api;else root.CxxRoster=api;})(globalThis,function(A,E,C,Clone){
 'use strict';
 const Parser=()=>typeof module==='object'&&module.exports?require('../Gal/parser.js'):globalThis.CxxGalParser;
 const copy=v=>Clone.clone(v),same=E.same,version='2051-npc-1',inputPath='/terminal/rosterInput';
 const profiles=new Map(C.actors.map(p=>[p.actorId,p])),names=new Map();
 for(const p of C.actors)for(const name of [p.actorId,p.name,...(p.roster?.aliases||[])]){if(names.has(name)&&names.get(name)!==p.actorId)names.set(name,null);else names.set(name,p.actorId);}
 const id=v=>{if(typeof v!=='string'||(!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v)||['constructor','prototype','__proto__'].includes(v)))throw Error('NPC事件需要稳定编号。');return v;};
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),get=(v,p)=>p.reduce((x,k)=>x?.[k],v);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),factor=g=>clamp(1-.04*(g.growth?.attributes?.cool||0),.2,1);
 const baseLoss=part=>({face:5,skin:8,skeleton:8,legs:8,arms:12,os:10,frontal:10,nervous:15,circulatory:8,hands:8})[part]||8;
 const refund=part=>({face:3,skin:4,skeleton:4,legs:4,arms:6,os:5,frontal:5,nervous:8,circulatory:4,hands:4})[part]||4;
 function game(stat,actorId){return actorId==='player'?stat.terminal?.gameplay:stat.terminal?.ensemble?.actors?.[actorId]?.gameplay;}
 function sanity(g,p){
  if(g.sanity!==undefined){const s=g.sanity;if(!object(s)||s.schema!==1||!Number.isFinite(s.value)||s.value<0||s.value>100||!object(s.receipts)||!object(s.implants))throw Error('已有SAN记录无效，原记录已保留。');return s;}
  const s={schema:1,rulesRef:version,value:p?.roster?.san??100,psychosis:(p?.roster?.san??100)<=20,course:0,medications:0,addiction:0,firstKills:0,receipts:{},implants:{},dead:false};
  // Existing SAN is an opening balance, not proof of a historic surgery payment.
  for(const item of E.loadout.list(g))if(item.definition.category==='cyberware')s.implants[item.record.instanceId||item.slot]={paid:0,recovered:false,source:'opening-balance'};
  g.sanity=s;return s;
 }
 function initialize(stat){
  if(!stat?.terminal?.gameplay?.growth)return copy(stat);
  if(stat.terminal.roster?.seedVersion===version)return copy(stat);
  const existing=new Set(Object.keys(stat.terminal.ensemble?.actors||{})),next=A.initialize(stat);
  for(const p of C.actors){const g=game(next,p.actorId);sanity(g,p);if(!existing.has(p.actorId)&&p.roster?.hpRatio!==undefined){g.numeric.vitals.hp=Math.round(g.numeric.vitals.hp*p.roster.hpRatio);g.numeric.vitals.stamina=p.roster.stamina??g.numeric.vitals.stamina;}}
  sanity(next.terminal.gameplay,null);
  next.terminal.roster={schema:1,...copy(stat.terminal.roster||{}),seedVersion:version,present:copy(stat.terminal.roster?.present||[next.terminal.ensemble.control.actorId]),lastSeen:copy(stat.terminal.roster?.lastSeen||{}),receipts:copy(stat.terminal.roster?.receipts||{})};
  return next;
 }
 function resolve(value){return value==='player'?'player':names.get(value)||null;}
 function attendance(raw,stat){
  const result=new Set(),control=stat.terminal?.ensemble?.control?.actorId||'player';result.add(control);
  let scene=null;const text=String(raw||'');
  for(const row of Parser().inspect(text,{scenePayload:true}).roots.filter(row=>row.kind==='ztl'&&row.complete))try{const value=JSON.parse(text.slice(row.bodyStart,row.closeStart));if(Array.isArray(value?.characters))scene=value;}catch{}
  if(!scene)for(const actorId of stat.terminal?.roster?.present||[])result.add(actorId);
  if(scene){for(const row of scene.characters||[]){if(!object(row)||row.remote===true||['remote','mentioned','absent','parallel'].includes(row.presence))continue;const actorId=resolve(row.actorId||row.name);if(actorId)result.add(actorId);}}
  // An explicit active battle participant is physically present, even if ztl omitted it.
  const combat=game(stat,control)?.numeric?.combat;if(combat?.active)for(const row of [...(combat.allies||[]),...(combat.enemies||[])]){const actorId=resolve(row.actorId)||resolve(row.id)||resolve(row.name);if(actorId)result.add(actorId);}
  return [...result].filter(x=>game(stat,x));
 }
 const factKey=e=>JSON.stringify([e.actorId,e.id]);
 const effectKey=e=>JSON.stringify([e.kind,e.type||'',e.resource||'',e.amount??null,e.category||'',e.completed??null,e.itemId||'',e.consumptionId||'']);
 const anchor=(e,source)=>JSON.stringify([source?.messageId||source?.story||source?.floor,source?.variantId||source?.swipe,factKey(e)]);
 const numeric=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()?Number(value):NaN;
 function prepare(before,patches,policy={}){
  const options=policy.numericOptions||{},raw=options.rawStory,inputs=patches.filter(p=>p.path===inputPath);
  if(patches.some(p=>/^\/terminal\/roster(?:\/|$)/.test(p.path)||/^\/terminal\/gameplay\/sanity(?:\/|$)/.test(p.path)||/^\/terminal\/ensemble\/actors\/[^/]+\/gameplay\/sanity(?:\/|$)/.test(p.path)))throw Error('NPC状态和SAN只接受事实输入，不可直接覆盖。');
  if(!raw&&!inputs.length||options.source?.floor===0&&!inputs.length)return null;
  if(!before?.terminal?.gameplay?.growth){if(inputs.length)throw Error('先完成玩家建档，再登记NPC事实。');return null;}
  const base=initialize(before),present=attendance(raw,base),source=copy(options.source||{messageId:'story_'+E.loadout.hash(String(raw||''))}),ignored=[],facts=new Map(),paths={};let index=0;
  for(const input of inputs){if(!Array.isArray(input.value)){ignored.push({path:inputPath,reason:'需要可读取的事实数组，已保留原状态。'});continue;}
   for(const value of input.value){const path=inputPath+'['+(index++)+']';try{
    if(!object(value))throw Error('需要可读取的事实对象。');const e=copy(value),reported=e.actorId||e.actor,actorId=resolve(reported)||Object.keys(base.terminal.ensemble.actors).find(key=>key===reported||base.terminal.ensemble.actors[key]?.name===reported);
    if(!actorId||!game(base,actorId))throw Error('人物无法识别，已保留其原状态。');e.actorId=actorId;
    try{id(e.id);}catch{e.id='event_'+E.loadout.hash(JSON.stringify([source.messageId||source.story||source.floor,path,actorId,e.kind]));}
    if(!['resource','shock','support','medicate','death','achievement'].includes(e.kind))throw Error('kind 无法读取：'+String(e.kind));
    if(e.amount!==undefined){const amount=numeric(e.amount);if(!Number.isFinite(amount))throw Error('amount 需要可读取的数值，已保留该项原值。');e.amount=clamp(amount,-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER);}
    if(e.kind==='resource'&&(!['hp','stamina','ram'].includes(e.resource)||e.amount===undefined))throw Error('resource/amount 需要资源名称及变化量，已保留该项原值。');
    if(e.kind==='achievement'||e.kind==='death')e.completed=e.completed===undefined?true:e.completed==='true'?true:e.completed==='false'?false:e.completed;
    if(typeof e.quote!=='string')delete e.quote;if(typeof e.reason!=='string'||!e.reason.trim())e.reason=e.quote||'模型登记的剧情变化';
    const key=factKey(e);if(facts.has(key)){if(effectKey(facts.get(key))!==effectKey(e))ignored.push({path,reason:'同一事件编号重复声明，沿用本轮首次记录。'});continue;}
    facts.set(key,e);paths[key]=path;
   }catch(error){ignored.push({path,reason:error.message});}}
  }
  return {base,present,events:[...facts.values()],eventPaths:paths,ignored,source,raw,patches:patches.filter(p=>p.path!==inputPath),computed:[]};
 }
 function allocateNPC(g,p){
  if(!p)return;let draft=E.growth.build(g.growth),state=E.growth.read(g.growth),priority=p.roster?.priority||E.growth.attributes;
  while(state.attributePoints){const key=priority.find(k=>draft.attributes[k]<20);if(!key)break;draft.attributes[key]++;state=E.growth.allocate(g.growth,draft);}
  for(let guard=0;guard<300&&state.perkPoints;guard++){const candidates=Object.keys(E.talents.definitions).map(key=>{try{return E.growth.node(key);}catch{return null;}}).filter(Boolean).filter(n=>['available','invested'].includes(E.growth.status(state,n.id))).sort((a,b)=>priority.indexOf(a.attribute)-priority.indexOf(b.attribute));if(!candidates.length)break;draft.perks[candidates[0].id]=(draft.perks[candidates[0].id]||0)+1;state=E.growth.allocate(g.growth,draft);}
  g.growth=state;
 }
 function phase(s,before){if(s.value<=20)s.psychosis=true;if(before<60&&s.value>=60){s.psychosis=false;s.course++;s.medications=0;}s.checkModifier=s.addiction>=3?-10:0;}
 function settleMind(g,previous,p,events,raw,source,ignored=[],paths={}){
  const s=sanity(g,p),shock={ 'friend-injured':40,'companion-death':55,'kill-loved':70,'psychosis-witness':45,'ice-overload':30,betrayal:40,'first-kill':10};
  for(const e of events){try{const prior=s.receipts[e.id],fact=copy(e);if(prior)continue;
   const key=anchor(e,source);
   if(Object.values(s.receipts).some(r=>r.anchor===key))continue;
   let delta=0;const priorValue=s.value;
   if(e.kind==='shock'){
    if(e.amount!==undefined)delta=e.amount;
    else{if(!Object.hasOwn(shock,e.type))throw Error('type/amount 无法读取，已保留SAN原值。');if(e.type==='first-kill'){if((p?.roster?.rookie||!p&&g.growth?.originId==='student')&&s.firstKills<2){delta=-Math.round(shock[e.type]*factor(g));s.firstKills++;}}else delta=-Math.round(shock[e.type]*factor(g));}
   }else if(e.kind==='support'){if(e.amount!==undefined)delta=e.amount;else{if(!['reconcile','redemption'].includes(e.type))throw Error('type/amount 无法读取，已保留SAN原值。');delta=e.type==='redemption'?35:10;}}
   else if(e.kind==='medicate'){
    delta=e.amount??[20,15,10,5][Math.min(3,s.medications)];s.medications++;s.addiction++;
   }else if(e.kind==='death'){if(e.completed===false)continue;s.dead=true;if(!['digital','engram'].includes(p?.roster?.form))g.numeric.vitals.hp=0;}
   else if(['achievement','resource'].includes(e.kind)){delta=0;}
   else throw Error('未支持的NPC事实类型。');
   s.value=clamp(s.value+delta,0,100);phase(s,priorValue);
   s.receipts[e.id]={event:fact,source:copy(source),anchor:key,delta,value:s.value};
  }catch(error){ignored.push({path:paths[factKey(e)]||inputPath,reason:error.message});}
  }
 }
 function implantChanges(g,prior,p,source){
  const s=sanity(g,p),priorValue=s.value,old=E.loadout.list(prior||{}),now=E.loadout.list(g),key=r=>r.record.instanceId||r.slot;
  for(const r of now)if(r.definition.category==='cyberware'&&!old.some(v=>key(v)===key(r))){const loss=Math.round(baseLoss(r.definition.part)*factor(g));s.value=clamp(s.value-loss,0,100);s.implants[key(r)]={paid:loss,recovered:false,source:copy(source)};}
  for(const r of old)if(r.definition.category==='cyberware'&&!now.some(v=>key(v)===key(r))){const paid=s.implants[key(r)];if(paid&&!paid.recovered){s.value=clamp(s.value+Math.min(paid.paid,refund(r.definition.part)),0,100);paid.recovered=true;}}
  phase(s,priorValue);
 }
 function set(target,path,value){let at=target;for(const k of path.slice(0,-1)){at[k]??={};at=at[k];}at[path.at(-1)]=copy(value);}
 function changes(before,after,present){const result=[];function add(path){const a=get(before,path),b=get(after,path);if(!same(a,b))result.push({path,missing:a===undefined,before:a===undefined?null:copy(a),after:copy(b)});}
  if(!before.terminal?.ensemble)add(['terminal','ensemble']);else for(const actorId of new Set([...present,...(before.terminal.roster?.seedVersion===version?[]:Object.keys(after.terminal.ensemble.actors))])){if(actorId==='player')continue;const row=after.terminal.ensemble.actors[actorId],prev=before.terminal.ensemble.actors[actorId],base=['terminal','ensemble','actors',actorId];if(!prev)add(base);else for(const k of Object.keys(row.gameplay||{}))add([...base,'gameplay',k]);}
  add(['terminal','roster']);if(present.includes('player'))for(const k of Object.keys(after.terminal.gameplay))add(['terminal','gameplay',k]);else add(['terminal','gameplay','sanity']);return result;}
 function combine(before,rt,inner){
  const after=copy(rt.base);for(const c of inner?.changes||[])set(after,c.path,c.after);
  const control=after.terminal.ensemble.control.actorId;
  const combatOwners=[...new Set(['player',control,...(inner?.ensembleTransactions||[]).map(r=>r.actorId)])],owned=new Set();
  for(const owner of combatOwners)for(const actorId of syncCombat(rt.base,after,owner))owned.add(actorId);
  const reportedActors=new Set([...rt.present,...rt.events.map(e=>e.actorId),...rt.patches.map(p=>/^\/terminal\/ensemble\/actors\/([^/]+)\//.exec(p.path)?.[1]).filter(Boolean)]);
  for(const actorId of reportedActors){const g=game(after,actorId),old=game(rt.base,actorId),p=profiles.get(actorId);if(!g)continue;
   const mind=sanity(g,p),failed=new Set(),ignore=(e,error)=>{failed.add(e.id);rt.ignored.push({path:rt.eventPaths[factKey(e)]||inputPath,reason:error.message});},events=rt.events.filter(e=>e.actorId===actorId).filter(e=>{const prior=mind.receipts[e.id];if(!prior)return true;if(effectKey(prior.event)!==effectKey(e))rt.ignored.push({path:rt.eventPaths[factKey(e)]||inputPath,reason:'该事件编号已有记录，保留原值。'});return false;});
   const rewards=events.filter(e=>e.kind==='achievement');for(const e of rewards)try{const fact={id:e.id,kind:e.kind,source:e.source,category:e.category,completed:e.completed,reason:e.reason};if(Object.values(g.growth.rewards).some(r=>r.program==='quest-completion'&&r.award?.source?.kind===e.source?.kind&&r.award?.source?.id===e.source?.id))continue;const planned=E.growth.planAchievement(g.growth,fact);g.growth=planned.state;if(!planned.duplicate)g.growth.rewards[e.id].origin=copy(rt.source);}catch(error){ignore(e,error);}
   for(const e of events.filter(e=>e.kind==='resource'))try{if(owned.has(actorId))throw Error('本轮参战者资源已由交锋回执记录，保留该结果。');const r=E.settle(g,[{id:e.id,kind:'resource',resource:e.resource,amount:e.amount,reason:e.reason}],{source:rt.source});Object.assign(g,r.state);}catch(error){ignore(e,error);}
   if(actorId!=='player'&&actorId!==control&&g.growth.xp!==old.growth.xp)allocateNPC(g,p);
   implantChanges(g,old,p,rt.source);settleMind(g,old,p,events.filter(e=>!failed.has(e.id)),rt.raw,rt.source,rt.ignored,rt.eventPaths);rt.computed.push(actorId);
   const max=E.maximums(g.growth.perks,E.rules,E.loadout.effects(g),g.growth);for(const k of Object.keys(max))g.numeric.vitals[k]=Math.min(g.numeric.vitals[k],max[k]);
  }
  const roster=after.terminal.roster;for(const patch of rt.patches){const m=/^\/terminal\/ensemble\/actors\/([^/]+)\/wallet(?:\/|$)/.exec(patch.path);if(m)roster.walletObserved=[...new Set([...(roster.walletObserved||[]),m[1]])];}roster.present=copy(rt.present);for(const actorId of rt.present)roster.lastSeen[actorId]=copy(rt.source);roster.lastSettlement={source:copy(rt.source),actors:copy(rt.computed)};
  const own=changes(before,after,[...reportedActors]),overlap=p=>own.some(c=>p===('/'+c.path.join('/'))||p.startsWith('/'+c.path.join('/')+'/'));
  const ordinary=(inner?.patches||rt.patches).filter(p=>!overlap(p.path)),patches=[...ordinary,...own.map(c=>({op:c.missing?'add':'replace',path:'/'+c.path.join('/'),value:copy(c.after)}))];
  return {...inner,ignored:[...(inner?.ignored||[]),...rt.ignored],changes:[...(inner?.changes||[]).filter(c=>!overlap('/'+c.path.join('/'))),...own],patches,roster:{base:rt.base,inner,innerAfter:(()=>{const s=copy(rt.base);for(const c of inner?.changes||[])set(s,c.path,c.after);return s;})(),present:rt.present,computed:rt.computed},applied:[...(inner?.applied||[]),...rt.events.map(e=>e.id)]};
 }
 function project(stat,actorId){const p=profiles.get(actorId),g=game(stat,actorId);if(!g?.growth||!g.numeric)return null;const max=E.maximums(g.growth.perks,E.rules,E.loadout.effects(g),g.growth),s=g.sanity,form=p?.roster?.form||'human',physical=!['digital','engram'].includes(form),actor={level:g.growth.level,attributes:g.growth.attributes,perks:g.growth.perks,equipment:E.loadout.effects(g),vitals:g.numeric.vitals};
  const labels=[];if(s?.dead)labels.push('死亡');else{if(physical&&g.numeric.vitals.hp===0)labels.push('失能');else if(physical&&g.numeric.vitals.hp/max.hp<.6)labels.push('负伤');if(s?.psychosis)labels.push('赛博精神病'+(s.value>20?'·稳定期':''));else if(s?.value<60)labels.push('精神承压');}const state=labels.join(' / ')||(s?'健康':'SAN未记录');
  return {actorId,name:p?.name||'玩家',form,physical,state,san:s?.value??null,level:g.growth.level,xp:g.growth.xp,attributePoints:g.growth.attributePoints,perkPoints:g.growth.perkPoints,attributes:copy(g.growth.attributes),perks:copy(g.growth.perks),power:Math.round(E.resolveEffects(actor).power*100)/100,vitals:{...copy(g.numeric.vitals),hp:physical?g.numeric.vitals.hp:null},maxima:{...max,hp:physical?max.hp:null},present:(stat.terminal.roster?.present||[]).includes(actorId),lastSeen:copy(stat.terminal.roster?.lastSeen?.[actorId]||null),loreEquipment:copy(p?.roster?.loreEquipment||[])};
 }
 const protocol='【NPC剧情状态】依据本轮正文与人物处境推导已发生的变化，程序记录并展示。用add /terminal/rosterInput提交事实数组，每项{id:稳定事件编号,actor:准确姓名,kind,quote:可选原句或概述}。ztl用于记录当前场景名单；有明确事件时按实际受影响人物登记。资源kind:"resource"另带resource:"hp|stamina|ram"、amount:有符号变化量、reason。成长kind:"achievement"另带source:{kind:"story|training|activity|quest",id:稳定成果编号},category:"small|stage|gig|major",completed:true,reason。SAN冲击kind:"shock",type:"friend-injured|companion-death|kill-loved|psychosis-witness|ice-overload|betrayal|first-kill"；恢复kind:"support",type:"reconcile|redemption"；药物kind:"medicate"另带itemId与consumptionId，按剧情登记实际使用。上述SAN事件可用amount明确给出推导的有符号增量；省略时采用现有type参考值或药物恢复梯度。实际死亡用kind:"death",completed:true登记。成瘾≥3的能力判定参考修正为−10；HP零为失能，SAN≤20触发赛博精神病，恢复到60解除。每项独立事实使用稳定id，同一事实续写与保存重试沿用原id；原文重写从父状态重算。交锋回执和义体装卸已记录的变化沿用其结果，其余剧情变化按实际发生情况登记。';
 function context(stat){return (stat?.terminal?.roster?.present||[]).map(actorId=>project(stat,actorId)).filter(Boolean).map(r=>({actorId:r.actorId,name:r.name,level:r.level,xp:r.xp,attributes:r.attributes,perks:r.perks,vitals:r.vitals,san:r.san,state:r.state,maxima:r.maxima,power:r.power,gear:E.loadout.list(game(stat,r.actorId)).map(x=>({slot:x.slot,name:x.definition.name,tier:x.definition.tier})),sanItems:Object.entries(game(stat,r.actorId).inventory||{}).filter(([id,v])=>id!=='$meta'&&v?.quantity>0).map(([id,v])=>({id,quantity:v.quantity,name:E.loadout.get(game(stat,r.actorId),id,v.definitionRef)?.name||id})).filter(x=>/镇静|神经稳定|精神稳定|抑制剂/.test(x.name)),checkModifier:game(stat,r.actorId)?.sanity?.addiction>=3?-10:0}));}
 // Read-only model view. All wallets remain available for a newly arriving NPC;
 // present, controlled and explicitly referenced actors retain their full state.
 function promptVariables(stat){
  const next=copy(stat);if(!next?.terminal)return next;delete next.terminal.variableEdits;
  for(const g of [next.terminal.gameplay,...Object.values(next.terminal.ensemble?.actors||{}).map(row=>row.gameplay)])if(g?.growth)delete g.growth.corrections;
  return next;
 }
 function promptState(stat,{text='',actorId}={}){
  if(!stat?.terminal)return null;const t=stat.terminal,active=new Set([...(t.roster?.present||[]),actorId||t.ensemble?.control?.actorId||'player']);
  const actors={};for(const [key,row]of Object.entries(t.ensemble?.actors||{})){
    if(row.name&&String(text).includes(row.name))active.add(key);
    const g=row.gameplay,selected=active.has(key),entry={actorId:row.actorId,name:row.name,worldbookUid:row.worldbookUid,stateRef:copy(row.stateRef),...(row.stateRef?.kind==='legacy-player'?{}:{wallet:row.wallet===undefined?null:copy(row.wallet)})};
    if(g)entry.gameplay=selected?copy(g):{location:copy(g.location??null),inventory:copy(g.inventory||{}),equipment:copy(g.equipment||{}),growth:g.growth?{level:g.growth.level,attributes:copy(g.growth.attributes),perks:copy(g.growth.perks)}:null,numeric:{vitals:copy(g.numeric?.vitals??null)},sanity:g.sanity?{value:g.sanity.value,psychosis:g.sanity.psychosis,dead:g.sanity.dead,addiction:g.sanity.addiction}:null};
    actors[key]=entry;
  }
  return promptVariables({terminal:{wallet:copy(t.wallet??null),quests:copy(t.quests||{}),gameplay:copy(t.gameplay??null),ensemble:t.ensemble?{control:copy(t.ensemble.control),actors}:null,roster:t.roster?{present:copy(t.roster.present||[]),lastSeen:copy(t.roster.lastSeen||{})}:null}});
 }
 function syncCombat(before,after,owner){
  const old=game(before,owner)?.numeric?.combat,now=game(after,owner)?.numeric?.combat,changed=[];
  if(!old||!now||old.id!==now.id)return changed;
  const previous=[...(old.allies||[]),...(old.enemies||[])];
  for(const row of [...(now.allies||[]),...(now.enemies||[])]){const actorId=resolve(row.actorId||row.name),prior=previous.find(v=>v.id===row.id),g=game(after,actorId);if(!g||actorId===owner||!prior||['digital','engram'].includes(profiles.get(actorId)?.roster?.form))continue;
   const max=E.maximums(g.growth.perks,E.rules,E.loadout.effects(g),g.growth);let did=false;
   for(const k of ['hp','stamina','ram']){const delta=(row.vitals?.[k]??0)-(prior.vitals?.[k]??0);if(delta){g.numeric.vitals[k]=clamp(Math.round((g.numeric.vitals[k]+delta)*100)/100,0,max[k]);did=true;}}
   if(did)changed.push(actorId);
  }return changed;
 }
 function program(before,after,actorId,request={}){const g=game(after,actorId);if(g?.sanity)implantChanges(g,game(before,actorId),profiles.get(actorId),{kind:'player-operation'});
  const c=g?.numeric?.combat;
  if(['battle-start','battle-roster'].includes(request.action)&&c?.mode==='system')for(const row of [...(c.allies||[]),...(c.enemies||[])]){const who=resolve(row.actorId||row.name),other=game(after,who);if(!other||who===actorId||['digital','engram'].includes(profiles.get(who)?.roster?.form))continue;row.actorId=who;row.level=other.growth.level;row.attributes=copy(other.growth.attributes);row.perks=copy(other.growth.perks);row.equipment=E.loadout.effects(other);row.vitals=copy(other.numeric.vitals);}
  syncCombat(before,after,actorId);return after;
 }
 // Link an actual quest completion to the same growth transaction. A model's
 // already registered receipt for this quest wins; completion cannot pay twice.
 function questRewards(before,transaction,quest,policy){
  if(!transaction?.roster||!quest)return transaction;
  const after=copy(before);for(const c of transaction.changes)set(after,c.path,c.after);
  const final=copy(after);for(const p of quest.patches)if(p.path.startsWith('/terminal/quests/')){const keys=p.path.slice(1).split('/');set(final,keys,p.value);}
  const touched=[];
  for(const [questId,q]of Object.entries(final.terminal?.quests||{})){
   const actorId=q?.ownerActorId||'player',g=game(after,actorId);
   if(q?.state!=='完成'||before.terminal?.quests?.[questId]?.state==='完成'||!transaction.roster.present.includes(actorId)||!g?.growth)continue;
   if(Object.values(g.growth.rewards).some(r=>r.award?.source?.kind==='quest'&&r.award.source.id===questId))continue;
   const result=E.growth.planAchievement(g.growth,{id:'quest_done_'+E.loadout.hash(actorId+':'+questId),kind:'achievement',source:{kind:'quest',id:questId},category:'gig',completed:true,reason:'完成委托：'+(q.title||questId)});g.growth=result.state;const receipt=g.growth.rewards['quest_done_'+E.loadout.hash(actorId+':'+questId)];receipt.program='quest-completion';receipt.origin=copy(policy.numericOptions?.source||null);
   if(actorId!=='player'&&actorId!==after.terminal.ensemble.control.actorId)allocateNPC(g,profiles.get(actorId));touched.push(actorId);
  }
  if(!touched.length)return transaction;
  const changes=copy(transaction.changes);
  for(const actorId of touched){const path=actorId==='player'?['terminal','gameplay','growth']:['terminal','ensemble','actors',actorId,'gameplay','growth'],parent=changes.find(c=>path.slice(0,c.path.length).join('/')===c.path.join('/'));
   if(parent)parent.after=copy(get(after,parent.path));else changes.push({path,missing:false,before:copy(get(before,path)),after:copy(get(after,path))});
  }
  const owned=p=>transaction.changes.some(c=>p.path==='/'+c.path.join('/'));
  const patches=[...quest.patches.filter(p=>!owned(p)),...changes.map(c=>({op:c.missing?'add':'replace',path:'/'+c.path.join('/'),value:copy(c.after)}))];
  quest.patches=patches;return {...transaction,changes,patches};
 }
 function settlement(g,rewardIds){
  const rows=rewardIds.map(id=>g.growth.rewards[id]).filter(r=>r?.award&&r.earned);if(!rows.length)return null;
  const fromLevel=rows[0].fromLevel,toLevel=rows.at(-1).toLevel,earned=rows.reduce((s,r)=>({xp:s.xp+r.earned.xp,attributePoints:s.attributePoints+r.earned.attributePoints,perkPoints:s.perkPoints+r.earned.perkPoints}),{xp:0,attributePoints:0,perkPoints:0});
  const hp=level=>E.maximums(g.growth.perks,E.rules,E.loadout.effects(g),{...g.growth,level}).hp,hpMax=hp(toLevel)-hp(fromLevel),reasons=rows.map(r=>r.fact?.reason||r.award.source?.id||'成长成果');
  const lines=['+'+earned.xp+' XP',...(toLevel>fromLevel?['Lv.'+fromLevel+' → Lv.'+toLevel]:[]),...(hpMax>0?['生命上限 +'+hpMax]:[]),...(earned.attributePoints?['+'+earned.attributePoints+' 属性点']:[]),...(earned.perkPoints?['+'+earned.perkPoints+' 专长点']:[])];
  return {...earned,fromLevel,toLevel,hpMax,reasons,text:lines.join(' · ')};
 }
 function progress(g,{receipt=null,actorId='player'}={}){if(!g?.growth)return null;const s=E.growth.read(g.growth),i=Math.max(0,s.level-(s.levelOffset||0)-1),row=E.growth.rules.levels[i],next=E.growth.rules.levels[i+1],ids=Object.keys(s.rewards||{}).filter(id=>s.rewards[id]?.award),reward=receipt?.phase==='saved'&&receipt.growth?.actorId===actorId?settlement(g,receipt.growth.rewardIds||[]):null;return {level:s.level,xp:s.xp,into:s.xp-row.xp,required:next?next.xp-row.xp:null,remaining:next?Math.max(0,next.xp-s.xp):0,attributePoints:s.attributePoints,perkPoints:s.perkPoints,lastReward:copy(s.rewards[ids.at(-1)]||null),lastSummary:ids.length?settlement(g,ids.slice(-1)):null,currentSummary:reward,san:g.sanity?.value??null,checkModifier:g.sanity?.addiction>=3?-10:0};}
 return {version,inputPath,initialize,attendance,prepare,combine,project,context,promptState,promptVariables,resolve,protocol,profiles,allocateNPC,program,progress,questRewards};
});
