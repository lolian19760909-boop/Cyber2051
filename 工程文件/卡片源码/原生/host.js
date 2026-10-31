/* Character-local helper. Owns rendered DOM only; no message or variable setters. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxNativeHost=api;})(globalThis,function(){
  'use strict';
  function scope(context,owner){
    const id=context.getCurrentChatId?.();
    return !context.groupId&&owner&&context.characters?.[context.characterId]?.avatar===owner&&typeof id==='string'&&id?JSON.stringify([owner,id]):'';
  }
  function latest(context){
    for(let i=context.chat.length-1;i>=0;i--){const m=context.chat[i];if(m&&!m.is_user&&!m.is_system&&typeof m.mes==='string'&&m.mes.trim())return i;}
    return -1;
  }
  function mount({window:win,context,subscribe,prose,terminalFactory,css,notify,messageFeed}){
    const doc=win.document,owner=context().characters?.[context().characterId]?.avatar;
    if(!owner||context().groupId)return {destroy(){}};
    let destroyed=false,current='',chat=null,style=null,timer=null,activeSource=null;
    const surfaces=new Map(),statusStates=new Map(),frames=new Map(),disposers=[];
    const terminal=terminalFactory.create({document:doc,onClose(){activeSource=null;}});
    const observer=messageFeed?null:new win.MutationObserver(schedule);
    function validFrame(frame){
      if(!frame||frame.ownerDocument!==doc||(!chat?.contains(frame)&&!frame.matches?.('[data-cxx-component]')))return null;
      const message=frame.closest('.mes'),id=Number(message?.getAttribute('mesid')??frame.dataset.cxxFloor),c=context(),source=c.chat[id];
      if(!Number.isInteger(id)||!source||source.is_user||source.is_system)return null;
      if(frame.dataset.cxxComponent&&Number(frame.dataset.cxxSwipe)!==(source.swipe_id||0))return null;
      try{return {frame,id,source,swipe:source.swipe_id,api:frame.contentWindow?.CxxNativeStatus};}catch(_){return null;}
    }
    function statusReady(frame){
      const item=validFrame(frame);if(!item?.api||frames.get(frame)===item.api)return;
      frames.set(frame,item.api);
      const saved=statusStates.get(item.id);
      if(saved?.source===item.source&&saved.swipe===item.swipe)item.api.restore(saved.state);
    }
    function saveStatus(event){
      if(!current||current!==scope(context(),owner))return;
      const item=validFrame(event.detail?.frame);if(!item?.api)return;
      statusStates.set(item.id,{source:item.source,swipe:item.swipe,state:item.api.snapshot()});
    }
    function readyStatus(event){if(current&&current===scope(context(),owner))statusReady(event.detail?.frame);}
    function closeTerminal(){terminal.close();activeSource=null;}
    function clearArt(entry){entry.art?.remove();entry.artDialog?.close();entry.artDialog?.remove();for(const dispose of entry.artDisposers||[])dispose();entry.artDisposers=[];entry.art=null;entry.artDialog=null;entry.artKey='';}
    function renderArt(entry,node,source,id){
      const pictures=win.CxxPlot?.illustrationsAt?.(source,id)||[],key=JSON.stringify(pictures.map(p=>[p.id,p.url,p.source]));
      if(entry.artKey===key&&(!pictures.length||entry.art?.isConnected))return;
      clearArt(entry);entry.artKey=key;if(!pictures.length)return;
      const art=entry.art=doc.createElement('section');art.className='cxx-story-illustrations';art.dataset.cxxStoryStyle='figure';art.setAttribute('aria-label','本轮剧情插图');
      for(const picture of pictures){
        const figure=doc.createElement('figure'),button=doc.createElement('button'),img=doc.createElement('img'),caption=doc.createElement('figcaption');
        figure.className='cxx-story-figure';figure.dataset.cxxStoryCg=picture.id;figure.hidden=true;
        button.type='button';button.className='cxx-story-figure-open';button.setAttribute('aria-label','查看剧情插图：'+(picture.caption||picture.lineTitle));img.alt=picture.caption||picture.lineTitle;img.decoding='async';caption.textContent=picture.caption||'';
        let lease=null,ended=false;
        const show=()=>{if(!ended){figure.hidden=false;figure.setAttribute('data-ready','1');}},failed=()=>{if(!ended){figure.hidden=false;img.hidden=true;caption.textContent='图片暂不可用，解锁记录仍保留。';if(!caption.isConnected)figure.append(caption);}};
        img.onload=()=>{Promise.resolve(img.decode?.()).then(show,show);};img.onerror=failed;
        (entry.artDisposers||(entry.artDisposers=[])).push(()=>{ended=true;img.onload=null;img.onerror=null;lease?.release();lease=null;});
        Promise.resolve().then(()=>win.CxxResources?.acquire?win.CxxResources.acquire(picture.url):{url:win.CxxResources?.source(picture.url)||picture.url,release(){}}).then(value=>{if(ended){value.release();return;}lease=value;img.src=value.url;},failed);
        button.onclick=()=>{
          if(!img.src||img.hidden)return;
          entry.artDialog?.close();entry.artDialog?.remove();
          const dialog=entry.artDialog=doc.createElement('dialog'),large=doc.createElement('img'),close=doc.createElement('button');dialog.className='cxx-story-viewer';dialog.setAttribute('aria-label',img.alt);large.src=img.src;large.alt=img.alt;close.type='button';close.className='cxx-story-viewer-close';close.textContent='关闭';close.onclick=()=>dialog.close();
          dialog.addEventListener('click',event=>{if(event.target===dialog||event.target===large)dialog.close();});
          dialog.addEventListener('close',()=>{dialog.remove();if(entry.artDialog===dialog)entry.artDialog=null;if(button.isConnected)button.focus();},{once:true});dialog.append(close,large);doc.body.append(dialog);dialog.showModal();close.focus();
        };
        button.append(img);figure.append(button);if(picture.caption)figure.append(caption);art.append(figure);
      }
      node.after(art);
    }
    function clear(){
      observer?.disconnect();closeTerminal();
      for(const [node,entry] of surfaces){clearArt(entry);entry.api.destroy();if(!entry.hadClass)node.classList.remove('cxx-native-prose');}
      surfaces.clear();statusStates.clear();frames.clear();style?.remove();style=null;chat=null;
    }
    function renderText(text,id){
      const c=context(),formatter=c.messageFormatter;
      const format=typeof formatter?.format==='function'?formatter.format.bind(formatter):typeof c.messageFormatting==='function'?c.messageFormatting.bind(c):null;
      if(!format)return text;
      // The host returns sanitized display HTML. The detached template never enters the page.
      const template=doc.createElement('template');
      template.innerHTML=format(text,c.characters[c.characterId]?.name||'',false,false,id);
      for(const node of template.content.querySelectorAll('style,script'))node.remove();
      return template.content.textContent;
    }
    function refresh(batch){
      if(destroyed)return;
      const c=context(),next=scope(c,owner),element=doc.getElementById('chat');
      if(next!==current||element!==chat){clear();current=next;if(!next||!element)return;
        chat=element;style=doc.createElement('style');style.id='cxx-native-reading-style';style.textContent=css;doc.head.append(style);
        observer?.observe(chat,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['mesid','swipeid']});
        batch=null;
      }
      if(!current||!chat)return;
      // Shared terminal data follows this chat independently of its launching floor.
      const messages=batch&&!batch.full?batch.floors.map(id=>chat.querySelector('.mes[mesid="'+id+'"]')).filter(Boolean):chat.querySelectorAll('.mes');
      for(const message of messages){
        const id=Number(message.getAttribute('mesid')),source=c.chat[id];
        if(!Number.isInteger(id)||!source||source.is_user||source.is_system)continue;
        const node=message.querySelector('.mes_text');if(!node)continue;
        let entry=surfaces.get(node);
        if(entry&&(entry.source!==source||entry.swipe!==source.swipe_id)){clearArt(entry);entry.api.destroy();if(!entry.hadClass)node.classList.remove('cxx-native-prose');surfaces.delete(node);entry=null;}
        if(!entry){
          const hadClass=node.classList.contains('cxx-native-prose');node.classList.add('cxx-native-prose');
          entry={source,swipe:source.swipe_id,hadClass,api:prose.mount(node,{raw:()=>source.mes,renderText:text=>renderText(text,id)})};surfaces.set(node,entry);
        }else entry.api.refresh();
        renderArt(entry,node,source,id);
        for(const frame of [...message.querySelectorAll('iframe'),...doc.querySelectorAll('[data-cxx-component][data-cxx-floor="'+id+'"]')])statusReady(frame);
      }
      for(const [node,entry] of surfaces)if(!chat.contains(node)){clearArt(entry);entry.api.destroy();if(!entry.hadClass)node.classList.remove('cxx-native-prose');surfaces.delete(node);}
      for(const frame of frames.keys())if(!frame.isConnected)frames.delete(frame);
      for(const [id,saved] of statusStates)if(c.chat[id]!==saved.source||c.chat[id]?.swipe_id!==saved.swipe)statusStates.delete(id);
    }
    function schedule(){if(!destroyed&&timer===null)timer=win.setTimeout(()=>{timer=null;refresh();},60);}
    function openTerminal(event){
      const c=context();
      if(event.defaultPrevented||destroyed||!current||current!==scope(c,owner)||doc.body.getAttribute('data-cxx-gal-active')==='1')return;
      const item=validFrame(event.detail?.frame);if(!item)return;
      try{if(!item.frame.contentDocument?.getElementById('t2051x-fab'))return;}catch(_){return;}
      event.preventDefault();
      if(item.id!==latest(c)){notify('请从最新回复打开终端，以便读取当前进度。');return;}
      try{terminal.open({messageId:item.id});activeSource={...item,raw:item.source.mes};}catch(error){notify(error.message);}
    }
    function openDiagnostics(event){if(!current||current!==scope(context(),owner)||!validFrame(event.detail?.frame))return;if(typeof win.CxxDiagnostics?.open!=='function'){notify('诊断服务正在加载，请稍后再试。');return;}win.CxxDiagnostics.open();}
    for(const [event,handler] of [['cxx:open-native-diagnostics',openDiagnostics],['cxx:open-native-terminal',openTerminal],['cxx:native-status-ready',readyStatus],['cxx:native-status-change',saveStatus],['cxx:native-suspend',closeTerminal]]){
      doc.addEventListener(event,handler);disposers.push(()=>doc.removeEventListener(event,handler));
    }
    const events=context().eventTypes||{};
    if(messageFeed)disposers.push(messageFeed(refresh));
    else for(const name of ['CHAT_CHANGED','MESSAGE_RECEIVED','MESSAGE_SWIPED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_UPDATED','CHARACTER_MESSAGE_RENDERED']){
      if(events[name])disposers.push(subscribe(events[name],name==='CHAT_CHANGED'?refresh:schedule));
    }
    refresh();
    return {refresh,close:closeTerminal,destroy(){if(destroyed)return;destroyed=true;if(timer!==null)win.clearTimeout(timer);disposers.splice(0).forEach(fn=>fn());clear();current='';terminal.destroy();}};
  }
  return {mount,scope,latest};
});
