/* Card-owned layers yield together to host dialogs. Nested leases restore only their own changes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxUILayers=api;})(globalThis,function(){
 'use strict';
  const Popover=typeof module==='object'&&module.exports?require('./popover.js'):globalThis.CxxPopover;
 const selector='#cxx-gal-visible-viewport,#cxx-galgame-root,#cxx-shared-terminal-233,#cxx-phone,.cxx-story-library,.cxx-game-menu,.cxx-opening-flow,[data-cxx-update-panel]';
 function forWindow(win){
  if(win.__cxx_ui_layers__)return win.__cxx_ui_layers__;
  const records=new Map(),leases=new Set();let observer=null,changing=false,reader=null,desired=null;
  function applyReader(){if(leases.size||!reader||desired===null)return;const mode=desired;desired=null;reader(mode);}
  function reading(mode){desired=mode;applyReader();}
  function restore(node,r){records.delete(node);if(!node.isConnected)return;if(node.style.getPropertyValue('visibility')==='hidden'){if(r.visibility)node.style.setProperty('visibility',r.visibility,r.priority);else node.style.removeProperty('visibility');}node.inert=r.inert;if(r.popover&&node.hasAttribute('popover')&&!node.hidden)try{node.showPopover();}catch{}}
  function hold(node,lease){
   if(lease.except.some(e=>e===node||e.contains?.(node))){const r=records.get(node);if(r){r.owners.delete(lease);if(!r.owners.size)restore(node,r);}return;}
   let r=records.get(node);if(!r){r={node,visibility:node.style.getPropertyValue('visibility'),priority:node.style.getPropertyPriority('visibility'),inert:node.inert,popover:Popover.isOpen(node),owners:new Set()};records.set(node,r);}
   r.owners.add(lease);if(Popover.isOpen(node))try{node.hidePopover();}catch{}
   if(node.style.getPropertyValue('visibility')!=='hidden')node.style.setProperty('visibility','hidden','important');
   node.inert=true;
  }
  function scan(){if(changing)return;changing=true;try{for(const lease of leases)for(const n of win.document.querySelectorAll(selector))hold(n,lease);}finally{changing=false;}}
  function suspend({except=[]}={}){
   const lease={except};leases.add(lease);scan();
   if(!observer){observer=new win.MutationObserver(scan);observer.observe(win.document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','popover']});}
   let released=false;return()=>{if(released)return;released=true;leases.delete(lease);changing=true;
    try{for(const [node,r]of records){r.owners.delete(lease);if(r.owners.size)continue;restore(node,r);}}
    finally{changing=false;if(!leases.size){observer?.disconnect();observer=null;applyReader();}else scan();}
   };
  }
  const stack=[];
  function enter(page,element){
   const entry={page,element,focus:win.document.activeElement,mode:win.document.body.dataset.cxxGalActive==='1'?'gal':'native',scroll:[...win.document.querySelectorAll('#chat,.cxx-gal-dialogue,.cxx-opening-flow,.cxx-story-library,.cxx-game-menu')].filter(n=>n!==element&&!element?.contains(n)).map(node=>({node,top:node.scrollTop,left:node.scrollLeft}))};stack.push(entry);let left=false;
   return ()=>{if(left)return;left=true;const index=stack.indexOf(entry),top=index===stack.length-1;if(index>=0)stack.splice(index,1);if(!top)return;for(const s of entry.scroll)if(s.node.isConnected){s.node.scrollTop=s.top;s.node.scrollLeft=s.left;}if(entry.focus?.isConnected&&!entry.focus.closest?.('[inert]'))entry.focus.focus?.({preventScroll:true});};
  }
  return win.__cxx_ui_layers__={suspend,enter,reading,registerReader(fn){reader=fn;applyReader();return()=>{if(reader===fn){reader=null;desired=null;}};},history:()=>stack.map(x=>({page:x.page,mode:x.mode})),read:()=>({pages:stack.map(x=>x.page),overlays:leases.size,reading:desired})};
 }
 return {forWindow};
});
