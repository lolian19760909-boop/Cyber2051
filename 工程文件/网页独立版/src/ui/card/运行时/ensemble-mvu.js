/* Derived from 卡片源码/运行时/ensemble-mvu.js; source SHA256 aedf917f28c5af13c9e324afe52795005aaf2358a0c973ee898c5b9218898240. Rebuild with tools/p3a-adapt-views.mjs. */
/* Per-actor calculation adapter. The existing MVU executor owns every write. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(local?require('./ensemble-state.js'):root.CxxEnsembleState,local?require('../共享/data-clone.js'):root.CxxDataClone);if(local)module.exports=api;else root.CxxEnsembleMvu=api;})(globalThis,function(A,C){
  'use strict';
  const copy=v=>C.clone(v),input=/^\/terminal\/ensemble\/actors\/([a-zA-Z][a-zA-Z0-9_-]{0,79})\/gameplay\/numericInput$/;
  const path=keys=>'/'+keys.join('/');
  function view(stat,actorId){const value=A.read(stat,actorId),next=copy(stat);next.terminal.gameplay=value.gameplay;next.terminal.wallet=value.wallet;return next;}
  const frozen=['battleRound','tacticalBase'];
  function policyFor(policy,actorId){const next={...policy,numericOptions:{...policy.numericOptions,custodyActorId:actorId}};for(const key of frozen){const value=next.numericOptions[key];if(value&&(value.actorId===undefined?'player':value.actorId)!==actorId)delete next.numericOptions[key];}return next;}
  function prepare(before,patches,policy,T,legacy){
    A.registry(before);
    const owners=frozen.map(key=>policy.numericOptions?.[key]).filter(Boolean).map(value=>value.actorId===undefined?'player':value.actorId);for(const id of owners)A.address(before,id);
    const tacticalOwner=policy.numericOptions?.tacticalBase?(policy.numericOptions.tacticalBase.actorId||'player'):null;
    const ids=[...new Set([...patches.map(p=>input.exec(p.path)?.[1]).filter(Boolean),...(tacticalOwner&&tacticalOwner!=='player'?[tacticalOwner]:[])])];
    if(!ids.length)return legacy(before,patches,policyFor(policy,'player'),T);
    const processed=new Set(),transactions=[];let result=[];
    for(const actorId of ids){
      const selected=A.read(before,actorId);
      if(selected.record.stateRef.kind!=='actor')throw Error('原玩家数值请使用原保存路径。');
      if(!selected.gameplay?.growth||!selected.gameplay?.numeric)throw Error('该人物尚未建立完整数值记录。');
      const prefix='/terminal/ensemble/actors/'+actorId,group=patches.filter(p=>p.path.startsWith(prefix+'/gameplay/')||p.path===prefix+'/gameplay'||p.path.startsWith(prefix+'/wallet/')||p.path===prefix+'/wallet');
      group.forEach(p=>processed.add(p));
      const fromLocal=p=>({...copy(p),path:prefix+p.path.slice('/terminal'.length)});
      // Each frozen round belongs to exactly one actor, including an old reply
      // being regenerated after the player has switched to somebody else.
      const localPolicy={...policyFor(policy,actorId),growthIdentity:undefined,growthAction:undefined};
      const local=legacy(view(before,actorId),group.map(p=>({...copy(p),path:'/terminal'+p.path.slice(prefix.length)})),localPolicy,T);
      const changes=local.changes.map(c=>({...copy(c),path:['terminal','ensemble','actors',actorId,...c.path.slice(1)]}));
      transactions.push({actorId,binding:A.binding(before,actorId),local,changes});
      result.push(...local.patches.map(fromLocal));
    }
    const ordinary=patches.filter(p=>!processed.has(p)),base=legacy(before,ordinary,policyFor(policy,'player'),T);
    result=[...(base?.patches||ordinary),...result];
    return {patches:result,changes:[...(base?.changes||[]),...transactions.flatMap(t=>t.changes)],ensembleTransactions:transactions,legacyTransaction:base};
  }
  function check(transaction,before,after,legacyCheck,context){
    if(transaction.legacyTransaction)legacyCheck(transaction.legacyTransaction,before,after,context);
    for(const row of transaction.ensembleTransactions){
      A.assertBinding(before,row.binding);A.assertBinding(after,row.binding);
      legacyCheck(row.local,view(before,row.actorId),view(after,row.actorId),context);
    }
    return true;
  }
  return {prepare,check,view,inputPath:actorId=>path(['terminal','ensemble','actors',actorId,'gameplay','numericInput'])};
});
