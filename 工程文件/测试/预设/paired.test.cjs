'use strict';
const {fs,path,assert,acorn,sha,root}=require('../../工具/lib/card-ast.cjs');
const Adapt=require('../../工具/构建/预设/paired.cjs'),Bubble=require('../../工具/构建/预设/bubbles.cjs');
const parser=require('../../卡片源码/Gal/parser.js'),guard=require('../../卡片源码/正文/display-guard.js');
const cardFile=process.env.CXX_CARD_FILE||require('../../工具/构建/当前/build.cjs').output,cardBytes=fs.readFileSync(cardFile),card=JSON.parse(cardBytes);
assert.equal(card.data.character_version,require('../../工具/构建/当前/build.cjs').version);
const results=[];
for(const {preset,original,receipt}of Adapt.build()){
 const checks=[];const check=(name,fn)=>{fn();checks.push(name);};
 const key=receipt.profile,byId=id=>preset.prompts.find(x=>x.identifier===id);
 const active=id=>preset.prompt_order.find(x=>x.character_id===100001).order.some(x=>x.identifier===id&&x.enabled);
 check('all sampling and top-level non-adaptation settings preserved',()=>{const a=structuredClone(original),b=structuredClone(preset);for(const x of ['name','prompts','prompt_order','extensions']){delete a[x];delete b[x];}assert.deepEqual(a,b);});
 check('original prompt IDs, array order and unrelated prompt objects preserved',()=>{
  assert.deepEqual(preset.prompts.map(x=>x.identifier),original.prompts.map(x=>x.identifier));
  const changed=new Set(key==='izumi'?[Adapt.ids.izumiCustom,Adapt.ids.izumiThought,Adapt.ids.world,Adapt.ids.izumiSummary,Adapt.ids.izumiOptions]:['enhanceDefinitions',Adapt.ids.rebornGame,Adapt.ids.rebornOptions,Adapt.ids.rebornSummary,Adapt.ids.rebornThought,Adapt.ids.rebornTool,Adapt.ids.rebornPrefill,Adapt.ids.rebornMarker,'SPresetSettings']);
  for(let i=0;i<preset.prompts.length;i++)if(!changed.has(preset.prompts[i].identifier))assert.deepEqual(preset.prompts[i],original.prompts[i]);
  for(let i=0;i<preset.prompt_order.length;i++)assert.deepEqual(preset.prompt_order[i].order.map(x=>x.identifier),original.prompt_order[i].order.map(x=>x.identifier));
 });
 check('original helpers and non-preset extension namespaces preserved',()=>{
  const expected=structuredClone(original.extensions.tavern_helper.scripts),actual=structuredClone(preset.extensions.tavern_helper.scripts.slice(0,-1));
  if(receipt.profile==='izumi')for(const item of actual)if(item.content?.includes('function restoreIncomingSanitizedTextInChat(')){
   const marker='\n/* cxx-receipt-normalize-v2 */';assert(item.content.endsWith(marker));item.content=item.content.slice(0,-marker.length).replace('if(sameStamp)return false;','if(sameStamp&&(previous.after===orig||rtx.formatFloor(previous.after,idx)===orig))return false;').replace('if(!incoming&&(message.extra?.cxx_context||message.extra?.izumiWorldNext?.sourceId))return false;','if(!incoming&&message.extra?.izumiWorldNext?.sourceId)return false;');
  }
  assert.deepEqual(actual,expected);
  for(const k of Object.keys(original.extensions))if(!['SPreset','tavern_helper','regex_scripts'].includes(k))assert.deepEqual(preset.extensions[k],original.extensions[k]);
 });
 check('display helper equals current 61-character nine-expression source',()=>{
  const content=preset.extensions.tavern_helper.scripts.at(-1).content;
  assert.equal(sha(content),sha(Bubble.build().preset.extensions.tavern_helper.scripts.find(x=>x.id===Bubble.helperId).content));
  const ast=acorn.parse(content,{ecmaVersion:'latest'}),media=ast.body.find(x=>x.type==='VariableDeclaration'&&x.declarations[0].id.name==='CXX_BDA_MEDIA').declarations[0].init;
  const data=JSON.parse(content.slice(media.start,media.end));assert.equal(Object.keys(data).length,61);for(const r of Object.values(data))assert.equal(Object.keys(r.faces).length,9);
 });
 check('SPreset mirrors every changed regex field without normalizing unrelated source fields',()=>{
  for(const r of preset.extensions.regex_scripts){const b=preset.extensions.SPreset.RegexBinding.regexes.find(x=>x.id===r.id);assert.ok(b);Adapt.compile(r.findRegex);for(const k of ['disabled'])assert.equal(r[k],b[k],r.id+' '+k);}
  if(key==='reborn')assert.deepEqual(JSON.parse(byId('SPresetSettings').content),preset.extensions.SPreset);
 });
 check('default protocol and memory switches',()=>{
  if(key==='izumi'){assert.equal(active(Adapt.ids.world),false);assert.equal(byId(Adapt.ids.world).enabled,false);assert.equal(byId(Adapt.ids.world).content,original.prompts.find(x=>x.identifier===Adapt.ids.world).content);assert.equal(active(Adapt.ids.izumiSummary),true);assert.equal(active(Adapt.ids.izumiCustom),true);}
  else{assert.equal(active(Adapt.ids.rebornTool),false);assert.equal(active(Adapt.ids.rebornPrefill),false);assert.equal(preset.extensions.SPreset.ToolBindings[Adapt.ids.rebornTool].enabled,false);assert.equal(preset.extensions.SPreset.OutputPreprocessing.consumeToolCalls,false);assert.equal(preset.extensions.SPreset.OutputPreprocessing.toolCallFormatter.enabled,false);assert.equal(preset.extensions.SPreset.ForcedPostProcessing.enabled,false);assert.equal(preset.extensions.SPreset.FinalRequestProcessing.enabled,false);assert.equal(byId(Adapt.ids.rebornMarker).content,'{{trim}}<|sep|><|merge|>');assert.ok(active(Adapt.ids.rebornGame));}
 });
 const prefix=key==='izumi'?'<konatan_planning~>前置辅助内容。</konatan_planning~>':'<think>前置辅助内容。</think>';
 const story='<cxx-story>唯一旧楼事实：雨水敲着车窗。\n<cxx-say speaker="高松灯" expression="shocked">「地图准备好了。」</cxx-say>\n<cxx-say speaker="千早爱音" expression="normal" kind="thought">私密心声。</cxx-say>\n<cxx-say speaker="户山香澄" expression="serious" battle="true">「跟紧。」</cxx-say>\n</cxx-story>';
 const ztl='<ztl>{"date":"2051-10-22","time":"20:30","location":"新宿","characters":[{"name":"高松灯","outfit":"日常","thought":"等待"},{"name":"户山香澄","outfit":"战斗","thought":"警戒","battle":true}],"phone_contacts":[{"name":"门卫甲","evidence":"门卫甲已经与我交换了联系方式。"}]}</ztl>';
 const opts='<xuan>1. 等待\n2. 问路\n3. 打开地图\n4. 喝水\n5. 回家</xuan>',summary='<current_event>巡查</current_event><progress>2051-10-22 20:30抵达新宿。</progress>';
 const raw=prefix+story+ztl+opts+summary;
 check('Gal extracts only story, five choices, thoughts, battle and scene',()=>{
  const p=parser.parseMessage(raw,{cache:false});assert.equal(p.choices.length,5);assert.equal(p.paragraphs.length,4);assert.ok(!p.paragraphs.some(x=>/前置辅助|巡查|progress/.test(x.text)));assert.equal(p.paragraphs[2].kind,'thought');assert.equal(p.paragraphs[3].battle,true);assert.equal(p.scene.characters.find(x=>x.name==='户山香澄').battle,true);assert.equal(p.auxiliary.length,3);assert.deepEqual(p.warnings,[]);
 });
 const hooks={},doc={createElement:()=>({remove(){}}),head:{append(){}},documentElement:{toggleAttribute(){},removeAttribute(){}},addEventListener(){},removeEventListener(){}},stop=guard.install({top:{document:doc},api:{SillyTavern:{getContext:()=>({messageFormatter:{addHook:(fn,o)=>hooks[o.stage]=fn}})}},runtime:{alive:true,key:()=> 'paired'},parser});
 function apply(text,{depth=0,destination='display',placement=2}={}){
  for(const r of [...card.data.extensions.regex_scripts,...preset.extensions.regex_scripts]){
   if(r.disabled||!r.placement.includes(placement))continue;
   const off=destination==='display'?!r.markdownOnly:destination==='prompt'?!r.promptOnly:r.markdownOnly||r.promptOnly;
   if(off)continue;
   if(r.minDepth!=null&&r.minDepth>=0&&depth<r.minDepth||r.maxDepth!=null&&r.maxDepth>=0&&depth>r.maxDepth)continue;
   text=text.replace(Adapt.compile(r.findRegex),r.replaceString);
  }return text;
 }
 for(const depth of [0,6,10,11,50])check('prompt retains actual story through depth '+depth,()=>{const text=apply(raw,{depth,destination:'prompt'});assert.match(text,/唯一旧楼事实/);assert.match(text,/地图准备好了/);assert.match(text,/私密心声/);assert.match(text,/2051-10-22 20:30抵达新宿/);assert.doesNotMatch(text,/data-cxx-bda-style|<style>/);});
 check('display pipeline emits shared bubbles without mutating raw text',()=>{
  const before=raw,html=hooks.afterRegex(apply(hooks.beforeRegex(raw,{})));assert.match(html,/data-cxx-bda-style/);assert.equal((html.match(/class="bdc bdc-cxx/g)||[]).length,3);assert.match(html,/bdc-thought/);assert.match(html,/地图准备好了/);assert.equal(raw,before);
 });
 check('separate MVU reply has no story, options or bubble style injection',()=>{
  const update='<UpdateVariable><Analysis>本轮已发生变化。</Analysis><JSONPatch>[{"op":"replace","path":"/日期","value":"2051-10-22"}]</JSONPatch></UpdateVariable>';
  assert.equal(apply(update,{destination:'raw'}),update);const p=parser.parseMessage(update,{cache:false});assert.equal(p.choices.length,0);assert.equal(p.paragraphs.length,0);assert.doesNotMatch(apply(update),/data-cxx-bda-style/);
 });
 check('user messages do not receive bubble styles',()=>assert.doesNotMatch(apply(story,{placement:1}),/data-cxx-bda-style/));
 check('preset regexes never rewrite the card display protocol tags',()=>{
  for(const r of preset.extensions.regex_scripts){
   if(r.disabled)continue;
   const src=String(r.findRegex);
   if(/cxx-(?:story|say|receipt)/.test(src))assert.match(src,/data-cxx-bda-style/,r.scriptName+' may only inject the bubble style, not rewrite story tags');
   assert.doesNotMatch(src,/<xuan>|<CityPublicContext>|<StatusPlaceHolderImpl\/>|<ztl>/g,r.scriptName+' must not touch card-owned protocol tags');
  }
 });
 check('thought blocks stay isolated from the card display protocol',()=>{
  const sample='<think>计划：<cxx-say speaker="高松灯" expression="normal">「暗号」</cxx-say></think>';
  const out=apply(sample,{destination:'display'});
  // izumi removes the whole raw block and lets its host script render thinking.
  if(key==='izumi'){assert.doesNotMatch(out,/「暗号」/);assert.doesNotMatch(out,/<\/?think>/);return;}
  // reborn folds it into html, so nested tags must arrive escaped.
  assert.doesNotMatch(out,/<cxx-say/);
  assert.match(out,/&lt;&#8203;cxx-say/);
 });
 check('spoken lines stay owned by the shared helper',()=>{
  const takeover=card.data.extensions.regex_scripts.find(x=>String(x.scriptName).includes('台词标签'));
  assert.equal(takeover.disabled,true,'card level speech regex must stay off so bubbles are not rendered twice');
 });
 stop();results.push({profile:key,sha256:receipt.output.sha256,passed:checks.length,checks});
}
const report={pass:true,card:{file:cardFile,sha256:sha(cardBytes)},scope:'Offline fixtures with current card parser and display guard, installed host regex order; not actual host import or model output.',results};
const dir=path.join(root,'.cache/preset/paired');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'fixtures.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
