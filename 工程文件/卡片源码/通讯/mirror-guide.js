/* A small presentation adapter over the plugin's own controls and change/save handlers. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxMirrorGuide=api;})(globalThis,function(){
 'use strict';
 const field=name=>'[data-jy-field="'+name+'"]',tts=name=>'[data-jy-tts-field="'+name+'"]';
 function control(shadow,selector){const n=shadow.querySelector(selector);if(!n)throw Error('镜译设置界面已更新，请打开“完整设置”继续配置。');return n;}
 function applyFields(win,shadow,patch){
  // Preflight the entire change before touching anything, including all duplicate controls.
  for(const [selector,value]of patch){const n=control(shadow,selector);if(n.tagName==='SELECT'&&![...n.options].some(o=>o.value===String(value)))throw Error('所选连接已不存在，请重新选择。');}
  for(const [selector,value]of patch){const nodes=[...shadow.querySelectorAll(selector)];for(const n of nodes){if(n.type==='checkbox')n.checked=!!value;else n.value=String(value);}nodes[0].dispatchEvent(new win.Event('change',{bubbles:true}));}
 }
 async function persisted(win,checks){
  const c=win.SillyTavern?.getContext?.();if(!c?.getRequestHeaders)throw Error('宿主设置读回接口尚未就绪；配置已提交，请重新检查。');
  for(const delay of [250,650,1400,2200]){await new Promise(r=>win.setTimeout(r,delay));const response=await win.fetch('/api/settings/get',{method:'POST',headers:c.getRequestHeaders(),body:'{}',credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('设置读回失败（HTTP '+response.status+'），请重试核对。');const result=await response.json(),settings=typeof result.settings==='string'?JSON.parse(result.settings):result.settings;const saved=settings?.extension_settings?.['jingyi-translator'];if(saved&&checks(saved))return true;}
  throw Error('配置已提交，但磁盘读回尚未一致。请稍候重新检查，不必重复填写。');
 }

 function voiceId(value){const text=String(value||'').trim();if(!text)return '';if(/^[a-f0-9]{32}$/i.test(text))return text;let u;try{u=new URL(text);}catch{throw Error('请粘贴声音页面的网址，或 32 位声音编号。');}if(u.hostname!=='fish.audio'&&!u.hostname.endsWith('.fish.audio'))throw Error('请使用 Fish Audio 声音页面链接。');const id=u.pathname.split('/').find(p=>/^[a-f0-9]{32}$/i.test(p));if(!id)throw Error('链接里没有声音编号，请进入某个声音的详情页，再复制地址。');return id;}
 function explain(error){const text=String(error?.message||error);if(/401|403|api.?key|密钥|没填.*key/i.test(text))return '密钥未被接受。翻译／通话模型请在「完整设置 → 模型连接」核对；朗读请回到「密钥」，复制 Fish API Keys 中的完整密钥。';if(/402|quota|credit|余额|额度/i.test(text))return 'API 用量不足或账号无权使用当前模型。打开用量页面核对；网页会员不等于 API 额度。不会自动切换型号。';if(/429|rate.?limit/i.test(text))return '请求太频繁。稍等片刻，再点一次试听。';if(/cors|proxy|代理|failed to fetch|network|timeout|超时/i.test(text))return '连接没有完成。检查「连接」中的代理说明；确认网站能访问后重试。';if(/permission|notallowed|麦克风|权限/i.test(text))return '浏览器未允许使用麦克风。点击地址栏的权限图标允许后重试；也可以先用打字通话。';if(/voice|音色|reference/i.test(text))return '声音编号不可用。请在声音库打开该声音，确认仍可用，再粘贴链接。';if(/保存|读回|磁盘/.test(text))return '设置尚未确认保存。填写内容仍在当前面板，请稍候重新保存核对。';return text;}
 // Use the plugin's own single-sentence translation test. No temporary connection mutation.
 function testTranslation(win,shadow,signal){
  const root=control(shadow,'[data-jy-root]'),dot=control(root,'[data-jy-task-dot]'),message=control(root,'[data-jy-task-message]');control(root,'[data-jy-action="test-api"]');
  if(dot.dataset.jyTaskDot==='running')return Promise.reject(Error('镜译正在处理其他任务，请完成后再测试。'));
  const target=control(shadow,'[data-jy-translation-channel]').value;
  return new Promise((resolve,reject)=>{let running=false,timer;const button=win.document.createElement('button'),observer=new win.MutationObserver(check);
   const finish=(error,result)=>{observer.disconnect();win.clearTimeout(timer);signal?.removeEventListener('abort',cancel);button.remove();error?reject(error):resolve(result);};
   function check(){const state=dot.dataset.jyTaskDot;if(state==='running')running=true;if(!running)return;if(state==='success')finish(null,message.textContent);else if(state==='error')finish(Error(message.textContent||'翻译连接测试失败。'));}
   function cancel(){finish(Error('已停止等待。镜译正在发送的测试仍由插件处理，可在完整设置查看结果。'));}
   if(signal?.aborted)return cancel();signal?.addEventListener('abort',cancel,{once:true});observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-jy-task-dot']});timer=win.setTimeout(()=>finish(Error('翻译测试等待超时，请在完整设置查看结果后重试。')),120000);
   button.type='button';button.hidden=true;button.dataset.jyAction='desk-test-channel';button.dataset.jyChannelId=target;root.append(button);button.click();check();
  });
 }
 function mount({win,host,section='translation',onBack=()=>{},onComplete=()=>{}}){
  const shadow=host.shadowRoot,dialog=control(shadow,'.jy-dialog'),doc=win.document,api=win.__JINGYI__,has=name=>api?.features?.includes(name);
  const paths={translation:[['translation','连接与语言'],['translate-test','试译一句'],['practice','切换阅读']],voice:[['source','连接音源'],['voices','选择声音'],['test','点读练习']],call:[['call','准备通话'],['call-test','测试连接'],['input','选用麦克风']]};
  const steps=paths[section]||paths.translation;
  let stopped=false,busy=false,critical=false,speech=null,abort=null,mic=null,played=false,translation='',testedModel=false,testedVoice=false,step=steps[0][0];
  const style=doc.createElement('style');style.textContent=win.CxxMirrorGuideStyle||'';shadow.append(style);dialog.classList.add('cxx-jy-guided');
  const bar=doc.createElement('section');bar.className='cxx-jy-guide';dialog.prepend(bar);
  const node=(tag,text,parent,cls)=>{const n=doc.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;parent.append(n);return n;};
  const title=node('h2',section==='translation'?'读懂这座城市':section==='voice'?'听她说第一句话':'接通她的声音',bar);
  const progress=node('p','',bar,'cxx-jy-progress');progress.setAttribute('role','status');
  const layout=node('div',null,bar,'cxx-jy-layout'),nav=node('nav',null,layout),content=node('div',null,layout,'cxx-jy-form');nav.setAttribute('aria-label','操作引导步骤');
  const note=node('p','',bar,'cxx-jy-note');note.setAttribute('role','status');const footer=node('footer',null,bar,'cxx-jy-guide-actions');
  const button=(label,fn,parent,cls='')=>{const b=node('button',label,parent,cls);b.type='button';b.onclick=async()=>{if(busy||stopped)return;busy=true;bar.setAttribute('aria-busy','true');note.textContent='处理中…';note.classList.remove('error');try{await fn();}catch(e){if(!stopped){note.textContent=explain(e);note.classList.add('error');}}finally{busy=false;bar.removeAttribute('aria-busy');}};return b;};
  const close=()=>control(shadow,'.jy-close').click();
  button('返回用途选择',()=>{close();onBack();},footer,'cxx-jy-secondary');
  const previous=button('上一步',()=>go(steps[steps.findIndex(s=>s[0]===step)-1][0]),footer,'cxx-jy-secondary');
  button('稍后继续',close,footer,'cxx-jy-secondary');button('完整设置',()=>destroy(),footer,'cxx-jy-secondary');
  for(const [id,label]of steps){const b=button(label,()=>go(id),nav);b.dataset.step=id;}
  function go(id){if(stopped)return;abort?.abort();speech?.stop?.();speech?.cancel?.();mic?.cancel?.();mic=null;step=id;paint();dialog.scrollTop=0;content.querySelector('h3')?.focus({preventScroll:true});}
  function heading(text,why){const h=node('h3',text,content);h.tabIndex=-1;node('p',why,content,'cxx-jy-help');}
  function link(label,url,parent=content){const a=node('a',label+' ↗',parent,'cxx-jy-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
  function help(label,lines){const d=node('details',null,content,'cxx-jy-trouble');node('summary',label,d);for(const text of lines)node('p',text,d);return d;}
  function input(label,value='',type='text'){const l=node('label',label,content),e=node('input',null,l);e.type=type;e.value=value;e.autocomplete=type==='password'?'new-password':'off';return e;}
  function select(label,selector){const l=node('label',label,content),e=node('select',null,l),original=control(shadow,selector);for(const o of original.options){const n=node('option',o.textContent,e);n.value=o.value;}e.value=original.value;return e;}
  async function save(patch,check){critical=true;try{applyFields(win,shadow,patch);await persisted(win,check);if(!stopped)note.textContent='设置已保存。';}finally{critical=false;}}
  function complete(text){onComplete(section);content.replaceChildren();heading('可以开始了',text);node('p','之后可从 设置 → 翻译与声音 再次练习或修改连接。',content);button('返回游戏',close,content,'cxx-jy-primary');button('继续设置其他用途',()=>{close();onBack();},content);progress.textContent='练习完成';}
  function proxyHelp(){help('连接失败时检查这里',win.__TAURI_INTERNALS__||win.__TAURI__||win.TauriTavern?['当前为 TauriTavern。先用当前网络连接测试；代理接口报错时，取消“经酒馆代理”后重试。网络与代理在 TT 中配置。']:['SillyTavern 提示 CORS／代理未启用时：保存聊天，关闭酒馆，在安装目录 config.yaml 设置 enableCorsProxy: true，然后重启酒馆。','回到本页勾选“经酒馆代理”再测试。托管酒馆请联系服务管理员配置代理。']);}
  function paint(){
   content.replaceChildren();note.textContent='';note.classList.remove('error');dialog.dataset.cxxGuideStep=step;const index=steps.findIndex(s=>s[0]===step);progress.textContent=(index+1)+' / '+steps.length+' · '+steps[index][1];previous.disabled=index===0;
   for(const b of nav.querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.step===step?'step':'false');
   if(step==='source'){
    heading('连接一个声音来源','沿用已配好的音源，或填写 Fish API 密钥。保存后再选声音。');
    const provider=select('声音来源',tts('provider')),key=input('Fish API 密钥',control(shadow,'[data-jy-tts-fish="key"]').value,'password'),model=select('Fish 型号','[data-jy-tts-fish="model"]'),proxy=input('经酒馆代理','','checkbox');proxy.checked=control(shadow,'[data-jy-tts-fish="viaProxy"]').checked;
    const fish=[key.parentElement,model.parentElement,proxy.parentElement],sync=()=>fish.forEach(n=>n.hidden=provider.value!=='fish');provider.onchange=sync;sync();
    const d=help('第一次用 Fish？',['创建账号 → 创建 API 密钥 → 粘贴到上方。网页会员与 API 用量分别计费，测试会使用所选服务的 API 用量。']);link('登录 Fish','https://fish.audio/auth/signup',d);link('创建 API 密钥','https://fish.audio/app/api-keys/',d);
    node('p','GPT-SoVITS 沿用镜译中已配置的本地服务；服务地址可在“完整设置”调整。',content);proxyHelp();
    button('保存音源，选择声音',async()=>{const patch=[[tts('provider'),provider.value],[tts('enabled'),true],[tts('speechMarks'),false]];if(provider.value==='fish'){if(!key.value.trim())throw Error('请填写 Fish API 密钥，或选择已有的本地音源。');patch.push(['[data-jy-tts-fish="key"]',key.value.trim()],['[data-jy-tts-fish="model"]',model.value],['[data-jy-tts-fish="viaProxy"]',proxy.checked]);}await save(patch,s=>s.tts?.enabled===true&&s.tts?.provider===provider.value&&s.tts?.speechMarks===false&&(provider.value!=='fish'||s.tts?.fish?.key===key.value.trim()&&s.tts?.fish?.model===model.value&&s.tts?.fish?.viaProxy===proxy.checked));go('voices');},content,'cxx-jy-primary');
    if(api?.tts?.status?.().readReady)button('已有连接，直接点读练习',()=>go('test'),content);
   }else if(step==='voices'){
    heading('选择默认声音','角色已有的专属音色保留。默认声音用于还没有分配音色的角色。');
    const voice=input('Fish 声音链接或编号',control(shadow,tts('dialogueVoice')).value);link('打开声音库试听','https://fish.audio/discovery/');
    button('保存声音，进入练习',async()=>{const id=voiceId(voice.value);await save([[tts('dialogueVoice'),id],[tts('dialogueFallback'),'default']],s=>s.tts?.dialogueVoice===id&&s.tts?.dialogueFallback==='default');go('test');},content,'cxx-jy-primary');button('保留现有声音，进入练习',()=>go('test'),content);help('声音编号是什么？',['打开声音详情后复制网页链接，或复制32位声音编号。密钥不填在这里。','使用 GPT-SoVITS 时，保留现有声音即可；参考音频在镜译完整设置中选择。']);
   }else if(step==='test'){
    heading('点一下台词，听见声音','这是正文点读的操作练习。试听使用当前音源，不写入聊天。');
    const sample=node('div',null,content,'cxx-jy-sample');node('span','试听台词',sample,'cxx-jy-sample-label');node('p','你好，欢迎来到东京都。',sample);const play=button('朗读这句台词',async()=>{if(!has('tts.speak'))throw Error('请更新镜译，以使用角色朗读。');const s=api.tts.status();if(!s.readReady)throw Error(s.readReason||'请先完成音源连接。');played=false;confirm.disabled=true;speech=await api.tts.speak({text:'你好，欢迎来到东京都。',speaker:'',analyze:false,play:true});if(!speech?.done)throw Error('未取得播放结果，请打开完整设置检查音源。');await speech.done;if(!stopped){played=true;confirm.disabled=false;note.textContent='播放结束。听到声音后，确认完成。';}},sample,'cxx-jy-primary');play.setAttribute('aria-label','朗读这句台词');
    const stop=button('停止声音',()=>{},content);stop.onclick=()=>{speech?.stop?.();speech?.cancel?.();};const confirm=button('我已听到，完成练习',()=>{if(played)complete('正文中点击角色台词或心声旁的麦克风即可朗读；Gal 的声音面板还可连续播放。');},content);confirm.disabled=!played;
    help('播放结束但没听到？',['检查设备音量与当前标签页静音状态，再点一次台词。','密钥、额度或网络报错：回到“连接音源”按提示调整。']);proxyHelp();
   }else if(step==='translation'){
    heading('选择想看的语言','使用平时聊天的连接，或选择已保存的连接。');
    const status=api?.reading?.status?.()||{},language=input('目标语言',status.targetLanguage||'日本語'),connection=select('翻译连接','[data-jy-translation-channel]');
    const d=help('自动翻译怎么开？',['本引导保留镜译现有的自动翻译设置。需要自动翻译新回复时，在完整设置中打开对应开关。','首次翻译旧正文：完整设置 → 翻译台 → 核对楼层 → 翻译当前回复。']);
    button('保存，试译一句',async()=>{const lang=language.value.trim();if(!lang)throw Error('请填写目标语言，如 日本語 或 English。');const tags=control(shadow,field('bodyTags')).value.split(/[\s,，]+/).filter(Boolean);if(!tags.includes('cxx-story'))tags.push('cxx-story');await save([[field('bodyTags'),tags.join('\n')],['[data-jy-profile-field="targetLanguage"]',lang],['[data-jy-translation-channel]',connection.value],[field('translationOnly'),false],[tts('speechMarks'),false]],s=>{const p=s.promptProfiles?.find(p=>p.id===s.selectedPromptProfileId)||s.promptProfiles?.[0];return s.bodyTags?.includes('cxx-story')&&!s.translationOnly&&p?.targetLanguage===lang&&s.tts?.speechMarks===false&&(s.apiMode==='independent'?s.selectedChannelId:'follow')===connection.value;});go('translate-test');},content,'cxx-jy-primary');
   }else if(step==='translate-test'){
    heading('让连接真正翻译一次','测试句：雨が降っている。点击试译会使用所选模型的 API 用量。');const result=node('blockquote',translation||'译文将在这里出现。',content,'cxx-jy-result');
    button('试译这句话',async()=>{abort=new win.AbortController();try{const text=await testTranslation(win,shadow,abort.signal);if(!stopped){translation=String(text);result.textContent=translation;next.disabled=false;note.textContent='已收到试译结果。继续练习原文／译文切换。';}}finally{abort=null;}},content,'cxx-jy-primary');const stop=button('停止等待',()=>{},content);stop.onclick=()=>abort?.abort();const next=button('下一步：切换阅读',()=>go('practice'),content);next.disabled=!translation;
   }else if(step==='practice'){
    heading('切换你想看的内容','先在下方练习。正式正文也使用“原文／译文／原译对照”这三个选项。');const modes=node('div',null,content,'cxx-jy-practice-modes'),sample=node('div',null,content,'cxx-jy-sample');node('span','阅读练习 · 测试内容',sample,'cxx-jy-sample-label');const text=node('p','雨が降っている。',sample),done=button('完成，返回游戏',()=>complete('原生正文下方展开“阅读与声音”；Gal 打开声音面板，即可切换。需要翻译当前正文时，使用镜译完整设置中的翻译台。'),content,'cxx-jy-primary');done.disabled=true;
    for(const [id,label]of [['original','原文'],['reading','译文'],['compare','原译对照']]){const b=button(label,()=>{if(id!=='original'&&!translation)throw Error('请先回到“试译一句”完成测试。');text.textContent=id==='original'?'雨が降っている。':id==='reading'?translation:'雨が降っている。\n'+translation;for(const n of modes.children)n.setAttribute('aria-pressed',String(n===b));done.disabled=!translation;note.textContent='已切换为'+label+'。正式正文有可用译文时即可使用。';},modes);b.setAttribute('aria-pressed',String(id==='original'));}
    button('去翻译当前正文',()=>{destroy();control(shadow,'[data-jy-tab="main"]').click();},content);
   }else if(step==='call'){
    heading('先选择通话的连接','通话使用独立的模型连接与流式音源。麦克风留到最后选用。');
    const channel=select('通话模型连接',tts('callChannelId')),voice=select('通话声音来源',tts('streamVoice'));node('p',api?.tts?.status?.().streamReady?'通话声音已具备配置。':api?.tts?.status?.().reason||'请先在声音引导或完整设置中连接通话音源。',content,'cxx-jy-callout');
    button('保存，测试连接',async()=>{await save([[tts('callChannelId'),channel.value],[tts('streamVoice'),voice.value]],s=>(s.tts?.callChannelId||'')===channel.value&&s.tts?.streamVoice===voice.value);testedModel=testedVoice=false;go('call-test');},content,'cxx-jy-primary');
   }else if(step==='call-test'){
    heading('确认能回答，也能出声','两项分别测试，各使用对应服务的 API 用量。测试内容不进入剧情。');
    const model=node('p',testedModel?'模型已返回回答。':'等待测试模型。',content),audio=node('p',testedVoice?'声音播放已结束。':'等待测试声音。',content);
    button('测试通话模型',async()=>{if(!has('llm.stream'))throw Error('请更新镜译，以使用通话模型。');abort=new win.AbortController();try{const text=await api.llm.stream({messages:[{role:'user',content:'请只回复：连接成功。'}],signal:abort.signal});if(!String(text||'').trim())throw Error('模型没有返回文字，请检查通话连接。');if(!stopped){testedModel=true;model.textContent='模型回答：'+String(text).slice(0,200);next.disabled=!testedVoice;}}finally{abort=null;}},content,'cxx-jy-primary');
    button('试听通话声音',async()=>{if(!has('tts.stream')||!api.tts.status().streamReady)throw Error(api.tts.status().reason||'请先配置通话音源。');testedVoice=false;next.disabled=true;speech=api.tts.stream({speaker:''});speech.push('你好，现在可以听见我吗？');speech.end();await speech.done;if(!stopped){testedVoice=true;audio.textContent='播放已结束；请确认实际听到声音。';next.disabled=!testedModel;}},content);
    const stop=button('停止测试',()=>{},content);stop.onclick=()=>{abort?.abort();speech?.cancel?.();};const next=button('已听到声音，继续',()=>{if(testedModel&&testedVoice)go('input');},content);next.disabled=!(testedModel&&testedVoice);
   }else if(step==='input'){
    heading('打字或说话，由你决定','手机中选联系人 → 拨打语音 → 输入文字发送。开麦后，按住说话，松开可编辑识别文字。');const status=api?.stt?.status?.()||{};node('p',status.available?'语音输入已配置。点击下方按钮才会申请麦克风权限。':status.reason||'语音输入尚未配置，可以先打字。',content,'cxx-jy-callout');
    button('测试麦克风',async()=>{if(!has('stt')||!api.stt.status().available)throw Error(api.stt?.status?.().reason||'请在完整设置中选择语音输入服务。');mic=await api.stt.start();if(stopped){mic?.cancel?.();mic=null;return;}note.textContent='正在听。说一句话，再点“结束录音”。';},content);const end=button('结束录音',()=>{},content);end.onclick=async()=>{if(!mic){note.textContent='请先开始麦克风测试。';return;}try{const handle=mic;mic=null;const text=await handle.stop();if(!stopped)note.textContent=text?'识别结果：'+text:'未识别到文字，请检查设备后重试。';}catch(e){if(!stopped)note.textContent=explain(e);}};
    help('麦克风无法打开？',['浏览器地址栏 → 网站权限 → 麦克风 → 允许，再测试。HTTP远程网页请改用HTTPS。','TT 的语音输入按镜译检测结果配置，浏览器语音识别不可用时可选择云端输入。']);
    button(testedModel&&testedVoice?'先用打字，完成引导':'返回游戏，稍后测试',()=>{if(testedModel&&testedVoice)complete('在手机中选择已解锁的联系人，点击“拨打语音”。也可直接发送文字私聊。');else close();},content,'cxx-jy-primary');button('打开手机',()=>{close();win.CxxPhone?.open?.('contacts');},content);
   }
  }
  const guard=e=>{if(critical&&(e.type==='keydown'&&e.key==='Escape'||e.type==='click'&&e.target.closest?.('.jy-close'))){e.preventDefault();e.stopImmediatePropagation();note.textContent='正在保存设置，请稍候。';}};win.addEventListener('keydown',guard,true);shadow.addEventListener('click',guard,true);
  function destroy(){if(stopped)return;stopped=true;abort?.abort();speech?.stop?.();speech?.cancel?.();mic?.cancel?.();win.removeEventListener('keydown',guard,true);shadow.removeEventListener('click',guard,true);style.remove();bar.remove();dialog.classList.remove('cxx-jy-guided');delete dialog.dataset.cxxGuideStep;}
  paint();return {destroy};
 }
 return {mount,applyFields,persisted,voiceId,explain,testTranslation};
});
