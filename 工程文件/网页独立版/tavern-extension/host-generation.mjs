/** Per-request ST settings and native request builders; never assigns host settings. */
import {chatSettings,schemaFrom,requestYaml} from '../src/models/provider-requests.mjs';
import {decodeReply,iterateSSE,ModelError} from '../src/models/port.mjs';
import {resolveAdapter} from '../src/models/adapters.mjs';
import {CHAT_SOURCES,TEXT_SOURCES} from '../src/models/registry.mjs';
import {textPrompt} from '../src/models/text-requests.mjs';
import {nativeKoboldBody} from '../src/models/native/kobold.mjs';
import {nativeNovelParameters} from '../src/models/native/novelai.mjs';
import {loadNovelTokenizer} from '../src/models/novelai.mjs';
import {prepareTokenCounter} from '../src/models/tokenizers.mjs';
const clone=structuredClone;
const CHAT_FAMILY={'openai-chat':'custom','claude-messages':'claude','google-gemini':'makersuite','vertex-ai':'vertexai','azure-openai':'azure_openai',cohere:'cohere'};
const SAMPLING={temperature:'temp',repetition_penalty:'rep_pen',frequency_penalty:'freq_pen',presence_penalty:'presence_pen'};
function selectedRoute(payload,c){
  if(!payload.baseUrl)return {api:c.mainApi,source:c.mainApi==='openai'?c.chatCompletionSettings.chat_completion_source:null};
  const adapter=resolveAdapter(payload.adapter||payload.family||'openai-chat');
  if(TEXT_SOURCES.some(row=>row.id===adapter.id))return {api:'textgenerationwebui',source:adapter.id};
  if(['novelai','horde','kobold-classic'].includes(adapter.family))return {api:({novelai:'novel',horde:'koboldhorde','kobold-classic':'kobold'})[adapter.family],source:adapter.id};
  const source=CHAT_SOURCES.some(row=>row.id===adapter.id)?adapter.id:CHAT_FAMILY[adapter.family];
  if(!source)throw new ModelError('host_override_unsupported','当前酒馆没有此连接的原生生成路径');return {api:'openai',source};
}
function textSettings(base,p){const value={...clone(base),...(p.presetSettings?.textSettings||{}),...(p.textSettings||{}),...p};for(const [key,native]of Object.entries(SAMPLING))if(p[key]!==undefined)value[native]=p[key];return value;}
function nativeResponse(response,{stream,api,source}){
  if(!stream)return {response,source};
  // ST1.19 forwardFetchResponse deliberately forwards bytes/status only. Its
  // generation clients select SSE from the request, not from Content-Type.
  const headers=new Headers(response.headers);headers.set('content-type','text/event-stream');let body=response.body;
  if(api==='textgenerationwebui'&&source==='ollama'){
    // The native backend already converts Ollama NDJSON to one JSON data line
    // per SSE event: choices[{text,thinking}], followed by [DONE].
    const lines=iterateSSE(response),encoder=new TextEncoder();
    body=new ReadableStream({async pull(controller){try{const next=await lines.next();if(next.done){controller.close();return;}let line=next.value;if(line.startsWith('data:')&&line.slice(5).trim()!=='[DONE]'){let data;try{data=JSON.parse(line.slice(5));}catch{throw new ModelError('bad_stream','酒馆 Ollama 文本流包含损坏的数据帧');}data.choices=(data.choices||[]).map(choice=>({...choice,delta:{content:choice.text||'',reasoning_content:choice.reasoning??choice.thinking??''}}));line='data: '+JSON.stringify(data);}controller.enqueue(encoder.encode(line+'\n'));}catch(error){controller.error(error);await lines.return();}},cancel:()=>lines.return()});
    source='st:ollama-sse';headers.delete('content-length');
  }
  return {response:new Response(body,{status:response.status,statusText:response.statusText,headers}),source};
}
function effectiveRequest(payload,c){
  const body=payload.body||{},p={...(body.presetSettings||{}),...(payload.provider||{}),...body,...(body.providerSettings||{})},route=selectedRoute(payload,c);
  let settings;if(route.api==='openai'){const inherited=clone(c.chatCompletionSettings);settings=chatSettings(route.source,{...inherited,...p,...(payload.baseUrl?{baseUrl:payload.baseUrl}:{})});for(const [key,value]of Object.entries(inherited))if(settings[key]===undefined)settings[key]=value;}
  return {body,p,route,settings,type:p.generationType||p.type||'normal'};
}

