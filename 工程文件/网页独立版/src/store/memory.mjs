/** Test state port with the same history contract as IDB; never used as player storage. */
import { clone, assertOwner, lineage, stateAt, prepareCommit,prepareProfileCommit } from './records.mjs';
import { newId } from '../core/ids.mjs';
import {attachStorageAudit} from './audit.mjs';
import {SAVE_TABLES,SAVE_KEYS,prepareImportedSnapshot} from './backup.mjs';
export function createMemoryStatePort({ accountId } = {}) {
  const tables=Object.fromEntries(['runs','nodes','states','receipts','tasks','branches','checkpoints','drafts','memories','summaries','indices','media','settings'].map(name=>[name,new Map()]));
  let queue=Promise.resolve(), generating=false;
  const key=(run,id)=>JSON.stringify([run,id]);
  const getRun=runId=>{const run=tables.runs.get(runId);assertOwner(run,accountId);return run;};
  const rows=(name,runId)=>[...tables[name].values()].filter(row=>row.runId===runId);
  const head=(runId,branchId)=>{const run=getRun(runId),branch=tables.branches.get(key(runId,branchId||run?.branchId));return {revision:run?.revision||0,headNodeId:branch?.headNodeId||((!branchId||branchId===run?.branchId)?run?.headNodeId:null)||null,branchId:branchId||run?.branchId||null};};
  function serial(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}
  const port={
    kind:'memory',
    readMacroGlobals:async()=>clone(tables.settings.get('macro-globals')?.value||{}),
    writeMacroGlobals:async value=>{tables.settings.set('macro-globals',{value:clone(value)});return clone(value);},
    readContentLibrary:async()=>clone(tables.settings.get('content-library')?.value??null),
    writeContentLibrary:async value=>{tables.settings.set('content-library',{value:clone(value)});return clone(value);},
    async withRunLock(runId,fn){if(generating)throw Object.assign(new Error('已有回合正在处理'),{code:'turn_busy'});generating=true;try{return await fn();}finally{generating=false;}},
    readRun:async runId=>clone(getRun(runId)||null),
    readSnapshot:async(runId,nodeId)=>{const current=getRun(runId),h=head(runId),allNodes=rows('nodes',runId),selected=nodeId===undefined?h.headNodeId:nodeId;return clone({head:h,run:current,nodes:lineage(allNodes,selected),state:selected?stateAt(allNodes,selected):null,allNodes});},
    listRuns:async owner=>[...tables.runs.values()].filter(run=>run.accountId===(accountId||owner)).map(clone),
    readHead:async(runId,branchId)=>head(runId,branchId),
    readStorySettings:async runId=>{getRun(runId);return clone(tables.settings.get(key(runId,'story'))?.value??null);},
    writeStorySettings:async(runId,value)=>{getRun(runId);tables.settings.set(key(runId,'story'),{runId,id:'story',value:clone(value??null),updatedAt:new Date().toISOString()});return clone(value??null);},
 readStoryAgent:async runId=>{getRun(runId);return clone(tables.settings.get(key(runId,'agent'))?.value??null);},
 writeStoryAgent:async(runId,value)=>{getRun(runId);tables.settings.set(key(runId,'agent'),{runId,id:'agent',value:clone(value??null),updatedAt:new Date().toISOString()});return clone(value??null);},
    readState:async(runId,branchId)=>{getRun(runId);return clone(tables.states.get(key(runId,branchId))||null);},
    readNode:async(runId,nodeId)=>{getRun(runId);return clone(tables.nodes.get(key(runId,nodeId))||null);},
    readReceipt:async(runId,id)=>{getRun(runId);return clone(tables.receipts.get(key(runId,id))||null);},
    readMedia:async(runId,id)=>{getRun(runId);return clone(tables.media.get(key(runId,id))||null);},
    readLineage:async(runId,nodeId)=>{const h=head(runId);return clone(lineage(rows('nodes',runId),nodeId===undefined?h.headNodeId:nodeId));},
    readNodeState:async(runId,nodeId)=>{getRun(runId);const node=tables.nodes.get(key(runId,nodeId));if(node?.snapshot!==undefined)return clone(node.snapshot);return stateAt(rows('nodes',runId),nodeId);},
    listBranches:async runId=>{getRun(runId);return clone(rows('branches',runId));},
    listTasks:async(runId,status='pending')=>{getRun(runId);return clone(rows('tasks',runId).filter(row=>!status||row.status===status));},
    listRecords:async(name,runId)=>{getRun(runId);return clone(rows(name,runId));},
    readRecord:async(name,runId,id)=>{getRun(runId);return clone(tables[name].get(key(runId,id))||null);},
    putRecords:async(name,runId,records)=>serial(()=>{getRun(runId);if(!['tasks','drafts','memories','summaries','indices','media'].includes(name))throw new Error('不可写记录类型');for(const row of records)tables[name].set(key(runId,row.id||row.taskId||row.mediaId),clone({...row,runId}));}),
    async commit(operation){return serial(()=>{
      const {runId,branchId,operationId}=operation,current=getRun(runId);assertOwner(current,operation.accountId);
      if(accountId&&accountId!==operation.accountId)throw Object.assign(new Error('存档身份不匹配'),{code:'account_mismatch'});
      const existing=tables.receipts.get(key(runId,operationId));
      if(existing)return {status:'replayed',revision:existing.revision,nodeId:existing.nodeId,receipt:clone(existing.receipt)};
      if((current?.revision||0)!==operation.expectedRevision)return {status:'conflict',currentRevision:current?.revision||0,headNodeId:current?.headNodeId||null};
      const prepared=prepareCommit(operation,current,tables.states.get(key(runId,current?.branchId)),tables.nodes.get(key(runId,operation.parentNodeId)));
      if(!prepared)return {status:'conflict',currentRevision:current?.revision||0,headNodeId:current?.headNodeId||null};
      const backups=Object.fromEntries(Object.entries(tables).map(([name,map])=>[name,new Map(map)]));
      try{
        tables.nodes.set(key(runId,operation.nodeId),prepared.node);tables.states.set(key(runId,branchId),prepared.state);
        tables.receipts.set(key(runId,operationId),prepared.receipt);tables.runs.set(runId,prepared.run);tables.branches.set(key(runId,branchId),prepared.branch);
        for(const task of operation.tasks||[])tables.tasks.set(key(runId,task.taskId||task.id),clone({...task,runId,sourceNodeId:operation.nodeId,status:'pending',createdAt:prepared.node.createdAt}));
        for(const media of operation.media||[])tables.media.set(key(runId,media.mediaId||media.id),clone({...media,runId}));
        tables.drafts.delete(key(runId,'candidate'));tables.drafts.delete(key(runId,operationId));
        if(operation.failAfterWrites)throw new Error('注入的写入失败');
        return {status:'committed',revision:prepared.run.revision,nodeId:operation.nodeId,receipt:clone(prepared.receipt)};
      }catch(error){for(const name of Object.keys(tables))tables[name]=backups[name];throw error;}
    });},
    commitProfile:operation=>serial(()=>{const current=getRun(operation.runId);if(accountId&&operation.accountId!==accountId)throw Object.assign(new Error('存档身份不匹配'),{code:'account_mismatch'});const prior=tables.receipts.get(key(operation.runId,operation.operationId));if(prior)return {status:'replayed',revision:prior.revision,nodeId:prior.nodeId};const prepared=prepareProfileCommit(operation,current);if(!prepared)return {status:'conflict',currentRevision:current.revision};for(const media of operation.media||[])tables.media.set(key(current.runId,media.mediaId||media.id),clone({...media,runId:current.runId}));tables.runs.set(current.runId,prepared.run);tables.receipts.set(key(current.runId,operation.operationId),prepared.receipt);return {status:'committed',revision:prepared.run.revision,nodeId:prepared.run.headNodeId};}),
    async createCheckpoint(runId,label='存档点',{nodeId}={}){return serial(()=>{const h=head(runId);if(!h.headNodeId)throw new Error('还没有已保存回合');if(nodeId)stateAt(rows('nodes',runId),nodeId);const row={runId,checkpointId:newId('checkpoint'),nodeId:nodeId||h.headNodeId,branchId:h.branchId,label,createdAt:new Date().toISOString()};tables.checkpoints.set(key(runId,row.checkpointId),row);return clone(row);});},
    listCheckpoints:async runId=>{getRun(runId);return clone(rows('checkpoints',runId));},
    async deleteCheckpoint(runId,checkpointId){return serial(()=>{getRun(runId);if(!tables.checkpoints.delete(key(runId,checkpointId)))throw new Error('存档点不存在');return {deleted:checkpointId};});},
    async deleteRun(runId){return serial(()=>{getRun(runId);for(const name of SAVE_TABLES)for(const row of rows(name,runId))tables[name].delete(key(runId,row[SAVE_KEYS[name]]));tables.runs.delete(runId);tables.settings.delete(key(runId,'story'));tables.settings.delete(key(runId,'agent'));return {deleted:runId};});},
    async selectBranch(runId,branchId,expectedRevision){return serial(()=>{const run=getRun(runId),branch=tables.branches.get(key(runId,branchId));if(!branch)throw new Error('路线不存在');if(run.revision!==expectedRevision)return {status:'conflict',currentRevision:run.revision};const next={...run,branchId,headNodeId:branch.headNodeId,revision:run.revision+1};tables.runs.set(runId,next);return clone(next);});},
    async restoreCheckpoint(runId,checkpointId){return serial(()=>{const run=getRun(runId),point=tables.checkpoints.get(key(runId,checkpointId));if(!point)throw new Error('存档点不存在');const branchId=newId('branch'),data=stateAt(rows('nodes',runId),point.nodeId);tables.branches.set(key(runId,branchId),{runId,branchId,headNodeId:point.nodeId,revision:run.revision+1,label:point.label});tables.states.set(key(runId,branchId),{runId,branchId,data,revision:run.revision+1});const next={...run,branchId,headNodeId:point.nodeId,revision:run.revision+1};tables.runs.set(runId,next);return clone(next);});},
    exportRun:async runId=>{const current=getRun(runId);if(!current)throw new Error('故事不存在');return {workId:'tokyo2051',schema:1,run:clone(current),tables:Object.fromEntries(SAVE_TABLES.map(name=>[name,clone(rows(name,runId))])),extensions:{storySettings:clone(tables.settings.get(key(runId,'story'))?.value??null),storyAgent:clone(tables.settings.get(key(runId,'agent'))?.value??null)},exportedAt:new Date().toISOString()};},
    async importRun(snapshot,options={}){const next=await prepareImportedSnapshot(snapshot,{...options,accountId:accountId||options.accountId});return serial(()=>{if(tables.runs.has(next.run.runId))throw new Error('目标故事已存在，请作为新故事导入');tables.runs.set(next.run.runId,clone(next.run));for(const [field,id]of [['storySettings','story'],['storyAgent','agent']])if(next.extensions?.[field])tables.settings.set(key(next.run.runId,id),{runId:next.run.runId,id,value:clone(next.extensions[field])});for(const name of SAVE_TABLES)for(const row of next.tables[name])tables[name].set(key(next.run.runId,row[SAVE_KEYS[name]]),clone(row));return clone(next.run);});},
    close:async()=>{},
  };
  return attachStorageAudit(port);
}
