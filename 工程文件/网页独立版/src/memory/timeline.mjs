/** The six-table chronicle is the one durable compression store. Top-K recall never covers history. */
import {semanticHash} from '../context/sources.mjs';
import {estimateTokens} from '../context/tokens.mjs';
import {checkMemorySource} from './source.mjs';
import {newId} from '../core/ids.mjs';
const HISTORY='memory:history',clone=value=>structuredClone(value),failure=(code,message)=>Object.assign(new Error(message),{code});
function splitText(text,limit){const chars=[...text],chunks=[];let body='',cost=0;for(const ch of chars){const size=ch.charCodeAt(0)<=127?1/3:1;if(cost+size>limit&&body){chunks.push(body);body='';cost=0;}body+=ch;cost+=size;}if(body||!chunks.length)chunks.push(body);return chunks;}
function parseResult(response){let value;const text=String(response.text??response).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{value=JSON.parse(text);}catch{throw failure('memory_timeline_invalid','历史整理未返回完整 JSON');}if(typeof value.summary!=='string'||/<(?:UpdateVariable|cxx-source|cxx-story)\b/i.test(value.summary))throw failure('memory_timeline_invalid','纪要缺少正文或夹带正式协议');return value;}
const refsOf=source=>({nodeId:source.nodeId,replyId:source.replyId,semanticHash:source.semanticHash,ancestorHash:source.ancestorHash,ancestorDepth:source.ancestorDepth,parentNodeId:source.parentNodeId});
export function createDatabaseTimeline(hooks){
  const {now,requestPurpose,put,refresh,getSources,getRecords,getTasks,getContext,projectHistory,identity,unsaved,ensureAssets,archiveRows}=hooks;
  let lastState=null;
  async function selected(options={}){
    await refresh({...(options.nodes?{nodes:options.nodes}:{})});const actorId=options.actorId||getContext().state?.terminal?.ensemble?.control?.viewpointActorId||'player',all=getSources(),from=options.fromNodeId?all.findIndex(r=>r.source.nodeId===options.fromNodeId):0,to=options.toNodeId?all.findIndex(r=>r.source.nodeId===options.toNodeId):all.length-1;
    if(!all.length)return {actorId,rows:[],signature:await semanticHash({actorId,empty:true})};if(from<0||to<from)throw new TypeError('请选择当前路线的完整历史范围');const rows=all.slice(from,to+1),signature=await semanticHash({actorId,sources:rows.map(r=>refsOf(r.source))});return {actorId,rows,signature};
  }
  function resultValid(row,actorId,sources=getSources()){
    if(!row)return false;
    const c=row.coverage,control=getRecords().find(r=>r.id==='memory-control:'+row.id);if(row.kind!=='table'||row.table!=='纪要表'||row.purpose!=='timeline'||!c||c.schema!==1||c.actorId!==actorId||row.deleted||control?.mode==='excluded'||control?.correction)return false;
    if(!checkMemorySource(row.source,sources,{requireQuote:false}).valid)return false;const current=new Map(sources.map(r=>[r.source.nodeId,r]));
    for(const ref of c.sources||[]){const value=current.get(ref.nodeId),source=value?.source;if(!source||value.node.native&&!value.node.message?.binding?.viewpointActorId&&!value.node.message?.actorId||['replyId','semanticHash','ancestorHash'].some(key=>source[key]!==ref[key]))return false;}
    const indices=(c.sources||[]).map(ref=>sources.findIndex(r=>r.source.nodeId===ref.nodeId));return indices.length>0&&indices.every((n,i)=>n>=0&&(!i||n===indices[i-1]+1));
  }
  const rowValid=(row,actorId,sources)=>resultValid(row,actorId,sources)&&row.coverage.complete===true;
  async function validatedCoverage(options={}){
    const selection=await selected(options),sources=getSources(),rows=hooks.enabled()?getRecords().filter(row=>rowValid(row,selection.actorId,sources)).map(row=>({id:row.id,fromNodeId:row.coverage.sources[0].nodeId,toNodeId:row.coverage.sources.at(-1).nodeId,nodeIds:row.coverage.sources.map(s=>s.nodeId),text:row.cells.纪要,actorId:selection.actorId,sourceHash:row.coverage.sourceHash,recordIds:[row.id],createdAt:row.createdAt,kind:row.coverage.inputKind})):[];
    const covered=new Set(rows.flatMap(row=>row.nodeIds));return {rows,gaps:selection.rows.filter(r=>!covered.has(r.source.nodeId)).map(r=>({nodeId:r.source.nodeId,reason:'没有已保存且来源有效的完整纪要'})),sources:selection.rows.map(r=>refsOf(r.source)),actorId:selection.actorId};
  }
  function rawBody(row,actorId){const input=projectHistory(row.node.message?.input?.text||'',{actorId,nodeId:row.source.nodeId,role:'user'}),body=projectHistory(row.node.message?.raw||'',{actorId,nodeId:row.source.nodeId,role:'assistant'});return (input?'玩家行动：'+input+'\n':'')+body;}
  async function plan(options={}){
    const selection=await selected(options),maxInputTokens=options.maxInputTokens??12000,targetTokens=options.targetTokens??2000;await ensureAssets();
    if(selection.rows.some(row=>row.node.native&&!row.node.message?.binding?.viewpointActorId&&!row.node.message?.actorId))throw failure('memory_timeline_scope_unknown','旧酒馆正文没有可核对的人物视角，不能当作玩家经历生成覆盖；请先确认旧楼来源');
    if(!Number.isInteger(maxInputTokens)||!Number.isInteger(targetTokens)||targetTokens<64||maxInputTokens<targetTokens*2+256||maxInputTokens>120000)throw new TypeError('整理输入预算须至少为目标纪要的两倍加 256，输入上限 120000');
    const valid=getRecords().filter(row=>rowValid(row,selection.actorId)),items=[];let index=0;
    while(index<selection.rows.length){const row=selection.rows[index],candidates=valid.filter(r=>r.coverage.sources[0].nodeId===row.source.nodeId&&r.coverage.sources.every((ref,offset)=>selection.rows[index+offset]?.source.nodeId===ref.nodeId)).sort((a,b)=>b.coverage.sources.length-a.coverage.sources.length||estimateTokens(a.cells.纪要)-estimateTokens(b.cells.纪要));
      const chosen=candidates[0];if(chosen){items.push({kind:'summary',recordId:chosen.id,text:chosen.cells.纪要,parts:clone(chosen.coverage.parts),refs:clone(chosen.coverage.sources)});index+=chosen.coverage.sources.length;continue;}
      const text=rawBody(row,selection.actorId),chunks=splitText(text,Math.max(128,maxInputTokens-512));for(const [part,body]of chunks.entries())items.push({kind:'raw',text:body,nodeId:row.source.nodeId,parts:[{nodeId:row.source.nodeId,index:part,total:chunks.length}],refs:[refsOf(row.source)]});index++;
    }
    const value={schema:1,kind:'timeline',actorId:selection.actorId,signature:selection.signature,sourceRefs:selection.rows.map(r=>refsOf(r.source)),fromNodeId:selection.rows[0]?.source.nodeId,toNodeId:selection.rows.at(-1)?.source.nodeId,maxInputTokens,targetTokens,initialItems:items,sourceTokens:items.reduce((sum,item)=>sum+estimateTokens(item.text),0)};
    return {...value,estimatedFirstPassCalls:batches(items,maxInputTokens).filter(batch=>batch.length>1||batch[0]?.kind==='raw'&&estimateTokens(batch[0].text)>targetTokens).length};
  }
  function batches(items,budget){const out=[];let list=[],cost=0;for(const item of items){const size=estimateTokens(item.text)+128;if(list.length&&cost+size>budget){out.push(list);list=[];cost=0;}list.push(item);cost+=size;}if(list.length)out.push(list);return out;}
  async function taskIdFor(job,items){const id=identity(),natural='memory-timeline:'+await semanticHash({scope:{accountId:id.accountId,runId:id.runId},actorId:job.actorId,targetTokens:job.targetTokens,parts:items.map(i=>({kind:i.kind,recordId:i.recordId,text:i.text,parts:i.parts,refs:i.refs}))});return job.taskAliases?.[natural]||natural;}
  function coverageFor(job,items){const refs=new Map(),parts=new Map();for(const item of items){for(const ref of item.refs)refs.set(ref.nodeId,ref);for(const part of item.parts)parts.set(part.nodeId+':'+part.index,part);}const ordered=[...refs.values()].sort((a,b)=>job.sourceRefs.findIndex(r=>r.nodeId===a.nodeId)-job.sourceRefs.findIndex(r=>r.nodeId===b.nodeId)),allParts=[...parts.values()],complete=ordered.every(ref=>{const chunks=allParts.filter(p=>p.nodeId===ref.nodeId);return chunks.length===chunks[0]?.total&&new Set(chunks.map(p=>p.index)).size===chunks.length&&chunks.every(p=>p.total===chunks[0].total&&p.index>=0&&p.index<p.total);});return {schema:1,actorId:job.actorId,sources:ordered,parts:allParts,complete,inputKind:items.every(i=>i.kind==='summary')?'rollup':'raw'};}
  async function saveJob(job){lastState=job;await put('memories',[{schema:1,id:HISTORY,kind:'memory-history',job}]);return job;}
  async function checkJob(job){const value=await selected({actorId:job.actorId,fromNodeId:job.fromNodeId,toNodeId:job.toNodeId});if(value.signature!==job.signature)throw failure('memory_source_invalid','历史正文、分支或人物视角来源已经改变');}
  async function retrySave(taskId){await refresh();const task=unsaved.get(taskId)||getTasks().find(t=>t.taskId===taskId);if(!task?.prepared||task.kind!=='memory-timeline')throw failure('memory_no_prepared','没有待保存的数据库纪要');const job=clone(task.jobScope);await checkJob(job);unsaved.set(taskId,task);await put('tasks',[task]);await put('memories',task.prepared.records);await put('tasks',[{...task,status:'done',prepared:null,resultRecordId:task.prepared.records.find(r=>r.purpose==='timeline').id,updatedAt:now()}]);unsaved.delete(taskId);return getRecords().find(r=>r.id===task.prepared.records.find(r=>r.purpose==='timeline').id);}
  function itemFrom(row){return {kind:'summary',recordId:row.id,text:row.cells.纪要,parts:clone(row.coverage.parts),refs:clone(row.coverage.sources)};}
  async function processBatch(job,items,signal){
    const taskId=await taskIdFor(job,items),prior=getTasks().find(task=>task.taskId===taskId),previousResult=prior?.status==='done'?getRecords().find(r=>r.id===prior.resultRecordId):null;if(resultValid(previousResult,job.actorId))return {item:itemFrom(previousResult),modelCalls:0};if(prior?.prepared||unsaved.has(taskId))return {item:itemFrom(await retrySave(taskId)),modelCalls:0};
    const sourceMap=new Map(getSources().map(r=>[r.source.nodeId,r])),coverage=coverageFor(job,items),anchor=sourceMap.get(coverage.sources.at(-1).nodeId),source={...clone(anchor.source),type:'timeline',quote:anchor.plain.slice(0,160)},task={schema:1,taskId,kind:'memory-timeline',sourceNodeId:anchor.source.nodeId,source,actorId:job.actorId,jobScope:{actorId:job.actorId,signature:job.signature,fromNodeId:job.fromNodeId,toNodeId:job.toNodeId},status:'pending',createdAt:now(),updatedAt:now()};await put('tasks',[task]);
    const inputTokens=items.reduce((n,item)=>n+estimateTokens(item.text)+128,0);if(inputTokens>job.maxInputTokens+128)throw failure('memory_timeline_budget','历史分块超出本次输入预算');if(signal.aborted)throw new DOMException('整理已暂停','AbortError');
    let response,value;
    if(items.length===1&&estimateTokens(items[0].text)<=job.targetTokens){value={summary:items[0].text,overview:'已保存的当前视角经历',timeSpan:'未明确',keyDialogue:'',records:[]};}
    else if(items.every(i=>!i.text.trim()))value={summary:'',overview:'此视角没有已知信息',timeSpan:'未明确',records:[]};
    else {
      if(!requestPurpose)throw failure('memory_model_missing','历史整理模型尚未配置');response=await requestPurpose('archive',[{role:'system',content:'你把按时间顺序给出的已提交经历整理为东京都2051的数据库纪要。输入已按同一人物视角投影，不能补入全知事实、他人心声或未发生的未来。完整保留因果、否定、尚未履行的约定、失败尝试、长期动机，以及能维持语气的关键措辞；相同日常可合并。这里只做历史整理，不推进剧情、不改正式任务/钱包/物品。不得用相关性TopK省略整段历史。输出完整 JSON：{"summary":"按时间连贯纪要","overview":"一句话","timeSpan":"故事时间或未明确","keyDialogue":"少量关键原句","records":[]}。summary最多 '+job.targetTokens+' 个估算token。原文分块可在同一次请求里附加重要六表 records，每行用 {nodeId,table,cells,quote}，quote必须是对应本批原文至少八字原句，人物/关系遵守明确知情与方向；没有需要新增的记录可返回[]。如果输入全是已有纪要，只合并纪要，records必须为空。不得引用输入中不存在的编号、擅自宣布承诺履行或改变不确定性。'},{role:'user',content:JSON.stringify({actorId:job.actorId,items:items.map(item=>({kind:item.kind,nodeId:item.nodeId,nodeIds:item.refs.map(r=>r.nodeId),part:item.parts,text:item.text})),actors:hooks.actors(),existing:hooks.existingIds()})}],{signal});if(signal.aborted)throw new DOMException('整理已暂停','AbortError');if(response.complete===false)throw failure('memory_timeline_incomplete','历史整理回复未完整结束');value=parseResult(response);
    }
    if(estimateTokens(value.summary)>job.targetTokens||value.summary.length>50000)throw failure('memory_timeline_budget','纪要超过目标预算，未替换原文');if(items.some(item=>item.text.trim())&&!value.summary.trim())throw failure('memory_timeline_empty','非空历史没有可保存的纪要');await checkJob(job);
    const extra=Array.isArray(value.records)?value.records:[];if(extra.length&&items.every(i=>i.kind==='summary'))throw failure('memory_timeline_invalid','合并旧纪要不能重新生成事实行');const additional=extra.length?await archiveRows({records:extra,items,taskId}):[];
    coverage.sourceHash=await semanticHash({actorId:job.actorId,sources:coverage.sources,parts:coverage.parts});const recordId='timeline:'+taskId+(previousResult?':'+newId('revision'):''),businessId='TL_'+recordId.slice(-24),row={schema:1,id:recordId,kind:'table',table:'纪要表',purpose:'timeline',businessId,cells:{编码索引:businessId,时间跨度:String(value.timeSpan||'未明确'),概览:String(value.overview||'历史纪要'),纪要:value.summary,重要对话:String(value.keyDialogue||'')},coverage,source,taskId,createdAt:now(),origin:response?'model':'retained-projection'};
    const staged={...task,status:'prepared',prepared:{records:[...additional,row]},modelCalled:!!response,model:typeof response?.model==='string'?{model:response.model}:Object.fromEntries(['adapter','family','model'].filter(k=>typeof response?.model?.[k]==='string').map(k=>[k,response.model[k]])),usage:Object.fromEntries(['input_tokens','output_tokens','prompt_tokens','completion_tokens','total_tokens'].filter(k=>Number.isFinite(response?.usage?.[k])).map(k=>[k,response.usage[k]])),updatedAt:now()};unsaved.set(taskId,staged);return {item:itemFrom(await retrySaveStaged(staged,job)),modelCalls:response?1:0};
  }
  async function retrySaveStaged(task,job){await checkJob(job);await put('tasks',[task]);await put('memories',task.prepared.records);await put('tasks',[{...task,status:'done',prepared:null,resultRecordId:task.prepared.records.find(r=>r.purpose==='timeline').id,updatedAt:now()}]);unsaved.delete(task.taskId);return getRecords().find(r=>r.id===task.prepared.records.find(r=>r.purpose==='timeline').id);}
  async function compactHistory(options,signal){
    const proposed=await plan(options);if(!proposed.sourceRefs.length)return {saved:[],coverage:await validatedCoverage(options),calls:0};const stored=getRecords().find(r=>r.id===HISTORY)?.job;
    const reusable=stored?.kind==='timeline'&&stored.signature===proposed.signature&&stored.actorId===proposed.actorId&&stored.targetTokens===proposed.targetTokens&&(stored.outputs||[]).every(item=>resultValid(getRecords().find(row=>row.id===item.recordId),stored.actorId));
    let job=reusable?clone(stored):{...proposed,initialItems:undefined,id:newId('timeline-job'),status:'ready',phase:0,next:0,items:proposed.initialItems,outputs:[],taskIds:[],createdAt:now(),error:''};
    if(job.status==='done')return {saved:job.outputRecordIds||[],coverage:await validatedCoverage(options),calls:0};await saveJob(job);let calls=0;
    try{
      while(true){await checkJob(job);const groups=batches(job.items,job.maxInputTokens);job.phaseBatchCount=groups.length;
        for(;job.next<groups.length;){if(signal.aborted)throw new DOMException('整理已暂停','AbortError');const group=groups[job.next],id=await taskIdFor(job,group),result=await processBatch(job,group,signal);calls+=result.modelCalls;job.outputs.push(result.item);if(!job.taskIds.includes(id))job.taskIds.push(id);job.next++;await saveJob({...job,status:'running',error:''});}
        const total=job.outputs.reduce((sum,item)=>sum+estimateTokens(item.text),0);
        const complete=job.outputs.every(item=>getRecords().find(row=>row.id===item.recordId)?.coverage?.complete);
        if(total<=job.targetTokens&&complete){job={...job,status:'done',outputRecordIds:job.outputs.map(item=>item.recordId),completedAt:now()};await saveJob(job);return {saved:job.outputRecordIds,coverage:await validatedCoverage(options),calls};}
        if(job.phase>=12||job.outputs.length>=job.items.length&&job.phase>0)throw failure('memory_timeline_not_reduced','整理未减少历史体积，原文保留，请调整目标预算');job={...job,phase:job.phase+1,items:job.outputs,next:0,outputs:[],status:'ready'};await saveJob(job);
      }
    }catch(error){job={...job,status:error.name==='AbortError'?'paused':error.code==='memory_source_invalid'?'source-changed':'failed',error:error.message,updatedAt:now()};await saveJob(job).catch(()=>{});throw error;}
  }
  return {previewTimeline:plan,validatedCoverage,compactHistory,retrySave,status:()=>lastState};
}
