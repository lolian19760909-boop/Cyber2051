const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const Startup=require('../../卡片源码/运行时/startup-state.js'),instrument=require('../../工具/lib/startup-instrument.cjs');
test('caught startup failures retain code and stack for diagnostics',async()=>{
 const reports=[],win={setTimeout,clearTimeout,CxxDiagnostics:{module(){},report:e=>reports.push(e)}};Startup.install(win);
 const context={parent:win,waitGlobalInitialized:()=>Promise.reject(Object.assign(Error('connection closed'),{code:'HOST_DOWN'})),console:{error(){}}};
 const source=instrument("(async()=>{await waitGlobalInitialized('Cxx233Updater');})().catch(e=>{console.error('[core]',e);});",{id:'core',name:'剧情与玩法核心'});
 await vm.runInNewContext(source,context);assert.match(reports[0].message,/connection closed/);assert.match(reports[0].detail,/Error: connection closed/);assert.equal(reports[0].context.code,'HOST_DOWN');assert.equal(win.CxxStartup.read()[0].state,'启动失败');win.CxxStartup.destroy();
});
test('a dependency that never resolves records its exact name after the startup deadline',async()=>{
 let timeout;const win={setTimeout:fn=>(timeout=fn,1),clearTimeout(){}};Startup.install(win);let finish;const work=win.CxxStartup.wait('core','剧情与玩法核心','Cxx233Updater',()=>new Promise(r=>finish=r));timeout();assert.equal(win.CxxStartup.read()[0].state,'依赖等待超过10秒');assert.equal(win.CxxStartup.read()[0].detail,'Cxx233Updater');finish();await work;assert.equal(win.CxxStartup.read()[0].state,'依赖已就绪');win.CxxStartup.destroy();
});
