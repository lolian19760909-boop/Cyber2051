/** Source fingerprints are content and ancestry bound, never credentials. */
export const stableJSON=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function semanticHash(value){if(!globalThis.crypto?.subtle)throw Object.assign(new Error('当前浏览器无法校验来源，请通过本机启动器或 HTTPS 打开'),{code:'source_crypto'});const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJSON(value)));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function sourceRows({nodes,identity,actorId='player',versions={},projectText,memo}){
 const base={schema:1,accountId:identity.accountId,runId:identity.runId,versions},scope=stableJSON({...base,actorId});
 if(memo&&memo.scope!==scope){memo.scope=scope;memo.root=await semanticHash(base);memo.nodes=new Map();}
 const rows=[],seen=new Set();let ancestry=memo?.root||await semanticHash(base);
 for(const node of nodes){
  seen.add(node.nodeId);const raw=node.message?.raw;
  const details={nodeId:node.nodeId,parentId:node.parentId,operationId:node.operationId,kind:node.message?.kind,input:node.message?.input?.text,...(node.message?.input?.messages?{inputMessages:node.message.input.messages}:{}),changes:node.changes,binding:node.message?.binding};
  const signature=stableJSON({...details,branchId:node.branchId,attemptId:node.message?.attemptId,native:node.native}),prior=ancestry,cached=memo?.nodes.get(node.nodeId);
  const reusable=cached?.signature===signature&&cached.raw===raw&&cached.prior===prior;
  ancestry=reusable?cached.ancestry:await semanticHash({prior,...details,raw});
  const saved={signature,raw,prior,ancestry,roles:{}};memo?.nodes.set(node.nodeId,saved);
  if(node.message?.kind==='program')continue;
  const binding=node.message?.binding||(!node.native?{actorId:'player',viewpointActorId:'player',evidence:'legacy-web-before-actor-controls'}:null);if(!binding||binding.viewpointActorId!==actorId)continue;
  const common={nodeId:node.nodeId,replyId:node.message?.attemptId||node.nodeId,branchId:node.branchId,actorId};
  const input=node.message?.input,inputs=Array.isArray(input?.messages)?input.messages.map((row,index)=>['user',row.content,'u'+index]):[['user',input?.text,'u']];
  for(const [role,text,suffix]of [...inputs,['assistant',raw,'a']]){
   if(!text)continue;const projection=projectText?projectText(text,role,node):{text:String(text)},native={role,content:String(typeof projection==='string'?projection:projection.text)},old=reusable?cached.roles[suffix]:null;
   const digest=old?.source===text?old.digest:await semanticHash({role,text}),projectionDigest=old?.content===native.content?old.projectionDigest:await semanticHash(native.content);
   saved.roles[suffix]={source:text,content:native.content,digest,projectionDigest};
   rows.push({role,text:native.content,native,binding,pending:!!projection.pending,hiddenThoughts:projection.hiddenThoughts||0,projectionDigest,ref:{schema:1,scope:{accountId:identity.accountId,runId:identity.runId},messageId:node.nodeId+'-'+suffix,variantId:(node.message?.attemptId||node.nodeId)+'-'+suffix,digest,ancestry,prior:node.parentId,...common}});
  }
 }
 if(memo)for(const id of memo.nodes.keys())if(!seen.has(id))memo.nodes.delete(id);
 return rows;
}
export function validSource(reference,rows){return rows.some(r=>r.ref.messageId===reference?.messageId&&r.ref.variantId===reference.variantId&&r.ref.digest===reference.digest&&r.ref.ancestry===reference.ancestry&&r.ref.actorId===reference.actorId);}
