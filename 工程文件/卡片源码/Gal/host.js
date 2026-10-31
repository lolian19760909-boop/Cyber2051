/* Runs inside a character-local Tavern Helper script iframe. */
(function () {
  'use strict';
  const win = window.parent, doc = win.document;
  const context = () => SillyTavern.getContext();
  const slot = '__cxx_gal_g1__';
  win[slot]?.destroy();
  const ctx = context();
  const owner = ctx.characters[ctx.characterId]?.avatar;
  if (!owner || ctx.groupId) return;
  if (!ctx.eventTypes.GENERATION_AFTER_COMMANDS) {
    win.toastr?.warning('当前酒馆或助手缺少 Gal 对话格式所需的生成接口，请检查扩展版本。', 'Gal 阅读');
    return;
  }
  const style = doc.createElement('style');
  style.id = 'cxx-galgame-style';
  style.textContent = CXX_GAL_STYLE;
  doc.head.append(style);
  // A single game-menu entry owns navigation in native and Gal modes.
  let listRevision=0;
  let runtime, refreshTimer, mvuTimer, destroyed = false, coveredKey = '', terminalSource = null;
  function statusNote(text, ttl = 0) {
    mvuStatus = text;
    clearTimeout(mvuNoteTimer); mvuNoteTimer = null;
    if (!text || ttl <= 0) return;
    const round = mvuRound;
    mvuNoteTimer = setTimeout(() => { if (!destroyed && round === mvuRound) { mvuStatus = ''; runtime?.refresh(); } }, ttl);
  }
  let mvuStatus = '', mvuScope = '', mvuSeen = false, mvuParsed = false, mvuRead = false, mvuSaving = false, mvuChecks = 0, mvuCommands = false, mvuBound = false, mvuTarget = null, mvuRound = 0, mvuNoteTimer = null;
  const mvuAttempts = new Set();
  let mvuIdleChecks=0;
  let mediaStamp='',savedMedia=[],mediaPending=false,mediaError='';
  const terminalBridge = CxxGalTerminal.create({ document: doc, onClose: () => { terminalSource = null; runtime?.refresh(); runtime?.focusTerminal(); } });
  const statusBridge = CxxGalStatusBridge.create({ document: doc, onClose: () => { runtime?.refresh(); runtime?.focusStatus(); } });
  const disposers = [];
  const key = c => {
    const chatId = c.getCurrentChatId();
    return c.groupId || c.characters[c.characterId]?.avatar !== owner || typeof chatId !== 'string' || !chatId
      ? '' : JSON.stringify([owner, chatId]);
  };
  let observedKey = key(ctx), readyKey = observedKey, scopeEpoch = 0, modeAttempted = false;
  const mode = CxxGalMode.create({
    readScope: () => { const current = key(context()); return current === readyKey ? current : ''; },
    getVariables: options => getVariables(options),
    updateVariablesWith: (update, options) => updateVariablesWith(update, options),
  });
  function observeScope(ready = false) {
    const current = key(context());
    if (current !== observedKey) {
      observedKey = current; readyKey = ''; scopeEpoch++; modeAttempted = false;
      clearTimeout(refreshTimer); refreshTimer = null;
      clearTimeout(mvuTimer); mvuTimer = null; mvuStatus = ''; mvuScope = ''; mvuSeen = false; mvuRead = false; mvuSaving = false; mvuTarget = null; mvuRound++;
      mvuAttempts.clear();
    }
    if (ready) readyKey = current;
    return current;
  }
  function modeAvailable() {
    return typeof getVariables === 'function' && typeof updateVariablesWith === 'function';
  }
  function maybeRestore() {
    if (destroyed || !runtime || runtime.active || modeAttempted || !readyKey || observeScope() !== readyKey || busy() || !input() || !modeAvailable()) return;
    const result = mode.read(readyKey);
    if (!result.ok) { if (result.code !== 'scope-changed' && result.code !== 'volatile') modeAttempted = true; return; }
    modeAttempted = true;
    if (result.enabled) runtime.open({ remember: false });
  }
  function saveMode(expectedKey, enabled) {
    if (destroyed) return;
    const current = observeScope();
    if (current !== expectedKey || readyKey !== expectedKey) return;
    if(win.Cxx236OpeningHost?.hasUnconfirmed()){win.Cxx236OpeningHost.setReadingMode(enabled);return;}
    modeAttempted = true;
    const preferences=win.Cxx236Preferences,epoch=scopeEpoch;
    if(!preferences?.save){notify('阅读设置正在加载，请稍后重试。');return;}
    void preferences.save({...preferences.read(),gal:enabled}).catch(error=>{
      if(!destroyed&&epoch===scopeEpoch&&key(context())===expectedKey)notify('阅读方式保存失败：'+error.message);
    });
  }
  const workshopBridge = CxxGalWorkshop.create({ document: doc,
    getAllEnabledScriptButtons: typeof getAllEnabledScriptButtons === 'function' ? getAllEnabledScriptButtons : undefined,
    eventEmit: typeof eventEmit === 'function' ? eventEmit : undefined,
    isCurrent: () => Boolean(coveredKey && coveredKey === key(context())),
    onClose: () => { runtime?.refresh(); runtime?.focusWorkshop(); },
  });
  function openingState(c) {
    const first = c.chat[0];
    const openingMessage = first && !first.is_user && !win.Cxx236OpeningHost?.readingReady(first) && CxxGalOpeningBridge.isOpeningSource(first.mes, first.swipe_id || 0) ? first : null;
    return { openingMessage, opening: Boolean(openingMessage && !c.chat.some(m => m.is_user)), swipeId: first?.swipe_id || 0 };
  }
  const originalOpening = CxxGalOpeningBridge.create({ document: doc,
    isCurrent: () => !destroyed && Boolean(coveredKey && coveredKey === key(context()) && openingState(context()).opening),
    getOpeningId: () => openingState(context()).swipeId,
    onClose: reason => { if (reason) runtime?.close(reason); else runtime?.refresh(); },
  });
  function replyFloor(c) {
    for (let id = c.chat.length - 1; id >= 0; id--) {
      const m = c.chat[id];
      if (m.is_user || m.is_system || typeof m.mes !== 'string' || !m.mes.trim()) continue;
      if (id === 0 && CxxGalOpeningBridge.isOpeningSource(m.mes, m.swipe_id || 0)) continue;
      // Components belong to the real reply floor, even without a valid scene JSON.
      // Each bridge checks that its own iframe has actually loaded there.
      return id;
    }
    return -1;
  }
  function syncPanels() {
    const c = context();
    if (!coveredKey || coveredKey !== key(c) || !openingState(c).opening) originalOpening.close();
    else if (originalOpening.active) originalOpening.refresh({ swipeId: openingState(c).swipeId });
    if (!coveredKey || coveredKey !== key(c)) {
      statusBridge.close(); workshopBridge.close();
    }
    if (!key(c) || openingState(c).opening || (terminalSource && terminalSource.scope !== key(c))) {
      terminalBridge.close(); statusBridge.close();
    } else {
      if (statusBridge.active && statusBridge.messageId !== replyFloor(c)) statusBridge.close();
      // The shared terminal follows saved state in this chat; a new reply does not close it.
    }
  }
  const input = () => doc.querySelector('#send_textarea');
  const nativeBusy = () => {
    // Helper extra calls also show the shared stop button; it does not identify native ownership.
    return Boolean(typeof builtin !== 'undefined' && typeof builtin.duringGenerating === 'function' && builtin.duringGenerating());
  };
  const mvuBusy = () => false;
  const busy = () => nativeBusy() || mvuBusy() || (mvuScope===key(context()) && ((mvuSeen && !mvuParsed && !mvuRead) || mvuSaving));
  function guardState(floor) {
    try { return win.Cxx236VariableGuard?.state?.({ floor }) || null; } catch (_) { return null; }
  }
  function numericSettingsError() {
    const state = guardState(context().chat.length - 1);
    if (!state || state.ready !== true) return '变量解析器尚未就绪，先返回原生确认本卡「MVU Zod 脚本」已启用，再发送；数值计算不会交给终端API代做。';
    return '';
  }
  function nativeSendReady(expected) {
    try {
      const c=context(),scope=key(c),button=doc.querySelector('#send_but'),field=input();
      if(destroyed || win[slot]?.nativeSendReady!==nativeSendReady || !runtime?.active || !scope || coveredKey!==scope || readyKey!==scope ||
          expected?.characterKey!==owner || expected?.chatId!==c.getCurrentChatId() || doc.body.getAttribute('data-cxx-gal-active')!=='1' ||
          busy() || numericSettingsError() || typeof c.onlineStatus!=='string' || !c.onlineStatus || c.onlineStatus==='no_connection')return false;
      return Boolean(field && field.isConnected!==false && !field.disabled && button && button.isConnected!==false && !button.disabled &&
        button.getClientRects().length>0 && win.getComputedStyle(button).display!=='none');
    } catch (_) { return false; }
  }
  function mvuSource(floor=context().chat.length-1) {
    const source=win.CxxSource?.peek?.(floor);
    return source?.ok?source.sourceMessage:typeof win.CxxSource?.original==='function'?win.CxxSource.original(floor):context().chat[floor]?.mes;
  }
  function mvuSourceChanged() {
    if(!mvuTarget)return false;
    const current=context().chat.at(-1);
    if(current!==mvuTarget.message||(current?.swipe_id||0)!==(mvuTarget.swipe||0)||context().chat.length!==mvuTarget.count)return true;
    const normal=raw=>String(raw||'').replace(/<StatusPlaceHolderImpl\/>/g,'').replace(/<status_current_variable>[\s\S]*?<\/status_current_variable>/gi,'').trim();
    const before=normal(mvuTarget.canonical??mvuTarget.raw),after=normal(mvuSource());
    return before!==after&&!(after.startsWith(before)&&/^\s*<UpdateVariable>[\s\S]*<\/UpdateVariable>\s*$/.test(after.slice(before.length)));
  }
  function watchMvu() {
    if(mvuRead)return;
    clearTimeout(mvuTimer); mvuTimer = null;
    if (destroyed || !mvuScope || mvuScope !== key(context())) return;
    const current = context().chat.at(-1);
    if (mvuSourceChanged()) { mvuScope = ''; mvuSaving=false;mvuRound++;mvuStatus = '回复或分支已变化，数值结果需要重新核对。'; runtime?.refresh(); return; }
    if (mvuBusy() && !mvuTarget) mvuTarget = {message:current,swipe:current?.swipe_id,raw:current?.mes,canonical:mvuSource(),count:context().chat.length};
    if (!mvuBound && win.Mvu?.events?.COMMAND_PARSED) {
      const name = win.Mvu.events.COMMAND_PARSED, parsed = (_, commands, source) => {
        const latest=context().chat.at(-1),receipt=win.Cxx236VariableGuard?.state?.({floor:context().chat.length-1})?.receipt;
        if (destroyed || mvuScope !== key(context()) || !latest || latest.is_user || latest.is_system || source!==latest.mes&&!receipt) return;
        if (!mvuTarget) mvuTarget={message:latest,swipe:latest.swipe_id,raw:latest.mes,canonical:mvuSource(),count:context().chat.length};
        if (latest!==mvuTarget.message || latest.swipe_id!==mvuTarget.swipe || context().chat.length!==mvuTarget.count) return;
        if(mvuRead && mvuParsed)return;
        if(mvuRead && !mvuParsed) {mvuRead=false;mvuChecks=0;}
        mvuSeen=true;mvuParsed=true;mvuSaving=true;mvuCommands=receipt?receipt.phase!=='missing':Array.isArray(commands)&&commands.length>0;mvuTarget.raw=latest.mes;mvuTarget.canonical=mvuSource();
        if (!mvuRead) { clearTimeout(mvuTimer); mvuTimer=setTimeout(watchMvu,1000); }
      };
      eventOn(name,parsed); disposers.push(()=>eventRemoveListener(name,parsed)); mvuBound = true;
    }
    // 卡内解析器（无 MVU）路径：以回执为准，不再依赖 mag_command_parsed 事件。
    if (!win.Mvu && !mvuRead) {
      const floor = context().chat.length - 1, replay = guardState(floor);
      const phase = replay?.receipt?.phase;
      if (phase === 'applied' || phase === 'saved') { mvuSeen = true; mvuParsed = true; }
      else if (phase === 'rejected') { mvuSeen = true; mvuParsed = true; mvuSaving = false; mvuStatus = '变量未应用：' + (replay.receipt.message || ''); }
    }
    if (mvuBusy()) { mvuIdleChecks=0;mvuSeen = true; mvuStatus = 'MVU正在计算数值，按玩家设置处理请求…'; }
    else if (nativeBusy()) {mvuIdleChecks=0;mvuStatus = '主剧情正在生成…';}
    else if (mvuSeen && mvuParsed && !mvuRead) {
      mvuRead = true; mvuSaving = true; if (mvuStatus.indexOf('变量未应用') !== 0) mvuStatus = '变量计算已结束，正在核对酒馆保存…';
      const scope = mvuScope, round = mvuRound, floor = context().chat.length - 1, swipe = context().chat.at(-1)?.swipe_id || 0;
      const delays=[1000,3000,8000];let retries=0;
      const current = () => !destroyed && round===mvuRound && scope===mvuScope && scope===key(context()) && floor===context().chat.length-1 && swipe===(context().chat.at(-1)?.swipe_id || 0);
      const verify = async () => {
        if(!current())return;
        try {
          const receipt = await CxxContent.savedEventMedia({receipt:true});if(!current())return;
          mvuSaving=false;const matched=receipt?.saved&&receipt.floor===floor&&receipt.swipe===swipe;
          const result=receipt?.outcome||win.Cxx236VariableGuard?.state?.({floor})?.receipt;
          if(result?.phase==='rejected')statusNote('变量未应用：'+result.message);
          else if(matched&&result?.phase==='saved')statusNote('变量已保存并核对。',8000);
          else if(result?.phase==='applied')statusNote('变量已应用，保存待核对。');
          else if(mvuCommands)statusNote('本轮数值结果未确认，请保留回复并核对行动记录。');
          else statusNote('');
          runtime?.refresh();
        } catch (_) {
          if(!current())return;
          if(retries<delays.length) { mvuStatus='等待变量保存，稍后核对（'+(retries+1)+'/3）';mvuTimer=setTimeout(verify,delays[retries++]); }
          else {mvuSaving=false;mvuStatus='变量保存尚未确认；可继续阅读，稍后在影像记录中重新核对。';}runtime?.refresh();
        }
      };verify();
    }
    else if (mvuSeen && !mvuParsed) {
      mvuStatus='正在等候MVU写入变量结果…';
      if(++mvuIdleChecks>=3){mvuRead=true;mvuSaving=false;mvuStatus='MVU请求已结束，尚未收到变量结果；可继续阅读或在MVU中手动重试。';}
    }
    else if (!nativeBusy()) mvuStatus='等待MVU数值处理，尚未确认保存…';
    if (!mvuRead && ++mvuChecks >= 240) {mvuRead=true;mvuStatus='本轮MVU数值结果未确认，等待已达上限并暂停自动读取；请保留回复并核对行动记录。';}
    runtime?.refresh();
    if (!mvuRead) mvuTimer = setTimeout(watchMvu,1000);
  }
  const notify = message => win.toastr?.info(message, 'Gal 阅读');
  const sceneResolver=CxxGalScene.create(CxxGalParser);
  const backgroundOverrides=CxxGalBackgrounds.overrides({storage:win.localStorage,assets:CXX_GAL_MEDIA,baseUrl:CXX_GAL_MEDIA_BASE});
  const adapter = {
    onOpened: expectedKey => saveMode(expectedKey, true),
    onUserClose: expectedKey => saveMode(expectedKey, false),
    readCombat(floor) { return win.CxxCombatView?.forFloor(context().chat,floor)||[]; },
    read() { const c = context(); return { key: key(c), messages: c.chat, listRevision, draft: input()?.value || '', busy: busy(), generating: nativeBusy() && !mvuBusy() && !mvuSeen, canStop: nativeBusy() && !mvuBusy() && !mvuSeen, status: mvuStatus, ...openingState(c) }; },
    readHud(options) { return CxxGalHud.read({ ...options,receipt:win.Cxx236VariableGuard?.state?.({floor:options.messageId})?.receipt,
      getVariables: typeof getVariables === 'function' ? getVariables : undefined }); },
    resolveScene({floor,scene}){const c=context();return sceneResolver.resolve({key:key(c),messages:c.chat,floor,scene,locate:(map,id)=>win.CxxAtlasTool?.location(map,id)});},
    battleBefore(floor){const c=context();return sceneResolver.battleBefore({key:key(c),messages:c.chat,floor});},
    background(scene) { return CxxGalBackgrounds.select(scene, { assets: CXX_GAL_MEDIA, baseUrl: CXX_GAL_MEDIA_BASE }); },
    backgroundInfo(source){return backgroundOverrides.read(key(context()),source);},
    setBackground(source,filename){return backgroundOverrides.set(key(context()),source,filename);},
    eventMedia(){
      const installed=CxxContent.readHost();if(!installed || typeof getVariables!=='function')return [];
      const c=context(),scope=key(c),messages=c.chat || [];let events={};const state236=(typeof Cxx236State!=='undefined'&&Cxx236State)||globalThis.parent?.Cxx236State;if(state236&&typeof state236.stat==='function'){try{const value=state236.stat();if(value&&value.terminal)events=value.terminal?.gameplay?.events || {};}catch(error){}}// 兜底也走唯一入口，不再自己扫消息里的 stat_data。
  if(!Object.keys(events).length){try{const fallback=state236?.stat?.();if(fallback?.terminal)events=fallback.terminal?.gameplay?.events||{};}catch(error){}}
      const stamp=JSON.stringify([scope,installed.contentRevision,events]);
      if(stamp!==mediaStamp){savedMedia=[];if(!mediaPending && !busy()){mediaStamp=stamp;mediaPending=true;mediaError='';CxxContent.savedEventMedia().then(media=>{if(!destroyed && scope===key(context()) && stamp===mediaStamp)savedMedia=media;}).catch(e=>{if(scope===key(context()) && stamp===mediaStamp)mediaError=e.message;}).finally(()=>{mediaPending=false;if(!destroyed && mediaStamp===stamp)runtime?.refresh();});}}
      return savedMedia;
    },
    eventMediaStatus(){return mediaPending?'正在核对已保存的事件影像…':mediaError;},
    setDraft(text) {
      const field = input();
      if (!field) throw Error('找不到酒馆输入框');
      field.value = text; field.dispatchEvent(new win.Event('input', { bubbles: true }));
    },
    send() {
      const dispatch=()=>{
        if (!key(context()) || busy()) throw Error('当前聊天已切换或正在生成');
        const settingError = numericSettingsError(); if (settingError) throw Error(settingError);
        const button = doc.querySelector('#send_but');
        if (!button || button.disabled) throw Error('酒馆发送入口不可用，请返回原生界面检查');
        button.click();
      };
      return win.__cxx_player__?.requestSend?win.__cxx_player__.requestSend(dispatch):dispatch();
    },
    stop() { if (nativeBusy() && !mvuBusy() && !mvuSeen) doc.querySelector('#mes_stop')?.click(); else if (busy()) notify('额外MVU仍在处理，当前公开接口不能单独停止它；可以返回原生查看状态。'); },
    cover(active) {
      if (active) {
        doc.dispatchEvent(new win.CustomEvent('cxx:native-suspend'));
        const nextKey = key(context());
        coveredKey = nextKey;
        doc.body.setAttribute('data-cxx-gal-active', '1');
        syncPanels();
        if (mvuScope === nextKey && !mvuRead) watchMvu();
      } else {
        coveredKey = '';
        terminalSource = null;
        originalOpening.close(); terminalBridge.close(); statusBridge.close(); workshopBridge.close(); doc.body.removeAttribute('data-cxx-gal-active');
      }    },
    focusNative() { input()?.focus({ preventScroll: true }); }, notify,
    openOpening() {
      const c = context(), state = openingState(c);
      if (!coveredKey || coveredKey !== key(c) || !state.opening) throw Error('开场已结束或聊天已切换，请从当前聊天继续。');
      terminalBridge.close(); statusBridge.close(); workshopBridge.close();
      originalOpening.open({ swipeId: state.swipeId });
    },
    openTerminal() {
      const c = context();
      if (!key(c)) throw Error('当前聊天已切换，请重新打开。');
      if (openingState(c).opening) throw Error('完成开场后可打开剧情终端。');
      statusBridge.close(); workshopBridge.close();
      const messageId = replyFloor(c), message = c.chat[messageId];
      terminalBridge.open({ messageId });
      terminalSource = { scope: key(c), messageId, message, swipeId: message?.swipe_id, raw: message?.mes };
    },
    async openPlayer() {const c=context();if(!key(c)||coveredKey!==key(c))throw Error('当前聊天已切换。');if(openingState(c).opening)throw Error('请先完成开局配置。');terminalBridge.close();statusBridge.close();workshopBridge.close();if(!win.__cxx_player__)throw Error('人物服务尚未就绪。');win.__cxx_player__.open('人物');},
    async openStatus() {
      const c = context();
      if (!key(c) || coveredKey !== key(c)) throw Error('当前聊天已切换，请重新打开。');
      if (openingState(c).opening) throw Error('完成开场后可打开人物状态。');
      terminalBridge.close(); workshopBridge.close();
      const expected=key(c),floor=replyFloor(c),lease=await win.Cxx236Components?.acquire(floor);
      if(expected!==key(context())||!runtime?.active||floor!==replyFloor(context())){lease?.release();throw Error('聊天或回复已变化。');}
      statusBridge.open({ messageId: floor, lease });
    },
    async openWorkshop() {
      if (!coveredKey || coveredKey !== key(context())) throw Error('当前聊天已切换，请重新打开。');
      if (typeof win.CxxWorkshopWebsite?.open !== 'function') throw Error('请先启用本卡的创意工坊脚本。');
      win.CxxWorkshopWebsite.open();
    },
    sprite(characterId, expression, options) { return CxxGalSprites.sprite(characterId, CXX_GAL_MEDIA_BASE, expression, CXX_GAL_STANDING, options); },
    subscribe(callback) {
      function schedule(kind) {
        if (destroyed) return;
        const scheduledKey = observeScope(kind === 'chat'), epoch = scopeEpoch;
        if(kind==='ended'){clearTimeout(refreshTimer);refreshTimer=null;}
        if(kind==='draft'){callback(kind);return;}
        if (kind !== 'content') {          callback(kind);
          syncPanels();
          maybeRestore();
          return;
        }
        if (refreshTimer) return;
        const timer = setTimeout(() => {
          if (refreshTimer === timer) refreshTimer = null;
          if (destroyed) return;
          if (epoch !== scopeEpoch || key(context()) !== scheduledKey) { observeScope(); return; }          callback(kind);
          syncPanels();
          maybeRestore();
        }, 120);
        refreshTimer = timer;
      }
      const events = ctx.eventTypes;
      if (typeof iframe_events !== 'undefined' && iframe_events.GENERATION_REQUESTED) {
        const requested=(id,kind,config)=>{
          const latest=context().chat.at(-1);
          if(destroyed || !mvuScope || mvuScope!==key(context()) || !mvuBusy() || !latest || latest.is_user || latest.is_system ||
              !['generate','generateRaw'].includes(kind) || typeof id!=='string' || !id || config?.generation_id!==id || config?.user_input!=='遵循<must>指令' ||
              mvuAttempts.has(id))return;
          if(mvuTarget && (latest!==mvuTarget.message || latest.swipe_id!==mvuTarget.swipe || context().chat.length!==mvuTarget.count))return;
          mvuAttempts.add(id);mvuSeen=true;
          if(!mvuTarget)mvuTarget={message:latest,swipe:latest.swipe_id,raw:latest.mes,canonical:mvuSource(),count:context().chat.length};
          if(mvuRead && !mvuParsed){mvuRead=false;mvuChecks=0;}
          watchMvu();
        };
        eventOn(iframe_events.GENERATION_REQUESTED,requested);
        disposers.push(()=>eventRemoveListener(iframe_events.GENERATION_REQUESTED,requested));
      }
      if (typeof iframe_events !== 'undefined' && iframe_events.MESSAGE_IFRAME_RENDER_ENDED) {
        const frameReady = () => schedule('content');
        eventOn(iframe_events.MESSAGE_IFRAME_RENDER_ENDED, frameReady);
        disposers.push(() => eventRemoveListener(iframe_events.MESSAGE_IFRAME_RENDER_ENDED, frameReady));
      }
      // ST 1.19 awaits this event before prompt assembly. Do not use TH's async filter as a mode switch.
      const beforeGeneration = (type, options, dryRun) => {
        // ST 1.19 supplies this own field; TH 4.11.2 generate/generateRaw emit ('normal', {}).
        const native = options && Object.prototype.hasOwnProperty.call(options, 'automatic_trigger');
        const allowed = native && ['normal', 'regenerate', 'swipe', 'continue'].includes(type);
        if (runtime?.active && allowed && dryRun!==true) { const settingError = (mvuBusy() || (mvuScope===key(context()) && (mvuSaving || (mvuSeen && !mvuParsed && !mvuRead)))) ? 'MVU仍在计算或保存本轮数值，请等待结束后再发送。' : numericSettingsError(); if (settingError) { notify(settingError); throw Error(settingError); } }
        // The card's EJS generation entry owns the output-format contract.
      };
      if (events.GENERATION_AFTER_COMMANDS) {
        eventOn(events.GENERATION_AFTER_COMMANDS, beforeGeneration);
        disposers.push(() => eventRemoveListener(events.GENERATION_AFTER_COMMANDS, beforeGeneration));
      }
      const sharedFeed=win.Cxx233Runtime?.watchMessages?.(batch=>{if(batch.reasons?.some(r=>r==='data'||r==='scope'))schedule('content');});
      if(sharedFeed)disposers.push(sharedFeed);
      for (const [name, kind] of Object.entries({
        CHAT_CHANGED: 'chat', MESSAGE_SENT: 'sent', MESSAGE_RECEIVED: 'content', MESSAGE_SWIPED: 'content',
        MESSAGE_EDITED: 'content', MESSAGE_DELETED: 'content', MESSAGE_UPDATED: 'content',
        CHARACTER_MESSAGE_RENDERED: 'content', STREAM_TOKEN_RECEIVED: 'content',
        GENERATION_STARTED: 'status', GENERATION_STOPPED: 'ended', GENERATION_ENDED: 'ended',
      })) {
        if (!events[name]) continue;
        const handler = (type, options, dryRun) => {
          // ST prompt token counting emits this event without making a model request.
          if(name==='GENERATION_STARTED' && dryRun===true)return;
          if (['MESSAGE_SWIPED','MESSAGE_DELETED','MESSAGE_EDITED'].includes(name) && mvuScope && mvuSourceChanged()) { clearTimeout(mvuTimer); mvuTimer=null;mvuScope='';mvuSaving=false;mvuRound++;mvuStatus='回复或分支已变化，数值结果需要重新核对。'; }
          if (name === 'GENERATION_STARTED' && !mvuBusy()) { mvuRound++;mvuScope = key(context()); mvuTarget = null; mvuSeen = false; mvuParsed = false; mvuCommands = false; mvuRead = false; mvuSaving = false; statusNote(''); mvuChecks = 0; mvuAttempts.clear();mvuStatus = '主剧情正在生成…'; watchMvu(); }
          if(['CHAT_CHANGED','MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_SWIPED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_UPDATED'].includes(name))listRevision++;
          if(!sharedFeed||kind!=='content')schedule(kind);
        };
        eventOn(events[name], handler);
        disposers.push(() => eventRemoveListener(events[name], handler));
      }
      const nativeDraft = event => { if (event.target === input()) schedule('draft'); };
      doc.addEventListener('input', nativeDraft);
      disposers.push(() => doc.removeEventListener('input', nativeDraft));
      // ST 1.19 clears is_send_press after early stop events, then removes this flag.
      const generationObserver = new win.MutationObserver(() => schedule('status'));
      generationObserver.observe(doc.body, { attributes: true, attributeFilter: ['data-generating'] });
      disposers.push(() => generationObserver.disconnect());
      // Original terminal and workshop already create the updater. Lift its real
      // panel after the user's entry action, keeping one active tool at a time.
      const updates = new win.MutationObserver(records => {
        if (!coveredKey || coveredKey !== key(context()) || workshopBridge.mode === 'update') return;
        const selector = 'section[role="dialog"][aria-label="内容更新"]';
        const added = records.some(record => Array.from(record.addedNodes || []).some(node =>
          node.nodeType === 1 && (node.matches?.(selector) || node.querySelector?.(selector))));
        const panel = added && doc.querySelector(selector);
        if (!panel) return;
        terminalBridge.close(); statusBridge.close();
        // Current updater owns its top-layer panel; only lift legacy panels.
        if(panel.matches(':popover-open'))return;
        try { workshopBridge.openUpdate(panel); } catch (e) { notify(e.message); }
      });
      updates.observe(doc.body, { childList: true, subtree: true });
      disposers.push(() => updates.disconnect());
      return () => { clearTimeout(refreshTimer); clearTimeout(mvuTimer); disposers.splice(0).forEach(fn => fn()); };
    },
  };
  function openNativeTerminal(event) {
    const frame = event.detail?.frame, c = context();
    // Native play is owned by the independent helper. Gal handles its own open panel only.
    if (event.defaultPrevented || destroyed || !coveredKey || coveredKey !== key(c) || !frame || frame.ownerDocument !== doc ||
        (!doc.getElementById('chat')?.contains(frame)&&!frame.matches?.('[data-cxx-component]'))) return;
    if ((frame.closest('.mes')?.getAttribute('mesid')??frame.dataset.cxxFloor) !== String(replyFloor(c))) {
      event.preventDefault(); notify('请从最新回复打开终端，以便读取当前进度。'); return;
    }
    try {
      if (!frame.contentDocument?.getElementById('t2051x-fab')) return;
      adapter.openTerminal(); event.preventDefault();
    } catch (error) { notify(error.message); }
  }
  doc.addEventListener('cxx:open-native-terminal', openNativeTerminal);
  runtime = CxxGalController.create({ adapter, parser: CxxGalParser,
    mount: callbacks => CxxGalUI.mount({ document: doc, parent: doc.body, ...callbacks,
      onMap: () => {try{const c=context();if(!key(c)||coveredKey!==key(c))throw Error('当前聊天已切换。');if(openingState(c).opening)throw Error('请先完成开局配置。');if(!win.CxxAtlasTool)throw Error('地图服务尚未就绪。');statusBridge.close();workshopBridge.close();win.CxxAtlasTool.open();}catch(error){notify(error.message);}},
      onNativeOpening: () => { try { adapter.openOpening(); } catch (error) { notify(error.message); } },
      onOpeningSelection: () => originalOpening.close(),
      onMediaRefresh: () => {if(!mediaPending){mediaStamp='';mediaError='';}runtime?.refresh();},
      onChooseOrigin: () => win.Cxx236OpeningHost?.open(),
      onMigration: () => {try{const updater=parent.Cxx233Updater;if(updater?.openPanel){updater.openPanel('migration');return;}if(!CxxContent.request('migration'))notify('请启用“更新与存档”脚本后重试。');}catch(error){notify(error.message);}} }) });
  const layers=win.__cxx_ui_layers__||globalThis.CxxUILayers?.forWindow(win);const setReader=enabled=>{if(enabled&&!runtime.active)runtime.open({remember:false});else if(!enabled&&runtime.active)runtime.close();};const stopReader=layers?.registerReader(setReader);const openGal = () => {saveMode(readyKey,true);if(layers)layers.reading(true);else runtime.open();};
  const applyChatPreference236 = () => {
    if(destroyed || !readyKey || key(context())!==readyKey)return;
    const result=win.Cxx236Preferences?{ok:true,enabled:win.Cxx236Preferences.read().gal}:mode.read(readyKey);if(!result.ok)return;
    modeAttempted=true;
    if(layers)layers.reading(result.enabled);else setReader(result.enabled);
  };
  win.addEventListener('cxx-ui-preferences-changed',applyChatPreference236);
  const openingCompleted = () => runtime?.refresh();
  win.addEventListener('cxx-opening-completed',openingCompleted);
  if (typeof getButtonEvent === 'function') {
    const buttonEvent = getButtonEvent('Gal 模式');
    eventOn(buttonEvent, openGal);
    disposers.push(() => eventRemoveListener(buttonEvent, openGal));
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; stopReader?.();runtime.destroy(); originalOpening.destroy(); workshopBridge.destroy(); statusBridge.destroy(); terminalBridge.destroy(); style.remove();
    doc.removeEventListener('cxx:open-native-terminal', openNativeTerminal);
    win.removeEventListener('cxx-ui-preferences-changed',applyChatPreference236);
    win.removeEventListener('cxx-opening-completed',openingCompleted);
    window.removeEventListener('pagehide', destroy);
    if (win[slot]?.destroy === destroy) delete win[slot];
  }
  win[slot] = { destroy, open:openGal, active:()=>runtime.active,version: CXX_GAL_REVISION, numericBusy: busy, nativeSendReady, background:scene=>adapter.background(scene) };
  window.addEventListener('pagehide', destroy, { once: true });
  maybeRestore();
})();
