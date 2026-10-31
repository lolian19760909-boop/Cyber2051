'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {overlay}=require('../../工具/lib/ui-motion-overlay.cjs'),{chromium}=require('../../独立制卡器/workbench/node_modules/playwright');
const eng=path.resolve(__dirname,'../..'),out=process.env.CXX_EVIDENCE||path.join(eng,'.cache/ui-motion-20261024'),suite=path.join(eng,'配套扩展/tavern-runtime-suite');
const bytes=fs.readFileSync(process.env.CXX_TEST_CARD||path.join(out,'candidate.json')),card=JSON.parse(bytes),report={scope:'Packaged card with real Suite WAAPI; controlled chat/save adapter; isolated browser',cardSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),checks:[],errors:[],performance:[]};
const themeRuntime=require('../../工具/lib/script-modules.cjs').extract(card.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n;\n'),['CxxThemeRuntime'])[0].source;
const B=require('../../工具/lib/card-ast.cjs');let themeCarriers;B.walk(B.acorn.parse(card.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n;\n'),{ecmaVersion:'latest',sourceType:'module'}),node=>{if(node.type==='CallExpression'&&node.callee?.object?.name==='CxxThemeRuntime'&&node.callee?.property?.name==='install')themeCarriers=node.arguments[2]?.value;});assert(themeCarriers?.includes('data-cxx-theme="yellow"'));
const all=card.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n;\n'),menuCode=require('../../工具/lib/card-global.cjs')(all,['CxxHubStyle','CxxGameMenuStyle'])+';\n'+require('../../工具/lib/script-modules.cjs').extract(all,['CxxUILayers','CxxHubUI','CxxGameMenu','CxxSettingsUI']).map(m=>m.source).join(';\n');
const pack=require('../../工具/lib/offline-resources.cjs')(eng),uris=new Map(),assets=new Map();
for(const e of pack.manifest.entries){const b=pack.entries.get(e.file);uris.set(e.id,()=>`data:${e.mime};base64,${b.toString('base64')}`);for(const alias of e.aliases||[])assets.set(alias,{body:b,mime:e.mime});}
for(const s of card.data.extensions.tavern_helper.scripts)s.content=s.content.replace(/data:image\/svg\+xml,%3Csvg%20xmlns=%22http:\/\/www.w3.org\/2000\/svg%22\/%3E#cxxasset-([a-f0-9]{64})/g,(v,id)=>uris.get(id)?.()||v);
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8">');return;}const file=path.resolve(suite,'.'+name);if(!file.startsWith(suite+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(file));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function settled(frame){await frame.waitForFunction(()=>CxxTerminalApp.read().motion.active===0&&CxxTerminalApp.read().motion.transitions===0);}
async function exercise(T,browser,url,width){
 const e=await T.environment(browser,url,card,width,width<700?844:900,{hasTouch:width<700},{prepare:async page=>{
  await page.route('https://**/*',route=>{const a=assets.get(route.request().url());return a?route.fulfill({body:a.body,contentType:a.mime}):route.abort();});
  await page.addScriptTag({content:themeRuntime});await page.evaluate(css=>CxxThemeRuntime.install(window,window,css),themeCarriers);
  await page.evaluate(async()=>{const {createMotion}=await import('/visual/runtime/motion.mjs');window.TavernMotion=createMotion();window.motionLevel='high';Cxx236Preferences.read=()=>({level:motionLevel,device:innerWidth<700?'mobile':'desktop'});});
 }});
 const {page}=e;let frame=e.frame;try{
  await page.evaluate(()=>{document.querySelector('#send_textarea').hidden=true;window.beforeState=JSON.stringify(c.chat);});
  assert(await frame.evaluate(()=>CxxTerminalApp.motion.available),'Suite actually connected');
  for(const theme of ['red','yellow','night']){
   await page.evaluate(theme=>CxxTheme.set(theme),theme);assert.equal(await frame.evaluate(()=>document.documentElement.dataset.cxxTheme),theme);
   await frame.evaluate(()=>CxxTerminalApp.navigate('characters'));await frame.locator('.player-view-host').waitFor();await frame.getByRole('button',{name:'物品栏',exact:true}).first().click();
   await frame.locator('.player-view-host').locator('.app[data-tab="物品栏"]').waitFor();
   await frame.getByRole('button',{name:'义体',exact:true}).first().click();await frame.locator('.app[data-tab="义体"]').waitFor();
   await frame.locator('.player-head .sec-tabs').getByRole('button',{name:'人物',exact:true}).click();await frame.locator('.app[data-tab="人物"]').waitFor();await settled(frame);
   await page.screenshot({path:path.join(out,`terminal-${theme}-${width}.png`)});
   const transitions=await frame.evaluate(async()=>{const outcomes=[];for(const id of ['archive','network','operations','settings','characters']){CxxTerminalApp.navigate(id);outcomes.push({id,active:CxxTerminalApp.read().motion.active,visible:[...document.querySelectorAll('#t2051x-workspace>.page')].filter(n=>!n.hidden&&n.getClientRects().length).length});await new Promise(r=>setTimeout(r,35));}await new Promise(r=>setTimeout(r,350));return {outcomes,page:CxxTerminalApp.page,hiddenGhosts:document.querySelectorAll('[aria-hidden="true"][inert]').length};});
   assert.equal(transitions.page,'characters');assert(transitions.outcomes.some(x=>x.active>0),'Actual route uses Suite');assert.equal(transitions.hiddenGhosts,0);await settled(frame);
   const palette=await frame.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--cxx-theme-heading').trim());if(theme==='yellow')assert.equal(palette,'#e9d042');if(theme==='night')assert(palette&&palette!=='#e9d042');
   report.checks.push({width,theme,palette,path:'character tabs and interrupted terminal routes',...transitions});
  }
  await frame.evaluate(()=>CxxTerminalApp.navigate('characters'));await settled(frame);
  if(width<700)await frame.locator('.profile-mobile-tabs').getByRole('button',{name:'装配',exact:true}).click();
  await frame.locator('.profile-equipped').first().click();await frame.locator('.drawer').waitFor();
  await frame.getByRole('button',{name:'关闭 ×',exact:true}).click();await frame.locator('.drawer').waitFor({state:'detached'});
  await frame.locator('.profile-equipped').first().click();await frame.locator('.drawer').waitFor();await page.keyboard.press('Escape');await frame.locator('.drawer').waitFor({state:'detached'});
  report.checks.push({width,path:'equipment detail entrance, exit, reopen and Escape'});
  await frame.evaluate(()=>CxxTerminalApp.navigate('archive'));await settled(frame);const row=frame.locator('.archive-row').first();await row.click();await settled(frame);assert(await frame.locator('#t2051x-archive-selection').isVisible());
  if(width<700){await frame.getByRole('button',{name:'‹ 返回列表',exact:true}).click();await settled(frame);assert(await row.isVisible());}
  await frame.evaluate(()=>CxxTerminalApp.navigate('operations'));await settled(frame);await frame.locator('[data-quest-id]').first().click();await frame.locator('.journal-copy h2').waitFor();await sleep(250);
  await frame.getByRole('button',{name:'历史',exact:true}).click();await sleep(250);assert(await frame.locator('.journal-empty').isVisible());
  report.checks.push({width,path:'archive detail/back and quest filter/detail'});
  for(const level of ['medium','low']){await page.evaluate(level=>{motionLevel=level;dispatchEvent(new CustomEvent('cxx-ui-preferences-changed'));},level);const value=await frame.evaluate(()=>{CxxTerminalApp.navigate('settings');CxxTerminalApp.navigate('archive');return CxxTerminalApp.read();});if(level==='low')assert.equal(value.motion.active,0);await settled(frame);report.checks.push({width,level,activeAtSwitch:value.motion.active});}
  await page.evaluate(()=>{motionLevel='high';dispatchEvent(new CustomEvent('cxx-ui-preferences-changed'));});
  await frame.locator('.nav-item[data-page="settings"]').focus();await page.keyboard.press('Enter');assert.equal(await frame.evaluate(()=>CxxTerminalApp.read().motion.active),0);
  await page.emulateMedia({reducedMotion:'reduce'});await frame.evaluate(()=>CxxTerminalApp.navigate('network'));assert.equal(await frame.evaluate(()=>CxxTerminalApp.read().motion.active),0);await page.emulateMedia({reducedMotion:'no-preference'});
  // Warm cached pages, then compare the same route loop with motion on/off.
  for(const level of ['low','high']){await page.evaluate(level=>motionLevel=level,level);report.performance.push(await frame.evaluate(async({width,level})=>{document.getElementById('t2051x-root').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));const samples=[],tasks=[];let running=true,last=performance.now();const observer=new PerformanceObserver(list=>tasks.push(...list.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});function tick(t){if(last)samples.push(t-last);last=t;if(running)requestAnimationFrame(tick);}requestAnimationFrame(tick);for(const id of ['settings','archive','network','settings','archive','network']){CxxTerminalApp.navigate(id);await new Promise(r=>setTimeout(r,260));}running=false;observer.disconnect();samples.sort((a,b)=>a-b);return {width,level,frames:samples.length,p95FrameMs:samples[Math.floor(samples.length*.95)],longTasks:tasks,active:CxxTerminalApp.read().motion.active};},{width,level}));}
  assert.equal(await page.evaluate(()=>JSON.stringify(c.chat)===beforeState),true,'UI navigation preserves chat and variables');
  const overflow=await frame.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert.equal(overflow,false);
  await page.addScriptTag({content:menuCode});await page.evaluate(async()=>{terminal.close();window.menu=CxxGameMenu.create({win:window,context:()=>({chatId}),store:{list:async()=>[],flush:async()=>player.waitForSaved(),remember:async()=>{}},openArchive:()=>{},begin:()=>{},leave:()=>{}});await menu.open('hub');});
  await page.locator('.hub-entry-grid [data-section="characters"]').click();await page.locator('#cxx-shared-terminal-233').waitFor();frame=await (await page.$('#cxx-shared-terminal-233')).contentFrame();await frame.locator('.profile-overview').waitFor();const loads=await page.evaluate(()=>terminal.read().loads);
  await page.locator('.hub-entry-grid [data-section="city"]').click();await frame.locator('#t2051x-page-city').waitFor({state:'visible'});
  await page.locator('.hub-entry-grid [data-section="characters"]').click();await frame.locator('.profile-overview').waitFor();assert.equal(await page.evaluate(()=>terminal.read().loads),loads);
  await page.getByRole('button',{name:'‹ 游戏菜单',exact:true}).click();await page.locator('.cxx-hub[data-section="hub"]').waitFor();
  await page.getByRole('button',{name:'继续阅读',exact:true}).click();await page.locator('.cxx-game-menu').waitFor({state:'detached'});await page.evaluate(()=>menu.destroy());
  assert.equal(await page.evaluate(()=>JSON.stringify(c.chat)===beforeState),true);report.checks.push({width,path:'hub to embedded terminal, city/profile reuse, return and resume without data writes'});
  await page.evaluate(()=>{terminal.destroy();player.stop();runtime.destroy();CxxTheme.destroy();});await sleep(50);assert.equal(await page.evaluate(()=>TavernMotion.diagnostics().scopes),0,'Frame destruction releases scopes');
  report.checks.push({width,path:'keyboard / reduced motion / data parity / disposal'});report.errors.push(...e.errors);
 }catch(error){report.errors.push(...e.errors);await page.screenshot({path:path.join(out,`integration-failure-${width}.png`)});throw error;}finally{await page.close();}
}
(async()=>{let browser;try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});await overlay(async()=>{const T=require('../../工具/lib/terminal-preview.cjs');for(const width of (process.env.CXX_WIDTHS||'1440,390').split(',').map(Number))await exercise(T,browser,'http://127.0.0.1:'+server.address().port,width);});assert.deepEqual(report.errors,[]);report.pass=true;}catch(error){report.failure=error.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'integration.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}})();
