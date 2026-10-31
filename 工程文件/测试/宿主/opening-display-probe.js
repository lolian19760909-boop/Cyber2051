/* Temporary, read-only opening display probe. No chat/card/storage writes. */
(function () {
  'use strict';
  const selector = '#chat .mes[mesid="0"] [data-cxx-opening]';
  const attempt = fn => { try { return fn(); } catch (e) { return { probeError: String(e.message || e) }; } };
  function geometry(win, node) {
    if (!node) return null;
    const r = node.getBoundingClientRect(), s = win.getComputedStyle(node);
    return {
      connected: !!node.isConnected, hidden: !!node.hidden, inert: !!node.inert,
      display: s.display, visibility: s.visibility, opacity: s.opacity, position: s.position, zIndex: s.zIndex,
      left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height),
      right: Math.round(r.right), bottom: Math.round(r.bottom),
      parent: node.parentElement?.tagName || null,
      hiddenAncestors: ancestors(win, node)
    };
  }
  function ancestors(win, node) {
    const rows = [];
    for (let p = node.parentElement, i = 0; p && i < 12; p = p.parentElement, i++) {
      const s = win.getComputedStyle(p);
      if (p.hidden || p.inert || s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0')
        rows.push({ tag: p.tagName, id: p.id || '', hidden: !!p.hidden, inert: !!p.inert, display: s.display, visibility: s.visibility, opacity: s.opacity });
    }
    return rows;
  }
  function capture(win, api) {
    const doc = win.document, rt = win.Cxx233Runtime, opening = win.Cxx236OpeningHost;
    const c = attempt(() => (api.SillyTavern || win.SillyTavern).getContext());
    const rows = Array.isArray(c?.chat) ? c.chat : [], first = rows[0];
    const key = attempt(() => rt?.key?.()), chatId = attempt(() => c?.getCurrentChatId?.());
    const currentAvatar = c?.characters?.[c.characterId]?.avatar;
    const state = attempt(() => opening?.state?.()), stats = attempt(() => opening?.stats?.());
    const getVariables = api.getVariables || win.TavernHelper?.getVariables;
    const vars = attempt(() => getVariables?.({ type: 'chat' }));
    const id = first?.swipe_id, identity = vars?.__cxx_identity;
    const roots = [...doc.querySelectorAll('.cxx-opening-flow')];
    const page = Number(/^<OpeningPage id="(\d{1,2})"\/>[ \t]*(?:\r?\n|$)/.exec(first?.mes || '')?.[1]);
    const marker = /^<OpeningForm\/>[ \t]*(?:\r?\n|$)/.test(first?.mes || '') ? 0 : page > 0 && page < 25 ? page : null;
    const chat = doc.getElementById('chat'), placeholder = doc.querySelector(selector);
    const topAtView = roots.map(n => {
      const r = n.getBoundingClientRect();
      if (n.hidden || !r.width || !r.height) return null;
      const hit = doc.elementFromPoint(Math.max(0, Math.min(win.innerWidth - 1, r.left + r.width / 2)), Math.max(0, Math.min(win.innerHeight - 1, r.top + r.height / 2)));
      return { belongsToOpening: !!hit && n.contains(hit), tag: hit?.tagName || null, id: hit?.id || '', className: typeof hit?.className === 'string' ? hit.className.slice(0, 120) : '' };
    });
    return {
      probe: 'opening-display-20261014', at: new Date().toISOString(),
      build: attempt(() => win.CxxResources?.read?.()?.cardBuild) || null,
      viewport: { width: win.innerWidth, height: win.innerHeight, secureContext: win.isSecureContext },
      services: { runtime: !!rt, alive: rt?.alive, player: !!win.__cxx_player__, preferences: !!win.Cxx236Preferences, creation: !!opening },
      scope: { contextError: c?.probeError || null, runtimeKeyPresent: typeof key === 'string' && !!key,
        keyError: key?.probeError || null, chatIdPresent: !!chatId && !chatId.probeError,
        currentAvatarPresent: !!currentAvatar, runtimeOwnerPresent: !!rt?.owner,
        ownerMatchesCurrent: !!currentAvatar && rt?.owner === currentAvatar, group: !!c?.groupId,
        messageCount: rows.length, userMessageCount: rows.filter(m => m?.is_user).length,
        firstOpeningId: marker,
        firstSwipe: id ?? null, readingScenarioMatches: [17, 18, 19].includes(id) && identity?.openingScenario === id,
        readingGrowth: !!first?.variables?.[id]?.stat_data?.terminal?.gameplay?.growth,
        variablesError: vars?.probeError || null },
      opening: { statePresent: !!state && !state.probeError, stateError: state?.probeError || null,
        status: state?.status || null, step: state?.draft?.step || null, busy: !!state?.busy,
        stats: stats || null, startup: attempt(() => win.CxxOpeningStartup?.read?.()) || null },
      layout: { menuActive: attempt(() => !!win.__cxx_launcher__?.active?.()),
        galActive: doc.body.getAttribute('data-cxx-gal-active') === '1',
        placeholderCount: doc.querySelectorAll('[data-cxx-opening]').length,
        exactPlaceholder: geometry(win, placeholder), chat: geometry(win, chat),
        editing: !!placeholder?.closest('.mes')?.querySelector('.edit_textarea,#curEditTextarea'),
        surfaces: roots.map(n => geometry(win, n)), topAtView,
        menus: [...doc.querySelectorAll('.cxx-game-menu')].map(n => geometry(win, n)) }
    };
  }
  function diagnose(r) {
    if (!r.services.creation) return '创建服务未注册';
    if (!r.scope.runtimeKeyPresent) return '当前聊天未通过运行范围识别；查看 scope 中聊天ID、角色归属及分组字段';
    if (r.scope.firstOpeningId === null) return '当前第0楼原文没有被识别为短开场标记';
    if (r.scope.userMessageCount) return '当前聊天已有玩家消息，自动开场入口不再满足条件';
    if (r.scope.readingScenarioMatches && r.scope.readingGrowth && (!r.opening.statePresent || r.opening.status === 'saved')) return '该开局已经保存，当前处于阅读阶段';
    if (!r.opening.statePresent) return '创建服务已注册，但尚未建立开场流程；查看 player/preferences/startup';
    if (r.layout.menuActive === true) return '主菜单仍被判定为打开，原生开场被隐藏；查看 menus 的实际显示状态';
    if (r.layout.galActive) return '当前处于Gal模式；原生开场会隐藏';
    if (!r.layout.exactPlaceholder) return '占位存在，但不在开场代码要求的第0楼DOM位置';
    if (!r.layout.chat?.height) return '聊天容器高度为0，未通过开场显示条件';
    if (r.layout.editing) return '第0楼处于编辑模式，开场暂时隐藏';
    const n = r.layout.exactPlaceholder, c = r.layout.chat;
    if (!n.width || n.top >= c.bottom || n.bottom <= c.top) return '开场占位不在代码计算的聊天可见区域';
    if (!r.layout.surfaces.length) return '流程存在，但没有找到正式开场DOM';
    if (r.layout.surfaces.every(s => s.hidden || s.display === 'none' || s.visibility === 'hidden')) return '正式开场DOM已创建，但仍被隐藏';
    if (r.layout.surfaces.some(s => s.hiddenAncestors?.length)) return '正式开场的上级容器被隐藏或冻结';
    if (r.layout.topAtView.some(h => h && !h.belongsToOpening)) return '正式开场中心位置被其他界面覆盖';
    return '开场DOM已显示；需结合 layout 中尺寸、层级和现场截图继续判断';
  }
  if (typeof module === 'object' && module.exports) { module.exports = { capture, diagnose }; return; }
  const win = window.parent || window, doc = win.document;
  const old = doc.getElementById('cxx-opening-display-probe');
  old?.remove();
  const box = doc.createElement('section'); box.id = 'cxx-opening-display-probe';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '2051开场显示诊断');
  box.style.cssText = 'position:fixed;inset:8px;z-index:2147483647;background:#15121a;color:#eee;padding:16px;box-sizing:border-box;overflow:auto;font:16px/1.5 sans-serif;border:2px solid #8ad5dc;';
  const title = doc.createElement('h2'); title.textContent = '2051 开场显示诊断（只读）'; box.append(title);
  const note = doc.createElement('p'); box.append(note);
  const output = doc.createElement('textarea'); output.readOnly = true;
  output.style.cssText = 'display:block;width:100%;height:55vh;box-sizing:border-box;background:#090a0d;color:#eee;font:13px/1.4 monospace;'; box.append(output);
  function refresh() {
    const before = box.style.display; box.style.display = 'none';
    try { const r = capture(win, globalThis); note.textContent = diagnose(r); output.value = JSON.stringify(r, null, 2); }
    catch (e) { note.textContent = '诊断脚本读取失败'; output.value = String(e.stack || e); }
    finally { box.style.display = before; }
  }
  function button(text, action) { const b = doc.createElement('button'); b.type = 'button'; b.textContent = text;
    b.style.cssText = 'min-height:44px;padding:10px 16px;margin:8px 8px 0 0;background:#253a3d;color:#fff;border:1px solid #8ad5dc;font:16px sans-serif;'; b.onclick = action; box.append(b); }
  button('刷新诊断', refresh);
  button('复制诊断', async () => { refresh(); try { await win.navigator.clipboard.writeText(note.textContent + '\n' + output.value); note.textContent = '已复制，请发给作者。'; }
    catch { output.focus(); output.select(); note.textContent = '请长按上面的内容，全选并复制。'; } });
  button('关闭', () => box.remove()); doc.body.append(box); refresh();
  window.addEventListener('pagehide', () => box.remove(), { once: true });
})();
