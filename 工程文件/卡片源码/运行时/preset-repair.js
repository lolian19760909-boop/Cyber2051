(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxPresetRepair=value;})(globalThis,function(){
 'use strict';
 const marker='cxx-pending-swipe-v1',viewportMarker='cxx-floating-viewport-v1',receiptMarker='cxx-receipt-normalize-v2',known=new Set([
  // 当前维护基底与成品：Izumi 1022 原件、V0.12 改版
  'e40570bfa514fd4e27007562b6e3daa5b3ba107494cb67074dc4cda9d5a1c8ad',
  '09e00c52e0cfdd77432ebe336400fc875dc7a093a46bbdecfb3820e711e036b7',
  // 历史基底与历史改版（回退对比用）
  'b69b8428ff6ff161edbf967a205a0b2cb22cee3aee7ab99effeaaed3bffa9118',
  '20ead672480ecfae0b33ee99c58367c27647cfc3f301c15ccb7c2fc2881fed53',
  '4c194963293cbc438ab3e6a49f804d9a7aa07100a3059c839c40f2a3b1ef00be']);
 const viewport=`
;/* cxx-floating-viewport-v1 */(()=>{const w=parent||window;let timer=null,tries=0;
 function fit(){const n=w.document.getElementById('izumi-floating-window-v1');if(!n)return false;const r=n.getBoundingClientRect(),v=w.visualViewport,x0=(v?.offsetLeft||0)+8,y0=(v?.offsetTop||0)+8,width=v?.width||w.innerWidth,height=v?.height||w.innerHeight;if(!r.width||!r.height)return true;const x=Math.max(x0,Math.min(r.left,x0+width-r.width-16)),y=Math.max(y0,Math.min(r.top,y0+height-r.height-16));if(Math.abs(x-r.left)>.5){n.style.left=x+'px';n.style.right='auto';}if(Math.abs(y-r.top)>.5){n.style.top=y+'px';n.style.bottom='auto';}return true;}
 w.addEventListener('resize',fit);w.addEventListener('pointerup',fit);w.visualViewport?.addEventListener('resize',fit);const poll=()=>{if(!fit()&&tries++<25)timer=setTimeout(poll,200);};poll();
 addEventListener('pagehide',()=>{clearTimeout(timer);w.removeEventListener('resize',fit);w.removeEventListener('pointerup',fit);w.visualViewport?.removeEventListener('resize',fit);},{once:true});})();`;
 function legacyPatch(content){
  if(content.includes(marker))return content.includes(viewportMarker)?content:content+viewport;
  const start=content.indexOf("eventTypes.MESSAGE_SWIPED || 'message_swiped'"),at=content.indexOf('restoreIncomingSanitizedTextInChat(messageId);',start);
  if(start<0||at<start||at-start>180)throw Error('Izumi预设的候选监听结构已变化，原脚本保留。');
  return content.slice(0,at)+`// ${marker}: a native overswipe still displays the previous reply.
          const pendingMessage = hostContext()?.chat?.[messageId];
          if (Array.isArray(pendingMessage?.swipes) && typeof pendingMessage.swipes[pendingMessage.swipe_id ?? 0] !== 'string') return;
          `+content.slice(at)+viewport;
 }
 function patch(content){
  if(content.includes(receiptMarker))return content;
  let next=legacyPatch(content);
  const declaration='function restoreIncomingSanitizedTextInChat(messageIndex) {';
  if(!next.includes(declaration))throw Error('Izumi正文清理入口已变化，原脚本保留。');
  next=next.replace(declaration,`/* ${receiptMarker} */ const cxxNormalizedIncoming=new WeakMap();
  function restoreIncomingSanitizedTextInChat(messageIndex, incoming = false) {`);
  next=next.replace('      const orig = String(message.mes);',`      const slot = Number(message.swipe_id ?? 0);
      if (!incoming && message.extra?.cxx_context) return false;
      const stamp = JSON.stringify([message.send_date, message.gen_started, message.gen_finished]);
      const versions = cxxNormalizedIncoming.get(message) || new Map();
      if (versions.get(slot) === stamp) return false;
      versions.set(slot, stamp); cxxNormalizedIncoming.set(message, versions);
      const orig = String(message.mes);`);
  const received=next.indexOf("eventTypes.MESSAGE_RECEIVED || 'message_received'"),call=next.indexOf('restoreIncomingSanitizedTextInChat(messageId);',received);
  if(received<0||call-received>180)throw Error('Izumi接收监听结构已变化，原脚本保留。');
  next=next.slice(0,call)+next.slice(call).replace('restoreIncomingSanitizedTextInChat(messageId);','restoreIncomingSanitizedTextInChat(messageId, true);');
  const ended=next.indexOf("eventTypes.GENERATION_ENDED || 'generation_ended', (messageId)"),endCall=next.indexOf('restoreIncomingSanitizedTextInChat(messageId);',ended);
  if(ended<0||endCall-ended>180)throw Error('Izumi结束监听结构已变化，原脚本保留。');
  next=next.slice(0,endCall)+next.slice(endCall).replace('restoreIncomingSanitizedTextInChat(messageId);','// Raw incoming text is normalized once at MESSAGE_RECEIVED, after streaming finalization.');
  return next;
 }
 async function repair({api,sha256}){
  const trees=api.getScriptTrees({type:'preset'}),flat=nodes=>nodes.flatMap(n=>[n,...(n.type==='folder'?flat(n.scripts):[])]),updates=new Map(),skipped=[];
  for(const s of flat(trees)){
   if(typeof s.content!=='string'||!s.content.includes('restoreIncomingSanitizedTextInChat')||s.content.includes(receiptMarker))continue;
   let original=s.content,hash=await sha256(original);const backup=s.data?.__cxx_pending_swipe_backup;
   let listed=known.has(hash);
   if(!listed&&backup&&known.has(backup.sha256)&&await sha256(backup.content)===backup.sha256&&legacyPatch(backup.content)===s.content){original=backup.content;hash=backup.sha256;listed=true;}
   // 作者自己已经把“同一生成归一化”改成带内容比对的写法（1022 起）：入口已有 incoming 参数、
   // 接收处已传 true，本卡不再叠加自己的去重，只记录跳过原因。
   if(original.includes('incoming = false')&&original.includes('restoreIncomingSanitizedTextInChat(messageId, true)')){skipped.push({script:s.name||s.id||'',hash,reason:'author-updated'});continue;}
   // 只改认得出的基线版本：白名单命中，或备份证明这正是本卡上次改写过的内容。
   // 认不出来的预设一律不动（作者或玩家自己改过的脚本不能被悄悄替换）。
   if(!listed){skipped.push({script:s.name||s.id||'',hash,reason:'unlisted'});continue;}
   let patched;
   try{patched=patch(original);}catch(error){skipped.push({script:s.name||s.id||'',hash,reason:'structure-changed',detail:error.message});continue;}
   if(patched===original){skipped.push({script:s.name||s.id||'',hash,reason:'no-change'});continue;}
   updates.set(s.id,{hash,content:patched,original:s.content,backup:original,listed});
  }
  if(!updates.size)return {changed:0,skipped,scanned:flat(trees).length};
  await api.updateScriptTreesWith(current=>{for(const s of flat(current)){const u=updates.get(s.id);if(!u)continue;if(s.content!==u.original)throw Error('预设脚本在修复前已有变化，原内容保留。');s.data={...s.data,__cxx_pending_swipe_backup:s.data?.__cxx_pending_swipe_backup||{sha256:u.hash,content:u.backup}};s.content=u.content;}return current;},{type:'preset'});
  const saved=flat(api.getScriptTrees({type:'preset'}));for(const [id,u]of updates)if(saved.find(s=>s.id===id)?.content!==u.content)throw Error('预设候选修复尚未读回一致。');
  return {changed:updates.size,skipped,scanned:flat(trees).length};
 }
 return {patch,repair,marker,receiptMarker};
});
