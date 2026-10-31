import { createMotion } from '/motion/runtime/motion.mjs';
const mode=new URLSearchParams(location.search).get('page'),errors=[],checks=[];
let low=false,nativeHost=null,released=0,created=0;
const engine=createMotion();window.TavernMotion=engine;window.Cxx236Preferences={read:()=>({level:low?'low':'high'})};
const theme=CxxThemeRuntime.install(window,window,visualStyles.carriers);theme.set(new URLSearchParams(location.search).get('theme')||'red');
const report=status=>parent.postMessage({report:{status,width:innerWidth,theme:theme.read(),checks,errors,motion:engine.diagnostics()}},location.origin);
window.addEventListener('error',event=>{errors.push(event.message);report('页面异常');});window.addEventListener('unhandledrejection',event=>{errors.push(String(event.reason));report('页面异常');});
if(mode==='memory'){
  setupMemory();
  const receipt={id:'request_1',purpose:'compact',actorId:'player',status:'complete',attempts:1,durationMs:1250,usage:{source:'provider',input:1200,output:240}},record={id:'compact_1',viewpointActorId:'player',status:'ready',createdAt:1792383433000,sources:[{messageId:'m1'},{messageId:'m8'}],items:[{kind:'未结事项',text:'钥匙已经交接，但双方约定的回访尚未完成。'},{kind:'传闻',text:'听说仓库明晚停电，还没有得到证实。 <img src=x onerror=alert(1)>'}],measurement:{before:9200,after:1350}};
  const state={retryRevision:0,enabled:true,busy:false,pendingSave:false,requests:{busy:false,records:[receipt]},records:[record],receipts:[receipt],lastRun:{beforeTokens:14500,afterTokens:6650,estimateScope:'history-plus-previous-fixed',finalInputEstimate:10000,budget:{input:24800},projection:{withheldMessages:4,hiddenThoughts:2},notes:['近期六轮完整对话保留。']}};
  window.CxxContextCompression={status:()=>structuredClone(state),allowRetry:async()=>state.retryRevision++,setEnabled:async value=>{state.enabled=value;},exclude:async id=>{state.records.find(row=>row.id===id).status='excluded';},include:async id=>{state.records.find(row=>row.id===id).status='ready';},retrySave:async()=>{state.pendingSave=false;},cancel:()=>{state.requests.busy=false;}};
  window.CxxContextBridge={capabilities:()=>({auxiliary:true})};window.CxxContext={binding:()=>({viewpointActorId:'player'}),index:()=>({rows:[{messageId:'m1',floor:1},{messageId:'m8',floor:8}]})};memory.actors=()=>[{actorId:'player',name:'当前玩家'}];
}else if(mode==='ensemble')setupEnsemble(visualStyles);
else {
  const chat=document.createElement('div');chat.id='chat';chat.innerHTML='<div class="mes" mesid="0"><div class="mes_text"><p>雨停了。她把钥匙收进外套口袋。</p></div></div>';document.getElementById('fixture').append(chat);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#27181e"/><path d="M0 460 200 120 430 330 670 50 960 320V540H0" fill="#71343f"/></svg>',url='data:image/svg+xml,'+encodeURIComponent(svg),message={mes:'<cxx-story>雨停了。她把钥匙收进外套口袋。</cxx-story>',swipe_id:0},context={characters:[{avatar:'fixture.png',name:'测试'}],characterId:0,chat:[message],getCurrentChatId:()=> 'native-visual',eventTypes:{}};
  window.CxxPlot={illustrationsAt:()=>[{id:'one',url,caption:'检查画面一',lineTitle:'来源一'},{id:'two',url,caption:'检查画面二',lineTitle:'来源一'}]};window.CxxResources={acquire:async value=>{created++;return {url:value,release(){released++;}};}};
  nativeHost=CxxNativeHost.mount({window,context:()=>context,subscribe:()=>()=>{},prose:CxxNativeProse,terminalFactory:{create:()=>({close(){},destroy(){}})},css:visualStyles.nativeCSS});
}
const root=()=>document.querySelector('[data-cxx-memory-panel]')?.shadowRoot;
const button=name=>[...root().querySelectorAll('button')].find(node=>node.textContent===name);
const pause=()=>new Promise(resolve=>setTimeout(resolve,520));
const assert=(value,message)=>{if(!value)throw Error(message);};
function bounds(){const element=mode==='memory'?root()?.querySelector('dialog'):document.querySelector('.cxx-ensemble');const rect=element.getBoundingClientRect();assert(rect.left>=-1&&rect.right<=innerWidth+1,'页面超出横向边界');assert(element.scrollWidth<=element.clientWidth+1,'页面内容横向溢出');return {width:innerWidth,rect:{x:rect.x,width:rect.width,height:rect.height},font:getComputedStyle(element).fontSize};}
async function check(withMotion=true){
  if(mode==='native'){
    await Promise.all([...document.querySelectorAll('.cxx-story-figure img')].map(image=>image.decode()));await pause();const figures=[...document.querySelectorAll('.cxx-story-figure')];assert(figures.length===2,'多图未保留');assert(!document.querySelector('.mes_text .cxx-story-illustrations'),'插图嵌套在正文内');assert(document.querySelector('.mes_text').nextElementSibling?.classList.contains('cxx-story-illustrations'),'插图没有紧随正文');
    const frames=figures.map(figure=>{const rect=figure.getBoundingClientRect();assert(rect.right<=innerWidth+1&&rect.left>=-1,'插图越界');return {width:rect.width,padding:getComputedStyle(figure).padding};});
    figures[0].querySelector('button').click();assert(document.querySelector('.cxx-story-viewer[open]'),'插图查看器未打开');document.querySelector('.cxx-story-viewer-close').click();await pause();assert(!document.querySelector('.cxx-story-viewer'),'查看器关闭残留');nativeHost.refresh();assert(created===2,'刷新重复获取图片');nativeHost.destroy();assert(released===2&&!document.querySelector('.cxx-story-illustrations'),'插图清理失败');checks.push({name:'正文后双图、查看器、尺寸与资源清理',frames,created,released,pass:true});report('正文插图检查通过');return;
  }
  if(mode!=='memory'){checks.push({name:'人物表布局',...bounds()});report('人物表布局通过');return;}
  panel.close();window.TavernMotion=withMotion?engine:undefined;document.getElementById('opener').focus();panel.open('记忆');await pause();assert(root().querySelectorAll('[data-memory-id]').length===40,'记忆批量显示异常');
  for(const tab of ['上下文压缩','记忆','剧情','上下文压缩'])button(tab).click();await pause();assert(root().querySelectorAll('main').length===1,'快速切页遗留旧页面');assert(!root().querySelector('main').inert,'当前页面仍被禁用');
  root().querySelector('.context-table summary').click();assert(!root().querySelector('img'),'摘要文本被当成HTML');checks.push({name:withMotion?'C切页与摘要':'无插件切页与摘要',...bounds()});
  button('关闭自动压缩').click();await pause();assert(button('开启自动压缩'),'压缩开关没有回显');button('开启自动压缩').click();await pause();button('停用这份摘要').click();await pause();assert(button('重新使用这份摘要'),'摘要停用没有回显');button('重新使用这份摘要').click();await pause();
  button('关闭').click();panel.open('记忆');await pause();assert(root()?.querySelector('dialog[open]'),'关闭途中重开失败');
  button('关闭').click();await pause();assert(!root(),'关闭遗留面板');assert(engine.diagnostics().scopes===0&&engine.diagnostics().active===0,'关闭遗留动效');assert(document.activeElement.id==='opener','关闭未恢复焦点');
  low=true;panel.open('上下文压缩');assert(engine.diagnostics().active===0,'低动态仍播放');panel.close();low=false;
  for(let i=0;i<12;i++){panel.open(i%2?'记忆':'上下文压缩');panel.close();}await pause();assert(engine.diagnostics().scopes===0&&engine.diagnostics().active===0,'反复开关没有清理');
  window.TavernMotion=engine;panel.open('上下文压缩');await pause();checks.push({name:'开关、摘要采用、反向开合、焦点、低动态、12次关闭',pass:true});report('检查通过');
}
window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==parent)return;
  try{const {action}=event.data;if(action==='theme'){theme.set(event.data.theme);report('主题已切换');}
    else if(action==='check'||action==='fallback')await check(action==='check');
    else if(action==='close'){panel?.close();report('已关闭');}
    else if(mode==='memory'){panel.open(action==='compression'?'上下文压缩':'记忆');report('页面已打开');}
  }catch(error){errors.push(error.stack||error.message);report('检查失败');}
});
report('准备就绪');
