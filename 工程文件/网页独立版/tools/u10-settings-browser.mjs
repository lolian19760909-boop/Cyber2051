import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {createLocalServer} from './serve.mjs';

const server=createLocalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const checks=[],errors=[],network=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1440,height:960}});
let generations=0,selectionCalls=0,lastSelectionBody=null;
const selectionFrame='data: '+JSON.stringify({choices:[{delta:{content:'{"uids":[],"reason":"夹具不选任何条目"}'}}]})+String.fromCharCode(10,10)+'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+String.fromCharCode(10,10)+'data: [DONE]'+String.fromCharCode(10,10);
await context.route('https://**/*',route=>route.abort());
await context.route('**/api/play/connect',async route=>{
 const text=String(route.request().postData()||'');
 if(text.includes('目录挑选助手')){selectionCalls+=1;lastSelectionBody=text;await route.fulfill({status:200,contentType:'text/event-stream',body:selectionFrame});return;}
 generations+=1;
 const reply='<cxx-story>雨停了，诊所门口亮着一盏灯。<cxx-say speaker="千早爱音" expression="smile">进去问问吧。</cxx-say></cxx-story>';
 await route.fulfill({status:200,contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:reply}}]})+String.fromCharCode(10,10)+'data: [DONE]'+String.fromCharCode(10,10)});
});
const page=await context.newPage();page.setDefaultTimeout(20000);
page.on('pageerror',error=>errors.push(error.stack));
page.on('response',response=>{if(response.status()>=400)network.push(response.status()+' '+response.url());});
const saved=()=>page.waitForFunction(()=>!CxxWebApp.read().busy&&document.getElementById('status-line').textContent.includes('已提交'),null,{timeout:60000});
const view=()=>page.evaluate(async()=>({mode:CxxWebApp.session.agent.mode,books:await CxxWebApp.session.listBooks().catch(()=>[]),catalog:CxxWebApp.session.catalog,opts:CxxWebApp.session.promptOptions.selection,plan:CxxWebApp.session.plan,last:CxxWebApp.session.selection.last,runId:CxxWebApp.session.identity.runId,keys:Object.keys(localStorage).filter(key=>key.includes('cxx2051:prompt:'))}));
let phase='boot';
try{
 phase='boot';
 await page.goto(origin+'/?mode=local&baseUrl=https%3A%2F%2Ffixture.invalid%2Fv1&model=synthetic');
 await page.locator('.cxx-opening-flow').waitFor();
 const next=async step=>{await page.locator('.opening-next').click();if(step)await page.locator('.cxx-opening-flow[data-step="'+step+'"]').waitFor();};
 await next('origin');await next('profile');await page.getByLabel('姓名',{exact:true}).fill('U10 设置回归');await next('growth');await next('loadout');await next('scenario');await page.getByRole('button',{name:/街头/}).last().click();await next('review');await next();
 await page.waitForFunction(()=>CxxWebApp.read().booted&&CxxWebApp.ui,null,{timeout:60000});
 checks.push('生产开局可进入游戏界面');

 phase='settings';
 await page.locator('#drawer-btn').click();
 const panel=page.locator('#session-settings');
 await panel.locator('summary',{hasText:'世界书接管与选择'}).click();
 assert.match(await panel.innerText(),/作用范围：本故事/);checks.push('设置面板出现「世界书接管与选择」并标明作用范围');

 const base=await view();
 assert.equal(base.mode,'off');
 await panel.getByLabel('接管模式').selectOption('takeover');
 await page.waitForFunction(()=>CxxWebApp.session.agent.mode==='takeover',null,{timeout:10000});
 checks.push('接管模式改动落到本故事 Agent 记录');

 assert.ok(base.books.length>=1,'世界书至少一本');
 const takeBtn=panel.getByRole('button',{name:'接管这本书'}).first();
 await takeBtn.click();
 await page.waitForFunction(()=>CxxWebApp.session.agent.books.length>0,null,{timeout:15000});
 assert.match(await panel.innerText(),/已接管/);checks.push('接管这本书写入接管基线');
 await panel.getByRole('button',{name:'恢复原配置'}).first().click();
 await page.waitForFunction(()=>CxxWebApp.session.agent.books.length===0,null,{timeout:15000});
 checks.push('恢复原配置读回接管前快照');

 await panel.getByLabel('条目批大小').fill('2');
 await panel.getByLabel('选择策略').selectOption('destiny');
 await panel.getByRole('button',{name:'保存选择设置'}).click();
 const tuned=await view();
 assert.equal(tuned.opts.strategy,'destiny');
 assert.equal(tuned.opts.params.entryBatch,2);
 checks.push('选择策略与批次参数保存后进入下一次请求');

 await page.locator('#drawer-close').click();
 await page.locator('#native-btn').click();
 await page.locator('#input').fill('去诊所看看义体名录');
 await page.locator('#send').click();
 await saved();
 const after=await view();
 assert.ok(after.plan,'本轮留下选择方案');
 assert.ok(after.plan.counts.managed>0,'方案带完整目录');
 assert.equal(after.plan.calls[0]?.stage,'catalog','命定策略先走目录批');
 assert.equal(after.plan.counts.selected,0,'夹具回空目录即本轮不选');
 checks.push('改参数后下一轮真实按新策略发请求');

 await page.locator('#drawer-btn').click();
 await panel.getByRole('button',{name:'刷新请求详情'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#session-settings pre')].some(el=>el.textContent.includes('counts')),null,{timeout:20000});
 const detail=await page.evaluate(()=>[...document.querySelectorAll('#session-settings pre')].map(el=>el.textContent).join('\n'));
 assert.match(detail,/"counts"/);
 checks.push('请求详情展示选中／排除／调用／写回');

 phase='skill';
 await panel.locator('summary',{hasText:'Skill 生成与修补'}).click();
 await page.waitForFunction(()=>document.querySelector('#session-settings')?.innerText.includes('生成的 Skill 提示与修补规则'),null,{timeout:15000});
 const uid=await page.evaluate(()=>CxxWebApp.session.listSkillItems()[0]?.uid||'');
 assert.ok(uid,'目录里有可修补条目');
 await panel.getByLabel('目录条目').selectOption(uid);
 await panel.getByLabel('条目说明').fill('人工修补：U10 验收写入的说明');
 await panel.getByLabel('触发词（逗号分隔）').fill('U10-FIXTURE-KEY');
 await panel.getByRole('button',{name:'保存修补'}).click();
 await page.waitForFunction(()=>CxxWebApp.session.catalog.patched===1,null,{timeout:15000});
 const patched=await page.evaluate(()=>{const row=CxxWebApp.session.listSkillItems().find(item=>item.patched);return {uid:row?.uid,description:row?.description,keywords:row?.keywords,indexHash:CxxWebApp.session.catalog.indexHash};});
 assert.equal(patched.uid,uid);
 assert.equal(patched.description,'人工修补：U10 验收写入的说明');
 assert.deepEqual(patched.keywords,['U10-FIXTURE-KEY']);
 checks.push('Skill 修补写入本故事并重算条目 hash');

 phase='reload';
 const beforeReload=(await view()).runId;
 await page.reload();
 await page.waitForFunction(()=>CxxWebApp.read().booted&&CxxWebApp.session,null,{timeout:60000});
 const reloaded=await view();
 assert.equal(reloaded.runId,beforeReload);
 assert.equal(reloaded.mode,'takeover','接管模式随故事保存');
 assert.equal(reloaded.opts.strategy,'destiny','选择设置随故事保存');
 assert.ok(reloaded.keys.some(key=>key.includes(beforeReload)),'偏好按故事分开存');
 assert.equal(reloaded.catalog.patched,1,'Skill 修补随故事保存');
 assert.ok(reloaded.catalog.items>0,'刷新后知识目录仍在');
 checks.push('刷新后接管模式、选择设置与 Skill 修补读回，且按故事分键');

 await page.locator('#drawer-btn').click();
 await panel.locator('summary',{hasText:'Skill 生成与修补'}).click();
 await panel.getByRole('button',{name:'清除修补'}).click();
 await page.waitForFunction(()=>CxxWebApp.session.catalog.patched===0,null,{timeout:15000});
 checks.push('清除修补回到生成结果');

 phase='mobile';
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{document.getElementById('drawer').dataset.open='true';for(const row of document.querySelectorAll('#session-settings details'))if((row.querySelector('summary')?.textContent||'').includes('世界书接管与选择'))row.open=true;});
 const mobileMode=panel.getByLabel('接管模式');
 await mobileMode.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const el=[...document.querySelectorAll('#session-settings label')].find(row=>(row.textContent||'').includes('接管模式'));return !!el&&el.getBoundingClientRect().height>0;},null,{timeout:15000});
 assert.ok(await mobileMode.isVisible());
 await panel.getByRole('button',{name:'保存选择设置'}).click();
 checks.push('移动端可口径完成同样设置操作');

 assert.deepEqual(errors,[]);
 assert.deepEqual(network.filter(line=>!line.includes('/favicon.ico')),[]);
}catch(error){
 errors.push(error.stack);errors.push('VIEW '+JSON.stringify(await page.evaluate(()=>{try{const s=CxxWebApp.session;return {status:document.getElementById('status-line')?.textContent||'',mode:s?.agent?.mode,opts:s?.promptOptions?.selection,catalog:s?.catalog,skillItems:s?.listSkillItems?.().length,skillOptions:[...document.querySelectorAll('#session-settings select')].map(el=>({label:el.closest('label')?.textContent?.trim().slice(0,8),value:el.value,opts:el.options.length}))};}catch(inner){return {inner:String(inner)}};}).catch(()=>null)));
}finally{
 fs.writeFileSync(new URL('../reports/u10-settings-browser.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),phase,scope:'维护源＋真实Edge/IDB；受控模型响应',checks,errors,network,generations,selectionCalls,lastSelectionBody:lastSelectionBody?lastSelectionBody.slice(0,400):null},null,2)+String.fromCharCode(10));
 await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 checks.forEach(c=>console.log('PASS '+c));errors.forEach(e=>console.log('FAIL '+e));
 console.log('U10='+(errors.length?1:0));
}
