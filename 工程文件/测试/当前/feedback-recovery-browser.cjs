'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),runtime=path.join(root,'工程文件/卡片源码');
const output=path.join(root,'.cache/diagnostics/2.3.10-feedback-fix-20261023/save/browser-current');
fs.mkdirSync(output,{recursive:true});
const browserPath=[process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Microsoft/Edge/Application/msedge.exe')].find(value=>value&&fs.existsSync(value));
if(!browserPath)throw Error('需要本机 Chrome 或 Edge 运行隔离浏览器测试。');
const sourceFiles=['共享/data-clone.js','共享/vendor/js-sha256/sha256.js','运行时/crypto-compat.js','通讯/phone-core.js','运行时/core.js'];
const scripts=sourceFiles.map(file=>fs.readFileSync(path.join(runtime,file),'utf8')).concat(['backup','diagnostics'].map(name=>fs.readFileSync(path.join(runtime,'运行时',name+'.js'),'utf8')));
const setup=`
window.reloads=0;window.openedCopies=[];window.copies=new Map();window.current={cardId:'cyber2051',characterKey:'isolated-browser.png',chatId:'isolated-story'};
window.live={messages:[{mes:'unsaved story',swipes:['unsaved story','alternate branch'],swipe_id:0,swipe_info:[{},{unknown:'all branches'}],variables:[{}, {custom:'unselected variables'}],foreign:{keep:true}}],metadata:{integrity:'original',variables:{preset:1}},updateState:{installed:{}},versions:{st:'1.18.0',helper:'4.9.5'}};
window.raw=[{unknownHeader:'kept',chat_metadata:structuredClone(live.metadata)},...structuredClone(live.messages)];raw[0].chat_metadata.variables.preset=2;
window.host={getContext:()=>({...current}),assertContext(expected){if(['cardId','characterKey','chatId'].some(k=>expected[k]!==current[k]))throw Error('scope changed');},readState:()=>structuredClone(live.updateState),withLock:work=>work(),ready:async()=>{}};
window.adapters={snapshot:()=>structuredClone(live),liveSnapshot:()=>structuredClone(live),readCurrent:async()=>({header:raw[0],jsonl:raw.map(JSON.stringify).join('\\n')}),copyExists:async(_,id)=>copies.has(id),readCopy:async(_,id)=>structuredClone(copies.get(id)||[]),writeCopy:async(_,id,rows)=>copies.set(id,structuredClone(rows))};
window.backup=CxxUpdateBackup.create({host,core:CxxUpdateCore,adapters,crypto,api:{}});
window.Cxx233Updater={host,backup,pauseForStory:async()=>()=>{}};
window.__cxx_chat_save_guard_v1={reopen:async({preserve})=>{await preserve({format:1,type:'cxx-chat-reopen-draft',scope:current,loaded:{messages:structuredClone(live.messages),metadata:structuredClone(live.metadata)},completeLoaded:{messages:structuredClone(live.messages),metadata:structuredClone(live.metadata)},disk:structuredClone(raw),characterVariables:{unknown:'character store'},composer:'这是重新打开前尚未发送的输入'});reloads++;return{kind:'ready'};}};
window.SillyTavern={getContext:()=>({openCharacterChat:async id=>{openedCopies.push(id);current.chatId=id;}})};
window.recovery=CxxDiagnosticRuntime.createReopenRecovery({win:window});
window.subscribers=new Set();window.service={reopenRecovery:recovery,read:()=>({rows:[],modules:[],current:{character:current.characterKey,chat:current.chatId},health:[],scan:{checked:1},network:[]}),subscribe:fn=>{subscribers.add(fn);fn();return()=>subscribers.delete(fn);}};
window.dispose=CxxDiagnosticRuntime.panel(document.getElementById('app'),service);
`;
(async()=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html><meta charset="utf-8"><body><main id="app"></main></body></html>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({executablePath:browserPath,headless:true});const context=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url='http://127.0.0.1:'+server.address().port+'/';
  async function initialize(){await page.goto(url);for(const source of scripts)await page.addScriptTag({content:source});await page.addScriptTag({content:setup});await page.getByText('保存冲突恢复与保全记录',{exact:true}).click();}
  await initialize();await page.getByRole('button',{name:'保全当前内容并重新打开',exact:true}).click();await page.getByText('已保全原内容并重新打开，可以继续保存。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>reloads),1);
  const before=await page.getByLabel('重新打开前的备份').inputValue();assert.match(before,/^[a-f0-9]{64}$/);
  await initialize();await page.getByRole('button',{name:'读取本角色保全记录',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="重新打开前的备份"]')?.value.length===64);assert.equal(await page.getByLabel('重新打开前的备份').inputValue(),before);assert.equal(await page.evaluate(()=>reloads),0);
  await page.getByRole('button',{name:'取回保全的输入草稿',exact:true}).click();assert.equal(await page.getByLabel('保全的输入草稿').inputValue(),'这是重新打开前尚未发送的输入');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'下载选中备份',exact:true}).click();const download=await downloadEvent,downloadPath=path.join(output,'browser-exported-backup.json');await download.saveAs(downloadPath);const document=JSON.parse(fs.readFileSync(downloadPath,'utf8'));assert.equal(document.payload.messages[0].swipe_info[1].unknown,'all branches');assert.equal(document.payload.messages[0].variables[1].custom,'unselected variables');assert.equal(document.payload.reopenDraft.composer,'这是重新打开前尚未发送的输入');
  assert.equal(await page.evaluate(document=>backup.parse(document).then(value=>value.sha256),document),before);
  await page.getByRole('button',{name:'核对选中备份',exact:true}).click();await page.getByText('已核对：1 层正文、2 个分支；确认后创建新故事副本。',{exact:true}).waitFor();await page.getByRole('button',{name:'恢复为新故事副本',exact:true}).click();await page.waitForFunction(()=>openedCopies.length===1);assert.equal(await page.evaluate(()=>copies.size),2);
  await page.evaluate(()=>{current.characterKey='other.png';for(const fn of subscribers)fn();});assert.equal(await page.getByLabel('重新打开前的备份').isDisabled(),true);assert.equal(await page.getByLabel('保全的输入草稿').isVisible(),false);
  assert.deepEqual(errors,[]);const result={kind:'isolated Chromium UI + IndexedDB persistence + real backup parse/restoreCopy',browser:path.basename(browserPath),liveHost:false,liveSavesTouched:false,pass:true,checks:['durable write/read before reopen','page reload retained original document','download parsed by existing backup parser','unsent composer available to copy','all branches and unknown fields retained','preview restore creates two new copies and opens restored one','scope change clears former records and composer'],errors};fs.writeFileSync(path.join(output,'recovery-browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
