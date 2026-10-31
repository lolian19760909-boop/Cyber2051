'use strict';
const fs=require('node:fs'),path=require('node:path'),{inlineSource}=require('./inline-source.cjs');
const root=path.resolve(__dirname,'../..');
function source(read=file=>fs.readFileSync(path.join(root,'卡片源码',file),'utf8')){
 const vendor=read('共享/vendor/js-sha256/sha256.js');
 // Private CommonJS wrapper: no global sha256, AMD registration or Node auto-detection.
 const wrapper=`(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxSha256=api;})(globalThis,function(){const module={exports:{}};const window=undefined,self=undefined,process=undefined,define=undefined;\n${vendor}\nreturn module.exports;});`;
 return inlineSource(wrapper+'\n;\n'+read('运行时/crypto-compat.js'));
}
module.exports={source};
