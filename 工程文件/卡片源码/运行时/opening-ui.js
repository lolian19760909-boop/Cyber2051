(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxOpeningUI=api;})(globalThis,function(global){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const steps=['origin','profile','growth','loadout','scenario','review'],labels=['人生出身','捏人与背景','能力配点','初始装备','乐队与开局','确认开始'];
  const scenarioTitle=id=>id==='custom-opening'?'自己写第一幕':global.CxxOpeningGroups?.beginnings?.find(x=>x.id===id)?.title||global.CxxOpeningCatalog?.find(x=>x.id===id)?.title||'';
  function mount({document:doc,flow,identity:I,setup:Setup,css,preview,resolveDevice,manageViewport=true}){
    let state=flow.state(),viewKey='',loadout=null,updates=[],destroyed=false,avatarEpoch=0,creator=null,creatorView={},guidedRevision=0,markedInput=null,detailKey='',selectedItem=null,forge=null,forgeEpoch=0,forgeClosing=Promise.resolve(),itemSource='';
    const node=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
    const button=(text,run,cls='')=>{const b=node('button',cls,text);b.type='button';b.onclick=()=>{try{Promise.resolve(run()).catch(e=>flow.markError(e));}catch(e){flow.markError(e);}};return b;};
    let preferScreen=!state.draft.preferences?.nsfwChosen;
    const root=node('section','cxx-opening-flow'),style=node('style','');style.textContent=I.css+'\n'+css;
    root.setAttribute('aria-label','开局配置');const header=node('header','opening-header'),brand=node('p','opening-brand','TOKYO 2051 / YOUR BEGINNING'),nav=node('nav','opening-steps');nav.setAttribute('aria-label','开局步骤');
    const currentStep=node('p','opening-current-step');currentStep.setAttribute('aria-live','polite');
    const navValues=[],navButtons=steps.map((step,i)=>{const b=button(labels[i],()=>{flow.go(step);preferScreen=false;paint();});b.setAttribute('aria-label',(i+1)+' '+labels[i]);b.title=(i+1)+' / 6 · '+labels[i];const num=node('span','opening-step-num',String(i+1).padStart(2,'0'));b.prepend(num);const value=node('span','opening-step-value');value.setAttribute('aria-hidden','true');b.append(value);navValues.push(value);nav.append(b);return b;});
    const navPreferences=button('游玩偏好',()=>{preferScreen=true;paint();});navPreferences.setAttribute('aria-label','0 游玩偏好');navPreferences.title='0 / 6 · 游玩偏好（内容尺度）';navPreferences.prepend(node('span','opening-step-num','00'));nav.prepend(navPreferences);
    const body=node('main','opening-body cxx-identity'),footer=node('footer','opening-footer'),feedback=node('aside','opening-feedback'),noticeRow=node('div','opening-notice-row'),notice=node('p','opening-notice');notice.id='opening-notice-'+state.draft.creationId;notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    const back=button('← 上一步',()=>flow.go(steps[steps.indexOf(state.draft.step)-1]),'opening-back');
    const next=button('保存并继续 →',()=>{if(preferScreen){flow.patch({preferences:{nsfwChosen:true}});preferScreen=false;paint();return;}if(state.status==='error')return flow.retry();const i=steps.indexOf(state.draft.step);if(i===4)return preview.confirm();if(i===5)return flow.commit(state.draft.pendingCommand);return flow.next();},'opening-next');
    const info=node('span','opening-footnote','确认前可随时返回修改'),escKey=node('span','opening-key');escKey.append(node('span','opening-kbd','Esc'),doc.createTextNode('返回选档'));footer.append(escKey,info,back,next);header.append(brand,currentStep);const stopOrientation=(global.CxxEntryExperience||doc.defaultView.CxxEntryExperience)?.button(doc.defaultView.parent||doc.defaultView,header);
    const guide=button('前往填写',()=>focusGuidance(),'opening-guide'),details=node('details','opening-error-details'),recovery=node('div','opening-recovery');details.append(node('summary','','查看处理与详情'),recovery);noticeRow.append(notice,guide);feedback.append(noticeRow,details);const stage=node('section','opening-stage'),stageArt=node('div','opening-stage-art'),stageScan=node('div','opening-stage-scan'),caption=node('div','opening-stage-caption'),captionLabel=node('small',''),captionTitle=node('h3',''),captionText=node('p','');stage.setAttribute('aria-hidden','true');caption.append(captionLabel,captionTitle,captionText);stage.append(stageArt,stageScan,caption);
    root.append(style,header,nav,stage,body,feedback,footer);
    const sizeWindow=doc.defaultView,resizeLayout=()=>{const width=root.clientWidth;if(!width)return;root.dataset.layout=width<=760?'compact':width<=1100?'narrow':'wide';root.dataset.short=String(root.clientHeight<500);};
    const resizeObserver=sizeWindow.ResizeObserver?new sizeWindow.ResizeObserver(resizeLayout):null;resizeObserver?.observe(root);sizeWindow.addEventListener('resize',resizeLayout);const layoutFrame=sizeWindow.requestAnimationFrame(resizeLayout);
    function heading(title,description){const h=node('h2','',title);h.tabIndex=-1;body.append(h,node('p','identity-note',description));}
    const stopLayout=manageViewport?(global.CxxEntryExperience||doc.defaultView.CxxEntryExperience)?.attach(doc.defaultView,root):null;let fullTalent=null,talentDraft=null,talentView={};
    function openTalents(){const top=doc.defaultView.parent||doc.defaultView,T=global.CxxTalents||top.CxxTalents,UI=global.CxxTalentUI||top.CxxTalentUI;if(!T||!UI)throw Error('天赋组件尚未就绪。');const value=flow.choice().growthSetup;fullTalent=UI.mount({document:doc,parent:body,talents:T,fullscreen:true,localSave:true,state:T.initialize(value),draftBuild:talentDraft,viewState:talentView,onClose:()=>{talentDraft=fullTalent.readDraft();talentView=fullTalent.readView();fullTalent?.destroy();fullTalent=null;},onApply:async build=>{const applied=T.allocate(T.initialize(value),build);flow.patch({growth:{...value,attributes:applied.attributes,attributePoints:applied.attributePoints,perks:applied.perks}});return {stat:{terminal:{gameplay:{growth:applied}}}};}});}
    const customArt='<svg viewBox="0 0 220 260" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M34 72V34h38M148 34h38v38M34 172v38h38M148 210h38v-38" stroke="currentColor" stroke-width="1"/><path d="M76 94c0-47 68-47 68 0v14c0 47-68 47-68 0V94Z" stroke="currentColor" stroke-width="2"/><path d="M49 203v-21c0-32 36-40 61-40s61 8 61 40v21" stroke="currentColor" stroke-width="2"/><path d="M92 109h36M110 91v36" stroke="currentColor" opacity=".5"/><path d="M18 123h42m100 0h42M110 17v30m0 164v31" stroke="currentColor" opacity=".35"/></svg><b>WRITE YOUR BEGINNING</b>';
    const customOrigin={id:'custom',name:'自定义出身',en:'YOUR OWN STORY',intro:'由你书写背景，设定自己的属性与成长起点。'};
    function originArt(e,cls){
      if(e.cover){const img=node('img',cls);const src='https://cyber2051.top/img/galgame/backgrounds/'+e.cover;img.src=doc.defaultView.CxxResources?.source(src)||global.parent?.CxxResources?.source(src)||src;img.alt=cls?e.name+' · 东京都':'';img.loading='lazy';return img;}
      const art=node('span',(cls?cls+' ':'')+'identity-art-custom');art.innerHTML=customArt;return art;
    }
    function mirrorChoice(parent){
      const group=node('fieldset','opening-mirror-choice'),legend=node('legend','','镜译功能'),line=node('label','','本故事使用镜译'),select=node('select','');select.setAttribute('aria-label','本故事使用镜译');
      for(const [value,label]of [['false','关闭 · 原文阅读'],['true','开启 · 译文、朗读与通话']]){const option=node('option','',label);option.value=value;select.append(option);}select.value=String(state.draft.preferences.mirror===true);select.onchange=()=>flow.patch({preferences:{mirror:select.value==='true'}});line.append(select);group.append(legend,line,node('p','identity-note','开启后，建档完成会进入可跳过的操作引导。镜译的全局自动翻译在插件中单独管理。'));parent.append(group);updates.push(()=>select.value=String(state.draft.preferences.mirror===true));
    }
    function preferenceScreen(){
      const p=state.draft.preferences||{},set=v=>flow.patch({preferences:{nsfw:v,nsfwChosen:true}}),setBattle=v=>flow.patch({preferences:{battleMode:v}});
      heading('游玩偏好','先定下这个档位的内容尺度，后面所有步骤都按它来。之后想改，随时可以打开设置改回来。');
      const group=node('fieldset','opening-mirror-choice');group.append(node('legend','','内容尺度'));
      const line=node('label','','NSFW 内容（终端影像里的成人图片）');
      const sel=node('select','');sel.setAttribute('aria-label','NSFW 内容总开关');
      [['off','关闭 · 默认，成人图片只显示锁住的占位'],['on','开启 · 允许查看成人图片']].forEach(([value,text])=>{const o=node('option','',text);o.value=value;sel.append(o);});
      sel.value=p.nsfw===true?'on':'off';sel.onchange=()=>set(sel.value==='on');
      line.append(sel);group.append(line);body.append(group);
      body.append(node('p','identity-note','默认关闭。关闭时「瑟瑟」分组仍会列出张数，但缩略图与大图都是占位，点开会提示先去设置里开启。这个开关只影响卡内画廊，不影响正文。'));
      const battle=node('fieldset','opening-mirror-choice');battle.append(node('legend','','战斗结算方式'));
      const battleLine=node('label','','遭遇战怎么打');
      const battleSel=node('select','');battleSel.setAttribute('aria-label','战斗结算方式');
      [['fast','速决 · 默认，一键结算并给战报'],['text','纯文本 · 后台算完直接并进剧情'],['tactical','即时战术 · 打开战斗面板逐个行动']].forEach(([value,text])=>{const o=node('option','',text);o.value=value;battleSel.append(o);});
      battleSel.value=['tactical','fast','text'].includes(p.battleMode)?p.battleMode:'fast';battleSel.onchange=()=>setBattle(battleSel.value);
      battleLine.append(battleSel);battle.append(battleLine);body.append(battle);
      body.append(node('p','identity-note','三种方式共用同一套算式：武器、命中、护甲、伤势与消耗完全一致，只是决定谁来点按钮。速决会把胜负、掉血和逐条战报写进存档，随时能在战斗条上展开查看；纯文本连战报条都不展开，直接并进正文。想让战斗慢下来自己操作，就选即时战术。'));
    }
    function origins(){
      heading('你的人物出身','选择你在东京都的身份。你的故事，从这里开始。');const cards=node('div','identity-cards');cards.setAttribute('role','radiogroup');cards.setAttribute('aria-label','玩家出身');body.append(cards);
      const all=[...I.entries,customOrigin];
      const description=node('p','opening-origin-description');body.append(description);updates.push(()=>description.textContent=all.find(e=>e.id===state.draft.origin).intro);
      all.forEach((e,i)=>{const b=button('',()=>flow.chooseOrigin(e.id),'identity-card');b.dataset.identity=e.id;b.setAttribute('role','radio');b.append(node('small','',e.en),node('h3','',e.name));
        b.append(originArt(e,'identity-art'));
        b.append(node('span','identity-copy',e.intro));updates.push(()=>{const selected=state.draft.origin===e.id;b.setAttribute('aria-checked',String(selected));b.tabIndex=selected?0:-1;});
        b.onkeydown=ev=>{if(!['ArrowLeft','ArrowRight'].includes(ev.key))return;ev.preventDefault();const next=all[(i+(ev.key==='ArrowRight'?1:all.length-1))%all.length];flow.chooseOrigin(next.id);cards.querySelector('[data-identity="'+next.id+'"]').focus();};cards.append(b);
      });
      mirrorChoice(body);
    }
    function growth(){
      const id=state.draft.origin,custom=id==='custom';heading(custom?'决定你的成长起点':'决定你的起点',custom?'根据出身背景，设定初始数值。':'保留出身带来的属性，再分配属于你的自由点数。');
      const current=()=>structuredClone(state.draft.growth[id]||I.initialSetup(id));
      const layout=node('div','identity-editor'),about=node('section','identity-panel'),stats=node('section','identity-panel');layout.append(about,stats);body.append(layout);
      about.append(node('p','identity-eyebrow','BACKGROUND / YOUR STORY'),node('h3','',custom?'书写你的来历':I.entries.find(e=>e.id===id).name));
      function number(parent,label,key,attribute=false,min=0){const row=node('label','identity-metric',label),input=node('input','');input.type='number';input.min=String(min);input.step='1';input.inputMode='numeric';input.value=String(attribute?current().attributes[key]:current()[key]);input.setAttribute('aria-label',label);input.dataset.openingField=key;input.oninput=()=>{const d=current();if(attribute)d.attributes[key]=input.value;else d[key]=input.value;flow.patch({growth:d});};row.append(input);parent.append(row);}
      stats.append(button('打开全屏天赋界面',openTalents));if(custom){about.append(node('p','identity-copy',state.draft.custom),button('修改出身背景',()=>flow.go('profile')),node('p','','初始数值由你决定，可以超出通常的角色起点。'));const metrics=node('div','identity-metrics');about.append(metrics);number(metrics,'初始等级','level',false,1);number(metrics,'累计经验','xp');number(metrics,'可用属性点','attributePoints');number(metrics,'可用天赋点','perkPoints');}
      else{about.append(node('p','',I.entries.find(e=>e.id===id).background),node('p','identity-anchor-note','出身确定属性起点。你还有4点可以自由分配，也可以留到进入故事之后再使用。'),node('p','','初始等级 1 · 天赋点 0'));const total=node('div','identity-point-total','尚未分配的属性点'),value=node('strong','');total.append(value);stats.append(total);updates.push(()=>value.textContent=String(current().attributePoints));}
      stats.prepend(node('p','identity-eyebrow','ATTRIBUTES / INITIAL ALLOCATION'),node('h3','','初始属性'));
      for(const a of I.attributes){if(custom){number(stats,a.name,a.id,true);continue;}const row=node('div','identity-attribute'),label=node('div',''),control=node('div','identity-counter');label.append(node('strong','',a.name),node('small','',a.hint));const value=node('output','');value.setAttribute('aria-label',a.name);const adjust=delta=>{const d=current(),n=d.attributes[a.id]+delta;if(n<I.anchors[id][a.id]||n>20||d.attributePoints-delta<0)return;d.attributes[a.id]=n;d.attributePoints-=delta;flow.patch({growth:d});};const minus=button('−',()=>adjust(-1)),plus=button('+',()=>adjust(1));minus.setAttribute('aria-label','减少'+a.name);plus.setAttribute('aria-label','增加'+a.name);updates.push(()=>{const d=current();value.textContent=String(d.attributes[a.id]);minus.disabled=state.busy||d.attributes[a.id]<=I.anchors[id][a.id];plus.disabled=state.busy||d.attributePoints<=0||d.attributes[a.id]>=20;});control.append(minus,value,plus);row.append(label,control);stats.append(row);}
    }

    function image(id,cls){const img=node('img',cls||''),entry=(doc.defaultView.CxxMenuArt||global.CxxMenuArt)?.entries?.[id];img.alt='';if(entry){img.src=entry.fallback||entry.url;img.onerror=()=>{img.onerror=null;img.src=entry.fallback;};}return img;}
    function persona(){
      const top=doc.defaultView.parent||doc.defaultView,p=state.draft.profile||global.CxxStoryProfile.seed(top);
      creator=global.CxxCreatorUI.mount({document:doc,parent:body,profile:p,custom:state.draft.custom,origin:state.draft.origin,originText:I.entries.find(e=>e.id===state.draft.origin)?.background||'',css:global.CxxCreatorStyle,viewState:creatorView,
        resolvePortrait:ref=>ref?.kind==='asset'?top.SillyTavern?.getContext?.().chatMetadata?.__cxx_item_art?.assets?.[ref.id]?.src:ref?.kind==='gallery'?(global.CxxMenuArt?.entries?.[ref.id]?.fallback||''):'',
        onChange:value=>flow.patch(value),onError:e=>flow.markError(e)});
      updates.push(()=>creator?.update(state.draft.profile||p,state.draft.custom));
      mirrorChoice(body);
      const token=++avatarEpoch;Promise.resolve(global.CxxStoryProfile.currentAvatar(top)).then(src=>{if(!destroyed&&token===avatarEpoch)creator?.setAvatar(src);},()=>{});
    }
    function review(){
      heading('准备好，走进这座城市。','检查最后一遍。点击开始游戏后，才会建立故事并进入所选开局。');const d=state.draft,layout=node('div','opening-review'),info=node('section','opening-review-card');layout.append(info);body.append(layout);info.append(node('small','','YOUR STORY / 档案确认'),node('h3','',d.profile?.name||'沿用当前人物'),node('p','',I.entries.find(e=>e.id===d.origin)?.name||'自定义出身'),node('p','',d.profile?.personality||'性格交由故事逐渐展现'),node('h3','',scenarioTitle(d.scenario)||'尚未选择'),node('p','','能力与装备按上一页的选择建立。返回任何步骤都不会提前发放或消耗。'));
      info.append(node('p','opening-worldbook-notice','人物资料保存在原世界书内属于本存档的 user 条目中；每条新路线各有自己的条目。'));
      if(global.CxxOpeningFlow.isDirect(d.scenario)){info.append(node('h3','','第一幕原文'),node('div','opening-written-preview',d.scenario==='custom-opening'?d.openingText:global.CxxOpeningGroups?.beginnings?.find(x=>x.id===d.scenario)?.text||''));}
      const settings=node('section','opening-review-card');layout.append(settings);settings.append(node('h3','','阅读偏好'));for(const [key,title,opts]of [['gal','阅读方式',[[false,'原生阅读'],[true,'Gal 阅读']]],['level','画面特效',[['medium','标准'],['low','低特效'],['high','完整']]],['device','布局',[['auto','自动适配'],['desktop','桌面'],['mobile','手机']]]]){const label=node('label','',title),select=node('select','');for(const [value,name]of opts){const option=node('option','',name);option.value=String(value);select.append(option);}select.value=String(d.preferences[key]);select.onchange=()=>flow.patch({preferences:{[key]:key==='gal'?select.value==='true':select.value}});label.append(select);settings.append(label);}mirrorChoice(settings);
    }

    function paint(){
      const step=preferScreen?'preferences':state.draft.step,key=state.restoreChoice?'restore':step+(['profile','growth','loadout'].includes(step)?':'+state.draft.origin:'');
      if(key!==viewKey){avatarEpoch++;stopForge();selectedItem=null;itemSource='';if(creator){creatorView=creator.view();creator.destroy();creator=null;}loadout?.destroy();loadout=null;preview.unmount();updates=[];body.replaceChildren();viewKey=key;
        if(state.restoreChoice){heading('发现一份人物草稿',state.restoreChoice.legacy?'这是旧版或归属未确认的草稿，可手动恢复文字；恢复后会重新确认人物设定。':'档位中保留了 '+state.restoreChoice.name+' 的草稿。');body.append(button('继续草稿',()=>flow.resolveDraft(true),'opening-next'),button('重新填写',()=>flow.resolveDraft(false),'opening-back'));}
        else if(step==='preferences')preferenceScreen();
        else if(step==='origin')origins();else if(step==='profile')persona();else if(step==='review')review();else if(step==='growth')growth();
        else if(step==='loadout'){heading('你的初始装备','确认开局携带与已安装的物品，正式建档时生效。');loadout=Setup.mount({document:doc,parent:body,origin:state.draft.origin,initial:state.draft.loadouts[state.draft.origin],onChange:loadout=>flow.patch({loadout}),onSelect:item=>{selectedItem=item;paintStage('loadout');}});}
        else{heading('故事从哪一幕开始','先浏览剧情，再确认全部配置。');const pane=node('div','opening-scenario');body.append(pane);preview.mount(pane);}
        body.scrollTop=0;enterRows();
      }
      if(!state.restoreChoice&&step==='scenario')preview.refresh(state);
      root.dataset.step=step;root.dataset.origin=state.draft.origin;root.dataset.restore=String(!!state.restoreChoice);paintSteps();paintStage(step);root.setAttribute('aria-busy',String(state.busy));
      currentStep.textContent=preferScreen?'0 / 6 · 游玩偏好':(steps.indexOf(step)+1)+' / 6 · '+labels[steps.indexOf(step)];
      navPreferences.setAttribute('aria-current',preferScreen?'step':'false');navPreferences.disabled=state.busy||state.status==='saved'||!!state.restoreChoice;
      navButtons.forEach((b,i)=>{b.setAttribute('aria-current',steps[i]===step?'step':'false');b.disabled=state.busy||state.status==='saved'||!!state.restoreChoice||preferScreen&&!state.draft.preferences?.nsfwChosen||!flow.canGo(steps[i]);b.dataset.complete=String(state.draft.completed.includes(steps[i]));});
      for(const input of body.querySelectorAll('input,textarea,select,button'))input.disabled=state.busy||state.status==='saved';updates.forEach(fn=>fn());
      back.hidden=preferScreen||!!state.restoreChoice||step==='origin'||state.locked;back.disabled=state.busy||preferScreen;
      next.textContent=state.status==='saved'?'开局已保存':state.busy?'正在保存…':preferScreen?'保存并继续：'+labels[steps.indexOf(state.draft.step)]+' →':state.status==='error'?'重试保存':step==='review'?'开始游戏 →':step==='scenario'?'保存并查看最终确认 →':'保存并继续：'+labels[steps.indexOf(step)+1]+' →';
      next.disabled=!!state.restoreChoice||state.busy||state.status==='saved'||step==='scenario'&&state.draft.scenario===null;
      info.textContent=state.locked?'已有配置保留，完成保存后进入故事':'已完成 '+state.draft.completed.length+'/5 · 保存后进入下一步';notice.textContent=state.error||(state.busy?'正在保存开局配置，请稍候…':state.status==='saved'?'开局已保存，可以继续故事。':'');notice.hidden=!notice.textContent;
      feedback.hidden=!notice.textContent;guide.hidden=!state.guidance;guide.textContent='前往'+(state.guidance?.label||'填写');guide.disabled=state.busy;
      details.hidden=!state.error||state.busy||!!state.guidance;
      const currentDetail=details.hidden?'':JSON.stringify(state.lastError||{message:state.error});
      if(currentDetail!==detailKey){detailKey=currentDetail;details.open=false;recovery.replaceChildren();if(currentDetail)recovery.append(node('p','',state.error),button('检查保存结果',()=>showRecovery(false)),button('恢复并继续创建',()=>showRecovery(true)),button('复制错误详情',()=>copyDetails(state.lastError||{message:state.error})));}
      if(!state.guidance){clearGuidance();guidedRevision=0;}else if(state.guidance.revision!==guidedRevision){guidedRevision=state.guidance.revision;focusGuidance();}

    }
    // Stage (DESIGN.md 10.10): the picture follows the current choice; profile and story bring their own.
    let stageKey='',stageScene='';
    const originEntry=()=>I.entries.find(e=>e.id===state.draft.origin)||customOrigin;
    function radar(values,anchors){
      const ns='http://www.w3.org/2000/svg',svg=doc.createElementNS(ns,'svg'),cx=200,cy=150,R=110,max=Math.max(8,...values,...anchors);
      svg.setAttribute('viewBox','0 0 400 300');svg.setAttribute('class','opening-radar');
      const point=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/5,r=R*v/max;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];};
      const shape=(cls,list)=>{const p=doc.createElementNS(ns,'polygon');p.setAttribute('class',cls);p.setAttribute('points',list.map((v,i)=>point(i,v).join(',')).join(' '));svg.append(p);};
      for(const ring of [.25,.5,.75,1])shape('opening-radar-web',values.map(()=>max*ring));
      shape('opening-radar-anchor',anchors);shape('opening-radar-shape',values);
      I.attributes.forEach((a,i)=>{const [x,y]=point(i,max*1.28);for(const [text,dy,cls] of [[a.name,0,''],[String(values[i]),18,'opening-radar-value']]){const t=doc.createElementNS(ns,'text');t.setAttribute('x',String(x));t.setAttribute('y',String(y+dy));t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');if(cls)t.setAttribute('class',cls);t.textContent=text;svg.append(t);}});
      return svg;
    }
    function stopForge(){forgeEpoch++;if(forge){forgeClosing=forge.dispose();forge=null;}return forgeClosing;}
    async function forgeImage(value){
      if(/^data:image\/(?:webp|png|jpeg);base64,/.test(value))return value;
      const win=doc.defaultView,resources=win.CxxResources||global.parent?.CxxResources,lease=resources?await resources.acquire(value):{url:value,release(){}};
      try{
        const response=await win.fetch(lease.url);if(!response.ok)throw Error('装配图片读取失败。');
        const blob=await response.blob();if(!/^image\/(?:webp|png|jpeg)$/.test(blob.type))throw Error('装配图片格式不符。');
        return await new Promise((resolve,reject)=>{const reader=new win.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('装配图片读取失败。'));reader.readAsDataURL(blob);});
      }finally{lease.release();}
    }
    async function revealItem(hero,from,to){
      const closing=stopForge(),epoch=forgeEpoch;
      if(motion()==='low')return;
      const css=()=>{if(!destroyed&&epoch===forgeEpoch&&motion()!=='low')hero.animate([{opacity:0,filter:'blur(6px)'},{opacity:1,filter:'blur(0px)'}],{duration:520,easing:'cubic-bezier(.23,1,.32,1)'});};
      await closing;if(destroyed||epoch!==forgeEpoch||motion()==='low')return;
      let images;try{images=from===to?await forgeImage(to).then(value=>[value,value]):await Promise.all([forgeImage(from),forgeImage(to)]);}catch{css();return;}
      if(destroyed||epoch!==forgeEpoch||motion()==='low')return;
      const colors=doc.defaultView.getComputedStyle(stage),settings={colorScheme:colors.colorScheme,pixelRatio:doc.defaultView.devicePixelRatio||1,interactive:colors.getPropertyValue('--cxx-interactive').trim(),structure:colors.getPropertyValue('--cxx-structure').trim(),imageRatio:doc.defaultView.innerWidth<=760?.56:.62};
      forge=global.CxxVisualProjects.mount({id:'cxx-forge-dissolve@2',parent:stage,inputs:{theme:JSON.stringify(settings),from:images[0],to:images[1]},onFallback:()=>{hero.style.visibility='';css();},onEvent:event=>{if(event.name==='complete'&&epoch===forgeEpoch){hero.style.visibility='';void stopForge();}}});
      const holder=forge,ready=await holder.ready;if(destroyed||epoch!==forgeEpoch)return;if(ready)hero.style.visibility='hidden';
    }
    function paintStage(step){
      if(['preferences','profile','scenario'].includes(step)||state.restoreChoice){stageKey='';return;}
      const e=originEntry();let key='',scene=step+':'+e.id,fill;
      if(step==='origin'){key=scene;fill=()=>{stageArt.dataset.kind='scene';stageArt.replaceChildren(originArt(e,''));setCaption(e.en,e.name,e.intro);};}
      else if(step==='growth'){const setup=state.draft.growth?.[e.id]||I.initialSetup(e.id),values=I.attributes.map(a=>Number(setup.attributes?.[a.id])||0),anchors=e.id==='custom'?values:I.attributes.map(a=>I.anchors[e.id]?.[a.id]??0);key=scene+':'+values.join(',');
        fill=()=>{stageArt.dataset.kind='radar';stageArt.replaceChildren(radar(values,anchors));setCaption('ATTRIBUTES / '+e.en,e.name,e.id==='custom'?'按你的出身背景设定初始数值。':'虚线是出身带来的起点，实线是分配后的属性。');};}
      else if(step==='loadout'){const item=selectedItem,L=global.CxxLoadout,A=global.CxxPlayerArt;key=scene+':'+(item?JSON.stringify(item.row):'none');
        fill=()=>{stageArt.dataset.kind='item';stageArt.replaceChildren();if(item){const bench=node('div','opening-forge-bench'),ring=node('div','opening-forge-ring'),hero=node('div','opening-forge-hero'),stats=node('dl','opening-forge-stats');stageArt.style.setProperty('--loadout-grade','var(--cxx-grade-'+item.d.tier+')');bench.append(ring,hero);hero.innerHTML=A.icon(item.d,{assets:item.row.artUpload?{[item.row.artUpload.id]:item.row.artUpload}:{}});stats.hidden=!item.stats.length;for(const stat of item.stats){const row=node('div','');row.append(node('dt','',stat.name),node('dd','',stat.value));stats.append(row);}stageArt.append(bench,stats);setCaption(item.part+' · '+L.grades[item.d.tier-1],item.d.name,item.description);const next=hero.querySelector('img').src;void revealItem(hero,itemSource||next,next);itemSource=next;}else{stopForge();itemSource='';setCaption('LOADOUT','尚未添加初始物品','可以空手开局，也可以在右侧添加。');}};}
      else{const d=state.draft,title=scenarioTitle(d.scenario);key=scene+':'+(d.profile?.name||'')+title;
        fill=()=>{stageArt.dataset.kind='scene';stageArt.replaceChildren(originArt(e,''));setCaption('YOUR STORY / 档案确认',d.profile?.name||'沿用当前人物',[e.name,title].filter(Boolean).join(' · '));};}
      if(key===stageKey)return;const changed=scene!==stageScene;stageKey=key;stageScene=scene;fill();if(changed&&step!=='loadout')reveal();
    }
    function setCaption(label,title,text){captionLabel.textContent=label||'';captionTitle.textContent=title||'';captionText.textContent=text||'';captionText.hidden=!text;}
    function paintSteps(){
      const d=state.draft,values=[originEntry().name,d.profile?.name||'',I.attributes.length?'属性已分配':'','已确认装备',scenarioTitle(d.scenario),''];
      navValues.forEach((value,i)=>{const text=d.completed.includes(steps[i])&&steps[i]!==d.step?values[i]:'';if(value.textContent!==text)value.textContent=text;value.hidden=!text;});
    }
    // Motion (DESIGN.md 10.4 / 10.10): rows slide in from the right, the stage cross-fades; low effects,
    // reduced motion and keyboard entry go straight to the end state.
    function motion(){const w=doc.defaultView;if(w.matchMedia?.('(prefers-reduced-motion: reduce)').matches||doc.activeElement?.matches?.(':focus-visible'))return 'low';const level=(w.parent||w).Cxx236Preferences?.read?.().level;return level==='low'||level==='high'?level:'medium';}
    const theme=()=>doc.documentElement.dataset.cxxTheme||'red';
    function enterRows(){
      const level=motion();if(level==='low'||typeof body.animate!=='function')return;const t=theme();
      const frames=t==='yellow'?[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}]:t==='night'?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateX(24px)'},{opacity:1,transform:'none'}];
      const rows=body.querySelectorAll(':scope>h2,:scope>.identity-note,.identity-card,.identity-attribute,.identity-point-total,.identity-panel>button,.opening-review-card,.opening-band-card,.opening-character-card,.opening-scene-card');
      [...rows].slice(0,14).forEach((row,i)=>row.animate(frames,{duration:t==='yellow'?180:t==='night'?160:200,delay:Math.min(i*24,240),easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'}));
      body.querySelectorAll('.loadout-tile').forEach((row,i)=>row.animate([{opacity:0,transform:'perspective(600px) rotateY(-50deg)'},{opacity:1,transform:'none'}],{duration:280,delay:i*50,easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'}));
    }
    function reveal(){
      const level=motion();if(level==='low'||typeof stageArt.animate!=='function'||stage.offsetParent===null)return;
      stageArt.animate([{opacity:.35},{opacity:1}],{duration:200,easing:'ease-out'});
      if(level==='high'&&theme()!=='night')stageScan.animate([{top:'0%',opacity:1},{top:'100%',opacity:.2}],{duration:400,easing:'linear'});
    }
    function clearGuidance(){if(markedInput){markedInput.removeAttribute('aria-invalid');markedInput.removeAttribute('aria-describedby');markedInput=null;}}
    function focusGuidance(){
      const target=state.guidance;if(!target||state.busy)return;clearGuidance();
      const input=target.step==='profile'?creator?.focusField(target.field):[...body.querySelectorAll('[data-opening-field]')].find(el=>el.dataset.openingField===target.field);
      if(input){markedInput=input;input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',notice.id);input.focus({preventScroll:true});input.scrollIntoView({block:'center',inline:'nearest'});}else{const title=body.querySelector('h2');title?.focus({preventScroll:true});title?.scrollIntoView({block:'nearest'});}
    }
    async function copyDetails(value){const host=doc.defaultView.parent||doc.defaultView;let report=value;try{if(host.CxxDiagnostics?.issue)report=await host.CxxDiagnostics.issue(value);else report={schema:'cyber2051.issue.v1',error:value,save:host.__cxx_chat_save_guard_v1?.status?.()||null,diagnosticService:'loading'};}catch(e){report={error:value,diagnosticError:e.message};}const raw=JSON.stringify(report,null,2);try{await doc.defaultView.navigator.clipboard.writeText(raw);}catch{const text=node('textarea','',raw);text.readOnly=true;recovery.append(text);text.select();}}
    async function showRecovery(run){
      const result=run?await flow.recover():await flow.inspect();if(destroyed)return;
      feedback.hidden=false;details.hidden=false;details.open=true;recovery.replaceChildren(node('p','',result.message));
      if(result.action==='recover')recovery.append(button('恢复并继续创建',()=>showRecovery(true)));
      if(result.action==='open-story')recovery.append(button('进入对应故事',()=>flow.openRecovery(result.chatId)));
      recovery.append(button('复制诊断',()=>copyDetails({result,lastError:state.lastError})),button('救援与导出',()=>flow.rescue()));
    }
    const motionHost=doc.defaultView.parent||doc.defaultView,reducedMotion=doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)');
    function settleMotion(){const closing=stopForge();for(const animation of root.getAnimations({subtree:true}))animation.cancel();const hero=stageArt.querySelector('.opening-forge-hero');if(hero)hero.style.visibility='';return closing;}
    motionHost.addEventListener('cxx-theme-change',settleMotion);motionHost.addEventListener('cxx-ui-preferences-changed',settleMotion);reducedMotion.addEventListener('change',settleMotion);
    const off=flow.subscribe(s=>{const restored=state.restoreChoice&&!s.restoreChoice;state=s;if(restored)preferScreen=!s.draft.preferences?.nsfwChosen;if(!destroyed)paint();});
    return {root,refresh:paint,destroy(){const closing=settleMotion();motionHost.removeEventListener('cxx-theme-change',settleMotion);motionHost.removeEventListener('cxx-ui-preferences-changed',settleMotion);reducedMotion.removeEventListener('change',settleMotion);creator?.destroy();fullTalent?.destroy();stopLayout?.();resizeObserver?.disconnect();sizeWindow.cancelAnimationFrame(layoutFrame);sizeWindow.removeEventListener('resize',resizeLayout);destroyed=true;stopOrientation?.();off();loadout?.destroy();preview.unmount();root.hidden=true;void closing.then(()=>root.remove());}};
  }
  return {mount};
});
