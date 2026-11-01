/** 页内原文编辑器组件合同检查：在真实发布模块上验证 dialog 全文展示、保存调用 reprocessNode、取消与回调。无游戏启动、无模型调用。 */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';import {createPackagedServer} from './local-runtime.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;};
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(arg('--root','工程文件/.cache/raw-editor-20261101/package')),out=path.resolve(arg('--out','工程文件/.cache/raw-editor-20261101/raw-editor-check.json'));
const current=JSON.parse(fs.readFileSync(path.join(root,'current.json')));
const server=await new Promise(resolve=>{const s=createPackagedServer({root});s.listen(0,'127.0.0.1',()=>resolve(s));});
const base='http://127.0.0.1:'+server.address().port;
const report={at:new Date().toISOString(),buildId:current.release,scope:'Real shipped module in isolated browser with a stub session; no game boot, no model call',errors:[],steps:[],shots:[]};let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const page=await (await browser.newContext({viewport:{width:1280,height:900}})).newPage();page.setDefaultTimeout(20000);
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/releases/'+current.release+'/index.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const {mountRawEditor}=await import('./src/ui/raw-editor.mjs');
  const RAW='那段原本满怀期待的异国之旅，最终以最灰暗的方式提前画上了句号。\n\n<think>被格式规则隐藏的思考内容：这里是完整原文的一部分</think>\n\n<danmu>被隐藏的弹幕内容</danmu>';
  const calls=[],saved=[];
  const session={reprocessNode:async(nodeId,options)=>{calls.push({nodeId,options});return {status:'committed'};}};
  const editor=mountRawEditor({session,busy:()=>false,onSaved:result=>saved.push(result),onError:error=>saved.push({error:error.message})});
  const node={nodeId:'floor-1',message:{kind:'opening',raw:RAW,input:{text:'【开始】【开场白】场景生成指令'}}};
  editor.open(node);
  const dialog=document.querySelector('dialog.cxx-raw-editor');
  const open=!!dialog&&dialog.open,anchor=!!dialog.closest('body')&&!document.querySelector('.cxx-story-library');
  const textarea=dialog.querySelector('textarea');
  const fullRaw=textarea.value.includes('被格式规则隐藏的思考内容')&&textarea.value.includes('被隐藏的弹幕内容')&&textarea.value.includes('那段原本满怀期待的异国之旅');
  const actionValue=[...dialog.querySelectorAll('textarea')][1].value;
  textarea.value=RAW+'\n\n（编辑测试）新的结尾行。';
  dialog.querySelector('button').click();
  await new Promise(resolve=>setTimeout(resolve,120));
  const afterSave={closed:!dialog.open,calls,saved};
  // 取消路径：再次打开后点取消
  editor.open(node);const cancel=dialog.querySelectorAll('button')[1];cancel.click();
  await new Promise(resolve=>setTimeout(resolve,80));
  const cancelClosed=!dialog.open;
  editor.destroy();
  const removed=!document.querySelector('dialog.cxx-raw-editor');
  return {open,anchor,fullRaw,actionValue:actionValue==='【开始】【开场白】场景生成指令',afterSave,cancelClosed,removed};
 });
 report.result=result;
 report.steps.push('dialog在页内打开：'+result.open+'，未跳转其他页面：'+result.anchor);
 report.steps.push('完整原文含被正则隐藏内容：'+result.fullRaw);
 report.steps.push('保存调用reprocessNode：'+JSON.stringify(result.afterSave.calls));
 assert.ok(result.open&&result.anchor,'dialog未在当前页打开');
 assert.ok(result.fullRaw,'编辑器未显示完整原文（含被隐藏内容）');
 assert.equal(result.actionValue,true,'原行动未回填');
 assert.equal(result.afterSave.calls.length,1,'保存未触发reprocessNode');
 assert.equal(result.afterSave.calls[0].nodeId,'floor-1','保存目标节点错误');
 assert.ok(result.afterSave.calls[0].options.raw.includes('（编辑测试）新的结尾行。'),'编辑内容未提交');
 assert.ok(result.afterSave.saved.length===1&&result.afterSave.saved[0].status==='committed','onSaved未回调');
 assert.ok(result.afterSave.closed,'保存后dialog未关闭');
 assert.ok(result.cancelClosed,'取消未关闭');
 assert.ok(result.removed,'destroy未清理dialog');
 assert.deepEqual(report.errors,[],'页面出现未捕获错误');
 report.ok=true;
}catch(error){report.ok=false;report.failure=error.message.split('\n')[0];}
finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');await browser?.close().catch(()=>{});await new Promise(r=>server.close(r));console.log(JSON.stringify(report,null,2));}
