import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { createLocalServer } from './serve.mjs';
const server=createLocalServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const results=[],errors=[];
async function check(name,fn){try{await fn();results.push({name,ok:true});}catch(error){results.push({name,ok:false,error:error.stack});}}
async function setup(options={}){
 const context=await browser.newContext(options);await context.route('https://**/*',route=>route.abort());
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 return context;
}
async function open(context,mode='local'){const page=await context.newPage();await page.goto(origin+'/?mode='+mode);await page.locator('.cxx-opening-flow').waitFor({timeout:15000});await page.locator('#drawer-btn').click();return page;}
const contexts=[];
try{
 await check('默认 Key 只在浏览会话，关闭浏览会话后不恢复',async()=>{
  const context=await setup();contexts.push(context);const page=await open(context);
  await page.locator('#apiKey').fill('fixture-transient-key');await page.locator('#baseUrl').fill('https://fixture.test/v1');await page.locator('#model-form button[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('#status-line').textContent.includes('本次浏览会话'));
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('fixture-transient-key'))),false);
  assert.equal(await page.evaluate(()=>Object.values(sessionStorage).some(value=>value.includes('fixture-transient-key'))),true);
  const storageState=await context.storageState();const reopened=await setup({storageState});contexts.push(reopened);const fresh=await open(reopened);
  assert.equal(await fresh.locator('#apiKey').inputValue(),'');
 });
 await check('主动记住才落盘，取消记住与清除均删除凭据',async()=>{
  const context=await setup();contexts.push(context);const page=await open(context);
  await page.locator('#apiKey').fill('fixture-remembered-key');await page.locator('input[name=rememberKey]').check();await page.locator('#model-form button[type=submit]').click();
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('fixture-remembered-key'))),true);
  await page.locator('input[name=rememberKey]').uncheck();await page.locator('#model-form button[type=submit]').click();
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>value.includes('fixture-remembered-key'))),false);
  await page.locator('#clear-key').click();assert.equal(await page.locator('#apiKey').inputValue(),'');
  assert.equal(await page.evaluate(()=>Object.values(sessionStorage).some(value=>value.includes('fixture-remembered-key'))),false);
 });
 await check('公网复用 CXXUser 的真实代码与凭据键，账号设置隔离、退出清会话',async()=>{
  const context=await setup();contexts.push(context);
  await context.addInitScript(expectedOrigin=>{if(location.origin===expectedOrigin&&!localStorage.getItem('cxx-oauth-token'))localStorage.setItem('cxx-oauth-token','site-A');},origin);
  await context.route('**/api/workshop/me',route=>{const token=route.request().headers().authorization;return route.fulfill({json:token==='Bearer site-B'?{ok:true,loggedIn:true,publisherId:'publisher-B',displayName:'B'}:{ok:true,loggedIn:true,publisherId:'publisher-A',displayName:'A'}});});
  const page=await open(context,'public');assert.equal(await page.evaluate(()=>typeof CXXUser.check),'function');
  await page.locator('#apiKey').fill('fixture-A-key');await page.locator('input[name=rememberKey]').check();await page.locator('#model-form button[type=submit]').click();
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('cxx2051:session'))),false);
  const other=await context.newPage();await other.goto(origin);await other.evaluate(()=>localStorage.setItem('cxx-oauth-token','site-B'));
  await page.waitForFunction(()=>localStorage.getItem('cxx2051:last-run:public:publisher-B'));
  assert.equal(await page.locator('#apiKey').inputValue(),'');
  await page.locator('#drawer-close').click();await page.locator('#logout-btn').click();assert.equal(await page.locator('#apiKey').inputValue(),'');assert.equal(await page.locator('#login-btn').isVisible(),true);
 });
}finally{for(const context of contexts)await context.close();await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
const report={at:new Date().toISOString(),scope:'隔离 Edge；真实 CXXUser 代码＋合成 /me；不含实际 OAuth 或模型',total:results.length,passed:results.filter(row=>row.ok).length,results,errors};
fs.writeFileSync(new URL('../reports/r3-account-browser.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for(const row of results)console.log((row.ok?'PASS ':'FAIL ')+row.name+(row.error?'\n'+row.error:''));
if(report.passed!==report.total||errors.length)process.exitCode=1;
