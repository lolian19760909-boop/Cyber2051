/** Previous advance pack → classifier capsule, with the original quotas.
 *  Source: A1:67-79 (capsule table), A1:374 / A4:913-918 (PLOT_TASK_CONTRACT 11 fields),
 *  A3:300-301 (head 180 + tail 120 trimming), A5:224 (6000 char ceiling). */
export const PLOT_FIELDS=Object.freeze(['player_input','recall_detail','recall','time_state','scene_state','runtime_state','time_recall','situation_assessment','butterfly_delta','chapter_baseline','progression_guidance']);
export const CAPSULE_FIELDS=Object.freeze(['scene_state','runtime_state','chapter_baseline','progression_guidance','recall','situation_assessment']);
export const FIELD_QUOTA=Object.freeze({scene_state:480,runtime_state:420,chapter_baseline:420,progression_guidance:420,recall:300,situation_assessment:220});
export const CAPSULE_QUOTAS=Object.freeze({authority:240,playerInput:1700,dbRoute:720,tail:520,maxChars:6000});
export const PLAYER_TRIM=Object.freeze({head:520,tail:420});
export const DB_TRIM=Object.freeze({head:260,tail:220});
export const ERA='东京都2051';
/** Fields whose names come from the 2051 contract itself; the rest stay marked pending until the original contract is supplied. */
export const CONTRACT_CONFIRMED=Object.freeze(['player_input','recall','scene_state','runtime_state','chapter_baseline','progression_guidance','situation_assessment']);
const clean=value=>String(value??'').replace(/\r\n/g,'\n').trim();
const clip=(text,{head,tail,ellipsis='…'}={})=>{
  const value=clean(text);if(value.length<=head+tail)return {text:value,truncated:false};
  return {text:value.slice(0,head)+ellipsis+value.slice(-tail),truncated:true};
};
const stripExamples=raw=>String(raw??'')
  .replace(/```[\s\S]*?```/g,'')
  .replace(/<cxx-example[^>]*>[\s\S]*?<\/cxx-example>/gi,'')
  .replace(/<cxx-sample[^>]*>[\s\S]*?<\/cxx-sample>/gi,'');
