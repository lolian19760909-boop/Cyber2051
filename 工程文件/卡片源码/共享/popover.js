(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxPopover=api;})(globalThis,function(){
  'use strict';
  function isOpen(node) {
    if (typeof node?.showPopover !== 'function' || typeof node?.hidePopover !== 'function') return false;
    try { return node.matches(':popover-open'); } catch { return false; }
  }
  function show(node) {
    if (typeof node.showPopover === 'function' && typeof node.hidePopover === 'function') {
      node.setAttribute('popover', 'manual');
      try { if (!node.matches(':popover-open')) node.showPopover(); return true; } catch {}
    }
    node.removeAttribute('popover');
    return false;
  }
  function hide(node) { if (isOpen(node)) node.hidePopover(); }
  return { isOpen, show, hide };
});
