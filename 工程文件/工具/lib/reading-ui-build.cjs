'use strict';
const {createHash}=require('node:crypto');
// One adapter per host; every script can start first without racing another frame.
function runtime(source,version){
 const files=Object.fromEntries(['cxx-forge-dissolve','cxx-boot-noise'].map(id=>{
  const prefix='视觉作品/'+id+'/',entry=source(prefix+'entry.js'),project=JSON.parse(source(prefix+'project.json'));
  const resource=project.resources.find(r=>r.path==='entry.js');if(!resource||resource.bytes!==Buffer.byteLength(entry)||resource.sha256!==createHash('sha256').update(entry).digest('hex'))throw Error('视觉作品清单与入口不符：'+id);
  source(prefix+'project.source.json');return [id+'@'+project.version,[{name:'project.json',text:JSON.stringify(project)},{name:'entry.js',text:entry}]];
 }));
 const visual=source('运行时/visual-projects.js'),boot=source('运行时/boot-loader.js'),css=require('./ui-theme.cjs').sheet(source,'运行时/boot-loader.css');
 const signature=createHash('sha256').update(JSON.stringify([files,visual,boot,css,version])).digest('hex');
 return '(function(){const host=globalThis.parent||globalThis;if(host.__cxxReadingUIBuild!=='+JSON.stringify(signature)+'){globalThis.CxxCardVersion='+JSON.stringify(version)+';globalThis.CxxBootLoaderStyle='+JSON.stringify(css)+';globalThis.CxxVisualProjectFiles='+JSON.stringify(files)+';'+visual+';'+boot+';host.CxxVisualProjects=globalThis.CxxVisualProjects;host.CxxBootLoader=globalThis.CxxBootLoader;host.CxxCardVersion=globalThis.CxxCardVersion;host.__cxxReadingUIBuild='+JSON.stringify(signature)+';}globalThis.CxxVisualProjects=host.CxxVisualProjects;globalThis.CxxBootLoader=host.CxxBootLoader;})();';
}
module.exports={runtime};
