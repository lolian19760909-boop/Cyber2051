/** One structured reply contract for native protocols. Reasoning never becomes story text. */
export function createReplyState({onDelta,onReasoning,onUsage,onProgress}={}){
 const result={text:'',reasoning:'',toolCalls:[],swipes:[],images:[],signature:'',toolSignatures:{},usage:null},tools=new Map();
 const usage=raw=>{
  if(!raw)return;
  const previous=result.usage||{},u=raw.tokens||raw;
  const values={input_tokens:u.prompt_tokens??u.input_tokens??u.promptTokenCount??u.prompt_eval_count,output_tokens:u.completion_tokens??u.output_tokens??u.candidatesTokenCount??u.eval_count,total_tokens:u.total_tokens??u.totalTokenCount,reasoning_tokens:u.completion_tokens_details?.reasoning_tokens??u.thoughtsTokenCount,cached_input_tokens:u.prompt_tokens_details?.cached_tokens??u.cache_read_input_tokens??u.cachedContentTokenCount};
  result.usage={...previous,...Object.fromEntries(Object.entries(values).filter(([,v])=>Number.isFinite(v)))};
  if(result.usage.total_tokens===undefined&&Number.isFinite(result.usage.input_tokens)&&Number.isFinite(result.usage.output_tokens))result.usage.total_tokens=result.usage.input_tokens+result.usage.output_tokens;
  onUsage?.({...result.usage});
 };
 const text=(value,index=0)=>{if(typeof value!=='string'||!value)return;if(index>0)result.swipes[index-1]=(result.swipes[index-1]||'')+value;else{result.text+=value;onDelta?.(value);}onProgress?.();};
 const thought=value=>{if(typeof value!=='string'||!value)return;result.reasoning+=value;onReasoning?.(value);onProgress?.();};
 const content=(value,index=0)=>{if(typeof value==='string'){text(value,index);return;}if(!Array.isArray(value))return;for(const part of value){if(part.type==='text'||part.type==='output_text')text(part.text,index);else if(part.type==='thinking'){if(Array.isArray(part.thinking))part.thinking.forEach(p=>thought(p.text));else thought(part.thinking||part.text);}else if(part.type==='reasoning')thought(part.text);}};
 const tool=(value,index=0,{complete=false,claude=false}={})=>{
  const key=String(index),old=tools.get(key)||{id:value.id||'call_'+index,type:'function',function:{name:'',arguments:''}};
  if(value.id)old.id=value.id;
  const fn=value.function||value;
  if(fn.name)old.function.name=complete?fn.name:old.function.name===fn.name?fn.name:old.function.name+fn.name;
  if(fn.arguments!==undefined)old.function.arguments=complete?String(fn.arguments):old.function.arguments+String(fn.arguments);
  if(claude&&value.input&&Object.keys(value.input).length)old.function.arguments=JSON.stringify(value.input);
  if(value.thought_signature){old.thought_signature=value.thought_signature;result.toolSignatures[old.id]=value.thought_signature;}
  tools.set(key,old);result.toolCalls=[...tools.values()];
 };
 function consume(data,{source,family,stream=true}={}){
  let reason,done=false;
  usage(data.usage||data.usageMetadata||data.message?.usage||data.usage_metadata||data.billed_units);
  if(source==='ollama'){
   text(data.response||data.message?.content||'');thought(data.thinking||data.message?.thinking);usage(data);for(const[t,i]of (data.message?.tool_calls||[]).map((v,i)=>[v,i]))tool({...t,function:{...t.function,arguments:typeof t.function?.arguments==='string'?t.function.arguments:JSON.stringify(t.function?.arguments||{})}},i,{complete:true});done=data.done===true;reason=data.done_reason||(done?'stop':undefined);
  }else if(source==='llamacpp'){
   text(data.content||'');done=data.stop===true;reason=data.stopped_limit?'length':done?'stop':undefined;usage(data.timings?{input_tokens:data.timings.prompt_n,output_tokens:data.timings.predicted_n}:null);
  }else if(family==='claude-messages'){
   reason=data.delta?.stop_reason||data.stop_reason;done=data.type==='message_stop';
   if(!stream){for(const [index,part]of (data.content||[]).entries()){if(part.type==='text')text(part.text);else if(part.type==='thinking'){thought(part.thinking);if(part.signature)result.signature=part.signature;}else if(part.type==='tool_use')tool(part,index,{complete:true,claude:true});}}
   else if(data.type==='content_block_start'){const part=data.content_block||{};if(part.type==='text')text(part.text);else if(part.type==='thinking')thought(part.thinking);else if(part.type==='tool_use')tool(part,data.index??0,{complete:true,claude:true});}
   else if(data.type==='content_block_delta'){const d=data.delta||{};if(d.type==='text_delta')text(d.text);else if(d.type==='thinking_delta')thought(d.thinking);else if(d.type==='signature_delta')result.signature+=d.signature||'';else if(d.type==='input_json_delta')tool({function:{arguments:d.partial_json||''}},data.index??0);}
  }else if(['google-gemini','vertex-ai'].includes(family)){
   for(const [index,candidate]of (data.candidates||[]).entries()){
    if(index===0){reason=candidate.finishReason;done=!!reason;}
    for(const [partIndex,part]of (candidate.content?.parts||[]).entries()){
     if(part.thought)thought(part.text);else text(part.text,index);
     if(part.inlineData&&!part.thought)result.images.push('data:'+part.inlineData.mimeType+';base64,'+part.inlineData.data);
     if(part.functionCall)tool({id:part.functionCall.id||'call_'+partIndex,function:{name:part.functionCall.name,arguments:JSON.stringify(part.functionCall.args||{})},thought_signature:part.thoughtSignature},partIndex,{complete:true});
     if(part.thoughtSignature&&typeof part.text==='string')result.signature=part.thoughtSignature;
    }
   }
  }else if(family==='cohere'){
   if(stream){text(data.delta?.message?.content?.text||data.text||'');thought(data.delta?.message?.tool_plan);const call=data.delta?.message?.tool_calls;if(call)for(const [index,c]of (Array.isArray(call)?call:[call]).entries())tool(c,data.index??index);}
   else {content(data.message?.content);thought(data.message?.tool_plan);for(const [index,c]of (data.message?.tool_calls||[]).entries())tool(c,index,{complete:true});}
   reason=data.delta?.finish_reason||data.finish_reason;done=data.type==='message-end'||data.event_type==='stream-end';
  }else if(['novelai','kobold-classic'].includes(family)){
   text(data.token||data.results?.[0]?.text||data.output||'');reason=data.finish_reason;done=!!data.done||!!reason;
  }else if(family==='workersai'&&typeof data.response==='string'){text(data.response);done=!!data.done;
  }else{
   const choices=data.choices||[];
   for(const [position,choice]of choices.entries()){
    const index=Number.isInteger(choice.index)?choice.index:position,d=choice.delta||choice.message||{};
    content(d.content??choice.text,index);
    if(index===0){thought(d.reasoning_content??d.reasoning);reason=choice.finish_reason||reason;done=done||!!reason;}
    for(const [i,t]of (d.tool_calls||[]).entries())tool(t,t.index??i,{complete:!choice.delta});
    if(d.function_call)tool({id:'function_call',function:d.function_call},0,{complete:!choice.delta});
    for(const part of d.images||[])if(part.image_url?.url)result.images.push(part.image_url.url);
    for(const detail of d.reasoning_details||[])if(detail.type==='reasoning.encrypted'&&detail.data){if(detail.id)result.toolSignatures[detail.id]=detail.data;if(!/^(?:tool_|call_)/.test(detail.id||''))result.signature=detail.data;}
    if(d.reasoning_signature)result.signature=d.reasoning_signature;
   }
   if(!choices.length&&!stream)text(data.output||data.response||data.results?.[0]?.text||data.text||'');
  }
  return {reason,done};
 }
 return {result,consume};
}
