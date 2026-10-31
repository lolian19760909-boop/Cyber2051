'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..'),source=path.join(root,'卡片源码/长期记忆'),bundle=require(path.join(source,'package.cjs')).data();
const out=path.join(root,'交付/组件/2.3.0-长期记忆-P1');
function script(){
 const sources=['正文/dialogue.js','Gal/parser.js','长期记忆/knowledge.js','长期记忆/adapter.js'].map(p=>fs.readFileSync(path.join(root,'卡片源码',p),'utf8')).join('\n');
 const content='(()=>{\n'+sources+'\nconst host=parent||globalThis;host.CxxLongMemory?.destroy();const service=CxxLongMemoryAdapter.create({api:globalThis,host,parser:CxxGalParser,bundle:'+JSON.stringify(bundle)+'});host.CxxLongMemory=service.start();const run=fn=>async()=>{try{await fn();}catch(error){host.toastr?.error(error.message);console.error("[长期记忆]",error);}};eventOn(getButtonEvent("长期记忆配置"),run(async()=>{const result=await service.install();host.toastr?.info(result.mode+"；"+result.target+"。embedding 请在原版设置中配置。");await service.openSettings();}));eventOn(getButtonEvent("长期记忆状态"),run(async()=>{const value=service.state();host.toastr?.info((value.enabled?"本故事长期记忆已配置":"本故事长期记忆未配置")+"；记忆书："+(value.book||"未选择"));}));addEventListener("pagehide",()=>{service.destroy();if(host.CxxLongMemory===service)delete host.CxxLongMemory;},{once:true});\n})();';
 new vm.Script(content);
 return {type:'script',enabled:true,id:bundle.id,name:'东京都2051·长期记忆 P1',content,info:'2.3.0 P1：原版 shujuku 1.2.9 外部适配。按“长期记忆配置”为本故事导入模板和预设，再在原插件选择交火、混合检索、目标书及 embedding。玩家记忆管理 API 已接入，完整面板在后续阶段提供。',button:{enabled:true,buttons:[{name:'长期记忆配置',visible:true},{name:'长期记忆状态',visible:true}]},data:{},export_with:{data:false,button:true}};
}
const files=()=>({'记忆模板.json':bundle.template,'召回预设.json':bundle.recall,'推进预设.json':bundle.advance,'召回与推进组合预设.json':bundle.combined,'长期记忆外部适配.json':script()});
if(require.main===module){const result=files();if(process.argv.includes('--write')){fs.mkdirSync(out,{recursive:true});for(const [name,value]of Object.entries(result))fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');fs.copyFileSync(path.join(source,'README.md'),path.join(out,'使用说明.md'));}console.log(JSON.stringify({stage:'P1 components',output:out,files:Object.keys(result),writes:process.argv.includes('--write')},null,2));}
module.exports={files,bundle,out,root};
