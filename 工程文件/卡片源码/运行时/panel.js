(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxUpdatePanel=api;})(globalThis,function(){
  'use strict';
  function render(panel,v,a){
    const doc=panel.ownerDocument,scroll=panel.scrollTop,expanded=new Set([...panel.querySelectorAll('details[open]')].map(n=>n.querySelector('summary')?.textContent));
    panel.replaceChildren();
    function n(tag,text,parent=panel){const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;parent.append(e);return e;}
    function button(text,fn,parent=panel,primary=false){const b=n('button',text,parent);b.type='button';b.disabled=v.busy;b.className=primary?'cxx-update-primary':'';b.onclick=()=>Promise.resolve().then(fn).catch(a.error);return b;}
    function details(title,parent=panel){const d=n('details',undefined,parent);n('summary',title,d);d.open=expanded.has(title);return d;}
    function file(label,fn,parent=panel){const l=n('label',label,parent),f=n('input',undefined,l);f.type='file';f.accept='.json,application/json';f.disabled=v.busy;f.onchange=()=>{const chosen=f.files?.[0];if(chosen)Promise.resolve().then(()=>fn(chosen)).catch(a.error);};return f;}
    n('style',globalThis.CxxUpdatePanelStyle||'');
    const header=n('header');
    const name=n('div',undefined,header);n('small','CYBER TOKYO / 2051',name).className='cxx-update-kicker';n('h2','更新与存档',name);
    if(v.version)n('small','卡内容 '+v.version,name);
    button('关闭',a.close,header).disabled=false;
    const nav=n('nav');nav.setAttribute('aria-label','更新与存档栏目');
    if(a.openStories)button('故事与存档点',a.openStories,nav);
    for(const [id,label]of [['update','卡内更新'],['migration','换卡续玩'],['recovery','更多操作']]){const b=button(label,()=>a.tab(id),nav);b.disabled=false;b.setAttribute('aria-selected',String(v.tab===id));b.setAttribute('aria-pressed',String(v.tab===id));}
    n('p',v.tab==='migration'&&/需要酒馆1\.19\.0|runtime-not-verified/.test(v.status)?'当前环境未通过原地安装检查。你仍可在这里导出续玩存档，再导入新版角色卡。':v.status).setAttribute('role','status');
    if(v.capabilities){
      const c=v.capabilities;
      if(!c.nativeUUID&&!c.randomValues)n('p','当前环境缺少安全随机数功能，无法创建保存记录。请更换浏览器后重试。').setAttribute('role','status');
      else if(!c.nativeDigest||!c.nativeUUID)n('p','已启用浏览器兼容模式，本地校验与保存仍可使用。').setAttribute('role','status');
      if(!c.signature)n('p','当前环境无法验证更新签名，版本检查与更新安装暂不可用；游玩、备份和换卡续玩不依赖此项能力。').setAttribute('role','status');
    }
    if(v.recovery?.kind==='pending'){
      const r=v.recovery,box=n('section');box.setAttribute('aria-label','未完成的安装');n('h3','有待恢复的安装',box);
      n('p',r.otherChat?'安装记录属于另一故事。先进入该故事，再检查并恢复，随后可继续游玩。':'请检查并恢复这次安装后继续游玩。',box);
      if(r.otherChat)button('前往待恢复故事',a.openRecoveryStory,box,true);else button('检查并恢复这次安装',a.recover,box,true);
    }else if(v.recovery?.kind==='orphan'){n('p','上次更新的恢复记录已不存在，不影响当前故事，可以直接继续游玩或导出续玩存档。').setAttribute('role','status');
   }else if(v.recovery?.kind==='foreign'){n('p','上次安装记录属于另一实例，不影响当前故事，可以直接继续游玩或导出续玩存档。').setAttribute('role','status');}
    else if(v.recovery?.kind==='blocked'){n('p',v.recovery.message||'安装记录需要核查，请保留救援文件。');}
    if(v.tab==='update'){
      n('h3','当前版本 '+v.version);
      const latest=v.local?.pack;
      n('p','发现新版后自动准备更新包。核对变更清单，点击更新后会自动备份、替换并刷新核对。');
      if(v.discovery){
        const label=n('label','自动检查新版本（每24小时最多一次）'),toggle=n('input',undefined,label);toggle.type='checkbox';toggle.checked=v.discovery.enabled;toggle.onchange=()=>a.autoCheck(toggle.checked);
        n('p',v.discovery.status).setAttribute('role','status');const check=button('立即检查版本',a.discover);check.disabled=v.discovery.checking;
      }
      const website=n('a','打开官方网站');website.href='https://cyber2051.top/';website.target='_blank';website.rel='noopener noreferrer';
      file('选择官方更新包 JSON',a.packageFile);
      if(latest)n('p','已选择版本 '+latest.version);
      if(latest?.release?.notes||latest?.notes)n('p',latest.release?.notes||latest.notes);
      if(v.local?.summary){const s=v.local.summary;n('p','组件变更：新增 '+s.counts.added+'，更新 '+s.counts.updated+'，移除 '+s.counts.deleted+'。');
        if(s.conflicts.length){const d=details('将保留的玩家修改与暂缓项目');for(const x of s.conflicts)n('p',x.component+' / '+x.id+(x.path?' / '+x.path:'')+'：'+reason(x.reason),d);}}
      const partial=v.state.installed?.['cyber2051.core']?.release?.releaseProgress;
      if(partial){n('p','部分更新至 '+partial.targetVersion+'；完整版本仍为 '+v.version+'。暂缓 '+partial.blockedGroups.length+' 组。处理修改后可重新选择同一文件补装。');const d=details('查看未完成项目');for(const x of partial.skipped||[])n('p',x.component+' / '+x.id+'：'+reason(x.reason),d);}
      if(v.online){n('p',v.online.status).setAttribute('role','status');if(v.online.inventory?.length){const d=details('全部组件版本与指纹（'+v.online.inventory.length+'）');for(const x of v.online.inventory)n('p',x.label+' · '+x.name+' · '+x.currentVersion+' → '+x.targetVersion+' · '+({keep:'保持',add:'新增',replace:'更新',remove:'移除',reload:'等待刷新'}[x.action]||x.action)+(x.currentHash?' · '+x.currentHash.slice(0,12)+' → '+(x.targetHash||'').slice(0,12):''),d);}}
      if(v.local)button(v.online?.target?'更新并核对全部组件':'安装此更新包',v.online?.target?a.onlineInstall:a.install,panel,true);
      n('p','更新前自动备份；正文、MVU进度和回复分支会保留。').className='cxx-update-note';
    }else if(v.tab==='migration'){
      n('h3','① 在旧卡导出故事');n('p','等正文和变量保存结束后导出，原卡与聊天会保留。');
      button('导出续玩存档',a.exportMigration,panel,true);
      if(a.recover)button('检查并恢复未完成安装',a.recover);
      if(a.exportRescue)button('导出救援文件',a.exportRescue);
      if(v.download){const link=n('a','下载已准备好的存档');link.href=v.download.url;link.download=v.download.filename;link.onclick=e=>{try{if(v.busy){e.preventDefault();return;}a.assertDownload?.();}catch(cause){e.preventDefault();a.error(cause);}};}
      n('h3','② 导入新版角色卡');n('p','将新版角色卡 JSON 导入酒馆，打开它的新聊天。累计更新包不是角色卡，请勿混用。');
      n('h3','③ 在新版恢复故事');file('选择第一步导出的续玩存档',a.migrationFile);
      if(v.migration){n('p','兼容检查通过 · 原聊天：'+v.migration.sourceChat);n('p','来源 '+v.migration.source.baseVersion+' · '+v.migration.counts.floors+' 层 · '+v.migration.counts.branches+' 个回复分支');button('创建续玩聊天并打开',a.importMigration,panel,true);const d=details('查看保存的进度');n('pre',JSON.stringify(v.migration.playerState,null,2),d);}
    }else{
      button('原地累计更新',()=>a.tab('update'),panel);
      n('h3','恢复更新前的版本');n('p','程序回退会恢复上一版组件。聊天备份另存为副本，可从聊天列表打开。');
      if(v.state.lastReleaseBackup)button('恢复上一版组件',a.rollback,panel,true);
      else n('p','尚无可回退的版本更新。');
      button('检查并恢复未完成安装',a.recover);
      if(a.exportRescue){button('导出救援文件',a.exportRescue);n('p','无法恢复时保留完整聊天和恢复材料；救援文件需核查，不能直接作为续玩存档导入。');}
      if(v.state.lastChatBackup?.backupId){n('p','最近聊天备份：'+v.state.lastChatBackup.backupId);button('打开更新前的聊天备份',()=>a.openChat(v.state.lastChatBackup.backupId));}
      const saves=details('聊天备份文件');button('导出完整聊天备份',a.exportBackup,saves);file('选择聊天备份 JSON',a.backupFile,saves);
      if(v.restore){n('p','备份已核对：'+JSON.stringify(v.restore.counts||{}),saves);button('恢复为新聊天并打开',a.restore,saves,true);}
    }
    if(v.error){const d=details('错误详情');n('pre',v.error.code+'\n'+v.error.message,d);}
    if(v.capabilities){const d=details('浏览器兼容信息（排查用）');n('pre',JSON.stringify(v.capabilities,null,2),d);}
    panel.scrollTop=scroll;
  }
  function reason(value){return {'both-changed':'你和新版都修改了此字段','deleted-upstream-local-dirty':'新版删除了你修改或保存过数据的项目','local-field-deleted':'你删除了此字段','local-item-deleted':'你删除了此项目','local-field-collision':'新增字段与玩家字段冲突','unowned-id-collision':'编号与玩家自建内容相同','baseline-missing':'缺少可验证的旧版基线','dependency-blocked':'依赖的更新组暂缓','node-type-changed':'组件类型改变，需要保留当前结构'}[value]||value;}
  return {render};
});
