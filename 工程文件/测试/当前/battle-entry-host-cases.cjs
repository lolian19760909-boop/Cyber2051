'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({page,select,diskRows,report,out})=>{
 await page.evaluate(()=>{document.querySelector('.cxx-announcement button')?.click();__cxx_launcher__.close();Cxx233Terminal?.close();__cxx_gal_g1__.open();});
 const gal=page.locator('#cxx-galgame-root');await gal.waitFor({state:'visible'});
 const skip=page.getByRole('button',{name:/^先进入阅读$/});if(await skip.isVisible())await skip.click();
 const before=await page.evaluate(()=>Cxx236VariableGuard.localState());
 for(const mode of ['fast','text','tactical']){
  await page.evaluate(async mode=>{await Cxx236Preferences.save({...Cxx236Preferences.read(),gal:true,battleMode:mode});},mode);
  await gal.getByRole('button',{name:'战斗',exact:true}).click();
  const battle=page.locator('.cxx-battle-dialog[open]');await battle.waitFor();await page.waitForTimeout(450);await page.screenshot({path:path.join(out,'battle-'+mode+'.png')});
  if(mode==='tactical'){await battle.getByRole('button',{name:'故事存档',exact:true}).waitFor();await battle.getByRole('button',{name:'故事存档',exact:true}).click();await battle.waitFor({state:'detached'});const archive=page.getByRole('dialog',{name:'故事与存档',exact:true});await archive.waitFor();await page.screenshot({path:path.join(out,'battle-to-stories.png')});await page.keyboard.press('Escape');await archive.waitFor({state:'detached'});}
  else{assert.match(await battle.innerText(),/这一战还没有结算记录/);await battle.getByRole('button',{name:'收起 ×',exact:true}).click();await battle.waitFor({state:'detached'});}
  assert.deepEqual(await page.evaluate(()=>Cxx236VariableGuard.localState()),before);report.checks.push('native '+mode+' manual battle entry is visible, closes, and retains game state');
  if(mode==='fast'){await page.setViewportSize({width:390,height:844});await gal.getByRole('button',{name:'战斗',exact:true}).click();await battle.waitFor();await page.screenshot({path:path.join(out,'battle-mobile.png')});await battle.getByRole('button',{name:'收起 ×',exact:true}).click();await battle.waitFor({state:'detached'});await page.setViewportSize({width:1280,height:900});report.checks.push('native mobile battle toolbar button opens and closes report');}
 }
 const saved=await diskRows();await select(page);assert.deepEqual(await diskRows(),saved);assert.equal(await page.evaluate(()=>Cxx236Preferences.read().battleMode),'tactical');assert.deepEqual(await page.evaluate(()=>Cxx236VariableGuard.localState()),before);report.checks.push('native battle mode survives reload with saved state retained');
};
