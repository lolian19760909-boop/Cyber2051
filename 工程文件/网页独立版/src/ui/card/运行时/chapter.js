/* Derived from 卡片源码/运行时/chapter.js; source SHA256 cedc735c73aa030921ccb596e7d984da2a9f3a4c7efcb4b77726d7d6531b8705. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const local=typeof module==='object'&&module.exports,value=factory(local?require('../剧情/盗芯之夜.json'):root.CxxChapterData);if(local)module.exports=value;else root.CxxChapter=value;})(globalThis,function(data){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const copy=v=>structuredClone(v),ID='q_chip_night',text=v=>typeof v==='string',plain=v=>v&&typeof v==='object'&&!Array.isArray(v),norm=v=>String(v||'').replace(/\s+/g,' ').trim();
 function initial(){return {schema:1,chapterId:'chip_night_v1',stage:1,status:'active',history:[],knownFacts:''};}
 function definition(){return data.enabled===false?null:copy(data.quest);}
 function current(record){const c=record?.chapter;if(!c)return initial();if(c.schema!==1||c.chapterId!=='chip_night_v1'||!Number.isInteger(c.stage)||c.stage<1||c.stage>8||!['active','complete','closed'].includes(c.status)||!Array.isArray(c.history))throw Error('章节记录版本或阶段无效，请核对原存档。');return copy(c);}
 function advance(record,events,{source,storyText}={}){
  if(data.enabled===false)throw Error('此章节暂未装载，原有记录保留。');
  const out=current(record);if(out.status!=='active')throw Error('本章已结束，保留当前结果。');
  if(!Array.isArray(events)||!events.length||events.length>8||!source||!norm(storyText))throw Error('章节更新需要本轮正文与事件数组。');
  for(const e of events){
   if(!plain(e)||Object.keys(e).some(k=>!['event','stage','evidence','facts'].includes(k))||!['advance','escape','note','leave'].includes(e.event)||e.stage!==out.stage||out.status!=='active')throw Error('章节事件与当前阶段不符。');
   const quote=norm(e.evidence);if(!text(e.evidence)||quote.length<8||quote.length>400||!norm(storyText).includes(quote))throw Error('章节依据需摘取本轮正文中已经发生的完整事实。');
   if(e.facts!==undefined&&(!text(e.facts)||e.facts.length>2000))throw Error('章节已知进展格式无效。');
   if(e.event==='escape'&&(out.stage<5||out.stage>7))throw Error('当前阶段不处于酒店撤离过程。');
   out.history.push({event:e.event,stage:out.stage,evidence:e.evidence,...(e.facts!==undefined?{facts:e.facts}:{}),source:copy(source)});
   if(e.facts!==undefined)out.knownFacts=e.facts;
   if(e.event==='advance'){if(out.stage===8)out.status='complete';else out.stage++;}
   if(e.event==='escape')out.stage=8;
   if(e.event==='leave')out.status='closed';
  }
  return out;
 }
 function protocol(record){if(data.enabled===false)return '';const c=current(record);if(c.status!=='active')return '';
  return '【盗芯章节变量】当前阶段 '+c.stage+'。仅在本轮实际完成当前段的退出条件时推进。计划、邀请未答复、回顾及作者秘密不算完成。更新路径 /terminal/quests/'+ID+'/chapter，value为事件数组，例如 [{"event":"advance","stage":'+c.stage+',"evidence":"本轮正文中的事实原句，至少八字","facts":"玩家已知的进展、同伴伤情和物品去向"}]。advance完成当前段；note只记已知事实；escape用于第5—7段实际被迫撤离，转入第8段；leave用于明确拒绝或退出本次章节。逐段事件可在同批提交，每项填写当时stage。阶段、凭据、state和objective由程序生成。报酬只在实际谈妥和支付时更新原委托金额字段；章节完成不发钱。';
 }
 function context(stat,{analyzes=false}={}){
  if(data.enabled===false)return '';
  const record=stat?.terminal?.quests?.[ID];if(!record||record.state==='已发布')return '';
  const c=current(record);if(c.status==='complete')return '【盗芯之夜本章已结束】'+c.knownFacts+'\n本章停止在离开酒店、接上安全屋求援。后续诊断、香澄显现与追查等待下一章内容，继续处理玩家眼前的行动。';
  if(c.status==='closed'||!['已接取','进行中'].includes(record.state))return '【盗芯之夜暂未推进】保留已发生经历：'+c.knownFacts+'。按玩家目前的实际行动继续。';
  const part=data.stages[c.stage-1];
  return '【盗芯之夜 · '+part.title+'】\n玩家从日志选择章节，只代表愿意展开这条故事；接单、关系与准备由实际剧情形成。既有经历优先，下面按当前局面展开，玩家介入造成的变化继续生效。作者秘密用于人物动机，其他角色依据各自见闻行动。\n已知进展：'+(c.knownFacts||'尚未登记；从当前聊天核对。')+'\n'+part.content+'\n本段退出条件：'+part.exit+'\n'+(analyzes?protocol(record):'变量由额外分析记录；正文只推进玩家实际选择的行动。');
 }
 function stageLabel(record){if(data.enabled===false)return '暂未装载';const c=current(record);return c.status==='complete'?'本章结束':c.status==='closed'?'本章已退出':data.stages[c.stage-1].title;}
 function objective(record){if(data.enabled===false)return record?.objective||'';const c=current(record);return c.status==='complete'?'已离开酒店，接上安全屋求援。':c.status==='closed'?'已退出本次章节。':data.stages[c.stage-1].exit;}
 return {ID,initial,definition,current,advance,protocol,context,stageLabel,objective};
});
