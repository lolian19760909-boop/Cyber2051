/* The terminal launches the single chat-owned atlas. */
(()=>{
 'use strict';
 const app=window.CxxTerminalApp,city=document.getElementById('t2051x-page-city'),tool=()=>parent.CxxAtlasTool;
 city.replaceChildren();const card=document.createElement('section'),title=document.createElement('h2'),text=document.createElement('p'),button=document.createElement('button');card.style.cssText='margin:auto;padding:32px;max-width:560px;border-left:2px solid #73cbd0;background:#120c12';title.textContent='东京都 · 城市地图';text.textContent='地图在独立窗口中打开。关闭后保留当前镜头、筛选与地点选择。';button.type='button';button.className='quiet';button.textContent='打开城市地图 ↗';button.style.minHeight='44px';button.onclick=()=>tool()?.open();card.append(title,text,button);city.append(card);
 let disposed=false;const launch=event=>{if(event.target.closest('[data-page="city"]'))queueMicrotask(()=>{if(!disposed)tool()?.open();});};document.getElementById('t2051x-system-nav').addEventListener('click',launch);
 const stop=app.subscribe(event=>{if(!disposed&&event?.preferences)tool()?.preferences();});
 window.TOKYO_TERMINAL_MAP_CONTROL={focus(mapId,placeId){return !disposed&&tool()?.focus(mapId,placeId)||false;},escape:()=>false,read:()=>tool()?.read().shell,destroy(){if(disposed)return;disposed=true;stop();document.getElementById('t2051x-system-nav').removeEventListener('click',launch);}};
 window.addEventListener('pagehide',()=>window.TOKYO_TERMINAL_MAP_CONTROL.destroy(),{once:true});
})();
