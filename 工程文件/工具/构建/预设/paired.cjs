'use strict';
// Preset-only adaptation: original prompts and settings remain the base.
const B=require('../../lib/card-ast.cjs'),{fs,path,assert,acorn,root,read,sha}=B;
const Bubble=require('./bubbles.cjs');
const originals=path.join(root,'卡片源码/预设/原版'),outDir=path.join(root,'.cache/build');
const profiles=[
 {key:'izumi',file:'Izumi-1022.json',hash:'afbc32364c42ac5a58d88e72550ab32872e13a526de6b24642a9d32f324435c2',name:'Izumi_东京都2051改版V0.12'},
 {key:'reborn',file:'喵赛亚-1.5.json',hash:'b0df2772a2a6152c8ad0f20d99dbe12c66b3bb0a8b2ce72463406a9599990d6d',name:'喵赛亚1.5_东京都2051适配V1.1'},
];
const ids={world:'f2bd9e18-e94f-401a-9fec-a96f03b72f6a',izumiCustom:'d6d69788-6791-4813-98db-6286e43858a3',izumiThought:'a901d88f-484c-4448-988a-b60ab0414f32',izumiSummary:'060464e2-cc75-4984-82c6-6dc1702db61a',izumiOptions:'e8d8ed8b-99f5-465e-91ba-895ff28322b5',rebornGame:'f65144f0-d39e-43e6-84e7-5c1d78a1a23d',rebornOptions:'046af93d-0c63-4561-b0b2-052cd265fecd',rebornSummary:'3867af9e-9bad-4fdf-9ef8-83ca07d8c68e',rebornThought:'eb65ec28-14a7-401c-887a-e6e22c3295c9',rebornTool:'3df19ba7-b44d-4d46-b17a-de514d86e5d5',rebornPrefill:'91918c0a-bfc6-4101-9796-5421aab6fae8',rebornMarker:'a00fb1fe-9907-4709-b230-43ae0d236529'};
const bubbleRuleIds=['705d4a8c-0e4e-4478-a700-34808d225132','611a5e2c-71f9-4b14-92c0-7b9f7093509f',Bubble.styleId];
const compile=s=>{const m=/^\/(.*)\/([a-z]*)$/s.exec(s);return m?new RegExp(m[1],m[2]):new RegExp(s);};
function build({write=false}={}){
 const bubble=Bubble.build().preset,common=read('卡片源码/预设/提示词/2051配套衔接.txt').trim();
 const results=profiles.map(profile=>{
  const input=path.join(originals,profile.file),bytes=fs.readFileSync(input);assert.equal(sha(bytes),profile.hash,'frozen original hash');
  const original=JSON.parse(bytes),preset=structuredClone(original),edits=[];
  // Each mutation registers its exact original value for an inverse comparison.
  function set(parts,value){let owner=preset;for(const key of parts.slice(0,-1)){assert.ok(owner&&typeof owner==='object');owner=owner[key];}const key=parts.at(-1);edits.push({parts,existed:Object.hasOwn(owner,key),before:structuredClone(owner[key])});owner[key]=structuredClone(value);}
  const promptIndex=id=>{const i=preset.prompts.findIndex(p=>p.identifier===id);assert.ok(i>=0,id);return i;};
  const patchPrompt=(id,patch)=>{const i=promptIndex(id);for(const [k,v]of Object.entries(patch))set(['prompts',i,k],v);};
  function toggle(id,enabled){patchPrompt(id,{enabled});let found=0;for(let i=0;i<preset.prompt_order.length;i++)for(let j=0;j<preset.prompt_order[i].order.length;j++)if(preset.prompt_order[i].order[j].identifier===id){set(['prompt_order',i,'order',j,'enabled'],enabled);found++;}assert.ok(found,id+' order');}
  function patchRegex(id,patch){
   for(const parts of [['extensions','regex_scripts'],['extensions','SPreset','RegexBinding','regexes']]){
    let list=preset;for(const k of parts)list=list[k];const i=list.findIndex(r=>r.id===id);assert.ok(i>=0,id+' binding');
    for(const [k,v]of Object.entries(patch))set([...parts,i,k],v);
   }
  }
  set(['name'],profile.name);
  // New shared pieces append, so original stable IDs and relative order survive.
  const sharedRules=bubbleRuleIds.map(id=>structuredClone(bubble.extensions.regex_scripts.find(r=>r.id===id)));
  for(const parts of [['extensions','regex_scripts'],['extensions','SPreset','RegexBinding','regexes']]){
   let list=preset;for(const k of parts)list=list[k];assert.ok(!list.some(x=>bubbleRuleIds.includes(x.id)));set(parts,[...list,...sharedRules]);
  }
  const helper=structuredClone(bubble.extensions.tavern_helper.scripts.find(s=>s.id===Bubble.helperId));
  assert.ok(!preset.extensions.tavern_helper.scripts.some(x=>x.id===helper.id));
  set(['extensions','tavern_helper','scripts'],[...preset.extensions.tavern_helper.scripts,helper]);
  if(profile.key==='izumi'){
   for(let i=0;i<preset.extensions.tavern_helper.scripts.length;i++){const item=preset.extensions.tavern_helper.scripts[i];if(item.content?.includes('function restoreIncomingSanitizedTextInChat('))set(['extensions','tavern_helper','scripts',i,'content'],(()=>{const repair=require('../../../卡片源码/运行时/preset-repair.js');if(item.content.includes('function restoreIncomingSanitizedTextInChat(messageIndex) {'))return repair.patch(item.content);let content=item.content;const admitted='if(!incoming&&message.extra?.izumiWorldNext?.sourceId)return false;';assert.equal(content.split(admitted).length,2,'current upstream publication guard');content=content.replace(admitted,'if(!incoming&&(message.extra?.cxx_context||message.extra?.izumiWorldNext?.sourceId))return false;');return content+'\n/* '+repair.receiptMarker+' */';})());}

   patchPrompt(ids.izumiCustom,{content:common});
   patchPrompt(ids.izumiThought,{content:read('卡片源码/预设/提示词/心理描写.txt').trimEnd()});
   toggle(ids.world,false);
   toggle(ids.izumiSummary,true);
   // The squashed post-history block pairs this anti-native-thinking tail with the preset's own
   // <Chain_of_Thought> scaffold; with native thinking forced on, DeepSeek ends thinking and
   // stops before writing any body (deterministic empty body, replay-proven 2026-11-01, issue #28).
   // The site preset ships without the suppression tail; the CoT scaffold stays authoritative.
   toggle('3beb259e-7516-41c9-8657-fd56cac8e628',false);
   // Author-validated replacement (2026-11-01): the assistant-side quick-CoT opener keeps the
   // auxiliary thinking scaffold and dialogue bubbles working without the suppression tail.
   toggle('64f1335c-52cd-4d6c-93d1-77cc99b0c76c',true);
   // The tavern capture of the working opening request carries a single squashed system block
   // instead of the preset's ~20 scattered system messages (issue #23).
   set(['squash_system_messages'],true);
   // A disabled optional output switch is still safe to enable later.
   patchPrompt(ids.izumiOptions,{name:'⏩选项栏｜2051五选项',content:'【行动选项｜必须五个，写在 xuan 内】\n主剧情结束后给出五个行动选项，全部放在 <xuan>…</xuan> 内用「- 」逐条列出：简洁、合理、衔接当前剧情，保留不同走向，不替玩家执行。\n禁止：另生成 <options>／<option>；把选项写进正文或 <ztl>；预先写出玩家尚未选择的行动结果。'});
   for(const id of ['4c369a25-bf59-47bc-bcf5-510d02d6326d','b9f51abf-13ad-4d57-aa1e-2a04a456ce98','a542e188-70c5-4364-9ef8-ffd78a39dd90','7dbe5b2a-72ca-4ebc-a5ba-e0291c9bf210','7ea9ba2c-1fb0-403c-b62b-0425792734a8'])patchRegex(id,{disabled:true});
  }else{
   const ritual=preset.prompts[promptIndex('enhanceDefinitions')].content;
   const toolInstruction='SPECIAL INSTRUCTION: Do not think silently, start with function call.';
   assert.equal(ritual.split(toolInstruction).length,2,'current upstream tool-call instruction');
   // Tools are off here, so the auxiliary thinking returns to the card's own tag.
   patchPrompt('enhanceDefinitions',{content:ritual.replace(toolInstruction,'SPECIAL INSTRUCTION: Do not think silently, start with a <think> block.')});
   patchPrompt(ids.rebornGame,{name:'📏2051正文与功能衔接',content:common});
   patchPrompt(ids.rebornOptions,{content:'【行动选项｜必须五个，写在 xuan 内】\n主剧情结束后给出五个行动选项，全部放在 <xuan>…</xuan> 内用「- 」逐条列出：简洁、合理、衔接当前剧情，保留不同走向，不替玩家执行。\n禁止：另生成 <options>／<option>；把选项写进正文或 <ztl>；预先写出玩家尚未选择的行动结果。'});
   patchPrompt(ids.rebornSummary,{content:read('卡片源码/预设/提示词/Reborn摘要衔接.txt').trim()});
   patchPrompt(ids.rebornThought,{content:'【内心话｜仅在需要时】需要角色内心活动时，直接心里话写 <cxx-say speaker="人物全名" expression="表情值" kind="thought">内心话</cxx-say>，不加引号、星号、斜体或 <details> 折叠；旁白转述直接写进正文；不代写 {{user}} 未表达的心理。'});
   toggle(ids.rebornTool,false);
   toggle(ids.rebornPrefill,false);
   // Tool output has five independent switches: the prompt, the binding, the call
   // consumer, the formatter and the final request rewrite. All five must close.
   set(['extensions','SPreset','ToolBindings',ids.rebornTool,'enabled'],false);
   set(['extensions','SPreset','OutputPreprocessing','consumeToolCalls'],false);
   set(['extensions','SPreset','OutputPreprocessing','toolCallFormatter','enabled'],false);
   set(['extensions','SPreset','ForcedPostProcessing','enabled'],false);
   set(['extensions','SPreset','FinalRequestProcessing','enabled'],false);
   // That marker only feeds the final request rewrite; the separator tags stay.
   patchPrompt(ids.rebornMarker,{content:'{{trim}}<|sep|><|merge|>'});
   patchRegex('a90748f5-0dcf-40c4-aa30-14d8c8dbb51f',{disabled:true});
   // Preserve old-message folding, while new replies use the card's auxiliary tag.
   for(const id of ['69ddfba5-b9af-4fea-9d96-490d85f6b66f','bdae9a30-78dc-4241-a9a1-4b02f561a571','80ebc9b6-6e2e-40bb-807a-b3cfebd23bc5','e3a9e68f-4112-447c-bea3-7057c1f77422'])patchRegex(id,{findRegex:'/<(?:think_nya~|think)>([\\s\\S]*?)<\\/(?:think_nya~?|think)>/g'});
   patchRegex('b97ad5d8-5673-461c-a6bd-807f8efe6949',{findRegex:'/<(think_nya~|think)>([\\s\\S]*?)<\\/(?:think_nya~?|think)>\\s*?/g'});
   // The escape guard only looked for the upstream close tag, so a reply using the
   // card's <think> would fold raw tags into HTML. Cover both closes.
   patchRegex('1d78fce4-3e3c-4d8f-b9dc-f26555be0a6d',{findRegex:'/<(?<tag>(?!\\/?think(?:_nya~)?>)[^<>]+)>(?=(?:(?!<\\/?think(?:_nya~)?>)[\\s\\S])*<\\/(?:think_nya~|think)>)/g'});
   const embedded=promptIndex('SPresetSettings');
   set(['prompts',embedded,'content'],JSON.stringify(preset.extensions.SPreset));
   assert.deepEqual(JSON.parse(preset.prompts[embedded].content),preset.extensions.SPreset);
  }
  // Undo only registered leaf mutations; assert everything else matches the source.
  const restored=structuredClone(preset);
  for(const e of edits.slice().reverse()){let owner=restored;for(const k of e.parts.slice(0,-1))owner=owner[k];if(e.existed)owner[e.parts.at(-1)]=e.before;else delete owner[e.parts.at(-1)];}
  assert.deepEqual(restored,original,'fields outside the adaptation are identical');
  for(const list of [preset.prompts,preset.extensions.regex_scripts,preset.extensions.SPreset.RegexBinding.regexes,preset.extensions.tavern_helper.scripts]){const key=list===preset.prompts?'identifier':'id';assert.equal(new Set(list.map(x=>x[key])).size,list.length,'stable IDs unique');}
  for(const r of preset.extensions.regex_scripts)compile(r.findRegex);
  acorn.parse(helper.content,{ecmaVersion:'latest'});
  const text=JSON.stringify(preset,null,2)+'\n',output=path.join(outDir,profile.name+'.json');
  const receipt={profile:profile.key,name:preset.name,input:{file:input,sha256:sha(bytes)},output:{file:output,sha256:sha(text),bytes:Buffer.byteLength(text)},counts:{prompts:preset.prompts.length,regexes:preset.extensions.regex_scripts.length,helpers:preset.extensions.tavern_helper.scripts.length},changedPaths:edits.map(e=>'/'+e.parts.join('/')),allOtherFieldsPreserved:true,sharedBubbleHelperId:helper.id,sharedBubbleHelperSha256:sha(helper.content),sharedBubbleRegexIds:bubbleRuleIds,library:{snapshotVersion:'2026-08-18',routeIds:['tavern-card-builder','sillytavern-render-regex-pipeline'],read:['ST-A0','ST-A4','ST-A6']},worldSystemDefault:profile.key==='izumi'?'disabled by author choice':undefined};
  if(write){fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(output,text);}
  return {preset,receipt,original};
 });
 if(write){const dir=path.join(root,'.cache/preset/paired');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'build.json'),JSON.stringify(results.map(x=>x.receipt),null,2)+'\n');}
 return results;
}
module.exports={build,profiles,ids,compile,outDir};
if(require.main===module)console.log(JSON.stringify(build({write:process.argv.includes('--write')}).map(x=>x.receipt),null,2));
