/** Calls the existing card template importer, never creates model replies or edits state. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const maintained=process.argv.includes('--maintained-template')?JSON.parse(fs.readFileSync(new URL('../../数据/表格模板-cxx15.json',import.meta.url),'utf8')):null;
const adapter=maintained?fs.readFileSync(new URL('../../卡片源码/数据/store.js',import.meta.url),'utf8'):null;
const fixture=JSON.parse(fs.readFileSync(new URL('../reports/r4-browser-check.json',import.meta.url))).fixture;
assert(/^WEB_HOST_TEST_.*\.png$/.test(fixture.avatar)&&/^web-controlled-/.test(fixture.chatId));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}),context=await browser.newContext(),page=await context.newPage(),consoleErrors=[],failed=[];let result,error;
await context.route('https://**/*',route=>route.abort());
page.on('console',msg=>{if(msg.type()==='error'&&/ACU|[Ss][Qq][Ll]|[Tt]emplate|模板|[Dd]atabase/.test(msg.text()))consoleErrors.push(msg.text().slice(0,1200));});
page.on('requestfailed',req=>{const u=new URL(req.url());failed.push({path:u.origin+u.pathname,error:req.failure()?.errorText});});
async function dialogs(){const ok=page.locator('dialog[open] .popup-button-ok,dialog[open] .popup-button-yes,dialog[open].cxx-announcement button').last();if(await ok.isVisible().catch(()=>false))await ok.click({timeout:500}).catch(()=>{});const helper=page.locator('.TH-popup').filter({hasText:fixture.avatar}).filter({hasText:'嵌入式脚本'});if(await helper.isVisible().catch(()=>false))await helper.getByRole('button',{name:'确认',exact:true}).click({timeout:500}).catch(()=>{});}
async function operation(fn,arg){let done=false,value,failure;page.evaluate(fn,arg).then(v=>{done=true;value=v;},e=>{done=true;failure=e;});const until=Date.now()+120000;while(!done&&Date.now()<until){await dialogs();await new Promise(r=>setTimeout(r,100));}if(!done)throw Error('原插件操作120秒未结束');if(failure)throw failure;return value;}
try{
 console.log('STEP fixture-load');await page.goto('http://127.0.0.1:22351');await page.waitForFunction(()=>globalThis.SillyTavern&&document.querySelector('#cxx2051-open-web')?.disabled===false);
 await operation(async({avatar,chatId})=>{let c=SillyTavern.getContext();await c.getCharacters();c=SillyTavern.getContext();const i=c.characters.findIndex(row=>row.avatar===avatar);if(i<0)throw Error('隔离卡缺失');await c.selectCharacterById(i);await SillyTavern.getContext().openCharacterChat(chatId);},fixture);
 await page.waitForFunction(()=>globalThis.CxxDataStore?.template&&globalThis.AutoCardUpdaterAPI?.importTemplateFromData,null,{timeout:60000});
 console.log('STEP original-controller-idle');await operation(()=>Cxx233Updater.whenIdle());
 console.log('STEP original-template-import');result=await operation(async({maintained,adapter})=>{const a=AutoCardUpdaterAPI,template=maintained||CxxDataStore.template,pick=value=>({keys:Object.keys(value||{}).filter(k=>k.startsWith('sheet_')).map(k=>({key:k,name:value[k]?.name,header:value[k]?.content?.[0]}))});const before=pick(a.exportTableAsJson()),stored=pick(a.getTableTemplate?.({scope:'chat'}));let ack,ensured;if(maintained){const module={exports:{}};new Function('module','exports',adapter)(module,module.exports);const live={exportTableAsJson:()=>a.exportTableAsJson(),getTableTemplate:options=>a.getTableTemplate(options),async importTemplateFromData(...args){ack=await a.importTemplateFromData(...args);return ack;}};const result=await module.exports.ensureSchema(live,template);ensured={ok:result.ok,reason:result.reason,attempts:result.attempts};}else ack=await a.importTemplateFromData(template,{scope:'chat',dataMode:'merge',conflictPolicy:'overwrite'});return {template:pick(template),before,stored,ack,ensured,after:pick(a.exportTableAsJson())};},{maintained,adapter});
 console.log(JSON.stringify(result));
}catch(cause){error=cause.message;console.log('FAIL '+error);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(new URL(maintained?'../reports/r4-native-db-repaired-template.json':'../reports/r4-native-db-inspect.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),fixture,scope:maintained?'actual ACU importer validation of maintained repaired template, retaining existing chat schemas; not a rebuilt-card or native-settlement pass':'same actual native schema importer and original template; no model/reply/state/receipt edits',result,error,consoleErrors,failed},null,2)+'\n');}
