/* Public MirrorTranslate APIs only; no keys or private extension metadata. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxJingyiBridge=api;})(globalThis,function(){
  'use strict';
  function create(top,{enabled=()=>true}={}){
    let jy=null,destroyed=false;
    const has=name=>Array.isArray(jy?.features)&&jy.features.includes(name);
    const assertEnabled=()=>{if(!enabled())throw Error('本故事的镜译功能已关闭，请在设置 → 翻译与声音开启。');};
    async function refresh(names=[]){if(!enabled()){jy=null;return {enabled:false,installed:!!top.__JINGYI__,text:false,call:false,read:false,mic:false,reason:'本故事的镜译功能已关闭，可在设置 → 翻译与声音开启。',readReason:'本故事的镜译功能已关闭。',missing:[],voices:[]};}let timer;try{const found=top.__JINGYI__;jy=found?await Promise.race([found.ready||Promise.resolve(found),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('镜译初始化超时，请稍后检查连接。')),5000);})]):null;}finally{clearTimeout(timer);}if(destroyed)throw Error('通讯服务已关闭。');assertEnabled();
      const tts=jy?.tts?.status?.()||{},stt=jy?.stt?.status?.()||{},check=has('call.connect')&&typeof jy.call?.connect==='function'?await jy.call.connect({app:'东京都2051通讯器',characters:names.slice(0,60),needs:['tts.stream','stt','llm.stream']}):null;
      // v0.48.0 hasKey is Fish's key even when the floor voice is Doubao/MiniMax.
      // For other providers let speak validate its own setup, without inspecting private keys.
      const readConfigured=typeof tts.readReady==='boolean'?tts.readReady:tts.provider==='gsv'||tts.hasKey!==false;
      return {installed:!!jy,version:jy?.version||'',text:has('llm.stream')&&typeof jy.llm?.stream==='function',call:has('tts.stream')&&typeof jy.tts?.stream==='function'&&tts.enabled!==false&&(tts.streamReady===true||(tts.streamReady===undefined&&tts.hasKey!==false)),read:typeof jy?.tts?.speak==='function'&&tts.enabled!==false&&readConfigured,mic:has('stt')&&typeof jy.stt?.start==='function'&&stt.available===true,stopAll:typeof jy?.tts?.stop==='function',reason:!jy?'镜译接口尚未就绪，请在设置中检查安装与启用状态。联系人与记录仍可查看。':!has('llm.stream')?'当前镜译未提供通话模型接口；请从作者渠道更新镜译并刷新页面。':tts.reason||'',readReason:tts.readReason||'请在镜译中配置楼层朗读的 Fish 或 GPT-SoVITS 音源。',micReason:stt.reason||'当前镜译或浏览器未提供可用的语音输入。',missing:check?.missing||[],voices:jy?.tts?.voices?.()||[],reading:has('reading')&&typeof jy?.reading?.get==='function'?'public-snapshot':'unavailable'};
    }
    function llm(options){assertEnabled();if(!has('llm.stream')||!jy.llm?.stream)throw Error('当前镜译缺少 llm.stream。');return jy.llm.stream(options);}
    function stream(options){assertEnabled();if(!has('tts.stream')||!jy.tts?.stream)throw Error('当前镜译缺少 tts.stream。');return jy.tts.stream(options);}
    function speak(options){assertEnabled();if(typeof jy?.tts?.speak!=='function')throw Error('当前镜译缺少 tts.speak。');return jy.tts.speak({...options,analyze:false,play:true});}
    function mic(options){assertEnabled();if(!has('stt')||!jy.stt?.start)throw Error('当前镜译缺少 stt。');const status=jy.stt.status();if(!status.available)throw Error(status.reason||'麦克风不可用。');return jy.stt.start(options);}
    function stopAll(){return typeof jy?.tts?.stop==='function'?jy.tts.stop({all:true}):false;}
    return {refresh,llm,stream,speak,renderSpeech:options=>{assertEnabled();return jy.tts.speak({...options,analyze:false,play:false});},mic,stopAll,destroy(){destroyed=true;jy=null;}};
  }
  return {create};
});
