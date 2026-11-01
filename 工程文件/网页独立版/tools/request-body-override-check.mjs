/** Real request adapters and an HTTP endpoint that requires connection-level fields. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {buildRequest} from '../src/models/adapters.mjs';
import {createDirectModelPort,createRelayModelPort} from '../src/models/port.mjs';
import {requestBodyOptions} from '../src/models/request-body.mjs';
import {CHAT_SOURCES,TEXT_SOURCES,EXTRA_MAIN_SOURCES} from '../src/models/registry.mjs';
const body={model:'fixture-model',messages:[{role:'user',content:'fixture'}],temperature:.8,top_k:7,stream:false};
const {createPlayConnect}=createRequire(import.meta.url)('../../网站/gateway/play-connect.cjs'),oldLoopback=process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM;
process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM='1';
const server=http.createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;const request=JSON.parse(text);if(request.route_token!=='fixture-route'||'top_k'in request)res.writeHead(400,{'content-type':'application/json'}).end(JSON.stringify({error:{message:'route_token is required and top_k must be omitted'}}));else res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({choices:[{message:{content:'连接成功'},finish_reason:'stop'}]}));});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const payload={adapter:'openai-chat',baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',credential:'fixture-key',body};
const gateway=createPlayConnect({authorize:()=>({row:{publisher_id:'fixture'}}),loadAdapters:async()=>({buildRequest}),send:(res,status,data,headers)=>res.writeHead(status,{'content-type':'application/json',...headers}).end(JSON.stringify(data)),readRawBody(req,res,max,done){const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>done(Buffer.concat(chunks)));}});
const relay=http.createServer((req,res)=>gateway.handle(req,res,new URL(req.url,'http://localhost'),req.method));await new Promise(done=>relay.listen(0,'127.0.0.1',done));
try{
 const port=createDirectModelPort({localNetwork:true});
 await assert.rejects(port.chat(payload),error=>error.status===400&&error.message.includes('route_token'));
 const result=await port.chat({...payload,provider:{bodyOverrides:{route_token:'fixture-route'},bodyOmissions:['top_k']}});
 assert.equal(result.text,'连接成功');
 const relayed=await createRelayModelPort({endpoint:'http://127.0.0.1:'+relay.address().port+'/api/play/connect'}).chat({...payload,provider:{bodyOverrides:{route_token:'fixture-route'},bodyOmissions:['top_k']}});assert.equal(relayed.text,'连接成功');assert.equal(gateway.stats().active,0);
 for(const adapter of ['chat:openai','chat:claude','google-gemini','text:ooba']){
  const request=buildRequest({operation:'chat',adapter,baseUrl:'https://fixture.test',payload:{...body,bodyOverrides:{route_token:'fixture-route',temperature:.25},bodyOmissions:['top_k']}}),sent=JSON.parse(request.body);
  assert.equal(sent.route_token,'fixture-route',adapter);assert.equal(sent.temperature,.25,adapter);assert(!('top_k'in sent),adapter);
 }
 let sources=0;for(const [prefix,rows]of [['chat:',CHAT_SOURCES],['text:',TEXT_SOURCES],['extra:',EXTRA_MAIN_SOURCES]])for(const row of rows){
  const sent=JSON.parse(buildRequest({operation:'chat',adapter:prefix+row.id,baseUrl:'https://fixture.test',payload:{...body,bodyOverrides:{route_token:'fixture-route'},bodyOmissions:['top_k']}}).body);
  assert.equal(sent.route_token,'fixture-route',prefix+row.id);assert(!('bodyOverrides'in sent));assert(!('bodyOmissions'in sent));sources++;
 }
 assert.deepEqual(requestBodyOptions({bodyOverrides:'route_token: fixture-route\ntemperature: 0.25',bodyOmissions:'[top_k, thinking]'}),{bodyOverrides:{route_token:'fixture-route',temperature:.25},bodyOmissions:['top_k','thinking']});
 assert.deepEqual(requestBodyOptions(),{bodyOverrides:{},bodyOmissions:[]});
 assert.throws(()=>requestBodyOptions({bodyOverrides:'[1,2]'}),/对象/);
 assert.throws(()=>requestBodyOptions({bodyOverrides:'{broken'}),/JSON\/YAML/);
 const custom=JSON.parse(buildRequest({operation:'chat',adapter:'chat:custom',baseUrl:'https://fixture.test',payload:{...body,presetSettings:{custom_include_body:'route_token: preset'},bodyOverrides:{route_token:'connection'}}}).body);assert.equal(custom.route_token,'connection');
 const malformed=createDirectModelPort({fetchImpl:async()=>Response.json({error:{message:'messages must be an array'}},{status:400})});await assert.rejects(malformed.chat({...payload,provider:{bodyOverrides:{messages:{unexpected:true}}}}),error=>error.status===400&&error.message.includes('messages must be an array'));
 const stream=buildRequest({operation:'chat',adapter:'chat:openai',baseUrl:'https://fixture.test',payload:{...body,stream:true,bodyOverrides:{stream:false},bodyOmissions:['temperature']}});assert.equal(stream.stream,false);assert(!('temperature'in JSON.parse(stream.body)));assert(!stream.warnings.some(row=>row.includes('temperature')));
 console.log(JSON.stringify({ok:true,checks:14,sourceOverrides:sources,supplierCalls:0,scope:'Real adapters, real gateway and local HTTP; baseline rejection becomes a successful generation'}));
}finally{server.closeAllConnections();relay.closeAllConnections();await Promise.all([new Promise(done=>server.close(done)),new Promise(done=>relay.close(done))]);if(oldLoopback===undefined)delete process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM;else process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM=oldLoopback;}