export function createNativeHostTokenCounter({context,assertScope,loadModule=specifier=>import(specifier),prepareLocalCounter=prepareTokenCounter}={}){
  return async function tokenCounter(payload,{signal}={}){
    const check=()=>{signal?.throwIfAborted();assertScope();},counted=async work=>{check();const value=await work();check();return value;};check();
    const c=context(),{p,route,settings}=effectiveRequest(payload,c);let source=route.source,model='',currentModel='';
    if(route.api==='openai'){const native=await loadModule('/scripts/openai.js');check();model=p.model||native.getChatCompletionModel(settings);currentModel=native.getChatCompletionModel(c.chatCompletionSettings);}
    else if(route.api==='textgenerationwebui'){const native=await loadModule('/scripts/textgen-settings.js');check();const selected=textSettings(native.textgenerationwebui_settings,p);selected.type=source||native.textgenerationwebui_settings.type;source=selected.type;model=p.model||native.getTextGenModel(selected);currentModel=native.getTextGenModel(native.textgenerationwebui_settings);}
    else if(route.api==='novel'){const native=await loadModule('/scripts/nai-settings.js');check();source='novelai';model=p.model||native.nai_settings.model_novel;currentModel=native.nai_settings.model_novel;}
    else source=route.api==='koboldhorde'?'aihorde':'kobold-classic';
    const overridden=!!payload.baseUrl||route.api!==c.mainApi||route.api==='openai'&&source!==c.chatCompletionSettings.chat_completion_source||model!==currentModel;
    if(overridden){const adapter=(route.api==='openai'?'chat:':route.api==='textgenerationwebui'?'text:':'extra:')+source,counter=await prepareLocalCounter({adapter,body:{...p,model}},{signal});check();return {source:counter.source+':host-override',estimate:counter.estimate,countTextAsync:text=>counted(()=>(counter.countTextAsync||counter.countText)(text)),countMessagesAsync:messages=>counted(()=>(counter.countMessagesAsync||counter.countMessages)(messages))};}
    const native=await loadModule('/scripts/tokenizers.js');check();const chat=route.api==='openai';return {source:chat?'tavern:chat-completion-tokenizers':'tavern:text-tokenizer+message-estimate',estimate:!chat,countTextAsync:text=>counted(()=>native.getTokenCountAsync(String(text))),countMessagesAsync:messages=>counted(()=>chat?native.countTokensOpenAIAsync(messages):native.getTokenCountAsync(JSON.stringify(messages)))};
  };
}

