/**
 * 网页独立版前端：三种运行方式共用这一套界面。
 *
 * 运行方式只改注入的端口：
 *   public  → 本站会话 + `/api/play/connect` 转发 + IndexedDB
 *   local   → 免登录，本机受限适配器直连上游 + IndexedDB
 *   tavern  → 宿主提供聊天/存档/模型（页面只做渲染）
 *
 * 生成中只显示候选，提交成功才落盘（蓝图 §5.1）；提交失败保留候选与原 operationId 供重试。
 */

import { CHAT_SOURCES, TEXT_SOURCES, EXTRA_MAIN_SOURCES, FAMILY_KEYS } from '../src/models/registry.mjs';
import { appUrl } from '../src/platform/paths.mjs';
import { loadJsonWithRetry, loaderSummary, loaderLine } from '../src/platform/loader.mjs';
import { mountCreation,prepareCreation } from '../src/ui/creation.mjs';
import {mountGameSetup} from '../src/ui/game-setup.mjs';
import {installedGameSetup} from '../src/gameplay/game-setup-catalog.mjs';
import {mountWeb,createWebAdapter,mountWebSettings} from '../opening-ui/index.mjs';
import {mountReadingShell} from '../opening-ui/reading-shell.mjs';
import { newId } from '../src/core/ids.mjs';
import { createIdbStatePort } from '../src/store/idb.mjs';
import { createTavernStatePort } from '../src/store/tavern.mjs';
import { parseReply,normalizeThinkingTags } from '../src/app/parse.mjs';
import {buildRequest} from '../src/models/adapters.mjs';
import {connectionCredential} from '../src/models/connections.mjs';
import {mountModelConnection} from '../src/ui/model-connection.mjs';
import {pendingOpening} from '../src/app/opening.mjs';
import {updatePlan} from '../src/app/migration.mjs';
import {mountSaveUpdate} from '../src/ui/save-update.mjs';
import { createRulesEngine } from '../src/rules/engine.mjs';
import { loadCardChainInBrowser } from '../src/reuse/browser-chain.mjs';
import { createWebSession } from '../src/app/session.mjs';
import { createRelayModelPort, createDirectModelPort, createTavernModelPort, ModelError } from '../src/models/port.mjs';
import { createSiteLogin, createSessionTokenStore } from '../src/models/login.mjs';
import {createAssetPort} from '../src/assets/port.mjs';
import {prepareOfficialMedia} from '../src/assets/prepare.mjs';
import {loadPackCatalog,readPackQuality,savePackQuality} from '../src/assets/pack-state.mjs';
import {choosePackQuality} from '../src/ui/pack-choice.mjs';
import {mountPackManager} from '../src/ui/pack-manager.mjs';
import {prepareDatabase,attachDatabase} from '../src/database/runtime.mjs';
import {loadFoundation} from '../src/ui/source.mjs';
import {mountGameplay,prepareGameplay} from '../src/ui/gameplay.mjs';
import {mountSessionSettings} from '../src/ui/settings.mjs';
import {mountSessionContent} from '../src/ui/content.mjs';
import {mountReplyControls} from '../src/ui/candidates.mjs';
import {mountStoryArchive} from '../src/ui/archive.mjs';
import {createTemporaryBackup} from '../src/store/temporary-backup.mjs';
import {openTemporaryTransfer} from '../src/ui/temporary-transfer.mjs';
import {mountApplicationControls} from '../src/platform/application.mjs';
import {mountPromptInspector} from '../src/context/inspector.mjs';
import {loadKnowledgeBrowser} from '../src/context/knowledge-load.mjs';
import {mountSaveControls} from '../src/ui/saves.mjs';

