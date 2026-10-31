import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const context=await browser.newContext({viewport:{width:1440,height:960}});await context.route('https://**/*',route=>route.abort());
const page=await context.newPage();page.on('pageerror',e=>console.log('PAGE_ERROR',e.message.slice(0,300)));
try{await page.goto('http://127.0.0.1:22351');await page.waitForFunction(()=>globalThis.SillyTavern?.getContext&&globalThis.TavernHelper?.generateRaw,{},{timeout:40000});await page.locator('#cxx2051-open-web').waitFor({state:'attached',timeout:40000});
console.log(JSON.stringify(await page.evaluate(()=>({title:document.title,buttons:[...document.querySelectorAll('dialog button,.popup button')].map(x=>x.textContent),text:document.body.innerText.slice(-3000),context:Object.keys(SillyTavern.getContext()),helper:typeof TavernHelper.generateRaw,web:!!document.querySelector('#cxx2051-open-web')})),null,2));
}finally{await browser.close();}
