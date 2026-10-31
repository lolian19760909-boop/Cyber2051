/** Native tables are a rebuildable projection of the selected committed floor. No model calls. */
import {stateAt,lineage} from '../store/records.mjs';
import {semanticHash,stableJSON} from '../context/sources.mjs';
import {buildMemorySources,checkMemorySource} from '../memory/source.mjs';
import {loadContract,tableData,TABLE_NAMES} from '../memory/contract.mjs';
import {appUrl} from './paths.mjs';
const NS='cxx2051_web',clone=structuredClone;
const fail=(code,message)=>Object.assign(new Error(message),{code});
let materialPromise;
async function loadMaterial(){if(globalThis.CxxMemoryMaterial)return globalThis.CxxMemoryMaterial;if(typeof process==='object'&&process.versions?.node){const {createRequire}=await import('node:module');return createRequire(import.meta.url)('../../../卡片源码/长期记忆/material.js');}return materialPromise??=import(appUrl('card/长期记忆/material.js')).then(module=>module.default||globalThis.CxxMemoryMaterial);}

/** Translate saved web sources to real native floors; retain the complete original webSource. */
export async function projectNativeMemory(origin,{parser,contract,material,current={},reference,projectionHash}={}){
 const records=origin.document.records?.memories||[],stored=records.filter(record=>record.kind==='table'&&TABLE_NAMES.includes(record.table)&&!record.deleted),base=clone(current),hasOwned=Object.values(base).some(table=>TABLE_NAMES.includes(table?.name)&&table.content?.slice(1).some(row=>material.source(row[table.content[0].indexOf(table.name==='纪要表'?'纪要':'来源')])?.webSource?.runId===origin.runId));
 if(!stored.length&&!hasOwned)return {data:base,count:0,changed:false};
 const nodes=lineage(origin.document.nodes,origin.nodeId),sources=await buildMemorySources({nodes,identity:{accountId:origin.accountId,runId:origin.runId},parser}),converted=[];
 for(const record of stored){
  const check=checkMemorySource(record.source,sources,{requireQuote:record.purpose!=='timeline'});if(!check.valid)continue;
  const control=records.find(value=>value.id==='memory-control:'+record.id&&value.sourceHash===record.source.semanticHash&&value.ancestorHash===record.source.ancestorHash);if(control?.mode==='excluded')continue;
  let anchor=null;for(const [floor,row]of origin.nativeRows.entries()){if(row.is_user||row.is_system)continue;const swipe=row.swipe_id||0,marker=row.variables?.[swipe]?.__cxx_web_commit;if(marker?.owner==='web'&&marker.nodeId===record.source.nodeId){anchor={floor,swipe};break;}}
  if(!anchor)continue;const nativeRef=reference?.(anchor.floor);if(!nativeRef)throw fail('projection_memory_reference','原生消息来源尚未就绪，已保存的六表记录等待重建投影');
  const nativeSource={story:[origin.avatar,origin.chatId],floor:anchor.floor,swipe:anchor.swipe,quote:record.source.quote||check.row.plain.slice(0,160),ref:clone(nativeRef),webSource:{...clone(record.source),recordId:record.id,recordCreatedAt:record.createdAt||null,recordUpdatedAt:record.updatedAt||null,controlUpdatedAt:control?.updatedAt||null,projectionTaskId:'st-projection:'+origin.nodeId,projectionHash}};
  const cells=clone(record.cells),textColumn={'纪要表':'纪要','人物经历':'共同经历','承诺与未结事项':'事项与条件','事件记录':'内容','人物认知':'所知内容','关系变化':'关系描述'}[record.table];if(control?.correction)cells[textColumn]=control.correction;
  converted.push({...record,cells,source:nativeSource});
 }
 for(const table of Object.values(base)){if(!TABLE_NAMES.includes(table?.name)||!table.content?.length)continue;const column=table.content[0].indexOf(table.name==='纪要表'?'纪要':'来源');table.content=[table.content[0],...table.content.slice(1).filter(row=>material.source(row[column])?.webSource?.runId!==origin.runId)];}
 const added=tableData(converted,contract),template=contract.nativeTemplate;
 for(const descriptor of contract.tables){const incoming=added[descriptor.id],existing=Object.values(base).find(table=>table?.name===descriptor.name);if(!existing&&!template?.[descriptor.id])throw fail('projection_memory_template','六表原生模板尚未包含在内容包中，请更新内容包后重建');Object.assign(incoming,clone(existing||template[descriptor.id]),{content:incoming.content});if(!existing){incoming.updateConfig={...(incoming.updateConfig||{}),uiSentinel:-1,contextDepth:-1,updateFrequency:-1,batchSize:-1,skipFloors:-1,groupId:-1};incoming.exportConfig={...(incoming.exportConfig||{}),enabled:false,extraIndexEnabled:false};}}
 const data=material.merge(base,added,source=>!!source?.webSource);
 return {data,count:converted.length,changed:stableJSON(data)!==stableJSON(current)};
}

