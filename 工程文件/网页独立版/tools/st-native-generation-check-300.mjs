import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
import {createNativeHostGenerator,createNativeHostTokenCounter} from '../tavern-extension/host-generation.mjs';
import {nativeChatParameters} from '../src/models/native/chat-parameters.mjs';
import {nativeClaudeBody} from '../src/models/native/native-bodies.mjs';
import {nativeTextParameters,textgenerationwebui_settings} from '../src/models/native/text-parameters.mjs';
import {kai_settings} from '../src/models/native/kobold.mjs';import {nai_settings} from '../src/models/native/novelai.mjs';
const checks=[],check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
function fixture({mainApi='openai',chatSource='deepseek',fetcher,decodeNative=false}={}){
 const chat={chat_completion_source:chatSource,deepseek_model:'deepseek-flash',claude_model:'claude-sonnet-4-6',temp_openai:0.3,show_thoughts:false,reasoning_effort:'low',assistant_prefill:'HOST {{incglobalvar::host}}',n:1,bias_presets:{},function_calling:false};
 const c={mainApi,chatCompletionSettings:chat,powerUserSettings:{instruct:{enabled:false}},eventTypes:{CHAT_COMPLETION_SETTINGS_READY:'chat-settings',TEXT_COMPLETION_SETTINGS_READY:'text-settings'},eventSource:{async emit(event,data){events.push({event,data});}},getRequestHeaders:()=>({'content-type':'application/json'})};
 const events=[],requests=[],nativeCalls=[],substitutions=[];let hordeCalls=0;
 const modules={
  '/scripts/openai.js':{getChatCompletionModel:s=>s[s.chat_completion_source+'_model']||'native-model',async createGenerationParameters(settings,model,type,messages,options){nativeCalls.push({settings:structuredClone(settings),model,type,messages,options});return nativeChatParameters(settings,model,type,messages,{jsonSchema:options.jsonSchema,substitute:text=>{substitutions.push(text);return text.replace(/\{\{incglobalvar::host\}\}/g,'HOST_EXPANDED');}});}},
  '/script.js':{getGenerateUrl:api=>({kobold:'/api/backends/kobold/generate',textgenerationwebui:'/api/backends/text-completions/generate',novel:'/api/novelai/generate'})[api],getStoppingStrings:()=>['native-stop']},
  '/scripts/textgen-settings.js':{textgenerationwebui_settings:{...textgenerationwebui_settings,type:'ooba',server_urls:{ooba:'http://127.0.0.1:5000'}},getTextGenModel:()=> 'text-native',createTextGenGenerationData(settings,model,prompt,maxTokens,impersonate,continuation,cfg,type){nativeCalls.push({settings:structuredClone(settings),model,type,prompt});return nativeTextParameters(settings,model,prompt,maxTokens,{type,baseUrl:'http://127.0.0.1:5000'});}},
  '/scripts/kai-settings.js':{kai_settings:{...kai_settings,api_server:'http://127.0.0.1:5001'},kai_flags:{can_use_streaming:true,can_use_stop_sequence:true,can_use_mirostat:true,can_use_grammar:true,can_use_min_p:true}},
  '/scripts/nai-settings.js':{nai_settings:{...nai_settings,model_novel:'kayra-v1'},getNovelMaxResponseTokens:()=>250},
  '/scripts/horde.js':{async generateHorde(prompt,params,signal,report){hordeCalls++;assert.equal(report,false);signal?.throwIfAborted();return {text:'Horde正文'};}}
 };
 const generate=createNativeHostGenerator({context:()=>c,assertScope(){},loadModule:async name=>{assert.ok(modules[name],name);return modules[name];},novelTokenizer:async()=>text=>[...text].map(ch=>ch.codePointAt(0)),fetchImpl:async(url,options)=>{const data=JSON.parse(options.body);requests.push({url,data,signal:options.signal});if(fetcher)return fetcher(url,options);return new Response(JSON.stringify(url.includes('chat-completions')&&data.chat_completion_source==='claude'?{content:[{type:'text',text:'Claude正文'}],stop_reason:'end_turn',usage:{input_tokens:4,output_tokens:3}}:{choices:[{message:{content:'正文'},finish_reason:'stop'}]}),{headers:{'content-type':'application/json'}});},decode:async(response,options)=>{if(mainApi!=='openai'&&!decodeNative)return {text:'文本正文',complete:true};const {decodeReply}=await import('../src/models/port.mjs');return decodeReply(response,options);}});
 return {c,generate,events,requests,nativeCalls,substitutions,modules,get hordeCalls(){return hordeCalls;}};
}
const body={messages:[{role:'system',content:'规则'},{role:'user',content:'行动'}],model:'deepseek-flash',max_tokens:3210,temperature:0.8,top_p:0.85,reasoning_effort:'high',include_reasoning:true,stream:false};
await check('继承原生DeepSeek来源，网页正式采样与思考设置生效且不修改宿主',async()=>{
 const f=fixture(),before=JSON.stringify(f.c.chatCompletionSettings),result=await f.generate({payload:{adapter:'openai-chat',body},signal:new AbortController().signal});assert.equal(result.text,'正文');assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/api/backends/chat-completions/generate');const p=f.requests[0].data;assert.equal(p.chat_completion_source,'deepseek');assert.equal(p.reasoning_effort,'high');assert.equal(p.include_reasoning,true);assert.equal(p.temperature,0.8);assert.equal(p.max_tokens,3210);assert.equal(f.events.length,1);assert.equal(JSON.stringify(f.c.chatCompletionSettings),before);
});
await check('Claude已展开prefill不再执行宏，quiet与continue遵原生适用条件',async()=>{
 for(const [type,continuePrefill,expected]of [['normal',false,'展开后 {{incglobalvar::literal}}'],['quiet',false,undefined],['continue',true,undefined],['impersonate',false,'扮演后 {{incglobalvar::literal}}']]){
  const f=fixture({chatSource:'claude'}),p={...body,model:'claude-sonnet-4-6',generationType:type,continue_prefill:continuePrefill,assistant_prefill:'展开后 {{incglobalvar::literal}}',assistant_impersonation:'扮演后 {{incglobalvar::literal}}'};await f.generate({payload:{body:p}});assert.equal(f.requests.length,1);const data=f.requests[0].data;assert.equal(data.type,type);assert.equal(data.assistant_prefill,expected);assert.ok(f.substitutions.every(value=>!value.includes('incglobalvar')));assert.equal(f.c.chatCompletionSettings.assistant_prefill,'HOST {{incglobalvar::host}}');
  if(expected){const upstream=nativeClaudeBody(data).body;assert.equal(JSON.stringify(upstream).split(expected).length-1,1);}
 }
});
await check('显式连接覆盖来源，seed/verbosity等由原生参数函数生效',async()=>{
 const f=fixture();await f.generate({payload:{adapter:'chat:openai',baseUrl:'https://example.test/v1',credential:'SYNTHETIC',body:{...body,model:'gpt-5',seed:12,verbosity:'low',generationType:'normal'}}});const data=f.requests[0].data;assert.equal(data.chat_completion_source,'openai');assert.equal(data.seed,12);assert.equal(data.verbosity,'low');assert.equal(data.reverse_proxy,'https://example.test/v1');assert.equal(data.proxy_password,'SYNTHETIC');assert.equal(f.nativeCalls[0].settings.reverse_proxy,'');
});
await check('custom三个已展开字段在normal和quiet都不二次展开，未owned保持原生一次展开',async()=>{
 const fields={custom_include_body:'{"note":"{{incglobalvar::literal}}"}',custom_exclude_body:'- "{{incglobalvar::literal}}"',custom_include_headers:'{"X-Note":"{{incglobalvar::literal}}"}'};
 for(const generationType of ['normal','quiet']){const f=fixture({chatSource:'custom'});await f.generate({payload:{body:{...body,...fields,generationType}}});for(const [key,value]of Object.entries(fields)){assert.equal(f.nativeCalls[0].settings[key],'');assert.equal(f.requests[0].data[key],value);}assert.ok(f.substitutions.every(value=>!value.includes('incglobalvar')));}
 const native=fixture({chatSource:'custom'});await native.generate({payload:{body:{...body,presetSettings:{custom_include_body:'HOST {{incglobalvar::host}}'}}}});assert.equal(native.requests[0].data.custom_include_body,'HOST HOST_EXPANDED');assert.equal(native.substitutions.filter(value=>value.includes('incglobalvar::host')).length,1);
});
await check('只覆盖model时计数与实际请求共用继承source和覆盖后的model',async()=>{
 const f=fixture(),selected=[],counter=createNativeHostTokenCounter({context:()=>f.c,assertScope(){},loadModule:async name=>f.modules[name],prepareLocalCounter:async value=>{selected.push(value);return {source:'local-model',estimate:false,countText:()=>100,countMessages:()=>200};}}),payload={adapter:'openai-chat',body:{...body,model:'deepseek-v4-pro'}};
 assert.equal((await counter(payload)).source,'local-model:host-override');await f.generate({payload});assert.equal(selected[0].adapter,'chat:'+f.requests[0].data.chat_completion_source);assert.equal(selected[0].body.model,f.requests[0].data.model);assert.equal(f.requests[0].data.model,'deepseek-v4-pro');
});
await check('原生DeepSeek流缺Content-Type仍按已知SSE合同解析，非流式JSON保持',async()=>{
 const events=[{choices:[{delta:{reasoning_content:'原生思考'}}]},{choices:[{delta:{content:'原生正文'},finish_reason:'stop'}],usage:{prompt_tokens:7,completion_tokens:4,total_tokens:11}}],sse=events.map(value=>'data: '+JSON.stringify(value)+'\n\n').join('')+'data: [DONE]\n\n';
 const f=fixture({fetcher:async()=>new Response(new TextEncoder().encode(sse))}),result=await f.generate({payload:{body:{...body,stream:true}}});assert.equal(f.requests[0].data.stream,true);assert.equal(result.text,'原生正文');assert.equal(result.reasoning,'原生思考');assert.equal(result.usage.total_tokens,11);assert.equal(result.diagnostics.format,'sse');assert.equal(f.requests.length,1);
 const json=fixture({fetcher:async()=>new Response(new TextEncoder().encode(JSON.stringify({choices:[{message:{content:'JSON正文'},finish_reason:'stop'}]})))});assert.equal((await json.generate({payload:{body:{...body,stream:false}}})).text,'JSON正文');
});
await check('原生Ollama已转SSE的choices.text/thinking不误判为直连NDJSON',async()=>{
 const text='data: '+JSON.stringify({choices:[{text:'Ollama正文',thinking:'Ollama思考'}]})+'\n\ndata: [DONE]\n\n',f=fixture({mainApi:'textgenerationwebui',decodeNative:true,fetcher:async()=>new Response(new TextEncoder().encode(text))});f.modules['/scripts/textgen-settings.js'].textgenerationwebui_settings.type='ollama';
 const result=await f.generate({payload:{body:{...body,model:'text-native',stream:true}}});assert.equal(f.requests[0].data.api_type,'ollama');assert.equal(result.text,'Ollama正文');assert.equal(result.reasoning,'Ollama思考');assert.equal(result.complete,true);assert.equal(result.diagnostics.format,'sse');assert.equal(f.requests.length,1);
});
await check('原生Text Generation/Kobold/Novel/Horde保持各自路径，不偷偷变聊天补全',async()=>{
 for(const api of ['textgenerationwebui','kobold','novel','koboldhorde']){
  const f=fixture({mainApi:api}),result=await f.generate({payload:{body:{...body,model:api==='novel'?'kayra-v1':'text-native',max_tokens:200,temperature:0.71,stream:false,generationType:'quiet'}},signal:new AbortController().signal});assert.ok(result.text);if(api==='koboldhorde'){assert.equal(f.hordeCalls,1);assert.equal(f.requests.length,0);}else{assert.equal(f.requests.length,1);assert.ok(!f.requests[0].url.includes('chat-completions'));const data=f.requests[0].data;assert.equal(data.temperature,0.71);if(api==='novel')assert.equal(data.max_length,200);}
 }
});
await check('取消在请求前阻止HTTP，进行中沿同一signal中止且没有自动重发',async()=>{
 const before=fixture(),signal=new AbortController();signal.abort();await assert.rejects(()=>before.generate({payload:{body},signal:signal.signal}),{name:'AbortError'});assert.equal(before.requests.length,0);
 let started;const ready=new Promise(resolve=>started=resolve),controller=new AbortController(),during=fixture({fetcher:(_url,{signal})=>{started();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('停止','AbortError')),{once:true}));}}),work=during.generate({payload:{body},signal:controller.signal});await ready;controller.abort();await assert.rejects(()=>work,{name:'AbortError'});assert.equal(during.requests.length,1);
});
await check('既有宿主生成壳维持ready、生成忙闲和长期记忆租约的单次释放',async()=>{
 const source=fs.readFileSync(new URL('../tavern-extension/index.mjs',import.meta.url),'utf8'),start=source.indexOf('  async function generate({payload,signal,onDelta,onReasoning,onUsage,onProgress})'),end=source.indexOf(' const tokenCounter=',start),fn=source.slice(start,end).trim();
 const events=[];let started;const ready=new Promise(resolve=>started=resolve),controller=new AbortController(),box={crypto:webcrypto,DOMException,generationPhase:'idle',lastGenerate:null,assertScope(){},waitForReady:async()=>events.push('ready'),cardGeneration:phase=>events.push(phase),CxxLongMemory:{acquireWebGeneration(){events.push('acquire');return()=>events.push('release');}},nativeGenerate:async({signal})=>{events.push('request');started();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('停止','AbortError')),{once:true}));}};vm.createContext(box);const generate=vm.runInContext('('+fn+')',box),work=generate({payload:{body},signal:controller.signal});await ready;controller.abort();await assert.rejects(()=>work,{name:'AbortError'});assert.deepEqual(events,['ready','start','acquire','request','end','release']);
});
const report={at:new Date().toISOString(),passed:checks.length,total:checks.length,checks,realModelCalls:0,scope:'Actual host bridge/native builders and response decoder; synthetic HTTP, native parameter sources pinned to ST1.19; no live host or player writes'};fs.writeFileSync(new URL('../reports/st-native-generation-check-300.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
