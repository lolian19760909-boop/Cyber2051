/** Model transports share finite adapters, framing and explicit completion checks. No generation retries. */
import { buildRequest, resolveAdapter } from './adapters.mjs';
import {createReplyState} from './reply-state.mjs';
export class ModelError extends Error{constructor(code,message,extra={}){super(message||code);this.name='ModelError';this.code=code;Object.assign(this,extra);}}
const MAX_BYTES=16*1024*1024;
// Only fixed field names, types and counts leave the response decoder. Never retain values.
const characterCounts=value=>typeof value==='string'?{characters:value.length,nonWhitespace:value.replace(/\s/g,'').length,spaces:value.length-value.replace(/ /g,'').length}:{characters:0,nonWhitespace:0,spaces:0};
function requestDiagnostics(request){
 let body;try{body=JSON.parse(request.body||'{}');}catch{return {};}
 const messages=Array.isArray(body.messages)?body.messages:[];
 const allowed=(value,list)=>value===undefined?null:list.includes(value)?value:'other',stops=typeof body.stop==='string'?[body.stop]:Array.isArray(body.stop)?body.stop:[],pathname=new URL(request.url).pathname;
 return {endpointPath:/^(?:\/v\d+|\/beta)?\/(?:chat\/completions|completions|messages)$/.test(pathname)?pathname:'custom',stream:body.stream===true,responseFormat:allowed(body.response_format?.type,['text','json_object','json_schema']),thinking:allowed(body.thinking?.type,['enabled','disabled']),reasoningEffort:allowed(body.reasoning_effort,['none','minimal','low','medium','high','xhigh','max','auto']),temperature:Number.isFinite(body.temperature)?body.temperature:null,topP:Number.isFinite(body.top_p)?body.top_p:null,maxTokens:Number.isFinite(body.max_tokens)?body.max_tokens:null,maxCompletionTokens:Number.isFinite(body.max_completion_tokens)?body.max_completion_tokens:null,stop:{count:stops.length,characterLengths:stops.map(value=>typeof value==='string'?value.length:0)},toolsCount:Array.isArray(body.tools)?body.tools.length:0,toolChoice:typeof body.tool_choice==='object'?'named':allowed(body.tool_choice,['auto','none','required']),messageRoles:messages.reduce((counts,row)=>{if(['system','developer','user','assistant','tool'].includes(row?.role))counts[row.role]=(counts[row.role]||0)+1;return counts;},{}),lastMessageRole:allowed(messages.at(-1)?.role,['system','developer','user','assistant','tool'])};
}
function responseDiagnostics(response,{family,source}){
 const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 const report={schema:1,stage:'decode',httpStatus:response.status,contentType:/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime)?mime:'unrecognized',adapter:source,protocol:family,format:'unknown',frames:0,payloadCharacters:0,doneMarker:false,providerFinishReason:null,decodedCharacters:0,reasoningCharacters:0,messageContentCharacters:0,selectedContentCharacters:0,decodedNonWhitespaceCharacters:0,decodedSpaces:0,choices:[],fieldTypes:{},observations:[]};
 const type=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
 function observe(data){
  for(const [position,choice]of (Array.isArray(data?.choices)?data.choices:[]).entries()){
   const index=Number.isSafeInteger(choice.index)?choice.index:null;let row=report.choices.find(row=>row.position===position&&row.index===index);
   if(!row){row={position,index,frames:0,deltaContentCharacters:0,deltaContentNonWhitespaceCharacters:0,deltaContentSpaces:0,deltaNonEmptyFrames:0,messageContentCharacters:0,textCharacters:0,reasoningCharacters:0,toolCallFrames:0,firstContentFrame:null,lastContentFrame:null};report.choices.push(row);}
   row.frames++;const counts=characterCounts(choice.delta?.content);row.deltaContentCharacters+=counts.characters;row.deltaContentNonWhitespaceCharacters+=counts.nonWhitespace;row.deltaContentSpaces+=counts.spaces;if(counts.characters){row.deltaNonEmptyFrames++;row.firstContentFrame??=report.frames;row.lastContentFrame=report.frames;}
   row.messageContentCharacters+=characterCounts(choice.message?.content).characters;row.textCharacters+=characterCounts(choice.text).characters;row.reasoningCharacters+=characterCounts(choice.delta?.reasoning_content).characters+characterCounts(choice.message?.reasoning_content).characters;if(choice.delta?.tool_calls?.length||choice.message?.tool_calls?.length)row.toolCallFrames++;
  }
  if(data?.usage){const usage=data.usage;report.usage={};for(const[key,value]of Object.entries({promptTokens:usage.prompt_tokens,completionTokens:usage.completion_tokens,totalTokens:usage.total_tokens,reasoningTokens:usage.completion_tokens_details?.reasoning_tokens,cachedPromptTokens:usage.prompt_tokens_details?.cached_tokens}))if(Number.isFinite(value))report.usage[key]=value;}
  const c=data?.choices?.[0],values={'choices':data?.choices,'delta.content':c?.delta?.content,'delta.reasoning_content':c?.delta?.reasoning_content,'message.content':c?.message?.content,'message.reasoning_content':c?.message?.reasoning_content,'finish_reason':c?.finish_reason,'error':data?.error,'result':data?.result,'result.error':data?.result?.error,'output':data?.output};
  for(const[key,value]of Object.entries(values)){const list=report.fieldTypes[key]??=[];const t=type(value);if(!list.includes(t))list.push(t);}
  report.reasoningCharacters+=[c?.delta?.reasoning_content,c?.message?.reasoning_content].reduce((n,v)=>n+(typeof v==='string'?v.length:0),0);
  if(typeof c?.message?.content==='string')report.messageContentCharacters+=c.message.content.length;
  const reason=c?.finish_reason??data?.finish_reason??data?.delta?.stop_reason??data?.stop_reason??data?.candidates?.[0]?.finishReason??data?.done_reason;
  if(typeof reason==='string')report.providerFinishReason=['stop','length','tool_calls','content_filter','insufficient_system_resource','end_turn','stop_sequence','max_tokens','STOP','MAX_TOKENS','SAFETY','COMPLETE','complete','eos_token'].includes(reason)?reason:'other';
 }
 return {report,observe};
}

