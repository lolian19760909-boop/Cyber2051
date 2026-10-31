(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(local?require('./numeric-rules.js'):root.CxxNumericRules,local?require('./talent-rules.js'):root.CxxTalentRules,local?require('./growth.js'):root.CxxNumericGrowth,local?require("../../运行时/loadout.js"):root.CxxLoadout);if(local)module.exports=value;else root.CxxNumericEngine=value;})(globalThis,function(defaultRules,talents,growth,L){
  'use strict';
 const cloneAPI=()=>{const local=typeof module==='object'&&module.exports?require('../../共享/data-clone.js'):null;const api=local||globalThis.CxxDataClone;if(api&&typeof api.clone==='function')return api;if(typeof structuredClone==='function')return {clone:value=>structuredClone(value)};return {clone:value=>JSON.parse(JSON.stringify(value))};};const clone=value=>cloneAPI().clone(value);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
  const canonical=v=>Array.isArray(v)?v.map(canonical):object(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const number=(v,min=0,max=Number.MAX_VALUE)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail('numeric-number','数值不在有效范围');return v;};
  const id=v=>{if(typeof v!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v)||['constructor','prototype','__proto__'].includes(v))fail('numeric-id','事件和实体需要稳定编号');return v;};
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n)),round=n=>Math.round(n*100)/100;
  const own=(v,k)=>Object.hasOwn(v,k);
  function tags(value=[]){if(!Array.isArray(value)||value.some(t=>typeof t!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(t)))fail('numeric-tags','状态标签需要使用已约定的英文编号');return new Set(value);}
  function attrs(value){if(!object(value))fail('numeric-attributes','缺少五属性');for(const key of growth.attributes)number(value[key],0,Number.MAX_SAFE_INTEGER);return value;}
  function learned(perks={}){const result=[];for(const [key,rank]of Object.entries(perks)){if(key==='$meta')continue;const ranks=talents.definitions[key];if(!ranks||!Number.isInteger(rank)||rank<0||rank>ranks.length)fail('numeric-perk','专长编号或等级不正确：'+key);ranks.slice(0,rank).forEach((effects,i)=>effects.forEach((effect,j)=>result.push({...effect,id:'perk:'+key+':'+(i+1)+':'+j})));}return result;}
  function collected(perks={},equipment=[]){
    const effects=learned(perks),items=new Map(),unique=new Map();
    for(const item of equipment){id(item.id);if(items.has(item.id)){if(!same(items.get(item.id),item))fail('numeric-effect-conflict','同一装备编号的定义不一致');continue;}items.set(item.id,item);(item.effects||[]).forEach((e,i)=>effects.push({...e,id:'item:'+item.id+':'+(e.id||i)}));}
    for(const e of effects){if(unique.has(e.id)&&!same(unique.get(e.id),e))fail('numeric-effect-conflict','同编号效果内容不一致');unique.set(e.id,e);}
    return [...unique.values()];
  }
  function maximums(perks={},rules=defaultRules,equipment=[],actor={}){const result={...rules.vitals};if(rules.version>=2)result.hp=rules.health.base+rules.health.body*(actor.attributes?.body??4)+rules.health.level*((actor.level??1)-1);if(actor.hpMax!==undefined)result.hp=number(actor.hpMax,1);for(const e of collected(perks,equipment)){const key={hpMax:'hp',staminaMax:'stamina',ramMax:'ram'}[e.kind];if(key){if(e.when)fail('numeric-effect','资源上限使用常驻效果，临时效果请用战力修正');result[key]+=number(e.value,-Number.MAX_VALUE,Number.MAX_VALUE);}}if(actor.hpMax!==undefined)result.hp=number(actor.hpMax,1);for(const n of Object.values(result))number(n,1);return result;}
  function ratio(actor,key,rules=defaultRules){const max=maximums(actor.perks,rules,actor.equipment,actor)[key];return clamp((actor.vitals?.[key]??max)/max,0,1);}
  function matches(expression,actor,enemy={},rules=defaultRules){
    if(!expression)return true;
    const actorTags=tags(actor.tags),enemyTags=tags(enemy.tags);
    return expression.split('&').every(group=>group.split('|').some(token=>{
      const comparison=token.match(/^(hp|stamina|ram)([<>])(\d+(?:\.\d+)?)$/);
      if(comparison){const value=ratio(actor,comparison[1],rules)*100;return comparison[2]==='<'?value<Number(comparison[3]):value>Number(comparison[3]);}
      if(token==='enemy:low_hp')return ratio(enemy,'hp',rules)<0.3;
      if(token==='enemy:full_hp')return ratio(enemy,'hp',rules)===1;
      return token.startsWith('enemy:')?enemyTags.has(token.slice(6)):actorTags.has(token);
    }));
  }
  const kinds=new Set(['powerFlat','powerPct','multiplier','critChance','critDamage','hpMax','staminaMax','ramMax','ability','defense','restoreHp','restoreStamina','restoreRam','damage']);
  function resolveEffects(actor,enemy={},rules=defaultRules){
    attrs(actor.attributes);const effects=collected(actor.perks,actor.equipment);
    const seen=new Map(),active=[],abilities=[];let flat=0,percent=0,multiplier=1,critChance=0,critExtra=rules.criticalMultiplier-1,defense=2*actor.attributes.body+actor.attributes.technical;
    for(const effect of effects){
      if(!kinds.has(effect.kind))fail('numeric-effect','未支持的数值效果');
      if(seen.has(effect.id)){if(!same(seen.get(effect.id),effect))fail('numeric-effect-conflict','同编号效果内容不一致');continue;}seen.set(effect.id,effect);
      if(effect.kind==='ability'){abilities.push({id:effect.id,text:talents.describe(effect),available:matches(effect.when,actor,enemy,rules)});continue;}
      number(effect.value,-Number.MAX_VALUE,Number.MAX_VALUE);
      if(!matches(effect.when,actor,enemy,rules))continue;
      active.push(effect);
      if(effect.kind==='powerFlat')flat+=effect.value;
      if(effect.kind==='powerPct')percent+=effect.value;
      if(effect.kind==='multiplier')multiplier*=number(effect.value,0);if(effect.kind==='defense')defense+=effect.value;
      if(effect.kind==='critChance')critChance+=effect.value;
      if(effect.kind==='critDamage')critExtra+=effect.value;
    }
    const raw=growth.attributes.reduce((sum,key)=>sum+actor.attributes[key]*rules.attributes[key],0);
    const base=rules.attack.scale*(raw+flat)+rules.attack.level*((actor.level??1)-1);
    const critical=1+clamp(critChance,0,1)*Math.max(0,critExtra);
    const health=ratio(actor,'hp',rules),injury=health===0?0:1-rules.injuryWeight*(1-health);
    const power=number(Math.max(0,base)*Math.max(0,1+percent)*multiplier*critical*injury);
    defense=Math.max(0,defense);const reduction=Math.min(rules.defenseCap,defense/(100+defense));
    const hp=actor.vitals?.hp??maximums(actor.perks,rules,actor.equipment,actor).hp;
    const weight=Math.sqrt(power)*Math.sqrt(hp/(1-reduction));number(weight);
    return {base,power,flat,percent,multiplier,critical,health,defense,reduction,weight,active,abilities};
  }

  function winChance(player,enemy,rules=defaultRules){number(player);number(enemy);if(player===0&&enemy===0)return 0.5;if(player===0)return 0;if(enemy===0)return 1;return 1/(1+Math.exp(rules.exponent*(Math.log(enemy)-Math.log(player))));}
  function actorFrom(record,{rules=defaultRules,profiles={}}={}){
    if(!object(record))return null;
    let definition;
    if(record.profileId){definition=profiles[record.profileId];if(!definition)return null;}
    else definition=rules.templates[record.template];
    if(!definition)return null;
    const district=record.district||'ordinary';if(!own(rules.districts,district))fail('numeric-district','未知地区强度模板');
    const actor={...clone(definition),level:record.level??definition.level??1,id:record.id,name:record.name||record.id,attributes:clone(attrs(record.attributes||definition.attributes)),perks:clone(definition.perks||{}),tags:[...tags([...(definition.tags||[]),...(record.tags||[])])],vitals:{...maximums(record.perks||definition.perks,rules,record.equipment||definition.equipment,{...definition,...record}),...clone(definition.vitals||{}),...clone(record.vitals||{})},equipment:clone(record.equipment||definition.equipment||[]),hpMax:record.hpMax};
    for(const key of Object.keys(rules.vitals))number(actor.vitals[key]);
    actor.regionFactor=record.profileId?1:rules.districts[district];return actor;
  }
  function evaluateCombat(state,{rules=defaultRules,profiles={},playerEquipment=null}={}){
    playerEquipment=playerEquipment||L.effects(state);
    const combat=state.numeric?.combat;
    if(!combat?.active)return {active:false,known:false};
    if(!state.growth||!Array.isArray(combat.enemies)||combat.enemies.length===0)return {active:true,known:false};
    const player={level:state.growth.level,attributes:state.growth.attributes,perks:state.growth.perks,tags:L.tags(state,combat.playerTags||[]),vitals:state.numeric.vitals,equipment:playerEquipment};
    const enemies=combat.enemies.map(record=>actorFrom(record,{rules,profiles})),allies=(combat.allies||[]).map(record=>actorFrom(record,{rules,profiles}));
    if(enemies.some(x=>!x)||allies.some(x=>!x))return {active:true,known:false};
    // Evaluate conditional effects per opponent, then weight by opposing raw strength.
    // A vulnerability on one enemy must not be copied onto every member of their team.
    function against(actor,opponents){const weights=opponents.map(e=>growth.attributes.reduce((s,k)=>s+e.attributes[k]*rules.attributes[k],0));const total=weights.reduce((a,b)=>a+b,0);return opponents.reduce((sum,e,i)=>sum+resolveEffects(actor,e,rules).weight*(total?weights[i]/total:1/opponents.length),0)*(actor.regionFactor||1);}
    const team=[player,...allies],playerPower=team.reduce((sum,a)=>sum+against(a,enemies),0),enemyPower=enemies.reduce((sum,a)=>sum+against(a,team),0);
    const playerChance=winChance(playerPower,enemyPower,rules);
    return {active:true,known:true,playerPower,enemyPower,playerChance,enemyChance:1-playerChance,incapacitated:ratio(player,'hp',rules)===0};
  }
  function shortPrompt(result){
    if(!result.active)return '';
    if(!result.known)return '【战况参考】对手资料尚不完整，暂不提供胜率。若玩家无明确要求，结合已知能力和现场条件续写；不要据此补造敌方数值。';
    const p=Math.round(result.playerChance*100),enemy=100-p;
    const direction=result.incapacitated?'撤离或救援，不自动判定死亡':p>=60?'我方在本轮占优':p<=40?'敌方在本轮占优':'双方本轮优势接近';
    return '【本轮交锋参考】我方优势概率'+p+'%，敌方'+enemy+'%。若玩家无明确要求，倾向'+direction+'；不得把本轮优势当作整场胜利。';
  }
  function initialNumeric(state,rules=defaultRules,equipment=[]){return {schema:1,rulesRef:{id:rules.id,version:rules.version},vitals:maximums(state.growth?.perks,rules,equipment,state.growth),combat:{active:false},receipts:{}};}
  function checkNumeric(value,rules=defaultRules){
    if(!object(value)||value.schema!==1||!same(value.rulesRef,{id:rules.id,version:rules.version})||!object(value.vitals)||!object(value.combat)||!object(value.receipts))fail('numeric-state','数值记录需要对应的规则版本');
    for(const key of Object.keys(rules.vitals))number(value.vitals[key]);
    return value;
  }
  function validateActorRecord(record){
    if(!object(record))fail('numeric-actor','参战者需要档案');id(record.id);
    if(Boolean(record.template)===Boolean(record.profileId))fail('numeric-actor','选择一个类型模板或作者档案');
    if(Object.keys(record).some(k=>!['id','name','template','profileId','district','tags','vitals'].includes(k)))fail('numeric-actor','正文只选择敌方模板，不直接编造属性或加成');
    if(record.name!==undefined&&(typeof record.name!=='string'||record.name.length>80))fail('numeric-actor','参战者名称过长');
    tags(record.tags);return record;
  }
  // Saved loadout/growth edits and story facts share one combat snapshot refresh.
  // Only cheat/legacy battles keep overrides; raising a cap never refills resources.
  function syncCombatPlayer(state,previous,actions=[]){
    const c=state.numeric?.combat;if(!c?.manual||!c.active||!c.player)return;
    const chosen=c.actions?.player;
    if(chosen?.activeSlots){const before=new Map(L.list(previous).map(r=>[r.slot,r])),after=new Map(L.list(state).map(r=>[r.slot,r]));chosen.activeSlots=actions.some(a=>a.action==='active-state')?L.activeSlots(state):chosen.activeSlots.filter(slot=>{const a=before.get(slot),b=after.get(slot);return a&&b&&b.definition.active&&a.record.instanceId===b.record.instanceId&&a.record.itemId===b.record.itemId;});}
    const p=c.player,growthBefore=previous.growth||{};
    if(c.mode==='system'||p.level===growthBefore.level)p.level=state.growth.level;
    for(const key of growth.attributes)if(c.mode==='system'||p.attributes[key]===growthBefore.attributes?.[key])p.attributes[key]=state.growth.attributes[key];
    if(c.mode==='system')delete p.hpMax;
    const equipped=chosen?.activeSlots?{...state,loadout:{...state.loadout,active:chosen.activeSlots}}:state;
    p.perks=clone(state.growth.perks);p.equipment=L.effects(equipped);p.tags=L.tags(equipped,p.tags);
    const max=maximums(p.perks,undefined,p.equipment,p);
    for(const key of Object.keys(max)){const delta=(state.numeric.vitals[key]??0)-(previous.numeric?.vitals?.[key]??state.numeric.vitals[key]);p.vitals[key]=round(clamp(c.mode==='system'?state.numeric.vitals[key]:p.vitals[key]+delta,0,max[key]));}
  }
  function settle(state,events,{rules=defaultRules,profiles={},playerEquipment=null,factBatch=null,source=null}={}){
    if(!object(state)||!Array.isArray(events))fail('numeric-input','数值事件需要数组与当前玩法状态');
    let next=migrate(state);const changes=[],applied=[],duplicates=[],equipmentOverride=playerEquipment;
    const hasItems=events.some(e=>L.eventKinds.has(e?.kind));
    const seenItems=hasItems&&factBatch&&state.loadout?.factBatches?.[factBatch];const explicit=new Set(events.filter(e=>e.kind==='reward').map(e=>JSON.stringify(e.source)));
    for(const event of events){
      if(!object(event))fail('numeric-input','事件格式不正确');id(event.id);
      const tactical=next.tactical?.encounter;if(tactical&&(tactical.active||tactical.narrativePending)&&(event.kind==='resource'||L.eventKinds.has(event.kind)&&event.kind!=='item-gain'))fail('tactical-owned','战术资源与装配已经由程序结算，不能在节点叙事中重复扣除或改装。');
      if(L.eventKinds.has(event.kind)){if(seenItems){duplicates.push(event.id);continue;}const duplicate=next.itemReceipts?.[event.id];next=L.applyEvents(next,[event]);if(next.numeric?.vitals){const max=maximums(next.growth?.perks,rules,equipmentOverride||L.effects(next),next.growth);for(const key of Object.keys(max))next.numeric.vitals[key]=Math.min(next.numeric.vitals[key],max[key]);}(duplicate?duplicates:applied).push(event.id);continue;}
      if(next.itemReceipts?.[event.id])fail('numeric-event-conflict','该事件编号已用于物品变化');
      playerEquipment=equipmentOverride||L.effects(next);
      if(event.kind==='achievement'){if(explicit.has(JSON.stringify(event.source))){duplicates.push(event.id);continue;}
        if(next.numeric?.receipts?.[event.id])fail('numeric-event-conflict','该事件编号已用于其他数值事件');
        if(Object.keys(event).some(k=>!['id','kind','source','category','completed','reason'].includes(k)))fail('numeric-event','成长成果含未支持字段');
        const result=growth.planAchievement(next.growth,event);next.growth=result.state;if(!result.duplicate&&source)next.growth.rewards[event.id].origin=clone(source);(result.duplicate?duplicates:applied).push(event.id);continue;
      }
      if(event.kind==='reward'){
        if(next.numeric?.receipts?.[event.id])fail('numeric-event-conflict','该事件编号已用于其他数值事件');
        if(Object.keys(event).some(k=>!['id','kind','source','xp','attributePoints','perkPoints'].includes(k)))fail('numeric-event','奖励事件含未支持字段');
        if(Object.values(next.growth?.rewards||{}).some(r=>r.award?.source?.kind===event.source?.kind&&r.award?.source?.id===event.source?.id&&r.fact)){duplicates.push(event.id);continue;}
        const grant=clone(event);delete grant.kind;const result=growth.planReward(next.growth,grant);next.growth=result.state;(result.duplicate?duplicates:applied).push(event.id);continue;
      }
      if(!next.growth)fail('numeric-uninitialized','先使用已确认的角色成长起点');
      growth.read(next.growth);
      if(!next.numeric)next.numeric=initialNumeric(next,rules,playerEquipment);checkNumeric(next.numeric,rules);
      const previous=next.numeric.receipts[event.id];
      if(previous){if(!same(previous.event,event))fail('numeric-event-conflict','同一事件不能改成不同内容');duplicates.push(event.id);continue;}
      if(next.growth.rewards[event.id])fail('numeric-event-conflict','数值事件编号已用于成长奖励');
      let assessment=null;
      if(event.kind==='resource'){
        if(next.numeric.combat.manual&&(next.numeric.combat.active&&!next.numeric.combat.paused||source&&next.numeric.combat.lastRound?.source?.floor===source.floor&&next.numeric.combat.lastRound?.source?.swipe===source.swipe))fail('battle-owned','战斗中资源由程序结算，MVU不能重复扣除。');
        if(Object.keys(event).some(k=>!['id','kind','target','resource','amount','reason'].includes(k)))fail('numeric-event','资源事件含未支持字段');
        if(!own(rules.vitals,event.resource))fail('numeric-resource','未知连续资源');number(event.amount,-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER);
        if(typeof event.reason!=='string'||!event.reason.trim())fail('numeric-event','资源变化需要正文依据');
        let target=next.numeric,max=maximums(next.growth.perks,rules,playerEquipment,next.growth);
        if(event.target&&event.target!=='player'){
          target=[...(next.numeric.combat.enemies||[]),...(next.numeric.combat.allies||[])].find(a=>a.id===event.target);
          if(!target)fail('numeric-target','没有该参战者');const actor=actorFrom(target,{rules,profiles});if(!actor)fail('numeric-target','参战者档案尚未完整');max=maximums(actor.perks,rules,actor.equipment,actor);target.vitals=target.vitals||clone(actor.vitals);
        }
        target.vitals[event.resource]=round(clamp(number(target.vitals[event.resource])+event.amount,0,max[event.resource]));
      }else if(event.kind==='encounter'){fail('battle-player','战斗只能由玩家面板确认开始、暂停或结束。');
      }else fail('numeric-event','未支持的数值事件');
      next.numeric.receipts[event.id]={event:clone(event),...(assessment?{assessment}:{})};applied.push(event.id);
    }
    if(hasItems&&factBatch){next=L.base(next);next.loadout.factBatches={...next.loadout.factBatches,[factBatch]:true};}
    if(next.numeric?.vitals){const max=maximums(next.growth?.perks,rules,equipmentOverride||L.effects(next),next.growth);for(const key of Object.keys(max))next.numeric.vitals[key]=Math.min(next.numeric.vitals[key],max[key]);}
    syncCombatPlayer(next,state);
    for(const key of ['growth','numeric','inventory','equipment','itemDefinitions','itemReceipts','loadout'])if(!same(state[key],next[key]))changes.push({path:['terminal','gameplay',key],before:state[key]===undefined?null:clone(state[key]),missing:state[key]===undefined,after:clone(next[key])});
    return {state:next,changes,applied,duplicates};
  }
  function context(stat){const game=stat?.terminal?.gameplay,c=game?.numeric?.combat;if(!c?.active&&!game?.tactical?.enabled)return ''; return c?.manual&&c.active?(c.paused?'【逐轮战斗已暂停】当前按普通叙事进行，不自动结算交锋。已发生的非交锋资源变化由MVU按事实登记；恢复战斗后从已保存状态继续。不得自动恢复战斗或宣布此前待完成交锋的结果。':'【逐轮战斗】只按程序注入的本轮结果描写，未提供结果时不得臆造结算。'):'【战斗控制】当前没有正在结算的战斗。正文可以描写冲突，但不能自行开启数值战斗。若本层现场首次进入即将交锋的状态，在本层<ztl>的JSON中添加"combat":{"pending":true}，只用于显示可关闭的待确认提示；描写停在交锋起点，不替玩家结算战斗或判定胜负。闲谈、训练、回忆、假设、远处枪声和已结束的冲突不标记；同一冲突后续层不重复标记。此提示不发起额外API请求，不代表玩家已经开战。';}
  function migrate(state){const next=clone(state);if(!next.numeric||next.numeric.rulesRef?.version===defaultRules.version)return next;if(next.numeric.rulesRef?.id!==defaultRules.id||next.numeric.rulesRef?.version!==1)fail('numeric-state','未知数值规则，保留原记录。');const equipment=L.effects(next),oldMax=maximums(next.growth?.perks,{...defaultRules,version:1},equipment),max=maximums(next.growth?.perks,defaultRules,equipment,next.growth);next.numeric.vitals.hp=round(clamp(next.numeric.vitals.hp/oldMax.hp,0,1)*max.hp);next.numeric.rulesRef={id:defaultRules.id,version:defaultRules.version};next.numeric.combat={...next.numeric.combat,active:false,manual:false};return next;}

  return {loadout:L,rules:defaultRules,talents,growth,same,learned,collected,migrate,maximums,matches,resolveEffects,winChance,actorFrom,evaluateCombat,shortPrompt,initialNumeric,checkNumeric,syncCombatPlayer,settle,context};
});
