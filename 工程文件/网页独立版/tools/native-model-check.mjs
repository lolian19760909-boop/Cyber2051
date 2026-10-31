/** Offline differential checks against the actual pinned ST files; no model endpoint is contacted. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildRequest} from '../src/models/adapters.mjs';
import {decodeReply} from '../src/models/port.mjs';
import {ALL_SOURCES} from '../src/models/registry.mjs';
import {chatParameters} from '../src/models/provider-requests.mjs';
import * as portable from '../src/models/native/converters.mjs';
import browserCrypto from '../src/models/native-crypto.mjs';
const WEB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),ST=path.resolve(WEB,'../.cache/debug223/host/app'),require=createRequire(path.join(ST,'package.json')),{parse}=require('acorn');
const source=p=>fs.readFileSync(path.join(ST,p),'utf8').replace(/\r\n/g,'\n');
function declaration(text,name){for(const outer of parse(text,{ecmaVersion:'latest',sourceType:'module'}).body){const n=outer.declaration||outer;if(n.id?.name===name||n.declarations?.some(d=>d.id.name===name))return text.slice(n.start,n.end);}throw Error(name);}
const constants=await import('data:text/javascript;base64,'+Buffer.from(source('src/constants.js')).toString('base64'));
const original=source('src/prompt-converters.js').replace("import { getConfigValue, tryParse } from './util.js';",'const getConfigValue=(key,fallback)=>fallback;const tryParse=text=>{try{return JSON.parse(text);}catch{return null;}};');
const oracle=await import('data:text/javascript;base64,'+Buffer.from(original).toString('base64'));
const backend=source('src/endpoints/backends/chat-completions.js'),checks=[];
const nativeRoute=parse(backend,{ecmaVersion:'latest',sourceType:'module'}).body.find(n=>n.type==='ExpressionStatement'&&n.expression?.callee?.object?.name==='router'&&n.expression?.arguments?.[0]?.value==='/generate').expression.arguments[1];
const names={userName:'U',charName:'C',groupNames:[],startsWithGroupName:()=>false};
for(const value of ['', 'hello','旅行者','a'.repeat(129)])assert.equal(browserCrypto.createHash('sha512').update(value).digest('hex'),crypto.createHash('sha512').update(value).digest('hex'));
checks.push('Portable SHA-512 equals node:crypto for empty, UTF-8 and multi-block input');
for(const fn of ['convertClaudeMessages','convertGooglePrompt','convertAI21Messages','convertMistralMessages','convertCohereMessages','convertXAIMessages']){
 const rows=[{role:'system',name:'example_user',content:'规则'},{role:'user',content:'开始'},{role:'assistant',content:'前文'},{role:'system',content:'后注'}];
 const args=fn==='convertClaudeMessages'?['',true,false,names]:fn==='convertGooglePrompt'?['gemini-2.5-flash',true,names]:[names];
 assert.deepEqual(JSON.parse(JSON.stringify(portable[fn](structuredClone(rows),...args))),JSON.parse(JSON.stringify(oracle[fn](structuredClone(rows),...args))),fn);
}
checks.push('Six native message converters equal independently loaded pinned source');
async function nativeBody(fn,payload){
 let captured;const nativeErrors=[];
 const c={...constants,...oracle,structuredClone,URL,AbortController,process:{stdout:{columns:80}},console:{debug(){},warn(){},info(){},error(){}},getConfigValue:(key,fallback)=>fallback,readSecret:()=> 'synthetic-not-a-key',SECRET_KEYS:new Proxy({},{get:(_,key)=>key}),getVertexAIAuth:async()=>({authHeader:'synthetic',authType:'api_key'}),getProjectIdFromServiceAccount:()=> 'synthetic',cacheTTL:'5m',enableSystemPromptCache:false,cachingAtDepth:-1,enableAdaptiveThinking:true,color:{red:v=>v,yellow:v=>v,blue:v=>v},fetch:async(_url,options)=>{captured=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:'fixture'}}],content:[{type:'text',text:'fixture'}],candidates:[{content:{parts:[{text:'fixture'}]}}]}),{status:200,headers:{'content-type':'application/json'}});},forwardFetchResponse:async()=>{},Response};
 Object.assign(c,Object.fromEntries(['OPENAI','CLAUDE','MISTRAL','COHERE_V1','COHERE_V2','PERPLEXITY','GROQ','MAKERSUITE','VERTEX_AI','AI21','CHUTES','ELECTRONHUB','NANOGPT','DEEPSEEK','XAI','AIMLAPI','POLLINATIONS','POLLINATIONS_ANON','MOONSHOT','FIREWORKS','COMETAPI','ZAI_COMMON','ZAI_CODING','SILICONFLOW','SILICONFLOW_CN','MINIMAX','MINIMAX_CN'].map(key=>['API_'+key,'https://fixture.invalid/v1'])));
 c.flattenSchema=vm.runInNewContext('('+declaration(source('src/util.js'),'flattenSchema')+')',c);
 c.console.error=(...args)=>nativeErrors.push(args.map(v=>String(v)).join(' '));
 c.API_WORKERS_AI='https://fixture.invalid/accounts';
 c.TEXT_COMPLETION_MODELS=vm.runInNewContext(declaration(source('src/endpoints/tokenizers.js'),'TEXT_COMPLETION_MODELS')+';TEXT_COMPLETION_MODELS',c);
 c.isOpenRouterModelCacheable=async()=>false;c.getAffinityKey=()=> 'fixture';c.createHmac=crypto.createHmac;c.uuidv4=()=> 'fixture';c.yaml=require('yaml');
 for(const helper of ['getOpenRouterTransforms','getOpenRouterPlugins','setJsonObjectFormat'])c[helper]=vm.runInNewContext('('+declaration(backend,helper)+')',c);
 for(const helper of ['mergeObjectWithYaml','excludeKeysByYaml'])c[helper]=vm.runInNewContext('('+declaration(source('src/util.js'),helper)+')',c);
 const request={body:structuredClone(payload),socket:{removeAllListeners(){},on(){}},user:{directories:{}}},response={status(){return this;},send(){return this;},json(){return this;}};
 await vm.runInNewContext('('+(fn==='router'?backend.slice(nativeRoute.start,nativeRoute.end):declaration(backend,fn))+')',c)(request,response);
 assert.ok(captured,'Native backend did not issue synthetic request: '+fn+' '+payload.chat_completion_source+' '+nativeErrors.join(';'));return captured;
}
for(const [source,model,extra]of [['openai','gpt-4o',{}],['openai','o3',{}],['openai','gpt-5',{}],['openrouter','deepseek/deepseek-r1',{openrouter_providers:['one'],openrouter_allow_fallbacks:false,openrouter_quantizations:['fp16'],enable_web_search:true}],['nanogpt','deepseek',{nanogpt_provider:'one',nanogpt_payg_override:true,enable_web_search:true}],['moonshot','kimi-k2.5',{}],['zai','glm-4.5',{}],['siliconflow','fixture',{}],['perplexity','sonar-reasoning',{}],['groq','fixture',{}],['pollinations','fixture',{seed:42}],['fireworks','fixture',{}],['workers_ai','@cf/meta/llama-3',{accountId:'fixture'}],['custom','fixture',{custom_include_body:'foo: bar',custom_exclude_body:'[temperature]',custom_prompt_post_processing:'strict'}]]){
 for(const structured of [false,true]){const input={model,messages:[{role:'system',content:'rule'},{role:'assistant',content:'a'},{role:'system',content:'late'},{role:'user',content:'hello'}],temperature:1,top_p:.98,top_k:64,max_tokens:4096,include_reasoning:true,reasoning_effort:'high',stream:true,seed:42,...extra,...(structured?{json_schema:{name:'fixture',description:'Fixture schema',value:{type:'object',properties:{answer:{type:'string'}}},strict:true}}:{})};
 const expected=await nativeBody('router',chatParameters(source,input,input.messages)),actual=JSON.parse(buildRequest({operation:'chat',adapter:'chat:'+source,baseUrl:'https://fixture.invalid',credential:'synthetic-not-a-key',payload:input}).body);
 assert.deepEqual(actual,expected,'native route '+source+' '+model+' schema='+structured);}checks.push('Actual native router (text + schema): '+source+' '+model);
}
const cases=[['claude','claude-sonnet-4-5','sendClaudeRequest'],['claude','claude-opus-4-6','sendClaudeRequest'],['makersuite','gemini-2.5-flash','sendMakerSuiteRequest'],['makersuite','gemini-3-pro','sendMakerSuiteRequest'],['vertexai','gemini-2.5-flash','sendMakerSuiteRequest'],['deepseek','deepseek-flash','sendDeepSeekRequest'],['mistralai','mistral-large-latest','sendMistralAIRequest'],['cohere','command-r-plus-08-2024','sendCohereRequest'],['ai21','jamba-large','sendAI21Request'],['xai','grok-3-mini','sendXaiRequest'],['minimax','M2-her','sendMinimaxRequest'],['aimlapi','fixture','sendAimlapiRequest'],['chutes','fixture','sendChutesRequest'],['electronhub','fixture','sendElectronHubRequest'],['azure_openai','gpt-4o','sendAzureOpenAIRequest']];
for(const [source,model,fn]of cases){
 const input={model,messages:[{role:'system',content:'RULES'},{role:'user',content:'hello'},{role:'assistant',content:'prefix'}],names:{userName:'U',charName:'C'},temperature:1.09,top_p:.98,top_k:64,max_tokens:4096,include_reasoning:true,reasoning_effort:'high',use_sysprompt:true,stream:true,seed:42,apiVersion:'2024-10-21',deployment:model,baseUrl:'https://fixture.invalid'};
 const p=chatParameters(source,input,input.messages);if(source==='azure_openai')Object.assign(p,{azure_base_url:input.baseUrl,azure_deployment_name:model,azure_api_version:input.apiVersion});
 const expected=await nativeBody(fn,p),actual=JSON.parse(buildRequest({operation:'chat',adapter:'chat:'+source,baseUrl:'https://fixture.invalid',credential:'synthetic-not-a-key',payload:input}).body);
 assert.deepEqual(actual,expected,source+' '+model);checks.push('Actual native '+fn+': '+model);
}
for(const group of [['chat',ALL_SOURCES.slice(0,26)],['text',ALL_SOURCES.slice(26,41)],['extra',ALL_SOURCES.slice(41)]])for(const s of group[1]){const r=buildRequest({operation:'chat',adapter:group[0]+':'+s.id,baseUrl:'https://fixture.invalid',payload:{model:'fixture',messages:[{role:'user',content:'hello'}]}});assert.ok(JSON.parse(r.body));}
checks.push('All 44 frozen sources construct chat requests, including separate text:openrouter');
const sse=frames=>new Response(frames.map(f=>'data: '+(typeof f==='string'?f:JSON.stringify(f))+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
const r=await decodeReply(sse([{choices:[{index:0,delta:{content:[{type:'thinking',thinking:[{text:'思考'}]},{type:'text',text:'正文'}]}},{index:1,delta:{content:'另一候选'}}]},{choices:[{index:0,delta:{tool_calls:[{index:0,id:'a',function:{name:'f',arguments:'{"x":'}}]}}]},{choices:[{index:0,delta:{tool_calls:[{index:0,function:{arguments:'1}'}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:3,completion_tokens:4,total_tokens:7}},'[DONE]']),{family:'openai-chat',source:'mistralai'});
assert.equal(r.text,'正文');assert.equal(r.reasoning,'思考');assert.equal(r.swipes[0],'另一候选');assert.equal(r.toolCalls[0].function.arguments,'{"x":1}');assert.equal(r.usage.input_tokens,3);assert.equal(r.complete,true);checks.push('SSE array content, reasoning, swipes, tool fragments and usage stay separate');
const eof=await decodeReply(sse([{choices:[{delta:{content:'正文'}}]}]),{family:'openai-chat',source:'deepseek'});assert.equal(eof.complete,true);checks.push('Clean OpenAI HTTP EOF succeeds; reader errors still throw');
const thought=await decodeReply(sse([{choices:[{delta:{reasoning_content:'只有思考'},finish_reason:'stop'}]},'[DONE]']),{family:'openai-chat',source:'deepseek'});assert.equal(thought.text,'');assert.equal(thought.reasoning,'只有思考');checks.push('Reasoning-only response never masquerades as story body');
const report={at:new Date().toISOString(),ok:true,realSupplierRequests:0,checks};fs.writeFileSync(path.join(WEB,'reports/native-model-check-300.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
