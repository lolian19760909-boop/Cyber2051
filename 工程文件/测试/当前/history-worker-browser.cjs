'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const {chromium}=require('../../独立制卡器/workbench/node_modules/playwright');
const B=require('../../工具/构建/当前/build.cjs'),{extract}=require('../../工具/lib/script-modules.cjs'),{workerNode}=require('../../工具/lib/card-ast.cjs');
async function main(){
  const file=path.resolve(process.env.CXX_TEST_CARD||B.output),card=JSON.parse(fs.readFileSync(file)),core=card.data.extensions.tavern_helper.scripts.find(s=>s.id==='cxx-business-core-241').content;
  const workerSource=workerNode(core).value,modules=extract(core,['Cxx238Dialogue','CxxGalParser','CxxStorySummaries','Cxx249HistoryRuntime']).map(m=>m.source).join('\n;\n');
  const dir=path.resolve(process.env.CXX_EVIDENCE||path.join(B.root,'.cache/component-e2'));
  fs.mkdirSync(dir,{recursive:true});
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta charset="utf-8"><title>2051 E2 Worker isolation</title>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;const report={file,scope:'隔离Edge，真实Blob Worker与候选模块；受控消息夹具，无ST/TT与玩家数据',checks:[],errors:[],externalRequests:[]};
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    const origin='http://127.0.0.1:'+server.address().port;
    await page.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){report.externalRequests.push(route.request().url());return route.abort();}return route.continue();});
    await page.goto(origin);await page.addScriptTag({content:modules});
    const result=await page.evaluate(async({workerSource,raws})=>{
      const checks=[],eq=(a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Result mismatch');},ok=(value,label)=>{if(!value)throw Error(label);},sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const sources=[],services=[],life={created:0,terminated:0,urls:0,revoked:0};
      function create({delay=0,unavailable=false,broken=false}={}){
        const platform={setTimeout:(fn,ms)=>window.setTimeout(fn,ms),clearTimeout:id=>window.clearTimeout(id),Blob,URL:{createObjectURL(blob){life.urls++;return URL.createObjectURL(blob);},revokeObjectURL(url){life.revoked++;URL.revokeObjectURL(url);}}};
        if(!unavailable)platform.Worker=class extends Worker{constructor(url){super(url);life.created++;this.addEventListener('error',e=>e.preventDefault());}terminate(){life.terminated++;super.terminate();}};
        const source=broken?'throw new Error("controlled-worker-failure");':workerSource+(delay?'\nconst originalDispatch=self.onmessage;self.onmessage=e=>setTimeout(()=>originalDispatch(e),'+delay+');':'');
        const service=Cxx249HistoryRuntime.create({workerSource:source,platform,run:(kind,payload)=>kind==='parse'?CxxGalParser.parseMessage(payload.raw,{cache:false}):CxxStorySummaries.row(payload.message,payload.floor,CxxGalParser)});
        services.push(service);return service;
      }
      try{
        const h=create();
        for(const [i,raw]of raws.entries()){
          const message={mes:raw,is_user:false,swipe_id:1,extra:'keep'},snapshot=JSON.stringify(message);sources.push(snapshot);
          const parsed=await h.submit('parse',{raw},h.messageSource(message,'A'));eq(parsed,CxxGalParser.parseMessage(raw,{cache:false}));ok(parsed.raw===raw,'raw changed');
          const row=await h.submit('summary',{message,floor:i+1},h.messageSource(message,'A','summary'));eq(row,CxxStorySummaries.row(message,i+1,CxxGalParser));ok(JSON.stringify(message)===snapshot,'record changed');
        }
        ok(h.stats().worker&&h.stats().fallback===0,'Worker did not execute');checks.push('候选真实Blob Worker：正文、心声、辅助块、异常标签、摘要与主线程一致，原消息不变');
        const m={mes:raws[0]},source=h.messageSource(m,'A'),before=h.stats().submitted;
        const both=await Promise.all([h.submit('parse',{raw:m.mes},source),h.submit('parse',{raw:m.mes},source)]);eq(both[0],both[1]);ok(h.stats().submitted===before+1,'duplicate jobs');
        await h.submit('parse',{raw:m.mes},source);ok(h.stats().cacheHits>0,'cache missed');checks.push('重复事件合并执行，同修订读取命中原缓存');
        const delayed=create({delay:40}),edited={mes:'旧正文'},editJob=delayed.submit('parse',{raw:edited.mes},delayed.messageSource(edited,'edit'));
        const editedResult=editJob.then(()=>false,e=>e.code==='cxx-history-stale');edited.mes='编辑后正文';ok(await editedResult,'edited result accepted');ok(delayed.stats().entries===0,'stale cached');checks.push('受控延迟下，编辑楼层后旧异步结果丢弃');
        const swipe={mes:'相同正文',swipe_id:0},swipeJob=delayed.submit('parse',{raw:swipe.mes},delayed.messageSource(swipe,'swipe')),swipeResult=swipeJob.then(()=>false,e=>e.code==='cxx-history-stale');swipe.swipe_id=1;ok(await swipeResult,'old swipe accepted');checks.push('受控延迟下，即使正文相同，切换swipe仍使旧结果失效');
        const a=delayed.submit('parse',{raw:'A旧结果'},{key:'a1',revision:1,scope:'A'}),queued=delayed.submit('parse',{raw:'A排队'},{key:'a2',revision:1,scope:'A'});
        const discarded=Promise.all([a,queued].map(p=>p.then(()=>false,e=>e.code==='cxx-history-stale')));delayed.clearScope('A');ok((await discarded).every(Boolean),'chat not cleared');
        const b=await delayed.submit('parse',{raw:'B当前正文'},{key:'b',revision:1,scope:'B'});ok(b.raw==='B当前正文','wrong chat result');checks.push('切聊终止在途Worker并清除排队任务，新聊天重新创建Worker');
        const fallback=create({unavailable:true}),recover=create({broken:true});
        for(const service of [fallback,recover]){const value=await service.submit('parse',{raw:raws[0]},{key:'fallback',revision:1});eq(value,CxxGalParser.parseMessage(raws[0],{cache:false}));ok(service.stats().fallback===1,'fallback not run');}
        checks.push('无Worker及真实Worker启动异常均回到既有主线程解析');
        const error=await h.submit('summary',{message:null,floor:2},{key:'bad',revision:1}).then(()=>null,e=>e);ok(error&&typeof error.message==='string','error envelope lost');
        ok((await h.submit('parse',{raw:'错误后继续'},{key:'next',revision:1})).raw==='错误后继续','Worker stuck after error');checks.push('任务错误保持原错误信封；错误后的有效任务继续处理');
        const pending=delayed.submit('parse',{raw:'卸载前任务'},{key:'destroy',revision:1,scope:'B'}),gone=pending.then(()=>false,e=>e.code==='cxx-history-stale');delayed.destroy();ok(await gone,'destroy did not reject');
        await sleep(70);for(const service of services)service.destroy();ok(life.created===life.terminated,'Worker leak');ok(life.urls===life.revoked,'Blob URL leak');
        ok(services.every(s=>s.stats().pending===0&&s.stats().entries===0&&s.stats().bytes===0),'queue or cache leak');checks.push('卸载释放全部Worker、Blob URL、缓存和等待任务');
        return {checks,life,sampleCount:raws.length};
      }finally{for(const service of services)service.destroy();}
    },{workerSource,raws:[...require('../Gal/fixtures/messages.json').map(x=>x.raw),require('./fixtures/thought-lines.json').raw,require('./fixtures/update-variable.cjs').reported,'<cxx-story>正文。</cxx-story><UpdateVariable><JSONPatch>[','<cxx-story>千早爱音【心声】：还没结束。</cxx-story>']});
    Object.assign(report,result);assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
  fs.writeFileSync(path.join(dir,'worker-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
