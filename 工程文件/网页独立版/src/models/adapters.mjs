/** Finite protocol requests. Shared by browser direct connections and the gateway. */
import {SERVICE_DEFAULTS,connectionDefaults} from './connections.mjs';
import { CHAT_SOURCES, TEXT_SOURCES, EXTRA_MAIN_SOURCES, PROTOCOL_FAMILIES } from './registry.mjs';
import {providerRequest} from './provider-requests.mjs';
import {textRequest,textPrompt as nativeTextPrompt} from './text-requests.mjs';
import {novelRequest} from './novelai.mjs';
import {nativeKoboldBody,kai_settings} from './native/kobold.mjs';
export class AdapterError extends Error{constructor(code,message){super(message||code);this.code=code;}}
export const OPERATIONS=Object.freeze(['models','chat','embeddings','rerank','tokenize']);
const sources=new Map([...CHAT_SOURCES.map(row=>['chat:'+row.id,row]),...TEXT_SOURCES.map(row=>['text:'+row.id,row]),...EXTRA_MAIN_SOURCES.map(row=>['extra:'+row.id,row])]);
const defaults=SERVICE_DEFAULTS;
export function resolveAdapter(id){
  if(id==='openai-compatible')id='openai-chat';
  if(sources.has(id))return {...sources.get(id),sourceId:id};
  const source=[...sources.values()].find(row=>row.id===id);
  if(source)return {...source,sourceId:id};
  if(Object.hasOwn(PROTOCOL_FAMILIES,id))return {id,family:id,sourceId:id};
  throw new AdapterError('bad_adapter','未登记的模型适配器');
}
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
const samplingFields=['temperature','top_p','top_k','top_a','min_p','frequency_penalty','presence_penalty','repetition_penalty','max_tokens','stop','stop_sequences','seed','reasoning_effort','verbosity'];
const neutral={temperature:1,top_p:1,top_k:0,top_a:0,min_p:0,frequency_penalty:0,presence_penalty:0,repetition_penalty:1,seed:-1};
const meaningful=(key,value)=>value!==undefined&&value!==null&&value!==''&&value!=='auto'&&(!Array.isArray(value)||value.length>0)&&value!==neutral[key];
function stopList(value){if(value===undefined||value===null)return undefined;const list=Array.isArray(value)?value:[value];if(list.some(item=>typeof item!=='string'))throw new AdapterError('bad_parameter','停止词须为文字或文字数组');return list;}
function parameterNotes(payload,body,family,source){
 const mapped=key=>{if(['google-gemini','vertex-ai'].includes(family)){const aliases={temperature:'temperature',top_p:'topP',top_k:'topK',max_tokens:'maxOutputTokens',stop:'stopSequences',stop_sequences:'stopSequences',frequency_penalty:'frequencyPenalty',presence_penalty:'presencePenalty',seed:'seed'};return body?.generationConfig?.[aliases[key]];}
  if(family==='claude-messages')return body?.[key==='stop'?'stop_sequences':key];
  if(family==='cohere')return body?.[({top_p:'p',top_k:'k',stop:'stop_sequences'})[key]||key];
  if(source==='ollama')return body?.options?.[key==='max_tokens'?'num_predict':key];
  if(source==='llamacpp')return body?.[key==='max_tokens'?'n_predict':key];
  if(['novelai','horde'].includes(family))return (body?.parameters||body?.params)?.[key==='max_tokens'?'max_length':key];
  if(family==='kobold-classic')return body?.[({max_tokens:'max_length',repetition_penalty:'rep_pen',stop:'stop_sequence',stop_sequences:'stop_sequence'})[key]||key];
  return body?.[key]??(key==='max_tokens'?body?.max_completion_tokens:undefined);};
 return samplingFields.filter(key=>meaningful(key,payload[key])&&mapped(key)===undefined).map(key=>'当前 '+family+' 请求没有发送 '+key+'；预设配置仍保留。');
}
function modelId(value,slashes=false){const text=String(value||'');if(!text||text.length>300||text.split('/').some(part=>['.','..'].includes(part))||!new RegExp(slashes?'^[a-zA-Z0-9@_.:/-]+$':'^[a-zA-Z0-9@_.:-]+$').test(text))throw new AdapterError('model_required','请填写有效的型号／部署名称');return slashes?text.split('/').map(encodeURIComponent).join('/'):encodeURIComponent(text);}
function messagesOf(payload){if(!Array.isArray(payload.messages)||!payload.messages.length)throw new AdapterError('messages_required','生成需要对话内容');return payload.messages.map(row=>{if(!['system','developer','user','assistant','tool'].includes(row.role)||!(typeof row.content==='string'||Array.isArray(row.content)||row.content===null&&Array.isArray(row.tool_calls)))throw new AdapterError('bad_message','消息角色或内容无效');return structuredClone(pick(row,['role','content','name','tool_calls','tool_call_id','reasoning_content','reasoning','reasoning_signature','tool_signatures']));});}