const tagPattern=field=>new RegExp('<'+field+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+field+'>','i');
/** Read the advance pack tags from the last assistant body. Fenced blocks and example wrappers are not evidence. */
export function readPlotPack(nodes=[],{fields=PLOT_FIELDS}={}){
  const body=[...nodes].reverse().find(node=>typeof node?.message?.raw==='string'&&node.message.raw.trim())||null;
  const raw=body?stripExamples(body.message.raw):'';
  const values={},present=[];
  for(const field of fields){
    const match=tagPattern(field).exec(raw),text=match?clean(match[1]):'';
    if(!text)continue;
    values[field]=text;present.push(field);
  }
  const missing=fields.filter(field=>!present.includes(field));
  return {nodeId:body?.nodeId??null,replyId:body?.message?.replyId??null,fields:values,present,missing,capsuleFields:CAPSULE_FIELDS.filter(field=>present.includes(field))};
}
/** Route facts the capsule is allowed to quote: counts plus the scene row, never a whole table. */
export function routeFacts(facts=null){
  const tables=Array.isArray(facts?.tables)?facts.tables:[];
  const rows=tables.reduce((sum,table)=>sum+(Number(table?.rows??table?.rowCount)||0),0);
  const route=facts?.routeFacts||{};
  const scene=(facts?.views?.v_scene_now||[])[0]||null;
  const place=[scene?.area,scene?.opening,scene?.clock].filter(Boolean).join(' · ');
  return {tables:tables.length||(facts?.tables?Object.keys(facts.tables).length:0),rows,era:ERA,chapter:clean(route.chapter),locations:(route.locations||[]).slice(0,6),characters:(route.characters||[]).slice(0,16),place};
}
const scrub=text=>String(text??'').replace(/```[\s\S]*?```/g,'').replace(/<cxx-(?:example|sample)\b[\s\S]*?<\/cxx-(?:example|sample)>/gi,'').trim();
const segment=(label,text,quota)=>{const value=clean(text);if(!value)return null;const clipped=value.length>quota?clip(value,{head:quota-120,tail:120}):{text:value,truncated:false};return {label,text:clipped.text,chars:clipped.text.length,truncated:clipped.truncated,quota};};
/** Compose the classifier capsule in the original segment order and per-segment quotas. */
export function buildCapsule({authority='',playerInput='',dbRoute='',pack=null,tail=''}={}){
  const parts=[],push=row=>{if(row)parts.push(row);};
  push(segment('本地权威路由',authority,CAPSULE_QUOTAS.authority));
  const input=clean(playerInput);
  if(input){
    const body=input.length>PLAYER_TRIM.head+PLAYER_TRIM.tail?clip(input,{head:PLAYER_TRIM.head,tail:PLAYER_TRIM.tail}):{text:input,truncated:false};
    push({label:'本轮玩家原文',text:body.text,chars:body.text.length,truncated:body.truncated,quota:CAPSULE_QUOTAS.playerInput});
  }
  const db=clean(dbRoute);
  if(db){const body=db.length>DB_TRIM.head+DB_TRIM.tail?clip(db,{head:DB_TRIM.head,tail:DB_TRIM.tail}):{text:db,truncated:false};push({label:'数据库路由事实',text:body.text,chars:body.text.length,truncated:body.truncated,quota:CAPSULE_QUOTAS.dbRoute});}
  for(const field of CAPSULE_FIELDS)push(segment('上一轮'+field,pack?.fields?.[field]||'',FIELD_QUOTA[field]));
  let used=parts.reduce((sum,row)=>sum+row.label.length+row.text.length+3,0);
  const rest=Math.max(0,Math.min(CAPSULE_QUOTAS.tail,CAPSULE_QUOTAS.maxChars-used));
  const ending=clean(scrub(tail));
  if(ending&&rest>40){const body=ending.length>rest?clip(ending,{head:rest-120>0?rest-120:rest,tail:rest>120?120:0}):{text:ending,truncated:false};push({label:'最近助手正文证据',text:body.text,chars:body.text.length,truncated:body.truncated,quota:rest});}
  const text=parts.map(row=>'['+row.label+'] '+row.text).join('\n');
  return {text:text.length>CAPSULE_QUOTAS.maxChars?text.slice(0,CAPSULE_QUOTAS.maxChars)+'…':text,segments:parts,chars:Math.min(text.length,CAPSULE_QUOTAS.maxChars),truncated:text.length>CAPSULE_QUOTAS.maxChars||parts.some(row=>row.truncated)};
}
/** Missing-tag repair (buildPlotRepairMessages / plotRepairTagTemplate equivalent). Unknown fields stay pending, never invented. */
export function repairPlan(pack,{contract=null}={}){
  const declared=Array.isArray(contract?.plotContract?.outputFields)&&contract.plotContract.outputFields.length?contract.plotContract.outputFields.map(String):PLOT_FIELDS;
  const fromContract=declared!==PLOT_FIELDS;
  const missing=declared.filter(field=>!pack?.present?.includes(field));
  const pending=fromContract?[]:missing.filter(field=>!CONTRACT_CONFIRMED.includes(field));
  const repairable=fromContract?missing:missing.filter(field=>CONTRACT_CONFIRMED.includes(field));
  const status=!missing.length?'ok':repairable.length?'repairable':'pending-contract';
  const template=repairable.map(field=>'<'+field+'>…</'+field+'>').join('\n');
  const messages=status==='repairable'?[
    {role:'system',content:'你是东京都2051剧情推进包标签修复器。只补齐缺失标签，改写已有字段、续写正文或决定行动结果都不属于本次任务。缺失字段不确定时写 unknown。'},
    {role:'user',content:JSON.stringify({source:pack?.nodeId??null,existing:pack?.fields||{},missing:repairable,template,rule:'只输出缺失标签本身，每字段一组完整标签，不输出其它文字。'})},
  ]:[];
  return {status,declared,fromContract,missing,repairable,pendingContract:pending,messages,template};
}
/** Apply a repair answer back onto the pack; unparsable answers leave the pack untouched. */
export function mergeRepair(pack,raw,{fields=null}={}){
  const text=String(raw??'').replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'');
  const next={...pack,fields:{...(pack?.fields||{})},present:[...(pack?.present||[])]};
  const wanted=fields||CAPSULE_FIELDS;
  let changed=false;
  for(const field of wanted){
    const match=tagPattern(field).exec(text),value=match?clean(match[1]):'';
    if(!value)continue;
    next.fields[field]=value;if(!next.present.includes(field))next.present.push(field);changed=true;
  }
  next.missing=PLOT_FIELDS.filter(field=>!next.present.includes(field));
  next.capsuleFields=CAPSULE_FIELDS.filter(field=>next.present.includes(field));
  return {pack:next,changed};
}
/** One receipt row for diagnostics: which field came from where and what was trimmed. */
export function packReceipt(pack,capsule,repair){
  return {nodeId:pack?.nodeId??null,fields:Object.fromEntries(Object.entries(pack?.fields||{}).map(([key,value])=>[key,value.length])),missing:pack?.missing||[],capsule:{chars:capsule?.chars??0,truncated:!!capsule?.truncated,segments:(capsule?.segments||[]).map(row=>({label:row.label,chars:row.chars,truncated:row.truncated}))},repair:repair?{status:repair.status,missing:repair.missing,repaired:repair.repaired??false,pendingContract:repair.pendingContract}:null};
}
export default {PLOT_FIELDS,CAPSULE_FIELDS,FIELD_QUOTA,CAPSULE_QUOTAS,PLAYER_TRIM,DB_TRIM,ERA,CONTRACT_CONFIRMED,readPlotPack,routeFacts,buildCapsule,repairPlan,mergeRepair,packReceipt};
