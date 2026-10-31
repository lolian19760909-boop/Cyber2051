/* Derived from 卡片源码/运行时/entry-experience.js; source SHA256 e36b8064b69fbeefa7f50830e39d115fc36c2f7374721aa4ac395439363301ad. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else{root.CxxEntryExperience=value;if(root)root.CxxEntryExperience=value;}})(globalThis,function(){
 'use strict';
 const orientationKey='cxx-gal-mobile-orientation-v1',announcementId='release-2322-live-notice',noticeUrl='https://cyber2051.top/updates/v3/notice.txt',announcementText="1000 赞了，谢谢大家！感谢大家一直以来的支持！点赞加速作者更新！\n\n目前卡最新版为 东京都2051 2.3.22。\n这一版主要修一个问题：2.3.20 的启动崩溃——之前为了压体积做了跨脚本模块去重，但酒馆助手给每个角色脚本各开一个窗口，去重后核心脚本找不到自己的模块，整个「剧情与玩法核心」起不来，原生阅读与 Gal 全部卡在等待。2.3.21 撤销了跨脚本去重，每个脚本自带完整模块。\n\n森川柚枼、琳星夜、Vesper 三位投稿角色的完整人设，以及 61 位角色共 549 张立绘继续包含。图片、界面及 Live2D 配套资源可在线加载，离线包作为备用。\n\n关于本卡，如果大家在游玩中遇到了 bug，或希望添加玩法与内容、喜欢的 XP，可以在帖子里反馈，也可以私聊我！我一般午间、晚间集中回复。\n如果你喜欢其他作品的设定，或有更好的点子，也欢迎在帖子里提出！";
 const deviceOrientation=win=>win.screen?.orientation?.type?.startsWith('portrait')?'portrait':win.screen?.orientation?.type?.startsWith('landscape')?'landscape':win.innerWidth<win.innerHeight?'portrait':'landscape';
 const read=win=>{try{const saved=win.localStorage.getItem(orientationKey);if(['portrait','landscape'].includes(saved))return saved;}catch{}return deviceOrientation(win);};
 const isMobile=win=>win.CxxGalLandscape?.isMobile?.(win)??!!((win.navigator?.maxTouchPoints||win.matchMedia?.('(pointer:coarse)').matches)&&Math.min(win.innerWidth,win.innerHeight)<900);
 function placement(win,el,{left=0,top=0,width:w,height:h}){
  const mobile=isMobile(win),orientation=read(win),rotate=!!(mobile&&orientation!==deviceOrientation(win));
  return {mobile,orientation,rotated:rotate,shortViewport:(rotate?w:h)<500,styles:{position:'fixed',right:'auto',bottom:'auto',left:(left+(rotate?w:0))+'px',top:top+'px',width:(rotate?h:w)+'px',height:(rotate?w:h)+'px','max-width':'none','max-height':'none',margin:'0',transform:rotate?'rotate(90deg)':'none','transform-origin':'0 0'}};
 }
 function toggle(win){const mode=read(win)==='landscape'?'portrait':'landscape';try{win.localStorage.setItem(orientationKey,mode);}catch{}win.dispatchEvent(new win.CustomEvent('cxx-orientation-changed',{detail:{mode}}));return mode;}
 function button(win,parent){const b=win.document.createElement('button');b.type='button';b.className='cxx-orientation-toggle';b.style.minHeight='44px';const paint=()=>{b.textContent=read(win)==='landscape'?'切换竖屏':'切换横屏';b.setAttribute('aria-label','手机'+b.textContent);};b.onclick=()=>toggle(win);win.addEventListener('cxx-orientation-changed',paint);paint();parent.append(b);return()=>{win.removeEventListener('cxx-orientation-changed',paint);b.remove();};}
 function attach(win,el){
  let frame=null;const vv=win.visualViewport,owned=new Map();el.dataset.cxxViewportOwner='1';
  function release(){for(const [key,record]of owned){if(el.style.getPropertyValue(key)!==record.applied)continue;if(record.value)el.style.setProperty(key,record.value,record.priority);else el.style.removeProperty(key);}owned.clear();delete el.dataset.rotated;delete el.dataset.orientation;delete el.dataset.cxxShortViewport;}
  function set(key,value){let record=owned.get(key);if(!record||el.style.getPropertyValue(key)!==record.applied)record={value:el.style.getPropertyValue(key),priority:el.style.getPropertyPriority(key)};el.style.setProperty(key,value,'important');record.applied=el.style.getPropertyValue(key);owned.set(key,record);}
  function paint(){frame=null;if(!el.isConnected)return;const parent=el.parentElement?.closest('[data-cxx-viewport-owner],#cxx-gal-visible-viewport'),mobile=isMobile(win);
   if(parent||!mobile){release();return;}
   const appHeader=win.__cxxStandaloneUI&&el.classList.contains('cxx-opening-flow')?(win.document.querySelector('.topbar')?.getBoundingClientRect().height||0):0;const placed=placement(win,el,{left:vv?.offsetLeft||0,top:(vv?.offsetTop||0)+appHeader,width:vv?.width||win.innerWidth,height:Math.max(1,(vv?.height||win.innerHeight)-appHeader)});
   for(const [key,value]of Object.entries(placed.styles))set(key,value);
   el.dataset.orientation=placed.orientation;el.dataset.rotated=placed.rotated?'1':'0';el.dataset.cxxShortViewport=String(placed.shortViewport);
  }
  const schedule=()=>{if(frame===null)frame=win.requestAnimationFrame(paint);};for(const name of ['resize','cxx-orientation-changed'])win.addEventListener(name,schedule);vv?.addEventListener('resize',schedule);vv?.addEventListener('scroll',schedule);el.addEventListener('focusin',schedule);el.addEventListener('focusout',schedule);schedule();
  return()=>{win.cancelAnimationFrame(frame);for(const name of ['resize','cxx-orientation-changed'])win.removeEventListener(name,schedule);vv?.removeEventListener('resize',schedule);vv?.removeEventListener('scroll',schedule);el.removeEventListener('focusin',schedule);el.removeEventListener('focusout',schedule);release();delete el.dataset.cxxViewportOwner;};
 }
 function announcements(win){const key='cxx2051-announcement:'+announcementId,limit=12000;
  const digest=s=>{const t=String(s||'');let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0')+'-'+t.length.toString(16);};
  let dialog=null,flight=null,finish=null,loading=false,ended=false,synced=false,refreshing=null;const listeners=new Set();
  let body=announcementText;try{const saved=win.localStorage.getItem(key+':text');if(saved)body=saved;}catch{}
  const stored=()=>{try{return win.localStorage.getItem(key)||'';}catch{return '';}};
  const unread=()=>digest(body.trim())!==stored();
  const emit=()=>{if(ended)return;const snapshot={unread:unread()};for(const fn of listeners){try{fn(snapshot);}catch{}}};
  const remember=text=>{body=text;try{win.localStorage.setItem(key+':text',text);}catch{}};
  function fetchNotice(){const target=win.fetch||typeof fetch==='function'&&fetch;if(typeof target!=='function')return Promise.resolve('');const controller=typeof win.AbortController==='function'?new win.AbortController:null;let timer=null;if(controller)timer=setTimeout(()=>{try{controller.abort();}catch{}},6000);
   const finishTimer=()=>{if(timer){clearTimeout(timer);timer=null;}};
   return Promise.resolve(target.call(win,noticeUrl,{cache:'no-store',credentials:'omit',redirect:'error',signal:controller?controller.signal:undefined})).then(response=>response&&response.ok?response.text():'').then(text=>{finishTimer();const trimmed=String(text||'').replace(/\r\n/g,'\n').trim();if(!trimmed||trimmed.length>limit)return '';return trimmed;}).catch(()=>{finishTimer();return '';});
  }
  function paint(){if(!dialog)return;const p=dialog.querySelector('[data-cxx-announcement-text]');if(p)p.textContent=body;}
  function close(){if(!dialog)return;try{win.localStorage.setItem(key,digest(body.trim()));}catch{}dialog.close();dialog.remove();dialog=null;finish?.();finish=null;flight=null;emit();}
  function open(force=false){if(flight)return flight;if(!force&&!unread())return Promise.resolve();const doc=win.document;dialog=doc.createElement('dialog');dialog.className='cxx-announcement cxx-feedback-theme';dialog.setAttribute('aria-label','东京都2051 公告');const sheet=doc.createElement('style');sheet.textContent=globalThis.CxxFeedbackStyle||'';const title=doc.createElement('h2'),text=doc.createElement('p'),b=doc.createElement('button');title.textContent='东京都2051 · 公告';text.dataset.cxxAnnouncementText='1';text.textContent=body;text.style.whiteSpace='pre-wrap';b.type='button';b.textContent='我知道了';b.onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};dialog.append(sheet,title,text,b);doc.body.append(dialog);flight=new Promise(resolve=>finish=resolve);dialog.showModal();b.focus();
   if(!loading&&!synced){loading=true;void fetchNotice().then(remote=>{loading=false;if(ended||!remote)return;if(remote===body){emit();return;}synced=true;remember(remote);paint();emit();});}
   return flight;}
  function refresh(){if(ended)return Promise.resolve(false);if(refreshing)return refreshing;refreshing=fetchNotice().then(remote=>{refreshing=null;if(ended||!remote)return false;const changed=remote!==body;if(changed){synced=true;remember(remote);emit();if(!dialog)void open(false);}return changed;}).catch(()=>{refreshing=null;return false;});return refreshing;}
  function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);try{fn({unread:unread()});}catch{}return()=>listeners.delete(fn);}
  return {open,refresh,unread,subscribe,seen:()=>!unread(),body:()=>body,destroy(){ended=true;listeners.clear();if(dialog){dialog.close();dialog.remove();dialog=null;}finish?.();flight=null;}};
 }
 return {orientationKey,read,toggle,isMobile,placement,button,attach,announcements,announcementId,announcementText,noticeUrl};
});
