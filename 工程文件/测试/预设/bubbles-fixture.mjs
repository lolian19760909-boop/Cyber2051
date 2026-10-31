const config = window.bubbleConfig;
const shared = document.createElement('style'); shared.textContent = config.sharedCSS; document.head.append(shared);
const chat = document.getElementById('chat'), status = document.getElementById('status'), output = document.getElementById('report');
const listeners = new Map(), messages = [{ mes: '已有楼层' }];
const events = [], errors = [], checks = [];
let chatId = 'bubble-fixture', low = false;
const eventTypes = Object.fromEntries(['GENERATION_STARTED','GENERATION_ENDED','GENERATION_STOPPED','CHAT_CHANGED','MESSAGE_SENT','MESSAGE_RECEIVED','PERSONA_CHANGED','PERSONA_UPDATED'].map(key=>[key,key]));
window.SillyTavern = { getContext:()=>({ characterId:0, chat:messages, getCurrentChatId:()=>chatId, eventTypes, eventSource:{ on(key, callback){ if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key).add(callback); }, removeListener(key, callback){ listeners.get(key)?.delete(callback); } } }) };
window.Cxx236Preferences = { read:()=>({ level:low?'low':'high' }) };
window.substitudeMacros = value=>value==='{{user}}'?'夜行客':value==='{{userAvatarPath}}'?'/bubbles/portrait.svg':value;
const emit = (key,...args)=>{ for(const callback of listeners.get(key)??[])callback(...args); };
const report = ()=>{ output.textContent=JSON.stringify({checks,events,errors,activeEntries:chat.querySelectorAll('[data-bda-enter]').length,listeners:[...listeners.values()].reduce((sum,value)=>sum+value.size,0)},null,2); };
window.addEventListener('error',event=>{ errors.push(event.message);report(); });
window.addEventListener('unhandledrejection',event=>{ errors.push(String(event.reason));report(); });
chat.addEventListener('animationstart',event=>{ if(event.target.hasAttribute('data-bda-enter')) { const animation=event.target.getAnimations().find(item=>item.animationName===event.animationName);events.push({name:event.animationName,duration:animation?.effect.getTiming().duration,easing:getComputedStyle(event.target).animationTimingFunction,frames:animation?.effect.getKeyframes().map(({opacity,transform,clipPath})=>({opacity,transform,clipPath}))});report(); } });
function floor(index){const node=document.createElement('div');node.className='mes';node.setAttribute('mesid',String(index));node.innerHTML='<div class="mes_text">'+sanitizeMessage(config.rendered)+'</div>';return node;}
chat.append(floor(0));
const helper=document.getElementById('helper');
helper.srcdoc='<html><body><script src="/bubbles/helper.js"><\/script></body></html>';
await new Promise(resolve=>helper.addEventListener('load',resolve,{once:true}));
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const settle=()=>new Promise(resolve=>setTimeout(resolve,450));
const assert=(condition,label)=>{if(!condition)throw new Error(label);};
const change=()=>{chat.dataset.theme=document.getElementById('theme').value;document.documentElement.dataset.cxxTheme=chat.dataset.theme;chat.style.width=document.getElementById('width').value+'px';chat.dataset.device=Number.parseFloat(chat.style.width)<480?'phone':'desktop';};
document.getElementById('theme').onchange=change;document.getElementById('width').onchange=change;
const run=work=>async()=>{try{await work();report();}catch(error){status.textContent=error.message;errors.push(error.stack??error.message);report();}};
function add(type='normal'){const index=messages.length;messages.push({mes:'新回复'+index});emit('GENERATION_STARTED',type,{},false);chat.append(floor(index));emit('MESSAGE_RECEIVED',index,type);emit('GENERATION_ENDED');}
document.getElementById('new').onclick=()=>{add();status.textContent='已增加新回复';};
document.getElementById('lifecycle').onclick=run(async()=>{
  const select=document.querySelector('select[aria-label="2051 台词显示"]');select.value='avatar';select.dispatchEvent(new Event('change'));await settle();
  const baseline=events.length;window.__cyber2051BandoriAvatar.refresh();await settle();assert(events.length===baseline,'已有楼层误播入场');
  for(const [theme,duration] of [['red',200],['yellow',180],['night',160]]){
    document.getElementById('theme').value=theme;change();await frame();const before=events.length;add();await settle();
    const current=events.slice(before);assert(current.length===4,theme+' 新楼气泡次数不符：'+current.length);assert(current.every(event=>event.duration===duration),theme+' 时长不符');assert(!chat.querySelector('[data-bda-enter]'),'动画结束后标记未清理');
    const node=chat.lastElementChild;node.replaceWith(node.cloneNode(true));window.__cyber2051BandoriAvatar.refresh();await settle();assert(events.length===before+4,'旧楼重绘重复入场');
  }
  let before=events.length;add('regenerate');await settle();add('swipe');await settle();add('continue');await settle();assert(events.length===before,'重生成或续写误播');
  low=true;emit('GENERATION_STARTED','normal',{},false);add();await settle();low=false;assert(events.length===before,'低动态误播');
  chatId='other-chat';messages.splice(0,messages.length,{mes:'载入的旧楼'});chat.replaceChildren(floor(0));emit('CHAT_CHANGED');await settle();assert(events.length===before,'切聊天误播');
  window.__cyber2051BandoriAvatar.refresh();await settle();assert(events.length===before,'刷新重复入场');
  checks.push({name:'新楼、三主题时长、重绘、重生成、续写、低动态、切聊天',pass:true});status.textContent='动画生命周期通过';
});
const properties=['display','position','width','height','minWidth','maxWidth','padding','margin','borderTop','borderRight','borderBottom','borderLeft','backgroundColor','color','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','clipPath','whiteSpace','textAlign'];
function snapshot(node,view=window){const read=(item,pseudo)=>{if(!item)return null;item.getBoundingClientRect();const value=view.getComputedStyle(item,pseudo);return Object.fromEntries(properties.map(name=>[name,value[name]]));};return {self:read(node),before:read(node,'::before'),after:read(node,'::after'),portrait:read(node.querySelector('[data-bda-owned=portrait]')),caption:read(node.querySelector('[data-bda-expression-label]'))};}
async function reference(){
  const iframe=document.getElementById('reference');
  const copy=chat.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('style,[data-cxx-bda-style]').forEach(node=>node.remove());copy.querySelectorAll('[data-bda-enter]').forEach(node=>node.removeAttribute('data-bda-enter'));
  iframe.style.width=chat.style.width;iframe.hidden=false;
  iframe.srcdoc='<!doctype html><style>'+config.donorCSS+'body{margin:0}.mock{height:auto;padding:20px;box-sizing:border-box}.mes{display:block!important;margin:0!important;padding:0!important;max-width:100%!important}.mes_text{container-type:inline-size;width:100%;color:#ebe7e5}</style>'+copy.outerHTML;
  await new Promise(resolve=>iframe.addEventListener('load',resolve,{once:true}));await document.fonts.ready;await iframe.contentDocument.fonts.ready;await frame();return iframe;
}
document.getElementById('reference-button').onclick=run(async()=>{await reference();status.textContent='当前原稿对照已显示';});
document.getElementById('compare').onclick=run(async()=>{
  const differences=[],computedOnly=[];
  for(const width of ['800','350'])for(const theme of ['red','yellow','night'])for(const mode of ['avatar','initial','color','off']){
    document.getElementById('width').value=width;document.getElementById('theme').value=theme;change();
    const select=document.querySelector('select[aria-label="2051 台词显示"]');select.value=mode;select.dispatchEvent(new Event('change'));await Promise.all([...chat.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));await settle();await frame();
    const original=await reference();const actual=[...chat.querySelectorAll('[data-bda]')],expected=[...original.contentDocument.querySelectorAll('[data-bda]')];
    for(let index=0;index<actual.length;index++){
      const left=snapshot(actual[index]),right=snapshot(expected[index],original.contentWindow);
      const geometry=node=>{const rect=node.getBoundingClientRect(),parent=node.parentElement.getBoundingClientRect();return {left:rect.left-parent.left,top:rect.top-parent.top,width:rect.width,height:rect.height};},a=geometry(actual[index]),b=geometry(expected[index]),sameBox=Object.keys(a).every(key=>Math.abs(a[key]-b[key])<.02);
      if(!sameBox)differences.push({width,theme,mode,index,part:'geometry',actual:a,expected:b});
      for(const part of Object.keys(left))for(const property of Object.keys(left[part]??{}))if(left[part][property]!==right[part]?.[property]){const item={width,theme,mode,index,part,property,actual:left[part][property],expected:right[part]?.[property]};if(part==='self'&&property==='margin'&&sameBox)computedOnly.push({...item,actualBox:a,expectedBox:b});else differences.push(item);}
    }
  }
  checks.push({name:'24组同DOM样式及实际位置对照',differences,computedOnly});status.textContent=differences.length?'有'+differences.length+'项差异':'24组外观及实际位置一致';
});
status.textContent='准备就绪';report();
document.getElementById('compat').onclick=run(async()=>{
  document.getElementById('theme').value='red';change();const select=document.querySelector('select[aria-label="2051 台词显示"]');select.value='avatar';select.dispatchEvent(new Event('change'));await settle();
  const bubble=chat.querySelector('[data-bda]'),expected=[getComputedStyle(bubble).backgroundColor,getComputedStyle(bubble,'::before').color];chat.classList.remove('mock');delete document.documentElement.dataset.cxxTheme;await frame();assert(JSON.stringify([getComputedStyle(bubble).backgroundColor,getComputedStyle(bubble,'::before').color])===JSON.stringify(expected),'红色后备主题不一致');chat.classList.add('mock');change();
  const count=chat.querySelectorAll('[data-bda]').length,before=events.length;document.body.dataset.cxxGalActive='1';await frame();assert(!chat.querySelector('[data-bda]'),'Gal开启未清理气泡');delete document.body.dataset.cxxGalActive;await frame();assert(chat.querySelectorAll('[data-bda]').length===count,'Gal返回未恢复气泡');assert(events.length===before,'Gal返回误播入场');
  const text=chat.querySelector('.mes_text'),saved=text.innerHTML;text.innerHTML=sanitizeMessage(config.noStyle);window.__cyber2051BandoriAvatar.refresh();assert(!text.querySelector('[data-bda]'),'关闭显示正则仍装饰');text.innerHTML=saved;window.__cyber2051BandoriAvatar.refresh();
  document.querySelector('[data-role-all=false]').click();assert(!chat.querySelector('[data-bda]'),'全关未生效');document.querySelector('[data-role-all=true]').click();assert(chat.querySelectorAll('[data-bda]').length===count,'全开未恢复');assert(events.length===before,'显示开关误播入场');
  window.__cyber2051BandoriAvatar.dispose();assert(!document.querySelector('#cxx-bda-control,#cxx-bda-style,[data-bda-owned],[data-bda]'),'卸载残留');assert([...listeners.values()].every(value=>value.size===0),'卸载残留监听');checks.push({name:'红主题后备、Gal往返、正则开关、角色开关与卸载',pass:true});status.textContent='兼容与清理通过';
});
