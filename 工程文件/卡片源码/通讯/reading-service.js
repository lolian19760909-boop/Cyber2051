/* Public, read-only MirrorTranslate projections. Source identities own all voices. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./reading-projection.js'):root.CxxReadingProjection);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxReadingService=api;})(globalThis,function(Projection){
 'use strict';
 const MIC='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1M12 18v4M8 22h8"/></svg>';
 const clean=s=>String(s||'').normalize('NFKC').replace(/[\s「」『』“”"【】]/g,'');
 function matchParagraph(text,speaker,thought,parts,start=0){const n=clean(text);return parts.findIndex((p,i)=>i>=start&&p.voiceEligible!==false&&(p.kind==='thought')===thought&&(!speaker||clean(p.speaker)===clean(speaker))&&[p.dialogueText,p.voiceSource,p.voiceReading,p.sourceText,p.readingText,p.text].some(t=>t&&clean(t)===n));}
 function create({top,api,runtime,parser,bridge,core,setup,settings=()=>({}),configure=async()=>{},inCall=()=>false,enabled=()=>true}){
  let active=null,disposed=false,unwatch,unsource,unsetup,modeFlight=null,state={playing:false,status:'手动朗读 · 原文'};
  const sheet=top.document?.createElement?.('style');if(sheet){sheet.textContent=typeof CxxReadingStyle==='string'?CxxReadingStyle:'';top.document.head?.append(sheet);}
  const listeners=new Set(),native=new Map(),ctx=()=>api.SillyTavern.getContext(),source=()=>top.CxxSource;
  const mode=()=>!enabled()?'original':['original','reading','compare'].includes(settings().readingMode)?settings().readingMode:'original';
  function notify(){for(const fn of [...listeners])try{fn({...state,enabled:enabled(),mode:mode()});}catch{}for(const e of native.values()){e.output.textContent=state.floor===e.floor?state.status:'';for(const b of e.node.parentElement?.querySelectorAll('.cxx-inline-voice')||[]){const playing=state.playing&&state.floor===e.floor&&state.index===Number(b.dataset.index);b.setAttribute('aria-pressed',String(playing));}}top.dispatchEvent?.(new top.CustomEvent('cxx-reading-changed'));}
  function stop(){const changed=!!active||state.playing;if(active){const old=active;active=null;old.controller.abort();old.voice?.stop?.();old.voice?.cancel?.();old.release?.();}top.CxxVoice?.stop();state={...state,playing:false};if(changed)notify();}
  const project=snapshot=>snapshot?Projection.project(snapshot,parser,mode()):null;
  async function parsed(floor,signal){const row=ctx().chat[floor];if(!row||row.is_user||row.is_system)throw Error('当前正文不可用。');const r=source()?await source().read(floor,{signal}):{ok:true,sourceMessage:row.mes};if(!r.ok)throw Error(r.message||'无法核对原文。');return project(r.snapshot)||parser.parseMessage(core.source(r.sourceMessage,parser)||'',{cache:false});}
  function paragraphs(floor){const row=ctx().chat[floor];if(!row||row.is_user||row.is_system)return [];const r=source()?.peek(floor);if(top.__JINGYI__&&!r?.ok)return [];return (project(r?.snapshot)||parser.parseMessage(r?.sourceMessage||row.mes,{cache:false})).paragraphs;}
  function setMode(value){if(!enabled()&&value!=='original')return Promise.reject(Error('请先在设置 → 翻译与声音开启本故事的镜译功能。'));if(!['original','reading','compare'].includes(value))return Promise.reject(Error('未知阅读模式。'));if(modeFlight)return modeFlight;stop();modeFlight=Promise.resolve().then(()=>configure({readingMode:value})).then(()=>{runtime.scheduleMessages?.(null,true,'reading-mode');mountNative(true);notify();}).finally(()=>{modeFlight=null;});return modeFlight;}
  async function play({floor,index=0,continuous=false,side,onPosition}){
   if(!enabled())throw Error('本故事的镜译功能已关闭，请从设置开启。');if(inCall())throw Error('通话期间暂停正文朗读。');stop();top.CxxVoice?.prepare();const scope=runtime.key(),row=ctx().chat[floor],raw=row?.mes,swipe=row?.swipe_id;if(!scope||!row)throw Error('当前正文不可用。');
   const controller=new AbortController(),request=active={controller,release:top.CxxRadio?.suspend?.(),voice:null,raw,floor,swipe};
   const valid=()=>!disposed&&active===request&&runtime.key()===scope&&ctx().chat[floor]===row&&row.mes===raw&&row.swipe_id===swipe&&!inCall();
   try{
    const data=await parsed(floor,controller.signal),caps=await bridge.refresh();if(!valid())return;if(!caps.read){setup?.open();throw Error(caps.readReason||caps.reason||'请在镜译中启用并配置楼层朗读。');}bridge.stopAll?.();
    const parts=data.paragraphs,cfg=settings(),reading=side==='reading'||(!side&&mode()==='reading');if(!parts.length)throw Error('该楼层没有完整正文。');let count=0;
    for(let i=index;i<parts.length;i++){
     if(!valid())break;const p=parts[i];if(p.voiceEligible===false){if(!continuous)throw Error('该项是诊断或附属信息，不参与正文朗读。');continue;}if(continuous&&cfg.readRange==='dialogue'&&(!p.speaker||p.kind==='thought'))continue;
     const useReading=reading&&(side==='reading'||!!p.voiceReading),text=useReading?p.voiceReading:p.voiceSource||p.dialogueText||p.text;if(!text){if(!continuous)throw Error('此段暂无可用译文，请先在镜译中翻译。');continue;}
     state={floor,index:i,playing:true,status:(useReading?'译文 · ':'原文 · ')+(p.kind==='thought'?'心声 · ':'')+(p.speaker||'旁白')};notify();onPosition?.(i);
     const options={text,speaker:p.speaker||'',lang:useReading?cfg.readLanguage||p.readingLanguage||'':cfg.readLanguage||'',signal:controller.signal};
     if(top.CxxVoice&&bridge.renderSpeech){
      state={...state,status:'正在生成语音 · '+(p.speaker||'旁白')};notify();
      const rendered=await bridge.renderSpeech(options);if(!valid())break;
      await rendered.done;const blob=await rendered.blob();if(!valid())break;
      request.voice=await top.CxxVoice.play(blob,{scope,floor,swipe:swipe||0,index:i,characterId:p.characterId,kind:p.kind},controller.signal);
     }else request.voice=await bridge.speak(options);
     if(!valid())break;
     state={...state,status:'正在朗读 · '+(p.kind==='thought'?'心声 · ':'')+(p.speaker||'旁白')};notify();
     await request.voice.done;if(!valid())break;count++;if(!continuous)break;
    }
    if(valid())state={...state,playing:false,status:count?'朗读完成':reading?'当前范围暂无可用译文':'当前范围没有可朗读段落'};
   }catch(e){if(valid()){state={...state,playing:false,status:e.message};throw e;}}finally{if(active===request){active=null;request.release?.();notify();}}
  }
  function error(e){top.toastr?.warning?.(e.message,'朗读');state={...state,playing:false,status:e.message};notify();}
  function mountNative(force=false){
   if(disposed)return;const scope=runtime.key(),chat=ctx().chat;
   for(const [mes,e]of native)if(!mes.isConnected||e.scope!==scope||!chat[e.floor]||chat[e.floor].is_user||chat[e.floor].is_system||!core.source(chat[e.floor].mes,parser)){e.node.remove();mes.querySelectorAll('.cxx-inline-voice').forEach(n=>n.remove());native.delete(mes);}
   if(!enabled()){for(const e of native.values())e.node.remove();native.clear();top.document.querySelectorAll('.cxx-inline-voice').forEach(n=>n.remove());return;}
   if(!scope)return;
   for(const mes of top.document.querySelectorAll('#chat .mes[mesid]')){
    const floor=Number(mes.getAttribute('mesid')),row=chat[floor];if(!row||row.is_user||row.is_system||!core.source(row.mes,parser))continue;
    let e=native.get(mes);if(!e||!e.node.isConnected){e?.node.remove();const node=top.document.createElement('details');node.dataset.cxxSlot='reading';node.className='cxx-reading-tools';
     const summary=top.document.createElement('summary');summary.textContent='阅读与声音';node.append(summary);
     const modes=top.document.createElement('div'),select=top.document.createElement('select');select.setAttribute('aria-label','朗读段落');select.onchange=stop;
     modes.className='cxx-reading-modes';const actions=top.document.createElement('div');actions.className='cxx-reading-actions';const button=(parent,label,fn)=>{const b=top.document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>Promise.resolve().then(fn).catch(error);parent.append(b);return b;};
     const modeButtons=['original','reading','compare'].map((m,i)=>button(modes,['原文','译文','原译对照'][i],()=>setMode(m)));node.append(modes,select);
     node.append(actions);button(actions,'读所选段',()=>play({floor,index:+select.value}));button(actions,'连续朗读',()=>play({floor,index:+select.value,continuous:true,onPosition:i=>{select.value=String(i);}}));const translated=button(actions,'读此段译文',()=>play({floor,index:+select.value,side:'reading'}));button(actions,'停止',stop);button(actions,'继续声音',()=>active?.voice?.resume());button(actions,'镜译安装 / 设置',()=>setup?.open());button(actions,'重试核对',async()=>{await setup?.check();await source()?.refresh?.(floor);mountNative(true);});
     const info=top.document.createElement('p'),output=top.document.createElement('div');output.setAttribute('role','status');node.append(info,output);(mes.querySelector('.mes_text')||mes).after(node);e={scope,floor,node,select,modeButtons,translated,info,output,signature:'',bodyKey:''};native.set(mes,e);
    }
    const result=source()?.peek(floor),snapshot=result?.snapshot,data=result?.ok?project(snapshot):null,hasReading=!!data?.reading.available;
    const signature=JSON.stringify([row.mes,row.swipe_id,mode(),snapshot?.readingRevision,snapshot?.state,result?.ok,result?.message]);
    e.output.textContent=state.floor===floor?state.status:'';e.modeButtons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(mode()===['original','reading','compare'][i]));b.disabled=i>0&&!hasReading;});e.translated.disabled=!hasReading;
    const names={ready:'译文已就绪',partial:'部分段落已翻译',processing:'镜译处理中，暂用原文',stale:'正文已变化，旧译文已停用',failed:'镜译处理失败，可在镜译中重试',absent:'尚无译文'};
    e.info.textContent=!top.__JINGYI__?(setup?.read().message||'镜译尚未就绪，请打开安装 / 设置检查。'):!result?'正在核对原文…':!result.ok?result.message:(names[snapshot?.state]||'原文已核对')+(data?.reading.unmapped?' · 部分译文无法对应角色段落，朗读保留原文':'');
    if(signature!==e.signature){const selected=e.select.value;e.select.replaceChildren();paragraphs(floor).forEach((p,i)=>{const o=top.document.createElement('option');o.value=String(i);o.textContent=(i+1)+' · '+(p.kind==='thought'?'心声 ':p.speaker||'旁白')+' '+(p.sourceText||p.text).slice(0,42);e.select.append(o);});if([...e.select.options].some(o=>o.value===selected))e.select.value=selected;e.signature=signature;}
    const node=mes.querySelector('.mes_text'),c=ctx(),bodyKey=signature+'|'+Boolean(result?.ok);
    if(top.__JINGYI__&&c.messageFormatter?.addHook&&node&&!mes.querySelector('textarea')&&(force||e.bodyKey!==bodyKey)){
     const format=c.messageFormatter?.format?.bind(c.messageFormatter)||c.messageFormatting;if(format){const scroll=node.scrollTop;node.innerHTML=format(row.mes,row.name,false,false,floor);node.scrollTop=scroll;e.bodyKey=bodyKey;}
    }
    let voiceCursor=0;if(node&&!mes.querySelector('textarea'))for(const bubble of node.querySelectorAll('.bdc-cxx,.custom-bdc-cxx')){
     const old=bubble.querySelector('.cxx-inline-voice');if(old?.__cxxReadingSignature===signature){voiceCursor=Number(old.dataset.index)+1;continue;}old?.remove();const copy=bubble.cloneNode(true),label=copy.querySelector('.bda-speaker,.custom-bda-speaker'),who=label?.textContent.replace(/[：:]\s*$/,'')||'';copy.querySelectorAll('.bda-speaker,.custom-bda-speaker,.cxx-dialogue-mode,.custom-cxx-dialogue-mode').forEach(n=>n.remove());const parts=paragraphs(floor),index=matchParagraph(copy.textContent,who,bubble.classList.contains('bdc-thought')||bubble.classList.contains('custom-bdc-thought'),parts,voiceCursor);if(index<0)continue;voiceCursor=index+1;
     const b=top.document.createElement('button');b.className='cxx-inline-voice';b.type='button';b.dataset.cxxSlot='voice';b.dataset.index=String(index);b.__cxxReadingSignature=signature;b.innerHTML=MIC;b.title=b.getAttribute('aria-label')||'朗读'+(who||'此段')+(parts[index].kind==='thought'?'的心声':'的台词');b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(state.playing&&state.floor===floor&&state.index===index));const expected=row.mes,swipe=row.swipe_id;b.onclick=event=>{event.preventDefault();event.stopPropagation();if(runtime.key()!==scope||ctx().chat[floor]?.mes!==expected||ctx().chat[floor]?.swipe_id!==swipe){mountNative(true);return;}if(state.playing&&state.floor===floor&&state.index===index)stop();else void play({floor,index}).catch(e=>{error(e);if(!top.__JINGYI__)setup?.open();});};const name=bubble.querySelector('.bda-speaker,.custom-bda-speaker');if(name)name.after(b);else bubble.prepend(b);
    }
   }
  }
  async function readText({text,speaker}){if(!enabled())throw Error('本故事的镜译功能已关闭。');if(inCall())throw Error('请先挂断通话，再朗读历史记录。');stop();top.CxxVoice?.prepare();const controller=new AbortController(),request=active={controller,scope:runtime.key(),release:top.CxxRadio?.suspend?.()};try{const cap=await bridge.refresh();if(active!==request)return;if(!cap.read)throw Error(cap.readReason||'请在镜译中启用并配置楼层朗读。');bridge.stopAll?.();const options={text,speaker,signal:controller.signal,lang:settings().readLanguage||''};if(top.CxxVoice&&bridge.renderSpeech){const rendered=await bridge.renderSpeech(options);await rendered.done;if(active!==request)return;request.voice=await top.CxxVoice.play(await rendered.blob(),{scope:runtime.key(),kind:'history'},controller.signal);}else request.voice=await bridge.speak(options);if(active!==request)return;await request.voice.done;}finally{if(active===request)stop();}}
  const service={play,readText,stop,setMode,mode,project,setup:()=>setup?.open(),displayRaw:snapshot=>snapshot?Projection.displayRaw(snapshot,mode(),new Set(project(snapshot).paragraphs.flatMap(p=>p.segmentIds))):null,resume:()=>active?.voice?.resume(),paragraphs,read:()=>({...state,enabled:enabled(),mode:mode()}),refresh(){stop();runtime.scheduleMessages?.(null,true,'reading-mode');mountNative(true);notify();},subscribe(fn){listeners.add(fn);fn({...state,enabled:enabled(),mode:mode()});return()=>listeners.delete(fn);},start(){unwatch=runtime.watchMessages(batch=>{if(active&&(batch.reasons?.includes('scope')||ctx().chat[active.floor]?.mes!==active.raw||ctx().chat[active.floor]?.swipe_id!==active.swipe))stop();mountNative();});unsource=source()?.subscribe(({floor,reason})=>{if(active&&reason!=='ready'&&(floor==null||floor===active.floor))stop();mountNative();});unsetup=setup?.subscribe(()=>mountNative());void setup?.check();mountNative();return service;},destroy(){disposed=true;stop();unwatch?.();unsource?.();unsetup?.();for(const e of native.values())e.node.remove();top.document?.querySelectorAll?.('.cxx-inline-voice')?.forEach(n=>n.remove());sheet?.remove();native.clear();listeners.clear();}};return service;
 }
 return {create,matchParagraph,MIC};
});
