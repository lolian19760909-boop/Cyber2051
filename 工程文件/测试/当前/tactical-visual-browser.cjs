'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../../独立制卡器/workbench/node_modules/playwright'),P=require('../../工具/lib/terminal-preview.cjs'),F=require('../lib/tactical-fixtures.cjs'),T=require('../../卡片源码/运行时/tactical-engine.js');
const eng=path.resolve(__dirname,'../..'),bytes=fs.readFileSync(process.env.CXX_TEST_CARD||path.join(eng,'.cache/build/赛博小祥2051-V2.3.0.json')),card=JSON.parse(bytes),out=process.env.CXX_EVIDENCE||path.join(eng,'.cache/tactical230'),captureOnly=process.env.CXX_CAPTURE_ONLY==='1';
const pack=require('../../工具/lib/offline-resources.cjs')(eng),uris=new Map();for(const e of pack.manifest.entries){const b=pack.entries.get(e.file);if(b)uris.set(e.id,()=>`data:${e.mime};base64,${b.toString('base64')}`);}
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/data:image\/svg\+xml,%3Csvg%20xmlns=%22http:\/\/www.w3.org\/2000\/svg%22\/%3E#cxxasset-([a-f0-9]{64})/g,(v,id)=>uris.get(id)?.()||v);
let base=F.equip(F.game(),'pistol',1,'weapon_1');base=F.equip(base,'cyberdeck',1,'cyber_os_1');
const initial=structuredClone(base);base=T.operation(base,{action:'tactical-initialize',id:'initial',expected:T.stamp(base),supplies:{light:100,med:2,frag:2},programs:Object.keys(T.rules.programs),devices:{drone:1,turret:1},magazines:{weapon_1:T.profile(F.L.list(base).find(r=>r.slot==='weapon_1').definition).magazine}});base=T.operation(base,{action:'tactical-enable',id:'enable',expected:T.stamp(base),enabled:true});
const scene={hostile:true,playerZone:'room',zones:[{id:'room',name:'车站大厅',cover:1,known:true,exit:true},{id:'hall',name:'通往站台的走廊',cover:0,known:true}],edges:[{a:'room',b:'hall',open:true,los:true}],actors:[{id:'enemy',name:'现场目标与较长人物名称',template:'guard',zone:'room',networked:true,network:'local',visible:true}],nodes:[{id:'camera',name:'站内摄像头',kind:'camera',zone:'room',network:'local',known:true}],source:{floor:1,hash:'fixture'}};
const active=T.operation(base,{action:'tactical-start',id:'start',expected:T.stamp(base),seed:1234,encounterId:'visual-fixture'},{scene});
const report={cardSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Current tactical UI through actual player route; numeric state and save/model callbacks controlled; no real player writes',screens:[],checks:[],errors:[]};
const server=http.createServer((q,r)=>r.end('<!doctype html>'));
async function shot(page,id,width){
 await page.evaluate(async()=>{await document.fonts.ready;for(const a of document.getAnimations())if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();});
 const m=await page.locator('.tactical-shell').evaluate(n=>{const s=n.getRootNode();return {font:getComputedStyle(n).fontSize,overflow:document.documentElement.scrollWidth>innerWidth+2,localOverflow:n.scrollWidth>n.clientWidth+2,buttons:[...s.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({name:b.textContent.slice(0,25),height:b.getBoundingClientRect().height})),fixedBars:[...s.querySelectorAll('.execute-bar')].filter(b=>b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom};})};});
 await page.screenshot({path:path.join(out,`${id}-${width}.png`)});report.screens.push({id,width,...m});if(!captureOnly){assert(!m.overflow&&!m.localOverflow,`${id} ${width} overflow`);assert(m.buttons.every(b=>b.height>=43.5),`${id} ${width} touch target`);assert.equal(m.font,'16px');}
}
async function pane(page,name){const tab=page.locator('.mobile-tabs').getByRole('button',{name,exact:true});if(await tab.isVisible())await tab.click();}
(async()=>{let browser;fs.mkdirSync(out,{recursive:true});try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of (process.env.CXX_WIDTHS||'1440,1280,768,390,360,844').split(',').map(Number)){
  const e=await P.environment(browser,'http://127.0.0.1:'+server.address().port,card,width,width===844?390:width===1280?720:width===360?800:width===390?844:900),page=e.page;
  await page.evaluate(({initial,base,active})=>{
   terminal.destroy();for(const id of ['chat','send_textarea'])document.getElementById(id).style.display='none';window.fixture=document.createElement('main');fixture.style.cssText='box-sizing:border-box;width:100%;height:100dvh;overflow:auto';document.body.append(fixture);
   window.tacticalStates={initial,base,active};window.fixtureGame=structuredClone(initial);window.flags={busy:false,error:'',sourceChanged:false};window.requests=[];window.sequence=0;
   window.operations={stories(){},retrySave(){},recognize:async()=>{throw Error('验收夹具：现场识别失败，存档保持');},operation:async(action,fields={})=>{requests.push({action,...fields});if(window.rejectAction)throw Error('验收夹具：保存失败，原状态保留');if(window.holdAction){flags.busy=true;window.tacticalView.refresh();await new Promise(r=>window.releaseAction=r);flags.busy=false;}fixtureGame=CxxTacticalEngine.operation(fixtureGame,{action,id:'fixture-'+(++sequence),expected:CxxTacticalEngine.stamp(fixtureGame),...fields});},parseIntent:async()=>{throw Error('验收夹具：解析失败，自由行动草稿保留');}};
   window.__cxx_tactical__={mount:parent=>window.tacticalView=CxxTacticalUI.mount({parent,read:()=>({game:fixtureGame,view:CxxTacticalEngine.view(fixtureGame),...flags}),operations,T:CxxTacticalEngine})};
   window.view=player.mount(fixture,'战斗');
  },{initial,base,active});
  assert.equal(await page.locator('.cxx-battle').count(),0);await shot(page,'inventory-audit',width);
  await page.evaluate(()=>{fixtureGame=structuredClone(tacticalStates.base);tacticalView.refresh();});await shot(page,'scene-idle',width);await page.getByRole('button',{name:'识别当前现场',exact:true}).click();await page.getByText('验收夹具：现场识别失败，存档保持',{exact:true}).waitFor();await shot(page,'scene-error',width);
  await page.evaluate(()=>{fixtureGame=structuredClone(tacticalStates.active);view.destroy();view=player.mount(fixture,'战斗');fixture.scrollTop=0;});await shot(page,'actions',width);
  for(const [name,id]of [['移动','move'],['破解','hack'],['工程与支援','engineer'],['作战','combat']]){await page.locator('.category-tabs').getByRole('button',{name,exact:true}).click();await shot(page,id,width);}
  await pane(page,'现场');await shot(page,'field',width);await pane(page,'战报');await shot(page,'report',width);await pane(page,'行动');
  if(!captureOnly){
   await page.getByRole('button',{name:'选择动作 防御',exact:true}).click();const previous=await page.evaluate(()=>JSON.stringify(fixtureGame));await page.evaluate(()=>rejectAction=true);await page.locator('[data-execute=true]').click();await page.getByText('验收夹具：保存失败，原状态保留',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.stringify(fixtureGame)),previous);await shot(page,'action-save-error',width);
   await page.evaluate(()=>{rejectAction=false;holdAction=true;});await page.locator('[data-execute=true]').click();await page.getByText('正在保存行动结果…',{exact:true}).waitFor();assert(await page.locator('[data-execute=true]').isDisabled());await shot(page,'action-save-busy',width);await page.evaluate(()=>releaseAction());await page.waitForFunction(()=>!flags.busy);await page.getByText('正在保存行动结果…',{exact:true}).waitFor({state:'hidden'});assert.notEqual(await page.evaluate(()=>JSON.stringify(fixtureGame)),previous);
   await page.evaluate(()=>{flags.sourceChanged=true;tacticalView.refresh();});assert(await page.locator('[data-execute=true]').isDisabled());await shot(page,'changed-branch',width);report.checks.push({width,path:'current player route / four categories / field-report-actions / failed save unchanged / busy disabled / successful numeric action / changed source blocked'});
  }
  await page.evaluate(()=>{view.destroy();fixture.innerHTML='';flags.sourceChanged=false;flags.error='';fixtureGame=structuredClone(tacticalStates.active);window.surface=CxxBattleSurface.create({api,top:window}).start();surface.open();});await page.locator('.cxx-battle-dialog .tactical-shell').waitFor();await shot(page,'surface',width);
  if(width===1440&&!captureOnly){await page.evaluate(()=>{const d=document.querySelector('.cxx-battle-dialog');d.style.width='440px';});await shot(page,'surface-narrow',width);const bar=await page.locator('.execute-bar').boundingBox(),dialog=await page.locator('.cxx-battle-dialog').boundingBox();assert(bar.x>=dialog.x&&bar.x+bar.width<=dialog.x+dialog.width,'Action footer stays inside its dialog');}
  await page.getByRole('button',{name:'返回 ×',exact:true}).click();await page.evaluate(()=>{surface.destroy();delete window.__cxx_tactical__;player.stop();runtime.destroy();});report.errors.push(...e.errors);await page.close();
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,screens:report.screens.length,checks:report.checks.length,errors:report.errors,failure:report.failure}));}
})();
