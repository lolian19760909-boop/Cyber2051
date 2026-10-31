/* Read-only build feedback. Saved growth and tactical formulas remain the owners. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxGrowthFeedback=api;})(globalThis,function(root){
 'use strict';
 const local=typeof module==='object'&&module.exports;
 const engine=()=>local?require('../数值引擎/src/engine.js'):root.CxxNumericEngine;
 const tactical=()=>local?require('./tactical-engine.js'):root.CxxTacticalEngine;
 const names={body:'肉体',reflexes:'反应',intelligence:'智力',technical:'技术能力',cool:'镇定'};
 const pending={Tech_Central_Perk_2_3:'拆解与材料回收尚未开放。',Tech_Inbetween_Right_2:'义体升级与附加特性选择尚未开放。',Tech_Central_Perk_3_3:'细胞适配的专长安装资格检查尚未接入。'};
 const automatic={Body_Central_Milestone_1:'耐力不足时喘息可恢复生命',Reflexes_Central_Milestone_2:'接近敌人时可突进',Reflexes_Central_Milestone_3:'接近敌人时可空中突进',Reflexes_Right_Milestone_3:'满足距离和生命条件时尝试终结',Body_Master_Perk_5:'近距离尝试终结',Cool_Right_Perk_3_2:'近距离尝试终结',Intelligence_Left_Perk_3_4:'近距离尝试终结',Tech_Right_Milestone_3:'技术武器蓄能后射击',Cool_Left_Milestone_2:'精准武器瞄准后射击',Intelligence_Left_Milestone_2:'破解优先时使用已有程序和队列',Intelligence_Left_Milestone_3:'破解优先时使用已有程序和队列',Intelligence_Master_Perk_1:'破解优先时使用已有程序和队列'};
 const gearTags=new Set(['shotgun','lmg','hmg','rifle','smg','pistol','revolver','precision','sniper','gun','blade','blunt','throwing','silenced','smart','tech_weapon','cyberdeck','cyberware','monowire','launcher','optical_camo_equipped','cyberware_coordinated','skeleton_pair','hands_pair','body_coverage','wide_coverage']);
 const num=n=>Number(Number(n).toFixed(2)),signed=n=>(n>=0?'+':'')+num(n);
 function describe(e){const rules=engine().talents,prefix=e.when?rules.conditionText(e.when)+'：':'';if(e.kind==='ability')return prefix+e.text;const label={powerPct:'伤害加成项',powerFlat:'基础伤害',critChance:'暴击率',critDamage:'暴击伤害加成项',hpMax:'生命上限',staminaMax:'耐力上限',ramMax:'RAM上限',defense:'防护'}[e.kind]||e.kind,pct=['powerPct','critChance','critDamage'].includes(e.kind);return prefix+label+' '+signed(e.value*(pct?100:1))+(pct?'%':'');}
 function stats(g){return tactical()?.buildStats?.(g)||null;}
 function compare(before,after,{all=false}={}){
  const a=stats(before),b=stats(after);if(!a?.maxima||!b?.maxima)return [];const rows=[];
  function add(label,x,y,suffix=''){if(all||x!==y)rows.push(label+' '+num(x)+suffix+' → '+num(y)+suffix+(x!==y?'（'+signed(y-x)+suffix+'）':''));}
  for(const [key,label]of [['hp','生命上限'],['stamina','耐力上限'],['ram','RAM上限']])add(label,a.maxima[key],b.maxima[key]);
  add((a.weapon===b.weapon?b.weapon:a.weapon+' → '+b.weapon)+' · 普通单击',a.damage,b.damage);
  add('暴击率',a.critChance*100,b.critChance*100,'%');add('防护',a.defense,b.defense);add('减伤',a.reduction*100,b.reduction*100,'%');
  for(const p of b.programs){const old=a.programs.find(x=>x.id===p.id);if(old)add(p.name+' · 破解直伤',old.damage,p.damage);else rows.push(p.name+' · 破解直伤 '+p.damage+' / '+p.ram+' RAM');}
  return rows;
 }
 function perk(g,id,rank){
  const E=engine(),ranks=E.talents.definitions[id]||[],s=stats(g),take=Math.max(1,rank),effects=ranks.slice(0,take).flat();
  const rows=effects.map(e=>{
   let state='条件待触发';if(pending[id])state='功能待开放';else if(s?.unavailable)state='武器类别待确认';else if(s){const a=e.when?.includes('cyberdeck')||e.when?.includes('quickhack')?s.hackActor:s.actor;
    const unsuitable=(e.when||'').split('&').some(group=>{const tokens=group.split('|');return tokens.every(t=>gearTags.has(t))&&!tokens.some(t=>a.tags.includes(t));});
    if(unsuitable)state='装备不适用';else if(e.kind==='ability')state='动作能力';else if(E.matches(e.when,a,s.neutral))state=rank?'当前生效':'投入后生效';
   }else if(e.kind==='ability')state='动作能力';return {state,text:describe(e)};
  });
  return {ranks:ranks.map(es=>es.map(describe).join('；')),rows,note:pending[id]||automatic[id]&&('速决：'+automatic[id]+'。')|| (effects.some(e=>e.kind==='ability')?'按说明中的动作或事件触发；其他主动动作可在即时战术中选择。':''),pending:!!pending[id]};
 }
 function draft(g,before,after){if(!g)return [];const rows=compare({...g,growth:before},{...g,growth:after});for(const [key,value]of Object.entries(after.attributes))if(value!==before.attributes[key])rows.unshift(names[key]+' '+before.attributes[key]+' → '+value);for(const [id,n]of Object.entries(after.perks))if(n>(before.perks[id]||0))rows.push(engine().growth.node(id).name+' '+(before.perks[id]||0)+' → '+n+' 级');return rows;}
 return {stats,compare,perk,draft,describe,names};
});
