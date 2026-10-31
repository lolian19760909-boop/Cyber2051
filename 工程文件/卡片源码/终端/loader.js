
(function(){
'use strict';
if (window.__T2051_LOADED__) return; window.__T2051_LOADED__ = true;

const loadingRoot=document.getElementById('t2051x-root'),loadingView=document.getElementById('t2051x-loading'),loadingFab=document.getElementById('t2051x-fab');
let loadingStarted=false,loadingPending=false,loadingRaf=0,loadingTimer=0;
loadingRoot.setAttribute('aria-busy','true');
const terminalBoot=window.CxxBootLoader.mount({doc:document,parent:loadingView,title:'正在打开终端',stages:['载入终端组件','读取终端资料','准备页面']});window.CxxTerminalBoot=terminalBoot;terminalBoot.stage(0,'now');
try{const f=window.frameElement,c=f?.ownerDocument.getElementById('chat');if(f&&c&&!f.matches(':popover-open')){const fr=f.getBoundingClientRect(),cr=c.getBoundingClientRect();loadingRoot.style.setProperty('--t2051x-visible-top',Math.max(0,cr.top-fr.top)+'px');loadingRoot.style.setProperty('--t2051x-visible-bottom',Math.max(0,fr.bottom-cr.bottom)+'px');}}catch(_){}
function startTerminal(){
 loadingPending=false;if(loadingStarted||!loadingRoot.isConnected)return;loadingStarted=true;
 try{initializeTerminal();terminalBoot.stage(2,'done');terminalBoot.log('terminal','prepare','页面','已就绪');void terminalBoot.done().then(()=>{loadingView.hidden=true;});loadingFab.disabled=false;loadingFab.setAttribute('aria-busy','false');loadingRoot.setAttribute('aria-busy','false');}
 catch(error){const current=terminalBoot.read().stages.findIndex(s=>s.state==='now');terminalBoot.log('terminal','load','组件',error.message,'bad');terminalBoot.fail(Math.max(0,current),{title:'终端暂未准备好',message:error.message,onRetry:()=>window.location.reload(),onBack:()=>{terminalBoot.destroy();loadingView.hidden=true;window.parent.Cxx233Terminal?.close();}});loadingRoot.setAttribute('aria-busy','false');console.error('[东京都终端] 组件载入失败',error);}
}
function scheduleTerminal(){if(loadingStarted||loadingPending)return;loadingPending=true;loadingRaf=requestAnimationFrame(()=>{loadingTimer=setTimeout(startTerminal,0);});}
window.addEventListener('pagehide',()=>{terminalBoot.destroy();cancelAnimationFrame(loadingRaf);clearTimeout(loadingTimer);loadingPending=false;});
window.addEventListener('pageshow',scheduleTerminal);
scheduleTerminal();
function initializeTerminal(){
/*TERMINAL_MODULES*/
}
})();
