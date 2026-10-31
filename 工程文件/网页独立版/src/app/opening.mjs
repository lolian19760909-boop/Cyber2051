/** 直接出身开场没有作者写好的 /send 指令；补一条通用开场动作。 */
export const DIRECT_OPENING_PROMPT='【开始】【开场白】\n请顺着上面的开场继续，描写在场角色的反应与场景变化，停在一个需要玩家行动的时刻。不要替玩家决定行动。';
/** A confirmed opening is the sole automatic player action. Ordinary turns stay manual. */
export function confirmedOpeningCommand(command){
 if(!command)return '';
 const match=/^\/send ([\s\S]*)\|\/trigger$/.exec(command);
 if(!match||!match[1].trim())throw Error('剧情开场指令格式无效');
 return match[1].trim();
}
export function openingAction({command='',direct=false}={}){if(command)return confirmedOpeningCommand(command);return direct?DIRECT_OPENING_PROMPT:'';}
export async function pendingOpening({nodes,statePort,runId,draft=''}){
 const narrative=nodes.filter(node=>node.message?.kind!=='program'&&node.message?.raw);
 if(narrative.length!==1||narrative[0].message.kind!=='opening')return null;
 const node=narrative[0],text=node.message.openingAction||'';
 if(!text||draft.trim()&&draft.trim()!==text)return null;
 const operationId='opening-dispatch:'+node.nodeId;
 const parents=new Set(nodes.map(row=>row.nodeId)),attempts=statePort?.listRecords?await statePort.listRecords('drafts',runId):[];
 const latest=attempts.filter(row=>row.input?.text===text&&parents.has(row.parentNodeId)).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))[0];
  const retryAttempt=latest||null;
 // A dispatch receipt is not a generated story. Failed attempts from older versions remain retryable.
 // The committed narrative count above is the authority for whether this opening has completed.
 return {text,nodeId:node.nodeId,operationId,retryAttempt};
}
