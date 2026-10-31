'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http'),vm=require('vm');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),B=require('./build.cjs'),T=require('../../lib/terminal-preview.cjs');
async function main(){
 const {card,receipt}=await B.build({write:true}),out=path.join(B.root,'.cache/quests-ui');fs.mkdirSync(out,{recursive:true});
 const fixture={window:{}};vm.runInNewContext(B.source('终端/data.js'),fixture);const definitions=fixture.window.T2051_DATA.quests;
 const report={sha256:receipt.output.sha256,kind:'Packaged terminal / real player-host save and readback, isolated Edge fixture; not live ST/TT',checks:[],errors:[]};
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8">');}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});let page;
 try{
  const env=await T.environment(browser,'http://127.0.0.1:'+server.address().port,card,1280,900);page=env.page;const frame=env.frame;report.errors=env.errors;
  await page.evaluate(defs=>{Cxx236VariableGuard.questDefinition=(id,r)=>defs.find(q=>q.id===id);c.chat[1].variables[0].stat_data.terminal.wallet={yen:150000,earned:150000,spent:0};window.disk=structuredClone([{chat_metadata:c.chatMetadata},...c.chat]);},definitions);
  await page.evaluate(art=>{window.CxxMenuArt=art;terminal.openPage('operations');},JSON.parse(B.source('运行时/menu-assets.json')));
  await frame.evaluate(()=>CxxTerminalApp.navigate('operations'));
  await frame.locator('.cxx-journal').waitFor();assert.equal(await frame.locator('.journal-row').count(),11);assert.equal(await page.evaluate(()=>metrics.writes),0);
  await frame.locator('[data-quest-id=q01]').click();assert.equal(await page.evaluate(()=>metrics.writes),0);
  await frame.getByRole('button',{name:'接取委托',exact:true}).click();await frame.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.evaluate(()=>metrics.writes),0);
  await frame.getByRole('button',{name:'接取委托',exact:true}).click();await frame.getByRole('button',{name:'确认接取',exact:true}).click();await frame.getByText('已保存，并从聊天文件读回确认。',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>disk[2].variables[0].stat_data.terminal.quests.q01.state),'已接取');assert.equal(await page.evaluate(()=>disk[2].variables[0].stat_data.terminal.wallet.yen),150000);
  report.checks.push('11 formal quests only; viewing/confirmation cancellation never writes; accept writes only selected quest and reads disk back');
  await frame.getByRole('button',{name:'开始执行',exact:true}).click();await frame.getByText('已保存，并从聊天文件读回确认。',{exact:true}).waitFor();
  await frame.getByRole('button',{name:'追踪',exact:true}).click();await frame.getByText('已保存，并从聊天文件读回确认。',{exact:true}).waitFor();
  await frame.getByRole('button',{name:'写入行动 ↗',exact:true}).click();assert((await page.locator('#send_textarea').inputValue()).includes('阿杨的采购单'));const savedDraft=await page.locator('#send_textarea').inputValue();await frame.getByRole('button',{name:'写入行动 ↗',exact:true}).click();assert.equal(await page.locator('#send_textarea').inputValue(),savedDraft);
  report.checks.push('Start distinct from accept; tracking stored; action draft preserves existing player input and never calls a model');
  await frame.locator('[data-quest-id=q01]').click();
  for(const [width,height]of [[1280,900],[768,900],[390,844],[844,390]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);
   if(width===390){await frame.getByRole('button',{name:'‹ 返回列表',exact:true}).click();await frame.locator('.journal-list').evaluate(e=>e.scrollTop=130);await page.screenshot({path:path.join(out,'journal-list-390.png')});await frame.locator('[data-quest-id=q03]').click();}
   await page.screenshot({path:path.join(out,'journal-detail-'+width+'.png')});
   assert(await frame.locator('.cxx-journal').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&e.scrollWidth<=e.clientWidth+1;}),'journal viewport '+width);
   assert(await frame.locator('.journal-actions').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0;}),'action footer '+width);
  }
  report.checks.push('390/768/1280 and 844x390 layouts; mobile B independent details; footer in viewport; no horizontal overflow');
  await page.setViewportSize({width:1280,height:900});await frame.locator('[data-quest-id=q02]').click();await page.evaluate(()=>failSave=true);await frame.getByRole('button',{name:'接取委托',exact:true}).click();await frame.getByRole('button',{name:'确认接取',exact:true}).click();await frame.getByRole('button',{name:'重试保存',exact:true}).waitFor();const ids=await page.evaluate(()=>Object.keys(c.chat[1].variables[0].stat_data.terminal.questJournal.receipts));await page.evaluate(()=>failSave=false);await frame.getByRole('button',{name:'重试保存',exact:true}).click();await frame.getByText('已保存，并从聊天文件读回确认。',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>Object.keys(disk[2].variables[0].stat_data.terminal.questJournal.receipts)),ids);
  report.checks.push('Save failure keeps request; same receipt retry saves once with no duplicated record/reward');
  await page.evaluate(()=>{const old=structuredClone(c.chat[1].variables[0]);old.stat_data.terminal.quests.unknown_old={state:'完成',title:'旧记录的长名称测试',alien:{kept:9}};c.chat[1].variables[0]=old;});await frame.evaluate(()=>CxxTerminalApp.invalidate({topic:'data'}));await frame.locator('[data-quest-id=unknown_old]').click();assert.equal(await frame.getByRole('button',{name:'接取委托',exact:true}).count(),0);assert(await frame.getByText('此记录的内容包未加载。',{exact:false}).count());
  await frame.getByRole('button',{name:'主线',exact:true}).click();assert.equal(await frame.locator('.journal-row').count(),0);assert.equal(await frame.locator('.cxx-journal').getByText(/盗芯之夜/).count(),0);
  report.checks.push('Unknown old records survive and display read-only; no draft/new mainline content loaded');
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }catch(e){if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