export function committedProjectionSource(context,fingerprint,original=row=>row?.mes){
 const c=context(),doc=c.chatMetadata?.[NS],run=doc?.run;if(!run?.headNodeId)return null;
 const floor=c.chat.findLastIndex(row=>!row.is_user&&!row.is_system),row=c.chat[floor],swipe=row?.swipe_id||0,variables=row?.variables?.[swipe],marker=variables?.__cxx_web_commit;
 if(marker?.owner!=='web')return null;
 const node=doc.nodes.find(value=>value.nodeId===run.headNodeId),receipt=doc.receipts.find(value=>value.nodeId===run.headNodeId);
 if(!node||!receipt)throw fail('projection_receipt','当前网页提交缺少来源节点或保存回执');
 const stateNodeId=marker.stateNodeId||marker.nodeId;
 if(stateNodeId!==run.headNodeId)throw fail('projection_source','原生楼层状态与网页当前路线不一致');
 const narrative=lineage(doc.nodes,run.headNodeId).findLast(value=>value.message?.kind!=='program'&&typeof value.message?.raw==='string');
 const raw=String(original(row)??'');
 if(!narrative||marker.nodeId!==narrative.nodeId||fingerprint(raw)!==fingerprint(narrative.message.raw)||fingerprint(raw)!==marker.fingerprint)throw fail('projection_source','正文或所选swipe已变化，请先接回原生来源');
 const state=stateAt(doc.nodes,run.headNodeId);if(stableJSON(state)!==stableJSON(variables.stat_data))throw fail('projection_source','原生楼层状态与保存节点不一致');
 const avatar=c.characters?.[c.characterId]?.avatar,chatId=c.getCurrentChatId();
 return {accountId:run.accountId,runId:run.runId,avatar,chatId,nodeId:node.nodeId,operationId:receipt.operationId,branchId:run.branchId,revision:run.revision,floor,swipe,fingerprint:fingerprint(raw),state,document:doc,nativeRows:clone(c.chat)};
}

