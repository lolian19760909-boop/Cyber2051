'use strict';
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),acorn=require('D:/SillyTavern/node_modules/acorn');
// Reuse only existing fixture helpers; no previous test is registered or rerun.
module.exports=function(file,names){
  const full=file==='controller.test.cjs'?path.join(__dirname,'controller-fixture.cjs'):path.resolve(__dirname,"../运行时",file),source=fs.readFileSync(full,'utf8');
  const tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'script'});
  const kept=tree.body.filter(n=>['VariableDeclaration','FunctionDeclaration'].includes(n.type)).map(n=>source.slice(n.start,n.end)).join('\n');
  const m=new Module(full,module);m.filename=full;m.paths=Module._nodeModulePaths(path.dirname(full));m._compile(kept+'\nmodule.exports={'+names.join(',')+'};',full);return m.exports;
};
