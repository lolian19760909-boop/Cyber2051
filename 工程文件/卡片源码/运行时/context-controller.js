/* The card owns compaction policy; the bridge only supplies native transport. */
(function(root,factory){const local=typeof module==='object'&&module.exports,api=factory(local?require('./context-requests.js'):root.CxxContextRequests,local?require('./context-store.js'):root.CxxContextStore,local?require('./context-compact.js'):root.CxxContextCompact,local?require('../共享/data-clone.js'):root.CxxDataClone,local?require('./crypto-compat.js'):root.CxxCrypto);if(local)module.exports=api;else root.CxxContextController=api;})(globalThis,function(Requests,Store,Compact,Clone,Crypto){
  'use strict';
  const copy=v=>Clone.clone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),projectionVersion=2;
  function create({api,top,host,source,parser,readDisk,settings={}}={}){
    const ctx=()=>api.SillyTavern.getContext(),capture=()=>source.token(),countTokens=text=>ctx().getTokenCountAsync(text);
    const store=Store.create({api,top,host,capture,readDisk}),requests=Requests.create({bridge:()=>top.CxxContextBridge,capture,countTokens,onRecord:record=>{if(['failed','cancelled'].includes(record.status)&&same(record.scope,capture().scope))void store.update(v=>{if(!v.receipts.some(r=>r.id===record.id))v.receipts.push(record);}).catch(()=>{});}});
    let disposed=false,round=null,lastFixed=null,lastReport=null,lastError='';
    function story(raw){
      const text=parser.prepareDialogue(parser.readingText(String(raw||''))),inspected=parser.inspect(text),cuts=inspected.ranges.filter(r=>r.aux||['UpdateVariable','ztl','xuan','CityPublicContext','m18-terminal'].includes(r.kind));
      const merged=[];for(const r of cuts.sort((a,b)=>a.start-b.start)){const last=merged.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else merged.push({start:r.start,end:r.end});}
      let result=text;for(const r of merged.reverse())result=result.slice(0,r.start)+'\n'+result.slice(r.end);return {text:result.replace(/<StatusPlaceHolderImpl\s*\/>/g,'').trim(),pending:cuts.some(r=>!r.complete)};
    }
    function actorName(actorId){
      const known=top.CxxLongMemory?.actors?.().find(a=>a.actorId===actorId)?.name;if(known)return known;
      for(const m of [...ctx().chat].reverse()){const name=m.variables?.[m.swipe_id||0]?.stat_data?.terminal?.ensemble?.actors?.[actorId]?.name;if(name)return name;}
      return actorId==='player'?ctx().chatMetadata?.variables?.__cxx_identity?.name:null;
    }
    function visibleStory(raw,name){
      const parsed=story(raw),text=parsed.text,canonical=value=>parser.characterAliases?.[value]?.name||value;
      const cuts=parser.inspect(text).ranges.filter(r=>{if(r.kind!=='cxx-say')return false;const opening=text.slice(r.start,r.bodyStart),kind=/\bkind\s*=\s*(["'])(.*?)\1/i.exec(opening)?.[2];if(kind!=='thought')return false;const speaker=/\bspeaker\s*=\s*(["'])(.*?)\1/i.exec(opening)?.[2];return !speaker||!(['{{user}}','user','玩家'].includes(speaker)||name&&canonical(speaker)===canonical(name));});
      let result=text;for(const r of cuts.sort((a,b)=>b.start-a.start))result=result.slice(0,r.start)+'\n'+result.slice(r.end);
      return {text:result.trim(),hiddenThoughts:cuts.length,pending:parsed.pending};
    }
    async function project(request){
      const c=ctx(),binding=request.binding,actorId=binding?.viewpointActorId;
      if(!actorId||actorId!==binding.actorId)throw Error('本轮人物视角尚未确定，未压缩历史。');
      const rows=[],name=actorName(actorId);let withheldMessages=0,hiddenThoughts=0,pendingHistoricalRows=0;
      for(const [i,mapped]of request.mapped.entries()){
        const native=request.rows[i];
        // Ownership applies to the outgoing copy as well as summaries. Shared facts
        // enter through source-backed knowledge records, not another actor's raw chat.
        if(!native.is_system&&mapped.binding?.viewpointActorId!==actorId){withheldMessages++;continue;}
        if(typeof native.mes!=='string')throw Error('发送副本的正文不是文本，未改写本轮消息。');
        const visible=native.is_system?{text:native.mes,hiddenThoughts:0}:visibleStory(native.mes,name);hiddenThoughts+=visible.hiddenThoughts;
        if(visible.pending)pendingHistoricalRows++;
        if(!native.is_system)native.mes=visible.text;
        const projectionDigest=Array.from(new Uint8Array(await Crypto.digest(new TextEncoder().encode(visible.text))),x=>x.toString(16).padStart(2,'0')).join('');
        rows.push({ref:{scope:copy(request.index.scope),messageId:mapped.messageId,variantId:mapped.variantId,digest:mapped.digest,ancestry:mapped.ancestry},projectionDigest,native,role:native.is_user?'user':native.is_system?'system':'assistant',text:visible.text,pending:visible.pending||mapped.pending||!!(native.is_system||native.extra?.media?.length||native.extra?.files?.length||native.tool_calls||native.tool_call_id),binding:copy(mapped.binding)});
      }
      if(typeof top.CxxContextBridge?.fixedBudget!=='function')throw Error('请安装 Runtime Suite 0.2.0 或更新版本，并启用上下文模块，以启用首次摘要预算；安装状态见插件检查。');
      const reserve=request.memory?.mode==='database'?{tokens:0,key:'database'}:await top.CxxContextBridge.fixedBudget(request);
      const fixed=Math.max(reserve.tokens,lastFixed?.key===reserve.key?lastFixed.tokens:0);
      if(round?.id!==request.id)throw Error('本轮上下文整理已停止。');round.fixedBudget=reserve;
      return {rows,nativeRows:rows.map(r=>r.native),actorId,projectionVersion,projection:{withheldMessages,hiddenThoughts,pendingHistoricalRows},contextSize:c.chatCompletionSettings?.openai_max_context,outputTokens:c.chatCompletionSettings?.openai_max_tokens,fixedTokens:fixed,sessionId:request.id,pinned:top.CxxLongMemory?.contextPins?.(actorId)||[]};
    }
    const compact=Compact.create({source:{capture,validSource:source.validSource,validSources:source.validSources},store,requests,countTokens,project,settings});
    async function before(request){
      if(disposed)throw Error('上下文服务已关闭。');lastError='';const epoch=capture();round={id:request.id,scope:copy(epoch.scope),binding:copy(epoch.binding),historyTokens:null,summaryTokens:0,markers:[]};
      if(ctx().mainApi!=='openai'||!top.CxxContextBridge?.capabilities?.().auxiliary){round=null;return {rows:request.rows};}
      try{if(request.memory?.mode==='database'){const projected=await project(request);if(round?.id!==request.id)throw Error('本轮上下文整理已停止。');lastReport={mode:'database',provider:request.memory.provider?.id,calls:0,projection:projected.projection,notes:['数据库接管历史与召回；保留人物视角筛选，本轮不创建或注入套件摘要。']};round=null;return {rows:projected.nativeRows};}
        const result=await compact.before(request);if(round?.id!==request.id)throw Error('本轮上下文整理已停止。');if(store.read().enabled===false){lastReport=compact.status().lastRun;round=null;return result;}
        round.historyTokens=await countTokens(JSON.stringify(result.rows.map(r=>({role:r.is_user?'user':r.is_system?'system':'assistant',content:r.mes}))));round.summaryTokens=await countTokens(result.prompt||'');
        {const nonce='CXXCTX_'+request.id+'_'+Date.now()+'_';round.anchor='['+nonce+'MAIN]';result.prompt=(result.prompt?result.prompt+'\n':'')+round.anchor;result.rows.forEach((row,i)=>{if(row.is_system)return;const begin='['+nonce+i+'_BEGIN]',end='['+nonce+i+'_END]';round.markers.push({begin,end,role:row.is_user?'user':'assistant',content:row.mes});row.mes=begin+'\n'+row.mes+'\n'+end;});}
        const {key,...fixedBudget}=round.fixedBudget||{};
        lastReport={...compact.status().lastRun,fixedBudget,estimateScope:'history-plus-current-config-reserve'};return result;
      }catch(e){lastError=e.message;throw e;}
    }
    async function final({id,payload}){
      if(round?.id!==id||!round.anchor||!Array.isArray(payload?.chat)||ctx().mainApi!=='openai')return;
      const token=round,slots=[],anchorOnly=new Set(payload.chat.filter(m=>typeof m.content==='string'&&m.content.trim()===token.anchor));for(const m of payload.chat){if(typeof m.content==='string')slots.push({get:()=>m.content,set:value=>{m.content=value;}});else if(Array.isArray(m.content))for(const part of m.content)if(typeof part?.text==='string')slots.push({get:()=>part.text,set:value=>{part.text=value;}});}
      const combined=slots.map(s=>s.get()).join('\0'),present=token.markers.filter(m=>combined.split(m.begin).length===2&&combined.split(m.end).length===2);
      // Other extensions may run generateRawData while a narrative round is active.
      // Native raw calls do not assemble our depth-zero extension prompt.
      if(!combined.includes(token.anchor)&&!token.markers.some(m=>combined.includes(m.begin)||combined.includes(m.end)))return;
      const anchorCount=combined.split(token.anchor).length-1;
      for(const slot of slots){let value=slot.get();for(const marker of token.markers)value=value.split(marker.begin+'\n').join('').split('\n'+marker.end).join('').split(marker.begin).join('').split(marker.end).join('');value=value.split(token.anchor).join('');slot.set(value);}
      for(let i=payload.chat.length-1;i>=0;i--)if(anchorOnly.has(payload.chat[i])&&!payload.chat[i].content.trim())payload.chat.splice(i,1);
      await top.CxxLongMemory?.preparePrompt?.(payload);if(round!==token)throw Error('本轮发送已经变化。');
      const value=await countTokens(JSON.stringify(payload.chat));if(round!==token)throw Error('本轮发送已经变化。');
      if(!Number.isFinite(value))throw Error('最终输入长度暂时无法估算。');
      const c=ctx(),b=Compact.budget({contextSize:c.chatCompletionSettings.openai_max_context,responseTokens:c.chatCompletionSettings.openai_max_tokens,settings});
      const history=present.length!==token.markers.length?await countTokens(JSON.stringify(present.map(({role,content})=>({role,content})))):token.historyTokens;if(round!==token)throw Error('本轮发送已经变化。');
      const fixed=history===null?null:Math.max(0,Math.ceil(value-history-token.summaryTokens));if(fixed!==null)lastFixed={key:token.fixedBudget?.key,tokens:fixed};
      lastReport={...lastReport,finalInputEstimate:Math.ceil(value),budget:b,tokenSource:'host-estimate'};
      if(anchorCount!==1||present.length!==token.markers.length){lastError='宿主在装配提示时裁掉或改写了需要保留的对话，本次已停止发送。已更新固定内容估算，可重新发送继续整理；近期内容本身过长时请提高上下文窗口。';throw Error(lastError);}
      // This check occurs after native worldbook/preset assembly; the earlier estimate
      // is not advertised as a full prompt measurement, especially on the first turn.
      if(store.read().enabled!==false&&value>b.input){lastError='本轮完整提示超过预留输入预算。已记下固定内容用量，请重新发送以继续整理；若近期内容本身过长，请提高上下文窗口。';throw Error(lastError);}
      return true;
    }
    function records(){const actorId=source.binding()?.viewpointActorId,list=(store.read().compactions||[]).filter(r=>r.viewpointActorId===actorId),refs=list.flatMap(r=>r.sources||[]),checks=source.validSources(refs),validity=new Map(refs.map((ref,i)=>[ref,checks[i]]));return list.map(r=>({...copy(r),status:r.projectionVersion!==projectionVersion?'outdated':r.status==='excluded'?'excluded':r.sources?.every(ref=>validity.get(ref))?'ready':'stale'}));}
    const service={before,final,finish(){round=null;requests.cancel();},status:()=>({enabled:store.read().enabled!==false,retryRevision:store.read().retryRevision||0,...compact.status(),error:lastError||compact.status().error,pendingSave:store.status().pending,requests:requests.status(),lastRun:copy(lastReport),records:records(),receipts:copy(store.read().receipts||[])}),
      async setEnabled(value){if(round||compact.status().busy)throw Error('请等待本轮回复结束后调整压缩设置。');return store.update(v=>{v.enabled=value===true;});},
      async exclude(id){if(round||compact.status().busy)throw Error('请等待本轮回复结束后调整摘要。');return store.update(v=>{const row=v.compactions.find(r=>r.id===id);if(!row)throw Error('摘要记录不存在。');row.status='excluded';});},
      async include(id){if(round||compact.status().busy)throw Error('请等待本轮回复结束后调整摘要。');return store.update(v=>{const row=v.compactions.find(r=>r.id===id);if(!row||row.projectionVersion!==projectionVersion||!source.validSources(row.sources).every(Boolean))throw Error('摘要来源或人物筛选规则已变化，不能重新使用。');row.status='ready';});},
      async allowRetry(){if(round||compact.status().busy)throw Error('请等待本轮回复结束后调整压缩设置。');return store.update(v=>{v.retryRevision=(v.retryRevision||0)+1;});},
      retrySave:()=>store.retry(),cancel:()=>requests.cancel(),destroy(){disposed=true;round=null;requests.destroy();store.destroy();}};
    return service;
  }
  return {create};
});
