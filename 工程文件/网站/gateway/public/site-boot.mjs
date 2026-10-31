// A finite title film. Fragment strips share the already-selected wordmark bitmap.
// Readiness only observes existing hero images; unrelated requests are never awaited.
import {mountLoadingAscii} from './site-game.mjs?v=home20261027b';
export function mount(bridge){
 const {node}=bridge;if(!bridge.active)return;
 const animations=[],timers=[],cleanups=[];let leaving=false,settled=0,failed=0,hasLogo=false,titleReady=false;
 const root=document.documentElement;let mode;try{mode=localStorage.getItem('cxx-display-mode');}catch{}
 const light=(root.dataset.effects||mode||(matchMedia('(max-width:760px)').matches?'light':'full'))!=='full';
 cleanups.push(mountLoadingAscii(node,{still:light}));
 const progress=node.querySelector('progress'),brand=node.querySelector('.boot-brand'),status=node.querySelector('.boot-status');
 const cleanup=()=>{animations.forEach(a=>a.cancel());timers.forEach(clearTimeout);cleanups.forEach(fn=>fn());};bridge.cleanup(cleanup);if(!bridge.active)return;
 const animate=(element,frames,{clock,...options})=>{if(element&&bridge.active){const animation=element.animate(frames,{fill:'both',easing:'linear',...options});if(Number.isFinite(clock))animation.startTime=clock;animations.push(animation);return animation;}};
 const later=(fn,ms)=>timers.push(setTimeout(()=>{if(bridge.active)fn();},Math.max(0,ms)));
 const elapsed=()=>performance.now()-bridge.started;
 async function leave(){
  if(leaving||!bridge.active)return;leaving=true;
  await document.fonts.ready;if(!bridge.active)return;
  node.dataset.phase='opening';root.dataset.boot='opening';
  const duration=light?240:380,target=document.querySelector('.hero-wordmark').getBoundingClientRect(),from=brand.getBoundingClientRect();
  brand.style.transformOrigin='0 0';
  const title=animate(brand,hasLogo?[{transform:'translate(0,0) scale(1,1)'},{transform:`translate(${target.x-from.x}px,${target.y-from.y}px) scale(${target.width/from.width},${target.height/from.height})`}]:[{opacity:1},{opacity:0}],{duration,easing:'cubic-bezier(.23,1,.32,1)'});
  const backdrop=animate(node.querySelector('.boot-backdrop'),[{opacity:1},{opacity:0}],{duration,easing:'cubic-bezier(.23,1,.32,1)'});
  animate(node.querySelector('.boot-ascii'),[{opacity:1},{opacity:0}],{duration:140});
  animate(node.querySelector('.boot-signature'),[{opacity:.48},{opacity:0}],{duration:120});
  animate(node.querySelector('.boot-lock'),[{opacity:.6},{opacity:0}],{duration:120});
  await Promise.allSettled([title.finished,backdrop.finished]);if(bridge.active)bridge.finish('complete');
 }
 function scheduleLeave(){if(settled===3&&titleReady)void leave();}
 function observeImage(selector){
  const image=document.querySelector(selector);let done=false;
  const finish=ok=>{if(done||!bridge.active)return;done=true;settled++;failed+=ok?0:1;if(selector==='.hero-wordmark'&&!ok)titleReady=true;progress.value=settled;node.dataset.readyImages=String(settled);node.dataset.failedImages=String(failed);scheduleLeave();};
  if(!image){finish(false);return;}
  const loaded=()=>{if(image.naturalWidth){const decoded=image.decode?.();if(decoded)decoded.then(()=>finish(true),()=>finish(!!image.naturalWidth));else finish(true);}else finish(false);};
  if(image.complete)loaded();else{const error=()=>finish(false);image.addEventListener('load',loaded,{once:true});image.addEventListener('error',error,{once:true});cleanups.push(()=>{image.removeEventListener('load',loaded);image.removeEventListener('error',error);});}
 }
 async function showWordmark(base){
  if(hasLogo||!bridge.active||!base?.naturalWidth||base.hidden)return;hasLogo=true;
  const image=()=>{const n=document.createElement('img');n.className='boot-wordmark';if(base.crossOrigin)n.crossOrigin=base.crossOrigin;n.width=960;n.height=320;n.src=base.currentSrc||base.src;n.alt='';n.setAttribute('aria-hidden','true');return n;};
  const whole=image();whole.classList.add('boot-wordmark-base');try{await whole.decode();}catch{hasLogo=false;titleReady=true;scheduleLeave();return;}if(!bridge.active||leaving)return;
  // Parsing completion precedes defer scripts. Let the initial document layout
  // paint before starting the title, without waiting for unrelated scripts/API.
  if(document.readyState==='loading')await new Promise(resolve=>{const parsed=()=>{if(document.readyState!=='loading'){document.removeEventListener('readystatechange',parsed);resolve();}};document.addEventListener('readystatechange',parsed);cleanups.push(()=>{document.removeEventListener('readystatechange',parsed);resolve();});});if(!bridge.active||leaving)return;
  const clock=await new Promise(resolve=>{let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(resolve);});cleanups.push(()=>cancelAnimationFrame(frame));});if(!bridge.active||leaving)return;
  const remaining=1380-elapsed(),signal=remaining>=600;
  // A late bitmap gets a short dissolve. Squeezing the entire glitch sequence
  // into the last few frames made a slow first visit look like a dropped frame.
  const duration=signal?Math.min(light?760:1000,remaining):Math.max(80,Math.min(240,remaining)),fragment=document.createDocumentFragment();fragment.append(whole);
  // The whole title stays readable. Only bounded strips drop out or overshoot.
  const bands=!signal?[]:light?[[23,34,42],[61,69,-32],[78,83,22]]:[[13,20,-65],[25,34,50],[40,44,-90],[51,61,76],[68,73,-40],[80,88,58]];
  const strips=bands.map(([top,bottom,offset],i)=>{
   const slice=document.createElement('span');slice.className='boot-fragment '+(i%2?'boot-fragment-cyan':'boot-fragment-red');slice.style.top=top+'%';slice.style.height=(bottom-top)+'%';
   const pixels=image();pixels.className='boot-fragment-image';pixels.style.top=(-top/(bottom-top)*100)+'%';pixels.style.height=(10000/(bottom-top))+'%';slice.append(pixels);fragment.append(slice);return {slice,offset};
  });
  // Write all layers once, then start them on one document timeline. Interleaving
  // append()/animate() forced style/layout repeatedly on cold, slower devices.
  brand.append(fragment);
  const titleAnimation=animate(whole,[{opacity:0,transform:'translateY(6px)',offset:0},{opacity:1,transform:'translateY(0)',offset:.28},{opacity:1,transform:'translateY(0)',offset:1}],{duration,clock,easing:'cubic-bezier(.23,1,.32,1)'});
  strips.forEach(({slice,offset})=>{
   animate(slice,[
    {opacity:0,transform:`translateX(${offset}px)`,offset:0},
    {opacity:.6,transform:`translateX(${offset*.6}px)`,offset:.1},
    {opacity:.6,transform:`translateX(${offset*.6}px)`,offset:.2},
    {opacity:0,transform:'translateX(0)',offset:.36},
    {opacity:0,transform:'translateX(0)',offset:.57},
    {opacity:.4,transform:`translateX(${offset*.16}px)`,offset:.65},
    {opacity:.4,transform:`translateX(${offset*.16}px)`,offset:.7},
    {opacity:0,transform:'translateX(0)',offset:.84},
    {opacity:0,transform:'translateX(0)',offset:1}
   ],{duration,clock});
  });
  node.dataset.phase='signal';node.dataset.signal=signal?'full':'fade';later(()=>{if(!leaving){node.dataset.phase='locked';status.textContent='Tokyo2051';}},duration*.8);
  animate(node.querySelector('.boot-lock'),[{opacity:0,transform:'scaleX(.7)',offset:0},{opacity:0,transform:'scaleX(.7)',offset:.58},{opacity:.7,transform:'scaleX(1)',offset:.8},{opacity:.55,transform:'scaleX(1)',offset:1}],{duration,clock,easing:'cubic-bezier(.23,1,.32,1)'});
  if(signal&&!light)animate(node.querySelector('.boot-signal-plane'),[{opacity:0,transform:'translateX(0)',offset:0},{opacity:.16,transform:'translateX(-8px)',offset:.16},{opacity:0,transform:'translateX(0)',offset:.3},{opacity:0,transform:'translateX(0)',offset:.58},{opacity:.1,transform:'translateX(5px)',offset:.67},{opacity:0,transform:'translateX(0)',offset:.79},{opacity:0,transform:'translateX(0)',offset:1}],{duration,clock});
  await Promise.allSettled([titleAnimation.finished]);if(bridge.active){titleReady=true;scheduleLeave();}
 }
 function start(){
  if(!bridge.active)return;node.dataset.phase='acquiring';const base=document.querySelector('.hero-wordmark');
  if(base?.complete)showWordmark(base);else if(base){const loaded=()=>showWordmark(base);base.addEventListener('load',loaded,{once:true});cleanups.push(()=>base.removeEventListener('load',loaded));}
  observeImage('.hero-city');observeImage('.hero-person');observeImage('.hero-wordmark');
 }
 // Discover just the hero markup. DOMContentLoaded also waits for unrelated defer
 // scripts, so it cannot own the timing of this self-contained opening.
 if(document.querySelector('.hero-wordmark'))start();else{const markup=new MutationObserver(()=>{if(document.querySelector('.hero-wordmark')){markup.disconnect();start();}});markup.observe(document.body,{childList:true,subtree:true});cleanups.push(()=>markup.disconnect());}
 const observer=new MutationObserver(()=>{if(root.dataset.motion==='off')bridge.finish('preference');});observer.observe(root,{attributes:true,attributeFilter:['data-motion','data-effects']});cleanups.push(()=>observer.disconnect());
}
