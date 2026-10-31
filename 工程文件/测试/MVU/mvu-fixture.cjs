'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),acorn=require('D:/SillyTavern/node_modules/acorn'),_=require('D:/SillyTavern/node_modules/lodash');
// Extract only the pinned parser/executor and its data helpers. No loader, UI, network or host initialization runs.
const source=fs.readFileSync(path.join(__dirname,'fixtures/mvu-pinned.js'),'utf8'),tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'}),names=new Set(['$t','Ft','Rt','Vt','Lt','jt','xt','ft','ht','vt','rt','at','it','Ut','Gt','Ht','gt','Wt','Dt']);let declarations;
function walk(node,parent){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id.name==='$t')declarations=parent.body.filter(x=>x.type==='FunctionDeclaration'&&names.has(x.id.name));for(const v of Object.values(node))if(Array.isArray(v))v.forEach(x=>walk(x,node));else if(v&&typeof v==='object')walk(v,node);}walk(tree);
if(!declarations)throw Error('Pinned MVU executor was not found');
const functions=declarations.map(n=>source.slice(n.start,n.end)).join('\n');
function executor(eventEmit){const context=vm.createContext({_,structuredClone,dt:{klona:structuredClone},It:{$l:JSON.parse},substitudeMacros:x=>x,eventEmit,ct:{VARIABLE_UPDATE_STARTED:'mag_variable_update_started',COMMAND_PARSED:'mag_command_parsed',VARIABLE_UPDATE_ENDED:'mag_variable_update_ended',SINGLE_VARIABLE_UPDATED:'mag_variable_updated'},ot(){},bt:{tr:k=>k},yt:{D:()=>({settings:{通知:{变量更新出错:false}}})},console:{log(){},info(){},warn(){},error(){}},mt:Symbol('array metadata')});vm.runInContext(functions,context);return vm.runInContext('({run:$t,schema:ht})',context);}
module.exports={executor};
