(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxUpdaterUpgrade=api;})(globalThis,function(root){
  'use strict';
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):globalThis.CxxCrypto;
  const ID='cf33c692-7a41-444d-b8b7-6a70163e0104',copy=x=>JSON.parse(JSON.stringify(x));
  const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
  const flat=nodes=>nodes.flatMap(n=>[n,...(n.type==='folder'?flat(n.scripts):[])]);
  function patch(trees,before,content,Core){
    const found=flat(trees).filter(n=>n.id===ID);if(found.length!==1||Core.canonical(found[0])!==Core.canonical(before))fail('upgrade-target-changed','更新器在检查后变化，未覆盖');
    const visit=nodes=>nodes.map(n=>n.id===ID?{...copy(n),content}:n.type==='folder'?{...copy(n),scripts:visit(n.scripts)}:copy(n));return visit(trees);
  }
  function create({api=root,manifest,content,Core=root.CxxUpdateCore,Host=root.CxxUpdateHost,Controller=root.CxxUpdateController,Backup=root.CxxUpdateBackup,report=()=>{},sessionId=CryptoCompat.uuid(),wait=ms=>new Promise(r=>setTimeout(r,ms))}){
    let running=false,job=null;
    const surface=api.parent||root,operations=surface.__cxx_legacy_upgrade_ops_v1__||(surface.__cxx_legacy_upgrade_ops_v1__=new Map());
    root.addEventListener?.('pagehide',()=>{if(job&&operations.get(job.character)===job)operations.delete(job.character);},{once:true});
    function exclusive(kind,work){
      const character=api.getCurrentCharacterId?.()||sessionId,chat=api.SillyTavern?.getContext?.().getCurrentChatId?.()||'';
      if(job&&job.kind===kind&&job.character===character&&job.chat===chat)return job.promise;
      if(job||operations.has(character))return Promise.reject(Object.assign(Error('已有旧版工具正在处理，请等待当前任务完成。'),{code:'upgrade-running'}));
      const entry={kind,character,chat};job=entry;operations.set(character,entry);
      entry.promise=Promise.resolve().then(work).finally(()=>{if(operations.get(character)===entry)operations.delete(character);if(job===entry)job=null;});return entry.promise;
    }
    function source(){
      const found=flat(api.getScriptTrees({type:'character'})).filter(s=>s.id===ID);
      if(found.length!==1)fail('migration-source-missing','请打开本卡的旧聊天，保留唯一的卡内更新器。');
      const before=found[0],seed=before.data?.__cxx_update_seed;
      if(seed?.cardId!=='cyber2051')fail('migration-source-missing','未识别到本卡记录，请先打开旧卡聊天。');
      return {before,seed};
    }
    async function registered(){const value=source(),hash=await Core.sha256(value.before.content);if(hash!==manifest.targetHash&&!manifest.sources.some(s=>s.sha256===hash))fail('migration-source-unregistered','此更新器被修改或尚未登记；请导出救援文件供核查。');return value;}
    function exportSeed(seed,host){
      const current=host.readState().installed?.['cyber2051.core'];
      return current?.release?{...seed,...current.release.seed,baseVersion:current.version,migration:{...seed.migration,...current.release.seed?.migration,buildId:current.release.buildId,saveSchema:current.release.saveSchema}}:seed;
    }
    async function runUpgrade(){
      if(running)fail('upgrade-running','升级工具正在处理');running=true;let repair,oldService;
      try{
        if(!manifest||manifest.type!=='cyber2051.updater-upgrade'||manifest.updaterId!==ID||await Core.sha256(content)!==manifest.targetHash)fail('upgrade-tool-invalid','升级工具的代码或清单校验失败');
        const trees=api.getScriptTrees({type:'character'}),found=flat(trees).filter(s=>s.id===ID);if(found.length!==1||!found[0].enabled)fail('upgrade-target-missing','请打开本卡单角色聊天，并启用唯一的“更新与存档”脚本');
        const before=copy(found[0]),seed=before.data?.__cxx_update_seed;if(seed?.cardId!=='cyber2051'||Core.compareVersions(seed.baseVersion,'2.0.45')<0)fail('upgrade-source-unsupported','此工具仅支持2.0.45及以后的本卡');
        const sourceHash=await Core.sha256(before.content);if(sourceHash!==manifest.targetHash&&!manifest.sources.some(s=>s.sha256===sourceHash))fail('upgrade-source-modified','更新器被修改或未登记，未覆盖；请保留原件核对');
        const host=Host.create({core:Core,api,rawRegex:true});await host.ready();const expected=host.getContext();host.assertContext(expected,true);
        // Each new host starts with a two-second write quiet period. Waiting
        // here must not waive the context/generation guards used by the lock.
        report('正在等待宿主保存稳定');await wait(2100);host.assertContext(expected);
        repair=Controller.create({api,host,core:Core,seed,hostModule:Host});oldService=api.parent?.Cxx233Updater;
        // Acquire the actual lock before stopping the old service. Its
        // whenIdle may wait forever on the very journal this tool must recover.
        let result;for(let attempt=0;;attempt++){let entered=false;try{result=await host.withLock(async()=>{
          entered=true;host.assertContext(expected);if(sourceHash!==manifest.targetHash)oldService?.stop();await repair.initialize();
          if(sourceHash===manifest.targetHash){
            const state=host.readState(),pending=state.updaterUpgrade;
            if(pending&&pending.status!=='complete'&&(pending.targetHash!==manifest.targetHash||!['cardId','characterKey','chatId'].every(k=>pending.context?.[k]===expected[k])))fail('upgrade-pending-other','另一笔更新器升级尚未结束，请回到原故事核对该升级记录。');
            if(pending?.sessionId===sessionId&&pending.status==='awaiting-reload'){report('更新器已保存。请刷新酒馆后再次点击本工具核对完成。');return {status:'awaiting-reload'};}
            await repair.recover();await host.assertNoPendingInstall();const disk=await host.persisted(expected),actual=flat(disk.extensions.tavern_helper.scripts).find(s=>s.id===ID);
            if(!actual||await Core.sha256(actual.content)!==manifest.targetHash)fail('upgrade-save-unconfirmed','更新器磁盘读回尚未确认，请保留工具重试');
            if(pending&&pending.status!=='complete'){state.updaterUpgrade={...pending,status:'complete'};await host.saveState(state,expected);}
            report('更新器升级已核对完成；当前卡版本与游玩进度保持。可以停用本工具。');return {status:'complete'};
          }
          report('正在核对并恢复原安装记录');await repair.recover();await host.assertNoPendingInstall();
          const current=flat(api.getScriptTrees({type:'character'})).find(s=>s.id===ID);if(Core.canonical(current)!==Core.canonical(before))fail('upgrade-target-changed','恢复后更新器已变化，请重新检查');
          report('正在保存完整聊天与原更新器备份');const chat=await repair.backup.beforeContentInstall({alreadyLocked:true});
          let state=host.readState(),record=state.updaterUpgrade;
          if(record?.status&&record.status!=='complete'&&record.targetHash!==manifest.targetHash)fail('upgrade-pending-other','另一个更新器升级尚未结束，请先核对原记录');
          if(!record||record.status==='complete'){
            const name='cxx-updater-backup-'+CryptoCompat.uuid();record={id:CryptoCompat.uuid(),name,sourceHash,targetHash:manifest.targetHash,status:'prepared',sessionId,context:expected,chatBackup:chat};
            await host.writeRawBook(name,{entries:{},extensions:{__cxx_updater_upgrade:{format:1,record:copy(record),script:copy(before)}}},expected);
            state.updaterUpgrade=record;state.lastChatBackup=chat;await host.saveState(state,expected);
          }
          record={...record,status:'awaiting-reload',sessionId};state=host.readState();state.updaterUpgrade=record;await host.saveState(state,expected);
          report('正在保存新版更新器；请勿切换聊天');host.assertContext(expected);
          api.updateScriptTreesWith(value=>patch(value,before,content,Core),{type:'character'});
          let confirmed=false;for(const delay of [0,250,500,1000,2000,4000]){if(delay)await wait(delay);host.assertContext(expected,true);const disk=await host.persisted(expected);const got=flat(disk.extensions.tavern_helper.scripts).find(s=>s.id===ID);if(got&&await Core.sha256(got.content)===manifest.targetHash){const expectedScript={...before,content};if(Core.canonical(got)!==Core.canonical(expectedScript))fail('upgrade-data-changed','代码已保存，但脚本数据读回不同，保留原备份等待核对');confirmed=true;break;}}
          if(!confirmed)fail('upgrade-save-unconfirmed','尚未确认落盘，保留原件和升级记录；请刷新后用同一工具核对');
          await host.confirmUpdaterWrite(expected);
          report('新版更新器已保存，原卡数据保持。请刷新酒馆，再点击本工具核对完成。');return {status:'awaiting-reload',backup:record.name};
        });break;}catch(e){if(entered||e.code!=='update-already-running'||attempt>=39)throw e;report('正在等待现有保存完成');await wait(250);host.assertContext(expected);}}
        return result;
      }catch(e){report('升级未完成：'+e.message+'。原备份和恢复记录保留；请刷新酒馆后用同一工具重试，请勿删除记录。');throw e;}
      finally{repair?.stop();running=false;}
    }
    async function prepareMigration(){
      if(running)fail('upgrade-running','已有操作正在处理，请稍后重试。');running=true;
      try{
        const {seed}=await registered();
        const host=Host.create({core:Core,api,rawRegex:true});await host.ready('export');const expected=host.getContext();report('正在核对旧聊天、MVU与物品定义…');await wait(2100);host.assertContext(expected);
        const snapshot=()=>{host.assertContext(expected);const c=api.SillyTavern.getContext();return Core.canonical(copy({messages:c.chat,metadata:c.chatMetadata}));},before=snapshot();
        const assertCurrent=()=>{if(snapshot()!==before)fail('migration-export-stale','聊天或变量已变化，请重新准备续玩存档');};
        // Keep the download bound to the observed live chat. TT's complete disk
        // export can contain cold reply branches that are not hydrated in memory.
        const backup=Backup.create({api,host,core:Core,getSeed:()=>exportSeed(seed,host),readOnlyExport:true}),result=await backup.captureMigration({completeDisk:true});assertCurrent();
        const prepared=await backup.prepareExportFile(result.document);
        host.assertContext(expected);report('存档已准备好。点击下载，再导入新版卡，在新版“卡更新 → 换卡续玩”中导入此文件。');
        return {...prepared,assertCurrent};
      }catch(e){if(e.code==='migration-pending-install')e.message+='。请先点击“检查并恢复”；若仍失败，可导出救援文件。';report('未能导出：'+e.message);throw e;}finally{running=false;}
    }
    async function checkAndRecover(){
      const {seed}=await registered(),host=Host.create({core:Core,api,rawRegex:true});await host.ready('export');const expected=host.getContext();
      report('正在等保存稳定并检查安装记录…');await wait(2100);host.assertContext(expected);
      const repair=Controller.create({api,host,core:Core,seed,hostModule:Host});
      try{const result=await repair.recoverPending();host.assertContext(expected);report(result.status==='none'?'本实例没有待恢复安装。可以准备续玩存档。':'安装记录已恢复并核对。请准备续玩存档；若更新器代码发生变化，请先刷新。');return result;}
      catch(e){report('未能自动恢复：'+e.message+'。可以导出救援文件保留现场。');throw e;}finally{repair.stop();}
    }
    async function exportRescue(){
      const {seed}=source(),host=Host.create({core:Core,api,rawRegex:true});await host.ready('export');const expected=host.getContext();
      report('正在准备完整聊天与恢复材料…');await wait(2100);host.assertContext(expected);
      const backup=Backup.create({api,host,core:Core,getSeed:()=>exportSeed(seed,host),readOnlyExport:true}),document=await backup.captureRescue(),prepared=await backup.prepareExportFile(document);
      host.assertContext(expected);report('救援文件已准备好。请下载保存；它需要核查，不能直接作为续玩存档导入。');return {...prepared,assertCurrent:()=>host.assertContext(expected)};
    }
    return {run:()=>exclusive('upgrade',runUpgrade),patch,exportMigration:()=>exclusive('migration',prepareMigration),checkAndRecover:()=>exclusive('recover',checkAndRecover),exportRescue:()=>exclusive('rescue',exportRescue),info(){const {seed}=source();const state=api.getVariables?.({type:'character'})?.__cxx_update_state;return {cardVersion:state?.installed?.['cyber2051.core']?.version||seed.baseVersion,toolVersion:manifest.version};}};
  }
  return {ID,create,patch};
});
