'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sourceRoot=path.join(process.env.CXX_SAVE_SOURCE_ROOT||path.resolve(__dirname,'../../卡片源码'),'运行时');
const server=http.createServer((req,res)=>{if(req.url.endsWith('.js')){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join(sourceRoot,req.url.slice(1))));}else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<script src="/boot-loader.js"></script><script src="/game-menu.js"></script>');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(5000);await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.CxxGameMenu);
 await page.evaluate(async()=>{window.events=[];window.vars={};let chatId='before',creation;
  window.Cxx236OpeningHost={beginDraft:options=>{creation=options;window.creation=options;return {state:()=>({busy:false}),cancel(){}};},refresh(){}};
  window.Cxx233Updater={pauseForStory:async()=>{events.push('pause');return()=>events.push('release');},initializeChat:async()=>{events.push('content');vars.__cxx_content_pins??={pack:'1.0.0'};vars.__cxx_content_origin??={instanceId:'fixture',initialized:true,newChat:true};}};
  window.__cxx_player__={completeOpening:async()=>{events.push('player');if(vars.__cxx_content_origin?.instanceId!=='fixture')throw Error('player initialization ran before content bindings');vars.player='saved';},waitForSaved:async()=>{events.push('verify-player');}};
  const store={list:async()=>[],saveOpeningDraft:async()=>{events.push('draft');},finishCreation:async()=>{events.push('finish');window.persisted=structuredClone(vars);},inspectPending:async()=>({})};
  window.menu=CxxGameMenu.create({win:window,store,context:()=>({instanceId:'fixture',chatId}),begin:async()=>{events.push('begin');chatId='new-story';vars={foreign:{keep:7}};return {chatId};}});await menu.open('slots');
 });
 await page.getByRole('button',{name:'档位 1 · 空',exact:true}).click();await page.getByRole('button',{name:'在档位 01 创建人物',exact:true}).click();await page.waitForFunction(()=>!!window.creation);
 await page.evaluate(()=>creation.withCommit(async()=>{await creation.submit({creationId:'one',draft:{creationId:'one'}});await creation.verify();}));
 const result=await page.evaluate(()=>({events,persisted}));assert.deepEqual(result.events,['pause','begin','draft','content','player','verify-player','finish','release']);assert.deepEqual(result.persisted.foreign,{keep:7});assert.equal(result.persisted.__cxx_content_pins.pack,'1.0.0');assert.equal(result.persisted.player,'saved');assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,checks:['new route binds content before player initialization','completed story includes content bindings and unknown fields','one pause surrounds the complete creation'],events:result.events}));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
