/* Display the maintained opening iframe in place; never replay its business actions. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxGalOpeningBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Actual card slots: first_mes = 0; alternate/NNN.txt = NNN + 1; slot 25 is empty.
  // Both container and distinguishing child must exist. The two Umiri pages differ.
  const pages = [
    ['.di-wrap', '.di-start-btn'], ['.mn-wrap', '#mgoOverlay'],
    ['.sk-wrap', '.sk-btn'], ['.ae-wrap', '.ae-btn'],
    ['#uikaWrap', '#uikaEnding'], ['#takiWrap', '#takiOverlay'],
    ['.tomo-wrap', '#tomoOverlay'], ['.rana-wrap', '#ranaOverlay'],
    ['#umiriWrap', '.umiri-container', '#umiriOverlay'], ['#nyamuWrap', '#nyamuOverlay'],
    ['#mutsumiWrap', '#mutsumiOverlay'], ['#soyoWrap', '#soyoOverlay'],
    ['#sakikoWrap', '#sakikoOverlay'], ['#anonWrap', '#anonOverlay'],
    ['#tomoriWrap', '#tomoriOverlay'], ['#soyo2Wrap', '#soyo2Overlay'],
    ['#umiriWrap', '.umiri-poster', '#umiriOverlay'], ['.ring-wrap', '#ringHeroArea'],
    ['.asuka-wrap', '#asukaHeroArea'], ['.mygo-wrap', '#mygoPlayer'],
    ['#haruCard', '#haruConfirmBtn'], ['.dm-wrap', '#interactiveArea', '#confirmOverlay'],
    ['.bb-wrap', '.bb-btn'], ['#fuyuCard', '#fuyuConfirmBtn'],
    ['.lp-wrap', '#lpGo', '#lpSkip', '#lpCustom'],
  ];
  let sequence = 0;

  function isOpeningSource(text, swipeId) {
    if (typeof text !== 'string' || !Number.isInteger(swipeId) || !pages[swipeId]) return false;
    const short = globalThis.parent?.Cxx236OpeningMap?.pageId(text);
    if (short !== undefined && short !== null) return short === swipeId;
    const html = text.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    if (!/<body\b[^>]*>/i.test(html) || !/<\/body\s*>/i.test(html)) return false;
    const ids = new Set(), classes = new Set();
    for (const tag of html.matchAll(/<[a-z][^<>]*>/gi)) {
      for (const attr of tag[0].matchAll(/\s+([^\s"'<>/=]+)\s*=\s*(["'])(.*?)\2/g)) {
        if (attr[1].toLowerCase() === 'id') ids.add(attr[3]);
        else if (attr[1].toLowerCase() === 'class') attr[3].split(/\s+/).forEach(value => classes.add(value));
      }
    }
    return pages[swipeId].every(mark => (mark[0] === '#' ? ids : classes).has(mark.slice(1)));
  }

  function create({document:doc,isCurrent=()=>true}){
    let disposed=false;
    const open=()=>{if(disposed||!isCurrent())return false;doc.defaultView.Cxx236OpeningHost?.open();return true;};
    return {open,refresh(){},close(){},destroy(){disposed=true;},get active(){return false;}};
  }
  return { create, isOpeningSource };
});
