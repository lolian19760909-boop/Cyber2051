'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Publisher=require('../../工具/发布/release-package.cjs'),P=require('../../卡片源码/运行时/plugin-check.js');
const source=fs.readFileSync(path.join(__dirname,'../../卡片源码/运行时/plugin-check.js'),'utf8');
const card=sources=>({data:{extensions:{tavern_helper:{scripts:sources.map((content,i)=>({id:'script-'+i,type:'script',content}))}}}});
test('release plugin requirement comes from the maintained checker and agrees with every frozen copy',()=>{
 const value=card([source,source]);value.data.extensions.tavern_helper.scripts[1]={id:'folder',type:'folder',scripts:[value.data.extensions.tavern_helper.scripts[1]]};
 assert.deepEqual(Publisher.pluginRequirements(value),[{id:'suite',version:P.VERSION,required:true}]);
});
test('release fails when a frozen checker is missing or differs from its maintained dependency',()=>{
 assert.throws(()=>Publisher.pluginRequirements(card(['const unrelated=true;'])),/missing its plugin dependency/);
 const old=source.replace("VERSION='"+P.VERSION+"'","VERSION='0.3.4'");assert.notEqual(old,source);
 for(const sources of [[old],[source,old]])assert.throws(()=>Publisher.pluginRequirements(card(sources)),/rebuild before publishing/);
});
test('dependency extraction is static and rejects a nonliteral declaration without executing card code',()=>{
 const wrapper=body=>"(function(root,factory){root.CxxPluginCheck=factory();})(globalThis,function(){"+body+"});";
 assert.deepEqual(Publisher.pluginRequirements(card([wrapper("throw Error('must not run');const VERSION='"+P.VERSION+"';return {VERSION};")])),[{id:'suite',version:P.VERSION,required:true}]);
 assert.throws(()=>Publisher.pluginRequirements(card([wrapper("const VERSION=globalThis.pickVersion();return {VERSION};")])),/rebuild before publishing/);
});
