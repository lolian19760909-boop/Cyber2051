/* Derived from 卡片源码/运行时/variable-editor.js; source SHA256 71b53aab2c6f8aa0bc1b154e6036bb98b480be2619ee667d1ce38b2a274e361b. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxVariableEditor=api;})(globalThis,function(root){
 'use strict';
 const local=typeof module==='object'&&module.exports,copy=value=>(local?require('../共享/data-clone.js'):root.CxxDataClone).clone(value),plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const engine=()=>local?require('../数值引擎/src/engine.js'):root.CxxNumericEngine,loadout=()=>local?require('./loadout.js'):root.CxxLoadout,schemaModule=()=>local?require('../MVU/schema.js'):root.Cxx236Schema,same=(a,b)=>engine().same(a,b);
 const actors=()=>typeof module==='object'&&module.exports?require('./ensemble-state.js'):root.CxxEnsembleState;
 const roster=()=>typeof module==='object'&&module.exports?require('./roster.js'):root.CxxRoster;
 const pointer=parts=>'/'+parts.map(key=>String(key).replace(/~/g,'~0').replace(/\//g,'~1')).join('/');
 function protectedPath(parts){
  if(parts.some(key=>key.startsWith('$')||['__proto__','constructor','prototype'].includes(key))||parts[0]?.startsWith('__'))return true;
  if(parts[0]!=='terminal')return false;
  if(['opening','variableEdits','questJournal','rosterInput','cityInput','policeInput'].includes(parts[1]))return true;
  if(parts[1]==='ensemble'){
   if(parts.length>2&&parts[2]!=='actors')return true;
   if(['actorId','stateRef','worldbookUid','definitionRef','sourceRef'].includes(parts[4]))return true;
  }
  const index=parts.indexOf('gameplay');if(index>=0){const tail=parts.slice(index+1);
   if(['schema','events','results','itemReceipts','loadoutStart','numericInput','tactical'].includes(tail[0]))return true;
   if(tail[0]==='growth'&&['schema','rulesRef','talentsRef','initial','rewards','corrections','originId','unrestricted','levelOffset'].includes(tail[1]))return true;
   if(tail[0]==='equipment'&&tail[2]==='source')return true;
   if(tail[0]==='numeric'&&['schema','rulesRef','receipts','combat'].includes(tail[1]))return true;
   if(tail[0]==='sanity'&&['schema','rulesRef','receipts','implants'].includes(tail[1]))return true;
   if(tail[0]==='loadout'&&['revision','lastSave','pendingTransactions','resolvedTransactions'].includes(tail[1]))return true;
  }
  if(parts[1]==='roster'&&['schema','seedVersion','receipts','lastSeen','lastSettlement'].includes(parts[2]))return true;
  if(['police','city'].includes(parts[1])&&['schema','events','receipts'].includes(parts[2]))return true;
  return false;
 }
 function editable(value,path=[]){if(Array.isArray(value))return copy(value);if(!plain(value))return copy(value);return Object.fromEntries(Object.entries(value).filter(([key])=>!protectedPath([...path,key])).map(([key,entry])=>[key,editable(entry,[...path,key])]));}
 function differences(before,after,path=[],rows=[]){
  if(same(before,after))return rows;
  if(plain(before)&&plain(after)){for(const key of new Set([...Object.keys(before),...Object.keys(after)]))differences(before[key],after[key],[...path,key],rows);}
  else rows.push({path:pointer(path),beforeMissing:before===undefined,afterMissing:after===undefined,...(before===undefined?{}:{before:copy(before)}),...(after===undefined?{}:{after:copy(after)})});
  return rows;
 }
 function get(value,path){return path.reduce((at,key)=>at&&Object.hasOwn(at,key)?at[key]:undefined,value);}
 function set(value,path,data,missing){let parent=value;for(const key of path.slice(0,-1)){if(!plain(parent[key]))throw Error('变量父字段已变化：'+pointer(path));parent=parent[key];}if(missing)delete parent[path.at(-1)];else parent[path.at(-1)]=copy(data);}
 function key(request){return JSON.stringify({changes:request.changes,undoOf:request.undoOf||null,actorId:request.actorId||'player'});}
 function gameEntries(stat){const rows=[{id:'player',path:['terminal','gameplay'],wallet:['terminal','wallet']}];for(const [id,row]of Object.entries(stat.terminal?.ensemble?.actors||{}))if(id!=='player'&&row.stateRef?.kind==='actor')rows.push({id,path:['terminal','ensemble','actors',id,'gameplay'],wallet:['terminal','ensemble','actors',id,'wallet']});return rows;}
 function validateGame(before,after,id){
  const E=engine(),L=loadout();
  if(!plain(after))throw Error('人物游戏状态需要保留。');
  if(!same(before?.growth,after.growth)&&after.growth){const corrected=E.growth.correct(before.growth,after.growth,id);for(const field of ['xp','level','attributes','perks','attributePoints','perkPoints','corrections'])if(corrected[field]!==undefined)after.growth[field]=corrected[field];}
  if(after.growth)E.growth.read(after.growth);
  const loadoutChanged=['inventory','equipment','itemDefinitions','loadout'].some(field=>!same(before?.[field],after[field]));
  if(loadoutChanged){
   for(const [itemId,row]of Object.entries(after.inventory||{})){if(itemId==='$meta')continue;if(!Number.isSafeInteger(row.quantity)||row.quantity<0)throw Error('物品数量需要非负整数：'+itemId);if(row.quantity&&!L.get(after,itemId,row.definitionRef))throw Error('物品定义尚未登记：'+itemId);}
   const slots=Object.entries(after.equipment||{}).filter(([,row])=>row?.itemId),visible=L.list(after);if(visible.length!==slots.length)throw Error('装备数量、实物编号或持有记录不匹配。');
   for(const [slot,row]of slots){const d=L.get(after,row.itemId,row.definitionRef),matches=d?.category==='weapon'?/^weapon_[123]$/.test(slot):d?.category==='clothing'?slot==='wear_'+d.part:d?.category==='cyberware'&&new RegExp('^cyber_'+d.part+'_[1-9]\\d*$').test(slot);if(!matches)throw Error('装备与部位不匹配：'+slot);}
  }
  if(after.numeric){E.checkNumeric(after.numeric);if(after.growth){const max=E.maximums(after.growth.perks,undefined,L.effects(after),after.growth);for(const [field,limit]of Object.entries(max))after.numeric.vitals[field]=Math.min(after.numeric.vitals[field],limit);}}
  if(after.sanity&&(!Number.isFinite(after.sanity.value)||after.sanity.value<0||after.sanity.value>100))throw Error('SAN 应在 0—100 之间。');
 }
 function plan(stat,request,options={}){
  const Schema=schemaModule(),z=(local?require('../数据/validator.js'):root.Cxx236Zod).z;
  if(!stat?.terminal)throw Error('当前故事状态尚未就绪。');if(typeof request.id!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(request.id))throw Error('变量编辑编号无效。');if(!Array.isArray(request.changes)||!request.changes.length)throw Error('请先修改需要调整的变量。');
  const prior=stat.terminal.variableEdits?.[request.id],requestHash=key(request);if(prior){if(prior.requestHash!==requestHash)throw Error('编辑编号已用于其他内容，请重新预览。');return copy(stat);}
  if(options.actorBinding)actors().assertBinding(stat,options.actorBinding);if(request.actorBinding&&!same(request.actorBinding,options.actorBinding)||request.actorId&&options.actorBinding&&request.actorId!==options.actorBinding.actorId)throw Error('当前人物已变化，请重新打开变量修改器。');
  const original=editable(stat);let next=copy(stat);const undone=request.undoOf?stat.terminal.variableEdits?.[request.undoOf]:null;
  if(request.undoOf&&(!undone||undone.undoneBy))throw Error('这次修改已经撤回或当前路线没有该记录。');
  if(undone&&!same(request.changes,undo(stat,request.undoOf)))throw Error('撤回内容与原修改记录不一致。');
  for(const change of request.changes){const path=Schema.pathOf(change.path);if(protectedPath(path))throw Error('该字段由保存系统维护：'+change.path);if(path[0]==='terminal'&&path[1]==='ensemble'&&path[2]==='actors'&&path.length===4)throw Error('人物登记与移除请使用人物页。');const old=get(original,path);if((old===undefined)!==change.beforeMissing||!same(old,change.before))throw Error('变量已有后续变化，请重新读取：'+change.path);const equipmentSlot=path.at(-2)==='equipment'&&path.includes('gameplay');if(!same(get(stat,path),old)&&!equipmentSlot&&!undone||!same(editable(change.after,path),change.after))throw Error('请展开并修改游戏字段，保留其保存记录：'+change.path);if(!change.afterMissing&&change.after===undefined)throw Error('变量目标值缺失：'+change.path);if(typeof change.after==='number'&&!Number.isFinite(change.after))throw Error('数值需要为有限数字：'+change.path);set(next,path,change.after,change.afterMissing);}
  const schema=Schema.build(z);next=schema.parse(schema.stat,next,'游戏变量');
  const changedActors=[];for(const row of gameEntries(stat)){if(!same(get(stat,row.wallet),get(next,row.wallet)))set(next,row.wallet,schema.parse(schema.wallet,get(next,row.wallet),'钱包'),false);const old=get(stat,row.path);let game=get(next,row.path);if(same(old,game))continue;if(old?.numeric?.combat?.active||old?.tactical?.encounter?.active)throw Error('请先结束当前人物的交锋，再修改其状态。');game=schema.parse(schema.gameplay,game,'人物变量');set(next,row.path,game,false);game=get(next,row.path);validateGame(old,game,request.id);changedActors.push(row.id);}
  const beforeEffects=copy(next);
  if(undone){for(const effect of undone.effects||[]){const path=Schema.pathOf(effect.path);if(!protectedPath(path))continue;if((get(stat,path)===undefined)!==effect.afterMissing||!same(get(stat,path),effect.after))throw Error('关联记录已有后续变化，当前修改保留：'+effect.path);if(effect.beforeMissing&&get(next,path.slice(0,-1))==null)continue;set(next,path,effect.before,effect.beforeMissing);}}
  else for(const actorId of changedActors){const row=gameEntries(stat).find(row=>row.id===actorId),game=get(next,row.path),previous=get(stat,row.path);for(const [slot,value]of Object.entries(game.equipment||{}))if(value&&!same(value,previous.equipment?.[slot]))value.source={kind:'variable-edit',id:request.id};roster().program(stat,next,actorId,request);}
  const changes=differences(editable(stat),editable(next));if(!changes.length)throw Error('当前修改与保存状态一致。');
  const effects=new Map(differences(beforeEffects,next).map(change=>[change.path,change]));for(const row of gameEntries(stat)){const old=get(stat,row.path)?.equipment||{},saved=get(next,row.path)?.equipment||{};for(const slot of new Set([...Object.keys(old),...Object.keys(saved)])){const a=old[slot]?.source,b=saved[slot]?.source;if(!same(a,b)){const path=pointer([...row.path,'equipment',slot,'source']);effects.set(path,{path,beforeMissing:a===undefined,afterMissing:b===undefined,...(a===undefined?{}:{before:copy(a)}),...(b===undefined?{}:{after:copy(b)})});}}}
  next.terminal.variableEdits={...next.terminal.variableEdits,[request.id]:{requestHash,changes,effects:[...effects.values()],actorId:request.actorId||options.actorBinding?.actorId||'player',at:request.at||'',...(request.undoOf?{undoOf:request.undoOf}:{})}};if(undone)next.terminal.variableEdits[request.undoOf]={...undone,undoneBy:request.id};return next;
 }
 function undo(stat,id){const saved=stat.terminal?.variableEdits?.[id];if(!saved||saved.undoneBy)throw Error('这次修改已经撤回或当前路线没有该记录。');return saved.changes.map(change=>({path:change.path,beforeMissing:change.afterMissing,afterMissing:change.beforeMissing,...(change.afterMissing?{}:{before:copy(change.after)}),...(change.beforeMissing?{}:{after:copy(change.before)})}));}
 return {editable,differences,plan,undo,key,gameEntries,get,pointer};
});
