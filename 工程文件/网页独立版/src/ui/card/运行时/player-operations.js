/* Derived from 卡片源码/运行时/player-operations.js; source SHA256 326ee6940a438461c3c2c7b73b579de219a226187f9c42a588875b967c80583f. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(local?require('./loadout.js'):root.CxxLoadout,local?require("../数值引擎/src/engine.js"):root.CxxNumericEngine,local?require('./battle.js'):root.CxxBattle,local?require('./tactical-engine.js'):root.CxxTacticalEngine,local?require('./quests.js'):root.CxxQuests);if(local)module.exports=api;else root.CxxPlayerOperations=api;})(globalThis,function(L,E,B,T,Q){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const copy=v=>structuredClone(v),fields=['growth','numeric','inventory','equipment','itemDefinitions','itemReceipts','loadout','loadoutStart','tactical'];
  const actors=()=>typeof module==='object'&&module.exports?require('./ensemble-state.js'):globalThis.CxxEnsembleState;
  function clamp(game){if(!game.numeric?.vitals)return;const max=E.maximums(game.growth?.perks,undefined,L.effects(game),game.growth);for(const k of Object.keys(max))game.numeric.vitals[k]=Math.min(game.numeric.vitals[k],max[k]);}
  function playerPlan(stat,request,{identity,newChat=false,startGame,battleEncounter,battleRoster,battleClosure,tacticalScene,questDefinitions,questSource,questCalibration}={}){
    if(!stat?.terminal)throw Error('开场基础变量尚未就绪。');
    if(request.action.startsWith('quest-'))return Q.plan(stat,request,{questDefinitions,questSource,questCalibration});
    const next=copy(stat),previous=next.terminal.gameplay||{};let game=E.migrate(previous);
    if(request.action==='initialize'){
      let existed=game.growth!==undefined;if(existed)E.growth.read(game.growth);
      // A new scenario keeps its authored values and unknown fields. Only the
      // player fields follow the already configured opening, once per branch.
      if(!existed&&newChat&&startGame?.growth&&startGame.loadoutStart?.token===identity?.setupToken){
        if(Object.values(game.inventory||{}).some(x=>x?.quantity)||Object.values(game.equipment||{}).some(x=>x?.itemId))throw Error('此开场已有装备记录，请保留原记录，不覆盖起步配置。');
        for(const key of fields)if(startGame[key]!==undefined)game[key]=copy(startGame[key]);
        existed=true;E.growth.read(game.growth);
      }
      if(!existed){if(!identity?.growthSetup)throw Error('请先确认出身与初始配点。');game.growth=E.growth.initialize(identity.growthSetup,identity.id);}
      game={schema:1,blueprints:{},skills:{},resources:{},events:{},results:{},...L.base(game)};
      if(!existed&&newChat&&identity?.setupToken&&!game.loadoutStart){
        const initial=L.initial(identity.id,identity.loadoutSetup);
        if(Object.values(game.inventory).some(x=>x?.quantity)||Object.values(game.equipment).some(x=>x?.itemId))throw Error('当前已有装备记录，保留原记录，不重复领取起步配置。');
        for(const key of ['inventory','equipment','itemDefinitions','itemReceipts','loadout'])game[key]={...game[key],...initial[key]};
        game.loadoutStart={token:identity.setupToken,version:L.version};
      }
      if(!existed&&!game.numeric)game.numeric=E.initialNumeric(game,undefined,L.effects(game));
    }else{
      E.growth.read(game.growth);
      if(game.tactical?.encounter?.active&&!request.action.startsWith('tactical-'))throw Error('请先将战況交回剧情，再改变配点或装备。');
      if(request.action.startsWith('tactical-'))game=T.operation(game,request,{scene:tacticalScene});
      else if(request.action==='growth-repair'){if(game.growth.repairReceipts?.[request.id])return next;if(!E.same(game.growth,request.expected))throw Error('成长记录已有变化，请重新检查补算范围。');game=E.settle(game,request.events,{source:{kind:'history-repair',...request.range}}).state;game.growth.repairReceipts={...game.growth.repairReceipts,[request.id]:request.range};}
      else if(request.action==='talent-allocate')game.growth=E.growth.allocate(game.growth,request.build);
      else if(request.action==='loadout-save')game=L.saveDraft(game,request);
      else if(request.action==='resolve-equipment'){
        const pending=game.loadout?.pendingTransactions?.[request.id];if(!pending){if(game.loadout?.resolvedTransactions?.[request.id])return next;throw Error('待确认交易已变化。');}
        if(!E.same(next.terminal.wallet||{},pending.walletBefore))throw Error('钱包已有后续变化，请回到原楼层重跑 MVU，避免覆盖后续交易。');
        const definitions={};for(const issue of pending.issues){const raw=request.resolutions?.[issue.id];if(!raw)throw Error('请确认每件装备的型号、品质与能力。');const d=L.customDefinition(raw);game.itemDefinitions={...game.itemDefinitions,[d.id]:d};definitions[issue.id]=d;}
        const events=pending.events.map(e=>{if(!definitions[e.id])return e;const v={...e,itemId:definitions[e.id].id};delete v.item;return v;});
        game=E.settle(game,events,{source:pending.source,factBatch:pending.factBatch}).state;
        const wallet=copy(next.terminal.wallet||{});for(const p of pending.wallet){const key=p.path.split('/').at(-1);if(!['yen','spent','earned'].includes(key)||!['replace','add'].includes(p.op)||!Number.isSafeInteger(p.value)||key!=='yen'&&p.value<0)throw Error('交易款项不完整，请重跑原楼层 MVU。');wallet[key]=p.value;}
        if(pending.wallet.length&&wallet.yen-pending.walletBefore.yen!==wallet.earned-pending.walletBefore.earned-(wallet.spent-pending.walletBefore.spent))throw Error('交易扣款与累计收支不一致，请重新解析。');
        if(pending.wallet.length)next.terminal.wallet=wallet;delete game.loadout.pendingTransactions[request.id];game.loadout.resolvedTransactions={...game.loadout.resolvedTransactions,[request.id]:{events:events.map(e=>e.id)}};
      }
      else if(request.action==='custom-edit')game=L.editCustom(game,request);
      else if(request.action.startsWith('battle-'))game=B.operation(game,request,{battleEncounter,battleRoster,battleClosure});
      else game=L.action(game,request);
    }
    clamp(game);if(!request.action.startsWith('battle-')&&!request.action.startsWith('tactical-'))E.syncCombatPlayer(game,previous,request.operations||[request]);next.terminal.gameplay=game;return next;
  }
  function planCore(stat,request,options={}){
    if(request.action==='police-correct'||request.action.startsWith('city-'))return (typeof module==='object'&&module.exports?require('./civic.js'):globalThis.CxxCivic||globalThis?.CxxCivic).plan(stat,request,options);
    if(request.action==='roster-initialize')return (typeof module==='object'&&module.exports?require('./roster.js'):globalThis.CxxRoster).initialize(stat);
    const A=actors(),registered=stat?.terminal?.ensemble!==undefined;
    if(request.action==='ensemble-initialize'){
      if(!A)throw Error('人物建档服务尚未就绪。');
      return (typeof module==='object'&&module.exports?require('./roster.js'):globalThis.CxxRoster).initialize(stat);
    }
    if(!registered){
      if(request.actorId&&request.actorId!=='player'||request.actorBinding||options.actorBinding||request.action==='actor-switch')throw Error('先为本故事登记人物。');
      return playerPlan(stat,request,options);
    }
    if(!A)throw Error('人物状态服务尚未就绪。');
    // Opening previews and saved-opening recovery always maintain the original
    // player's confirmed origin; they never initialize the controlled NPC.
    if(request.action==='initialize'&&!options.actorBinding)options={...options,actorBinding:A.binding(stat,'player')};
    A.assertBinding(stat,options.actorBinding);
    if(request.actorBinding&&!E.same(request.actorBinding,options.actorBinding))throw Error('人物操作草稿已过期，请重新打开当前人物。');
    if(request.action==='actor-switch')return A.preview(stat,A.planControl(stat,request.actorId));
    const actorId=options.actorBinding.actorId;
    if(request.actorId&&request.actorId!==actorId)throw Error('操作人物与已确认的保存目标不一致。');
    if(request.action==='battle-resolve'&&(request.pending?.actorId||'player')!==actorId)throw Error('本轮交锋属于另一人物，不能改换结算目标。');
    if(request.action.startsWith('battle-')&&request.action!=='battle-resolve'&&actorId!==A.registry(stat).control.actorId)throw Error('请先切为该人物，再操作其战斗。');
    if(request.action.startsWith('tactical-')&&actorId!==A.registry(stat).control.actorId)throw Error('请先切为该人物，再操作其战术现场。');
    if(request.action.startsWith('quest-'))return Q.plan(stat,request,options);
    if(actorId==='player')return playerPlan(stat,request,options);
    // Keep the existing engine's player-relative paths inside a pure calculation
    // view. Only this actor's resulting gameplay/wallet are copied back.
    if(request.action==='initialize')throw Error('既有人物沿用已确认起点，不按玩家出身重新建档。');
    const selected=A.read(stat,actorId),view=copy(stat);
    if(!selected.gameplay?.growth||!selected.gameplay?.numeric)throw Error('该人物尚未建立完整数值记录。');
    view.terminal.gameplay=selected.gameplay;view.terminal.wallet=selected.wallet;
    const calculated=playerPlan(view,request,options),unchanged=copy(calculated);
    unchanged.terminal.gameplay=view.terminal.gameplay;unchanged.terminal.wallet=view.terminal.wallet;
    if(!E.same(unchanged,view))throw Error('人物操作包含跨人物状态改动。');
    const next=copy(stat),record=next.terminal.ensemble.actors[actorId];
    record.gameplay=calculated.terminal.gameplay;record.wallet=calculated.terminal.wallet;
    return next;
  }
  function plan(stat,request,options={}){const after=planCore(stat,request,options);if(request.action==='initialize'&&after.terminal?.gameplay?.numeric&&after.terminal?.roster?.seedVersion!=='2051-npc-1')return (typeof module==='object'&&module.exports?require('./roster.js'):globalThis.CxxRoster).initialize(after);if(['roster-initialize','ensemble-initialize','actor-switch'].includes(request.action))return after;return (typeof module==='object'&&module.exports?require('./roster.js'):globalThis.CxxRoster).program(stat,after,options.actorBinding?.actorId||'player',request);}
  function validate(before,after,operation){if(!operation)throw Error('此改动需要已校验的本地数值操作。');const expected=plan(before,operation.request,operation);if(!E.same(expected,after))throw Error('本地数值结果与引擎计算不一致。');return after;}
  function changes(before,after){const a=before.terminal?.gameplay,b=after.terminal?.gameplay;if(!a)return [{key:null,before:undefined,after:copy(b)}];return Object.keys(b).filter(k=>!E.same(a[k],b[k])).map(key=>({key,before:copy(a[key]),after:copy(b[key])}));}
  return {fields,clamp,plan,validate,changes};
});
