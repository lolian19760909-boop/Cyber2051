// Native connection transport. Story selection, summaries and retries belong to the card.
const copy=value=>JSON.parse(JSON.stringify(value));
function fail(code,message){throw Object.assign(Error(message),{code});}
export function usage(data){
  const u=data?.usage||{},g=data?.usageMetadata||{};
  const number=(...values)=>values.find(v=>Number.isSafeInteger(v)&&v>=0)??null;
  const input=number(u.prompt_tokens,u.input_tokens,g.promptTokenCount),output=number(u.completion_tokens,u.output_tokens,g.candidatesTokenCount);
  return {input,output,total:number(u.total_tokens,g.totalTokenCount,input!==null&&output!==null?input+output:null),source:input!==null||output!==null?'provider':'unavailable'};
}
export function createAuxiliary({context,loadBackend=()=>import('../../../openai.js'),fetcher=(...args)=>fetch(...args)}={}){
  return async function request({messages,responseTokens=2048,signal}={}){
    const c=context();
    if(c.mainApi!=='openai')fail('aux-api','上下文整理需要酒馆的 Chat Completion 连接。');
    if(!Array.isArray(messages)||!messages.length||messages.some(m=>!['system','user','assistant'].includes(m?.role)||typeof m.content!=='string'||Object.keys(m).some(k=>!['role','content'].includes(k))))fail('aux-input','辅助请求的消息格式无效。');
    if(!Number.isSafeInteger(responseTokens)||responseTokens<128||responseTokens>8192)fail('aux-budget','辅助回复预算须为 128—8192 token。');
    const backend=await loadBackend();signal?.throwIfAborted();
    if(typeof backend.createGenerationParameters!=='function'||typeof backend.getChatCompletionModel!=='function'||typeof c.extractMessageFromData!=='function')fail('aux-capability','宿主缺少独立上下文请求接口，请更新配套桥所支持的宿主。');
    const original=copy(messages),settings=copy(c.chatCompletionSettings);
    Object.assign(settings,{openai_max_tokens:responseTokens,n:1,stream_openai:false,function_calling:false,enable_web_search:false,request_images:false,show_thoughts:false,bias_preset_selected:null,custom_include_body:'',custom_exclude_body:''});
    for(const entry of Object.values(settings.additional_parameters_by_source||{}))if(entry&&typeof entry==='object'){entry.include_body='';entry.exclude_body='';}
    const model=backend.getChatCompletionModel(settings);
    if(typeof model!=='string'||!model)fail('aux-model','请先在酒馆选择用于当前故事的模型。');
    const prepared=await backend.createGenerationParameters(settings,model,'quiet',copy(original),{allowToolCalls:false,toolData:null,macroContext:{names:{user:'user',char:'assistant',group:''}}});
    signal?.throwIfAborted();
    const data=prepared?.generate_data;
    // Permit the native o1 role conversion, but no added text, attachments or messages.
    if(!data||!Array.isArray(data.messages)||data.messages.length!==original.length||data.messages.some((m,i)=>m.content!==original[i].content||!(m.role===original[i].role||original[i].role==='system'&&m.role==='user')||Object.keys(m).some(k=>!['role','content'].includes(k))))fail('aux-prompt','宿主改写了独立请求内容，本次未发送。');
    // Request-body overrides can replace messages after frontend validation. Authentication
    // and routing stay native; only this auxiliary request omits prompt/tool overrides.
    for(const key of ['custom_include_body','custom_exclude_body','assistant_prefill','stop','tools','tool_choice','functions','function_call','logit_bias','logprobs','top_logprobs'])delete data[key];
    Object.assign(data,{stream:false,user_name:'user',char_name:'assistant',group_names:[],include_reasoning:false,enable_web_search:false,request_images:false});
    if(data.n!==undefined)data.n=1;
    if(Object.hasOwn(data,'max_completion_tokens'))data.max_completion_tokens=responseTokens;else data.max_tokens=responseTokens;
    const response=await fetcher('/api/backends/chat-completions/generate',{method:'POST',headers:c.getRequestHeaders(),body:JSON.stringify(data),signal});
    signal?.throwIfAborted();
    if(!response.ok)fail('aux-http','辅助请求失败（HTTP '+response.status+'）。');
    const result=await response.json();signal?.throwIfAborted();
    if(result?.error)fail('aux-provider','模型服务未完成辅助请求，请检查酒馆连接。');
    const text=c.extractMessageFromData(result,'openai');
    if(typeof text!=='string'||!text.trim())fail('aux-empty','模型没有返回可用的整理结果。');
    return {text,usage:usage(result),model,provider:settings.chat_completion_source};
  };
}
