/* Both readers attach the same live opening surface. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxGalOpeningView=api;})(globalThis,function(){
 'use strict';
 function mount({document:doc,parent}){const host=doc.defaultView.Cxx236OpeningHost;if(!host)throw Error('开场服务尚未就绪，请稍候重新打开。');return host.mount(parent);}
 return {mount};
});
