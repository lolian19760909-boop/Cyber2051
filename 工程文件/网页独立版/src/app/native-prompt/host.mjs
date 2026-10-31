/** Explicit synchronous host bindings for the unmodified ST macro handlers. No browser globals/storage. */
import {createVarStore} from './variables.mjs';
import {parseMesExamples,parseExampleIntoIndividual,formatInstructModeExamples} from './examples.mjs';
export {parseMesExamples,parseExampleIntoIndividual,formatInstructModeExamples};
let current={};
export const getMacroHost=()=>current;
export let chat_metadata={},chat=[],main_api='openai',extension_prompts={},power_user={instruct:{},sysprompt:{},context:{}},selected_group=null,name1='',name2='';
let evaluator;
export const setMacroEvaluator=fn=>{evaluator=fn;};
export function substituteParams(text,overrides={}){return evaluator(String(text??''),{...current,fields:{...current.fields,...(overrides.name1Override?{userName:overrides.name1Override}:{}),...(overrides.name2Override?{charName:overrides.name2Override}:{})}}).text;}
export function substituteParamsExtended(text,extra={},postProcess){return evaluator(String(text??''),{...current,dynamicMacros:{...current.dynamicMacros,...extra},transformMacro:postProcess}).text;}
export function withMacroHost(context,action){
 const previous={current,chat_metadata,chat,main_api,extension_prompts,power_user,selected_group,name1,name2};
 current=context;current.vars??=createVarStore();current.globalVars??=createVarStore();
 const fields=context.fields||{};name1=fields.userName||'旅行者';name2=fields.charName||'';
 chat_metadata=context.chatMetadata??{};chat=context.history?.map(row=>({...row,mes:row.mes??row.content??'',is_user:row.is_user??row.role==='user',is_system:row.is_system??row.role==='system'}))||[];
 main_api=context.mainApi||'openai';selected_group=fields.groupName||null;
 power_user={instruct:context.instruct||{},sysprompt:context.sysprompt||{},context:context.contextTemplate||{}};
 extension_prompts=Object.fromEntries(Object.entries(context.outlets||{}).map(([key,value])=>['customWIOutlet_'+key,{value:Array.isArray(value)?value.join('\n'):String(value)}]));
 try{return action();}finally{({current,chat_metadata,chat,main_api,extension_prompts,power_user,selected_group,name1,name2}=previous);}
}
const variableFacade=key=>Object.fromEntries(['get','set','add','inc','dec','has','del'].map(method=>[method,(...args)=>current[key][method](...args)]));
export const SillyTavern={getContext:()=>({variables:{local:variableFacade('vars'),global:variableFacade('globalVars')}})};
export const getCurrentChatId=()=>current.chatId||'';
export const getMaxContextTokens=()=>Number(current.maxContext??0);
export const getMaxResponseTokens=()=>Number(current.maxTokens??0);
export const getMaxPromptTokens=()=>getMaxContextTokens()-getMaxResponseTokens();
export const getGroupNames=()=>current.fields?.groupMembers||String(current.fields?.groupName||'').split(',').map(x=>x.trim()).filter(Boolean);
export const isMobile=()=>current.mobile===true;
export const inject_ids={CUSTOM_WI_OUTLET:key=>'customWIOutlet_'+key};
export const textgenerationwebui_banned_in_macros=[];
export const document={querySelector(selector){if(selector==='#send_textarea')return {value:current.input??current.fields?.lastUserMessage??''};if(selector==='#chat .mes'&&current.firstDisplayedMessageId!=null)return {getAttribute:()=>String(current.firstDisplayedMessageId)};return null;}};
const report=(...values)=>{const message=values.filter(value=>typeof value==='string').join(' ');if(message)current.warnings?.push(message);};
export const diagnosticConsole={warn:report,error:report,debug(){},log(){}};
