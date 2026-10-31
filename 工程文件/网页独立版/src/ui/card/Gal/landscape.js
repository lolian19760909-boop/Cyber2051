/* Derived from 卡片源码/Gal/landscape.js; source SHA256 6ba6fe27fc7f313f19e32842dde324933f92261c877aa6b8614a46ec525b0cea. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxGalLandscape=api;
})(globalThis,function(){
  'use strict';
  function isMobile(win){const selected=win?.Cxx236Preferences?.read?.().device;if(selected==='mobile')return true;if(selected==='desktop')return false;return !!((win?.navigator?.maxTouchPoints||0)>0||win?.matchMedia?.('(pointer: coarse)')?.matches)&&Math.min(win?.innerWidth||0,win?.innerHeight||0)<900;}
  function geometry({width,height,left=0,top=0,rotated=false}){return {width,height,left,top,rotated,canvasWidth:rotated?height:width,canvasHeight:rotated?width:height};}
  function placement(v,{x=0,y=0,width=v.canvasWidth,height=v.canvasHeight-y}={}){
    return {left:(v.left+(v.rotated?v.width-y:x))+'px',top:(v.top+(v.rotated?x:y))+'px',width:width+'px',height:Math.max(1,height)+'px',transform:v.rotated?'rotate(90deg)':'none',transformOrigin:'0 0'};
  }
  function mount({document:doc,root,toolbar,before,onLayout}){
    const win=doc.defaultView,screen=win?.screen,html=doc.documentElement;
    let disposed=false,pending=false,owned=false,locked=false,requested=false,referenceHeight=0,lastLandscape=false,lastKeyboard=false,lockEpoch=0;
    const removers=[];
    const subscribers=new Set(),previousViewport=win.CxxGalViewport;
    let viewportValue=null,viewportSignature='',readingSignature='',measureTick=null,headerHeight=null;
    const header=root.querySelector('.cxx-gal-header');
    const setStyles=(node,values)=>{for(const [key,value]of Object.entries(values))if(node.style[key]!==value)node.style[key]=value;};
    const setVariable=(name,value)=>{if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value);};
    const setAttribute=(node,name,value)=>{if(node.getAttribute(name)!==value)node.setAttribute(name,value);};
    const viewport=doc.createElement('div');viewport.id='cxx-gal-visible-viewport';
    viewport.style.cssText='position:fixed;inset:auto;margin:0;padding:0;border:0;min-width:0;min-height:0;max-width:none;max-height:none;overflow:hidden;z-index:2147483000;background:#08080b;box-sizing:border-box';
    root.before(viewport);viewport.append(root);
    if(root.hasAttribute('popover')){try{root.hidePopover();}catch{}root.removeAttribute('popover');}
    const modeKey='cxx-gal-mobile-orientation-v1';let mode='auto';
    function readMode(){try{const saved=win.localStorage.getItem(modeKey);mode=['portrait','landscape'].includes(saved)?saved:'auto';}catch{}}
    readMode();
    const button=doc.createElement('button');button.type='button';button.className='cxx-gal-button cxx-gal-fullscreen';
    const note=doc.createElement('div');note.className='cxx-gal-screen-note';note.setAttribute('role','status');note.hidden=true;
    toolbar.insertBefore(button,before);root.append(note);
    const fullscreen=()=>doc.fullscreenElement||doc.webkitFullscreenElement;
    const listen=(target,event,fn)=>{if(!target?.addEventListener)return;target.addEventListener(event,fn);removers.push(()=>target.removeEventListener(event,fn));};
    function say(text){if(disposed)return;note.textContent=text;note.hidden=!text;}
    function restoreLayer(){
      if(win.__cxxStandaloneUI){viewport.removeAttribute("popover");return;}
      if(disposed||!root.isConnected)return;
      if(isMobile(win)){if(viewport.hasAttribute('popover')){try{viewport.hidePopover();}catch{}viewport.removeAttribute('popover');}return;}
      if(typeof viewport.showPopover==='function'){viewport.setAttribute('popover','manual');try{if(!viewport.matches(':popover-open'))viewport.showPopover();}catch{viewport.removeAttribute('popover');}}
    }
    function measure(){
      if(disposed||measureTick!==null)return;
      measureTick=win.requestAnimationFrame(flushMeasure);
    }
    function flushMeasure(){
      measureTick=null;
      if(disposed)return;
      const vv=win?.visualViewport,width=vv?.width||win.innerWidth,appHeader=0,height=win.innerHeight-appHeader;
      const visibleHeight=vv?.height?Math.max(1,vv.height-appHeader):height;
      const mobile=isMobile(win);
      let focused=doc.activeElement;try{if(focused?.tagName==='IFRAME')focused=focused.contentDocument?.activeElement;}catch{}
      const editing=!!focused?.matches?.('input,textarea,[contenteditable="true"]');
      const deviceLandscape=win.screen?.orientation?.type?win.screen.orientation.type.startsWith('landscape'):width>height;
      let landscape=mobile?(mode==='auto'?deviceLandscape:mode==='landscape'):width>height&&height<=600;
      if(!mobile&&editing&&referenceHeight)landscape=lastLandscape;
      if(!editing||!referenceHeight||landscape!==lastLandscape)referenceHeight=height;
      const keyboard=editing&&visibleHeight<referenceHeight*.75;
      // Explicit orientation stays stable while the visual viewport follows the keyboard.
      const rotated=mobile&&mode!=='auto'&&landscape!==deviceLandscape;
      const viewWidth=rotated?visibleHeight:width,viewHeight=rotated?width:visibleHeight;
      // Finish geometry reads before style writes. Header changes arrive through
      // ResizeObserver on the following layout, never a write/read loop here.
      const measuredHeader=headerHeight??header?.offsetHeight??0;
      lastLandscape=landscape;
      setAttribute(root,'data-mobile',mobile?'1':'0');setAttribute(root,'data-rotated',rotated?'1':'0');
      setAttribute(root,'data-landscape',landscape?'1':'0');setAttribute(root,'data-keyboard',keyboard?'1':'0');
      setAttribute(root,'data-compact',landscape&&!keyboard&&viewHeight<=520?'1':'0');
      setAttribute(root,'data-narrow',viewWidth<=620?'1':'0');
      const offset=(vv?.offsetTop||0)+appHeader;
      viewportValue=geometry({width,height:visibleHeight,left:vv?.offsetLeft||0,top:offset,rotated});
      setStyles(viewport,{left:viewportValue.left+'px',top:offset+'px',width:width+'px',height:visibleHeight+'px'});
      const local=placement({...viewportValue,left:0,top:0});
      setStyles(root,{position:'absolute',inset:'auto',left:local.left,top:local.top,width:viewWidth+'px',height:viewHeight+'px',maxWidth:'none',maxHeight:'none',boxSizing:'border-box',transform:local.transform,transformOrigin:'0 0'});
      setVariable('--cxx-gal-view-width',viewWidth+'px');setVariable('--cxx-gal-view-height',viewHeight+'px');
      setVariable('--cxx-gal-view-top',offset+'px');
      setVariable('--cxx-gal-reference-width',Math.round(Math.min(viewWidth,viewHeight*16/9))+'px');
      setVariable('--cxx-gal-reference-height',Math.round(Math.min(viewHeight,viewWidth*9/16))+'px');
      const label=mobile?(landscape?'切换竖屏':'切换横屏'):owned&&fullscreen()===html?'退出全屏':'全屏';
      if(button.textContent!==label)button.textContent=label;
      setAttribute(button,'aria-pressed',String(mobile?landscape:owned&&fullscreen()===html));
      setAttribute(button,'title',mobile?'切换横屏或竖屏阅读':'进入或退出全屏');
      if(landscape&&requested)say('');
      viewportValue.headerHeight=measuredHeader;
      const signature=JSON.stringify(viewportValue);if(signature!==viewportSignature){viewportSignature=signature;for(const fn of subscribers)fn(viewportValue);}
      const textGeometry=[viewWidth,viewHeight,measuredHeader,mobile,landscape,keyboard].join(':');
      if(textGeometry!==readingSignature){readingSignature=textGeometry;onLayout?.();}
      if(keyboard&&!lastKeyboard)doc.activeElement?.scrollIntoView?.({block:'nearest',inline:'nearest'});
      lastKeyboard=keyboard;
    }
    function unlock(){lockEpoch++;if(locked){try{screen.orientation.unlock();}catch{}locked=false;}}
    async function leave(){
      requested=false;unlock();
      if(owned&&fullscreen()===html){const exit=doc.exitFullscreen||doc.webkitExitFullscreen;try{await exit?.call(doc);}catch{say('暂时无法退出全屏，请使用浏览器的退出操作。');}}
      if(fullscreen()!==html)owned=false;
      restoreLayer();measure();
    }
    async function toggle(){
      if(disposed||pending)return;
      if(isMobile(win)){mode=lastLandscape?'portrait':'landscape';try{win.localStorage.setItem(modeKey,mode);win.dispatchEvent(new win.CustomEvent('cxx-orientation-changed',{detail:{mode}}));}catch{}say('');restoreLayer();measure();return;}
      if(owned&&fullscreen()===html){pending=true;try{await leave();}finally{pending=false;}return;}
      requested=true;pending=true;button.disabled=true;
      try{
        if(fullscreen()&&fullscreen()!==html){say('请先退出当前全屏，再进入 Gal 全屏。');return;}
        if(!fullscreen()){
          const request=html?.requestFullscreen||html?.webkitRequestFullscreen;
          if(!request){say('当前浏览器不支持网页全屏，可以继续使用当前窗口。');return;}
          // Fullscreen the host document so sibling terminal/dialog layers remain available.
          // The displayed Gal popover itself cannot be a fullscreen target.
          await request.call(html,{navigationUI:'hide'});owned=fullscreen()===html;
          if(disposed){await leave();return;}
        }
        restoreLayer();
        say('');measure();
      }catch{restoreLayer();say('无法进入全屏，可以继续使用当前窗口。');}
      finally{pending=false;if(!disposed){button.disabled=false;measure();}}
    }
    function changed(){
      if(owned&&fullscreen()!==html){owned=false;requested=false;unlock();say('');}
      restoreLayer();measure();
    }
    listen(button,'click',toggle);listen(doc,'fullscreenchange',changed);listen(doc,'webkitfullscreenchange',changed);
    listen(win,'resize',measure);listen(screen?.orientation,'change',measure);listen(win?.visualViewport,'resize',measure);listen(win?.visualViewport,'scroll',measure);
    listen(root,'focusin',measure);listen(root,'focusout',measure);
    listen(win,'cxx-panel-focus',measure);
    listen(win,'cxx-ui-preferences-changed',changed);listen(win,'cxx-orientation-changed',()=>{readMode();measure();});
    const headerObserver=win.ResizeObserver?new win.ResizeObserver(entries=>{const entry=entries.find(item=>item.target===header);if(entry){const box=entry.borderBoxSize?.[0]||entry.borderBoxSize;headerHeight=box?.blockSize??header.offsetHeight;}measure();}):null;if(header)headerObserver?.observe(header);
    const service={read:()=>viewportValue,measure,subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},place(frame,{belowHeader=true,rotate=true}={}){
      const before=frame.getAttribute('style'),popover=frame.getAttribute('popover');
      frame.style.cssText='position:fixed!important;display:block!important;inset:auto!important;margin:0!important;padding:0!important;border:0!important;box-sizing:border-box!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;clip-path:none!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;background:#08080b!important;z-index:2147483647!important';
      function position(){if(!viewportValue)return;const view=rotate?viewportValue:geometry({width:viewportValue.width,height:viewportValue.height,left:viewportValue.left,top:viewportValue.top});const style=placement(view,{y:belowHeader?viewportValue.headerHeight:0});for(const [key,value]of Object.entries(style)){const name=key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());if(frame.style.getPropertyValue(name)!==value)frame.style.setProperty(name,value,'important');}}
      if(isMobile(win))frame.removeAttribute('popover');position();subscribers.add(position);
      if(!isMobile(win)&&typeof frame.showPopover==='function'){frame.setAttribute('popover','manual');try{frame.showPopover();}catch{}}
      return()=>{subscribers.delete(position);try{if(frame.matches(':popover-open'))frame.hidePopover();}catch{}if(before===null)frame.removeAttribute('style');else frame.setAttribute('style',before);if(popover===null)frame.removeAttribute('popover');else frame.setAttribute('popover',popover);};
    }};win.CxxGalViewport=service;
    restoreLayer();flushMeasure();
    return {destroy(){if(disposed)return;disposed=true;if(measureTick!==null)win.cancelAnimationFrame(measureTick);removers.splice(0).forEach(fn=>fn());headerObserver?.disconnect();subscribers.clear();void leave();button.remove();note.remove();viewport.remove();if(win.CxxGalViewport===service){if(previousViewport)win.CxxGalViewport=previousViewport;else delete win.CxxGalViewport;}},toggle,measure};
  }
  return {mount,isMobile,geometry,placement};
});