export function createStProjection({context,assertScope,writeTask,fingerprint,original,sync=()=>globalThis.CxxDataSync,database=()=>globalThis.AutoCardUpdaterAPI,parser=()=>globalThis.Cxx233Runtime?.parser,reference=floor=>globalThis.CxxContext?.reference?.(floor),contract:providedContract,material:providedMaterial,now=()=>new Date().toISOString(),event='cxx2051_web_committed'}={}){
 if(!context||!assertScope||!writeTask||!fingerprint)throw new TypeError('原生投影需要宿主来源、保存与指纹接口');
 let disposed=false,running=null,scheduled=false,lastError=null,lastReady=null;const listeners=new Set(),host=context(),events=host.eventSource;
 const status=()=>({running:!!running,error:clone(lastError),ready:clone(lastReady),rebuildable:true,modelCalls:0});
 const notify=()=>{for(const fn of listeners)try{fn(status());}catch{}};
 function source(){assertScope();if(disposed)throw fail('projection_closed','此聊天投影服务已关闭');return committedProjectionSource(context,fingerprint,original);}
 const signature=value=>stableJSON({accountId:value.accountId,runId:value.runId,avatar:value.avatar,chatId:value.chatId,nodeId:value.nodeId,operationId:value.operationId,branchId:value.branchId,revision:value.revision,floor:value.floor,swipe:value.swipe,fingerprint:value.fingerprint,state:value.state,memories:value.document.records?.memories||[]});
 async function one({force=false}={}){
  const origin=source();if(!origin)return {status:'not-owned'};const captured=signature(origin),sourceHash=await semanticHash(JSON.parse(captured));
  const ensure=()=>{const current=source();if(!current||signature(current)!==captured)throw fail('projection_stale','同步期间正文、人物状态或路线已经改变，旧表不作为当前状态');};
  ensure();const taskId='st-projection:'+origin.nodeId,prior=origin.document.records?.tasks?.find(task=>task.taskId===taskId),base={...clone(prior||{}),schema:1,taskId,kind:'st_projection',sourceNodeId:origin.nodeId,source:{accountId:origin.accountId,runId:origin.runId,nodeId:origin.nodeId,operationId:origin.operationId,branchId:origin.branchId,revision:origin.revision,floor:origin.floor,swipe:origin.swipe,fingerprint:origin.fingerprint,sha256:sourceHash},modelCalls:0};
  if(!force&&prior?.status==='ready'&&prior.source?.sha256===sourceHash){lastReady={...base.source,at:prior.completedAt};notify();return {status:'ready',replayed:true};}
  const adapter=sync();if(!adapter?.pushAll||adapter.sourceGuard!==true){const error=fail('projection_runtime','当前卡片尚未提供带来源检查的16表同步，请更新本地运行组件后重建投影');await writeTask({...base,status:'failed',error:{code:error.code,message:error.message},updatedAt:now()});throw error;}
  const task={...base,status:'running',attempts:(prior?.attempts||0)+1,startedAt:now(),updatedAt:now(),error:null};await writeTask(task);ensure();
  try{
   const db=database(),records=origin.document.records?.memories||[],nativeData=db?.exportTableAsJson?.(),material=providedMaterial||await loadMaterial(),hasMemory=records.some(record=>record.kind==='table'&&TABLE_NAMES.includes(record.table))||Object.values(nativeData||{}).some(table=>TABLE_NAMES.includes(table?.name)&&table.content?.slice(1).some(row=>material.source(row[table.content[0].indexOf(table.name==='纪要表'?'纪要':'来源')])?.webSource?.runId===origin.runId));let memoryProjection=null;
   if(hasMemory){if(!db?.exportTableAsJson||!db?.importTableAsJson)throw fail('projection_memory_plugin','原生数据库导入接口尚未就绪');const contract=providedContract||await loadContract();ensure();memoryProjection=await projectNativeMemory(origin,{parser:parser(),contract,material,current:nativeData,reference,projectionHash:sourceHash});ensure();}
   const result=await adapter.pushAll(clone(origin.state.terminal),Number(origin.state.terminal?.turn)||0,{assertCurrent:ensure,source:clone(base.source)});ensure();
   if(!result?.ok)throw fail('projection_failed',result?.reason||'原生状态表尚未完整同步');
   // Re-read after the 16-table mirror so its fresh rows cannot be replaced by the earlier snapshot.
   if(memoryProjection){const contract=providedContract||await loadContract(),material=providedMaterial||await loadMaterial();memoryProjection=await projectNativeMemory(origin,{parser:parser(),contract,material,current:db.exportTableAsJson(),reference,projectionHash:sourceHash});ensure();if(memoryProjection.changed){const imported=await db.importTableAsJson(JSON.stringify(memoryProjection.data));ensure();if(imported!==true&&imported?.success!==true)throw fail('projection_memory_failed','原生六表投影尚未保存');const readback=db.exportTableAsJson();for(const table of Object.values(memoryProjection.data).filter(table=>TABLE_NAMES.includes(table?.name))){const actual=Object.values(readback).find(value=>value?.name===table.name);if(stableJSON(actual?.content)!==stableJSON(table.content))throw fail('projection_memory_readback','原生六表投影读回不一致');}}}
   const finished={...task,status:'ready',completedAt:now(),updatedAt:now(),tables:(result.results||[]).map(row=>({table:row.table,rows:row.rows})),memoryRows:memoryProjection?.count||0,error:null};await writeTask(finished,{adoptProjection:true,assertCurrent:ensure});ensure();lastReady={...base.source,at:finished.completedAt};lastError=null;notify();return {status:'ready',taskId,source:clone(base.source)};
  }catch(error){lastError={code:error.code||'projection_failed',message:error.message};try{assertScope();let current=true;try{ensure();}catch{current=false;}await writeTask({...task,status:current?'failed':'stale',error:lastError,updatedAt:now()},current?{adoptProjection:true,assertCurrent:ensure}:{});}catch{}notify();throw error;}
 }
 function run(options={}){scheduled=true;if(running)return running;running=(async()=>{let result;while(scheduled&&!disposed){scheduled=false;result=await one(options);}return result;})().catch(error=>{lastError={code:error.code||'projection_failed',message:error.message};notify();throw error;}).finally(()=>{running=null;notify();if(scheduled&&!disposed)void run().catch(()=>{});});notify();return running;}
 const onCommit=()=>{void run().catch(()=>{});};events.on(event,onCommit);
 const api={schedule:run,retry:()=>run({force:true}),status,subscribe(fn){listeners.add(fn);fn(status());return()=>listeners.delete(fn);},dispose(){disposed=true;events.removeListener(event,onCommit);listeners.clear();}};
 // Reopening resumes a pending/failed projection; the canonical chat is already durable.
 queueMicrotask(()=>{if(!disposed)void run().catch(()=>{});});return api;
}
