'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../../独立制卡器/workbench/node_modules/playwright'),A=require('../../工具/lib/card-ast.cjs'),T=require('../../工具/lib/terminal-preview.cjs');
const eng=path.resolve(__dirname,'../..'),card=JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||path.join(eng,'.cache/build/赛博小祥2051-V2.3.0.json'))),out=process.env.CXX_EVIDENCE||path.join(eng,'.cache/regex230/lifecycle');
const all=card.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n'),code=A.modules(all).filter(m=>['Cxx238Dialogue','CxxGalParser','CxxDisplayGuard235','Cxx249HistoryRuntime'].includes(m.name)).map(m=>m.source).join(';\n'),worker=A.workerNode(card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241').content).value;
const server=http.createServer((q,r)=>r.end('<!doctype html>'));
(async()=>{let browser;const report={scope:'Actual packaged shared runtime, formatter guard, parser and browser Worker; controlled host events; no player writes'};fs.mkdirSync(out,{recursive:true});try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({channel:'msedge',headless:true});const e=await T.environment(browser,'http://127.0.0.1:'+server.address().port,card);await e.page.addScriptTag({content:require('../../工具/lib/card-global.cjs')(all,['CxxDisplayGuardStyle'])});await e.page.addScriptTag({content:code});
 report.result=await e.page.evaluate(async worker=>{
  terminal.destroy();const initial=JSON.stringify(c.chat),hooks={beforeRegex:[],afterRegex:[]},rows=[],counts={created:0,revoked:0,activeWorkers:0};
  c.eventTypes.CHAT_COMPLETION_PROMPT_READY='prompt-ready';c.messageFormatter={addHook:(fn,o)=>hooks[o.stage].push(fn)};
  const platform={setTimeout:(fn,ms)=>window.setTimeout(fn,ms),clearTimeout:id=>window.clearTimeout(id),Blob,URL:{createObjectURL:b=>{counts.created++;return URL.createObjectURL(b);},revokeObjectURL:u=>{counts.revoked++;URL.revokeObjectURL(u);}},Worker:class extends Worker{constructor(url){super(url);counts.activeWorkers++;this.closed=false;}terminate(){if(!this.closed){this.closed=true;counts.activeWorkers--;}super.terminate();}}};
  const check=(ok,what)=>{if(!ok)throw Error(what);};let previous;
  for(let i=0;i<20;i++){
   const stop=CxxDisplayGuard235.install({top:window,api,runtime,parser:CxxGalParser});previous?.();previous=stop;
   const raw='<cxx-story>第'+i+'次读取。</cxx-story>\n`<xuan>引用示例</xuan>`';
   let rendered=raw;for(const fn of hooks.beforeRegex)rendered=fn(rendered,{messageId:1});for(const fn of hooks.afterRegex)rendered=fn(rendered);
   check([...document.querySelectorAll('style')].filter(s=>s.textContent===globalThis.CxxDisplayGuardStyle).length===1,'one owned display style after replacement');
   check(rendered.includes('引用示例')&&!/CXXPROTECTED/.test(rendered),'display protection roundtrip');
   const off=runtime.watchMessages(()=>{});check(runtime.read().readers===1,'one shared feed reader');off();check(runtime.read().readers===0,'shared feed reader released');
   const history=Cxx249HistoryRuntime.create({workerSource:worker,platform,run:()=>{throw Error('Unexpected Worker fallback');}}),opts={key:'row',revision:i,scope:'same-chat'};
   const [a,b]=await Promise.all([history.submit('parse',{raw},opts),history.submit('parse',{raw},opts)]);check(JSON.stringify(a)===JSON.stringify(b)&&a.raw===raw,'joined Worker output');
   const stats=history.stats();check(stats.executed===1&&stats.pending===0&&stats.queued===0,'duplicate consumers execute once');history.destroy();
   check(counts.activeWorkers===0&&counts.created===counts.revoked,'Worker and Blob released');
   check(__events.get('prompt-ready').size===1&&hooks.beforeRegex.length===1&&hooks.afterRegex.length===1,'one active prompt listener and host dispatcher');
   rows.push({cycle:i+1,executions:stats.executed,readers:runtime.read().readers,activeWorkers:counts.activeWorkers});
  }
  previous();runtime.destroy();check([...document.querySelectorAll('style')].every(s=>s.textContent!==globalThis.CxxDisplayGuardStyle),'display style released');check(__events.get('prompt-ready').size===0,'prompt listener released');check(JSON.stringify(c.chat)===initial&&metrics.writes===0,'chat unchanged');
  return {cycles:rows,counts,hostDispatchers:hooks.beforeRegex.length+hooks.afterRegex.length,promptListeners:__events.get('prompt-ready').size,writes:metrics.writes};
 },worker);assert.deepEqual(e.errors,[]);report.pass=true;
 }catch(error){report.failure=error.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}})();
