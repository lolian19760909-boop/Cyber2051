import {nativeInstruct} from './native/instruct.mjs';
import {nativeTextParameters} from './native/text-parameters.mjs';
import {convertTextCompletionPrompt} from './native/converters.mjs';
import * as C from './native/constants.mjs';
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
export function textPrompt(messages,payload={}){
 if(typeof payload.prompt==='string')return payload.prompt;
 const instruct=payload.instruct||payload.presetSettings?.instruct;
 if(!instruct?.enabled)return convertTextCompletionPrompt(messages.map(row=>({...row,...(row.name==='example_user'?{name:payload.names?.userName||row.name}:row.name==='example_assistant'?{name:payload.names?.charName||row.name}:{})})));
 const names=payload.names||{},user=names.userName||'User',char=names.charName||'Assistant',context=payload.context||payload.presetSettings?.context||{};
 const substitute=text=>String(text||'').replace(/{{(?:user|name1)}}/gi,user).replace(/{{(?:char|name2)}}/gi,char);
 const native=nativeInstruct({instruct,context,group:names.groupName,substitute}),firstUser=messages.findIndex(m=>m.role==='user'),firstAssistant=messages.findIndex(m=>m.role==='assistant');
 let storyCount=0;if((context.story_string_position??0)!==1)while(storyCount<messages.length&&['system','developer'].includes(messages[storyCount].role)&&!messages[storyCount].name)storyCount++;
 const lines=[];if(storyCount)lines.push(native.formatInstructModeStoryString(messages.slice(0,storyCount).map(m=>m.content).join('\n\n'),{customContext:context,customInstruct:instruct}));
 lines.push(...messages.slice(storyCount).map((m,offset)=>{const i=offset+storyCount,name=m.name==='example_user'?user:m.name==='example_assistant'?char:m.name||(m.role==='user'?user:m.role==='assistant'?char:'System');return native.formatInstructModeChat(name,typeof m.content==='string'?m.content:JSON.stringify(m.content),m.role==='user',['system','developer'].includes(m.role),'',user,char,i===firstUser||i===firstAssistant?native.force_output_sequence.FIRST:false,instruct);}));
 const type=payload.generationType||payload.type||'normal';
 if(type!=='continue')lines.push(native.formatInstructModePrompt(type==='impersonate'?user:char,type==='impersonate',payload.promptBias||'',user,char,type==='quiet',false,instruct));
 return lines.join('');
}
export function textRequest(source,payload,messages){
 const preset=payload.presetSettings||{},p={...preset,...payload},settings={...(preset.textSettings||{}),...(payload.textSettings||{}),type:source};
 for(const [key,native]of Object.entries({temperature:'temp',repetition_penalty:'rep_pen',frequency_penalty:'freq_pen',presence_penalty:'presence_pen'}))if(p[key]!==undefined)settings[native]=p[key];
 for(const key of ['top_p','top_k','top_a','min_p','seed','n','include_reasoning','typical_p','min_length','rep_pen_range','rep_pen_slope','rep_pen_decay','sampler_order','sampler_priority','samplers','samplers_priorities','add_bos_token','ban_eos_token','ignore_eos_token','skip_special_tokens','spaces_between_special_tokens','mirostat_mode','mirostat_tau','mirostat_eta','grammar_string','json_schema','json_schema_allow_empty','dynatemp','min_temp','max_temp','dynatemp_exponent','smoothing_factor','smoothing_curve','dry_allowed_length','dry_multiplier','dry_base','dry_sequence_breakers','dry_penalty_last_n','banned_tokens','banned_strings','global_banned_tokens','send_banned_tokens','xtc_threshold','xtc_probability','nsigma','min_keep','adaptive_target','adaptive_decay','tfs','eta_cutoff','epsilon_cutoff','guidance_scale','negative_prompt','openrouter_providers','openrouter_quantizations','openrouter_allow_fallbacks'])if(p[key]!==undefined)settings[key]=p[key];
 const encoded=p.nativeTextEncoded,logitBias=encoded?.logit_bias??p.logit_bias;
 if(logitBias&&!Array.isArray(logitBias))settings.logit_bias=Object.entries(logitBias).map(([id,value])=>({text:'['+id+']',value}));
 const configured=p.stop??p.stop_sequences??settings.stopping_strings??[],stop=[...(Array.isArray(configured)?configured:[configured])],instruct=p.instruct;
 if(instruct?.enabled){if(instruct.stop_sequence)stop.push(instruct.stop_sequence);if(instruct.sequences_as_stop_strings)for(const key of ['input_sequence','output_sequence','last_input_sequence','last_output_sequence','system_sequence'])if(instruct[key])stop.push(instruct[key]);}
 let body=nativeTextParameters(settings,p.model,textPrompt(messages,p),p.max_tokens??4096,{contextSize:p.max_context_length??p.max_context??p.contextSize??8192,stop:[...new Set(stop)],logprobs:p.logprobs,logitBias,bannedTokens:encoded?.banned_tokens??p.banned_tokens,bannedStrings:encoded?.banned_strings??p.banned_strings,type:p.generationType||'normal',baseUrl:p.baseUrl});
 body.stream=p.stream!==false;delete body.parseSequenceBreakers;delete body.api_server;delete body.api_type;
 const keys={togetherai:C.TOGETHERAI_KEYS,infermaticai:C.INFERMATICAI_KEYS,featherless:C.FEATHERLESS_KEYS,generic:C.OPENAI_KEYS,openrouter:C.OPENROUTER_KEYS,vllm:C.VLLM_KEYS};
 if(source==='openrouter'){
  if(body.provider?.length)body.provider={allow_fallbacks:body.allow_fallbacks??true,order:body.provider};else delete body.provider;
  if(body.quantizations?.length){body.provider??={};body.provider.quantizations=body.quantizations;}
 }
 if(keys[source])body=pick(body,keys[source]);
 if(source==='generic'&&body.stop)body.stop=body.stop.slice(0,4);
 if(source==='ollama')body={model:p.model,prompt:body.prompt,stream:p.stream!==false,keep_alive:p.keep_alive??-1,raw:true,options:pick({...body,...(p.num_batch>0?{num_batch:p.num_batch}:{})},C.OLLAMA_KEYS)};
 return body;
}
