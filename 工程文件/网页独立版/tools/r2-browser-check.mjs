import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createLocalServer } from './serve.mjs';
const server=createLocalServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,checks=[],errors=[],requests=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1360,height:900}});
await context.route('https://**/*',route=>route.abort());
await context.route('**/api/play/connect',async route=>{
 const payload=route.request().postDataJSON().payload;requests.push(payload);
 const state=JSON.parse(/<status_current_variable>([\s\S]*?)<\/status_current_variable>/.exec(payload.messages.map(row=>row.content).join('\n'))[1]);
 const yen=(state.terminal.wallet.yen||0)+100;
 const reply='<cxx-story>BROWSER_REPLY_'+yen+'</cxx-story><UpdateVariable>'+JSON.stringify([{op:'replace',path:'/terminal/wallet/yen',value:yen},{op:'replace',path:'/terminal/wallet/earned',value:yen}])+'</UpdateVariable>';
 await route.fulfill({status:200,contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:reply},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});
});
const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.stack));
const step=()=>page.locator('.cxx-opening-flow').getAttribute('data-step');
const next=()=>page.locator('.opening-next').click();
const waitSaved=()=>page.waitForFunction(()=>!document.querySelector('#send').disabled&&document.querySelector('#status-line').textContent.includes('已提交'));
async function inspect(){return page.evaluate(async()=>{const q=indexedDB.open('cxx2051-web');const db=await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});const tx=db.transaction(['runs','nodes','states','checkpoints'],'readonly');const read=name=>new Promise(resolve=>{tx.objectStore(name).getAll().onsuccess=e=>resolve(e.target.result);});const [runs,nodes,states,checkpoints]=await Promise.all(['runs','nodes','states','checkpoints'].map(read));db.close();return {runs,nodes,states,checkpoints};});}
try{
 await page.goto(origin+'/?mode=local&baseUrl='+encodeURIComponent('https://upstream.test/v1/chat/completions')+'&model=synthetic');
 await page.locator('.cxx-opening-flow').waitFor();
 assert.equal(await step(),'preferences');await next();assert.equal(await step(),'origin');await next();assert.equal(await step(),'profile');
 await page.getByLabel('姓名',{exact:true}).fill('浏览器回归');
 await next();assert.equal(await step(),'growth');await next();assert.equal(await step(),'loadout');await next();assert.equal(await step(),'scenario');
 await page.getByRole('button',{name:/街头/}).last().click();
 await next();assert.equal(await step(),'review');await next();
 await page.waitForFunction(()=>document.querySelector('#status-line').textContent.startsWith('就绪'));
 let saved=await inspect();assert.equal(saved.runs.length,1);assert.equal(saved.runs[0].profile.name,'浏览器回归');assert.equal(saved.nodes[0].message.kind,'opening');assert.ok(saved.states[0].data.terminal.gameplay.growth);assert.equal(requests.length,0);checks.push('原六步 UI 真实创建，人物／能力／装备与原文同事务保存，不调用模型');
 await page.locator('#input').fill('BROWSER_INPUT_ONE');await page.locator('#send').click();await waitSaved();
 await page.locator('#drawer-btn').click();await page.locator('#checkpoint').click();await page.locator('#drawer-close').click();
 await page.locator('#input').fill('BROWSER_INPUT_TWO');await page.locator('#send').click();await waitSaved();
 await page.reload();await page.waitForFunction(()=>document.querySelector('#status-line').textContent.startsWith('就绪'));
 await page.locator('#input').fill('BROWSER_INPUT_THREE');await page.locator('#send').click();await waitSaved();
 assert.ok(JSON.stringify(requests[2].messages).includes('BROWSER_INPUT_ONE'));assert.ok(JSON.stringify(requests[2].messages).includes('BROWSER_REPLY_100'));checks.push('刷新后第三次真实 fetch 包含第一轮输入／回复');
 const prior=await inspect(),priorRun=prior.runs[0],priorNode=prior.nodes.find(row=>row.nodeId===priorRun.headNodeId);
 await page.locator('#regen').click();await waitSaved();
 saved=await inspect();const current=saved.runs[0],reroll=saved.nodes.find(row=>row.nodeId===current.headNodeId),state=saved.states.find(row=>row.branchId===current.branchId);
 assert.notEqual(current.branchId,priorRun.branchId);assert.equal(reroll.parentId,priorNode.parentId);assert.equal(state.data.terminal.wallet.yen,300);assert.equal(requests.length,4);checks.push('重抽建立兄弟路线、复用父状态；余额不叠加被替换候选');
 await page.locator('#drawer-btn').click();await page.getByRole('button',{name:/恢复 · 存档/}).click();await page.waitForFunction(()=>document.querySelector('#status-line').textContent.startsWith('就绪'));
 saved=await inspect();const restored=saved.runs[0];assert.equal(saved.states.find(row=>row.branchId===restored.branchId).data.terminal.wallet.yen,100);assert.equal(requests.length,4);checks.push('从 UI 恢复第一轮检查点为新路线，不再次生成');
 assert.deepEqual(errors,[]);
}catch(error){errors.push(error.stack);errors.push('UI: '+await page.locator('#status-line').textContent()+' / '+await page.locator('.opening-notice').textContent().catch(()=>''));await page.screenshot({path:fileURLToPath(new URL('../reports/r2-browser-failure.png',import.meta.url)),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{
 fs.writeFileSync(new URL('../reports/r2-browser-check.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),scope:'真实 Edge、原创建 UI、真实 IDB、合成网络上游；非真实模型',checks,errors,requests:requests.length},null,2)+'\n');
 await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
for(const check of checks)console.log('PASS '+check);for(const error of errors)console.log('FAIL '+error);
