/* Derived from 卡片源码/运行时/civic-ui.js; source SHA256 f0e0fa944ff2bf814ebc7203218de373c11942f2600a25dbb5b0f583bc76c962. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const api={create:factory};if(typeof module==='object'&&module.exports)module.exports=api;else {root.CxxCivicUI=api;if(root)root.CxxCivicUI=api;}})(globalThis,function(options){
 'use strict';
 const {window:win,read,scope,focus}=options;
 const doc=win.document,P=win.CxxPolice,City=win.CxxCity,A=City;
 let dialog=null,body=null,note=null,style=null,page='police',stopped=false,busy=false,openedScope='';
 const el=(tag,text,parent,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;parent.append(n);return n;};
 const button=(label,fn,parent)=>{const b=el('button',label,parent);b.type='button';b.onclick=()=>{if(!busy&&!stopped)fn();};return b;};
 const status={pursuit:'追捕中',search:'搜索中',filed:'已登记',ended:'本次响应已结束',detained:'已拘押',resolved:'已处理',corrected:'已纠正'};
 const yen=n=>'¥'+Number(n||0).toLocaleString('zh-CN');
 function close(){if(dialog?.open)dialog.close();}
 function draft(text){try{note.textContent=win.CxxWebPlayer.draft(text);close();}catch(e){note.textContent=e.message;}}
 async function commit(request){busy=true;note.textContent='正在保存…';body.setAttribute('aria-busy','true');
  try{if(scope()!==openedScope)throw Error('故事已经切换，请重新打开。');await win.CxxWebPlayer.commit(request);if(!stopped&&scope()===openedScope){paint();note.textContent='已保存。';}}
  catch(e){if(!stopped)note.textContent=e.message;}finally{busy=false;body?.setAttribute('aria-busy','false');}
 }
 function police(stat){const actor=A.selected(stat),view=P.view(stat,actor.actorId),summary=el('section',undefined,body,'civic-summary');
  el('h2',actor.record.name+' · 警情',summary);const stars=el('p','★'.repeat(view.stars)+'☆'.repeat(5-view.stars),summary,'civic-stars');stars.setAttribute('aria-label','当前警星 '+view.stars+' 星');stars.dataset.active=String(view.stars>0);
  el('p',view.longTerm.length?'长期通缉：'+view.longTerm.map(w=>w.scope==='tokyo'?'全东京':P.rules.districts[w.scope]?.name||w.scope).join('、'):'没有长期通缉记录',summary);
  if(view.held)el('p',view.held.facility+' · 距已登记期限结束还剩 '+view.held.remainingMinutes+' 个故事分钟',summary);
  if(!view.cases.length)el('p','尚无已登记警情。',body);
  for(const c of view.cases.slice().reverse()){
   const card=el('article',undefined,body,'civic-record');el('h3',(P.rules.districts[c.district]?.name||c.district)+' · '+(status[c.tracking]||c.tracking),card);
   el('p',(c.valid?'本案严重度 '+c.level+' 星':'本案已撤销')+' · 当前响应 '+c.current+' 星 · '+(c.ordinary?'普通通缉有效':'普通通缉已结束'),card);
   if(c.fineDue||c.finePaid)el('p','应罚 '+yen(c.fineDue)+' · 已缴 '+yen(c.finePaid)+' · 已减免 '+yen(c.fineWaived)+' · 尚欠 '+yen(Math.max(0,c.fineDue-c.finePaid-c.fineWaived)),card);
   if(c.identity===true)el('p','你已得知：警方确认了本案人物身份。',card);
   if(c.clue)el('p','已知线索：'+c.clue,card);
   for(const item of c.heldItems)el('p','扣押中：'+item.name+' ×'+item.quantity+' · '+item.keeper+' · '+({ordinary:'普通保管',evidence:'涉案物品',contraband:'违禁物'}[item.type]),card);
   const correction=P.correction(stat,c.id);if(correction){const controls=el('div',undefined,card,'civic-actions');button('核对本案识别',()=>{
    controls.replaceChildren();el('p',correction.message,controls);for(const fact of correction.evidence)el('blockquote',fact.quote,controls);
    button('确认纠正本案识别',()=>commit({action:'police-correct',id:'correct_'+P.hash(c.id+'|'+correction.expected),...correction,actorId:actor.actorId,...(actor.binding?{actorBinding:actor.binding}:{})}),controls);
    button('返回',paint,controls);
   },controls);}
  }
  const actions=el('div',undefined,body,'civic-actions');button('尝试投降／交涉',()=>draft('我停止威胁动作，尝试向现场警方说明情况并表达投降或配合调查的意愿，等待他们的回应。'),actions);
 }
 function places(stat){const actor=A.selected(stat),city=stat.terminal?.city||{},search=el('label','查找地点',body,'civic-search'),input=el('input',undefined,search);input.type='search';input.placeholder='地点名称或用途';
  const list=el('div',undefined,body,'civic-place-list');
  function render(){list.replaceChildren();const query=input.value.trim().toLocaleLowerCase();
   for(const raw of [...City.data.places,...Object.values(city.temporary||{})]){const p=City.place(stat,raw.id);if(!City.known(stat,p.id)||query&&!([p.name,p.cat,p.desc,p.district].join(' ').toLocaleLowerCase().includes(query)))continue;
    const card=el('article',undefined,list,'civic-record');el('h3',p.name,card);el('p',(p.district||City.data.regions.find(r=>r.id===p.group)?.name||'')+' · '+({open:'营业／可访问',closed:'已停业',destroyed:'已损毁'}[p.status||p.defaultStatus]||'')+(p.owner?' · 经营者：'+p.owner:''),card);
    if(p.desc){const details=el('details',undefined,card);el('summary','地点详情',details);el('p',p.desc,details,'civic-prose');}
    if(['private','school'].includes(p.kind))el('p',city.access?.[actor.actorId]?.[p.id]?.allowed?'已有入内许可，仍按当前现场安排进入。':'尚无入内许可，可以先联系或询问。',card);
    for(const c of Object.values(city.contacts||{}).filter(c=>c.actorId===actor.actorId&&c.placeId===p.id))el('p','上次获知 '+c.person+' 在此；当前位置以正文为准。',card);
    const actions=el('div',undefined,card,'civic-actions');for(const a of City.actions(stat,p.id))button(a.label,()=>draft(a.draft),actions);
    if(!city.temporary?.[p.id])button('地图定位',()=>{close();focus('tokyo-central',p.id);},actions);
   }
   if(!list.childElementCount)el('p','没有匹配的已知地点。',list);
  }input.oninput=render;render();
  for(const [id,candidate]of Object.entries(city.candidates||{})){const card=el('article',undefined,body,'civic-record');el('h3','新地点待确认：'+candidate.name,card);el('p',candidate.desc,card);el('blockquote',candidate.quote,card);el('p','确认后加入本故事地点清单；实际到达再由正文记录。',card);
   const controls=el('div',undefined,card,'civic-actions'),expected=JSON.stringify(candidate);
   for(const [action,label]of [['city-confirm-place','加入地点清单'],['city-dismiss-place','忽略此候选']])button(label,()=>commit({action,id:'place_'+P.hash(action+'|'+id+'|'+expected),candidateId:id,expected,actorId:actor.actorId,...(actor.binding?{actorBinding:actor.binding}:{})}),controls);
  }
 }
 function paint(){if(!body||stopped)return;body.replaceChildren();const stat=read();if(page==='police')police(stat);else places(stat);for(const b of dialog.querySelectorAll('[data-civic-page]'))b.setAttribute('aria-pressed',String(b.dataset.civicPage===page));}
 function ensure(){if(dialog)return;style=el('style',globalThis.CxxCivicStyle||win.CxxCivicStyle||'',doc.head);dialog=el('dialog',undefined,doc.body,'cxx-civic');dialog.setAttribute('aria-label','城市记录');const header=el('header',undefined,dialog);el('h1','城市记录',header);button('关闭',close,header);const nav=el('nav',undefined,dialog);for(const [key,label]of [['police','警方与通缉'],['places','地点与线索']]){const b=button(label,()=>{page=key;paint();},nav);b.dataset.civicPage=key;}body=el('main',undefined,dialog);note=el('p','',dialog,'civic-status');note.setAttribute('role','status');dialog.addEventListener('cancel',e=>{e.preventDefault();close();});}
 return {open(key='police'){if(stopped)return;openedScope=scope();if(!openedScope)throw Error('请先打开故事。');page=key;ensure();paint();if(!dialog.open)dialog.showModal();},close,refresh(){if(dialog?.open&&!busy)paint();},destroy(){stopped=true;close();dialog?.remove();style?.remove();dialog=body=note=style=null;}};
});
