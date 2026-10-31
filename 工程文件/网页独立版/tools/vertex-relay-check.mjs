import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildRequest} from '../src/models/adapters.mjs';
const {createPlayConnect}=createRequire(import.meta.url)('../../网站/gateway/play-connect.cjs');
const account={project_id:'fixture-project',client_email:'fixture@fixture-project.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\nfixture-only\n-----END PRIVATE KEY-----'};
const payload={authMode:'full',region:'global',model:'gemini-2.5-pro',messages:[{role:'user',content:'fixture'}]},checks=[];
process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM='1';
let request,tokenMode='success',authStarted,activeSignal;
const upstream=http.createServer((req,res)=>res.writeHead(401,{'content-type':'application/json'}).end(JSON.stringify({error:'fixture-upstream'})));
await new Promise(done=>upstream.listen(0,'127.0.0.1',done));
const target='http://127.0.0.1:'+upstream.address().port+'/v1';
const relay=createPlayConnect({authorize:()=>({row:{publisher_id:'fixture-publisher'}}),send:(res,status,body,headers)=>res.writeHead(status,{'content-type':'application/json',...headers}).end(JSON.stringify(body)),readRawBody(req,res,max,done){const chunks=[];req.on('data',x=>chunks.push(x));req.on('end',()=>done(Buffer.concat(chunks)));},loadAdapters:async()=>({buildRequest:args=>{request=buildRequest(args);return {...request,url:target};}}),vertexToken:async(value,{signal})=>{assert.equal(value.project_id,account.project_id);activeSignal=signal;authStarted?.();if(tokenMode==='failure')throw Error('do-not-echo-private-fixture');if(tokenMode==='wait')return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('fixture cancelled','AbortError')),{once:true}));return 'fixture-oauth-token';}});
const server=http.createServer((req,res)=>relay.handle(req,res,new URL(req.url,'http://localhost'),req.method));
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
const call=(options={},signal)=>fetch(origin+'/api/play/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'chat',adapter:'chat:vertexai',credential:{serviceAccount:account},payload,...options}),signal});
try{
 let response=await call();assert.equal(response.status,401);assert.equal((await response.json()).error,'fixture-upstream');assert.equal(request.headers.authorization,'Bearer fixture-oauth-token');assert.equal(request.headers['x-goog-api-key'],undefined);assert(request.url.startsWith('https://aiplatform.googleapis.com/v1/projects/fixture-project/locations/global/'));checks.push('Full account is exchanged inside the relay before target forwarding');
 tokenMode='failure';response=await call();assert.equal(response.status,400);const failure=await response.json();assert.equal(failure.error,'vertex_auth_failed');assert(!JSON.stringify(failure).includes('do-not-echo'));assert.equal(relay.stats().active,0);checks.push('OAuth failure is actionable, sanitized and releases its request slot');
 response=await call({credential:'fixture-express-key',payload:{...payload,authMode:'express'}});assert.equal((await response.json()).error,'fixture-upstream');assert.equal(request.headers['x-goog-api-key'],'fixture-express-key');assert.equal(request.headers.authorization,undefined);checks.push('Express uses API-key auth without running service-account exchange');
 tokenMode='wait';const entered=new Promise(done=>authStarted=done),controller=new AbortController(),pending=call({},controller.signal).catch(error=>error);await Promise.race([entered,pending.then(()=>{throw Error('fixture did not enter OAuth');})]);controller.abort();await pending;for(let i=0;i<30&&relay.stats().active;i++)await new Promise(done=>setTimeout(done,10));assert(activeSignal.aborted);assert.equal(relay.stats().active,0);checks.push('Disconnect aborts an in-progress OAuth request and releases its slot');
}finally{server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(done=>server.close(done)),new Promise(done=>upstream.close(done))]);}
console.log(JSON.stringify({ok:true,checks:checks.length,names:checks,scope:'Real loopback relay with injected OAuth and a local upstream; no Google or paid-model traffic'}));
