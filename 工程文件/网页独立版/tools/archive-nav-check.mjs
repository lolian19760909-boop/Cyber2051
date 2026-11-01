/** 读取存档页检查：返回主菜单可用性、删除故事/存档点全流程。隔离浏览器+本地包+种子IDB数据，无真实存档、无模型调用。 */
import fs from 'node:fs';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';import {createPackagedServer} from './local-runtime.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;};const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(arg('--root','工程文件/.cache/archive-fix-20261101/package')),out=path.resolve(arg('--out','工程文件/.cache/archive-fix-20261101/archive-nav-check.json'));
const current=JSON.parse(fs.readFileSync(path.join(root,'current.json')));
const server=await new Promise(resolve=>{const s=createPackagedServer({root});s.listen(0,'127.0.0.1',()=>resolve(s));});
const base='http://127.0.0.1:'+server.address().port;
const report={at:new Date().toISOString(),buildId:current.release,scope:'Isolated browser, seeded local IDB rows; no user story, no model call',errors:[],steps:[],shots:[]};let browser;
const seed=page=>page.evaluate(async()=>{
  const accountId=localStorage.getItem('cxx2051:local-account')||null;const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('cxx2051-web',2);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  const now=new Date().toISOString();
  await new Promise((resolve,reject)=>{const t=db.transaction(['runs','checkpoints'],'readwrite');t.objectStore('runs').put({runId:'seed-run',accountId,branchId:'main',revision:0,headNodeId:null,createdAt:now,updatedAt:now,profile:{name:'种子故事',origin:{name:'测试起点'}}});t.objectStore('checkpoints').put({runId:'seed-run',checkpointId:'seed-point-1',nodeId:null,branchId:'main',label:'种子存档点',createdAt:now});t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
  db.close();return 'seeded';
});
const buttonNames=page=>page.evaluate(()=>[...document.querySelectorAll('.cxx-web-archive button')].map(b=>b.textContent.trim()));
const shoot=(page,name)=>{const file='shot-'+name+'.png';return page.screenshot({path:path.join(path.dirname(out),file)}).then(()=>report.shots.push(file));};
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await (await browser.newContext({viewport:{width:1280,height:900}})).newPage();page.setDefaultTimeout(20000);
 await page.route('**/api/workshop/announcements',route=>route.fulfill({json:{ok:true,items:[]}}));
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(base+'/?mode=local',{waitUntil:'domcontentloaded'});
 await page.waitForURL('**/releases/'+current.release+'/index.html?mode=local');
 await page.locator('.cxx-pack-choice button').click();
 await page.waitForFunction(()=>!!window.CxxOpeningPage&&!document.querySelector('.cxx-boot'),{},{timeout:180000});
 const later=page.getByRole('button',{name:'稍后再说',exact:true});if(await later.isVisible().catch(()=>false))await later.click();
 const title=page.locator('.cx77-splash[data-phase=title]');if(await title.isVisible().catch(()=>false))await title.click();
 await page.locator('.cx77-splash').waitFor({state:'detached'}).catch(()=>{});
 // 1 干净状态：进入存档页并返回主菜单
 await page.getByRole('button',{name:'读取存档'}).click();
 await page.waitForSelector('.cxx-web-archive',{timeout:15000});
 await shoot(page,'1-archive-empty');
 await page.getByRole('button',{name:'返回主菜单'}).click();
 await page.waitForTimeout(800);
 const backState=await page.evaluate(()=>{const nav=document.querySelector('.game-navigation');return {menuVisible:!!nav&&nav.offsetParent!==null,archiveStill:!!document.querySelector('.cxx-web-archive')};});
 report.backWorks=backState.menuVisible&&!backState.archiveStill;
 report.steps.push('返回主菜单：'+JSON.stringify(backState));
 assert.ok(report.backWorks,'返回主菜单失效');
 // 2 种子数据后进入存档页：删除按钮存在
 await seed(page);
 await page.getByRole('button',{name:'读取存档'}).click();
 await page.waitForSelector('.cxx-web-archive',{timeout:15000});
 await page.getByRole('button',{name:'刷新列表'}).click();
 await page.waitForFunction(()=>document.querySelector('.cxx-web-archive')?.innerText.includes('种子故事'),{},{timeout:15000});
 const storyButtons=await buttonNames(page);report.storyButtons=storyButtons;
 assert.ok(storyButtons.some(t=>t.includes('删除此故事')),'删除此故事按钮不存在');
 await page.locator('.story-card').first().click();
 await page.waitForSelector('.story-aside button');
 await shoot(page,'2-story-details');
 // 3 删除整个故事（confirm 已自动接受）
 await page.getByRole('button',{name:'删除此故事'}).click();await page.waitForTimeout(2000);report.deleteStatus=await page.evaluate(()=>document.querySelector('.story-status')?.textContent||'(无状态)');
 await page.waitForFunction(()=>![...document.querySelectorAll('.story-card strong')].some(e=>e.textContent.includes('种子故事')),{},{timeout:15000});
 const cardsAfterStoryDelete=await page.evaluate(()=>document.querySelectorAll('.story-card').length);
 report.storyDeleted=cardsAfterStoryDelete===0;
 report.steps.push('删除故事后卡片数：'+cardsAfterStoryDelete);
 assert.ok(report.storyDeleted,'删除故事后列表未清空');
 // 4 重建种子 → 存档点页签删除存档点
 await seed(page);
 await page.getByRole('button',{name:'刷新列表'}).click();
 await page.getByRole('button',{name:'存档点'}).click();
 await page.waitForFunction(()=>document.querySelector('.cxx-web-archive')?.innerText.includes('种子存档点'),{},{timeout:15000});
 await page.locator('.story-card').first().click();
 await page.waitForSelector('.story-aside button');
 await shoot(page,'3-point-details');
 assert.ok((await buttonNames(page)).some(t=>t.includes('删除此存档点')),'删除此存档点按钮不存在');
 await page.getByRole('button',{name:'删除此存档点'}).click();
 await page.waitForFunction(()=>![...document.querySelectorAll('.story-card strong')].some(e=>e.textContent.includes('种子存档点')),{},{timeout:15000});
 const cardsAfterPointDelete=await page.evaluate(()=>document.querySelectorAll('.story-card').length);
 report.pointDeleted=cardsAfterPointDelete===0;
 report.steps.push('删除存档点后卡片数：'+cardsAfterPointDelete);
 assert.ok(report.pointDeleted,'删除存档点后列表未清空');
 // 5 再次返回主菜单回归
 await page.getByRole('button',{name:'返回主菜单'}).click();
 await page.waitForTimeout(800);
 const finalState=await page.evaluate(()=>{const nav=document.querySelector('.game-navigation');return {menuVisible:!!nav&&nav.offsetParent!==null,archiveStill:!!document.querySelector('.cxx-web-archive')};});
 report.finalBackWorks=finalState.menuVisible&&!finalState.archiveStill;
 await shoot(page,'4-final-menu');
 assert.ok(report.finalBackWorks,'收尾返回主菜单失效');
 assert.deepEqual(report.errors,[],'页面出现未捕获错误');
 report.ok=true;
}catch(error){report.ok=false;report.failure=error.message.split('\n')[0];}
finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');await browser?.close().catch(()=>{});await new Promise(r=>server.close(r));console.log(JSON.stringify(report,null,2));}
