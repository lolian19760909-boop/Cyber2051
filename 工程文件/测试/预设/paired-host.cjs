'use strict';
// Dedicated empty ST profile at :6957. Never targets the daily or shared test host.
const {fs,path,assert,sha,root}=require('../../工具/lib/card-ast.cjs');
const Adapt=require('../../工具/构建/预设/paired.cjs');
const {chromium}=require(process.env.CXX_PLAYWRIGHT||'C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.join(root,'.cache/preset/paired'),base='http://127.0.0.1:6957';
async function main(){
 const browser=await chromium.launch({headless:true,channel:'msedge'}),report={scope:'Actual SillyTavern 1.19.0 core import, reload, regex and macro checks in an empty dedicated profile; third-party helpers/SPreset execution and real model generation are separate.',profiles:[],errors:[],paidRequests:0};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(20000);
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/api/backends/**',r=>{report.paidRequests++;return r.abort();});
  await page.route('https://**/*',r=>r.abort());
  await page.goto(base);await page.waitForFunction(()=>window.SillyTavern&&!document.querySelector('#preloader'));
  console.log('host-ready');
  await page.selectOption('#main_api','openai',{force:true});
  for(const {preset,receipt}of Adapt.build()){
   console.log('import '+preset.name);
   const artifact=receipt.output.file;
   const exists=await page.locator('#settings_preset_openai option').evaluateAll((list,name)=>list.some(x=>x.textContent===name),preset.name);
   await page.locator('#openai_preset_import_file').setInputFiles(artifact);
   if(exists)await page.locator('.popup').filter({hasText:'Preset name already exists'}).locator('.popup-button-ok').click();
   await page.waitForFunction(name=>[...document.querySelector('#settings_preset_openai').options].some(x=>x.textContent===name),preset.name);
   await page.selectOption('#settings_preset_openai',{label:preset.name},{force:true});
   await page.evaluate(async()=>{await(await import('/scripts/openai.js')).getPresetApplicationPromise();});
   console.log('applied '+preset.name);
   await page.waitForFunction(count=>SillyTavern.getContext().chatCompletionSettings?.prompts?.length===count,preset.prompts.length);
   const actual=await page.evaluate(async({name,story})=>{
    const c=SillyTavern.getContext(),engine=await import('/scripts/extensions/regex/engine.js'),extensions=await import('/scripts/extensions.js'),manager=(await import('/scripts/preset-manager.js')).getPresetManager('openai');
    extensions.extension_settings.preset_allowed_regex??={};extensions.extension_settings.preset_allowed_regex.openai??=[];
    if(!extensions.extension_settings.preset_allowed_regex.openai.includes(name))extensions.extension_settings.preset_allowed_regex.openai.push(name);
    const setting=c.chatCompletionSettings,enabled=setting.prompt_order.find(x=>x.character_id===100001).order.filter(x=>x.enabled).map(x=>x.identifier);
    const contents=setting.prompts.filter(x=>enabled.includes(x.identifier)&&!x.marker).map(x=>({id:x.identifier,text:c.substituteParams(x.content)}));
    const regexes=engine.getScriptsByType(engine.SCRIPT_TYPES.PRESET,{allowedOnly:true});
    const prompt=[0,6,11,50].map(depth=>({depth,text:engine.getRegexedString(story,2,{isPrompt:true,depth})}));
    const display=engine.getRegexedString('<cxx-say speaker="高松灯" expression="normal">「已抵达。」</cxx-say>',2,{isMarkdown:true,depth:0});
    return {selected:manager.getSelectedPresetName(),prompts:setting.prompts.length,regexes:regexes.length,helperCount:manager.readPresetExtensionField({path:'tavern_helper.scripts'})?.length,contents,prompt,display};
   },{name:preset.name,story:'<cxx-story>旧楼唯一事实：已抵达新宿。</cxx-story><current_event>巡查</current_event><progress>等待。</progress>'});
   assert.equal(actual.selected,preset.name);assert.equal(actual.prompts,preset.prompts.length);assert.equal(actual.regexes,preset.extensions.regex_scripts.length);assert.equal(actual.helperCount,2);
   assert.match(actual.display,/data-cxx-bda-style/);for(const p of actual.prompt)assert.match(p.text,/旧楼唯一事实/);
   const common=actual.contents.find(x=>x.id===(receipt.profile==='izumi'?Adapt.ids.izumiCustom:Adapt.ids.rebornGame));assert.match(common.text,/正文解析/);assert.match(common.text,/额外解析/);
   if(receipt.profile==='izumi')assert.ok(!actual.contents.some(x=>x.id===Adapt.ids.world));else assert.ok(!actual.contents.some(x=>x.id===Adapt.ids.rebornTool));
   const stored=JSON.parse(fs.readFileSync(path.join(out,'host-data/default-user/OpenAI Settings',preset.name+'.json')));
   assert.deepEqual(stored,preset,'actual imported artifact roundtrip');
   await page.evaluate(async()=>{await(await import('/script.js')).saveSettings();});
   console.log('saved '+preset.name);
   await page.reload();await page.waitForFunction(name=>window.SillyTavern&&!document.querySelector('#preloader')&&[...document.querySelector('#settings_preset_openai').selectedOptions].some(x=>x.textContent===name),preset.name);
   report.profiles.push({name:preset.name,sha256:sha(fs.readFileSync(artifact)),prompts:actual.prompts,regexes:actual.regexes,checks:['UI file import and import name','disk JSON equals artifact','active prompt order and macro expansion','four-depth actual regex prompt retention','actual display regex stylesheet','reload retains selected preset']});
  }
  assert.deepEqual(report.errors,[]);assert.equal(report.paidRequests,0);report.pass=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'host.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
