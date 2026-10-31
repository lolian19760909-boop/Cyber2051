import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createLocalServer} from './serve.mjs';
const server=createLocalServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,checks=[],errors=[],network=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1440,height:960}});
await context.route('https://**/*',route=>route.abort());
let generations=0,selectionCalls=0;
const selectionFrame='data: '+JSON.stringify({choices:[{delta:{content:'{"uids":[],"reason":"夹具不选任何条目"}'}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
await context.route('**/api/play/connect',async route=>{
 if(String(route.request().postData()||'').includes('目录挑选助手')){selectionCalls++;await route.fulfill({status:200,contentType:'text/event-stream',body:selectionFrame});return;}
 generations++;
 const reply='<cxx-story>你沿着确认过的道路走到巴的诊所，停在诊所的门口。<cxx-say speaker="千早爱音" expression="smile">我们到了，先问问能不能进去吧。</cxx-say></cxx-story><UpdateVariable>'+JSON.stringify([{op:'replace',path:'/terminal/gameplay/location/mapId',value:'tokyo-central'},{op:'replace',path:'/terminal/gameplay/location/placeId',value:'a-yang-clinic'}])+'</UpdateVariable>';
 await route.fulfill({status:200,contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:reply}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});
});
const page=await context.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.stack));
page.on('response',response=>{if(response.status()>=400)network.push(response.status()+' '+response.url());});
let phase='boot';
const shot=name=>fileURLToPath(new URL('../reports/p3a-'+name+'.png',import.meta.url));
const inspect=()=>page.evaluate(async()=>({revision:(await CxxWebApp.statePort.readHead(CxxWebApp.session.identity.runId)).revision,state:CxxWebApp.session.currentState,last:CxxWebApp.session.nodes.at(-1),body:CxxWebApp.session.narrativeNode}));
const saved=()=>page.waitForFunction(()=>!CxxWebApp.read().busy&&document.getElementById('status-line').textContent.includes('已提交'));
try{
 console.log('STEP boot');
 await page.goto(origin+'/?mode=local&baseUrl=https%3A%2F%2Ffixture.invalid%2Fv1&model=synthetic');
 await page.locator('.cxx-opening-flow').waitFor();
 await page.screenshot({path:shot('creation'),fullPage:true});
 const next=async step=>{await page.locator('.opening-next').click();if(step)await page.locator('.cxx-opening-flow[data-step="'+step+'"]').waitFor();};
 await next('origin');await next('profile');await page.getByLabel('姓名',{exact:true}).fill('原卡UI回归');await next('growth');await next('loadout');await next('scenario');await page.getByRole('button',{name:/街头/}).last().click();await next('review');await next();
 checks.push('原六步人物创建实际交互并保存');
 phase='gameplay';console.log('STEP gameplay');
 await page.waitForFunction(()=>CxxWebApp.read().booted&&CxxWebApp.ui,{timeout:45000});await page.locator('#cxx-galgame-root').waitFor();await page.locator('.cxx-boot-overlay').waitFor({state:'detached'}).catch(()=>{});
 await page.screenshot({path:shot('gal-red'),fullPage:true});checks.push('原Gal原CSS/UI与已提交开局真实装配');
 await page.locator('#native-btn').click();await page.locator('.cxx-native-reading .mes_text').waitFor();assert.ok((await page.locator('.mes_text').innerText()).length>10);checks.push('原生/Gal切换读取同一已保存正文');
 phase='player';console.log('STEP player');
 await page.locator('#player-btn').click();await page.locator('.cxx-web-terminal').waitFor({state:'visible'});await page.getByRole('button',{name:'物品栏',exact:true}).last().click();
 await page.getByRole('heading',{name:'物品栏',exact:true}).waitFor();await page.screenshot({path:shot('player-inventory'),fullPage:true});
 const beforeProgram=await inspect(),weapon=page.getByLabel('当前使用武器',{exact:true});await weapon.selectOption('');
 await page.getByRole('button',{name:'保存装配',exact:true}).waitFor();await page.getByRole('button',{name:'保存装配',exact:true}).click();await page.waitForFunction(rev=>CxxWebApp.session.nodes.at(-1).message.kind==='program'&&CxxWebApp.read().ui.revision>rev,beforeProgram.revision);
 const afterProgram=await inspect();assert.equal(afterProgram.body.nodeId,beforeProgram.body.nodeId);assert.equal(generations,0);checks.push('原人物装备操作经规则校验提交程序节点，不改正文、不调用模型');
 await page.getByRole('button',{name:'收起',exact:false}).first().click();
 phase='map';console.log('STEP map');
 const beforeMap=await inspect();await page.locator('#map-btn').click();await page.locator('.cxx-atlas-tool').waitFor({state:'visible'});const map=page.frameLocator('#cxx-independent-atlas');await map.locator('#atlas').waitFor({timeout:45000});await map.locator('.hud-rail [data-part=索引]').click();await map.locator('#atlas-search').fill('诊所');await map.locator('#node-list [data-node="a-yang-clinic"]').click();
 await page.screenshot({path:shot('map'),fullPage:true});
 await map.getByRole('button',{name:'前往此处 ↗',exact:true}).click();
 assert.equal((await inspect()).revision,beforeMap.revision);assert.match(await page.locator('#input').inputValue(),/巴.*诊所/);assert.equal(generations,0);
 await page.locator('#send').click();await saved();const afterMove=await inspect();assert.equal(afterMove.state.terminal.gameplay.location.placeId,'a-yang-clinic');assert.equal(generations,1);assert.ok(selectionCalls>=1,'目录选择在生产回合里真实发起');checks.push('地图浏览/行动只填草稿；模型合法到达提议经过校验及原子提交，未免费传送');
 await page.locator('[data-bda="anon"]').waitFor();checks.push('原61角色气泡runtime实际装饰千早爱音台词，表情与头像读取原资源');
 await page.locator('#input').fill('接着问问诊所的营业时间。');await page.locator('#send').click();await saved();assert.equal(generations,2);checks.push('移动后下一回合正常生成、提交');
 phase='theme';await page.locator('#theme-btn').click();assert.equal(await page.locator('html').getAttribute('data-cxx-theme'),'yellow');await page.locator('#gal-btn').click();await page.screenshot({path:shot('gal-yellow'),fullPage:true});await page.locator('#theme-btn').click();assert.equal(await page.locator('html').getAttribute('data-cxx-theme'),'night');checks.push('原红/黄/夜主题运行时切换');
 phase='memory';await page.locator('#drawer-btn').click();await page.getByRole('button',{name:'记忆与历史整理',exact:true}).click();await page.locator('.cxx-memory-dialog').waitFor({state:'visible'});await page.getByRole('button',{name:'历史整理',exact:true}).click();await page.locator('.cxx-memory-dialog').getByRole('button',{name:'确认并开始整理',exact:true}).waitFor();checks.push('唯一数据库历史整理界面，连续覆盖预览/开始/恢复入口真实装载');
 assert.deepEqual(errors,[]);assert.deepEqual(network.filter(line=>!line.includes('/favicon.ico')),[]);
}catch(error){errors.push(error.stack);errors.push('STATUS '+await page.locator('#status-line').textContent().catch(()=>''));errors.push('NETWORK '+JSON.stringify(network));errors.push('TURN '+JSON.stringify(await page.evaluate(()=>({error:CxxWebApp.session.coordinator.lastError?.message,code:CxxWebApp.session.coordinator.lastError?.code,issues:CxxWebApp.session.coordinator.lastError?.issues,detail:CxxWebApp.session.coordinator.lastError?.detail})).catch(()=>null)));await page.screenshot({path:shot('failure'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{fs.writeFileSync(new URL('../reports/p3a-browser-check.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),phase,scope:'维护源原UI＋真实Edge/IDB/逐文件Asset；受控模型响应，非真实模型验收',checks,errors,network,generations},null,2)+'\n');await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
checks.forEach(c=>console.log('PASS '+c));errors.forEach(e=>console.log('FAIL '+e));

