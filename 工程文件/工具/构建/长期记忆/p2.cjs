'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..'),read=p=>fs.readFileSync(path.join(root,'卡片源码',p),'utf8'),{extract}=require('../../lib/script-modules.cjs');
const base=JSON.parse(fs.readFileSync(path.join(root,'交付/基线/2.3.0-整理前.json'),'utf8'));
const bundle={...require(path.join(root,'卡片源码/长期记忆/package.cjs')).data(),version:'2.3.0-P2'};
const chapter=JSON.parse(read('剧情/盗芯之夜.json'));chapter.stages=chapter.stages.slice(0,2);
const quest=JSON.parse(read('终端/content/quests.json')).quests.find(q=>q.id==='q01');assert(quest);
function core(){const script=structuredClone(base.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241'));
 const modules={CxxQuests:'运行时/quests.js',Cxx236VariablePolicy:'MVU/variable-policy.js',Cxx236Variables:'MVU/variables.js',CxxExperienceHost:'运行时/experience-host.js'},matches=extract(script.content,Object.keys(modules));assert.equal(matches.length,4);
 for(const m of matches.sort((a,b)=>b.start-a.start)){const code=extract(read(modules[m.name]),[m.name]);assert.equal(code.length,1);script.content=script.content.slice(0,m.start)+code[0].source+script.content.slice(m.end);}
 new vm.Script(script.content);script.info+='\n2.3.0 P2：仅更新剧情事件校验、事实来源和条目注入接线。配合 P2 长期记忆组件使用。';return script;
}
function adapter(){const code=['正文/dialogue.js','Gal/parser.js','剧情/line-model.js','剧情/line-engine.js','剧情/chapter-engine.js','剧情/graph-compat.js','长期记忆/knowledge.js','长期记忆/adapter.js','长期记忆/plot.js','长期记忆/panel.js'].map(read).join('\n;\n');
 const content='(()=>{\nglobalThis.CxxThemeCSS='+JSON.stringify(read('主题/tokens.css'))+';globalThis.CxxMemoryPanelStyle='+JSON.stringify(read('长期记忆/panel.css'))+';\n'+code+'\nconst host=parent||globalThis;host.CxxLongMemory?.destroy();const service=CxxLongMemoryAdapter.create({api:globalThis,host,parser:CxxGalParser,bundle:'+JSON.stringify(bundle)+'});const plot=CxxMemoryPlot.create('+JSON.stringify({chapter,quest})+');plot.enabled=()=>service.state().plots;plot.story=raw=>service.story(raw).replace(/<cxx-say\\b(?=[^>]*\\bkind=["\x27]thought["\x27])[^>]*>[\\s\\S]*?<\\/cxx-say>/gi,"");host.CxxPlot=plot;const panel=CxxMemoryPanel.create({api:globalThis,host,memory:service,plot,quests:host.CxxQuests||parent.CxxQuests});const destroy=service.destroy;service.destroy=()=>{panel.destroy();destroy();if(host.CxxPlot===plot)delete host.CxxPlot;};service.openPanel=panel.open;host.CxxLongMemory=service.start();const run=fn=>async()=>{try{await fn();}catch(e){host.toastr?.error(e.message);console.error("[长期记忆 P2]",e);}};eventOn(getButtonEvent("长期记忆面板"),run(panel.open));eventOn(getButtonEvent("长期记忆配置"),run(async()=>{await service.install();await service.openSettings();}));addEventListener("pagehide",()=>{service.destroy();if(host.CxxLongMemory===service)delete host.CxxLongMemory;},{once:true});\n})();';
 new vm.Script(content);return {type:'script',enabled:true,id:bundle.id,name:'东京都2051·长期记忆 P2',content,info:'P2：原版数据库外部适配、记忆面板及两份剧情样本。先装配套剧情与玩法核心，再打开面板为当前故事启用 P2 剧情。',button:{enabled:true,buttons:[{name:'长期记忆面板',visible:true},{name:'长期记忆配置',visible:true}]},data:{},export_with:{data:false,button:true}};
}
const out=path.join(root,'交付/组件/2.3.0-长期记忆-P2');
function files(){return {'剧情与玩法核心-P2.json':core(),'长期记忆外部适配-P2.json':adapter(),'记忆模板.json':bundle.template,'召回预设.json':bundle.recall,'推进预设.json':bundle.advance,'召回与推进组合预设.json':bundle.combined};}
if(require.main===module){const all=files();if(process.argv.includes('--write')){fs.mkdirSync(out,{recursive:true});for(const[name,value]of Object.entries(all))fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');const doc=path.join(root,'卡片源码/长期记忆/P2.md');if(fs.existsSync(doc))fs.copyFileSync(doc,path.join(out,'使用说明.md'));}console.log(JSON.stringify({output:out,files:Object.keys(all),written:process.argv.includes('--write')}));}
module.exports={files,root,out,chapter,quest,bundle};
