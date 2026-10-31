'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const acorn=require('acorn');
const root=path.resolve(__dirname,'../../..');
function load(rules){
 const host=process.env.CXX_ST_APP||path.join(root,'.cache/debug223/host/app');
 const engine=fs.readFileSync(path.join(host,'public/scripts/extensions/regex/engine.js'),'utf8');
 const utils=fs.readFileSync(path.join(host,'public/scripts/utils.js'),'utf8');
 const fn=acorn.parse(utils,{ecmaVersion:'latest',sourceType:'module'}).body.find(n=>n.declaration?.id?.name==='regexFromString').declaration;
 const context=vm.createContext({console:{...console,debug:()=>{}},characters:[],this_chid:undefined,extension_settings:{regex:rules,disabledExtensions:[]},substituteParams:x=>x,substituteParamsExtended:x=>x,getPresetManager:()=>null,writeExtensionField:()=>{throw Error('No writes in fixture');}});
 vm.runInContext(utils.slice(fn.start,fn.end)+'\n'+engine.replace(/^import .*?;\r?\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.engine={getRegexedString,runRegexScript};',context);
 // This executes the installed engine. Macro expansion is an identity fixture;
 // our card rules use substituteRegex=0 and test messages contain no macros.
 return {run:(raw,placement,params)=>context.engine.getRegexedString(raw,placement,params),one:(rule,raw)=>context.engine.runRegexScript(rule,raw),sha256:crypto.createHash('sha256').update(engine).digest('hex'),host};
}
module.exports={load};
