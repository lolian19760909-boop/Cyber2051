import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRequest } from '../src/models/adapters.mjs';
import { CHAT_SOURCES,TEXT_SOURCES,EXTRA_MAIN_SOURCES } from '../src/models/registry.mjs';
import { createDirectModelPort,createRelayModelPort } from '../src/models/port.mjs';
const results=[];
async function check(name,fn){try{await fn();results.push({name,ok:true});}catch(error){results.push({name,ok:false,error:error.stack});}}
const messages=[{role:'system',content:'RULE'},{role:'user',content:'INPUT'}],body={model:'fixture-model',messages,max_tokens:128,temperature:.5,stream:true};
await check('44 个冻结来源可构造有限生成请求，不接受任意适配器或凭据头',async()=>{
 const groups=[['chat:',CHAT_SOURCES],['text:',TEXT_SOURCES],['extra:',EXTRA_MAIN_SOURCES]];let count=0;
 for(const [prefix,rows]of groups)for(const row of rows){const request=buildRequest({operation:'chat',adapter:prefix+row.id,baseUrl:row.family==='workersai'?'https://fixture.test/client/v4/accounts/account/ai':'https://fixture.test',credential:'fixture-key',payload:body});assert.equal(request.method,'POST');assert.ok(JSON.parse(request.body));assert.equal(new URL(request.url).hostname,'fixture.test');count++;}
 assert.equal(count,44);
 assert.throws(()=>buildRequest({operation:'models',adapter:'unknown',baseUrl:'https://fixture.test'}),error=>error.code==='bad_adapter');
 assert.throws(()=>buildRequest({operation:'models',adapter:'openai-chat',baseUrl:'https://fixture.test',credential:{header:'x-forward-anything',token:'x'}}),error=>error.code==='bad_credential');
});
await check('操作对应独立方法、路径、鉴权和请求形状',async()=>{
 const request=(adapter,operation,payload=body,baseUrl='https://fixture.test')=>buildRequest({adapter,operation,payload,baseUrl,credential:'fixture-key'});
 assert.equal(request('openai-chat','models').method,'GET');assert.equal(request('openai-chat','models').body,undefined);assert.equal(new URL(request('openai-chat','models').url).pathname,'/v1/models');
 assert.equal(new URL(request('claude-messages','chat').url).pathname,'/v1/messages');assert.equal(request('claude-messages','chat').headers['x-api-key'],'fixture-key');assert.equal(JSON.parse(request('claude-messages','chat').body).system,'RULE');
 assert.equal(new URL(request('text:ollama','chat').url).pathname,'/api/generate');assert.equal(JSON.parse(request('text:ollama','chat').body).raw,true);
 assert.equal(new URL(request('text:openrouter','chat').url).pathname,'/v1/chat/completions');
 assert.equal(new URL(request('text:mancer','chat').url).pathname,'/oai/v1/completions');assert.equal(new URL(request('text:dreamgen','chat').url).pathname,'/api/openai/v1/completions');
 assert.equal(request('google-gemini','chat').headers['x-goog-api-key'],'fixture-key');assert.equal(new URL(request('google-gemini','chat').url).search,'?alt=sse');
 assert.equal(new URL(request('openai-chat','embeddings',{model:'embed',input:['x']}).url).pathname,'/v1/embeddings');
 assert.equal(new URL(request('cohere','rerank',{model:'rerank',query:'x',documents:['a']}).url).pathname,'/v2/rerank');
});
const fixtures=[
 ['openai-chat','text/event-stream',[{choices:[{delta:{content:'OPENAI'}}]},'[DONE]'],'OPENAI'],
 ['claude-messages','text/event-stream',[{type:'content_block_delta',delta:{type:'text_delta',text:'CLAUDE'}},{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}],'CLAUDE'],
 ['google-gemini','text/event-stream',[{candidates:[{content:{parts:[{text:'GEMINI'}]},finishReason:'STOP'}]}],'GEMINI'],
 ['vertex-ai','text/event-stream',[{candidates:[{content:{parts:[{text:'VERTEX'}]},finishReason:'STOP'}]}],'VERTEX'],
 ['cohere','text/event-stream',[{type:'content-delta',delta:{message:{content:{text:'COHERE'}}}},{type:'message-end',delta:{finish_reason:'COMPLETE'}}],'COHERE'],
 ['workersai','text/event-stream',[{response:'WORKERS'},'[DONE]'],'WORKERS'],
 ['text-generic','text/event-stream',[{choices:[{text:'TEXT',finish_reason:'stop'}]}],'TEXT'],
 ['kobold-lite','text/event-stream',[{choices:[{text:'KCPP',finish_reason:'stop'}]}],'KCPP'],
 ['kobold-classic','text/event-stream',[{token:'KOBOLD'}],'KOBOLD'],
 ['novelai','text/event-stream',[{token:'NOVEL'}],'NOVEL'],
 ['text:ollama','application/x-ndjson',[{response:'OLLAMA',done:false},{done:true,done_reason:'stop'}],'OLLAMA'],
 ['text:llamacpp','text/event-stream',[{content:'LLAMA',stop:false},{stop:true,stopped_eos:true}],'LLAMA'],
];
for(const [adapter,type,frames,expected] of fixtures)await check('协议解码与正常结束：'+adapter,async()=>{
 const raw=frames.map(value=>type.includes('ndjson')?JSON.stringify(value)+'\n':'data: '+(typeof value==='string'?value:JSON.stringify(value))+'\n\n').join('');
 const port=createRelayModelPort({fetchImpl:async()=>new Response(raw,{headers:{'content-type':type}})});
 const result=await port.chat({adapter,baseUrl:'https://fixture.test',body});assert.equal(result.text,expected);assert.equal(result.complete,true);
});
await check('截断正文保留为未完成，坏帧和错误帧仍拒绝',async()=>{
 for(const raw of ['data: {"choices":[{"delta":{"content":"HALF"}}]}\n\n','data: {"choices":[{"delta":{"content":"HALF"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n','data: {BROKEN}\n\n','event: error\ndata: {"error":{"message":"secret-echo"}}\n\n']){
  const port=createRelayModelPort({fetchImpl:async()=>new Response(raw,{headers:{'content-type':'text/event-stream'}})});
  if(raw.includes('HALF')){const partial=await port.chat({adapter:'openai-chat',baseUrl:'https://fixture.test',body});assert.equal(partial.text,'HALF');assert.equal(partial.complete,false);}else await assert.rejects(port.chat({adapter:'openai-chat',baseUrl:'https://fixture.test',body}),error=>['bad_stream','incomplete_response','upstream_error'].includes(error.code));
 }
});
await check('OpenAI兼容流逐choice结束不提前取消，空delta不覆盖正文或错误回退',async()=>{
 const frame=value=>'data: '+(typeof value==='string'?value:JSON.stringify(value))+'\n\n';
 const payloads=[
  [[{choices:[{delta:{reasoning_content:'THINKING'}}]},{choices:[{delta:{content:''},finish_reason:'stop'}]},{choices:[{delta:{content:'正文'}}]},'[DONE]'],'正文'],
  [[{choices:[{delta:{content:'正文'},finish_reason:'stop'}]},{choices:[],usage:{total_tokens:1}},'[DONE]'],'正文'],
  [[{choices:[{message:{content:'正文'},finish_reason:'stop'}]},'[DONE]'],'正文'],
  [[{choices:[{delta:{content:''},message:{content:'WRONG'},finish_reason:'stop'}]},'[DONE]'],''],
 ];
 for(const[frames,expected]of payloads){let emitted='';const port=createRelayModelPort({fetchImpl:async()=>new Response(frames.map(frame).join(''),{headers:{'content-type':'text/event-stream'}})}),reply=await port.chat({adapter:'openai-chat',baseUrl:'https://fixture.test',body},{onDelta:delta=>emitted+=delta});assert.equal(reply.text,expected);assert.equal(emitted,expected);assert.equal(reply.diagnostics.doneMarker,true);assert.equal(reply.complete,true);}
});
await check('直连 GET 模型列表支持内网 HTTP，不携带站点凭据',async()=>{
 let call;const port=createDirectModelPort({fetchImpl:async(url,options)=>{call={url,options};return Response.json({data:[{id:'local-model'}]});}});
 const result=await port.models({adapter:'openai-chat',baseUrl:'http://192.168.1.5:1234/v1',credential:'fixture-key',body:{}});
 assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');assert.equal(call.options.redirect,'error');assert.equal(call.options.body,undefined);assert.equal(result.models[0].id,'local-model');
});
await check('站点 401 与模型 401 分开，不自动重发',async()=>{
 for(const origin of ['gateway','upstream']){let calls=0;const port=createRelayModelPort({fetchImpl:async()=>{calls++;return new Response('{}',{status:401,headers:{'x-cxx-error-origin':origin}});}});await assert.rejects(port.chat({adapter:'openai-chat',baseUrl:'https://fixture.test',body}),error=>error.code===(origin==='gateway'?'site_auth':'model_auth'));assert.equal(calls,1);}
});
await check('真OpenAI仅标准字段，generic兼容保留扩展；auto表示服务商默认',async()=>{
 const payload={...body,top_k:64,top_a:.2,min_p:.1,repetition_penalty:1.2,reasoning_effort:'low',verbosity:'high'},official=buildRequest({operation:'chat',adapter:'openai-chat',baseUrl:'https://api.openai.com/v1',payload}),native=JSON.parse(official.body);
 for(const field of ['top_k','top_a','min_p','repetition_penalty','max_tokens'])assert.equal(native[field],undefined);assert.equal(native.max_completion_tokens,128);assert.equal(native.reasoning_effort,'low');assert.equal(native.verbosity,'high');assert.equal(official.warnings.length,4);
 const generic=buildRequest({operation:'chat',adapter:'openai-chat',baseUrl:'https://compatible.test/v1',payload}),expanded=JSON.parse(generic.body);assert.equal(expanded.top_a,.2);assert.equal(expanded.min_p,.1);assert.equal(expanded.top_k,64);assert.equal(expanded.verbosity,'high');assert.deepEqual(generic.warnings,[]);
 const automatic=JSON.parse(buildRequest({operation:'chat',adapter:'openai-chat',baseUrl:'https://api.openai.com/v1',payload:{...body,verbosity:'auto',reasoning_effort:'auto',seed:-1}}).body);assert.equal(automatic.verbosity,undefined);assert.equal(automatic.reasoning_effort,undefined);assert.equal(automatic.seed,undefined);
 const textRequest=buildRequest({operation:'chat',adapter:'text-generic',baseUrl:'https://api.openai.com/v1',payload}),legacy=JSON.parse(textRequest.body);assert.equal(legacy.max_tokens,128);assert.equal(legacy.max_completion_tokens,undefined);assert.equal(legacy.reasoning_effort,undefined);assert.equal(legacy.verbosity,undefined);assert.ok(textRequest.warnings.some(row=>row.includes('reasoning_effort')));assert.ok(textRequest.warnings.some(row=>row.includes('verbosity')));
});
await check('DeepSeek按酒馆兼容传递字段，已弃用惩罚仍明确提示无效',async()=>{
 const request=buildRequest({operation:'chat',adapter:'chat:deepseek',payload:{...body,top_k:64,frequency_penalty:.4,presence_penalty:.2,reasoning_effort:'high',verbosity:'high',top_p:.9}}),native=JSON.parse(request.body);assert.equal(native.frequency_penalty,.4);assert.equal(native.presence_penalty,.2);assert.deepEqual(native.thinking,{type:'enabled'});assert.equal(native.top_k,undefined);assert.equal(native.reasoning_effort,'high');assert.ok(request.warnings.some(row=>row.includes('frequency_penalty')));assert.ok(request.warnings.some(row=>row.includes('top_p')));
});
await check('Claude／Gemini停止词别名与Gemini惩罚／seed正确映射',async()=>{
 const payload={...body,stop:'END',top_k:0,frequency_penalty:.3,presence_penalty:.2,seed:123},request=(adapter)=>buildRequest({operation:'chat',adapter,baseUrl:'https://fixture.test',payload});const claude=JSON.parse(request('claude-messages').body),gemini=JSON.parse(request('google-gemini').body).generationConfig;assert.deepEqual(claude.stop_sequences,['END']);assert.equal(claude.top_k,undefined);assert.deepEqual(gemini.stopSequences,['END']);assert.equal(gemini.frequencyPenalty,.3);assert.equal(gemini.presencePenalty,.2);assert.equal(gemini.seed,123);assert.equal(gemini.topK,undefined);assert.equal(payload.stop,'END');
 const alias=JSON.parse(buildRequest({operation:'chat',adapter:'google-gemini',payload:{...body,stop_sequences:['A','B']}}).body);assert.deepEqual(alias.generationConfig.stopSequences,['A','B']);
});
await check('Cohere v2使用k/p和stop_sequences，超出供应商p范围明确提示',async()=>{
 const request=buildRequest({operation:'chat',adapter:'cohere',payload:{...body,top_k:64,top_p:.9,stop:['END'],frequency_penalty:.2,presence_penalty:.3,seed:1}}),native=JSON.parse(request.body);assert.equal(native.k,64);assert.equal(native.p,.9);assert.equal(native.top_k,undefined);assert.equal(native.top_p,undefined);assert.deepEqual(native.stop_sequences,['END']);assert.equal(native.frequency_penalty,.2);assert.equal(native.presence_penalty,.3);assert.deepEqual(request.warnings,[]);
 const invalid=buildRequest({operation:'chat',adapter:'cohere',payload:{...body,top_p:1}});assert.equal(JSON.parse(invalid.body).p,undefined);assert.ok(invalid.warnings.some(row=>row.includes('0.01')));
});
await check('直连／转发结果和付费前参数检查透出相同警示，模型不重试',async()=>{
 for(const make of [createDirectModelPort,createRelayModelPort]){let calls=0;const port=make({fetchImpl:async()=>{calls++;return Response.json({choices:[{message:{content:'ONE'},finish_reason:'stop'}]});}}),payload={adapter:'openai-chat',baseUrl:'https://api.openai.com/v1',body:{...body,stream:false,top_k:64,min_p:.1}};assert.equal(port.parameters(payload).length,2);const result=await port.chat(payload);assert.equal(result.text,'ONE');assert.equal(result.warnings.length,2);assert.deepEqual(result.parameterWarnings,result.warnings);assert.equal(calls,1);}
});
await check('Horde 只启动一次，后续仅查询；完成正文可提交',async()=>{
 const phases=[];const port=createRelayModelPort({fetchImpl:async(url,options)=>{const envelope=JSON.parse(options.body);phases.push(envelope.payload.phase||'start');return Response.json(envelope.payload.phase==='poll'?{done:true,generations:[{text:'HORDE'}]}:{id:'fixture-job'});}});
 const result=await port.chat({adapter:'horde',body});assert.equal(result.text,'HORDE');assert.deepEqual(phases,['start','poll']);
});
const report={at:new Date().toISOString(),scope:'合成协议及请求形状；无真实供应商验收',total:results.length,passed:results.filter(row=>row.ok).length,results};
fs.writeFileSync(new URL('../reports/r3-model-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for(const row of results)console.log((row.ok?'PASS ':'FAIL ')+row.name+(row.error?'\n'+row.error:''));
if(report.passed!==report.total)process.exitCode=1;
