/** Worldbook carriers: versioned content + per-story runtime config. Pure data; no host calls. */
export const WORLDBOOK_SCHEMA=1;

export const CONFIG_FIELDS=['enabled','constant','strategy','type','probability','effect','position','depth','role','order'];
const CARRIERS=['card','settings','host'];

const clone=value=>value===undefined?undefined:structuredClone(value);

function fnv(value){let hash=0x811c9dc5;const text=String(value);for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)>>>0;}return hash.toString(36).padStart(7,'0');}

export function entryConfig(entry={}){
  const extensions=entry.extensions||{};
  return {
    enabled:entry.enabled!==false&&!entry.disable,
    constant:entry.constant===true,
    strategy:entry.selective===true||entry.strategy==='selective'?'selective':(entry.strategy||'constant'),
    type:String(entry.type??extensions.type??'entire'),
    probability:Number.isFinite(entry.probability)?entry.probability:(Number.isFinite(extensions.probability)?extensions.probability:100),
    effect:String(entry.effect??extensions.effect??''),
    position:extensions.position??entry.position??null,
    depth:extensions.depth??entry.depth??null,
    role:extensions.role??entry.role??null,
    order:Number(entry.insertion_order??entry.order??0)||0,
  };
}

export function entryPatch(entry={},patch={}){
  return entryConfig({...entry,...patch,extensions:{...(entry.extensions||{}),...(patch.extensions||{})}});
}

export function normalizeEntry(entry={},index=0){
  const entryId=String(entry.uid??entry.id??index);
  return {entryId,title:String(entry.comment||entry.name||('条目 '+entryId)),content:String(entry.content||''),keys:entry.keys||entry.key||[],secondary_keys:entry.secondary_keys||entry.keysecondary||[],use_regex:!!entry.use_regex,config:entryConfig(entry)};
}

export function normalizeBook(raw={},carrier='card'){
  if(!CARRIERS.includes(carrier))throw new TypeError('未知世界书载体：'+carrier);
  const bookId=String(raw.bookId??raw.id??raw.name??'card');
  const entries=(Array.isArray(raw.entries)?raw.entries:Object.values(raw.entries||{})).map((entry,index)=>normalizeEntry(entry,index));
  const source=['chat','persona','character','global'].includes(raw.source)?raw.source:carrier==='card'?'character':'chat';
  const book={schema:WORLDBOOK_SCHEMA,bookId,name:String(raw.name||bookId),carrier,source,enabled:raw.enabled!==false,entries,externalRevision:raw.revision??null};
  book.revision=bookRevision(book);
  return book;
}

export function bookRevision(book){
  const rows=(book?.entries||[]).map(entry=>[entry.entryId,fnv(JSON.stringify([entry.content,entry.keys,entry.secondary_keys,entry.use_regex,entry.config]))]).sort((a,b)=>a[0]<b[0]?-1:1);
  return fnv(JSON.stringify([book?.bookId??'',book?.enabled,book?.source,rows]));
}

export function configDigest(book){
  return fnv(JSON.stringify((book?.entries||[]).map(entry=>[entry.entryId,entry.config]).sort((a,b)=>a[0]<b[0]?-1:1)));
}

function settingRecord(settings,bookId){return settings?.books?.[bookId]||null;}

export function withSettings(book,settings){
  const record=settingRecord(settings,book.bookId);
  if(!record)return book;
  const source=record.entriesRaw?normalizeBook({...book,entries:record.entriesRaw},book.carrier).entries:book.entries;
  const entries=source.map(entry=>{
    const patch=record.entries?.[entry.entryId];
    if(!patch)return entry;
    const next={...entry};
    if(typeof patch.content==='string')next.content=patch.content;
    next.config=entryPatch(entry.config,patch.config||{});
    return next;
  });
  const next={...book,name:record.name||book.name,source:['chat','persona','character','global'].includes(record.source)?record.source:book.source,enabled:record.enabled!==false,entries,appliedFrom:'settings'};return {...next,revision:bookRevision(next)};
}

