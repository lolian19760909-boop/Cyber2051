/** Independent player storage. Atomic commits, immutable node history and account-scoped reads. */
import { clone, assertOwner, lineage, stateAt, prepareCommit,prepareProfileCommit } from './records.mjs';
import { newId } from '../core/ids.mjs';
import {attachStorageAudit} from './audit.mjs';
import {SAVE_TABLES,prepareImportedSnapshot} from './backup.mjs';
export const DB_NAME='cxx2051-web', DB_VERSION=3;
export const STORES=Object.freeze(Object.fromEntries(['runs','nodes','states','receipts','tasks','checkpoints','settings','media','branches','drafts','memories','summaries','indices','leases','backups'].map(name=>[name,name])));
const KEYS={runs:'runId',nodes:['runId','nodeId'],states:['runId','branchId'],receipts:['runId','operationId'],tasks:['runId','taskId'],checkpoints:['runId','checkpointId'],settings:'key',media:['runId','mediaId'],branches:['runId','branchId'],drafts:['runId','id'],memories:['runId','id'],summaries:['runId','id'],indices:['runId','id'],leases:'runId',backups:['runId','id']};
const request=q=>new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
const completed=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('事务被中止'));tx.onerror=()=>{};});
export class ConflictError extends Error {constructor(current){super('修订号冲突');this.code='conflict';this.current=current;}}
export function openDatabase(factory=globalThis.indexedDB,name=DB_NAME){
  if(!factory)throw new Error('当前环境没有 IndexedDB');
  const q=factory.open(name,DB_VERSION);
  q.onupgradeneeded=()=>{
    const db=q.result;
    for(const [name,keyPath] of Object.entries(KEYS)){
      const store=db.objectStoreNames.contains(name)?q.transaction.objectStore(name):db.createObjectStore(name,{keyPath});
      if(!['runs','settings','leases'].includes(name)&&!store.indexNames.contains('byRun'))store.createIndex('byRun','runId');
      if(name==='nodes'&&!store.indexNames.contains('byParent'))store.createIndex('byParent','parentId');
      if(name==='tasks'&&!store.indexNames.contains('byStatus'))store.createIndex('byStatus','status');
    }
  };
  return new Promise((resolve,reject)=>{
    q.onsuccess=()=>{q.result.onversionchange=()=>q.result.close();resolve(q.result);};
    q.onerror=()=>reject(q.error);
    q.onblocked=()=>reject(Object.assign(new Error('其他页面仍占用旧版存档库，请关闭旧页面后重试'),{code:'upgrade_blocked'}));
  });
}
export function createIdbStatePort(options={}){
  const factory=options.factory||globalThis.indexedDB,locks=options.lockManager||globalThis.navigator?.locks,owner=options.accountId;
  let dbPromise;
  const database=()=>dbPromise||(dbPromise=openDatabase(factory,options.name||DB_NAME));
  async function tx(names,mode,fn){
    const db=await database(),transaction=db.transaction(names,mode),done=completed(transaction);done.catch(()=>{});
    try{const result=await fn(transaction);await done;return result;}catch(error){try{transaction.abort();}catch{}await done.catch(()=>{});throw error;}
  }
  const run=async(t,runId)=>{const row=await request(t.objectStore('runs').get(runId));assertOwner(row,owner);return row;};
  const list=(t,name,runId)=>request(t.objectStore(name).index('byRun').getAll(runId));
  async function readHead(runId,branchId){return tx(['runs','branches'],'readonly',async t=>{const current=await run(t,runId),id=branchId||current?.branchId;const branch=id?await request(t.objectStore('branches').get([runId,id])):null;return {revision:current?.revision||0,headNodeId:branch?.headNodeId||((!branchId||branchId===current?.branchId)?current?.headNodeId:null)||null,branchId:id||null};});}
  async function readRecord(name,runId,id){return tx(['runs',name],'readonly',async t=>{await run(t,runId);return await request(t.objectStore(name).get([runId,id]))||null;});}
  async function listRecords(name,runId){return tx(['runs',name],'readonly',async t=>{await run(t,runId);return list(t,name,runId);});}
  async function withRunLock(runId,fn){
    if(locks?.request)return locks.request('cxx2051:generate:'+runId,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Object.assign(new Error('另一页面正在处理这个故事'),{code:'turn_busy'});return fn();});
    const leaseId=newId('lease'),leaseMs=90000;
    await tx(['leases'],'readwrite',async t=>{const store=t.objectStore('leases'),old=await request(store.get(runId));if(old&&old.expires>Date.now())throw Object.assign(new Error('另一页面正在处理这个故事'),{code:'turn_busy'});store.put({runId,leaseId,expires:Date.now()+leaseMs});});
    const timer=setInterval(()=>tx(['leases'],'readwrite',async t=>{const store=t.objectStore('leases'),old=await request(store.get(runId));if(old?.leaseId===leaseId)store.put({...old,expires:Date.now()+leaseMs});}).catch(()=>{}),20000);
    try{return await fn();}finally{clearInterval(timer);await tx(['leases'],'readwrite',async t=>{const store=t.objectStore('leases'),old=await request(store.get(runId));if(old?.leaseId===leaseId)store.delete(runId);});}
  }
  async function readStorySettings(runId){return tx(['runs','settings'],'readonly',async t=>{await run(t,runId);const row=await request(t.objectStore('settings').get('story:'+runId));return row?.value??null;});}
  async function writeStorySettings(runId,value){return tx(['runs','settings'],'readwrite',async t=>{const current=await run(t,runId);assertOwner(current,owner);await request(t.objectStore('settings').put({key:'story:'+runId,runId,owner:current?.accountId??owner??null,value:clone(value??null),updatedAt:new Date().toISOString()}));return clone(value??null);});}
  async function readStoryAgent(runId){return tx(['runs','settings'],'readonly',async t=>{await run(t,runId);const row=await request(t.objectStore('settings').get('agent:'+runId));return row?.value??null;});}
  async function writeStoryAgent(runId,value){return tx(['runs','settings'],'readwrite',async t=>{const current=await run(t,runId);assertOwner(current,owner);await request(t.objectStore('settings').put({key:'agent:'+runId,runId,owner:current?.accountId??owner??null,value:clone(value??null),updatedAt:new Date().toISOString()}));return clone(value??null);});}
  const port={
    kind:'idb',
    readMacroGlobals:()=>tx(['settings'],'readonly',async t=>(await request(t.objectStore('settings').get('macro-globals:'+owner)))?.value||{}),
    writeMacroGlobals:value=>tx(['settings'],'readwrite',async t=>{await request(t.objectStore('settings').put({key:'macro-globals:'+owner,owner,value:clone(value)}));return clone(value);}),
    readContentLibrary:()=>tx(['settings'],'readonly',async t=>(await request(t.objectStore('settings').get('content-library:'+owner)))?.value??null),
    writeContentLibrary:value=>tx(['settings'],'readwrite',async t=>{t.objectStore('settings').put({key:'content-library:'+owner,owner,value:clone(value)});return clone(value);}),withRunLock,readHead,readStorySettings,writeStorySettings,readStoryAgent,writeStoryAgent,
    readRun:runId=>tx(['runs'],'readonly',t=>run(t,runId)),
    readSnapshot:(runId,nodeId)=>tx(['runs','branches','nodes'],'readonly',async t=>{
      const current=await run(t,runId),branchId=current?.branchId||null;
      const [branch,allNodes]=await Promise.all([branchId?request(t.objectStore('branches').get([runId,branchId])):null,list(t,'nodes',runId)]);
      const head={revision:current?.revision||0,headNodeId:branch?.headNodeId||current?.headNodeId||null,branchId},selected=nodeId===undefined?head.headNodeId:nodeId;
      return {head,run:current,nodes:lineage(allNodes,selected),state:selected?stateAt(allNodes,selected):null,allNodes};
    }),
    listRuns:accountId=>tx(['runs'],'readonly',async t=>(await request(t.objectStore('runs').getAll())).filter(row=>row.accountId===(owner||accountId))),
    readState:(runId,id)=>readRecord('states',runId,id),readNode:(runId,id)=>readRecord('nodes',runId,id),readReceipt:(runId,id)=>readRecord('receipts',runId,id),
    readMedia:(runId,id)=>readRecord('media',runId,id),
    async readLineage(runId,nodeId){const head=await readHead(runId);return lineage(await listRecords('nodes',runId),nodeId===undefined?head.headNodeId:nodeId);},
    async readNodeState(runId,nodeId){if(!nodeId)return null;const node=await readRecord('nodes',runId,nodeId);if(node?.snapshot!==undefined)return clone(node.snapshot);return stateAt(await listRecords('nodes',runId),nodeId);},
    listBranches:runId=>listRecords('branches',runId),listCheckpoints:runId=>listRecords('checkpoints',runId),listRecords,readRecord,
    async deleteCheckpoint(runId,checkpointId){return tx(['runs','checkpoints'],'readwrite',async t=>{await run(t,runId);const store=t.objectStore('checkpoints');if(!(await request(store.get([runId,checkpointId]))))throw new Error('存档点不存在');store.delete([runId,checkpointId]);return {deleted:checkpointId};});},
    async deleteRun(runId){return tx(['runs','settings','leases',...SAVE_TABLES],'readwrite',async t=>{const current=await run(t,runId);assertOwner(current,owner);for(const name of SAVE_TABLES)for(const row of await list(t,name,runId))t.objectStore(name).delete(KEYS[name].map(k=>row[k]));t.objectStore('runs').delete(runId);t.objectStore('leases').delete(runId);t.objectStore('settings').delete('story:'+runId);t.objectStore('settings').delete('agent:'+runId);return {deleted:runId};});},
    async listTasks(runId,status='pending'){return (await listRecords('tasks',runId)).filter(row=>!status||row.status===status);},
    async putRecords(name,runId,records){if(!['tasks','drafts','memories','summaries','indices','media','backups'].includes(name))throw new Error('不可写记录类型');return tx(['runs',name],'readwrite',async t=>{await run(t,runId);for(const record of records){const row={...record,runId};if(name==='tasks')row.taskId??=row.id;if(name==='media')row.mediaId??=row.id;t.objectStore(name).put(row);}});},
    async commit(operation){
      const {runId,branchId,operationId}=operation;
      if(owner&&operation.accountId!==owner)throw Object.assign(new Error('存档身份不匹配'),{code:'account_mismatch'});
      return tx(['runs','branches','nodes','states','receipts','tasks','drafts','media'],'readwrite',async t=>{
        const current=await run(t,runId);assertOwner(current,operation.accountId);
        const existing=await request(t.objectStore('receipts').get([runId,operationId]));
        if(existing)return {status:'replayed',revision:existing.revision,nodeId:existing.nodeId,receipt:existing.receipt};
        if((current?.revision||0)!==operation.expectedRevision)return {status:'conflict',currentRevision:current?.revision||0,headNodeId:current?.headNodeId||null};
        const state=current?.branchId?await request(t.objectStore('states').get([runId,current.branchId])):null;
        const parent=operation.parentNodeId?await request(t.objectStore('nodes').get([runId,operation.parentNodeId])):null;
        const prepared=prepareCommit(operation,current,state,parent);
        if(!prepared)return {status:'conflict',currentRevision:current?.revision||0,headNodeId:current?.headNodeId||null};
        for(const [name,row] of Object.entries({runs:prepared.run,branches:prepared.branch,nodes:prepared.node,states:prepared.state,receipts:prepared.receipt}))t.objectStore(name).put(row);
        for(const task of operation.tasks||[])t.objectStore('tasks').put({...task,taskId:task.taskId||task.id,runId,sourceNodeId:operation.nodeId,status:'pending',createdAt:prepared.node.createdAt});
        for(const media of operation.media||[])t.objectStore('media').put({...media,mediaId:media.mediaId||media.id,runId});
        t.objectStore('drafts').delete([runId,'candidate']);
        t.objectStore('drafts').delete([runId,operationId]);
        if(operation.failAfterWrites)throw new Error('注入的写入失败');
        return {status:'committed',revision:prepared.run.revision,nodeId:operation.nodeId,receipt:prepared.receipt};
      });
    },
    async commitProfile(operation){
      if(owner&&operation.accountId!==owner)throw Object.assign(new Error('存档身份不匹配'),{code:'account_mismatch'});
      return tx(['runs','states','branches','receipts','media'],'readwrite',async t=>{const current=await run(t,operation.runId),prior=await request(t.objectStore('receipts').get([operation.runId,operation.operationId]));assertOwner(current,operation.accountId);if(prior)return {status:'replayed',nodeId:prior.nodeId,revision:prior.revision};const prepared=prepareProfileCommit(operation,current);if(!prepared)return {status:'conflict',currentRevision:current.revision};for(const media of operation.media||[])t.objectStore('media').put({...media,mediaId:media.mediaId||media.id,runId:operation.runId});t.objectStore('runs').put(prepared.run);t.objectStore('receipts').put(prepared.receipt);const branch=await request(t.objectStore('branches').get([current.runId,current.branchId]));if(branch)t.objectStore('branches').put({...branch,revision:prepared.run.revision});return {status:'committed',nodeId:prepared.run.headNodeId,revision:prepared.run.revision};});
    },
    async createCheckpoint(runId,label='存档点',{nodeId}={}){if(nodeId)await port.readNodeState(runId,nodeId);return tx(['runs','checkpoints'],'readwrite',async t=>{const current=await run(t,runId);if(!current?.headNodeId)throw new Error('还没有已保存回合');const row={runId,checkpointId:newId('checkpoint'),nodeId:nodeId||current.headNodeId,branchId:current.branchId,label,createdAt:new Date().toISOString()};t.objectStore('checkpoints').put(row);return row;});},
    async selectBranch(runId,branchId,expectedRevision){return tx(['runs','branches'],'readwrite',async t=>{const current=await run(t,runId),branch=await request(t.objectStore('branches').get([runId,branchId]));if(!branch)throw new Error('路线不存在');if(current.revision!==expectedRevision)return {status:'conflict',currentRevision:current.revision};const next={...current,branchId,headNodeId:branch.headNodeId,revision:current.revision+1};t.objectStore('runs').put(next);return next;});},
    async restoreCheckpoint(runId,checkpointId){
      const point=await readRecord('checkpoints',runId,checkpointId);if(!point)throw new Error('存档点不存在');
      const before=await readHead(runId),data=await port.readNodeState(runId,point.nodeId),branchId=newId('branch');
      return tx(['runs','branches','states'],'readwrite',async t=>{const current=await run(t,runId);if(current.revision!==before.revision)return {status:'conflict',currentRevision:current.revision};const next={...current,branchId,headNodeId:point.nodeId,revision:current.revision+1};t.objectStore('branches').put({runId,branchId,headNodeId:point.nodeId,revision:next.revision,label:point.label});t.objectStore('states').put({runId,branchId,data,revision:next.revision});t.objectStore('runs').put(next);return next;});
    },
    exportRun:runId=>tx(['runs','settings',...SAVE_TABLES],'readonly',async t=>{const current=await run(t,runId);if(!current)throw new Error('故事不存在');const data=await Promise.all(SAVE_TABLES.map(name=>list(t,name,runId)));return {workId:'tokyo2051',schema:1,run:clone(current),tables:Object.fromEntries(SAVE_TABLES.map((name,index)=>[name,data[index]])),extensions:{storySettings:(await request(t.objectStore('settings').get('story:'+runId)))?.value??null,storyAgent:(await request(t.objectStore('settings').get('agent:'+runId)))?.value??null},exportedAt:new Date().toISOString()};}),
    async importRun(snapshot,options={}){const next=await prepareImportedSnapshot(snapshot,{...options,accountId:owner||options.accountId});return tx(['runs','settings',...SAVE_TABLES],'readwrite',async t=>{if(await request(t.objectStore('runs').get(next.run.runId)))throw new Error('目标故事已存在，请作为新故事导入');t.objectStore('runs').put(next.run);for(const [field,prefix]of [['storySettings','story'],['storyAgent','agent']])if(next.extensions?.[field])t.objectStore('settings').put({key:prefix+':'+next.run.runId,runId:next.run.runId,owner:next.run.accountId,value:clone(next.extensions[field])});for(const name of SAVE_TABLES)for(const row of next.tables[name])t.objectStore(name).put(row);return clone(next.run);});},
    async close(){if(dbPromise)(await dbPromise).close();dbPromise=null;},
  };
  return attachStorageAudit(port);
}
