(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxThemeRuntime=value;})(globalThis,function(){
 'use strict';
 const KEY='cxx-ui-theme-v1',themes=Object.freeze([{id:'red',name:'红'},{id:'yellow',name:'黄'},{id:'night',name:'夜间'}]);
 const known=id=>themes.some(t=>t.id===id);
 // Scene and illustration filters (DESIGN.md 10.8): a yellow-black duotone for scenes, and
 // red-channel recolouring of the red illustration art for the yellow and night themes.
 const FILTERS='\x3cfilter id="cxx-scene-yellow" color-interpolation-filters="sRGB">\x3cfeColorMatrix type="saturate" values="0"/>\x3cfeComponentTransfer>\x3cfeFuncR type="table" tableValues="0.043 0.12 0.62 0.913"/>\x3cfeFuncG type="table" tableValues="0.043 0.11 0.55 0.816"/>\x3cfeFuncB type="table" tableValues="0.043 0.05 0.12 0.26"/>\x3c/feComponentTransfer>\x3c/filter>'+
  '\x3cfilter id="cxx-art-yellow" color-interpolation-filters="sRGB">\x3cfeColorMatrix type="matrix" values="1.05 0 0 0 0 .95 0 0 0 0 .3 0 0 0 0 0 0 0 1 0"/>\x3c/filter>'+
  '\x3cfilter id="cxx-art-night" color-interpolation-filters="sRGB">\x3cfeColorMatrix type="matrix" values="1 0 0 0 0 1 0 0 0 0 1.03 0 0 0 0 0 0 0 1 0"/>\x3c/filter>';
 function install(win,owner=win,carriers=''){
  win.CxxTheme?.destroy();
  let current='red',ended=false;const listeners=new Set(),docs=new Map();
  try{const saved=win.localStorage.getItem(KEY);if(known(saved))current=saved;}catch{}
  function mark(doc){const el=doc?.documentElement;if(!el)return;if(el.getAttribute('data-cxx-theme')!==current)el.setAttribute('data-cxx-theme',current);if(carriers&&doc.head){let style=doc.getElementById('cxx-theme-carriers');if(!style){style=doc.createElement('style');style.id='cxx-theme-carriers';doc.head.append(style);}if(style.textContent!==carriers)style.textContent=carriers;}if(doc.createElementNS&&doc.body&&!doc.getElementById('cxx-theme-filters')){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='cxx-theme-filters';svg.setAttribute('aria-hidden','true');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';svg.innerHTML=FILTERS;doc.body.append(svg);}}
  // Iframes load later and may be replaced; a capturing load listener per watched
  // document marks each new frame document as soon as it exists.
  function onLoad(event){if(event.target?.tagName!=='IFRAME')return;let child=null;try{child=event.target.contentDocument;}catch{}watch(child);}
  function watch(doc){
   if(ended||!doc?.documentElement)return;mark(doc);
   if(!docs.has(doc)){const view=doc.defaultView,leave=()=>{doc.removeEventListener('load',onLoad,true);view?.removeEventListener('pagehide',leave);docs.delete(doc);};docs.set(doc,leave);doc.addEventListener('load',onLoad,true);view?.addEventListener('pagehide',leave,{once:true});}
   for(const frame of doc.querySelectorAll('iframe')){let child=null;try{child=frame.contentDocument;}catch{}if(child)watch(child);}
  }
  function apply(){watch(win.document);for(const doc of docs.keys())mark(doc);}
  function notify(){for(const fn of listeners)try{fn(current);}catch{}win.dispatchEvent(new win.Event('cxx-theme-change'));}
  function set(id){
   if(ended)throw Error('界面主题服务已停止，请重新打开设置。');
   if(!known(id))throw Error('未知的界面主题：'+id);
   current=id;let saved=true;try{win.localStorage.setItem(KEY,id);}catch{saved=false;}
   apply();notify();return {theme:current,saved};
  }
  // Another tab of the same browser changed the theme.
  const storage=event=>{if(event.key!==KEY)return;const next=known(event.newValue)?event.newValue:'red';if(next===current)return;current=next;apply();notify();};
  win.addEventListener('storage',storage);
  const service={themes,read:()=>current,set,attach(child){try{watch(child?.document||child);}catch{}},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
   destroy(){if(ended)return;ended=true;win.removeEventListener('storage',storage);for(const leave of [...docs.values()])leave();listeners.clear();owner.removeEventListener?.('pagehide',service.destroy);if(win.CxxTheme===service)delete win.CxxTheme;}};
  // Marks stay on the documents after the owner script unloads; the next install reuses them.
  owner.addEventListener?.('pagehide',service.destroy,{once:true});
  win.CxxTheme=service;apply();return service;
 }
 return {install,themes,key:KEY};
});