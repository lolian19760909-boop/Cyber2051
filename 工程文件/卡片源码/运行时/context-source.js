/* Message provenance only. Callers own persistence and actor-evidence resolution. */
(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(local?require('../共享/data-clone.js'):root.CxxDataClone,local?require('./crypto-compat.js'):root.CxxCrypto);if(local)module.exports=api;else root.CxxContextSource=api;})(globalThis,function(Clone,Crypto){
  'use strict';
  const KEY='cxx_context',copy=v=>Clone.clone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function fail(code,message){throw Object.assign(Error(message),{code});}
  function identifier(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);}
  function binding(value){
    if(value===null||value===undefined)return null;
    if(!object(value)||!identifier(value.actorId)||!identifier(value.viewpointActorId)||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.evidence!=='string'||!value.evidence.trim())fail('source-binding','消息人物归属缺少明确依据。');
    return copy(value);
  }
  function marker(value,variant=false){
    if(value===undefined)return null;
    if(!object(value)||value.schema!==1||!identifier(value.messageId)||variant&&(!identifier(value.variantId)||!Object.hasOwn(value,'binding')))fail('source-schema','消息来源格式不受支持，原数据已保留。');
    if(variant)binding(value.binding);return value;
  }
  function selected(message){return message.swipe_id??0;}
  function generationBinding(chat,{type,current,legacy=null}={}){
    if(!['swipe','regenerate','continue'].includes(type))return binding(current);
    const row=chat.at(-1);if(!row)return binding(current);
    const value=marker(Array.isArray(row.swipes)?row.swipe_info?.[selected(row)]?.extra?.[KEY]:row.extra?.[KEY],true);
    const prior=binding(value?.binding)||binding(legacy);
    if(!prior)fail('source-identity','这条旧回复没有可确认的扮演人物，不能按当前人物重写；请先核对原消息的人物归属。');
    return prior;
  }
  function plan(chat,{makeId=()=>Crypto.uuid(),resolveBinding=()=>null,completedFloor=null,newVariants=[]}={}){
    if(!Array.isArray(chat))fail('source-chat','消息列表无效。');
    const next=copy(chat),used=new Set(),changes=[],unresolved=[];
    for(let floor=0;floor<next.length;floor++){
      const row=next[floor],original=chat[floor];if(!object(row)||typeof row.mes!=='string')fail('source-message','消息正文格式无效。');
      const active=selected(row);if(!Number.isSafeInteger(active)||active<0)fail('source-swipe','消息回复版本无效。');
      if(row.extra!==undefined&&!object(row.extra))fail('source-extra','消息附加信息格式无效，未覆盖。');
      const existing=marker(row[KEY]),current=marker(row.extra?.[KEY],true),messageId=existing?.messageId||current?.messageId||makeId();
      if(!identifier(messageId)||used.has(messageId))fail('source-duplicate','消息来源编号重复，不能按正文猜配。');used.add(messageId);
      row[KEY]=existing?copy(existing):{schema:1,messageId};
      const hasSwipes=Array.isArray(row.swipes),texts=hasSwipes?row.swipes.slice():[row.mes];
      if(completedFloor===floor)texts[active]=row.mes;
      if(row.swipes!==undefined&&!hasSwipes||row.swipe_info!==undefined&&!Array.isArray(row.swipe_info))fail('source-swipes','回复列表格式无效。');
      const variants=new Set();
      for(let swipe=0;swipe<texts.length;swipe++){
        if(typeof texts[swipe]!=='string')continue; // Native host can reserve a new, unfinished swipe slot.
        const info=row.swipe_info?.[swipe];
        if(hasSwipes&&row.tt_swipe_cold&&info==null&&completedFloor!==floor)continue;
        if(info!==undefined&&info!==null&&(!object(info)||info.extra!==undefined&&!object(info.extra)))fail('source-swipe-info','回复附加信息格式无效。');
        const fresh=newVariants.some(v=>v.messageId===messageId&&v.swipe===swipe);
        let saved=fresh?null:marker(info?.extra?.[KEY],true);
        // Before the host creates swipe_info, only a single initial response may use extra.
        if(!saved&&!hasSwipes&&!fresh)saved=current;
        if(saved&&(saved.messageId!==messageId||variants.has(saved.variantId)))fail('source-duplicate','回复来源编号冲突，未覆盖原记录。');
        const value=saved?copy(saved):{schema:1,messageId,variantId:makeId(),binding:binding(resolveBinding({floor,swipe,message:original}))};
        if(!identifier(value.variantId)||variants.has(value.variantId))fail('source-duplicate','回复来源编号重复。');variants.add(value.variantId);
        if(value.binding===null)unresolved.push({messageId,variantId:value.variantId,floor,swipe});
        if(hasSwipes){row.swipe_info??=[];row.swipe_info[swipe]={...(info||{}),extra:{...(info?.extra||{}),[KEY]:value}};}
        if(swipe===active)row.extra={...(row.extra||{}),[KEY]:copy(value)};
      }
      if(!same(original,row))changes.push(floor);
    }
    return {chat:next,changes,unresolved};
  }
  const hash=async value=>Array.from(new Uint8Array(await Crypto.digest(new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('');
  function semantic(row){const e=row.extra||{};return {text:row.mes,user:row.is_user===true,system:row.is_system===true,name:row.name??null,role:row.role??null,tool_call_id:row.tool_call_id??null,tool_calls:row.tool_calls??null,reasoning:e.reasoning??null,media:e.media??null,files:e.files??null};}
  async function snapshot(chat,scope){
    if(!object(scope)||typeof scope.character!=='string'||!scope.character||typeof scope.chat!=='string'||!scope.chat)fail('source-scope','故事来源尚未确定。');
    const frozen=copy(chat),rows=[],seen=new Set();let ancestry=await hash({schema:1,scope});
    for(let floor=0;floor<frozen.length;floor++){
      const row=frozen[floor],m=marker(row[KEY]);if(!m||seen.has(m.messageId))fail('source-unmapped','消息缺少唯一来源编号。');seen.add(m.messageId);
      const swipe=selected(row),hasSwipes=Array.isArray(row.swipes);
      if(hasSwipes&&typeof row.swipes[swipe]!=='string'){rows.push({messageId:m.messageId,floor,swipe,pending:true});continue;}
      const v=marker(hasSwipes?row.swipe_info?.[swipe]?.extra?.[KEY]:row.extra?.[KEY],true);
      if(!v||v.messageId!==m.messageId||!same(v,row.extra?.[KEY]))fail('source-unmapped','当前回复来源与选中版本不一致。');
      const digest=await hash(semantic(row)),prior=ancestry;
      ancestry=await hash({prior,messageId:m.messageId,variantId:v.variantId,digest,binding:v.binding});
      rows.push({messageId:m.messageId,variantId:v.variantId,floor,swipe,digest,prior,ancestry,binding:copy(v.binding)});
    }
    return {schema:1,scope:copy(scope),ancestry,rows};
  }
  function map(rows,index){
    const sources=new Map(index.rows.map(row=>[row.messageId,row])),seen=new Set();
    return rows.map(row=>{
      const m=marker(row[KEY]),v=marker(row.extra?.[KEY],true),source=m&&sources.get(m.messageId);
      if(!source||source.pending||!v||source.variantId!==v.variantId||!same(source.binding,v.binding)||seen.has(m.messageId))fail('source-unmapped','发送消息不能唯一对应当前回复，已停止本次处理。');
      seen.add(m.messageId);return copy(source);
    });
  }
  function valid(reference,index){const row=index.rows.find(r=>r.messageId===reference?.messageId);return same(reference?.scope,index.scope)&&!!row&&!row.pending&&['variantId','digest','ancestry'].every(k=>row[k]===reference[k]);}
  async function rebase(index,scope){
    const next=copy(index);next.scope=copy(scope);let ancestry=await hash({schema:1,scope});
    for(const row of next.rows){if(row.pending)continue;row.prior=ancestry;ancestry=await hash({prior:ancestry,messageId:row.messageId,variantId:row.variantId,digest:row.digest,binding:row.binding});row.ancestry=ancestry;}
    next.ancestry=ancestry;return next;
  }
  return {KEY,plan,snapshot,map,valid,semantic,rebase,generationBinding};
});
