/** Formal preset adapter. Authority: ST 1.19 PromptManager/openai/regex and paired maintained presets. */
import {createVarStore,expandMacros} from './macro.mjs';
import {parseMesExamples,parseExampleIntoIndividual} from './native-prompt/examples.mjs';
import {withMacroHost} from './native-prompt/host.mjs';
import {regexScripts,mergeRegexScripts,transformText} from './regex.mjs';
import {NATIVE_PROMPT_DEFAULTS} from './native-prompt/preset-defaults.mjs';
export {createVarStore,expandMacros};
export {regexScripts,mergeRegexScripts,transformText};
export {PromptError} from './prompt-error.mjs';
export function presetOrder(preset,{orderIndex,characterId=100001}={}){const list=preset.prompt_order||[];return (orderIndex===undefined?list.find(o=>o.character_id===characterId&&o.order?.length)||list.find(o=>o.order?.length):list[orderIndex])?.order||[];}
export function presetControls(preset,toggles={}){const order=presetOrder(preset),enabled=new Map(order.map(s=>[s.identifier,s.enabled!==false]));return preset.prompts.map(p=>({identifier:p.identifier,name:p.name||p.identifier,role:p.role||'system',marker:!!p.marker,enabled:Object.hasOwn(toggles,p.identifier)?!!toggles[p.identifier]:!!enabled.get(p.identifier),position:p.injection_position||0,depth:p.injection_depth??4,order:p.injection_order??100,trigger:p.injection_trigger||[]}));}
/** ST populationInjectionPrompts applied to chronological history. */
export function injectAtDepth(history,injections=[]){const reverse=history.map(x=>({...x})).reverse();let inserted=0;const depths=[...new Set(injections.map(p=>Math.max(0,Number(p.depth)||0)))].sort((a,b)=>a-b);for(const depth of depths){const selected=injections.filter(p=>(Number(p.depth)||0)===depth),orders=[...new Set(selected.map(p=>Number(p.order??100)))].sort((a,b)=>b-a),rows=[];for(const order of orders)for(const role of ['system','user','assistant']){const content=selected.filter(p=>Number(p.order??100)===order&&(p.role||'system')===role).map(p=>p.content?.trim()).filter(Boolean).join('\n');if(content)rows.push({role,content,injected:true});}reverse.splice(Math.min(depth+inserted,reverse.length),0,...rows);inserted+=rows.length;}return reverse.reverse();}
/** Used only when a preset omits the setting; an explicitly empty nudge remains empty. */
export const CONTINUE_NUDGE=NATIVE_PROMPT_DEFAULTS.continue_nudge_prompt;
const MARKERS=new Set(['personaDescription','charDescription','charPersonality','scenario','dialogueExamples','worldInfoBefore','worldInfoAfter','chatHistory']);
const promptRole=value=>typeof value==='number'?['system','user','assistant'][value]||'system':value||'system';
export function authorNoteForGeneration(note={},userMessageCount=0){
 const interval=note.interval??1,active=note.enabled!==false&&interval>0&&(interval===1||userMessageCount>0&&userMessageCount%interval===0);
 let content=String(note.content||'');if(note.character?.enabled){const character=String(note.character.content||'');content=note.character.position==='before'?character+'\n'+content:note.character.position==='after'?content+'\n'+character:character;}
 const position=note.position??1;return {...note,active,content,position:position==='chat'||position==='in_chat'?1:position==='before'?2:position==='after'?0:position};
}
/** The three custom request fields are expanded in native createGenerationParameters order, including quiet requests. */
export function providerPromptSettings(preset={},context={}, {source='',generationType='normal'}={}){
 source=String(source).replace(/^chat:/,'');source=({'openai-chat':'custom','openai-compatible':'custom','claude-messages':'claude'})[source]||source;
 const result={generationType,continue_prefill:!!preset.continue_prefill},expand=text=>expandMacros(text??'',{...context,generationType}).text;
 if(source==='claude'){
  result.assistant_prefill='';result.assistant_impersonation='';
  if(generationType!=='quiet'&&!(generationType==='continue'&&preset.continue_prefill)){const field=generationType==='impersonate'?'assistant_impersonation':'assistant_prefill';result[field]=expand(preset[field]);}
 }
 if(source==='custom')for(const field of ['custom_include_body','custom_exclude_body','custom_include_headers'])result[field]=expand(preset[field]);
 return result;
}
/** ST's continuation postfix belongs to the saved combined reply, not the assistant request prefill. */
export function continuationPrefix(raw,preset={}){raw=String(raw??'');const postfix=raw.endsWith(' ')?'':String(preset.continue_postfix??' ');return {prefix:raw+postfix,postfix};}
export function assemblePrompt(input){
 const {supplies={},history=[],random,now=new Date(),toggles={},generationType='normal'}=input,preset={...NATIVE_PROMPT_DEFAULTS,...input.preset};
 if(!Array.isArray(preset?.prompts))throw new TypeError('装配提示需要正式预设 JSON');
 const vars=input.vars||createVarStore(),globalVars=input.globalVars||createVarStore(),warnings=[],used=[],injections=[...(input.injections||[])],separators=new Set(),byId=new Map(preset.prompts.map(p=>[p.identifier,p]));
 const fields={...supplies,lastUserMessage:history.findLast(m=>m.role==='user')?.content??supplies.lastUserMessage??'',lastCharMessage:history.findLast(m=>m.role==='assistant')?.content??'',lastMessage:history.at(-1)?.content??''};
 const context={...input.macroContext,vars,globalVars,fields,history:input.macroHistory||history,now,random,warnings,generationType,chatId:input.chatId,chatMetadata:input.chatMetadata,messageVariables:input.messageVariables||{},outlets:input.worldInfo?.outlets||{},instruct:input.instruct??preset.instruct,contextTemplate:input.contextTemplate??preset.context,sysprompt:input.sysprompt??preset.sysprompt,preferCharacterPrompt:input.preferCharacterPrompt??true,maxContext:preset.openai_max_context,maxTokens:preset.openai_max_tokens};
 const expand=(text,extra={})=>expandMacros(text,{...context,...extra}).text;
 // PromptManager resolves all ordered prompt bodies before filling built-in fields and overrides.
 const ordered=[];
 for(const slot of presetOrder(preset,input)){
  const original=byId.get(slot.identifier);if(!original){warnings.push('预设引用了不存在的条目：'+slot.identifier);continue;}
  const enabled=(Object.hasOwn(toggles,slot.identifier)?!!toggles[slot.identifier]:slot.enabled!==false)&&(!original.injection_trigger?.length||original.injection_trigger.includes(generationType));
  if(!enabled&&slot.identifier!=='main')continue;
  ordered.push({...original,enabled,content:expand(enabled?original.content||'':'')});
 }
 for(const entry of ordered){
  const id=entry.identifier;
  if((MARKERS.has(id)||entry.marker)&&!['chatHistory','dialogueExamples'].includes(id)){
   let value=String(supplies[id]??'');
   if(id==='charPersonality'&&value&&preset.personality_format)value=expand(preset.personality_format);
   else if(id==='scenario'&&value&&preset.scenario_format)value=expand(preset.scenario_format);
   else if(['worldInfoBefore','worldInfoAfter'].includes(id)&&value&&preset.wi_format?.trim())value=preset.wi_format.replace(/{(\d+)}/g,(match,n)=>n==='0'?value:match);
   entry.content=!MARKERS.has(id)&&input.expandedSupplies?.includes(id)?value:expand(value);
  }
 }
 for(const [id,value]of [['main',input.systemPromptOverride??supplies.systemPrompt],['jailbreak',input.jailbreakPromptOverride??supplies.postHistoryInstructions]]){
  const entry=ordered.find(row=>row.identifier===id);if(value&&entry?.enabled&&entry.forbid_overrides!==true)entry.content=expand(value,{fields:{...fields,original:entry.content}});
 }
 const userCount=input.userMessageCount??history.filter(row=>row.role==='user').length,note=authorNoteForGeneration(input.authorNote,userCount);
 let relativeNote=null;
 if(note.active){
  const content=expand([...(input.worldInfo?.anBefore||[]),note.content,...(input.worldInfo?.anAfter||[])].filter(Boolean).join('\n'));
  const position=note.position??1,role=promptRole(note.role);
  if(content){if(position===1||position==='chat')injections.push({role,depth:note.depth??4,order:100,content});else relativeNote={role,content,position:position===2||position==='before'?'start':'end'};}
 }
 for(const entry of ordered)if(entry.injection_position===1&&entry.content){injections.push({role:promptRole(entry.role),content:entry.content,depth:entry.injection_depth??4,order:entry.injection_order??100});used.push(entry.identifier);}
 if(relativeNote){const main=ordered.find(row=>row.identifier==='main');if(main?.injection_position===1){const at=injections.findIndex(row=>row.content===main.content&&row.depth===(main.injection_depth??4));injections.splice(Math.max(0,at+(relativeNote.position==='end'?1:0)),0,{role:promptRole(main.role),content:relativeNote.content,depth:main.injection_depth??4,order:main.injection_order??100});relativeNote=null;}}
 // Raw scripts are only needed for legacy histories that were not processed when received.
 const cleanHistory=history.map((message,index)=>{let content=message.content;const options={preset,placement:message.role==='user'?1:2,depth:history.length-index-1,context,warnings};if(!input.historyRawProcessed)content=transformText(content,{...options,stage:'raw'});content=transformText(content,{...options,stage:'prompt'});return {...message,content};});
 const controls=[];let continuation=null;
 if(generationType==='continue'&&cleanHistory.length){
  continuation=continuationPrefix(input.continueRaw??history.at(-1)?.content,preset);
  if(preset.continue_prefill){const last=cleanHistory.pop(),prefix=last.role==='assistant'&&/^(?:chat:)?claude(?:-messages)?$/.test(input.chatCompletionSource||'')?expand(preset.assistant_prefill||''):'';controls.push({...last,content:[prefix,last.content].filter(Boolean).join('\n\n')});}
 }
 let historyRows=injectAtDepth(cleanHistory,injections);
 if(generationType==='continue'&&!preset.continue_prefill&&continuation){const index=historyRows.findLastIndex(row=>!row.injected);if(index>=0){const last=historyRows.splice(index,1)[0];controls.push({...last,content:expand(last.content)});}const content=expand(preset.continue_nudge_prompt??CONTINUE_NUDGE,{fields:{...fields,lastChatMessage:continuation.prefix.trim()}});if(content)controls.push({role:'system',content});}
 const emptyUser=historyRows.at(-1)?.role==='assistant'&&preset.send_if_empty?expand(preset.send_if_empty):'';
 historyRows=historyRows.slice().reverse().map(row=>({...row,content:expand(row.content)})).reverse();if(emptyUser)historyRows.push({role:'user',content:emptyUser});
 const starter=expand(fields.groupName?preset.new_group_chat_prompt??'':preset.new_chat_prompt??'[Start a new Chat]');if(starter){const row={role:'system',content:starter};historyRows.unshift(row);separators.add(row);}
 if(fields.groupName&&generationType!=='impersonate'){const content=expand(preset.group_nudge_prompt||'');if(content){const row={role:'system',content};historyRows.push(row);separators.add(row);}}
 const messages=[];
 for(const entry of ordered){
  const id=entry.identifier;if(entry.injection_position===1)continue;
  if(id==='chatHistory'){messages.push(...historyRows);used.push(id);continue;}
  if(id==='dialogueExamples'){
   const examples=[...(input.worldInfo?.examplesBefore||[]).slice().reverse(),supplies.dialogueExamples||'',...(input.worldInfo?.examplesAfter||[])].filter(Boolean);
   const blocks=examples.flatMap(text=>withMacroHost(context,()=>parseMesExamples(expand(text),false)));
   for(const block of blocks){const title=expand(preset.new_example_chat_prompt??'[Example Chat]');if(title){const row={role:'system',content:title};messages.push(row);separators.add(row);}messages.push(...withMacroHost(context,()=>parseExampleIntoIndividual(block)));}if(examples.length)used.push(id);continue;
  }
  if(id==='main'&&relativeNote?.position==='start')messages.push({role:relativeNote.role,content:relativeNote.content});
  if(entry.content){messages.push({role:promptRole(entry.role),content:entry.content});used.push(id);}
  if(id==='main'&&relativeNote?.position==='end')messages.push({role:relativeNote.role,content:relativeNote.content});
 }
 if(!used.includes('chatHistory')&&history.length)warnings.push('当前预设关闭了聊天历史标记，未注入历史与本轮输入');
 if(generationType==='impersonate'){const content=expand(preset.impersonation_prompt||'');if(content)messages.push({role:'system',content});}
 if(input.quietPrompt)messages.push({role:'system',content:expand(input.quietPrompt)});
 messages.push(...controls);
 if(preset.squash_system_messages)for(let i=messages.length-1;i>0;i--)if(messages[i].role==='system'&&messages[i-1].role==='system'&&!messages[i].name&&!messages[i-1].name&&!separators.has(messages[i])&&!separators.has(messages[i-1])){messages[i-1].content+='\n'+messages[i].content;messages.splice(i,1);}
 // ST's createGenerationParameters owns normal Claude prefill. Resolve it here, after prompt
 // assembly, while the full macro environment still exists. Do not evaluate unused settings.
 const providerSettings=providerPromptSettings(input.providerPreset||preset,context,{source:input.chatCompletionSource,generationType});
 return {messages:messages.filter(row=>row.content||row.tool_calls),providerSettings,warnings:[...new Set(warnings)],vars:vars.snapshot(),globalVars:globalVars.snapshot(),used,continuation,displayContract:displayContract(preset)};
}
export function displayContract(preset){const scripts=regexScripts(preset),fold=scripts.some(s=>!s.disabled&&/思维链折叠/.test(s.scriptName));return {thinking:fold?'fold':'remove',thinkingTags:fold?['think_nya~','think']:['think','thinking','konatan_planning~'],containers:'native-views',auxiliary:['tucao','konatan_chat','current_event','progress','summary','advice','background','danmu']};}
export function samplingFromPreset(p={}){const number=(k,d)=>Number.isFinite(p[k])?p[k]:d;return {temperature:number('temperature',1),top_p:number('top_p',1),top_k:number('top_k',0),top_a:number('top_a',0),min_p:number('min_p',0),frequency_penalty:number('frequency_penalty',0),presence_penalty:number('presence_penalty',0),repetition_penalty:number('repetition_penalty',1),max_tokens:number('openai_max_tokens',30000),max_context:number('openai_max_context',128000),include_reasoning:p.show_thoughts!==false,thinking_contract:displayContract(p).thinking==='fold'?'fold':undefined,reasoning_effort:p.reasoning_effort,verbosity:p.verbosity,seed:p.seed===-1?undefined:p.seed};}
