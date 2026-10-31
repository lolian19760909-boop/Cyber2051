/* MVU proposes sourced facts; the existing quest transaction owns saving and payment. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.CxxMemoryPlot={create:factory};})(globalThis,function({chapter,chapters,quest,quests,detection,lines=[]}){
 const local=typeof module==='object'&&module.exports;
 const structuredClone=(local?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const LineEngine=local?require('../剧情/line-engine.js'):globalThis.CxxStoryLines;
 const Chapters=local?require('../剧情/chapter-engine.js'):globalThis.CxxStoryChapters;
 const GraphCompat=local?require('../剧情/graph-compat.js'):globalThis.CxxStoryGraphCompat;
 const LineModel=local?require('../剧情/line-model.js'):globalThis.CxxStoryLineModel;
 const authorMain=lines.some(line=>line.route==='author-20261018'),legacyMain=(stat,historyRoute)=>!authorMain||(historyRoute||LineModel.mainRoute(stat))==='legacy';
 const storyLines=LineEngine.create(lines),compatible=stat=>GraphCompat.project(stat,lines);
 const copy=v=>structuredClone(v),norm=v=>String(v||'').replace(/\s+/g,' ').trim();
 const common={accept:'玩家明确接下这份委托',started:'玩家实际开始执行这份工作',pause:'玩家实际暂停这份工作',resume:'玩家实际恢复这份工作',leave:'玩家明确拒绝或退出这份工作',fail:'目标已经实际失败，本次工作已无法继续',escape:'玩家在酒店行动中因实际危险被迫撤离，已放弃当前现场步骤'};
 const chapterLines=Chapters.create(chapters===undefined?Chapters.fromChapter(chapter,detection):chapters,{common});
 const stageCount=chapterLines.lines[0]?.nodes.length||0;
 const questRules=detection?.quests||{q01:{collected:'实际取回六套皮下护甲',delivered:'六套护甲已交到巴的诊所后账并验收'}};
 const commissions=(quests||[quest]).filter(Boolean).map(q=>({...copy(q),startMode:'narrative'}));
 const definitions=[...chapterLines.definitions,...commissions,...storyLines.definitions];
 if(new Set(definitions.map(q=>q.id)).size!==definitions.length)throw Error('剧情线编号与已有章节或委托重复。');
 const owns=id=>definitions.some(q=>q.id===id),definition=id=>copy(definitions.find(q=>q.id===id)||null);
 function advance(before,id,events,{Q,source,storyText,questDefinitions=definitions,historyRoute}){
  if(!LineModel.owned(before,id))throw Error('这份剧情记录属于另一位人物，请切回接取人物后继续。');
  if(storyLines.owns(id))return storyLines.advance(compatible(before),id,events,{source,storyText});
  if(!owns(id)||!Array.isArray(events)||!events.length||events.length>8)throw Error('剧情事件须属于已装载内容，并为 1—8 项数组。');
  if(chapterLines.owns(id)){if(id==='q_chip_night'&&!legacyMain(before,historyRoute))throw Error('新故事使用三线13节点，请按当前节点提交事实。');return chapterLines.advance(before,id,events,{Q,source,storyText,questDefinitions:historyRoute==='legacy'?questDefinitions.filter(q=>q.route!=='author-20261018'):questDefinitions});}
  let r=copy(Q.record(before,id)),working=copy(before);working.terminal.quests||={};
  for(const e of events){
   if(!e||Object.keys(e).some(k=>!['event','stage','kind','evidence'].includes(k))||e.kind!=='happened'||!Array.isArray(e.evidence)||!e.evidence.length)throw Error('只登记本轮已经发生的事实；计划、回忆、否定、假设、心声和未选选项不能推进。');
   if(!['accept','progress','complete','pause','resume','leave','fail'].includes(e.event))throw Error('事件不属于当前剧情阶段。');
   const rules=questRules[id];
   const expected=e.event==='accept'?['accept']:['pause','resume','leave','fail'].includes(e.event)?[e.event]:['started',...Object.keys(rules)];
   const evidence={};
   for(const item of e.evidence){const quote=norm(item?.quote),key=item?.fact;
    if(!item||Object.keys(item).some(k=>!['fact','quote'].includes(k))||!expected.includes(item.fact)||evidence[key]||quote.length<8||quote.length>400||!norm(storyText).includes(quote))throw Error('事件条件与本轮有效正文引文不匹配。');
    evidence[key]={quote:item.quote,source:copy(source)};
   }
   if(e.event==='accept'){
    working.terminal.quests[id]=r;
    r=Q.plan(working,{id:'plot_accept',action:'quest-accept',questId:id,expectedRevision:Q.journal(working).revision},{questDefinitions,questSource:source}).terminal.quests[id];
   }else{
    if(e.event==='leave'&&r.state==='已发布')r={...r,id,schema:1,state:'已放弃'};
    else if(['pause','resume','leave'].includes(e.event)){
     working.terminal.quests[id]=r;const action={pause:'pause',resume:'resume',leave:'abandon'}[e.event];
     r=Q.plan(working,{id:'plot_'+action,action:'quest-'+action,questId:id,expectedRevision:Q.journal(working).revision},{questDefinitions,questSource:source}).terminal.quests[id];
    }else if(!['已接取','进行中'].includes(r.state))throw Error('先明确接取；暂停或已结束的任务不能登记执行结果。');
    if(e.event==='fail'){r.state='失败';r.startedFloor??=source.floor;}
   }
   const prior=r.plot||{schema:1,facts:{},history:[],priorFacts:r.knownFacts||''};if(prior.schema!==1)throw Error('剧情事实记录版本不匹配。');
   r.plot={...prior,facts:{...prior.facts,...evidence},history:[...prior.history,{event:e.event,stage:e.stage,source:copy(source),evidence:copy(e.evidence)}]};
   if(['progress','complete'].includes(e.event)){
    if(e.event==='complete'&&Object.keys(rules).some(key=>!r.plot.facts[key]))throw Error('当前片段的退出条件尚未全部得到正文证明。');
    r.state='进行中';r.startedFloor??=source.floor;
    if(e.event==='complete'){r.state='完成';r.objective=id==='q01'?'六套皮下护甲已交到巴的诊所后账；收款按实际发生另记。':definition(id).goal+'（已完成；收款按实际发生另记。）';}
   }
   const labels={...common,...questRules[id]};
   r.knownFacts=[r.plot.priorFacts,...Object.entries(r.plot.facts).map(([key,value])=>(labels[key]||key)+'：'+value.quote)].filter(Boolean).join('\n');
  }
  return r;
 }
 function entries(stat,{historyRoute}={}){const records=stat?.terminal?.quests||{},result=chapterLines.entries(stat).filter(e=>e.lineId!=='q_chip_night'||legacyMain(stat,historyRoute));
  for(const q of commissions){const r=records[q.id]||{state:'已发布'};if(!['已发布','已接取','进行中'].includes(r.state))continue;
   result.push({id:'quest:'+q.id,lineId:q.id,name:q.title,track:q.track||'commission',progress:['已接取','进行中'].includes(r.state),content:r.state==='已发布'?[q.goal,'尚未接取，只有玩家明确接单才开始。'].join('\n'):[q.brief,q.goal,q.terms,q.risk,q.bonus,'约定基础报酬：'+q.pay+'；完成不等于已经收款。'].filter(Boolean).join('\n')});
  }
  return LineEngine.select([...result,...(historyRoute==='legacy'&&authorMain?[]:storyLines.entries(compatible(stat)))].filter(entry=>LineModel.owned(stat,entry.lineId)),stat);
 }
 function context(stat,{analyzes=false,historyRoute}={}){const current=compatible(stat),records=current?.terminal?.quests||{},selected=entries(stat,{historyRoute});let text='【本故事当前剧情条目】\n'+selected.map(e=>'['+e.id+'] '+e.name+'\n'+e.content).join('\n\n');
  const selectedIds=new Set(selected.map(entry=>entry.lineId));
  text+='\n已保存进度：'+JSON.stringify(Object.fromEntries(definitions.filter(q=>records[q.id]&&LineModel.owned(stat,q.id)).map(q=>{const r=records[q.id];return [q.id,{state:r.state,stage:r.chapter?.stage,knownFacts:(r.knownFacts||'').slice(-1200),ending:r.line?.ending?.title}];})));
  const paused=storyLines.definitions.flatMap(q=>{const r=records[q.id];if(!r||!LineModel.owned(stat,q.id)||!['已接取','进行中'].includes(r.state))return [];return storyLines.view(current,q.id).nodes.filter(n=>n.state==='paused').map(n=>({line:q.id,node:n.id,title:n.title}));});
  if(paused.length)text+='\n已暂停的节点（只按玩家实际重返行动恢复）：'+JSON.stringify(paused);
  const ownedStat={...stat,terminal:{...stat.terminal,quests:Object.fromEntries(Object.entries(records).filter(([id])=>LineModel.owned(stat,id)))}};
  text+=chapterLines.ended(ownedStat);
  if(authorMain)text+='\n主线路由：'+(legacyMain(stat,historyRoute)?'此档有旧盗芯实际进度，继续原八段；新13节点不重复开启，后续资格不从旧完成状态推算。':'新故事使用三线13节点，旧q_heist／q_chip_night不启动。芯片未植入玩家时不进入玩家寄宿的双魂线，继续玩家实际选择的故事。');
  const retained=GraphCompat.unloaded(ownedStat,lines);if(retained.length)text+='\n旧节点记录已保留，定义未装载时不重算或推进：'+JSON.stringify(retained);
  if(analyzes){
   const conditions=Object.fromEntries(commissions.filter(q=>selectedIds.has(q.id)).map(q=>[q.id,questRules[q.id]]));
   text+='\n【剧情事实检测：复用本次 MVU】先判定时态、主体及是否真正发生。计划、回忆、假设、否定、私人心声、未选择的选项、浏览／地图／追踪都不产生事件。承诺仅证明承诺，不能证明履行。无需更新时不输出事件。';
   text+='\n对已装载任务，仅输出 add /terminal/quests/<id>/events，value 为事件数组，禁止直接改 state/objective/knownFacts/chapter/plot。每项格式 {"event":"progress","kind":"happened","evidence":[{"fact":"条件编号","quote":"当前助手正文中八至四百字的原句"}]}'+chapterLines.lines.map(line=>line.texts.eventNote).join('')+'。程序合并已经保存的条件，可以同批顺序接取和推进；不要重复接取或跨过尚未演出的段落。';
   text+='\n通用事件：accept'+(chapterLines.lines.length?'（'+chapterLines.lines.map(line=>line.texts.acceptNote).join('；')+'）':'')+'；progress 记录当前段条件；pause/resume/leave/fail 分别使用同名事实。条件含义：'+JSON.stringify(common)+'。';
   text+=chapterLines.rules(stat,selectedIds);
   text+='\n常规委托 complete 要求对应条件全部成立：'+JSON.stringify(conditions)+'。合理替代做法按实际达到的目标判断；时间、损伤和额外奖金按原约定及实际结果另记，不能仅因目标完成自动视为无损或准点。';
   text+='\n钱款继续使用现有 MVU 钱包及委托实际款项字段，必须实际发生并同批记账；不因事件自动付款或发物品。未接取前明确拒绝可提交 leave。旧版 q_heist 使用原记录及原更新路径。';
   if(storyLines.definitions.length)text+='\n【节点剧情线】'+JSON.stringify(selected.filter(e=>e.nodeId).map(e=>({line:e.lineId,node:e.nodeId})))+'。仍提交 add /terminal/quests/<line>/events；普通事实用 {event:"progress",node:"节点编号",kind:"happened",evidence:[{fact:"条件编号",quote:"本轮正文原句"}]}，条件齐全自动完成。不要发送 accept/advance/complete。结果用 event:"outcome" 并填 outcome:"结果编号"，evidence.fact 为该结果编号；实际重返暂停节点用 event:"resume"、fact:"resume"。门槛与结局由程序计算，禁止直写 line/state/knownFacts。';
   if(storyLines.definitions.length)text+='\n节点有choices时，按实际发生择一提交 {event:"choice",node:"节点编号",choice:"组编号",value:"选项编号",kind:"happened",evidence:[{fact:"组编号_选项编号",quote:"本轮正文原句"}]}。每组仅确认一个实际结果；所有完成条件与必选分歧齐全才完成。玩家拒绝接入同样是可记录事实，不代玩家选择。';
  }return text;
 }
 const openings=(stat,source)=>storyLines.openings(compatible(stat),entries(stat),source);
 const illustrations=stat=>storyLines.illustrations(compatible(stat)),album=stat=>storyLines.album(compatible(stat));
 const gallery=stat=>album(stat).map(picture=>({...picture,unlocked:!picture.locked}));
 const unlockedIllustrations=(before,after)=>{const key=p=>[p.lineId,p.nodeId,p.id].join(':');const had=new Set(illustrations(before).map(key));return illustrations(after).filter(p=>!had.has(key(p)));};
 return {owns,definition,definitions,stageCount,advance,entries,context,openings,mainRoute:LineModel.mainRoute,lineView:(stat,id)=>storyLines.view(compatible(stat),id),illustrations,album,gallery,unlockedIllustrations,legacyGraphs:stat=>GraphCompat.unloaded(stat,lines)};
});
