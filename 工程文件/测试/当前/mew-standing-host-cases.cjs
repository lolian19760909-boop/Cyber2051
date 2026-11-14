'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const names=['仲町阿拉蕾','宫永野乃花','峰月律','藤都子','千石由乃'],ids=['Arale','Nonoka','Ritsu','Miyako','Yuno'],faces=require('../../卡片源码/正文/dialogue.js').expressions,media=require('../../卡片源码/Gal/standing-media.json').files;
module.exports=async({page,select,report,out})=>{
 const checks=names.flatMap((name,i)=>faces.map(expression=>({name,id:ids[i],expression,url:media.find(a=>a.characterId===ids[i]&&a.expressionId===expression)?.remoteUrl})));
 assert.equal(checks.length,45);assert(checks.every(c=>c.url));
 await page.evaluate(async({checks,names})=>{await Cxx233Updater.host.withChatSave(Cxx233Updater.host.getContext(),async()=>{});document.querySelector('.cxx-announcement button')?.click();__cxx_launcher__.close();Cxx233Terminal?.close();const state=Cxx236VariableGuard.localState(),c=SillyTavern.getContext();const story='<cxx-story>'+checks.map(x=>'<cxx-say speaker="'+x.name+'" expression="'+x.expression+'">'+x.name+' '+x.expression+' 立绘接入验收。</cxx-say>').join('')+'</cxx-story><ztl>'+JSON.stringify({date:'2051-11-14',time:'12:00',location:'RING-Live!',characters:names.map(name=>({name,outfit:'日常服装',thought:'在场。'}))})+'</ztl>';await TavernHelper.createChatMessages([{role:'user',name:c.name1,message:'核对梦限大五人全部差分',data:{stat_data:structuredClone(state)},extra:{}},{role:'assistant',name:c.name2,message:story,data:{stat_data:structuredClone(state)},extra:{}}],{refresh:'affected'});const settled=await Cxx236VariableGuard.settle(c.chat.length-1);if(!settled.ok&&!settled.floorSaved)throw Error(settled.reason||'测试正文未保存');__cxx_gal_g1__.open();},{checks,names});
 await page.locator('.cxx-boot:visible').waitFor({state:'hidden',timeout:120000});
 report.mew=[];
 for(let i=0;i<checks.length;i++){
  const current=checks[i];await page.waitForFunction(({name,url})=>[...document.querySelectorAll('.cxx-gal-sprite')].some(img=>img.alt===name+'立绘'&&img.getAttribute('data-requested-src')===url&&img.naturalWidth>0),current,{timeout:30000});
  report.mew.push({name:current.name,expression:current.expression,decoded:true});if(i%9===0){await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});await page.screenshot({path:path.join(out,'mew-'+current.id+'-normal.png')});}if(i+1<checks.length)await page.getByRole('button',{name:'下一句',exact:true}).click();
 }
 report.checks.push('five restored characters and all 45 authored expressions decode in the actual native Gal');
 await select(page);const restored=await page.evaluate(()=>{const c=SillyTavern.getContext(),s=Cxx236VariableGuard.localState();return {story:c.chat.at(-1)?.mes,actors:[90,102,103,104,105].map(uid=>({uid,name:s?.terminal?.ensemble?.actors?.['wb_'+uid]?.name}))};});assert(names.every(n=>restored.story.includes(n)));assert(restored.actors.every(a=>names.includes(a.name)));report.mewRestored=restored.actors;report.checks.push('reload preserves the five restored actors and their saved source dialogue');
};
