/** Real model-port HTTP failures retain bounded provider explanations. Synthetic upstreams, no paid requests. */
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
console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,supplierCalls:0}));
