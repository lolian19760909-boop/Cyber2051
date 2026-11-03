'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({page,select,diskRows,report,out}){
 const failed=await page.evaluate(async()=>{
  const c=SillyTavern.getContext(),before=structuredClone(Cxx236State.stat()),seed=Cxx233Updater.readSeed(),old=before.terminal.gameplay.location;
  const destination=Object.entries(seed.mapIndex).flatMap(([mapId,ids])=>ids.map(placeId=>({mapId,placeId}))).find(at=>at.mapId!==old.mapId||at.placeId!==old.placeId);
  if(!destination)throw Error('验收需要一个不同的已登记地点');
  const amount=before.terminal.wallet.yen+25,raw='<cxx-story>你核对收据，然后沿街走到下一个地点。</cxx-story><UpdateVariable>'+JSON.stringify([{op:'replace',path:'/terminal/wallet/yen',value:amount},{op:'replace',path:'/terminal/gameplay/location',value:destination}])+'</UpdateVariable>';
  const readSeed=Cxx233Updater.readSeed,apply=CxxDataWrite.apply;
  window.__policyReadProbe={before,destination,amount,raw,writes:0,restore(){Cxx233Updater.readSeed=readSeed;CxxDataWrite.apply=apply;}};
  Cxx233Updater.readSeed=()=>{throw Error('策略读取中断验收');};CxxDataWrite.apply=function(...args){__policyReadProbe.writes++;return apply.apply(this,args);};
  await TavernHelper.createChatMessages([{role:'user',message:'策略读取恢复验收',data:{stat_data:structuredClone(before)},extra:{}},{role:'assistant',message:raw,data:{stat_data:structuredClone(before)},extra:{}}],{refresh:'affected'});
  const floor=c.chat.length-1,first=await Cxx236VariableGuard.settle(floor),second=await Cxx236VariableGuard.settle(floor),row=c.chat[floor];__policyReadProbe.floor=floor;
  return {floor,first:{ok:first.ok,status:first.status,reason:first.reason,ignored:first.transaction?.ignored},second:{ok:second.ok,status:second.status},writes:__policyReadProbe.writes,parentKept:JSON.stringify(row.variables[0].stat_data)===JSON.stringify(before),raw:row.mes,marker:row.variables[0].__cxx_native_commit};
 });
 report.policyReadFailed=failed;
 assert.equal(failed.first.ok,false,JSON.stringify(failed));assert.equal(failed.first.status,'failed');assert.match(failed.first.reason,/策略读取中断验收/);assert.equal(failed.second.status,'failed');assert.equal(failed.writes,0);assert.equal(failed.parentKept,true);assert.equal(failed.marker,undefined);
 let disk=(await diskRows())[failed.floor+1];assert.equal(disk.mes,failed.raw);const before=await page.evaluate(()=>__policyReadProbe.before);assert.deepEqual(disk.variables[0].stat_data,before);
 await page.evaluate(()=>{document.querySelector('.cxx-announcement button')?.click();__cxx_launcher__?.close();});await page.locator('.mes[mesid="'+failed.floor+'"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'policy-read-01-failed.png')});
 const recovered=await page.evaluate(async()=>{const p=__policyReadProbe;p.restore();const result=await Cxx236VariableGuard.settle(p.floor),row=SillyTavern.getContext().chat[p.floor];return {ok:result.ok,status:result.status,reason:result.reason,stat:structuredClone(row.variables[0].stat_data),destination:p.destination,amount:p.amount};});report.policyReadRecovered=recovered;
 assert.equal(recovered.ok,true,recovered.reason);assert.equal(recovered.stat.terminal.wallet.yen,recovered.amount);assert.deepEqual(recovered.stat.terminal.gameplay.location,recovered.destination);assert.deepEqual((await diskRows())[failed.floor+1].variables[0].stat_data,recovered.stat);
 assert.equal((await page.evaluate(floor=>Cxx236VariableGuard.settle(floor),failed.floor)).status,'duplicate');
 await select(page);assert.deepEqual(await page.evaluate(()=>structuredClone(Cxx236State.stat())),recovered.stat);assert.equal((await page.evaluate(floor=>Cxx236VariableGuard.settle(floor),failed.floor)).status,'duplicate');
 await page.evaluate(()=>{document.querySelector('.cxx-announcement button')?.click();__cxx_launcher__?.close();});await page.locator('.mes[mesid="'+failed.floor+'"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'policy-read-02-recovered.png')});
 const next=await page.evaluate(async()=>{const c=SillyTavern.getContext(),before=Cxx236State.stat(),raw='<cxx-story>你继续向前走。</cxx-story><UpdateVariable>'+JSON.stringify([{op:'replace',path:'/terminal/wallet/yen',value:before.terminal.wallet.yen+7}])+'</UpdateVariable>';await TavernHelper.createChatMessages([{role:'user',message:'继续游玩',data:{stat_data:structuredClone(before)},extra:{}},{role:'assistant',message:raw,data:{stat_data:structuredClone(before)},extra:{}}],{refresh:'affected'});const floor=c.chat.length-1,result=await Cxx236VariableGuard.settle(floor);return {floor,ok:result.ok,reason:result.reason,stat:structuredClone(c.chat[floor].variables[0].stat_data)};});
 assert.equal(next.ok,true,next.reason);assert.equal(next.stat.terminal.wallet.yen,recovered.amount+7);assert.deepEqual(next.stat.terminal.gameplay.location,recovered.destination);assert.deepEqual((await diskRows())[next.floor+1].variables[0].stat_data,next.stat);await select(page);assert.deepEqual(await page.evaluate(()=>structuredClone(Cxx236State.stat())),next.stat);
 await page.evaluate(()=>{document.querySelector('.cxx-announcement button')?.click();__cxx_launcher__?.close();});await page.locator('.mes[mesid="'+next.floor+'"]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'policy-read-03-next.png')});
 report.checks.push('policy read failure retains raw and full parent on disk with zero data commits','same floor recovers wallet and registered location, saves and reloads once','next native turn saves and reloads with the recovered location');
};
