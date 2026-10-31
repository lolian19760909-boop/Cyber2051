/* The one shared bridge. Model text is data, never executable HTML. */
(function (root, factory) {
  if(typeof module==='object'&&module.exports)module.exports={create:factory};
  else {
    root.parent.Cxx233Runtime?.destroy();
    const service=factory(root);
    root.initializeGlobal('Cxx233Runtime',service);
    root.addEventListener('pagehide',service.destroy,{once:true});
  }
})(globalThis,function(api){
  'use strict';
  const top=api.parent||api,owner=api.SillyTavern?.getContext().characters?.[api.SillyTavern?.getContext().characterId]?.avatar;
  let currentAvatar='';
  let alive=true,personaRevision=0;const children=new Set(),modules=new Map();
  const worldbookEditor=api.CxxWorldbookEditor?.acquire(top);
  function persona(){const c=api.SillyTavern.getContext(),avatar=top.document?.querySelector('#user_avatar_block .avatar-container.selected')?.getAttribute('data-avatar-id')||currentAvatar;return {name:String(c.chatMetadata?.__cxx_story_profile?.name||c.name1||''),description:c.chatMetadata?.__cxx_story_profile&&api.CxxStoryProfile?api.CxxStoryProfile.description(c.chatMetadata.__cxx_story_profile):String(c.powerUserSettings?.persona_description||''),avatar:avatar&&c.getThumbnailUrl?c.getThumbnailUrl('persona',avatar):'',revision:personaRevision};}
  const shortcutStyle=top.document?.createElement('style');
  if(shortcutStyle){
    shortcutStyle.id='cxx-shortcut-layout';
    const ids=['07d0d1a7-897e-4a2d-adb4-e95d360e6ba2','cf33c692-7a41-444d-b8b7-6a70163e0104','cxx-business-core-241','9a9d6e73-5111-4c64-89c7-98717bbbdf3b','cxx-native-ui-231','cxx-galgame-g1-local','cxx-phone-v1'];
    shortcutStyle.textContent=ids.map(id=>'#script_container_'+id).join(',')+'{display:none!important}';
    top.document.head.append(shortcutStyle);
  }
  const readers=new Set(),feedListeners=[],dirty=new Set(),reasons=new Set();let revision=0;
  let snapshotScope='',snapshotChat=null,snapshotRows=[],snapshotThrough=-1,snapshotScans=0;
  const emptySnapshot={};
  function invalidateSnapshots(floor=0){snapshotThrough=Math.min(snapshotThrough,Math.max(0,floor)-1);snapshotRows.length=Math.max(0,snapshotThrough+1);}
  let feedTimer=null,feedObserver=null,rootObserver=null,feedChat=null,feedScope='',full=true;
  const scheduleTimeout=api.setTimeout?.bind(api)||setTimeout,cancelTimeout=api.clearTimeout?.bind(api)||clearTimeout;
  function flushMessages(){
    feedTimer=null;if(!alive||!readers.size)return;
    const scope=key(),chat=top.document?.getElementById('chat');
    if(scope!==feedScope||chat!==feedChat){full=true;api.CxxGalParser?.clearCache();feedScope=scope;feedChat=chat;feedObserver?.disconnect();if(chat)feedObserver?.observe(chat,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','style','class','mesid','swipeid','is_system']});}
    const batch={scope,full,floors:[...dirty],reasons:[...reasons],revision};full=false;dirty.clear();reasons.clear();
    for(const reader of [...readers])try{reader(batch);}catch(error){console.error('[正文刷新]',error);}
  }
  function scheduleMessages(id,all=false,reason='mount'){full=full||all;reasons.add(reason);if(reason==='data'||reason==='scope'){revision++;invalidateSnapshots(all?0:Number.isInteger(id)?id:0);}if(Number.isInteger(id)&&id>=0)dirty.add(id);if(feedTimer===null)feedTimer=scheduleTimeout(flushMessages,120);}
  function stopMessages(){cancelTimeout(feedTimer);feedTimer=null;feedObserver?.disconnect();rootObserver?.disconnect();rootObserver=null;feedObserver=null;feedChat=null;feedScope='';full=true;dirty.clear();reasons.clear();invalidateSnapshots();feedListeners.splice(0).forEach(stop=>stop());}
  function watchMessages(reader){
    readers.add(reader);
    if(readers.size===1){
      const events=api.SillyTavern.getContext().eventTypes||{};
      for(const name of ['PERSONA_CHANGED','PERSONA_UPDATED','PERSONA_RENAMED'])if(events[name]){const fn=avatar=>{if(name==='PERSONA_CHANGED'&&typeof avatar==='string')currentAvatar=avatar;personaRevision++;api.CxxGalParser?.clearCache();scheduleMessages(null,true,'persona');top.dispatchEvent(new top.CustomEvent('cxx-persona-changed'));};api.eventOn(events[name],fn);feedListeners.push(()=>api.eventRemoveListener(events[name],fn));}
      for(const name of ['CHAT_CHANGED','MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_EDITED','MESSAGE_DELETED','CHARACTER_MESSAGE_RENDERED','STREAM_TOKEN_RECEIVED','GENERATION_ENDED','GENERATION_STOPPED'])if(events[name]){
        const fn=id=>{scheduleMessages(Number.isInteger(id)?id:api.SillyTavern.getContext().chat.length-1,name==='CHAT_CHANGED'||name==='MESSAGE_DELETED',name==='CHAT_CHANGED'?'scope':name==='CHARACTER_MESSAGE_RENDERED'?'mount':'data');if(['CHAT_CHANGED','GENERATION_ENDED','GENERATION_STOPPED'].includes(name)){cancelTimeout(feedTimer);flushMessages();}};
        api.eventOn(events[name],fn);feedListeners.push(()=>api.eventRemoveListener(events[name],fn));
      }
      const variablesChanged=()=>scheduleMessages(api.SillyTavern.getContext().chat.length-1,false,'data');
      for(const name of ['mag_variable_initialized','mag_variable_update_ended']){api.eventOn(name,variablesChanged);feedListeners.push(()=>api.eventRemoveListener(name,variablesChanged));}
      if(top.MutationObserver)feedObserver=new top.MutationObserver(records=>{
        for(const record of records){
          const target=record.target.nodeType===1?record.target:record.target.parentElement;
          if(record.type==='attributes'&&!target?.matches?.('.mes'))continue;
          if(target?.closest('[data-cxx-slot],.cxx-native-aux,.cxx-native-speaker'))continue;
          const changed=[...record.addedNodes||[],...record.removedNodes||[]];
          if(changed.length&&changed.every(n=>n.nodeType===1&&n.matches?.('iframe[data-cxx-component],.cxx-native-aux,.cxx-native-speaker')))continue;
          const floor=target?.closest('.mes');
          if(floor)scheduleMessages(Number(floor.getAttribute('mesid')),false,record.type==='attributes'&&record.attributeName==='is_system'?'data':'mount');
          else for(const node of changed)if(node.nodeType===1){for(const m of [node,...node.querySelectorAll?.('.mes')||[]])if(m.matches?.('.mes'))scheduleMessages(Number(m.getAttribute('mesid')));}
        }
      });
      if(top.MutationObserver){
        // Only inspect added/removed subtrees for the chat root; card mutations do not refresh history.
        rootObserver=new top.MutationObserver(records=>{if(records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.id==='chat'||n.querySelector?.('#chat')))))scheduleMessages(null,true);});
        rootObserver.observe(top.document.body,{childList:true,subtree:true});
      }
    }
    scheduleMessages(null,true);
    return ()=>{readers.delete(reader);if(!readers.size)stopMessages();};
  }
  function key(){const c=api.SillyTavern.getContext(),id=c.getCurrentChatId?.();return alive&&!c.groupId&&owner===c.characters?.[c.characterId]?.avatar&&id?JSON.stringify([owner,id]):'';}
  function register(name,value,dispose,dependencies=[]){
    modules.get(name)?.destroy();
    let active=true;
    const entry={value,dependencies,destroy(){if(!active)return;active=false;for(const [other,dependent]of [...modules])if(other!==name&&dependent.dependencies.includes(name))dependent.destroy();dispose?.();if(modules.get(name)===entry)modules.delete(name);if(top[name]===value)delete top[name];}};
    modules.set(name,entry);api.initializeGlobal(name,value);top.CxxDiagnostics?.module(name,'已就绪');return entry.destroy;
  }
  function bridge(child){
    if(!alive)throw Error('共享运行时已停止，请重新加载角色卡脚本。');
    const listeners=[],frame=child.frameElement;top.CxxDiagnostics?.capture(child,frame?.dataset?.cxxComponent||'内嵌界面');
    const names=['SillyTavern','_','Mvu','builtin','tavern_events','iframe_events','eventEmit','getLastMessageId','getChatMessages','setChatMessages','getWorldbook','getWorldbookNames','getCharWorldbookNames','createWorldbook','replaceWorldbook','updateWorldbookWith','getScriptTrees','getCurrentCharPrimaryLorebook','getLorebookEntries','getCurrentCharacter','getButtonEvent','insertOrAssignVariables','updateVariablesWith','replaceVariables','generate','generateRaw','injectPrompts','triggerSlash'];
    for(const name of names)if(api[name]!==undefined)Object.defineProperty(child,name,{configurable:true,get:()=>api[name]});
    if(frame?.dataset.cxxOpening!==undefined){
      const expected=key();
      const assertOpening=()=>{if(!alive||key()!==expected||!frame.isConnected||api.SillyTavern.getContext().chat.some(m=>m.is_user))throw Error('开场已结束或聊天已切换，请从当前聊天继续。');};
      for(const name of ['setChatMessages','triggerSlash'])if(typeof api[name]==='function')Object.defineProperty(child,name,{configurable:true,value:(...args)=>{assertOpening();if(name==='setChatMessages'&&top.__cxx_player__)return top.__cxx_player__.setOpeningMessages(...args);if(name==='triggerSlash'&&top.__cxx_player__&&/^\s*\/send\b/.test(args[0]||''))return top.__cxx_player__.requestSend(()=>api[name](...args));return api[name](...args);}});
    }
    child.getCurrentMessageId=()=>Number(frame.dataset.cxxFloor);
    child.getPlayerPersona=persona;
    child.getVariables=(options={})=>api.getVariables(options.type==='message'&&options.message_id===undefined?{...options,message_id:child.getCurrentMessageId()}:options);
    child.getStatusSnapshot=()=>statusSnapshot(child.getCurrentMessageId());
    child.getAllVariables=()=>{
      const c=api.SillyTavern.getContext(),floor=child.getCurrentMessageId();
      return api._.cloneDeep(Object.assign({},...['global','character','chat'].map(type=>api.getVariables({type})),...c.chat.slice(0,floor+1).map(m=>m.variables?.[m.swipe_id||0]||{})));
    };
    child.eventOn=(name,handler)=>{api.eventOn(name,handler);listeners.push([name,handler]);return {stop:()=>child.eventRemoveListener(name,handler)};};
    child.eventRemoveListener=(name,handler)=>{api.eventRemoveListener(name,handler);const i=listeners.findIndex(x=>x[0]===name&&x[1]===handler);if(i>=0)listeners.splice(i,1);};
    const visibilityStops=[];
    child.watchVisibleInterval=(fn,ms)=>{
      let timer=null;const update=()=>{const shown=!child.document.hidden&&child.Cxx236Motion?.tier!=='paused';if(shown&&timer===null)timer=child.setInterval(fn,ms);else if(!shown&&timer!==null){child.clearInterval(timer);timer=null;}};
      child.addEventListener('cxx-effects-change',update);update();const stop=()=>{if(timer!==null)child.clearInterval(timer);timer=null;child.removeEventListener('cxx-effects-change',update);};visibilityStops.push(stop);return stop;
    };
    const panelFocus=()=>top.dispatchEvent(new top.Event('cxx-panel-focus'));child.document.addEventListener('focusin',panelFocus);child.document.addEventListener('focusout',panelFocus);
    let resize=null,resizeTick=null;const motion=top.Cxx236Effects?.attach(child);top.CxxTheme?.attach(child);
    const resizeFrame=()=>{
      resizeTick=null;
      if(!active||frame.dataset.cxxAutoHeight!=='1'||frame.hasAttribute('data-cxx-gal-status')||frame.hasAttribute('data-cxx-gal-opening')||!frame.isConnected||frame.getBoundingClientRect().width<1)return;
      const height=Math.ceil(child.document.body?.scrollHeight||0);
      if(height>0&&frame.dataset.cxxOpening!==undefined&&frame.__cxxResize){frame.__cxxResize(height);return;}
      if(height>0&&Math.abs((parseFloat(frame.style.height)||0)-height)>=2){frame.style.height=height+'px';frame.__cxxResize?.(height);}
    };
    const scheduleResize=()=>{if(resizeTick===null)resizeTick=child.requestAnimationFrame(resizeFrame);};
    const ready=()=>{if(frame.dataset.cxxOpening!==undefined&&top.__cxx_player__)visibilityStops.push(top.__cxx_player__.mountSaveStatus(child.document));if(frame.dataset.cxxAutoHeight==='1'){
      // A nested scrollbar changes the grid width, then changes the measured height again.
      const style=child.document.createElement('style');style.textContent=(frame.dataset.cxxOpening!==undefined?'html{overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain}':'html{overflow:hidden!important}')+'body{min-height:0!important;height:auto!important}';child.document.head.append(style);
      if(child.ResizeObserver){resize=new child.ResizeObserver(scheduleResize);resize.observe(child.document.body);}
      child.addEventListener('resize',scheduleResize);scheduleResize();
    }};
    let active=true;
    function destroy(){if(!active)return;active=false;visibilityStops.forEach(stop=>stop());child.document.removeEventListener('focusin',panelFocus);child.document.removeEventListener('focusout',panelFocus);resize?.disconnect();if(resizeTick!==null)child.cancelAnimationFrame(resizeTick);child.removeEventListener('resize',scheduleResize);motion?.destroy();listeners.splice(0).forEach(([name,handler])=>api.eventRemoveListener(name,handler));children.delete(destroy);child.removeEventListener('pagehide',destroy);child.document.removeEventListener('DOMContentLoaded',ready);}
    child.document.addEventListener('DOMContentLoaded',ready,{once:true});child.addEventListener('pagehide',destroy,{once:true});children.add(destroy);
    frame.__cxxBridgeDispose=destroy;
    return destroy;
  }
  function frameHTML(html){const base=String(top.location?.href||'/').replaceAll('&','&amp;').replaceAll('"','&quot;');return html.replace(/<head\b[^>]*>/i,match=>match+'<base href="'+base+'"><script>parent.Cxx233Runtime.bridge(window);<\/script>');}
  function liveStat236(){const s=(typeof globalThis!=='undefined'&&globalThis.Cxx236State)||(typeof top!=='undefined'&&top&&top.Cxx236State);if(!s||typeof s.stat!=='function')return null;try{const v=s.stat();return v&&v.terminal?v:null;}catch(e){return null;}}
  function statusSnapshot(floor){
    const chat=api.SillyTavern.getContext().chat,scope=key();
    if(snapshotScope!==scope||snapshotChat!==chat){snapshotScope=scope;snapshotChat=chat;invalidateSnapshots();}
    if(chat.length<=snapshotThrough)invalidateSnapshots(chat.length);
    const end=Math.min(Math.floor(floor),chat.length-1);if(end<0||!Number.isFinite(end))return emptySnapshot;
    const own=chat[end],direct=own?.variables?.[own.swipe_id||0];snapshotScans++;if(direct?.stat_data)return direct;
    for(let i=snapshotThrough+1;i<=end;i++){const row=chat[i],value=row?.variables?.[row.swipe_id||0];snapshotRows[i]=value?.stat_data?i:(snapshotRows[i-1]??-1);snapshotScans++;}
    snapshotThrough=Math.max(snapshotThrough,end);const source=snapshotRows[end];
    if(source<0){const live=liveStat236();return live?{stat_data:live}:emptySnapshot;}const row=chat[source],value=row?.variables?.[row.swipe_id||0];
    if(value?.stat_data)return value;invalidateSnapshots(source);return statusSnapshot(end);
  }
  function setDocument(frame,html){releaseFrame(frame);const url=top.URL.createObjectURL(new top.Blob([frameHTML(html)],{type:'text/html'}));frame.__cxxBlob=url;frame.src=url;}
  function releaseFrame(frame){if(frame.__cxxShadowDispose){const stop=frame.__cxxShadowDispose;delete frame.__cxxShadowDispose;stop();}if(frame.__cxxBlob){try{frame.contentWindow?.dispatchEvent(new frame.contentWindow.PageTransitionEvent('pagehide',{persisted:false}));}catch{}}frame.__cxxBridgeDispose?.();delete frame.__cxxBridgeDispose;if(frame.__cxxBlob){top.URL.revokeObjectURL(frame.__cxxBlob);delete frame.__cxxBlob;}}
  function destroy(){if(!alive)return;alive=false;shortcutStyle?.remove();stopMessages();readers.clear();api.CxxGalParser?.clearCache();for(const entry of [...modules.values()])entry.destroy();for(const dispose of [...children])dispose();worldbookEditor?.release();if(top.Cxx233Runtime===service)delete top.Cxx233Runtime;}
  const invokeScriptButton=async name=>{const buttons=api.getAllEnabledScriptButtons?.()||{};const found=Object.values(buttons).flat().find(b=>b.button_name===name);if(!found)throw Error(name+'服务正在加载。');return api.eventEmit(found.button_id);};
  const service={invokeScriptButton,parser:api.CxxGalParser,version:'234',get alive(){return alive;},owner,key,persona,register,bridge,frameHTML,setDocument,releaseFrame,watchMessages,statusSnapshot,invalidateSnapshots,scheduleMessages,read:()=>({revision,snapshotScans,snapshotThrough,readers:readers.size}),destroy};
  if(api.CxxMirrorSource){const source=api.CxxMirrorSource.create({api,top,runtime:service});register('CxxSource',source,()=>source.destroy());source.start();}
  if(api.CxxGrowthRepair){const repair=api.CxxGrowthRepair.create({api,top,runtime:service});register('CxxGrowthRepair',repair,()=>repair.destroy());}
  if(api.CxxVariableMode){const modes=api.CxxVariableMode.create({api,top});register('CxxVariableMode',modes,()=>modes.destroy());modes.start();}
  if(api.CxxReroll){const reroll=api.CxxReroll.create({api,top,runtime:service});register('CxxReroll',reroll,()=>reroll.destroy());reroll.start();}
  return service;
});
