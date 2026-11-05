import {checkCreatorMobile} from './creator-mobile-cases.mjs';
import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright';
import {createPackagedServer} from './local-runtime.mjs';
const out=path.resolve(process.env.CXX_CREATOR_EVIDENCE||'.cache/feedback-implementation-20261105/mobile-fixed'),root=path.resolve(process.env.CXX_CREATOR_PACKAGE||'.cache/feedback-implementation-20261105/package'),release=JSON.parse(fs.readFileSync(path.join(root,'current.json'))).release;
fs.mkdirSync(out,{recursive:true});
const server=createPackagedServer({root});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const report={release,scope:'isolated desktop Edge mobile viewport and native CDP IME events; Chrome unavailable',checks:[],errors:[],modelRequests:0};let browser,page,phase='boot';
const shot=async name=>page.screenshot({path:path.join(out,name+'.png')});
try{
 browser=await chromium.launch({headless:true,channel:'msedge'});report.browser=browser.version();const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',error=>report.errors.push(error.message));
 await context.route('**/api/workshop/announcements',route=>route.fulfill({json:{ok:true,items:[]}}));
 await context.route('**/api/play/connect',route=>{report.modelRequests++;return route.fulfill({json:{choices:[{message:{content:'<cxx-story>用于诊断的合成正文。</cxx-story>'},finish_reason:'stop'}]}});});
 await page.goto(base+'/releases/'+release+'/index.html?mode=local&baseUrl=https%3A%2F%2Ffixture.invalid%2Fv1&model=synthetic');await page.locator('.cxx-pack-choice button').first().waitFor({timeout:60000});await page.locator('.cxx-pack-choice button').first().click();await page.waitForFunction(()=>!!window.CxxOpeningPage&&!document.querySelector('.cxx-boot'),null,{timeout:180000});
 const later=page.getByRole('button',{name:'稍后再说',exact:true});if(await later.isVisible())await later.click();await page.locator('.cx77-splash[data-phase=title]').waitFor();await page.locator('.cx77-splash[data-phase=title]').click();await page.locator('.cx77-splash').waitFor({state:'detached'});if(await later.isVisible())await later.click();
 phase='creation';await page.getByRole('button',{name:'新游戏',exact:true}).click();await page.locator('.cxx-game-setup').waitFor();await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:/开始创建|创建角色|创建人物|继续创建/}).click();await page.locator('.cxx-opening-flow').waitFor();
 const next=async step=>{await page.locator('.opening-next').click();await page.locator('.cxx-opening-flow[data-step="'+step+'"]').waitFor();};await next('origin');await next('profile');await shot('01-profile-portrait');
 phase='creator-mobile-cases';report.ok=await checkCreatorMobile({page,context,out,report});
}catch(error){report.ok=false;report.phase=phase;report.error=error.stack;if(page){await shot('failure').catch(()=>{});report.surface=await page.locator('body').innerText().catch(()=>null);}}
finally{fs.writeFileSync(path.join(out,'creator-probe.json'),JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;console.log(JSON.stringify({ok:report.ok,phase:report.phase,error:report.error,checks:report.checks.map(({case:field,scenario,composition,afterMiddleInsert,ok,events,geometry})=>({field,scenario,composition,afterMiddleInsert,ok,activeValueWrites:events.filter(e=>e.event==='active-value-set').length,scrollBox:geometry.ancestors.find(n=>n.cls==='creator-parameters')?.box})),errors:report.errors}));await browser?.close();await new Promise(resolve=>server.close(resolve));}
