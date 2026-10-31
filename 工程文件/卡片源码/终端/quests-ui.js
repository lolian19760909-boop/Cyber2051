(function(root,factory){const api=factory(root.CxxQuests,typeof module==='object'&&module.exports?require('../运行时/quest-view.js'):root.CxxQuestView,typeof module==='object'&&module.exports?require('./quest-controller.js'):root.CxxQuestController);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxQuestUI=api;})(globalThis,function(Q,View,Controller){
 'use strict';
 function mount(container,{read,definitions,commit,compose,map,source=()=>({}),viewSource=()=>({}),view={},onView=()=>{},observer,motion=()=>{}}){
  const doc=container.ownerDocument,win=doc.defaultView;let dead=false,confirmation=null,cue='enter';const control=Controller.create({read,source,commit,uuid:()=>win.crypto.randomUUID(),changed:render,observer});
  const v=Object.assign(view,{filter:view.filter||'all',page:view.page||'list',scrolls:view.scrolls||{},listScroll:view.listScroll||0});
  const el=doc.createElement('section');el.className='cxx-journal sec-page';el.setAttribute('aria-label','委托日志');container.append(el);const transitions=win.CxxMotion?.mount(el);
  const n=(tag,text,parent,cls)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==null)e.textContent=text;parent?.append(e);return e;};
  const btn=(text,fn,parent,cls)=>{const b=n('button',text,parent,cls);b.type='button';b.onclick=()=>{try{fn();}catch(e){control.notice(e.message,true);}};return b;};
  const money=value=>Number.isSafeInteger(value)?'¥ '+value.toLocaleString('zh-CN'):'未核实';
  function remember(){const list=el.querySelector('.journal-list'),detail=el.querySelector('.journal-copy');if(list&&list.offsetHeight)v.listScroll=list.scrollTop;if(detail&&detail.offsetHeight&&v.selected)v.scrolls[v.selected]=detail.scrollTop;onView(v);}
  function projection(stat){return View.project(stat,definitions(),viewSource());}
  const request=control.request;async function run(req){confirmation=null;return control.run(req);}
  function choose(id){remember();v.selected=id;v.page='detail';confirmation=null;cue='select';if(!control.state().pending)control.notice('');else render();el.querySelector('.journal-copy h2')?.focus({preventScroll:true});}
  function back(){remember();v.page='list';confirmation=null;cue='enter';render();el.querySelector('[data-quest-id="'+v.selected+'"]')?.focus({preventScroll:true});}
  function review(action,q){remember();confirmation={action,q};render();el.querySelector('.journal-confirm')?.focus({preventScroll:true});}
  function render(){if(dead)return;if(cue&&el.children.length&&transitions)void transitions.update(el,renderNow,{direction:v.page==='list'?-1:1});else renderNow();}
  function renderNow(){
   if(dead)return;remember();control.reconcile();const {busy,message,error,pending}=control.state();const stat=read()||{},snapshot=projection(stat),j=Q.journal(stat),rows=snapshot.items.map(item=>item.definition),selected=rows.find(q=>q.id===v.selected),focus=doc.activeElement?.dataset?.focus;
   el.replaceChildren();el.dataset.page=el.dataset.view=selected?v.page:'list';el.dataset.busy=String(busy);
   const head=n('header',null,el,'journal-head sec-head'),name=n('div',null,head,'sec-title');n('small','JOURNAL / TOKYO 2051',name,'sec-eyebrow');n('h1','委托日志',name);n('span',null,head,'sec-grow');
   const filters=n('nav',null,head,'journal-filters sec-tabs');filters.setAttribute('aria-label','委托筛选');
   for(const [id,label]of [['all','全部'],['active','已接取'],['main','主线'],['history','历史']]){const b=btn(label,()=>{remember();v.filter=id;v.page='list';cue='tab';render();},filters);b.setAttribute('aria-pressed',String(v.filter===id));b.dataset.focus='filter-'+id;}
   const balance=n('div',null,head,'journal-wallet sec-figure');n('small','可用资金',balance);n('strong',money(Number(Q.actor(stat).wallet?.yen)),balance);
   const workspace=n('div',null,el,'journal-workspace sec-body'),left=n('section',null,workspace,'journal-index sec-list-pane');
   const list=n('div',null,left,'journal-list sec-list');list.setAttribute('aria-label','委托列表');
   const visible=rows.filter(q=>{const r=Q.record(stat,q.id);return v.filter==='active'?Q.active.includes(r.state):v.filter==='history'?Q.closed.includes(r.state):v.filter==='main'?q.track==='main':true;});
   if(!visible.length)n('p',v.filter==='main'?'当前内容中尚无主线任务。新主线将在后续内容更新中加入。':'这里还没有记录。可在「全部」中查看委托。',list,'journal-empty');
   // The full list groups main story, commissions and closed records; a filter shows one group.
   const closed=q=>Q.closed.includes(Q.record(stat,q.id).state),groups=v.filter==='all'?[['主线',q=>q.track==='main'&&!closed(q)],['委托',q=>q.track!=='main'&&!closed(q)],['历史',closed]]:[[{active:'已接取',main:'主线',history:'历史'}[v.filter],()=>true]];
   for(const [label,test]of groups){const members=visible.filter(test);if(!members.length)continue;n('p',label+' · '+members.length,list,'journal-group sec-group');
    for(const q of members){const r=Q.record(stat,q.id),tracked=j.tracked===q.id,b=btn('',()=>choose(q.id),list,'journal-row sec-row');b.dataset.questId=q.id;b.setAttribute('aria-pressed',String(q.id===v.selected));n('span',null,b,'sec-icon'+(q.track==='main'?' is-main':'')).setAttribute('aria-hidden','true');n('strong',q.title,b,'journal-row-title');n('span',tracked?'追踪中':r.state,b,'journal-row-state sec-chip'+(tracked?' is-attention':''));n('small',[q.fixer,q.district,tracked&&r.state].filter(Boolean).join(' · ')||'旧档案',b);}}
   list.scrollTop=v.listScroll;
   const indexFoot=n('footer',null,left,'journal-index-foot');n('small','当前追踪',indexFoot);n('span',View.display(snapshot,'title','尚未选择'),indexFoot);
   const detail=n('section',null,workspace,'journal-detail sec-detail');
   // With nothing chosen yet, a wide screen previews the first listed commission.
   const preview=!selected&&win.matchMedia('(min-width:701px)').matches?rows.find(q=>q.id===list.querySelector('.journal-row')?.dataset.questId):null;if(preview)list.querySelector('.journal-row').setAttribute('aria-pressed','true');
   if(selected||preview){
    const q=selected||preview,r=Q.record(stat,q.id),bar=n('nav',null,detail,'journal-detail-bar');btn('‹ 返回列表',back,bar,'journal-back');n('span',(q.track==='main'?'主线':'委托')+' / '+r.state+' · '+(q.chapterId?'剧情章节':q.id.toUpperCase()),bar,'sec-eyebrow');
    const copy=n('div',null,detail,'journal-copy sec-scroll');n('p',[q.fixer,q.type,q.difficulty&&q.difficulty+'风险'].filter(Boolean).join(' / '),copy,'journal-kicker');const h=n('h2',q.title,copy);h.tabIndex=-1;
    const goal=n('div',null,copy,'journal-objective sec-objective');n('small',r.state==='完成'?'已达成目标':'当前目标',goal);n('p',snapshot.items.find(item=>item.id===q.id).objective,goal);
    n('p',q.brief||'',copy,'journal-brief');
    if(r.state!=='已发布')n('p','接单人：'+Q.owner(stat,q.id).record.name,copy,'journal-note');
    if(r.knownFacts){n('h3','已知进展',copy);n('p',r.knownFacts,copy,'journal-facts');}
    const pay=n('div',null,copy,'journal-pay sec-terms');for(const [title,amount]of [['当前约定',r.agreedYen??q.pay],['实际收到',r.paidYen],['实际退还',r.refundedYen]]){const cell=n('div',null,pay);n('small',title,cell);n('strong',q.chapterId&&title==='当前约定'&&!amount?'简报中协商':money(amount),cell);}n('p',r.settled?'报酬已结清。':'完成与收款分别记录；金额以剧情中实际支付为准。',copy,'journal-note');
    const terms=n('details',null,copy,'journal-terms');n('summary','要求、风险与报酬条款',terms);for(const [label,value]of [['要求',q.terms],['风险',q.risk],['额外约定',q.bonus],['报酬说明',q.payNote],['期限',r.deadlineAt||q.deadline],['接取条件',q.unlock],['完成评级',r.rank]])if(value&&value!=='无'){n('h3',label,terms);n('p',value,terms);}n('p','期限按故事时间判断；离开页面不会让现实时间推进任务。',terms,'journal-note');
    if(q.placeId)btn('在地图中查看 ↗',()=>map(q.id),copy,'journal-map sec-link');
    if(Q.correction(stat)?.[1].questIds?.includes(q.id))btn('这次识别有误…',()=>review('correct',q),copy,'journal-correct sec-link');
    copy.scrollTop=v.scrolls[q.id]||0;
    const foot=n('footer',null,detail,'journal-actions sec-actions');btn('返回',back,foot,'journal-back sec-button');btn(j.tracked===q.id?'取消追踪':'追踪',()=>run(request('track',q.id)),foot,'journal-secondary sec-button');
    const action=r.state==='已发布'||r.state==='已放弃'&&r.startedFloor===undefined||['失败','已放弃'].includes(r.state)&&q.retry?'accept':r.state==='已接取'?'start':['暂离','搁置'].includes(r.state)?'resume':null;
    if(action&&!q.legacy&&!(q.chapterId&&action==='start')){const reason=Q.available(stat,q,action,rows);const b=btn(({accept:q.chapterId?'展开章节':'接取委托',start:'开始执行',resume:'继续执行'})[action],()=>action==='accept'?review(action,q):run(request(action,q.id)),foot,'journal-primary sec-button is-primary');b.disabled=busy||!!reason;b.title=reason;if(reason)n('p',reason,copy,'journal-reason');}
    if(Q.active.includes(r.state)){
     btn('写入行动 ↗',()=>{compose(q,r);control.notice('已写入行动草稿。返回阅读后，可补充做法并发送。');},foot,'journal-primary sec-button is-primary');
     const more=n('details',null,copy,'journal-more');n('summary','暂离与放弃',more);if(r.state==='进行中'){const b=btn('暂时离开',()=>review('pause',q),more);const why=Q.available(stat,q,'pause',rows);b.disabled=!!why;b.title=why;}
     btn('放弃本次委托',()=>review('abandon',q),more);n('p','暂离保留进度；放弃结束本次委托。已领取的钱和物品不会自动退还。紧急现场的后果由剧情决定。',more,'journal-note');
    }
   }else {n('p','选择一份委托',detail,'journal-welcome');n('p','阅读简报，决定下一步。',detail,'journal-note');}
   const status=n('div',null,el,'journal-status');status.setAttribute('role','status');status.dataset.error=String(error);n('span',message,status);if(pending&&!busy)btn('重试保存',()=>run(pending),status);
   if(confirmation){const {action,q}=confirmation,box=n('div',null,el,'journal-confirm');box.tabIndex=-1;box.setAttribute('role','dialog');box.setAttribute('aria-label','确认委托操作');n('h2',action==='correct'?'撤销最近一次识别':action==='accept'?(q.chapterId?'展开这段故事？':'接下这份委托？'):action==='pause'?'暂时离开？':'放弃本次委托？',box);n('strong',q.title,box);
    let extra={};if(action==='correct'){const found=Q.correction(stat);if(found){extra.receiptId=found[0];n('p','以下识别将恢复到修改前；原正文不变。关联钱包必须仍与本次记录一致，否则不会执行。',box);for(const c of found[1].changes)n('p',c.parts.slice(1).join(' / ')+'：'+String(c.after)+' → '+(c.missing?'未记录':String(c.before)),box,'journal-change');}}
    else n('p',action==='accept'?(q.chapterId?'从当前经历接上与爱音的合作。是否接下后续工作，在共同简报时决定。':'接单只登记约定。何时出发、如何行动，由你决定；不会提前发放报酬。'):action==='pause'?'保留已发生的进展。若现场仍有危险或期限，离场后果将在后续剧情中处理。':'保留已发生的事实与款项。再次接取需满足该委托的条件。',box);
    const actions=n('div',null,box);btn('取消',()=>{confirmation=null;render();},actions,'sec-button');btn('确认'+({accept:'接取',pause:'暂离',abandon:'放弃',correct:'撤销'})[action],()=>run(request(action,q.id,extra)),actions,'journal-primary sec-button is-primary');
   }
   if(busy)el.querySelectorAll('button').forEach(b=>b.disabled=true);if(focus)el.querySelector('[data-focus="'+focus+'"]')?.focus({preventScroll:true});onView(v);control.observed(snapshot);
   motion(cue||'sync',el);cue=null;
  }
  const onkey=e=>{if(e.key==='Escape'&&!control.state().busy&&(confirmation||v.page==='detail')){e.stopPropagation();e.preventDefault();if(confirmation){confirmation=null;render();}else back();}};el.addEventListener('keydown',onkey);
  render();return {refresh:render,select:choose,readView:()=>{remember();return v;},destroy(){transitions?.dispose();remember();dead=true;control.destroy();el.removeEventListener('keydown',onkey);el.remove();}};
 }
 return {mount};
});
