/** Fixed-shape diagnostics. Story text, media, prompts and connection settings stay out. */
import {inspectSnapshot} from './backup.mjs';
export async function auditRun(port,runId){
 const snapshot=await port.exportRun(runId),run=snapshot.run,counts=Object.fromEntries(Object.entries(snapshot.tables).map(([name,rows])=>[name,rows.length]));let inspection;
 try{inspection=inspectSnapshot(snapshot);}catch(error){inspection={readable:false,issues:[{code:error.code||'save_invalid',message:error.message}]};}
 const tasks={};for(const row of snapshot.tables.tasks||[])tasks[row.status||'unknown']=(tasks[row.status||'unknown']||0)+1;
 const candidates=(snapshot.tables.drafts||[]).filter(row=>row.operationId).map(row=>({operationId:row.operationId,nodeId:row.nodeId,parentNodeId:row.parentNodeId,phase:row.phase,complete:row.complete===true,errorCode:row.error?.code||null,errorStage:row.error?.stage||null}));
 return {schema:1,kind:'tokyo2051.storage-diagnostic',at:new Date().toISOString(),storage:port.kind,story:{runId:run.runId,revision:run.revision,branchId:run.branchId,headNodeId:run.headNodeId,contentVersion:run.contentVersion||null},counts,tasks,candidates,inspection};
}
export function attachStorageAudit(port){port.auditRun=runId=>auditRun(port,runId);return port;}
