/* Display the original helper001 workshop and helper002 update panel, without moving business DOM.
 * TH 4.11.2: getAllEnabledScriptButtons()[scriptId] supplies button_id; eventEmit(button_id)
 * matches src/panel/Script.vue. getButtonEvent() would resolve the caller's own script instead.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxGalWorkshop = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const Popover=typeof module==='object'&&module.exports?require('../共享/popover.js'):globalThis.CxxPopover;
  const SCRIPT_ID = '9a9d6e73-5111-4c64-89c7-98717bbbdf3b';
  const FRAME = 'iframe[id="TH-script--创意工坊--' + SCRIPT_ID + '"]';
  const UPDATE = 'section[role="dialog"][aria-label="内容更新"]';
  const MARKER = 'data-cxx-gal-workshop';
  let sequence = 0;

  // helper001 has no panel ID. Its old shell lives in the exact script frame; the new shell is a body child in its parent.
  function workshopPanels(inner) {
    const matches = [];
    for (const root of inner?.body?.children || []) {
      const panel = root.children?.[0], head = panel?.children?.[0], tabs = panel?.children?.[1];
      if (root.tagName !== 'DIV' || root.children.length !== 1 || panel?.children?.length !== 4 ||
          head?.children?.[0]?.textContent?.trim() !== '创意工坊') continue;
      const closeButton = [...head.children].find(node => node.tagName === 'BUTTON' && node.textContent.trim() === '✕');
      const labels = [...(tabs?.children || [])].filter(node => node.tagName === 'BUTTON').map(node => node.textContent.trim());
      if (closeButton && labels.join('|') === '目录|投稿|我的') matches.push({ root, panel, closeButton });
    }
    return matches;
  }
  function updateClose(panel) {
    return [...(panel?.querySelectorAll('button') || [])].find(button => button.textContent.trim() === '关闭');
  }
  function create({ document: doc, getAllEnabledScriptButtons, eventEmit, isCurrent = () => true, onClose }) {
    const win = doc.defaultView, token = String(++sequence);
    let entry = null, disposed = false, pending = null, lastOperation = null, wait = null;
    const current = () => { try { return !disposed && isCurrent(); } catch (_) { return false; } };
    const updatePanel = () => {
      const panels = [...doc.querySelectorAll(UPDATE)].filter(panel => panel.parentElement === doc.body);
      return panels.length === 1 ? panels[0] : null;
    };
    function restore(node, name, value) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); }
    function sourceCurrent(view) {
      try { return view.frame.isConnected && view.frame.contentDocument === view.inner; } catch (_) { return false; }
    }
    function candidates(owner) {
      return [owner.inner, doc].flatMap(scope => workshopPanels(scope).map(shell => ({
        kind: 'workshop', frame: owner.frame, inner: owner.inner, parentPanel: scope === doc,
        target: scope === doc ? shell.root : owner.frame, keyDocument: scope, ...shell,
      })));
    }
    function findOwned(operation) {
      if (!sourceCurrent(operation)) return null;
      const found = candidates(operation);
      if (found.length > 1) throw Error('找到多个工坊面板，无法确定本次打开的原面板。');
      const view = found[0];
      return view && !operation.before.has(view.root) ? view : null;
    }
    function cancelPending(operation) {
      // The native close handler owns helper001's current ui. Never call an older operation's handler after a newer open.
      if (!operation || lastOperation !== operation) return;
      try { const view = findOwned(operation); if (view) nativeClose(view); } catch (_) { /* Ambiguous or unloading: do not pick a shell. */ }
    }
    function nativeClose(view) {
      if (view.kind === 'workshop') {
        if (sourceCurrent(view) && view.root.isConnected) view.closeButton.click();
      } else if (view.target.isConnected) updateClose(view.target)?.click();
    }
    function release(view, notify, closeNative, reason) {
      if (entry !== view) return;
      entry = null;
      view.hostObserver?.disconnect(); view.innerObserver?.disconnect();
      win.removeEventListener('resize', view.resize);
      view.target.removeEventListener('toggle', view.toggle);
      view.frame?.removeEventListener('load', view.load);
      view.inner?.defaultView?.removeEventListener('pagehide', view.unload);
      view.keyDocument.removeEventListener('keydown', view.keydown);
      if (closeNative) { try { nativeClose(view); } catch (_) { /* The original frame may be unloading. */ } }
      try { if (Popover.isOpen(view.target)) view.target.hidePopover(); } catch (_) {}
      view.style?.remove();
      restore(view.target, 'popover', view.popover); restore(view.target, MARKER, view.marker);
      if (current() && view.previousFocus?.isConnected) view.previousFocus.focus?.({ preventScroll: true });
      if (notify && typeof onClose === 'function') onClose(reason);
    }
    function close() {
      const operation = pending; pending = null;
      cancelPending(operation);
      if (wait) { win.clearTimeout(wait.timer); const resolve = wait.resolve; wait = null; resolve(); }
      if (entry) release(entry, false, true, 'close');
    }
    function promote(view) {
      const target = view.target;
      if (!current()) throw Error('聊天已切换，工坊接入已取消。');
      if (typeof target.showPopover !== 'function' || typeof target.hidePopover !== 'function' || typeof win?.MutationObserver !== 'function') {
        throw Error('当前浏览器不支持工坊显示接入。');
      }
      if (Popover.isOpen(target) || target.hasAttribute(MARKER)) throw Error('这个面板正在其他界面中使用。');
      Object.assign(view, { popover: target.getAttribute('popover'), marker: target.getAttribute(MARKER), previousFocus: doc.activeElement });
      entry = view;
      try {
        view.style = doc.createElement('style'); doc.head.append(view.style);
        view.resize = () => {
          const bottom = doc.querySelector('#cxx-galgame-root .cxx-gal-header')?.getBoundingClientRect().bottom;
          const top = Number.isFinite(bottom) && bottom >= 0 ? Math.ceil(bottom) : 80;
          const geometry = view.kind === 'workshop'
            ? `inset:${top}px 0 0!important;margin:0!important;padding:0!important;border:0!important;width:100vw!important;width:100dvw!important;height:calc(100vh - ${top}px)!important;height:calc(100dvh - ${top}px)!important;max-width:none!important;max-height:none!important;${view.parentPanel ? 'align-items:center!important;justify-content:center!important;overflow:hidden!important;' : 'background:transparent!important;'}`
            : `top:${top + 8}px!important;bottom:12px!important;max-height:calc(100dvh - ${top + 20}px)!important;`;
          view.style.textContent = `[${MARKER}="${token}"]{position:fixed!important;display:${view.parentPanel ? 'flex' : 'block'}!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;transform:none!important;box-sizing:border-box!important;min-width:0!important;min-height:0!important;z-index:2147483647!important;${geometry}}` +
            (view.parentPanel ? `[${MARKER}="${token}"]>div{max-height:100%!important;min-height:0!important;box-sizing:border-box!important;overflow:auto!important;flex-shrink:1!important;}` : '');
        };
        view.keydown = event => {
          if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229 || event.defaultPrevented || view.keyDocument.querySelector('dialog[open]')) return;
          event.preventDefault(); release(view, true, true, 'escape');
        };
        view.toggle = event => { if (entry === view && event.newState === 'closed' && !Popover.isOpen(target)) release(view, true, true, 'closed'); };
        view.load = () => release(view, true, false, 'unloaded');
        view.unload = () => release(view, true, true, 'unloaded');
        target.setAttribute(MARKER, token); target.setAttribute('popover', 'manual');
        view.resize(); target.showPopover();
        target.addEventListener('toggle', view.toggle); view.frame?.addEventListener('load', view.load);
        view.inner?.defaultView?.addEventListener('pagehide', view.unload);
        view.keyDocument.addEventListener('keydown', view.keydown); win.addEventListener('resize', view.resize);
        const inspect = () => {
          if (entry !== view) return;
          if (!current()) return release(view, true, true, 'context');
          if (view.kind === 'workshop') {
            const updates = updatePanel();
            if (updates && updateClose(updates)) { openUpdate(updates); return; }
            if (!sourceCurrent(view)) return release(view, true, false, 'unloaded');
            if (!view.root.isConnected) release(view, true, false, 'closed');
          } else if (!target.isConnected) release(view, true, false, 'closed');
        };
        view.hostObserver = new win.MutationObserver(inspect);
        view.hostObserver.observe(doc.body, { childList: true, subtree: true });
        if (view.kind === 'workshop') {
          if (!view.parentPanel) {
            view.innerObserver = new win.MutationObserver(inspect);
            view.innerObserver.observe(view.inner.body, { childList: true, subtree: true });
          }
          view.closeButton.focus({ preventScroll: true });
        } else target.focus({ preventScroll: true });
        return true;
      } catch (error) {
        release(view, false, true, 'failed');
        throw Error(error?.message || '工坊面板未能打开，Gal 对话已保留。');
      }
    }
    function openUpdate(panel) {
      if (!current()) throw Error('聊天已切换，更新面板接入已取消。');
      if (entry?.kind === 'update' && entry.target === panel && panel.isConnected) return true;
      if (!panel || panel.ownerDocument !== doc || panel.parentElement !== doc.body || panel !== updatePanel() || !updateClose(panel)) {
        throw Error('没有找到已加载的原内容更新面板。');
      }
      close();
      return promote({ kind: 'update', target: panel, keyDocument: doc });
    }
    async function open() {
      if (!current()) throw Error('当前聊天不可用，请重新打开 Gal。');
      if (entry?.kind === 'workshop' && entry.root.isConnected && sourceCurrent(entry)) return true;
      if (pending) throw Error('工坊正在打开，请等待本次加载完成。');
      if (typeof getAllEnabledScriptButtons !== 'function' || typeof eventEmit !== 'function') throw Error('当前酒馆助手不支持读取工坊按钮。');
      const button = getAllEnabledScriptButtons()?.[SCRIPT_ID]?.find(item => item.button_name === '创意工坊');
      if (!button || typeof button.button_id !== 'string' || !button.button_id) throw Error('请先启用本卡的创意工坊脚本与按钮。');
      close();
      const frames = [...doc.querySelectorAll(FRAME)];
      if (frames.length !== 1) throw Error('没有找到唯一的原创意工坊脚本。');
      let inner;
      try { inner = frames[0].contentDocument; } catch (_) {}
      if (!inner?.body) throw Error('没有找到已加载的原创意工坊脚本。');
      const owner = { frame: frames[0], inner }, before = candidates(owner);
      if (before.length > 1) throw Error('找到多个工坊面板，无法确定原面板。');
      if (before.some(view => Popover.isOpen(view.target) || view.target.hasAttribute(MARKER))) throw Error('这个面板正在其他界面中使用。');
      const oldUpdate = updatePanel();
      if (oldUpdate) {
        if (Popover.isOpen(oldUpdate) || oldUpdate.hasAttribute(MARKER)) throw Error('内容更新面板正在其他界面中使用。');
        updateClose(oldUpdate)?.click();
      }
      const operation = { ...owner, before: new Set(before.map(view => view.root)) };
      lastOperation = operation; pending = operation;
      try {
        await eventEmit(button.button_id);
        for (let attempt = 0; attempt < 40; attempt++) {
          if (pending !== operation || !current() || !sourceCurrent(operation)) throw Error('聊天或界面已切换，工坊接入已取消。');
          const view = findOwned(operation);
          if (inner.readyState !== 'loading' && view) return promote(view);
          await new Promise(resolve => {
            const waiting = { resolve, timer: win.setTimeout(() => { if (wait === waiting) wait = null; resolve(); }, 50) };
            wait = waiting;
          });
        }
        throw Error('没有找到已加载的原工坊面板；请检查创意工坊脚本是否启动。');
      } catch (error) { cancelPending(operation); throw error; }
      finally { if (pending === operation) pending = null; }
    }
    function destroy() { close(); disposed = true; win.removeEventListener('pagehide', destroy); }
    win.addEventListener('pagehide', destroy);
    return { open, openUpdate, close, destroy,
      get active() { return Boolean(entry || pending); }, get mode() { return entry?.kind || (pending ? 'workshop' : null); } };
  }
  return { create };
});
