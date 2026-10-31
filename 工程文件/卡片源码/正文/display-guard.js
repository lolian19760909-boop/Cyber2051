(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={install:factory};else root.CxxDisplayGuard235={install:factory};})(globalThis,function(options){
  'use strict';
  const {top,api,runtime,parser}=options;
  const thoughtStyle=top.document?.createElement('style');
  if(thoughtStyle){
    thoughtStyle.textContent=globalThis.CxxDisplayGuardStyle||'';
    top.document.head.append(thoughtStyle);
  }
  const toggleDiagnostic=event=>{const detail=event.target;if(!detail?.matches?.('.cxx-update-diagnostic'))return;const body=detail.querySelector(':scope > .cxx-native-aux-body');if(body){body.hidden=!detail.open;body.style?.setProperty('display',detail.open?'block':'none','important');}};
  top.document?.addEventListener('toggle',toggleDiagnostic,true);
  const mirrorEnabled=()=>api.getVariables?.({type:'chat'})?.__cxx_ui_preferences?.mirror!==false;
  const mirrorStyle=top.document?.createElement('style');if(mirrorStyle)mirrorStyle.textContent='html[data-cxx-mirror-off] #chat :is(.jy-tts-bar,.jy-tts-line,.jy-tts-play,.jy-tts-edit){display:none!important}';mirrorStyle&&top.document.head.append(mirrorStyle);
  const syncMirror=()=>{top.document?.documentElement?.toggleAttribute('data-cxx-mirror-off',!!runtime.key()&&!mirrorEnabled());runtime.scheduleMessages?.(null,true,'mirror-mode');};
  top.addEventListener?.('cxx-ui-preferences-changed',syncMirror);const offMirror=runtime.watchMessages?.(batch=>{if(batch?.reasons?.includes('scope'))syncMirror();});syncMirror();
  const formatter=api.SillyTavern.getContext().messageFormatter;
  // The host has addHook but no removeHook. Keep exactly one dormant dispatcher
  // per formatter; all card-owned state is released with the current runtime.
  const hooks=typeof formatter?.addHook==='function';
  const key='__cxx_display_dispatch_235__';let slot=top[key];
  if(!slot||slot.formatter!==formatter){
    slot?.stopLegacy?.();
    slot={formatter,handler:null};top[key]=slot;
    if(hooks){
    formatter.addHook((text,context)=>slot.handler?.before(text,context)??text,{stage:'beforeRegex',order:0});
    formatter.addHook(text=>slot.handler?.after(text)??text,{stage:'afterRegex',order:10000});
    }
  }
  let sequence=0;const saved=new Map(),nonce=(top.crypto?.randomUUID?.()||String(Date.now())).replace(/-/g,'');
  const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const outcome=floor=>(top.Cxx236VariableGuard||api.Cxx236VariableGuard)?.state?.({floor})?.receipt;
  const outcomeText=receipt=>receipt?.phase==='saved'?'变量已保存并核对':receipt?.phase==='rejected'?'变量未应用':receipt?.phase==='applied'?'变量已应用，保存待核对':receipt?.phase==='missing'?'本轮未提供变量更新':'变量格式已识别，等待处理';
  const fingerprint=text=>{text=String(text||'').replace(/\r\n/g,'\n').replace(/<StatusPlaceHolderImpl\/>/g,'').trim();let hash=2166136261;for(const ch of text)hash=Math.imul(hash^ch.charCodeAt(0),16777619);return (hash>>>0).toString(16)+':'+text.length;};
  function growthOutcome(node,floor,receipt){
    let box=node.nextElementSibling?.matches?.('.cxx-growth-receipt')?node.nextElementSibling:null,summary=null,points=0;
    if(receipt?.phase!=='saved'||!receipt.growth?.rewardIds?.length){box?.remove();return;}
    try{const state236=top.Cxx236State||api.Cxx236State,live=state236&&typeof state236.stat==='function'?state236.stat():null,stat=live&&live.terminal?live:null,id=stat?.terminal?.ensemble?.control?.actorId||'player',g=id==='player'?stat?.terminal?.gameplay:stat?.terminal?.ensemble?.actors?.[id]?.gameplay;const progress=top.CxxRoster?.progress(g,{receipt,actorId:id});summary=progress?.currentSummary;points=(progress?.attributePoints||0)+(progress?.perkPoints||0);}catch{}
    if(!summary){box?.remove();return;}const stamp=JSON.stringify([summary,points]);if(box?.dataset.summary===stamp)return;
    if(!box){box=top.document.createElement('aside');box.className='cxx-growth-receipt';box.setAttribute('role','status');node.after(box);}box.dataset.summary=stamp;box.replaceChildren();
    const title=top.document.createElement('strong'),text=top.document.createElement('p'),button=top.document.createElement('button');title.textContent='成长已结算 · '+summary.text;text.textContent=summary.reasons.join('；');button.type='button';button.textContent='分配当前成长点';button.hidden=!points;button.onclick=()=>top.__cxx_player__?.open('天赋');box.append(title,text,button);
  }
  const refreshOutcomes=()=>{for(const node of top.document?.querySelectorAll?.('[data-cxx-variable-floor]')||[]){
    const floor=Number(node.dataset.cxxVariableFloor),receipt=outcome(floor);if(!receipt||receipt.hostFingerprint!==node.dataset.cxxVariableFingerprint||String(receipt.swipe)!==node.dataset.cxxVariableSwipe){growthOutcome(node,floor,null);continue;}
    const title=node.querySelector('[data-cxx-variable-title]'),detail=node.querySelector('[data-cxx-variable-detail]');if(title)title.textContent=outcomeText(receipt)+' · 展开查看';if(detail)detail.textContent=receipt.message||outcomeText(receipt);
    growthOutcome(node,floor,receipt);
  }};
  const offOutcomes=runtime.watchMessages?.(refreshOutcomes);
  const sourceStatus=(floor,result)=>{
    const pending=!result||result.code==='source_pending'||result.code==='processing';
    return '<section class="cxx-source-status'+(pending?'':' cxx-source-error')+'" role="status" aria-live="polite"><span class="cxx-source-mark" aria-hidden="true"></span><div class="cxx-source-copy"><small>TOKYO 2051 / READING</small><strong>'+(pending?'正在准备正文':'正文暂时无法读取')+'</strong><p>'+(pending?'稍等片刻，读好后会自动显示。':'可以重新读取；具体原因见下方详情。')+'</p>'+(pending?'':'<button type="button" data-cxx-source-retry="'+floor+'">重新读取</button><details><summary>查看原因</summary><p>'+escape(String(result.message||'读取尚未完成。'))+'</p></details>')+'</div></section>';
  };
  const retrySource=async event=>{
    const button=event.target.closest?.('[data-cxx-source-retry]');if(!button||!button.closest('#chat'))return;
    const floor=Number(button.dataset.cxxSourceRetry),mes=button.closest('.mes');if(!Number.isInteger(floor)||Number(mes?.getAttribute('mesid'))!==floor)return;
    const source=top.CxxSource;if(!source?.refresh)return;button.disabled=true;
    try{const pending=source.refresh(floor);runtime.scheduleMessages?.(floor,false,'source');await pending;}
    catch(error){top.CxxDiagnostics?.report({module:'正文读取',stage:'重新读取',message:error.message,detail:error.stack||''});}
    finally{if(button.isConnected)button.disabled=false;runtime.scheduleMessages?.(floor,false,'source');}
  };
  top.document?.addEventListener('click',retrySource);
  const handler={
    before(text,context){
      if(!runtime.alive||!runtime.key()||context.isUser||context.isSystem||context.isReasoning)return text;
      const source=top.CxxSource,floor=context.messageId,row=api.SillyTavern.getContext().chat?.[floor];
      if(!mirrorEnabled()&&source?.original&&Number.isInteger(floor)&&row?.mes===text)text=source.original(floor);
      if(mirrorEnabled()&&source&&top.__JINGYI__&&Number.isInteger(floor)&&row?.mes===text){
        const result=source.peek(floor);
        if(result?.ok)text=top.CxxReading?.displayRaw?.(result.snapshot)||result.sourceMessage;
        else{
          void source.read(floor).catch(()=>{});
          const token='CXXSOURCE'+nonce+'X'+(++sequence)+'END';saved.set(token,sourceStatus(floor,result));return token;
        }
      }
      text=parser.prepareDialogue(parser.readingText(text));
      let parsed=parser.inspect(text);
      const updates=parsed.roots.filter(r=>r.kind==='UpdateVariable');
      // Display copies are inert. The same decoder supplies their format result;
      // a receipt only describes this exact floor, swipe and source text.
      for(const r of updates.slice().reverse()){
        const token='CXXPROTECTED'+nonce+'X'+(++sequence)+'END',raw=text.slice(r.start,r.end);
        const reason=r.reason||'更新块重复、嵌套或标签格式不完整。';
        const receipt=outcome(floor),title=receipt?outcomeText(receipt):r.valid?'变量格式已识别，等待处理':'变量格式异常',detail=receipt?.message||(r.valid?'尚无本楼层的变量处理回执。':reason),sourceRaw=row?.mes||text;
        saved.set(token,'<details class="cxx-native-aux cxx-update-diagnostic" data-cxx-aux="native" data-cxx-variable-floor="'+floor+'" data-cxx-variable-swipe="'+(row?.swipe_id||0)+'" data-cxx-variable-fingerprint="'+fingerprint(sourceRaw)+'"><summary data-cxx-variable-title>'+escape(title)+' · 展开查看</summary><div class="cxx-native-aux-body" hidden style="display:none!important"><p data-cxx-variable-detail>'+escape(detail)+'</p><pre>'+escape(raw)+'</pre></div></details>');
        text=text.slice(0,r.start)+token+text.slice(r.end);
      }
      if(updates.length)parsed=parser.inspect(text);
      const mask=new Uint8Array(parsed.protection.all),invalid=new Uint8Array(text.length);
      // Keep Izumi's delimiters for its existing folding regex, while treating
      // the planning body as text until after display regexes have finished.
      if(parsed.planning)mask.fill(1,parsed.planning.bodyStart,parsed.planning.closeStart);
      for(const m of text.matchAll(/^(?: {4}|\t)[^\r\n]*/gm))mask.fill(1,m.index,m.index+m[0].length);
      for(const r of parsed.roots)if(!r.valid||!r.complete){mask.fill(1,r.start,r.end);invalid.fill(1,r.start,r.end);}
      for(const r of parsed.diagnostics){mask.fill(1,r.start,r.end);invalid.fill(1,r.start,r.end);}
      // Merge masks before replacing so a literal never crosses a second token.
      const spans=[];for(let i=0;i<mask.length;i++)if(mask[i]){const start=i;while(mask[i+1])i++;spans.push([start,i+1]);}
      for(const [start,end]of spans.reverse()){
        const raw=text.slice(start,end);if(!/[<>]/.test(raw))continue;
        const token='CXXPROTECTED'+nonce+'X'+(++sequence)+'END';
        let literal=raw;
        if(!/^(?: {0,3}(?:`+|~{3,})| {4}|\t)/.test(raw)){
          const html=/^(<(?:pre|code|blockquote)\b[^>]*>)([\s\S]*?)(<\/(?:pre|code|blockquote)>)$/i.exec(raw);
          literal=html?html[1]+escape(html[2])+html[3]:raw.replaceAll('<','&lt;');
        }
        saved.set(token,invalid.subarray(start,end).some(Boolean)?escape(raw)+'（标签异常，已保留原文）':literal);
        text=text.slice(0,start)+token+text.slice(end);
      }
      text=parser.nativeDialogue(text,html=>{
        const token='CXXDIALOGUE'+nonce+'X'+(++sequence)+'END';saved.set(token,html);return token;
      });
      return text;
    },
    after(text){for(const [token,value]of saved)if(text.includes(token)){text=text.replaceAll(token,value);saved.delete(token);}return text;}
  };
  slot.stopLegacy?.();
  slot.handler=handler;
  // The suite owns the displayed DOM. Card rules remain the source of story
  // parsing; no host chat text or swipe is rewritten for presentation.
  let suiteRenderer=null,stopSuite=null,stopSuiteWatch=null;
  const connectSuite=()=>{
    const renderer=top.TavernVisual?.messages;
    if(renderer===suiteRenderer)return;
    stopSuiteWatch?.();stopSuiteWatch=null;stopSuite?.();stopSuite=null;suiteRenderer=renderer||null;
    if(!renderer?.register)return;
    stopSuite=renderer.register({id:'tokyo2051',priority:100,classPrefixes:['cxx-','bdc-'],
      matches:({raw,row})=>runtime.alive&&!!runtime.key()&&!row.is_system&&!/^<Opening(?:Form\/>|Page\b)/.test(raw),
      revision:({floor})=>{const value=top.CxxSource?.peek(floor);return [runtime.key(),value?.code,value?.snapshot?.sourceRevision,value?.snapshot?.readingRevision,value?.snapshot?.state,top.CxxReading?.mode?.(),outcome(floor)?.revision];},
      render:({raw,row,floor,format,status})=>{
        const source=top.CxxSource,result=source?.peek(floor);
        if(mirrorEnabled()&&!row.is_user&&source&&top.__JINGYI__&&!result?.ok){
          void source.read(floor).catch(()=>{});
          const pending=!result||result.code==='source_pending'||result.code==='processing';
          return status({state:pending?'loading':'error',title:pending?'正在准备正文':'正文暂时无法读取',description:pending?'稍等片刻，读好后会自动显示。':'可以重新读取，继续当前故事。',detail:pending?'':String(result.message||'读取尚未完成。'),
            action:pending?undefined:async()=>{try{await source.refresh(floor);}catch(error){top.CxxDiagnostics?.report({module:'正文读取',stage:'重新读取',message:error.message});}finally{runtime.scheduleMessages?.(floor,false,'source');}}
          });
        }
        const meta={floor,name:row.name||'',isUser:!!row.is_user};
        if(hooks)return format('host',raw,meta);
        try{const body=top.document.createElement('div'),c=api.SillyTavern.getContext();body.innerHTML=handler.after(c.messageFormatting(handler.before(raw,{messageId:floor,isUser:!!row.is_user}),meta.name,false,meta.isUser,floor));return body;}
        finally{saved.clear();}
      }
    });
    stopSuiteWatch=runtime.watchMessages?.(batch=>renderer.refresh(batch?.full?undefined:batch?.floors));
    runtime.scheduleMessages?.(null,true,'suite');
  };
  const suiteChanged=()=>{connectSuite();runtime.scheduleMessages?.(null,true,'suite');};
  top.addEventListener?.('trs-visual-ready',suiteChanged);
  top.addEventListener?.('trs-visual-stopped',suiteChanged);
  connectSuite();
  // TT / older hosts expose messageFormatting without the new hook API.
  // Reuse the host's regex/Markdown/sanitizer on display copies only.
  let stopLegacy=()=>{};
  if(!hooks&&typeof api.SillyTavern.getContext().messageFormatting==='function'){
    const rendered=new Map();
    const refresh=batch=>{
      if(suiteRenderer)return;
      const scope=runtime.key();if(!runtime.alive||!scope)return;
      const c=api.SillyTavern.getContext(),chat=top.document?.getElementById('chat');if(!chat)return;
      const nodes=batch&&!batch.full?batch.floors.map(id=>chat.querySelector('.mes[mesid="'+id+'"]')).filter(Boolean):chat.querySelectorAll('.mes');
      for(const mes of nodes){
        // The host owns the live editor, including its unsaved draft.
        if(mes.querySelector('.edit_textarea,#curEditTextarea'))continue;
        const id=Number(mes.getAttribute('mesid')),row=c.chat[id],node=mes.querySelector('.mes_text');
        if(!node||!row||row.is_system||typeof row.mes!=='string'||/^<Opening(?:Form\/>|Page\b)/.test(row.mes))continue;
        const previous=rendered.get(node);
        const snapshot=top.CxxSource?.peek(id),readingKey=JSON.stringify([snapshot?.code,snapshot?.snapshot?.sourceRevision,snapshot?.snapshot?.readingRevision,snapshot?.snapshot?.state,top.CxxReading?.mode?.(),outcome(id)?.revision]);
        // Native auxiliary folding may wrap this display copy in a details body.
        // It still belongs to this message; don't redraw and reset the user's toggle.
        if(previous?.scope===scope&&previous.raw===row.mes&&previous.swipe===row.swipe_id&&previous.readingKey===readingKey&&node.contains(previous.body))continue;
        const body=top.document.createElement('div');body.dataset.cxxLegacyDisplay='1';
        try{
          const text=handler.before(row.mes,{isUser:!!row.is_user,isSystem:false,isReasoning:false,messageId:id});
          body.innerHTML=handler.after(c.messageFormatting(text,row.name||c.characters[c.characterId]?.name||'',false,!!row.is_user,id));
        }finally{saved.clear();}
        node.replaceChildren(body);rendered.set(node,{body,scope,raw:row.mes,swipe:row.swipe_id,readingKey});
      }
      for(const node of rendered.keys())if(!chat.contains(node))rendered.delete(node);
    };
    const unwatch=runtime.watchMessages(refresh);
    stopLegacy=()=>{unwatch();for(const [node,{body}]of rendered)if(node.contains(body))body.replaceWith(...body.childNodes);rendered.clear();};
    slot.stopLegacy=stopLegacy;
  }
  // The current paired preset uses Chat Completion. Touch only outbound copies
  // of assistant text, retaining all other roles, multimodal parts and metadata.
  const promptEvent=api.SillyTavern.getContext().eventTypes?.CHAT_COMPLETION_PROMPT_READY;
  const history=payload=>{
    if(!runtime.alive||!runtime.key()||!Array.isArray(payload?.chat))return;
    for(let i=0;i<payload.chat.length;i++){
      const row=payload.chat[i];if(row?.role!=='assistant')continue;
      const content=typeof row.content==='string'?parser.historyDialogue(row.content):Array.isArray(row.content)?row.content.map(part=>part?.type==='text'&&typeof part.text==='string'?{...part,text:parser.historyDialogue(part.text)}:part):row.content;
      if(content!==row.content)payload.chat[i]={...row,content};
    }
  };
  if(promptEvent)api.eventOn(promptEvent,history);
  return ()=>{offOutcomes?.();offMirror?.();mirrorStyle?.remove();top.document?.documentElement?.removeAttribute('data-cxx-mirror-off');top.removeEventListener?.('cxx-ui-preferences-changed',syncMirror);stopSuiteWatch?.();stopSuite?.();suiteRenderer=null;top.removeEventListener?.('trs-visual-ready',suiteChanged);top.removeEventListener?.('trs-visual-stopped',suiteChanged);if(slot.handler===handler){slot.handler=null;stopLegacy();slot.stopLegacy=null;}saved.clear();thoughtStyle?.remove();top.document?.removeEventListener('toggle',toggleDiagnostic,true);top.document?.removeEventListener('click',retrySource);if(promptEvent)api.eventRemoveListener(promptEvent,history);};
});
