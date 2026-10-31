(function(root,factory){
  const local=typeof module==='object'&&module.exports;
  const api=factory(local?require('./gameplay.js'):root.CxxGameplay,local?require("../数值引擎/src/growth.js"):root.CxxNumericGrowth,
    local?require("../数值引擎/adapters/mvu.js"):root.CxxNumericMvu,local?require("../数值引擎/src/engine.js"):root.CxxNumericEngine,
    local?require("../数值引擎/src/talent-data.js"):root.CxxTalentData,local?require("../数值引擎/src/growth-rules.js"):root.CxxGrowthRules);
  if(local)module.exports=api;else root.CxxTalents=api;
})(globalThis,function(G,R,M,E,data,curve){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const clone=v=>structuredClone(v),fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
  const {rules,attributes,ref,node,initialize,read,status,allocate,build,edit,reset,learned}=R,curveSource=curve.source;
  function projection(stat){const p={terminal:{wallet:clone(stat.terminal.wallet)}};if(stat.terminal.gameplay){p.terminal.gameplay=clone(stat.terminal.gameplay);delete p.terminal.gameplay.results;}return p;}
  function plan(stat,catalog,request){
    if(!['growth-initialize','talent-allocate'].includes(request.action))return G.plan(stat,catalog,request);
    const current=G.read(stat),old=stat.terminal.gameplay?.growth;let next,title;
    if(request.action==='growth-initialize'){
      if(old!==undefined)fail('growth-initialized','成长起点已经保存，不重复初始化');
      const initial=catalog.growthIdentity?.growthSetup||request.initial;
      if(!initial)fail('growth-uninitialized','请明确确认旧角色的成长起点');
      if(catalog.growthIdentity?.growthSetup&&request.initial&&!G.same(request.initial,initial))fail('growth-origin','请使用已经确认的开局配点');
      next=initialize(initial,catalog.growthIdentity?.id);title='确认成长起点';
    }else{next=allocate(old,request.build);if(G.same(next,old))fail('talent-unchanged','还没有新的配点');title='确认属性与天赋配点';}
    const changes=current.enabled?[{path:['terminal','gameplay','growth'],before:old??null,missing:old===undefined,after:next}]:[
      {path:['terminal','gameplay'],before:null,missing:true,after:{schema:1,...Object.fromEntries(G.TABLES.map(k=>[k,{}])),growth:next}}
    ];
    return {format:1,request:clone(request),title,changes,definitions:learned(next),beforeState:projection(stat),
      description:'采用当前角色的真实点数。正文确认后由MVU保存；已保存的配点不能通过草稿撤回。此次仅登记成长，不发放装备或义体。'};
  }
  function prompt(ticket){
    if(!['growth-initialize','talent-allocate'].includes(ticket.plan.request.action))return G.prompt(ticket);
    return ['[东京都2051正文行动 '+ticket.id+']',ticket.plan.title,
      '玩家已确认此成长配置，点数与前置已由脚本核对。正文承认成长并继续叙事，无需额外战斗、训练或费用；装备依赖仍须实际具备。本轮不附加经验或奖励。',
      JSON.stringify({actionId:ticket.id,requestHash:ticket.requestHash,request:ticket.plan.request,expectedChanges:ticket.plan.changes}),
      '正文承接已确认的配点。当前变量解析模式将 expectedChanges 的 after 值及 /terminal/gameplay/results/'+ticket.id+'={requestHash,status:"success",reason:"确认配点"} 一起保存；路径不存在用 add，存在用 replace。不得重新计算、收费或增发点数。',
      '同一 actionId 已保存时保持原结果，不重复扣点。保留本次无关字段。本次配置不提交 numericInput。'].join('\n');
  }
  const roster=()=>typeof module==='object'&&module.exports?require('./roster.js'):root.CxxRoster;
  function context(stat,identity){const R=roster();return contextLegacy(stat,identity)+(R?'\n'+R.protocol+'\n【本轮在场人物已保存状态】'+JSON.stringify(R.context(stat)):'');}
  function contextLegacy(stat,identity){
    if(stat?.__cxxGrowthReadError)return '【成长记录待核对】'+stat.__cxxGrowthReadError;
    const raw=stat?.terminal?.gameplay?.growth;
    if(raw){
      try{const s=read(raw);return '【已保存角色成长】以此状态续写，不回退到开局配置。\n'+JSON.stringify({level:s.level,xp:s.xp,attributes:s.attributes,attributePoints:s.attributePoints,perkPoints:s.perkPoints,unrestricted:s.unrestricted===true,perks:learned(s).map(p=>({name:p.name,rank:p.rank})),abilities:E.learned(s.perks).filter(e=>e.kind==='ability').map(e=>E.talents.describe(e))})+
        '\n已学专长的作用只到已保存等级；其依赖的武器、义体、车辆须实际具备。数值加成由脚本统一计算；正文结合战术和现场安排过程，玩家明确要求优先。不在正文重复计算数值或暗造新装备。';}
      catch(e){return '【成长记录待核对】'+e.message+'。保留已有成长字段，本轮不重置、不新增成长奖励；可继续不依赖争议能力的剧情。';}
    }
    if(!identity?.growthSetup)return '【成长尚未启用】尚无确认的成长起点，不猜测等级或补发属性、专长点。';
    return '【人物建档待完成】玩家已经确认开局选择；请先在人物页完成本地建档，不由正文重发初始装备或计算成长。';
  }
  function xpProgress(state){const level=state.level-(state.unrestricted?(state.levelOffset||0):0),current=rules.levels[level-1],next=rules.levels[level];return {current:state.xp-(current?.xp||0),required:next?next.xp-current.xp:null,total:state.xp};}
  function validateTransition(before,after,{growthIdentity,growthAction}={}){
    const old=before.terminal?.gameplay?.growth,next=after.terminal?.gameplay?.growth;
    if(growthAction){
      const request=growthAction.plan.request;
      if(!['growth-initialize','talent-allocate'].includes(request.action))fail('growth-action','这不是已开放的成长行动');
      const result=after.terminal?.gameplay?.results?.[growthAction.id];
      const previous=before.terminal?.gameplay?.results?.[growthAction.id];
      if(previous){
        if(!G.same(previous,result)||!G.same(old,next)||!['success','refused'].includes(G.verify(growthAction,after).status))fail('growth-action','已有成长行动结果不能再次结算或覆盖');
        return true;
      }
      if(result?.status==='success'){
        const fresh=plan(before,{growthIdentity},request);
        if(!G.same(fresh.changes,growthAction.plan.changes))fail('growth-action','成长行动的起点已变化');
      }
      if(!['success','refused'].includes(G.verify(growthAction,after).status))fail('growth-action','成长与匹配的行动结果必须在同一批完整保存');
      return true;
    }
    let expected;
    if(old===undefined){
      if(!growthIdentity?.growthSetup)fail('growth-uninitialized','尚未确认成长起点');
      expected=initialize(growthIdentity.growthSetup,growthIdentity.id);
    }else expected=read(old);
    const saved=read(next);
    if(!G.same(expected,saved))fail('growth-accounting','本轮成长与初值、奖励金额或升级点数不一致');
    // Creating a missing parent must not silently enable other asset systems.
    if(!before.terminal?.gameplay){const rest=clone(after.terminal.gameplay);delete rest.growth;delete rest.$meta;
      if(!G.same(rest,{schema:1,...Object.fromEntries(G.TABLES.map(k=>[k,{}]))}))fail('growth-parent','首次成长只能建立空玩法容器');}
    return true;
  }
  function protocol(gameplay={},options={}){return [
    '【角色成长保存协议】开局建档与玩家配点由本地宿主保存，额外MVU不要重复初始化、改写growth或替玩家花点。保留已存initial、talentsRef、unrestricted、levelOffset及自定义高属性。',
    '只登记正文已经发生的奖励、资源、装配与状态事实，统一提交numericInput；已有存档始终以当前分支为准。',
    '如当前明确存在尚未结算的历史成长行动，仅按该历史请求的精确结果合同处理；不要生成、重发或重做旧行动。',
    M.protocol(gameplay,options)
  ].join('\n');}
  return {data,rules,curveSource,attributes,ref,node,initialize,read,status,allocate,build,edit,reset,learned,plan,prompt,context,xpProgress,validateTransition,protocol};
});
