/* Pure bridge from this card's confirmed growth actions to the standalone numeric engine. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(
  local?require("../数值引擎/src/engine.js"):root.CxxNumericEngine,
  local?require("../数值引擎/adapters/mvu.js"):root.CxxNumericMvu,
  local?require('./numeric-content.js'):root.CxxNumericContent,
  local?require('./battle.js'):null,root);
  if(local)module.exports=value;else root.CxxNumericHost=value;
})(globalThis,function(E,M,content,B,root){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  const copy=v=>structuredClone(v),get=(v,p)=>p.reduce((v,k)=>v?.[k],v);
  const pointer=p=>'/'+p.join('/');
  function preparePlayer(before,patches,policy,T){
    const inputs=patches.filter(p=>p.path===M.inputPath),ordinary=patches.filter(p=>p.path!==M.inputPath),tacticalBase=policy.numericOptions?.tacticalBase;
    if(tacticalBase&&!inputs.length)inputs.push({op:'add',path:M.inputPath,value:[]});
    if(inputs.length>1)throw Error('一次保存只提交一份数值事件数组。');
    const growth=ordinary.filter(p=>p.path==='/terminal/gameplay'||p.path==='/terminal/gameplay/growth'||p.path.startsWith('/terminal/gameplay/growth/'));
    if(ordinary.some(p=>['numeric','tactical'].some(k=>p.path==='/terminal/gameplay/'+k||p.path.startsWith('/terminal/gameplay/'+k+'/'))))throw Error('战况与资源由数值模块结算，请提交 numericInput 事件。');
    const old=before?.terminal?.gameplay?.growth;
    if(growth.length&&old!==undefined&&!policy.growthAction)throw Error('成长增量由数值模块结算；直接配点需要已确认的界面行动。');
    if(!inputs.length)return null;
    if(policy.growthAction)throw Error('本次为已确认配点，仅保存配置与行动结果，不追加数值事件。');
    if(!['add','replace'].includes(inputs[0].op)||!Array.isArray(inputs[0].value)||Object.keys(inputs[0]).some(k=>!['op','path','value'].includes(k)))throw Error('numericInput 只接受本轮事件数组。');
    // The first story turn may initialize the confirmed origin and report an event together.
    const base=copy(before);
    if(tacticalBase){if(!tacticalBase.game?.tactical||!base.terminal?.gameplay)throw Error('战斗叙事接续记录不完整。');for(const k of ['growth','numeric','inventory','equipment','itemDefinitions','itemReceipts','loadout','tactical'])if(tacticalBase.game[k]!==undefined)base.terminal.gameplay[k]=copy(tacticalBase.game[k]);if(base.terminal.gameplay.tactical.encounter)base.terminal.gameplay.tactical.encounter.source=copy(tacticalBase.source);}
    if(growth.length){
      const p=growth[0],parent=!before.terminal?.gameplay;
      if(growth.length!==1||p.op!=='add'||p.path!==(parent?'/terminal/gameplay':'/terminal/gameplay/growth'))throw Error('首次成长只接受已确认的完整起点。');
      if(parent)base.terminal.gameplay=copy(p.value);else base.terminal.gameplay.growth=copy(p.value);
      T.validateTransition(before,base,policy);
    }
    // The prose is complete. Commit its frozen round and legal story facts in
    // one MVU transaction, so post-round equipment or XP cannot invalidate it.
    const battleRound=policy.numericOptions?.battleRound;
    if(battleRound)base.terminal.gameplay=(B||root.CxxBattle).operation(base.terminal.gameplay,{action:'battle-resolve',pending:battleRound});
    const restrictions=policy.numericOptions?.custodyRestrictions?.[policy.numericOptions?.custodyActorId||'player'];
    if(restrictions){
      if(!base.terminal?.gameplay?.growth)throw Error('被拘押人物尚未建立数值记录。');
      const game=base.terminal.gameplay;game.loadout={...game.loadout,policeRestrictions:copy(restrictions)};
      const blocked=new Set(Object.values(restrictions).flatMap(r=>r.slots));game.loadout.active=(game.loadout.active||[]).filter(slot=>!blocked.has(slot));
      const max=E.maximums(game.growth.perks,undefined,E.loadout.effects(game),game.growth);for(const k of Object.keys(max))if(game.numeric?.vitals)game.numeric.vitals[k]=Math.min(game.numeric.vitals[k],max[k]);
    }
    const rest=ordinary.filter(p=>!growth.includes(p));
    const tx=M.prepare(base,[...rest,...inputs],policy.numericOptions||content);
    const final=copy(base);
    for(const c of tx.changes)final.terminal.gameplay[c.path[2]]=copy(c.after);
    const paths=!before.terminal?.gameplay?[['terminal','gameplay']]:['growth','numeric','inventory','equipment','itemDefinitions','itemReceipts','loadout','tactical'].filter(k=>!E.same(before.terminal.gameplay[k],final.terminal.gameplay[k])).map(k=>['terminal','gameplay',k]);
    const changes=paths.map(path=>({path,missing:get(before,path)===undefined,before:get(before,path)===undefined?null:copy(get(before,path)),after:copy(get(final,path))}));
    return {...tx,changes,patches:[...rest.filter(p=>!tx.withheld?.some(w=>E.same(w,p))),...changes.map(c=>({op:c.missing?'add':'replace',path:pointer(c.path),value:copy(c.after)}))]};
  }
  // Matches the pinned MVU JSONPatch parser; its executor remains the only state writer.
  function commands(patches,pathOf){return patches.map(p=>{
    const parts=pathOf(p.path),address=keys=>keys.map(k=>'['+JSON.stringify(k)+']').join('');
    return {type:p.op==='replace'?'set':'insert',full_match:JSON.stringify(p),args:p.op==='replace'?[address(parts),JSON.stringify(p.value)]:[address(parts.slice(0,-1)),/^\d+$/.test(parts.at(-1))?parts.at(-1):JSON.stringify(parts.at(-1)),JSON.stringify(p.value)],reason:'json_patch'};
  });}
  const ensemble=()=>typeof module==='object'&&module.exports?require('./ensemble-mvu.js'):root.CxxEnsembleMvu;
  function prepareCore(before,patches,policy={},T){
    if(patches.some(p=>p.path.startsWith('/terminal/ensemble/actors/'))||['battleRound','tacticalBase'].some(key=>policy.numericOptions?.[key]?.actorId&&policy.numericOptions[key].actorId!=='player')){
      const adapter=ensemble();if(!adapter)throw Error('多人物数值服务尚未就绪。');
      return adapter.prepare(before,patches,policy,T,preparePlayer);
    }
    return preparePlayer(before,patches,policy,T);
  }
  const roster=()=>typeof module==='object'&&module.exports?require('./roster.js'):root.CxxRoster;
  function prepare(before,patches,policy={},T){const R=roster(),rt=R?.prepare(before,patches,policy);return rt?R.combine(before,rt,prepareCore(rt.base,rt.patches,policy,T)):prepareCore(before,patches,policy,T);}
  function check(transaction,before,after,context){if(transaction.roster){const r=transaction.roster;if(r.inner)check(r.inner,r.base,r.innerAfter,context);for(const c of transaction.changes)if(!E.same(get(before,c.path),c.missing?undefined:c.before)||!E.same(get(after,c.path),c.after))throw Error('NPC与成长整批结果未保存一致。');if(after.terminal?.rosterInput!==undefined)throw Error('NPC事实输入不能保留为存档状态。');return true;}return transaction.ensembleTransactions?ensemble().check(transaction,before,after,M.checkPrepared,context):M.checkPrepared(transaction,before,after,context);}
  return {prepare,commands,check,content};
});
