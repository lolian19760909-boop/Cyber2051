/* Derived from 卡片源码/数值引擎/src/growth-base.js; source SHA256 d048a115f630dd5e4475645a4625f3a68290fb327a6aa6d0dc3774ce51bc2d75. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxNumericGrowthBase=value;})(globalThis,function(){
'use strict';
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));
  function fail(code, message) { throw Object.assign(new Error(message), { code }); }
  function id(v) { if (typeof v !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v) || ['constructor','prototype','__proto__'].includes(v)) fail('gameplay-id', '玩法编号只能使用字母、数字、横线与下划线'); }
  function text(v, max = 4000) { if (typeof v !== 'string' || !v.trim() || v.length > max || /<\x25|<\s*\/?\s*script\b|javascript\s*:/i.test(v)) fail('gameplay-text', '玩法内容只接受有长度限制的静态文字'); }
  function integer(v, min = 0, max = 1000000000) { if (!Number.isSafeInteger(v) || v < min || v > max) fail('gameplay-number', '玩法数量超出允许范围'); }
  function keys(v, allowed) { if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) fail('gameplay-field', '玩法定义含未支持字段，需要匹配的新版角色卡'); }
  const normalized = v => Array.isArray(v) ? v.map(normalized) : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalized(v[k])])) : v;
  const same = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));

  const growthNumber=(value,min=0)=>integer(value,min,Number.MAX_SAFE_INTEGER);
  function validateGrowthRules(rules) {
    keys(rules,['schema','id','version','levels']);
    if(rules.schema!==1)fail('growth-rules','成长规则版本尚不支持');
    id(rules.id);text(rules.version,128);
    if(!Array.isArray(rules.levels) || !rules.levels.length)fail('growth-rules','成长规则缺少等级表');
    let previous=-1;
    rules.levels.forEach((row,index)=>{
      keys(row,['level','xp','attributePoints','perkPoints']);
      if(row.level!==index+1)fail('growth-rules','成长等级必须从1开始连续排列');
      growthNumber(row.xp);growthNumber(row.attributePoints);growthNumber(row.perkPoints);
      if(row.xp<=previous || index===0 && row.xp!==0)fail('growth-rules','等级表使用从0开始、严格递增的累计经验门槛');
      if(index===0 && (row.attributePoints || row.perkPoints))fail('growth-rules','初始点数由确认后的开局配置提供，不放入升级奖励');
      previous=row.xp;
    });
    return rules;
  }
  function growthLevel(xp,rules) {
    let level=1;
    for(const row of rules.levels){if(row.xp>xp)break;level=row.level;}
    return level;
  }
  function readGrowth(state,rules) {
    validateGrowthRules(rules);
    if(!object(state) || state.schema!==1)fail('growth-uninitialized','请先确认当前角色的成长起点');
    if(!same(state.rulesRef,{id:rules.id,version:rules.version}))fail('growth-rules-ref','当前角色应使用其保存的成长规则版本');
    for(const key of ['level','xp','attributePoints','perkPoints'])growthNumber(state[key],key==='level'?1:0);
    const offset=state.unrestricted===true?(state.levelOffset??0):0;growthNumber(offset,-Number.MAX_SAFE_INTEGER);
    if(state.level!==growthLevel(state.xp,rules)+offset)fail('growth-state','已保存等级与累计经验不一致，不自动重算角色');
    if(!object(state.rewards))fail('growth-state','成长记录缺少奖励来源表');
    return clone(state);
  }
  function initializeGrowth(rules,initial) {
    validateGrowthRules(rules);
    if(!object(initial))fail('growth-uninitialized','需要已经确认的初始等级、经验和可用点数');
    for(const key of ['level','xp','attributePoints','perkPoints'])growthNumber(initial[key],key==='level'?1:0);
    if(initial.rewards!==undefined && Object.keys(initial.rewards || {}).length)fail('growth-initial','已有奖励记录的角色应直接读取，不能重新初始化');
    const offset=initial.unrestricted===true?{levelOffset:initial.level-growthLevel(initial.xp,rules)}:{};
    return readGrowth({...clone(initial),...offset,schema:1,rulesRef:{id:rules.id,version:rules.version},rewards:{}},rules);
  }
  function planGrowthReward(state,rules,grant) {
    const current=readGrowth(state,rules);
    keys(grant,['id','source','xp','attributePoints','perkPoints']);id(grant.id);
    keys(grant.source,['kind','id','definitionRef']);
    if(!['quest','story','training','activity'].includes(grant.source.kind))fail('growth-source','奖励须关联委托、剧情、训练或行动');
    text(grant.source.id,256);
    if(grant.source.definitionRef!==undefined){
      keys(grant.source.definitionRef,['packageId','version','kind','id']);
      for(const value of Object.values(grant.source.definitionRef))text(value,128);
      for(const key of ['packageId','version','kind','id'])if(!grant.source.definitionRef[key])fail('growth-source','奖励定义引用不完整');
    }
    const award={source:clone(grant.source),xp:grant.xp??0,attributePoints:grant.attributePoints??0,perkPoints:grant.perkPoints??0};
    for(const key of ['xp','attributePoints','perkPoints'])growthNumber(award[key]);
    if(!award.xp && !award.attributePoints && !award.perkPoints)fail('growth-reward','这条奖励没有经验或点数');
    const previous=current.rewards[grant.id];
    if(previous!==undefined){
      if(!same(previous.award,award))fail('growth-reward-conflict','同一奖励编号已有不同内容，请保留原结算');
      return {state:current,changes:[],duplicate:true,earned:{xp:0,attributePoints:0,perkPoints:0,levels:0}};
    }
    const next=clone(current),earned={xp:award.xp,attributePoints:award.attributePoints,perkPoints:award.perkPoints,levels:0};
    growthNumber(next.xp+award.xp);next.xp+=award.xp;
    const beforeProgression=growthLevel(current.xp,rules),afterProgression=growthLevel(next.xp,rules);
    next.level=afterProgression+(current.unrestricted===true?(current.levelOffset??0):0);growthNumber(next.level,1);
    earned.levels=next.level-current.level;
    for(const row of rules.levels){
      if(row.level>beforeProgression && row.level<=afterProgression){
        earned.attributePoints+=row.attributePoints;earned.perkPoints+=row.perkPoints;
      }
    }
    for(const key of ['attributePoints','perkPoints']){growthNumber(earned[key]);growthNumber(next[key]+earned[key]);next[key]+=earned[key];}
    next.rewards[grant.id]={award,earned:clone(earned),fromLevel:current.level,toLevel:next.level};
    return {state:next,duplicate:false,earned,changes:[{path:['terminal','gameplay','growth'],before:current,missing:false,after:clone(next)}]};
  }

return {same,validateRules:validateGrowthRules,read:readGrowth,initialize:initializeGrowth,planReward:planGrowthReward};
});
