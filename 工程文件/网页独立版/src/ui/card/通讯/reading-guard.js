/* Derived from 卡片源码/通讯/reading-guard.js; source SHA256 a643e24ed03c3697afc6604a59aae89d50413f120f37520c6ca372ef03791f18. Rebuild with tools/p3a-adapt-views.mjs. */
/* Isolated 2051 adapter. Uses public APIs only; no raw-message fallback or source cache. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxReadingGuard=api;})(globalThis,function(){
  'use strict';
  const states=new Set(['absent','processing','partial','ready','failed','stale','conflict']);
  const fail=(code,message)=>({ok:false,code,message,sourceMessage:null,snapshot:null});
  const fault=(code,message)=>Object.assign(new Error(message),{code});
  const number=value=>typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value.trim())?Number(value):NaN;
  function validScope(s){return !!s&&typeof s.chatId==='string'&&s.chatId!==''&&Number.isInteger(s.messageId)&&s.messageId>=0&&Number.isInteger(s.swipeId)&&s.swipeId>=0&&typeof s.token==='string'&&s.token!=='';}
  function sameScope(a,b){return validScope(b)&&['chatId','messageId','swipeId','token'].every(k=>a[k]===b[k]);}
  function validSnapshot(s,owner,reliableSource){
    if(!s||s.schema!==1||!states.has(s.state)||!Array.isArray(s.segments))return false;
    if(!['chatId','messageId','swipeId'].every(k=>s.owner?.[k]===owner[k]))return false;
    if(s.state==='conflict')return reliableSource&&s.sourceMessage===null&&s.sourceRevision===null&&s.readingRevision==='none'&&s.segments.length===0&&typeof s.error==='string'&&s.error.length>0;
    if(typeof s.sourceMessage!=='string')return false;
    if(!['sourceRevision','readingRevision'].every(k=>typeof s[k]==='string'&&s[k]))return false;
    const ids=new Set();let end=0;
    for(const p of s.segments){
      const x=p?.source;
      if(typeof p?.id!=='string'||!p.id||ids.has(p.id)||!Number.isInteger(x?.start)||!Number.isInteger(x?.end)||x.start<end||x.end<x.start||x.end>s.sourceMessage.length||s.sourceMessage.slice(x.start,x.end)!==x.text)return false;
      if(p.reading!==null&&(typeof p.reading?.text!=='string'||typeof p.reading?.language!=='string'))return false;
      ids.add(p.id);end=x.end;
    }
    return true;
  }
  // readScope(request) supplies {chatId,messageId,swipeId,token}. token must change
  // on message replacement/edit, swipe switch, deletion/reindex or chat/character
  // switch, including while a read is pending. Use the host runtime's ownership
  // token; no MirrorTranslate private metadata is needed.
  function create({getApi,readScope,timeoutMs=5000}){
    if(typeof getApi!=='function'||typeof readScope!=='function')throw TypeError('需要宿主接口与楼层归属读取器。');
    let disposed=false,bound=null,unsubscribe=null,epoch=0;
    const listeners=new Set(),pending=new Set();
    const timeout=Number.isFinite(timeoutMs)&&timeoutMs>0?timeoutMs:5000;
    function current(scope,request,found){try{return !disposed&&getApi()===found&&sameScope(scope,readScope(request));}catch{return false;}}
    function wait(value,signal){
      return new Promise((resolve,reject)=>{
        let settled=false,timer;
        const settle=(fn,result)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);pending.delete(cancel);fn(result);};
        const cancel=()=>settle(reject,fault('closed','正文读取服务已关闭。'));
        const abort=()=>settle(reject,fault('cancelled','本次正文读取已取消。'));
        pending.add(cancel);timer=setTimeout(()=>settle(reject,fault('timeout','镜译正文读取超时，请稍后手动重试。')),timeout);
        signal?.addEventListener('abort',abort,{once:true});
        // Always attach handlers, including already-aborted operations, to absorb late rejection.
        Promise.resolve(value).then(v=>settle(resolve,v),e=>settle(reject,e));
        if(disposed)cancel();else if(signal?.aborted)abort();
      });
    }
    function unbind(){try{unsubscribe?.();}catch{}unsubscribe=null;bound=null;epoch++;}
    function bind(api){
      if(bound===api)return;
      unbind();
      const off=api.reading.onChange(event=>{
        if(disposed||bound!==api)return;
        epoch++;
        for(const fn of [...listeners]){if(disposed)break;try{fn(event);}catch{}}
      });
      if(typeof off!=='function')throw Error('镜译正文订阅没有提供取消方法。');
      bound=api;unsubscribe=off;
    }
    async function read({messageId,swipeId,signal}={}){
      if(disposed)return fail('closed','正文读取服务已关闭。');
      if(signal?.aborted)return fail('cancelled','本次正文读取已取消。');
      const id=number(messageId),swipe=swipeId==null?undefined:number(swipeId);
      if(!Number.isInteger(id)||id<0||(swipe!==undefined&&(!Number.isInteger(swipe)||swipe<0)))return fail('invalid_request','楼层或回复分支无效。');
      const request={messageId:id,...(swipe===undefined?{}:{swipeId:swipe})};
      let scope,found;
      try{
        scope=readScope(request);if(!validScope(scope)||scope.messageId!==id||(swipe!==undefined&&scope.swipeId!==swipe))return fail('scope_unavailable','无法确认正文所属聊天和分支。');
        scope={...scope};found=getApi();
        if(!found){unbind();return fail('unavailable','未安装镜译，无法读取镜译正文快照。');}
        const api=await wait(found.ready||found,signal);
        if(signal?.aborted)return fail('cancelled','本次正文读取已取消。');
        if(!current(scope,request,found))return fail('changed','聊天、楼层或分支已变化，本次读取已丢弃。');
        if(!api?.features?.includes('reading')||!['get','onChange','status'].every(k=>typeof api.reading?.[k]==='function')){unbind();return fail('unsupported','当前镜译缺少正文只读接口。');}
        bind(api);const stamp=epoch;
        const snapshot=await wait(api.reading.get({messageId:id,swipeId:scope.swipeId}),signal);
        if(signal?.aborted)return fail('cancelled','本次正文读取已取消。');
        if(!current(scope,request,found)||stamp!==epoch)return fail('changed','正文在读取期间发生变化，请重新读取。');
        if(snapshot===null)return fail('missing','该楼层或回复分支已不存在。');
        const reliableSource=Number.isInteger(api.reading.apiVersion)&&api.reading.apiVersion>=2;
        if(!validSnapshot(snapshot,scope,reliableSource))return fail('invalid_snapshot','镜译正文快照的归属或段落位置无效。');
        if(snapshot.state==='conflict')return fail('source_conflict',snapshot.error);
        // API v2 reports conflict before all other states. stale/processing may
        // supply canonical source, independently of whether a translation is usable.
        // v1 and absent/invalid API versions retain the old conservative guard.
        if(!reliableSource&&snapshot.state==='stale')return fail('source_unverified','这段内容改动后，镜译尚不能确认可靠原文。已暂停使用它进行总结、剧情记忆和战斗判断；不会自动恢复或重翻。');
        if(!reliableSource&&snapshot.state==='processing')return fail('processing','镜译正在处理这一段，待完成后再读取剧情原文。');
        return {ok:true,code:'ready',sourceMessage:snapshot.sourceMessage,snapshot};
      }catch(error){
        if(disposed)return fail('closed','正文读取服务已关闭。');
        if(signal?.aborted)return fail('cancelled','本次正文读取已取消。');
        if(scope&&!current(scope,request,found))return fail('changed','聊天、楼层或分支已变化，本次读取已丢弃。');
        if(['timeout','cancelled','closed'].includes(error?.code))return fail(error.code,error.message);
        if(/没有找到正文标签/.test(String(error?.message)))return fail('body_tags_missing','镜译没有找到正文提取范围。请在“正文处理 → 提取标签”加入 cxx-story，再手动重试。当前未取得可靠原文，相关处理已暂停。');
        return fail('read_failed','镜译正文读取失败，相关处理已暂停。'+String(error?.message||'请稍后手动重试。').slice(0,500));
      }
    }
    async function readSource(options){const result=await read(options);if(!result.ok)throw fault(result.code,result.message);return result.sourceMessage;}
    return {read,readSource,subscribe(fn){if(disposed||typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},destroy(){if(disposed)return;disposed=true;unbind();for(const cancel of [...pending])cancel();listeners.clear();}};
  }
  return {create,validSnapshot};
});
