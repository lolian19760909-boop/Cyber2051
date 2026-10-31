'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {install}=require('../../卡片源码/长期记忆/startup.js');
function fixture(){
 let resolve;const ready=new Promise(r=>resolve=r),events=new Map(),pagehide=new Set(),calls={created:0,stopped:0,panelStopped:0,opened:0,installed:0,settings:0},host={Cxx233Runtime:{parser:{}},CxxQuests:{},toastr:{error(){}}};
 const api={waitGlobalInitialized:()=>ready,addEventListener:(name,fn)=>pagehide.add(fn),removeEventListener:(name,fn)=>pagehide.delete(fn),eventOn:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},eventRemoveListener:(name,fn)=>events.get(name)?.delete(fn),getButtonEvent:n=>n,
  CxxLongMemoryAdapter:{create(){calls.created++;const service={state:()=>({story:'s',plots:true}),story:s=>s,start:()=>service,destroy:()=>calls.stopped++,install:async()=>calls.installed++,openSettings:async()=>calls.settings++};return service;}},
  CxxMemoryPlot:{create:()=>({})},CxxMemoryPanel:{create:()=>({open:()=>calls.opened++,destroy:()=>calls.panelStopped++})},CxxMemoryMaterial:{},CxxMemoryHistory:{}};
 const options={host,api,bundle:{keep:true},chapter:{},quests:[],detection:{}};
 return {host,api,options,resolve,events,pagehide,calls,emit:async n=>{for(const fn of [...events.get(n)||[]])await fn();}};
}
test('unload while waiting for core cannot create a late service',async()=>{const f=fixture(),pending=install(f.options);for(const stop of [...f.pagehide])stop();f.resolve();assert.equal(await pending,undefined);assert.equal(f.calls.created,0);assert.equal(f.pagehide.size,0);});
test('twenty replacements retain one service and two button handlers; stale cleanup cannot stop the replacement',async()=>{
 const f=fixture();f.resolve();let previous;
 for(let i=0;i<20;i++){const service=await install(f.options);previous?.destroy();assert.equal(f.host.CxxLongMemory,service);assert.equal(f.pagehide.size,1);assert.equal([...f.events.values()].reduce((n,s)=>n+s.size,0),2);await f.emit('长期记忆面板');await f.emit('长期记忆配置');previous=service;}
 assert.equal(f.calls.opened,20);assert.equal(f.calls.installed,20);assert.equal(f.calls.settings,20);previous.destroy();previous.destroy();assert.equal(f.calls.stopped,20);assert.equal(f.calls.panelStopped,20);assert.equal(f.pagehide.size,0);assert.equal([...f.events.values()].reduce((n,s)=>n+s.size,0),0);assert.equal(f.host.CxxLongMemory,undefined);assert.equal(f.host.CxxPlot,undefined);
});
test('thought removal and original service settings remain wired to the same adapter',async()=>{const f=fixture();f.resolve();const s=await install(f.options);assert(f.host.CxxPlot.enabled());assert.equal(f.host.CxxPlot.story('<cxx-say kind="thought">心声</cxx-say>正文'),'正文');assert.equal(typeof s.openPanel,'function');s.openPanel();assert.equal(f.calls.opened,1);s.destroy();});
test('partial startup failure releases the created adapter and page listener',async()=>{const f=fixture();f.resolve();f.api.CxxMemoryPanel.create=()=>{throw Error('panel fixture');};await assert.rejects(install(f.options),/panel fixture/);assert.equal(f.calls.stopped,1);assert.equal(f.pagehide.size,0);assert.equal(f.host.CxxPlot,undefined);});
test('memory configuration guides missing dependencies before any template writes, then resumes normally',async()=>{const f=fixture();f.resolve();let ready=false,checks=0;f.host.CxxPlugins={ensureMemory:async()=>{checks++;return ready;}};const service=await install(f.options);await f.emit('长期记忆配置');assert.equal(checks,1);assert.equal(f.calls.installed,0);assert.equal(f.calls.settings,0);ready=true;await f.emit('长期记忆配置');assert.equal(f.calls.installed,1);assert.equal(f.calls.settings,1);service.destroy();});

test('illustrations follow stable messages after deleting earlier floors and retain legacy matching',async()=>{
 const f=fixture();f.resolve();await install(f.options);
 const body='已经发生的剧情正文';let h=2166136261;for(const ch of body)h=Math.imul(h^ch.charCodeAt(0),16777619);
 const source={floor:8,swipe:0,story:(h>>>0).toString(16),messageId:'m1',variantId:'v1'};
 f.host.CxxPlot.illustrations=()=>[{url:'image.png',source}];
 const m={mes:body,cxx_context:{messageId:'m1'},extra:{cxx_context:{messageId:'m1',variantId:'v1'}},variables:{0:{stat_data:{}}}};
 assert.equal(f.host.CxxPlot.illustrationsAt(m,2).length,1);
 assert.equal(f.host.CxxPlot.illustrationsAt({...m,mes:body+'改写'},2).length,0);
 assert.equal(f.host.CxxPlot.illustrationsAt({...m,cxx_context:{messageId:'m2'}},2).length,0);
 assert.equal(f.host.CxxPlot.illustrationsAt({...m,extra:{cxx_context:{variantId:'v2'}}},2).length,0);
 delete source.messageId;delete source.variantId;
 assert.equal(f.host.CxxPlot.illustrationsAt(m,8).length,1);
 assert.equal(f.host.CxxPlot.illustrationsAt(m,2).length,0);
 source.messageId='fallback';m.cxx_plot_id='fallback';
 assert.equal(f.host.CxxPlot.illustrationsAt(m,2).length,1);f.host.CxxLongMemory.destroy();
});
