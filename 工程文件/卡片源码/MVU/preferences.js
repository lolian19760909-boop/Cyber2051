/* One chat-local write for the first-run choices. No writes from render callbacks. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.Cxx236Preferences=value;})(globalThis,function(){
 'use strict';
 const KEY='__cxx_ui_preferences',GAL='__cxx_gal_mode',levels=['high','medium','low'];
 const CSS=(globalThis.CxxPreferenceStyle||'');
 const copy=v=>JSON.parse(JSON.stringify(v));
 // Persisted JSON objects can return in a different key order (for example
 // through a Rust host). Compare values; array order and value types still matter.
 function sameJson(a,b){
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameJson(a[key],b[key]));
 }
 const modes=['tactical','fast','text'],strategies=['auto','weapon','hack'],dataStores=['on','shadow'];
 // dataStore：状态读取源的回滚开关。on=以数据库表为准（2.3.28 起默认）；shadow=仍以 MVU 变量为准并双写。
 function read(vars){const v=vars?.[KEY];return {level:levels.includes(v?.effects)?v.effects:'medium',device:['mobile','desktop'].includes(v?.device)?v.device:'auto',complete:v?.setupVersion===1&&v?.completed===true,gal:vars?.[GAL]?.enabled===true,mirror:v?.mirror!==false,mirrorGuidePending:v?.mirrorGuidePending===true,nsfw:v?.nsfw===true,nsfwChosen:v?.nsfwChosen===true,battleMode:modes.includes(v?.battleMode)?v.battleMode:'fast',fastStrategy:strategies.includes(v?.fastStrategy)?v.fastStrategy:'auto',dataStore:dataStores.includes(v?.dataStore)?v.dataStore:'on'};}
 function resolveDevice(selected,win){if(['mobile','desktop'].includes(selected))return selected;return ((win?.navigator?.maxTouchPoints||0)>0||win?.matchMedia?.('(pointer: coarse)')?.matches)&&Math.min(win?.innerWidth||0,win?.innerHeight||0)<900?'mobile':'desktop';}
 function eligible(chat){return Array.isArray(chat)&&chat.length>0&&!chat.some(m=>m.is_user)&&/^<Opening(?:Form\/>|Page id="\d+"\/>)/.test(chat[0]?.mes||'');}
 function create({api,win,runtime,verifySaved}){
  const context=()=>api.SillyTavern.getContext(),scope=()=>runtime.key(),doc=win.document;
  let ended=false,epoch=0,observed='',modal=null,busy=false,stopWaiting=null,previewChoice=null,saveQueue=Promise.resolve(),pendingSaves=0;
  const listeners=new Set();
  const current=(key,version)=>!ended&&scope()===key&&epoch===version;
  function state(){return {...read(api.getVariables({type:'chat'})),...previewChoice};}
  function notify(){for(const fn of listeners)fn(state());win.dispatchEvent(new win.Event('cxx-ui-preferences-changed'));}
  function save(choice){
   if(!levels.includes(choice.level)||typeof choice.gal!=='boolean'||choice.device!==undefined&&!['auto','mobile','desktop'].includes(choice.device)||choice.mirror!==undefined&&typeof choice.mirror!=='boolean'||choice.nsfw!==undefined&&typeof choice.nsfw!=='boolean'||choice.nsfwChosen!==undefined&&typeof choice.nsfwChosen!=='boolean'||choice.battleMode!==undefined&&!modes.includes(choice.battleMode)||choice.fastStrategy!==undefined&&!strategies.includes(choice.fastStrategy)||choice.dataStore!==undefined&&!dataStores.includes(choice.dataStore))return Promise.reject(Error('请选择设备、特效、阅读方式、镜译、内容尺度与战斗结算方式。'));
   const key=scope(),version=epoch,c=context();if(!key)throw Error('当前聊天未就绪。');
   choice={...choice};busy=true;pendingSaves++;
   const commit=async()=>{let before,after;
   try{
    await api.updateVariablesWith(vars=>{if(!current(key,version))throw Error('聊天已切换，设置未写入。');before=copy(vars);after={...vars,[KEY]:{...vars[KEY],schemaVersion:1,effects:choice.level,device:choice.device??read(vars).device,...(choice.mirror===undefined?{}:{mirror:choice.mirror}),...(typeof choice.mirrorGuidePending==='boolean'?{mirrorGuidePending:choice.mirrorGuidePending}:{}),...(choice.nsfw===undefined?{}:{nsfw:choice.nsfw}),...(choice.nsfwChosen===undefined?{}:{nsfwChosen:choice.nsfwChosen}),...(choice.battleMode===undefined?{}:{battleMode:choice.battleMode}),...(choice.fastStrategy===undefined?{}:{fastStrategy:choice.fastStrategy}),...(choice.dataStore===undefined?{}:{dataStore:choice.dataStore}),setupVersion:1,completed:true},[GAL]:{...vars[GAL],schemaVersion:1,enabled:choice.gal}};return after;},{type:'chat'});
    after=copy(after);
    if(!current(key,version))throw Error('聊天已切换。');
    if(typeof c.saveMetadata!=='function')throw Error('宿主没有提供设置保存能力。');
    for(let attempt=0;;attempt++){
     if(!current(key,version))throw Error('聊天已切换，旧设置回调已取消。');
     await c.saveMetadata();if(!current(key,version))throw Error('聊天已切换，旧设置回调已取消。');
     try{await verifySaved({key,context:c,hostWindow:win,expected:after,current:()=>current(key,version)});break;}
     catch(e){const actual=api.getVariables({type:'chat'});if(e.code!=='preferences-readback'||attempt>=2||!current(key,version)||[KEY,GAL].some(k=>!sameJson(actual[k],after[k])))throw e;}
    }
    if(!current(key,version))throw Error('聊天已切换。');
    close();notify();return state();
   }catch(e){
    // Restore only our fields, only in the originating chat and only if no newer choice won.
    if(before&&current(key,version)){
     await api.updateVariablesWith(vars=>{if(!current(key,version))throw Error('聊天已切换。');const next={...vars};for(const k of [KEY,GAL])if(sameJson(vars[k],after[k])){if(Object.hasOwn(before,k))next[k]=before[k];else delete next[k];}return next;},{type:'chat'});
     try{await c.saveMetadata();}catch{}
    }
    throw e;
   }
   };
   const run=()=>{if(!current(key,version))throw Error('聊天已切换，设置未写入。');const host=win.Cxx233Updater?.host;if(!host?.withChatSave)return commit();const [characterKey,chatId]=JSON.parse(key);return host.withChatSave({characterKey,chatId},commit);};
   const result=saveQueue.catch(()=>{}).then(run).finally(()=>{pendingSaves--;busy=pendingSaves>0;});saveQueue=result;return result;
  }
  function close(){modal?.cleanup();modal=null;}
  function open(manual=false){
   if(!manual){win.Cxx236OpeningHost?.open();return;}
   if(ended||!scope()||modal)return;
   const saved=state(),previous=doc.activeElement,layer=doc.createElement('dialog');layer.id='cxx-first-settings-236';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','cxx-first-settings-title');

   const style=doc.createElement('style');style.textContent=CSS;
   const node=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
   const panel=node('section','cxx-setup-panel'),hero=node('header','cxx-setup-hero'),body=node('div','cxx-setup-body');
   hero.append(node('p','cxx-setup-kicker','TOKYO / 2051'),node('h2','cxx-setup-brand','东京都\n2051'),node('p','cxx-setup-caption','MyGO!!!!! × Ave Mujica'),node('span','cxx-setup-step','READING PREFERENCES'));
   const title=node('h2','cxx-setup-title','阅读与特效');title.id='cxx-first-settings-title';
   body.append(title,node('p','cxx-setup-intro','调整当前聊天的显示方式。'));
   const controls=[];
   function choices(label,name,values,selected){
    const group=node('fieldset','cxx-setup-group'),grid=node('div','cxx-setup-choices');group.append(node('legend','',label));const inputs=[];
    for(const [value,title,description]of values){const row=node('label','cxx-setup-choice'),input=doc.createElement('input'),copy=node('span','cxx-setup-copy');input.setAttribute('type','radio');input.name=name;input.setAttribute('name',name);input.value=value;input.checked=value===selected;copy.append(node('strong','',title),node('small','',description));row.append(input,copy);grid.append(row);inputs.push(input);controls.push(input);}
    group.append(grid);body.append(group);return {value:()=>inputs.find(input=>input.checked)?.value,inputs};
   }
   const device=choices('使用设备','cxx-setup-device',[['mobile','手机端','触控布局 · 轻量动效'],['desktop','电脑端','桌面布局 · 完整动效']],resolveDevice(saved.device,win));
   const effect=choices('特效强度','cxx-setup-effect',[['high','高','完整氛围'],['medium','中','轻量反馈'],['low','低','静态显示']],saved.level);
   body.append(node('p','cxx-setup-foot','手机端保留操作反馈，暂停持续装饰动效；原生与 Gal 均可使用。'));
   const mode=choices('阅读方式','cxx-setup-mode',[['native','原生阅读','保留酒馆聊天界面'],['gal','Gal 阅读','全屏场景与对话']],saved.gal?'gal':'native');
   const mirror=choices('镜译功能','cxx-setup-mirror',[['off','关闭','本故事使用原文阅读'],['on','开启','译文显示、角色朗读与手机通话']],saved.mirror?'on':'off');
   body.append(node('p','cxx-setup-foot','开关仅作用于本故事。镜译的全局自动翻译仍在插件设置中管理。'));
   const status=node('p','cxx-setup-status');status.setAttribute('role','status');
   const buttons=node('div','cxx-setup-actions'),cancel=node('button','cxx-setup-cancel','取消'),confirm=node('button','cxx-setup-confirm','保存设置');
   controls.push(cancel,confirm);buttons.append(cancel,confirm);
   cancel.onclick=()=>{if(!busy)close();};
   confirm.onclick=async()=>{
    controls.forEach(n=>n.disabled=true);status.textContent='正在保存…';
    try{await save({level:effect.value(),device:device.value(),gal:mode.value()==='gal',mirror:mirror.value()==='on'});}
    catch(e){if(modal?.layer===layer){status.textContent='未完成：'+e.message;controls.forEach(n=>n.disabled=false);}return;}
   };
   function keydown(e){if(e.key==='Escape'&&!busy){e.preventDefault();close();}if(e.key==='Tab'){const nodes=controls.filter(n=>!n.disabled&&(n.tagName?.toLowerCase()!=='input'||n.checked)),i=nodes.indexOf(doc.activeElement);if(e.shiftKey&&i===0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&i===nodes.length-1){e.preventDefault();nodes[0]?.focus();}}}
   function cancelled(e){e.preventDefault();if(!busy)close();}
   body.append(status,buttons,node('p','cxx-setup-foot','之后可在终端修改。'));panel.append(hero,body);layer.append(style,panel);doc.body.append(layer);layer.addEventListener('keydown',keydown);layer.addEventListener('cancel',cancelled);
   modal={layer,cleanup(){layer.removeEventListener('keydown',keydown);layer.removeEventListener('cancel',cancelled);cancel.onclick=confirm.onclick=null;layer.close?.();layer.remove();if(previous?.isConnected)previous.focus?.();}};layer.showModal?.();effect.inputs.find(n=>n.checked)?.focus();
  }

  function changed(){const key=scope();if(key!==observed){observed=key;epoch++;previewChoice=null;close();notify();}}
  const events=context().eventTypes||{},names=['CHAT_CHANGED'];
  for(const name of names)if(events[name])api.eventOn(events[name],changed);
  if(!context().chat.length&&events.CHARACTER_MESSAGE_RENDERED){api.eventOn(events.CHARACTER_MESSAGE_RENDERED,changed);stopWaiting=()=>api.eventRemoveListener(events.CHARACTER_MESSAGE_RENDERED,changed);}
  changed();
  return {read:state,device:()=>resolveDevice(state().device,win),save,whenIdle:()=>saveQueue,open,preview(choice){previewChoice={...choice};notify();},clearPreview(){if(!previewChoice)return;previewChoice=null;notify();},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},destroy(){if(ended)return;ended=true;epoch++;close();stopWaiting?.();for(const name of names)if(events[name])api.eventRemoveListener(events[name],changed);listeners.clear();},get busy(){return busy;}};
 }
 async function verifySaved({context:c,hostWindow,expected,current}){
  const response=await hostWindow.fetch('/api/chats/get',{method:'POST',signal:AbortSignal.timeout(10000),headers:c.getRequestHeaders(),credentials:'same-origin',cache:'no-cache',body:JSON.stringify({avatar_url:c.characters[c.characterId]?.avatar,file_name:c.getCurrentChatId(),ch_name:c.characters[c.characterId]?.name})});
  if(!response.ok)throw Error('存盘核对失败（HTTP '+response.status+'），请重试。');const text=await response.text();if(!current())throw Error('聊天已切换。');
  if(/^\s*</.test(text))throw Error('酒馆存档接口返回了网页，设置尚未确认。请检查酒馆登录或代理连接后重试。');
  let rows;try{rows=JSON.parse(text);}catch{throw Error('酒馆存档接口返回格式异常，设置尚未确认。');}const vars=rows?.[0]?.chat_metadata?.variables;
  for(const key of [KEY,GAL])if(!sameJson(vars?.[key],expected[key]))throw Object.assign(Error('设置尚未保存，请重试。'),{code:'preferences-readback'});
 }
 return {KEY,GAL,read,resolveDevice,eligible,create,verifySaved,dataStores};
});
