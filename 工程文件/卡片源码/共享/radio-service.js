/* One audio owner per chat. Views subscribe; closing a view never stops music. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.CxxRadioFactory={create:factory};})(globalThis,function(options){
  'use strict';
  const Boot=typeof module==='object'&&module.exports?require('../运行时/boot-loader.js'):globalThis.CxxBootLoader;
  const {window:win,runtime,channels}=options;
  const doc=win.document,audio=doc.createElement('audio'),listeners=new Set(),off=[],views=new Set();
  audio.preload='none';audio.hidden=true;audio.dataset.cxxRadio='true';doc.body.append(audio);
  let scope=runtime.key(),disposed=false,sequence=0,intent=false,changing=false,deadline=null,mediaOwned=false;
  let userRevision=0,holds=0,resumeTicket=null;
  const state={channelId:channels[0]?.id,index:0,status:'idle',error:'',mode:'sequence',volume:1};
  const channel=()=>channels.find(c=>c.id===state.channelId),track=()=>channel()?.tracks[state.index];
  function clearDeadline(){win.clearTimeout(deadline);deadline=null;}
  function read(){sync();return {...state,position:Number.isFinite(audio.currentTime)?audio.currentTime:0,duration:Number.isFinite(audio.duration)?audio.duration:0,track:track()?.name||'',channel:channel()?.name||''};}
  function emit(){if(disposed)return;const snapshot=read();for(const fn of [...listeners])try{fn(snapshot);}catch(e){win.console?.warn('电台界面更新失败',e);}}
  function reset(){changing=true;++sequence;intent=false;clearDeadline();audio.pause();audio.removeAttribute('src');audio.load();Object.assign(state,{channelId:channels[0]?.id,index:0,status:'idle',error:''});changing=false;releaseMedia();}
  function sync(){const next=runtime.key();if(next!==scope){scope=next;reset();emit();}}
  function fail(message){++sequence;intent=false;clearDeadline();changing=true;audio.pause();changing=false;state.status='error';state.error=message;mediaState('paused');emit();}
  function mediaState(value){if(mediaOwned)try{win.navigator.mediaSession.playbackState=value;}catch{}}
  function releaseMedia(){if(!mediaOwned)return;const session=win.navigator?.mediaSession;for(const action of ['play','pause','previoustrack','nexttrack','seekto'])try{session?.setActionHandler(action,null);}catch{}try{session.playbackState='none';session.metadata=null;}catch{}mediaOwned=false;}
  function claimMedia(){const session=win.navigator?.mediaSession;if(!session)return;mediaOwned=true;try{if(win.MediaMetadata)session.metadata=new win.MediaMetadata({title:track()?.name||'电台',artist:channel()?.name||'东京都2051',album:'东京都电台'});}catch{}
    for(const [action,fn]of Object.entries({play:()=>play(),pause,previoustrack:()=>step(-1),nexttrack:()=>step(1),seekto:e=>seek(e.seekTime)}))try{session.setActionHandler(action,fn);}catch{}
  }
  async function play(channelId=state.channelId,index=state.index){
    sync();userRevision++;if(disposed||!scope)return false;
    if(holds){state.error='通讯或朗读正在使用声音，结束后可手动播放电台。';emit();return false;}
    const selected=channels.find(c=>c.id===channelId),song=selected?.tracks[index];if(!song)return false;
    const same=state.channelId===channelId&&state.index===index&&audio.getAttribute('src')===song.url;
    const token=++sequence,expected=scope;clearDeadline();changing=true;
    if(!same){audio.pause();audio.src=song.url;}else if(state.status==='error'||audio.ended){audio.load();}
    Object.assign(state,{channelId,index,status:'loading',error:''});intent=true;changing=false;claimMedia();emit();
    deadline=win.setTimeout(()=>{if(token===sequence&&intent)fail('载入超时，请重试或选择另一首曲目。');},20000);
    try{
      // Call play in the click stack, before awaiting anything (mobile gesture).
      await audio.play();
      if(disposed||token!==sequence||runtime.key()!==expected){sync();return false;}
      clearDeadline();if(!intent||audio.paused)return false;state.status='playing';mediaState('playing');emit();return true;
    }catch(e){if(!disposed&&token===sequence&&runtime.key()===expected)fail(e?.name==='NotAllowedError'?'浏览器未允许播放，请点击重试。':'音频暂不可用，请重试或选择另一首曲目。');return false;}
  }
  function pause(){sync();userRevision++;if(disposed)return;++sequence;intent=false;clearDeadline();audio.pause();if(state.status!=='idle')state.status='paused';state.error='';mediaState('paused');emit();}
  function suspend(){
    sync();if(!holds){const playing=intent&&['loading','playing'].includes(state.status),expected=scope;pause();resumeTicket={playing,scope:expected,revision:userRevision};}holds++;
    let released=false;return()=>{if(released)return;released=true;holds=Math.max(0,holds-1);if(holds)return;const ticket=resumeTicket;resumeTicket=null;if(!disposed&&ticket?.playing&&scope===ticket.scope&&runtime.key()===ticket.scope&&userRevision===ticket.revision)play();};
  }
  function toggle(){return intent?pause():play();}
  function step(direction=1){sync();const list=channel()?.tracks||[];if(!list.length)return;const next=state.mode==='shuffle'&&list.length>1?(state.index+1+Math.floor(Math.random()*(list.length-1)))%list.length:(state.index+direction+list.length)%list.length;return play(state.channelId,next);}
  function seek(value){sync();userRevision++;if(disposed||!Number.isFinite(audio.duration)||audio.duration<=0)return;audio.currentTime=Math.max(0,Math.min(audio.duration,+value||0));emit();}
  function volume(value){userRevision++;if(disposed)return;state.volume=Math.max(0,Math.min(1,+value||0));audio.volume=state.volume;emit();}
  function mode(value){userRevision++;if(['sequence','repeat','shuffle'].includes(value)){state.mode=value;emit();}}
  function on(name,fn){audio.addEventListener(name,fn);off.push(()=>audio.removeEventListener(name,fn));}
  on('playing',()=>{sync();if(!intent){audio.pause();return;}clearDeadline();state.status='playing';state.error='';mediaState('playing');emit();});
  on('pause',()=>{if(changing||disposed||audio.ended||!audio.paused)return;clearDeadline();intent=false;if(state.status!=='idle'&&state.status!=='error')state.status='paused';mediaState('paused');emit();});
  on('waiting',()=>{if(intent){state.status='loading';emit();}});
  on('error',()=>{if(!changing&&audio.getAttribute('src'))fail('音频暂不可用，请重试或选择另一首曲目。');});
  on('ended',()=>{if(intent){if(state.mode==='repeat')play();else step(1);}});
  for(const name of ['timeupdate','durationchange','loadedmetadata'])on(name,emit);
  const unwatch=runtime.watchMessages?.(sync);
  function subscribe(fn){sync();if(disposed)return()=>{};listeners.add(fn);fn(read());return()=>listeners.delete(fn);}
  const css=options.style||(typeof CxxRadioStyle==='string'?CxxRadioStyle:'');
  function mount({document:d,parent,compact=false}){
    const node=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
    const root=node('section',undefined,'cxx-radio');root.setAttribute('aria-label','共用电台');const style=node('style',css);root.append(style);
    const header=node('header'),mark=node('span','♫','radio-mark'),heading=node('div',undefined,'radio-heading'),title=node('h2'),subtitle=node('small');mark.setAttribute('aria-hidden','true');heading.append(title,subtitle);header.append(mark,heading);
    const controls=node('div',undefined,'radio-controls');
    function button(text,fn,cls){const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;}
    const prev=button('上一首',()=>step(-1)),playButton=button('播放',toggle,'radio-play'),next=button('下一首',()=>step(1));
    const modes=node('select');modes.setAttribute('aria-label','播放模式');for(const [value,label]of [['sequence','顺序播放'],['repeat','单曲循环'],['shuffle','随机播放']]){const op=node('option',label);op.value=value;modes.append(op);}modes.onchange=()=>mode(modes.value);
    const volumeLabel=node('label','音量','radio-volume'),volumeInput=node('input');volumeInput.type='range';volumeInput.min=0;volumeInput.max=1;volumeInput.step=.05;volumeInput.setAttribute('aria-label','音量');volumeInput.oninput=()=>volume(volumeInput.value);volumeLabel.append(volumeInput);controls.append(prev,playButton,next,modes,volumeLabel);
    const progress=node('div',undefined,'radio-progress'),slider=node('input'),clock=node('output');slider.type='range';slider.min=0;slider.step=1;slider.setAttribute('aria-label','播放进度');slider.onchange=()=>seek(slider.value);progress.append(slider,clock);
    const status=node('p',undefined,'radio-status'),retry=button('重试',()=>play(),'radio-retry');status.setAttribute('role','status');
    const browse=node('div',undefined,'radio-browse'),stations=node('select'),songs=node('select'),list=node('div',undefined,'radio-tracks');stations.setAttribute('aria-label','选择频道');songs.setAttribute('aria-label','选择歌曲');
    for(const c of channels){const op=node('option',c.freq+' · '+c.name);op.value=c.id;stations.append(op);}stations.value=state.channelId;
    let rows=[];function tracks(){songs.replaceChildren();list.replaceChildren();rows=[];const c=channels.find(c=>c.id===stations.value);c?.tracks.forEach((t,i)=>{const op=node('option',t.name);op.value=i;songs.append(op);if(!compact){const b=button(String(i+1).padStart(2,'0')+' · '+t.name,()=>{if(state.channelId===c.id&&state.index===i)toggle();else play(c.id,i);});rows.push(b);list.append(b);}});if(c?.id===state.channelId)songs.value=String(state.index);}
    stations.onchange=tracks;songs.onchange=()=>play(stations.value,+songs.value);browse.append(stations,songs);root.append(header,controls,progress,status,retry,browse);if(!compact)root.append(list);parent.append(root);tracks();
    const format=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');let lastTrack='';
    const unsubscribe=subscribe(s=>{const key=s.channelId+':'+s.index;if(key!==lastTrack){lastTrack=key;stations.value=s.channelId;tracks();}title.textContent=s.track||'东京都电台';subtitle.textContent=s.channel+' · 共用播放';playButton.textContent=s.status==='playing'?'暂停':s.status==='loading'?'取消载入':'播放';playButton.setAttribute('aria-pressed',String(s.status==='playing'));modes.value=s.mode;volumeInput.value=s.volume;slider.max=String(s.duration||0);slider.value=String(s.position);slider.disabled=!s.duration;clock.textContent=format(s.position)+' / '+format(s.duration);const labels={idle:'选择曲目后点击播放',loading:'正在载入…',playing:'播放中',paused:'已暂停，点击播放继续',error:s.error};Boot.small(status,{label:labels[s.status]||'',busy:s.status==='loading'});retry.hidden=s.status!=='error';rows.forEach((b,i)=>b.setAttribute('aria-pressed',String(stations.value===s.channelId&&i===s.index&&s.status==='playing')));});
    let removed=false;const view={destroy(){if(removed)return;removed=true;unsubscribe();views.delete(view);d.defaultView?.removeEventListener('pagehide',view.destroy);root.remove();}};views.add(view);d.defaultView?.addEventListener('pagehide',view.destroy,{once:true});return view;
  }
  function destroy(){if(disposed)return;unwatch?.();reset();disposed=true;for(const v of [...views])v.destroy();listeners.clear();off.forEach(fn=>fn());audio.remove();}
  return {read,play,pause,toggle,next:()=>step(1),previous:()=>step(-1),seek,volume,mode,suspend,subscribe,mount,destroy};
});
