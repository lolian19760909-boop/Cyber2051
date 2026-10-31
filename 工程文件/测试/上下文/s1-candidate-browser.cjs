'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),T=require('../../工具/lib/terminal-preview.cjs');
const eng=path.resolve(__dirname,'../..'),file=process.env.CXX_TEST_CARD||path.join(eng,'.cache/context-s0/s1-checkpoint/赛博小祥2051-S1检查候选.json'),bytes=fs.readFileSync(file),card=JSON.parse(bytes),out=process.env.CXX_EVIDENCE||path.join(eng,'.cache/context-s0/packaged-ensemble');
const report={file,cardSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Actual checkpoint modules and terminal; synthetic host and save disk. Not real ST/TT or model acceptance.',checks:[],screens:[],errors:[]};
const server=http.createServer((q,r)=>r.end('<!doctype html>'));
(async()=>{let browser;fs.mkdirSync(out,{recursive:true});try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});
  for(const width of [1280,390]){
    const {page,frame,errors}=await T.environment(browser,'http://127.0.0.1:'+server.address().port,card,width,950);
    await page.evaluate(()=>{window.originalPlayer=JSON.stringify(c.chat[1].variables[0].stat_data.terminal.gameplay);terminal.openPage('characters','人物表');});
    const table=frame.locator('.cxx-ensemble');await table.getByRole('button',{name:'登记已确认的人物',exact:true}).click();
    try { await page.waitForFunction(()=>disk[2]?.variables?.[0]?.stat_data?.terminal?.ensemble?.actors?.wb_10); }
    catch(error){ report.failureState=await page.evaluate(()=>({metrics,warning:window.warning,stat:c.chat[1].variables[0].stat_data,disk}));report.failureText=await table.innerText();report.failureShadow=await table.evaluate(e=>e.shadowRoot?.textContent);throw error; }
    assert.equal(await page.evaluate(()=>disk[2].variables[0].stat_data.terminal.ensemble.actors.wb_10.wallet.yen),12000);
    assert.equal(await page.evaluate(()=>JSON.stringify(disk[2].variables[0].stat_data.terminal.gameplay)===originalPlayer),true);
    assert.equal(await table.getByRole('button',{name:'丰川祥子',exact:true}).count(),0);
    await table.getByLabel('查看方式',{exact:true}).selectOption('author');await table.getByRole('button',{name:'丰川祥子',exact:true}).click();
    await table.getByRole('button',{name:'装备',exact:true}).click();assert.equal(await table.getByRole('heading',{name:'从据点取得的手枪',exact:true}).count(),2);
    assert.equal(await table.getByRole('button',{name:'扮演此角色',exact:true}).count(),0,'no switch until sending and all consumers are connected');
    const screenshot=path.join(out,'table-'+width+'.png');await page.screenshot({path:screenshot});report.screens.push({width,file:screenshot});
    if(width<=850)await page.keyboard.press('Escape');
    await page.evaluate(async()=>{const stat=c.chat[1].variables[0].stat_data;await player.commit({action:'unequip',actorId:'wb_10',actorBinding:CxxEnsembleState.binding(stat,'wb_10'),slot:'weapon_1'});});
    await frame.evaluate(()=>CxxTerminalApp.invalidate({topic:'gameplay'}));
    await table.getByRole('button',{name:'丰川祥子',exact:true}).click();
    await table.getByRole('button',{name:'装备',exact:true}).click();
    await table.getByRole('heading',{name:'从据点取得的手枪',exact:true}).nth(1).waitFor({state:'detached'});
    assert.equal(await table.getByRole('heading',{name:'从据点取得的手枪',exact:true}).count(),1);
    assert.equal(await page.evaluate(()=>disk[2].variables[0].stat_data.terminal.ensemble.actors.wb_10.gameplay.equipment.weapon_1),null);
    assert.equal(await page.evaluate(()=>JSON.stringify(disk[2].variables[0].stat_data.terminal.gameplay)===originalPlayer),true);
    report.checks.push({width,pass:true,flow:'packaged terminal entry / register and actual save readback / viewpoint privacy / author equipment / actor mutation refresh / original player preserved / switch unavailable',metrics:await page.evaluate(()=>metrics)});
    await page.evaluate(()=>{terminal.destroy();player.stop();runtime.destroy();});report.errors.push(...errors);await page.close();
  }
  assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,screens:report.screens.length,checks:report.checks.length,errors:report.errors,failure:report.failure}));}})();
