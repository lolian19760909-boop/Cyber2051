'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({page,select,diskRows,report,out}){
 report.patchTurns=[];
 for(const [index,amount,kind]of [[1,125,'mixed'],[2,137,'achievement'],[3,137,'syntax'],[4,149,'normal']]){
  const result=await page.evaluate(async({index,amount,kind})=>{
   const c=SillyTavern.getContext(),before=Cxx236State.stat(),patches=[{op:'replace',path:'/terminal/wallet/yen',value:amount,comment:'模型附带记账说明'},{op:'replace',path:'/terminal/wallet/earned',value:amount}];
   if(kind==='mixed')patches.unshift(null,{op:'remove',path:'/terminal/wallet/spent'},{op:'add',path:'/__proto__/polluted',value:true},{op:'replace',path:'/terminal/wallet/spent',value:'不可读'});
   if(kind==='achievement')patches.unshift({op:'add',path:'/terminal/gameplay/numericInput',value:[{id:'bad_reward',kind:'achievement',source:'story',category:'minor',completed:true,reason:'该字段无法读取'}]});
   const raw='<cxx-story>你与店员核对第'+index+'张收据，然后继续向街角走去。</cxx-story><UpdateVariable>'+(kind==='syntax'?'[{"op":':JSON.stringify(patches))+'</UpdateVariable>';
   await TavernHelper.createChatMessages([{name:c.name1,role:'user',message:'混合字段验收 '+index,data:{stat_data:structuredClone(before)},extra:{}},{name:c.name2,role:'assistant',message:raw,data:{stat_data:structuredClone(before)},extra:{}}],{refresh:'affected'});
   const floor=c.chat.length-1,r=await Cxx236VariableGuard.settle(floor),state=c.chat[floor].variables?.[c.chat[floor].swipe_id||0]?.stat_data;
   return {floor,raw,ok:r.ok,status:r.status,reason:r.reason,ignored:r.transaction?.ignored?.length||0,wallet:state?.terminal?.wallet,xp:state?.terminal?.gameplay?.growth?.xp,polluted:{}.polluted};
  },{index,amount,kind});
  if(kind==='syntax'){assert.equal(result.ok,false);assert.equal(result.status,'rejected');}
  else {assert(result.ok,result.reason);if(kind!=='normal'&&result.status!=='duplicate')assert(result.ignored>0);}
  assert.equal(result.wallet.yen,amount);assert.equal(result.wallet.spent,0);assert.equal(result.polluted,undefined);assert.equal(result.xp,0);
  const saved=(await diskRows())[result.floor+1];assert.equal(saved.mes,result.raw);assert.equal(saved.variables[saved.swipe_id||0].stat_data.terminal.wallet.yen,amount);assert.equal(saved.variables_initialized[saved.swipe_id||0],true);
  await select(page);await page.evaluate(()=>{document.querySelector('.cxx-announcement button')?.click();__cxx_launcher__?.close();});
  const restored=await page.evaluate(floor=>({wallet:Cxx236State.stat().terminal.wallet,phase:Cxx236VariableGuard.state({floor}).receipt?.phase}),result.floor);assert.equal(restored.wallet.yen,amount);assert.equal(restored.wallet.spent,0);assert.equal(restored.phase,kind==='syntax'?'rejected':'saved');
  if(kind==='syntax'){const replay=await page.evaluate(floor=>Cxx236VariableGuard.settle(floor),result.floor);assert.equal(replay.status,'rejected');assert.equal(replay.persisted,true);}
  if(kind!=='syntax'){const replay=await page.evaluate(floor=>Cxx236VariableGuard.settle(floor),result.floor);assert.equal(replay.status,'duplicate');}
  await page.locator('.mes[mesid="'+result.floor+'"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'model-patch-turn-'+index+'.png')});report.patchTurns.push({index,amount,kind,status:result.status,ignored:result.ignored,diskReadback:true,rawPreserved:true,reloaded:true});
 }
 report.checks.push('mixed invalid entries retain valid wallet through actual native save and reload','unreadable achievement leaves XP unchanged and saves the independent wallet','malformed JSON retains prior state and raw; following turn saves normally','native saved turns replay once');
};
