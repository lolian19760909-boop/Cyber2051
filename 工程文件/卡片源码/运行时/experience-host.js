(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxExperienceHost=api;})(globalThis,function(root){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  function sameJson(a,b){
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameJson(a[key],b[key]));
  }
  function create({api=root,top=root.parent||root,fetcher=root.fetch?.bind(root),news=root.CxxCityNews,identities=root.CxxIdentity,summaries=root.CxxStorySummaries,parser=root.CxxGalParser,talents=root.CxxTalents,numeric=root.CxxNumericEngine,numericContent=root.CxxNumericContent}={}){
    const S=summaries,SK=S.KEY,CONFIG='tokyo2051-standalone-preview-v1-net-v1',KEY='__cxx_city_news',slot='__cxx_experience__';
    const ctx=()=>api.SillyTavern.getContext(),owner=ctx().characters?.[ctx().characterId]?.avatar;
    const key=()=>{const c=ctx();return !disposed&&!c.groupId&&owner&&c.characters?.[c.characterId]?.avatar===owner&&c.getCurrentChatId()?JSON.stringify([owner,c.getCurrentChatId()]):'';};
    const outboxKey=(kind,expected)=>'cxx-result-outbox-v1:'+kind+':'+expected;
    function outbox(kind,p){try{top.localStorage.setItem(outboxKey(kind,p.scope),JSON.stringify({schema:1,...p}));}catch{status='本机缓存空间不足，本次结果仍保留在当前页面；请先重试保存再离开。';}}
    function clearOutbox(kind,expected){try{top.localStorage.removeItem?.(outboxKey(kind,expected));}catch{}}
    function readOutbox(kind,expected){try{const p=JSON.parse(top.localStorage.getItem(outboxKey(kind,expected))||'null');return p?.schema===1&&p.scope===expected&&p.next&&typeof p.next==='object'?p:null;}catch{return null;}}
    const vars=()=>api.getVariables({type:'chat'})||{};
    const busy=()=>Boolean(ctx().isGenerating||top.document?.body?.hasAttribute('data-generating')||api.builtin?.duringGenerating?.()||top.__cxx_gal_g1__?.numericBusy?.());
    const later=api.setTimeout?.bind(api)||setTimeout,cancel=api.clearTimeout?.bind(api)||clearTimeout;
    let disposed=false,scope='',store=null,newsRecord={},rows=[],active=null,prompt=null,timer=null,dirty=Infinity,epoch=0,queue=Promise.resolve(),pendingAuto=false,waitingSince=0,status='',loading=null,stoppedFloor=null;
    let growthPrompt=null,growthReroll=null,chapterPrompt=null,stateProjection=null;
    let sourceRows=[],structural=false,indexRevision=0,verified=false,verification=null,selectionRevision=0,indexWork=null,rowRevision=0,pendingCache=null,indexedChat=null;
    const dirtyFloors=new Set(),messageIds=new WeakMap();let nextMessageId=0;const historyNamespace=Date.now().toString(36)+Math.random().toString(36).slice(2);
    const metrics={rowParses:0,indexVisits:0,rangeReads:0};
    const stale=()=>Object.assign(Error('剧情来源已变化'),{code:'cxx-history-stale'});
    function describe(m,floor){metrics.indexVisits++;const revision=++indexRevision;if(!m||floor===0||m.is_system||typeof m.mes!=='string'||!m.mes.trim())return null;if(!messageIds.has(m))messageIds.set(m,++nextMessageId);return {message:m,raw:m.mes,swipe:m.swipe_id||0,role:m.is_user?'player':'assistant',identity:messageIds.get(m),revision};}
    function sameSource(meta,m){return Boolean(meta&&meta.raw===m?.mes&&meta.swipe===(m?.swipe_id||0)&&meta.role===(m?.is_user?'player':'assistant')&&!m?.is_system);}
    // Host hydration may replace objects without changing the selected story.
    // Fingerprints include the selected swipe even when two swipes share text.
    function sourceStamp(from,to){return JSON.stringify(ctx().chat.slice(from,to+1).map((m,i)=>[!!m.is_user,!!m.is_system,m.swipe_id||0,top.CxxSource?(top.CxxSource.peek(from+i)?.sourceMessage||(sourceRows[from+i]?.raw===m.mes?sourceRows[from+i]?.sourceRaw:null)||m.mes):m.mes]));}
    const readFlights=new Map();
    function joinRead(id,work){const k=key()+':'+id;if(readFlights.has(k))return readFlights.get(k);const p=Promise.resolve().then(work).finally(()=>{if(readFlights.get(k)===p)readFlights.delete(k);});readFlights.set(k,p);return p;}
    async function stableRead(work){for(let n=0;n<3;n++){try{return await work();}catch(e){if(e.code!=='cxx-history-stale'||n===2)throw e;await updateIndex();}}}
    async function decode(floor,expected=scope){const meta=sourceRows[floor];if(!meta)return null;const valid=()=>!disposed&&scope===expected&&key()===expected&&sourceRows[floor]===meta&&sameSource(meta,ctx().chat[floor]);const history=top.Cxx249History;
      const raw=top.CxxSource?await top.CxxSource.text(floor):meta.raw;if(!valid())throw stale();meta.sourceRaw=raw;
      const payload={message:{mes:raw,is_user:meta.role==='player',is_system:false,swipe_id:meta.swipe},floor};
      let row;if(history)row=await history.submit('summary',payload,{key:'summary:'+historyNamespace+':'+expected+':'+meta.identity,revision:meta.revision,scope:expected,isCurrent:valid});else row=await new Promise((resolve,reject)=>later(()=>{if(!valid()){reject(stale());return;}try{metrics.rowParses++;resolve(S.row(payload.message,floor,parser));}catch(e){reject(e);}},0));
      if(!valid())throw stale();const result=row?{...row,floor}:null;if(!meta.resolved||rows[floor]?.hash!==result?.hash||rows[floor]?.error!==result?.error)rowRevision++;rows[floor]=result?{floor,role:result.role,swipe:result.swipe,hash:result.hash,error:result.error}:null;meta.resolved=true;return result;
    }
    async function rangeRows(from,to){metrics.rangeReads++;const expected=scope,end=Math.min(to,sourceRows.length-1),stamp=sourceStamp(from,end),result=[];for(let i=Math.max(1,from);i<=end;i++){const row=await decode(i,expected);if(row)result.push(row);}if(scope!==expected||key()!==expected||stamp!==sourceStamp(from,end))throw stale();return result;}
    function pendingCount(mode){const stamp=indexRevision+':'+rowRevision+':'+store.cursor+':'+mode;if(pendingCache?.stamp===stamp)return pendingCache.count;let count=0;for(let i=store.cursor+1;i<rows.length;i++){const r=rows[i];if(sourceRows[i]&&!sourceRows[i].resolved){count=null;break;}if(r&&(mode==='all'||r.role==='assistant'))count++;}pendingCache={stamp,count};return count;}
    async function ensureVerified(){if(verified||!store)return;if(verification)return verification;const expected=scope,revision=indexRevision,readEpoch=epoch;
      const work=(async()=>{let earliest=Infinity;for(const e of store.entries){try{const parsed=await rangeRows(e.from,e.to);if(!parsed.length||parsed.some(r=>r.error)||S.fingerprint(parsed)!==e.sourceHash)earliest=Math.min(earliest,e.from);}catch(error){if(error.code==='cxx-history-stale'||error.sourceGuard)throw error;earliest=Math.min(earliest,e.from);}}
        await rangeRows(store.cursor+1,rows.length-1);if(scope!==expected||key()!==expected||revision!==indexRevision||epoch!==readEpoch)throw stale();
        if(Number.isFinite(earliest)&&S.invalidate(store,earliest)){newsRecord={...newsRecord,stale:true};await persist({[SK]:store,[KEY]:newsRecord},expected,()=>scope===expected&&revision===indexRevision);}
        if(scope===expected&&revision===indexRevision){verified=true;notify();}
      })();verification=work;try{await work;}finally{if(verification===work)verification=null;}
    }
    const listeners=[];
    const connectionApi=typeof module==='object'&&module.exports?require('./api-connection.js'):root.CxxApiConnection,connection=connectionApi.create(fetcher,{context:ctx,onState:s=>{top.dispatchEvent?.(new top.Event('cxx-aux-request-changed'));if(s.stage==='failed')top.CxxDiagnostics?.report({module:'辅助模型',stage:s.kind,message:s.error||'HTTP '+s.http,detail:JSON.stringify(s)});}});
    function endpoint(base){return connectionApi.baseUrl(base)+'/chat/completions';}
    let memoryConfig={};
    function config(){try{memoryConfig=JSON.parse(top.localStorage.getItem(CONFIG)||'{}')||{};}catch{}return {...memoryConfig,countMode:memoryConfig.countMode==='assistant'?'assistant':'all',summaryEvery:[10,20,30,40].includes(memoryConfig.summaryEvery)?memoryConfig.summaryEvery:memoryConfig.autoEvery===5?10:20,manualSummaryCount:[5,10,20,40].includes(memoryConfig.manualSummaryCount)?memoryConfig.manualSummaryCount:10,manualNews:memoryConfig.manualNews===true,autoEnabled:memoryConfig.autoEnabled??memoryConfig.autoEvery!==0};}
    function approved(c){try{return c.storySummaryConsent?.scope==='story-summary-news-v2'&&c.storySummaryConsent.endpoint===endpoint(c.apiBase)&&c.storySummaryConsent.model===c.model;}catch{return false;}}
    function notify(){top.dispatchEvent?.(new top.Event('cxx-city-news-changed'));}
    function cancelActive(reason){if(active){active.controller.abort();status=reason;notify();}}
    function configure(patch){connection.cancel();const previous=config();memoryConfig={...previous,...patch};if(previous.apiBase!==memoryConfig.apiBase||previous.model!==memoryConfig.model)delete memoryConfig.storySummaryConsent;try{top.localStorage.setItem(CONFIG,JSON.stringify(memoryConfig));}catch{}epoch++;cancelActive('设置已变化，旧请求已取消。');pendingAuto=true;schedule();notify();return config();}
    function consent(destination,model){const c=config();if(destination!==endpoint(c.apiBase)||model!==c.model)throw Error('接口已变化，请重新核对。');return configure({storySummaryConsent:{scope:'story-summary-news-v2',endpoint:destination,model}});}
    function persist(fields,expected=scope,guard=()=>true){
      fields=structuredClone(fields);
      const operation=async()=>{if(!expected||key()!==expected||!guard())throw Error('聊天或来源已变化，保存已取消。');await api.updateVariablesWith(v=>{if(key()!==expected||!guard())throw Error('聊天或来源已变化，保存已取消。');Object.assign(v,fields);return v;},{type:'chat'});if(key()!==expected||!guard())throw Error('保存期间聊天或来源已变化。');await ctx().saveMetadata?.();};
      const run=()=>{const host=top.Cxx233Updater?.host,[characterKey,chatId]=JSON.parse(expected);return host?.withChatSave?host.withChatSave({characterKey,chatId},operation):operation();};const result=queue.then(run);queue=result.catch(()=>{});return result;
    }
    let stampCache=null;
    function selectionStamp(){if(!store)return '';const revision=store.revision+':'+selectionRevision;if(stampCache?.store===store&&stampCache.revision===revision)return stampCache.value;let value='';try{value=S.signature(S.selected(store));}catch{}stampCache={store,revision,value};return value;}
    function currentNews(){return verified&&newsRecord.summaryStamp&&newsRecord.summaryStamp===selectionStamp()&&!newsRecord.stale?newsRecord.dynamic:null;}
    function state(options={}){const c=config();if(scope!==key()||!scope)return {status:'当前聊天正在切换或尚未就绪',dynamic:null,summary:null,busy:false,approved:approved(c),lastFloor:0,pendingCount:0};const count=store?pendingCount(c.countMode):0;return {status:status||newsRecord.status||'都市动态尚未生成',dynamic:newsRecord.dynamic||null,stale:!!newsRecord.dynamic&&(!!newsRecord.stale||verified&&!currentNews()),busy:!!active,approved:approved(c),summary:store?(options.light?{schema:store.schema,revision:store.revision,selectionMode:store.selectionMode,selectedIds:[...store.selectedIds]}:structuredClone(store)):null,summaryRevision:store?.revision+':'+selectionRevision,indexing:count===null||!verified,lastFloor:Math.max(0,rows.length-1),pendingCount:count??0,nextIn:Math.max(0,c.summaryEvery-(count||0)),interval:c.summaryEvery,countMode:c.countMode};}
    function summaryEntries(){return store?store.entries.map(({history,...entry})=>({...entry})).sort((a,b)=>a.from-b.from):[];}
    async function load(){
      const expected=key();pendingSummarySave=null;pendingNewsSave=null;staleSchedules=0;epoch++;active?.controller.abort();active=null;clearPrompt();growthReroll=null;if(scope&&scope!==expected)top.Cxx249History?.clearScope(scope);scope=expected;rows=[];sourceRows=[];store=null;newsRecord={};dirty=Infinity;dirtyFloors.clear();structural=false;verified=false;verification=null;indexRevision++;selectionRevision++;pendingAuto=false;status='';stoppedFloor=null;
      if(!expected)return;pendingSummarySave=readOutbox('summary',expected);pendingNewsSave=readOutbox('news',expected);
      const data=vars();newsRecord=data[KEY]||{};store=data[SK]?.schema===1?structuredClone(data[SK]):S.create(Math.max(0,ctx().chat.length-1));
      indexedChat=ctx().chat;sourceRows=indexedChat.map((m,i)=>describe(m,i));rows=sourceRows.map((m,i)=>m?{floor:i,role:m.role,swipe:m.swipe}:null);
      if(store.cursor>=rows.length)store.cursor=Math.max(0,rows.length-1);
      if(!data[SK]||store.cursor!==data[SK].cursor)await persist({[SK]:store,[KEY]:newsRecord},expected);
      if(key()===expected){pendingAuto=!!data[SK];notify();schedule();}
    }
    async function ensure(){if(loading)await loading;if(scope!==key()||!store){loading=load();try{await loading;}finally{loading=null;}}if(!scope||!store)throw Error('当前聊天尚未就绪。');}
    function touch(from,auto=false,structure=false){staleSchedules=0;if(!active?.range||sourceStamp(active.range.from,active.range.to)!==active.sourceStamp){epoch++;cancelActive('剧情来源已变化，请重新生成该范围。');}const floor=Math.min(rows.length,Math.max(0,Number.isInteger(from)?from:rows.length-1));dirty=Math.min(dirty,floor);dirtyFloors.add(floor);structural=structural||structure;pendingAuto=pendingAuto||auto;schedule();}
    let staleSchedules=0;
    function schedule(delay=80){if(disposed||timer!==null)return;timer=later(()=>{timer=null;void tick().catch(e=>{if(e.code==='cxx-history-stale'){if(!disposed&&++staleSchedules<3)schedule(1000);else{status='正文仍在变化，等待完成后重新检查。';notify();}return;}status=e.message;notify();});},delay);}
    async function updateIndex(){
      if(indexWork)return indexWork;const expected=scope;const work=(async()=>{for(let n=0;n<3;n++){try{await updateIndexOnce();}catch(e){if(e.code!=='cxx-history-stale'||scope!==expected||disposed||n===2)throw e;}if(scope!==expected||!Number.isFinite(dirty)&&rows.length===ctx().chat.length)return;}throw stale();})();indexWork=work;try{return await work;}finally{if(indexWork===work)indexWork=null;}
    }
    async function updateIndexOnce(){
      const chat=ctx().chat;if(chat!==indexedChat){dirty=0;structural=true;indexedChat=chat;}if(!Number.isFinite(dirty)&&rows.length===chat.length)return;const from=dirty;dirty=Infinity;let earliest=Infinity;
      const changed=new Set(dirtyFloors);dirtyFloors.clear();if(structural||chat.length<rows.length){for(let i=Number.isFinite(from)?from:0;i<Math.max(rows.length,chat.length);i++)changed.add(i);}else for(let i=rows.length;i<chat.length;i++)changed.add(i);structural=false;
      for(const i of [...changed].sort((a,b)=>a-b)){
        if(sameSource(sourceRows[i],chat[i])){
          const meta=sourceRows[i];
          if(meta.message!==chat[i]){meta.message=chat[i];messageIds.set(chat[i],meta.identity);}
          continue;
        }
        const old=rows[i];sourceRows[i]=describe(chat[i],i);
        rows[i]=sourceRows[i]?{floor:i,role:sourceRows[i].role,swipe:sourceRows[i].swipe}:null;
        const next=await decode(i);
        if(old&&(old.hash!==next?.hash||old.role!==next?.role))earliest=Math.min(earliest,i);
      }
      rows.length=sourceRows.length=chat.length;
      if(Number.isFinite(earliest)&&S.invalidate(store,earliest)){newsRecord={...newsRecord,stale:true};status='历史剧情已变化，相关总结需要重建。';await persist({[SK]:store,[KEY]:newsRecord});}
      if(store.cursor>=chat.length){store.cursor=Math.max(0,chat.length-1);await persist({[SK]:store});}
    }
    function begin(kind,range){const cfg=config();if(active)throw Error('已有请求正在处理。');if(busy())throw Error('请等本轮剧情与变量处理结束。');if(!approved(cfg)||!cfg.apiBase||!cfg.model)throw Error('请先确认允许此接口接收剧情正文、所选总结并生成新闻。');const request={kind,cfg,expected:scope,epoch,range,sourceStamp:range?sourceStamp(range.from,range.to):null,controller:new AbortController()};request.current=()=>!disposed&&key()===request.expected&&epoch===request.epoch&&!request.controller.signal.aborted&&approved(config())&&!busy()&&(!range||sourceStamp(range.from,range.to)===request.sourceStamp);active=request;return request;}
    async function requestJSON(request,system,input,validate,repairOnce=false){
      let repairs=0,correction='';
      for(let attempt=1;attempt<=3;attempt++){
        if(!request.current())throw Error('剧情、选择或连接已变化，请求已取消。');
        status=(request.kind==='summary'?'正在生成剧情总结':'正在生成四家媒体新闻')+'（'+attempt+'/3）';notify();
        const control=new AbortController(),abort=()=>control.abort();request.controller.signal.addEventListener('abort',abort,{once:true});const timeout=later(abort,60000);
        try{
          const response=await connection.request(request.cfg,{temperature:request.kind==='summary'?0.3:1,messages:[{role:'system',content:system+correction},{role:'user',content:JSON.stringify(input)}]},{signal:control.signal,kind:request.kind});
          if(!response.ok)throw Object.assign(Error([400,413,422].includes(response.status)?'接口拒绝输入（HTTP '+response.status+'）；若超过容量，请减少所选总结或补建范围，不会自动截断。':'HTTP '+response.status),{retryable:![400,401,403,404,405,413,422].includes(response.status)});
          const responseBody=await response.json();if(top.CxxSource){if(request.range)await top.CxxSource.prime(request.range.from,request.range.to);else for(const e of S.selected(store))await top.CxxSource.prime(e.from,e.to);}if(!request.current())throw Object.assign(Error('来源已变化，丢弃晚到结果。'),{retryable:false});
          const raw=responseBody?.choices?.[0]?.message?.content||'';
          try{return validate(raw);}catch(e){if(repairOnce&&repairs++>=1)throw Object.assign(e,{retryable:false});correction='\n上次返回未通过校验：'+e.message+'。重新根据原始资料输出完整合格JSON，不解释。';throw e;}
        }catch(e){if(e.sourceGuard||!request.current()||e.retryable===false||attempt===3)throw e;}
        finally{cancel(timeout);request.controller.signal.removeEventListener('abort',abort);}
      }
    }
    function buildRange(from,to){return joinRead('build:'+from+':'+to,()=>buildRangeOnce(from,to));}
    let pendingSummarySave=null;
    async function retrySummarySave(){const p=pendingSummarySave;if(!p)throw Error('没有待重试保存的总结。');if(key()!==p.scope)throw stale();if(top.CxxSource)await top.CxxSource.prime(p.from,p.to);if(key()!==p.scope||sourceStamp(p.from,p.to)!==p.sourceStamp){pendingSummarySave=null;clearOutbox('summary',p.scope);throw stale();}await persist({[SK]:p.next},p.scope,()=>key()===p.scope&&sourceStamp(p.from,p.to)===p.sourceStamp);if(top.fetch&&ctx().getRequestHeaders)await confirmSaved(p.scope,SK,p.next);store=p.next;pendingSummarySave=null;clearOutbox('summary',p.scope);status='总结已保存。';notify();return true;}
    async function buildRangeOnce(from,to){
      if(pendingSummarySave){if(pendingSummarySave.from===from&&pendingSummarySave.to===to&&pendingSummarySave.scope===key())return retrySummarySave();throw Error('已有总结生成完成，请先重试保存。');}
      await ensure();await stableRead(async()=>{await updateIndex();await ensureVerified();});if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>=rows.length)throw Error('请选择有效的起止楼层（首层为1）。');
      const original=store.entries.find(e=>e.from===from&&e.to===to);if(store.entries.some(e=>e!==original&&e.from<=to&&e.to>=from))throw Error('范围与已有总结交叠，请使用该总结的重建按钮。');
      const inputRows=S.source(await stableRead(()=>rangeRows(from,to)),from,to),sourceHash=S.fingerprint(inputRows),request=begin('summary',{from,to});
      const entry={...(original||{}),id:original?.id||'S'+String(store.nextId).padStart(4,'0'),from,to,sourceHash,revision:(original?.revision||0)+1,status:'valid',history:original?[...(original.history||[]),Object.fromEntries(Object.entries(original).filter(([k])=>k!=='history'))]:[]};
      try{
        const text=await requestJSON(request,S.PROMPT,{messages:inputRows.map(r=>({floor:r.floor,role:r.role,text:r.text}))},S.normalize,true);if(!request.current())return false;
        const next=structuredClone(store);entry.text=text;delete entry.error;entry.updatedAt=new Date().toISOString();if(original)next.entries[next.entries.findIndex(e=>e.id===original.id)]=entry;else{next.entries.push(entry);next.nextId++;}next.revision++;if(from<=next.cursor+1)next.cursor=Math.max(next.cursor,to);
        pendingSummarySave={scope:request.expected,from,to,sourceStamp:request.sourceStamp,next};outbox('summary',pendingSummarySave);
        try{await retrySummarySave();}catch(e){status='总结已生成，保存失败：'+e.message+'；请重试保存，不会重新请求模型。';notify();return false;}
        if(!request.current())return false;status='总结 '+entry.id+' 已保存（楼层 '+from+'—'+to+'）。';notify();return true;
      }catch(e){if(e.sourceGuard){status=e.message;notify();return false;}if(request.current()){const next=structuredClone(store);if(original){const row=next.entries.find(e=>e.id===original.id);row.status='failed';row.error=e.message;}else{next.entries.push({...entry,text:'',status:'failed',error:e.message});next.nextId++;}next.revision++;await persist({[SK]:next},request.expected,request.current);store=next;status='总结失败：'+e.message+'；可单独重试。';notify();}return false;}
      finally{if(active===request){active=null;notify();}}
    }
    function summarizeRange(from,to){return joinRead('range:'+from+':'+to,async()=>{await ensure();const before=selectionStamp(),ok=await buildRange(from,to);if(ok&&config().autoEnabled&&selectionStamp()!==before)try{await refresh();}catch(e){status='总结已保存；新闻暂未更新：'+e.message;notify();}return ok;});}
    async function rebuild(id){await ensure();const e=store.entries.find(e=>e.id===id);if(!e)throw Error('总结不存在。');return summarizeRange(e.from,e.to);}
    async function setSelection(mode,ids=[]){await ensure();if(!['all','selected'].includes(mode)||!Array.isArray(ids)||ids.some(id=>!store.entries.some(e=>e.id===id)))throw Error('总结选择无效。');epoch++;active?.controller.abort();const next={...store,selectionMode:mode,selectedIds:[...new Set(ids)]};await persist({[SK]:next});store=next;selectionRevision++;status='新闻读取范围已保存；点击请求新动态使用此选择。';notify();}
    async function refresh({signal}={}){
      if(signal?.aborted)return false;
      await ensure();await updateIndex();await ensureVerified();if(signal?.aborted)return false;if(pendingNewsSave)return retryNewsSave();let chosen=S.selected(store);if(!chosen.length&&store.selectionMode==='selected'){status='请先选择要用于新闻的总结。';notify();return false;}if(!chosen.length){status='正在补建最近剧情总结，再生成新闻与论坛。';notify();const cfg=config(),tail=[];for(let i=rows.length-1;i>0&&tail.length<cfg.manualSummaryCount;i--){if(store.entries.some(e=>i>=e.from&&i<=e.to))continue;const r=await decode(i);if(r&&(cfg.countMode==='all'||r.role==='assistant'))tail.push(r);}if(!tail.length){status='尚无可总结正文；请先游玩，或重建已失效的总结。';notify();return false;}const ok=await buildRange(tail.at(-1).floor,tail[0].floor);if(!ok)return false;chosen=S.selected(store);}const summaryStamp=S.signature(chosen),request=begin('news');
      const abort=()=>{request.controller.abort();status='页面已离开，本次新闻请求已取消。';notify();};signal?.addEventListener('abort',abort,{once:true});
      try{
        const dynamic=await requestJSON(request,news.SYSTEM_PROMPT,{summaries:chosen.map(e=>({id:e.id,from:e.from,to:e.to,text:e.text}))},raw=>news.normalize(JSON.parse(raw.replace(/^\s*```(?:json)?\s*([\s\S]*?)```\s*$/,'$1')),chosen.map(e=>e.id)));
        if(!request.current())return false;const now=Date.now();for(const [kind,list]of Object.entries(dynamic))list.forEach((v,i)=>Object.assign(v,{id:'city_'+kind+'_'+now+'_'+i,time:'刚刚',dynamic:true}));dynamic.generatedAt=new Date(now).toISOString();
        const history=[...(newsRecord.history||[])];if(newsRecord.dynamic)history.push(Object.fromEntries(Object.entries({...newsRecord,stale:true}).filter(([k])=>k!=='history')));
        const next={...newsRecord,history,schema:2,dynamic,summaryStamp,summaryIds:chosen.map(e=>e.id),stale:false,status:'都市动态已更新：四家媒体各1条，论坛2张。'};
        pendingNewsSave={scope:request.expected,summaryStamp,next};outbox('news',pendingNewsSave);try{await retryNewsSave();}catch(e){status='新闻与论坛已生成，保存尚未确认：'+e.message+'；再次刷新只重试保存。';notify();return false;}notify();return true;
      }catch(e){if(request.current()){status='新闻更新失败：'+e.message+'；已有总结保留，可只重试新闻。';notify();}return false;}finally{signal?.removeEventListener('abort',abort);if(active===request){active=null;notify();}}
    }
    async function publishHeadlines(dynamic,request){if(!config().syncStory||!request.current())return;const floor=ctx().chat.length-1;await api.updateVariablesWith(v=>{if(!request.current())throw Error('来源已变化。');if(v.stat_data?.terminal)v.stat_data.terminal.net={...(v.stat_data.terminal.net||{}),schemaVersion:1,updatedAt:'最近',news:dynamic.news.map(n=>n.outlet+'：'+n.title),threads:dynamic.threads.map(t=>'帖子：'+t.title)};return v;},{type:'message',message_id:floor});}
    let pendingNewsSave=null;
    async function retryNewsSave(){const p=pendingNewsSave;if(!p)throw Error('没有待保存的新闻。');const valid=()=>key()===p.scope&&selectionStamp()===p.summaryStamp;if(!valid()){pendingNewsSave=null;clearOutbox('news',p.scope);throw stale();}await persist({[KEY]:p.next},p.scope,valid);if(top.fetch&&ctx().getRequestHeaders)await confirmSaved(p.scope,KEY,p.next);if(!valid())throw stale();newsRecord=p.next;pendingNewsSave=null;clearOutbox('news',p.scope);await publishHeadlines(p.next.dynamic,{current:valid});status='新闻与论坛已保存并核对。';notify();return true;}
    async function tick(){
      await ensure();if(busy()){if(pendingAuto){status='等待正文与 MVU 处理完成，之后自动继续。';notify();schedule(1000);}return;}waitingSince=0;await updateIndex();await ensureVerified();if(active)return;
      if(top.__cxx_utility__?.busy()){if(pendingAuto)schedule(1000);return;}const auto=pendingAuto;const cfg=config();if(!auto||!cfg.autoEnabled||!approved(cfg)||stoppedFloor!==null)return;pendingAuto=false;if(pendingSummarySave)await retrySummarySave();if(pendingNewsSave)await retryNewsSave();
      const range=S.pending(store,rows,cfg);if(range){const ok=await summarizeRange(range.from,range.to);if(ok&&S.pending(store,rows,cfg)){pendingAuto=true;schedule(1000);}}
    }
    async function summarizePending(){await ensure();await updateIndex();await ensureVerified();await rangeRows(store.cursor+1,rows.length-1);const range=S.pending(store,rows,config());if(!range)throw Error('尚未达到总结间隔；可以使用起止楼层补建。');return summarizeRange(range.from,range.to);}
    function summarizeNow(){return joinRead('manual',async()=>{await ensure();return pendingSummarySave?retrySummarySave():summarizeNowOnce();});}
    async function summarizeNowOnce(){
      await ensure();await updateIndex();const cfg=config();
      // Manual use includes existing chat history on first enablement, without the auto interval.
      const tail=[];let to=-1,last=0;const intervals=[...store.entries].sort((a,b)=>a.from-b.from);
      for(let i=rows.length-1;i>last&&tail.length<cfg.manualSummaryCount;i--){const covered=intervals.find(e=>i>=e.from&&i<=e.to);if(covered){i=covered.from;continue;}const r=await decode(i);if(!r)continue;if(to<0){to=i;last=intervals.reduce((n,e)=>e.to<to?Math.max(n,e.to):n,0);}tail.push(r);}
      if(!tail.length)throw Error('没有未总结的正文；已有总结可用下方重建按钮更新。');
      const from=tail.at(-1).floor;
      const ok=await buildRange(from,to);
      if(ok&&cfg.manualNews)try{await refresh();}catch(e){status='总结已保存；新闻暂未更新：'+e.message;notify();}
      return ok;
    }
    function clearPrompt(){stateProjection=null;prompt?.uninject();prompt=null;growthPrompt?.uninject();growthPrompt=null;chapterPrompt?.uninject();chapterPrompt=null;}
    function latestGrowthStat(type,extra){
      const chat=ctx().chat;let end=chat.length-1;const discarded=chat[end]?.variables?.[chat[end]?.swipe_id||0]?.stat_data?.terminal?.gameplay?.growth;
      if(extra&&growthReroll?.scope===key()&&growthReroll.floor===end&&growthReroll.previous===chat[end-1]&&growthReroll.previousSwipe===(chat[end-1]?.swipe_id||0))return growthReroll.stat;
      // A reroll starts from the preceding turn, never the discarded answer's awards.
      if(!extra&&['swipe','regenerate'].includes(type)&&end>=0&&!chat[end].is_user)end--;
      for(let i=end;i>=0;i--){const message=chat[i],stat=message.variables?.[message.swipe_id||0]?.stat_data;if(stat)return stat;}
      if(!extra&&['swipe','regenerate'].includes(type)&&discarded)return {__cxxGrowthReadError:'重写前的成长快照已清理，无法核对上一轮的成长起点。本轮保持成长不变，不从开局配置重建或补发奖励。'};
      return null;
    }
    function equipmentContext(stat,analyzes){
      const equipment=api.CxxLoadout||top.CxxLoadout;
      if(!equipment)return '';
      const chat=ctx().chat,start=Math.max(0,chat.length-2);
      const recent=chat.slice(start).map((message,index)=>top.CxxSource
        ?top.CxxSource.message(message,start+index):message);
      return '\n'+equipment.context(stat?.terminal?.gameplay,recent.map(m=>m.mes||'').join('\n'))
        +(analyzes?'\n'+equipment.protocol(stat?.terminal?.gameplay):'');
    }
    function actorFrame(stat,type,extra){
      const A=typeof module==='object'&&module.exports?require('./ensemble-state.js'):root.CxxEnsembleState||top.CxxEnsembleState;
      const actorId=extra&&growthReroll?.scope===key()?growthReroll.actorId:top.CxxContext?.generationBinding?.(type)?.actorId;
      if(!actorId&&stat?.terminal?.ensemble&&['swipe','regenerate','continue'].includes(type))throw Error('旧回复的人物来源服务尚未就绪，不能按当前人物重写。');
      if(!A&&stat?.terminal?.ensemble)throw Error('人物状态服务尚未就绪。');
      const actor=A?A.selected(stat,actorId):{actorId:'player',record:{name:'玩家'},gameplay:stat?.terminal?.gameplay,wallet:stat?.terminal?.wallet,paths:{gameplay:['terminal','gameplay'],wallet:['terminal','wallet']}};
      if(actor.actorId==='player')actor.record.name=ctx().chatMetadata?.__cxx_story_profile?.name||ctx().name1||actor.record.name;
      return {actor,stat:stat?{...stat,terminal:{...stat.terminal,gameplay:actor.gameplay,wallet:actor.wallet}}:stat};
    }
    function actorProtocol(text,actor){return String(text||'').replaceAll('/terminal/gameplay','/'+actor.paths.gameplay.join('/')).replaceAll('/terminal/wallet','/'+actor.paths.wallet.join('/'));}
    async function before(type,options,dryRun){
      clearPrompt();if(!key())return;
      const native=options&&Object.hasOwn(options,'automatic_trigger')&&['normal','continue','swipe','regenerate'].includes(type);
      const extra=!native&&top.CxxVariableMode?.read?.().mode==='extra';
      if(!native&&!extra)return;
      try{await (top.CxxStoryProfile||root.CxxStoryProfile)?.selected?.(top,{api});}catch(error){ctx().stopGeneration?.();top.CxxDiagnostics?.report({module:'user资料',stage:'生成前绑定',message:error.message,detail:error.stack});throw error;}
      if(top.CxxVariableMode)await top.CxxVariableMode.ready();
      const analyzes=extra||native&&top.CxxVariableMode?.read().mode==='main';
      if(top.CxxSource)await top.CxxSource.prime();
      const identity=vars()[identities.KEY],confirmed=identities.valid(identity)?identity:null;
      if(native){growthReroll=null;if(['swipe','regenerate','continue'].includes(type)){const chat=ctx().chat,end=chat.length-1;growthReroll={scope:key(),floor:end,previous:chat[end-1],previousSwipe:chat[end-1]?.swipe_id||0,stat:latestGrowthStat(type,false)};}}
      const canonical=latestGrowthStat(type,extra);let frame;try{frame=actorFrame(canonical,type,extra);}catch(e){ctx().stopGeneration?.();throw e;}const actor=frame.actor,controlledIdentity=actor.actorId==='player'?confirmed:null;if(native&&growthReroll)growthReroll.actorId=actor.actorId;
      const roster=typeof module==='object'&&module.exports?require('./roster.js'):root.CxxRoster||top.CxxRoster;
      const projected=roster?.promptState?.(canonical,{actorId:actor.actorId,text:ctx().chat.slice(-2).map(m=>m.mes||'').join('\n')});
      if(projected)stateProjection={scope:key(),content:'<status_current_variable>\n'+JSON.stringify(projected)+'\n</status_current_variable>\n未列出的档案细节为未知，不是零；离场人物仍冻结。当前玩家及在场人物保留完整玩法状态，其他已登记人物保留钱包与基础状态，供其实际进场时读取。'};
      const chapter=top.CxxPlot?(top.CxxPlot.enabled()?top.CxxPlot:null):api.CxxChapter||top.CxxChapter||root.CxxChapter;{const content=[chapter?.context(canonical,{analyzes}),top.CxxCity?.context(canonical,{analyzes}),top.CxxPolice?.context(canonical,{analyzes})].filter(Boolean).join('\n');if(content)chapterPrompt=api.injectPrompts([{id:'cxx-chip-night-v1',position:'in_chat',depth:0,role:'system',should_scan:false,content}],{once:false});}
      if(talents){
        const stat=frame.stat;let battle='';if(native){try{battle=actor.gameplay?.numeric?.combat?.active?(top.__cxx_battle__?.prepare(type,canonical,dryRun)||numeric?.context(stat,numericContent||{})||''):(top.__cxx_tactical__?await top.__cxx_tactical__.prepare(type,dryRun,canonical):'');}catch(e){ctx().stopGeneration?.();top.toastr?.warning(e.message,'本轮交锋');battle='【本轮未结算】'+e.message+' 不得描写扣血或胜负，等待玩家处理。';}}
        const content='【本轮玩家人物】'+JSON.stringify({actorId:actor.actorId,name:actor.record.name})+'。下列成长、装备与资源属于此人。\n'+actorProtocol(talents.context(stat,controlledIdentity)+equipmentContext(stat,analyzes)
          +(analyzes?'\n'+talents.protocol(stat?.terminal?.gameplay,numericContent||{})
            :'\n如实描写玩家完成的破解、调查、交涉、战斗、修理、训练、音乐活动或委托成果。经验由程序根据已完成的事实结算，正文无需计算或报出经验数字；计划与回顾不算新成果。')
          +(battle?'\n'+battle:''),actor)+(analyzes?'\n本轮 numericInput 事件中的 target:"player" 指 '+actor.actorId+'，保存到 /'+actor.paths.gameplay.join('/')+'/numericInput；不会把原玩家的固定保存路径重新解释成另一人物。':'');
        growthPrompt=api.injectPrompts([{id:'cxx-character-growth-v1',position:'in_chat',depth:0,role:'system',should_scan:false,content}],{once:false});
      }
      if(!native)return;
      if(dryRun!==true){stoppedFloor=null;epoch++;active?.controller.abort();}if(config().syncStory){await ensure();await updateIndex();await ensureVerified();}
      const dynamic=config().syncStory?currentNews():null;const content='【当前user】'+JSON.stringify({actorId:actor.actorId,name:actor.record.name,worldbookUid:actor.record.worldbookUid})+'。此人由玩家扮演，玩家输入就是此人的输入；不得把此人作为另一位NPC自由代演，不替玩家决定未输入的行动、台词或内心。历史对白保留当时人物归属。\n'+(controlledIdentity?(identities.promptContext?identities.promptContext(identity):'当前聊天已确认身份，属于背景资料，不赠送初始资产：\n'+JSON.stringify(identity)):'')+(dynamic?'\n已收到的新闻和论坛标题，仅供背景及传闻，不证明任务、资产或秘密：\n'+JSON.stringify({news:dynamic.news.map(n=>n.title),threads:dynamic.threads.map(t=>t.title)}):'');if(content)prompt=api.injectPrompts([{id:'cxx-city-public-context-v1',position:'in_chat',depth:1,role:'system',should_scan:false,content}],{once:false});
    }
    function on(name,fn){const event=ctx().eventTypes[name];if(!event)return;const handler=(...args)=>{try{return Promise.resolve(fn(...args)).catch(e=>{if(!disposed&&e.code!=='cxx-history-stale'){status=e.message;notify();}});}catch(e){if(!disposed){status=e.message;notify();}}};api.eventOn(event,handler);listeners.push(()=>api.eventRemoveListener(event,handler));}
    function start(){top.CxxApiConnection=connectionApi;
      if(top.CxxSource)listeners.push(top.CxxSource.subscribe(({floor})=>{const r=Number.isInteger(floor)?top.CxxSource.peek(floor):null;if(r?.ok)touch(floor);else if(r){cancelActive(r.message);status=r.message;notify();}}));
      top[slot]?.destroy();top[slot]=service;top.CxxApiConnection=connectionApi;if(root.CxxUtilityApi){top.__cxx_utility__?.destroy();top.__cxx_utility__=root.CxxUtilityApi.create({api,top,fetcher});}if(root.CxxBattleHost)root.CxxBattleHost.create({api,top,B:root.CxxBattle}).start();if(root.CxxTacticalHost)root.CxxTacticalHost.create({api,top}).start();if(root.CxxBattleSurface)root.CxxBattleSurface.create({api,top}).start();on('CHAT_CHANGED',()=>{cancel(timer);timer=null;loading=load();return loading.finally(()=>{loading=null;});});on('GENERATION_AFTER_COMMANDS',before);on('WORLDINFO_ENTRIES_LOADED',filterIdentities);
      for(const name of ['MESSAGE_SENT','MESSAGE_RECEIVED','MESSAGE_UPDATED','MESSAGE_EDITED','MESSAGE_SWIPED','MESSAGE_DELETED'])on(name,id=>touch(Number.isInteger(id)?id:name==='MESSAGE_DELETED'?0:Math.max(0,ctx().chat.length-1),false,name==='MESSAGE_DELETED'));
      for(const event of ['mag_variable_update_ended','mag_variable_initialized']){const done=()=>{pendingAuto=true;schedule();};api.eventOn?.(event,done);listeners.push(()=>api.eventRemoveListener?.(event,done));}const wake=()=>{pendingAuto=true;schedule();};top.addEventListener?.('pageshow',wake);listeners.push(()=>top.removeEventListener?.('pageshow',wake));
      on('GENERATION_ENDED',()=>{clearPrompt();touch(Math.max(0,ctx().chat.length-1),stoppedFloor===null);});on('GENERATION_STOPPED',()=>{clearPrompt();stoppedFloor=Math.max(0,ctx().chat.length-1);pendingAuto=false;touch(stoppedFloor);});
      api.addEventListener?.('pagehide',destroy,{once:true});loading=load();loading.catch(e=>{status=e.message;notify();}).finally(()=>{loading=null;});return service;
    }
    function destroy(){connection.destroy();if(disposed)return;disposed=true;top.__cxx_utility__?.destroy();top.__cxx_battle__?.destroy();top.__cxx_battle_surface__?.destroy();top.__cxx_tactical__?.destroy();epoch++;cancel(timer);active?.controller.abort();clearPrompt();growthReroll=null;rows=[];sourceRows=[];store=null;newsRecord={};stampCache=null;pendingCache=null;listeners.splice(0).forEach(fn=>fn());api.removeEventListener?.('pagehide',destroy);if(top[slot]===service)delete top[slot];}
    async function confirmSaved(expected,field,value){
      if(typeof top.fetch!=='function'||typeof ctx().getRequestHeaders!=='function')throw Error('酒馆存档读取接口尚未就绪，请重新打开聊天。');
      const [avatar_url,file_name]=JSON.parse(expected);
      for(const delay of [0,150,350,700,1500,2500,5000]){
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));if(key()!==expected)throw Error('聊天已切换，保存未确认。');
        const response=await top.fetch('/api/chats/get',{method:'POST',headers:ctx().getRequestHeaders(),credentials:'same-origin',cache:'no-cache',signal:AbortSignal.timeout(10000),body:JSON.stringify({avatar_url,file_name,ch_name:ctx().characters[ctx().characterId]?.name})});
        if(!response.ok)throw Error('酒馆存档读取失败（HTTP '+response.status+'）。');
        const text=await response.text();if(key()!==expected)throw Error('聊天已切换，保存未确认。');
        if(/^\s*</.test(text))throw Error('酒馆存档接口返回了网页，保存尚未确认。请检查酒馆登录或代理连接后重试。');
        let rows;try{rows=JSON.parse(text);}catch{throw Error('酒馆存档接口返回格式异常，保存尚未确认。');}
        if(sameJson(rows?.[0]?.chat_metadata?.variables?.[field],value))return;if(delay===700&&sameJson(vars()[field],value)){const host=top.Cxx233Updater?.host,[characterKey,chatId]=JSON.parse(expected),save=async()=>{if(key()!==expected)throw stale();await ctx().saveChat?.();};if(host?.withChatSave)await host.withChatSave({characterKey,chatId},save);else await save();}
      }
      throw Error('酒馆磁盘保存未确认，请等待保存完成后重试。');
    }
    async function chooseIdentity(value){if(!top.__cxx_player__)throw Error('人物保存服务尚未就绪。');return (await top.__cxx_player__.completeOpening({value})).growthIdentity;}

    async function filterIdentities(payload){
      if(!key())return;const P=top.CxxStoryProfile||root.CxxStoryProfile;
      // Only the current card's worldbook request copy is replaced. Historical
      // assistant snapshots and the stored worldbook retain their original data.
      const primaryWorld=ctx().characters?.[ctx().characterId]?.data?.extensions?.world;
      if(primaryWorld&&stateProjection?.scope===key()&&Array.isArray(payload?.characterLore))payload.characterLore.splice(0,payload.characterLore.length,...payload.characterLore.map(entry=>entry.world===primaryWorld&&(entry.uid??entry.id)===1&&(entry.comment||entry.name)==='mvu变量列表'&&typeof entry.content==='string'&&/<status_current_variable>\s*\{\s*"terminal"\s*:\s*\{\{get_message_variable::stat_data\.terminal\}\}\s*\}\s*<\/status_current_variable>/.test(entry.content)?{...entry,content:entry.content.replace(/<status_current_variable>[\s\S]*?<\/status_current_variable>/i,stateProjection.content)}:entry));
      if(P?.selected){const scope=key(),route=ctx().chatMetadata?.__cxx_story_v1?.routeId||ctx().getCurrentChatId?.();P.filterEntries(payload,null,null,route);
        try{const selected=await P.selected(top,{api});if(key()!==scope)throw Error('故事已切换，请在当前故事重新发送。');P.filterEntries(payload,ctx().chatMetadata?.[P.KEY]?.binding,selected,route);}
        catch(error){ctx().stopGeneration?.();top.CxxDiagnostics?.report({module:'user资料',stage:'生成前绑定',message:error.message,detail:error.stack});throw error;}
      }
      if(!identities.valid(vars()[identities.KEY]))return;const list=payload?.characterLore;if(Array.isArray(list))for(let i=0;i<list.length;i++)if([49,50,51,52].includes(list[i].uid??list[i].id)&&/^user人设：/.test(list[i].comment||list[i].name||''))list[i]={...list[i],disable:true};
    }

    const service={start,destroy,tick,refresh,config,configure,request:(cfg,payload,options)=>connection.request(cfg,payload,options),testConnection:cfg=>connection.test(cfg||config()),connectionState:()=>connection.read(),subscribeConnection:fn=>connection.subscribe(fn),listModels:cfg=>connection.listModels(cfg||config()),cancelModels:()=>connection.cancel(),consent,endpoint,state,summaryEntries,performanceStats:()=>({...metrics,rows:rows.length,verified}),chooseIdentity,prepareIdentityOpening:value=>top.__cxx_player__?.prepareOpening(value),completeIdentityOpening:options=>{if(!top.__cxx_player__)throw Error('人物保存服务尚未就绪。');return top.__cxx_player__.completeOpening(options);},readIdentity:()=>key()?vars()[identities.KEY]:null,owner,summarizeRange,summarizePending,summarizeNow,retrySummarySave,retryNewsSave,rebuild,setSelection};return service;

  }
  return {create};
});
