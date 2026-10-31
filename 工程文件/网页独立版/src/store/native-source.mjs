/** Reconcile native selection, actions, edits and completed replies without model requests. */
import {clone,stateAt,lineage,prepareCommit} from './records.mjs';
import {newId} from '../core/ids.mjs';
import {stableJSON} from '../context/sources.mjs';
import {committedCombatRequiresReplay,replayCombatPreparation} from '../ui/combat.mjs';
import {nativeSettlement} from './native-receipt.mjs';
const fail=(code,message)=>Object.assign(new Error(message),{code}),assistant=row=>row&&!row.is_user&&!row.is_system;
function rowDelta(before,after){
  const rows=[];for(let index=0;index<after.length;index++)if(JSON.stringify(before[index])!==JSON.stringify(after[index]))rows.push({index,row:clone(after[index])});
  return {schema:1,length:after.length,rows};
}
export async function reconcileNative({document,actual,projected,projectRows,parse,rules,fingerprint,nativeScope,accountId,runId,original=row=>row?.mes||''}){
  const raw=row=>String(original(row)??row?.mes??''),selected=row=>row?.variables?.[row.swipe_id||0],comparable=rows=>rows.map(row=>({user:!!row.is_user,system:!!row.is_system,raw:raw(row),swipe:row.swipe_id||0,state:selected(row)?.stat_data})),same=(a,b)=>stableJSON(a)===stableJSON(b);
  if(same(comparable(actual),comparable(projected)))return null;
  const lastFloor=actual.findLastIndex(assistant),frontier=projected.findLastIndex(assistant);
  if(actual.slice(lastFloor+1).some(row=>row.is_user&&!row.is_system))throw fail('host_reply_pending','酒馆已有尚未回复的玩家消息，请先在酒馆完成或保留该输入后再接回网页');
  if(lastFloor<0||frontier<0)throw fail('host_history_unavailable','酒馆没有可读取的已保存正文，请先恢复聊天');
  if(!assistant(actual[frontier])||!same(comparable(actual.slice(0,frontier)),comparable(projected.slice(0,frontier))))throw fail('host_history_edited','较早的酒馆正文已经修改，后续状态不能直接继承；请先恢复原文或完成原生重新结算');
  const next=clone(document),hostRows=clone(actual),currentLine=lineage(document.nodes,document.run.headNodeId),expectedBody=currentLine.findLast(node=>node.message?.kind!=='program'&&node.message?.raw),row=actual[frontier],vars=selected(row),marker=vars?.__cxx_web_commit,rowId=row.swipe_info?.[row.swipe_id||0]?.extra?.cxx2051_node??row.extra?.cxx2051_node,markedBody=rowId&&rowId===marker?.nodeId?document.nodes.find(node=>node.nodeId===rowId):null,known=markedBody?.message?.kind==='program'?null:markedBody||expectedBody;
  if(!known)throw fail('host_history_unavailable','当前正文的来源节点未保存，请先恢复原聊天');
  if(!vars?.stat_data)throw fail('host_state_pending','原生回复还没有已保存的状态，请等待酒馆结算完成');
  const sourceId=markedBody&&marker?.stateNodeId||known.nodeId,stateNode=document.nodes.find(node=>node.nodeId===sourceId);
  if(!stateNode||!lineage(document.nodes,stateNode.nodeId).some(node=>node.nodeId===known.nodeId))throw fail('host_history_unavailable','当前楼层的状态节点与正文来源不匹配，请先恢复原聊天');
  let changed=false,branchId=null;
  const parentRows=node=>projectRows({...next,run:{...next.run,headNodeId:node.parentId}});
  function append({floor,parentId,beforeState,stateAfter,message,nodeId=newId('node'),operationId=newId('native'),receiptKind,native=false,preparedContext}){
    branchId||=newId('branch');const operation={accountId,runId,mode:'tavern',branchId,operationId,nodeId,expectedRevision:next.run.revision,parentNodeId:parentId,fork:true,beforeState,stateAfter,message,preparedContext,profile:next.run.profile,contentVersion:next.run.contentVersion,receipt:{kind:receiptKind},createdAt:new Date().toISOString()},parent=next.nodes.find(node=>node.nodeId===parentId),prepared=prepareCommit(operation,next.run,{data:beforeState},parent);
    if(!prepared)throw fail('host_conflict','原生聊天来源发生冲突，原文保持');
    const target=hostRows[floor],swipe=target.swipe_id||0,prior=clone(selected(target)||{}),bodyId=message.kind==='program'?lineage(next.nodes,parentId).findLast(node=>node.message?.kind!=='program'&&node.message?.raw)?.nodeId:nodeId;
    target.variables||=[];target.variables[swipe]={...prior,stat_data:clone(stateAfter),__cxx_web_commit:{...prior.__cxx_web_commit,schema:1,owner:'web',operationId,nodeId:bodyId,stateNodeId:nodeId,fingerprint:fingerprint(raw(target))}};
    target.extra={...clone(target.extra||{}),cxx2051_node:bodyId};if(target.swipe_info?.[swipe])target.swipe_info[swipe].extra={...clone(target.swipe_info[swipe].extra||{}),cxx2051_node:bodyId};
    target.variables_initialized||=[];target.variables_initialized[swipe]=true;
    prepared.node.hostRowsDelta=rowDelta(parentRows(prepared.node),hostRows.slice(0,floor+1));if(native){prepared.node.native=true;prepared.node.nativeFloor=floor;}
    next.schema=2;next.nodes.push(prepared.node);next.receipts.push(prepared.receipt);next.run=prepared.run;next.branches=next.branches.filter(branch=>branch.branchId!==prepared.branch.branchId).concat(prepared.branch);changed=true;return prepared.node;
  }
  function parsedAt(floor){const value=parse(raw(actual[floor]));if(!value.supported||value.protocol?.issues?.length)throw fail('host_edit_invalid','酒馆正文协议未通过校验，请保留原文后修正，或恢复原回复');if(!value.display?.paragraphs?.some(p=>String(p.text||'').trim()))throw fail('host_edit_invalid','酒馆回复没有可读取的完整正文，请先恢复原回复');return value;}
  if(fingerprint(raw(row))===fingerprint(known.message.raw)){
    const prior=stateAt(document.nodes,stateNode.nodeId);
    if(same(vars.stat_data,prior)){
      if(next.run.headNodeId!==stateNode.nodeId||next.run.branchId!==stateNode.branchId){next.run={...next.run,headNodeId:stateNode.nodeId,branchId:stateNode.branchId,revision:next.run.revision+1};changed=true;}
    }else{
      append({floor:frontier,parentId:stateNode.nodeId,beforeState:prior,stateAfter:vars.stat_data,message:{role:'system',kind:'program',raw:'',action:'native-action',label:'酒馆人物操作',...(known.message.binding?{binding:clone(known.message.binding)}:{})},receiptKind:'native-program'});
    }
  }else{
    if(!rules)throw fail('host_rules_missing','正文重校验服务尚未就绪');const parsed=parsedAt(frontier),parentId=known.parentId,nodeId=newId('node'),attemptId=newId('attempt'),operationId=newId('native'),parents=parentId?lineage(document.nodes,parentId):[],beforeState=known.message.kind==='opening'?stateAt(document.nodes,known.nodeId):parentId?stateAt(document.nodes,parentId):rules.emptyRoot(),binding=row.extra?.cxx_context?.binding||known.message.binding;
    const priorAfter=stateAt(document.nodes,known.nodeId),stored=known.preparedContext?.combat,needsReplay=committedCombatRequiresReplay({before:beforeState,after:priorAfter,nodeId:known.nodeId,floor:frontier});let replay;
    if(needsReplay||stored?.battle||stored?.tactical){if(!stored)throw fail('host_edit_program_missing','旧正文缺少冻结交锋票据；原状态保留，请恢复原回复或从父节点重写');replay=await replayCombatPreparation({ticket:stored,before:beforeState,raw:raw(row),nodeId,parentNodeId:parentId,oldNodeId:known.nodeId,floor:frontier,sourceNodes:parents,identity:{accountId,runId}});}
    const patches=clone(parsed.protocol.patches||[]);if(replay){const actorId=stored.actorId,numericPath=actorId==='player'?'/terminal/gameplay/numericInput':'/terminal/ensemble/actors/'+actorId+'/gameplay/numericInput';if(!patches.some(p=>p.path===numericPath))patches.push({op:'add',path:numericPath,value:[]});}
    const preparedContext={...clone(known.preparedContext||{}),...(replay?{combat:replay.preparedContext}:{})},settled=rules.settle({before:beforeState,patches,raw:raw(row),nodeId,parentNodeId:parentId,attemptId,actorBinding:binding,floor:frontier,sourceNodes:parents,...(replay?{numericOptions:replay.numericOptions,preparedContext}:{})});
    append({floor:frontier,parentId,beforeState:parentId?stateAt(document.nodes,parentId):{},stateAfter:settled.state,message:{...clone(known.message),raw:raw(row),display:parsed.display,attemptId,...(binding?{binding:clone(binding)}:{})},preparedContext,nodeId,operationId,receiptKind:'native-edit',native:!!known.native});
  }
  let priorFloor=frontier;
  for(let floor=frontier+1;floor<=lastFloor;floor++){
    if(!assistant(actual[floor]))continue;const parsed=parsedAt(floor),current=selected(actual[floor]);if(!current?.stat_data)throw fail('host_state_pending','新增原生回复还没有已保存状态，请等待酒馆逐楼结算完成');
    const parentId=next.run.headNodeId,beforeState=stateAt(next.nodes,parentId),inputs=actual.slice(priorFloor+1,floor).filter(row=>row.is_user&&!row.is_system).map(raw),settled=nativeSettlement(actual[floor],{scope:nativeScope,floor,raw:raw(actual[floor]),fingerprint,before:beforeState}),binding=actual[floor].swipe_info?.[actual[floor].swipe_id||0]?.extra?.cxx_context?.binding||actual[floor].extra?.cxx_context?.binding||settled.receipt.actorBinding;
    const added=append({floor,parentId,beforeState,stateAfter:settled.state,message:{role:'assistant',raw:raw(actual[floor]),display:parsed.display,attemptId:newId('attempt'),input:inputs.length?{text:inputs.join('\n\n'),...(inputs.length>1?{messages:inputs.map(content=>({role:'user',content}))}:{})}:null,...(binding?{binding:clone(binding)}:{})},receiptKind:'native-append',native:true});
    if(settled.programChanged)append({floor,parentId:added.nodeId,beforeState:settled.state,stateAfter:settled.current,message:{role:'system',kind:'program',raw:'',action:'native-action',label:'酒馆人物操作',...(binding?{binding:clone(binding)}:{})},receiptKind:'native-program'});priorFloor=floor;
  }
  if(!changed)return null;
  // Preserve translated display and every native extension field in the latest durable anchor.
  const tail=next.nodes.find(node=>node.nodeId===next.run.headNodeId);if(tail?.hostRowsDelta)tail.hostRowsDelta=rowDelta(parentRows(tail),hostRows);else if(tail?.hostRows)tail.hostRows=clone(hostRows);
  return next;
}