export async function* iterateSSE(response){
  if(!response.body)throw new ModelError('empty_response','模型响应没有正文');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',bytes=0,ended=false;
  try{
    while(true){const {done,value}=await reader.read();if(done){ended=true;break;}bytes+=value.byteLength;if(bytes>MAX_BYTES)throw new ModelError('response_too_large','模型回复超过限制');buffer+=decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){yield buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);}}
    buffer+=decoder.decode();if(buffer.trim())yield buffer.replace(/\r$/,'');
  }finally{if(!ended)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
async function* events(response){let event='',data=[];for await(const line of iterateSSE(response)){if(line===''){if(data.length)yield {event,data:data.join('\n')};event='';data=[];}else if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).trimStart());}if(data.length)yield {event,data:data.join('\n')};}
async function readText(response,onRead){const lines=[];for await(const line of iterateSSE(response))lines.push(line);const text=lines.join('\n');onRead?.({characters:text.length});return text;}
async function readJson(response,onRead){const text=await readText(response,onRead);try{return JSON.parse(text);}catch{throw new ModelError('bad_response','模型响应不是完整 JSON');}}
function responseErrorDetail(detail,text,request){
 const value=typeof detail==='string'?detail:detail?.error?.message??detail?.message??detail?.detail??detail?.error_description??(typeof detail?.error==='string'?detail.error:undefined);
 let message=typeof value==='string'?value:Array.isArray(value)?value.map(row=>typeof row==='string'?row:row?.msg||row?.message||'').filter(Boolean).join('；'):detail===undefined?text:'';
 message=String(message||'').replace(/\s+/g,' ').trim();
 for(const name of ['authorization','x-api-key','api-key','x-goog-api-key','apikey']){const secret=request.headers[name]?.replace(/^Bearer\s+/i,'');if(secret)message=message.split(secret).join('[密钥已隐藏]');}
 return message.length>500?message.slice(0,500)+'…':message;
}
function frame(value,event,family,source,diagnostics,reply){
  diagnostics.report.frames++;diagnostics.report.payloadCharacters+=value.length;
  if(value==='[DONE]'){diagnostics.report.doneMarker=true;return {done:true,text:''};}
  let data;try{data=JSON.parse(value);}catch{throw new ModelError('bad_stream','模型流包含损坏的数据帧');}
  diagnostics.observe(data);
  if(data.error||event==='error')throw new ModelError('upstream_error','模型服务在生成期间返回错误',{origin:'upstream'});
  if(data.promptFeedback?.blockReason)throw new ModelError('model_blocked','模型服务拒绝了此请求');
  const before=reply.result.text.length,part=reply.consume(data,{family,source,stream:true}),text=reply.result.text.slice(before);
  diagnostics.report.selectedContentCharacters+=text.length;return {text,...part};
}
const goodReason=reason=>!reason||['stop','end_turn','stop_sequence','STOP','COMPLETE','complete','eos_token','stop_sequence_reached','tool_calls','function_call','tool_use'].includes(reason);
function jsonText(data,family,source,reply){
  if(data.error||data.success===false)throw new ModelError('upstream_error','模型服务返回错误',{origin:'upstream'});
  const result=data.result||data;
  if(result.error||result.success===false)throw new ModelError('upstream_error','模型服务返回错误',{origin:'upstream'});
  if(result.promptFeedback?.blockReason)throw new ModelError('model_blocked','模型服务拒绝了此请求');
  const part=reply.consume(result,{family,source,stream:false});return {text:reply.result.text,reason:part.reason};
}
export async function decodeReply(response,{family,source,onDelta,onReasoning,onUsage,onProgress,signal,stream=true}){
  const diagnostics=responseDiagnostics(response,{family,source}),d=diagnostics.report;
  const reply=createReplyState({onReasoning,onUsage,onProgress});
  const type=response.headers.get('content-type')||'';let text='',reason,finished=false,streamed=false;
  try{
  if(type.includes('text/event-stream')){
    streamed=true;d.format='sse';
    // OpenAI-compatible streams end at DONE or clean HTTP EOF, not a per-choice finish field.
    // Match Tavern: consume every delta before completion and retain a separate cumulative body.
    const readUntilEnd=family!=='claude-messages';
    for await(const event of events(response)){if(signal?.aborted)throw new DOMException('已停止','AbortError');const part=frame(event.data,event.event,family,source,diagnostics,reply);if(part.text){text+=part.text;onDelta?.(part.text);}if(part.reason)reason=part.reason;if(part.done){finished=true;if(!readUntilEnd||d.doneMarker)break;}}
    // These native protocols define clean HTTP EOF as the end; they do not promise OpenAI's DONE.
    if(['openai-chat','azure-openai','text-generic','kobold-lite','novelai','kobold-classic','workersai'].includes(family))finished=true;
  }else if(type.includes('ndjson')||stream&&source==='ollama'&&type.includes('json')){
    streamed=true;d.format='ndjson';
    for await(const line of iterateSSE(response)){if(!line.trim())continue;const part=frame(line,'',family,source,diagnostics,reply);if(part.text){text+=part.text;onDelta?.(part.text);}if(part.reason)reason=part.reason;if(part.done){finished=true;break;}}
  }else{
    d.format='json';const data=await readJson(response);d.frames=1;d.payloadCharacters=JSON.stringify(data).length;diagnostics.observe(data);const part=jsonText(data,family,source,reply);text=part.text;d.selectedContentCharacters=characterCounts(text).characters;reason=part.reason;finished=true;if(text)onDelta?.(text);
  }
  if(signal?.aborted)throw new DOMException('已停止','AbortError');
  // 与酒馆一致：截断或连接中断时保留已生成的正文，标记 complete:false 交给回合层决定；空正文仍按失败处理。
  const truncated=!finished||!goodReason(reason);
   if(truncated&&!String(text||'').trim()&&!reply.result.toolCalls.length)throw new ModelError('incomplete_response','模型回复被截断或没有正常结束');
  d.stage='decoded';d.decodedCharacters=text.length;const counts=characterCounts(text);d.decodedNonWhitespaceCharacters=counts.nonWhitespace;d.decodedSpaces=counts.spaces;
  if(!text.length){d.observations.push('no_decoded_body');if(d.reasoningCharacters)d.observations.push('reasoning_without_body');if(d.format==='sse'&&d.messageContentCharacters)d.observations.push('message_content_instead_of_delta');}
   return {...reply.result,text,streamed,complete:!truncated,finishReason:reason||(finished?'normal_eof':'stream_closed'),diagnostics:d};
  }catch(error){d.decodedCharacters=text.length;const counts=characterCounts(text);d.decodedNonWhitespaceCharacters=counts.nonWhitespace;d.decodedSpaces=counts.spaces;d.failureCode=error instanceof ModelError?error.code:'decode_failed';if(d.failureCode==='bad_response')d.format='unrecognized';error.diagnostics=d;throw error;}

}
function normalizeResult(operation,data){
  if(operation==='models'){const list=data.data||data.models||data.model_names||data.result||(data.model_id?[{id:data.model_id}]:null)|| (data.result===undefined&&Array.isArray(data)?data:[]);return {models:Array.isArray(list)?list.map(row=>typeof row==='string'?{id:row}:({...row,id:row.id||row.name||row.model})):data.result?[{id:data.result}]:[],raw:data};}
  if(operation==='embeddings'){const vectors=data.data?.map(row=>row.embedding)||data.embeddings?.float||data.embeddings||data.embedding?.values&&[data.embedding.values]||data.predictions?.map(row=>row.embeddings?.values)||data.result?.data||[];return {vectors,raw:data};}
  if(operation==='rerank')return {results:(data.results||data.data||[]).map(row=>({index:row.index,score:row.relevance_score??row.score})),raw:data};
  if(operation==='tokenize'){const count=data.length??data.count??data.value??data.tokens?.length;if(!Number.isSafeInteger(count)||count<0)throw new ModelError('bad_response','远端分词接口未返回有效计数');return {count,ids:data.tokens??data.ids??[],raw:data};}
  return data;
}
function makePort(kind,transport){
  const novelSubscriptions=new Map();
  const tokenizerCapabilities=new Map();
  const prepare=(operation,payload)=>buildRequest({operation,adapter:payload.adapter||payload.family||'openai-chat',baseUrl:payload.baseUrl,credential:payload.credential,payload:{...(payload.provider||{}),...(payload.body||{})}});
  async function once(operation,payload,options={}){
    const selected=resolveAdapter(payload.adapter||payload.family||'openai-chat');
    if(operation==='chat'&&selected.family!=='novelai'){
      const {prepareSamplingTokens}=await import('./sampling-tokens.mjs');
      payload={...payload,body:await prepareSamplingTokens({...payload.provider,...payload.body},selected.id,selected.family,()=>tokenCounter(payload,{signal:options.signal}))};
    }
    if(operation==='chat'&&selected.family==='novelai'&&!payload.body?.nativeNovel){
      const key=String(payload.baseUrl||'')+'\0'+String(typeof payload.credential==='string'?payload.credential:payload.credential?.token||'');
      let subscription=payload.body?.novelSubscription||novelSubscriptions.get(key);
      if(!subscription){const status=await once('models',payload,{signal:options.signal});subscription=status.raw;novelSubscriptions.set(key,subscription);}
      const {prepareNovelPayload}=await import('./novelai.mjs');
      payload={...payload,body:await prepareNovelPayload({...payload.provider,...payload.body},{signal:options.signal,subscription})};
    }
    const request=prepare(operation,payload),warnings=request.warnings||[];
    const identity={adapter:selected.id,protocol:selected.family,provider:new URL(request.url).hostname,connection:kind,modelCredentialPresent:Boolean(request.headers.authorization||request.headers['x-api-key']||request.headers['api-key']||request.headers['x-goog-api-key']||request.headers.apikey||request.vertexServiceAccount),model:String(payload.body?.model||'').slice(0,160),request:requestDiagnostics(request)};
    let response;try{response=await transport(operation,payload,{...options,preparedRequest:request});}catch(error){if(operation==='chat')error.diagnostics={schema:1,...identity,httpStatus:null,format:'unavailable',stage:'transport'};throw error;}

    if(!response.ok){
      const diagnostic=responseDiagnostics(response,{family:selected.family,source:selected.id});let detail,text='';
      try{text=await readText(response,summary=>{diagnostic.report.errorBodyCharacters=summary.characters;});detail=JSON.parse(text);diagnostic.observe(detail);diagnostic.report.format='json';diagnostic.report.frames=1;diagnostic.report.payloadCharacters=text.length;}catch{diagnostic.report.format='unreadable';}
      const marker=response.headers.get('x-cxx-error-origin'),origin=['gateway','upstream','transport'].includes(marker)?marker:kind==='direct'?'upstream':'unknown';
      diagnostic.report.responseOrigin=origin;diagnostic.report.errorBodyState=diagnostic.report.format==='json'?'json':diagnostic.report.errorBodyCharacters===0?'empty':diagnostic.report.errorBodyCharacters>0?'not_json':'read_failed';
      const errorDetail=responseErrorDetail(detail,text,request);if(errorDetail)diagnostic.report.errorDetail=errorDetail;
      await response.body?.cancel().catch(()=>{});
      const auth=[401,403].includes(response.status),code=auth?(origin==='gateway'?'site_auth':origin==='upstream'?'model_auth':'auth_unknown'):response.status===429?'rate_limited':'model_request_failed';
      const summary=auth?(origin==='gateway'?(response.status===401?'本站登录已失效，请重新登录；模型配置已保留。':'本站账号当前无权调用模型转发服务；模型配置已保留。'):origin==='upstream'?'模型接口拒绝鉴权（'+response.status+'），请核对该接口使用的 API Key；本站登录与模型密钥是两套凭据。':'请求被拒绝（'+response.status+'），响应未标明来自本站还是模型服务；模型配置已保留。'):origin==='gateway'&&errorDetail?errorDetail:'模型请求失败（'+response.status+'）';
      const message=errorDetail&&summary!==errorDetail?summary+'：'+errorDetail:summary;
      throw new ModelError(code,message,{origin,status:response.status,warnings,parameterWarnings:warnings,diagnostics:{...diagnostic.report,...identity,stage:'http'}});
    }
    let result;try{result=operation!=='chat'||selected.family==='horde'?(operation==='chat'?await readJson(response):normalizeResult(operation,await readJson(response))):await decodeReply(response,{family:selected.family,source:selected.id,onDelta:options.onDelta,onReasoning:options.onReasoning,onUsage:options.onUsage,onProgress:options.onProgress,signal:options.signal,stream:request.stream});}catch(error){if(error.diagnostics)Object.assign(error.diagnostics,identity);throw error;}
    if(result.diagnostics)Object.assign(result.diagnostics,identity);
    return {...result,warnings,parameterWarnings:warnings};
  }
  const pause=(ms,signal)=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(new DOMException('已停止','AbortError'));const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);function abort(){clearTimeout(timer);reject(new DOMException('已停止','AbortError'));}signal?.addEventListener('abort',abort,{once:true});});
  async function chat(payload,options={}){
    if(resolveAdapter(payload.adapter||'openai-chat').family!=='horde')return once('chat',payload,options);
    let taskId;
    try{
      const start=await once('chat',payload,options);taskId=start.id;if(!taskId)throw new ModelError('bad_response','Horde 没有返回任务编号');
      const deadline=Date.now()+15*60*1000;
      while(Date.now()<deadline){await pause(1500,options.signal);const status=await once('chat',{...payload,body:{phase:'poll',taskId}},options);if(status.faulted)throw new ModelError('upstream_error','Horde 任务失败');if(status.done){const text=status.generations?.[0]?.text||'';options.onDelta?.(text);taskId=null;return {text,complete:true,streamed:false,finishReason:'stop'};}}
      throw new ModelError('timeout','Horde 任务等待超时');
    }finally{if(taskId)await once('chat',{...payload,body:{phase:'cancel',taskId}},{signal:AbortSignal.timeout(3000)}).catch(()=>{});}
  }
  async function tokenCounter(payload,options={}){
    const {prepareTokenCounter}=await import('./tokenizers.mjs'),selected=resolveAdapter(payload.adapter||payload.family||'openai-chat'),config={...payload.provider,...payload.body},remoteSources=['ooba','tabby','koboldcpp','llamacpp','vllm','aphrodite','kobold_classic'],eligible=remoteSources.includes(selected.id)&&config.tokenizer?.remote!==false;
    if(eligible){
      const key=JSON.stringify([selected.sourceId,payload.baseUrl,config.model,payload.credential]),count=text=>once('tokenize',{...payload,body:{model:config.model,text}},{signal:options.signal});
      if(!tokenizerCapabilities.has(key)){const probe=count('').then(()=>true,error=>{if(options.signal?.aborted)throw error;return false;});tokenizerCapabilities.set(key,probe);probe.catch(()=>tokenizerCapabilities.delete(key));}
      if(await tokenizerCapabilities.get(key)){
        const cache=new Map([['',0]]),countTextAsync=async text=>{const value=String(text);if(!cache.has(value))cache.set(value,count(value).then(r=>r.count));return cache.get(value);};
        return {source:'SillyTavern-1.19:remote:'+selected.id,estimate:false,async:true,encodeAsync:async text=>(await count(String(text))).ids,countTextAsync,countMessagesAsync:async messages=>{const {textPrompt}=await import('./text-requests.mjs');return countTextAsync(textPrompt(messages,config));}};
      }
    }
    const local=await prepareTokenCounter(payload,options);return eligible?{...local,source:local.source+':remote-unavailable',estimate:true}:local;
  }
  return {kind,parameters:payload=>prepare('chat',payload).warnings,tokenCounter,tokenize:(payload,options)=>once('tokenize',payload,options),models:(payload,options)=>once('models',payload,options),chat,embeddings:(payload,options)=>once('embeddings',payload,options),rerank:(payload,options)=>once('rerank',payload,options)};
}
export function createRelayModelPort(options={}){
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  return makePort(options.local?'local-relay':'relay',async(operation,payload,{signal}={})=>{
    const extra=typeof options.headers==='function'?await options.headers():options.headers||{};
    const token=typeof options.token==='function'?options.token():options.token;
    try{return await fetchImpl(options.endpoint||'/api/play/connect',{method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream, application/json',...extra,...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({operation,adapter:payload.adapter||'openai-chat',baseUrl:payload.baseUrl,credential:payload.credential||null,requestId:payload.requestId,payload:{...(payload.provider||{}),...(payload.body||{})}}),signal,credentials:'same-origin',redirect:'error'});}
    catch(error){if(signal?.aborted)throw new DOMException('已停止','AbortError');throw new ModelError('transport','连接模型转发服务失败',{origin:'transport'});}
  });
}
export function createDirectModelPort(options={}){
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  return makePort('direct',async(operation,payload,{signal,preparedRequest}={})=>{
    const request=preparedRequest||buildRequest({operation,adapter:payload.adapter||payload.family,baseUrl:payload.baseUrl,credential:payload.credential,payload:payload.body||{}}),url=new URL(request.url);
    if(url.protocol==='http:'&&!options.localNetwork&&!/^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname))throw new ModelError('insecure_target','公网模型需要 HTTPS');
    if(request.vertexServiceAccount)throw new ModelError('relay_required','服务账号方式请使用公网模型连接。');
    try{return await fetchImpl(request.url,{method:request.method,headers:request.headers,body:request.body,signal,credentials:'omit',mode:'cors',redirect:'error',referrerPolicy:'no-referrer'});}
    catch(error){if(signal?.aborted)throw new DOMException('已停止','AbortError');throw new ModelError('transport','模型直连失败，请核对地址、跨域和本地网络权限',{origin:'transport'});}
  });
}
export function createTavernModelPort({host}){
  if(typeof host?.generate!=='function')throw new ModelError('host_missing','酒馆模式缺少宿主生成能力');
  const tokenize=async(payload,options)=>{if(typeof host.tokenCounter!=='function')throw new ModelError('unsupported','宿主没有分词能力');if(typeof payload.body?.text!=='string')throw new ModelError('bad_parameter','分词输入须为文字');const counter=await host.tokenCounter(payload,options);return {count:await counter.countTextAsync(payload.body.text)};};
  return {kind:'host',...(typeof host.tokenCounter==='function'?{tokenCounter:(payload,options)=>host.tokenCounter(payload,options)}:{}),tokenize,models:async()=>({models:await host.models?.()||[]}),async chat(payload,{signal,onDelta,onReasoning,onUsage,onProgress}={}){const result=await host.generate({payload,signal,onDelta,onReasoning,onUsage,onProgress});if(signal?.aborted)throw new DOMException('已停止','AbortError');return {...(typeof result==='object'?result:{}),text:typeof result==='string'?result:String(result?.text??''),warnings:result?.warnings||[],complete:result?.complete!==false,streamed:!!onDelta};},embeddings:(payload,options)=>host.embeddings?host.embeddings(payload,options):Promise.reject(new ModelError('unsupported','宿主没有嵌入能力')),rerank:(payload,options)=>host.rerank?host.rerank(payload,options):Promise.reject(new ModelError('unsupported','宿主没有重排能力'))};
}
