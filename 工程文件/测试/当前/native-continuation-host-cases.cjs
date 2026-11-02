'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({page,select,diskRows,report,out}){
 report.nativeTurns=[];
 const start=await page.evaluate(()=>{const frame=document.querySelector('iframe[id$="--cxx-business-core-241"]').contentWindow,id=frame.CxxRoster.resolve('高松灯'),prepared=frame.CxxRoster.initialize(Cxx236State.stat());return {id,hp:prepared.terminal.ensemble.actors[id].gameplay.numeric.vitals.hp};});let expectedHp=start.hp;
 for(const [index,amount,delta]of [[1,13,-3],[2,29,0],[3,34,-1]]){
  const result=await page.evaluate(async({index,amount,delta,actorId})=>{
   const c=SillyTavern.getContext(),patches=[{op:'replace',path:'/terminal/wallet/yen',value:String(amount)},{op:'replace',path:'/terminal/wallet/earned',value:amount}];if(index===1)patches.push({op:'replace',path:'/terminal/wallet/spent',value:'读不出的金额'});if(delta)patches.push({op:'add',path:'/terminal/rosterInput',value:[{id:'native_hp_'+index,actor:'高松灯',kind:'resource',resource:'hp',amount:String(delta),quote:'用概述记录本轮擦伤'}]});
   const raw='<cxx-story>高松灯和你核对本轮实际收入，金额为'+amount+'。她在途中擦伤，伤势也已记录。</cxx-story><UpdateVariable><JSONPatch>'+JSON.stringify(patches)+'</JSONPatch></UpdateVariable>';
   const before=Cxx236State.stat();await TavernHelper.createChatMessages([{name:c.name1,role:'user',message:'继续原生保存验收 '+index,data:{stat_data:structuredClone(before)},extra:{}},{name:c.name2,role:'assistant',message:raw,data:{stat_data:structuredClone(before)},extra:{}}],{refresh:'affected'});
   const floor=c.chat.length-1,r=await Cxx236VariableGuard.settle(floor),v=c.chat[floor].variables?.[0];return {floor,ok:r.ok,status:r.status,reason:r.reason,ignored:r.transaction?.ignored?.length||0,wallet:v?.stat_data?.terminal?.wallet,hp:v?.stat_data?.terminal?.ensemble?.actors?.[actorId]?.gameplay?.numeric?.vitals?.hp,tablePlayerHp:Cxx236State.vitals('player')?.hp,playerHp:v?.stat_data?.terminal?.gameplay?.numeric?.vitals?.hp};
  },{index,amount,delta,actorId:start.id});
  assert(result.ok,result.reason);assert.equal(result.wallet.yen,amount);assert.equal(result.wallet.spent,0);if(index===1&&result.status!=='duplicate')assert(result.ignored>=1);expectedHp+=delta;assert.equal(result.hp,expectedHp);assert.equal(result.tablePlayerHp,result.playerHp);
  const rows=await diskRows(),saved=rows[result.floor+1].variables[rows[result.floor+1].swipe_id||0].stat_data;assert.equal(saved.terminal.wallet.yen,amount);assert.equal(saved.terminal.ensemble.actors[start.id].gameplay.numeric.vitals.hp,expectedHp);
  const receipt={index,amount,hp:expectedHp,floor:result.floor,tableMatchesPlayer:true,diskReadback:true,reloaded:false};report.nativeTurns.push(receipt);
  await select(page);await page.evaluate(()=>{document.querySelector('.cxx-announcement button')?.click();__cxx_launcher__?.close();});
  const restored=await page.evaluate(({actorId,floor})=>{const s=Cxx236State.stat();return {wallet:s.terminal.wallet,hp:s.terminal.ensemble.actors[actorId].gameplay.numeric.vitals.hp,phase:Cxx236VariableGuard.state({floor}).receipt?.phase};},{actorId:start.id,floor:result.floor});assert.equal(restored.wallet.yen,amount);assert.equal(restored.hp,expectedHp);assert.equal(restored.phase,'saved');
  const replay=await page.evaluate(floor=>Cxx236VariableGuard.settle(floor),result.floor);assert.equal(replay.ok,true,replay.reason);assert.equal(replay.status,'duplicate');
  await page.locator('[data-cxx-variable-floor="'+result.floor+'"] [data-cxx-variable-title]').filter({hasText:'变量已保存并核对'}).first().waitFor();await page.screenshot({path:path.join(out,'native-turn-'+index+'.png')});Object.assign(receipt,{replay:replay.status,reloaded:true,visibleReceipt:'saved'});
 }
 report.checks.push('three native turns retain readable wallet and NPC values through disk readback and reload','same native floor replay preserves the saved amount and HP','player table projection matches current saved vitals');
};
