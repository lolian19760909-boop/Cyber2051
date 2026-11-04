// 游戏内工坊共用面板；旧本地投稿草稿保留导出。
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.CxxWorkshopClient=api;
  if(root.__cxxStandaloneUI)return;
  const host = root.parent || root;
  function init() {
    try { root.__CXX_SHOP_RUNTIME__?.destroy?.(); host.CxxWorkshopWebsite?.destroy?.(); } catch {}
    const updater=()=>{const value=host.Cxx233Updater;if(!value?.workshop)throw Error('内容服务尚未就绪，请稍后重试');return value;};
    const player=()=>{if(!host.__cxx_player__)throw Error('请先完成开局建档。');return host.__cxx_player__;};
    const service={play:{read:()=>player().workshop(),commit:async request=>{const p=player();await p.commit(request);await p.waitForSaved();}},read:options=>updater().workshop(options),command:value=>{const engine=updater();return engine.command({...value,instanceId:engine.host.readState().instanceId});}};
    const launcher = api.create({ document: host.document, storage: root.localStorage, window: host, service, panel:root.CxxWorkshopPanel, css:root.CxxWorkshopStyle });
    const buttonName=getButtonEvent('创意工坊'),chatName=tavern_events.CHAT_CHANGED;
    const open=()=>launcher.open().catch(e=>host.toastr?.error(e.message,'创意工坊'));
    eventOn(buttonName,open); eventOn(chatName,launcher.close);
    let disposed = false;
    const runtime = { open: launcher.open, close: launcher.close, destroy() {
      if (disposed) return; disposed = true;
      eventRemoveListener(buttonName,open); eventRemoveListener(chatName,launcher.close); launcher.destroy();
      root.removeEventListener('pagehide', runtime.destroy);
      if (host.CxxWorkshopWebsite === runtime) delete host.CxxWorkshopWebsite;
      if (root.__CXX_SHOP_RUNTIME__ === runtime) delete root.__CXX_SHOP_RUNTIME__;
    } };
    host.CxxWorkshopWebsite = root.__CXX_SHOP_RUNTIME__ = runtime;
    root.addEventListener('pagehide', runtime.destroy, { once: true });
  }
  $(init);
})(typeof window === 'undefined' ? globalThis : window, function (root) {
  'use strict';
  const URL = 'https://cyber2051.top/workshop.html';
  const DRAFT_KEY = 'cxx-shop-draft';
  function create({document:doc,storage,window:win,service,panel=root.CxxWorkshopPanel,css=''}){
    const view=panel.create({document:doc,service,css,url:URL});
    async function open(options){
      await view.open(options);const dialog=doc.getElementById('cxx-workshop');if(!dialog||dialog.querySelector('[data-legacy-draft]'))return;
      const draft=storage?.getItem(DRAFT_KEY);if(draft==null)return;
      const exportDraft=doc.createElement('button');exportDraft.type='button';exportDraft.textContent='导出旧投稿草稿';exportDraft.dataset.legacyDraft='';
      exportDraft.addEventListener('click',()=>{const url=win.URL.createObjectURL(new win.Blob([draft],{type:'application/json;charset=utf-8'})),download=doc.createElement('a');download.href=url;download.download='东京都2051-旧投稿草稿.json';doc.body.append(download);download.click();download.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);});dialog.append(exportDraft);
    }
    return {...view,open};
  }
  return { create, URL, DRAFT_KEY };
});
