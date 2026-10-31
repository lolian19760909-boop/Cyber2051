/** Native chat is the only durable document in ST mode. No IndexedDB fallback. */
import {clone,lineage,stateAt,prepareCommit,assertOwner,prepareProfileCommit} from './records.mjs';
import {packMedia,unpackMedia} from './media.mjs';
import {newId} from '../core/ids.mjs';
import {reconcileNative} from './native-source.mjs';
import {SAVE_TABLES,prepareImportedSnapshot} from './backup.mjs';
import {attachStorageAudit} from './audit.mjs';
export function nativeFingerprint(value){let hash=2166136261;const text=String(value||'').replace(/\r\n/g,'\n').replace(/<StatusPlaceHolderImpl\/>/g,'').trim();for(const ch of text)hash=Math.imul(hash^ch.charCodeAt(0),16777619);return (hash>>>0).toString(16)+':'+text.length;}
const fail=(code,message)=>Object.assign(new Error(message),{code});
/** Materialize one native route. Legacy full anchors and new per-row deltas can coexist. */
export function projectTavernRows(next,host={}){
  if(!next.run?.headNodeId)return clone(next.baseRows);
  const chain=lineage(next.nodes,next.run.headNodeId),last=chain.filter(n=>n.native).at(-1),anchor=chain.findLastIndex(n=>n.hostRows);
  const rows=clone(anchor>=0?chain[anchor].hostRows:last?next.baseRows.slice(0,last.nativeFloor+1):next.baseRows);
  for(const node of chain.slice(anchor+1)){
    if(node.hostRowsDelta){
      const delta=node.hostRowsDelta;if(delta.schema!==1||!Number.isSafeInteger(delta.length)||delta.length<0||!Array.isArray(delta.rows))throw fail('host_history_unavailable','原生行变更记录无法读取，请保留原档后恢复最近可读路线');
      rows.length=delta.length;for(const change of delta.rows)rows[change.index]=clone(change.row);continue;
    }
    if(node.native)continue;
    if(node.message.kind==='program'){
      const row=rows.findLast(r=>!r.is_user&&!r.is_system);if(!row)throw fail('history_unavailable','行动缺少对应正文楼层');
      const swipe=row.swipe_id||0;row.variables||=[];const prior=clone(row.variables[swipe]||{});
      const narrative=lineage(next.nodes,node.nodeId).findLast(n=>n.message.kind!=='program'&&typeof n.message.raw==='string');if(!narrative)throw fail('history_unavailable','行动缺少正文来源节点');
      row.extra={...row.extra,cxx2051_node:narrative.nodeId};if(row.swipe_info?.[swipe])row.swipe_info[swipe].extra={...row.swipe_info[swipe].extra,cxx2051_node:narrative.nodeId};
      row.variables[swipe]={...prior,stat_data:stateAt(next.nodes,node.nodeId),__cxx_web_commit:{...prior.__cxx_web_commit,schema:1,owner:'web',nodeId:narrative.nodeId,stateNodeId:node.nodeId,operationId:node.operationId,fingerprint:nativeFingerprint(narrative.message.raw)}};row.variables_initialized||=[];row.variables_initialized[swipe]=true;continue;
    }
    if(node.message.input?.text){const prior=clone(rows.at(-1)?.variables?.[rows.at(-1)?.swipe_id||0]||{});delete prior.__cxx_web_commit;rows.push({name:host.userName||'You',is_user:true,is_system:false,send_date:node.createdAt,mes:node.message.input.text,variables:[prior],variables_initialized:[true],extra:{cxx2051_node:node.nodeId}});}
    const state=stateAt(next.nodes,node.nodeId),raw=node.message.raw||'';
    const vars={...clone(rows.at(-1)?.variables?.[rows.at(-1)?.swipe_id||0]||{}),stat_data:state,__cxx_web_commit:{schema:1,owner:'web',operationId:node.operationId,nodeId:node.nodeId,stateNodeId:node.nodeId,fingerprint:nativeFingerprint(raw)}};
    const siblings=next.nodes.filter(n=>!n.native&&n.message.kind!=='program'&&n.parentId===node.parentId&&n.message.input?.text===node.message.input?.text);
    const swipe_id=siblings.findIndex(n=>n.nodeId===node.nodeId);
    const variables=siblings.map(n=>({...clone(vars),stat_data:stateAt(next.nodes,n.nodeId),__cxx_web_commit:{...vars.__cxx_web_commit,operationId:n.operationId,nodeId:n.nodeId,stateNodeId:n.nodeId,fingerprint:nativeFingerprint(n.message.raw)}}));
    rows.push({name:host.characterName||'东京都2051',is_user:false,is_system:false,send_date:node.createdAt,mes:raw,swipe_id,swipes:siblings.map(n=>n.message.raw),swipe_info:siblings.map(n=>({send_date:n.createdAt,extra:{cxx2051_node:n.nodeId,...(n.message.binding?{cxx_context:{binding:clone(n.message.binding)}}:{})}})),variables,variables_initialized:variables.map(()=>true),extra:{cxx2051_node:node.nodeId,...(node.message.binding?{cxx_context:{binding:clone(node.message.binding)}}:{})}});
  }
  return rows;
}
export async function createTavernStatePort({host,accountId,runId,parse,parser,rules,deferReconcile=false}){
  const mark=step=>{try{(globalThis.__cxxBootMark??=[]).push([Date.now(),step]);if(globalThis.__cxxBootMark.length>80)globalThis.__cxxBootMark.shift();}catch{}};
  let closed=false,queue=Promise.resolve(),doc,stale=false;
  mark('port:read-begin');
  const scope=await host.read();
  mark('port:read-done');
  async function seed(snapshot){
    const prior=snapshot.metadata?.cxx2051_web;
    if(prior){
      if(![1,2].includes(prior.schema))throw fail('migration_required','此酒馆存档来自较新的网页版本，请先导出原聊天');
      const document=clone(prior);
      // Earlier imports kept every native row but attached only the last user
      // message to its reply. Recover that exact lost prefix from the saved rows.
      for(const node of document.nodes||[]){
        if(!node.native||node.message?.input?.messages||!Number.isInteger(node.nativeFloor))continue;
        const row=document.baseRows?.[node.nativeFloor],parent=document.nodes.find(value=>value.nodeId===node.parentId);
        if(!row||String(host.original?.(row)??row.mes??'')!==node.message.raw||parent&&!Number.isInteger(parent.nativeFloor))continue;
        const messages=document.baseRows.slice((parent?.nativeFloor??-1)+1,node.nativeFloor).filter(value=>value.is_user&&!value.is_system).map(value=>({role:'user',content:String(host.original?.(value)??value.mes??'')}));
        if(messages.length>1&&node.message.input?.text===messages.at(-1).content)node.message.input={...node.message.input,text:messages.map(value=>value.content).join('\n\n'),messages};
      }
      return document;
    }
    const result={schema:1,baseRows:clone(snapshot.rows),nodes:[],receipts:[],branches:[],checkpoints:[],records:{},run:null};
    let parent=null,previousFloor=-1;
    for(let i=0;i<snapshot.rows.length;i++){
      const row=snapshot.rows[i];
      if(row.is_user||row.is_system)continue;
      const nodeId='native_'+i,raw=String(host.original?.(row)??row.mes??''),display=parse(raw).display;
      const messages=snapshot.rows.slice(previousFloor+1,i).filter(value=>value.is_user&&!value.is_system).map(value=>({role:'user',content:String(host.original?.(value)??value.mes??'')}));
      result.nodes.push({runId,nodeId,parentId:parent,branchId:'native',depth:result.nodes.length+1,revision:0,nativeFloor:i,native:true,message:{role:'assistant',raw,display,input:messages.length?{text:messages.map(value=>value.content).join('\n\n'),...(messages.length>1?{messages}:{})}:null,...(row.extra?.cxx_context?.binding?{binding:clone(row.extra.cxx_context.binding)}:{})}});parent=nodeId;previousFloor=i;
    }
    const last=result.nodes.at(-1);if(snapshot.rows.slice(last?last.nativeFloor+1:0).some(row=>row.is_user&&!row.is_system))throw fail('host_reply_pending','酒馆最后一条玩家消息尚未回复，请先在原生界面完成或撤回后接入');
    mark('capture:begin');
    const captured=last&&typeof host.captureNativeState==='function'?await host.captureNativeState({floor:last.nativeFloor,swipe:snapshot.rows[last.nativeFloor].swipe_id||0,fingerprint:nativeFingerprint(last.message.raw)}):null;
    mark('capture:done');
    if(captured?.ok&&captured.complete===true&&captured.scope===host.nativeScope&&captured.floor===last.nativeFloor&&captured.swipe===(snapshot.rows[last.nativeFloor].swipe_id||0)&&captured.fingerprint===nativeFingerprint(last.message.raw)&&captured.root&&typeof captured.root==='object'){
      // This is the actual current complete state. Earlier native floors have no invented snapshots.
      last.snapshot=clone(captured.root);last.nativeCurrentOnly=true;result.nativeBaseline={floor:captured.floor,swipe:captured.swipe,fingerprint:captured.fingerprint,scope:captured.scope,source:captured.source,receipt:captured.receipt||null};
      if(captured.actorBinding)last.message.binding=clone(captured.actorBinding);
    }
    const priorState=snapshot.rows.some(row=>row.variables?.[row.swipe_id||0]?.stat_data),played=priorState||result.nodes.length>1||snapshot.rows.some(row=>row.is_user&&!row.is_system);
    if(!last?.snapshot&&played){const row=last&&snapshot.rows[last.nativeFloor];if(priorState&&!row?.variables?.[row.swipe_id||0]?.stat_data)throw fail('host_state_pending','酒馆当前末楼没有可验证的完整状态，请等待结算保存或恢复原回复；不会将前楼状态复制到这里');throw fail('host_state_unavailable','此原生聊天没有可验证的当前完整状态。16表投影不能恢复缺失的成长、物品与程序记录；请保留原聊天，使用已保存的完整快照或原生完整备份接入');}
    if(last?.snapshot&&parent){result.run={runId,accountId,mode:'tavern',revision:0,branchId:'native',headNodeId:parent};result.branches=[{runId,branchId:'native',headNodeId:parent,revision:0}];}
    else result.nodes=[];
    return result;
  }
  doc=await seed(scope);
  mark('port:seed-done');
  const check=()=>{if(closed)throw fail('session_disposed','酒馆页面已关闭');assertOwner(doc.run,accountId);host.assertScope();};
  const serial=fn=>{const next=queue.then(()=>{check();return fn();});queue=next.catch(()=>{});return next;};
  const project=next=>projectTavernRows(next,host);
  async function save(next){
    const rows=project(next);
    // The bridge checks both the live host document and disk before writing, then reads disk back.
    // A failed write may still have reached the chat file, so the next read must come from the host
    // instead of reusing this page's copy; otherwise an ack-lost retry writes the same turn twice.
    try{await host.write({rows,document:next});}catch(cause){stale=true;throw cause;}doc=next;
  }
  async function fresh(){
    check();
    if(stale){stale=false;const current=await host.read(),saved=current?.metadata?.cxx2051_web;if(saved)doc=clone(saved);}
    // 端口创建时已整份读过一次酒馆存档；此后本页是这份文档的唯一写入者，
    // 再逐 getter 回读会在大存档（几十 MB）上把启动拖成分钟级。
    // 需要真实磁盘状态的路径（对账 syncNativeSource、写入冲突）自己读 host。
    return doc;
  }
  const head=()=>({revision:doc.run?.revision||0,headNodeId:doc.run?.headNodeId||null,branchId:doc.run?.branchId||null});
  const records=name=>doc.records[name]||[];
  const port={kind:'tavern',
    readMacroGlobals:async()=>{check();return host.readMacroGlobals();},
    writeMacroGlobals:async value=>{check();return host.writeMacroGlobals(value);},
    readStorySettings:async()=>{await fresh();return clone(doc.storySettings||null);},
    writeStorySettings:async(_runId,value)=>serial(async()=>{await fresh();const next=clone(doc);next.storySettings=clone(value);await save(next);return clone(value);}),
    syncNativeSource:currentRules=>serial(async()=>{const current=await host.read();const saved=current.metadata?.cxx2051_web;if(saved)doc=clone(saved);if(!doc.run)return false;const reconciled=await reconcileNative({document:doc,actual:current.rows,projected:project(doc),projectRows:project,parse,rules:currentRules||rules,fingerprint:nativeFingerprint,original:host.original,nativeScope:host.nativeScope,accountId,runId});if(reconciled)await save(reconciled);return !!reconciled;}),
    withRunLock:(_id,fn)=>host.withLock(fn),
    readRun:async()=>{await fresh();return clone(doc.run);},listRuns:async()=>{await fresh();return doc.run?[clone(doc.run)]:[];},
    readHead:async()=>{await fresh();return head();},
    readState:async(_id,branchId)=>{await fresh();const branch=doc.branches.find(b=>b.branchId===(branchId||doc.run?.branchId));return branch?{runId,branchId:branch.branchId,data:stateAt(doc.nodes,branch.headNodeId),revision:doc.run.revision}:null;},
    readNode:async(_id,id)=>{await fresh();return clone(doc.nodes.find(n=>n.nodeId===id)||null);},
    readReceipt:async(_id,id)=>{await fresh();return clone(doc.receipts.find(r=>r.operationId===id)||null);},
    readLineage:async(_id,id)=>{await fresh();return clone(lineage(doc.nodes,id===undefined?doc.run?.headNodeId:id));},
    readNodeState:async(_id,id)=>{await fresh();const node=doc.nodes.find(n=>n.nodeId===id);return node?.snapshot!==undefined?clone(node.snapshot):stateAt(doc.nodes,id);},
    listBranches:async()=>{await fresh();return clone(doc.branches);},listCheckpoints:async()=>{await fresh();return clone(doc.checkpoints);},
    listRecords:async name=>{await fresh();return name==='media'?unpackMedia(records(name)):clone(records(name));},
    readRecord:async(name,id,key)=>{await fresh();if(id!==runId)throw fail('account_mismatch','记录不属于当前酒馆故事');const row=records(name).find(row=>(row.id||row.taskId||row.mediaId)===key);return name==='media'?unpackMedia(row||null):clone(row||null);},
    readMedia:async(_id,id)=>{await fresh();return unpackMedia(records('media').find(r=>(r.mediaId||r.id)===id)||null);},
    listTasks:async(_id,status='pending')=>{await fresh();return clone(records('tasks').filter(r=>!status||r.status===status));},
    putRecords:async(name,_id,rows)=>serial(async()=>{await fresh();if(!['tasks','drafts','memories','summaries','indices','media'].includes(name))throw new Error('不可写记录类型');const next=clone(doc),map=new Map(records(name).map(row=>[row.id||row.taskId||row.mediaId,row]));for(const row of name==='media'?await packMedia(rows):rows)map.set(row.id||row.taskId||row.mediaId,{...clone(row),runId});next.records[name]=[...map.values()];await save(next);}),
    commit:operation=>serial(async()=>{
      await fresh();if(operation.runId!==runId||operation.accountId!==accountId)throw fail('account_mismatch','不能把其他聊天的候选写入当前酒馆');
      const previous=doc.receipts.find(r=>r.operationId===operation.operationId);if(previous)return {status:'replayed',...clone(previous)};
      if((doc.run?.revision||0)!==operation.expectedRevision)return {status:'conflict',...head()};
      const prepared=prepareCommit(operation,doc.run,{data:doc.run?.headNodeId?stateAt(doc.nodes,doc.run.headNodeId):{}},doc.nodes.find(n=>n.nodeId===operation.parentNodeId));
      if(!prepared)return {status:'conflict',...head()};
      const next=clone(doc);next.nodes.push(prepared.node);next.receipts.push(prepared.receipt);next.run=prepared.run;
      next.branches=next.branches.filter(b=>b.branchId!==prepared.branch.branchId).concat(prepared.branch);
      next.records.tasks=(next.records.tasks||[]).concat((operation.tasks||[]).map(t=>({...t,runId,sourceNodeId:operation.nodeId,status:'pending'})));
      next.records.tasks.push({taskId:'st-projection:'+operation.nodeId,kind:'st_projection',runId,sourceNodeId:operation.nodeId,status:'pending',modelCalls:0});
      const media=await Promise.all((operation.media||[]).map(packMedia));if(media.length){const map=new Map((next.records.media||[]).map(r=>[r.mediaId||r.id,r]));for(const row of media)map.set(row.mediaId||row.id,{...row,runId});next.records.media=[...map.values()];}
      next.records.drafts=(next.records.drafts||[]).filter(r=>r.operationId!==operation.operationId&&r.id!=='candidate');
      await save(next);return {status:'committed',nodeId:operation.nodeId,revision:next.run.revision,receipt:prepared.receipt};
    }),
    commitProfile:operation=>serial(async()=>{await fresh();if(operation.accountId!==accountId||operation.runId!==runId)throw fail('account_mismatch','人物保存不属于当前故事');const previous=doc.receipts.find(r=>r.operationId===operation.operationId);if(previous)return {status:'replayed',revision:previous.revision,nodeId:previous.nodeId};const prepared=prepareProfileCommit(operation,doc.run);if(!prepared)return {status:'conflict',...head()};const next=clone(doc);next.run=prepared.run;next.receipts.push(prepared.receipt);const map=new Map((next.records.media||[]).map(r=>[r.mediaId||r.id,r]));for(const row of await Promise.all((operation.media||[]).map(packMedia)))map.set(row.mediaId||row.id,{...row,runId});next.records.media=[...map.values()];await save(next);return {status:'committed',revision:next.run.revision,nodeId:next.run.headNodeId};}),
    createCheckpoint:(_id,label='存档点',{nodeId}={})=>serial(async()=>{await fresh();if(!doc.run?.headNodeId)throw new Error('还没有可保存的回合');if(nodeId)stateAt(doc.nodes,nodeId);const row={runId,checkpointId:newId('checkpoint'),nodeId:nodeId||doc.run.headNodeId,branchId:doc.run.branchId,label,createdAt:new Date().toISOString()},next=clone(doc);next.checkpoints.push(row);await save(next);return row;}),
    selectBranch:(_id,branchId,expected)=>serial(async()=>{await fresh();if(doc.run.revision!==expected)return {status:'conflict',...head()};const branch=doc.branches.find(b=>b.branchId===branchId);if(!branch)throw new Error('路线不存在');const next=clone(doc);Object.assign(next.run,{branchId,headNodeId:branch.headNodeId,revision:next.run.revision+1});await save(next);return clone(next.run);}),
    restoreCheckpoint:(_id,id)=>serial(async()=>{await fresh();const point=doc.checkpoints.find(p=>p.checkpointId===id);if(!point)throw new Error('存档点不存在');stateAt(doc.nodes,point.nodeId);const next=clone(doc),branchId=newId('branch');Object.assign(next.run,{branchId,headNodeId:point.nodeId,revision:next.run.revision+1});next.branches.push({...point,branchId,headNodeId:point.nodeId});await save(next);return clone(next.run);}),
    exportRun:async()=>{await fresh();if(!doc.run)throw new Error('尚无可导出的故事');const tables={};for(const name of SAVE_TABLES)tables[name]=clone(doc[name]||records(name));tables.states=doc.branches.flatMap(branch=>{try{return [{runId,branchId:branch.branchId,revision:doc.run.revision,data:stateAt(doc.nodes,branch.headNodeId)}];}catch{return [];}});tables.media=await unpackMedia(tables.media);return {workId:'tokyo2051',schema:doc.schema,run:clone(doc.run),tables,extensions:{nativeBaseRows:clone(doc.baseRows),storySettings:clone(doc.storySettings||null)},exportedAt:new Date().toISOString()};},
    importRun:async(snapshot,options={})=>{const prepared=await prepareImportedSnapshot(snapshot,{...options,accountId,runId,mode:'tavern',parser:options.parser||parser});return serial(async()=>{await fresh();if(doc.run)throw fail('host_new_chat_required','请在新的酒馆聊天中导入，以保留当前聊天');const next=clone(doc);for(const name of ['nodes','branches','receipts','checkpoints'])next[name]=clone(prepared.tables[name]);next.schema=prepared.tables.nodes.some(node=>node.hostRowsDelta)?2:prepared.schema;next.run=clone(prepared.run);for(const name of ['tasks','drafts','memories','summaries','indices'])next.records[name]=clone(prepared.tables[name]);next.records.media=await packMedia(prepared.tables.media);if(prepared.extensions?.storySettings)next.storySettings=clone(prepared.extensions.storySettings);if(prepared.extensions?.nativeBaseRows)next.baseRows=clone(prepared.extensions.nativeBaseRows);await save(next);return clone(next.run);});},
    close:async()=>{closed=true;},
  };
  if(!deferReconcile&&scope.metadata?.cxx2051_web?.run)await port.syncNativeSource(rules);
  return attachStorageAudit(port);
}
