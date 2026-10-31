(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxHubUI=api;})(globalThis,function(root){
 'use strict';
 const sections=[['characters','人物','属性 · 装配'],['city','城市','地图 · 地点'],['operations','委托','目标 · 日志'],['network','通讯','联系人 · 邮件 · 城市消息'],['archive','资料','世界 · 记录']];
 function records(stat={},quest=null,overview={}){
  const recent=[...(overview.memories||[])].sort((a,b)=>(b.source?.floor??-1)-(a.source?.floor??-1)).slice(0,3),people=overview.people||[],main=overview.main;
  return [
   {id:'reputation',label:'最近经历',empty:!recent.length,summary:recent[0]?.summary?.slice(0,40)||'还没有经历记录',lines:recent.length?recent.map(r=>(r.kind==='玩家手记'?'玩家手记 · '+r.sourceType+'：':'')+r.body.slice(0,180)):['在长期记忆中记录一次经历，或写下你的手记。'],target:'memory',tab:'记忆',action:'打开长期记忆'},
   {id:'bonds',label:'人物往来',empty:!people.length,summary:people.slice(0,2).map(r=>r.人物||r.name).filter(Boolean).join('、')||'还没有人物往来记录',lines:people.length?people.slice(-3).map(r=>Object.entries(r).filter(([k])=>!['来源','row_id','id','avatar','unlocks'].includes(k)).map(([,v])=>String(v)).join(' · ').slice(0,200)):['已记录的人物经历与联系人会显示在这里。'],target:'memory',tab:'人物与承诺',action:'查看人物经历'},
   {id:'story',label:'当前主线',empty:!main,summary:main?.title||'尚未展开主线',lines:main?[main.stage?'当前阶段：B'+String(main.stage).padStart(2,'0'):'当前主线：'+main.title,'状态：'+main.state,main.facts].filter(Boolean):['自由探索，主线展开后在这里查看已发生的进展。'],target:'memory',tab:'剧情',action:'查看剧情进度'}
  ];
 }
 // A recorded place, or null when the story has not written one yet.
 const placeOf=scene=>{const name=typeof scene?.location==='string'?scene.location.trim():'';return name&&name!=='地点未记录'?{name,time:typeof scene.time==='string'?scene.time.trim():''}:null;};
 // Pause-menu hub (DESIGN.md 10.7): a solid rail with the menu, and the current place's scene on the right.
 function mount({doc,parent,art=root.CxxHubArt||{},identity={},game={},stat={},load=null,yen=null,story='',quest=null,overview={},scene=null,active='',openMemory=()=>{},navigate=()=>{},resume=()=>{},save=()=>{},settings=()=>{},title=()=>{},home=()=>{}}){
  const n=(tag,text,p,cls)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;p.append(e);return e;};
  const button=(text,fn,p,cls)=>{const b=n('button',text,p,cls);b.type='button';b.onclick=fn;return b;};
  const win=doc.defaultView;
  parent.classList.add('cxx-hub-boundary');
  const shell=n('section',null,parent,'cxx-hub'),rail=n('aside',null,shell,'hub-rail');
  const brand=n('div',null,rail,'hub-brand');
  if(art.wordmark){const img=n('img',null,brand,'hub-logo');img.alt='Tokyo 2051';img.src=art.wordmark;img.onerror=()=>{img.hidden=true;n('span','Tokyo 2051',brand,'hub-brand-text');};}else n('span','Tokyo 2051',brand,'hub-brand-text');
  const who=n('div',null,rail,'hub-who'),whoName=n('strong','',who,'hub-name'),whoRole=n('span','',who,'hub-role'),whoLevel=n('span','',who,'hub-level');
  const go=button('',resume,rail,'hub-continue');n('strong','继续阅读',go);const goPlace=n('small','',go);go.setAttribute('aria-label','继续阅读');goPlace.id='cxx-hub-continue-place';go.setAttribute('aria-describedby',goPlace.id);
  function glyph(p,id){const src=art.icons?.[id];if(!src)return;const i=n('img',null,p);i.alt='';i.src=src;i.setAttribute('aria-hidden','true');}
  const nav=n('nav',null,rail,'hub-entry-grid');nav.setAttribute('aria-label','游戏分区');
  for(const [id,label,desc]of sections){const b=button('',()=>navigate(id),nav);b.dataset.section=id;b.setAttribute('aria-label',label+' · '+desc);glyph(b,id);n('strong',label,b);n('small',desc,b);}
  const footer=n('footer',null,rail,'hub-footer');button('存档 / 读档',save,footer);button('设置',settings,footer);button('返回标题',title,footer,'hub-title');const note=n('p','',footer,'hub-save-status');note.setAttribute('role','status');
  const motion=root.CxxMotion?.mount(shell);
  const content=n('main',null,shell,'hub-content'),welcome=n('section',null,content,'hub-home');
  const sceneImg=n('img',null,welcome,'hub-scene');sceneImg.alt='';sceneImg.setAttribute('aria-hidden','true');
  const top=n('div',null,welcome,'hub-scene-top'),place=n('p',null,top,'hub-place');n('span','现在位置',place);const placeName=n('strong','',place),placeTime=n('span','',place,'hub-place-time');
  const status=n('div',null,top,'hub-status');
  function updateStatus(value){
   const identity=value.identity||{},game=value.game||{};whoName.textContent=identity.name||'旅人';whoRole.textContent=game.origin?.name||'';whoRole.hidden=!whoRole.textContent;whoLevel.textContent='LV '+(game.growth?.level??'—');
   status.replaceChildren();
   for(const row of [{id:'load',label:'改造负荷',value:value.load??'—'},{id:'money',label:'日元',value:Number.isFinite(value.yen)?value.yen.toLocaleString('zh-CN'):'—'}]){const box=n('div',null,status,'hub-stat hub-stat-'+row.id),line=n('div',null,box,'hub-stat-line');if(art.statusArt?.[row.id]){const img=n('img',null,line,'hub-stat-icon');img.alt='';img.src=art.statusArt[row.id];}n('strong',row.value,line);n('span',row.label,line);if(row.id==='load')box.title='已装义体的累计负荷；本卡没有容量上限。';}
  }
  updateStatus({identity,game,load,yen});
  // The scene follows the latest floor's place through the Gal background index. Until it
  // decodes, and when no place is recorded, the title page's city view stands in.
  let sceneTurn=0;
  function showScene(value){
   const city=win.CxxMenuArt?.entries?.city,turn=++sceneTurn,fallback=city?.fallback||art.background||art.fallback||'';
   if(!sceneImg.getAttribute('src')&&fallback)sceneImg.src=fallback;
   let url='';try{const s=placeOf(value.scene);url=s?win.__cxx_gal_g1__?.background?.({location:s.name,time:s.time})?.url||'':'';}catch{}
   if(!url)url=city?.url||'';
   if(!url){if(fallback&&sceneImg.getAttribute('src')!==fallback)sceneImg.src=fallback;return;}
   const resources=win.CxxResources||root.parent?.CxxResources;
   Promise.resolve(resources?resources.acquire(url):{url,release(){}}).then(async lease=>{try{if(turn!==sceneTurn||!sceneImg.isConnected)return;const full=new win.Image();full.src=lease.url;await full.decode();if(turn===sceneTurn&&sceneImg.isConnected)sceneImg.src=full.src;}finally{lease.release?.();}}).catch(()=>{});
  }
  const bottom=n('div',null,welcome,'hub-scene-bottom'),triptych=n('section',null,bottom,'hub-dossiers');triptych.setAttribute('aria-label','旅程摘要');
  const q=n('article',null,bottom,'hub-quest');n('p','当前追踪',q,'hub-eyebrow');const qTitle=n('h3','',q),qStage=n('p','',q,'hub-quest-stage'),qGoal=n('p','',q,'hub-quest-goal'),qAction=button('',()=>navigate('operations'),q);
  function updateRecords(value){
   stat=value.stat||{};quest=value.quest||null;
   const where=placeOf(value.scene);place.hidden=!where;placeName.textContent=where?.name||'';placeTime.textContent=where?.time||'';goPlace.textContent=where?'回到'+where.name:(value.story||'回到故事');
   showScene(value);
   triptych.replaceChildren();
   for(const card of records(stat,quest,value.overview)){let b;const open=()=>{const dialog=n('dialog',null,shell,'hub-record-dialog');dialog.setAttribute('aria-label',card.label);let closing=false;const dismiss=action=>{if(closing)return;closing=true;const done=()=>{const connected=dialog.isConnected;dialog.close();dialog.remove();if(!connected)return;if(action)action();else b.focus({preventScroll:true});};if(motion?.available)void motion.presence(dialog,false).then(done);else done();};n('p','故事记录',dialog,'hub-eyebrow');n('h2',card.label,dialog);for(const line of card.lines)n('p',line,dialog);button(card.action,()=>dismiss(()=>{if(card.target==='memory')openMemory(card.tab);else navigate(card.target);}),dialog);button('返回',()=>dismiss(),dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();dismiss();});dialog.showModal();void motion?.presence(dialog,true);};
    b=button('',open,triptych,'hub-dossier-card');b.dataset.empty=String(card.empty);const illustration=n('span',null,b,'hub-dossier-illustration'),asset=art.dossiers?.[card.id];
    if(asset){const i=n('img',null,illustration);i.alt='';i.src=asset.fallback||asset.url;i.onerror=()=>{i.remove();};if(asset.url){const resources=win.CxxResources||root.parent?.CxxResources;Promise.resolve(resources?resources.acquire(asset.url):{url:asset.url,release(){}}).then(async lease=>{try{if(!i.isConnected)return;const full=new win.Image();full.src=lease.url;await full.decode();if(i.isConnected)i.src=full.src;}finally{lease.release();}}).catch(()=>{});}}
    n('span',card.label,b,'hub-dossier-label');n('strong',card.summary,b,'hub-dossier-name');}
   const main=value.overview?.main;
   qTitle.textContent=quest?.title||'选择你的下一份委托';qStage.textContent=quest&&main&&main.title===quest.title&&main.stage?'第 '+main.stage+' 段 · '+(main.state||''):'';qStage.hidden=!qStage.textContent;
   qGoal.textContent=quest?.goal||'到委托日志查看已有目标，选择一项开始追踪。';qAction.textContent=quest?'查看委托':'打开委托日志';
  }
  updateRecords({stat,quest,story,overview,scene});
  const pane=n('section',null,content,'hub-pane');pane.hidden=true;const breadcrumb=n('div',null,pane,'hub-breadcrumb');button('‹ 游戏菜单',home,breadcrumb);const label=n('span','',breadcrumb);const container=n('div',null,pane,'hub-pane');
  function select(id){const previous=welcome.hidden?pane:welcome,next=id?pane:welcome,from=motion?.capture(previous);for(const b of nav.children){if(b.dataset.section===id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}welcome.hidden=!!id;pane.hidden=!id;label.textContent=sections.find(x=>x[0]===id)?.[1]||'';shell.dataset.section=id||'hub';if(previous!==next)void motion?.navigate(previous,next,{from,container:content,direction:id?1:-1});}
  // One entrance at rest: the menu items and the quest card reveal once; keyboard entry is immediate.
  const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(motion?.available){for(const [i,target] of [go,...nav.children,q].entries())void motion.animate(target,[{opacity:.2,transform:'translateX(-10px)'},{opacity:1,transform:'none'}],{channel:'entry',duration:200,delay:i*16,fill:'backwards'});}
  else if(!reduced&&!doc.activeElement?.matches?.(':focus-visible')){
   const targets=[go,...nav.children,q];
   for(const [i,target] of targets.entries())target.animate?.([{opacity:0,transform:'translateX(-12px)'},{opacity:1,transform:'none'}],{duration:200,delay:Math.min(i*24,144),fill:'backwards',easing:'cubic-bezier(.23,1,.32,1)'});
  }
  select(active);return {root:shell,container,note,select,updateStatus,updateRecords,destroy(){sceneTurn++;motion?.dispose();}};
 }
 return {mount,sections,records};
});
