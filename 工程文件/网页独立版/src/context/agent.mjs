/** Selection layer: one TurnInput in, one SelectionPlan out, consumed by worldbook assembly.
 *  U01 keeps this layer pure: no host objects, no storage writes, ids stay strings. */
export const SELECTION_SCHEMA=1;
const list=value=>Array.isArray(value)?value:[];
const ids=value=>[...new Set(list(value).map(row=>String(row)))];
export function emptyPlan(inputRef=null){
  return {schema:SELECTION_SCHEMA,inputRef,managedIds:[],selectedIds:[],requiredIds:[],removedIds:[],evidence:[],conflicts:[],placements:[],bookChanges:[],calls:[],extensions:{},budget:{estimatedInputTokens:0,actualUsage:null}};
}
function normalizePlacements(rows){
  return list(rows).filter(row=>row&&row.entryId!==undefined).map(row=>{
    const placement={entryId:String(row.entryId)};
    if(Number.isInteger(row.position))placement.position=row.position;
    if(Number.isInteger(row.depth))placement.depth=row.depth;
    if(typeof row.role==='string')placement.role=row.role;
    if(Number.isInteger(row.order))placement.order=row.order;
    return placement;
  });
}
function normalizeChanges(rows){
  return list(rows).filter(row=>row&&row.entryId!==undefined).map(row=>({bookId:row.bookId==null?null:String(row.bookId),entryId:String(row.entryId),fields:{...(row.fields||{})}}));
}
/** Coerce any producer's plan into the documented shape; unknown members are dropped, never guessed. */
export function normalizePlan(plan,{inputRef=null,missing=[]}={}){
  const base=emptyPlan(plan?.inputRef??inputRef??null),source=plan||{};
  const managed=ids(source.managedIds),selected=ids(source.selectedIds).filter(id=>managed.includes(id)),required=ids(source.requiredIds).filter(id=>managed.includes(id)),removed=ids(source.removedIds).filter(id=>managed.includes(id));
  const both=selected.filter(id=>required.includes(id));
  for(const id of both)missing.push('条目同时被选中和保护：'+id);
  return {
    schema:SELECTION_SCHEMA,
    inputRef:base.inputRef,
    managedIds:managed,
    selectedIds:selected.filter(id=>!required.includes(id)),
    requiredIds:required,
    removedIds:removed,
    evidence:list(source.evidence).map(row=>({entryId:String(row?.entryId??''),sourceIds:ids(row?.sourceIds),reason:String(row?.reason??''),...(row?.kind?{kind:String(row.kind)}:{})})).filter(row=>row.entryId),
    conflicts:list(source.conflicts).map(row=>({group:String(row?.group??''),winner:String(row?.winner??'')})).filter(row=>row.group),
    placements:normalizePlacements(source.placements),
    bookChanges:normalizeChanges(source.bookChanges),
    calls:list(source.calls).map(row=>({stage:String(row?.stage??''),purpose:String(row?.purpose??'')})).filter(row=>row.stage),
    pages:list(source.pages).map(row=>({uid:String(row?.uid??''),segments:Math.max(1,Number(row?.segments)||1)})).filter(row=>row.uid),
    pendingQueries:list(source.pendingQueries).map(row=>({uid:String(row?.uid??''),reason:String(row?.reason??'')})).filter(row=>row.uid),
    budget:{estimatedInputTokens:Number(source.budget?.estimatedInputTokens)||0,actualUsage:source.budget?.actualUsage??null},
    strategy:String(source.strategy||''),mode:String(source.mode||''),signature:source.signature??null,reason:String(source.reason||''),
    extensions:source.extensions&&typeof source.extensions==='object'?structuredClone(source.extensions):{},
  };
}
/** Sets and lookup tables the assembly layer needs, computed once per turn. */
export function selectionSets(plan,resolve=id=>id){
  const managed=new Set((plan?.managedIds||[]).map(id=>resolve(id))),selected=new Set((plan?.selectedIds||[]).map(id=>resolve(id))),required=new Set((plan?.requiredIds||[]).map(id=>resolve(id))),removed=new Set((plan?.removedIds||[]).map(id=>resolve(id)));
  const placements=new Map((plan?.placements||[]).map(row=>[resolve(row.entryId),row])),changes=new Map((plan?.bookChanges||[]).map(row=>[resolve(row.entryId,row.bookId),row.fields||{}]));
  return {managed,selected,required,removed,placements,changes};
}
/** The one entry point session calls. planFor is injected: a manual plan today, a model selector later. */
export function createSelectionAgent({planFor=null,requestPurpose=null,fallback=null}={}){
  const prepare=async turnInput=>{
    const missing=[];
    let raw=null;
    if(typeof planFor==='function')raw=await planFor(turnInput);
    else if(planFor&&typeof planFor==='object')raw=planFor;
    if(!raw&&typeof fallback==='function')raw=await fallback(turnInput);
    if(requestPurpose&&!raw)raw=await requestPurpose('selection',turnInput);
    const plan=normalizePlan(raw,{inputRef:turnInput?.request?.attemptId??null,missing});
    if(typeof planFor!=='function'&&(!plan.managedIds.length))plan.calls=[...plan.calls,{stage:'catalog',purpose:'selection-pending'}];
    if(missing.length)plan.evidence=[...plan.evidence,{entryId:'',sourceIds:[],reason:missing.join('；')}];
    return plan;
  };
  return {prepare};
}

