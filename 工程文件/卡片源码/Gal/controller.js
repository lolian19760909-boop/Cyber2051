/* G1: view state only; native messages and draft remain authoritative. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./sprites.js') : root.CxxGalSprites);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxGalController = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sprites) {
  'use strict';
  function create({ adapter, parser, mount }) {
    // 状态统一入口：本楼没有 stat_data（数据库接管后就是这样）时，仍按统一入口判断状态是否就绪。
    const liveState236 = () => {
      try {
        const api236 = globalThis.Cxx236State || globalThis.parent?.Cxx236State;
        if (!api236 || typeof api236.stat !== 'function') return null;
        const value = api236.stat();
        return value && value.terminal ? value : null;
      } catch (_) { return null; }
    };
    let view = null, chatKey = '', selected = null, paragraphIndex = 0;
    let follow = true, error = '', pending = false, disposed = false, sendTimer, lastChoice;
    let parsedRaw, parsed, parsedMessage, parsedSwipe,parseTask=null,parseSequence=0;
    const parseRevisions=new WeakMap(),parseNamespace=Date.now().toString(36)+Math.random().toString(36).slice(2);
    const positions = new Map(), ids = new WeakMap();
    let nextId = 0,indexedChat=null,indexedLength=-1,indexedRevision=-1,indexedOpening=null,indexedKey='',messages=[],floorNumbers=new Map(),messageSet=new Set(),labels=[];
    const idFor = message => {
      if (!ids.has(message)) ids.set(message, String(++nextId));
      return ids.get(message);
    };
    function remember() {
      if (!chatKey) return;
      positions.delete(chatKey);
      positions.set(chatKey, { selected, paragraphIndex, follow });
      if (positions.size > 20) positions.delete(positions.keys().next().value);
    }
    function resetPending() { pending = false; clearTimeout(sendTimer); }
    function close(reason) {
      globalThis.parent?.CxxReading?.stop();
      remember(); resetPending(); lastChoice = null;
      parseTask=null;parseSequence++;
      if (view) { view.destroy(); view = null; }
      adapter.cover(false); adapter.focusNative();
      if (reason) adapter.notify(reason);
    }
    function refresh() {
      if (disposed || !view) return;
      try {
        const snapshot = adapter.read();
        if (snapshot.key !== chatKey) { close(); return; }
        if(indexedKey!==snapshot.key||indexedChat!==snapshot.messages||indexedLength!==snapshot.messages.length||indexedRevision!==snapshot.listRevision||indexedOpening!==snapshot.openingMessage){
          indexedKey=snapshot.key;indexedChat=snapshot.messages;indexedLength=snapshot.messages.length;indexedRevision=snapshot.listRevision;indexedOpening=snapshot.openingMessage;
          messages=[];floorNumbers=new Map();labels=[];
          snapshot.messages.forEach((m,i)=>{floorNumbers.set(m,i);if(m!==snapshot.openingMessage&&!m.is_system&&typeof m.mes==='string'){messages.push(m);labels.push({id:idFor(m),label:i+' · '+(m.is_user?'你':m.name||'正文'),excerpt:parser.firstLine?.(m.mes)||''});}});messageSet=new Set(messages);
        }
        if (snapshot.busy) resetPending();
        // Streaming refreshes only the selected current body. Actions stay disabled until MVU is ready.
        const latest = messages[messages.length - 1];
        if (!messageSet.has(selected)) follow = true;
        if (follow) selected = latest || null;
        const mirrorSource=globalThis.parent?.CxxSource,floor=floorNumbers.get(selected),hostRaw=selected?.mes||'';
        const raw = selected&&!selected.is_user&&mirrorSource?mirrorSource.sync(floor):hostRaw;
        if(!snapshot.generating&&!snapshot.opening)view.beginReading?.({floor,scope:chatKey});
        if (parsedMessage !== selected || parsedRaw !== raw || parsedSwipe !== selected?.swipe_id) {
          const switched = parsedMessage !== selected || parsedSwipe !== selected?.swipe_id;
          const history=typeof globalThis!=='undefined'&&globalThis.parent?.Cxx249History;
          if(history&&selected){
            let source=parseRevisions.get(selected);if(!source||source.raw!==raw||source.swipe!==selected.swipe_id){source={raw,swipe:selected.swipe_id,revision:++parseSequence};parseRevisions.set(selected,source);}
            if(!parseTask||parseTask.source!==source||parseTask.message!==selected){const task=parseTask={source,message:selected,scope:chatKey,view};const valid=()=>!disposed&&view===task.view&&parseTask===task&&chatKey===task.scope&&selected===task.message&&selected.mes===hostRaw&&selected.swipe_id===source.swipe;
              const sharedSource=history.messageSource?.(selected,chatKey,'parse')||{key:'parse:'+parseNamespace+':'+chatKey+':'+idFor(selected),revision:source.revision,scope:chatKey};
              history.submit('parse',{raw},{...sharedSource,isCurrent:valid}).then(value=>{if(!valid())return;parsed=value;parsedRaw=raw;parsedMessage=task.message;parsedSwipe=source.swipe;parseTask=null;if(switched)paragraphIndex=0;refresh();}).catch(e=>{if(valid()){parseTask=null;if(e.code!=='cxx-history-stale'){if(view.readingFailed)view.readingFailed(e.message,refresh,{floor,scope:chatKey});else close('Gal 阅读失败，已恢复原生聊天。'+e.message);}}});
            }
            if(view.renderStream)view.renderStream({paragraphs:switched?[]:parsed?.paragraphs||[],paragraphIndex:switched?0:paragraphIndex,busy:true,canStop:snapshot.canStop,status:snapshot.generating?'正文正在生成…':'正在读取正文…'});
            else view.setBusy?.('正在读取正文…');
            return;
          }
          parsed = parser.parseMessage(raw,{key:selected?'gal:'+parseNamespace+':'+idFor(selected):'empty'});
          parsedRaw = raw; parsedMessage = selected; parsedSwipe = selected?.swipe_id;
          if (switched) paragraphIndex = 0;
        }
        paragraphIndex = Math.max(0, Math.min(paragraphIndex, Math.max(0, parsed.paragraphs.length - 1)));
        if(snapshot.generating && selected===latest && !selected?.is_user && view.renderStream){
          view.renderStream({paragraphs:parsed.paragraphs,paragraphIndex,busy:true,canStop:snapshot.canStop,status:snapshot.status||'正文正在生成…'});
          return;
        }
        if(snapshot.generating && selected!==latest && view.setBusy){view.setBusy(snapshot.status||'正文正在生成…');return;}
        const scene=adapter.resolveScene?adapter.resolveScene({floor:floorNumbers.get(selected),scene:parsed.scene}):parsed.scene;
        const backgroundInfo=adapter.backgroundInfo?.({floor,swipe:selected?.swipe_id||0,raw,scene});
        const projection=!selected?.is_user?globalThis.parent?.CxxReading?.project(mirrorSource?.peek(floor)?.snapshot):null;
        const illustration=selected&&!selected.is_user?globalThis.parent?.CxxPlot?.illustrationsAt?.(selected,floor)?.at(-1):null;
        view.render({
          opening: Boolean(snapshot.opening),
          openingMessage: snapshot.openingMessage,
          openingSwipe: snapshot.swipeId ?? snapshot.openingMessage?.swipe_id,
          openingRaw: snapshot.openingMessage?.mes,
          messages: labels,
          combat: selected ? adapter.readCombat?.(floorNumbers.get(selected)) || [] : [],
          storyCg: illustration || null,
          selectedFloor:selected?floorNumbers.get(selected):null, selectedId: selected ? idFor(selected) : '', paragraphs: selected?.is_user
            ? parsed.paragraphs.map(p=>({...p,speaker:selected.name||'用户',characterId:null})) : projection?.paragraphs||parsed.paragraphs,
          reading:projection?.reading,
          paragraphIndex, floor:floorNumbers.get(selected), swipe:selected?.swipe_id||0, scope:chatKey, choices: !snapshot.busy&&(selected?.variables?.[selected.swipe_id||0]?.stat_data||liveState236())?parsed.choices:[], scene,
          background: backgroundInfo?.value || adapter.background?.(scene), backgroundInfo,
          eventMedia: adapter.eventMedia?.() || [],
            eventMediaStatus: adapter.eventMediaStatus?.() || '',
          hud: adapter.readHud?.({ messageId: selected ? floorNumbers.get(selected) : null,
            scene: parsed.scene, characterId: selected?.is_user ? null : parsed.paragraphs[paragraphIndex]?.characterId, history: selected !== latest }),
          draft: snapshot.draft, busy: snapshot.busy || pending, canStop: snapshot.canStop, history: selected !== latest,
          sprites: selected?.is_user||illustration ? [] : sprites.select(parsed, paragraphIndex, (id, expression, options) => adapter.sprite?.(id, expression, options), adapter.battleBefore?.(floor) || {}),
          status: snapshot.status || (snapshot.busy ? '酒馆正在生成，结束后显示正文…' : pending ? '正在交给酒馆发送…' :
            parsed.warnings.length ? '部分标签无法识别，已保留原文。' : '草稿已同步'),
          error,
        });
      } catch (e) { if(e.sourceGuard){globalThis.parent?.CxxReading?.stop();view.setBusy?.(e.message);error=e.message;}else close('Gal 阅读失败，已恢复原生聊天。' + (e?.message || '')); }
    }
    function draft(text) {
      if (!view || adapter.read().key !== chatKey) return;
      adapter.setDraft(text);
    }
    async function send() {
      const snapshot = adapter.read();
      if (!view || snapshot.key !== chatKey || pending || snapshot.busy || !snapshot.draft.trim()) return;
      // ST 1.19 processCommands consumes slash input without MESSAGE_SENT.
      // Keep the saved Gal preference; reveal native dialogs before dispatch.
      if (snapshot.draft.trim().startsWith('/')) {
        close();
        try { await adapter.send(); }
        catch (e) { adapter.notify('酒馆指令未能提交：' + e.message + '；草稿保留在原生输入框。'); }
        return;
      }
      pending = true; error = ''; refresh();
      try {
        await adapter.send();
        if(!view||adapter.read().key!==chatKey)return;
        sendTimer = setTimeout(() => {
          if (!pending || !view) return;
          resetPending();
          error = '发送尚未确认。请返回原生界面查看连接或提示；草稿以原生输入框为准。';
          refresh();
        }, 4000);
      } catch (e) { resetPending(); error = e.message; refresh(); }
    }
    function open({ remember = true } = {}) {
      if (disposed) return;
      if (view) { refresh(); return; }
      const snapshot = adapter.read();
      if (!snapshot.key) { adapter.notify('请先打开一张角色卡的聊天。'); return; }
      chatKey = snapshot.key;
      const saved = positions.get(chatKey);
      selected = saved?.selected || null; paragraphIndex = saved?.paragraphIndex || 0; follow = saved?.follow ?? true;
      error = '';
      const openingKey = chatKey;
      let openingView;
      try {
        view = openingView = mount({
          onBackground: ({filename,key}) => {
            if(disposed||!view||adapter.read().key!==chatKey||!selected)return;
            try {
              const floor=floorNumbers.get(selected),raw=parsedRaw,scene=adapter.resolveScene?adapter.resolveScene({floor,scene:parsed.scene}):parsed.scene;
              const source={floor,swipe:selected.swipe_id||0,raw,scene};
              if(adapter.backgroundInfo?.(source)?.key!==key)throw Error('楼层或场景已变化，请重新选择背景。');
              adapter.setBackground(source,filename);error='';refresh();
            }catch(e){error=e.message;refresh();}
          },
          onClose: () => {
            if (disposed || !view || view !== openingView || chatKey !== openingKey) return;
            try { adapter.onUserClose?.(openingKey); }
            catch (e) { adapter.notify('Gal 开关未能保存：' + e.message); }
            finally { close(); }
          },
          onTerminal: () => {
            if (disposed || !view || adapter.read().key !== chatKey) return;
            try {
              if (typeof adapter.openTerminal !== 'function') throw Error('当前页面未载入终端，请在有状态栏的剧情楼层中打开。');
              adapter.openTerminal();
            } catch (e) { error = e.message; refresh(); }
          },
          onRead: continuous => {
            if(!view||!selected||selected.is_user||adapter.read().busy)return;
            const reader=globalThis.parent?.CxxReading;if(!reader){error='朗读服务尚未就绪。';refresh();return;}
            const current=selected,scope=chatKey;
            reader.play({floor:floorNumbers.get(selected),index:paragraphIndex,continuous,onPosition:index=>{if(view&&chatKey===scope&&selected===current){paragraphIndex=index;refresh();}}}).catch(e=>{if(view&&chatKey===scope){error=e.message;refresh();}});
          },
          onReadingMode:value=>globalThis.parent?.CxxReading?.setMode(value).then(refresh).catch(e=>{error=e.message;refresh();}),
          onReadTranslation:()=>{if(!selected||selected.is_user)return;globalThis.parent?.CxxReading?.play({floor:floorNumbers.get(selected),index:paragraphIndex,side:'reading'}).catch(e=>{error=e.message;refresh();});},
          onPlayer: async () => {if(disposed||!view||adapter.read().key!==chatKey)return;try{await adapter.openPlayer();}catch(e){error=e.message;refresh();}},
          onStatus: async () => {
            if (disposed || !view || adapter.read().key !== chatKey) return;
            try {
              if (typeof adapter.openStatus !== 'function') throw Error('当前页面未载入人物状态。');
              await adapter.openStatus();
            } catch (e) { error = e.message; refresh(); }
          },
          onWorkshop: async () => {
            if (disposed || !view || adapter.read().key !== chatKey) return;
            const openingKey = chatKey;
            const openingView = view;
            try {
              if (typeof adapter.openWorkshop !== 'function') throw Error('当前卡尚未启用创意工坊脚本。');
              await adapter.openWorkshop();
            } catch (e) {
              if (!disposed && view === openingView && chatKey === openingKey && adapter.read().key === openingKey) { error = e.message; refresh(); }
            }
          },
          onSend: send, onStop: () => {
            if (disposed || !view || adapter.read().key !== chatKey) return;
            resetPending(); adapter.stop(); refresh();
          }, onDraft: draft,
          onSelectMessage: id => {
            globalThis.parent?.CxxReading?.stop();
            const messages = adapter.read().messages;
            selected = messages.find(m => idFor(m) === String(id)) || null;
            follow = selected === messages.at(-1); paragraphIndex = 0; refresh();
          },
          onSelectParagraph: index => {globalThis.parent?.CxxReading?.stop();paragraphIndex = index; refresh(); },
          onChoice: text => {
            const snapshot = adapter.read();
            if(snapshot.busy||!(selected?.variables?.[selected.swipe_id||0]?.stat_data||liveState236()))return;
            if (disposed || !view || view !== openingView || snapshot.key !== chatKey) return;
            const current = snapshot.draft, now = Date.now();
            if (lastChoice && lastChoice.message === selected && lastChoice.swipe === selected?.swipe_id &&
                lastChoice.raw === parsedRaw && lastChoice.text === text && lastChoice.draft === current && now - lastChoice.at < 500) return;
            const next = current + (current && !/\s$/.test(current) ? '\n' : '') + text;
            draft(next);
            lastChoice = { message: selected, swipe: selected?.swipe_id, raw: parsedRaw, text, draft: next, at: now };
            refresh(); view?.focusInput();
          },
        });
        refresh();
        if (view) {
          adapter.cover(true);
          if (view === openingView && remember !== false) {
            try { adapter.onOpened?.(openingKey); }
            catch (e) { adapter.notify('Gal 开关未能保存：' + e.message); }
          }
        }
      } catch (e) { close('Gal 未能打开，原生聊天保留。' + e.message); }
    }
    const unsubscribe = adapter.subscribe(kind => {
      if(kind==='draft'){const snapshot=adapter.read();if(snapshot.key!==chatKey){if(view)close();return;}view?.updateDraft?.(snapshot.draft);return;}
      if (kind === 'sent' || kind === 'ended') resetPending();
      refresh();
    });
    const top=globalThis.parent;top?.addEventListener?.('cxx-source-changed',refresh);top?.addEventListener?.('cxx-reading-changed',refresh);
    return {
      open, close, refresh,
      focusTerminal() { view?.focusTerminal?.(); },
      focusStatus() { view?.focusStatus?.(); },
      focusWorkshop() { view?.focusWorkshop?.(); },
      get active() { return Boolean(view); },
      destroy() { if (disposed) return; close(); disposed = true; unsubscribe();top?.removeEventListener?.('cxx-source-changed',refresh);top?.removeEventListener?.('cxx-reading-changed',refresh); positions.clear(); },
    };
  }
  return { create };
});
