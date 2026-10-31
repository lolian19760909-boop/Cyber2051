(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Cxx249Shadow=api;})(globalThis,function(){
 'use strict';
 const fontDocuments=new WeakMap();
 function create({window:win,runtime,templates}){
  const doc=win.document,compiled=new Map(),fonts=new Set();
  const supported=Boolean(win.CSSStyleSheet?.prototype?.replaceSync&&win.CSS?.supports?.('container-type','inline-size')&&win.Element?.prototype?.attachShadow);
  function selectors(s){return s.split(/(\[(?:[^\]"']|"[^"]*"|'[^']*')*\]|"[^"]*"|'[^']*')/g).map((part,i)=>i%2?part:part.replace(/:root\b/g,'.cxx-root').replace(/(^|[^\w.#-])(html|body)(?![\w-])/g,(_,prefix,tag)=>prefix+(tag==='html'?'.cxx-root':'.cxx-body'))).join('');}
  function css(source){
   const sheet=new win.CSSStyleSheet();sheet.replaceSync(source);
   const rules=list=>Array.from(list,rule=>{
    if(rule.type===1)return selectors(rule.selectorText)+'{'+rule.style.cssText.replace(/\b85vh\b/g,'calc(var(--cxx-component-viewport-height, 100vh) * .85)')+'}';
    if(rule.type===4){const condition=rule.conditionText;return (/\b(?:min|max)-width\s*:/.test(condition)&&!/(?:prefers|orientation|hover|pointer)/.test(condition)?'@container cxx-card ':'@media ')+condition+'{'+rules(rule.cssRules)+'}';}
    if(rule.cssRules&&rule.type!==7){const head=rule.cssText.slice(0,rule.cssText.indexOf('{'));return head+'{'+rules(rule.cssRules)+'}';}
    return rule.cssText;
   }).join('\n');return rules(sheet.cssRules);
  }
  function compile(kind){
   if(compiled.has(kind))return compiled.get(kind);
   const parsed=new win.DOMParser().parseFromString(templates[kind],'text/html'),styles=Array.from(parsed.querySelectorAll('style'),s=>s.textContent),scripts=[];
   for(const s of parsed.querySelectorAll('script')){if(!s.type||s.type==='text/javascript'){scripts.push(s.textContent.replace('`$1`','window.Cxx236InitialValue'));s.remove();}}
   parsed.querySelectorAll('style,link,base,title,meta').forEach(n=>n.remove());
   const imports=[];const source=styles.join('\n').replace(/@import\s+url\(['"]?([^'"\)]+)['"]?\)\s*;/g,(_,url)=>{imports.push(url);return '';});
   // Google font imports only declare font faces. Other imported CSS keeps its isolated iframe.
   if(imports.some(url=>!url.startsWith('https://fonts.googleapis.com/')))throw Error('Imported component stylesheet requires iframe isolation');
   let shared=fontDocuments.get(doc);if(!shared){shared=new Map();fontDocuments.set(doc,shared);}
   for(const url of imports)if(!fonts.has(url)){let item=shared.get(url);if(!item){const node=doc.createElement('link');node.rel='stylesheet';node.href=url;node.dataset.cxxComponentFonts='249';doc.head.append(node);item={node,users:0};shared.set(url,item);}item.users++;fonts.add(url);}
   const sheet=new win.CSSStyleSheet();sheet.replaceSync(':host{display:block;min-width:0;container-type:inline-size;container-name:cxx-card}.cxx-root{display:block;color:#000;font:16px "Times New Roman",serif;text-align:start;direction:ltr;isolation:isolate}.cxx-body{display:block;margin:8px}'+css(source));
   const names=['window','document','parent','getStatusSnapshot','watchVisibleInterval','getCurrentMessageId','getVariables','getAllVariables','eventOn','eventRemoveListener','setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame'];
   const factories=scripts.map(s=>new Function(...names,s));
   const value={sheet,body:parsed.body.innerHTML,rootAttrs:Array.from(parsed.documentElement.attributes,a=>[a.name,a.value]),bodyAttrs:Array.from(parsed.body.attributes,a=>[a.name,a.value]),names,factories};compiled.set(kind,value);return value;
  }
  function mount(host,kind,value){
   const template=compile(kind),shadow=host.attachShadow({mode:'open'}),root=doc.createElement('div'),body=doc.createElement('div'),head=doc.createElement('div');
   root.className='cxx-root';body.className='cxx-body';head.hidden=true;
   for(const [k,v]of template.rootAttrs)if(k!=='class')root.setAttribute(k,v);
   for(const [k,v]of template.bodyAttrs)if(k!=='class')body.setAttribute(k,v);
   body.className+=' '+(template.bodyAttrs.find(a=>a[0]==='class')?.[1]||'');
   body.innerHTML=template.body;root.append(head,body);shadow.adoptedStyleSheets=[template.sheet];shadow.append(root);
   const timers=new Set(),intervals=new Set(),rafs=new Set(),events=new win.EventTarget();let alive=true,loading=true;
   const scoped={documentElement:root,body,head,defaultView:null,get hidden(){return doc.hidden;},get visibilityState(){return doc.visibilityState;},get readyState(){return loading?'loading':'complete';},get activeElement(){return shadow.activeElement;},getElementById:id=>shadow.getElementById(id),querySelector:s=>shadow.querySelector(selectors(s)),querySelectorAll:s=>shadow.querySelectorAll(selectors(s)),createElement:tag=>doc.createElement(tag),createTextNode:t=>doc.createTextNode(t),contains:n=>root.contains(n),addEventListener:(...a)=>shadow.addEventListener(...a),removeEventListener:(...a)=>shadow.removeEventListener(...a),dispatchEvent:e=>shadow.dispatchEvent(e)};
   const local={document:scoped,parent:win,top:win,frameElement:host,Cxx236InitialValue:value,addEventListener:(...a)=>events.addEventListener(...a),removeEventListener:(...a)=>events.removeEventListener(...a),dispatchEvent:e=>events.dispatchEvent(e),setTimeout(fn,ms,...args){const id=win.setTimeout(()=>{timers.delete(id);if(alive)fn(...args);},ms);timers.add(id);return id;},clearTimeout(id){timers.delete(id);win.clearTimeout(id);},setInterval(fn,ms,...args){const id=win.setInterval(()=>{if(alive)fn(...args);},ms);intervals.add(id);return id;},clearInterval(id){intervals.delete(id);win.clearInterval(id);},requestAnimationFrame(fn){const id=win.requestAnimationFrame(t=>{rafs.delete(id);if(alive)fn(t);});rafs.add(id);return id;},cancelAnimationFrame(id){rafs.delete(id);win.cancelAnimationFrame(id);}};
   const child=new Proxy(local,{get:(o,k)=>k in o?o[k]:win[k],has:(o,k)=>k in o||k in win});local.window=child;scoped.defaultView=child;
   Object.defineProperties(host,{contentWindow:{value:child,configurable:true},contentDocument:{value:scoped,configurable:true}});host.dataset.cxxShadow='1';const stopHostAction=event=>event.stopPropagation();for(const type of ['click','dblclick','submit'])host.addEventListener(type,stopHostAction);
   // Runtime-injected styles use the same scoped roots as the trusted template.
   const append=head.append.bind(head);head.append=(...nodes)=>{for(const n of nodes)if(n.tagName==='STYLE')n.textContent=css(n.textContent);append(...nodes);};
   const dispose=()=>{if(!alive)return;try{child.dispatchEvent(new win.Event('pagehide'));}finally{alive=false;for(const type of ['click','dblclick','submit'])host.removeEventListener(type,stopHostAction);host.__cxxBridgeDispose?.();for(const id of timers)win.clearTimeout(id);for(const id of intervals)win.clearInterval(id);for(const id of rafs)win.cancelAnimationFrame(id);timers.clear();intervals.clear();rafs.clear();}};
   host.__cxxShadowDispose=dispose;
   try{runtime.bridge(child);for(const factory of template.factories)factory.call(child,...template.names.map(n=>n==='window'?child:n==='document'?scoped:n==='parent'?win:child[n]));loading=false;scoped.dispatchEvent(new win.Event('DOMContentLoaded'));if(kind==='mvu'){const node=scoped.querySelector('.mvu-content');if(node)node.textContent=value;}host.dispatchEvent(new win.Event('load'));}
   catch(error){dispose();throw error;}
   return {destroy:dispose,root,body};
  }
  return {supported,mount,read:()=>({templates:compiled.size}),destroy(){const shared=fontDocuments.get(doc);for(const url of fonts){const item=shared?.get(url);if(item&&!--item.users){item.node.remove();shared.delete(url);}}fonts.clear();compiled.clear();}};
 }
 return {create};
});
