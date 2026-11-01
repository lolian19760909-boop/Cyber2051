import {createBulletin} from '../src/ui/bulletin.mjs';
/** Complete opening surface. Business actions are supplied by adapters.mjs. */
export function createWebShell({win=window,parent=win.document.body,assets,actions,visuals}){
  const doc=win.document,root=doc.createElement('section');root.className='cxx-game-menu';root.dataset.page='home';root.tabIndex=-1;root.setAttribute('aria-label','东京都2051 游戏主菜单');
  parent.append(root);if(root.showPopover){root.setAttribute('popover','manual');root.showPopover();}
  const shell=doc.createElement('div');shell.className='game-shell';root.append(shell);
  let homeStamp=null,stories=[],ready=false,creation=null,archive=null,disposed=false,transitioning=false,transitionView=null;
  const n=(tag,text,parent,cls)=>{const el=doc.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;parent.append(el);return el;};
  const button=(text,fn,parent,cls)=>{const b=n('button',text,parent,cls);b.type='button';b.onclick=fn;return b;};

  const bulletin=createBulletin({win,assets});
  async function showBulletin(automatic=false){const status=shell.querySelector('.game-status');if(!automatic&&status)status.textContent='正在读取公告…';try{await bulletin.open({automatic});if(status)status.textContent='';}catch(error){if(!automatic&&status)status.textContent='公告读取失败：'+error.message;}}
  function maybeNotice(){if(disposed||!ready)return;void showBulletin(true);}
  function frame(page){root.dataset.page=page;shell.replaceChildren();const image=n('img',null,shell,'game-backdrop');image.src=assets.city;image.alt='';n('div',null,shell,'game-shade');const layout=n('div',null,shell,'game-layout'),head=n('header',null,layout,'game-heading');const h=n('h1',null,head);h.setAttribute('aria-label','Tokyo 2051');h.className='game-has-wordmark';const logo=n('img',null,h,'game-wordmark');logo.src=assets.logo;logo.alt='Tokyo 2051';const foot=()=>{const f=n('footer',null,layout,'game-footer');n('span','TOKYO 2051',f);const status=n('p','',f,'game-status');status.setAttribute('role','status');return f;};return {layout,foot};}
  function home(){const stamp=JSON.stringify([stories,actions.canCreate?.(),actions.needsLogin?.()]);if(root.dataset.page==='home'&&homeStamp===stamp&&shell.childElementCount)return;homeStamp=stamp;const {layout,foot}=frame('home'),nav=n('nav',null,layout,'game-navigation');nav.setAttribute('aria-label','游戏主菜单');const last=stories.find(x=>x.playable)||stories[0];const play=button(last?.creating?'继续创建人物':'继续游戏',()=>transition(()=>actions.play(last.id)),nav,'game-primary');play.disabled=!last;const small=n('small',last?.title||'暂无存档',play);button('新游戏',()=>transition(()=>actions.create()),nav).disabled=actions.canCreate?.()===false;button('读取存档',openStories,nav).disabled=actions.needsLogin?.()===true;button('设置',()=>actions.openSettings(),nav);button('公告与指南',()=>showBulletin(false),nav);if(actions.needsLogin?.())button('登录',()=>{hide();actions.login();},nav);button('返回',()=>actions.leave(),nav,'game-quiet');const recent=n('aside',null,layout,'game-resume');n('p','最近存档',recent,'game-kicker');n('h2',last?.title||'暂无存档',recent);if(last?.excerpt)n('p',last.excerpt,recent,'game-location');foot();}
  async function transition(action,{reuse=false}={}){
    if(disposed)return;if(transitioning)return reuse?action():undefined;transitioning=true;root.setAttribute('aria-busy','true');
    try{transitionView=await visuals.loading(root);await new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)));await action();await new Promise(resolve=>win.requestAnimationFrame(resolve));}
    catch(error){home();shell.querySelector('.game-status').textContent=error.message;}
    finally{transitionView?.destroy();transitionView=null;transitioning=false;root.removeAttribute('aria-busy');}
  }
  async function refresh(){stories=await actions.listStories();if(root.dataset.page==='home')home();return stories;}
  async function openStories(){root.hidden=false;if(root.showPopover&&!root.matches(':popover-open'))root.showPopover();archive?.destroy();archive=await actions.mountArchive(root,()=>{archive?.destroy();archive=null;home();});}
  const boot=n('section',null,root,'cxx-boot');boot.setAttribute('aria-busy','true');const footer=n('div',null,boot,'cxx-boot-footer'),caption=n('span','正在准备游玩',footer,'cxx-boot-caption'),detailEl=n('span','',footer,'cxx-boot-detail'),percent=n('span','0%',footer,'cxx-boot-percent');
  const resourceHeading=n('div',null,footer,'fusion-load-heading');footer.prepend(resourceHeading);n('span','LOADING',resourceHeading,'fusion-load-label');
  const resourceButton=button('',()=>{},resourceHeading,'game-resource-action');resourceButton.hidden=true;
  resourceButton.style.setProperty('--pause-texture','url("'+assets.controls.pause+'")');resourceButton.style.setProperty('--play-texture','url("'+assets.controls.play+'")');
  const resourceIcon=n('i',null,resourceButton);resourceIcon.setAttribute('aria-hidden','true');
  home();visuals.attach(root);
  function show(){if(disposed)return;root.hidden=false;if(root.showPopover&&!root.matches(':popover-open'))root.showPopover();home();void refresh();maybeNotice();}
  function hide(){archive?.destroy();archive=null;bulletin.close();if(root.hidePopover&&root.matches(':popover-open'))root.hidePopover();root.hidden=true;}
  function creationTarget(){creation?.destroy?.();creation=null;root.hidden=false;if(root.showPopover&&!root.matches(':popover-open'))root.showPopover();const {layout,foot}=frame('create'),main=n('main',null,layout,'game-creation'),head=n('div',null,main,'game-create-heading');n('span','NEW GAME',head);button('返回主菜单',()=>{actions.cancelCreation();home();},head,'game-quiet');const target=n('div',null,main,'game-create-body');foot();return target;}
  function openingIssue(message,retry,reply){
    root.hidden=false;if(root.showPopover&&!root.matches(':popover-open'))root.showPopover();
    const {layout,foot}=frame('opening'),main=n('main',null,layout,'game-navigation');
    n('h2','开始故事',main);n('p',message,main,'game-opening-issue');
    if(reply){const detail=n('details',null,main,'game-opening-reply');n('summary','查看回复原文',detail);n('p','收到 '+reply.raw.length+' 字符 · 解析正文 '+reply.paragraphs+' 段 · '+reply.completion,detail);const raw=n('textarea',null,detail);raw.value=reply.raw;raw.readOnly=true;raw.rows=10;raw.setAttribute('aria-label','模型回复原文');if(reply.warnings.length)n('p',reply.warnings.join('；'),detail);}
      const diagnostic=n('details',null,main,'game-opening-diagnostic');n('summary','查看脱敏诊断',diagnostic);
      if(reply?.diagnostics){const serialized=JSON.stringify(reply.diagnostics,null,2);n('p','只含响应类型、字段类型、长度与结束原因；不含密钥、请求头、提示词或回复正文。',diagnostic);const pre=n('pre',serialized,diagnostic);pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:35vh;overflow:auto';button('导出脱敏诊断',()=>{const blob=new Blob([serialized],{type:'application/json'}),url=URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download='东京都2051-开局脱敏诊断.json';link.click();win.setTimeout(()=>URL.revokeObjectURL(url),1000);},diagnostic,'game-quiet');}
      else n('p','这次失败未记录响应诊断。更新前的失败无法补录；不会自动重试或调用模型。',diagnostic);
      button('设置正文模型',()=>actions.openSettings('connection'),main,'game-primary');
    button('重试开局',retry,main);button('返回主菜单',show,main,'game-quiet');foot();
  }
  return {root,show,hide,refresh,creationTarget,openStories,openingIssue,
    resourceAction(text,action){resourceButton.hidden=!text;resourceButton.dataset.action=text==='继续下载'?'resume':'pause';resourceButton.setAttribute('aria-label',text||'暂停下载');resourceButton.title=text||'';resourceButton.disabled=false;resourceButton.onclick=()=>{resourceButton.disabled=true;action();};},
    progress({fraction,text='正在准备游玩',detail='',current,total}){const nextDetail=detail||(Number.isFinite(current)&&Number.isFinite(total)?current+' / '+total:''),nextPercent=Number.isFinite(fraction)?Math.round(fraction*100)+'%':'';if(caption.textContent!==text)caption.textContent=text;if(detailEl.textContent!==nextDetail)detailEl.textContent=nextDetail;if(percent.textContent!==nextPercent)percent.textContent=nextPercent;const note=[text,detail].filter(Boolean).join(' · ');transitionView?.update({fraction:Number.isFinite(fraction)?fraction:null,text:note,detailText:note});},
    failure(message){caption.textContent=message;percent.textContent='';boot.setAttribute('aria-busy','false');button('重新加载',()=>win.location.reload(),boot,'game-quiet');button('返回官网',()=>actions.leave(),boot,'game-quiet');},
    async ready(){await refresh();await new Promise(resolve=>win.requestAnimationFrame(resolve));ready=true;percent.textContent='100%';boot.setAttribute('aria-busy','false');boot.remove();maybeNotice();},
    enteredGame(){if(ready){transitionView?.destroy();transitionView=null;hide();}},
    transition,
    destroy(){disposed=true;transitionView?.destroy();archive?.destroy();creation?.destroy?.();bulletin.destroy();root.remove();},
  };
}