export function readBooks({cards=[],settings=null,host=null,hostBooks=[]}={}){
  const books=[];
  for(const raw of cards)books.push(normalizeBook(raw,'card'));
  for(const raw of hostBooks)books.push(normalizeBook(raw,'host'));
  const extra=settings?.books&&typeof settings.books==='object'?Object.entries(settings.books):[];
  for(const [bookId,record] of extra){
    if(books.some(book=>book.bookId===bookId))continue;
    books.push(normalizeBook({bookId,name:record.name||bookId,source:record.source,entries:record.entriesRaw||[],revision:record.revision??null},'settings'));
  }
  const merged=books.map(book=>withSettings(book,settings));
  return {schema:WORLDBOOK_SCHEMA,at:new Date().toISOString(),books:merged,revision:fnv(JSON.stringify(merged.map(book=>[book.bookId,book.revision]))),host:describeHost(host)};
}

export function describeHost(host){
  if(!host)return {available:false,reason:'host_missing'};
  const write=typeof host.write==='function'||typeof host.apply==='function';
  const read=typeof host.read==='function'||typeof host.list==='function';
  return {available:read||write,canRead:read,canWrite:write,reason:read||write?'':'host_api_missing'};
}

export function diffBooks(before,after){
  const rows=[];
  const lookup=book=>new Map((book?.entries||[]).map(entry=>[entry.entryId,entry]));
  for(const book of after?.books||[]){
    const old=lookup((before?.books||[]).find(row=>row.bookId===book.bookId));
    for(const entry of book.entries){
      const previous=old.get(entry.entryId);
      if(!previous){rows.push({bookId:book.bookId,entryId:entry.entryId,kind:'added'});continue;}
      if(previous.content!==entry.content)rows.push({bookId:book.bookId,entryId:entry.entryId,kind:'content'});
      const changed=CONFIG_FIELDS.filter(field=>JSON.stringify(previous.config?.[field])!==JSON.stringify(entry.config?.[field]));
      if(changed.length)rows.push({bookId:book.bookId,entryId:entry.entryId,kind:'config',fields:changed});
    }
  }
  return rows;
}

export function fieldSnapshot(book,entryIds=null){
  const keep=new Set((entryIds||book.entries.map(entry=>entry.entryId)).map(String));
  return Object.fromEntries(book.entries.filter(entry=>keep.has(entry.entryId)).map(entry=>[entry.entryId,{content:entry.content,config:clone(entry.config)}]));
}

export function planRestore(before,current,{userFields={}}={}){
  const patches=[],kept=[];
  for(const book of current?.books||[]){
    const record=before?.books?.find(row=>row.bookId===book.bookId);
    if(!record)continue;
    const source=new Map(record.entries.map(entry=>[entry.entryId,entry]));
    const user=new Map(Object.entries(userFields?.[book.bookId]||{}));
    for(const entry of book.entries){
      const target=source.get(entry.entryId);
      if(!target)continue;
      const fields={};
      const touched=user.get(entry.entryId)||{};
      for(const field of CONFIG_FIELDS){
        if(JSON.stringify(entry.config?.[field])===JSON.stringify(target.config?.[field]))continue;
        if(touched.config&&touched.config.includes(field)){kept.push({bookId:book.bookId,entryId:entry.entryId,kind:'config',field,value:entry.config?.[field],reason:'用户手改保留'});continue;}
        fields[field]=target.config?.[field];
      }
      const patch={bookId:book.bookId,entryId:entry.entryId};
      if(Object.keys(fields).length)patch.config=fields;
      if(entry.content!==target.content){
        if(touched.content){kept.push({bookId:book.bookId,entryId:entry.entryId,kind:'content',reason:'用户手改保留'});}
        else patch.content=target.content;
      }
      if(patch.config||typeof patch.content==='string')patches.push(patch);
    }
  }
  return {patches,kept};
}

const APPLIED_SCHEMA=1;

function patchOf(book,change){
  const entry=book.entries.find(row=>row.entryId===String(change.entryId));
  return {bookId:book.bookId,entryId:String(change.entryId),entry,fields:{...(change.fields||{})},known:!!entry};
}

