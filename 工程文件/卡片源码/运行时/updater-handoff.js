(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxUpdaterHandoff=value;})(globalThis,function(){
 'use strict';
 const ID='cf33c692-7a41-444d-b8b7-6a70163e0104',flat=nodes=>(nodes||[]).flatMap(n=>n.type==='folder'?flat(n.scripts):[n]);
 const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
 function create({api,Core,requirement,wait=ms=>new Promise(r=>setTimeout(r,ms)),fetch:fetcher,notify=()=>{},reload,active=()=>true}){
  let flight;const top=api.parent||api;
  const owner=()=>{const c=api.SillyTavern.getContext();return {characterKey:c.characters?.[c.characterId]?.avatar,chatId:c.getCurrentChatId()};};
  const hash=async()=>{const scripts=flat(api.getScriptTrees({type:'character'})).filter(s=>s.id===ID);if(scripts.length!==1||scripts[0].enabled!==true)fail('updater-required','请启用唯一的更新与存档脚本，再刷新页面。');return Core.sha256(scripts[0].content);};
  async function run(){
   if(!requirement||!/^\d+\.\d+\.\d+$/.test(requirement.version)||!/^[a-f0-9]{64}$/.test(requirement.sha256||''))fail('updater-contract','本版缺少更新器核验信息，已停止启动保存服务。');
   const expected=owner(),check=()=>{if(!active()||Core.canonical(owner())!==Core.canonical(expected))fail('context-changed','故事已切换，停止续接原故事的更新。');};
   check();if(await hash()===requirement.sha256&&await top.Cxx233Updater?.runtimeHash?.()===requirement.sha256){
    for(let n=0;;n++){check();const service=top.Cxx233Updater,upgrade=service.host.readState().updaterUpgrade,r=service.online?.()?.read()?.receipt;
     if((!upgrade||upgrade.status==='complete')&&!(r?.item?.version===requirement.version&&['applying','verify','plugins-downloaded'].includes(r.phase)))return true;
     if(n===0)notify('正在等待本次更新刷新后的核对完成，保存服务尚未启动。');
     if(n>=1800)fail('updater-verification-pending','本次更新尚未完成刷新核对，请在卡更新中继续；保存服务尚未启动。');await wait(100);
    }
   }
   notify('正在完成本版更新器升级，核对并刷新后恢复游戏。');
   let service;
   // The legacy installer can still be committing the newly received business
   // script. Do not start a second installer or register a content writer yet.
   for(let n=0;;n++){check();service=top.Cxx233Updater;const a=service?.activity?.(),online=service?.online?.()?.read();if(service&&a&&!a.running&&!a.saveRunning&&!a.storyOperations&&!online?.busy&&!service.host.getContext().busy)break;if(n>=1800)fail('updater-waiting','已有更新尚未结束，保存服务尚未启动；请在卡更新中查看并继续本次更新。');await wait(100);}
   check();if(await hash()===requirement.sha256){check();reload();return false;}
   const state=service.host.readState(),installed=state.installed?.['cyber2051.core'];
   if(installed?.version!==requirement.version||!/^[a-f0-9]{64}$/.test(installed.sha256||''))fail('updater-release-pending','组件安装尚未完整确认，请在卡更新中继续本次更新；保存服务尚未启动。');
   // Recovery remains owned by the installer and checks its original story.
   await service.recoverPending();check();
   const url='https://cyber2051.top/updates/v3/packages/cyber2051.core/'+requirement.version+'.json';
   let response;try{response=await top.caches?.open('cyber2051-update-packages-v1').then(c=>c.match(url));}catch{}
   if(!response)response=await (fetcher||top.fetch.bind(top))(url,{credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
   check();if(!response?.ok)fail('updater-package','未取得本次更新的正式签名包，请在卡更新中重试。');
   const text=await response.text();check();const bytes=new TextEncoder().encode(text).length;
   if(bytes>64*1024*1024||await Core.sha256(text)!==installed.sha256)fail('updater-package-hash','更新包与已确认的版本指纹不同，已停止续接。');
   const pack=JSON.parse(text);if(pack.version!==requirement.version||pack.release?.updater?.manifest?.targetHash!==requirement.sha256)fail('updater-package-target','更新包中的更新器与本版不一致，已停止续接。');
   // prepareOnline verifies the original publisher signature and the source
   // allowlist. The existing upgrader owns backups and the guarded script write.
   await service.prepareOnline({id:'cyber2051.core',kind:'core',version:requirement.version,url,bytes,sha256:installed.sha256});check();
   try{await service.online().apply();}catch(error){
    check();let pending;try{pending=(top.Cxx233Updater?.host||service.host).readState().updaterUpgrade;}catch{}
    if(await hash()!==requirement.sha256&&pending?.targetHash!==requirement.sha256)throw error;
    // Removing the legacy iframe can reject its final read before the new
    // controller has published itself. Require the exact replacement, rather
    // than treating that short publication gap as an installation failure.
    for(let n=0;;n++){check();const next=top.Cxx233Updater;if(next!==service&&await next?.runtimeHash?.()===requirement.sha256&&await hash()===requirement.sha256)break;if(n>=300)throw error;await wait(100);}
   }
   check();if(await hash()!==requirement.sha256)fail('updater-unconfirmed','更新器尚未保存为本版，保存服务保持停止，请在卡更新中继续。');
   reload();return false;
  }
  return {ensure(){return flight||=run();}};
 }
 return {create};
});
