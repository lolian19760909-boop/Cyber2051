/** Memory sources use the maintained story parser; auxiliary planning and patches are never facts. */
import {semanticHash,stableJSON} from '../context/sources.mjs';
import {normalizeThinkingTags} from '../app/parse.mjs';
export const normalizeQuote=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function narrativeBody(raw,parser){
  if(!parser?.inspect||!parser?.readingText)throw Object.assign(new Error('长期记忆需要正文解析器'),{code:'memory_parser_missing'});
  const text=parser.prepareDialogue(parser.readingText(normalizeThinkingTags(String(raw||'')))),checked=parser.inspect(text);
  const cuts=checked.ranges.filter(r=>r.aux||['UpdateVariable','ztl','xuan','CityPublicContext','m18-terminal'].includes(r.kind));
  if(cuts.some(r=>!r.complete))throw Object.assign(new Error('正文辅助块尚未闭合，不能归档'),{code:'memory_incomplete'});
  const ranges=[];for(const r of cuts.sort((a,b)=>a.start-b.start)){const last=ranges.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else ranges.push({start:r.start,end:r.end});}
  let body=text;for(const r of ranges.reverse())body=body.slice(0,r.start)+'\n'+body.slice(r.end);
  return body.replace(/<StatusPlaceHolderImpl\s*\/>/g,'').trim();
}
export function narrativeSegments(raw,parser,actors=[]){
  const parsed=parser.parseMessage(normalizeThinkingTags(raw)),canonical=name=>parser.characterAliases?.[name]?.name||name,byName=new Map(actors.map(a=>[canonical(a.name),a.actorId]));
  const owner=p=>['{{user}}','user','玩家'].includes(p.speaker)&&actors.some(a=>a.actorId==='player')?'player':byName.get(canonical(p.speaker))||actors.find(a=>a.actorId===p.characterId)?.actorId||null;
  return (parsed.paragraphs||[]).filter(p=>String(p.dialogueText||p.text||'').trim()).map(p=>({kind:p.kind==='thought'?'thought':p.speaker?'speech':'narration',actorId:owner(p),speaker:p.speaker||null,text:String(p.dialogueText||p.text)}));
}
export function chunksOf(segments,limit=10000){
  const result=[];let current=[],size=0;
  for(const segment of segments){const chars=[...segment.text];for(let at=0;at<chars.length;at+=limit){const part={...segment,text:chars.slice(at,at+limit).join(''),...(at?{continued:true}:{})},length=part.text.length;if(size+length>limit&&current.length){result.push(current);current=[];size=0;}current.push(part);size+=length;}}
  if(current.length)result.push(current);return result;
}
export async function memoryNodeContent(node,parser){
  const raw=String(node.message?.raw||''),body=raw?narrativeBody(raw,parser):'',viewpointActorId=node.message?.binding?.viewpointActorId||node.message?.actorId||(node.native?null:'player');
  const hash=await semanticHash({body:normalizeQuote(body),viewpointActorId,utterances:raw?narrativeSegments(raw,parser).filter(s=>s.speaker).map(s=>({kind:s.kind,speaker:s.speaker,text:normalizeQuote(s.text)})):[]});
  return {raw,body,hash};
}
export const extendMemoryAncestor=(prior,node,hash)=>semanticHash({prior,nodeId:node.nodeId,parentId:node.parentId||null,operationId:node.operationId||null,input:node.message?.input?.text||'',...(node.message?.input?.messages?{inputMessages:node.message.input.messages}:{}),semanticHash:hash,...(node.message?.kind==='program'?{changes:node.changes}:{})});
export async function buildMemorySources({nodes=[],identity,parser,versions={},memo}){
  const base={schema:1,accountId:identity.accountId,runId:identity.runId},scope=stableJSON({...base,versions});
  if(memo&&memo.scope!==scope){memo.scope=scope;memo.root=await semanticHash(base);memo.nodes=new Map();}
  const rows=[],seen=new Set();let ancestorHash=memo?.root||await semanticHash(base);
  for(const [floor,node]of nodes.entries()){
    if(!node?.nodeId||seen.has(node.nodeId)||floor&&node.parentId!==nodes[floor-1].nodeId)throw Object.assign(new Error('记忆来源链不连续'),{code:'memory_source_chain'});seen.add(node.nodeId);
    const signature=stableJSON({parentId:node.parentId,operationId:node.operationId,input:node.message?.input?.text,...(node.message?.input?.messages?{inputMessages:node.message.input.messages}:{}),kind:node.message?.kind,native:node.native,actorId:node.message?.actorId,binding:node.message?.binding,...(node.message?.kind==='program'?{changes:node.changes}:{})}),cached=memo?.nodes.get(node.nodeId),same=cached?.signature===signature&&cached.raw===node.message?.raw,prior=ancestorHash;
    const content=same?cached.content:await memoryNodeContent(node,parser),{raw,body,hash}=content;
    ancestorHash=same&&cached.prior===prior?cached.ancestor:await extendMemoryAncestor(prior,node,hash);
    memo?.nodes.set(node.nodeId,{signature,raw:node.message?.raw,content,prior,ancestor:ancestorHash});
    if(!raw||node.message?.kind==='program')continue;
    rows.push({node,body,plain:normalizeQuote(body),source:{schema:1,runId:identity.runId,accountId:identity.accountId,branchId:node.branchId,nodeId:node.nodeId,replyId:node.message?.attemptId||node.nodeId,semanticHash:hash,ancestorHash,ancestorDepth:floor+1,parentNodeId:node.parentId||null,floor,swipe:0,versions:{...versions},ref:{messageId:node.nodeId,variantId:node.message?.attemptId||node.nodeId,semanticHash:hash,ancestorHash}}});
  }if(memo)for(const id of memo.nodes.keys())if(!seen.has(id))memo.nodes.delete(id);return rows;
}
export function checkMemorySource(source,rows,{requireQuote=true}={}){
  if(!source?.ref||source.schema!==1)return {valid:false,reason:'来源缺少身份'};
  const row=rows.find(r=>r.source.nodeId===source.nodeId);if(!row)return {valid:false,reason:'来源不在当前路线'};
  const now=row.source;
  for(const field of ['accountId','runId','nodeId','replyId','semanticHash','ancestorHash'])if(now[field]!==source[field])return {valid:false,reason:'来源正文或祖先链已改变'};
  if(source.ancestorDepth!==undefined&&source.ancestorDepth!==now.ancestorDepth||source.parentNodeId!==undefined&&source.parentNodeId!==now.parentNodeId)return {valid:false,reason:'来源祖先链已改变'};
  if(requireQuote&&(typeof source.quote!=='string'||normalizeQuote(source.quote).length<8||!row.plain.includes(normalizeQuote(source.quote))))return {valid:false,reason:'来源原句不匹配'};
  return {valid:true,row};
}
export function actorRoster(state,profile={}){const list=Object.entries(state?.terminal?.ensemble?.actors||{}).map(([id,a])=>({actorId:a.actorId||id,name:a.name||id}));if(!list.some(a=>a.actorId==='player'))list.unshift({actorId:'player',name:profile.name||'玩家'});return list;}
