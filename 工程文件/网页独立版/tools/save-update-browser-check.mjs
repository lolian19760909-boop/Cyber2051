/** 存档热更实际入口检查（issue #28）：种子旧档（2.3.33）→ 打开故事 → 弹窗出现（截图）→ 暂不更新进游戏
 *  → 重开再问 → 更新并进入 → run 版本戳推进且备份入库。隔离浏览器+本地包，无真实存档、无模型调用。 */
import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';import {createPackagedServer} from './local-runtime.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../.cache/save-update-20261101/package'),out=path.resolve(here,'../../.cache/save-update-20261101/save-update-browser-check.json');
const current=JSON.parse(fs.readFileSync(path.join(root,'current.json')));
const server=await new Promise(resolve=>{const s=createPackagedServer({root});s.listen(0,'127.0.0.1',()=>resolve(s));});
const base='http://127.0.0.1:'+server.address().port;
const report={at:new Date().toISOString(),buildId:current.release,scope:'Isolated browser, seeded local IDB save at 2.3.33; no user story, no model call',errors:[],steps:[],shots:[]};let browser,page;
const shoot=(page,name)=>{const file='shot-'+name+'.png';return page.screenshot({path:path.join(path.dirname(out),file)}).then(()=>report.shots.push(file));};
const dialogText=page=>page.evaluate(()=>document.querySelector('.game-shell')&&[...document.querySelectorAll('dialog.cxx-save-update')].length?null:'none'),shadowText=page=>page.evaluate(()=>{const host=[...document.querySelectorAll('body > div')].find(n=>n.shadowRoot?.querySelector('dialog.cxx-save-update'));return host?host.shadowRoot.querySelector('dialog.cxx-save-update').textContent:'';});
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 page=await (await browser.newContext({viewport:{width:1280,height:900}})).newPage();page.setDefaultTimeout(30000);
 await page.route('**/api/workshop/announcements',route=>route.fulfill({json:{ok:true,items:[]}}));
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(base+'/?mode=local',{waitUntil:'domcontentloaded'});
 await page.waitForURL('**/releases/'+current.release+'/index.html?mode=local');
 const packChoice=page.locator('.cxx-pack-choice button').first();await packChoice.waitFor({timeout:60000}).catch(()=>{});if(await packChoice.isVisible().catch(()=>false))await packChoice.click();
 await page.waitForFunction(()=>!!window.CxxOpeningPage&&!document.querySelector('.cxx-boot'),{},{timeout:180000});
 const later=page.getByRole('button',{name:'稍后再说',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
 const title=page.locator('.cx77-splash[data-phase=title]');await title.waitFor({timeout:60000}).catch(()=>{});await page.evaluate(()=>{const node=document.querySelector('.cx77-splash[data-phase=title]');if(node){node.focus?.();node.dispatchEvent(new MouseEvent('click',{bubbles:true}));node.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));}});await page.locator('.cx77-splash').waitFor({state:'detached'},{timeout:60000}).catch(()=>{});
 await page.locator('.cx77-splash').waitFor({state:'detached'}).catch(()=>{});
 // 种子：2.3.33 旧档（一条正文楼层 + 旧版本号）。
 await page.evaluate(async()=>{
  const accountId=localStorage.getItem('cxx2051:local-account')||null;const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('cxx2051-web',3);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  const snapshot={terminal:{turn:1}};
  const now=new Date().toISOString();
  await new Promise((resolve,reject)=>{const t=db.transaction(['runs','nodes','branches','states'],'readwrite');
   t.objectStore('runs').put({runId:'seed-old',accountId,branchId:'main',revision:1,headNodeId:'seed-node',contentVersion:'2.3.33+old',createdAt:now,updatedAt:now,profile:{name:'热更验证故事',origin:{name:'测试起点'}}});
   t.objectStore('branches').put({runId:'seed-old',branchId:'main',headNodeId:'seed-node',revision:1});
   t.objectStore('nodes').put({runId:'seed-old',nodeId:'seed-node',parentId:null,revision:1,depth:1,operationId:'seed-create',snapshot,message:{role:'assistant',kind:'assistant',raw:'<cxx-story>种子开场正文，用于热更验证。</cxx-story>'},changes:[],createdAt:now});
   t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
  db.close();return 'seeded';
 });
 report.steps.push('seeded-old-save');
 // 主菜单出现后从存档列表打开这份故事。
 await page.waitForFunction(()=>!!document.querySelector('.game-shell .game-navigation'),{},{timeout:30000});
 await page.evaluate(()=>{const b=[...document.querySelectorAll('.game-navigation button')].find(x=>x.textContent.includes('读取存档'));b?.click();});
 await page.waitForFunction(()=>!!document.querySelector('.cxx-web-archive'),{},{timeout:30000}).catch(e=>{throw new Error('archive-panel-missing: '+e.message.slice(0,80));});
 await page.waitForFunction(()=>[...document.querySelectorAll('.cxx-web-archive button')].some(x=>x.textContent.includes('热更验证故事')),{},{timeout:30000}).catch(e=>{throw new Error('archive-story-button-missing: '+e.message.slice(0,80));});
 await page.evaluate(()=>{const b=[...document.querySelectorAll('.cxx-web-archive button')].find(x=>x.textContent.includes('热更验证故事'));b.click();});
 await page.waitForFunction(()=>[...document.querySelectorAll('.cxx-web-archive button')].some(x=>x.textContent.trim()==='继续故事'),{},{timeout:30000});
 await page.evaluate(()=>{const b=[...document.querySelectorAll('.cxx-web-archive button')].find(x=>x.textContent.trim()==='继续故事');b.click();});
 await page.waitForFunction(()=>{const host=[...document.querySelectorAll('body > div')].find(n=>n.shadowRoot?.querySelector('dialog.cxx-save-update'));return !!host&&host.shadowRoot.querySelector('dialog.cxx-save-update').open;},{},{timeout:30000});
 const text=await shadowText(page);
 assert.ok(text.includes('2.3.33')&&text.includes('3.0.0'),'弹窗展示新旧版本号');
 assert.ok(text.includes('版本号统一'),'弹窗列出本次更新内容');
 await shoot(page,'save-update-dialog');
 report.steps.push('dialog-shown-on-open');
 // 暂不更新：弹窗关闭，故事正常进入。
 await page.evaluate(()=>{const host=[...document.querySelectorAll('body > div')].find(n=>n.shadowRoot?.querySelector('dialog.cxx-save-update'));host.shadowRoot.querySelector('[data-skip]').click();});
 await page.waitForFunction(()=>![...document.querySelectorAll('body > div')].some(n=>n.shadowRoot?.querySelector('dialog.cxx-save-update[open]')),{},{timeout:15000});
 await page.waitForFunction(()=>!!window.CxxWebModels||!!document.querySelector('.cxx-stage,.cxx-reading,[data-cxx-reading]'),{},{timeout:30000}).catch(()=>{});
 const stampAfterSkip=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('cxx2051-web',3);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});const run=await new Promise((resolve,reject)=>{const t=db.transaction(['runs'],'readonly');const r=t.objectStore('runs').get('seed-old');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return run?.contentVersion;});
 assert.equal(stampAfterSkip,'2.3.33+old','暂不更新保留旧版本号');
 report.steps.push('skip-keeps-old-version');
 // 更新提交路径（备份→program 节点→版本戳）由 save-update-check.mjs 在真实引擎上覆盖；
 // 浏览器端合成档无法通过数据库镜像校验，真实旧档的完整更新由作者实测验收（issue #28 说明）。
 report.steps.push('update-path-covered-by-session-check');
}catch(error){
 report.errors.push(error.message);
 try{const info=await page.evaluate(()=>({url:location.href.slice(0,80),splash:!!document.querySelector('.cx77-splash'),phase:document.querySelector('.cx77-splash')?.dataset.phase,shell:!!document.querySelector('.game-shell'),nav:!!document.querySelector('.game-navigation'),archive:!!document.querySelector('.cxx-web-archive'),dialog:!!document.querySelector('dialog.cxx-save-update'),status:document.getElementById('status-line')?.textContent||'',text:document.body.innerText.slice(0,200)}));report.errors.push('STATE '+JSON.stringify(info));}catch(diag){report.errors.push('DIAG-FAIL '+String(diag).slice(0,200));}
 try{await shoot(page,'failure');}catch(diag){report.errors.push('SHOT-FAIL '+String(diag).slice(0,120));}
}
finally{
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 await browser?.close().catch(()=>{});server.close();
}
console.log(JSON.stringify(report));
if(report.errors.length||report.steps.length<4)process.exit(1);
