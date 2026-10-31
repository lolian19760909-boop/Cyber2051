/** Agent state: takeover baselines, mode and per-round selection journal. Pure data, no host calls. */
import {CONFIG_FIELDS,fieldSnapshot} from '../platform/worldbook.mjs';

export const AGENT_STATE_SCHEMA=1;
export const AGENT_MODES=['off','observe','takeover'];

const clone=value=>value===undefined?undefined:structuredClone(value);

export function emptyAgentState(){return {schema:AGENT_STATE_SCHEMA,mode:'off',books:{},journal:[],applied:[],decisions:{},modeSince:null};}

export function normalizeAgentState(value){
  const base=emptyAgentState();
  if(!value||typeof value!=='object')return base;
  const mode=AGENT_MODES.includes(value.mode)?value.mode:'off';
  const books={};
  for(const [bookId,record] of Object.entries(value.books||{})){
    if(!record||typeof record!=='object')continue;
    const entries={};
    for(const [entryId,row] of Object.entries(record.entries||{})){
      if(!row||typeof row!=='object')continue;
      const config={};
      for(const field of CONFIG_FIELDS)if(field in (row.config||{}))config[field]=row.config[field];
      entries[String(entryId)]={content:typeof row.content==='string'?row.content:'',config};
    }
    books[String(bookId)]={bookId:String(bookId),name:String(record.name||bookId),revision:record.revision??null,at:record.at??null,entries};
  }
  return {
    schema:AGENT_STATE_SCHEMA,
    mode,
    books,
    journal:Array.isArray(value.journal)?value.journal.filter(row=>row&&typeof row==='object').map(row=>({turn:Number(row.turn)||0,at:row.at??null,plan:clone(row.plan)??null,applied:clone(row.applied)??null})):[],
    applied:Array.isArray(value.applied)?value.applied.filter(row=>row&&typeof row==='object'):[],
    decisions:normalizeDecisions(value.decisions),
    modeSince:value.modeSince??null,
  };
}

/** 决策复用只记签名、入选 uid、依据与依赖签名；同一签名换版本就重算，不靠时间猜新旧。 */
function normalizeDecisions(value){
  const out={};
  const rows=value&&typeof value==='object'?Object.entries(value):[];
  for(const [key,row] of rows.slice(-24)){
    if(!row||typeof row!=='object')continue;
    const sig=String(row.sig||key||'');
    if(!sig)continue;
    out[sig]={sig,at:row.at??null,revision:Number(row.revision)||0,mode:String(row.mode||'select'),deps:row.deps??null,selectedIds:Array.isArray(row.selectedIds)?row.selectedIds.map(String):[],reason:String(row.reason||'')};
  }
  return out;
}

export function rememberDecision(state,row){
  const next=normalizeAgentState(state);
  const sig=String(row?.sig||'');
  if(!sig)return next;
  const entries=Object.entries(next.decisions).filter(([key])=>key!==sig);
  entries.push([sig,{sig,at:row.at??null,revision:Number(row.revision)||0,mode:String(row.mode||'select'),deps:row.deps??null,selectedIds:Array.isArray(row.selectedIds)?row.selectedIds.map(String):[],reason:String(row.reason||'')}]);
  next.decisions=normalizeDecisions(Object.fromEntries(entries.slice(-24)));
  return next;
}

export function decisionOf(state,sig){return normalizeAgentState(state).decisions[String(sig)]||null;}

export function setMode(state,mode,at=null){
  if(!AGENT_MODES.includes(mode))throw new TypeError('未知接管模式：'+mode);
  return {...normalizeAgentState(state),mode,modeSince:at};
}

export function takeoverRecord(book,at=new Date().toISOString()){
  return {bookId:book.bookId,name:book.name,revision:book.revision,at,entries:fieldSnapshot(book)};
}

export function recordTakeover(state,record){
  const next=normalizeAgentState(state);
  next.books={...next.books,[record.bookId]:{...record,entries:clone(record.entries)}};
  return next;
}

export function takeoverOf(state,bookId){
  const next=normalizeAgentState(state);
  return next.books[String(bookId)]||null;
}

export function clearTakeover(state,bookId){
  const next=normalizeAgentState(state);
  delete next.books[String(bookId)];
  return next;
}

export function baselineOf(state,bookIds=null){
  const next=normalizeAgentState(state);
  const keep=bookIds?new Set(bookIds.map(String)):null;
  const books=Object.values(next.books).filter(record=>!keep||keep.has(record.bookId)).map(record=>({
    bookId:record.bookId,
    name:record.name,
    revision:record.revision,
    entries:Object.entries(record.entries).map(([entryId,row])=>({entryId,title:entryId,content:row.content,config:clone(row.config)})),
  }));
  return {schema:AGENT_STATE_SCHEMA,books};
}

export function selectionJournal(state,{turn,at=new Date().toISOString(),plan=null,applied=null}={}){
  const next=normalizeAgentState(state);
  const row={turn:Number(turn)||0,at,plan:plan?{managedIds:clone(plan.managedIds||[]),selectedIds:clone(plan.selectedIds||[]),requiredIds:clone(plan.requiredIds||[]),removedIds:clone(plan.removedIds||[]),bookChanges:clone(plan.bookChanges||[])}:null,applied:applied?clone(applied):null};
  next.journal=[...(next.journal||[]).filter(entry=>entry.turn!==row.turn),row].slice(-24);
  return next;
}

export function journalOf(state,turn){
  const next=normalizeAgentState(state);
  return (next.journal||[]).find(row=>row.turn===Number(turn))||null;
}

export function recordApplied(state,entry){
  const next=normalizeAgentState(state);
  next.applied=[...(next.applied||[]),{at:entry.at??null,turn:Number(entry.turn)||0,plan:entry.planId??null,books:entry.books??[],patches:entry.patches??[],kept:entry.kept??[],status:entry.status||'applied'}].slice(-48);
  return next;
}

export function stateView(state){
  const next=normalizeAgentState(state);
  return {schema:AGENT_STATE_SCHEMA,mode:next.mode,modeSince:next.modeSince,books:Object.keys(next.books),journal:next.journal.length,applied:next.applied.length,decisions:Object.keys(next.decisions).length};
}
