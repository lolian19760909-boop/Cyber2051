import {appUrl} from '../platform/paths.mjs';
import {mountBulletinView} from './bulletin-view.mjs';

export function announcementArticles(items=[]){
 return items.filter(row=>Number.isSafeInteger(row.id)&&typeof row.title==='string'&&typeof row.body==='string').map(row=>({
  id:'announcement-'+row.id,kind:row.kind==='card'?'update':'notice',title:row.title,date:String(row.created_at||'').slice(0,10),
  summary:'',pinned:!!row.pinned,revision:row.updated_at||row.created_at||'',sections:[{title:'',paragraphs:row.body.split(/\n\s*\n/)}],
 }));
}

export function createBulletin({win=window,assets}){
 const doc=win.document,base=appUrl('web/bulletin/'),api=new URL('/api/workshop/announcements',win.location.hostname==='cyber2051.top'?win.location.origin:'https://cyber2051.top').href;
 let current=null,flight=null,disposed=false,automaticRevision=null,staticContent=null;
 const controllers=new Set(),readKey=revision=>'cxx2051:bulletin:read:'+revision;
 async function request(url,kind){const controller=new AbortController();controllers.add(controller);const timer=win.setTimeout(()=>controller.abort(),10000);try{const response=await win.fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);return await response[kind]();}finally{win.clearTimeout(timer);controllers.delete(controller);}}
 async function layout(){
  if(!staticContent)staticContent=Promise.all([request(new URL('dialog.html',base),'text'),request(new URL('notice.css',base),'text'),request(new URL('content.json',base),'json')]).then(([html,css,authored])=>({html,css:css.replace(/url\(["']?([^)'"\s]+)["']?\)/g,(_,url)=>'url("'+new URL(url,new URL('notice.css',base)).href+'")'),authored:authored.items||[]})).catch(error=>{staticContent=null;throw error;});
  return staticContent;
 }
 function disposeView(view,remember=false){
  if(current!==view)return;
  current=null;view.unsubscribe?.();
  if(remember&&view.revision)try{win.localStorage.setItem(readKey(view.revision),'1');}catch{}
  view.host.remove();
 }
 function close(){const view=current;if(!view)return;view.view.close();disposeView(view);}
 async function open({automatic=false}={}){
  if(disposed||current)return;if(flight)return flight;
  flight=(async()=>{
   const [content,feed]=await Promise.all([layout(),request(api,'json').then(data=>{if(!Array.isArray(data?.items))throw Error('公告格式不正确');return {items:announcementArticles(data.items)};}).catch(error=>({items:[],error}))]);
   if(disposed)return;
   const articles=[...feed.items,...content.authored];
   const announcements=articles.filter(article=>article.kind!=='guide');
   const digest=await win.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(announcements)));
   const revision=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
   if(disposed)return;let seen=false;try{seen=win.localStorage.getItem(readKey(revision))==='1';}catch{}
   if(automatic){if(!announcements.length||seen||automaticRevision===revision)return;automaticRevision=revision;}
   const returnFocus=doc.activeElement,host=doc.createElement('div'),scope=host.attachShadow({mode:'open'}),style=doc.createElement('style'),container=doc.createElement('div');
   host.dataset.cxxTheme=win.CxxTheme?.read?.()||doc.documentElement.dataset.cxxTheme||'red';
   style.textContent=content.css;container.className='cxx-notice-preview';container.innerHTML=content.html;scope.append(style,container);doc.body.append(host);
   for(const placeholder of scope.querySelectorAll('[data-bulletin-brand]')){const logo=doc.createElement('img');logo.className='cxx-brand-mark';logo.src=assets.logo;logo.alt='Tokyo 2051';placeholder.replaceWith(logo);}
   const holder={host,revision};current=holder;
   const syncTheme=theme=>{host.dataset.cxxTheme=theme;holder.view?.syncTheme(theme);};
   holder.view=mountBulletinView({scope,container,articles,logoUrl:assets.logo,returnFocus,
    setTheme:theme=>{win.CxxTheme?.set?.(theme);syncTheme(theme);},onClose:remember=>disposeView(holder,remember),
    onRefresh:()=>{close();void open();},
   });
   syncTheme(host.dataset.cxxTheme);holder.unsubscribe=win.CxxTheme?.subscribe?.(syncTheme);
   const art=[...content.css.matchAll(/url\("([^"]+)"\)/g)].map(match=>match[1]).filter(url=>/\.(?:svg|png|webp)$/i.test(url));
   void Promise.all([...new Set(art)].map(url=>new Promise(resolve=>{const image=new win.Image();let settled=false;const timer=win.setTimeout(()=>finish(false),8000);function finish(ok){if(settled)return;settled=true;win.clearTimeout(timer);image.onload=image.onerror=null;resolve(ok);}image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=url;}))).then(loaded=>{if(current===holder&&loaded.every(Boolean))container.dataset.artReady='true';});
   if(feed.error){const error=doc.createElement('p');error.className='cxx-load-error';error.setAttribute('role','status');error.textContent='公告读取失败，请刷新重试。';scope.getElementById('cxx-article').prepend(error);}
  })().finally(()=>{flight=null;});
  return flight;
 }
 return {open,close,destroy(){disposed=true;for(const controller of controllers)controller.abort();close();}};
}
