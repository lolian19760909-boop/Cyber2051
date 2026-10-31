/* Derived from 卡片源码/运行时/ensemble-ui.js; source SHA256 157cfc91241f68e906c32f3bd84e5235b4ca1d27333efe582dd7c805c2ff8563. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(root,local?require('./ensemble-view.js'):root.CxxEnsembleView);if(local)module.exports=api;else root.CxxEnsembleUI=api;})(globalThis,function(root,V){
  'use strict';
  function mount({document:doc,parent,read,register,switchActor,openActor,narrative,viewState={},onViewChange=()=>{}}){
    let snapshot=null,projection=null,disposed=false,sequence=0,pending=false,visible=true,dirty=false,mode=viewState.mode==='author'?'author':'player',selected=viewState.selected||null,query=String(viewState.query||''),tab=viewState.detailTab||'状态';
    const el=(tag,text,where,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;where?.append(n);return n;};
    const host=el('section',undefined,parent,'cxx-ensemble'),shadow=host.attachShadow({mode:'open'});el('style',root.CxxEnsembleStyle||'',shadow);
    const panel=el('div',undefined,shadow,'ensemble-panel'),header=el('header',undefined,panel),heading=el('div',undefined,header);el('h2','人物与状态',heading);const control=el('p','正在读取当前故事…',heading,'control');
    const modeLabel=el('label','查看方式',header),modeSelect=el('select',undefined,modeLabel);modeSelect.setAttribute('aria-label','查看方式');for(const [id,label]of [['player','人物状态'],['author','作者总览']]){const o=el('option',label,modeSelect);o.value=id;}modeSelect.value=mode;
    const note=el('p','',panel,'view-note');
    const toolbar=el('div',undefined,panel,'toolbar'),label=el('label','搜索人物',toolbar),search=el('input',undefined,label);search.type='search';search.value=query;search.placeholder='输入姓名';
    const button=(text,action,where,cls)=>{const b=el('button',text,where,cls);b.type='button';b.onclick=()=>Promise.resolve().then(action).catch(e=>tell(e.message,true));return b;};
    button('重新读取',()=>refresh(),toolbar,'refresh');const status=el('p','读取中…',panel,'status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const layout=el('div',undefined,panel,'ensemble-layout'),list=el('div',undefined,layout,'roster'),details=el('section',undefined,layout,'actor-detail');details.setAttribute('aria-label','人物详情');
    const drawer=el('dialog',undefined,shadow,'ensemble-drawer');drawer.setAttribute('aria-label','人物详情');let opener=null;
    button('返回人物表',()=>drawer.close(),drawer,'drawer-close');
    const compact=()=>host.clientWidth<=850;
    function placeDetail(open=false){
      if(compact()){if(details.parentNode!==drawer)drawer.append(details);if(open&&!drawer.open)drawer.showModal();}
      else{if(drawer.open)drawer.close();if(details.parentNode!==layout)layout.append(details);}
    }
    drawer.addEventListener('close',()=>{opener?.isConnected&&opener.focus();});
    shadow.addEventListener('keydown',event=>{if(event.key==='Escape'&&drawer.open){event.preventDefault();event.stopPropagation();drawer.close();}});
    const resizeObserver=new doc.defaultView.ResizeObserver(()=>placeDetail());resizeObserver.observe(host);
    const fmt=value=>value===null||value===undefined?'未记录':String(value),money=value=>value===null?'未记录':'¥'+value.toLocaleString('zh-CN');
    const state=()=>({mode,selected,query,detailTab:tab});
    const tell=(text,error=false)=>{status.textContent=text;status.className='status'+(error?' error':'');};
    function saveView(){onViewChange(state());}
    function detail(row){
      details.replaceChildren();if(!row){el('p',selected?'这条人物记录已不在当前视图中。':'选择人物查看状态与装备。',details,'empty');return;}
      const top=el('div',undefined,details,'detail-heading');el('h3',row.name,top);el('span',row.controlled?'当前扮演':'模型角色',top,'controller');
      if(!['状态','装备','持有','经历','认知','关系','来源'].includes(tab))tab='状态';
      const tabs=el('nav',undefined,details,'detail-tabs');tabs.setAttribute('aria-label','人物资料分类');for(const name of ['状态','装备','持有','经历','认知','关系','来源']){const b=button(name,()=>{tab=name;detail(row);saveView();details.querySelector('button[aria-pressed="true"]')?.focus();},tabs);b.setAttribute('aria-pressed',String(tab===name));}
      if(row.error)el('p','部分状态需要检查：'+row.error,details,'error');
      if(tab==='状态'){
        el('p',row.state+' · '+(row.present?'当前在场':'离场冻结，显示最后记录'),details,'actor-state');
        const resources=el('div',undefined,details,'resources');for(const [key,name]of [['hp','生命'],['stamina','耐力'],['ram','RAM']]){const v=row.vitals[key],line=el('div',undefined,resources,'resource');el('span',name,line);el('strong',key==='hp'&&!row.physical?'无实体':fmt(v.value)+' / '+fmt(v.max),line);if(v.value!==null&&v.max>0){const meter=el('progress',undefined,line);meter.max=v.max;meter.value=Math.min(v.max,Math.max(0,v.value));meter.setAttribute('aria-label',name);}}
        const facts=el('dl',undefined,details,'facts');for(const [name,value]of [['等级',fmt(row.level)],['SAN',fmt(row.san)+' / 100'],['参考战力',fmt(row.power)],['升级进度',row.progress?.required===null?'已达等级上限':row.progress?row.progress.into+' / '+row.progress.required+' XP':'未记录'],['累计经验',fmt(row.xp)],['属性点',fmt(row.attributePoints)],['专长点',fmt(row.perkPoints)],...row.attributes.map(a=>[a.name,fmt(a.value)]),['余额',money(row.wallet.yen)],['累计收入',money(row.wallet.earned)],['累计支出',money(row.wallet.spent)]]){el('dt',name,facts);el('dd',value,facts);}
        el('h4','已学专长',details);if(!row.perks.length)el('p',row.status==='uninitialized'?'尚未建立成长记录。':'尚未学习专长。',details,'muted');for(const p of row.perks)el('p',p.name+' · '+fmt(p.rank)+'级',details);
        if(row.progress?.lastReward)el('p','最近成果：'+(row.progress.lastReward.fact?.reason||row.progress.lastReward.award.source?.id||'已记录')+' · +'+row.progress.lastReward.award.xp+' XP',details,'muted');
        if(row.progress?.checkModifier)el('p','药物成瘾：能力判定参考修正 '+row.progress.checkModifier,details,'muted');
      }else if(tab==='装备'){
        for(const text of row.loreEquipment||[])el('p',text,details,'muted');
        if(!row.equipment.length)el('p','没有已记录的装配。',details,'empty');
        for(const item of row.equipment){const record=el('article',undefined,details,'equipment-record');el('h4',item.name,record);el('p',item.current?'当前武器':item.active?'主动效果已开启':'已装配',record,'muted');el('p',item.effects.replace('“reflex_boost”','“反射加速已启用”'),record);if(item.description&&!item.effects.includes(item.description))el('p',item.description,record,'muted');}
      }else if(tab==='持有'){
        const table=el('table',undefined,details,'inventory');const tr=el('tr',undefined,el('thead',undefined,table));for(const title of ['物品','数量'])el('th',title,tr);const tbody=el('tbody',undefined,table);
        for(const item of row.inventory){const r=el('tr',undefined,tbody);el('td',item.name,r);el('td',fmt(item.quantity),r);}if(!row.inventory.length)el('p','没有已记录的持有物。',details,'empty');
      }else if(['经历','认知','关系'].includes(tab)){
        const records=narrative?.({actorId:row.actorId,mode});
        if(!records)el('p','记忆组件尚未就绪。',details,'empty');
        else if(!records.enabled)el('p','请在“长期记忆配置”中启用本故事的记忆表。',details,'empty');
        else{
          if(records.tableVersion<2)el('p','本故事仍使用旧模板，点击“长期记忆配置”可保留旧记录并补充认知与关系表。',details,'muted');
          if(!records.databaseAvailable)el('p','原版数据库未启用；此处只读取存档中已有文字材料。',details,'muted');
          const cognition=tab!=='关系',entries=tab==='经历'?records.knowledge.filter(item=>item.kind==='亲历'):cognition?records.knowledge:records.relations;
          if(tab==='经历')el('p','只列本人亲历的记录；听说、猜测和误解可在“认知”中查看。',details,'muted');
          if(!entries.length)el('p',tab==='经历'?'尚无来源有效的亲历记录。':cognition?'尚无来源有效的获知记录。':'尚无来源有效的有向关系记录。',details,'empty');
          for(const item of entries){
            const card=el('article',undefined,details,'equipment-record');
            el('h4',cognition?item.kind:'对 '+(records.names[item.toActorId]||item.toActorId),card);
            el('p',item.current?'当前记录'+(item.conflicted?' · 存在不同记录，请核对来源':''):'历史记录 · 已被后续记录取代',card,'muted');
            el('p',item.text,card);
            if(cognition)el('p','获知途径：'+item.via+(item.informant?' · 告知者：'+(records.names[item.informant]||item.informant):''),card,'muted');
            else{if(item.tags.length)el('p',item.tags.join(' · '),card,'muted');if(item.unresolved)el('p','未解问题：'+item.unresolved,card);}
            el('p','来源：第 '+item.source.floor+' 楼 · 回复 '+(item.source.swipe+1),card,'muted');
            if(mode==='author'){const source=el('details',undefined,card);el('summary','查看来源原句',source);el('p',item.source.quote,source);}
          }
          if(mode==='author'&&records.issues.length)el('p','有 '+records.issues.length+' 条记录因来源或字段不完整未用于投影；原行保留在数据库。',details,'muted');
        }
      }else{
        const source=row.source||{};el('p',source.kind==='author-profile'?'起点来自作者已确认的人物方案。':'沿用本故事已有玩家状态。',details);el('p','显示当前回复分支中的保存状态。',details,'muted');
        if(row.worldbookUid!==undefined)el('p','人物资料编号：'+row.worldbookUid,details);el('p',row.location?'最近确认位置：'+row.location.mapId+' / '+row.location.placeId:'最近位置尚未记录。',details);
      }
      const actions=el('div',undefined,details,'detail-actions');
      if(openActor)button('打开人物面板',()=>openActor(row.actorId),actions);
      if(switchActor&&row.controllable&&!row.controlled&&row.status==='ready')button('扮演此角色',async()=>{if(pending)return;const binding=row.binding;pending=true;panel.setAttribute('aria-busy','true');modeSelect.disabled=true;search.disabled=true;tell('正在切换并读回…');try{const saved=await switchActor(row.actorId,binding);if(disposed)return;await refresh(saved);tell('扮演身份已保存并读回。');}finally{pending=false;panel.removeAttribute('aria-busy');modeSelect.disabled=false;search.disabled=false;}},actions,'primary');
    }
    function paint(){
      projection=V.project(snapshot,{mode,query});if(!selected&&projection.rows.some(r=>r.actorId===projection.controlledActorId))selected=projection.controlledActorId;control.textContent='当前扮演：'+projection.controlName;note.textContent=mode==='author'?'作者总览包含完整已建档资料；查看不会改变角色知情。':'显示全名册精确数值；离场人物冻结。文字认知仍按原视角读取。';list.replaceChildren();
      if(!projection.registered&&register){const initial=el('div',undefined,list,'setup');el('p','本故事尚未登记配套人物。',initial);button('登记已确认的人物',async()=>{if(pending)return;pending=true;tell('正在登记并读回…');try{const result=await register();if(!disposed){await refresh(result);tell('人物已登记并读回。');}}finally{pending=false;}},initial);}
      const table=el('table',undefined,list,'roster-table');const caption=el('caption',mode==='author'?'已建档人物':'人物名册',table);caption.className='sr-only';const tr=el('tr',undefined,el('thead',undefined,table));for(const name of ['人物','等级','生命','SAN / 状态'])el('th',name,tr);const tbody=el('tbody',undefined,table);
      for(const row of projection.rows){const tr=el('tr',undefined,tbody);tr.dataset.actor=row.actorId;tr.classList.toggle('selected',selected===row.actorId);const identity=el('td',undefined,tr);identity.dataset.label='人物';const b=button(row.name,()=>{selected=row.actorId;paint();saveView();opener=list.querySelector('[data-actor="'+row.actorId+'"] button');if(compact())placeDetail(true);else opener?.focus();},identity);b.setAttribute('aria-pressed',String(selected===row.actorId));el('span',row.controlled?'当前扮演':row.status==='uninitialized'?'未建档数值':row.present?'当前在场':'离场冻结',identity,'role');
        for(const [name,value]of [['等级',fmt(row.level)],['生命',row.physical?fmt(row.vitals.hp.value)+' / '+fmt(row.vitals.hp.max):'无实体'],['SAN / 状态',fmt(row.san)+' · '+row.state]]){const td=el('td',value,tr);td.dataset.label=name;}}
      if(!projection.rows.length)el('p',query?'没有匹配的已知人物。':'当前视角没有人物记录。',list,'empty');
      detail(projection.rows.find(r=>r.actorId===selected));placeDetail();
    }
    async function refresh(saved){if(disposed)return;if(!visible){dirty=true;return;}const current=++sequence;try{const next=saved||await read();if(disposed||current!==sequence)return;snapshot=next;paint();tell('已读取当前回复分支。');}catch(e){if(!disposed&&current===sequence){list.replaceChildren();details.replaceChildren();tell(e.message,true);}}}
    modeSelect.onchange=()=>{mode=modeSelect.value;selected=null;paint();saveView();};search.oninput=()=>{query=search.value;paint();saveView();};
    refresh();return {root:host,refresh,readViewState:state,canLeave:()=>!pending,setVisible(value){visible=!!value;if(!visible&&drawer.open)drawer.close();if(visible&&dirty){dirty=false;refresh();}},destroy(){disposed=true;sequence++;resizeObserver.disconnect();if(drawer.open)drawer.close();host.remove();}};
  }
  return {mount};
});
