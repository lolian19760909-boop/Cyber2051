/* Host-owned extension installation. Uses host installation and one verified reload; plugin owns settings. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxMirrorSetup=api;})(globalThis,function(root){
 'use strict';
 const REPO='https://github.com/iabil-604/MirrorTranslate';
 // Run the import in the host document, not in Tavern Helper's iframe: importing
 // ST in an iframe would start a second, incorrectly scoped extension runtime.
 function hostModule(top){return new Promise((resolve,reject)=>{const id='cxx-host-extensions-'+top.crypto.randomUUID(),script=top.document.createElement('script');let timer;const finish=(error,value)=>{top.clearTimeout(timer);top.removeEventListener(id,receive);script.remove();error?reject(error):resolve(value);},receive=e=>e.detail?.error?finish(Error(e.detail.error)):finish(null,e.detail.module);top.addEventListener(id,receive,{once:true});script.type='module';script.textContent='import("/scripts/extensions.js").then(module=>window.dispatchEvent(new CustomEvent('+JSON.stringify(id)+',{detail:{module}})),error=>window.dispatchEvent(new CustomEvent('+JSON.stringify(id)+',{detail:{error:String(error.message)}})));';script.onerror=()=>finish(Error('宿主不允许加载扩展管理接口'));timer=top.setTimeout(()=>finish(Error('扩展管理接口加载超时')),8000);top.document.head.append(script);});}
 function create({top,loadModule=()=>hostModule(top),enabled=()=>true,enable=async()=>{}}){
  let ended=false,flight=null,manager=null,dialog=null,previous=null,restoreLayers=null,guide=null,configureEpoch=0,state={kind:'checking',message:'正在检查镜译…'},listeners=new Set();
  const publish=s=>{if(!ended){state=s;for(const fn of listeners)fn({...s});}return s;};
  async function inspect(){
   const jy=top.__JINGYI__;if(jy){try{let timer;try{await Promise.race([jy.ready||Promise.resolve(),new Promise((_,reject)=>{timer=top.setTimeout(()=>reject(Error('镜译正在加载，或启动未完成。请稍后重试；持续如此请在扩展管理器检查。')),5000);})]);}finally{top.clearTimeout(timer);}if(top.__JINGYI__!==jy)return publish({kind:'loading',message:'镜译正在重新加载，请稍后重试。'});const t=jy.tts?.status?.()||{};return publish({kind:'ready',version:jy.version,message:'镜译 '+(jy.version||'')+' 已连接'+(t.readReady?' · 朗读已就绪':' · 配音尚未就绪'),read:!!t.readReady,reason:t.readReason||'',reading:!!jy.reading?.get,translation:jy.reading?.status?.()||null,stream:!!t.streamReady,streamReason:t.streamReason||'',mic:jy.stt?.status?.()||null});}catch(e){return publish({kind:'loading',message:e.message});}}
   try{manager=await loadModule();const name=(manager.extensionNames||[]).find(n=>/(?:^|\/)MirrorTranslate$/i.test(n)||/iabil-604\/MirrorTranslate/i.test(manager.getExtensionManifest?.(n)?.homePage||''));
    if(name){const disabled=manager.extension_settings?.disabledExtensions?.includes(name);return publish({kind:disabled?'disabled':'loading',name,message:disabled?'镜译已安装，但在扩展管理器中被停用。':'镜译已安装，但接口尚未就绪。请稍后重试；仍无响应时，在保存进度后刷新酒馆。'});}
    return publish({kind:'missing',message:'尚未安装镜译。安装后配置翻译与配音，即可使用译文和角色朗读。',canInstall:typeof manager.installExtension==='function'});
   }catch{return publish({kind:'unknown',message:'未检测到镜译接口，且无法读取扩展管理器。请打开酒馆扩展页核对安装情况。'});}
  }
  function check(){if(flight)return flight;flight=inspect().finally(()=>flight=null);return flight;}
  async function install(){if(flight)return flight;flight=(async()=>{const s=await inspect();if(s.kind==='ready')return s;if(!manager)manager=await loadModule();if(s.kind==='missing'&&!s.canInstall)throw Error('当前宿主未提供安装入口，请在扩展管理器安装镜译。');close();publish({kind:'installing',message:'正在由酒馆安装镜译，请完成宿主提示…'});const ok=s.kind==='missing'?await manager.installExtension(REPO,false):true;if(s.kind==='disabled'){if(!manager.enableExtension)throw Error('当前宿主缺少启用接口，请在扩展管理器启用镜译。');await manager.enableExtension(s.name,false);}if(!ok){const after=await inspect();if(after.kind==='missing')publish({...after,message:'安装未完成或已取消。可重试，或将作者仓库地址复制到酒馆扩展安装页。'});return state;}let after=await inspect();const deadline=Date.now()+3000;while(!ended&&after.kind==='loading'&&Date.now()<deadline){await new Promise(r=>top.setTimeout(r,150));after=await inspect();}if(ended||after.kind==='ready')return after;if(!['loading','disabled'].includes(after.kind))return after;const stories=top.__cxx_stories__;if(!stories)throw Error('故事保存服务尚未就绪，已安装镜译；请保存进度后重新点击。');publish({kind:'installing',message:'镜译已安装，正在保存并核对进度，随后刷新加载…'});await stories.store.flush();const c=top.SillyTavern.getContext(),token={avatar:c.characters?.[c.characterId]?.avatar,chat:c.chatId||c.getCurrentChatId?.(),at:Date.now()};top.sessionStorage.setItem('cxx-mirror-install-return',JSON.stringify(token));top.location.reload();return after;})().catch(e=>publish({kind:'error',message:'安装未完成：'+e.message})).finally(()=>{flight=null;if(!ended)open();});return flight;}
  async function configure(section='advanced'){
   const b=top.document.querySelector('.jingyi-open-button');if(!b)throw Error('镜译设置入口尚未就绪，请重新检查。');
   const token=++configureEpoch;close();guide?.destroy();guide=null;restoreLayers?.();
   const layers=root.CxxUILayers||(typeof require==='function'?require('../共享/ui-layers.js'):null);if(!layers)throw Error('窗口服务尚未就绪，请刷新角色卡。');
   const manager=layers.forWindow(top),back=manager.enter?.('mirror'),release=manager.suspend();let seen=false;
   const observer=new top.MutationObserver(()=>{const panel=top.document.getElementById('jingyi-translator-panel-host');if(panel)seen=true;else if(seen)restore();});
   const restore=()=>{observer.disconnect();if(token===configureEpoch){guide?.destroy();guide=null;}release();back?.();if(restoreLayers===restore)restoreLayers=null;};restoreLayers=restore;observer.observe(top.document.body,{childList:true});
   try{
    b.click();const until=Date.now()+10000;let panel;
    while(!ended&&token===configureEpoch){panel=top.document.getElementById('jingyi-translator-panel-host');const visible=panel?.shadowRoot?.querySelector('.jy-dialog');if(visible&&visible.getClientRects().length){seen=true;break;}if(Date.now()>until)throw Error('镜译设置未能显示，已恢复游戏界面。可以重新打开。');await new Promise(r=>top.setTimeout(r,80));}
    if(ended||token!==configureEpoch)return;
    if(section!=='advanced')guide=root.CxxMirrorGuide.mount({win:top,host:panel,section,onBack:()=>{if(!ended)open();},onComplete:id=>{try{const value=JSON.parse(top.localStorage.getItem('cxx-mirror-lessons-v2')||'{}');value[id]=true;top.localStorage.setItem('cxx-mirror-lessons-v2',JSON.stringify(value));}catch{}}});
   }catch(e){if(token===configureEpoch)top.document.getElementById('jingyi-translator-panel-host')?.shadowRoot?.querySelector('.jy-close')?.click();restore();if(!ended&&token===configureEpoch){publish({...state,message:e.message});open();}throw e;}
  }
  function close(){dialog?.close?.();dialog?.remove();dialog=null;previous?.isConnected&&previous.focus?.({preventScroll:true});}
  function paint(){if(!dialog)return;dialog.replaceChildren();const doc=top.document,el=(tag,text,parent=dialog)=>{const n=doc.createElement(tag);if(text)n.textContent=text;parent.append(n);return n;};
   el('style',root.CxxMirrorSetupStyle||'');el('h2','翻译与声音');el('p',enabled()?'选一项，跟着操作，马上试用。':'本故事正在使用原文阅读。开启后可使用译文、朗读与通话。');el('p',state.message).setAttribute('role','status');
   const cards=el('div');cards.className='mirror-goals';const button=(label,fn,parent)=>{const b=el('button',label,parent);b.type='button';b.onclick=()=>Promise.resolve().then(fn).catch(e=>publish({...state,message:e.message}));return b;};
   if(!enabled()){button('为本故事开启镜译',async()=>{await enable();paint();},cards);}
   else if(state.kind==='ready'){
    const goals=[['translation','看译文',state.translation?.bodyTags?.includes('cxx-story')?'正文范围已连接 · '+(state.translation.targetLanguage||'目标语言待选'):'选择目标语言，复用当前酒馆连接。'],['voice','听角色说话',state.read?'朗读已就绪，点击台词旁的麦克风即可。':state.reason||'连接音源，选好音色，再听一句。'],['call','语音通话',state.stream?(state.mic?.available?'声音与语音输入已就绪':'声音已就绪；语音输入待设置，仍可打字'):state.streamReason||'可选功能，先设置通话声音与语音输入。']];
    let learned={};try{learned=JSON.parse(top.localStorage.getItem('cxx-mirror-lessons-v2')||'{}');}catch{}
    for(const [id,title,description]of goals){const card=button('',()=>configure(id),cards);el('strong',title,card);el('span',description,card);el('b',learned[id]?'重新练习 →':'开始引导 →',card);}
   }else{el('p','可以先继续阅读原文，翻译与声音随时回来设置。');if(state.kind==='missing'&&state.canInstall||['disabled','loading'].includes(state.kind))button(state.kind==='disabled'?'启用并加载镜译':'安装并启用镜译',install,cards);else button('打开扩展管理',()=>{const b=top.document.getElementById('extensions_details');if(!b)throw Error('请从酒馆工具栏打开扩展管理器。');close();b.click();},cards);}
   const nav=el('nav');if(state.kind==='ready')button('镜译完整设置',()=>configure(),nav);button('重新检查',check,nav).disabled=state.kind==='installing';button('稍后设置，返回游戏',close,nav);
   const hint=el('p','入口：游戏菜单 → 设置 → 翻译与声音。全局自动翻译、自动朗读在镜译完整设置中单独管理；本引导保留现有自动开关。');hint.className='mirror-footnote';
  }
  function open(){if(ended)return;if(!dialog){previous=top.document.activeElement;dialog=top.document.createElement('dialog');dialog.className='cxx-mirror-setup';dialog.setAttribute('aria-label','镜译安装与设置');dialog.oncancel=e=>{e.preventDefault();close();};top.document.body.append(dialog);paint();dialog.showModal();}void check();}
  function dismiss(){configureEpoch++;close();guide?.destroy();guide=null;top.document.getElementById?.('jingyi-translator-panel-host')?.shadowRoot?.querySelector('.jy-close')?.click();restoreLayers?.();}
  listeners.add(paint);try{const pending=JSON.parse(top.sessionStorage.getItem('cxx-mirror-install-return')||'null'),c=top.SillyTavern?.getContext();if(pending&&pending.avatar===c?.characters?.[c.characterId]?.avatar&&Date.now()-pending.at<120000){top.sessionStorage.removeItem('cxx-mirror-install-return');top.setTimeout(async()=>{if(ended)return;try{if(pending.chat&&top.SillyTavern?.getContext().getCurrentChatId?.()!==pending.chat)await top.__cxx_stories__?.store.switchStory(pending.chat);if(!ended)open();}catch(e){publish({kind:'error',message:'镜译已重新加载，但返回故事失败：'+e.message});open();}},500);}}catch{}return {check,install,configure,open,dismiss,read:()=>({...state}),subscribe(fn){listeners.add(fn);fn({...state});return()=>listeners.delete(fn);},destroy(){ended=true;dismiss();listeners.clear();}};
 }
 return {create,REPO};
});
