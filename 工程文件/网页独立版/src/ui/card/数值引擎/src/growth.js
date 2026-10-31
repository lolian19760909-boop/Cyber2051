/* Derived from 卡片源码/数值引擎/src/growth.js; source SHA256 cd79bbf8ca5fc23fc98f724056cb14de72a76428fbea87cb012ef60814d1ce47. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(local?require('./growth-base.js'):root.CxxNumericGrowthBase,local?require('./talent-data.js'):root.CxxTalentData,local?require('./talent-effects.js'):root.CxxTalentEffects,local?require('./growth-rules.js'):root.CxxGrowthRules);if(local)module.exports=value;else root.CxxNumericGrowth=value;})(globalThis,function(base,data,effects,curve){
'use strict';const G={growth:base,same:base.same};
  const clone=v=>JSON.parse(JSON.stringify(v)),fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
  const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const num=(n,min=0)=>{if(!Number.isSafeInteger(n)||n<min)fail('talent-number','点数必须为安全范围内的整数');return n;};
  const rules=curve.rules,ref={id:data.id,version:data.version},attributes=data.trees.map(t=>t.id);
  const nodes=new Map(data.trees.flatMap(t=>t.nodes.map(n=>[n.id,n])));
  function node(id){const n=nodes.get(id);if(!n)fail('talent-missing','这个专长没有对应的正式定义');return n;}
  function validateBuild(state){
    if(!plain(state.attributes)||!plain(state.perks))fail('talent-state','成长记录缺少属性或专长表');
    for(const key of attributes){num(state.attributes[key],state.unrestricted===true?0:3);if(!state.unrestricted&&state.attributes[key]>20)fail('talent-attribute','普通角色的单项属性不能超过20');}
    for(const [key,rank]of Object.entries(state.perks)){
      if(key==='$meta')continue;const n=node(key);num(rank);if(rank>n.ranks)fail('talent-rank','专长等级超出定义：'+n.name);
      if(rank&&(state.attributes[n.attribute]<n.required||n.requires.some(id=>(state.perks[id]||0)!==node(id).ranks)))fail('talent-prerequisite','专长前置不满足：'+n.name);
    }
    return state;
  }
  function initialize(initial,originId){
    if(!plain(initial))fail('growth-uninitialized','请先确认成长起点');
    const setup=clone(initial);delete setup.rewards;
    const state=G.growth.initialize(rules,{...setup,perks:{},talentsRef:clone(ref)});
    state.initial={level:state.level,xp:state.xp,attributes:clone(state.attributes),attributePoints:state.attributePoints,perkPoints:state.perkPoints};
    if(originId)state.originId=originId;
    validateBuild(state);return initial.perks?allocate(state,{attributes:clone(state.attributes),perks:clone(initial.perks)}):state;
  }
  function read(value){
    const state=G.growth.read(value,rules);
    if(!G.same(state.talentsRef,ref))fail('talent-version','当前角色应读取存档指定的天赋版本，不自动替换');
    validateBuild(state);
    if(!plain(state.initial))fail('growth-origin','成长记录缺少已确认的起点，不能猜测补发点数');
    // Reward receipts plus the initial allocation are the accounting source of truth.
    let xp=num(state.initial.xp),ap=num(state.initial.attributePoints),pp=num(state.initial.perkPoints);
    for(const [id,receipt]of Object.entries(state.rewards)){
      if(id==='$meta')continue;
      if(!plain(receipt)||!plain(receipt.award)||!plain(receipt.earned))fail('growth-receipt','成长奖励来源记录不完整');
      xp=num(xp+num(receipt.award.xp));ap=num(ap+num(receipt.earned.attributePoints));pp=num(pp+num(receipt.earned.perkPoints));
    }
    for(const a of attributes){const spent=state.attributes[a]-num(state.initial.attributes?.[a]);if(spent<0)fail('growth-accounting','已保存属性低于初始值');ap-=spent;}
    for(const [id,rank]of Object.entries(state.perks))if(id!=='$meta')pp-=rank;
    if(xp!==state.xp||ap!==state.attributePoints||pp!==state.perkPoints)fail('growth-accounting','成长点数与起点、奖励记录、已学专长不一致，请核对本轮MVU保存');
    return state;
  }
  function status(state,id){
    const n=node(id),rank=state.perks[id]||0;
    if(state.attributes[n.attribute]<n.required)return 'locked';
    if(n.requires.some(key=>(state.perks[key]||0)<node(key).ranks))return 'not_connected';
    return rank===n.ranks?'maxed':rank?'invested':'available';
  }
  function allocate(base,build){
    const current=read(base),next=clone(current);
    if(!plain(build)||!plain(build.attributes)||!plain(build.perks))fail('talent-build','配点草稿缺少属性与专长');
    for(const key of Object.keys(build.attributes))if(!attributes.includes(key)&&!G.same(build.attributes[key],current.attributes[key]))fail('talent-build','未知属性');
    let ap=0,pp=0;
    for(const key of attributes){const value=num(build.attributes[key],current.attributes[key]);ap=num(ap+value-current.attributes[key]);next.attributes[key]=value;}
    const result={...current.perks};
    for(const key of new Set([...Object.keys(current.perks),...Object.keys(build.perks)])){
      if(key==='$meta')continue;const rank=num(build.perks[key]??0,current.perks[key]||0);node(key);pp=num(pp+rank-(current.perks[key]||0));
      if(rank)result[key]=rank;else delete result[key];
    }
    if(ap>current.attributePoints||pp>current.perkPoints)fail('talent-budget','可用点数不足');
    next.attributes={...current.attributes,...next.attributes};next.perks=result;next.attributePoints-=ap;next.perkPoints-=pp;
    return validateBuild(next);
  }
  function build(state){return {attributes:clone(state.attributes),perks:clone(state.perks)};}
  function edit(base,draft,{kind,id,delta}){
    if(![-1,1].includes(delta))fail('talent-change','每次只调整一点');
    const next=clone(draft);
    if(kind==='attribute'){
      if(!attributes.includes(id))fail('talent-build','未知属性');next.attributes[id]+=delta;
    }else if(kind==='perk'){node(id);next.perks[id]=(next.perks[id]||0)+delta;}else fail('talent-change','未知配点操作');
    if(delta<0){
      // Refund only this draft's dependent ranks; already saved ranks never disappear.
      let changed=true;
      while(changed){changed=false;for(const n of nodes.values())if(next.perks[n.id]&&(next.attributes[n.attribute]<n.required||n.requires.some(id=>(next.perks[id]||0)<node(id).ranks))){
        if(base.perks[n.id])fail('talent-saved','这项调整会移除已经保存的专长');delete next.perks[n.id];changed=true;
      }}
    }
    return build(allocate(base,next));
  }
  function reset(base,draft,tree){
    if(!tree)return build(base);const next=clone(draft);
    for(const n of nodes.values())if(n.attribute===tree){if(base.perks[n.id])next.perks[n.id]=base.perks[n.id];else delete next.perks[n.id];}
    return build(allocate(base,next));
  }
  function learned(state){return [...nodes.values()].filter(n=>state.perks[n.id]>0).map(n=>({id:n.id,name:n.name,rank:state.perks[n.id],effects:effects[n.id]?.slice(0,state.perks[n.id])||[]}));}

function planReward(state,grant){const result=base.planReward(read(state),rules,grant);read(result.state);return result;}
 const achievementRates={small:0.35,stage:0.65,gig:1,major:2},achievementVersion='2051-frequent-1';
 function planAchievement(state,event){
  const current=read(state);if(!Object.hasOwn(achievementRates,event.category)||event.completed!==true||typeof event.reason!=='string'||!event.reason.trim()||!['story','training','activity','quest'].includes(event.source?.kind)||typeof event.source?.id!=='string'||!event.source.id.trim())fail('growth-fact','成长需要已完成的成果、稳定来源与正文依据。');
  if(['xp','attributePoints','perkPoints'].some(k=>event[k]!==undefined))fail('growth-fact','自动成果只提交事实，经验由程序计算。');
  const previous=current.rewards[event.id]||Object.values(current.rewards).find(r=>r.award?.source?.kind===event.source.kind&&r.award?.source?.id===event.source.id);
  if(previous){if(previous.fact&&!base.same({...previous.fact,id:event.id},event))fail('growth-reward-conflict','同一成果的依据已经改变，请从原楼层重跑。');return {state:current,duplicate:true,earned:{xp:0,attributePoints:0,perkPoints:0,levels:0},changes:[]};}
  const level=Math.max(1,Math.min(rules.levels.length,current.level-(current.levelOffset||0))),row=rules.levels[level-1],next=rules.levels[level],step=next?next.xp-row.xp:row.xp-rules.levels[level-2].xp;
  const result=planReward(current,{id:event.id,source:event.source,xp:Math.max(1,Math.round(step*achievementRates[event.category]))});
  result.state.rewards[event.id].fact=clone(event);result.state.rewards[event.id].rule={version:achievementVersion,category:event.category,rate:achievementRates[event.category],step};return result;
 }
return {rules,ref,attributes,node,initialize,read,status,allocate,build,edit,reset,learned,planReward,planAchievement,achievementRates,achievementVersion};
});
