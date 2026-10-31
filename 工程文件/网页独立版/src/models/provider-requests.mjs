/** Provider-specific request semantics from the pinned ST 1.19 frontend/backend. */
import {nativeChatParameters} from './native/chat-parameters.mjs';
import {nativeClaudeBody,nativeGeminiBody} from './native/native-bodies.mjs';
import {createNativeConverters} from './native/converters.mjs';
import * as constants from './native/constants.mjs';
import {flattenSchema} from './native/schema.mjs';
import {TEXT_COMPLETION_MODELS} from './native/tokenizer-selection.mjs';
import {parse as parseYaml} from './native/yaml/index.js';
const pick=(object,keys)=>Object.fromEntries(keys.filter(k=>object[k]!==undefined).map(k=>[k,object[k]]));
const common=['messages','model','temperature','max_tokens','max_completion_tokens','stream','presence_penalty','frequency_penalty','top_p','top_k','stop','logit_bias','seed','n'];
export function requestYaml(value,kind='object'){
 if(value===undefined||value===null||value==='')return kind==='array'?[]:{};
 const result=typeof value==='string'?parseYaml(value,{maxAliasCount:100}):structuredClone(value);
 if(kind==='array')return Array.isArray(result)?result:typeof result==='string'?[result]:result&&typeof result==='object'?Object.keys(result):[];
 if(Array.isArray(result))return Object.assign({},...result.filter(item=>item&&typeof item==='object'&&!Array.isArray(item)));
 if(!result||typeof result!=='object')throw Error('自定义请求配置类型无效');return result;
}
export function schemaFrom(payload){if(payload.json_schema)return payload.json_schema;const r=payload.response_format;if(r?.type==='json_schema')return {name:r.json_schema?.name||'response',value:r.json_schema?.schema||r.json_schema,strict:r.json_schema?.strict};return null;}
function namesOf(payload){return {userName:payload.names?.userName||'',charName:payload.names?.charName||'',groupNames:payload.names?.groupNames||[]};}
export function chatSettings(source,payload){
 const p={...(payload.presetSettings||{}),...payload};return {...p,
  chat_completion_source:source,temp_openai:p.temperature??p.temp_openai??1,freq_pen_openai:p.frequency_penalty??p.freq_pen_openai??0,pres_pen_openai:p.presence_penalty??p.pres_pen_openai??0,
  top_p_openai:p.top_p??p.top_p_openai??1,top_k_openai:p.top_k??p.top_k_openai??0,min_p_openai:p.min_p??p.min_p_openai??0,top_a_openai:p.top_a??p.top_a_openai??0,repetition_penalty_openai:p.repetition_penalty??p.repetition_penalty_openai??1,
  openai_max_tokens:p.max_tokens??p.openai_max_tokens??4096,stream_openai:p.stream??p.stream_openai??true,show_thoughts:p.thinking?.type?p.thinking.type==='enabled':p.include_reasoning??p.show_thoughts??true,
  reasoning_effort:p.reasoning_effort??'auto',verbosity:p.verbosity??'auto',use_sysprompt:p.use_sysprompt!==false,n:p.n??1,seed:p.seed??-1,bias_presets:p.bias_presets||{},
  assistant_prefill:p.assistant_prefill||'',assistant_impersonation:p.assistant_impersonation||'',request_image_resolution:p.request_image_resolution||'',request_image_aspect_ratio:p.request_image_aspect_ratio||'',
  azure_base_url:p.baseUrl,azure_deployment_name:p.deployment||p.model,azure_api_version:p.apiVersion,
  vertexai_auth_mode:p.authMode,vertexai_region:p.region,vertexai_express_project_id:p.projectId,workers_ai_account_id:p.accountId,
  zai_endpoint:p.endpoint||p.zai_endpoint,pollinations_endpoint:p.endpoint||p.pollinations_endpoint,siliconflow_endpoint:p.endpoint||p.siliconflow_endpoint,minimax_endpoint:p.endpoint||p.minimax_endpoint,
 };
}
export function chatParameters(source,payload,messages){
 const p={...(payload.presetSettings||{}),...payload},names=namesOf(p),settings=chatSettings(source,p);
 const stops=p.stop??p.stop_sequences??p.custom_stopping_strings??[],stop=typeof stops==='string'?[stops]:stops;
 const result=nativeChatParameters(settings,p.model||'',p.generationType||p.type||'normal',structuredClone(messages),{names,stop,tools:p.tools,toolChoice:p.tool_choice,logitBias:p.logit_bias,logprobs:p.logprobs,modelList:p.modelList,jsonSchema:schemaFrom(p),chatId:p.chat_id});
 return result.generate_data;
}
export function providerRequest(source,payload,messages){
 const p={...(payload.presetSettings||{}),...payload},config=p.nativeConfig||{},c=createNativeConverters(config),data=chatParameters(source,p,messages),names=c.getPromptNames({body:data});
 if(data.json_schema?.value)data.json_schema.value=flattenSchema(data.json_schema.value,source);
 if(data.custom_prompt_post_processing)data.messages=c.postProcessPrompt(data.messages,data.custom_prompt_post_processing,names);
 let body=pick(data,common),headers={};
 const tools=()=>{if(data.tools?.length){body.tools=structuredClone(data.tools);body.tool_choice=data.tool_choice;}};
 const schema=()=>{if(!data.json_schema)return;const s=data.json_schema;body.response_format={type:'json_schema',json_schema:source==='workers_ai'?s.value:['perplexity','pollinations'].includes(source)?{schema:s.value}:{name:s.name||'response',...(['mistralai','aimlapi','electronhub','chutes','fireworks','groq'].includes(source)&&s.description?{description:s.description}:{}),strict:s.strict??true,schema:s.value}};};
 const jsonObject=()=>{body.response_format={type:'json_object'};body.messages.push({role:'user',content:'JSON schema for the response:\n'+JSON.stringify(data.json_schema.value,null,4)});};
 const logprobs=()=>{if(data.logprobs>0){body.logprobs=true;body.top_logprobs=data.logprobs;}};
 if(source==='claude')return nativeClaudeBody(data,config);
 if(['makersuite','vertexai'].includes(source))return {...nativeGeminiBody(data,config),stream:data.stream};
 if(source==='deepseek'){
  body=pick(data,['messages','model','temperature','max_tokens','stream','presence_penalty','frequency_penalty','top_p','stop','seed']);tools();logprobs();if(data.json_schema)jsonObject();
  if(body.tools)for(const t of body.tools)if(Array.isArray(t.function?.parameters?.required)&&!t.function.parameters.required.length)delete t.function.parameters.required;
  body.messages=c.addAssistantPrefix(c.postProcessPrompt(body.messages,c.PROMPT_PROCESSING_TYPE.SEMI_TOOLS,names),body.tools,'prefix');c.addReasoningContentToToolCalls(body.messages);
  body.thinking={type:data.include_reasoning?'enabled':'disabled'};if(data.include_reasoning&&data.reasoning_effort)body.reasoning_effort=data.reasoning_effort;
 }else if(source==='mistralai'){
  body=pick(data,['model','temperature','top_p','frequency_penalty','presence_penalty','max_tokens','stream','safe_prompt']);if(data.stop?.length)body.stop=data.stop;body.messages=c.convertMistralMessages(data.messages,names);body.random_seed=data.seed;tools();schema();
 }else if(source==='ai21'){
  body=pick(data,['messages','model','max_tokens','temperature','top_p','stop','stream','tools']);if(data.json_schema)jsonObject();body.messages=c.convertAI21Messages(body.messages,names);
 }else if(source==='cohere'){
  body=pick(data,['stream','model','temperature','max_tokens','seed','frequency_penalty','presence_penalty']);Object.assign(body,{messages:c.convertCohereMessages(data.messages,names).chatHistory,k:data.top_k,p:data.top_p,stop_sequences:data.stop,documents:[],tools:structuredClone(data.tools||[])});
  for(const t of body.tools)if(t.function?.parameters)delete t.function.parameters.$schema;
  if(String(data.model).endsWith('08-2024'))body.safety_mode='OFF';if(data.json_schema)body.response_format={type:'json_schema',schema:data.json_schema.value};
 }else if(source==='minimax'){
  body=pick(data,['model','temperature','max_tokens','stream','top_p','stop']);body.messages=c.postProcessPrompt(data.messages,c.PROMPT_PROCESSING_TYPE.MERGE_TOOLS,names);if(data.model==='M2-her')body.max_tokens=Math.min(data.max_tokens,2048);tools();
 }else if(source==='azure_openai'){
  body=pick(data,constants.AZURE_OPENAI_KEYS);schema();logprobs();body.reasoning_effort=constants.OPENAI_REASONING_EFFORT_MODELS.includes(data.model)?constants.OPENAI_FIXED_REASONING_EFFORT[data.model]??constants.OPENAI_REASONING_EFFORT_MAP[data.reasoning_effort]??data.reasoning_effort:undefined;
 }else if(source==='xai'){
  body=pick(data,['messages','model','temperature','max_tokens','max_completion_tokens','stream','presence_penalty','frequency_penalty','top_p','seed','n']);body.messages=c.convertXAIMessages(data.messages,names);if(data.stop?.length)body.stop=data.stop;if(data.reasoning_effort)body.reasoning_effort=data.reasoning_effort==='high'?'high':'low';tools();schema();logprobs();
 }else{
  tools();schema();logprobs();
  if(source==='openrouter'){
   Object.assign(body,pick(data,['min_p','top_a','repetition_penalty','verbosity']));body.reasoning={exclude:!data.include_reasoning};if(data.reasoning_effort)body.reasoning.effort=data.reasoning_effort;
   body.transforms=data.middleout==='on'?['middle-out']:data.middleout==='off'?[]:undefined;
   if(data.provider?.length)body.provider={allow_fallbacks:data.allow_fallbacks??true,order:data.provider};if(data.quantizations?.length){body.provider??={};body.provider.quantizations=data.quantizations;}if(data.use_fallback)body.route='fallback';
   body.plugins=data.enable_web_search?[{id:'web'}]:[];
   c.embedOpenRouterMedia(body.messages,{audio:true,video:true});c.addOpenRouterSignatures(body.messages,data.model);
   if(/^anthropic\/claude/.test(data.model)){if(config['claude.enableSystemPromptCache'])c.cachingSystemPromptForOpenRouter(body.messages,config['claude.extendedTTL']?'1h':'5m');if((config['claude.cachingAtDepth']??-1)>=0)c.cachingAtDepthForOpenRouterClaude(body.messages,config['claude.cachingAtDepth'],config['claude.extendedTTL']?'1h':'5m');}
   if(/google\/gemini/.test(data.model))body.safety_settings=constants.GEMINI_SAFETY;
  }else if(source==='nanogpt'){
   Object.assign(body,pick(data,['min_p','top_a','repetition_penalty']));if(data.reasoning_effort)body.reasoning={effort:constants.NANOGPT_REASONING_EFFORT_MAP[data.reasoning_effort]};
   if(data.nanogpt_provider)headers['X-Provider']=data.nanogpt_provider;if(data.nanogpt_payg_override){headers['X-Billing-Mode']='paygo';body.billing_mode='paygo';}if(data.enable_web_search&&!/:online$/.test(data.model))body.model=data.model+':online';
   if(config['claude.enableSystemPromptCache']&&/(?:^|\/)claude[-_]/.test(data.model))body.cache_control={enabled:true,ttl:config['claude.extendedTTL']?'1h':'5m'};
  }else if(source==='moonshot'||source==='zai'){
   body.thinking={type:data.include_reasoning?'enabled':'disabled'};if(data.json_schema)jsonObject();else if(source==='moonshot')c.addAssistantPrefix(body.messages,[],'partial');
   if(source==='zai')headers['Accept-Language']='en-US,en';
  }else if(source==='siliconflow'){if(data.json_schema)jsonObject();
  }else if(source==='perplexity'){body.messages=c.postProcessPrompt(body.messages,c.PROMPT_PROCESSING_TYPE.STRICT,names);if(data.reasoning_effort)body.reasoning_effort=data.reasoning_effort;
  }else if(source==='chutes'){Object.assign(body,pick(data,['repetition_penalty','min_p','reasoning_effort']));
  }else if(['aimlapi','fireworks','electronhub','cometapi','pollinations'].includes(source)){
   if(data.reasoning_effort&&!(source==='pollinations'&&data.pollinations_endpoint==='anonymous'))body.reasoning_effort=data.reasoning_effort;
   if(source==='electronhub'&&data.enable_web_search)body.web_search=true;
   if(source==='pollinations'&&body.seed===undefined)body.seed=Math.floor(Math.random()*99999999);
  }else if(source==='openai'||source==='custom'){
   c.embedOpenRouterMedia(body.messages,{audio:true,video:false});
   if(data.reasoning_effort&&(constants.OPENAI_REASONING_EFFORT_MODELS.includes(data.model)||source==='custom'&&/^koboldcpp\//.test(data.model)))body.reasoning_effort=constants.OPENAI_FIXED_REASONING_EFFORT[data.model]??constants.OPENAI_REASONING_EFFORT_MAP[data.reasoning_effort]??data.reasoning_effort;
   if(data.verbosity&&constants.OPENAI_VERBOSITY_MODELS.test(data.model))body.verbosity=data.verbosity;
  }else if(source==='workers_ai')body.repetition_penalty=data.repetition_penalty;
 }
 // The original custom adapter deliberately lets explicit user fields override native defaults.
 if(source==='custom'){
  Object.assign(body,requestYaml(p.custom_include_body));for(const key of requestYaml(p.custom_exclude_body,'array'))delete body[key];
  const extra=requestYaml(p.custom_include_headers);for(const[key,value]of Object.entries(extra)){if(typeof value!=='string'||/[\r\n]/.test(key+value)||/^(host|cookie|content-length|connection|transfer-encoding)$/i.test(key))throw Error('自定义请求头无效');headers[key]=value;}
 }
 if(p.response_format&&!data.json_schema)body.response_format=structuredClone(p.response_format);
 const textCompletion=['openai','openrouter','custom'].includes(source)&&TEXT_COMPLETION_MODELS.includes(data.model);
 if(textCompletion){body.prompt=c.convertTextCompletionPrompt(body.messages);delete body.messages;if(data.logprobs>0){body.logprobs=data.logprobs;delete body.top_logprobs;}}
 return {body,headers,textCompletion};
}
