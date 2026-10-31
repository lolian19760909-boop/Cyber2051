/* Context records share the existing long-memory chat container, not a second save. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):root.CxxDataClone);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxContextStore=api;})(globalThis,function(Clone){
  'use strict';
  const copy=v=>Clone.clone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),KEY='__cxx_long_memory';
  const initial=()=>({schema:1,revision:0,enabled:true,compactions:[],receipts:[]});
  function create({api,top=globalThis,host,capture,readDisk}={}){
    const ctx=()=>api.SillyTavern.getContext();let queue=Promise.resolve(),pending=null,disposed=false;
    const read=()=>{const value=ctx().chatMetadata?.variables?.[KEY]?.context;return copy(value===undefined?initial():value);};
    const assert=expected=>{if(disposed||!same(expected,capture()))throw Error('上下文记录对应的故事或前文已变化。');};
    const disk=readDisk||async function(expected){const s=expected.scope,c=ctx(),response=await top.fetch('/api/chats/get',{method:'POST',headers:c.getRequestHeaders(),credentials:'same-origin',cache:'no-cache',signal:AbortSignal.timeout(30000),body:JSON.stringify({avatar_url:s.character,file_name:s.chat,ch_name:c.characters[c.characterId]?.name})});if(!response.ok)throw Error('上下文记录读回失败（HTTP '+response.status+'）。');const rows=await response.json();return rows?.[0]?.chat_metadata?.variables?.[KEY]?.context;};
    function scopeMatches(expected){return same(expected.scope,capture().scope);}
    async function save(value,expected){
      assert(expected);await ctx().saveChat();assert(expected);const saved=await disk(expected);assert(expected);
      if(!same(saved,value)||!same(read(),value))throw Error('上下文记录尚未保存一致，可重试保存。');
      pending=null;return copy(value);
    }
    function update(change){
      const expected=copy(capture());
      const job=queue.then(async()=>{
        assert(expected);if(pending){if(scopeMatches(pending.expected))throw Error('上次上下文记录尚未保存确认，请先重试保存。');pending=null;}
        if(typeof host?.withChatSave!=='function'||typeof host?.assertPlayerWritable!=='function'||typeof api.updateVariablesWith!=='function')throw Error('上下文保存服务尚未就绪。');
        return host.withChatSave({characterKey:expected.scope.character,chatId:expected.scope.chat,group:expected.scope.group},async()=>{
          assert(expected);await host.assertPlayerWritable({characterKey:expected.scope.character,chatId:expected.scope.chat,group:expected.scope.group});assert(expected);
          const before=read();if(before.schema!==1||!Number.isSafeInteger(before.revision)||before.revision<0)throw Error('上下文记录版本不匹配，保留原数据。');
          const next=copy(before);change(next);next.revision=before.revision+1;
          await api.updateVariablesWith(vars=>{assert(expected);const memory=vars[KEY]||{schema:1,enabled:false,notes:[],controls:{},nextNote:1};if(memory.schema!==1)throw Error('长期记忆记录版本不匹配。');if(!same(memory.context??initial(),before))throw Error('上下文记录已有新变化，请重新操作。');vars[KEY]={...memory,context:next};return vars;},{type:'chat'});
          pending={expected,before,value:copy(next)};return save(next,expected);
        });
      });queue=job.catch(()=>{});return job;
    }
    function retry(){const job=queue.then(async()=>{if(!pending)return read();const p=pending;assert(p.expected);if(!same(read(),p.value))throw Error('待保存记录已变化，不能重复覆盖。');return host.withChatSave({characterKey:p.expected.scope.character,chatId:p.expected.scope.chat,group:p.expected.scope.group},async()=>{assert(p.expected);await host.assertPlayerWritable({characterKey:p.expected.scope.character,chatId:p.expected.scope.chat,group:p.expected.scope.group});return save(p.value,p.expected);});});queue=job.catch(()=>{});return job;}
    return {read:()=>pending&&scopeMatches(pending.expected)?copy(pending.before):read(),update,retry,status:()=>({pending:!!pending&&scopeMatches(pending.expected)}),destroy(){disposed=true;}};
  }
  return {create,initial};
});
