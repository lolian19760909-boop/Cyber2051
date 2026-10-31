'use strict';
// City page (DESIGN.md 10.14): map with the tracked commission and current location on wide screens,
// list then detail on phones. Checks the same actions as before at six sizes, and the way back.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../../独立制卡器/workbench/node_modules/playwright'),T=require('../../工具/lib/terminal-preview.cjs');
const eng=path.resolve(__dirname,'../..'),bytes=fs.readFileSync(process.env.CXX_TEST_CARD||path.join(eng,'.cache/build/赛博小祥2051-V2.3.0.json')),card=JSON.parse(bytes),out=process.env.CXX_EVIDENCE||path.join(eng,'.cache/city230'),captureOnly=process.env.CXX_CAPTURE_ONLY==='1';
const report={cardSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Packaged terminal, city page and existing quest/archive navigation; map opening callbacks controlled; no player/model writes',screens:[],checks:[],errors:[]};
const server=http.createServer((q,r)=>r.end('<!doctype html>'));
async function shot(page,frame,id,width){const m=await frame.locator('.city-hud').evaluate(n=>({font:getComputedStyle(n).fontSize,view:n.dataset.view,overflow:document.documentElement.scrollWidth>innerWidth+2,localOverflow:n.scrollWidth>n.clientWidth+2,buttons:[...n.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0).map(b=>({name:b.textContent,height:b.getBoundingClientRect().height})),text:n.textContent}));assert(!m.overflow&&!m.localOverflow);assert.equal(m.font,'16px');assert(m.buttons.every(b=>b.height>=43.5),JSON.stringify(m.buttons));await page.screenshot({path:path.join(out,`${id}-${width}.png`)});report.screens.push({id,width,...m});}
(async()=>{let browser;fs.mkdirSync(out,{recursive:true});try{await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of (process.env.CXX_WIDTHS||'1440,1280,768,390,360,844').split(',').map(Number)){
  const e=await T.environment(browser,'http://127.0.0.1:'+server.address().port,card,width,width===844?390:width===1280?720:width===360?800:width===390?844:900),{page,frame}=e,narrow=width<=700;
  // Phones reach the location and commission through their list rows; each detail has its way back.
  const openDetail=async kind=>{if(!narrow)return;await frame.locator('.city-row').nth(kind==='here'?0:1).click();assert.equal(await frame.locator('.city-hud').getAttribute('data-view'),'detail');};
  const back=async()=>{if(!narrow)return;await frame.locator('.city-back').click();assert.equal(await frame.locator('.city-hud').getAttribute('data-view'),'list');};
  await page.evaluate(()=>{document.getElementById('send_textarea').hidden=true;window.mapCalls=[];window.CxxAtlasTool={open:()=>{mapCalls.push(['open']);return true;},focus:(map,place)=>{mapCalls.push(['focus',map,place]);return true;},read:()=>({shell:{mapId:'tokyo-central'}}),preferences(){}};});await frame.evaluate(()=>CxxTerminalApp.navigate('city'));await shot(page,frame,'empty',width);
  await page.evaluate(()=>{const sd=c.chat[1].variables[0].stat_data;sd.terminal.gameplay.location={mapId:'tokyo-central',placeId:'plaza'};sd.terminal.quests={q01:{state:'进行中',objective:'到指定交接点核对采购单，保留已确认目标。'}};sd.terminal.questJournal={schema:1,revision:1,tracked:'q01'};});await frame.evaluate(()=>CxxTerminalApp.invalidate({topic:'player'}));await shot(page,frame,'tracked',width);
  if(!captureOnly){
   await frame.locator('.city-here strong',{hasText:'新日本时代广场'}).waitFor({state:'attached'});assert((await frame.locator('.city-goal').textContent()).includes('保留已确认目标'));
   assert.equal(await frame.locator('.city-pin.is-here').getAttribute('hidden'),null,'current location pin shown');
   await openDetail('here');await shot(page,frame,'here',width);await frame.locator('.city-here .city-button').click();assert.deepEqual(await page.evaluate(()=>mapCalls.at(-1)),['focus','tokyo-central','plaza']);await back();
   await openDetail('track');await frame.locator('.city-track .city-button',{hasText:'查看追踪委托'}).click();await frame.waitForFunction(()=>CxxTerminalApp.page==='operations');await frame.evaluate(()=>CxxTerminalApp.navigate('city'));
   assert.equal(await frame.locator('.city-hud').getAttribute('data-view'),'list','returning to the city page starts at the list');
   await frame.locator('.city-entry-button',{hasText:'浏览地点资料'}).click();await frame.waitForFunction(()=>CxxTerminalApp.page==='archive');await frame.evaluate(()=>CxxTerminalApp.navigate('city'));
   await page.evaluate(()=>{const sd=c.chat[1].variables[0].stat_data;sd.terminal.gameplay.location={mapId:'future-map',placeId:'unknown'};sd.terminal.questJournal.tracked='unknown-quest';});await frame.evaluate(()=>CxxTerminalApp.invalidate({topic:'player'}));await shot(page,frame,'unknown',width);assert(await frame.locator('.city-here .city-button').isDisabled());
   assert.equal(await frame.locator('.city-here strong').textContent(),'地图未收录此地点');assert.equal(await frame.locator('.city-track h2').textContent(),'追踪委托暂不可读取');
   await page.evaluate(()=>delete window.CxxAtlasTool);await frame.locator('.city-entry-button',{hasText:'打开城市地图'}).click();await frame.getByText('城市地图尚未就绪，请稍后重试。',{exact:true}).waitFor();await shot(page,frame,'unavailable',width);
   report.checks.push({width,path:'current location / tracked objective / map focus / quest and archive navigation / phone list, detail and back / unknown references retained / missing map service feedback'});
  }
  assert.deepEqual(await page.evaluate(()=>({writes:metrics.writes,saves:metrics.saves})),{writes:0,saves:0});report.errors.push(...e.errors);await page.evaluate(()=>{terminal.destroy();player.stop();runtime.destroy();});await page.close();
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,screens:report.screens.length,checks:report.checks.length,errors:report.errors,failure:report.failure}));}
})();
