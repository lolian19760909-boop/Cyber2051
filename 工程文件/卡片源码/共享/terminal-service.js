(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.Cxx233TerminalFactory={create:factory};})(globalThis,function(options){
  'use strict';
  const {window:win,api,runtime,html}=options;
  const doc=win.document;let frame=null,scope='',active=null,disposed=false,ready=false,timer=null,refreshTimer=null,latest='',hiding=false,deadline=0,innerObserver=null,mailOff=null;
  const shortcut={},topics=new Set(),windowListeners=[];let routeOff=null;
  const listeners=new Set(),counts={created:0,loads:0,updates:0};
  function mobile(){return win.Cxx236Preferences?.read?.().device==='mobile'||win.matchMedia?.('(pointer:coarse)').matches;}
  function orientation(){try{return win.sessionStorage.getItem('cxx-terminal-layout:'+scope)==='landscape'?'landscape':'portrait';}catch{return 'portrait';}}
  function popoverOpen(){try{return !!frame?.matches(':popover-open');}catch{return false;}}
  function placeNative(){
    // Size the host layer from the visible viewport, as Gal already does. Mobile
    // WebViews need no popover support; the iframe remains a fixed host overlay.
    const vv=win.visualViewport,off=[];let raf=null;
    frame.removeAttribute('popover');
    frame.style.cssText='position:fixed!important;display:block!important;inset:auto!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;padding:0!important;box-sizing:border-box!important;transform:none!important;clip-path:none!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;background:#08080b!important;z-index:2147483647!important';
    function measure(){raf=null;if(!frame||!active)return;const left=vv?.offsetLeft||0,top=vv?.offsetTop||0,w=vv?.width||win.innerWidth,h=vv?.height||win.innerHeight,rotate=mobile()&&(orientation()==='landscape'?h>w:w>h),values={left:(left+(rotate?w:0))+'px',top:top+'px',width:(rotate?h:w)+'px',height:(rotate?w:h)+'px',transform:rotate?'rotate(90deg)':'none','transform-origin':'top left'};for(const [key,value]of Object.entries(values))if(frame.style.getPropertyValue(key)!==value)frame.style.setProperty(key,value,'important');
      // ST applies transform/perspective to <html>. Its scrolled origin can
      // also move fixed children; align the measured overlay to the viewport.
      const rect=frame.getBoundingClientRect();if(rect.left!==left)frame.style.setProperty('left',(parseFloat(frame.style.left)+left-rect.left)+'px','important');if(rect.top!==top)frame.style.setProperty('top',(top+top-rect.top)+'px','important');
    }
    function schedule(){if(raf===null)raf=win.requestAnimationFrame(measure);}
    measure();
    if(!mobile()&&typeof frame.showPopover==='function'){frame.setAttribute('popover','manual');try{frame.showPopover();}catch{frame.removeAttribute('popover');}measure();}
    for(const [target,name]of [[win,'resize'],[vv,'resize'],[vv,'scroll']])if(target){target.addEventListener(name,schedule,{passive:true});off.push(()=>target.removeEventListener(name,schedule));}
    return()=>{off.forEach(fn=>fn());if(raf!==null)win.cancelAnimationFrame(raf);if(popoverOpen())try{frame.hidePopover();}catch{}frame?.removeAttribute('popover');frame?.style.setProperty('display','none','important');};
  }
  function latestFloor(){const chat=api.SillyTavern.getContext().chat;for(let i=chat.length-1;i>=0;i--)if(!chat[i].is_user&&!chat[i].is_system)return i;return -1;}
  function notifyClose(){const old=active;active=null;routeOff?.();routeOff=null;old?.unplace?.();old?.routeBack?.();old?.onClose?.();}
  function hide(){if(!frame||hiding)return;hiding=true;win.clearTimeout(timer);timer=null;try{if(!frame.contentDocument?.getElementById('t2051x-terminal')?.hidden)frame.contentDocument?.getElementById('t2051x-close-terminal')?.click();if(popoverOpen())frame.hidePopover();}catch{}frame.hidden=true;notifyClose();frame.style.setProperty('display','none','important');hiding=false;}
  function clear(){mailOff?.();mailOff=null;win.clearTimeout(timer);timer=null;innerObserver?.disconnect();innerObserver=null;hide();if(frame){try{frame.contentWindow.CxxTerminalApp?.destroy();frame.contentWindow.TOKYO_TERMINAL_MAP_CONTROL?.destroy();}catch{}runtime.releaseFrame(frame);frame.remove();frame=null;}ready=false;latest='';}
  function sync(batch){
    if(disposed)return;
    const next=runtime.key();if(next!==scope){clear();scope=next;}
    if(!frame||!scope||!active)return;
    const c=api.SillyTavern.getContext();let floor=c.chat.length-1;while(floor>=0&&!c.chat[floor].variables?.[c.chat[floor].swipe_id||0]?.stat_data)floor--;if(floor<0)floor=latestFloor();const m=c.chat[floor];
    const signature={floor,swipe:m?.swipe_id,raw:m?.mes,variables:m?.variables?.[m?.swipe_id||0]};
    const dataChanged=batch?.reasons?.some(r=>r==='data'||r==='scope');
    frame.dataset.cxxFloor=String(floor);
    if(!latest||signature.floor!==latest.floor||signature.swipe!==latest.swipe||signature.raw!==latest.raw||signature.variables!==latest.variables||dataChanged){latest=signature;counts.updates++;if(ready){try{frame.contentWindow.CxxTerminalApp?.invalidate({topic:'data'});}catch{}}}
  }
  function showReady(){
    win.clearTimeout(timer);timer=null;if(!frame||!active||disposed||!runtime.key()||runtime.key()!==scope)return;
    const app=frame.contentWindow?.CxxTerminalApp,terminal=frame.contentDocument?.getElementById('t2051x-terminal');
    if(!app||!terminal){if(Date.now()<deadline)timer=win.setTimeout(showReady,40);else win.toastr?.warning('终端未能就绪，请重新打开终端。','终端');return;}
    const inner=frame.contentDocument,close=inner.getElementById('t2051x-close-terminal');let dock=inner.getElementById('cxx-terminal-comms');
    inner.documentElement.dataset.cxxEmbedded=active.embedded?'true':'false';
    if(active.embedded){ready=true;if(!active.opened){active.opened=true;routeOff?.();routeOff=app.subscribe?.(()=>{if(active?.embedded)active.onRoute?.(app.page);});app.open(active.route||{page:'characters'});}if(!innerObserver){innerObserver=new win.MutationObserver(()=>{if(active&&terminal.hidden)hide();});innerObserver.observe(terminal,{attributes:true,attributeFilter:['hidden']});}sync();return;}
    if(!dock&&close){dock=inner.createElement('nav');dock.id='cxx-terminal-comms';dock.setAttribute('aria-label','通讯与终端操作');close.before(dock);const b=(id,label,icon,fn)=>{const n=inner.createElement('button');n.id=id;n.type='button';n.setAttribute('aria-label',label);n.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+icon+'</svg>';const text=inner.createElement('span');text.textContent=label;n.append(text);n.onclick=fn;dock.append(n);return text;};
      b('cxx-terminal-phone','手机','<path d="M7 2h10v20H7zM10 18h4"/>',()=>{if(win.CxxPhone)win.CxxPhone.open();else win.toastr?.info('通讯器尚未就绪，请稍后重试。');});
      const mail=b('cxx-terminal-mail','邮件','<path d="M3 5h18v14H3zM3 5l9 8 9-8"/>',()=>win.CxxMailbox?.open());mailOff=win.CxxMailbox?.subscribe(s=>{mail.textContent='邮件'+(s.unread?' · '+s.unread:'');mail.parentElement.setAttribute('aria-label',s.unread?'邮件，'+s.unread+' 封未读':'邮件');mail.parentElement.title=mail.textContent;});dock.append(close);
    }
    if(close)close.textContent=active.onClose?'返回游戏菜单':'继续阅读';const brand=inner.querySelector('.brand');if(brand){for(const n of [brand,...brand.querySelectorAll('*')])for(const child of n.childNodes)if(child.nodeType===3&&/东京都|東京都/.test(child.textContent))child.textContent=child.textContent.replace(/东京都|東京都/g,'Tokyo');}
    if(brand&&!brand.dataset.artFailed&&!brand.querySelector('.cxx-terminal-wordmark')){const art=win.CxxMenuArt?.entries?.wordmark;if(art){const logo=inner.createElement('img');logo.className='cxx-terminal-wordmark';logo.alt='Tokyo 2051';logo.src=art.fallback||art.url;logo.style.cssText='display:block;width:132px;max-width:25vw;height:44px;object-fit:contain';logo.onerror=()=>{brand.dataset.artFailed='1';brand.textContent='Tokyo 2051';};brand.replaceChildren(logo);}}
    ready=true;let turn=frame.contentDocument.getElementById('cxx-terminal-orientation');if(!turn){turn=frame.contentDocument.createElement('button');turn.id='cxx-terminal-orientation';turn.type='button';const close=frame.contentDocument.getElementById('t2051x-close-terminal');close?.before(turn);turn.onclick=()=>{try{win.sessionStorage.setItem('cxx-terminal-layout:'+scope,orientation()==='landscape'?'portrait':'landscape');}catch{win.toastr?.warning('无法保存方向偏好，请检查浏览器存储。');return;}active?.unplace?.();if(active)active.unplace=placeNative();showReady();};}turn.hidden=!mobile();turn.textContent=orientation()==='landscape'?'竖屏':'横屏';turn.title=orientation()==='landscape'?'切换竖屏':'切换横屏';if(!active.opened){active.opened=true;app.open(active.route||{page:'city'});}
    if(!innerObserver){innerObserver=new win.MutationObserver(()=>{if(active&&terminal.hidden)hide();});innerObserver.observe(terminal,{attributes:true,attributeFilter:['hidden']});}sync();
  }
  function ensure(){
    if(frame)return;
    frame=doc.createElement('iframe');frame.id='cxx-shared-terminal-233';frame.title='东京都终端';frame.dataset.cxxFloor=String(latestFloor());frame.setAttribute('popover','manual');
    frame.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;border:0;padding:0;background:#08080b;z-index:2147483647';
    frame.addEventListener('load',()=>{counts.loads++;innerObserver?.disconnect();innerObserver=null;routeOff?.();routeOff=null;ready=false;if(active)active.opened=false;if(frame)showReady();});
    frame.addEventListener('toggle',event=>{if(event.newState==='closed'&&active&&frame.hasAttribute('popover')&&!popoverOpen())hide();});
    runtime.setDocument(frame,html);doc.body.append(frame);counts.created++;
  }
  function open(options){sync();if(!scope)throw Error('当前聊天尚未就绪。');if(options.messageId!==latestFloor())throw Error('请从最新回复打开终端。');if(options.embedded&&!options.container?.isConnected)throw Error('游戏菜单已关闭，请重新打开。');if(active?.consumer!==options.consumer)notifyClose();else {active?.unplace?.();active?.routeBack?.();}active={...options,opened:false};deadline=Date.now()+15000;ensure();frame.hidden=false;
    if(options.embedded){if(popoverOpen())frame.hidePopover();frame.removeAttribute('popover');if(frame.parentElement!==options.container)options.container.append(frame);frame.style.cssText='display:block;width:100%;height:100%;min-height:0;flex:1;border:0;background:transparent;';active.unplace=()=>frame?.contentWindow?.CxxTerminalApp?.saveView?.();}
    else{if(frame.parentElement!==doc.body)doc.body.append(frame);active.routeBack=win.__cxx_ui_layers__?.enter?.('terminal:'+options.route?.page,frame);active.unplace=!mobile()&&doc.body.getAttribute('data-cxx-gal-active')==='1'?win.CxxGalViewport?.place(frame,{belowHeader:false,rotate:false}):null;if(!active.unplace)active.unplace=placeNative();}win.clearTimeout(timer);showReady();return true;}
  function close(consumer){if(!consumer||active?.consumer===consumer)hide();}
  function captureReturn(){
    sync();const expected=scope,app=frame?.contentWindow?.CxxTerminalApp;
    app?.saveView?.();
    const saved=active?{consumer:active.consumer,onClose:active.onClose,embedded:active.embedded,container:active.container,onRoute:active.onRoute,route:{page:app?.page||active.route?.page||'city'}}:null;
    return()=>{if(disposed||!expected||runtime.key()!==expected)return false;
      // A page embedded in the game hub closes with the hub; reopen the hub on the same page.
      if(saved?.embedded&&!saved.container?.isConnected&&win.__cxx_launcher__?.navigate)return win.__cxx_launcher__.navigate(saved.route.page);
      return saved?open({...saved,messageId:latestFloor()}):open({messageId:latestFloor(),consumer:shortcut,route:{page:'city'}});};
  }
  function schedule(){if(refreshTimer!==null||disposed)return;refreshTimer=win.setTimeout(()=>{refreshTimer=null;sync();if(active&&ready&&topics.size){const requested=[...topics];topics.clear();frame.contentWindow.CxxTerminalApp?.invalidate({topic:requested.includes('news')?'news':requested.includes('content')?'content':'data'});}},40);}
  for(const [name,topic]of [['cxx-city-news-changed','news'],['cxx-content-changed','content'],['cxx-player-changed','data'],['cxx-ui-preferences-changed','preferences']]){const fn=()=>{topics.add(topic);schedule();};win.addEventListener(name,fn);windowListeners.push(()=>win.removeEventListener(name,fn));}

  const events=api.SillyTavern.getContext().eventTypes;
  const unwatch=runtime.watchMessages?.(sync);
  if(!unwatch)for(const name of ['CHAT_CHANGED','MESSAGE_RECEIVED','MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_EDITED','MESSAGE_DELETED'])if(events[name]){const fn=name==='CHAT_CHANGED'?sync:schedule;api.eventOn(events[name],fn);listeners.add([events[name],fn]);}
  function destroy(){if(disposed)return;disposed=true;windowListeners.forEach(off=>off());topics.clear();unwatch?.();win.clearTimeout(refreshTimer);refreshTimer=null;clear();for(const [name,fn]of listeners)api.eventRemoveListener(name,fn);listeners.clear();scope='';}
  return {open,openPage:(page='city',tab,options={})=>!options.embedded&&win.__cxx_launcher__?.navigate?win.__cxx_launcher__.navigate(page,tab):open({...options,messageId:latestFloor(),consumer:options.consumer||shortcut,route:{page,tab}}),close,captureReturn,sync,destroy,read:()=>({scope,ready,active:Boolean(active),...counts}),get frame(){return frame;}};
});
