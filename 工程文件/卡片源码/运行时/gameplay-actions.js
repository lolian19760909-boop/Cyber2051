(function(root,factory){
  const api=factory(); if(typeof module==='object' && module.exports)module.exports=api; root.CxxGameplayActions=api;
})(typeof globalThis==='object'?globalThis:window,function(){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
  // The adapter owns only chat-level request records. No game-state write API is accepted here.
  function create({gameplay:G,host,hash,uuid,allowGameplay=true}){
    let running=false;
    async function lock(work){if(running)fail('action-busy','当前行动正在处理，请勿重复点击');running=true;try{return await host.lock(work);}finally{running=false;}}
    function contextEqual(a,b){return ['characterKey','chatId'].every(k=>a[k]===b[k]);}
    const enabled=request=>typeof allowGameplay==='function'?allowGameplay(request)===true:allowGameplay===true;
    function allowed(snapshot,request){if(!enabled(request))fail('feature-pending','这项功能待更新，将在后续版本开放。');if(request.action==='start' && snapshot.openingEligible!==true)fail('opening-old-chat','出身开场仅适用于尚未开始的新聊天，旧聊天不能重新初始化');}
    function source(snapshot){return {context:snapshot.context,branches:snapshot.messages.map(m=>({is_user:m.is_user,mes:m.mes,swipe:m.swipe_id || 0})),stat:snapshot.stat};}
    async function prepare(request){
      if(!enabled(request))fail('feature-pending','这项功能待更新，将在后续版本开放。');
      const snapshot=await host.read(); if(snapshot.busy)fail('action-busy','正在生成或保存，稍后再选行动');
      for(const record of Object.values(snapshot.records || {}))if(record.status==='submitted' && contextEqual(record.ticket.context,snapshot.context)){
        const result=await inspectRecord(record,snapshot);
        if(!['success','refused'].includes(result.status))fail('action-unconfirmed','上次行动结果未确认，请先查看行动记录，不自动重发');
        if(!record.confirmed)await inspect(record.id);
      }
      allowed(snapshot,request);const plan=G.plan(snapshot.stat,snapshot.catalog,request), id='act_'+uuid().replace(/-/g,'');
      const ticket={format:1,id,context:snapshot.context,sourceHash:await hash(source(snapshot)),sourceBranches:source(snapshot).branches,sourceCount:snapshot.messages.length,plan};
      ticket.requestHash=await hash({id,context:ticket.context,sourceHash:ticket.sourceHash,sourceBranches:ticket.sourceBranches,plan});return ticket;
    }
    async function confirm(ticket,decision){
      if(decision!=='confirm')return {status:'cancelled',id:ticket.id};
      if(!enabled(ticket.plan.request))fail('feature-pending','这项功能待更新，将在后续版本开放。');
      return lock(async()=>{
        if(await hash({id:ticket.id,context:ticket.context,sourceHash:ticket.sourceHash,sourceBranches:ticket.sourceBranches,plan:ticket.plan})!==ticket.requestHash)fail('action-preview-changed','行动预览已变，请重新选择');
        const snapshot=await host.read();
        if(!contextEqual(snapshot.context,ticket.context))fail('action-context','角色或聊天已切换，未发送行动');
        const previous=await host.getRecord(ticket.id);
        if(previous)return inspectRecord(previous,snapshot);
        if(snapshot.sendReady===false)fail('action-send-unavailable','酒馆发送入口不可用，请先连接模型并等待当前生成结束；尚未提交行动');
        if(Object.values(snapshot.records || {}).some(r=>r.status==='submitted' && r.ticket.sourceHash===ticket.sourceHash))fail('action-unconfirmed','同一分支已有待确认的行动，不重复提交');
        if(snapshot.busy || await hash(source(snapshot))!==ticket.sourceHash)fail('action-context','聊天、回复分支或存档已变化，请重新选择行动');
        allowed(snapshot,ticket.plan.request);const replanned=G.plan(snapshot.stat,snapshot.catalog,ticket.plan.request);
        if(!G.same(replanned,ticket.plan))fail('action-definition-changed','内容定义已更新，请重新查看行动说明');
        // Persist the intent BEFORE invoking normal ST send. A lost acknowledgment never resends.
        const record={id:ticket.id,ticket:clone(ticket),status:'submitted',createdAt:new Date().toISOString()};
        await host.putRecord(record);
        const saved=await host.getRecord(ticket.id);
        if(!saved || !G.same(saved,record))fail('action-save-unconfirmed','行动记录尚未保存，未发送');
        const beforeSend=await host.read();
        if(beforeSend.busy || !contextEqual(beforeSend.context,ticket.context) || await hash(source(beforeSend))!==ticket.sourceHash)fail('action-context','保存期间上下文变化；已保留记录，不自动重发');
        try { await host.send(G.prompt(ticket),ticket.context); }
        catch(e){return {status:'unconfirmed',id:ticket.id,reason:'发送结果未确认，不自动重发：'+e.message};}
        return {status:'submitted',id:ticket.id,reason:'已交给酒馆正常发送，等待AI与MVU保存'};
      });
    }
    async function inspectRecord(record,snapshot){
      const t=record.ticket;
      if(!contextEqual(snapshot.context,t.context))return {status:'unconfirmed',id:t.id,reason:'这条行动属于其他角色或聊天'};
      const messages=snapshot.messages, token='[东京都2051正文行动 '+t.id+']';
      const floor=messages.findIndex((m,i)=>i>=t.sourceCount && m.is_user && m.mes.includes(token));
      if(floor<0)return {status:'unconfirmed',id:t.id,reason:'未找到已保存的行动消息，禁止自动重发'};
      const branches=messages.slice(0,t.sourceCount).map(m=>({is_user:m.is_user,mes:m.mes,swipe:m.swipe_id || 0}));
      // Only the selected branch that submitted the action may consume its result.
      if(!G.same(branches,t.sourceBranches))return {status:'unconfirmed',id:t.id,reason:'提交行动的回复分支已改变'};
      if(snapshot.busy)return {status:'submitted',id:t.id,reason:'AI或MVU尚在处理'};
      let resultFloor=floor+1;
      while(resultFloor<messages.length && messages[resultFloor].is_system)resultFloor++;
      const message=messages[resultFloor];
      if(!message || message.is_user)return {status:'unconfirmed',id:t.id,reason:'行动后没有可核对的AI回复'};
      const replyHash=await hash({mes:message.mes,swipe:message.swipe_id || 0});
      const saved=message.variables?.[message.swipe_id || 0]?.stat_data;
      if(!saved){
        const proof=record.confirmed;
        if(proof?.replyHash===replyHash && proof.floor===resultFloor && proof.swipe===(message.swipe_id || 0) && proof.requestHash===t.requestHash && ['success','refused'].includes(proof.status))return {id:t.id,floor:resultFloor,swipe:proof.swipe,status:proof.status,archived:true,reason:'历史结果已核对并留证；此楼MVU变量已不在当前存档中，不重新结算'};
        return {status:'unconfirmed',id:t.id,reason:'AI回复没有已保存的MVU数据，也没有之前核实的确认凭据'};
      }
      const result={id:t.id,floor:resultFloor,swipe:message.swipe_id || 0,...G.verify(t,saved)};
      if(['success','refused'].includes(result.status))result.proof={replyHash,floor:resultFloor,swipe:message.swipe_id || 0,requestHash:t.requestHash,status:result.status,stateHash:await hash(saved)};
      return result;
    }
    async function inspect(id){
      const snapshot=await host.read(),record=snapshot.records?.[id] || await host.getRecord(id);if(!record)fail('action-missing','没有这条行动记录');const result=await inspectRecord(record,snapshot);
      if(!result.proof || G.same(record.confirmed,result.proof))return result;
      return lock(async()=>{const current=await host.read(),saved=await host.getRecord(id);if(!saved)fail('action-missing','行动记录已改变');const checked=await inspectRecord(saved,current);
        if(checked.proof){await host.putRecord({...saved,confirmed:checked.proof});const stored=await host.getRecord(id);if(!stored || !G.same(stored.confirmed,checked.proof))fail('action-save-unconfirmed','行动确认凭据尚未保存，不重复发送');}return checked;});
    }
    async function inspectAll(){const snapshot=await host.read(),result={};for(const record of Object.values(snapshot.records || {})){const checked=await inspectRecord(record,snapshot);result[record.id]=checked.proof && !G.same(checked.proof,record.confirmed)?await inspect(record.id):checked;}return result;}
    async function acknowledge(id,decision){
      if(decision!=='acknowledge-unconfirmed')fail('action-confirm','请明确确认停止等待；此操作不重发、不撤销已发生的状态');
      return lock(async()=>{const snapshot=await host.read(),record=await host.getRecord(id);if(!record || !contextEqual(snapshot.context,record.ticket.context))fail('action-context','没有本聊天的行动记录');if(snapshot.busy)fail('action-busy','仍在生成，不能停止等待');await host.putRecord({...record,status:'acknowledged'});return {status:'acknowledged',id};});
    }
    return {prepare,confirm,inspect,inspectAll,acknowledge};
  }
  return {create};
});