/* ---------- U04：两套目录策略（同一模块下的不同策略函数，共用 TurnInput／目录／事实／requestPurpose） ---------- */
export const STRATEGY_SCHEMA=1;
/** 参数是原模块的局部作用域：斗罗分类并发 4；命定目录 50／条目 45 一批；每轮最多两次补查。
 *  “两次补查”只约束命定这一层，不是整个系统的调用上限。 */
export const STRATEGY_PARAMS={douluo:{classifyConcurrency:4,catalogBatch:50,entryBatch:45,lookupsPerTurn:2},destiny:{catalogBatch:50,entryBatch:45,lookupsPerTurn:2}};
const fnv=value=>{let h=0x811c9dc5;const text=String(value);for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');};
export const chunks=(rows,size)=>list(rows).reduce((out,row,index)=>{if(index%size===0)out.push([]);out[out.length-1].push(row);return out;},[]);
export async function mapLimit(rows,limit,worker){
  const input=list(rows),out=new Array(input.length);let cursor=0,failed=false;
  const lanes=Array.from({length:Math.max(1,Math.min(limit,input.length||1))},async()=>{for(;!failed;){const index=cursor++;if(index>=input.length)return;try{out[index]=await worker(input[index],index);}catch(error){failed=true;throw error;}}});
  await Promise.all(lanes);return out;
}
export const searchText=item=>[item?.title,...(item?.aliases||[]),...(item?.keywords||[])].filter(Boolean).map(String);
/** 无模型时的确定性路由：标题／别名／关键词命中。模型可用时同样的命中只作为证据补充。 */
export function matchItems(items,needle){
  const text=String(needle||'').trim();if(!text)return [];
  const out=[];
  for(const item of list(items)){
    for(const word of searchText(item)){
      if(word&&(text.includes(word)||word.includes(text)&&text.length>=2)){out.push({uid:String(item.uid),reason:'命中「'+word+'」'});break;}
    }
  }
  return out;
}
const groupByCategory=items=>{const map=new Map();for(const item of list(items)){const key=String(item?.category||'generic');if(!map.has(key))map.set(key,[]);map.get(key).push(item);}return [...map].map(([id,members])=>({id,label:String(members[0]?.categoryLabel||id),members}));};
const bodyChars=item=>Number(item?.bodyBytes??String(item?.description||'').length)||0;
const planShell=(items,extra)=>Object.assign({schema:STRATEGY_SCHEMA,managedIds:list(items).map(item=>String(item.uid)),selectedIds:[],requiredIds:[],removedIds:[],evidence:[],conflicts:[],placements:[],bookChanges:[],calls:[],budget:{estimatedInputTokens:0,actualUsage:null}},extra);

/** 斗罗式：按人物／地点／规则／章节分组判断，并发 4 分类，关系扩展后再做证据闸门。 */
export async function douluoSelect({turnInput=null,items=[],facts=null,requestPurpose=null,params={},scene=null,historyRefs=[],text=''}={}){
  const cfg={...STRATEGY_PARAMS.douluo,...params},needle=String(text||turnInput?.text||turnInput?.input?.text||'');
  const groups=groupByCategory(items),calls=[],relations=[],evidence=[];
  const judged=await mapLimit(groups,cfg.classifyConcurrency,async group=>{
    let answer=null;
    if(typeof requestPurpose==='function'){
      try{answer=await requestPurpose('selection',{stage:'judge',group:{id:group.id,label:group.label},capsule:String(facts?.capsule||''),items:group.members.map(item=>({uid:String(item.uid),title:item.title,category:item.category}))});}catch(error){if([401,403].includes(error?.status)||['site_auth','model_auth','auth_unknown'].includes(error?.code))throw error;answer=null;}
    }
    calls.push({stage:'judge',purpose:'category:'+group.id});
    const picked=Array.isArray(answer?.uids)?answer.uids.map(String):null;
    const rows=picked?group.members.filter(item=>picked.includes(String(item.uid))):matchItems(group.members,needle);
    return {group,rows,reason:String(answer?.reason||(picked?'模型目录判断':'关键词命中')),kind:picked?'category':'keyword'};
  });
  const selected=new Set();
  for(const row of judged){
    for(const item of row.rows){
      selected.add(String(item.uid));
      evidence.push({entryId:String(item.entryId),sourceIds:['category:'+row.group.id],reason:row.reason,kind:row.kind||'keyword'});
    }
  }
  // 关系扩展：被选中条目的标题/别名在其它条目正文里出现，则把对方带进证据（跨组也算）。
  const names=new Map();
  for(const item of list(items)){
    const uid=String(item.uid);if(!selected.has(uid))continue;
    for(const word of searchText(item))if(word&&word.length>=2)names.set(word,uid);
  }
  for(const item of list(items)){
    const uid=String(item.uid);if(selected.has(uid))continue;
    const body=String(item.description||'');
    for(const [word,owner] of names){if(body.includes(word)){selected.add(uid);relations.push({from:owner,to:uid,why:word});evidence.push({entryId:String(item.entryId),sourceIds:['relation:'+owner],reason:'关系扩展：正文提到「'+word+'」',kind:'relation'});break;}}
  }
  // 章节判断与历史引用：事实里的章节和开场前引用的章节条目单独记理由，不混进人物/规则。
  const chapter=String(facts?.route?.chapter||facts?.routeFacts?.chapter||scene?.chapter||'');
  const chapters=[];const history=new Set(list(historyRefs).map(String));
  if(chapter)for(const item of list(items))if(item.category==='chapter'&&String(item.title).includes(chapter)){chapters.push({uid:String(item.uid),chapter});if(!selected.has(String(item.uid))){selected.add(String(item.uid));evidence.push({entryId:String(item.entryId),sourceIds:['facts:chapter'],reason:'章节判断：' + chapter,kind:'chapter'});}}
  for(const item of list(items))if(history.has(String(item.uid))&&!selected.has(String(item.uid))){selected.add(String(item.uid));evidence.push({entryId:String(item.entryId),sourceIds:['history:'+String(item.uid)],reason:'历史引用',kind:'history'});}
  const budget={estimatedInputTokens:Math.round([...selected].reduce((sum,uid)=>sum+bodyChars(list(items).find(item=>String(item.uid)===uid)),0)/3),actualUsage:null};
  return planShell(items,{selectedIds:[...selected],evidence,calls,budget,strategy:'douluo',relations,chapters,groups:judged.map(row=>({id:row.group.id,label:row.group.label,picked:row.rows.map(item=>String(item.uid)),reason:row.reason}))});
}

/** 命定式：先看能否复用上一轮决定；不能则合并增量（带补查上限），再不能就全量分批。 */
export function createDestinyState(seed=null){return {revision:0,decisions:seed?[seed]:[]};}
/** 目录与依赖签名：除现场胶囊与条目集合外，把条目正文摘要、书版本与策略设置一起算进来，
 *  换人物／分支／书／条目正文／预设后签名自然变，不需要另立失效清单。 */
export function destinySignature({facts=null,items=[],deps=null,text=''}={}){
  return fnv(JSON.stringify([String(text),String(facts?.capsule||''),list(facts?.facts).flatMap(fact=>list(fact?.sourceIds).map(String)),list(items).length,list(items).map(item=>String(item?.uid)).sort().join(','),list(items).map(item=>String(item?.hash??'')).sort().join(','),deps??null]));
}
export async function destinySelect({turnInput=null,items=[],groups=[],facts=null,requestPurpose=null,params={},state=createDestinyState(),scene=null,historyRefs=[],text='',deps=null}={}){
  const cfg={...STRATEGY_PARAMS.destiny,...params},needle=String(text||turnInput?.inputText||turnInput?.text||turnInput?.input?.text||'');
  const sig=destinySignature({facts,items,deps,text:needle}),prior=state.decisions.length?state.decisions[state.decisions.length-1]:null;
  const calls=[],evidence=[];
  if(prior&&prior.sig===sig){
    for(const uid of prior.selectedIds)evidence.push({entryId:'',sourceIds:['reuse:'+prior.sig],reason:'复用上一轮选择：'+prior.reason});
    return planShell(items,{selectedIds:[...prior.selectedIds],evidence,calls:[{stage:'reuse',purpose:'signature:'+sig}],budget:{estimatedInputTokens:0,actualUsage:null},strategy:'destiny',mode:'reuse',reason:prior.reason,signature:sig,extensions:{decision:prior}});
  }
  const itemDeps=list(items).map(item=>[String(item?.uid),String(item?.hash??'')]),factIds=new Set(list(facts?.facts).flatMap(fact=>list(fact?.sourceIds).map(String)));
  // Real fact bundles carry source objects; without explicit entry refs, rejudge the changed scene.
  const incremental=prior&&factIds.size>0&&prior.inputText===needle&&JSON.stringify(prior.deps)===JSON.stringify(itemDeps);
  const mode=prior?'merge':'full';
  const selected=new Set(incremental?prior.selectedIds:[]);
  const pages=[],pendingQueries=[];
  const entryByGroup=new Map();for(const group of list(groups))for(const uid of list(group?.itemUids))if(!entryByGroup.has(String(uid)))entryByGroup.set(String(uid),String(group.id));
  const catalogRows=groups.length?groups.map(group=>({uid:String(group.id),title:String(group.label||''),segments:1,count:list(group.itemUids).length,sample:list(group.itemUids).slice(0,12).map(uid=>String(list(items).find(item=>String(item.uid)===String(uid))?.title||'')).filter(Boolean)})):items;
  let catalogAnswered=false;
  const takeBatch=async(rows,stage,label)=>{
    let answer=null;
    if(typeof requestPurpose==='function'){
      try{answer=await requestPurpose('selection',{stage,label,capsule:String(facts?.capsule||''),items:rows.map(item=>({uid:String(item.uid),title:item.title,segments:item.segments?.length??1,...(item.count!==undefined?{count:item.count,sample:item.sample}:{})}))});}catch(error){if([401,403].includes(error?.status)||['site_auth','model_auth','auth_unknown'].includes(error?.code))throw error;answer=null;}
    }
    calls.push({stage,purpose:label});
    if(Array.isArray(answer?.uids)){if(stage==='catalog')catalogAnswered=true;return answer.uids.map(String);}
    return matchItems(rows,needle).map(row=>row.uid);
  };
  if(!incremental){
    // 原模块两段：先按目录（书/分类）粗选，再只对选中目录里的条目细判（A2:46-51）。
    const pickedCatalogs=new Set();
    const catalogBatches=chunks(catalogRows,cfg.catalogBatch);
    for(let index=0;index<catalogBatches.length;index++){
      const picked=await takeBatch(catalogBatches[index],'catalog','目录批次 '+(index+1)+'/'+catalogBatches.length);
      if(groups.length)for(const uid of picked)if(catalogRows.some(row=>String(row.uid)===uid))pickedCatalogs.add(uid);
      else for(const uid of picked)selected.add(uid);
    }
    /* 模型明确回了空目录 = 本轮不选；模型没答上来才退回全量，避免把失败当"没条目可用"。 */
    const entryRows=groups.length?(pickedCatalogs.size?list(items).filter(item=>pickedCatalogs.has(entryByGroup.get(String(item.uid)))):(catalogAnswered?[]:list(items))):list(items);
    const entryBatches=chunks(entryRows,cfg.entryBatch);
    for(let index=0;index<entryBatches.length;index++){const picked=await takeBatch(entryBatches[index],'entry','条目批次 '+(index+1)+'/'+entryBatches.length);for(const uid of picked)selected.add(uid);}
  }else{
    // 合并：先按新事实补查，再看上一轮选中的条目是否还站得住。
    if(selected.size){const retained=new Set(await takeBatch(list(items).filter(item=>selected.has(String(item.uid))),'entry','合并复核'));for(const uid of selected)if(!retained.has(uid))selected.delete(uid);}
    const fresh=list(items).filter(item=>factIds.has(String(item.uid))&&!selected.has(String(item.uid)));
    const lookups=fresh.slice(0,cfg.lookupsPerTurn);
    for(const item of lookups)selected.add(String(item.uid));
    for(const item of fresh.slice(cfg.lookupsPerTurn))pendingQueries.push({uid:String(item.uid),reason:'补查额度已用尽，留到下一轮'});
    if(lookups.length)calls.push({stage:'lookup',purpose:'事实补查 '+lookups.length+' 条'});
    for(const uid of selected)if(!list(items).some(item=>String(item.uid)===uid))pendingQueries.push({uid,reason:'上一轮选中但本轮目录里没有'});
  }
  for(const item of list(items)){
    if(!selected.has(String(item.uid)))continue;
    const segments=Math.max(1,item.segments?.length||1);
    if(segments>1)pages.push({uid:String(item.uid),segments});
    evidence.push({entryId:String(item.entryId),sourceIds:['destiny:'+mode],reason:mode==='full'?'全量分批选中'+(segments>1?' · 长条目分页 '+segments+' 段':''):'合并后仍选中'+(segments>1?' · 长条目分页 '+segments+' 段':'')});
  }
  const decision={sig,at:new Date().toISOString(),mode,selectedIds:[...selected],reason:mode==='full'?'首轮全量':'事实变化后合并',deps:itemDeps,inputText:needle,revision:state.revision+1};
  state.decisions.push(decision);state.revision+=1;
  return planShell(items,{selectedIds:[...selected],evidence,calls,budget:{estimatedInputTokens:Math.round([...selected].reduce((sum,uid)=>sum+bodyChars(list(items).find(item=>String(item.uid)===uid)),0)/3),actualUsage:null},strategy:'destiny',mode,signature:sig,pages,pendingQueries,reason:decision.reason,extensions:{decision}});
}

