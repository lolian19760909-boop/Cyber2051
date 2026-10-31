'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../../卡片源码/运行时/context-requests.js');
const scope={character:'fixture.png',chat:'a',group:null};
async function transportFixture(){const {createAuxiliary}=await import('../../配套扩展/cxx-context-bridge/auxiliary.mjs'),f={calls:[],builds:[]};
 f.ctx={mainApi:'openai',chatCompletionSettings:{chat_completion_source:'custom',custom_model:'fixture',openai_max_tokens:99,custom_include_body:'messages: secret',function_calling:true,reverse_proxy:'local'},getRequestHeaders:()=>({'X-Test':'fixture'}),extractMessageFromData:data=>data.choices?.[0]?.message.content};
 f.backend={getChatCompletionModel:s=>s.custom_model,createGenerationParameters:async(s,m,t,messages,o)=>{f.builds.push({s,m,t,o});return {generate_data:{messages,model:m,custom_include_body:s.custom_include_body,custom_exclude_body:'stream',custom_include_headers:'Authorization: fixture',assistant_prefill:'hidden',tools:[{private:'tool'}],stop:['private stop'],reverse_proxy:s.reverse_proxy,include_reasoning:true,max_tokens:s.openai_max_tokens}};}};
 f.request=createAuxiliary({context:()=>f.ctx,loadBackend:async()=>f.backend,fetcher:async(url,opts)=>{f.calls.push({url,...opts,body:JSON.parse(opts.body)});return {ok:true,json:async()=>({choices:[{message:{content:'{"ok":true}',reasoning_content:'never return'}}],usage:{prompt_tokens:100,completion_tokens:5,total_tokens:105}})};}});return f;
}
test('auxiliary uses exact text and native routing without macros, tools, prompt overrides or global settings writes',async()=>{
 const f=await transportFixture(),before=structuredClone(f.ctx.chatCompletionSettings),messages=[{role:'system',content:'literal {{user}}'},{role:'user',content:'one private owner'}],out=await f.request({messages,responseTokens:512});
 assert.deepEqual(f.ctx.chatCompletionSettings,before);assert.deepEqual(f.calls[0].body.messages,messages);assert.deepEqual(messages,[{role:'system',content:'literal {{user}}'},{role:'user',content:'one private owner'}]);
 assert.equal(f.calls[0].url,'/api/backends/chat-completions/generate');assert.equal(f.calls[0].body.reverse_proxy,'local');assert.equal(f.calls[0].body.custom_include_headers,'Authorization: fixture');assert.equal(f.calls[0].body.max_tokens,512);assert.equal(f.calls[0].body.include_reasoning,false);
 for(const key of ['custom_include_body','custom_exclude_body','assistant_prefill','tools','stop'])assert.equal(f.calls[0].body[key],undefined);
 assert.equal(out.text,'{"ok":true}');assert.deepEqual(out.usage,{input:100,output:5,total:105,source:'provider'});assert(!JSON.stringify(out).includes('reasoning'));assert.equal(f.builds[0].o.allowToolCalls,false);
});
test('unsupported connections, input and native extra prompt text fail before network',async()=>{
 const f=await transportFixture();f.ctx.mainApi='novel';await assert.rejects(f.request({messages:[{role:'user',content:'x'}]}),/Chat Completion/);f.ctx.mainApi='openai';
 await assert.rejects(f.request({messages:[{role:'tool',content:'x'}]}));await assert.rejects(f.request({messages:[{role:'user',content:'x'}],responseTokens:0}));
 f.backend.createGenerationParameters=async()=>({generate_data:{messages:[{role:'user',content:'other actor secrets'}]}});await assert.rejects(f.request({messages:[{role:'user',content:'x'}]}),/改写/);assert.equal(f.calls.length,0);
});
test('native role conversion and usage absence are explicit; abort prevents dispatch',async()=>{
 const f=await transportFixture();f.backend.createGenerationParameters=async(s,m,t,messages)=>({generate_data:{messages:messages.map(v=>({...v,role:'user'})),max_completion_tokens:20}});await f.request({messages:[{role:'system',content:'same text'}],responseTokens:400});assert.equal(f.calls[0].body.max_completion_tokens,400);
 const controller=new AbortController();controller.abort(Error('stop'));await assert.rejects(f.request({messages:[{role:'user',content:'x'}],signal:controller.signal}),/stop/);assert.equal(f.calls.length,1);
 const {usage}=await import('../../配套扩展/cxx-context-bridge/auxiliary.mjs');assert.deepEqual(usage({}),{input:null,output:null,total:null,source:'unavailable'});
});
test('card request queue freezes inputs, records only measurements, and rejects stale queued work',async()=>{
 let current={scope,binding:{actorId:'player'},tail:'first'},release;const sent=[];
 const bridge={capabilities:()=>({auxiliary:true}),request:async v=>{sent.push(structuredClone(v.messages));if(sent.length===1)await new Promise(r=>release=r);return {text:'{"items":[]}',usage:{input:12,output:4,source:'provider'},model:'fixture',provider:'test'};}};
 const svc=R.create({bridge:()=>bridge,capture:()=>current,countTokens:async()=>17}),messages=[{role:'user',content:'hidden actor profile'}];const first=svc.run({purpose:'compact',actorId:'player',messages,validate:R.json});while(!release)await new Promise(r=>setTimeout(r,0));
 const second=svc.run({purpose:'private-actor',actorId:'wb_6',messages});messages[0].content='later mutated';current={...current,tail:'edited'};release();await assert.rejects(first,/前文/);await assert.rejects(second,/前文/);assert.equal(sent.length,1);assert.equal(sent[0][0].content,'hidden actor profile');assert.equal(svc.status().records[1].attempts,0);assert(!JSON.stringify(svc.status()).includes('hidden actor'));svc.destroy();
});
test('successful and cancelled requests do not emit a normal chat event or write memory',async()=>{
 let cancelled=false;const svc=R.create({capture:()=>({scope}),bridge:()=>({capabilities:()=>({auxiliary:true}),request:({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{cancelled=true;reject(signal.reason);},{once:true}))})});
 const promise=svc.run({purpose:'compact',actorId:'player',messages:[{role:'user',content:'x'}]});while(svc.status().active?.stage!=='request')await new Promise(r=>setTimeout(r,0));svc.cancel();await assert.rejects(promise,/取消/);assert(cancelled);assert.equal(svc.status().pending,0);assert.equal(svc.status().records[0].status,'cancelled');svc.destroy();
});
test('auxiliary transport uses the installed ST parameter builder with an isolated settings copy',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),root=process.env.CXX_ST_ROOT||'D:/SillyTavern',code=fs.readFileSync(path.join(root,'public/scripts/openai.js'),'utf8'),start=code.indexOf('export async function createGenerationParameters('),end=code.indexOf('/**\r\n * Send a chat completion request',start)>0?code.indexOf('/**\r\n * Send a chat completion request',start):code.indexOf('/**\n * Send a chat completion request',start);assert(start>=0&&end>start);
 const expanded=[],context={chat_completion_sources:Object.fromEntries([...code.matchAll(/chat_completion_sources\.([A-Z0-9_]+)/g)].map(m=>[m[1],m[1].toLowerCase()])),ToolManager:{canPerformToolCalls:()=>false},power_user:{request_token_probabilities:false},getReasoningEffort:()=>undefined,getVerbosity:()=>undefined,getCustomStoppingStrings:()=>['private stop'],openai_max_stop_strings:4,name1:'old persona name',name2:'card name',getGroupNames:()=>['old group'],substituteParams:value=>{expanded.push(value);return value;},validateReverseProxy:async()=>{}};
 vm.createContext(context);vm.runInContext(code.slice(start,end).replace(/^export /,'')+'\nthis.make=createGenerationParameters;',context);const f=await transportFixture();f.backend.createGenerationParameters=context.make;
 const result=await f.request({messages:[{role:'system',content:'literal {{getvar::secret}}'},{role:'user',content:'only current actor'}],responseTokens:400});
 assert.equal(result.text,'{"ok":true}');assert.equal(f.calls[0].body.messages[0].content,'literal {{getvar::secret}}');assert(!expanded.includes('messages: secret'));assert(!expanded.includes('literal {{getvar::secret}}'));assert.equal(f.ctx.chatCompletionSettings.custom_include_body,'messages: secret');assert.equal(f.calls[0].body.n,undefined);assert.equal(f.calls[0].body.user_name,'user');
});
