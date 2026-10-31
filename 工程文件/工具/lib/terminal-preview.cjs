'use strict';
const B=require('./card-ast.cjs'),{extract}=require('./script-modules.cjs');
const wanted=new Set(['CxxOperations','CxxPlayerReader','CxxPlayerSave','CxxPlayerRefresh','CxxQuestHost','CxxDiagnosticRuntime','CxxComponentCatalog','CxxQuests','CxxItemArt','CxxItemModel','CxxItemCatalog','CxxItemEditor','CxxBattle','CxxBattleUI','CxxBattleSurface','CxxItemDefinitions','CxxLoadout','CxxPlayerAssets','CxxPlayerArt','CxxLoadoutSetup','CxxNumericRules','CxxTalentRules','CxxTalentData','CxxGrowthRules','CxxTalentEffects','CxxNumericGrowthBase','CxxNumericGrowth','CxxNumericEngine','CxxGameplay','CxxTalents','CxxPlayerOperations','CxxPlayerUI','CxxPlayerHost','CxxIdentity','CxxTalentUI','Cxx233TerminalFactory']);
function readingHelper(all){
 const found=[];B.walk(B.acorn.parse(all,{ecmaVersion:'latest',sourceType:'module'}),n=>{
  if(n.type!=='ExpressionStatement'||n.expression?.type!=='CallExpression')return;
  const body=n.expression.callee?.body?.body;if(body?.[0]?.declarations?.[0]?.id?.name!=='host')return;
  const source=all.slice(n.start,n.end);if(source.includes('__cxxReadingUIBuild')){found.push(source);return false;}
 });
 B.assert.ok(new Set(found).size<=1,'packaged reading helpers agree');return found[0]||'';
}
function configuration(card){
 const e=B.extract(card),all=card.data.extensions.tavern_helper.scripts.map(s=>s.content||'').join('\n;\n');
 const block=e.native.slice(e.mapBlock.start,e.mapBlock.end),mapCode=block.slice(block.indexOf('const documents='),block.indexOf("own(publish('Cxx233Maps'"));
 wanted.add('CxxMotion');wanted.add('CxxDataClone');wanted.add('CxxPopover');wanted.add('CxxStoryProfile');wanted.add('CxxPlayerProfileUI');wanted.add('CxxGrowthFeedback');
 for(const name of ['CxxEnsembleContent','CxxEnsembleState','CxxEnsembleMvu','CxxEnsembleView','CxxEnsembleUI','Cxx238Dialogue','CxxGalParser','CxxRoster','CxxCity','CxxPolice','CxxCivic','CxxCivicUI'])wanted.add(name);
 for(const name of ['CxxTacticalRules','CxxTacticalEngine','CxxTacticalUI','CxxTacticalAssets','CxxTacticalHost','CxxBattleContext','CxxCrypto','CxxAtlasDocumentStyle','CxxAtlasResourcesFactory','CxxAtlasToolFactory'])wanted.add(name);
 const visualNames=['CxxHubArt','CxxPlayerProfileStyle','CxxMenuArt','CxxTalentAssets'];
 if(all.includes('globalThis.CxxEnsembleStyle='))visualNames.push('CxxEnsembleStyle');
 for(const name of ['CxxTalentFullscreenStyle','CxxTacticalStyle','CxxBattleSurfaceStyle','CxxAtlasToolStyle','CxxTalentStyle','CxxIdentityStyle','CxxPlayerStyle','CxxThemeCSS','CxxLoadoutSetupStyle','CxxFeedbackStyle','CxxCombatViewStyle','CxxCityData','CxxPoliceRules','CxxCivicStyle'])if(new RegExp('globalThis\\.'+name+'\\s*=').test(all))visualNames.push(name);
 const visual=require('./card-global.cjs')(all,visualNames);
 return {html:e.html,mapCode,embedded:readingHelper(all)+';\n'+visual+';\n'+extract(all,[...wanted]).map(m=>m.source).join('\n;\n'),runtime:B.statement(all,'root.parent.Cxx233Runtime?.destroy()').source};
}
function setupHost(){
  const copy=structuredClone,events=new Map();window.metrics={writes:0,saves:0,reads:0,variableReads:0};window.chatId='terminal-fixture';window.saveDelay=0;window.failSave=false;
  const identity={...CxxIdentity.snapshot('street','',CxxIdentity.initialSetup('street'),{weapon:'pistol'}),setupToken:'fixture-start'};
  const stat=CxxPlayerOperations.plan({terminal:{wallet:{yen:500},unknown:{keep:true}}},{action:'initialize'},{identity,newChat:true});
  const chat=[{is_user:true,mes:'开始游玩',swipe_id:0},{mes:'当前剧情',is_user:false,swipe_id:0,variables:[{stat_data:stat}]}];
  const c=window.c={chat,characters:[{avatar:'terminal-fixture.png',name:'终端检查'}],characterId:0,chatMetadata:{variables:{__cxx_identity:identity}},getCurrentChatId:()=>chatId,getRequestHeaders:()=>({}),eventTypes:{CHAT_CHANGED:'changed',MESSAGE_SWIPED:'swiped',MESSAGE_UPDATED:'updated',GENERATION_ENDED:'ended',CHARACTER_MESSAGE_RENDERED:'rendered'},async saveChat(){metrics.saves++;const value=copy([{chat_metadata:c.chatMetadata},...c.chat]);if(saveDelay)await new Promise(r=>setTimeout(r,saveDelay));if(failSave)throw Error('fixture-save-failed');window.disk=value;}};
  window.disk=copy([{chat_metadata:c.chatMetadata},...chat]);
  const api=window.api={parent:window,SillyTavern:{getContext:()=>c},_:_,tavern_events:c.eventTypes,builtin:{duringGenerating:()=>false},getLastMessageId:()=>c.chat.length-1,initializeGlobal:(name,value)=>window[name]=value,
   getVariables({type='chat',message_id}={}){metrics.variableReads++;return type==='character'?{}:type==='message'?copy(c.chat[message_id]?.variables?.[c.chat[message_id]?.swipe_id||0]||{}):copy(c.chatMetadata.variables);},
   async updateVariablesWith(fn,{type,message_id}){if(type==='chat')c.chatMetadata.variables=fn(copy(c.chatMetadata.variables));else c.chat[message_id].variables[c.chat[message_id].swipe_id||0]=fn(copy(c.chat[message_id].variables[c.chat[message_id].swipe_id||0]));metrics.writes++;},
   eventOn(n,fn){if(!events.has(n))events.set(n,new Set());events.get(n).add(fn);},eventRemoveListener(n,fn){events.get(n)?.delete(fn);},eventEmit:async(n,...args)=>{for(const fn of events.get(n)||[])await fn(...args);}
  };
  Object.assign(window,api);window.parent=window;
  window.Cxx236VariableGuard={validateProgram:(a,b,o)=>CxxPlayerOperations.validate(a,b,o.engineOperation)};
  window.toastr={warning:message=>window.warning=message};
  window.Cxx236Preferences={read:()=>({level:'low',device:innerWidth<700?'mobile':'desktop'}),device:()=>innerWidth<700?'mobile':'desktop',subscribe:()=>()=>{},open(){}};
  const reader=CxxPlayerHost.createReader({api,readDisk:async()=>{metrics.reads++;return copy(disk);}});
  window.player=CxxPlayerHost.create({api,host:{assertPlayerWritable:async()=>{},withChatSave:async(_,fn)=>fn()},read:reader});player.start();
  window.runtime=window.Cxx233Runtime=makeRuntime(api);
  window.__events=events;
}
async function environment(browser,url,card,width=1280,height=900,browserOptions={},hooks={}){
 const page=await browser.newPage({...browserOptions,viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.setDefaultTimeout(10000);
 await page.route('https://**/*',r=>r.abort());await page.goto(url);
 await page.setContent('<style>body{margin:0;background:#0c0f12;color:white}#chat{height:100vh}.mes{height:100%}</style><div id="chat"><div class="mes" mesid="1"></div></div><textarea id="send_textarea"></textarea>');
 const config=configuration(card);await page.addScriptTag({content:B.fs.readFileSync(require.resolve('lodash/lodash.min.js'),'utf8')});await page.addScriptTag({content:config.embedded});
 await page.addScriptTag({content:'window.module={exports:{}};\n'+config.runtime+'\nwindow.makeRuntime=module.exports.create;delete window.module;'});
 await page.evaluate(setupHost);
 if(hooks.prepare)await hooks.prepare(page);
 await page.addScriptTag({content:'(()=>{'+config.mapCode+'\nwindow.Cxx233Maps={documents,install,mount,prepare};})();'});
 await page.evaluate(html=>{window.terminal=Cxx233TerminalFactory.create({window,api,runtime,html});window.Cxx233Terminal=terminal;window.startTime=performance.now();terminal.open({messageId:1,consumer:{}});},config.html);
 await page.waitForFunction(()=>terminal.read().ready);const frame=await (await page.$('#cxx-shared-terminal-233')).contentFrame();await frame.waitForFunction(()=>document.getElementById('t2051x-terminal')?.hidden===false);
 return {page,frame,errors};
}
function preview(card){
 const c=configuration(card),script=value=>'<script>'+value.replace(/<\/script/gi,'<\\/script')+'</script>';
 return '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>当前 终端维护源预览</title><style>body{margin:0;background:#0c0f12}#chat,.mes{height:100dvh}</style><div id="chat"><div class="mes" mesid="1"></div></div><textarea id="send_textarea" hidden></textarea>'+script(B.fs.readFileSync(require.resolve('lodash/lodash.min.js'),'utf8'))+script(c.embedded)+script('window.module={exports:{}};'+c.runtime+';window.makeRuntime=module.exports.create;delete window.module;')+script('('+setupHost.toString()+')();')+script('(()=>{'+c.mapCode+';window.Cxx233Maps={documents,install,mount,prepare};})();')+script('window.terminal=Cxx233TerminalFactory.create({window,api,runtime,html:'+JSON.stringify(c.html)+'});window.Cxx233Terminal=terminal;terminal.openPage("city");');
}
module.exports={configuration,environment,setupHost,preview};
