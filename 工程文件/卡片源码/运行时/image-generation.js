(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxImageGeneration=api;})(globalThis,function(){
 'use strict';
 const endpoint='https://image.novelai.net/ai/generate-image';
 const defaults={automatic:false,model:'nai-diffusion-5-full',width:832,height:1216,steps:28,scale:5,negative:'low quality, blurry, watermark',prefix:'cyberpunk, Tokyo, cinematic illustration, detailed background'};
 const copy=value=>JSON.parse(JSON.stringify(value));
 function request(prompt,options,seed){const negative=options.negative||'';return {action:'generate',input:prompt,model:options.model,parameters:{params_version:3,width:options.width,height:options.height,steps:options.steps,scale:options.scale,seed,n_samples:1,sampler:'k_euler_ancestral',noise_schedule:'karras',image_format:'png',negative_prompt:negative,qualityToggle:false,sm:false,sm_dyn:false,v4_prompt:{caption:{base_caption:prompt,char_captions:[]},use_coords:false,use_order:true},v4_negative_prompt:{caption:{base_caption:negative,char_captions:[]}}}};}
 function create({read,write,current,settings={},saveSettings=()=>{},fetch:fetcher=globalThis.fetch?.bind(globalThis),random=()=>Math.floor(Math.random()*4294967296),now=()=>new Date().toISOString()}){
  let config={...defaults,...Object.fromEntries(Object.keys(defaults).filter(name=>name in settings).map(name=>[name,settings[name]]))},key='',ended=false,queue=Promise.resolve();const jobs=new Map(),seen=new Set(),listeners=new Set();
  const emit=()=>{for(const fn of [...listeners])fn();},valid=source=>{if(ended||!current(source))throw Object.assign(Error('插图对应的故事或回复已经变化'),{code:'image_source_changed'});};
  const status=source=>{const job=jobs.get(source.key);return {phase:job?.phase||'idle',error:job?.error||'',candidate:!!job?.candidate};};
  async function persist(source,job){valid(source);job.phase='saving';job.error='';emit();await write(source,copy(job.candidate));valid(source);job.phase='saved';job.candidate=null;emit();return read(source);}
  function generate(source,{prompt,automatic=false}={}){
   if(automatic&&(!config.automatic||!key||seen.has(source.key)))return Promise.resolve(null);valid(source);
   const previous=jobs.get(source.key);if(previous&&['queued','generating','saving'].includes(previous.phase))return previous.promise;
   if(previous?.candidate)return retrySave(source);
   if(!key)return Promise.reject(Error('请先在插图设置填写 NovelAI Persistent API token'));
   const text=(prompt??[config.prefix,source.text].filter(Boolean).join(', ')).trim();if(!text)return Promise.reject(Error('请填写插图提示词'));
   if(automatic)seen.add(source.key);
   const selected={...config},credential=key,controller=new AbortController(),job={phase:'queued',error:'',candidate:null,controller,promise:null};jobs.set(source.key,job);emit();
   const work=async()=>{
    valid(source);if(controller.signal.aborted)throw new DOMException('插图生成已取消','AbortError');
    const saved=automatic?await read(source):null;valid(source);if(controller.signal.aborted)throw new DOMException('插图生成已取消','AbortError');
    if(automatic&&saved?.sourceKey===(source.contentKey||source.key)){job.phase='saved';emit();return saved;}
    job.phase='generating';emit();const seed=random(),response=await fetcher(endpoint,{method:'POST',credentials:'omit',redirect:'error',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(request(text,selected,seed)),signal:controller.signal});
    const result=await response.json();if(!response.ok)throw Error(String(result.message||result.error||'NovelAI HTTP '+response.status).replaceAll(credential,'[Key]'));
    const image=result.images?.[0];if(typeof image?.image!=='string'||!image.image)throw Error('NovelAI 未返回可保存的图片');
    valid(source);if(controller.signal.aborted)throw new DOMException('插图生成已取消','AbortError');job.candidate={format:1,sourceKey:source.contentKey||source.key,prompt:text,negative:selected.negative,model:selected.model,seed:image.seed??seed,image:image.image,mime:'image/png',createdAt:now()};return persist(source,job);
   };
   job.promise=queue.then(work).catch(error=>{job.phase=error.name==='AbortError'?'cancelled':'failed';job.error=error.name==='AbortError'?'':error.message;emit();throw error;});const active=job.promise;queue=active.then(()=>{},()=>{});return active.finally(()=>{if(job.promise===active)job.promise=null;});
  }
  function retrySave(source){const job=jobs.get(source.key);if(!job?.candidate)return Promise.reject(Error('当前没有待保存的插图'));if(job.phase==='saving'&&job.promise)return job.promise;const active=persist(source,job).catch(error=>{job.phase='failed';job.error=error.message;emit();throw error;});job.promise=active;return active.finally(()=>{if(job.promise===active)job.promise=null;});}
  return {read,status,generate,retrySave,settings:()=>({...config,configured:!!key}),configure(value){if('key'in value)key=String(value.key||'').trim();const next={...config};for(const name of Object.keys(defaults))if(name in value)next[name]=value[name];config=next;saveSettings(copy(config));emit();},cancel(source){jobs.get(source.key)?.controller.abort();},cancelAll(){for(const job of jobs.values())job.controller.abort();},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},destroy(){ended=true;key='';for(const job of jobs.values())job.controller.abort();listeners.clear();jobs.clear();}};
 }
 return {create,request,defaults,endpoint};
});
