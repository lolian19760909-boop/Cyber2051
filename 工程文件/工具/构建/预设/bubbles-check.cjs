'use strict';
const {fs,path,assert,acorn,sha}=require('../../lib/card-ast.cjs'),Build=require('./bubbles.cjs'),http=require('node:http');
const {chromium}=require(process.env.CXX_PLAYWRIGHT||'C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const ST=process.env.CXX_ST_ROOT||'D:/SillyTavern',presetFile=process.env.CXX_PRESET_FILE||Build.output,preset=process.env.CXX_PRESET_FILE?JSON.parse(fs.readFileSync(presetFile)):Build.build({write:true}).preset,source=preset.extensions.tavern_helper.scripts.find(s=>s.id===Build.helperId).content;
const evidence=process.env.CXX_EVIDENCE||Build.cache;fs.mkdirSync(evidence,{recursive:true});
const parser=require('../../../卡片源码/Gal/parser.js'),guard=require('../../../卡片源码/正文/display-guard.js');
const cardFile=process.env.CXX_CARD_FILE||path.join(__dirname,'../../../交付/基线/2.3.0-整理前.json'),card=JSON.parse(fs.readFileSync(cardFile));
const hooks={},doc={createElement:()=>({remove(){}}),head:{append(){}},documentElement:{toggleAttribute(){},removeAttribute(){}},addEventListener(){},removeEventListener(){}},stop=guard.install({top:{document:doc},api:{SillyTavern:{getContext:()=>({messageFormatter:{addHook:(fn,o)=>hooks[o.stage]=fn}})}},runtime:{alive:true,key:()=> 'fixture'},parser});
const compile=s=>{const m=/^\/(.*)\/([a-z]*)$/s.exec(s);return m?new RegExp(m[1],m[2]):new RegExp(s);};
const allRules=[...card.data.extensions.regex_scripts,...preset.extensions.regex_scripts];allRules.forEach(r=>compile(r.findRegex));
function rules(text,{style=true,destination='display',depth=0,placement=2}={}){
 for(const r of allRules){if(r.disabled||!r.placement.includes(placement)||!style&&r.id===Build.styleId)continue;
  if(destination==='display'?!r.markdownOnly:!r.promptOnly)continue;
  if(r.minDepth!=null&&depth<r.minDepth||r.maxDepth!=null&&depth>r.maxDepth)continue;
  text=text.replace(compile(r.findRegex),r.replaceString);
 }return text;
}
function formatted(raw,options){return hooks.afterRegex(rules(hooks.beforeRegex(raw,{}),options));}
const raw='<cxx-story>雨水敲着车窗。\n<cxx-say speaker="高松灯" expression="shocked">「地图已经准备好了。」</cxx-say>\n<cxx-say speaker="千早爱音" expression="sadness" kind="thought">但愿她没有发现。</cxx-say>\n<cxx-say speaker="用户" expression="normal">「我们走吧。」</cxx-say>\n<cxx-say speaker="门卫甲" expression="normal">「请出示证件。」</cxx-say></cxx-story>';
const rendered=formatted(raw),noStyle=formatted(raw,{style:false});assert.match(rendered,/data-cxx-bda-style="r4"/);assert.doesNotMatch(noStyle,/data-cxx-bda-style/);assert.equal((rendered.match(/bdc-cxx/g)||[]).length,4);assert.match(rendered,/bdc-thought/);
assert.doesNotMatch(rules(raw,{destination:'prompt'}),/data-cxx-bda-style|<style>/);assert.doesNotMatch(rules(raw,{placement:1}),/data-cxx-bda-style/);
assert.match(formatted(raw,{depth:50}),/data-cxx-bda-style/);assert.doesNotMatch(formatted('普通旁白。'),/data-cxx-bda-style/);
assert.doesNotMatch(formatted('```html\n<span class="bdc bdc-tomori">代码示例</span>\n```'),/data-cxx-bda-style/);
const styleRule=preset.extensions.regex_scripts.find(r=>r.id===Build.styleId),once=raw.replace(compile(styleRule.findRegex),styleRule.replaceString);assert.equal(once.replace(compile(styleRule.findRegex),styleRule.replaceString),once);
const donor=JSON.parse(fs.readFileSync(process.env.CXX_IZUMI_DONOR||'C:/Users/lolian/Downloads/Izumi_0923-大少女乐队时代-V2.0-GAL气泡兼容.json'));
for(const id of ['705d4a8c-0e4e-4478-a700-34808d225132','611a5e2c-71f9-4b14-92c0-7b9f7093509f'])assert.deepEqual(preset.extensions.regex_scripts.find(r=>r.id===id),donor.extensions.regex_scripts.find(r=>r.id===id));
const chats=fs.readFileSync(path.join(ST,'public/scripts/chats.js'),'utf8'),tree=acorn.parse(chats,{ecmaVersion:'latest',sourceType:'module'});
const hostFunctions=['encodeStyleTags','decodeStyleTags','addDOMPurifyHooks'].map(name=>{const node=tree.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name===name)?.declaration;assert.ok(node,name);return chats.slice(node.start,node.end);}).join('\n');
// Controlled image requests prove loading/fallback behavior, not remote availability.
const imageFixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ioAAAAASUVORK5CYII=','base64');
async function main(){
 const server=http.createServer((req,res)=>res.end('<!doctype html><html></html>'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CXX_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}).catch(error=>{server.close();throw error;}),results=[];
 try{for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:920}}),errors=[],requests=[];let release,held=true;const gate=new Promise(r=>release=r);
  page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',async route=>{const url=route.request().url();requests.push(url);if(held)await gate;if(url.includes('_smile.'))return route.abort().catch(()=>{});return route.fulfill({contentType:'image/png',body:imageFixture}).catch(()=>{});});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.setContent('<style>body{background:#100f14;color:#ebe7e5;font:16px sans-serif;margin:0;padding:16px}#chat{max-width:800px;margin:auto}.mes_text{container-type:inline-size}#tavern_helper{margin-top:30px}*{box-sizing:border-box}</style><main id="chat"><div class="mes_text" id="message"></div></main><div id="tavern_helper"></div>');
  for(const file of ['dompurify/dist/purify.js','@adobe/css-tools/dist/umd/adobe-css-tools.js','showdown/dist/showdown.js'])await page.addScriptTag({path:path.join(ST,'node_modules',file)});
  await page.addScriptTag({content:'const css=cssTools;function isExternalMediaAllowed(){return true;}\n'+hostFunctions+'\naddDOMPurifyHooks();window.sanitizeMessage=html=>decodeStyleTags(DOMPurify.sanitize(encodeStyleTags(new showdown.Converter({simpleLineBreaks:true}).makeHtml(html)),{ADD_TAGS:["custom-style"],MESSAGE_SANITIZE:true}),{prefix:".mes_text "});'});
  await page.evaluate(html=>{document.querySelector('#message').innerHTML=sanitizeMessage(html);const listeners=new Map();window.testEvents={listeners,emit:(key,...args)=>{for(const f of listeners.get(key)||[])f(...args);}};window.persona={name:'夜行客',avatar:'https://fixture.invalid/user.png'};window.substitudeMacros=key=>key==='{{user}}'?persona.name:key==='{{userAvatarPath}}'?persona.avatar:key;
   window.SillyTavern={getContext:()=>({name1:persona.name,eventSource:{on:(k,f)=>{if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f);},removeListener:(k,f)=>listeners.get(k)?.delete(f)},event_types:{GENERATION_STARTED:'start',GENERATION_ENDED:'end',GENERATION_STOPPED:'stop',CHAT_CHANGED:'chat',PERSONA_CHANGED:'persona',PERSONA_UPDATED:'updated'}})};
  },rendered);
  assert.doesNotMatch(await page.locator('#message').innerText(),/CSS ERROR/);
  await page.addScriptTag({content:'(()=>{'+source+'})();'});
  const tomori='[data-bda="tomori"]',user='[data-bda="user"]',thought='[data-bda="anon"]';
  assert.equal(await page.locator(tomori+' img').count(),0);assert.equal(await page.locator(tomori+' [data-placeholder]').count(),1);
  assert.match(await page.locator(thought).innerText(),/心声/);
  assert.equal(await page.locator(user).getAttribute('data-bda-name'),'夜行客');
  const geometry=await page.locator(user).evaluate(el=>({display:getComputedStyle(el).display,paddingRight:parseFloat(getComputedStyle(el).paddingRight),paddingLeft:parseFloat(getComputedStyle(el).paddingLeft),label:getComputedStyle(el.querySelector('.custom-bda-speaker')).display,right:el.getBoundingClientRect().right,parentRight:el.closest('.mes_text').getBoundingClientRect().right}));
  assert.equal(geometry.display,'block');assert.equal(geometry.label,'none');assert.ok(geometry.paddingRight>geometry.paddingLeft);assert.ok(Math.abs(geometry.right-geometry.parentRight)<2);
  await page.screenshot({path:path.join(evidence,'r4-avatar-'+width+'.png'),fullPage:true});held=false;release();
  await page.waitForFunction(()=>document.querySelector('[data-bda="tomori"] img')?.getAttribute('src')?.includes('_shocked.png'));
  await page.locator(tomori).evaluate(el=>el.className='custom-bdc custom-bdc-cxx custom-bde-smile');await page.waitForFunction(()=>document.querySelector('[data-bda="tomori"] img')?.getAttribute('src')?.includes('_normal.png'));
  const mode=page.getByRole('combobox',{name:'2051 台词显示',exact:true});await mode.selectOption('initial');
  assert.match(await page.locator(tomori).evaluate(el=>getComputedStyle(el,'::before').content),/高/);assert.equal(await page.locator('[data-bda-owned="portrait"]').count(),0);
  await page.screenshot({path:path.join(evidence,'r4-initial-'+width+'.png'),fullPage:true});
  await mode.selectOption('color');assert.equal(await page.locator(tomori).evaluate(el=>getComputedStyle(el).display),'inline');assert.notEqual(await page.locator(tomori).evaluate(el=>getComputedStyle(el).color),await page.locator('#message').evaluate(el=>getComputedStyle(el).color));
  await mode.selectOption('off');assert.equal(await page.locator(tomori).evaluate(el=>getComputedStyle(el).color),await page.locator('#message').evaluate(el=>getComputedStyle(el).color));assert.match(await page.locator(tomori).innerText(),/地图已经准备好了/);
  const count=requests.length;await page.locator(tomori).evaluate(el=>el.className='custom-bdc custom-bdc-cxx custom-bde-blush');await page.waitForTimeout(1100);assert.equal(requests.length,count,'off mode avoids new portrait requests');
  await mode.selectOption('avatar');await page.getByRole('combobox',{name:'2051 用户头像来源'}).selectOption('initial');assert.equal(await page.locator(user).getAttribute('data-bda-view'),'initial');
  await page.getByRole('combobox',{name:'2051 用户头像来源'}).selectOption('persona');assert.equal(await page.locator(user+' img').getAttribute('src'),'https://fixture.invalid/user.png');
  await page.evaluate(()=>{persona.avatar='https://fixture.invalid/user2.png';testEvents.emit('updated');});assert.equal(await page.locator(user+' img').getAttribute('src'),'https://fixture.invalid/user2.png');
  await page.locator('#cxx-bda-roles summary').click();await page.locator('[data-role-id="tomori"]').uncheck();assert.equal(await page.locator(tomori).count(),0);await page.locator('[data-role-id="tomori"]').check();assert.equal(await page.locator(tomori).count(),1);await page.locator('#cxx-bda-roles summary').click();
  await page.evaluate(()=>{testEvents.emit('start','normal',{},false);document.body.setAttribute('data-cxx-gal-active','1');});await page.waitForFunction(()=>!document.querySelector('[data-bda]'));
  await page.evaluate(()=>{document.body.setAttribute('data-cxx-gal-active','0');testEvents.emit('end');});await page.waitForFunction(()=>document.querySelector('[data-bda="tomori"]'));
  const streaming=formatted('<cxx-story><cxx-say speaker="长崎素世" expression="serious">「接下来交给我。」</cxx-say></cxx-story>');
  const beforeStream=requests.length;await page.evaluate(html=>{testEvents.emit('start','normal',{},false);document.querySelector('#message').innerHTML=sanitizeMessage(html);},streaming);await page.waitForTimeout(1100);assert.equal(await page.locator('[data-bda]').count(),0);assert.equal(requests.length,beforeStream);
  await page.evaluate(()=>testEvents.emit('stop'));await page.waitForFunction(()=>document.querySelector('[data-bda="soyo"]'));
  await page.evaluate(html=>{document.querySelector('#message').innerHTML=sanitizeMessage(html);},noStyle);await page.waitForTimeout(1100);assert.equal(await page.locator('[data-bda],[data-bda-owned]').count(),0);assert.match(await page.locator('#message').innerText(),/地图已经准备好了/);
  // Legacy hosts restore dialogue after sanitizing; these spans have no custom- prefix.
  const protectedText=hooks.beforeRegex(raw,{}),legacySanitized=await page.evaluate(html=>sanitizeMessage(html),rules(protectedText)),legacy=hooks.afterRegex(legacySanitized);
  await page.evaluate(html=>{document.querySelector('#message').innerHTML=html;__cyber2051BandoriAvatar.refresh();},legacy);assert.equal(await page.locator(tomori+' .bda-speaker').evaluate(el=>getComputedStyle(el).display),'none');
  await page.evaluate(()=>__cyber2051BandoriAvatar.dispose());assert.equal(await page.locator('#cxx-bda-control,#cxx-bda-style,[data-bda-owned],[data-bda]').count(),0);assert.equal(await page.evaluate(()=>[...testEvents.listeners.values()].reduce((sum,v)=>sum+v.size,0)),0);
  await page.evaluate(()=>{delete window.SillyTavern;localStorage.removeItem('cyber2051-dialogue-display-v1');});await page.unroute('https://**/*');await page.route('https://**/*',route=>route.abort());
  await page.addScriptTag({content:'(()=>{'+source+'})();'});await page.waitForFunction(()=>document.querySelector('[data-bda="tomori"] [data-bda-expression-label]')?.textContent.includes('立绘暂未载入'));assert.equal(await page.locator(tomori+' img').count(),0);
  assert.equal(await page.locator('img[src^="blob:"],img[src^="data:"]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.evaluate(()=>__cyber2051BandoriAvatar.dispose());assert.deepEqual(errors,[]);results.push({width,geometry,checks:['sanitized regex CSS','four modes','thought label','player name and avatar source','role selection','own portrait loading and fallback','Gal during generation','no portrait work during streaming','stop refresh','regex-off plain dialogue','legacy host CSS','no-event fallback','dispose listeners'],errors});await page.close();
 }}finally{stop();await browser.close();await new Promise(r=>server.close(r));}
 const result={presetSha256:sha(fs.readFileSync(presetFile)),card:{file:cardFile,sha256:sha(fs.readFileSync(cardFile))},hostSource:{version:JSON.parse(fs.readFileSync(path.join(ST,'package.json'))).version,chatsSha256:sha(chats)},scope:'Controlled browser with installed ST sanitizer functions; image requests mocked; no real ST/TT import or model generation.',offline:['preset build preservation checks','donor normalization and quote rules exact','regex compilation','prompt/user exclusions','all-depth styling','code protection','style idempotency','native dialogue once'],results};
 fs.writeFileSync(path.join(evidence,process.env.CXX_PRESET_FILE?'bubbles.json':'bubbles-v07-r1.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
module.exports={source,rendered,noStyle,hostFunctions,formatted};
if(require.main===module){
 if(process.argv.includes('--static')){stop();console.log(JSON.stringify({pass:true,scope:'offline regex and preservation checks; no browser started',preset:presetFile,sha256:sha(fs.readFileSync(presetFile))},null,2));}
 else main().catch(e=>{console.error(e);process.exitCode=1;});
}
