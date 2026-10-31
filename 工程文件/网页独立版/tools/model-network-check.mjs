import http from 'node:http';
import dns from 'node:dns';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buildRequest} from '../src/models/adapters.mjs';
const {createPlayConnect}=createRequire(import.meta.url)('../../网站/gateway/play-connect.cjs');
const oldLookup=dns.lookup,oldAgent=http.globalAgent,oldLoopback=process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM;
process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM='1';
const seen=[];let upstreamCalls=0;
const upstream=http.createServer((req,res)=>{upstreamCalls++;assert.equal(req.url,'/v1/models');res.writeHead(401,{'content-type':'application/json'}).end(JSON.stringify({error:'fixture-invalid-key'}));});
await new Promise(done=>upstream.listen(0,'127.0.0.1',done));
const relay=createPlayConnect({authorize:()=>({row:{publisher_id:'fixture'}}),loadAdapters:async()=>({buildRequest}),send:(res,status,body,headers)=>res.writeHead(status,{'content-type':'application/json',...headers}).end(JSON.stringify(body)),readRawBody(req,res,max,done){const chunks=[];req.on('data',x=>chunks.push(x));req.on('end',()=>done(Buffer.concat(chunks)));}});
const server=http.createServer((req,res)=>relay.handle(req,res,new URL(req.url,'http://localhost'),req.method));
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const answer=(options,callback,address)=>options?.all?callback(null,[{address,family:4}]):callback(null,address,4);
try{
 // The operating environment exposes a virtual DNS address; its Agent owns routing.
 dns.lookup=(hostname,options,callback)=>hostname==='localhost'?answer(options,callback,'198.18.0.162'):oldLookup(hostname,options,callback);
 http.globalAgent=new http.Agent({lookup:(hostname,options,callback)=>{seen.push(hostname);answer(options,callback,'127.0.0.1');}});
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/play/connect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operation:'models',adapter:'chat:deepseek',baseUrl:'http://localhost:'+upstream.address().port+'/v1',credential:'fixture-nonsecret',payload:{}})});
 const data=await response.json();assert.equal(response.status,401,'Must reach upstream instead of rejecting virtual DNS: '+JSON.stringify(data));assert.equal(response.headers.get('x-cxx-error-origin'),'upstream');assert.equal(upstreamCalls,1);assert.deepEqual(seen,['localhost']);assert.equal(relay.stats().active,0);
 console.log(JSON.stringify({ok:true,checks:1,scope:'Real HTTP relay with virtual DNS and the native Node Agent; synthetic Key, no provider traffic'}));
}finally{
 http.globalAgent.destroy();http.globalAgent=oldAgent;dns.lookup=oldLookup;if(oldLoopback===undefined)delete process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM;else process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM=oldLoopback;
 server.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(done=>server.close(done)),new Promise(done=>upstream.close(done))]);
}
