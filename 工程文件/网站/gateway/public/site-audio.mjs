/** Homepage and game use the same approved mixer, controls and persisted audio state. */
const parent=document.querySelector('.site-audio');
if(parent){
 const response=await fetch('/play/current.json',{cache:'no-store'});
 if(!response.ok)throw Error('声音版本入口读取失败');
 const current=await response.json();
 if(!/^[a-f0-9]{20}$/.test(current.release))throw Error('声音版本入口无效');
 const base=new URL('/play/releases/'+current.release+'/opening-ui/',location.origin);
 const [{createOpeningAudio},manifest,css,{wireFeedback}]=await Promise.all([import(new URL('audio.mjs',base)),fetch(new URL('assets.json',base)).then(r=>{if(!r.ok)throw Error('声音资源清单读取失败');return r.json();}),fetch(new URL('audio-site.css',base)).then(r=>{if(!r.ok)throw Error('声音条样式读取失败');return r.text();}),import(new URL('feedback.mjs',base))]);
 const style=document.createElement('style');style.textContent=css;document.head.append(style);
 const url=file=>new URL('assets/'+file,base).href;
 const audio=createOpeningAudio(window,{music:manifest.music.map(row=>({...row,url:url(row.file)})),sfx:Object.fromEntries(Object.entries(manifest.sfx).map(([name,file])=>[name,url(file)]))});
 const stopBar=audio.mount(parent);
 const stopFeedback=wireFeedback(document,{playSound:audio.sfx.play,ignore:node=>parent.contains(node)});audio.music.start();
 window.addEventListener('pagehide',()=>{stopBar();audio.destroy();stopFeedback();},{once:true});
}
