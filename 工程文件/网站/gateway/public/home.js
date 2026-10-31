'use strict';
// Portrait interactions only; the title film owns the single homepage entrance.
document.addEventListener('DOMContentLoaded', () => {
'use strict';
const { t } = CXXUI;
const hero=document.querySelector('.hero');
const art=window.CXXHeroArt;
let posterModule,posterAttempt=0,posterIntent=0,desiredCharacter=art?.current().id;
async function poster(){
  try{return await(posterModule ||= import('/workshop/poster-interaction.mjs?v=svgflow20261027'+(posterAttempt?'&retry='+posterAttempt:'')));}
  catch(error){posterModule=null;posterAttempt++;throw error;}
}
// Keep the first gesture even when the optional module is still downloading.
const swipeSurface=document.createElement('div');swipeSurface.className='poster-swipe-surface';swipeSurface.tabIndex=0;swipeSurface.setAttribute('role','group');hero.querySelector('.hero-portrait').append(swipeSurface);
function labelSwipe(){swipeSurface.setAttribute('aria-label',t('封面人物，左右方向键切换','Cover character; use the left and right arrow keys','表紙の人物。左右矢印キーで切り替え'));}
labelSwipe();document.addEventListener('cxx-lang-changed',labelSwipe);
async function stepCharacter(direction){
  if(!art)return;
  const index=art.choices.findIndex(item=>item.id===desiredCharacter),person=art.choices[(Math.max(0,index)+direction+art.choices.length)%art.choices.length],background=art.current().scene,intent=++posterIntent;
  desiredCharacter=person.id;
  try{const module=await poster();if(intent!==posterIntent)return;await module.selectPoster({...person,scene:background},{direction});if(intent===posterIntent)desiredCharacter=art.current().id;}
  catch{if(intent!==posterIntent)return;desiredCharacter=art.current().id;hero.querySelector('.poster-feedback').textContent=t('人物切换未能加载，请再次滑动重试。','Character switching could not load. Swipe again to retry.','人物切り替えを読み込めません。再度スワイプしてください。');}
}
swipeSurface.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();stepCharacter(event.key==='ArrowRight'?1:-1);});
let swipe=null;
function endSwipe(){
  const previous=swipe;swipe=null;swipeSurface.removeAttribute('data-dragging');
  window.removeEventListener('pointermove',moveSwipe);window.removeEventListener('pointerup',finishSwipe);window.removeEventListener('pointercancel',cancelSwipe);window.removeEventListener('blur',cancelSwipe);window.removeEventListener('pagehide',cancelSwipe);
  if(previous&&swipeSurface.hasPointerCapture(previous.id))swipeSurface.releasePointerCapture(previous.id);
  return previous;
}
function cancelSwipe(event){if(!event||event.pointerId===undefined||event.pointerId===swipe?.id)endSwipe();}
function moveSwipe(event){
  if(!swipe||event.pointerId!==swipe.id)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;
  if(!swipe.horizontal&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.2){endSwipe();return;}
  if(!swipe.horizontal&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.25){swipe.horizontal=true;swipeSurface.dataset.dragging='true';try{swipeSurface.setPointerCapture(event.pointerId);}catch{}}
  if(swipe?.horizontal&&event.cancelable)event.preventDefault();
}
function finishSwipe(event){
  if(!swipe||event.pointerId!==swipe.id)return;const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y,current=endSwipe();
  if(!current.horizontal||Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.25||!art)return;
  stepCharacter(dx<0?1:-1);
}
swipeSurface.addEventListener('pointerdown',event=>{
  if(event.isPrimary===false){endSwipe();return;}if(event.button!==0)return;endSwipe();
  swipe={id:event.pointerId,x:event.clientX,y:event.clientY,horizontal:false};poster().catch(()=>{});
  window.addEventListener('pointermove',moveSwipe,{passive:false});window.addEventListener('pointerup',finishSwipe);window.addEventListener('pointercancel',cancelSwipe);window.addEventListener('blur',cancelSwipe);window.addEventListener('pagehide',cancelSwipe,{once:true});
});
swipeSurface.addEventListener('lostpointercapture',cancelSwipe);
let pointerPending=false,pointerSeed;
function pointerStart(event){
  pointerSeed=null;
  if(event.pointerType==='touch'||event.target.closest('a,button,select,label,.hero-copy,.hero-bottom,.poster-rail')||document.documentElement.dataset.effects!=='full'||document.documentElement.dataset.motion!=='on'||!matchMedia('(min-width:1151px) and (hover:hover) and (pointer:fine)').matches)return;
  const bounds=hero.getBoundingClientRect(),x=event.clientX-bounds.left,y=event.clientY-bounds.top;
  if(x<bounds.width*.42||x>bounds.width-56||y<0||y>bounds.height*.78)return;
  
  pointerSeed={clientX:event.clientX,clientY:event.clientY,pointerType:event.pointerType,target:event.target};
  if(pointerPending)return;pointerPending=true;
  poster().then(module=>{module.initLens(pointerSeed);hero.removeEventListener('pointermove',pointerStart);}).catch(()=>{}).finally(()=>{pointerPending=false;});
}
hero.addEventListener('pointermove',pointerStart,{passive:true});
hero.addEventListener('pointerleave',()=>{pointerSeed=null;});
document.addEventListener('keydown',()=>{pointerSeed=null;},{capture:true});

});
