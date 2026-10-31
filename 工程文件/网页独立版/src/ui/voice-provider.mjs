/** Standalone transport for MirrorTranslate's maintained pure TTS providers. */
import {normalizeTts,normalizeVoiceList,normalizeVoiceLibrary,normalizeLanguageCode} from '../../shared/mirror/core.js?v=0.50.1';
import {plainLineText,planVoices,FISH_ADAPTER,GSV_ADAPTER,fishEndpoint,fishHeaders,gsvEndpoint,gsvHeaders,fishLivePayload,createSseParser,createTimestampCollector,base64ToBytes,wavInfo,scaleWavVolume,mergeWavBuffers} from '../../shared/mirror/tts.js?v=0.50.1';
import {takeStreamPieces} from '../../shared/mirror/tts-stream.js?v=0.50.1';
import {cloudRequestGroups,doubaoRequest,minimaxRequest,createCloudAudioReader,cloudBodyFailure} from '../../shared/mirror/tts-cloud.js?v=0.50.1';
import {createPcmPlayer,createWavStreamFeed,pcmDataOffset,LIVE_SAMPLE_RATE} from '../../shared/mirror/pcm-player.js?v=0.50.1';

const PROVIDERS=['fish','gsv','doubao','minimax'];
const LABELS={fish:'Fish Audio',gsv:'GPT-SoVITS',doubao:'豆包语音',minimax:'MiniMax'};
const gsvQueues=new Map(),gsvLoaded=new Map();
const clone=value=>structuredClone(value);
const stopped=signal=>signal?.reason instanceof Error?signal.reason:new DOMException('已停止语音','AbortError');
function check(signal){if(signal?.aborted)throw stopped(signal);}
function error(code,message,status=0){return Object.assign(new Error(message),{code,status});}
function endpoint(value){const url=new URL(String(value));if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw error('voice_endpoint','语音地址须为 HTTP(S)，凭据请填在 Key 中');return String(value).trim().replace(/\/+$/,'');}

function normalize(value={}){
  const tts=normalizeTts({...value,fish:{retries:0,...value.fish,viaProxy:false},gsv:{retries:0,...value.gsv,viaProxy:false},doubao:{...value.doubao,viaProxy:false}});
  tts.provider=PROVIDERS.includes(value.provider)?value.provider:tts.provider;
  tts.streamVoice=PROVIDERS.includes(value.streamVoice)?value.streamVoice:tts.provider;
  // The original MiniMax payload already accepts a base URL. Its host selector is a host-UI choice;
  // the standalone UI also accepts a player's own CORS endpoint with that same protocol.
  if(value.minimax?.baseUrl)tts.minimax.baseUrl=endpoint(value.minimax.baseUrl);
  for(const name of PROVIDERS)tts[name].baseUrl=endpoint(tts[name].baseUrl);
  if(tts.sttUrl)endpoint(tts.sttUrl);
  return {...tts,voices:normalizeVoiceList(value.voices),voiceLibrary:normalizeVoiceLibrary(value.voiceLibrary)};
}
function publicSettings(config){const value=clone(config);for(const name of PROVIDERS)delete value[name].key;delete value.sttApiKey;return value;}
function mergeSettings(before,patch){const value={...before,...patch};for(const name of [...PROVIDERS,'narratorVoices','prompts','context','console'])if(patch[name]&&typeof patch[name]==='object')value[name]={...before[name],...patch[name]};return normalize(value);}
function safeMessage(message,config){let text=String(message);for(const key of [config.fish.key,config.doubao.key,config.minimax.key,config.sttApiKey])if(key)text=text.split(key).join('[Key]');return text;}

