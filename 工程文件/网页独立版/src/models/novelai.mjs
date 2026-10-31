/** NovelAI preprocessing is asynchronous and lazy; other providers never load its WASM or vocabularies. */
import {nai_settings,nativeNovelParameters,nativeNovelBody} from './native/novelai.mjs';
import {textPrompt} from './text-requests.mjs';
import {loadTokenizer} from './tokenizers.mjs';
export async function loadNovelTokenizer(model,{loadAsset,signal}={}){
 const name=model.includes('clio')?'nerdstash':model.includes('kayra')?'nerdstash_v2':model.includes('erato')?'llama3':null;
 return name?loadTokenizer(name,{loadAsset,signal}):text=>[];
}
export async function prepareNovelPayload(payload,{loadAsset,signal,subscription}={}){
 if(payload.nativeNovel)return payload;
 const p={...(payload.presetSettings||{}),...payload},configured=p.novelSettings||p.textSettings||{},settings={...structuredClone(nai_settings),...configured,model_novel:p.model};
 for(const key of Object.keys(nai_settings))if(p[key]!==undefined)settings[key]=p[key];
 if(Array.isArray(p.logit_bias))settings.logit_bias=p.logit_bias;
 const stops=p.stop??p.custom_stopping_strings??[],stop=Array.isArray(stops)?stops:[stops],encode=await loadNovelTokenizer(p.model,{loadAsset,signal});
 signal?.throwIfAborted();
 const data=nativeNovelParameters(settings,textPrompt(p.messages,p),p.max_tokens??p.openai_max_tokens??150,encode,{subscription:subscription??p.novelSubscription,logprobs:p.logprobs,stop,type:p.generationType||'normal'});
 if(Array.isArray(p.stop_sequences)&&p.stop_sequences.every(row=>Array.isArray(row)))data.stop_sequences=p.stop_sequences;
 if(Array.isArray(p.bad_words_ids))data.bad_words_ids=p.bad_words_ids;
 if(Array.isArray(p.logit_bias_exp))data.logit_bias_exp=p.logit_bias_exp;
 const {input,...parameters}=data;
 // The compiled prompt travels once. The original turn retains its pre-send message inspection separately.
 return {...payload,prompt:input,messages:[{role:'user',content:''}],nativeNovel:parameters};
}
export function novelRequest(payload,messages){
 const p={...(payload.presetSettings||{}),...payload};
 if(p.nativeNovel)return nativeNovelBody({...p.nativeNovel,input:p.prompt,model:p.model});
 // Request preview does not load tokenizers or call a service. Sending always uses prepareNovelPayload.
 const settings={...structuredClone(nai_settings),...(p.novelSettings||p.textSettings||{}),...p,model_novel:p.model};
 return nativeNovelBody(nativeNovelParameters(settings,textPrompt(messages,p),p.max_tokens??150,()=>[],{subscription:p.novelSubscription,stop:[],type:p.generationType||'normal'}));
}
