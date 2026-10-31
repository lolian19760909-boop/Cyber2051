/** Portable story data. Connections and downloadable official caches are outside this contract. */
import {clone,stateAt} from './records.mjs';
import {packMedia,unpackMedia} from './media.mjs';
import {newId} from '../core/ids.mjs';
export const SAVE_FORMAT='tokyo2051.web-save.v1';
export const SAVE_TABLES=['nodes','states','branches','receipts','checkpoints','tasks','drafts','memories','summaries','indices','media'];
export const SAVE_KEYS={nodes:'nodeId',states:'branchId',branches:'branchId',receipts:'operationId',checkpoints:'checkpointId',tasks:'taskId',drafts:'id',memories:'id',summaries:'id',indices:'id',media:'mediaId'};
const MAX_BYTES=256*1024*1024;
const fault=(code,message)=>Object.assign(new Error(message),{code});
async function digest(text){const input=new TextEncoder().encode(text),bytes=globalThis.CxxCrypto?.digest?await globalThis.CxxCrypto.digest(input):await crypto.subtle.digest('SHA-256',input);return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function bounded(stream,maximum=MAX_BYTES){const reader=stream.getReader(),parts=[];let bytes=0;try{while(true){const row=await reader.read();if(row.done)break;bytes+=row.value.byteLength;if(bytes>maximum)throw fault('save_too_large','存档超过256 MiB导入上限');parts.push(row.value);}}catch(error){await reader.cancel().catch(()=>{});throw error;}return new Blob(parts);}
export function inspectSnapshot(snapshot){
 const issues=[];if(snapshot?.workId!=='tokyo2051'||![1,2].includes(snapshot.schema))throw fault('save_version','这不是支持的东京都2051存档版本');
 if(!snapshot.run?.runId||!snapshot.run.accountId||!snapshot.tables||!Array.isArray(snapshot.tables.nodes))throw fault('save_invalid','存档缺少故事身份或历史');
 for(const name of SAVE_TABLES)if(snapshot.tables[name]!==undefined&&!Array.isArray(snapshot.tables[name]))throw fault('save_invalid','存档集合损坏：'+name);
 for(const name of SAVE_TABLES){const seen=new Set();for(const row of snapshot.tables[name]||[]){const id=row?.[SAVE_KEYS[name]];if(typeof id!=='string'||!id||seen.has(id))throw fault('save_invalid','存档记录身份缺失或重复：'+name);seen.add(id);}}
 const nodes=snapshot.tables.nodes,ids=new Set();for(const node of nodes){if(!node?.nodeId||ids.has(node.nodeId))throw fault('save_invalid','历史节点身份重复或缺失');ids.add(node.nodeId);}
 for(const node of nodes)if(node.parentId&&!ids.has(node.parentId))issues.push({code:'parent_missing',nodeId:node.nodeId});
 try{stateAt(nodes,snapshot.run.headNodeId);}catch(error){issues.push({code:error.code||'history_unavailable',message:error.message});}
 for(const branch of snapshot.tables.branches||[])try{stateAt(nodes,branch.headNodeId);}catch(error){issues.push({code:'branch_unavailable',branchId:branch.branchId,message:error.message});}
 return {readable:!issues.some(row=>row.code!=='branch_unavailable'),issues,nodeCount:nodes.length,branchCount:snapshot.tables.branches?.length||0,mediaCount:snapshot.tables.media?.length||0,runId:snapshot.run.runId};
}
export async function encodeSave(snapshot,{compress=true}={}){
 inspectSnapshot(snapshot);const content=await packMedia({...snapshot,schema:snapshot.tables.nodes.some(node=>node.hostRowsDelta)?2:snapshot.schema}),text=JSON.stringify(content);if(new TextEncoder().encode(text).length>MAX_BYTES)throw fault('save_too_large','存档超过256 MiB导出上限');
 const file=new Blob([JSON.stringify({format:SAVE_FORMAT,algorithm:'SHA-256',checksum:await digest(text),content})],{type:'application/json'});
 return compress&&typeof CompressionStream!=='undefined'?new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).blob():file;
}
export async function decodeSave(file){
 if(!(file instanceof Blob)||file.size>MAX_BYTES)throw fault('save_too_large','请选择256 MiB以内的存档');
 const head=new Uint8Array(await file.slice(0,2).arrayBuffer()),gzip=head[0]===31&&head[1]===139;
 let text;if(gzip){if(typeof DecompressionStream==='undefined')throw fault('save_compression','此浏览器不支持gzip存档，请用较新浏览器导入');text=await(await bounded(file.stream().pipeThrough(new DecompressionStream('gzip')))).text();}else text=await file.text();
 let envelope;try{envelope=JSON.parse(text);}catch{throw fault('save_invalid','存档文件不是完整JSON');}
 if(envelope.format!==SAVE_FORMAT||envelope.algorithm!=='SHA-256')throw fault('save_version','存档版本不受支持，原文件未被修改');
 if(await digest(JSON.stringify(envelope.content))!==envelope.checksum)throw fault('save_checksum','存档校验不符，请使用完整的原始文件');
 const inspection=inspectSnapshot(envelope.content),snapshot=await unpackMedia(envelope.content);return {snapshot,inspection};
}
export async function prepareImportedSnapshot(snapshot,{accountId,runId=newId('run'),mode='local',parser,repair=false}={}){
 const inspection=inspectSnapshot(snapshot);if(!accountId)throw fault('account_mismatch','导入需要当前玩家身份');
 let next=clone(snapshot),oldRunId=next.run.runId;const originalAccount=next.run.accountId;
 if(!inspection.readable){
  // Older saves sometimes retained only the current branch state. Preserve the source graph
  // and fork a readable recovery root; never invent missing historical states.
  if(!repair)throw fault('save_repair_required','此档当前历史不完整，请检查报告后选择从已保存状态恢复');
  const saved=next.tables.states?.find(row=>row.branchId===next.run.branchId)?.data;
  if(!saved)throw fault('save_unrecoverable','此档没有可读的当前状态，请保留原文件并导入较早备份');
  const nodeId=newId('recovery'),branchId=newId('branch');next.tables.nodes.push({runId:oldRunId,nodeId,parentId:null,branchId,depth:1,revision:next.run.revision+1,snapshot:clone(saved),message:{kind:'program',raw:'',recovery:true},createdAt:new Date().toISOString()});
  next.tables.branches||=[];next.tables.branches.push({runId:oldRunId,branchId,headNodeId:nodeId,revision:next.run.revision+1,label:'从原档状态恢复'});Object.assign(next.run,{headNodeId:nodeId,branchId,revision:next.run.revision+1});
 }
 next=await (await import('../memory/rebase.mjs')).rebaseImportedMemory(next,{oldRunId,newRunId:runId,accountId,parser});
 next.run={...next.run,runId,accountId,mode,importedFrom:{runId:oldRunId,accountId:originalAccount,at:new Date().toISOString(),issues:inspection.issues}};
 for(const name of SAVE_TABLES){next.tables[name]||=[];next.tables[name]=next.tables[name].map(row=>({...row,runId,...(Object.hasOwn(row,'accountId')?{accountId}:{})}));}
 const data=stateAt(next.tables.nodes,next.run.headNodeId);next.tables.states=next.tables.states.filter(row=>row.branchId!==next.run.branchId).concat({runId,branchId:next.run.branchId,data,revision:next.run.revision});
 return next;
}
