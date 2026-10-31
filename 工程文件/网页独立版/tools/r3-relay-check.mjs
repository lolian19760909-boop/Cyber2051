import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createLocalServer } from './serve.mjs';
const {createPlayConnect}=createRequire(import.meta.url)('../../网站/gateway/play-connect.cjs');
process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM='1';
const results=[];
const check=async(name,fn)=>{console.log('CHECK '+name);try{await fn();results.push({name,ok:true});}catch(error){console.error('FAIL '+name+' '+error.message);results.push({name,ok:false,error:error.stack});}};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);});
let hits=0;const held=new Map(),received=[];
const upstream=http.createServer((req,res)=>{
 hits++;let raw='';req.on('data',chunk=>raw+=chunk);req.on('end',()=>{
  received.push({path:req.url,method:req.method,headers:req.headers,body:raw?JSON.parse(raw):null});
  if(req.url.startsWith('/hold/')){held.set(req.url,res);res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: {"choices":[{"delta":{"content":"HOLD"}}]}\n\n');return;}
  if(req.url.startsWith('/redirect/')){res.writeHead(302,{location:'/should-not-follow'}).end();return;}
  res.writeHead(200,{'content-type':'application/json','set-cookie':'upstream=must-not-forward','x-cxx-error-origin':'forged'}).end(JSON.stringify({data:[{id:'fixture'}]}));
 });
});
const upstreamPort=await listen(upstream);
function gateway({limits}={}){
 const play=createPlayConnect({limits,authorize:req=>req.headers.authorization==='Bearer banned'?{error:'banned',code:403}:req.headers.authorization?{row:{publisher_id:req.headers.authorization.slice(7)}}:{error:'unauthorized'},send:(res,status,body,headers)=>res.writeHead(status,{'content-type':'application/json',...headers}).end(JSON.stringify(body)),readRawBody(req,res,max,callback){let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size<=max)chunks.push(chunk);});req.on('end',()=>{if(size>max){res.writeHead(413).end();callback(null);}else callback(Buffer.concat(chunks));});}});
 const server=http.createServer((req,res)=>{if(!play.handle(req,res,new URL(req.url,'http://localhost'),req.method))res.writeHead(404).end();});
 return {server,play};
}
const primary=gateway(),port=await listen(primary.server),target='http://127.0.0.1:'+upstreamPort;
function call(path,account='A',extra={},signal){return fetch('http://127.0.0.1:'+port+'/api/play/connect',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+account,cookie:'site=private'},body:JSON.stringify({operation:'chat',adapter:'openai-chat',baseUrl:target+path,credential:'model-test',payload:{model:'m',messages:[{role:'user',content:'fixture'}],stream:true},...extra}),signal});}
try{
 await check('真实 publisher_id 隔离，完成一次只释放一个配额',async()=>{
  const a1=await call('/hold/a'),a2=await call('/hold/b'),b1=await call('/hold/c','B');assert.equal(b1.status,200);
  held.get('/hold/a/chat/completions').end('data: [DONE]\n\n');await a1.text();
  const a3=await call('/hold/d'),a4=await call('/hold/e');assert.equal(a3.status,200);assert.equal(a4.status,429);
  assert.equal(primary.play.stats().active,3);
  await Promise.all([a2.body.cancel(),a3.body.cancel(),b1.body.cancel()]);for(let i=0;i<40&&primary.play.stats().active;i++)await pause(10);
  assert.equal(primary.play.stats().active,0);assert.equal(primary.play.stats().accounts,0);
 });
 await check('未知适配器、任意头与操作均在上游之前拒绝',async()=>{
  const before=hits;for(const extra of [{adapter:'does-not-exist'},{credential:{header:'x-arbitrary',token:'x'}},{operation:'proxy_anything'}]){const response=await call('/not-a-model-api','A',extra);assert.equal(response.status,400);await response.text();}assert.equal(hits,before);
 });
 await check('模型列表固定 GET，站点凭据与上游响应头均隔离',async()=>{
  const response=await call('/v1','A',{operation:'models',payload:{}});
  assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('x-cxx-error-origin'),'none');await response.json();
  const request=received.at(-1);assert.equal(request.method,'GET');assert.equal(request.path,'/v1/models');assert.equal(request.headers.authorization,'Bearer model-test');assert.equal(request.headers.cookie,undefined);assert.equal(request.body,null);
 });
 await check('重定向不跟随；封禁保留 403 来源',async()=>{
  const before=hits,redirect=await call('/redirect');assert.equal(redirect.status,400);await redirect.text();assert.equal(hits,before+1);
  const banned=await call('/v1','banned');assert.equal(banned.status,403);assert.equal(banned.headers.get('x-cxx-error-origin'),'gateway');await banned.text();
 });
 await check('Node Agent解析期间断开，不连接迟到上游',async()=>{
  let resolve,start;const started=new Promise(done=>start=done),priorAgent=http.globalAgent;
  const agent=new http.Agent({lookup:(hostname,options,callback)=>{start();resolve=()=>options.all?callback(null,[{address:'127.0.0.1',family:4}]):callback(null,'127.0.0.1',4);}});
  http.globalAgent=agent;const isolated=gateway(),isolatedPort=await listen(isolated.server);
  try{const controller=new AbortController(),before=hits;
   const pending=fetch('http://127.0.0.1:'+isolatedPort+'/api/play/connect',{method:'POST',headers:{authorization:'Bearer DNS'},body:JSON.stringify({operation:'chat',adapter:'openai-chat',baseUrl:'http://localhost:'+upstreamPort+'/v1',payload:{messages:[{role:'user',content:'fixture'}]}}),signal:controller.signal}).catch(error=>error);
   await Promise.race([started,pending.then(()=>{throw Error('请求未进入Node Agent解析');})]);controller.abort();await pending;await pause(30);resolve();await pause(30);
   assert.equal(hits,before);assert.equal(isolated.play.stats().active,0);
  }finally{http.globalAgent=priorAgent;agent.destroy();await close(isolated.server);}
 });
 await check('本地免 Discord 适配器要求同源和临时凭据',async()=>{
  const local=createLocalServer(),localPort=await listen(local),origin='http://127.0.0.1:'+localPort;
  try{
   const noToken=await fetch(origin+'/api/play/connect',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(noToken.status,401);
   const nonce=await (await fetch(origin+'/api/local/session')).json();assert.equal(nonce.mode,'local');
   const foreign=await fetch(origin+'/api/play/connect',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json','x-cxx-local-token':nonce.token},body:'{}'});assert.equal(foreign.status,403);
   const valid=await fetch(origin+'/api/play/connect',{method:'POST',headers:{origin,'content-type':'application/json','x-cxx-local-token':nonce.token},body:JSON.stringify({operation:'models',adapter:'openai-chat',baseUrl:target+'/v1',credential:'local-test',payload:{}})});assert.equal(valid.status,200);await valid.text();
  }finally{await close(local);}
 });
}finally{await close(primary.server);await close(upstream);}
const report={at:new Date().toISOString(),scope:'实际 HTTP 回环网关和本机服务；合成账号，不含 Discord/TLS/Caddy',passed:results.filter(row=>row.ok).length,total:results.length,results};
fs.writeFileSync(new URL('../reports/r3-relay-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
for(const row of results)console.log((row.ok?'PASS ':'FAIL ')+row.name+(row.error?'\n'+row.error:''));
if(report.passed!==report.total)process.exitCode=1;
