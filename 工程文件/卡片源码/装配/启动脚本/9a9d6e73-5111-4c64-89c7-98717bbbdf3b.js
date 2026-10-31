// 创意工坊入口：确认后前往官网；旧本地投稿草稿只读导出。
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  const host = root.parent || root;
  function init() {
    try { root.__CXX_SHOP_RUNTIME__?.destroy?.(); host.CxxWorkshopWebsite?.destroy?.(); } catch {}
    const launcher = api.create({ document: host.document, storage: root.localStorage, window: host });
    const button = eventOn(getButtonEvent('创意工坊'), launcher.open);
    const chat = eventOn(tavern_events.CHAT_CHANGED, launcher.close);
    let disposed = false;
    const runtime = { open: launcher.open, close: launcher.close, destroy() {
      if (disposed) return; disposed = true;
      button.stop(); chat.stop(); launcher.close();
      root.removeEventListener('pagehide', runtime.destroy);
      if (host.CxxWorkshopWebsite === runtime) delete host.CxxWorkshopWebsite;
      if (root.__CXX_SHOP_RUNTIME__ === runtime) delete root.__CXX_SHOP_RUNTIME__;
    } };
    host.CxxWorkshopWebsite = root.__CXX_SHOP_RUNTIME__ = runtime;
    root.addEventListener('pagehide', runtime.destroy, { once: true });
  }
  $(init);
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const URL = 'https://cyber2051.top/workshop.html';
  const DRAFT_KEY = 'cxx-shop-draft';
  function create({ document: doc, storage, window: win }) {
    let dialog = null, previousFocus = null;
    function close() {
      if (!dialog) return;
      const old = dialog; dialog = null;
      old.remove(); previousFocus?.focus?.({ preventScroll: true }); previousFocus = null;
    }
    function open() {
      if (dialog) { dialog.querySelector('a').focus(); return; }
      previousFocus = doc.activeElement;
      const el = (tag, text) => { const node = doc.createElement(tag); if (text) node.textContent = text; return node; };
      dialog = el('dialog'); dialog.id = 'cxx-workshop-website';
      dialog.setAttribute('aria-labelledby', 'cxx-workshop-website-title');
      dialog.style.cssText = 'box-sizing:border-box;width:min(430px,calc(100vw - 32px));padding:24px;border:1px solid #546571;border-radius:12px;background:#141c23;color:#edf3f6;box-shadow:0 16px 60px #0009;font:15px/1.65 sans-serif;';
      const title = el('h2', '前往官网创意工坊？'); title.id = 'cxx-workshop-website-title'; title.style.cssText = 'font-size:20px;margin:0 0 12px';
      const description = el('p', '将在新标签页打开 cyber2051.top，在网站浏览作品、填写投稿和管理改稿。');
      const actions = el('div'); actions.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:18px';
      const link = el('a', '前往官网'); link.href = URL; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const cancel = el('button', '取消'); cancel.type = 'button';
      const buttonStyle = 'display:inline-block;padding:8px 16px;border:1px solid #71838c;border-radius:6px;background:#24323b;color:#edf3f6;text-decoration:none;font:inherit;cursor:pointer';
      link.style.cssText = cancel.style.cssText = buttonStyle;
      link.addEventListener('click', () => { const opened = dialog; win.setTimeout(() => { if (dialog === opened) close(); }, 0); });
      cancel.addEventListener('click', close);
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      actions.append(link, cancel); dialog.append(title, description, actions);
      let draft = null; try { draft = storage.getItem(DRAFT_KEY); } catch {}
      if (draft !== null) {
        const exportDraft = el('button', '导出旧投稿草稿'); exportDraft.type = 'button'; exportDraft.style.cssText = buttonStyle + ';margin-top:14px';
        exportDraft.addEventListener('click', () => {
          const url = win.URL.createObjectURL(new win.Blob([draft], { type: 'application/json;charset=utf-8' }));
          const download = el('a'); download.href = url; download.download = '东京都2051-旧投稿草稿.json';
          doc.body.append(download); download.click(); download.remove();
          win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
        });
        dialog.append(exportDraft);
      }
      doc.body.append(dialog); dialog.showModal(); cancel.focus();
    }
    return { open, close };
  }
  return { create, URL, DRAFT_KEY };
});
