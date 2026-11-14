/* Derived from 卡片源码/运行时/entry-experience.js; source SHA256 f05ed58d76b9d4ba3b11bca110f0e1859967b6c00614e951e30c2659c93b154b. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else{root.CxxEntryExperience=value;if(root)root.CxxEntryExperience=value;}})(globalThis,function(){
 'use strict';
 const orientationKey='cxx-gal-mobile-orientation-v1';
 const deviceOrientation=win=>win.screen?.orientation?.type?.startsWith('portrait')?'portrait':win.screen?.orientation?.type?.startsWith('landscape')?'landscape':win.innerWidth<win.innerHeight?'portrait':'landscape';
 const read=win=>{try{const saved=win.localStorage.getItem(orientationKey);if(['portrait','landscape'].includes(saved))return saved;}catch{}return deviceOrientation(win);};
 const isMobile=win=>win.CxxGalLandscape?.isMobile?.(win)??!!((win.navigator?.maxTouchPoints||win.matchMedia?.('(pointer:coarse)').matches)&&Math.min(win.innerWidth,win.innerHeight)<900);
 function placement(win,el,{left=0,top=0,width:w,height:h}){
  const mobile=isMobile(win),orientation=read(win),rotate=!!(mobile&&orientation!==deviceOrientation(win));
  return {mobile,orientation,rotated:rotate,shortViewport:(rotate?w:h)<500,styles:{position:'fixed',right:'auto',bottom:'auto',left:(left+(rotate?w:0))+'px',top:top+'px',width:(rotate?h:w)+'px',height:(rotate?w:h)+'px','max-width':'none','max-height':'none',margin:'0',transform:rotate?'rotate(90deg)':'none','transform-origin':'0 0'}};
 }
 function toggle(win){const mode=read(win)==='landscape'?'portrait':'landscape';try{win.localStorage.setItem(orientationKey,mode);}catch{}win.dispatchEvent(new win.CustomEvent('cxx-orientation-changed',{detail:{mode}}));return mode;}
 function button(win,parent){const b=win.document.createElement('button');b.type='button';b.className='cxx-orientation-toggle';b.style.minHeight='44px';const paint=()=>{b.textContent=read(win)==='landscape'?'切换竖屏':'切换横屏';b.setAttribute('aria-label','手机'+b.textContent);};b.onclick=()=>toggle(win);const orientation=win.screen?.orientation;for(const name of ['resize','cxx-orientation-changed'])win.addEventListener(name,paint);orientation?.addEventListener?.('change',paint);paint();parent.append(b);return()=>{for(const name of ['resize','cxx-orientation-changed'])win.removeEventListener(name,paint);orientation?.removeEventListener?.('change',paint);b.remove();};}
 function attach(win,el){
  let frame=null;const vv=win.visualViewport,orientation=win.screen?.orientation,owned=new Map();el.dataset.cxxViewportOwner='1';
  function release(){for(const [key,record]of owned){if(el.style.getPropertyValue(key)!==record.applied)continue;if(record.value)el.style.setProperty(key,record.value,record.priority);else el.style.removeProperty(key);}owned.clear();delete el.dataset.rotated;delete el.dataset.orientation;delete el.dataset.cxxShortViewport;}
  function set(key,value){let record=owned.get(key);if(!record||el.style.getPropertyValue(key)!==record.applied)record={value:el.style.getPropertyValue(key),priority:el.style.getPropertyPriority(key)};el.style.setProperty(key,value,'important');record.applied=el.style.getPropertyValue(key);owned.set(key,record);}
  function paint(){frame=null;if(!el.isConnected)return;const parent=el.parentElement?.closest('[data-cxx-viewport-owner],#cxx-gal-visible-viewport'),mobile=isMobile(win);
   if(parent||!mobile){release();return;}
   const appHeader=win.__cxxStandaloneUI&&el.classList.contains('cxx-opening-flow')?(win.document.querySelector('.topbar')?.getBoundingClientRect().height||0):0;const placed=placement(win,el,{left:vv?.offsetLeft||0,top:(vv?.offsetTop||0)+appHeader,width:vv?.width||win.innerWidth,height:Math.max(1,(vv?.height||win.innerHeight)-appHeader)});
   for(const [key,value]of Object.entries(placed.styles))set(key,value);
   el.dataset.orientation=placed.orientation;el.dataset.rotated=placed.rotated?'1':'0';el.dataset.cxxShortViewport=String(placed.shortViewport);
  }
  const schedule=()=>{if(frame===null)frame=win.requestAnimationFrame(paint);};for(const name of ['resize','cxx-orientation-changed'])win.addEventListener(name,schedule);orientation?.addEventListener?.('change',schedule);vv?.addEventListener('resize',schedule);vv?.addEventListener('scroll',schedule);el.addEventListener('focusin',schedule);el.addEventListener('focusout',schedule);schedule();
  return()=>{win.cancelAnimationFrame(frame);for(const name of ['resize','cxx-orientation-changed'])win.removeEventListener(name,schedule);orientation?.removeEventListener?.('change',schedule);vv?.removeEventListener('resize',schedule);vv?.removeEventListener('scroll',schedule);el.removeEventListener('focusin',schedule);el.removeEventListener('focusout',schedule);release();delete el.dataset.cxxViewportOwner;};
 }
 function announcements(win){
  const ui=globalThis.CxxBulletin;
  if(!ui)throw Error('公告与指南组件未装载，请完成卡片更新后刷新。');
  const assets={logo:''};let lease=null,loading=null,disposed=false;
  const service=ui.createBulletin({win,assets,baseUrl:ui.base,layoutContent:ui.layout,digestBytes:bytes=>globalThis.CxxCrypto.digest(bytes,win.crypto)});
  async function prepareLogo(){
   if(lease||disposed)return;if(loading)return loading;
   loading=(async()=>{try{const acquired=await win.CxxResources.acquire(ui.logo);if(disposed){acquired.release();return;}lease=acquired;assets.logo=lease.url;}catch(error){win.CxxDiagnostics?.report({module:'公告与指南',stage:'标题图片',message:error.message,detail:ui.logo});}})().finally(()=>{loading=null;});
   return loading;
  }
  async function show(automatic){await prepareLogo();await service.open({automatic});}
  return {async open(force=false){await show(!force);await service.whenClosed();},refresh:()=>show(true),destroy(){disposed=true;service.destroy();lease?.release();lease=null;}};
 }
 return {orientationKey,read,toggle,isMobile,placement,button,attach,announcements};
});
