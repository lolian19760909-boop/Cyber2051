(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxTalentUI=api;})(globalThis,function(root){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const Popover=typeof module==='object'&&module.exports?require('../共享/popover.js'):globalThis.CxxPopover;
  const icons={body:'body-d1fe68db.png',reflexes:'reflexes-23a0a79d.png',intelligence:'intelligence-b811d04f.png',technical:'tech-2d71880a.png',cool:'cool-99bb085f.png'};
  const frames={master:{locked:'tile-master-locked-3c2ba3f9.png',not_connected:'tile-master-locked-3c2ba3f9.png',available:'tile-master-available-1322f2e3.png',maxed:'tile-master-maxed-472133c0.png'},milestone:{locked:'tile-milestone-locked-12fa8d8c.png',not_connected:'tile-milestone-not_connected-83210518.png',available:'tile-milestone-available-64da32d1.png',invested:'tile-milestone-invested-f0e6d754.png',maxed:'tile-milestone-maxed-edc31f05.png'},perk:{locked:'tile-perk-locked-9e403d87.png',not_connected:'tile-perk-not_connected-868232fc.png',available:'tile-perk-available-75e21c7b.png',maxed:'tile-perk-maxed-2ca6eb4f.png'}};
  const atlas={locked:'not_connected-dff9bee3.png',not_connected:'not_connected-dff9bee3.png',available:'available-88b3fa9e.png',invested:'maxed-9a8780b7.png',maxed:'maxed-9a8780b7.png'};
  const cables={not_connected:'not_connected-71149b76.png',available:'available-7e42d897.png',maxed:'maxed-ab33beb4.png'};
  const sizes={master:[380,336],milestone:[236,236],perk:[140,148]};
  function styles(url){return (root.CxxThemeCSS||'')+(root.CxxTalentStyle||'').replace(/cxx-talent-asset:([A-Za-z0-9._-]+)/g,(_,file)=>url(file));}
  function mount({document:doc=root.document,parent,talents:T=root.CxxTalents,effectRules=root.CxxTalentEffects,state,initial,identityName='',onApply,onInitialize,assets=root.CxxTalentAssets,assetBase='',preview=false,awaitingSave=false,saveNotice='',localSave=false,draftBuild=null,fullscreen=false,onClose=()=>{},viewState={},allowRepair=true,readGame=()=>null,readSavedGrowth=saved=>saved.stat.terminal.gameplay.growth,onOpenTree=null,appearanceStyle='',native2x=false}){
    if(fullscreen&&!native2x){doc=(doc.defaultView.parent||doc.defaultView).document;parent=doc.body;}const win=doc.defaultView,host=doc.createElement('div');host.className='cxx-talent-host';parent.append(host);if(fullscreen){host.setAttribute('popover','manual');host.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;background:var(--cxx-ink);z-index:2147483646';Popover.show(host);}let stopOrientation=fullscreen?win.CxxEntryExperience?.attach(win,host):null;
    let stopResources;const shadow=(queueMicrotask(()=>{const owner=doc.defaultView.parent||doc.defaultView;const stop=owner.CxxResources?.mount(host.shadowRoot);if(native2x&&fullscreen){stopResources=stop;return;}if(stop){const watch=new doc.defaultView.MutationObserver(()=>{if(!host.isConnected){watch.disconnect();stop();}});watch.observe(doc,{childList:true,subtree:true});}}),host.attachShadow({mode:'open'})),url=name=>assets?.[name]||(assetBase?assetBase+name:'https://www.cyberpunk.net/build/'+(name.endsWith('.woff2')?'fonts/':'images/')+name);
    const el=(tag,cls,text,parent)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;parent?.append(e);return e;};
    const style=el('style','',styles(url)+'\n'+appearanceStyle,shadow),shell=el('section','shell',undefined,shadow);shell.setAttribute('aria-label','人物成长与天赋');if(onOpenTree)shell.dataset.cp2Profile='';if(native2x)shell.dataset.cp2Tree='';
    let stopTheme;if(native2x){shell.dataset.cp2Theme=win.CxxTheme.read();stopTheme=win.CxxTheme.subscribe(()=>{shell.dataset.cp2Theme=win.CxxTheme.read();});}
    let base=state?T.read(state):null,draft=base?T.build(base):null,tree=onOpenTree?null:viewState.tree??(fullscreen?'body':null),selected=viewState.selected||null,screen='main',zoom=viewState.zoom||1,disposed=false,pending=awaitingSave,note=saveNotice,observer=null;
    if(base&&draftBuild)try{T.allocate(base,draftBuild);draft=structuredClone(draftBuild);}catch{note='存档已变化，原试配无法应用，已按当前存档重新加载。';}
    let toolbar,work,footer,detail,canvas,canvasBox,scroll,overview,overviewViewport,detailFrame=0,suppressFocus=false;
    const click=(text,fn,parent,cls='small-button')=>{const b=el('button',cls,text,parent);b.type='button';b.addEventListener('click',async e=>{if(pending||disposed)return;try{await fn(e);}catch(error){note=error.message;announce();}});return b;};
    function current(){return T.allocate(base,draft);}
    function announce(){const n=shadow.querySelector('.notice');if(n)n.textContent=note;}
    const undo=[];let pointer=null,dragged=false,savedBenefits=[];function updateDraft(kind,id,delta){undo.push(structuredClone(draft));draft=T.edit(base,draft,{kind,id,delta});savedBenefits=[];note='';render(true);}
    function feedbackGame(growth){const g=readGame();return g?{...g,growth}:null;}
    async function canLeave(){if(pending)return false;if(!dirty())return true;const choice=await win.CxxDraftExit.choose(shadow,'配点尚未保存');if(choice==='stay')return false;if(choice==='save')await saveDraft();return true;}
    function dirty(){return base&&JSON.stringify(T.build(base))!==JSON.stringify(draft);}
    function resize(){
      if(disposed)return;
      if(overview){
        const compact=!!onOpenTree&&host.clientWidth<680;
        if(onOpenTree){shell.dataset.cp2Compact=String(compact);overview.dataset.compact=String(compact);}
        if(compact){overview.style.transform='none';overview.style.top='0';overviewViewport.style.height='100%';}
        else{const scale=onOpenTree?Math.min(1,(host.clientWidth-24)/730,Math.max(.25,(work.clientHeight-20)/683)):Math.min(.72,Math.max(.25,(host.clientWidth-24)/762));overview.style.transform='translateX(-50%) scale('+scale+')';overviewViewport.style.height=onOpenTree?'100%':(820*scale+36)+'px';if(onOpenTree)overview.style.top=Math.max(0,(work.clientHeight-683*scale)/2)+'px';}
      }
      if(canvas&&scroll){const scale=Math.max(.32,scroll.clientWidth/3840)*zoom;canvas.style.setProperty("--tree-scale",String(scale));canvas.style.transform='scale('+scale+')';canvasBox.style.width=(3840*scale)+'px';canvasBox.style.height=(1830*scale)+'px';}
      queueDetail();
    }
    function closeDetail(){
      // dialog.close restores focus synchronously; the node focus handler must not
      // turn that restoration into another request to open this detail.
      const focus=native2x&&fullscreen?shadow.querySelector('.node[data-id="'+selected+'"]')||shadow.querySelector('.talent-close'):null;suppressFocus=true;selected=null;
      try{detail?.close?.();if(detail)detail.hidden=true;shadow.querySelectorAll('.node[data-selected=true]').forEach(b=>b.dataset.selected='false');focus?.focus({preventScroll:true});}
      finally{suppressFocus=false;}
    }
    function bindDetail(element){
      element.addEventListener('cancel',e=>{e.preventDefault();closeDetail();});
      element.addEventListener('click',e=>{if(e.target!==element||element.tagName!=='DIALOG')return;const r=element.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDetail();});
    }
    function detailMode(modal){
      if(!detail||detail.tagName===(modal?'DIALOG':'ASIDE'))return;
      const old=detail;suppressFocus=true;try{old.close?.();}finally{suppressFocus=false;}detail=doc.createElement(modal?'dialog':'aside');detail.className='detail';detail.setAttribute('aria-label','专长详情');detail.append(...old.childNodes);bindDetail(detail);old.replaceWith(detail);
    }
    function queueDetail(){if(disposed||detailFrame)return;detailFrame=win.requestAnimationFrame(()=>{detailFrame=0;positionDetail();});}
    function positionDetail(){
      if(fullscreen&&!native2x&&detail&&selected&&work){detailMode(false);detail.hidden=false;detail.classList.toggle('bottom-sheet',host.clientWidth<=650);Object.assign(detail.style,{right:'0',left:'auto',top:host.clientWidth<=650?'auto':'60px',bottom:'0',width:host.clientWidth<=650?'100%':'300px',maxHeight:host.clientWidth<=650?'42%':'calc(100% - 60px)'});return;}
      if(disposed||!detail||!selected||!scroll||!work)return;
      const anchor=[...shadow.querySelectorAll('.node')].find(b=>b.dataset.id===selected);if(!anchor)return;
      const a=anchor.getBoundingClientRect(),s=scroll.getBoundingClientRect(),w=work.getBoundingClientRect(),v=win.visualViewport;
      const left=Math.max(w.left,(v?.offsetLeft||0))+8,right=Math.min(w.right,(v?.offsetLeft||0)+(v?.width||win.innerWidth))-8;
      const top=Math.max(s.top,(v?.offsetTop||0))+8,bottom=Math.min(s.bottom,(v?.offsetTop||0)+(v?.height||win.innerHeight))-8;
      if(a.right<s.left||a.left>s.right||a.bottom<s.top||a.top>s.bottom){detail.close?.();detail.hidden=true;return;}
      const modal=win.matchMedia?.('(pointer:coarse)').matches||host.clientWidth<=650;
      detailMode(modal);detail.hidden=false;
      if(modal){if(!detail.open)detail.showModal();return;}
      const width=Math.min(306,right-left),height=Math.min(410,bottom-top);
      if(width<=0||height<160){detailMode(true);detail.hidden=false;if(!detail.open)detail.showModal();return;}
      Object.assign(detail.style,{width:width+'px',maxHeight:height+'px',left:'0px',top:'0px'});
      const h=Math.min(detail.scrollHeight+2,height),clamp=(n,min,max)=>Math.max(min,Math.min(max,n)),y=clamp(a.top,top,bottom-h);
      const positions=[{x:a.right+12,y},{x:a.left-width-12,y},{x:clamp(a.left,left,right-width),y:a.bottom+12},{x:clamp(a.left,left,right-width),y:a.top-h-12}];
      const choice=positions.find(p=>p.x>=left&&p.x+width<=right&&p.y>=top&&p.y+h<=bottom);
      if(!choice){detailMode(true);detail.hidden=false;if(!detail.open)detail.showModal();return;}
      Object.assign(detail.style,{left:(choice.x-w.left)+'px',top:(choice.y-w.top)+'px'});detail.dataset.side=choice.x>=a.right?'right':choice.x+width<=a.left?'left':choice.y>=a.bottom?'below':'above';
    }
    function header(s){
      const bar=el('header','bar',undefined,shell),brand=el('div','brand',undefined,bar);el('p','eyebrow','TOKYO 2051 / CHARACTER DEVELOPMENT',brand);el('h2','',identityName||'人物成长',brand);
      if(s){const balance=el('div','balance',undefined,bar);for(const [cls,label,value]of [['attribute-total','属性点',s.attributePoints],['perk-total','专长点',s.perkPoints]]){const p=el('p',cls,undefined,balance);el('strong','',value,p);el('span','',label,p);}}
      if(s){const xp=T.xpProgress(s);el('p','growth-progress','Lv.'+s.level+' · '+(xp.required===null?'已满级':xp.current+' / '+xp.required+' XP · 距下级 '+Math.max(0,xp.required-xp.current)+' XP'),bar);}
      if(fullscreen)click(native2x?'关闭':'返回',async()=>{if(await canLeave())onClose();},bar,'small-button talent-close');if(base)click(screen==='records'?'返回天赋':'成长记录',()=>{screen=screen==='records'?'main':'records';selected=null;render();},bar,'small-button talent-records');
    }
    function overviewPage(s){
      overviewViewport=el('div','overview-viewport',undefined,work);overview=el('div','overview',undefined,overviewViewport);
      for(const t of T.data.trees){const b=click('',()=>{if(onOpenTree){onOpenTree(t.id);return;}tree=t.id;selected=null;zoom=1;render();},overview,'attribute-tile');b.dataset.tree=t.id;b.setAttribute('aria-label',t.name+' '+s.attributes[t.id]+'，查看天赋树');
        const bg=el('span','tile-bg',undefined,b);bg.style.backgroundImage='url("'+url(t.id==='reflexes'?'tile-3-6c9d2cd8.svg':['body','technical'].includes(t.id)?'tile-2-0ea2f3c7.svg':'tile-1-7ced94d8.svg')+'")';
        const img=el('img','',undefined,b);img.src=url(icons[t.id]);img.alt='';el('span','attribute-value',s.attributes[t.id],b);el('span','attribute-name',t.name,b);el('span','perk-count',t.nodes.reduce((sum,n)=>sum+(s.perks[n.id]||0),0)+' 已投入',b);
      }
      if(!onOpenTree){const relic=click('',()=>{note='Relic 使用独立点数与剧情条件，当前角色尚未开放。';announce();},overview,'attribute-tile');relic.dataset.tree='relic';relic.setAttribute('aria-label','Relic，尚未开放');const rbg=el('span','tile-bg',undefined,relic);rbg.style.backgroundImage='url("'+url('tile-relic-1f2824f5.svg')+'")';el('span','relic-symbol','R',relic);el('span','attribute-name','RELIC',relic);el('span','perk-count','尚未开放',relic);}
      const center=el('div','center-level',undefined,overview),xp=T.xpProgress(s);el('strong','',s.level,center);el('span','level-name','等级',center);el('p','xp',xp.required===null?'成长曲线已满级':xp.current.toLocaleString()+' / '+xp.required.toLocaleString()+' XP',center);const track=el('div','xp-track',undefined,center);el('i','',undefined,track).style.width=(xp.required===null?100:Math.min(100,xp.current/xp.required*100))+'%';
    }
    function showDetail(s){
      detail.replaceChildren();detail.hidden=!selected;if(!selected){detail.close?.();return;}
      const n=T.node(selected),rank=s.perks[n.id]||0,st=T.status(s,n.id),saved=base.perks[n.id]||0;
      const dismiss=el('button','detail-close','×',detail);dismiss.type='button';dismiss.setAttribute('aria-label','关闭专长详情');dismiss.addEventListener('click',closeDetail);
      el('p','tag',T.data.trees.find(t=>t.id===n.attribute).name+' / '+({perk:'专长',milestone:'核心专长',master:'顶级专长'}[n.type])+' / '+rank+' / '+n.ranks,detail);el('h3','',n.name,detail);
      const g=feedbackGame(s),feedback=g&&root.CxxGrowthFeedback?.perk(g,n.id,rank);
      if(feedback){const box=el('section','talent-benefit',undefined,detail);
        if(['available','invested'].includes(st)&&s.perkPoints>0){const next=T.allocate(base,T.edit(base,draft,{kind:'perk',id:n.id,delta:1})),rows=root.CxxGrowthFeedback.compare(g,feedbackGame(next));el('h4','','再投入 1 点',box);if(rows.length)for(const text of rows)el('p','next-benefit',text,box);else el('p','next-benefit',feedback.ranks[rank]||'获得对应动作能力。',box);}
        el('p','', '当前配装 · '+[...new Set(feedback.rows.map(r=>r.state))].join(' / '),box);if(feedback.note)el('p','',feedback.note,box);
      }
      const rules=feedback?el('details','talent-rules',undefined,detail):detail;if(feedback)el('summary','','各级效果与触发条件',rules);
      const lines=el('ol','',undefined,rules);(feedback?.ranks||effectRules[n.id]||[]).forEach((line,i)=>el('li',i<rank?'learned':'',line,lines));
      if(feedback)for(const r of feedback.rows)el('p','effect-state',r.state+' · '+r.text,rules);
      const needs=[native2x?T.data.trees.find(t=>t.id===n.attribute).name+' '+s.attributes[n.attribute]+'/'+n.required:'属性 '+n.required,...n.requires.map(id=>T.node(id).name+' '+(native2x?(s.perks[id]||0):T.node(id).ranks)+'/'+T.node(id).ranks)];el('p','need',needs.join(' · '),detail);
      const gainable=['available','invested'].includes(st),status=native2x&&pending?'正在保存':native2x&&gainable&&s.perkPoints<1?'专长点不足':({locked:'属性尚未达到门槛',not_connected:'前置专长尚未点满',available:'可投入专长点',invested:'可继续提升',maxed:'已达到最高等级'}[st]),statusLine=el('p',native2x?'tag perk-status':'tag',status+(saved?' · 已保存 '+saved+'级':''),detail);if(native2x)statusLine.dataset.blocked=String(!pending&&st!=='maxed'&&(!gainable||s.perkPoints<1));
      const actions=el('div','detail-actions',undefined,detail);
      click('获得 +1',()=>updateDraft('perk',n.id,1),actions,'action secondary').disabled=pending||!gainable||s.perkPoints<1;
      click('返还草稿',()=>updateDraft('perk',n.id,-1),actions,'action').disabled=pending||rank<=saved;
      queueDetail();
    }
    function treePage(s){
      const t=T.data.trees.find(t=>t.id===tree);toolbar=el('div','tree-toolbar',undefined,work);click('← 所有属性',()=>{tree=null;selected=null;render();},toolbar);el('h3','tree-title',t.name,toolbar);
      const edit=el('div','attr-edit',undefined,toolbar);click('−',()=>updateDraft('attribute',tree,-1),edit,'step').disabled=pending||s.attributes[tree]<=base.attributes[tree];el('strong','',s.attributes[tree],edit);click('+',()=>updateDraft('attribute',tree,1),edit,'step').disabled=pending||s.attributePoints<1||!s.unrestricted&&s.attributes[tree]>=20;edit.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-label',(i?'增加':'撤回')+t.name+'属性'));
      const zoomBox=el('div','zoom',undefined,toolbar);click('−',()=>{zoom=Math.max(1,zoom-.5);resize();zoomBox.querySelector('span').textContent=Math.round(zoom*100)+'%';},zoomBox).setAttribute('aria-label','缩小天赋树');el('span','',Math.round(zoom*100)+'%',zoomBox);click('+',()=>{zoom=Math.min(4,zoom+.5);resize();zoomBox.querySelector('span').textContent=Math.round(zoom*100)+'%';},zoomBox).setAttribute('aria-label','放大天赋树');
      const layout=el('div','tree-layout',undefined,work),nav=el('nav','tree-nav',undefined,layout);nav.setAttribute('aria-label','属性树');
      if(native2x){nav.hidden=true;const center=el('div','cp2-tree-center',undefined,shell.querySelector('.bar')),cycle=delta=>{const at=T.data.trees.findIndex(row=>row.id===tree);tree=T.data.trees[(at+delta+T.data.trees.length)%T.data.trees.length].id;zoom=1;selected=null;render();};click('‹',()=>cycle(-1),center).setAttribute('aria-label','上一个属性树');center.append(toolbar.querySelector('.tree-title'),edit);click('›',()=>cycle(1),center).setAttribute('aria-label','下一个属性树');}
      else for(const a of T.data.trees){const b=click('',()=>{tree=a.id;zoom=1;selected=null;render();},nav);b.setAttribute('aria-label',a.name);b.setAttribute('aria-current',String(a.id===tree));const img=el('img','',undefined,b);img.src=url(icons[a.id]);img.alt='';el('span','',s.attributes[a.id],b);}
      scroll=el('div','tree-scroll',undefined,layout);scroll.setAttribute('aria-label',t.name+'天赋图，可滚动与缩放');scroll.tabIndex=0;canvasBox=el('div','canvas-box',undefined,scroll);canvas=el('div','canvas',undefined,canvasBox);
      const nextTier=[4,9,15,20].find(level=>s.attributes[tree]<level);for(const [level,y]of [[20,20],[15,490],[9,990],[4,1440]])if(s.attributes[tree]<level){const tier=el('div','tier',undefined,canvas);tier.style.top=y+'px';tier.dataset.gate=String(level===nextTier);el('span','',native2x?t.name+' '+s.attributes[tree]+' / '+level:t.name+' '+level+' / 解锁门槛',tier);if(native2x&&level===nextTier){const lock=el('img','tier-lock',undefined,tier);lock.src=url('padlock-red-815d118d.png');lock.alt='';}}
      for(const n of t.nodes){const st=T.status(s,n.id);n.paths.forEach((p,i)=>{const def=T.data.cables[p.name],line=el('div','cable',undefined,canvas);let cs=st==='maxed'||st==='invested'?'maxed':st==='available'?'available':'not_connected';if(st==='not_connected'&&n.requires[i]&&T.status(s,n.requires[i])==='maxed')cs='available';line.dataset.state=cs;Object.assign(line.style,{left:p.x+'px',top:p.y+'px',width:def.width+'px',height:def.height+'px',backgroundPosition:def.position,backgroundImage:'url("'+url(cables[cs])+'")'});});}
      for(const n of t.nodes){const st=T.status(s,n.id),rank=s.perks[n.id]||0;const b=click('',e=>{if(dragged)return;selected=n.id;{shadow.querySelectorAll('.node[data-selected=true]').forEach(b=>b.dataset.selected='false');b.dataset.selected='true';showDetail(s);}},canvas,'node');b.dataset.id=n.id;b.dataset.state=st;b.dataset.type=n.type;b.dataset.selected=String(selected===n.id);b.setAttribute('aria-label',n.name+' '+rank+'/'+n.ranks);b.setAttribute('aria-pressed',String(rank>0));Object.assign(b.style,{left:n.x+'px',top:n.y+'px',width:sizes[n.type][0]+'px',height:sizes[n.type][1]+'px',backgroundImage:'url("'+url(frames[n.type][st]||frames[n.type].maxed)+'")'});
        const icon=el('span','sprite',undefined,b);Object.assign(icon.style,{width:n.sprite.width+'px',height:n.sprite.height+'px',backgroundPosition:n.sprite.position,backgroundImage:'url("'+url(atlas[st])+'")'});if(n.type!=='perk')el('span','rank',rank+'/'+n.ranks,b);
        b.addEventListener('focus',()=>{if(!suppressFocus&&!pointer){selected=n.id;showDetail(s);}});b.addEventListener('contextmenu',e=>{e.preventDefault();if(pending)return;selected=n.id;try{if(rank>(base.perks[n.id]||0))updateDraft('perk',n.id,-1);else{note='只能返还本次草稿中的点数。';announce();}}catch(error){note=error.message;announce();}});
      }
      detail=el(win.matchMedia?.('(pointer:coarse)').matches||host.clientWidth<=650?'dialog':'aside','detail',undefined,work);detail.setAttribute('aria-label','专长详情');bindDetail(detail);showDetail(s);
    }
    function recordsPage(){
      const box=el('div','records',undefined,work);el('h3','','已经保存的成长',box);const rows=Object.entries(base.rewards).filter(([id])=>id!=='$meta');if(!rows.length)el('p','','当前只有已确认的成长起点，尚无奖励结算。',box);
      const repair=win.CxxGrowthRepair;if(repair&&allowRepair){const controls=el('details','',undefined,box);el('summary','','检查旧档漏算（指定范围）',controls);el('p','','只发送你指定的有效原文。先查看补算结果，确认后写入当前分支。',controls);const from=el('input','',undefined,controls),to=el('input','',undefined,controls);from.type=to.type='number';from.min=to.min='1';from.value='1';to.value=String(Math.max(1,(win.SillyTavern?.getContext().chat.length||2)-1));from.setAttribute('aria-label','补算起始楼层');to.setAttribute('aria-label','补算结束楼层');const output=el('div','',undefined,controls);click('检查范围',async()=>{output.textContent='正在检查…';const result=await repair.inspect(Number(from.value),Number(to.value));output.replaceChildren();for(const r of result.rows)el('p','','第 '+r.floor+' 层 · '+r.reason+' · '+(r.duplicate?'已结算，跳过':'+'+r.xp+' XP'),output);click('确认补算并保存',async()=>{const saved=await repair.apply(result.id);base=T.read(saved.stat.terminal.gameplay.growth);draft=T.build(base);note='指定范围的补算已保存并核对。';render();},output,'action primary');},controls);}
      const list=el('ol','',undefined,box);for(const [,r]of rows.slice(-30).reverse()){const item=el('li','',r.fact?.reason||r.award.source.id,list);el('small','','+'+r.earned.xp+' XP · +'+r.earned.attributePoints+' 属性点 · +'+r.earned.perkPoints+' 专长点 · 等级 '+r.fromLevel+' → '+r.toLevel,item);}
    }
    function setupPage(){
      const box=el('div','setup',undefined,work);el('h3','',initial?'保存已确认的成长起点':'确认当前角色的成长起点',box);
      el('p','',initial?'开局配点已经确认。第一轮正文会建立成长记录；若尚未保存，可从这里继续。':'旧存档需要先确认起点。填写当前能力与剩余点数，已有剧情、钱包和人物关系会继续保留。',box);
      let setup=initial?structuredClone(initial):{schema:1,unrestricted:true,level:1,xp:0,attributes:Object.fromEntries(T.attributes.map(id=>[id,3])),attributePoints:7,perkPoints:0};
      const inputs=[];
      if(initial){const values=el('div','setup-values',undefined,box);el('p','','等级 '+setup.level+' · 经验 '+setup.xp+' · 属性点 '+setup.attributePoints+' · 专长点 '+setup.perkPoints,values);el('p','',T.data.trees.map(t=>t.name+' '+setup.attributes[t.id]).join(' / '),values);}
      else{const grid=el('div','setup-grid',undefined,box);for(const [key,label]of [['level','等级'],['xp','累计经验'],['attributePoints','剩余属性点'],['perkPoints','剩余专长点'],...T.data.trees.map(t=>[t.id,t.name])]){const l=el('label','',label,grid),i=el('input','',undefined,l);i.type='number';i.min=key==='level'?'1':'0';i.step='1';i.value=setup[key]??setup.attributes[key];i.setAttribute('aria-label',label);inputs.push([key,i]);}}
      click('确认起点并继续正文',async()=>{for(const [key,i]of inputs){if(!i.value.trim())throw Error('请填写完整的成长起点');const value=Number(i.value);if(T.attributes.includes(key))setup.attributes[key]=value;else setup[key]=value;}T.initialize(setup);if(!onInitialize)throw Error('此处没有正文发送入口');pending=true;try{await onInitialize(setup);if(disposed)return;note='已提交成长起点，等待正文保存。';}catch(e){pending=false;note=e.message;}if(!disposed)render();},box,'action primary').disabled=pending;
    }
    async function saveDraft(){if(!onApply)throw Error('保存入口暂不可用');const build=structuredClone(draft),before=base;pending=true;note='正在保存配点…';render(true);try{const result=await onApply(build);if(disposed)return;base=T.read(readSavedGrowth(result));savedBenefits=root.CxxGrowthFeedback?.draft(readGame(),before,base)||[];draft=T.build(base);undo.length=0;note='配点已保存并核对。';}finally{pending=false;if(!disposed)render(true);}}
    function render(preserveScroll=false){
      if(disposed)return;const position=preserveScroll&&scroll?{x:scroll.scrollLeft,y:scroll.scrollTop}:null,focus=preserveScroll&&(shadow.activeElement?.closest?.('.node')?.dataset.id||(native2x&&fullscreen?selected:null));
      detail?.close?.();shell.replaceChildren();detail=null;overview=null;canvas=null;scroll=null;const s=base?current():null;header(s);work=el('div','workspace',undefined,shell);
      if(!base)setupPage();else if(screen==='records')recordsPage();else if(tree)treePage(s);else overviewPage(s);
      footer=el('footer','bottom',undefined,shell);const stateLabel=el('p','draft-state',undefined,footer);el('strong','',pending?(localSave?'正在保存':'等待正文保存'):!base?'成长尚未保存':dirty()?'配点草稿 · 尚未保存':'当前已保存配点',stateLabel);el('span','',preview?'本地交互预览':base?'累计经验 '+s.xp.toLocaleString():'确认后首次建立成长档案',stateLabel);
      const benefits=base&&dirty()?root.CxxGrowthFeedback?.draft(readGame(),base,s)||[]:savedBenefits;
      if(benefits.length){const box=el('details','growth-preview',undefined,shell);shell.insertBefore(box,footer);el('summary','',(dirty()?'草稿收益':'本次配点收益')+' · '+benefits[0],box);for(const text of benefits)el('p','',text,box);el('small','','普通单击与破解直伤未计目标护甲、暴击和现场条件；上限提升不恢复当前资源。',box);}
      if(base&&screen==='main'){
        click('撤销',()=>{if(undo.length){draft=undo.pop();render(true);}},footer,'action').disabled=pending||!undo.length;click(tree?'重置本树':'重置草稿',()=>{undo.push(structuredClone(draft));draft=tree?T.reset(base,draft,tree):T.build(base);note='';render(true);},footer,'action').disabled=pending||!dirty();
        click('保存配点',saveDraft,footer,'action primary').disabled=pending||!dirty();
      }
      const notice=el('p','notice',note,shell);notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
      if(base&&screen==='main')el('p','hint',tree?'点击节点查看详情，在详情中增减点数；拖动或放大查看天赋树。':'选择一个属性进入天赋树。已保存的点数以当前正文记录为准。',shell);
      resize();if(position&&scroll){scroll.scrollLeft=position.x;scroll.scrollTop=position.y;}if(focus){suppressFocus=true;[...shadow.querySelectorAll('.node')].find(b=>b.dataset.id===focus)?.focus({preventScroll:true});suppressFocus=false;}else if(native2x&&fullscreen)shadow.querySelector('.talent-close').focus({preventScroll:true});queueDetail();
    }
    const escape=e=>{if(e.key!=='Escape')return;if(selected){e.preventDefault();if(native2x)e.stopPropagation();closeDetail();}else if(native2x&&fullscreen){e.preventDefault();e.stopPropagation();const close=shadow.querySelector('.talent-close');close.focus({preventScroll:true});close.click();}};
    shadow.addEventListener('pointerdown',e=>{const target=e.target.closest?.('.tree-scroll');pointer={x:e.clientX,y:e.clientY,scroll:target,left:target?.scrollLeft||0,top:target?.scrollTop||0};dragged=false;});shadow.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8){dragged=true;if(e.pointerType==='mouse'&&pointer.scroll){e.preventDefault();pointer.scroll.scrollLeft=pointer.left+pointer.x-e.clientX;pointer.scroll.scrollTop=pointer.top+pointer.y-e.clientY;}}});shadow.addEventListener('pointerup',()=>{pointer=null;});shadow.addEventListener('keydown',escape);shadow.addEventListener('scroll',queueDetail,true);doc.addEventListener('scroll',queueDetail,true);win.addEventListener('resize',resize);win.visualViewport?.addEventListener('resize',resize);win.visualViewport?.addEventListener('scroll',queueDetail);
    if(fullscreen){el('style','',root.CxxTalentFullscreenStyle||'',shadow);}
    if(win.ResizeObserver){observer=new win.ResizeObserver(resize);observer.observe(host);}render();if(scroll){scroll.scrollLeft=viewState.x||0;scroll.scrollTop=viewState.y||0;}
    return {element:host,shadow,canLeave,readView:()=>({tree,selected,zoom,x:scroll?.scrollLeft||0,y:scroll?.scrollTop||0}),readDraft:()=>draft?structuredClone(draft):null,destroy(){stopTheme?.();stopOrientation?.();stopResources?.();if(Popover.isOpen(host))host.hidePopover();disposed=true;observer?.disconnect();win.cancelAnimationFrame(detailFrame);doc.removeEventListener('scroll',queueDetail,true);win.removeEventListener('resize',resize);win.visualViewport?.removeEventListener('resize',resize);win.visualViewport?.removeEventListener('scroll',queueDetail);shadow.removeEventListener('keydown',escape);shadow.removeEventListener('scroll',queueDetail,true);detail?.close?.();host.remove();}};
  }
  return {mount};
});
