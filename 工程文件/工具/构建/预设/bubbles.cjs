'use strict';
const B=require('../../lib/card-ast.cjs'),{fs,path,root,read,assert,acorn}=B;
const input=path.join(root,'卡片源码/预设/Izumi-V0.8.json'),baseline=input,output=path.join(root,'.cache/build/Izumi_东京都2051改版V0.9.json'),cache=path.join(root,'.cache/preset');
const helperId='7d1f1956-d354-4cc2-90c3-358be1d9aa6d',styleId='99628814-5206-4280-b6ba-9379a5c54d09';
function build({write=false}={}){
 const bytes=fs.readFileSync(input);
 const preset=JSON.parse(bytes),original=structuredClone(preset),script=preset.extensions.tavern_helper.scripts.find(s=>s.id===helperId),source=script.content;
 const body=acorn.parse(source,{ecmaVersion:'latest'}).body,declarations=new Map(body.filter(n=>n.type==='VariableDeclaration').map(n=>[n.declarations[0].id.name,n]));
 assert.ok(!declarations.has('BDA_ASSETS'));assert.equal(body.at(-1).type,'ExpressionStatement');
 const fields=['BDA_META','CXX_BDA_NAMES','CXX_BDA_MEDIA','BDA_CSS','CXX_BDA_GROUPS','CXX_BDA_CROPS'];
 script.content=source.slice(0,body[0].start)+fields.map(name=>{
  const n=declarations.get(name);assert.ok(n);
  if(name==='BDA_CSS')return 'const BDA_CSS='+JSON.stringify(read('卡片源码/预设/气泡/controls.css'))+';';
  if(['BDA_META','CXX_BDA_NAMES'].includes(name))return 'const '+name+'='+JSON.stringify(JSON.parse(read('卡片源码/正文/'+name+'.json')))+';';
  if(name==='CXX_BDA_GROUPS')return 'const '+name+'='+JSON.stringify(JSON.parse(read('卡片源码/预设/气泡/role-groups.json')))+';';
  if(name==='CXX_BDA_MEDIA'){
   const sprites=require('../../../卡片源码/Gal/sprites.js'),media=JSON.parse(read('卡片源码/Gal/standing-media.json')),names=JSON.parse(read('卡片源码/正文/CXX_BDA_NAMES.json'));
   const faces=Object.fromEntries(sprites.characters.map(p=>[names[p.name],{faces:Object.fromEntries(sprites.expressions.map(face=>[face,sprites.sprite(p.id,'https://cyber2051.top',face,media)]))}]));
   assert.equal(Object.keys(faces).length,sprites.characters.length);
   return 'const '+name+'='+JSON.stringify(faces)+';';
  }
  if(name==='CXX_BDA_CROPS'){assert.deepEqual(JSON.parse(source.slice(n.declarations[0].init.start,n.declarations[0].init.end)),JSON.parse(read('卡片源码/预设/气泡/portrait-crops.json')));}
  return source.slice(n.start,n.end);
 }).join('\n')+'\n'+read('卡片源码/预设/气泡/runtime.js');
 assert.ok(!script.content.includes('BDA_ASSETS'));assert.ok(!script.content.includes('data:image'));acorn.parse(script.content,{ecmaVersion:'latest'});
 const rules=JSON.parse(read('卡片源码/预设/气泡/display-rules.json'));
 for(const patch of rules){const rule=preset.extensions.regex_scripts.find(r=>r.id===patch.id);assert.ok(rule,patch.id);Object.assign(rule,patch);if(rule.id===styleId)rule.replaceString='$1\n\n<span data-cxx-bda-style="r4" aria-hidden="true" style="display:none"></span>\n<style>\n'+read('卡片源码/预设/气泡/theme.css')+'\n</style>';}
 const help=preset.prompts.find(p=>p.identifier==='bdc-toggle-21');help.content='{{//配套气泡：开启预设正则“2051 台词显示｜气泡与上色样式”，在酒馆助手上方“2051 · 台词显示”选择头像气泡、首字气泡、对白上色或关闭美化。可按角色选择，用户头像可选当前人设或首字占位；设置保存在当前浏览器。Gal 隐藏原生气泡，返回恢复。生成完成后刷新头像；禁用样式正则并重绘楼层后保留纯台词。}}';
 preset.name='Izumi_东京都2051改版V0.9';
 const preserved=structuredClone(preset);preserved.name=original.name;preserved.extensions.tavern_helper.scripts.find(s=>s.id===script.id).content=source;
 for(const patch of rules){const i=preserved.extensions.regex_scripts.findIndex(r=>r.id===patch.id);preserved.extensions.regex_scripts[i]=original.extensions.regex_scripts[i];}
 preserved.prompts.find(p=>p.identifier===help.identifier).content=original.prompts.find(p=>p.identifier===help.identifier).content;
 assert.deepEqual(preserved,original,'only bubble helper, three display rules, display help and preset name may change');
 const bubbleStage=structuredClone(preset),baselineBytes=fs.readFileSync(baseline);
 const displayPreserved=structuredClone(bubbleStage);displayPreserved.name=original.name;
 displayPreserved.extensions.tavern_helper.scripts.find(s=>s.id===helperId).content=source;
 displayPreserved.extensions.regex_scripts.find(r=>r.id===styleId).replaceString=original.extensions.regex_scripts.find(r=>r.id===styleId).replaceString;
 displayPreserved.prompts.find(p=>p.identifier===help.identifier).content=original.prompts.find(p=>p.identifier===help.identifier).content;
 assert.deepEqual(displayPreserved,JSON.parse(baselineBytes),'V0.9 only changes bubble helper content, display stylesheet, paired help and preset name');
 const thought=preset.prompts.find(p=>p.identifier==='a901d88f-484c-4448-988a-b60ab0414f32'),custom=preset.prompts.find(p=>p.identifier==='d6d69788-6791-4813-98db-6286e43858a3'),fallback=preset.prompts.find(p=>p.identifier==='bdc-toggle-00');assert.ok(thought&&custom&&fallback);
 thought.content=read('卡片源码/预设/提示词/心理描写.txt').trimEnd();
 const prefix=custom.content.indexOf('\n5. ');assert.ok(prefix>0);assert.match(custom.content.slice(prefix),/^\n5\.[\s\S]*\n6\. /);
 custom.content=custom.content.slice(0,prefix)+'\n'+read('卡片源码/预设/提示词/输出与摘要衔接.txt').trim()+'\n\n'+read('卡片源码/预设/提示词/通讯衔接.txt').trim()+'\n';
 fallback.enabled=false;fallback.name='🎨 台词格式备用（默认关闭）';
 let toggles=0;for(const list of preset.prompt_order)for(const item of list.order)if(item.identifier===fallback.identifier){item.enabled=false;toggles++;}assert.ok(toggles>0);
 preset.name='Izumi_东京都2051改版V0.9';
 const unchanged=structuredClone(preset);unchanged.name=bubbleStage.name;
 const changedPromptIds=[thought.identifier,custom.identifier,fallback.identifier];
 for(const id of changedPromptIds){const index=unchanged.prompts.findIndex(p=>p.identifier===id);unchanged.prompts[index]=bubbleStage.prompts[index];}
 unchanged.prompt_order=structuredClone(bubbleStage.prompt_order);
 assert.deepEqual(unchanged,bubbleStage,'deduplication may only change three prompts, the fallback toggle and preset name');
 const restoredOrder=structuredClone(preset.prompt_order);for(let i=0;i<restoredOrder.length;i++)for(let j=0;j<restoredOrder[i].order.length;j++)if(restoredOrder[i].order[j].identifier===fallback.identifier)restoredOrder[i].order[j]=bubbleStage.prompt_order[i].order[j];assert.deepEqual(restoredOrder,bubbleStage.prompt_order);
 assert.deepEqual(preset.extensions,bubbleStage.extensions,'all regexes, helper scripts and extension settings must remain identical');
 const chars=p=>changedPromptIds.reduce((sum,id)=>{const prompt=p.prompts.find(x=>x.identifier===id);return sum+(prompt.enabled?[...prompt.content].length:0);},0);
 const promptDedup={baseline:{file:baseline,sha256:B.sha(baselineBytes)},changedPromptIds,disabledPromptId:fallback.identifier,regexesUnchanged:true,helpersUnchanged:true,enabledPromptCharacters:{before:chars(bubbleStage),after:chars(preset),removed:chars(bubbleStage)-chars(preset)},scope:'Raw characters in the three affected enabled prompts, not tokenizer or final assembled context counts'};
 const text=JSON.stringify(preset,null,2)+'\n',receipt={input:{file:input,sha256:B.sha(bytes),bytes:bytes.length},output:{file:output,sha256:B.sha(text),bytes:Buffer.byteLength(text)},scriptId:script.id,scriptBytes:Buffer.byteLength(script.content),changedRegexIdsFromR3:rules.map(r=>r.id),changedRegexIdsFromV08:[styleId],promptDedup,checks:['bubble stage preserves sampling, prompt order and prompt objects except paired help','V0.9 only changes one helper content and one display replacement; all IDs and other fields preserved','deduplication only edits two prompt contents and disables one fallback prompt','all other prompts, order, sampling parameters and unknown fields preserved','own portraits, expression identifiers and saved preference keys preserved','message styling owned by display regex; runtime only owns controls and decoration']};
 if(write){fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(cache,{recursive:true});fs.writeFileSync(output,text);fs.writeFileSync(path.join(cache,'preset-build.json'),JSON.stringify(receipt,null,2)+'\n');}
 return {preset,receipt};
}
module.exports={build,input,baseline,output,cache,helperId,styleId};if(require.main===module)console.log(JSON.stringify(build({write:process.argv.includes('--write')}).receipt,null,2));
