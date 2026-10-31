import {selectNativeTokenizer,normalizeNativeTokenizerModel} from './native/tokenizer-selection.mjs';
import {nativeTokenizerBestMatch,tokenizers} from './native/tokenizer-best-match.mjs';
import {textPrompt} from './text-requests.mjs';
const instances=new Map();let tiktokenInit,encodingMap;
export async function readTokenizerAsset(name,{loadAsset,signal}={}){
 const url=new URL('./native/tokenizers/'+name,import.meta.url);const raw=loadAsset?await loadAsset(url):url.protocol==='file:'&&typeof process==='object'&&process.versions?.node?await (await import('node:fs/promises')).readFile(url):await fetch(url,{signal}).then(r=>{if(!r.ok)throw Error('分词资源加载失败：'+name+'（'+r.status+'）');return r.arrayBuffer();});
 return raw instanceof Uint8Array?raw:new Uint8Array(raw);
}
export async function loadTokenizer(name,options={}){
 if(!instances.has(name)){
  const pending=(async()=>{
   const compressed=['deepseek','qwen2','command-r','command-a','nemo'].includes(name),sentence=['nerdstash','nerdstash_v2','llama','mistral','yi','gemma','jamba'].includes(name),web=compressed||sentence||['claude','llama3'].includes(name);
   if(web){const {Tokenizer}=await import('./native/tokenizers/runtime.mjs');let bytes=await readTokenizerAsset(name+(sentence?'.model':compressed?'.json.gz':'.json'),options);if(compressed)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());const instance=sentence?await Tokenizer.fromSentencePiece(bytes):await Tokenizer.fromJSON(new TextDecoder().decode(bytes));return text=>Array.from(instance.encode(String(text)));}
   if(!tiktokenInit)tiktokenInit=(async()=>{const module=await import('./native/tokenizers/tiktoken_bg.js'),bytes=await readTokenizerAsset('tiktoken_bg.wasm',options),{instance}=await WebAssembly.instantiate(bytes,{'./tiktoken_bg.js':module});module.__wbg_set_wasm(instance.exports);return module;})();
   const module=await tiktokenInit;
   if(!encodingMap)encodingMap=JSON.parse(new TextDecoder().decode(await readTokenizerAsset('model-to-encoding.json',options)));
   const encoding=encodingMap[name]||(['gpt-4o','o1'].includes(name)?'o200k_base':'cl100k_base'),data=JSON.parse(new TextDecoder().decode(await readTokenizerAsset(encoding+'.json',options))),instance=new module.Tiktoken(data.bpe_ranks,data.special_tokens,data.pat_str);
   return text=>Array.from(instance.encode(String(text)));
  })();instances.set(name,pending);pending.catch(()=>{if(instances.get(name)===pending)instances.delete(name);});
 }
 return instances.get(name);
}
export async function prepareTokenCounter(payload={},options={}){
 const adapter=String(payload.adapter||payload.family||'chat:openai').replace(/^(?:chat|text|extra):/,''),source=({'openai-chat':'custom','azure-openai':'azure_openai','claude-messages':'claude','google-gemini':'makersuite','vertex-ai':'vertexai','workersai':'workers_ai'}[adapter])||adapter,p={...(payload.body?.presetSettings||payload.presetSettings||{}),...(payload.provider||{}),...(payload.body||payload)},model=p.model||'';
 const textSources=['ooba','mancer','vllm','aphrodite','tabby','koboldcpp','togetherai','llamacpp','ollama','infermaticai','dreamgen','featherless','huggingface','generic'],mainApi=source==='novelai'?'novel':source==='aihorde'?'koboldhorde':source==='kobold_classic'||source==='kobold-classic'?'kobold':String(payload.adapter||'').startsWith('text:')||textSources.includes(source)?'textgenerationwebui':'openai';
 if(mainApi!=='openai'){
   const selected=nativeTokenizerBestMatch(mainApi,source,model,{modelList:p.modelList}),names={NONE:null,GPT2:'gpt2',OPENAI:'gpt-3.5-turbo',LLAMA:'llama',NERD:'nerdstash',NERD2:'nerdstash_v2',MISTRAL:'mistral',YI:'yi',CLAUDE:'claude',LLAMA3:'llama3',GEMMA:'gemma',JAMBA:'jamba',QWEN2:'qwen2',COMMAND_R:'command-r',COMMAND_A:'command-a',NEMO:'nemo',DEEPSEEK:'deepseek'},key=Object.keys(tokenizers).find(key=>tokenizers[key]===selected),name=names[key];
   const encode=name?await loadTokenizer(name,options):null,countText=text=>!text?0:encode?encode(text).length:Math.ceil(new TextEncoder().encode(String(text)).length/3.35);
   return {source:'SillyTavern-1.19:best-match:'+(name||'NONE'),estimate:!name,encode,countText,countMessages:messages=>countText(textPrompt(messages,p))};
 }
 const queryModel=selectNativeTokenizer(source,model,{modelList:p.modelList,mainApi:String(payload.adapter||'').startsWith('text:')?'textgenerationwebui':'openai'}),name=normalizeNativeTokenizerModel(queryModel),encode=await loadTokenizer(name,options),plain=['claude','llama3','llama','mistral','yi','gemma','jamba','deepseek','qwen2','command-r','command-a','nemo'].includes(name);
 const perMessage=message=>{
  if(plain)return encode(Object.values(message).join('\n\n')).length;
  let count=queryModel.includes('gpt-3.5-turbo-0301')?4:3;
  for(const[key,value]of Object.entries(message)){count+=encode(value).length;if(key==='name')count+=queryModel.includes('gpt-3.5-turbo-0301')?-1:1;}
  return count+3+(queryModel.includes('gpt-3.5-turbo-0301')?9:0);
 };
 return {source:'SillyTavern-1.19:'+name,estimate:false,encode,countText:text=>!text?0:perMessage({content:String(text)}),countMessages:(messages,{full=false}={})=>(Array.isArray(messages)?messages:[messages]).reduce((sum,row)=>sum+perMessage(row),0)-(full||queryModel==='claude'?0:2)};
}
