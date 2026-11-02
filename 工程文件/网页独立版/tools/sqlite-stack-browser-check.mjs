/** Real bundled SQLite: repeated successful and failed reads must leave saving usable. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createPackagedServer} from './local-runtime.mjs';

const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../dist/',import.meta.url)));
const out=path.resolve(process.argv[3]||'.cache/sqlite-stack-check.json');
const release=process.argv[4]||JSON.parse(fs.readFileSync(path.join(root,'current.json'))).release;
const app=createPackagedServer({root}),server=http.createServer((req,res)=>{
 if(req.url==='/sqlite-stack-check')return res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end('<!doctype html><title>SQLite query lifetime check</title>');
 if(req.url==='/favicon.ico')return res.writeHead(204).end();
 app.emit('request',req,res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,report={buildId:release,scope:'Isolated browser, actual packaged database plugin and public sqlState API; synthetic state, 0 model requests',checks:[],errors:[]};
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 for(const missingTable of [false,true]){
  const page=await browser.newPage();page.on('pageerror',error=>report.errors.push(error.message));await page.goto(base+'/sqlite-stack-check');
  const result=await page.evaluate(async({release,missingTable})=>{
   const {prepareDatabase}=await import('/releases/'+release+'/src/database/runtime.mjs'),{host,template}=await prepareDatabase();
   await host.bind({chatId:'stack-check',rows:[{mes:'数据库查询检查',name:'检查',swipe_id:0}],save:async()=>{},request:async()=>{throw Error('Unexpected model request');}});
   const imported=await host.api.importTemplateFromData(template,{scope:'chat'});if(!imported.success)throw Error(imported.message);
   const value=[{path:'/saved',json:'"still usable"'}],count=350000,started=performance.now();let failures=0;
   if(!missingTable)host.sqlState.replace(value);
   for(let i=0;i<count;i++){
    if(missingTable){try{host.sqlState.read();}catch(error){if(!error.message.includes('no such table'))throw error;failures++;}}
    else if(host.sqlState.read()[0]?.json!==value[0].json)throw Error('Saved state changed during repeated reads');
   }
   host.sqlState.replace(value);
   if(JSON.stringify(host.sqlState.read())!==JSON.stringify(value))throw Error('State cannot be saved and restored after repeated queries');
   if(missingTable&&failures!==count)throw Error('Missing-table reads did not reach the expected failure path');
   return {case:missingTable?'failed reads then save/restore':'successful reads then save/restore',count,expectedErrors:failures,ms:Math.round(performance.now()-started),saved:true};
  },{release,missingTable});
  report.checks.push(result);await page.close();console.log('PASS '+result.case+' ('+result.count+' reads)');
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.ok=false;report.error=error.message;process.exitCode=1;console.error('FAIL '+error.message);}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({buildId:release,checks:report.checks.length,ok:report.ok,out}));
