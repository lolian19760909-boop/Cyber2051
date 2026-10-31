(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxUpgradePanel=value;})(globalThis,function(){
  'use strict';
  function mount({document:doc,tool,version,subscribe}){
    const panel=doc.createElement('dialog');panel.dataset.cxxLegacyUpdater='1';panel.setAttribute('aria-label','旧版换卡续玩');
    const sheet=doc.createElement('style');sheet.textContent=globalThis.CxxUpgradeStyle||'';panel.append(sheet);
    const el=(tag,text,parent=panel)=>{const n=doc.createElement(tag);if(text)n.textContent=text;parent.append(n);return n;};
    el('h2','旧版换卡续玩');const versions=el('p','工具 '+version),status=el('p','① 准备并下载续玩存档。② 导入新版角色卡。③ 在新版“卡更新 → 换卡续玩”中恢复为副本。');status.setAttribute('role','status');
    const actions=el('div');actions.className='cxx-upgrade-actions';const controls=[];
    const button=(label,parent=actions)=>{const b=el('button',label,parent);b.type='button';controls.push(b);return b;};
    const prepare=button('准备续玩存档'),download=button('下载已准备的文件'),recover=button('检查并恢复'),rescue=button('准备救援文件');prepare.className='cxx-upgrade-primary';download.className='cxx-upgrade-download';download.disabled=true;
    el('p','若提示有未完成安装，先“检查并恢复”。仍无法恢复时，下载救援文件保留现场；救援文件需核查，不能直接作为续玩存档导入。');
    const advanced=el('details');el('summary','更多操作：原地累计更新',advanced);el('p','仅使用累计更新包时才需升级卡内更新器。换卡续玩无需先升级。升级后按提示刷新并核对；卡内容版本不会因此改变。',advanced);
    const run=button('备份并升级更新器 / 核对完成',advanced);const close=button('关闭',panel);controls.pop();close.className='cxx-upgrade-close';versions.className='cxx-upgrade-versions';
    let prepared=null,busy=false,disposed=false;
    const report=message=>{if(!disposed)status.textContent=message;};
    const clear=()=>{prepared?.revoke();prepared=null;download.disabled=true;};
    async function action(work,file=false){
      if(busy||disposed)return;busy=true;controls.forEach(b=>b.disabled=true);panel.setAttribute('aria-busy','true');clear();
      try{const result=await work();if(file){if(disposed)result.revoke();else prepared=result;}}
      catch(e){report('操作未完成：'+e.message);}
      finally{busy=false;panel.removeAttribute('aria-busy');controls.forEach(b=>b.disabled=false);download.disabled=!prepared;}
    }
    prepare.onclick=()=>action(()=>tool.exportMigration(),true);recover.onclick=()=>action(()=>tool.checkAndRecover());rescue.onclick=()=>action(()=>tool.exportRescue(),true);
    run.onclick=()=>action(async()=>{const r=await tool.run();if(r.status==='complete')run.textContent='已完成，可停用此工具';return r;});
    download.onclick=()=>{if(busy||!prepared)return;try{prepared.assertCurrent();const a=doc.createElement('a');a.href=prepared.url;a.download=prepared.filename;doc.body.append(a);a.click();a.remove();report('已请求下载。请在客户端下载记录中核对文件。');}catch(e){clear();report(e.message+'；请重新准备文件。');}};
    close.onclick=()=>panel.close?panel.close():panel.removeAttribute('open');doc.body.append(panel);
    const show=()=>{try{const info=tool.info();versions.textContent='卡内容 '+info.cardVersion+' · 独立工具 '+info.toolVersion;}catch(e){report(e.message);}if(!panel.open){if(panel.showModal)panel.showModal();else panel.setAttribute('open','');}};
    const stop=subscribe(show);
    return {show,report,destroy(){disposed=true;stop?.();clear();panel.remove();}};
  }
  return {mount};
});