export function createNativeHostGenerator({context,assertScope,loadModule=specifier=>import(specifier),fetchImpl=(...args)=>fetch(...args),decode=decodeReply,novelTokenizer=loadNovelTokenizer}={}){
  return async function generate({payload,signal,onDelta,onReasoning,onUsage,onProgress}){
    const check=()=>{signal?.throwIfAborted();assertScope();};check();
    const c=context(),{body,p,route,settings,type}=effectiveRequest(payload,c),messages=clone(p.messages||[]);
    let data,source=route.source,family,url,stream;
    if(route.api==='openai'){
      const native=await loadModule('/scripts/openai.js');check();
      const ownPrefill=Object.hasOwn(body,'assistant_prefill')||Object.hasOwn(body.providerSettings||{},'assistant_prefill'),ownImpersonation=Object.hasOwn(body,'assistant_impersonation')||Object.hasOwn(body.providerSettings||{},'assistant_impersonation');
      if(ownPrefill)settings.assistant_prefill='';if(ownImpersonation)settings.assistant_impersonation='';
      const expandedCustom=source==='custom'?['custom_include_body','custom_exclude_body','custom_include_headers'].filter(key=>Object.hasOwn(body,key)||Object.hasOwn(body.providerSettings||{},key)):[];
      for(const key of expandedCustom)settings[key]='';
      if(payload.baseUrl)settings.reverse_proxy='';
      const model=p.model||native.getChatCompletionModel(settings),result=await native.createGenerationParameters(settings,model,type,messages,{jsonSchema:schemaFrom(p)});check();data=result.generate_data;stream=result.stream??data.stream;
      if(source==='claude'&&type!=='quiet'&&!(type==='continue'&&settings.continue_prefill)){
        if(type==='impersonate'&&ownImpersonation)data.assistant_prefill=p.assistant_impersonation;
        else if(type!=='impersonate'&&ownPrefill)data.assistant_prefill=p.assistant_prefill;
      }
      for(const key of expandedCustom)data[key]=p[key];
      if(p.tools!==undefined){data.tools=clone(p.tools);data.tool_choice=p.tool_choice||'auto';}
      if(p.stop!==undefined||p.stop_sequences!==undefined)data.stop=clone(p.stop??p.stop_sequences);
      if(p.names){data.user_name=p.names.userName??data.user_name;data.char_name=p.names.charName??data.char_name;}
      if(payload.baseUrl){const address=payload.baseUrl.replace(/\/+$/,''),key=typeof payload.credential==='string'?payload.credential:payload.credential?.token||'';data.reverse_proxy=address;data.proxy_password=key;if(source==='custom'){data.custom_url=address;if(key)data.custom_include_headers=JSON.stringify({...requestYaml(data.custom_include_headers),Authorization:'Bearer '+key});}}
      await c.eventSource.emit(c.eventTypes.CHAT_COMPLETION_SETTINGS_READY,data);check();source=data.chat_completion_source;family=resolveAdapter('chat:'+source).family;url='/api/backends/chat-completions/generate';stream=data.stream;
    }else{
      const script=await loadModule('/script.js');check();const format={...p,instruct:p.instruct??c.powerUserSettings?.instruct,context:p.context??c.powerUserSettings?.context},prompt=textPrompt(messages,format),maxTokens=p.max_tokens??p.openai_max_tokens??2048,stop=p.stop??p.stop_sequences??script.getStoppingStrings(type==='impersonate',type==='continue',route.api),maxContext=p.max_context_length??p.openai_max_context??8192;
      if(route.api==='textgenerationwebui'){
        const native=await loadModule('/scripts/textgen-settings.js');check();const settings=textSettings(native.textgenerationwebui_settings,p);settings.type=source||native.textgenerationwebui_settings.type;source=settings.type;
        data=await native.createTextGenGenerationData(settings,p.model||native.getTextGenModel(settings),prompt,maxTokens,type==='impersonate',type==='continue',null,type);data.stream=p.stream!==false&&type!=='quiet';if(payload.baseUrl)data.api_server=payload.baseUrl;
        await c.eventSource.emit(c.eventTypes.TEXT_COMPLETION_SETTINGS_READY,data);check();family=resolveAdapter('text:'+source).family;
      }else if(route.api==='kobold'||route.api==='koboldhorde'){
        const native=await loadModule('/scripts/kai-settings.js');check();const settings=textSettings(native.kai_settings,p);settings.streaming_kobold=p.stream!==false;if(payload.baseUrl)settings.api_server=payload.baseUrl;
        data=nativeKoboldBody(settings,prompt,maxTokens,maxContext,route.api==='koboldhorde',{flags:native.kai_flags,stop,type});source=route.api==='koboldhorde'?'aihorde':'kobold';family=route.api==='koboldhorde'?'horde':'kobold-classic';
        if(route.api==='koboldhorde'){const nativeHorde=await loadModule('/scripts/horde.js');check();const result=await nativeHorde.generateHorde(prompt,data,signal,false);check();onDelta?.(result.text);return {...result,complete:true,streamed:false,finishReason:'stop',warnings:[]};}
      }else if(route.api==='novel'){
        const native=await loadModule('/scripts/nai-settings.js');check();const settings={...clone(native.nai_settings),...(p.textSettings||{}),...(p.novelSettings||{}),...p,model_novel:p.model||native.nai_settings.model_novel},encode=await novelTokenizer(settings.model_novel,{signal});check();
        data=nativeNovelParameters(settings,prompt,maxTokens,encode,{stop,type});data.max_length=Math.min(maxTokens,/kayra|erato/.test(settings.model_novel)?native.getNovelMaxResponseTokens():150);data.streaming=p.stream!==false&&type!=='quiet';source='novelai';family='novelai';
      }else throw new ModelError('host_api_unsupported','当前酒馆主接口没有可用的原生生成路径：'+route.api);
      url=script.getGenerateUrl(route.api);stream=data.stream??data.streaming;
    }
    check();const response=await fetchImpl(url,{method:'POST',headers:c.getRequestHeaders(),body:JSON.stringify(data),signal});check();
    if(!response.ok){let detail;try{detail=await response.json();}catch{}throw new ModelError('model_request_failed',detail?.error?.message||detail?.message||'酒馆模型接口返回 '+response.status,{status:response.status});}
    const framed=nativeResponse(response,{stream,api:route.api,source}),result=await decode(framed.response,{family,source:framed.source,signal,stream,onDelta,onReasoning,onUsage,onProgress});check();return {...result,warnings:result.warnings||[]};
  };
}
