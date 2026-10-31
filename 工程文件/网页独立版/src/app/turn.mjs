/** Three-mode turn coordinator. A candidate owns one parent snapshot and one stable commit operation. */
import { assertOperation, newId } from '../core/ids.mjs';
import { parseReply } from './parse.mjs';
import { RuleRejected } from '../rules/engine.mjs';
export const TURN_STATUS=Object.freeze(['idle','draft','generating','candidate','validating','committing','committed','interrupted','failed','conflict']);
export class TurnError extends Error{constructor(code,message,detail){super(message||code);this.name='TurnError';this.code=code;this.detail=detail;}}
export function createTurnCoordinator({ports,rules,identity,parser=null,now=()=>new Date().toISOString()}){
  const who=()=>typeof identity==='function'?identity():identity;
  const fresh=()=>({status:'idle',transcript:[],parsed:null,proposal:null,streamed:'',error:null,revision:0});
  let turn=fresh(),epoch=0;
  const parseCandidate=raw=>{const parsed=parseReply(raw,parser?{parser}:{});if(turn.processing?.response)parsed.response=structuredClone(turn.processing.response);return parsed;};
  const snapshot=()=>({status:turn.status,attemptId:turn.attemptId,operationId:turn.operationId,nodeId:turn.nodeId,parentNodeId:turn.parentNodeId,branchId:turn.identity?.branchId,expectedRevision:turn.expectedRevision,revision:turn.revision,replayed:!!turn.replayed,parameterWarnings:turn.parameterWarnings||[],error:turn.error,selection:turn.selection?{managed:turn.selection.managedIds?.length||0,selected:turn.selection.selectedIds?.length||0}:null,features:turn.parsed?.features||[],choices:turn.parsed?.display.choices.length||0,streamedLength:turn.streamed.length,transcript:turn.transcript.slice()});
  const status=(value,patch={})=>{turn={...turn,...patch,status:value};turn.transcript.push({at:now(),status:value});return snapshot();};
  function assertLive(owner=turn){if(owner!==turn||owner.epoch!==epoch||owner.signal?.aborted)throw new TurnError('interrupted','当前候选已经停止或失效');}
  async function saveCandidate(phase,owner=turn){if(ports.state.putRecords)await ports.state.putRecords('drafts',owner.identity.runId,[{id:owner.operationId,runId:owner.identity.runId,accountId:owner.identity.accountId,operationId:owner.operationId,nodeId:owner.nodeId,attemptId:owner.attemptId,parentNodeId:owner.parentNodeId,fork:owner.fork===true,branchId:owner.identity.branchId,expectedRevision:owner.expectedRevision,input:owner.input,raw:owner.streamed,complete:owner.complete===true,completion:owner.completion,manualEdit:owner.manualEdit===true,processing:owner.processing,phase,error:owner.error,...(owner.responseDiagnostics?{responseDiagnostics:owner.responseDiagnostics}:{}),profile:owner.profile,contentVersion:owner.contentVersion,actorBinding:owner.actorBinding,preparedContext:owner.preparedContext,selection:owner.selection,tasks:owner.committedTasks,updatedAt:now()}]);}
  async function begin({inputText,parentNodeId,branchId,beforeState,fork=false,profile,contentVersion,actorBinding,preparedContext,selection=null,generationType='normal'}={}){
    if(!['idle','committed','failed','interrupted','conflict'].includes(turn.status))throw new TurnError('turn_busy','已有回合正在处理');
    const current=who();epoch++;turn=fresh();
    status('draft',{...fresh(),epoch,identity:{...current,branchId:branchId||current.branchId},fork,profile,contentVersion,actorBinding,preparedContext:structuredClone(preparedContext),selection:selection?structuredClone(selection):null,attemptId:newId('attempt'),operationId:newId('op'),nodeId:newId('node'),input:{text:String(inputText??''),at:now(),...(generationType!=='normal'?{generationType}:{})}});
    const owner=turn;
    try{
      const head=await ports.state.readHead(current.runId),selectedParent=parentNodeId===undefined?head.headNodeId:parentNodeId;
      const state=beforeState??(selectedParent&&ports.state.readNodeState?await ports.state.readNodeState(current.runId,selectedParent):(await ports.state.readState(current.runId,current.branchId))?.data)??rules.emptyRoot();
      assertLive(owner);
      Object.assign(turn,{parentNodeId:selectedParent,expectedRevision:head.revision,revision:head.revision,beforeState:state});
      await saveCandidate('draft');assertLive(owner);
      return snapshot();
    }catch(error){if(turn===owner)status('failed',{error:{code:error.code||'prepare_failed',message:error.message,stage:'prepare'}});throw error;}
  }
  async function generate({modelPayload,signal,onDelta,onProgress,onReasoning,onUsage}){
    if(turn.status!=='draft')throw new TurnError('turn_not_draft');
    turn.signal=signal;status('generating');let text='';
    const owner=turn;let lastSaved=0,saving=Promise.resolve(),draftSaveError=null;
    const queueSave=()=>{if(Date.now()-lastSaved<500)return;lastSaved=Date.now();saving=saving.then(()=>saveCandidate('generating',owner)).catch(error=>{draftSaveError=error;});};
    try{
      assertLive(owner);
      const result=await ports.model.chat(modelPayload,{signal,onDelta(delta){assertLive(owner);text+=delta;turn.streamed=text;onDelta?.(delta);queueSave();},onReasoning(delta){assertLive(owner);turn.processing||={};turn.processing.response||={};turn.processing.response.reasoning=String(turn.processing.response.reasoning||'')+delta;onReasoning?.(delta);queueSave();},onUsage(usage){assertLive(owner);turn.processing||={};turn.processing.response={...turn.processing.response,usage:structuredClone(usage)};onUsage?.(usage);},onProgress});
      await saving;
      assertLive(owner);
      if(typeof result?.text==='string')text=result.text;
      if(result?.diagnostics)turn.responseDiagnostics=structuredClone(result.diagnostics);
      const response=Object.fromEntries(['reasoning','toolCalls','swipes','images','signature','toolSignatures','usage'].filter(key=>result?.[key]!==undefined).map(key=>[key,structuredClone(result[key])]));
      turn.processing={...turn.processing,response};const parsed=parseCandidate(text),complete=result?.complete!==false;
      if(turn.responseDiagnostics)turn.responseDiagnostics.parse={rawCharacters:text.length,paragraphs:parsed.display.paragraphs.length,visibleCharacters:parsed.display.paragraphs.reduce((n,p)=>n+String(p.text||'').trim().length,0),thinkingBlocks:parsed.thinking?.length||0,auxiliaryBlocks:parsed.auxiliary?.length||0,protocolIssueCount:parsed.protocol.issues.length,emptyReason:parsed.display.paragraphs.some(p=>String(p.text||'').trim())?null:!text.length?'no_decoded_body':parsed.thinking?.length||parsed.auxiliary?.length?'non_body_blocks_only':'no_display_paragraphs'};
      status('candidate',{streamed:text,parsed,complete,completion:result?.finishReason||'normal',parameterWarnings:result?.warnings||[]});
      await saveCandidate('candidate');draftSaveError=null;assertLive();return snapshot();
    }catch(error){
      await saving;
      if(turn!==owner){owner.streamed=text;owner.complete=false;owner.completion='interrupted';owner.error={code:'interrupted',message:'生成已停止，收到的回复已保留',stage:'generate'};await saveCandidate('interrupted',owner);return {status:'interrupted',operationId:owner.operationId,nodeId:owner.nodeId,error:owner.error};}
      if(error.diagnostics)turn.responseDiagnostics=structuredClone(error.diagnostics);
      const interrupted=['AbortError'].includes(error.name)||['aborted','interrupted'].includes(error.code)||signal?.aborted||turn.epoch!==epoch;
      status(interrupted?'interrupted':'failed',{streamed:text,proposal:null,error:{code:interrupted?'interrupted':error.code||'generate_failed',message:error.message,stage:'generate',...(draftSaveError?{draftSaveError:draftSaveError.message}:{})}});
      await saveCandidate(turn.status);return snapshot();
    }
  }
  async function validate({finalize}={}){
    if(!['candidate','validating','failed'].includes(turn.status)||!turn.parsed)throw new TurnError('turn_not_candidate');
    status('validating',{proposal:null});const owner=turn;
    try{
      assertLive();
      // 截断回复按酒馆保留正文；协议有缺口的补丁不落库，等玩家续写后整层重算。
      const incomplete=turn.complete===false;
      if(!turn.parsed.supported||(!incomplete&&turn.parsed.protocol.issues.length))throw new TurnError('protocol_invalid',turn.parsed.protocol.issues.join('；')||'协议解析不可用');
      if(!turn.parsed.display.paragraphs.some(row=>String(row.text||'').trim())){
       const reasoning=turn.processing?.response?.reasoning,reasoningLength=typeof reasoning==='string'?reasoning.length:0;
       if(!String(turn.parsed.raw||'').length&&reasoningLength)throw new TurnError('empty_reasoning_only',`模型只输出了思考（${reasoningLength} 字符），未输出正文`,{reasoningLength});
       throw new TurnError('empty_response','回复没有可保存的正文');
      }
      const patches=incomplete&&turn.parsed.protocol.issues.length?[]:turn.parsed.protocol.patches||[];
      let settled=rules.settle({before:turn.beforeState,patches,raw:turn.parsed.raw,nodeId:turn.nodeId,parentNodeId:turn.parentNodeId,actorBinding:turn.actorBinding,attemptId:turn.attemptId,preparedContext:turn.preparedContext});
      if(finalize)settled=await finalize({before:turn.beforeState,proposal:settled,preparedContext:turn.preparedContext,raw:turn.parsed.raw,nodeId:turn.nodeId,actorBinding:turn.actorBinding});
      assertLive(owner);if(!settled?.state||!Array.isArray(settled.patches))throw new TurnError('finalize_invalid','玩法结算没有返回有效状态和回执');
      return status('candidate',{proposal:settled,error:null});
    }catch(error){if(turn!==owner)return {status:'interrupted',error:{code:'interrupted',message:'旧玩法结算上下文已结束'}};status('failed',{proposal:null,error:{code:error.code||(error instanceof RuleRejected?'rule_rejected':'validate_failed'),message:error.message,stage:'validate'}});await saveCandidate('failed');return snapshot();}
  }
  async function commit(options={}){
    if(!['candidate','failed'].includes(turn.status))throw new TurnError('turn_not_committable','当前回合不能提交');
    if(!turn.parsed||!turn.proposal)throw new TurnError('candidate_incomplete','没有通过校验的完整候选');
    assertLive();
    if(Object.hasOwn(options,'tasks'))turn.committedTasks=structuredClone(options.tasks);
    if(Object.hasOwn(options,'media'))turn.committedMedia=structuredClone(options.media);
    const tasks=turn.committedTasks||[];
    const operation={...turn.identity,operationId:turn.operationId,expectedRevision:turn.expectedRevision,nodeId:turn.nodeId,parentNodeId:turn.parentNodeId,fork:turn.fork,beforeState:turn.beforeState,profile:turn.profile,contentVersion:turn.contentVersion,preparedContext:turn.preparedContext,selection:turn.selection,
      message:{role:'assistant',raw:turn.parsed.raw,display:turn.parsed.display,input:turn.input,attemptId:turn.attemptId,...(turn.actorBinding?{binding:turn.actorBinding}:{}),...(turn.manualEdit?{manualEdit:true}:{}),...(turn.complete===false?{complete:false,completion:turn.completion}:{}),...(turn.processing?{processing:structuredClone(turn.processing)}:{})},stateAfter:turn.proposal.state,
      receipt:{patches:turn.proposal.patches.map(p=>p.path),attemptId:turn.attemptId,...(turn.proposal.receipt?{program:turn.proposal.receipt}:{})},tasks,media:turn.committedMedia||[],createdAt:turn.createdAt||(turn.createdAt=now())};
    assertOperation(operation);status('committing');
    const owner=turn;
    try{
      const result=await ports.state.commit(operation);
      if(turn!==owner)return {status:result.status==='conflict'?'conflict':'committed',revision:result.revision,nodeId:result.nodeId,replayed:result.status==='replayed'};
      if(result.status==='conflict')return status('conflict',{error:{code:'conflict',message:'已有更新的已提交版本',currentRevision:result.currentRevision}});
      return status('committed',{revision:result.revision,nodeId:result.nodeId,replayed:result.status==='replayed',committedAt:now(),error:null});
    }catch(error){if(turn!==owner)return {status:'interrupted',error:{code:'interrupted',message:'旧候选上下文已结束'}};status('failed',{error:{code:error.code||'commit_failed',message:error.message,stage:'commit'}});await saveCandidate('failed');return snapshot();}
  }
  async function retryCommit(){if(turn.status!=='failed'||turn.error?.stage!=='commit')throw new TurnError('turn_not_retryable','只有保存失败可重试原候选');return commit();}
  async function failPreparation(error){if(turn.status!=='draft')throw new TurnError('turn_not_draft');status('failed',{error:{code:error.code||'prepare_failed',message:error.message,stage:'prepare'}});await saveCandidate('failed');return snapshot();}
  async function recoverCandidate(record,{fork=false,editedText,resumeProcessing=false,beforeState}={}){
    if(!['idle','committed','failed','interrupted','conflict'].includes(turn.status))throw new TurnError('turn_busy');
    const current=who();if(record.accountId!==current.accountId||record.runId&&record.runId!==current.runId)throw new TurnError('account_mismatch','候选不属于当前故事');
    const head=await ports.state.readHead(current.runId),receipt=await ports.state.readReceipt(current.runId,record.operationId);
    if(receipt)return {status:'committed',replayed:true,nodeId:receipt.nodeId,revision:receipt.revision};
    const complete=editedText!==undefined||record.complete===true||record.complete===undefined&&(record.phase==='candidate'||record.error?.stage==='commit');
    if(!complete&&!resumeProcessing)throw new TurnError('candidate_incomplete','中断回复仅可导出、完成额外解析，或手动编辑确认；不能直接恢复为正式回合');
    const raw=editedText===undefined?String(record.raw||''):String(editedText);
    if(!fork&&(head.revision!==record.expectedRevision||!record.fork&&head.headNodeId!==(record.parentNodeId||null)))return {status:'conflict',currentRevision:head.revision};
    const before=beforeState??(record.parentNodeId?await ports.state.readNodeState(current.runId,record.parentNodeId):rules.emptyRoot());
    epoch++;turn={...fresh(),epoch,identity:{...current,branchId:fork?newId('branch'):record.branchId||current.branchId},operationId:record.operationId,nodeId:record.nodeId||newId('node'),attemptId:record.attemptId||newId('attempt'),parentNodeId:record.parentNodeId||null,expectedRevision:head.revision,revision:head.revision,beforeState:before,profile:record.profile,contentVersion:record.contentVersion,actorBinding:record.actorBinding,preparedContext:record.preparedContext,selection:record.selection?structuredClone(record.selection):null,committedTasks:record.tasks,input:record.input,streamed:raw,parsed:parseReply(raw,parser?{parser}:{}),complete,completion:editedText!==undefined?'manual_edit':record.completion,manualEdit:editedText!==undefined||record.manualEdit===true,processing:record.processing,responseDiagnostics:record.responseDiagnostics,fork:fork||record.fork===true};
    turn.parsed=parseCandidate(raw);status('candidate');await saveCandidate('candidate');return snapshot();
  }
  async function setProcessing(value){if(!turn.operationId)throw new TurnError('turn_not_candidate');assertLive();turn.processing=structuredClone(value);if(turn.parsed&&turn.processing.response)turn.parsed.response=structuredClone(turn.processing.response);await saveCandidate(turn.status);return snapshot();}
  async function failProcessing(error,{stage='parse'}={}){if(!turn.operationId||turn.epoch!==epoch)return snapshot();status(error?.name==='AbortError'||turn.signal?.aborted?'interrupted':'failed',{complete:false,proposal:null,error:{code:error?.code||'processing_failed',message:error?.message||'额外解析未完成',stage}});await saveCandidate(turn.status);return snapshot();}
  async function replaceCandidate(raw,{origin='extra-parse',complete=true}={}){if(!['candidate','failed'].includes(turn.status)&&!(turn.status==='draft'&&['manual','continue'].includes(origin)))throw new TurnError('turn_not_candidate');assertLive();status('candidate',{streamed:String(raw),parsed:parseCandidate(String(raw)),proposal:null,error:null,complete,completion:origin,manualEdit:origin==='manual'});await saveCandidate('candidate');return snapshot();}
  async function regenerate(options={}){const parent=turn.parentNodeId,input=turn.input?.text;await begin({inputText:input,parentNodeId:parent,branchId:newId('branch'),fork:true});return options.modelPayload?generate(options):snapshot();}
  return {get status(){return turn.status;},get parsed(){return turn.parsed;},get lastError(){return turn.error;},setPreparedContext(value){if(turn.status!=='draft')throw new TurnError('turn_not_draft');turn.preparedContext=structuredClone(value);return saveCandidate('draft');},get context(){return {...turn,identity:{...turn.identity}};},begin,generate,validate,commit,retryCommit,failPreparation,recoverCandidate,replaceCandidate,setProcessing,failProcessing,regenerate,snapshot,
    invalidate(){epoch++;return status('interrupted',{proposal:null,error:{code:'interrupted',message:'页面上下文已切换'}});},
    reset(){epoch++;turn=fresh();return snapshot();},
  };
}
