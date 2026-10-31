// On-demand cover selection and a bounded color/sampling reveal of the actual art.
const hero=document.querySelector('.hero');
const feedback=hero.querySelector('.poster-feedback');
const city=hero.querySelector('.hero-city');
let revision=0, initialized=false,transitionRevision=0,transitionLayers=[],transitionAnimations=[],transitionObserver;
const t=(...values)=>window.CXXUI.t(...values);
function stopTransition(){
  const wasPlaying=hero.hasAttribute('data-poster-transition');
  transitionRevision++;transitionAnimations.forEach(animation=>animation.cancel());transitionAnimations=[];
  transitionLayers.forEach(layer=>layer.remove());transitionLayers=[];transitionObserver?.disconnect();
  document.removeEventListener('keydown',stopTransition,true);window.removeEventListener('pagehide',stopTransition);
  hero.removeAttribute('data-poster-transition');
  if(wasPlaying)document.dispatchEvent(new CustomEvent('cxx-poster-changed'));
}
function previousPortrait(){
  const figure=hero.querySelector('.hero-figure'),portrait=figure?.querySelector('.hero-person');if(!figure||!portrait?.naturalWidth)return null;
  const bounds=figure.getBoundingClientRect(),copy=figure.cloneNode(true);
  copy.className='poster-previous-figure';copy.setAttribute('aria-hidden','true');copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  Object.assign(copy.style,{left:figure.offsetLeft+'px',right:'auto',top:figure.offsetTop+'px',width:bounds.width+'px',height:bounds.height+'px'});
  copy.querySelectorAll('source').forEach(source=>source.remove());
  const image=copy.querySelector('.hero-person');image.className='poster-previous-person';image.alt='';image.removeAttribute('id');image.removeAttribute('srcset');image.removeAttribute('fetchpriority');image.src=portrait.currentSrc||portrait.src;
  image.style.filter=getComputedStyle(portrait).filter;
  figure.parentElement.append(copy);transitionLayers.push(copy);return copy;
}
function fadePortrait(previous,direction){
  if(!previous)return;const figure=hero.querySelector('.hero-figure'),token=transitionRevision;
  const options={duration:360,easing:'cubic-bezier(.4,0,.2,1)'},offset=(direction||1)*32;
  transitionAnimations=[previous.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:`translateX(${-offset}px)`}],options),figure.animate([{opacity:0,transform:`translateX(${offset}px)`},{opacity:1,transform:'translateX(0)'}],options)];
  const finish=()=>{if(token!==transitionRevision)return;stopTransition();};
  transitionObserver = new MutationObserver(()=>{if(document.documentElement.dataset.motion!=='on')finish();});
  transitionObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  document.addEventListener('keydown',stopTransition,true);window.addEventListener('pagehide',stopTransition,{once:true});
  Promise.allSettled(transitionAnimations.map(animation=>animation.finished)).then(finish);
}
export async function selectPoster(choice,{direction=0,instant=false}={}) {
  if(!choice)return;
  const current=++revision;
  if(choice.id===window.CXXHeroArt.current().id&&choice.scene===window.CXXHeroArt.current().scene){hero.removeAttribute('aria-busy');feedback.textContent='';return;}
  hero.setAttribute('aria-busy','true');
  feedback.textContent=t('正在读取所选封面…','Loading the selected cover…','選択した表紙を読み込んでいます…');
  const urls=window.CXXHeroArt.urls(choice),mobile=matchMedia('(max-width:600px)').matches;
  const pending=[new Image(),new Image()];
  pending[0].crossOrigin='anonymous';
  pending[0].src=mobile?urls.personMobile:urls.person; pending[1].src=mobile?urls.cityMobile:urls.city;
  try {
    await Promise.all(pending.map(image=>image.decode()));
    if(current!==revision)return;
    const previousChoice=window.CXXHeroArt.current(),characterChanged=choice.id!==previousChoice.id;
    stopTransition();
    const animate=characterChanged&&!instant&&document.documentElement.dataset.motion==='on'&&document.documentElement.dataset.input!=='keyboard'&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
    const previous=animate?previousPortrait():null;
    if(previous)hero.dataset.posterTransition='playing';
    window.CXXHeroArt.show(choice);
    hero.removeAttribute('aria-busy');
    feedback.textContent=t('封面已切换为：','Cover changed to: ','表紙を変更：')+t(...choice.names)+' / '+t(...window.CXXHeroArt.scenes.find(item=>item.id===choice.scene).names);
    if(previous)fadePortrait(previous,direction);
  }catch{
    if(current!==revision)return;
    hero.removeAttribute('aria-busy');
    feedback.textContent=t('封面暂时无法读取，已保留原画面。请再次滑动重试。','This cover is unavailable. The previous cover is retained; swipe again to retry.','表紙を読み込めませんでした。元の画像を保持しています。再度スワイプしてください。');
  }
}
export function initLens(seed) {
  if(initialized||!matchMedia('(min-width:1151px) and (hover:hover) and (pointer:fine)').matches)return; initialized=true;
  // Filter the small reveal windows, never the full hero or public text.
  const filters=document.createElementNS('http://www.w3.org/2000/svg','svg');
  filters.setAttribute('width','0');filters.setAttribute('height','0');filters.style.position='absolute';
  filters.classList.add('hero-sample-defs');filters.setAttribute('aria-hidden','true');
  filters.innerHTML='<defs><filter id="poster-sample" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".018 .12" numOctaves="1" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" result="sample"/><feColorMatrix in="sample" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="red"/><feOffset in="red" dx="1.5" result="red-shift"/><feColorMatrix in="sample" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="cyan"/><feOffset in="cyan" dx="-1.5" result="cyan-shift"/><feBlend in="red-shift" in2="cyan-shift" mode="screen"/></filter></defs>';
  hero.prepend(filters);
  const lens=document.createElement('div'),image=document.createElement('img');
  lens.className='hero-lens';lens.setAttribute('aria-hidden','true');image.className='hero-lens-image';image.alt='';image.decoding='async';lens.append(image);hero.prepend(lens);
  const subject=document.createElement('div'),subjectImage=document.createElement('img');
  subject.className='hero-subject-lens';subject.setAttribute('aria-hidden','true');subjectImage.className='hero-subject-light';subjectImage.alt='';subjectImage.crossOrigin='anonymous';subject.append(subjectImage);hero.prepend(subject);
  const portrait=hero.querySelector('.hero-person');
  let frame=0,lastTime=0,active=false,visible=true,rect,width=0,height=0,radius=160,subjectX=0,subjectY=0,x=0,y=0,tx=0,ty=0;
  const pointer=matchMedia('(min-width:1151px) and (hover:hover) and (pointer:fine)');
  const allowed=()=>pointer.matches&&visible&&!document.hidden&&!hero.dataset.posterTransition&&document.documentElement.dataset.effects==='full'&&document.documentElement.dataset.motion==='on'&&hero.dataset.artState!=='unavailable';
  function stop(){active=false;lens.style.opacity='0';subject.style.opacity='0';cancelAnimationFrame(frame);frame=0;lastTime=0;}
  function measure(){rect=hero.getBoundingClientRect();width=rect.width;height=rect.height;radius=Math.min(180,Math.max(140,width*.13));for(const layer of [lens,subject]){layer.style.width=radius*2+'px';layer.style.height=radius*2+'px';}image.style.width=width+'px';image.style.height=height+'px';const bounds=portrait.getBoundingClientRect();subjectX=bounds.left-rect.left;subjectY=bounds.top-rect.top;subjectImage.style.width=bounds.width+'px';subjectImage.style.height=bounds.height+'px';}
  function sync(){stop();const src=city.currentSrc||city.src;if(src&&hero.dataset.artState!=='unavailable'){image.src=src;subjectImage.src=portrait.currentSrc||portrait.src;}measure();}
  function draw(now){
    frame=0;if(!active||!allowed()){stop();return;}
    const damping=1-Math.exp(-Math.min(40,lastTime?now-lastTime:16.67)/95);lastTime=now;
    x+=(tx-x)*damping;y+=(ty-y)*damping;
    const driftX=(x/width-.5)*-8,driftY=(y/height-.5)*-5;
    lens.style.transform=`translate3d(${x-radius}px,${y-radius}px,0)`;
    image.style.transform=`translate3d(${radius-x+driftX}px,${radius-y+driftY}px,0)`;
    subject.style.transform=lens.style.transform;
    subjectImage.style.transform=`translate3d(${subjectX+radius-x+driftX*1.5}px,${subjectY+radius-y+driftY*1.5}px,0)`;
    if(Math.abs(tx-x)+Math.abs(ty-y)>.2)frame=requestAnimationFrame(draw);
  }
  function move(event){
    if(!allowed()||event.pointerType==='touch'||event.target?.closest('a,button,select,label,.hero-copy,.hero-bottom,.poster-rail')){stop();return;}rect=hero.getBoundingClientRect();
    tx=event.clientX-rect.left;ty=event.clientY-rect.top;
    if(tx<width*.42||tx>width-56||ty<0||ty>height*.78){stop();return;}
    if(!active){x=tx;y=ty;}active=true;lens.style.opacity='1';subject.style.opacity='1';if(!frame)frame=requestAnimationFrame(draw);
  }
  hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',stop);
  document.addEventListener('keydown',stop,true);document.addEventListener('visibilitychange',stop);window.addEventListener('pagehide',stop);
  window.addEventListener('scroll',stop,{passive:true});pointer.addEventListener('change',stop);
  document.addEventListener('cxx-poster-changed',sync);city.addEventListener('load',sync);portrait.addEventListener('load',sync);
  document.addEventListener('cxx-entry-finished',sync);
  new ResizeObserver(()=>{const next=hero.getBoundingClientRect();if(next.width!==width||next.height!==height){stop();measure();}}).observe(hero);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)stop();}).observe(hero);
  new MutationObserver(()=>{if(!allowed())stop();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-effects']});
  sync();if(seed&&hero.matches(':hover'))move(seed);
}