export function buildRequest({operation,adapter,baseUrl,credential,payload={}}){
  if(!OPERATIONS.includes(operation))throw new AdapterError('bad_operation','不支持的模型操作');
  const selected=resolveAdapter(adapter||'openai-chat'),family=selected.family,source=selected.id,notes=[];
  payload={...payload};if(payload.verbosity==='auto')delete payload.verbosity;if(payload.reasoning_effort==='auto')delete payload.reasoning_effort;if(payload.seed===-1)delete payload.seed;if(payload.generationType==='quiet'||payload.type==='quiet')payload.stream=false;
  let vertexServiceAccount;
  if(family==='vertex-ai'){
    if(operation==='models')throw new AdapterError('operation_unavailable','Vertex AI 请手动填写 Gemini 型号。');
    if(payload.authMode||!baseUrl){
      const mode=payload.authMode||'express',region=String(payload.region||'us-central1');payload.authMode=mode;
      if(!['express','full'].includes(mode)||!/^[a-z0-9-]{2,40}$/.test(region))throw new AdapterError('bad_vertex_config','请检查Vertex鉴权方式与地区。');
      let project=String(payload.projectId||'');
      if(mode==='full'){
        const account=credential?.serviceAccount;
        if(!account||typeof account.project_id!=='string'||typeof account.client_email!=='string'||typeof account.private_key!=='string'||!account.client_email.includes('@')||!account.private_key.includes('PRIVATE KEY'))throw new AdapterError('vertex_credentials_required','请导入含project_id、client_email及private_key的服务账号JSON。');
        project=account.project_id;vertexServiceAccount={project_id:account.project_id,client_email:account.client_email,private_key:account.private_key};
      }
      if(project&&!/^[a-zA-Z0-9-]{1,128}$/.test(project))throw new AdapterError('bad_vertex_project','Google项目ID格式无效。');
      const hostname=region==='global'||mode==='express'&&project?'aiplatform.googleapis.com':region+'-aiplatform.googleapis.com';
      baseUrl='https://'+hostname+'/v1'+(project?'/projects/'+project+'/locations/'+region:'')+'/publishers/google';
    }
  }
  let url;try{url=new URL(baseUrl||connectionDefaults(selected.sourceId,payload)||defaults[source]||({ 'claude-messages':defaults.claude,'google-gemini':defaults.makersuite,cohere:defaults.cohere,novelai:defaults.novelai,horde:defaults.aihorde }[family])||'');}catch{throw new AdapterError('bad_target','请填写模型服务基地址');}
  if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol)||/%(?:2e|2f|5c)/i.test(url.pathname))throw new AdapterError('bad_target','基地址只接受协议、主机和明确路径，不接受凭据／查询串');
  const token=String(typeof credential==='string'?credential:credential?.token||'').replace(/^Bearer\s+/i,'');
  if(/[\r\n]/.test(token))throw new AdapterError('bad_credential','密钥包含换行');
  const headers={'content-type':'application/json',accept:'text/event-stream, application/json'};
  if(credential?.header&&!['authorization','x-api-key','api-key','x-goog-api-key','apikey'].includes(String(credential.header).toLowerCase()))throw new AdapterError('bad_credential','不能指定任意鉴权头');
  let method='POST',body,pathname=url.pathname.replace(/\/+$/,'');
  pathname=pathname.replace(/\/(?:chat\/completions|completions|messages|embeddings|rerank|models)$/,'');
  const suffix=(value,version)=>{if(!pathname&&version)pathname='/'+version;return pathname+value;};
  const messages=operation==='chat'&&payload.phase!=='poll'&&payload.phase!=='cancel'?messagesOf(payload):[];
  if(source==='deepseek'&&operation==='models'&&url.hostname==='api.deepseek.com'&&pathname==='/beta')pathname='';
  if(token)headers.authorization='Bearer '+token;
  if(operation==='tokenize'){
    if(typeof payload.text!=='string')throw new AdapterError('bad_parameter','分词输入须为文字');
    const text=payload.text,model=String(payload.model||''),base=pathname.replace(/\/v1$/,'');
    const routes={tabby:['/v1/token/encode',{text,add_bos_token:false,encode_special_tokens:false}],koboldcpp:['/api/extra/tokencount',{prompt:text,special:false}],llamacpp:['/tokenize',{model,content:text}],vllm:['/tokenize',{model,prompt:text}],aphrodite:['/v1/tokenize',{model,prompt:text}],ooba:['/v1/internal/encode',{text}]};
    if(source==='kobold_classic'||family==='kobold-classic'){pathname=pathname.replace(/\/(?:api\/)?v1$/,'')+'/api/extra/tokencount';body={prompt:text};}
    else if(routes[source]&&['text-generic','kobold-lite'].includes(family)){pathname=base+routes[source][0];body=routes[source][1];}
    else throw new AdapterError('operation_unavailable','当前模型来源未声明远端分词接口');
    url.pathname=pathname;return {url:url.toString(),method:'POST',headers,body:JSON.stringify(body),family,sourceId:selected.sourceId,operation,warnings:[],parameterWarnings:[],stream:false};
  }
  if(family==='openai-chat'||family==='azure-openai'||family==='text-generic'||family==='kobold-lite'){
    if(family==='azure-openai'){
      delete headers.authorization;if(token)headers['api-key']=token;
      if(operation==='models')throw new AdapterError('operation_unavailable','Azure 部署名称须手动填写');
      const deployment=modelId(payload.deployment||payload.model);
      pathname=pathname.replace(/\/openai(?:\/deployments\/[^/]+)?$/,'')+'/openai/deployments/'+deployment;
      const version=String(payload.apiVersion||'2024-10-21');if(!/^\d{4}-\d{2}-\d{2}(?:-preview)?$/.test(version))throw new AdapterError('bad_api_version');url.searchParams.set('api-version',version);
    }
    if(source==='ollama'){
      pathname=pathname.replace(/\/(?:v1|api)$/,'');
      if(operation==='models'){method='GET';pathname+='/api/tags';}
      else if(operation==='chat')pathname+='/api/generate';
      else if(operation==='embeddings'){pathname+='/api/embed';body={model:payload.model,input:payload.input};}
      else throw new AdapterError('operation_unavailable');
    }else if(source==='llamacpp'){
      pathname=pathname.replace(/\/v1$/,'');
      if(operation==='models'){method='GET';pathname+='/v1/models';}
      else if(operation==='chat')pathname+='/completion';
      else if(operation==='embeddings'){pathname+='/embedding';body={content:payload.input};}
      else throw new AdapterError('operation_unavailable');
    }else{
      const version=source==='mancer'?'oai/v1':source==='dreamgen'?'api/openai/v1':'v1';
      if(source==='mancer'&&token){delete headers.authorization;headers['x-api-key']=token;}
      if(operation==='models'){method='GET';pathname=source==='tabby'?pathname.replace(/\/v1$/,'')+'/v1/model/list':source==='togetherai'?pathname.replace(/\/v1$/,'')+'/api/models':source==='huggingface'?pathname.replace(/\/v1$/,'')+'/info':suffix('/models',version);if(source==='togetherai')url.searchParams.set('info','');}
      else if(operation==='chat'){
        const text=(family==='text-generic'||family==='kobold-lite')&&!(source==='openrouter'&&selected.sourceId.startsWith('text:'));
        pathname=suffix(text?'/completions':'/chat/completions',version);
      }else if(operation==='embeddings'){pathname=suffix('/embeddings','v1');body=pick(payload,['model','input','dimensions','encoding_format']);}
      else{pathname=suffix('/rerank','v1');body=pick(payload,['model','query','documents','top_n']);}
    }
  }else if(family==='claude-messages'){
    delete headers.authorization;if(token)headers['x-api-key']=token;headers['anthropic-version']='2023-06-01';
    if(operation==='models'){method='GET';pathname=suffix('/models','v1');}
    else if(operation==='chat')pathname=suffix('/messages','v1');
    else throw new AdapterError('operation_unavailable','Claude 此适配器不提供嵌入／重排');
  }else if(family==='google-gemini'||family==='vertex-ai'){
    if(family==='google-gemini'||payload.authMode==='express'||family==='vertex-ai'&&!baseUrl){delete headers.authorization;if(token)headers['x-goog-api-key']=token;}
    if(family==='vertex-ai'&&payload.authMode==='express'&&!token)throw new AdapterError('vertex_key_required','请填写Vertex Express API Key。');
    if(vertexServiceAccount)delete headers.authorization;
    if(operation==='models'){method='GET';pathname=suffix('/models',family==='google-gemini'?'v1beta':null);}
    else if(operation==='chat'){
      pathname=suffix('/models/'+modelId(String(payload.model||'').replace(/^models\//,''))+':'+(payload.stream===false?'generateContent':'streamGenerateContent'),family==='google-gemini'?'v1beta':null);
      if(payload.stream!==false)url.searchParams.set('alt','sse');
    }else if(operation==='embeddings'){
      const id=modelId(String(payload.model||'').replace(/^models\//,''));
      pathname=suffix('/models/'+id+(family==='vertex-ai'?':predict':':embedContent'),family==='google-gemini'?'v1beta':null);
      body=family==='vertex-ai'?{instances:(Array.isArray(payload.input)?payload.input:[payload.input]).map(content=>({content}))}:{model:'models/'+String(payload.model).replace(/^models\//,''),content:{parts:[{text:String(payload.input||'')}]},outputDimensionality:payload.dimensions};
    }else throw new AdapterError('operation_unavailable');
  }else if(family==='cohere'){
    pathname=pathname.replace(/\/v[12]$/,'');
    if(operation==='models'){method='GET';pathname+='/v1/models';}
    else if(operation==='chat')pathname+='/v2/chat';
    else if(operation==='embeddings'){pathname+='/v2/embed';body={model:payload.model,texts:Array.isArray(payload.input)?payload.input:[payload.input],input_type:payload.input_type||'search_document',embedding_types:['float']};}
    else{pathname+='/v2/rerank';body=pick(payload,['model','query','documents','top_n']);}
  }else if(family==='workersai'){
    if(operation==='models'){method='GET';pathname+='/models/search';url.searchParams.set('task','Text Generation');url.searchParams.set('per_page','1000');}
    else if(operation==='chat')pathname=pathname.replace(/\/v1$/,'')+'/v1/chat/completions';
    else if(operation==='embeddings'){pathname+='/run/'+modelId(payload.model,true);body={text:Array.isArray(payload.input)?payload.input:[payload.input]};}
    else throw new AdapterError('operation_unavailable');
  }else if(family==='kobold-classic'){
    pathname=pathname.replace(/\/(?:api\/)?v1$/,'');
    if(operation==='models'){method='GET';pathname+='/api/v1/model';}
    else if(operation==='chat'){pathname+=payload.stream===false?'/api/v1/generate':'/api/extra/generate/stream';body={};}
    else throw new AdapterError('operation_unavailable');
  }else if(family==='novelai'){
    if(operation==='models'){method='GET';pathname='/user/subscription';if(['text.novelai.net','api.novelai.net'].includes(url.hostname))url.hostname='image.novelai.net';}
    else if(operation==='chat'){pathname=pathname.replace(/\/ai$/,'')+'/ai/'+(payload.stream===false?'generate':'generate-stream');body=novelRequest(payload,messages);if(['text.novelai.net','api.novelai.net'].includes(url.hostname))url.hostname=/kayra|erato/.test(payload.model||'')?'text.novelai.net':'api.novelai.net';}
    else throw new AdapterError('operation_unavailable','NovelAI 不提供此操作');
  }else if(family==='horde'){
    delete headers.authorization;headers.apikey=token||'0000000000';headers['Client-Agent']='cyber2051-web:0.2.0:local';
    pathname=pathname.replace(/\/api\/v2$/,'')+'/api/v2';
    if(operation==='models'){method='GET';pathname+='/status/models';url.searchParams.set('type','text');}
    else if(operation==='chat'&&['poll','cancel'].includes(payload.phase)){
      if(!/^[a-zA-Z0-9-]{1,128}$/.test(payload.taskId||''))throw new AdapterError('bad_task');
      method=payload.phase==='cancel'?'DELETE':'GET';pathname+='/generate/text/status/'+payload.taskId;
    }else if(operation==='chat'){pathname+='/generate/text/async';body={models:payload.model?[payload.model]:[],trusted_workers:false};}
    else throw new AdapterError('operation_unavailable');
  }
  if(source==='pollinations'&&payload.endpoint==='anonymous')headers.authorization='Bearer anonymous';
  if(operation==='chat'&&!payload.phase){
    if(['text-generic','kobold-lite'].includes(family))body=textRequest(source,{...payload,baseUrl:url.toString()},messages);
    else if(['openai-chat','azure-openai','claude-messages','google-gemini','vertex-ai','cohere','workersai'].includes(family)){
      const nativeSource=({'openai-chat':'custom','azure-openai':'azure_openai','claude-messages':'claude','google-gemini':'makersuite','vertex-ai':'vertexai','workersai':'workers_ai'}[source])||source;
      const native=providerRequest(nativeSource,payload,messages);body=native.body;Object.assign(headers,native.headers);
      if(native.textCompletion&&source!=='openrouter')pathname=pathname.replace(/\/chat\/completions$/,'/completions');
      if(['google-gemini','vertex-ai'].includes(family)&&native.stream===false){pathname=pathname.replace(/:streamGenerateContent$/,':generateContent');url.searchParams.delete('alt');}
      if(source==='deepseek'&&body.messages.at(-1)?.prefix&&url.hostname==='api.deepseek.com'&&/^\/(?:v1\/)?chat\/completions$/.test(pathname))pathname='/beta/chat/completions';
    }else if(body&&family!=='novelai'){
      const prompt=nativeTextPrompt(messages,payload);if(family==='novelai')body.input=prompt;else body.prompt=prompt;
      if(['horde','kobold-classic'].includes(family)){
        const settings={...structuredClone(kai_settings),...(payload.presetSettings?.textSettings||{}),...(payload.textSettings||{}),...payload,temp:payload.temperature??payload.textSettings?.temp??1,rep_pen:payload.repetition_penalty??payload.rep_pen??1,streaming_kobold:payload.stream!==false};
        const native=nativeKoboldBody(settings,prompt,payload.max_tokens??512,payload.max_context_length??payload.max_context??8192,family==='horde',{stop:stopList(payload.stop??payload.stop_sequence)||[],type:payload.generationType||'normal',flags:payload.koboldFlags});
        for(const key of ['api_server','can_abort','streaming'])delete native[key];
        if(family==='horde'){delete native.prompt;body.params=native;}else body=native;
      }
    }
  }
  url.pathname=pathname;
  if(body&&typeof body==='object')delete body.thinking_contract;
  const warnings=operation==='chat'&&!payload.phase?[...new Set([...parameterNotes(payload,body,family,source),...notes])]:[];
  if(url.hostname==='api.deepseek.com'&&operation==='chat'){const thinking=(body.thinking?.type||payload.thinking?.type)!=='disabled'&&payload.reasoning_effort!=='none';for(const key of ['frequency_penalty','presence_penalty'])if(source==='deepseek'&&meaningful(key,payload[key]))warnings.push('DeepSeek 不使用 '+key+'，原预设配置保留。');if(thinking&&meaningful('temperature',payload.temperature))warnings.push('DeepSeek 思考模式不使用 temperature。');if(!thinking&&meaningful('top_p',payload.top_p))warnings.push('DeepSeek 非思考模式不使用 top_p。');else if(thinking&&payload.top_p!==undefined&&payload.top_p<0.95)warnings.push('DeepSeek 思考模式会把 top_p 下限按 0.95 处理。');}
  return {url:url.toString(),method,headers,...(vertexServiceAccount?{vertexServiceAccount}:{}),body:body===undefined?undefined:JSON.stringify(body),family,sourceId:selected.sourceId,operation,warnings,parameterWarnings:warnings,stream:body?.stream===true||/generate-stream|generate\/stream|:streamGenerateContent$/.test(pathname)};
}
