'use strict';
// Build artifact only: all parsing rules stay in the registered maintenance sources.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {extract}=require('./script-modules.cjs'),{inlineSource}=require('./inline-source.cjs');
const registry=require('../构建/当前/module-sources.json');
const spec=registry.historyWorker;
function build({read=file=>fs.readFileSync(path.resolve(__dirname,'../../卡片源码',file),'utf8').replace(/\r\n/g,'\n')}={}){
  const modules=Object.fromEntries(spec.modules.map(name=>{
    const found=extract(inlineSource(read(registry.modules[name])),[name]);
    assert.equal(found.length,1,'History worker module: '+name);
    return [name,found[0].source];
  }));
  const entry=inlineSource(read(spec.entry));
  return {source:Object.values(modules).join('\n;\n')+'\n;\n'+entry,modules};
}
module.exports={build,spec};