const els = {
  body: document.body,
  themeBtn: document.getElementById('theme-btn'),
  drawer: document.getElementById('drawer'),
  drawerBtn: document.getElementById('drawer-btn'),
  drawerClose: document.getElementById('drawer-close'),
  stage: document.getElementById('stage-lines'),
  sceneLine: document.getElementById('scene-line'),
  choices: document.getElementById('choices'),
  aux: document.getElementById('aux'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  regen: document.getElementById('regen'),
  continueBtn: document.getElementById('continue'),
  stop: document.getElementById('stop'),
  status: document.getElementById('status-line'),
  modelForm: document.getElementById('model-form'),
  genInfo: document.getElementById('gen-info'),
  memoryBox: document.getElementById('memory-box'),
};

const settings = {
  thinking: 'default',
  adapter: 'chat:openai',
  baseUrl: '',
  model: '',
  apiKey: '',
  theme: 'red',
  connection: 'default',
  rememberKey: false,
};
let bootSequence=0,startSequence=0,modelConnection,connectionSettingsScope=null;
const storyDrafts=new Map(),draftScope=(accountId,runId)=>state.mode+':'+accountId+':'+runId;

let state = {
  mode: 'public',
  booted: false,
  session: null,
  chain: null,
  card: null,
  preset: null,
  tokenStore: null,
  abort: null,
  lastParsed: null,
  db: null,
  busy: false,
  stopRequested: false,
  creation: null,
  accountId: null,
  manifest: null,
  packCatalog: null,
  packQuality: 'standard',
  packInfo: null,
  packUI: null,
  release: null,
  hostIdentity: null,
  phase: 'boot',
};

function setStatus(text, tone = '') {
  els.status.textContent = text;
  els.status.dataset.tone = tone;
  settingsSurface.status(text,tone);
}


function themeApply(name) {
  settings.theme = name;
  els.body.dataset.theme = name;
  globalThis.CxxTheme?.set(name);
  els.themeBtn.textContent = { red: '红', yellow: '黄', night: '夜' }[name] || '红';
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- 渲染 ---------------- */

function renderParsed(parsed, { streaming = false } = {}) {
  if(state.ui)return;
  els.stage.innerHTML = '';
  if (!parsed || !parsed.display) {
    els.sceneLine.textContent = '';
    return;
  }
  const { paragraphs = [], scene } = parsed.display;
  if (scene && scene.location) {
    els.sceneLine.textContent = `${scene.location}${scene.time ? ` · ${scene.time}` : ''}`;
  } else {
    els.sceneLine.textContent = '';
  }
  for (const para of paragraphs) {
    if (!para || !String(para.text || '').trim()) continue;
    const isSay = para.characterId && para.text.includes('「');
    const div = document.createElement('div');
    div.className = `line ${isSay ? 'say' : 'narration'}`;
    if (isSay) {
      div.innerHTML = `<span class="who">${escapeHtml(para.speaker || para.characterId)}</span><span class="what">${escapeHtml(para.text)}</span>`;
    } else {
      div.textContent = para.text;
    }
    if (streaming) div.classList.add('streaming');
    els.stage.appendChild(div);
  }
  renderAux(parsed.display?.auxiliary||parsed.auxiliary);
}

function renderAux(auxiliary) {
  els.aux.innerHTML = '';
  if (!auxiliary || !auxiliary.length) return;
  for (const item of auxiliary) {
    if (!item || !String(item.body || '').trim()) continue;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = item.label || '更多';
    const body = document.createElement('div');
    body.className = 'aux-body';
    body.textContent = item.body;
    details.append(summary, body);
    els.aux.appendChild(details);
  }
}

function renderChoices(choices) {
  els.choices.innerHTML = '';
  if (!choices || !choices.length) return;
  choices.forEach((choice, index) => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.innerHTML = `<span class="idx">${index + 1}</span>${escapeHtml(choice)}`;
    btn.addEventListener('click', () => {
      els.input.value = choice;
      els.input.focus();
    });
    els.choices.appendChild(btn);
  });
}

function renderStream(text) {
  if(state.ui)return;
  // 流式阶段只显示原始文本（协议块还没闭合，解析必然是半成品）。
  els.stage.innerHTML = '';
  const safe=normalizeThinkingTags(text).replace(/<(think|thinking|konatan_planning~)(?:\s[^>]*)?>[\s\S]*?(?:<\/\1\s*>|$)/gi,'');
  const start=/<cxx-story\s*>/i.exec(safe),body=start?safe.slice(start.index+start[0].length).split(/<\/cxx-story\s*>|<(?:UpdateVariable|ztl|xuan)\b/i)[0]:'';
  const visible=body.replace(/<[^>]*>/g,'').replace(/<[^>]*$/,'');
  els.sceneLine.textContent = '生成中';
  const div = document.createElement('div');
  div.className = 'line narration streaming';
  div.textContent = visible.slice(-1600) || '…';
  els.stage.appendChild(div);
  els.aux.innerHTML = '';
}

/* ---------------- 端口装配 ---------------- */

function controllerFor() {
  try {
    return new AbortController();
  } catch {
    return null;
  }
}

function buildModelPort() {
  const direct=createDirectModelPort({localNetwork:true});
  if(state.mode==='tavern'){const host=createTavernModelPort({host:state.host}),selected=payload=>payload.connection==='lan'?direct:host;return {...Object.fromEntries(['models','chat','embeddings','rerank','tokenize','tokenCounter'].map(operation=>[operation,(payload,options)=>selected(payload)[operation](payload,options)])),parameters:payload=>selected(payload).parameters?.(payload)||[]};}
  const relay=createRelayModelPort({local:state.mode==='local',token:()=>state.mode==='public'?state.tokenStore.get():'',
    headers:state.mode==='local'?async()=>{const response=await fetch('/api/local/session',{cache:'no-store',credentials:'omit'});if(!response.ok)throw new ModelError('local_unavailable','本机连接服务尚未就绪');return {'x-cxx-local-token':(await response.json()).token};}:undefined});
  const selected=payload=>(['lan','default'].includes(payload.connection)?payload.connection:settings.connection)==='lan'?direct:relay;
  return {...Object.fromEntries(['models','chat','embeddings','rerank','tokenize','tokenCounter'].map(operation=>[operation,(payload,options)=>selected(payload)[operation](payload,options)])),parameters:payload=>selected(payload).parameters(payload)};
}
function modelConfig() {
  return {
    adapter: settings.adapter,
    baseUrl: settings.baseUrl,
    model: settings.model,
    credential: connectionCredential(settings),
    provider:settings.provider||{},
    family: settings.adapter,
    connection:settings.connection,
    ...(settings.thinking==='on'?{include_reasoning:true}:settings.thinking==='off'?{include_reasoning:false}:{}),
  };
}

async function ensureLocalIdentity() {
  const KEY = 'cxx2051:local-account';
  let id = '';
  try {
    id = localStorage.getItem(KEY) || '';
    if (!id) {
      id = `local-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem(KEY, id);
    }
  } catch {
    id = 'local-anonymous';
  }
  return id;
}

/* ---------------- 启动 ---------------- */

const loadRows = [];
/** U11: one retry on a failed data read, and every attempt stays visible in 本局信息. */
async function loadJson(url) {
  return loadJsonWithRetry(url, { record: loadRows });
}

/** 这一页到底是什么版本：酒馆接入时问扩展要身份自检，独立运行时读发布回执。 */
async function loadReleaseIdentity(){
  const host=globalThis.parent!==globalThis?globalThis.parent.Cxx2051WebExtension:null;
  if(host){
    try{state.hostIdentity=await host.verify?.()??host.identity??null;}catch{state.hostIdentity=host.identity??null;}
    if(state.hostIdentity?.buildId)state.release={buildId:state.hostIdentity.buildId,engineVersion:state.hostIdentity.engineVersion,contentVersion:state.hostIdentity.contentVersion};
    return;
  }
  try{const manifest=await loadJson('./release-manifest.json');state.release={buildId:manifest.buildId,engineVersion:manifest.engineVersion,contentVersion:manifest.contentVersion};}catch{}
}

async function localLauncherAvailable(){
  if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname.toLowerCase()))return false;
  try{const response=await fetch('/api/local/session',{cache:'no-store',credentials:'omit',redirect:'error'});if(!response.ok)return false;const session=await response.json();return session.mode==='local'&&typeof session.token==='string'&&/^[a-f0-9]{64}$/.test(session.token);}catch{return false;}
}

let bootFlight=null;
const BOOT_RESTART=Symbol('boot-restart');
async function prepareMedia(onProgress,options){
  try{for(;;){
    const controller=new AbortController();openingPage.resourceAction('暂停下载',()=>controller.abort());
    try{return await prepareOfficialMedia(onProgress,{...options,signal:controller.signal});}
    catch(error){if(error.name!=='AbortError')throw error;openingPage.progress({text:'下载已暂停',detail:'已保存的资源会在继续时复用'});await new Promise(resolve=>openingPage.resourceAction('继续下载',resolve));}
  }}finally{openingPage.resourceAction('',null);}
}
async function boot(){
  // 面板可能被“扩展自动打开 + 用户点击”或宿主重绘同时触发两次；两次并发 boot 会各自整份回读酒馆存档，
  // 大存档下直接把启动拖成分钟级。这里同一时刻只保留一次，后来者复用同一结果。
  if(bootFlight)return bootFlight;
  bootFlight=(async()=>{while(await runBoot()===BOOT_RESTART){} })().finally(()=>{bootFlight=null;});
  return bootFlight;
}
async function runBoot() {
  const sequence=++bootSequence;
  // Remaining tasks: three data files, knowledge, UI foundation, identity,
  // session preparation, and opening-page handoff; decorative image decoding runs separately.
  let ruleCount=0,completedRules=0,completedResources=0,mediaProgress=0;
  const resourceProgress=(count,text,detail='')=>{completedResources+=count;openingPage.progress({fraction:(completedRules+completedResources+120*mediaProgress)/(ruleCount+132),text,detail});};
  const params = new URLSearchParams(location.search);
  const requestedMode=params.get('mode')||document.documentElement.dataset.mode||'public';
  const mode=requestedMode==='local'&&!await localLauncherAvailable()?'public':requestedMode;
  if(sequence!==bootSequence)return;
  state.mode=mode;
  if(state.mode==='tavern'){els.modelForm.hidden=true;document.getElementById('new-run').hidden=true;}
  // 允许用地址参数覆盖模型配置：本地启动器与验收脚本都靠它，避免手填表单。
  if (params.get('adapter')) settings.adapter = params.get('adapter');
  if (params.get('baseUrl')) settings.baseUrl = params.get('baseUrl');
  if (params.get('model')) settings.model = params.get('model');
  themeApply(globalThis.CxxTheme?.read()||settings.theme);
  state.phase='identity:loading';
  const dataReady=Promise.all([loadJson(appUrl('data/card.json')),loadJson(appUrl('data/presets.json')),loadJson(appUrl('data/manifest.json')),loadKnowledgeBrowser(appUrl('data/')),state.mode==='tavern'?null:loadPackCatalog()]);dataReady.catch(()=>{});
  await loadReleaseIdentity();
  state.phase='identity:done';
  setStatus('正在装载卡内规则链…');

  if(state.mode==='public')await loadSiteUser();
  if(sequence!==bootSequence)return;
  state.tokenStore = createSessionTokenStore(safeStorage());

  try {
    state.chain = await loadCardChainInBrowser({ baseUrl: appUrl('card/'), onProgress: (p) => {ruleCount=p.total;completedRules=p.index;const fraction=(p.index+completedResources+120*mediaProgress)/(p.total+132);const detail=`${p.index} / ${p.total} 条规则`;setStatus('正在准备游玩… '+Math.round(fraction*100)+'%');openingPage.progress({fraction,text:'正在准备游戏资源',detail});} });
  } catch (error) {
    setStatus(`卡内规则链装载失败：${error.message}`, 'error');
    throw error;
  }

  const [card,presets,manifest,knowledge,packCatalog]=await dataReady;
  if(sequence!==bootSequence)return;
  resourceProgress(3,'正在准备故事与资源目录');
  state.manifest = manifest;
  state.card = card;
  state.knowledge=knowledge;
  resourceProgress(1,'正在准备故事资料');
  state.phase=state.knowledge?.status==='ok'?'knowledge:ok':'knowledge:'+(state.knowledge?.status||'missing');
  state.chain.policy={...(state.chain.policy||{}),mapIndex:card.runtimePolicy.mapIndex};
  state.presets=presets;state.preset=presets.find(row=>row.id==='izumi').preset;
  if(state.mode!=='tavern'){
    state.packCatalog=packCatalog;
    state.packQuality=readPackQuality(state.packCatalog)||await choosePackQuality({catalog:state.packCatalog});
  }else state.packQuality='original';
  if(state.mode!=='tavern')savePackQuality(state.packQuality);
  if(state.mode!=='tavern'&&state.packCatalog){
    state.packUI?.destroy();
    state.packUI=mountPackManager({parent:document.getElementById('pack-controls'),catalog:state.packCatalog,quality:state.packQuality,onChange:key=>{savePackQuality(key);location.reload();},onError:error=>setStatus(error.message,'error')});
  }
  if(!state.foundation){state.assets=createAssetPort({manifest,quality:state.packQuality});state.foundation=await loadFoundation({assets:state.assets,onTheme:()=>{const name=globalThis.CxxTheme?.read()||'red';settings.theme=name;els.body.dataset.theme=name;els.themeBtn.textContent={red:'红',yellow:'黄',night:'夜'}[name];}});themeApply(state.foundation.theme.read());const nativeCSS=globalThis.CxxWebUIData?.native?.css;if(nativeCSS){const style=document.createElement('style');style.dataset.cxxSource='native-bubbles';style.textContent=nativeCSS;document.head.append(style);}}

  resourceProgress(1,'正在准备游戏界面');
  if(state.mode==='tavern')mediaProgress=1;else try{state.packInfo=await prepareMedia(value=>{mediaProgress=value.fraction;const mega=n=>(Number(n||0)/1048576).toFixed(0),percent=Math.round((value.fraction||0)*100);let text='本机资源已就绪',detail='';if(value.stage==='download'){text='正在下载'+(value.label||'资源包');detail=mega(value.loaded)+' / '+mega(value.total)+' MB · '+percent+'%';}else if(value.stage==='install'){text='正在保存本机资源';detail=(value.loaded||0)+' / '+(value.total||0)+' 项';}else if(value.stage==='adopt'){text='正在核对本机旧资源';detail=(value.checked||value.loaded||0)+' / '+(value.total||0)+' 项';}else if(value.stage==='layer'){text='正在装载'+(value.layerLabel||value.label||'本机资源');detail='第 '+(value.layerIndex||1)+' / '+(value.layerCount||1)+' 层';}else if(value.stage==='retry'){text='资源包连接中断';detail=Math.round((value.delay||0)/1000)+' 秒后第 '+(value.attempt||1)+' 次续传（进度已保存在本机）';}openingPage.progress({fraction:(completedRules+completedResources+120*mediaProgress)/(ruleCount+132),text,detail});},{quality:state.packQuality,catalog:state.packCatalog});savePackQuality(state.packQuality);await state.packUI?.refresh();}catch(error){savePackQuality('');throw error;}
  resourceProgress(1,state.mode==='tavern'?'原宿主资源已连接':state.packQuality==='original'?'原画质资源已存到本机':'标准画质资源已存到本机');
  await Promise.all([prepareCreation(),prepareGameplay(),...(state.mode==='tavern'?[]:[prepareDatabase()])]);
  resourceProgress(1,'数据库组件已准备');
  resourceProgress(2,'建角与阅读界面已准备');
  let accountId='';
  if(state.mode==='public'){
    const requestedToken=state.tokenStore.get();
    const account=await CXXUser.check();
    if(sequence!==bootSequence)return;
    if(requestedToken!==state.tokenStore.get())return BOOT_RESTART;
    if(!account?.publisherId){document.getElementById('login-btn').hidden=false;document.getElementById('logout-btn').hidden=true;readingSurface.hide();openingPage.show();resourceProgress(2,'正在准备登录入口');setStatus('登录后开始或继续故事。','warn');return;}
    accountId=account.publisherId;
    document.getElementById('login-btn').hidden=true;document.getElementById('logout-btn').hidden=false;
  }else if(state.mode==='local')accountId=await ensureLocalIdentity();
  else {state.host=globalThis.parent!==globalThis&&globalThis.parent.Cxx2051WebHost;if(!state.host)throw new Error('请从酒馆扩展打开此界面');state.host.assertScope();accountId=state.host.accountId;}
  resourceProgress(1,'正在准备当前身份');
  state.accountId=accountId;loadSettings();
  if(params.get('adapter'))settings.adapter=params.get('adapter');
  if(params.get('baseUrl'))settings.baseUrl=params.get('baseUrl');
  if(params.get('model'))settings.model=params.get('model');
  if(params.get('connection')==='lan')settings.connection='lan';
  syncModelForm();
  await startSession({ accountId, fromOpening:false });
  resourceProgress(1,'正在准备画面与字体');
}

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function connectionKey(){return 'cxx2051:connection:'+state.mode+':'+state.accountId;}
function syncModelForm(){
  for(const name of ['adapter','baseUrl','model','apiKey','connection','thinking']){const field=els.modelForm.elements.namedItem(name);if(field)field.value=settings[name]||'';}
  els.modelForm.elements.namedItem('rememberKey').checked=settings.rememberKey;modelConnection?.sync(settings);
}
async function persistSettings(){
  const {adapter,baseUrl,model,connection,rememberKey,apiKey,serviceAccount,provider,thinking}=settings;
  const storage=safeStorage();if(!storage)throw new Error('此浏览器暂时不能保存设置');
  storage.setItem(connectionKey(),JSON.stringify({adapter,baseUrl,model,connection,provider,rememberKey,thinking,...(rememberKey?{apiKey,serviceAccount}:{})}));
  if(apiKey)sessionStorage.setItem(connectionKey()+':key',apiKey);else sessionStorage.removeItem(connectionKey()+':key');sessionStorage.removeItem(connectionKey()+':service-account');
  if(serviceAccount)sessionStorage.setItem(connectionKey()+':service-account',serviceAccount);else sessionStorage.removeItem(connectionKey()+':service-account');
}
function loadSettings(){
  const scope=connectionKey();if(connectionSettingsScope===scope)return;connectionSettingsScope=scope;
  Object.assign(settings,{adapter:'chat:openai',baseUrl:'',model:'',apiKey:'',serviceAccount:'',provider:{},rememberKey:false,connection:'default',thinking:'default'});
  try{const saved=JSON.parse(safeStorage()?.getItem(connectionKey())||'{}');for(const name of ['adapter','baseUrl','model','connection','provider'])if(saved[name])settings[name]=saved[name];settings.thinking=['on','off'].includes(saved.thinking)?saved.thinking:'default';settings.serviceAccount=sessionStorage.getItem(connectionKey()+':service-account')||(saved.rememberKey?saved.serviceAccount||'':'');settings.rememberKey=saved.rememberKey===true;settings.apiKey=sessionStorage.getItem(connectionKey()+':key')||(settings.rememberKey?saved.apiKey||'':'');}catch{}
}
let siteUserPromise;
function loadSiteUser(){
  if(globalThis.CXXUser?.accountVersion==='site-accounts/1')return Promise.resolve();
  return siteUserPromise||(siteUserPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=appUrl('user.js');script.onload=resolve;script.onerror=()=>reject(new Error('站点登录组件读取失败'));document.head.append(script);}));
}
async function doLogin() {
  const login = createSiteLogin();
  try {
    setStatus('请选择网站账号或 Discord 登录。');
    const result = await login.login({ onWaiting: () => setStatus('等待登录完成…') });
    state.tokenStore.set(result.token, result);
    setStatus('登录完成，正在进入东京都。', 'ok');
    await boot();
  } catch (error) {
    if (error.code === 'oauth_not_configured') {
      setStatus('本站未配置 Discord 登录；可先用「本地独立」模式进入。', 'warn');
    } else {
      setStatus(`登录失败：${error.message}`, 'warn');
    }
  }
}

/** 旧存档热更提醒：restore 后对比存档版本与当前内容版本，进入游戏前弹窗由玩家决定（issue #28）。 */
async function maybeOfferSaveUpdate(){
 try{
  if(state.mode==='tavern'||!state.manifest?.contentVersion||!state.session)return;
  const run=await state.statePort.readRun?.(state.session.identity.runId);
  const plan=updatePlan({from:run?.contentVersion,to:state.manifest.contentVersion});
  if(!plan)return;
  state.saveUpdateUI?.close?.();
  let updated=false;
  await new Promise(resolve=>{
   state.saveUpdateUI=mountSaveUpdate({
    from:plan.from,to:plan.to,highlights:plan.highlights,steps:plan.steps,
    brandUrl:document.querySelector('.game-wordmark')?.src,
    onUpdate:async()=>{await state.session.applySaveUpdate({to:state.manifest.contentVersion});updated=true;},
    onSkip:()=>{state.saveUpdateUI=null;resolve();},
    onEnter:()=>{state.saveUpdateUI=null;resolve();},
   });
  });
  if(updated)setStatus('存档已更新到 '+plan.to+'（已自动备份）。','ok');
 }catch{/* 版本提醒是附加能力；读取失败时按无更新处理，不打断开局 */ return;}
}

async function startSession({ accountId, runId, fromOpening=true }) {
  const mark=step=>{state.phase=step;try{(globalThis.__cxxBootMark??=[]).push([Date.now(),step]);if(globalThis.__cxxBootMark.length>80)globalThis.__cxxBootMark.shift();}catch{}};
  mark('session:start');
  if(state.mode==='public'&&(!state.tokenStore?.get()||!accountId||globalThis.CXXUser?.current()?.publisherId!==accountId)){setStatus('请登录后进入故事。','warn');return;}
  const sequence=++startSequence;
  if(state.session)storyDrafts.set(draftScope(state.session.identity.accountId,state.session.identity.runId),els.input.value);
  els.input.value=storyDrafts.get(draftScope(accountId,runId))||'';
  state.booted=false;
  state.abort?.abort();state.abort=null;state.busy=false;
  els.send.disabled=true;els.regen.disabled=true;els.continueBtn.disabled=true;
  setStatus('正在打开故事…');
  state.session?.dispose();
  state.creation?.destroy();
  state.gameSetupView?.destroy();state.gameSetupView=null;
  state.ui?.destroy();state.ui=null;state.settingsUI?.destroy();state.settingsUI=null;state.savesUI?.destroy();state.savesUI=null;state.replyUI?.destroy();state.replyUI=null;state.applicationUI?.destroy();state.applicationUI=null;state.promptUI?.destroy();state.promptUI=null;
  state.saveUpdateUI?.close?.();state.saveUpdateUI=null;
  state.creation=null;
  state.contentUI?.destroy();state.contentUI=null;
  await state.statePort?.close();
  if(sequence!==startSequence)return;
  state.accountId=accountId;
  const lastRunKey='cxx2051:last-run:'+state.mode+':'+accountId;
  runId=state.mode==='tavern'?state.host.runId:runId||safeStorage()?.getItem(lastRunKey)||'run-'+accountId;
  loadSettings();
  // Query configuration is a test/user convenience; credentials are never read from URLs.
  const query=new URLSearchParams(location.search);
  for(const key of ['adapter','baseUrl','model'])if(query.get(key))settings[key]=query.get(key);
  if(query.get('connection')==='lan')settings.connection='lan';
  syncModelForm();
  mark('port:create-begin');
  let statePort = state.mode==='tavern'?await createTavernStatePort({host:state.host,accountId,runId,deferReconcile:true,parser:state.chain.parser,parse:raw=>parseReply(raw,{parser:state.chain.parser}),rules:createRulesEngine({chain:state.chain})}):createIdbStatePort({ factory: globalThis.indexedDB, lockManager: globalThis.navigator?.locks, accountId });
  state.database=null;
  if(state.mode!=='tavern'){const attached=await attachDatabase({statePort,runId,accountId,parser:state.chain.parser});statePort=attached.port;state.database=attached.database;globalThis.AutoCardUpdaterAPI=state.database.api;}
  mark('port:create-done');
  state.statePort = statePort;
  if(state.mode==='public'){
    if(state.temporaryAccount!==accountId){state.temporary?.destroy();const backupPort=createIdbStatePort({factory:globalThis.indexedDB,accountId});state.temporaryAccount=accountId;state.temporary=createTemporaryBackup({token:()=>state.tokenStore.get(),exportSnapshot:async id=>(await backupPort.readHead(id)).headNodeId?backupPort.exportRun(id):null,closeSnapshot:()=>backupPort.close(),changed:value=>{window.dispatchEvent(new CustomEvent('cxx-temporary-save-changed',{detail:value}));const button=document.getElementById('backup-btn');button.title=value.phase==='failed'?'临时上传失败：'+value.error:value.phase==='ready'?'临时续玩备份已更新':'本地完整备份';}});}
    state.temporary.observe(statePort);
  }
  const modelPort = buildModelPort({ token: state.tokenStore.get() });

  const preferenceKey='cxx2051:prompt:'+state.mode+':'+accountId+':'+runId;let promptPreferences={};try{promptPreferences=JSON.parse(safeStorage()?.getItem(preferenceKey)||'{}');}catch{}
  let selectedPreset={id:'izumi',preset:state.preset};if(promptPreferences.presetId){const list=state.presets;selectedPreset=list.find(row=>row.id===promptPreferences.presetId)||selectedPreset;}
  const gameSetup=installedGameSetup(state.chain);
  state.session = createWebSession({
    mode: state.mode,
    accountId,
    runId,
    contentVersion:state.manifest?.contentVersion,
    engineVersion:state.manifest?.engineVersion,promptVersion:state.manifest?.promptVersion,
    ports: { state: statePort, model: modelPort,...(state.database?{database:state.database}:{}), ...(state.mode==='tavern'&&state.host?.worldbook?{worldbook: state.host.worldbook, worldbookBooks: ()=>state.host.hostBooks?.()??[],worldInfoSettings:()=>state.host.worldInfoSettings?.()??{}}:{}) },
    chain: state.chain,
    gameSetup,
    preset: selectedPreset.preset,presetId:selectedPreset.id,promptOptions:promptPreferences.promptOptions,
    card: state.card,
    catalog: state.knowledge?.status==='ok'?state.knowledge.index:null,
    model: modelConfig(),
  });

  state.database?.connect(state.session);
  mark('restore:begin');
  const restored=await state.session.restore();
  mark('restore:done');
  if(sequence!==startSequence)return;
  // 存档热更弹窗是进入游戏前的一道闸：更新或暂不之后才继续装配界面。
  await maybeOfferSaveUpdate();
  state.savesUI=mountSaveControls({parent:document.getElementById('save-controls'),session:state.session,statePort,accountId,mode:state.mode,onSwitch:runId=>startSession({accountId,runId}),onError:error=>setStatus(error.message,'error')});
  if(state.mode!=='tavern')safeStorage()?.setItem(lastRunKey,runId);
  mark('head:begin');
  const head = await statePort.readHead(state.session.identity.runId);
  mark('head:done');
  if(!fromOpening)return;
  settingsSurface.close();
  mark('lineage:begin'+(restored.nodes?'-cached':''));
  const lineage=restored.nodes||await statePort.readLineage(runId);
  mark('lineage:done:'+(lineage?.length??'?'));
  const node=restored.narrativeNode||[...lineage].reverse().find(n=>n.message?.kind!=='program'&&n.message?.raw)||null;
  globalThis.CxxWebModels={creator:async payload=>(await state.session.generatePurpose('creator',{messages:payload.ordered_prompts||payload.messages||[],signal:payload.signal})).text};
  if (head.headNodeId) {
    state.lastParsed=node?state.session.projectParsed(parseReply(node.message.raw,{parser:state.chain.parser})):null;
    renderParsed(state.lastParsed);
    renderChoices(state.lastParsed?.display?.choices || []);
    if(!node){els.stage.replaceChildren();const notice=document.createElement('p');notice.textContent='已恢复保存的状态，原档没有可读正文。人物与路线保留，可以继续行动。';els.stage.append(notice);}
  } else {
    state.booted=false;
    els.send.disabled=true;els.regen.disabled=true;els.continueBtn.disabled=true;
    document.querySelector('.composer').hidden=true;
    document.body.classList.add('creating');
    const session=state.session,setup=gameSetup,target=openingPage.creationTarget(),drafts=await statePort.listRecords('drafts',runId);let setupDraft=drafts.find(row=>row.id==='game-setup')?.value||session.gameSetupBinding||setup.draft();
    const saveDraft=value=>{setupDraft=structuredClone(value);return statePort.putRecords('drafts',runId,[{id:'game-setup',kind:'game-setup',value:setupDraft}]);};
    const openCreator=async binding=>{const previous=state.gameSetupView,view=await mountCreation({parent:target,session,statePort,gameSetup:binding,onSetup:()=>{void showSetup().catch(error=>setStatus(error.message,'error'));},contentVersion:state.manifest?.contentVersion,isCurrent:()=>sequence===startSequence,onError:error=>setStatus(error.message,'error'),onComplete:async({handoff})=>{if(sequence!==startSequence)return;await openingPage.transition(async()=>{await handoff();state.creation=null;await startSession({accountId,runId});});}});if(sequence!==startSequence){view.destroy();return;}previous?.destroy();state.gameSetupView=null;state.creation=view;setStatus('创建人物');};
    async function showSetup(){if(sequence!==startSequence)return;state.creation?.destroy();state.creation=null;state.gameSetupView?.destroy();target.replaceChildren();setStatus('新故事设置');state.gameSetupView=mountGameSetup({parent:target,setup,value:setupDraft,onChange:value=>{void saveDraft(value).catch(error=>setStatus(error.message,'error'));},onCancel:()=>{state.gameSetupView?.destroy();state.gameSetupView=null;openingPage.show();},onError:error=>setStatus(error.message,'error'),onContinue:async(binding,draft)=>{await saveDraft(draft);await session.bindGameSetup(binding);if(sequence!==startSequence)return;await openCreator(binding);}});await state.gameSetupView.ready;}
    await showSetup();
    return;
  }
  document.querySelector('.composer').hidden=false;
  document.body.classList.remove('creating');
  setStatus('正在准备阅读与终端界面…');
  state.ui=await mountGameplay({session:state.session,statePort,database:state.database,card:state.card,host:state.host,assets:state.assets,foundation:state.foundation,stage:els.stage,composer:document.querySelector('.composer'),input:els.input,send:sendTurn,stop:()=>{state.stopRequested=true;state.abort?.abort();state.session.cancel();},regenerate:nodeId=>sendTurn('',{regenerate:true,nodeId}),status:setStatus,busy:()=>state.busy,openSettings:()=>settingsSurface.open('play'),onEdited:async()=>{await state.ui.update();await refreshSaves();},deleteBody:nodeId=>deleteFloor(nodeId),openStories:()=>{settingsSurface.close();return openingPage.openStories();},savePoint:()=>document.getElementById('checkpoint').click(),backupStory:()=>exportCurrentStory(),temporary:state.mode==='public'?temporaryTransfer:null,openMainMenu:()=>openingPage.show(),openWorkshop:()=>window.open(state.mode==='public'?'/workshop.html':'https://cyber2051.top/workshop.html','_blank','noopener')});
  els.aux.replaceChildren();
  if(sequence!==startSequence){state.ui?.destroy();return;}state.replyUI=mountReplyControls({parent:document.getElementById('reply-controls'),session:state.session,statePort,busy:()=>state.busy,onBusy:value=>{state.busy=value;els.stop.disabled=!value;els.send.disabled=value;els.regen.disabled=value||!canRegenerate();els.continueBtn.disabled=value||!state.session.narrativeNode;},onCommitted:async()=>{await state.ui.update();await refreshSaves();setStatus('正文已校验保存，旧路线保留。','ok');},onError:error=>setStatus(error.message,'error')});
  state.settingsUI=await mountSessionSettings({parent:document.getElementById('session-settings'),memoryParent:els.memoryBox,session:state.session,presets:state.presets,onSettings:async value=>{safeStorage()?.setItem(preferenceKey,JSON.stringify(value));await state.session.saveContentPreferences();await state.ui.update();},onError:error=>setStatus(error.message,'error')});
  state.contentUI=mountSessionContent({database:state.database,parent:document.getElementById('session-content'),session:state.session,onChanged:async()=>{await state.ui.update();await state.settingsUI.refreshContent();},onError:error=>setStatus(error.message,'error')});
  state.applicationUI=mountApplicationControls({parent:document.getElementById('application-controls'),session:state.session,statePort,manifest:state.manifest,mode:state.mode,busy:()=>state.busy||state.session.running,onError:error=>setStatus(error.message,'error')});
  state.promptUI=mountPromptInspector({parent:document.getElementById('prompt-inspector'),session:state.session});
  setStatus(`就绪 · 修订 ${head.revision} 次提交`,'ok');els.send.disabled=false;els.regen.disabled=!canRegenerate();els.continueBtn.disabled=!node;state.booted=true;state.ui.finish();
  document.getElementById('play-nav').hidden=false;
  refreshGeneratorInfo(head);
  await refreshSaves();
  const awaitingOpening=await pendingOpening({nodes:state.session.nodes,statePort:state.statePort,runId,draft:els.input.value});
  if(awaitingOpening){
    readingSurface.hide();const attempt=awaitingOpening.retryAttempt;
    if(attempt){const retry=()=>resumeOpening().catch(error=>setStatus(error.message,'error')),raw=String(attempt.raw||'');openingPage.openingIssue(attempt.error?.message||'上次开场尚未完成，已收到的回复已保留。',retry,{raw,paragraphs:raw?state.chain.parser.parseMessage(raw).paragraphs.length:0,completion:attempt.completion||'未完成',warnings:[],diagnostics:attempt.responseDiagnostics||null});}
    else await resumeOpening();
  }
  else{readingSurface.show();openingPage.enteredGame();}
}

let openingDispatching=false;
async function resumeOpening(){
  if(openingDispatching||!state.booted||state.busy||!state.session)return;
  openingDispatching=true;
  try{
    const session=state.session,port=state.statePort,runId=session.identity.runId;
    const pending=await pendingOpening({nodes:session.nodes,statePort:port,runId,draft:els.input.value});
    if(!pending||session!==state.session)return;
    const retry=()=>resumeOpening().catch(error=>setStatus(error.message,'error'));
    const saveOnly=session.coordinator?.lastError?.stage==='commit';
    const issue=state.mode==='tavern'||saveOnly?'':modelConnectionIssue();
    if(issue){openingPage.openingIssue(issue,retry);return;}
    await openingPage.transition(async()=>{
      els.input.value=pending.text;settingsSurface.close();openingPage.progress({fraction:null,text:saveOnly?'正在保存开场…':'正在生成开场…'});
      let result;
      if(saveOnly){state.busy=true;try{result=await session.retryCommit();}finally{state.busy=false;state.ui?.finish();}if(['committed','replayed'].includes(result?.status)){await state.ui?.update();await refreshSaves();}}
      else result=await sendTurn(pending.text);
      if(session!==state.session)return;
      if(['committed','replayed'].includes(result?.status)){readingSurface.show();openingPage.enteredGame();}
      else{const authFailure=['site_auth','model_auth','auth_unknown'].includes(result?.error?.code);readingSurface.hide();openingPage.openingIssue(result?.error?.message||'开场尚未生成，可以重试或修改模型设置。',retry,{raw:authFailure?'':session.coordinator.context.streamed,diagnostics:result?.error?.diagnostics||session.coordinator.context.responseDiagnostics||null,paragraphs:authFailure?0:session.coordinator.parsed?.display.paragraphs.length||0,completion:authFailure?'鉴权失败，未开始生成':session.coordinator.context.completion||'未返回结束标记',warnings:authFailure?[]:session.coordinator.parsed?.display.warnings||[]});}
    },{reuse:true});
  }finally{openingDispatching=false;}
}

function describeLoader(){
  const summary = loaderSummary({ release: state.release, identity: state.hostIdentity, rows: loadRows });
  const template = state.manifest?.knowledge?.template || null;
  const extra = [];
  if (template) extra.push('Skill 模板 ' + (template.version || '?') + (template.action && template.action !== 'kept' ? '（' + template.action + '）' : ''));
  if (state.hostIdentity?.mismatches?.length) extra.push('扩展自检有 ' + state.hostIdentity.mismatches.length + ' 项不一致');
  return [loaderLine(summary), ...extra].join(' · ');
}

function describeSelection(){
  const s=state.session?.selection;
  if(!s||!s.last)return state.knowledge?.status==='ok'?('尚未选择 · 目录 '+state.knowledge.verify.items+' 条'):'目录未发布';
  const t=s.last,timing=s.timings?.['selection'];
  const base=t.strategy+'／'+t.mode+' · 选 '+t.selected+' 条 · 调用 '+t.calls;
  const time=timing?(' · '+timing.ms+'ms'+(timing.retries?'（重试 '+timing.retries+'）':'')):'';
  return base+time+' · 复用记录 '+s.decisions;
}
function describeKnowledge(){
  const k=state.knowledge;
  if(!k)return '未读取';
  if(k.status==='ok')return `${k.verify.items} 条 / ${k.verify.groups} 组 · ${String(k.verify.indexHash).slice(0,8)}`;
  if(k.status==='mismatch')return `目录与摘要不一致：${k.verify.digest}≠${k.verify.indexHash}`;
  return k.reason||k.status;
}

function describeRelease(){
  const host=state.hostIdentity;
  if(host){
    const tone={ok:'扩展·app·角色卡一致',mismatch:'身份不一致：'+host.mismatches.join('、'),missing:'这份安装没有构建回执',partial:'已读到构建，未核对角色卡'}[host.status]||host.status;
    return `${host.buildId||'未登记'} · ${tone}`;
  }
  const release=state.release;
  return release?`${release.buildId} · ${release.contentVersion||''}`:'未读取到发布回执';
}

function describeWorld() {
 const world=state.session?.describe?.().world;
 if(!world||!Array.isArray(world.books))return '未读取到世界书';
 const entries=world.books.reduce((sum,row)=>sum+(row.entries||0),0);
 const carriers=world.books.map(row=>row.carrier==='host'?'酒馆':row.carrier==='settings'?'设置':'卡内').join('／')||'无';
 return `${world.books.length} 本 · ${entries} 条 · ${carriers} · ${world.revision||'—'}`;
}
function describeAgent() {
 const agent=state.session?.agent;
 if(!agent)return '未接管';
 const applied=state.session?.applied;
 const status=applied?({applied:'已应用',failed:'写入失败','readback-mismatch':'读回不一致',unsupported:'载体不可写'}[applied.status]||applied.status):'本轮无写回';
 return `${agent.mode} · 接管 ${agent.books.length} 本 · 本轮${status}`;
}
function refreshGeneratorInfo(head) {
  const info = state.session ? state.session.describe() : null;
  els.genInfo.innerHTML = '';
  if (!info) return;
  const rows = [
    ['运行方式', { public: '公网独立', local: '本地独立', tavern: '酒馆接入' }[info.mode]],
    ['构建', describeRelease()],
    ['画质', state.mode==='tavern'?'宿主资源':state.packQuality==='original'?'原画质':'标准画质'],
    ['本机资源', state.packInfo?`${state.packInfo.layers?.length||0} 层 · ${state.packInfo.assets} 项`:state.mode==='tavern'?'宿主提供':'未读取'],
    ['加载与版本', describeLoader()],
    ['知识目录', describeKnowledge()],
    ['账号', info.identity.accountId],
    ['周目', info.identity.runId],
    ['修订', String(head ? head.revision : 0)],
    ['世界书条目', `${info.worldEntries}`],
    ['世界书', describeWorld()],
    ['选择写回', describeAgent()],
    ['目录选择', describeSelection()],
    ['预设变量已设', `${info.varsSet}`],
    ['采样', `T=${state.session.sampling.temperature} max=${state.session.sampling.max_tokens}`],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    els.genInfo.append(dt, dd);
  }
}

/* ---------------- 回合 ---------------- */

function canRegenerate() {
  // 失败／中断的回合没有生成正文节点，但候选仍留在协调器里且 session.regenerate 支持从它重跑，
  // 所以按钮可用性必须同时看这两处，否则截断或断网后玩家点不了重抽。
  const pending = state.session?.coordinator?.context;
  if (pending && ['failed', 'interrupted'].includes(pending.status) && (pending.input?.text || pending.input?.generationType === 'continue')) return true;
  const node = state.session?.narrativeNode;
  return Boolean(node?.message?.input?.text || node?.message?.input?.generationType === 'continue');
}

async function sendTurn(text, {regenerate=false,nodeId,continues=false}={}) {
  if (!state.booted || !state.session) return;
  // 刚点过中断时，上一轮还在收尾（provider 停生成 → 协调器落 interrupted）。此时点发送不能静默丢掉，等它收尾再走。
  if (state.busy && state.stopRequested) {
    const deadline = Date.now() + 6000;
    while (state.busy && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 60));
  }
  if (state.busy) return;
  const input = String(text || els.input.value || '').trim();
  if (!input && !regenerate && !continues) return;
  try{await state.ui?.beforeSend({text:input,type:continues?'continue':regenerate?'regenerate':'normal'});}catch(error){setStatus(error.message,'error');return;}
  if(state.busy)return;
  state.busy=true;(globalThis.__cxxTurnMark=globalThis.__cxxTurnMark||[]).push('enter:'+Date.now());
  const session=state.session;
  els.send.disabled = true;
  els.regen.disabled = true;
  els.continueBtn.disabled = true;
  els.stop.disabled = false;
  els.choices.innerHTML = '';
  const controller = controllerFor();
  state.abort = controller;
  let streamed = '',revealOpening=openingDispatching,reasoningStarted=false;
  try {
    const hooks = {
      signal: controller?.signal,
      onDelta: (delta) => {
        if(session!==state.session)return;
        if(!streamed&&reasoningStarted)setStatus('生成中…');
        streamed += delta;
        renderStream(streamed);
        state.ui?.stream(streamed);
        if(revealOpening&&streamed.trim()){revealOpening=false;requestAnimationFrame(()=>{if(session===state.session&&state.busy){readingSurface.show();openingPage.enteredGame();}});}
      },
      onReasoning:()=>{if(session!==state.session)return;if(!streamed&&!reasoningStarted){reasoningStarted=true;setStatus('思考中…');}state.ui?.stream(streamed);},
      onPhase: (phase, data) => {
        if(session!==state.session)return;
        if (phase === 'generating') {
          const warns = (data && data.warnings) || [];
          setStatus(warns.length ? `生成中 · ${warns[0]}` : '生成中…', warns.length ? 'warn' : '');
        } else if (phase === 'parsing') {
          setStatus('正文已收到，正在解析变量…');
        } else if (phase === 'committed' || phase === 'replayed') {
          setStatus(`已提交 · 修订 ${data?.revision ?? ''}`, 'ok');
        } else if (phase === 'conflict') {
          setStatus('这份存档已被其它标签页写入，候选未保存。', 'error');
        } else if (phase === 'interrupted') {
          setStatus('已中断：这一轮没有保存，输入保留在框里，可重新发送。', 'warn');
        } else if (phase === 'failed') {
          setStatus('校验未通过或写入失败，候选未保存（见下）。', 'error');
        }
      },
    };
    globalThis.__cxxTurnMark.push('run:'+Date.now());const result=continues?await session.continueTurn(hooks):regenerate?await session.regenerate({...hooks,nodeId}):await session.runTurn(input,hooks);globalThis.__cxxTurnMark.push('done:'+Date.now()+':'+(result&&result.status));
    if(session!==state.session)return;
    await state.ui?.afterTurn(result);globalThis.__cxxTurnMark.push('after:'+Date.now());
    const parameterWarnings=document.getElementById('parameter-warnings');parameterWarnings.textContent=(result.parameterWarnings||[]).join('\n');parameterWarnings.hidden=!result.parameterWarnings?.length;
    document.getElementById('retry-save').hidden=!(result.status==='failed'&&result.error?.stage==='commit');
    if (result.parsed) {
      state.lastParsed = result.parsed;
      renderParsed(result.parsed);
      renderChoices(result.status==='committed' ? result.parsed.display?.choices || [] : []);
    } else if (streamed && !state.ui) {
      renderParsed(null);
      const div = document.createElement('div');
      div.className = 'line narration';
      div.textContent = '这一轮没有形成可提交的回复。';
      els.stage.appendChild(div);
    }
    if(result.error&&state.ui)setStatus('未保存：'+(result.error.message||result.error.code),'error');
    if (result.error && !state.ui) {
      const div = document.createElement('div');
      div.className = 'line narration';
      div.style.color = 'var(--cxx-red)';
      div.textContent = `未保存：${result.error.message || result.error.code}`;
      els.stage.appendChild(div);
    }
    if (result.status === 'committed' || result.status === 'replayed') {
      if(!regenerate&&!continues&&els.input.value.trim()===input)els.input.value='';
      const head = await state.session.coordinator.snapshot();
      if (state.session.narrativeNode?.message?.complete === false) setStatus('模型回复未完整结束，已保存正文；点“重新生成”刷新本次回复，或点“继续”接上。', 'warn');
      refreshGeneratorInfo({ revision: head.revision });
      await refreshSaves();
      await state.ui?.update();
    }
    return result;
  } catch (error) {
    setStatus(`发送失败：${error.message}`, 'error');
    return {status:'failed',error};
  } finally {
    globalThis.__cxxTurnMark.push('finally:'+Date.now());
    if(session===state.session){
    state.busy=false;
    state.promptUI?.refresh();state.ui?.finish();
    els.send.disabled = false;
    els.regen.disabled = !canRegenerate();
    els.continueBtn.disabled = !state.session?.narrativeNode;
    els.stop.disabled = true;
    state.abort = null;
    state.stopRequested=false;
    }
  }
}

async function refreshSaves(){
  const box=document.getElementById('save-list');if(!box||!state.session)return;
  box.replaceChildren();
  const button=(label,run)=>{const node=document.createElement('button');node.type='button';node.textContent=label;node.onclick=()=>{setStatus('正在打开存档…');Promise.resolve(run()).catch(error=>setStatus(error.message,'error'));};box.append(node);};
  const runId=state.session.identity.runId;
  state.promptUI?.refresh();await state.replyUI?.refresh();
  for(const run of await state.statePort.listRuns(state.accountId))button(run.profile?.name||run.runId,()=>startSession({accountId:state.accountId,runId:run.runId}));
  for(const [index,branch] of (await state.session.listBranches()).entries())button(branch.label||'路线 '+(index+1),async()=>{await state.session.selectBranch(branch.branchId);await startSession({accountId:state.accountId,runId});});
  for(const point of await state.session.listCheckpoints())button('恢复 · '+point.label,async()=>{await state.session.restoreCheckpoint(point.checkpointId);await startSession({accountId:state.accountId,runId});});
}

function deleteFloor(nodeId){
  if(state.busy||state.session.running)return;
  const node=state.session.nodes.find(row=>row.nodeId===nodeId);if(!node?.parentId)return;
  const dialog=document.createElement('dialog');dialog.className='cxx-web-confirm';dialog.setAttribute('aria-labelledby','rewind-title');
  const title=document.createElement('h2');title.id='rewind-title';title.textContent='撤回此层及后续内容？';
  const note=document.createElement('p');note.textContent='人物和剧情回到此层开始前。原路线保留，可在历史路线中恢复。';
  const cancel=document.createElement('button');cancel.textContent='返回';cancel.type='button';cancel.onclick=()=>dialog.close();
  const confirm=document.createElement('button');confirm.textContent='确认撤回';confirm.type='button';confirm.onclick=async()=>{if(state.busy)return;state.busy=true;confirm.disabled=true;try{const result=await state.session.rewindNode(nodeId);if(result.status==='conflict')throw Error('故事已有更新，请重新读取后操作。');await state.ui.update();await refreshSaves();setStatus('已撤回，原路线保留。','ok');dialog.close();}catch(error){note.textContent=error.message;}finally{state.busy=false;confirm.disabled=false;}};
  dialog.append(title,note,cancel,confirm);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();cancel.focus();
}

function temporaryTransfer(){return openTemporaryTransfer({sync:state.temporary,session:state.session,statePort:state.statePort,accountId:state.accountId,mode:state.mode,onSwitch:runId=>startSession({accountId:state.accountId,runId}),onError:error=>setStatus(error.message,'warn')});}
document.getElementById('new-run').onclick=()=>{if(state.busy)return;startSession({accountId:state.accountId,runId:newId('run')}).catch(error=>setStatus(error.message,'error'));};
document.getElementById('checkpoint').onclick=async()=>{if(state.busy)return;try{await state.session.createCheckpoint('存档 '+new Date().toLocaleTimeString());await refreshSaves();setStatus('存档点已保存','ok');}catch(error){setStatus(error.message,'error');}};
document.getElementById('retry-save').onclick=async()=>{if(state.busy)return;state.busy=true;try{const result=await state.session.retryCommit();if(result.status==='committed'){renderParsed(result.parsed);renderChoices(result.parsed.display.choices);setStatus('原候选已保存','ok');document.getElementById('retry-save').hidden=true;await state.ui?.update();await refreshSaves();}else setStatus(result.error?.message||'保存未完成','error');}finally{state.busy=false;}};
for(const [id,method,args]of [['gal-btn','openGal'],['terminal-btn','openTerminal']])document.getElementById(id).onclick=()=>Promise.resolve(state.ui?.[method](args)).catch(error=>setStatus(error.message,'error'));

document.getElementById('backup-btn').onclick=()=>exportCurrentStory();
async function exportCurrentStory(){try{await state.savesUI.exportStory();setStatus('完整备份已导出。','ok');}catch(error){setStatus(error.message,'error');}}
/* ---------------- 事件 ---------------- */

els.send.addEventListener('click', () => sendTurn());
els.regen.addEventListener('click',()=>sendTurn('',{regenerate:true}));
els.continueBtn.addEventListener('click',()=>sendTurn('',{continues:true}));
els.stop.addEventListener('click', () => {
  state.abort?.abort();
  state.session?.cancel();
  state.ui?.stop();
});
els.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    sendTurn();
  }
});
els.themeBtn.addEventListener('click', () => {
  const order = ['red', 'yellow', 'night'];
  themeApply(order[(order.indexOf(settings.theme) + 1) % order.length]);
});
els.drawerBtn.addEventListener('click', () => {
  settingsSurface.open();
  refreshGeneratorInfo({ revision: state.session?.coordinator.snapshot().revision || 0 });
});
els.drawerClose.addEventListener('click', () => {
  settingsSurface.close();
});
els.drawer.addEventListener('click', (event) => {
  if (event.target === els.drawer) els.drawerClose.click();
});

els.modelForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if(state.busy){setStatus('请先结束当前生成，再修改连接。','warn');return;}
  try {readModelForm();const issue=modelConnectionIssue();if(issue)throw Error(issue);state.session?.setModel(modelConfig());}catch(error){setStatus(error.message,'error');return;}
  try {
    await persistSettings();
    setStatus(settings.rememberKey?'设置已保存，密钥已记住。':'设置已保存，密钥仅保留在本次浏览会话。','ok');
  } catch(error) { setStatus('配置已用于当前页面，保存失败：'+error.message,'warn'); }
  await resumeOpening();
});
function readModelForm(){
  const form = new FormData(els.modelForm);
  settings.adapter = String(form.get('adapter') || 'openai-chat');
  settings.baseUrl = String(form.get('baseUrl') || '').trim();
  settings.model = String(form.get('model') || '').trim();
  settings.apiKey = String(form.get('apiKey') || '').trim();
  settings.connection=String(form.get('connection')||'default');
  settings.rememberKey=form.get('rememberKey')==='on';Object.assign(settings,modelConnection.read());
}

const adapterSelect=els.modelForm.elements.namedItem('adapter');
const headerResize=new ResizeObserver(()=>document.documentElement.style.setProperty('--cxx-web-header-height',document.querySelector('.topbar').getBoundingClientRect().height+'px'));headerResize.observe(document.querySelector('.topbar'));
adapterSelect.replaceChildren();
for(const [label,prefix,rows] of [['聊天服务','chat:',CHAT_SOURCES],['文本服务','text:',TEXT_SOURCES],['其他服务','extra:',EXTRA_MAIN_SOURCES],['协议自定义','',FAMILY_KEYS.map(id=>({id,label:id}))]]){
  const group=document.createElement('optgroup');group.label=label;for(const row of rows){const option=document.createElement('option');option.value=prefix+row.id;option.textContent=row.label;group.append(option);}adapterSelect.append(group);
}
modelConnection=mountModelConnection(els.modelForm);modelConnection.sync(settings);
function modelConnectionIssue(){
 if(!settings.model&&!settings.provider?.deployment)return '请填写正文模型型号或部署名。';
 try{const config=modelConfig(),request=buildRequest({operation:'chat',...config,payload:{...config.provider,model:config.model,messages:[{role:'user',content:'开始'}],stream:true}});if(new URL(request.url).hostname==='api.deepseek.com'&&!request.headers.authorization)return '当前页面未配置 DeepSeek API Key，请填写并保存模型设置；未选择记住密钥时，新标签页需要重新填写。';return '';}catch(error){return error.message;}
}
document.getElementById('login-btn').onclick=()=>doLogin();
document.getElementById('logout-btn').onclick=()=>{connectionSettingsScope=null;sessionStorage.removeItem(connectionKey()+':key');sessionStorage.removeItem(connectionKey()+':service-account');settings.apiKey='';settings.serviceAccount='';CXXUser.logout();};
document.getElementById('clear-key').onclick=async()=>{if(state.busy){setStatus('请先中断生成，再清除密钥。','warn');return;}try{settings.apiKey='';settings.serviceAccount='';settings.rememberKey=false;sessionStorage.removeItem(connectionKey()+':key');sessionStorage.removeItem(connectionKey()+':service-account');await persistSettings();syncModelForm();state.session?.setModel(modelConfig());setStatus('此身份记住的模型密钥已清除。','ok');}catch(error){setStatus(error.message,'error');}};
document.getElementById('test-models').onclick=async()=>{try{readModelForm();const result=await buildModelPort().models(modelConfig());setStatus('已读取 '+result.models.length+' 个模型。','ok');const list=document.getElementById('model-options');list.replaceChildren();for(const row of result.models){if(!row.id)continue;const option=document.createElement('option');option.value=row.id;list.append(option);}}catch(error){setStatus(error.message,'error');}};
// Initial anonymous check is part of boot; only an owned account can be logged out.
document.addEventListener('cxx-user-changed',event=>{if(state.mode==='public'&&!event.detail.account&&state.accountId){connectionSettingsScope=null;const hadSession=state.booted;bootSequence++;startSequence++;try{sessionStorage.removeItem(connectionKey()+':key');sessionStorage.removeItem(connectionKey()+':service-account');}catch{}state.abort?.abort();state.session?.dispose();state.ui?.destroy();state.settingsUI?.destroy();state.contentUI?.destroy();state.savesUI?.destroy();state.replyUI?.destroy();state.applicationUI?.destroy();state.promptUI?.destroy();state.packUI?.destroy();state.creation?.destroy();state.statePort?.close();state.ui=null;state.settingsUI=null;state.savesUI=null;state.replyUI=null;state.applicationUI=null;state.promptUI=null;state.packUI=null;state.session=null;state.creation=null;state.statePort=null;state.accountId=null;state.temporary?.destroy();state.temporary=null;state.temporaryAccount=null;state.booted=false;state.busy=false;document.getElementById('play-nav').hidden=true;settingsSurface.close();els.input.value='';settings.apiKey='';settings.serviceAccount='';syncModelForm();els.send.disabled=true;els.regen.disabled=true;els.continueBtn.disabled=true;readingSurface.hide();openingPage.show();document.querySelector('.composer').hidden=true;document.getElementById('login-btn').hidden=false;document.getElementById('logout-btn').hidden=true;setStatus(hadSession?'已退出，请登录后继续。':'登录后开始或继续故事。','warn');}});
window.addEventListener('storage',event=>{if(state.mode==='public'&&event.key==='cxx-oauth-token'){state.session?.cancel();boot().catch(error=>setStatus(error.message,'error'));}});
window.addEventListener('cxx-host-close',()=>{state.booted=false;state.abort?.abort();state.session?.dispose();state.ui?.destroy();state.settingsUI?.destroy();state.contentUI?.destroy();state.savesUI?.destroy();state.replyUI?.destroy();state.applicationUI?.destroy();state.promptUI?.destroy();state.packUI?.destroy();state.creation?.destroy();state.statePort?.close();state.packUI=null;});
window.addEventListener('cxx-web-open-memory',()=>state.settingsUI?.openMemory());
window.addEventListener('cxx-web-send-draft',()=>sendTurn());
window.addEventListener('cxx-web-open-stories',()=>{settingsSurface.open('stories');refreshSaves();});
globalThis.CxxWebApp={get session(){return state.session;},get ui(){return state.ui;},get statePort(){return state.statePort;},get settingsUI(){return state.settingsUI;},read:()=>({mode:state.mode,booted:state.booted,busy:state.busy,phase:state.phase,release:state.release,loader:loaderSummary({release:state.release,identity:state.hostIdentity,rows:loadRows}),identity:state.hostIdentity?{status:state.hostIdentity.status,buildId:state.hostIdentity.buildId,mismatches:state.hostIdentity.mismatches,card:state.hostIdentity.card?.ok}:null,world:state.session?.describe?.().world??null,agent:state.session?.agent?{mode:state.session.agent.mode,books:state.session.agent.books.length,journal:state.session.agent.journal}:null,applied:state.session?.applied?{status:state.session.applied.status,books:state.session.applied.books.map(row=>row.bookId),unknown:state.session.applied.unknown.length}:null,knowledge:state.knowledge?{status:state.knowledge.status,items:state.knowledge.verify?.items??null,groups:state.knowledge.verify?.groups??null,indexHash:state.knowledge.verify?.indexHash??null}:null,ui:state.ui?.read(),creation:state.creation?.flow.state()})};
const openingPage=await mountWeb({actions:createWebAdapter({
  getState:()=>state,startSession,mountSaveControls,
  mountArchive:(parent,onClose)=>mountStoryArchive({parent,session:state.session,statePort:state.statePort,accountId:state.accountId,mode:state.mode,temporary:state.mode==='public'?temporaryTransfer:null,busy:()=>state.busy,onPlay:runId=>{onClose();return startSession({accountId:state.accountId,runId});},onClose,onError:error=>setStatus(error.message,'error'),mountTools:target=>state.session?mountSaveControls({parent:target,session:state.session,statePort:state.statePort,mode:state.mode,accountId:state.accountId,onSwitch:runId=>{onClose();return startSession({accountId:state.accountId,runId});}}):null}),
  openSettings:page=>{refreshGeneratorInfo({revision:state.session?.coordinator.snapshot().revision||0});settingsSurface.open(page);},
  leave:()=>{if(state.mode==='tavern'){openingPage.hide();window.dispatchEvent(new Event('cxx-host-close'));}else location.assign(location.pathname.startsWith('/play/')?'/':'https://cyber2051.top/');},
  login:async()=>{await doLogin();openingPage.show();await openingPage.ready();}
})});
const settingsSurface=mountWebSettings({root:els.drawer,playSound:openingPage.playSound});
const readingSurface=mountReadingShell({openMenu:()=>openingPage.show()});
window.addEventListener('pagehide',()=>{settingsSurface.destroy();readingSurface.destroy();openingPage.destroy();},{once:true});
globalThis.CxxOpeningPage=openingPage;
boot().then(()=>openingPage.ready()).catch((error)=>{setStatus(`启动失败：${error.message}`,'error');openingPage.failure(error.message);});

