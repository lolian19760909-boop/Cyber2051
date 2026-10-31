'use strict';
/** Finite BYOK forwarding. Website auth is never forwarded; request data is never logged or stored. */
const https=require('node:https'),http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const OPERATIONS=new Set(['models','chat','embeddings','rerank','tokenize']);
const LIMITS=Object.freeze({requestBytes:2*1024*1024,responseBytes:16*1024*1024,concurrentPerAccount:2,globalConcurrent:32,connectMs:30000,firstByteMs:300000,idleMs:180000,totalMs:15*60000});
const unbracket=value=>value.replace(/^\[|\]$/g,'');
function parseTarget(raw){
  let url;try{url=new URL(String(raw||''));}catch{return {error:'模型基地址无法解析'};}
  const allowLoopback=process.env.CXX_PLAY_CONNECT_ALLOW_LOOPBACK_UPSTREAM==='1',local=['127.0.0.1','localhost','::1'].includes(unbracket(url.hostname));
  if(url.protocol!=='https:'&&!(allowLoopback&&local&&url.protocol==='http:'))return {error:'公网模型只允许 HTTPS'};
  if(url.username||url.password||url.hash||/[\\]/.test(String(raw))||/%(?:2e|2f|5c)/i.test(url.pathname)||/[?&](?:key|token|secret|api[-_]?key)=/i.test(url.search))return {error:'模型地址包含不允许的凭据或编码'};
  return {url,allowLoopback};
}
let adapterPromise,adapterFile;
function adapters(){
  const playRoot=path.join(__dirname,'public/play'),pointer=path.join(playRoot,'current.json');let file;
  if(fs.existsSync(pointer)){const current=JSON.parse(fs.readFileSync(pointer,'utf8'));if(!/^[a-f0-9]{20}$/.test(current.release))throw Error('网页版本入口无效');file=path.join(playRoot,'releases',current.release,'src/models/adapters.mjs');}
  else{const candidates=[path.resolve(__dirname,'../src/models/adapters.mjs'),path.resolve(__dirname,'../../网页独立版/src/models/adapters.mjs'),path.join(playRoot,'src/models/adapters.mjs')];file=candidates.find(file=>fs.existsSync(file))||candidates.at(-1);}
  if(file!==adapterFile){adapterFile=file;adapterPromise=import(pathToFileURL(file).href);}return adapterPromise;
}
function createPlayConnect(deps){
  const {send,readRawBody,authorize}=deps,limits={...LIMITS,...deps.limits},counts=new Map(),jobs=new Map();
  let active=0;
  const fail=(res,status,error,message,origin='gateway')=>{if(res.destroyed||res.writableEnded)return;if(res.headersSent){res.destroy();return;}send(res,status,{error,message},{'x-cxx-error-origin':origin,'cache-control':'no-store'});};
  function track(account){
    const value=counts.get(account)||0;if(value>=limits.concurrentPerAccount||active>=limits.globalConcurrent)return null;
    counts.set(account,value+1);active++;let released=false;
    return ()=>{if(released)return;released=true;active--;const left=(counts.get(account)||1)-1;if(left)counts.set(account,left);else counts.delete(account);};
  }
  function forward({request,target,res,scope,onJson,evidence=false}){
    const host=unbracket(target.hostname),transport=target.protocol==='https:'?https:http;
    let firstTimer,idleTimer,connectTimer,capture=[];
    const stopTimers=()=>{clearTimeout(firstTimer);clearTimeout(idleTimer);clearTimeout(connectTimer);};scope.cleanups.push(stopTimers);
    const upstream=transport.request({hostname:host,port:target.port||(target.protocol==='https:'?443:80),path:target.pathname+target.search,method:request.method,headers:{...request.headers,host:target.host,'accept-encoding':'identity'},rejectUnauthorized:true},response=>{
      if(scope.gone){response.destroy();return;}
      const status=response.statusCode||502;
      if(status>=300&&status<400){response.destroy();fail(res,400,'redirect_rejected','模型服务重定向被拒绝');scope.finish();return;}
      const headers={'content-type':response.headers['content-type']||'application/json','cache-control':'no-store','x-cxx-error-origin':status>=400?'upstream':'none','x-content-type-options':'nosniff'};
      if(evidence)headers['x-cxx-upstream-body-sha256']=createHash('sha256').update(request.body||'').digest('hex');
      if(response.headers['content-encoding'])headers['content-encoding']=response.headers['content-encoding'];
      res.writeHead(status,headers);let bytes=0;
      response.on('data',chunk=>{
        if(scope.gone)return;
        clearTimeout(firstTimer);bytes+=chunk.length;
        if(bytes>limits.responseBytes){response.destroy();res.destroy();scope.finish();return;}
        clearTimeout(idleTimer);idleTimer=setTimeout(()=>{response.destroy();res.destroy();scope.finish();},limits.idleMs);
        if(onJson&&bytes<=1024*1024)capture.push(chunk);
        if(!res.write(chunk))response.pause();
      });
      res.on('drain',()=>response.resume());
      response.on('end',()=>{stopTimers();if(onJson&&status<300){try{onJson(JSON.parse(Buffer.concat(capture).toString('utf8')));}catch{}}if(!res.destroyed)res.end();scope.finish();});
      response.on('error',()=>{res.destroy();scope.finish();});
      response.on('aborted',()=>{res.destroy();scope.finish();});
    });
    scope.upstream=upstream;
    const onConnected=()=>{clearTimeout(connectTimer);firstTimer=setTimeout(()=>{upstream.destroy();fail(res,504,'first_byte_timeout','模型首字节超时','transport');scope.finish();},limits.firstByteMs);};
    upstream.once('socket',socket=>{if(upstream.reusedSocket){onConnected();return;}connectTimer=setTimeout(()=>{upstream.destroy();fail(res,504,'connect_timeout','模型连接超时','transport');scope.finish();},limits.connectMs);socket.once(target.protocol==='https:'?'secureConnect':'connect',onConnected);});
    upstream.once('error',()=>{stopTimers();fail(res,502,'upstream_unreachable','模型连接中断','transport');scope.finish();});
    upstream.end(request.body);
  }
  function handle(req,res,url,method){
    if(url.pathname!=='/api/play/connect')return false;
    if(method!=='POST'){fail(res,405,'method_not_allowed','只接受 POST');return true;}
    const auth=authorize(req);
    if(auth?.error||!auth?.row?.publisher_id){fail(res,auth?.code===403?403:401,auth?.error==='banned'?'banned':'unauthorized','需要有效登录且账号未被封禁');return true;}
    const account=String(auth.row.publisher_id),release=track(account);
    if(!release){fail(res,429,'too_many_in_flight','模型请求并发已达上限，请稍后手动重试');return true;}
    const scope={gone:false,upstream:null,cleanups:[]};
    let finished=false,reservation=null;
    scope.finish=()=>{if(finished)return;finished=true;for(const cleanup of scope.cleanups)cleanup();if(reservation)jobs.delete(reservation);release();};
    const gone=()=>{scope.gone=true;scope.upstream?.destroy();scope.finish();};
    res.once('close',()=>{if(!res.writableEnded)gone();else scope.finish();});req.once('aborted',gone);
    res.once('finish',scope.finish);
    const total=setTimeout(()=>{scope.upstream?.destroy();fail(res,504,'total_timeout','模型请求超过总时限','transport');scope.finish();},limits.totalMs);scope.cleanups.push(()=>clearTimeout(total));
    const readTimer=setTimeout(()=>{fail(res,408,'body_timeout','请求体读取超时');scope.finish();req.destroy();},limits.connectMs);scope.cleanups.push(()=>clearTimeout(readTimer));
    readRawBody(req,res,limits.requestBytes,raw=>{
      clearTimeout(readTimer);if(raw===null||scope.gone){scope.finish();return;}
      (async()=>{
        let envelope;try{envelope=JSON.parse(Buffer.isBuffer(raw)?raw.toString('utf8'):String(raw));}catch{fail(res,400,'bad_json','请求体不是有效 JSON');scope.finish();return;}
        if(!OPERATIONS.has(envelope.operation)){fail(res,400,'bad_operation','不支持的模型操作');scope.finish();return;}
        const module=await (deps.loadAdapters?deps.loadAdapters():adapters());
        if(scope.gone||finished)return;
        let request;try{request=module.buildRequest({operation:envelope.operation,adapter:envelope.adapter,baseUrl:envelope.baseUrl,credential:envelope.credential,payload:envelope.payload||{}});}catch(error){fail(res,400,error.code||'bad_request',error.code==='bad_adapter'?'未登记的模型适配器':'模型连接配置或请求无效');scope.finish();return;}
        const parsed=parseTarget(request.url);if(parsed.error){fail(res,400,'bad_target',parsed.error);scope.finish();return;}
        if(request.body&&Buffer.byteLength(request.body)>limits.requestBytes){fail(res,413,'payload_too_large','模型请求超过专用限额');scope.finish();return;}
        if(request.vertexServiceAccount){
          const controller=new AbortController();scope.cleanups.push(()=>controller.abort());
          try{const token=await (deps.vertexToken||require('./vertex-auth.cjs').serviceAccountToken)(request.vertexServiceAccount,{signal:controller.signal});if(scope.gone||finished)return;request.headers.authorization='Bearer '+token;}
          catch{fail(res,400,'vertex_auth_failed','Google服务账号鉴权失败，请检查账号JSON和Vertex权限。');scope.finish();return;}
        }
        let onJson;
        if(request.family==='horde'&&envelope.operation==='chat'){
          for(const [key,value]of jobs)if(value.expires<Date.now())jobs.delete(key);
          const prefix=account+'|'+parsed.url.origin+'|',phase=envelope.payload?.phase,id=envelope.payload?.taskId;
          if(phase==='poll'||phase==='cancel'){
            const key=prefix+id;if(!jobs.has(key)){fail(res,400,'unknown_task','此账号没有该模型任务');scope.finish();return;}
            onJson=data=>{if(phase==='cancel'||data.done||data.faulted)jobs.delete(key);};
          }else{
            if([...jobs.entries()].filter(([key])=>key.startsWith(account+'|')).length>=limits.concurrentPerAccount||jobs.size>=limits.globalConcurrent){fail(res,429,'too_many_jobs','等待中的模型任务已达上限');scope.finish();return;}
            reservation=prefix+'pending-'+Math.random();jobs.set(reservation,{expires:Date.now()+limits.totalMs});
            onJson=data=>{if(typeof data.id==='string'&&/^[a-zA-Z0-9-]{1,128}$/.test(data.id)){jobs.delete(reservation);reservation=null;jobs.set(prefix+data.id,{expires:Date.now()+limits.totalMs});}};
          }
        }
        if(scope.gone||finished)return;
        forward({request,target:parsed.url,res,scope,onJson,evidence:envelope.operation==='chat'&&req.headers['x-cxx-evidence']==='request-body-sha256-v1'});
      })().catch(()=>{fail(res,500,'relay_failed','模型转发未完成');scope.finish();});
    });
    return true;
  }
  return {handle,LIMITS:limits,OPERATIONS,stats:()=>({active,accounts:counts.size,pendingJobs:jobs.size})};
}
module.exports={createPlayConnect,LIMITS,parseTarget,OPERATIONS};
