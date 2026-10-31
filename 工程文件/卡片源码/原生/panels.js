(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Cxx249Panels=api;})(globalThis,function(){
 'use strict';
 function mount(doc){const style=doc.createElement('style');style.dataset.cxxPanelPolish='249';style.textContent=`
 section[role="dialog"][aria-label="内容更新"]{--cxx-panel-line:#69414c;--cxx-panel-accent:#e45072}
 section[role="dialog"][aria-label="内容更新"] :is(h2,h3){line-height:1.5;letter-spacing:.06em;overflow-wrap:anywhere}
 section[role="dialog"][aria-label="内容更新"] :is(button,input,select){min-height:44px;box-sizing:border-box}
 section[role="dialog"][aria-label="内容更新"] :is(button,input,select,a):focus-visible{outline:2px solid var(--cxx-panel-accent);outline-offset:2px}
 section[role="dialog"][aria-label="内容更新"] p{line-height:1.75}
 `;doc.head.append(style);return {destroy:()=>style.remove()};}
 return {mount};
});
