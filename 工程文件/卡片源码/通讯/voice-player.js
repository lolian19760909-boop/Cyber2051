(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxVoiceRuntime=api;})(globalThis,function(){
 'use strict';
 function create(win){let current=null,prepared=null,state={stage:'idle',amplitude:0};const listeners=new Set();
  function emit(patch){state={...state,...patch};for(const fn of listeners)fn({...state});}
  function prepare(){const AudioContext=win.AudioContext||win.webkitAudioContext;if(!AudioContext)throw Error('当前浏览器未提供音频播放接口。');prepared||=new AudioContext();void prepared.resume().catch(()=>{});}
  function stop(){current?.stop();current=null;emit({stage:'idle',amplitude:0});}
  async function play(blob,identity,signal){stop();prepare();const context=prepared;prepared=null;const audio=new win.Audio(),url=win.URL.createObjectURL(blob),source=context.createMediaElementSource(audio),analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);analyser.connect(context.destination);audio.src=url;const samples=new Float32Array(analyser.fftSize);let frame=0,closed=false,resolveDone,rejectDone;const done=new Promise((r,j)=>{resolveDone=r;rejectDone=j;});done.catch(()=>{});
   function sample(){if(closed||audio.paused)return;analyser.getFloatTimeDomainData(samples);const rms=Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);emit({...identity,stage:'playing',amplitude:Math.min(1,Math.max(0,(rms-.012)*7))});frame=win.requestAnimationFrame(sample);}
   function finish(error){if(closed)return;closed=true;audio.pause();audio.removeAttribute('src');audio.load();win.cancelAnimationFrame(frame);source.disconnect();analyser.disconnect();void context.close();win.URL.revokeObjectURL(url);signal?.removeEventListener('abort',abort);if(current===handle)current=null;emit({...identity,stage:error?'error':'ended',amplitude:0});error?rejectDone(error):resolveDone();}
   const pause=()=>{win.cancelAnimationFrame(frame);emit({...identity,stage:'paused',amplitude:0});};const abort=()=>finish();const handle={done,stop:()=>finish(),pause(){audio.pause();pause();},resume:()=>context.resume().then(()=>audio.play())};current=handle;audio.onplaying=()=>{win.cancelAnimationFrame(frame);sample();};audio.onpause=()=>{if(!closed)pause();};audio.onended=()=>finish();audio.onerror=()=>finish(Error('语音文件无法播放，请检查镜译音频格式。'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){finish();return handle;}emit({...identity,stage:'ready',amplitude:0});try{await context.resume();await audio.play();}catch(e){finish(e);throw e;}return handle;
  }
  return {prepare,play,stop,read:()=>({...state}),subscribe(fn){listeners.add(fn);fn({...state});return()=>listeners.delete(fn);},destroy(){stop();void prepared?.close();prepared=null;listeners.clear();}};
 }
 return {create};
});