async function timed(signal,seconds,work){
  check(signal);const controller=new AbortController(),abort=()=>controller.abort(stopped(signal));let timer;
  signal?.addEventListener('abort',abort,{once:true});
  const renew=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(error('voice_timeout','语音服务超过等待时间')),Math.max(1,Number(seconds)||180)*1000);};renew();
  try{return await work(controller.signal,renew);}catch(cause){if(controller.signal.aborted)throw stopped(controller.signal);throw cause;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
async function consume(response,signal,renew,onBytes){
  const reader=response.body?.getReader?.();
  if(!reader){check(signal);const bytes=new Uint8Array(await response.arrayBuffer());check(signal);if(bytes.length)onBytes(bytes);return;}
  const abort=()=>{void reader.cancel(stopped(signal)).catch(()=>{});};signal?.addEventListener('abort',abort,{once:true});
  try{for(;;){check(signal);const {value,done}=await reader.read();check(signal);if(done)break;renew();if(value?.length)onBytes(value);}}catch(cause){try{await reader.cancel(cause);}catch{}throw cause;}finally{signal?.removeEventListener('abort',abort);try{reader.releaseLock();}catch{}}
}
async function textStream(response,signal,renew,onText){const decoder=new TextDecoder();await consume(response,signal,renew,bytes=>onText(decoder.decode(bytes,{stream:true})));const tail=decoder.decode();if(tail)onText(tail);}
async function exclusiveGsv(base,signal,work){
  const previous=gsvQueues.get(base)||Promise.resolve();let release;const turn=new Promise(resolve=>{release=resolve;});const tail=previous.catch(()=>{}).then(()=>turn);gsvQueues.set(base,tail);
  let abort;try{await Promise.race([previous.catch(()=>{}),new Promise((_,reject)=>{abort=()=>reject(stopped(signal));signal?.addEventListener('abort',abort,{once:true});check(signal);})]);check(signal);return await work();}finally{signal?.removeEventListener('abort',abort);release();void tail.then(()=>{if(gsvQueues.get(base)===tail)gsvQueues.delete(base);});}
}
async function retry(settings,signal,work,canRetry=()=>true){for(let attempt=0;;attempt++){try{return await work();}catch(cause){check(signal);if(cause?.name==='AbortError'||cause?.code==='voice_timeout'&&!canRetry()||attempt>=settings.retries||!canRetry()||Number(cause?.status)>0&&Number(cause.status)<500)throw cause;}}}

export async function createVoiceProvider({settings:initial={},changed=()=>{},fetch:fetcher=globalThis.fetch,createContext}={}){
  let config=normalize(initial),dead=false;const active=new Set();
  function capabilities(){
    const name=config.provider,missing=!config.enabled?'请先开启语音服务':name!=='gsv'&&!config[name].key?'请填写'+LABELS[name]+' Key':name==='gsv'&&!config.gsv.refAudioPath&&!config.voiceLibrary.some(v=>v.gsv?.refAudioPath)?'请填写 GPT-SoVITS 参考音频':'';
    const stream=config.streamVoice,streamMissing=stream!=='gsv'&&!config[stream].key||stream==='gsv'&&!config.gsv.refAudioPath&&!config.voiceLibrary.some(v=>v.gsv?.refAudioPath),callReason=!config.enabled?'请先开启语音服务':streamMissing?'请完成'+LABELS[stream]+'通话音源的 Key 或参考音频配置':'';
    const stt=!dead&&config.enabled&&config.sttProvider==='cloud'&&!!config.sttApiKey&&!!config.sttUrl;
    return {enabled:config.enabled,tts:!dead&&!missing,call:!dead&&config.enabled&&!streamMissing,stt,mic:stt&&!!globalThis.navigator?.mediaDevices?.getUserMedia,provider:name,label:LABELS[name],streamProvider:stream,callReason:dead?'语音服务已关闭':callReason,reason:dead?'语音服务已关闭':missing};
  }
  function tell(){changed({settings:publicSettings(config),capabilities:capabilities()});}
  function stop(){for(const handle of [...active])handle.stop();}
  function configure(patch={}){const next=mergeSettings(config,patch);stop();config=next;tell();return publicSettings(config);}
  function usable(c,name){if(dead)throw error('voice_closed','语音服务已关闭');if(!c.enabled)throw error('voice_disabled','请先开启语音服务');if(name!=='gsv'&&!c[name].key)throw error('voice_key_missing','请填写'+LABELS[name]+' Key');}
  async function request(url,options,c,name){
    check(options.signal);let response;
    try{response=await fetcher(url,{...options,credentials:'omit',redirect:'error',cache:'no-store'});}catch(cause){check(options.signal);throw error('voice_network',LABELS[name]+' 连接失败，请检查地址、CORS 和网络');}
    if(!response.ok){const body=await response.text().catch(()=>'');check(options.signal);if(name==='doubao'||name==='minimax'){const e=cloudBodyFailure(name,{status:response.status,body,viaProxy:false});throw error('voice_http',safeMessage(e.message,c),response.status);}throw error('voice_http',LABELS[name]+' 请求失败（HTTP '+response.status+'）',response.status);}
    return response;
  }
  function itemsFor(text,speaker,lang,c){
    const clean=plainLineText(text);if(!clean.trim())throw error('voice_text_missing','没有可朗读文字');
    const segment={id:'speech',lineId:0,text:clean,type:speaker&&speaker!=='旁白'?'dialogue':'narration',speaker:speaker==='旁白'?'':String(speaker||''),lang:normalizeLanguageCode(lang)||''};
    return planVoices([segment],c).items;
  }
  async function fish(c,items,signal,{live=false,onAudio}={}){
    const output=[];for(const part of FISH_ADAPTER.parts(items,c)){
      check(signal);const {body}=FISH_ADAPTER.payload(part,c),sent=live?fishLivePayload(body,LIVE_SAMPLE_RATE):body;let fed=0;
      const made=await retry(c.fish,signal,()=>timed(signal,c.fish.timeoutSec,async(s,renew)=>{
        const response=await request(fishEndpoint(c.fish,'/v1/tts/stream/with-timestamp'),{method:'POST',headers:fishHeaders(c.fish),body:JSON.stringify(sent),signal:s},c,'fish');
        const collector=createTimestampCollector();let malformed=0;
        const parser=createSseParser(event=>{if(!event.data||event.data==='[DONE]')return;let payload;try{payload=JSON.parse(event.data);}catch{malformed++;return;}if(event.event==='error'||payload?.error)throw error('voice_stream',safeMessage(payload?.message||payload.error?.message||'Fish 语音返回错误',c));collector.accept(payload);if(live){const chunks=collector.result().audio;for(;fed<chunks.length;fed++)onAudio?.(base64ToBytes(chunks[fed]));}});
        await textStream(response,s,renew,text=>parser.push(text));parser.end();const result=collector.result();if(!result.audio.length)throw error('voice_audio_missing',malformed?'Fish 时间戳流无法解析':'Fish 没有返回音频');return result.audio.map(base64ToBytes);
      }),()=>!live||fed===0);
      output.push(...made);
    }return {parts:output,type:FISH_ADAPTER.mime(live?'pcm':c.fish.format)};
  }
  async function gsv(c,items,signal,{live=false,onAudio}={}){
    return exclusiveGsv(c.gsv.baseUrl,signal,async()=>{
      const output=[];for(const part of GSV_ADAPTER.parts(items,c)){
        const payload=GSV_ADAPTER.payload(part,c,{library:c.voiceLibrary});if(!payload.body.ref_audio_path)throw error('voice_reference_missing','此人物没有 GPT-SoVITS 参考音频');let fed=0;
        const made=await retry(c.gsv,signal,async()=>{
          try{return await timed(signal,c.gsv.timeoutSec,async(s,renew)=>{
            let loaded=gsvLoaded.get(c.gsv.baseUrl);if(!loaded){loaded={gpt:'',sovits:''};gsvLoaded.set(c.gsv.baseUrl,loaded);}
            for(const [kind,route]of [['gpt','/set_gpt_weights'],['sovits','/set_sovits_weights']]){const weights=payload.weights[kind];if(!weights||weights===loaded[kind])continue;loaded[kind]='';await request(gsvEndpoint(c.gsv,route,{query:{weights_path:weights}}),{method:'GET',headers:gsvHeaders(c.gsv),signal:s},c,'gsv');loaded[kind]=weights;renew();}
            const response=await request(gsvEndpoint(c.gsv,'/tts'),{method:'POST',headers:gsvHeaders(c.gsv),body:JSON.stringify({...payload.body,...(live?{streaming_mode:3,media_type:'wav'}:{})}),signal:s},c,'gsv'),bytes=[];
            if(live){const feed=createWavStreamFeed({first:true,gain:payload.volume?10**(payload.volume/20):1,holdSec:.5,onBytes:chunk=>{if(!pcmDataOffset(chunk))fed++;bytes.push(chunk);onAudio?.(chunk);}});await consume(response,s,renew,chunk=>feed.push(chunk));feed.end();if(!fed)throw error('voice_audio_missing','GPT-SoVITS 没有返回音频');}
            else{await consume(response,s,renew,chunk=>bytes.push(chunk));const raw=new Uint8Array(await new Blob(bytes).arrayBuffer());if(!wavInfo(raw)?.bytes)throw error('voice_audio_invalid','GPT-SoVITS 返回的不是可播放 WAV');bytes.splice(0,bytes.length,payload.volume?scaleWavVolume(raw,payload.volume):raw);}
            return bytes;
          });}catch(cause){gsvLoaded.delete(c.gsv.baseUrl);throw cause;}
        },()=>!live||fed===0);output.push(...made);
      }return {parts:output,type:'audio/wav'};
    });
  }
  async function cloud(c,name,items,signal,{live=false,onAudio}={}){
    const output=[];for(const group of cloudRequestGroups(items,c[name]))await timed(signal,c.fish.timeoutSec,async(s,renew)=>{
      const spec=(name==='doubao'?doubaoRequest:minimaxRequest)(c[name],{...group,live,sampleRate:LIVE_SAMPLE_RATE,requestId:globalThis.crypto.randomUUID(),sectionId:''});
      const response=await request(spec.url,{method:'POST',headers:spec.headers,body:JSON.stringify(spec.body),signal:s},c,name);
      const reader=createCloudAudioReader(name,bytes=>{output.push(bytes);if(live)onAudio?.(bytes);});await textStream(response,s,renew,text=>reader.push(text));if(!reader.received)throw error('voice_audio_missing',LABELS[name]+' 没有返回音频');
    });return {parts:output,type:live?'audio/L16':'audio/mpeg'};
  }
  async function synthesize(c,name,text,speaker,lang,signal,options={}){usable(c,name);const items=itemsFor(text,speaker,lang,c);if(!items.length)return {parts:[],type:'audio/wav'};return name==='fish'?fish(c,items,signal,options):name==='gsv'?gsv(c,items,signal,options):cloud(c,name,items,signal,options);}
  function job(signal){check(signal);const controller=new AbortController(),abort=()=>controller.abort(stopped(signal));signal?.addEventListener('abort',abort,{once:true});const handle={stop(){controller.abort(new DOMException('已停止语音','AbortError'));},signal:controller.signal,cleanup(){signal?.removeEventListener('abort',abort);active.delete(handle);}};active.add(handle);return handle;}
  function renderSpeech({text,speaker='',lang='',signal}={}){
    const c=clone(config),handle=job(signal);const done=(async()=>{try{const made=await synthesize(c,c.provider,text,speaker,lang,handle.signal);check(handle.signal);const parts=made.type==='audio/wav'&&made.parts.length>1?[mergeWavBuffers(made.parts)]:made.parts;return new Blob(parts,{type:made.type});}finally{handle.cleanup();}})();
    // The handle is returned before networking; callers may attach await done or blob() immediately.
    void done.catch(()=>{});return {done,blob:()=>done,stop:handle.stop};
  }
  function stream({speaker='',lang='',signal,onAudio,play=true}={}){
    const c=clone(config);usable(c,c.streamVoice);const handle=job(signal),state={done:new Map(),count:0};let last='',ended=false,failed=null,chain=Promise.resolve(),settle,reject,player=null;
    const done=new Promise((resolve,no)=>{settle=resolve;reject=no;});void done.catch(()=>{});
    if(play){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!createContext&&!Context){handle.cleanup();throw error('voice_audio_context','此浏览器没有 Web Audio，不能播放流式语音');}player=createPcmPlayer({sampleRate:LIVE_SAMPLE_RATE,createContext:createContext||(()=>new Context())});void player.ensureRunning().catch(cause=>{failed=cause;handle.stop();reject(cause);});}
    const finish=async()=>{if(failed)return;try{await chain;check(handle.signal);await player?.drained();check(handle.signal);settle({status:'ended',pieces:state.count});}catch(cause){reject(cause);}finally{player?.close();handle.cleanup();}};
    const abort=()=>{failed??=stopped(handle.signal);player?.stop();reject(failed);handle.cleanup();};handle.signal.addEventListener('abort',abort,{once:true});
    const enqueue=piece=>{chain=chain.then(async()=>{check(handle.signal);const take=player?.take(),held=[];try{await synthesize(c,c.streamVoice,piece.text,speaker,lang,handle.signal,{live:true,onAudio:bytes=>{check(handle.signal);if(c.liveAudio){take?.push(bytes);onAudio?.(bytes);}else held.push(bytes);}});for(const bytes of held){check(handle.signal);take?.push(bytes);onAudio?.(bytes);}take?.end();}catch(cause){take?.end();throw cause;}});void chain.catch(cause=>{if(failed)return;failed=cause;player?.stop();handle.stop();reject(cause);});};
    function cut(final){const lines=last.split('\n').map((text,lineId)=>({text,lineId}));for(const piece of takeStreamPieces(lines,state,{final,eager:true,quotePairs:c.quotePairs}))enqueue(piece);}
    function push(cumulativeText){if(ended)throw error('voice_stream_ended','此段语音已经结束');if(failed)throw failed;check(handle.signal);const next=String(cumulativeText??'');if(next===last)return;if(!next.startsWith(last))throw error('voice_stream_rewritten','语音流须追加完整文本；已朗读的内容不能在原流中改写');last=next;cut(false);}
    function end(){if(!ended){ended=true;cut(true);void finish();}return done;}
    const stop=()=>{handle.stop();player?.close();};active.delete(handle);active.add({stop});const cleanup=handle.cleanup;handle.cleanup=()=>{handle.signal.removeEventListener('abort',abort);active.forEach(h=>{if(h.stop===stop)active.delete(h);});cleanup();};
    return {push,end,done,cancel:stop,stop,resume:()=>player?.release(),pause:()=>player?.hold()};
  }
  async function transcribe({blob,lang,signal}={}){
    const c=clone(config);if(dead||!c.enabled)throw error('voice_disabled','请先开启语音服务');if(c.sttProvider!=='cloud'||!c.sttApiKey||!c.sttUrl)throw error('voice_stt_config','请配置语音转写地址、模型和 Key');if(!(blob instanceof Blob)||!blob.size)throw error('voice_recording_missing','没有可转写的录音');const handle=job(signal);
    try{return await timed(handle.signal,40,async(s)=>{const extension=blob.type.includes('mp4')?'m4a':blob.type.includes('ogg')?'ogg':'webm',form=new FormData();form.append('file',blob,'speech.'+extension);form.append('model',c.sttModel);if((lang||c.sttLang)&&c.sttPreset!=='siliconflow')form.append('language',lang||c.sttLang);const response=await fetcher(c.sttUrl,{method:'POST',headers:{Authorization:'Bearer '+c.sttApiKey},body:form,signal:s,credentials:'omit',redirect:'error',cache:'no-store'});if(!response.ok)throw error('voice_stt_http','转写失败（HTTP '+response.status+'）',response.status);const data=await response.json();check(s);return String(data?.text??'').trim();});}finally{handle.cleanup();}
  }
  return {configure,settings:()=>publicSettings(config),capabilities,renderSpeech,stream,transcribe,stop,destroy(){stop();dead=true;for(const name of PROVIDERS)if('key'in config[name])config[name].key='';config.sttApiKey='';}};
}
