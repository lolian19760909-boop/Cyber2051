/** JSON history primitives shared by IDB and host stores. No model/network calls. */
export const clone = value => value === undefined ? undefined : structuredClone(value);
const escape = key => String(key).replaceAll('~','~0').replaceAll('/','~1');
function equalValue(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)||Array.isArray(a)&&a.length!==b.length)return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equalValue(a[key],b[key]));}
export function diffState(before, after, pointer = '') {
  if (Object.is(before, after)) return [];
  if(Array.isArray(before)&&Array.isArray(after)&&equalValue(before,after))return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return [{op:'replace',path:pointer,value:clone(after)}];
  const changes=[];
  for (const key of Object.keys(before)) if (!Object.hasOwn(after,key)) changes.push({op:'remove',path:pointer+'/'+escape(key)});
  for (const key of Object.keys(after)) {
    const path=pointer+'/'+escape(key);
    if (!Object.hasOwn(before,key)) changes.push({op:'add',path,value:clone(after[key])});
    else changes.push(...diffState(before[key],after[key],path));
  }
  return changes;
}
export function applyChanges(before, changes) {
  let state=clone(before);
  for (const change of changes || []) {
    if(change.path===''){ state=clone(change.value);continue; }
    const parts=change.path.slice(1).split('/').map(x=>x.replaceAll('~1','/').replaceAll('~0','~'));
    if(parts.some(x=>['__proto__','prototype','constructor'].includes(x)))throw new Error('非法历史路径');
    let target=state;
    for(const key of parts.slice(0,-1)){if(!target||!Object.hasOwn(target,key))throw new Error('历史变更链损坏');target=target[key];}
    const key=parts.at(-1);
    if(change.op==='remove')delete target[key];else target[key]=clone(change.value);
  }
  return state;
}
export function assertOwner(run, accountId) {
  if(run && accountId && run.accountId!==accountId)throw Object.assign(new Error('存档不属于当前身份'),{code:'account_mismatch'});
}
export function lineage(nodes, headNodeId) {
  const byId=new Map(nodes.map(node=>[node.nodeId,node])),result=[],seen=new Set();
  let id=headNodeId;
  while(id){if(seen.has(id)||!byId.has(id))throw Object.assign(new Error('历史来源链缺失或循环'),{code:'history_unavailable'});seen.add(id);const node=byId.get(id);result.push(node);id=node.parentId;}
  return result.reverse();
}
export function stateAt(nodes, nodeId) {
  if(!nodeId)return null;
  const chain=lineage(nodes,nodeId);
  const start=chain.findLastIndex(node=>node.snapshot!==undefined);
  if(start<0)throw Object.assign(new Error('此历史节点缺少可用检查点，请保留原档后恢复最近可读路线'),{code:'history_unavailable'});
  let state=null;
  for(const node of chain.slice(start)){
    if(node.snapshot!==undefined)state=clone(node.snapshot);
    else if(state!==null&&Array.isArray(node.changes))state=applyChanges(state,node.changes);
    else throw Object.assign(new Error('旧存档缺少该节点的历史状态，请保留原档后恢复最近可读路线'),{code:'history_unavailable'});
  }
  return state;
}
export function prepareCommit(operation, run, currentState, parent) {
  assertOwner(run,operation.accountId);
  if(!operation.nodeId || !operation.operationId || !operation.accountId)throw new Error('提交身份不完整');
  if(operation.parentNodeId && !parent)throw Object.assign(new Error('父节点不存在'),{code:'parent_missing'});
  if(!operation.fork && (run?.headNodeId||null)!==(operation.parentNodeId||null))return null;
  const revision=(run?.revision||0)+1, depth=(parent?.depth||0)+1;
  const at=operation.createdAt||new Date().toISOString();
  const before=operation.beforeState??currentState?.data??{};
  const changes=diffState(before,operation.stateAfter);
  const node={runId:operation.runId,nodeId:operation.nodeId,branchId:operation.branchId,parentId:operation.parentNodeId||null,revision,depth,operationId:operation.operationId,message:clone(operation.message),changes,createdAt:at};
  if(operation.preparedContext!==undefined)node.preparedContext=clone(operation.preparedContext);
  if(operation.database!==undefined)node.database=clone(operation.database);
  if(!parent||depth%32===0)node.snapshot=clone(operation.stateAfter);
  const state={runId:operation.runId,branchId:operation.branchId,revision,data:clone(operation.stateAfter),updatedAt:at};
  const receipt={runId:operation.runId,operationId:operation.operationId,nodeId:node.nodeId,revision,receipt:clone(operation.receipt||null),committedAt:at};
  const nextRun={...(run||{}),runId:operation.runId,accountId:operation.accountId,mode:operation.mode||run?.mode,contentVersion:operation.contentVersion||run?.contentVersion,profile:operation.profile||run?.profile,createdAt:run?.createdAt||at,branchId:operation.branchId,revision,headNodeId:node.nodeId,updatedAt:at};
  const branch={runId:operation.runId,branchId:operation.branchId,headNodeId:node.nodeId,revision,updatedAt:at};
  return {node,state,receipt,run:nextRun,branch};
}
export function prepareProfileCommit(operation,run){
  assertOwner(run,operation.accountId);if(!run?.headNodeId)throw new Error('请先完成故事创建');
  if(!operation.operationId||!operation.accountId||!operation.profile||typeof operation.profile!=='object')throw new Error('人物保存身份不完整');
  if(run.revision!==operation.expectedRevision)return null;
  const revision=run.revision+1,at=new Date().toISOString();
  return {run:{...clone(run),profile:clone(operation.profile),revision,updatedAt:at},receipt:{runId:run.runId,operationId:operation.operationId,nodeId:run.headNodeId,revision,receipt:{kind:'profile'},committedAt:at}};
}
