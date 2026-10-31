/** One history projection: saved database timeline + recent verbatim turns. No paid side pipeline. */
import {sourceRows} from './sources.mjs';
import {estimateTokens} from './tokens.mjs';
import {visibleStory} from './projection.mjs';
const clone=structuredClone;
const error=(code,message)=>Object.assign(new Error(message),{code});

/** Only a complete, source-validated chronological prefix may replace original messages. */
export function selectTimeline(rows,coverage,{recentTurns=6}={}){
 if(!Number.isSafeInteger(recentTurns)||recentTurns<1)throw error('history_settings','近期原文至少保留一轮');
 const nodeIds=[...new Set(rows.map(row=>row.ref.nodeId))],cutoff=Math.max(0,nodeIds.length-recentTurns),selected=[],covered=new Set();let cursor=0;
 while(cursor<cutoff){
  const choices=(coverage?.rows||[]).filter(record=>Array.isArray(record.nodeIds)&&record.nodeIds.length&&record.nodeIds.length<=cutoff-cursor&&record.nodeIds.every((id,index)=>id===nodeIds[cursor+index])&&typeof record.text==='string'&&record.text.trim()&&!record.nodeIds.some(id=>rows.some(row=>row.ref.nodeId===id&&row.pending)));
  choices.sort((a,b)=>b.nodeIds.length-a.nodeIds.length);const chosen=choices[0];if(!chosen)break;
  selected.push(clone(chosen));chosen.nodeIds.forEach(id=>covered.add(id));cursor+=chosen.nodeIds.length;
 }
 const prompt=selected.length?'【已保存的连续剧情纪要】按来源顺序阅读；人物看法、否定、计划、传闻和未结事项保持原性质，正式数值以当前状态为准。\n'+selected.map(record=>'['+record.fromNodeId+' → '+record.toNodeId+']\n'+record.text).join('\n\n'):'';
 return {rows:rows.filter(row=>!covered.has(row.ref.nodeId)).map(row=>row.native),prompt,compactionIds:selected.map(row=>row.id),coveredNodeIds:[...covered],timelineRecordIds:[...new Set(selected.flatMap(row=>row.recordIds||[]))],selected,gaps:nodeIds.slice(cursor,cutoff),recentNodeIds:nodeIds.slice(cutoff),source:'database-timeline',calls:0};
}

export function createContextService({statePort,identity,parser,memory:memoryProvider,recentTurns=()=>6,versions=()=>({}),projectHistory}={}){
 let current=null,rows=[],legacy=[],coverage={rows:[],gaps:[]},lastRun=null,lastError='',disposed=false,unboundNative=0;
 const listeners=new Set(),who=()=>typeof identity==='function'?identity():identity,memory=()=>typeof memoryProvider==='function'?memoryProvider():memoryProvider;
 const sourceMemo={};
 const status=()=>({busy:false,error:lastError,pendingSave:false,settings:{enabled:true,auto:false,recentTurns:recentTurns()},source:'database-timeline',estimate:true,lastRun:clone(lastRun),legacyRecords:legacy.length});
 const publish=()=>{for(const fn of listeners)fn(status());};
 async function restore(input){
  if(disposed)throw error('history_disposed','此故事的上下文已经关闭');current={...input,actorId:input.actorId||'player',versions:clone(input.versions||versions())};
  unboundNative=input.nodes.filter(node=>node.native&&node.message?.raw&&!node.message.binding).length;rows=await sourceRows({nodes:input.nodes,identity:who(),actorId:current.actorId,versions:current.versions,memo:sourceMemo,projectText:(text,role,node)=>projectHistory?projectHistory(text,{actorId:current.actorId,nodeId:node.nodeId,role}):role==='assistant'?visibleStory(text,{parser,name:input.actorName||input.profile?.name}):{text:String(text)}});
  legacy=(await statePort.listRecords('summaries',who().runId)).filter(record=>record.kind==='compaction');coverage={rows:[],gaps:[]};publish();return status();
 }
 async function before({fixedTokens=0,contextSize,outputTokens,signal}={}){
  signal?.throwIfAborted();lastError='';
  try{
   coverage=memory()?.validatedCoverage?await memory().validatedCoverage({actorId:current.actorId,nodes:current.nodes}):{rows:[],gaps:[]};signal?.throwIfAborted();
   const selected=selectTimeline(rows,coverage,{recentTurns:recentTurns()}),notes=[];
   if(selected.gaps.length)notes.push('仍有 '+selected.gaps.length+' 轮较早正文未取得完整纪要覆盖，继续保留原文。');
   if(unboundNative)notes.push(unboundNative+' 条原生历史缺少人物来源，保留在存档中，尚未交给当前人物。');
   if(legacy.length)notes.push('旧版独立摘要保留在存档中，新轮次统一使用数据库纪要。');
   const result={...selected,notes,beforeTokens:fixedTokens+estimateTokens(rows.map(row=>row.native)),afterTokens:fixedTokens+estimateTokens(selected.rows)+estimateTokens(selected.prompt),tokenSource:'local-estimate',contextSize,outputTokens};
   lastRun={...result,rows:undefined,prompt:undefined,selected:undefined};publish();return result;
  }catch(failure){lastError=failure.message;publish();throw failure;}
 }
 const legacyRecords=()=>clone(legacy).map(record=>({...record,legacy:true,readOnly:true,active:false}));
 return {restore,before,status,records:()=>[...clone(coverage.rows||[]),...legacyRecords()],legacyRecords,get rows(){return clone(rows);},
  async organize(options){if(!memory()?.compactHistory)throw error('timeline_unavailable','请从数据库记忆页选择历史范围并生成连续纪要');return memory().compactHistory(options);},
  async configure(patch){return memory().configure(patch);},retrySave:taskId=>memory().retrySave(taskId),
  exclude:id=>memory().setMode(id,'excluded'),restoreRecord:id=>memory().setMode(id,'auto'),
  async allowRetry(){throw error('timeline_retry','请在数据库记忆页选择原任务，重试该任务或保存原结果');},
  cancel(){memory()?.pause?.();},subscribe(fn){listeners.add(fn);fn(status());return()=>listeners.delete(fn);},destroy(){disposed=true;listeners.clear();}
 };
}
