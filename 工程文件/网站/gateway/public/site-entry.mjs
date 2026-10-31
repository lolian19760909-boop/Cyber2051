// Presentation only: content stays visible, controls stay live, no loading gate.
let played=false, running=Promise.resolve(), animations=[], lines=[], revision=0;
const root=document.documentElement;
const permitted=()=>root.dataset.motion==='on'&&!document.hidden&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
export function stop(){
  const wasPlaying=root.dataset.entry==='playing';
  revision++;animations.forEach(animation=>animation.cancel());animations=[];
  lines.forEach(line=>line.remove());lines=[];root.removeAttribute('data-entry');
  if(wasPlaying)document.dispatchEvent(new CustomEvent('cxx-entry-finished'));
}
export function enter(repeat=false){
  if(!permitted())return Promise.resolve(false);
  if(played&&!repeat)return running;
  stop();played=true;const token=revision,hero=document.querySelector('.hero'),light=root.dataset.effects!=='full';
  root.dataset.entry='playing';
  function animate(node,frames,options){if(node)animations.push(node.animate(frames,{easing:'cubic-bezier(.23,1,.32,1)',fill:'none',...options}));}
  if(hero){
    // The title and portrait form two distinct layers. The copy and actions never fade out.
    animate(hero.querySelector('.wordmark-shell'),[{opacity:.72,transform:'translateX(-14px)'},{opacity:1,transform:'translateX(0)'}],{duration:light?360:700});
    animate(hero.querySelector('.hero-portrait'),[{opacity:.5,transform:'translateX(28px)'},{opacity:1,transform:'translateX(0)'}],{duration:light?420:900});
    if(!light)for(const edge of ['top','bottom']){
      const line=document.createElement('div');line.className='entry-edge entry-edge-'+edge;line.setAttribute('aria-hidden','true');hero.append(line);lines.push(line);
      animate(line,[{transform:'scaleX(0)',opacity:.9},{transform:'scaleX(1)',opacity:0}],{duration:900});
    }
  }else{
    const heading=[...document.querySelectorAll('.page-masthead,.page-heading,.detail-header,.admin-heading,.admin-login')].find(node=>node.getBoundingClientRect().height>0);
    animate(heading,[{opacity:.7,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:light?180:340});
  }
  running=Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{const completed=revision===token;if(completed)stop();return completed;});
  return running;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
document.addEventListener('keydown',stop,true);
document.addEventListener('pointerdown',stop,true);
new MutationObserver(()=>{if(!permitted())stop();}).observe(root,{attributes:true,attributeFilter:['data-motion','data-effects']});
