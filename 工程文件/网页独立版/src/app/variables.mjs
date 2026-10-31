/** The maintained main/extra worldbook formats share one rule contract. */
import {parseReply} from './parse.mjs';
import {PromptError} from './prompt.mjs';
export const EXTRA_BODY_DIRECTIVE='本轮采用额外解析：正文模型输出剧情、状态栏与选项；变量由额外解析模型依据本轮已经发生的事实记录。此正文请求不输出 UpdateVariable／JSONPatch，不把变量分析写成剧情。';
export const variableEntryMode=entry=>entry.extra?.__cxx_variable_mode||(entry.comment==='变量输出格式 · 正文解析'?'main':entry.comment==='[mvu_update]变量输出格式 · 额外解析'?'extra':null);
export function variableEntries(entries,mode='main',phase='body'){
 if(!['main','extra'].includes(mode))throw new PromptError('variable_mode','请选择正文解析或额外解析');
 if(phase==='analysis'&&!entries.some(entry=>variableEntryMode(entry)==='extra'))throw new PromptError('variable_source_missing','当前内容缺少维护源的额外解析规则，原正文已保留');
 return entries.map(entry=>{const own=variableEntryMode(entry);if(!own)return entry;const enabled=phase==='analysis'?own==='extra':mode==='main'&&own==='main';return {...entry,enabled,disable:!enabled};});
}
export function withoutVariableUpdates(raw,parser){
 const text=String(raw||''),ranges=parser.inspect(text).ranges.filter(row=>row.kind==='UpdateVariable');
 if(ranges.some(row=>row.complete===false))throw new PromptError('variable_body_invalid','原正文的变量标签未闭合，请先编辑确认原文');
 let result=text;for(const row of ranges.sort((a,b)=>b.start-a.start))result=result.slice(0,row.start)+result.slice(row.end);return result;
}
export function composeVariableReply(bodyRaw,analysisRaw,parser){
 const parsed=parseReply(analysisRaw,{parser});
 if(!parsed.supported||!parsed.protocol.found||parsed.protocol.issues.length)throw new PromptError('extra_parse_invalid',parsed.protocol.issues.join('；')||'额外解析须返回完整的 UpdateVariable 和合法 JSONPatch；原正文已保留');
 return withoutVariableUpdates(bodyRaw,parser)+'\n<UpdateVariable><JSONPatch>'+JSON.stringify(parsed.protocol.patches)+'</JSONPatch></UpdateVariable>';
}