export async function applySelection({plan=null,books=null,state=null,host=null,at=new Date().toISOString()}={}){
  const scoped=new Set((plan?.managedIds||[]).map(String));
  const changes=(plan?.bookChanges||[]).filter(change=>change&&change.bookId&&change.entryId!=null).map(change=>{
    const book=(books?.books||[]).find(row=>row.bookId===String(change.bookId));
    return book?patchOf(book,change):{bookId:String(change.bookId),entryId:String(change.entryId),entry:null,fields:{...(change.fields||{})},known:false};
  });
  const unknown=changes.filter(row=>!row.known).map(row=>({bookId:row.bookId,entryId:row.entryId}));
  const byBook=new Map();
  for(const row of changes){if(!row.known||!scoped.has(row.entryId)&&!scoped.has(row.bookId+':'+row.entryId))continue;const list=byBook.get(row.bookId)||[];list.push(row);byBook.set(row.bookId,list);}
  const applied=[],attempted=[],settingsPatch={books:{}},undone=[];
  let status='applied',error=null;
  for(const [bookId,rows] of byBook){
    if(state&&(state.mode!=='takeover'||!state.books?.[bookId]))continue;
    const book=(books?.books||[]).find(row=>row.bookId===bookId);
    const carrier=book?.carrier==='host'?(host?.canWrite?'host':'host-unavailable'):book?.carrier||'settings';
    if(carrier==='host-unavailable'){status='unsupported';error={bookId,code:'host_write_missing'};break;}
    const entryPatches=rows.map(row=>({entryId:row.entryId,fields:row.fields,config:pickConfig(row.fields),...(typeof row.fields.content==='string'?{content:row.fields.content}:{})}));
    const hostPatches=entryPatches.map(row=>({entryId:row.entryId,config:row.config,...(typeof row.content==='string'?{content:row.content}:{})}));
    try{
      if(carrier==='host'){
        attempted.push({bookId,carrier,patches:entryPatches,baseline:book});
        await host.apply({bookId,patches:hostPatches});
      }else{
        for(const row of rows){
          settingsPatch.books[bookId]=settingsPatch.books[bookId]||{entries:{}};
          const target=settingsPatch.books[bookId].entries[row.entryId]=settingsPatch.books[bookId].entries[row.entryId]||{};
          if(typeof row.fields.content==='string')target.content=row.fields.content;
          target.config={...(target.config||{}),...pickConfig(row.fields)};
        }
      }
      applied.push({bookId,carrier,patches:entryPatches,verified:true,at});
    }catch(cause){
      const code=String(cause?.code||'write_failed');
      if(/readback/.test(code)){status='readback-mismatch';error={bookId,code:'readback_mismatch',detail:String(cause?.message||cause)};break;}
      status='failed';error={bookId,code,message:String(cause?.message||cause)};break;
    }
  }
  if(status!=='applied'){
    for(const row of attempted.slice().reverse()){
      const baseline={entries:Object.fromEntries((row.baseline?.entries||[]).map(entry=>[entry.entryId,entry]))};
      if(!baseline)continue;
      const patches=(row.patches||[]).map(patch=>({entryId:patch.entryId,config:Object.fromEntries(Object.keys(patch.fields||{}).filter(field=>CONFIG_FIELDS.includes(field)).map(field=>[field,baseline.entries?.[patch.entryId]?.config?.[field]]).filter(([,value])=>value!==undefined)),...(typeof patch.fields?.content==='string'?{content:baseline.entries?.[patch.entryId]?.content}:{})}));
      try{
        if(row.carrier==='host'&&host?.canWrite)await host.apply({bookId:row.bookId,patches,restore:true});
        undone.push({bookId:row.bookId,patches});
      }catch(cause){undone.push({bookId:row.bookId,patches,error:String(cause?.message||cause)});}
    }
  }
  return {schema:APPLIED_SCHEMA,planId:plan?.inputRef??null,at,status,books:applied,settingsPatch,unknown,error,restore:undone};
}

function pickConfig(fields={}){return Object.fromEntries(CONFIG_FIELDS.filter(field=>field in fields).map(field=>[field,fields[field]]));}

