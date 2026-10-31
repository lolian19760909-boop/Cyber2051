(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxStartupHelp=api;})(globalThis,function(){
 'use strict';
 // This entry must run before resource, updater and gameplay initialization.
 function install(win,owner,expected=[],version=''){
  win.CxxStartupHelp?.destroy?.();const doc=win.document,panels=new Map();let ended=false,queued=false;
  const clean=value=>String(value||'').replace(/(Bearer\s+)\S+/gi,'$1[已隐藏]').replace(/((?:api[_-]?key|token|secret|password|密钥)\s*[=:]\s*)[^\s,;]+/gi,'$1[已隐藏]').replace(/(https?:\/\/[^\s?#]+)[?#][^\s)]+/g,'$1');
  function snapshot(){
   let scripts=[],listError='';
   try{const get=owner.getScriptTrees||win.TavernHelper?.getScriptTrees;if(get){const flatten=(rows,on=true)=>rows.flatMap(s=>s.type==='folder'?flatten(s.scripts||[],on&&s.enabled!==false):[{id:s.id,enabled:on&&s.enabled!==false}]);scripts=flatten(get({type:'character'}));}else listError='脚本列表接口不可用';}catch(e){listError=clean(e.message);}
   const boot=win.CxxStartup?.read?.()||[];
   return {version,at:new Date().toISOString(),environment:{protocol:win.location?.protocol,secureContext:win.isSecureContext,userAgent:win.navigator?.userAgent},scriptListError:listError,plugins:win.CxxPlugins?.read?.()||null,
    modules:expected.map(s=>{const configured=scripts.find(x=>x.id===s.id),state=boot.find(x=>x.id===s.id);return {name:s.name,id:s.id,enabled:configured?.enabled??null,state:state?.state||(configured?.enabled===false?'已停用':'尚未记录到脚本执行'),dependency:clean(state?.detail),error:state?.error?{message:clean(state.error.message),code:clean(state.error.code),stack:clean(state.error.stack)}:null};}),
    startup:boot.filter(x=>!expected.some(s=>s.id===x.id)).map(x=>({name:x.name,state:x.state,detail:clean(x.detail),error:x.error?{message:clean(x.error.message),stack:clean(x.error.stack)}:null})),
    services:{updater:!!win.Cxx233Updater,menu:!!win.__cxx_launcher__,gameplay:!!win.Cxx233Shared,creation:!!win.Cxx236OpeningHost,resources:!!win.CxxResources}};
  }
  function describe(){const s=snapshot();return ['2051 开场启动检查 · V'+s.version,'检查时间：'+s.at,'环境：'+s.environment.userAgent,'安全上下文：'+s.environment.secureContext,
   ...(s.plugins?.rows||[]).map(r=>r.name+'：'+r.message),
   ...(s.scriptListError?['脚本列表：'+s.scriptListError]:[]),...s.modules.map(m=>m.name+'：'+m.state+(m.dependency?' · '+m.dependency:'')+(m.error?'\n'+(m.error.stack||m.error.message)+(m.error.code?'\n错误码：'+m.error.code:''):'')),
   ...s.startup.map(m=>m.name+'：'+m.state+(m.detail?' · '+m.detail:'')+(m.error?'\n'+(m.error.stack||m.error.message):'')),
   '服务：'+Object.entries(s.services).map(([k,v])=>k+'='+v).join('，'),
   '“尚未记录到脚本执行”表示尚未取得该脚本的执行结果；不是具体的异常原因。'].join('\n\n');}
  function attach(node){
   if(panels.has(node))return;const box=doc.createElement('details');box.dataset.cxxStartupHelp='true';box.className='cxx-startup-help cxx-feedback-theme';const sheet=doc.createElement('style');sheet.textContent=globalThis.CxxFeedbackStyle||'';box.append(sheet);
   const title=doc.createElement('summary');title.textContent='插件与启动帮助';box.append(title);
   const note=doc.createElement('p');note.textContent='这里直接显示启动状态和已捕获的原始错误，无需访问手机文件。';box.append(note);
   const output=doc.createElement('textarea');output.readOnly=true;output.setAttribute('aria-label','可复制的启动信息');box.append(output);
   const refresh=()=>{output.value=describe();};
   const button=(label,run)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.onclick=run;box.append(b);};
   button('插件安装',()=>win.CxxPlugins?.open());button('刷新检查',()=>{void win.CxxPlugins?.check();refresh();});button('复制启动信息',async()=>{refresh();try{await win.navigator.clipboard.writeText(output.value);note.textContent='启动信息已复制。';}catch{output.focus();output.select();note.textContent='浏览器未允许自动复制；长按上面的文字，选择全选并复制。';}});
   box.addEventListener('toggle',()=>{if(box.open)refresh();});node.append(box);panels.set(node,box);refresh();
  }
  function entry(node){const b=node.querySelector('[data-cxx-return-title]'),note=node.querySelector('[data-cxx-entry-note]');if(!b)return;const ready=typeof win.__cxx_launcher__?.open==='function';if(b.disabled===ready)b.disabled=!ready;const text=ready?'继续创建人物，或选择其他故事。':'正在连接开局界面；若长时间未响应，请启用酒馆助手与本卡脚本。';if(note&&note.textContent!==text)note.textContent=text;b.onclick=async()=>{b.disabled=true;try{await win.__cxx_launcher__?.open();}catch(e){if(note)note.textContent='开局页面暂未打开：'+clean(e.message);}finally{if(b.isConnected)b.disabled=!win.__cxx_launcher__;}};}
  function scan(){queued=false;if(ended)return;for(const [node,box]of panels)if(!node.isConnected){box.remove();panels.delete(node);}for(const node of doc.querySelectorAll('[data-cxx-opening]')){attach(node);entry(node);}}
  function queue(records){if(ended||queued||records?.every(r=>r.target.closest?.('[data-cxx-startup-help]')))return;queued=true;win.queueMicrotask(scan);}
  const entryTimer=win.setInterval(()=>{if(!ended)for(const node of panels.keys())entry(node);},1000);const observer=new win.MutationObserver(queue);observer.observe(doc,{childList:true,subtree:true});queue();
  function capture(event){const e=event.error||event.reason||new Error(event.message||'启动脚本异常');win.CxxStartup?.mark('cxx-runtime-bootstrap','资源与运行诊断','启动失败','诊断入口之后的初始化',e);}
  owner.addEventListener('error',capture);owner.addEventListener('unhandledrejection',capture);
  const service={snapshot,destroy(){if(ended)return;ended=true;win.clearInterval(entryTimer);observer.disconnect();for(const box of panels.values())box.remove();panels.clear();owner.removeEventListener('error',capture);owner.removeEventListener('unhandledrejection',capture);owner.removeEventListener('pagehide',service.destroy);if(win.CxxStartupHelp===service)delete win.CxxStartupHelp;}};
  owner.addEventListener('pagehide',service.destroy,{once:true});win.CxxStartupHelp=service;return service;
 }
 return {install};
});
