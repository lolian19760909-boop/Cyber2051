/* Run once in a temporary Tavern Helper script, or in the host console.
 * No chat content, variables, credentials, storage writes or save calls. */
(function(root,factory){
  const tool=factory();
  if(typeof module==='object'&&module.exports)module.exports=tool;
  else tool.collect(root).then(report=>tool.show(root,report));
})(globalThis,function(){
  'use strict';
  const attempt=fn=>{try{return fn();}catch{return undefined;}};
  const callable=(object,name)=>typeof attempt(()=>object?.[name])==='function';
  async function version(object,name){
    if(!callable(object,name))return '此窗口未暴露';
    let timer;try{
      const value=await Promise.race([Promise.resolve().then(()=>object[name]()),new Promise(resolve=>{timer=setTimeout(()=>resolve('读取超时'),3000);})]);
      return typeof value==='string'||typeof value==='number'?String(value).slice(0,80):'返回类型未识别';
    }catch{return '读取失败';}finally{clearTimeout(timer);}
  }
  async function collect(root){
    const windows=[root,attempt(()=>root.parent),attempt(()=>root.top)].filter((w,i,a)=>w&&a.indexOf(w)===i);
    const host=windows.find(w=>callable(attempt(()=>w.SillyTavern),'getContext'));
    const context=attempt(()=>host.SillyTavern.getContext())||{};
    const helper=windows.map(w=>[w,attempt(()=>w.TavernHelper)]).flat().find(w=>callable(w,'getTavernVersion'))||root;
    const document=attempt(()=>host.document)||root.document;
    const fnNames=['getVariables','updateVariablesWith','setChatMessages','eventOn','eventRemoveListener','getWorldbook','replaceScriptTrees','replaceTavernRegexes'];
    const helperFunctions=Object.fromEntries(fnNames.map(name=>[name,callable(helper,name)]));
    const contextFunctions=Object.fromEntries(['messageFormatting','getCurrentChatId','getRequestHeaders','saveChat','saveMetadata','saveWorldInfo','updateWorldInfoList','unshallowCharacter'].map(name=>[name,callable(context,name)]));
    const formatter=callable(context.messageFormatter,'addHook')?'hooks':contextFunctions.messageFormatting?'messageFormatting':'unavailable';
    const eventNames=['CHAT_CHANGED','MESSAGE_SWIPED','MESSAGE_EDITED','CHARACTER_MESSAGE_RENDERED','CHAT_COMPLETION_PROMPT_READY','GENERATION_ENDED','GENERATION_STOPPED'];
    const events=Object.fromEntries(eventNames.map(name=>[name,typeof context.eventTypes?.[name]==='string']));
    const [reportedSillyTavern,helperVersion]=await Promise.all([version(helper,'getTavernVersion'),version(helper,'getTavernHelperVersion')]);
    const notes=[];
    if(!host)notes.push('未找到宿主上下文：请在已打开角色聊天的酒馆助手临时脚本中运行。');
    if(formatter==='unavailable')notes.push('两种正文格式化接口都不可用，需检查宿主接口。');
    if(Object.values(helperFunctions).some(v=>!v))notes.push('部分助手接口在此窗口不可见；控制台结果不能直接判定插件未安装。');
    const stMinor=/^1\.(\d+)\./.exec(reportedSillyTavern);
    if(stMinor&&Number(stMinor[1])<19)notes.push('当前卡内在线更新器要求 ST 1.19.0+；此版本报告会被该门槛拒绝。不要通过伪造版本绕过。');
    if(!events.CHAT_COMPLETION_PROMPT_READY)notes.push('未发现提示词事件；历史对白转换需要进一步核对。');
    return {
      kind:'cyber2051-tt-readonly-probe',at:new Date().toISOString(),
      versions:{reportedSillyTavern,helper:helperVersion,ttApp:'请从 TT 关于页面核对；上面的 ST 兼容版本不是 TT 应用版本'},
      surface:{hostContext:!!host,helperInCurrentWindow:helper===root,secureContext:attempt(()=>host.isSecureContext)??null},
      formatter,contextFunctions,helperFunctions,events,
      browser:{visualViewport:!!attempt(()=>host.visualViewport),webgl2Constructor:callable(host,'WebGL2RenderingContext'),worker:callable(host,'Worker'),decompressionStream:callable(host,'DecompressionStream'),dialog:callable(attempt(()=>host.HTMLDialogElement?.prototype),'showModal'),webLocks:callable(attempt(()=>host.navigator?.locks),'request'),fullscreen:callable(document?.documentElement,'requestFullscreen')},
      notes,scope:'只核对接口形状；不创建 WebGL/Worker，不请求聊天、不读存档、不调用模型。',
      notTested:['实际保存与读回','在线更新安装','真实正文生成','实体手机交互']
    };
  }
  function show(root,report){
    const doc=attempt(()=>root.parent.document)||root.document;if(!doc?.body){root.console?.log(report);return;}
    doc.getElementById('cxx-tt-compat-probe')?.remove();
    const panel=doc.createElement('section');panel.id='cxx-tt-compat-probe';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','TT 只读兼容诊断');
    panel.style.cssText='position:fixed;inset:5vh 4vw;z-index:2147483647;background:#101015;color:#ddd;border:1px solid #df547e;padding:16px;overflow:auto;font:14px/1.6 monospace;box-shadow:0 10px 40px #0009';
    const title=doc.createElement('strong');title.textContent='TT / 只读兼容诊断';
    const close=doc.createElement('button');close.textContent='关闭';close.style.cssText='float:right;padding:6px 14px';close.onclick=()=>panel.remove();
    const hint=doc.createElement('p');hint.textContent='这份报告只包含接口信息，可复制回工程排查。接口存在不等于实机功能已经通过。';
    const pre=doc.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;user-select:text';pre.textContent=JSON.stringify(report,null,2);
    panel.append(title,close,hint,pre);doc.body.append(panel);close.focus();
  }
  return {collect,show};
});
