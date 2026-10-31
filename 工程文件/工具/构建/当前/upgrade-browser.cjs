'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const Build=require('./build.cjs'),{extract}=require('../../lib/script-modules.cjs'),{inlineSource}=require('../../lib/inline-source.cjs');
async function main(){
 const script=JSON.parse(fs.readFileSync(path.join(Build.root,`.cache/build/东京都2051-旧版续玩工具-${Build.version}.json`))),card=JSON.parse(fs.readFileSync(Build.output)),manifest=JSON.parse(fs.readFileSync(path.join(Build.root,`.cache/build/upgrade-manifest-${Build.version}.json`)));
 const old=require('../../../测试/更新/fixtures/旧更新器.json');
 const actual=extract(script.content,['CxxUpdaterUpgrade','CxxUpgradePanel']);for(const [name,file]of [['CxxUpdaterUpgrade','upgrader.js'],['CxxUpgradePanel','upgrader-ui.js']])assert.equal(actual.find(x=>x.name===name).source,extract(inlineSource(fs.readFileSync(path.join(Build.root,'卡片源码/运行时',file),'utf8')),[name])[0].source);
 assert.equal(await require('../../../卡片源码/运行时/core.js').sha256(card.data.extensions.tavern_helper.scripts.find(s=>s.id===manifest.updaterId).content),manifest.targetHash);
 const report={scope:`Actual ${Build.version} standalone bundle and card panel; controlled host and recovery outcomes, real browser clicks and downloaded Blob. Not live TT/ST.`,source:'测试/更新/fixtures/旧更新器.json',checks:[],errors:[]},browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:white"></body></html>'}));await page.goto('http://localhost/fixture');
  await page.evaluate(old=>{
   window.fixtureChat={chat:[{mes:'旧版正文',swipes:['旧版正文',null],swipe_id:0}],chatMetadata:{}};window.SillyTavern={getContext:()=>fixtureChat};window.events={};window.reads=0;window.calls=[];window.pending=true;window.broken=false;window.revoked=0;window.stops=0;
   window.getVariables=()=>{reads++;return {};};window.getCurrentCharacterId=()=> 'old-card.png';window.getScriptTrees=()=>[old];window.getButtonEvent=name=>name;window.eventOn=(name,fn)=>events[name]=fn;window.eventRemoveListener=name=>delete events[name];
  },old);
  await page.addScriptTag({content:script.content});await page.waitForTimeout(20);assert.equal(await page.evaluate(()=>reads),0,'bundled controller must not auto-start');assert.equal(await page.locator('dialog[open]').count(),0);
  await page.evaluate(()=>{
   const ctx={cardId:'cyber2051',characterKey:'old-card.png',chatId:'story'};
   CxxUpdateHost.create=()=>({ready:async op=>{calls.push(op);},getContext:()=>ctx,assertContext(){},readState:()=>({})});
   CxxUpdateController.create=()=>({recoverPending:async()=>{calls.push('recover');if(broken)throw Error('原备份缺失，请保存救援文件');pending=false;return {status:'rolled-back'};},stop(){stops++;}});
   CxxUpdateBackup.create=()=>({captureMigration:async options=>{if(options?.completeDisk!==true)throw Error('完整分支导出未启用');calls.push('migration');if(pending)throw Object.assign(Error('仍有未完成的安装记录'),{code:'migration-pending-install'});return {document:{type:'cyber2051.migration',fixture:true}};},captureRescue:async()=>({type:'cyber2051.recovery',fixture:true}),prepareExportFile:async doc=>{const url=URL.createObjectURL(new Blob([JSON.stringify(doc)],{type:'application/json'}));return {url,filename:doc.type+'.json',revoke(){revoked++;URL.revokeObjectURL(url);}};},assertExportCurrent(){}});
   events['旧版续玩工具']();
  });
  const dlg=page.locator('dialog'),status=dlg.locator('[role=status]'),btn=name=>dlg.getByRole('button',{name,exact:true});
  assert.ok((await dlg.textContent()).includes(`卡内容 2.0.46 · 独立工具 ${Build.version}`));report.checks.push('actual bundle loads without starting controller; content and tool versions distinguished');
  for(const [width,height]of [[390,844],[844,390],[1280,900]]){await page.setViewportSize({width,height});assert.ok(await dlg.evaluate(d=>d.scrollWidth<=d.clientWidth+1));await page.screenshot({path:path.join(Build.cache,'upgrader-'+width+'.png')});}
  await page.setViewportSize({width:390,height:844});await btn('准备续玩存档').click();assert.equal(await btn('检查并恢复').isEnabled(),false);assert.equal(await btn('关闭').isEnabled(),true);await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('未完成的安装'));assert.match(await status.textContent(),/检查并恢复/);report.checks.push('pending install export stops with next step; other actions disabled while busy, close remains usable');
  await btn('检查并恢复').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('已恢复并核对'));assert.equal(await page.evaluate(()=>stops),1);assert.equal(await page.evaluate(()=>calls.includes('install')),false);
  await btn('准备续玩存档').click();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='下载已准备的文件').disabled);
  const dl=page.waitForEvent('download');await btn('下载已准备的文件').click();const downloaded=await dl;await downloaded.saveAs(path.join(Build.cache,'fixture-migration.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(Build.cache,'fixture-migration.json'))).type,'cyber2051.migration');report.checks.push('keyboard recovery then normal migration download works without upgrading updater');
  await page.evaluate(()=>{pending=true;broken=true;});await btn('检查并恢复').click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('原备份缺失'));assert.equal(await btn('下载已准备的文件').isEnabled(),false);
  await btn('准备救援文件').click();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='下载已准备的文件').disabled);assert.match(await status.textContent(),/不能直接作为续玩/);
  const rescue=page.waitForEvent('download');await btn('下载已准备的文件').click();await (await rescue).saveAs(path.join(Build.cache,'fixture-rescue.json'));assert.equal(JSON.parse(fs.readFileSync(path.join(Build.cache,'fixture-rescue.json'))).type,'cyber2051.recovery');report.checks.push('missing backup leaves rescue download available and labels it ineligible for normal import');
  await btn('关闭').click();assert.equal(await dlg.getAttribute('open'),null);await page.evaluate(()=>events['旧版续玩工具']());assert.equal(await dlg.count(),1);await page.evaluate(()=>dispatchEvent(new Event('pagehide')));assert.equal(await dlg.count(),0);assert.equal(await page.evaluate(()=>Object.keys(events).length),0);assert.equal(await page.evaluate(()=>revoked),2);report.checks.push('close/reopen reuses dialog; teardown revokes downloads and unsubscribes');
  const panelSource=extract(card.data.extensions.tavern_helper.scripts.find(s=>s.id===manifest.updaterId).content,['CxxUpdatePanel'])[0].source;await page.addScriptTag({content:panelSource});
  await page.evaluate(()=>{const panel=document.createElement('div');panel.dataset.cxxUpdatePanel='';panel.style.cssText='max-width:680px;width:calc(100% - 32px);margin:16px;max-height:90vh;overflow:auto';document.body.append(panel);window.view={tab:'migration',version:'2.0.46',updaterVersion:'2.2.0',status:'检测到未完成安装',state:{}};window.acts={close(){},tab(id){view.tab=id;CxxUpdatePanel.render(panel,view,acts);},error(e){throw e;},exportMigration(){calls.push('panel-migration');},recover(){calls.push('panel-recover');},exportRescue(){calls.push('panel-rescue');}};CxxUpdatePanel.render(panel,view,acts);});
  await page.getByRole('button',{name:'检查并恢复未完成安装',exact:true}).click();await page.getByRole('button',{name:'导出救援文件',exact:true}).click();assert.ok(await page.evaluate(()=>calls.includes('panel-recover')&&calls.includes('panel-rescue')));
  for(const [width,height]of [[390,844],[844,390],[1280,900]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(Build.cache,'card-panel-'+width+'.png')});}report.checks.push('actual card panel exposes both actions; standalone and card panel fit 390/844/1280 viewports');
  assert.deepEqual(report.errors,[]);await page.close();
 }finally{await browser.close();}
 fs.writeFileSync(path.join(Build.cache,'upgrade-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
