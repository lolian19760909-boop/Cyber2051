/** Real model-port failures retain bounded provider explanations. Synthetic upstreams, no paid requests. */
import assert from 'node:assert/strict';
import {createDirectModelPort,createRelayModelPort} from '../src/models/port.mjs';
const payload={adapter:'google-gemini',baseUrl:'https://model.example/v1beta',credential:'fixture-token',body:{model:'gemini-fixture',messages:[{role:'user',content:'fixture'}],stream:false}};
const checks=[];
async function failure(name,create,body,expected,{status=400,origin='upstream',type='application/json',code='model_request_failed',detailExpected=expected}={}){
 const port=create({fetchImpl:async()=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':type,'x-cxx-error-origin':origin}})});
 let error;try{await port.chat(payload);}catch(value){error=value;}
 assert(error,name+': expected failure');assert.equal(error.code,code);assert.equal(error.status,status);assert(error.message.includes(expected),name+': '+error.message);
 if(detailExpected===null)assert.equal(error.diagnostics.errorDetail,undefined);else assert(error.diagnostics.errorDetail.includes(detailExpected));assert(!error.message.includes(payload.credential));assert(!error.diagnostics.errorDetail?.includes(payload.credential));checks.push(name);return error;
}
for(const [name,create]of [['direct',createDirectModelPort],['relay',createRelayModelPort]])await failure(name+' Gemini error.message',create,{error:{code:400,message:'generationConfig.thinkingConfig is not supported'}},'generationConfig.thinkingConfig is not supported');
await failure('top-level message',createDirectModelPort,{message:'top_k is unsupported'},'top_k is unsupported');
await failure('detail validation array',createRelayModelPort,{detail:[{msg:'missing route parameter'}]},'missing route parameter');
await failure('plain response',createDirectModelPort,'model temporarily unavailable','model temporarily unavailable',{status:503,type:'text/plain'});
await failure('empty body retains status',createDirectModelPort,'','400',{detailExpected:null});
await failure('site authentication stays distinct',createRelayModelPort,{message:'Please sign in'},'本站登录已失效',{status:401,origin:'gateway',code:'site_auth',detailExpected:'Please sign in'});
await failure('provider authentication includes explanation',createDirectModelPort,{error:{message:'Key fixture-token has expired'}},'Key [密钥已隐藏] has expired',{status:401,code:'model_auth'});
await failure('rate limit includes explanation',createRelayModelPort,{error:'quota exhausted'},'quota exhausted',{status:429,code:'rate_limited'});
const long=await failure('long explanations are bounded',createDirectModelPort,{error:{message:'X'.repeat(2000)}},'X'.repeat(50));assert.equal(long.diagnostics.errorDetail.length,501);
const success=await createDirectModelPort({fetchImpl:async()=>Response.json({candidates:[{content:{parts:[{text:'正文正常'}]},finishReason:'STOP'}]})}).chat(payload);
assert.equal(success.text,'正文正常');assert.equal(success.diagnostics.errorDetail,undefined);checks.push('successful body and diagnostics unchanged');
async function decodedFailure(name,create,body,expected,{type='application/json',received='',detailExpected=expected}={}){
 let calls=0,actual='',error;
 const port=create({fetchImpl:async()=>{calls++;return new Response(typeof body==='string'?body:JSON.stringify(body),{status:200,headers:{'content-type':type}});}});
 try{await port.chat({...payload,adapter:'openai-chat',body:{model:'fixture',messages:payload.body.messages,stream:true}},{onDelta:part=>actual+=part});}catch(value){error=value;}
 assert(error,name+': expected failure');assert.equal(error.code,'upstream_error');assert.equal(error.origin,'upstream');assert.equal(error.diagnostics.httpStatus,200);
 assert(error.message.includes(expected),name+': '+error.message);assert.equal(actual,received);assert.equal(error.diagnostics.decodedCharacters,received.length);assert.equal(calls,1);
 if(detailExpected===null)assert.equal(error.diagnostics.errorDetail,undefined);else assert(error.diagnostics.errorDetail.includes(detailExpected),name+': missing diagnostic detail');
 assert(!error.message.includes(payload.credential));assert(!JSON.stringify(error.diagnostics).includes(payload.credential));checks.push(name);return error;
}
const partial='data: '+JSON.stringify({choices:[{delta:{content:'已生成正文'}}]})+'\n\n';
for(const [name,create]of [['direct',createDirectModelPort],['relay',createRelayModelPort]])await decodedFailure(name+' SSE preserves detail and received text',create,partial+'data: '+JSON.stringify({error:{message:'Quota exhausted for fixture-token'}})+'\n\n','Quota exhausted for [密钥已隐藏]',{type:'text/event-stream',received:'已生成正文'});
await decodedFailure('SSE event error message',createDirectModelPort,'event: error\ndata: {"message":"worker overloaded"}\n\n','worker overloaded',{type:'text/event-stream'});
await decodedFailure('SSE string error',createRelayModelPort,'data: {"error":"quota exhausted"}\n\n','quota exhausted',{type:'text/event-stream'});
await decodedFailure('NDJSON error detail',createDirectModelPort,'{"error":"worker unavailable"}\n','worker unavailable',{type:'application/x-ndjson'});
for(const [name,body]of [['top-level error',{error:{message:'model unavailable'}}],['nested result error',{result:{error:{message:'model unavailable'}}}],['success false',{success:false,message:'model unavailable'}],['nested success false',{result:{success:false,message:'model unavailable'}}]])await decodedFailure('HTTP 200 '+name,createRelayModelPort,body,'model unavailable');
await decodedFailure('HTTP 200 key is redacted',createDirectModelPort,{error:{message:'Key fixture-token expired'}},'Key [密钥已隐藏] expired');
await decodedFailure('empty SSE error retains summary',createDirectModelPort,'event: error\ndata: {}\n\n','模型服务在生成期间返回错误',{type:'text/event-stream',detailExpected:null});
const streamLong=await decodedFailure('SSE explanations are bounded',createDirectModelPort,'data: '+JSON.stringify({error:{message:'X'.repeat(2000)}})+'\n\n','X'.repeat(50),{type:'text/event-stream'});assert.equal(streamLong.diagnostics.errorDetail.length,501);
console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,supplierCalls:0}));
