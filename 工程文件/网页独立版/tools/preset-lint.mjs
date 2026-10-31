/** Build-time preflight: stop unknown macros and unsupported worldbook rules before they reach a release. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WEB} from './workspace-paths.mjs';
import {createVarStore,expandMacros,regexScripts,PromptError} from '../src/app/prompt.mjs';

const fields={charName:'祥子',userName:'旅行者',original:'',scenario:'东京都2051',charPersonality:'',charDescription:'',personaDescription:'',lastUserMessage:'',lastCharMessage:'',lastMessage:'',userAvatarPath:''};
function scanText(text,scope,findings){
 if(typeof text!=='string'||!text.includes('{{')&&!text.includes('<%'))return;
 const warnings=[];
 try{expandMacros(text,{vars:createVarStore(),fields,messageVariables:{stat_data:{}},random:()=>0.5,warnings});}
 catch(error){if(!(error instanceof PromptError))throw error;findings.push({severity:'error',scope,code:error.code,message:error.message});}
 for(const warning of warnings)findings.push({severity:'error',scope,message:warning});
}
function regexSource(script){
 try{let find=String(script.findRegex||'');if(script.substituteRegex===1)find=expandMacros(find,{vars:createVarStore(),fields,messageVariables:{stat_data:{}},random:()=>0.5}).text;
 const match=find.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);new RegExp(match?match[1]:find,match?match[2]:'g');}catch(error){return '正式预设正则无法编译：'+error.message;}
 return '';
}
export function lintContent({card,presets=[]}){
 const findings=[],entries=(card?.data||card||{}).character_book?.entries||[];
 for(const presetRow of presets){
  const preset=presetRow.preset||presetRow,id=presetRow.id||preset?.name||'preset',known=new Set((preset.prompts||[]).map(row=>row.identifier));
  for(const prompt of preset.prompts||[]){scanText(prompt.content,id+':prompt:'+(prompt.name||prompt.identifier),findings);scanText(prompt.name,id+':prompt-name:'+(prompt.identifier),findings);}
  scanText(preset.continue_nudge_prompt,id+':continue_nudge_prompt',findings);scanText(preset.assistant_prefill,id+':assistant_prefill',findings);
  for(const order of preset.prompt_order||[])for(const slot of order.order||[])if(!known.has(slot.identifier))findings.push({severity:'error',scope:id+':prompt_order',message:'预设引用了不存在的条目：'+slot.identifier});
  for(const script of regexScripts(preset)){
   scanText(script.findRegex,id+':regex:'+(script.scriptName||'?'),findings);scanText(script.replaceString,id+':regex:'+(script.scriptName||'?'),findings);
   const problem=regexSource(script);if(problem)findings.push({severity:'error',scope:id+':regex:'+(script.scriptName||'?'),message:problem});
  }
 }
 let scanDepthEntries=0,positionEntries=0,regexKeys=0,metaKeys=0;
 for(const entry of entries){
  const ext=entry.extensions||{},label='worldbook:'+(entry.comment||entry.id);
  if(entry.enabled!==false){
   const position=Number.isInteger(ext.position)?ext.position:entry.position==='after_char'?1:0;
   if(![0,1,2,3,4,5,6,7].includes(position))findings.push({severity:'error',scope:label,message:'条目插入位置无效：'+position});
   if(Number.isInteger(ext.scan_depth)&&ext.scan_depth>1000)findings.push({severity:'error',scope:label,message:'scan_depth 超出 1000：'+ext.scan_depth});
   if(ext.sticky||ext.cooldown||ext.delay||ext.group)scanDepthEntries++;if(![0,1,2,3,4,5,6,7].includes(position))positionEntries++;
  }
  for(const key of entry.keys||[]){const text=String(key);if(/^\/[\s\S]*\/[dgimsuvy]*$/.test(text))regexKeys++;else if(entry.use_regex!==false&&/[.*+?^${}()|[\]\\]/.test(text)){metaKeys++;findings.push({severity:'warn',scope:label+':key',message:'use_regex 纯词键含正则元字符，匹配器会退回字面：'+text+'；建议在源头改成 /…/ 形式'});}scanText(key,label+':key',findings);}
  for(const key of entry.secondary_keys||[])scanText(key,label+':secondary',findings);
  scanText(entry.content,label,findings);
 }
 const summary={ok:findings.every(row=>row.severity!=='error'),counts:{presets:presets.length,worldbookEntries:entries.length,regexKeys,metaKeys,advancedEntries:scanDepthEntries,unsupportedPositions:positionEntries,warnings:findings.length},findings};
 return summary;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 const card=JSON.parse(fs.readFileSync(path.join(WEB,'generated/card.json'),'utf8')),presets=JSON.parse(fs.readFileSync(path.join(WEB,'generated/presets.json'),'utf8'));
 const result=lintContent({card,presets});console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
}
