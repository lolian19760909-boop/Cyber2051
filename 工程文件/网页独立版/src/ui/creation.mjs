/** Reuse the maintained six-step creator. Only persistence and host-only services are adapted. */
import { newId } from '../core/ids.mjs';
import { parseReply } from '../app/parse.mjs';
import {openingAction} from '../app/opening.mjs';
import { appUrl } from '../platform/paths.mjs';
import {sourceScripts,sourceText} from './source.mjs';
const url=file=>appUrl('card/'+file.split('/').map(encodeURIComponent).join('/'));
async function json(file){const response=await fetch(url(file));if(!response.ok)throw new Error('开局数据读取失败：'+file);return response.json();}
async function text(file){const response=await fetch(url(file));if(!response.ok)throw new Error('开局样式读取失败：'+file);return response.text();}
let resourcesReady;
export function prepareCreation(){return resourcesReady??=(async()=>{
  const data=Promise.all([json('开场/groups.json'),json('开场/catalog.json'),json('运行时/menu-assets.json'),text('运行时/opening-ui.css'),text('运行时/creator-ui.css'),text('运行时/loadout-setup.css'),text('运行时/talent-ui.css')]);
  const files=['crypto-compat','gameplay','player-assets','player-art','identity','appearance','story-profile','item-art','creator-ui','loadout-setup','talents','talent-ui','visual-projects','opening-flow','opening-ui'].map(file=>file==='opening-flow'?'@opening-ui/opening-flow.js':'运行时/'+file+'.js').concat('MVU/openings.js');
  const [,result]=await Promise.all([sourceScripts(files,{adapted:new Set(['creator-ui','talent-ui','opening-ui'].map(file=>'运行时/'+file+'.js'))}),data]);
  return result;
})();}
export async function mountCreation({parent,session,statePort,contentVersion,gameSetup,onSetup,onComplete,onError,isCurrent=()=>true}){
  globalThis.__cxxStandaloneUI=true;
  const {wireFeedback}=await import(appUrl('opening-ui/feedback.mjs'));
  const [groups,catalog,menuArt,css,creatorCSS,loadoutCSS,talentCSS]=await prepareCreation();
  if(!isCurrent())return {destroy(){}};
  Object.assign(globalThis,{CxxOpeningGroups:groups,CxxOpeningCatalog:catalog,CxxMenuArt:menuArt,CxxCreatorStyle:creatorCSS,CxxLoadoutSetupStyle:loadoutCSS,CxxTalentStyle:talentCSS});
  const originalProfile=globalThis.CxxStoryProfile;
  // Do not ask an independent page to import ST's personas module.
  globalThis.CxxStoryProfile={...originalProfile,currentAvatar:async()=>'',hostPersona:()=>''};
  let view,previewNode,disposed=false,createdNode=null,frame=null,previewId=null,previewEpoch=0,bandId=null,personId=null,pendingCommand=null,authoredText='',stopAssets=null,stopSounds=null,stopSetup=null;
  const identity=globalThis.CxxIdentity,Flow=globalThis.CxxOpeningFlow;
  const flow=Flow.create({key:session.identity.runId,scope:{instanceId:session.identity.mode+':'+session.identity.accountId,slot:session.identity.runId},identity,loadout:globalThis.CxxLoadout,storage:localStorage,
    readIdentity:()=>null,readPreferences:()=>({device:'auto',level:'medium',gal:true,mirror:false}),readProfile:()=>originalProfile.seed(window),readOpening:id=>groups.beginnings.find(row=>row.id===id)?.text||'',prepare:async()=>{},
    async submit(selection){
      const head=await statePort.readHead(session.identity.runId),operationId='creation:'+selection.creationId,nodeId='opening_'+selection.creationId;
      const existing=await statePort.readReceipt(session.identity.runId,operationId);
      if(existing){createdNode=existing.nodeId;return;}
      if(head.headNodeId)throw new Error('此故事已有正式开局，请返回继续，或新建故事');
      const value={...selection.value,setupToken:selection.creationId};
      const initial=globalThis.CxxPlayerOperations.plan(session.rules.emptyRoot(),{action:'initialize'},{identity:value,newChat:true});
      initial.__cxx_identity=value;
      value.openingScenario=selection.swipe;if(selection.openingText!==undefined)value.openingKind='written';
      const profile={...originalProfile.normalize(selection.profile),origin:{id:value.id,name:value.name,background:value.background},preferences:selection.preferences,opening:{id:selection.draft.scenario,title:catalog.find(c=>c.id===selection.draft.scenario)?.title||groups.beginnings.find(c=>c.id===selection.draft.scenario)?.title||'自己写第一幕'}};
      const media=[];
      if(profile.portraitUpload){if(profile.portrait?.kind!=='asset'||profile.portrait.id!==profile.portraitUpload.id)throw Error('人物立绘与图片资源不一致。');await globalThis.CxxItemArt.merge(null,[profile.portraitUpload]);media.push({...profile.portraitUpload,mediaId:profile.portraitUpload.id});delete profile.portraitUpload;}
      const opening=String(selection.openingText??authoredText).replaceAll('{{user}}',profile.name);
      if(!opening.trim())throw new Error('所选开场没有正文');
      const parsed=parseReply('<cxx-story>'+opening+'</cxx-story>',{parser:session.coordinator.context.parsed?.parser||globalThis.CxxGalParser});
      const command=selection.draft.pendingCommand,result=await statePort.commit({...session.identity,operationId,expectedRevision:head.revision,nodeId,parentNodeId:null,profile,media,contentVersion,stateAfter:initial,beforeState:session.rules.emptyRoot(),message:{role:'assistant',kind:'opening',raw:parsed.raw,display:parsed.display,input:null,creationId:selection.creationId,...(gameSetup?{gameSetup:structuredClone(gameSetup)}:{}),...(command?{openingCommand:true}:{}),openingAction:openingAction({command,direct:Flow.isDirect(selection.draft.scenario)})},receipt:{kind:'creation',creationId:selection.creationId},createdAt:new Date().toISOString()});
      if(result.status==='conflict')throw new Error('另一页面已建立开局，请重新读取');
      createdNode=result.nodeId;
    },
    async verify(){if(!createdNode||!(await statePort.readNode(session.identity.runId,createdNode)))throw new Error('开局尚未保存完成');},send:async command=>{pendingCommand=command;},onFailure:onError,
    onComplete(){if(disposed)return;queueMicrotask(async()=>{try{await onComplete?.({pendingCommand,handoff:async()=>{await session.restore();destroy();}});}catch(error){onError?.(error);}});},
  });
  const preview={
    unmount(){clearPreview();previewNode?.replaceChildren();previewNode=null;},
    mount(node){previewNode=node;paintPreview();},refresh(){paintPreview();},
    confirm(){const id=flow.state().draft.scenario;if(Flow.isDirect(id))return flow.review();const row=catalog.find(c=>c.id===id),win=frame?.contentWindow;if(!row?.action||!win||previewId!==id||typeof win[row.action]!=='function')throw new Error('剧情预览还在读取，请稍候');const button=[...win.document.querySelectorAll('[onclick]')].find(node=>(node.getAttribute('onclick')||'').trim().startsWith(row.action+'('));if(!button)throw new Error('剧情开始按钮尚未就绪');return win[row.action].call(win,button);},
  };
  function paintPreview(){
    if(!previewNode)return;const id=flow.state().draft.scenario||1;if(previewId===id)return;clearPreview();previewId=id;const draft=flow.state().draft;previewNode.replaceChildren();
    if(id===1){directory();return;}
    if(!Flow.isDirect(id)){void showAuthored(id).catch(error=>flow.markError(error));return;}
    const back=document.createElement('button');back.type='button';back.textContent='← 开局目录';back.onclick=()=>flow.selectScenario(null);previewNode.append(back);
    const title=document.createElement('h3');title.textContent='出身开场';previewNode.append(title);
    for(const entry of groups.beginnings.filter(row=>row.id==='custom-opening'||row.id==='origin-'+draft.origin)){
      const button=document.createElement('button');button.type='button';button.className='opening-scenario-card';button.textContent=entry.title;button.setAttribute('aria-pressed',String(draft.scenario===entry.id));button.onclick=()=>flow.selectScenario(entry.id);previewNode.append(button);
    }
    if(draft.scenario==='custom-opening'){
      const label=document.createElement('label');label.textContent='第一幕正文';const field=document.createElement('textarea');field.setAttribute('aria-label','第一幕正文');field.value=draft.openingText||'';field.oninput=()=>flow.patch({openingText:field.value});label.append(field);previewNode.append(label);
    }else if(draft.scenario){const body=document.createElement('div');body.className='opening-written-preview';body.textContent=groups.beginnings.find(row=>row.id===draft.scenario)?.text||'';previewNode.append(body);}
  }
  function clearPreview(){previewEpoch++;if(frame){try{const controls=[...frame.contentDocument.querySelectorAll('input,textarea,select,[data-name],[data-action],.haru-char-pill,.fuyu-char-item')];flow.rememberScenario(previewId,{controls:controls.map(n=>({value:n.value,checked:n.checked,selected:n.classList.contains('selected'),pill:n.classList.contains('checked')})),action:frame.contentWindow.currentAction||'',scroll:frame.contentDocument.scrollingElement?.scrollTop||0});}catch{}frame.remove();}stopSounds?.();stopSounds=null;stopAssets?.();stopAssets=null;frame=null;previewId=null;}
  // Directory structure and class names follow MVU/openings.js:directory.
  function directory(){const pane=previewNode,doc=document,bands=groups.bands||[],band=bands.find(b=>b.id===bandId),person=band?.characters.find(c=>c.id===personId),el=(tag,text,parent,cls)=>{const n=doc.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;parent.append(n);return n;},button=(label,run,parent,cls)=>{const b=el('button',label,parent,cls);b.type='button';b.onclick=run;return b;},picture=(id,parent,cls)=>{const a=globalThis.CxxMenuArt?.entries?.[id],img=el('img',null,parent,cls);img.alt='';if(a){img.src=globalThis.CxxResources?.resolve(a.fallback||a.url)||(a.fallback||a.url);img.onerror=()=>{img.hidden=true;};}return img;};
    pane.replaceChildren();const crumbs=el('nav',null,pane,'opening-crumbs');button('选择乐队',()=>{bandId=null;personId=null;directory();},crumbs);if(band)button(band.name,()=>{personId=null;directory();},crumbs);if(person)el('span',person.name,crumbs);
    if(!band){const own=el('section',null,pane,'opening-own-scenes');el('h3','从你的出身开始',own);const choices=el('div',null,own,'opening-own-grid');for(const scene of groups.beginnings){if(scene.origin!==flow.state().draft.origin)continue;const b=button(scene.title,()=>flow.selectScenario(scene.id),choices,'opening-scene-card');el('small',scene.location,b);}button('自己写第一幕',()=>flow.selectScenario('custom-opening'),choices,'opening-scene-card');const grid=el('div',null,pane,'opening-band-grid');for(const b of bands){const card=button('',()=>{bandId=b.id;directory();},grid,'opening-band-card');picture(b.background,card,'opening-band-background');picture(b.hero,card,'opening-band-hero');const text=el('div',null,card,'opening-band-copy');el('small','CHOOSE YOUR STORY',text);el('h3',b.name,text);el('p',b.subtitle,text);el('b','走进她们的故事 →',text);}return;}
    if(!person){const grid=el('div',null,pane,'opening-character-grid');for(const c of band.characters){const card=button('',()=>{personId=c.id;directory();},grid,'opening-character-card');picture(c.id,card);el('strong',c.name,card);el('small',c.openings.length+' 个开局',card);}return;}
    const grid=el('div',null,pane,'opening-scene-grid');for(const id of person.openings){const row=catalog.find(c=>c.id===id);if(!row)continue;const card=button('',()=>flow.selectScenario(id),grid,'opening-scene-card');picture(person.id,card);const text=el('div',null,card);el('small','SCENE '+String(id).padStart(2,'0'),text);el('h3',row.title,text);el('p','与'+person.name+'相遇，查看剧情与开场选项。',text);el('b','查看详情 →',text);}}
  const priorOpeningHost=globalThis.Cxx236OpeningHost;
  globalThis.Cxx236OpeningHost={submitPreview(win,command){if(disposed||!frame||win!==frame.contentWindow||flow.state().draft.step!=='scenario')throw new Error('剧情预览已关闭');authoredText=win.document.querySelector('[data-opening-story]').innerText.trim();return flow.review(command);},selectPreview(win,id){if(win!==frame?.contentWindow)throw new Error('预览来源失效');flow.selectScenario(id);}};
  async function showAuthored(id){const epoch=previewEpoch,row=catalog.find(c=>c.id===id);if(!row)throw new Error('剧情编号不存在');let html=await sourceText('MVU/openings/'+String(id).padStart(2,'0')+'.html');if(disposed||epoch!==previewEpoch||!previewNode)return;const back=document.createElement('button');back.type='button';back.textContent='← 剧情目录';back.onclick=()=>flow.selectScenario(null);previewNode.append(back);frame=document.createElement('iframe');const current=frame;frame.title=row.title;frame.dataset.cxxOpeningPreview=id;frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.style.cssText='width:100%;min-height:480px;border:0;background:var(--cxx-canvas)';html=globalThis.Cxx236Openings.expandPersonaHTML(html,{name1:flow.state().draft.profile?.name||'旅人',substituteParams:text=>text});html=globalThis.CxxOpeningUI.detailHTML(html,id,document.documentElement.dataset.cxxTheme);current.onload=()=>{if(current!==frame)return;globalThis.CxxTheme?.attach(current.contentWindow);stopAssets=globalThis.CxxResources?.mount(current.contentDocument);stopSounds=wireFeedback(current.contentDocument,{playSound:globalThis.CxxOpeningPage.playSound});const saved=flow.restoreScenario(id),controls=[...current.contentDocument.querySelectorAll('input,textarea,select,[data-name],[data-action],.haru-char-pill,.fuyu-char-item')];saved.controls?.forEach((v,i)=>{const node=controls[i];if(!node)return;if(v.value!==undefined)node.value=v.value;if(v.checked!==undefined)node.checked=v.checked;node.classList.toggle('selected',v.selected);node.classList.toggle('checked',v.pill);});};current.srcdoc=html;previewNode.append(current);}
  view=globalThis.CxxOpeningUI.mount({document,flow,identity,setup:globalThis.CxxLoadoutSetup,css,preview,manageViewport:true});
  if(onSetup){const back=document.createElement('button');back.type='button';back.textContent='游戏版本与玩法';back.className='opening-back';back.onclick=onSetup;view.root.querySelector('.opening-footer').prepend(back);const sync=state=>{back.disabled=state.busy||state.status==='saved'||createdNode!==null;};sync(flow.state());stopSetup=flow.subscribe(sync);}
  view.root.style.height='calc(100dvh - var(--cxx-web-header-height,80px))';

  parent.replaceChildren(view.root);

  function destroy(){if(disposed)return;disposed=true;stopSetup?.();clearPreview();view?.destroy();flow.destroy();globalThis.CxxStoryProfile=originalProfile;globalThis.Cxx236OpeningHost=priorOpeningHost;}
  return {flow,destroy};
}
