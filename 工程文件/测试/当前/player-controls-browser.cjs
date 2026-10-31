'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../../独立制卡器/workbench/node_modules/playwright'),T=require('../../工具/lib/terminal-preview.cjs');
const eng=path.resolve(__dirname,'../..'),bytes=fs.readFileSync(process.env.CXX_TEST_CARD||path.join(eng,'.cache/build/赛博小祥2051-V2.3.0.json')),card=JSON.parse(bytes),out=process.env.CXX_EVIDENCE||path.join(eng,'.cache/player-controls230');
const pack=require('../../工具/lib/offline-resources.cjs')(eng),uris=new Map();
for(const e of pack.manifest.entries){const b=pack.entries.get(e.file);if(b)uris.set(e.id,()=>`data:${e.mime};base64,${b.toString('base64')}`);}
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/data:image\/svg\+xml,%3Csvg%20xmlns=%22http:\/\/www.w3.org\/2000\/svg%22\/%3E#cxxasset-([a-f0-9]{64})/g,(v,id)=>uris.get(id)?.()||v);
const report={cardSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Packaged UI and numeric modules; controlled model/save callbacks and synthetic host data only',screens:[],checks:[],errors:[]};
const server=http.createServer((q,r)=>r.end('<!doctype html>'));
async function shot(page,id,width,selector){
 await page.evaluate(async()=>{await document.fonts.ready;for(const a of document.getAnimations())if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();});
 const m=await page.locator(selector).evaluate(root=>({font:getComputedStyle(root).fontSize,overflow:document.documentElement.scrollWidth>innerWidth+2,localOverflow:root.scrollWidth>root.clientWidth+2,buttons:[...root.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().width>0).map(n=>({name:n.textContent.slice(0,30),height:n.getBoundingClientRect().height})),inputs:[...root.querySelectorAll('input,select,textarea')].filter(n=>n.type!=='checkbox'&&n.getBoundingClientRect().width>0).map(n=>({name:n.getAttribute('aria-label')||n.type,size:getComputedStyle(n).fontSize})),color:getComputedStyle(root).color}));
 await page.screenshot({path:path.join(out,`${id}-${width}.png`)});report.screens.push({id,width,...m});
 assert(!m.overflow&&!m.localOverflow,`${id} ${width} horizontal overflow`);assert(m.buttons.every(b=>b.height>=43.5),`${id} ${width} touch target: ${JSON.stringify(m.buttons.filter(b=>b.height<43.5))}`);
 assert(m.inputs.every(n=>parseFloat(n.size)>=16),`${id} ${width} input size: ${JSON.stringify(m.inputs)}`);
}
async function editor(page,width){
 await page.evaluate(()=>{fixture.innerHTML='';window.savedItems=[];window.__cxx_utility__={request:()=>new Promise(resolve=>window.resolveItem=resolve),cancel(){}};window.editor=CxxItemEditor.mount({document,parent:fixture,onConfirm:async row=>savedItems.push(row)});});
 await shot(page,'item-editor',width,'.cxx-item-editor');
 await page.getByLabel('名称',{exact:true}).fill('夜视义眼');await page.getByRole('button',{name:'解析为数值',exact:true}).click();
 assert(await page.getByRole('button',{name:'解析为数值',exact:true}).isDisabled());
 await page.getByLabel('名称',{exact:true}).fill('修改后的夜视义眼');
 await page.evaluate(()=>resolveItem({name:'旧响应',description:'旧描述',category:'cyberware',part:'frontal',tier:5,tags:[],numericEffects:[]}));
 await page.getByText('解析期间草稿已修改，旧结果已弃用，请按当前描述重新解析。',{exact:true}).waitFor();assert.equal(await page.getByLabel('名称',{exact:true}).inputValue(),'修改后的夜视义眼');
 await page.getByRole('button',{name:'解析为数值',exact:true}).click();
 await page.evaluate(()=>resolveItem({name:'夜视义眼',description:'保留玩家设定的夜间辨识能力。'.repeat(12),category:'cyberware',part:'frontal',tier:5,tags:[],numericEffects:[{kind:'ability',text:'夜视',when:'manual'}]}));
 await page.getByText('解析完成，查看装备预览后即可保存。',{exact:true}).waitFor();
 await page.locator('.item-readable-preview').scrollIntoViewIfNeeded();await shot(page,'item-preview',width,'.cxx-item-editor');
 await page.getByRole('button',{name:'保存这件物品',exact:true}).click();assert.deepEqual(await page.evaluate(()=>savedItems.map(x=>[x.name,x.tier,x.numericEffects[0].text])),[['夜视义眼',5,'夜视']]);
 report.checks.push({width,path:'item parse / stale draft / readable preview / one confirm callback'});await page.evaluate(()=>{editor.destroy();delete window.__cxx_utility__;scrollTo(0,0);});
}
async function battle(page,width){
 await page.evaluate(()=>{
  fixture.innerHTML='';window.fixtureGame=structuredClone(c.chat[1].variables[0].stat_data.terminal.gameplay);window.battleRequests=[];window.rejectSave=true;
  window.__cxx_battle__={state:()=>({stage:'idle'}),recognize:()=>new Promise(resolve=>window.resolveBattle=resolve),cancelRecognition(){},encounter:()=>null};
  window.battleView=CxxBattleUI.mount({document,parent:fixture,read:()=>fixtureGame,scope:'controls-'+innerWidth,commit:async request=>{battleRequests.push(structuredClone(request));if(rejectSave)throw Error('验收夹具：保存失败，草稿保留');fixtureGame=CxxBattle.operation(fixtureGame,request);}});
 });
 await page.getByRole('button',{name:'识别当前战况',exact:true}).click();assert(await page.getByRole('button',{name:'正在识别现场…',exact:true}).isDisabled());await shot(page,'battle-recognizing',width,'.cxx-battle');
 await page.getByRole('button',{name:'取消识别',exact:true}).click();await page.evaluate(()=>resolveBattle({inCombat:false}));
 await page.getByRole('button',{name:'作弊模式',exact:true}).click();await page.getByRole('button',{name:'添加敌方',exact:true}).click();await page.getByLabel('名称',{exact:true}).last().fill('带有较长姓名的现场敌方成员');await shot(page,'battle-draft',width,'.cxx-battle');
 await page.getByRole('button',{name:'确认资料并开始战斗',exact:true}).click();await page.getByText('验收夹具：保存失败，草稿保留',{exact:true}).waitFor();assert.equal(await page.getByLabel('名称',{exact:true}).last().inputValue(),'带有较长姓名的现场敌方成员');await shot(page,'battle-save-error',width,'.cxx-battle');
 await page.evaluate(()=>rejectSave=false);await page.getByRole('button',{name:'确认资料并开始战斗',exact:true}).click();await page.getByText('第 1 轮待生成',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>battleRequests[0].id===battleRequests[1].id),true);
 await page.locator('.cxx-battle').scrollIntoViewIfNeeded();await shot(page,'battle-active',width,'.cxx-battle');
 const colors=await page.locator('.battle-hp i').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));assert.notEqual(colors[0],colors.at(-1));
 await page.getByRole('button',{name:'暂停战斗',exact:true}).click();assert.equal(await page.evaluate(()=>fixtureGame.numeric.combat.paused),true);await page.getByRole('button',{name:'恢复战斗',exact:true}).click();assert.equal(await page.evaluate(()=>fixtureGame.numeric.combat.paused),false);
 report.checks.push({width,path:'recognition busy/cancel / cheat draft / save error retry same ID / active allies-enemies / pause-resume'});await page.evaluate(()=>{battleView.destroy();delete window.__cxx_battle__;scrollTo(0,0);});
}
(async()=>{let browser;fs.mkdirSync(out,{recursive:true});try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of (process.env.CXX_WIDTHS||'1440,1280,768,390,360,844').split(',').map(Number)){
  const height=width===844?390:width===1280?720:width===360?800:width===390?844:900,e=await T.environment(browser,'http://127.0.0.1:'+server.address().port,card,width,height),page=e.page;
  await page.evaluate(()=>{terminal.destroy();for(const id of ['chat','send_textarea'])document.getElementById(id).style.display='none';window.fixture=document.createElement('main');fixture.style.cssText='box-sizing:border-box;max-width:1080px;width:100%;margin:auto;padding:16px';document.body.append(fixture);const style=document.createElement('style');style.textContent=CxxThemeCSS;document.head.append(style);window.view=player.mount(fixture,'物品栏');fixture.style.height='100dvh';});
  await page.locator('.weapons .slot').first().click();await shot(page,'item-detail',width,'.drawer');assert((await page.locator('.drawer>.effect').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fontSize))).every(size=>size==='16px'));
  await page.keyboard.press('Escape');assert.equal(await page.locator('.drawer').count(),0);
  if(width===390){
   await page.locator('.weapons .slot').first().click();await page.getByRole('button',{name:'卸下（待保存）',exact:true}).click();assert.equal(await page.evaluate(()=>metrics.writes),0);await page.getByRole('button',{name:'放弃修改',exact:true}).click();assert.equal(await page.evaluate(()=>metrics.writes),0);report.checks.push({width,path:'equipment drawer / escape / unequip preview / discard without writes'});
  }
  await page.evaluate(()=>{view.destroy();fixture.style.height='auto';window.setupRows=[];window.setup=CxxLoadoutSetup.mount({document,parent:fixture,origin:'custom',initial:{items:[]},onChange:value=>setupRows.push(value)});});
  await page.getByLabel('名称（可改为自己的物品）',{exact:true}).fill('开局测试物品');await page.getByLabel('描述／特殊来历',{exact:true}).fill('此物品只加入开局草稿。');await page.getByRole('button',{name:'加入初始清单',exact:true}).click();assert.equal(await page.evaluate(()=>setupRows.at(-1).items.length),1);await shot(page,'loadout',width,'.loadout-setup');await page.evaluate(()=>{setup.destroy();fixture.innerHTML='';scrollTo(0,0);});
  await editor(page,width);await battle(page,width);
  await page.evaluate(()=>{fixture.innerHTML='';const sentinel=document.createElement('style');sentinel.textContent=':root{--cxx-cyan:#123456}';document.head.append(sentinel);window.surface=CxxBattleSurface.create({api,top:window}).start();surface.open();});await page.locator('.cxx-battle-dialog .cxx-battle').waitFor();await shot(page,'battle-surface',width,'.cxx-battle-dialog');assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cxx-cyan').trim()),'#123456','battle surface theme stays scoped');
  await page.getByRole('button',{name:'返回 ×',exact:true}).click();assert.equal(await page.locator('.cxx-battle-dialog').count(),0);await page.evaluate(()=>surface.destroy());
  if(width===1440){
   await page.evaluate(()=>{document.documentElement.style.zoom='2';fixture.style.height='50dvh';window.zoomView=player.mount(fixture,'人物');});await page.locator('.profile-overview').waitFor();await shot(page,'profile-zoom200',width,'.profile-overview');await page.evaluate(()=>{zoomView.destroy();document.documentElement.style.zoom='';fixture.style.height='auto';});
  }
  assert.deepEqual(await page.evaluate(()=>({writes:metrics.writes,saves:metrics.saves})),{writes:0,saves:0});report.errors.push(...e.errors);await page.evaluate(()=>runtime.destroy());await page.close();
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,screens:report.screens.length,checks:report.checks.length,errors:report.errors,failure:report.failure}));}
})();
