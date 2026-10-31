/* Pure actor addressing and transaction planning. MVU/player-host remain the writers. */
(function(root,factory){
  const local=typeof module==='object'&&module.exports;
  const api=factory(local?require('../数值引擎/src/engine.js'):root.CxxNumericEngine,
    local?require('./ensemble-content.js'):root.CxxEnsembleContent,
    local?require('../共享/data-clone.js'):root.CxxDataClone);
  if(local)module.exports=api;else root.CxxEnsembleState=api;
})(globalThis,function(E,content,cloneApi){
  'use strict';
  const clone=v=>cloneApi.clone(v),same=E.same;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function fail(code,message){throw Object.assign(Error(message),{code});}
  function id(value){if(typeof value!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value)||['constructor','prototype','__proto__'].includes(value))fail('actor-id','人物编号无效。');return value;}
  const get=(value,path)=>path.reduce((row,key)=>object(row)&&Object.hasOwn(row,key)?row[key]:undefined,value);
  function registry(stat){
    const value=stat?.terminal?.ensemble;
    if(value===undefined)return null;
    if(!object(value)||value.schema!==1||!object(value.actors)||!object(value.control)||!Number.isSafeInteger(value.control.revision)||value.control.revision<0)fail('actor-schema','人物状态版本或控制记录不完整，保留原数据。');
    return value;
  }
  function address(stat,actorId){
    id(actorId);
    const data=registry(stat),record=data?.actors?.[actorId];
    if(!object(record)||record.actorId!==actorId)fail('actor-missing','该人物尚未登记。');
    const legacy=record.stateRef?.kind==='legacy-player';
    if(legacy&&actorId!=='player'||!legacy&&record.stateRef?.kind!=='actor')fail('actor-reference','人物状态关联无效。');
    const base=legacy?['terminal']:['terminal','ensemble','actors',actorId];
    return {record,gameplayPath:[...base,'gameplay'],walletPath:[...base,'wallet']};
  }
  function binding(stat,actorId){
    const data=registry(stat);address(stat,actorId);
    return {actorId,controlledActorId:data.control.actorId,controlRevision:data.control.revision};
  }
  function assertBinding(stat,expected){
    if(!expected||!same(binding(stat,expected.actorId),expected))fail('actor-stale','扮演身份已经变化，请重新准备本次操作。');
    return true;
  }
  function plan(stat,actorId,kind,changes,extra={}){
    return {kind,binding:binding(stat,actorId),changes:clone(changes),...extra};
  }
  function read(stat,actorId){
    const a=address(stat,actorId);
    return {record:clone(a.record),gameplay:clone(get(stat,a.gameplayPath)),wallet:clone(get(stat,a.walletPath)),paths:{gameplay:a.gameplayPath,wallet:a.walletPath}};
  }
  // Read-only selection for existing consumers. Legacy saves retain their original paths.
  function selected(stat,actorId){
    const data=registry(stat),chosen=actorId===undefined?(data?.control.actorId||'player'):actorId;
    if(data)return {...read(stat,chosen),actorId:chosen,binding:binding(stat,chosen)};
    if(chosen!=='player')fail('actor-missing','该人物尚未登记。');
    return {actorId:'player',record:{actorId:'player',name:'玩家',stateRef:{kind:'legacy-player'}},gameplay:clone(stat?.terminal?.gameplay),wallet:clone(stat?.terminal?.wallet),paths:{gameplay:['terminal','gameplay'],wallet:['terminal','wallet']},binding:null};
  }
  // Returns a proposed snapshot only. Repeated calls never regrant existing actor state.
  function initialize(stat,{playerName='玩家',profiles=content.actors}={}){
    if(!object(stat)||!object(stat.terminal))fail('actor-origin','先读取本故事已保存的终端状态。');
    const old=registry(stat),next=clone(stat);
    const data=next.terminal.ensemble=old?clone(old):{schema:1,actors:{},control:{actorId:'player',viewpointActorId:'player',revision:0}};
    if(!Object.hasOwn(data.actors,'player'))data.actors.player={actorId:'player',name:playerName,stateRef:{kind:'legacy-player'},sourceRef:{kind:'existing-player'}};
    if(data.actors.player.stateRef?.kind!=='legacy-player')fail('actor-reference','原玩家必须沿用原状态路径。');
    for(const profile of profiles){
      const actorId=id(profile.actorId);
      if(actorId==='player')fail('actor-profile','人物档案不能替换原玩家。');
      const previous=data.actors[actorId];
      if(previous!==undefined){
        if(previous.actorId!==actorId||previous.stateRef?.kind!=='actor'||previous.worldbookUid!==profile.worldbookUid)fail('actor-identity','既有人物身份与新档案不一致。');
        continue;
      }
      const game=E.loadout.initial('custom',profile.loadoutSetup);
      game.growth=E.growth.initialize(profile.growthInitial,actorId+'_'+(profile.sourceRef?.version||content.version));
      game.numeric=E.initialNumeric(game,undefined,E.loadout.effects(game));
      const wallet=profile.walletInitial;
      if(!object(wallet)||['yen','earned','spent'].some(k=>!Number.isSafeInteger(wallet[k])||k!=='yen'&&wallet[k]<0))fail('actor-wallet','人物钱包起点无效。');
      data.actors[actorId]={actorId,name:profile.name,worldbookUid:profile.worldbookUid,stateRef:{kind:'actor'},sourceRef:clone(profile.sourceRef),controllable:profile.controllable!==false,gameplay:game,wallet:clone(wallet)};
    }
    address(next,data.control.actorId);address(next,data.control.viewpointActorId);
    return next;
  }
  function planNumeric(stat,actorId,events,options={}){
    const a=address(stat,actorId),game=get(stat,a.gameplayPath);
    if(!game?.growth)fail('actor-uninitialized','该人物尚未建立已确认的数值起点。');
    E.growth.read(game.growth);
    const result=E.settle(game,events,options);
    const changes=result.changes.map(change=>{
      if(change.path[0]!=='terminal'||change.path[1]!=='gameplay')fail('actor-numeric-path','数值引擎返回了未登记的状态路径。');
      return {...change,path:[...a.gameplayPath,...change.path.slice(2)]};
    });
    return plan(stat,actorId,'actor-numeric',changes,{applied:clone(result.applied),duplicates:clone(result.duplicates)});
  }
  function planControl(stat,actorId){
    const data=registry(stat),target=read(stat,actorId),current=read(stat,data.control.actorId);
    if(target.record.controllable===false)fail('actor-control','该人物已建立数值档案，尚未开放切换扮演。');
    if(!target.gameplay?.growth||!target.gameplay?.numeric)fail('actor-uninitialized','先为该人物建立完整数值记录。');
    E.growth.read(target.gameplay.growth);E.checkNumeric(target.gameplay.numeric,E.rules);
    if(current.gameplay?.numeric?.combat?.active||current.gameplay?.tactical?.encounter?.active||target.gameplay.numeric.combat.active||target.gameplay.tactical?.encounter?.active)fail('actor-combat','先结束当前人物交锋，再切换扮演。');
    if(data.control.actorId===actorId&&data.control.viewpointActorId===actorId)return plan(stat,actorId,'actor-control',[]);
    return plan(stat,actorId,'actor-control',[{path:['terminal','ensemble','control'],missing:false,before:clone(data.control),after:{...clone(data.control),actorId,viewpointActorId:actorId,revision:data.control.revision+1}}]);
  }
  function assertCurrent(stat,transaction){
    assertBinding(stat,transaction.binding);
    for(const change of transaction.changes){
      const value=get(stat,change.path);
      if(!same(value,change.missing?undefined:change.before))fail('actor-stale','人物状态已经变化，请重新准备本次操作。');
    }
    return true;
  }
  // Offline/UI preview, not a persistence API. Actual commits must use the host's transaction path.
  function preview(stat,transaction){
    assertCurrent(stat,transaction);
    const next=clone(stat);
    for(const change of transaction.changes){
      let parent=next;
      for(const key of change.path.slice(0,-1)){
        if(!object(parent[key]))fail('actor-parent','人物保存父路径不存在。');
        parent=parent[key];
      }
      parent[change.path.at(-1)]=clone(change.after);
    }
    return next;
  }
  // Author/system projection. Player-facing knowledge filtering belongs to the view service.
  function project(stat,actorId){
    const data=registry(stat);
    if(!data?.actors?.[actorId])return {actorId,status:'unregistered'};
    const value=read(stat,actorId),game=value.gameplay;
    const common={actorId,name:value.record.name,worldbookUid:value.record.worldbookUid,controlled:data.control.actorId===actorId,wallet:value.wallet??null};
    if(!game?.growth||!game?.numeric)return {...common,status:'uninitialized',growth:null,vitals:null,maxima:null,equipment:[]};
    E.growth.read(game.growth);E.checkNumeric(game.numeric,E.rules);
    return {...common,status:'ready',growth:clone(game.growth),vitals:clone(game.numeric.vitals),maxima:E.maximums(game.growth.perks,E.rules,E.loadout.effects(game),game.growth),equipment:clone(E.loadout.list(game)),inventory:clone(game.inventory||{}),location:clone(game.location??null)};
  }
  function extendSchema(schema){
    const props=schema?.properties?.terminal?.properties;if(!props)return;
    const extensible=value=>({...value,type:'object',extensible:true,recursiveExtensible:true,required:false});
    props.ensemble=extensible(props.ensemble||{});
    props.roster=extensible(props.roster||{});
    if(props.gameplay?.properties)props.gameplay.properties.sanity=extensible(props.gameplay.properties.sanity||{});
    const actorTable=props.ensemble.properties?.actors;
    if(actorTable)for(const record of Object.values(actorTable.properties||{}))if(record?.type==='object'&&record.properties?.gameplay)record.properties.gameplay=extensible(record.properties.gameplay);
  }
  return {schema:1,content,initialize,address,read,selected,registry,binding,assertBinding,planNumeric,planControl,assertCurrent,preview,project,extendSchema};
});
