'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {data}=require('./package.cjs');
function script(source,options={}){
 const chapter=JSON.parse(source('剧情/盗芯之夜.json'));
 const quests=JSON.parse(source('终端/content/quests.json')).quests.filter(q=>q.id!=='q_heist');
 const detection=JSON.parse(source('长期记忆/detection.json'));
 source('剧情/chapter-data.cjs');
 const chapters=require('../剧情/chapter-data.cjs').load(source,options);
 const lines=require('../剧情/build.cjs').load(source,options);
 assert.equal(chapter.stages.length,8);assert.equal(quests.length,10);
 for(const [i]of chapter.stages.entries())assert(Object.keys(detection.stages[i+1]||{}).length);
 for(const q of quests)assert(Object.keys(detection.quests[q.id]||{}).length);
 const bundle={...data(name=>source('长期记忆/'+name).trim()),version:'2.3.1-S2',plotsDefault:true};
 const code=['剧情/line-model.js','剧情/line-engine.js','剧情/chapter-engine.js','剧情/graph-compat.js','长期记忆/knowledge.js','长期记忆/adapter.js','长期记忆/plot.js','长期记忆/panel.js','长期记忆/material.js','长期记忆/history.js','长期记忆/startup.js'].map(source).join('\n;\n');
 const content='(async()=>{\nglobalThis.CxxThemeCSS='+JSON.stringify(source('主题/tokens.css'))+';globalThis.CxxMemoryPanelStyle='+JSON.stringify(source('长期记忆/panel.css'))+';\n'+code+'\n'+
  'await CxxLongMemoryStartup.install({host:parent||globalThis,api:globalThis,bundle:'+JSON.stringify(bundle)+',chapter:'+JSON.stringify(chapter)+',chapters:'+JSON.stringify(chapters)+',quests:'+JSON.stringify(quests)+',detection:'+JSON.stringify(detection)+',lines:'+JSON.stringify(lines)+'});\n})();';
 new vm.Script(content);
 return {type:'script',enabled:true,id:bundle.id,name:'2051 长期记忆与剧情',content,info:'2.3.1：通用节点剧情框架、盗芯八段与十份委托事实检测。剧情默认启用，进度与插图沿原 MVU 保存；数据库记忆按故事配置，使用原版 shujuku。',button:{enabled:true,buttons:[{name:'长期记忆面板',visible:true},{name:'长期记忆配置',visible:true}]},data:{},export_with:{data:false,button:true}};
}
module.exports={script};
