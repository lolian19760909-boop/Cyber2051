(function(root,factory){const local=typeof module==='object'&&module.exports;const value=factory(local?require('../src/engine.js'):root.CxxNumericEngine);if(local)module.exports=value;else root.CxxNumericMvu=value;})(globalThis,function(engine){
  'use strict';
 const cloneAPI=()=>{const local=typeof module==='object'&&module.exports?require('../../共享/data-clone.js'):null;const api=local||globalThis.CxxDataClone;if(api&&typeof api.clone==='function')return api;if(typeof structuredClone==='function')return {clone:value=>structuredClone(value)};return {clone:value=>JSON.parse(JSON.stringify(value))};};const clone=value=>cloneAPI().clone(value);
  const inputPath='/terminal/gameplay/numericInput';
  const get=(value,parts)=>parts.reduce((v,k)=>v?.[k],value);
  const path=parts=>'/'+parts.map(k=>k.replace(/~/g,'~0').replace(/\//g,'~1')).join('/');
  const parts=value=>{if(typeof value!=='string'||!value.startsWith('/'))throw Error('需要JSONPointer路径');const result=value.slice(1).split('/').map(k=>k.replace(/~1/g,'/').replace(/~0/g,'~'));if(result.some(k=>!k||['__proto__','prototype','constructor'].includes(k)))throw Error('路径不可用');return result;};
  function isOwned(value){const p=parts(value);return p[0]==='terminal'&&p[1]==='gameplay'&&['growth','numeric','numericInput','inventory','equipment','itemDefinitions','itemReceipts','loadout','tactical'].includes(p[2]);}
  function prepare(stat,patches,options={}){
    if(!Array.isArray(patches))throw Error('MVU更新需要补丁数组');
    const inputs=patches.filter(p=>p.path===inputPath);if(inputs.length>1)throw Error('一次保存只使用一份数值事件数组');
    const ordinary=patches.filter(p=>p.path!==inputPath);
    for(const p of ordinary){parts(p.path);if(isOwned(p.path))throw Error('成长和战况由数值模块计算；配点使用已确认行动接口');}
    if(!inputs.length)return {patches:clone(ordinary),changes:[],applied:[],duplicates:[]};
    if(!['add','replace'].includes(inputs[0].op)||!Array.isArray(inputs[0].value))throw Error('numericInput只接受事件数组');
    if(!stat?.terminal?.gameplay)throw Error('先建立已确认的成长起点');
    // Do not combine a computed child update with an unrelated parent replacement.
    for(const p of ordinary)if(['/terminal','/terminal/gameplay'].includes(p.path))throw Error('数值事件不能与整层替换同时保存');
    const game=stat.terminal.gameplay,events=inputs[0].value,gains=events.filter(e=>e.kind==='item-gain'),wallet=ordinary.filter(p=>p.path==='/terminal/wallet'||p.path.startsWith('/terminal/wallet/'));
    if(gains.length&&wallet.length){const before=stat.terminal.wallet||{},next=clone(before);for(const p of wallet){const key=p.path.split('/')[3];if(!['yen','earned','spent'].includes(key)||p.path!==('/terminal/wallet/'+key)||!['add','replace'].includes(p.op)||!Number.isSafeInteger(p.value)||p.value<0)throw Error('购买须同时提供余额、收入和支出的有效局部更新。');next[key]=p.value;}if(['yen','earned','spent'].some(k=>!Number.isSafeInteger(before[k])||!Number.isSafeInteger(next[k]))||next.yen-before.yen!==(next.earned-before.earned)-(next.spent-before.spent))throw Error('购买扣款与钱包收支不一致，物品和扣款均未入账。');}
    const seenBatch=options.factBatch&&game.loadout?.factBatches?.[options.factBatch],issues=seenBatch?[]:engine.loadout.qualityIssues(game,events);
    if(issues.length){const id='pending_'+engine.loadout.hash(JSON.stringify([options.source||options.factBatch,inputs[0].value]));const before=game.loadout,after={...clone(before||{}),pendingTransactions:{...clone(before?.pendingTransactions||{}),[id]:{id,events:clone(inputs[0].value),issues,wallet:clone(wallet),walletBefore:clone(stat.terminal.wallet||{}),source:clone(options.source||null),factBatch:options.factBatch||null}}};const change={path:['terminal','gameplay','loadout'],missing:before===undefined,before:before===undefined?null:clone(before),after};return {patches:[...clone(ordinary.filter(p=>!wallet.includes(p))),{op:change.missing?'add':'replace',path:'/terminal/gameplay/loadout',value:after}],changes:[change],applied:[],duplicates:[],pending:id,withheld:wallet};}
    const result=engine.settle(game,inputs[0].value,options);
    const duplicateGains=gains.filter(e=>result.duplicates.includes(e.id));if(wallet.length&&duplicateGains.length&&duplicateGains.length!==gains.length)throw Error('同次购买混有已结算与新物品，请核对购买记录后重新处理。');
    const withheld=wallet.length&&gains.length&&duplicateGains.length===gains.length?wallet:[];
    return {withheld,patches:[...clone(ordinary.filter(p=>!withheld.includes(p))),...result.changes.map(c=>({op:c.missing?'add':'replace',path:path(c.path),value:clone(c.after)}))],changes:result.changes,applied:result.applied,duplicates:result.duplicates,...(options.context?{context:clone(options.context)}:{})};
  }
  function checkPrepared(transaction,before,after,context){
    if(transaction.context&&!engine.same(transaction.context,context))throw Error('聊天或回复分支已变化，旧结果不能写入当前分支');
    for(const c of transaction.changes){if(!engine.same(get(before,c.path),c.missing?undefined:c.before))throw Error('数值起点已变化，需要重新准备本次保存');if(!engine.same(get(after,c.path),c.after))throw Error('本次数值尚未完整保存');}
    if(get(after,['terminal','gameplay','numericInput'])!==undefined)throw Error('numericInput是临时输入，不能作为存档状态保留');
    return true;
  }
  function allocation(stat,build){const old=stat?.terminal?.gameplay?.growth,next=engine.growth.allocate(old,build);return {action:'talent-allocate',changes:[{path:['terminal','gameplay','growth'],missing:false,before:clone(old),after:next}]};}
  function verifyAction(ticket,saved,context){
    if(ticket.context&&(!context||Object.keys(ticket.context).some(k=>!engine.same(ticket.context[k],context[k]))))return {status:'unconfirmed',reason:'当前聊天或分支与行动不匹配'};
    const result=saved?.terminal?.gameplay?.results?.[ticket.id];
    if(!result||result.requestHash!==ticket.requestHash||!['success','refused'].includes(result.status))return {status:'unconfirmed',reason:'尚无匹配的行动结果'};
    for(const change of ticket.plan.changes){
      let target=change.path,value=result.status==='success'?change.after:change.missing?undefined:change.before;
      if(target.join('.')==='terminal.gameplay'&&['growth-initialize','talent-allocate'].includes(ticket.plan.request?.action||ticket.plan.action)){target=[...target,'growth'];value=value?.growth;}
      if(!engine.same(get(saved,target),value))return {status:'unconfirmed',reason:'本次相关字段与确认结果不一致'};
    }
    return {status:result.status,reason:result.reason||''};
  }
  function protocol(state={},options={}){const selected=new Set(['human','machine','armored','moving','close','ranged','cover','stealth','gun','blade','blunt','cyberdeck','cyberware']);for(const e of engine.learned(state.growth?.perks)){for(const token of (e.when||'').split(/[&|]/)){const key=token.replace(/^enemy:/,'');if(engine.talents.labels[key])selected.add(key);}}const dictionary=Object.fromEntries([...selected].map(k=>[k,engine.talents.labels[k]]));const vocabulary=Object.keys(dictionary).map(key=>key+"="+dictionary[key]).join("；");return [
    '【轻量数值事件】按当前变量解析方式提交已经发生的成果与变化。逐击战斗由程序结算。',
    '使用JSONPatch add /terminal/gameplay/numericInput，value为本轮已发生事件数组。此路径是临时输入，由适配器转换为真正保存的growth/numeric补丁。不得自行计算或写入经验总数、等级、剩余点数、战力、胜率和资源余量。',
    '每个事件带稳定id。同一事实的续写、保存重试沿用id；重写从被替换回复之前的当前分支状态开始。同id不改内容。',
    '成长成果：{id,kind:"achievement",source:{kind:"story|training|activity|quest",id:稳定成果编号},category:"small|stage|gig|major",completed:true,reason:"本轮正文中实际完成的成果依据"}。small为破解、修理、有效线索、交涉、战斗成果、训练或音乐活动等小事；stage为独立阶段目标；gig为小委托交付；major为大型委托或关键剧情完成。程序按35%/65%/100%/200%的当前升级需求计算经验。正文不必写经验数字。',
    '同一事实只用一个档位，续写、回顾、意图和普通无成果对话不重复结算。来源编号保留，不能换id重复领奖；一轮不同成果分别提交，委托中独立行动与最终交付可分别提交。',
    '明确的作者奖励才使用：{id,kind:"reward",source:{kind:"story|training|activity|quest",id:稳定成果编号},xp:明确经验,attributePoints:直接属性点,perkPoints:直接专长点}。同一来源与achievement二选一，明确奖励优先；不要自行编造奖励数字。',
    '资源：{id,kind:"resource",target:"player或参战者id",resource:"hp|stamina|ram",amount:本次有符号变化,reason:正文依据}。损失为负，恢复为正；脚本限于0和实际资源上限，生命归零仅表示失能。',
    '战斗只能由玩家面板确认开启、暂停和结束。不得提交encounter事件。未暂停战斗的本轮伤害、恢复及资源消耗已经由程序确定，禁止重复提交resource事件；只登记非资源剧情结果和明确奖励。战斗已暂停时，后续普通叙事中明确发生的非交锋伤势、治疗和资源变化可正常登记；不能重复登记已结算那一层的交锋变化。',
    '配点由玩家界面本地保存，此事件入口不替玩家花点。物品与义体按附加事实协议处理；按正文实际先后排列事件，装备变化后的资源事件才使用新装配。',
      '本局相关条件标签（只列已学天赋与当前战斗会用到的那部分，照此拼写；未列出的一律不要编造）：'+vocabulary+'。'
].join('\n');}
  return {inputPath,prepare,checkPrepared,allocation,verifyAction,protocol};
});
