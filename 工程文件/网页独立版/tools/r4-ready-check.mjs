import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const file=new URL('../tavern-extension/index.mjs',import.meta.url),source=fs.readFileSync(file,'utf8');
const start=source.indexOf('  async function waitForReady(signal){'),end=source.indexOf('  async function api(',start);
assert(start>=0&&end>start);
// Execute the actual entry function; only its host and clock are controlled.
const create=new Function('globalThis','assertScope','error','avatar','chatId','setTimeout','DOMException',
 'let waiting;'+source.slice(start,end)+';return {ready:waitForReady,waiting:()=>waiting};');
const checks=[];
function fixture({cancel=false,switchChat=false,fail=false,pendingAfterIdle=false,allowed=false}={}){
 let now=0,complete=false,changed=false,idleCalls=0,writableCalls=0,resolveIdle,rejectIdle;
 const signal=new AbortController(),idle=new Promise((resolve,reject)=>{resolveIdle=resolve;rejectIdle=reject;});
 const updater={whenIdle(){idleCalls++;return idle;},activity:()=>({running:!complete,saveRunning:false,storyOperations:0}),getStatus:()=>complete?'已保存':'正在恢复',host:{readState:()=>({journalName:complete?undefined:'owned-book'}),async assertPlayerWritable(expected){writableCalls++;assert.deepEqual(expected,{characterKey:'WEB_HOST_TEST_READY.png',chatId:'web-controlled-ready'});if(allowed)return {kind:'other-instance'};if(!complete||pendingAfterIdle)throw Object.assign(Error('仍有安装记录'),{code:'migration-pending-install'});}}};
 const port=create({Cxx233Updater:updater},()=>{if(changed)throw Object.assign(Error('聊天已切换'),{code:'host_changed'});},(code,message)=>Object.assign(Error(message),{code}),'WEB_HOST_TEST_READY.png','web-controlled-ready',(fn,ms)=>{now+=ms;if(cancel)signal.abort();if(switchChat)changed=true;if(!complete&&now>=40100){complete=true;if(fail)rejectIdle(Object.assign(Error('恢复失败'),{code:'recovery-needed'}));else resolveIdle();}queueMicrotask(fn);},DOMException);
 return {port,signal:signal.signal,stats:()=>({now,complete,idleCalls,writableCalls})};
}
const long=fixture();await long.port.ready();assert(long.stats().now>=40100);assert.deepEqual(long.stats(),{now:40100,complete:true,idleCalls:1,writableCalls:2});assert.equal(long.port.waiting(),null);checks.push('真实入口函数等待40.1秒恢复合同完成，最终才允许人物写入；可控时钟无真实等待');
const cancelled=fixture({cancel:true});await assert.rejects(cancelled.port.ready(cancelled.signal),{name:'AbortError'});assert.equal(cancelled.stats().writableCalls,1);checks.push('等待期间取消立即退出，不跳过安装或继续写入');
const switched=fixture({switchChat:true});await assert.rejects(switched.port.ready(),{code:'host_changed'});assert.equal(switched.stats().writableCalls,1);checks.push('等待期间切换聊天立即退出，不写入旧聊天');
const failed=fixture({fail:true});await assert.rejects(failed.port.ready(),{code:'recovery-needed'});assert.equal(failed.stats().writableCalls,1);checks.push('原控制器恢复失败原样传出，不声明ready');
const pending=fixture({pendingAfterIdle:true});await assert.rejects(pending.port.ready(),{code:'migration-pending-install'});assert.equal(pending.stats().writableCalls,2);checks.push('控制器完成后仍执行原assertPlayerWritable，未解除的安装记录继续阻止写入');
const allowed=fixture({allowed:true});await allowed.port.ready();assert.deepEqual(allowed.stats(),{now:0,complete:false,idleCalls:0,writableCalls:1});checks.push('原Host允许的other-instance或普通聊天写入立即沿用，不为不属于当前写入的旧指针启动恢复等待');
fs.writeFileSync(new URL('../reports/r4-ready-check.json',import.meta.url),JSON.stringify({at:new Date().toISOString(),source:'tavern-extension/index.mjs',sha256:createHash('sha256').update(source).digest('hex'),scope:'actual entry waitForReady with controlled existing-controller completion and clock; not real-host acceptance',checks,errors:[]},null,2)+'\n');
for(const c of checks)console.log('PASS '+c);
