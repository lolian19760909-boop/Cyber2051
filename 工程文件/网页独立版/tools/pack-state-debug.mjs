import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {chromium} from 'playwright';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const EDGE=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,executablePath:EDGE});const context=await browser.newContext({viewport:{width:1400,height:900}});const page=await context.newPage();
await page.goto('http://127.0.0.1:8826/play/?mode=local',{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForSelector('dialog.cxx-pack-choice',{timeout:60000});
await page.locator('dialog.cxx-pack-choice input[value="standard"]').check();await page.locator('dialog.cxx-pack-choice button.primary').click();
await page.waitForSelector('dialog.cxx-pack-choice',{state:'detached',timeout:60000});
const state=async()=>page.evaluate(()=>{const vis=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {hidden:e.hidden,display:getComputedStyle(e).display,visible:r.width>0&&r.height>0};};return{status:document.querySelector('#status-line')?.textContent,splash:vis('.cx77-splash'),menu:vis('.cxx-game-menu'),notice:vis('.cxx-notice'),drawer:vis('#drawer-btn'),reading:vis('#reading-surface'),menuButtons:[...document.querySelectorAll('.cxx-game-menu button')].map(b=>b.textContent.trim()).slice(0,15),body:document.body.innerText.slice(0,500)};});
for(let i=0;i<20;i++){await page.waitForTimeout(2000);const s=await state();console.log(i,JSON.stringify(s));if(s.notice?.visible||s.menuButtons.includes('设置'))break;}
await page.screenshot({path:path.join(HERE,'..','..','.cache','play-loading-20261027','checks','pack-state.png')});
await page.keyboard.press('Space');await page.waitForTimeout(3000);console.log('AFTER SPACE',JSON.stringify(await state()));
await page.screenshot({path:path.join(HERE,'..','..','.cache','play-loading-20261027','checks','pack-state-after.png')});
await browser.close();