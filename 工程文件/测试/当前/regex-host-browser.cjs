'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('../../独立制卡器/workbench/node_modules/playwright');
const eng=path.resolve(__dirname,'../..'),out=process.env.CXX_EVIDENCE||path.join(eng,'.cache/regex230/host'),file=process.env.CXX_TEST_CARD||path.join(eng,'.cache/build/赛博小祥2051-V2.3.0.json');
const bytes=fs.readFileSync(file),card=JSON.parse(bytes),rules=card.data.extensions.regex_scripts;
const data=process.env.CXX_ST_DATA||path.join(eng,'独立制卡器/.cache/motion-m0/st-data/default-user');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function records(dir,result={}){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())records(f,result);else result[path.relative(data,f)]=sha(fs.readFileSync(f));}return result;}
(async()=>{const before=records(path.join(data,'chats')),report={scope:'Real isolated ST getRegexedString and messageFormatting; temporary in-memory rule list restored synchronously; no model or chat writes',cardSHA256:sha(bytes),blockedWrites:[],errors:[]};let browser;fs.mkdirSync(out,{recursive:true});try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/api/**',r=>{const u=new URL(r.request().url());if(/\/(?:generate|save|merge-attributes|edit|delete)$/.test(u.pathname)){report.blockedWrites.push(u.pathname);return r.abort();}return r.continue();});
 await page.goto(process.env.CXX_ST_URL||'http://127.0.0.1:6951',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.SillyTavern?.getContext?.().messageFormatting,null,{timeout:45000});
 report.result=await page.evaluate(async rules=>{
  const engine=await import('/scripts/extensions/regex/engine.js'),c=SillyTavern.getContext(),s=c.extensionSettings;
  const keys=['regex','character_allowed_regex','preset_allowed_regex','disabledExtensions'],snapshot=keys.map(k=>[k,Object.hasOwn(s,k),s[k]]),originalChat=JSON.stringify(c.chat);
  const scene='<ztl>{"date":"2051年4月12日","time":"21:18","location":"车站","characters":[]}</ztl>',raw='<cxx-story>雨停了，大家走出车站。</cxx-story>\n'+scene+'\n<xuan>1. 等待\n2. 回家</xuan>\n<UpdateVariable><Analysis>说明</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>\n<StatusPlaceHolderImpl/>\n<Gui>旧面板</Gui>';
  const checks=[],expect=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  try{
   s.regex=rules;s.character_allowed_regex=[];s.preset_allowed_regex={};s.disabledExtensions=(s.disabledExtensions||[]).filter(x=>x!=='regex');
   for(const depth of [0,1,2,3,4,100]){
    const display=engine.getRegexedString(raw,2,{isMarkdown:true,depth}),prompt=engine.getRegexedString(raw,2,{isPrompt:true,depth});
    expect(display.includes('雨停了')&&prompt.includes('雨停了'),'narrative preserved at depth '+depth);
    expect(depth<=1?display.includes('data-cxx-slot="status0"'):!display.includes('data-cxx-slot="status0"'),'status display depth '+depth);
    expect(!/<UpdateVariable>|<xuan>|<StatusPlaceHolderImpl\/>|<Gui>/.test(prompt),'prompt auxiliary removed at depth '+depth);
    expect(depth<3?prompt.includes('<ztl>'):!prompt.includes('<ztl>'),'historical status prompt depth '+depth);
   }
   for(const text of ['“'+raw+'”','```xml\n'+raw+'\n```','<pre>'+raw+'</pre>','<!--'+raw+'-->'])expect(engine.getRegexedString(text,2,{isPrompt:true,depth:4})===text,'prompt literal survives');
   expect(engine.getRegexedString(raw,2,{})===raw,'raw/save stage unchanged');
   expect(engine.getRegexedString(raw,1,{isPrompt:true,depth:4}).includes('<xuan>'),'user options not stripped');
   const html=c.messageFormatting(raw,'测试角色',false,false,0);
   expect(html.includes('雨停了')&&html.includes('data-cxx-slot="status0"')&&html.includes('data-cxx-slot="music12"'),'actual host Markdown formatter emits current status and music');
   expect(JSON.stringify(c.chat)===originalChat,'host chat untouched');
   return {checks,htmlLength:html.length,chatUntouched:true};
  }finally{for(const [key,had,value]of snapshot){if(had)s[key]=value;else delete s[key];}}
 },rules);
 assert(report.result.checks.length>=30);report.pass=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();const after=records(path.join(data,'chats'));report.unchangedChatFiles=Object.keys(before).length;report.changedChatFiles=Object.keys(before).filter(k=>before[k]!==after[k]);if(report.changedChatFiles.length){report.pass=false;process.exitCode=1;}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}})();
