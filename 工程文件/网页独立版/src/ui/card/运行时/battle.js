/* Derived from 卡片源码/运行时/battle.js; source SHA256 328e0e30cde86438aca3538f4ba739a430cdbade28a5878a8a7d6cd41b293046. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const local=typeof module==='object'&&module.exports,api=factory(local?require('../数值引擎/src/engine.js'):root.CxxNumericEngine,local?require('./loadout.js'):root.CxxLoadout);if(local)module.exports=api;else root.CxxBattle=api;})(globalThis,function(E,L){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const copy=v=>structuredClone(v),fail=s=>{throw Error(s);},round=n=>Math.round(n*100)/100;
  const finite=(v,min=0)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min)fail('参战者数值无效。');return v;};
  const validId=v=>{if(typeof v!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v)||['__proto__','constructor','prototype'].includes(v))fail('参战者或战斗编号无效。');return v;};
  function actor(record){const template=E.rules.templates[record.template||'civilian'];if(!template)fail('未知战斗模板。');const a={...copy(template),...copy(record),id:validId(record.id),name:String(record.name||record.id).slice(0,80),level:record.level??1,perks:record.perks||{},equipment:copy(record.equipment||[]),tags:[...new Set(record.tags||template.tags||[])]};finite(a.level,1);if(!Number.isInteger(a.level))fail('等级必须为正整数。');a.attributes=copy(record.attributes||template.attributes);for(const key of E.growth.attributes)finite(a.attributes[key]);for(const item of a.equipment){validId(item.id);item.effects=(item.effects||[]).map(L.model.effect);}if(a.hpMax!==undefined)finite(a.hpMax,1);const max=E.maximums(a.perks,undefined,a.equipment,a);a.vitals={...max,...record.vitals};for(const k of Object.keys(max))a.vitals[k]=Math.min(finite(a.vitals[k]),max[k]);E.resolveEffects(a);return a;}
  function player(game,overrides={}){return actor({...overrides,id:'player',name:overrides.name||'玩家',template:'civilian',level:overrides.level??game.growth.level,attributes:overrides.attributes||game.growth.attributes,perks:game.growth.perks,equipment:L.effects(game),tags:L.tags(game,overrides.tags||game.numeric.combat?.playerTags||[]),vitals:overrides.vitals||game.numeric.vitals});}
  function seed(game){return {player:player(game),allies:[],enemies:[]};}
  const mode=c=>c?.mode==='system'?'system':c?.manual?'cheat':'system';
  function recognized(record,game,{system=false}={}){
    const template=E.rules.templates[record.template];if(!template)fail('识别结果包含未知敌人类型，请重新识别。');
    const input=system?{id:record.id,name:record.name,template:record.template}:copy(record);input.perks={};input.equipment=[];
    if(!Array.isArray(record.equipment||[]))fail('识别装备列表无效。');
    for(const [i,item]of (system&&template.fixedEquipment?template.fixedEquipment:record.equipment||[]).entries()){
      const id=typeof item==='string'?item:(item?.definitionId||item?.itemId||item?.id),official=L.official.find(id),known=Object.values(game.itemDefinitions||{}).find(d=>d.custom&&[d.id,d.name].includes(id));
      const d=known||(official?L.definition(official.id):L.get(game,id));if(!d)fail('识别中包含未确认的装备，请重新识别。');
      input.equipment.push({id:'scan_item_'+i,name:d.name,effects:copy(d.numericEffects||[]),tags:copy(d.tags||[])});
    }
    input.tags=[...new Set([...(system?template.tags:record.tags||template.tags||[]),...input.equipment.flatMap(x=>x.tags)])];
    if(system){
      const rank=template.fixedEquipment?'regular':record.rank||'regular',health=record.health||'healthy';
      if(!Object.hasOwn(E.rules.encounter.ranks,rank)||!Object.hasOwn(E.rules.encounter.health,health))fail('识别中的强度或伤势类型无效。');
      input.level=Math.max(1,template.defaultLevel+E.rules.encounter.ranks[rank]);input.rank=rank;input.health=health;
      const a=actor(input);a.vitals.hp=round(a.vitals.hp*E.rules.encounter.health[health]);return a;
    }
    return actor(input);
  }
  function encounter(record,game){
    if(typeof record?.inCombat!=='boolean')fail('识别结果缺少是否正在交战，请重试。');
    if(!record.inCombat)return {inCombat:false,allies:[],enemies:[]};
    if(!Array.isArray(record.enemies)||!record.enemies.length||!Array.isArray(record.allies||[])||record.enemies.length+(record.allies||[]).length>32)fail('参战名单缺失或超出32人，请重新识别。');
    const allies=(record.allies||[]).map(r=>recognized(r,game,{system:true})),enemies=record.enemies.map(r=>recognized(r,game,{system:true})),ids=['player',...allies.map(a=>a.id),...enemies.map(a=>a.id)];
    if(new Set(ids).size!==ids.length)fail('识别的参战者编号重复。');if(enemies.every(a=>a.vitals.hp===0))return {inCombat:false,allies:[],enemies:[]};
    return {inCombat:true,allies,enemies};
  }
  const stateKey=g=>JSON.stringify({combat:g.numeric?.combat,vitals:g.numeric?.vitals,});
  function action(a,actors){const value={kind:'attack',...copy(a||{})};if(!['attack','defend','ability','withdraw'].includes(value.kind))fail('请选择攻击、防御、使用能力或撤离。');if(value.target&&!actors.some(x=>x.id===value.target))fail('目标不在本场战斗。');return value;}
  function start(game,request,battleEncounter){
    const selected=request.mode||'system';if(!['system','cheat'].includes(selected))fail('战斗模式无效。');
    if(selected==='system'){
      if(!battleEncounter?.inCombat||battleEncounter.id!==request.encounterId||!battleEncounter.source)fail('当前没有已确认的交战现场，请先识别战况。');
      if(game.numeric.combat?.encounterSource===battleEncounter.source)fail('这段现场已结算，请等待新的正文战况。');
    }
    const draft=selected==='system'?battleEncounter:request.draft;if(!draft?.enemies?.length)fail('请先确认至少一位敌人。');
    const p=player(game,selected==='system'?{}:draft.player||{}),allies=(draft.allies||[]).map(actor),enemies=draft.enemies.map(actor),actors=[p,...allies,...enemies],ids=actors.map(a=>a.id);
    if(new Set(ids).size!==ids.length)fail('参战者编号重复。');
    return {...copy(game.numeric.combat),id:validId(request.id),mode:selected,encounterSource:selected==='system'?battleEncounter.source:null,encounterStart:battleEncounter?.startFloor,closed:null,departed:[],actionOverride:null,manual:true,active:true,paused:false,round:0,player:p,allies,enemies,actions:{player:{kind:selected==='system'?'defend':'attack',target:enemies.find(a=>a.vitals.hp>0)?.id||enemies[0].id}},lastRound:null};
  }
  function available(game){const entries=L.list(game).filter(row=>!L.restricted(game,row.slot)),out=[];for(const row of entries)for(const [i,e]of (row.definition.numericEffects||[]).entries())if(L.model.actions.has(e.kind)&&(e.trigger||'manual')==='manual')out.push({id:row.slot+':'+i,name:row.definition.name+' · '+L.model.describe(e),effect:copy(e)});return out;}
  function prepare(game,{id,roll,source={},actionOverride}){
    validId(id);finite(roll);if(roll>=1)fail('随机抽取结果无效。');const initial=E.migrate(game),combat=initial.numeric?.combat;if(!combat?.manual||!combat.active||combat.paused)fail('本场战斗未开始或已暂停。');
    const prior=copy(initial),g=copy(initial),c=g.numeric.combat;if(actionOverride)c.actions={...c.actions,player:action(actionOverride,[c.player,...c.allies,...c.enemies])};if(c.actions?.player?.activeSlots)g.loadout.active=copy(c.actions.player.activeSlots);
    c.player=player(g,mode(c)==='system'?{name:c.player.name}:c.player);const sides={player:[c.player,...c.allies.map(actor)],enemy:c.enemies.map(actor)},actors=[...sides.player,...sides.enemy],byId=new Map(actors.map(a=>[a.id,a]));
    const act=Object.fromEntries(actors.map(a=>[a.id,action(mode(c)==='system'&&a.id!=='player'?{kind:'attack'}:c.actions?.[a.id],actors)])),sideOf=a=>sides.player.includes(a)?'player':'enemy';
    const targetFor=a=>{const selected=byId.get(act[a.id].target);return selected?.vitals.hp>0?selected:sides[sideOf(a)==='player'?'enemy':'player'].find(x=>x.vitals.hp>0);};
    const weights=Object.fromEntries(Object.entries(sides).map(([key,members])=>[key,members.reduce((sum,a)=>sum+E.resolveEffects(a,targetFor(a)||{}).weight,0)])),chance=E.winChance(weights.player,weights.enemy),advantage=roll<chance?'player':'enemy';
    const before=actors.map(a=>({id:a.id,name:a.name,hp:a.vitals.hp,hpMax:E.maximums(a.perks,undefined,a.equipment,a).hp,side:sideOf(a)})),events=[],notes=[];
    const pending=(a,e,target,amount,kind)=>({actor:a.id,target:target.id,resource:e?.kind==='restoreRam'?'ram':e?.kind==='restoreStamina'?'stamina':'hp',amount,kind});
    function heal(a,e,trigger,opponent,list){if((e.trigger||'manual')!==trigger||!L.model.actions.has(e.kind)||!E.matches(e.when,a,opponent||{}))return;if(trigger!=='manual'&&e.cost){if(a.vitals[e.cost.resource]<e.cost.amount)return;a.vitals[e.cost.resource]-=e.cost.amount;events.push({actor:a.id,target:a.id,resource:e.cost.resource,amount:-e.cost.amount,kind:'cost'});}const targets=e.target==='allEnemies'?sides[sideOf(a)==='player'?'enemy':'player']:e.target==='allAllies'?sides[sideOf(a)]:e.target==='target'?[opponent].filter(Boolean):[a];for(const t of targets)if(t.vitals.hp>0){if(e.kind==='damage')list.push(pending(a,e,t,-e.value*(1-E.resolveEffects(t,a).reduction)*(act[t.id].kind==='defend'?.5:1),'damage'));else list.push(pending(a,e,t,e.value,'restore'));}}
    function apply(batch){const groups=new Map();for(const e of batch){const key=e.target+':'+e.resource;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}for(const [key,entries]of groups){const [id,resource]=key.split(':'),a=byId.get(id),max=E.maximums(a.perks,undefined,a.equipment,a)[resource],old=a.vitals[resource],damage=-entries.reduce((s,e)=>s+Math.min(0,e.amount),0),healing=entries.reduce((s,e)=>s+Math.max(0,e.amount),0),actualDamage=Math.min(damage,old+healing),actualHealing=Math.min(healing,max-old+actualDamage);a.vitals[resource]=round(Math.max(0,Math.min(max,old-damage+healing)));for(const e of entries)events.push({...e,amount:round(e.amount*(e.amount<0?(damage?actualDamage/damage:0):(healing?actualHealing/healing:0))),attemptedAmount:round(e.amount)});}}
    function phase(side,factor){const batch=[],strikes=[];for(const a of sides[side]){if(a.vitals.hp<=0)continue;const selected=act[a.id],target=targetFor(a);if(selected.kind==='withdraw')continue;
      if(selected.kind==='ability'){
        const ability=a.id==='player'?available(g).find(x=>x.id===selected.ability)?.effect:(a.equipment||[]).flatMap(x=>x.effects||[]).find((e,i)=>String(i)===selected.ability&&L.model.actions.has(e.kind));
        if(!ability){notes.push(a.name+'的能力只有叙事用途，本轮没有数值攻击或恢复。');continue;}
        if(!E.matches(ability.when,a,target||{})){notes.push(a.name+'未满足能力条件。');continue;}if(ability.cost){const cost=ability.cost;if(a.vitals[cost.resource]<cost.amount){notes.push(a.name+'资源不足，能力未生效。');continue;}a.vitals[cost.resource]-=cost.amount;events.push({actor:a.id,target:a.id,resource:cost.resource,amount:-cost.amount,kind:'cost'});}
        if(ability.kind.startsWith('restore')){heal(a,{...ability,value:ability.value*factor},'manual',target,batch);continue;}
        const targets=ability.target==='allEnemies'?sides[side==='player'?'enemy':'player'].filter(x=>x.vitals.hp>0):[target].filter(Boolean);for(const t of targets){if(t.vitals.hp<=0)continue;const amount=ability.value*factor*(1-E.resolveEffects(t,a).reduction)*(act[t.id].kind==='defend'?.5:1);batch.push(pending(a,null,t,-amount,'damage'));strikes.push({a,t});}continue;
      }
      if(!target||target.vitals.hp<=0||sideOf(target)===side)continue;const attack=E.resolveEffects(a,target).power*factor*(selected.kind==='defend'?.5:1),amount=attack*(1-E.resolveEffects(target,a).reduction)*(act[target.id].kind==='defend'?.5:1);batch.push(pending(a,null,target,-amount,'damage'));strikes.push({a,t:target});
    }
    const living=new Set(actors.filter(a=>a.vitals.hp>0).map(a=>a.id));apply(batch);const recovery=[];
    for(const {a,t}of strikes){if(a.vitals.hp>0)for(const e of E.collected(a.perks,a.equipment)){heal(a,e,'onHit',t,recovery);if(living.has(t.id)&&t.vitals.hp===0)heal(a,e,'onKill',t,recovery);}if(t.vitals.hp>0)for(const e of E.collected(t.perks,t.equipment)){heal(t,e,'onDamage',a,recovery);if(t.vitals.hp<E.maximums(t.perks,undefined,t.equipment,t).hp*.5)heal(t,e,'lowHp',a,recovery);}}apply(recovery);
    }
    const withdrawing=act.player.kind==='withdraw';let outcome='ongoing';if(withdrawing&&advantage==='player'){outcome='escaped';notes.push('我方取得撤离优势，成功脱离。');}else if(withdrawing){phase('enemy',1);notes.push('撤离失败，承受对方本轮攻击。');}else{phase(advantage,1);phase(advantage==='player'?'enemy':'player',.5);}
    if(outcome==='ongoing'&&sides.enemy.every(a=>a.vitals.hp===0))outcome='enemy_incapacitated';else if(outcome==='ongoing'&&sides.player.every(a=>a.vitals.hp===0))outcome='player_incapacitated';
    const result={id,round:(c.round||0)+1,advantage,playerChance:chance,roll,actions:act,events,notes,outcome,stillFighting:outcome==='ongoing',actors:before.map(row=>({...row,after:byId.get(row.id).vitals.hp})),source:copy(source)};
    c.player=copy(sides.player[0]);c.allies=copy(sides.player.slice(1));c.enemies=copy(sides.enemy);c.round=result.round;c.active=result.stillFighting;c.lastRound=result;c.actionOverride=null;g.numeric.vitals=copy(c.player.vitals);
    return {id,roll,source:copy(source),...(actionOverride?{actionOverride:copy(actionOverride)}:{}),expected:stateKey(prior),snapshot:prior,result,combat:c,vitals:g.numeric.vitals};
  }
  function operation(game,request,{battleEncounter,battleRoster,battleClosure}={}){const g=E.migrate(game),c=g.numeric?.combat;if(request.action==='battle-start'){if(c?.manual&&c.active){if(c.id===request.id)return g;fail('请先结束当前战斗。');}g.numeric.combat=start(g,request,battleEncounter);}
    else if(request.action==='battle-resolve'){const p=request.pending;if(g.numeric.receipts[p.id]?.round)return g;if(stateKey(g)!==p.expected)fail('本轮交锋起点已变化；待完成结果已保留，未扣血。');const calculated=prepare(p.snapshot,p);if(!E.same(calculated.result,p.result))fail('本轮结果校验失败。');g.numeric.combat=calculated.combat;g.numeric.vitals=calculated.vitals;g.numeric.receipts[p.id]={round:copy(calculated.result)};}
    else{if(!c?.manual)fail('尚未确认战斗资料。');if(request.expected&&request.expected!==JSON.stringify(c))fail('本场战斗已变化，请重新读取。');
      if(mode(c)==='system'&&['battle-edit','battle-end'].includes(request.action))fail('系统决定模式不能改写战况或直接结束，请选择撤离行动。');
      if(request.action==='battle-close'){
        if(request.battleId!==c.id||!['recovery','narrative_end'].includes(request.reason))fail('结束请求不属于当前战斗。');
        if(request.reason==='narrative_end'&&(!c.paused||battleClosure?.battleId!==c.id||battleClosure.reason!=='narrative_end'||!battleClosure.proof))fail('当前没有可采用的正文结束依据。');
        if(!c.active)return g;c.active=false;c.paused=false;c.actionOverride=null;c.closed={reason:request.reason,source:copy(battleClosure?.proof||request.source||{}),...(battleClosure?.enemyStates?{enemyStates:copy(battleClosure.enemyStates)}:{})};
      }
      else if(request.action==='battle-roster'){
        if(!c.active||battleRoster?.id!==request.rosterId||battleRoster.battleId!==c.id||battleRoster.expected!==JSON.stringify(c))fail('参战名单凭据已变化，请重新识别。');
        const ids=new Set(['player',...c.allies.map(a=>a.id),...c.enemies.map(a=>a.id)]);
        for(const side of ['allies','enemies'])for(const value of battleRoster[side]){if(ids.has(value.id))fail('新增参战者编号重复。');ids.add(value.id);c[side].push(actor(value));}
        c.departed=c.departed||[];for(const d of battleRoster.departures)for(const side of ['allies','enemies']){const index=c[side].findIndex(a=>a.id===d.id);if(index>=0)c.departed.push({...c[side].splice(index,1)[0],side,departure:copy(d.evidence)});}
        if(!c.enemies.length)fail('全部敌人离场时请核对结束战斗。');if(c.allies.length+c.enemies.length>32)fail('参战人数超出32人。');
        for(const [id,a]of Object.entries(c.actions||{})){if(id!=='player'&&![...c.allies,...c.enemies].some(x=>x.id===id))delete c.actions[id];else if(a.target&&!['player',...c.allies.map(x=>x.id),...c.enemies.map(x=>x.id)].includes(a.target))delete a.target;}
        c.actionOverride=null;c.rosterSource=battleRoster.source;
      }
      else if(request.action==='battle-edit'){const next=start(g,{id:c.id,mode:'cheat',draft:request.draft});next.round=c.round;next.lastRound=c.lastRound;next.paused=c.paused;const ids=new Set([next.player,...next.allies,...next.enemies].map(a=>a.id));next.actions=Object.fromEntries(Object.entries(c.actions||{}).filter(([id])=>ids.has(id)).map(([id,a])=>[id,{...a,target:ids.has(a.target)?a.target:''}]));g.numeric.combat=next;}
      else if(request.action==='battle-pause')c.paused=Boolean(request.paused);
      else if(request.action==='battle-end'){c.active=false;c.paused=false;}
      else if(request.action==='battle-action'){if(!c.active)fail('本场战斗已经结束。');c.actions={...c.actions};for(const [id,value]of Object.entries(request.actions||{})){if(mode(c)==='system'&&id!=='player')fail('系统决定模式只允许选择玩家自己的行动。');if(![c.player,...c.allies,...c.enemies].some(a=>a.id===id))fail('此参战者不在本场战斗。');c.actions[id]=action(value,[c.player,...c.allies,...c.enemies]);if(id==='player'&&value.activeSlots)L.action(g,{action:'active-state',slots:value.activeSlots});}c.actionOverride={round:(c.round||0)+1};}
      else fail('不支持的战斗操作。');}
    return g;
  }
  function prompt(p){const r=p.result;return '【本轮交锋，已由程序确定】\n'+JSON.stringify(r)+'\n只描写第'+r.round+'轮行动与结果；优势不代表整场胜利。逐项遵守实际伤害、结算后生命和是否继续战斗。生命归零仅失去行动能力，不自动写成死亡。不得另掷暴击、改变伤害、增加隐含治疗或额外交锋。本轮资源由程序在正文完成后保存，MVU不得重复登记。\n行动以本轮actions字段为准，只使用已保存的装备和已确认能力。当前武器为未选择时，普通攻击按徒手描写；玩家想开枪不等于已经持有枪械。正文不能临时变更本轮行动、目标、参战名单或条件。新拾取、换装及场面变化发生在本轮结束之后，需登记或面板确认后供下一轮使用。';}
  return {rules:E.rules,matches:E.matches,actor,player,seed,mode,recognized,encounter,stateKey,available,prepare,operation,prompt};
});
