/** Merge a continued reply into the same assistant message, keeping one story wrapper and protocol blocks at the tail. */
const STORY_OPEN=/<cxx-story\s*>/i;
const STORY_CLOSE=/<\/cxx-story\s*>/i;
const PROTOCOL=/<(?:UpdateVariable|m18-terminal|CityPublicContext|StatusPlaceHolderImpl)\b/i;
function storySpan(raw){
 const open=STORY_OPEN.exec(raw);if(!open)return null;
 const openEnd=open.index+open[0].length,rest=raw.slice(openEnd),close=STORY_CLOSE.exec(rest);
 const closeStart=close?openEnd+close.index:raw.length,closeEnd=close?closeStart+close[0].length:raw.length;
 return {start:open.index,openEnd,closeStart,closeEnd,closed:Boolean(close),inner:raw.slice(openEnd,closeStart),before:raw.slice(0,open.index),after:raw.slice(closeEnd)};
}
function splitProtocol(inner){const match=PROTOCOL.exec(inner);return match?{narrative:inner.slice(0,match.index),protocol:inner.slice(match.index)}:{narrative:inner,protocol:''};}
export function mergeContinuationRaw(originalRaw,continuationRaw,{postfix}={}){
 const a=String(originalRaw||''),b=String(continuationRaw||''),sa=storySpan(a),sb=storySpan(b);
 if(!sa||!sb)return postfix===undefined?[a,b].filter(Boolean).join('\n\n'):a+postfix+b;
 const left=splitProtocol(sa.inner),right=splitProtocol(sb.inner);
 // 续写在正文包裹外的前言按时间顺序接到原正文之后，不能让它跑到整条消息开头。
 const lead=b.slice(0,sb.start).trim();
 const narrative=postfix===undefined?[left.narrative.trimEnd(),lead,right.narrative.trimStart()].filter(text=>text.trim()).join('\n\n'):left.narrative+postfix+(lead?lead+'\n':'')+right.narrative;
 const protocol=[left.protocol.trim(),right.protocol.trim()].filter(Boolean).join('\n');
 return a.slice(0,sa.start)+a.slice(sa.start,sa.openEnd)+narrative+(protocol?'\n'+protocol:'')+(sa.closed?a.slice(sa.closeStart,sa.closeEnd):'</cxx-story>')+a.slice(sa.closeEnd)+b.slice(sb.closeEnd);
}
