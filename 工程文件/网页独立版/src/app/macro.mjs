/** ST 1.19 macro parser/evaluator with application-owned chat variables and explicit host inputs. */
import {MacroEngine} from './native-prompt/engine/MacroEngine.mjs';
import {MacroRegistry,MacroCategory} from './native-prompt/engine/MacroRegistry.mjs';
import {registerCoreMacros} from './native-prompt/definitions/core-macros.mjs';
import {registerEnvMacros} from './native-prompt/definitions/env-macros.mjs';
import {registerChatMacros} from './native-prompt/definitions/chat-macros.mjs';
import {registerTimeMacros} from './native-prompt/definitions/time-macros.mjs';
import {registerVariableMacros} from './native-prompt/definitions/variable-macros.mjs';
import {registerInstructMacros} from './native-prompt/definitions/instruct-macros.mjs';
import {getStringHash} from './native-prompt/utils.mjs';
import {getMacroHost,setMacroEvaluator,withMacroHost} from './native-prompt/host.mjs';
import {createVarStore} from './native-prompt/variables.mjs';
import {PromptError} from './prompt-error.mjs';
export {createVarStore};
for(const register of [registerCoreMacros,registerEnvMacros,registerChatMacros,registerTimeMacros,registerVariableMacros,registerInstructMacros])register();
MacroRegistry.registerMacro('get_message_variable',{category:MacroCategory.VARIABLE,unnamedArgs:[{name:'path'}],handler:({unnamedArgs:[path]})=>{
 let value=getMacroHost().messageVariables||{};for(const key of String(path).split('.')){if(['__proto__','constructor','prototype'].includes(key)||value==null||!Object.hasOwn(value,key))return '';value=value[key];}return value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
}});
MacroRegistry.registerMacroAlias('deletevar','unsetvar');
export function expandMacros(input,context={}){
 const text=String(input??''),warnings=context.warnings||[],fields=context.fields||{};
 if(/<%[=-]?/.test(text))throw new PromptError('unsupported_template','当前维护源不含EJS；此模板需要先转换为明确的运行模块');
 const dynamicMacros={...context.dynamicMacros};
 for(const [name,key]of [['lastusermessage','lastUserMessage'],['lastcharmessage','lastCharMessage'],['lastmessage','lastMessage'],['lastchatmessage','lastChatMessage'],['useravatarpath','userAvatarPath']])if(Object.hasOwn(fields,key))dynamicMacros[name]=String(fields[key]??'');
 dynamicMacros.lastgenerationtype=String(context.generationType||'');
 dynamicMacros.hasextension={unnamedArgs:[{name:'name'}],handler:({unnamedArgs:[name]})=>String((context.extensions||[]).includes(name))};
 const env={content:text,contentHash:getStringHash(text),names:{user:fields.userName||'旅行者',char:fields.charName||'',group:fields.groupName||fields.charName||'',groupNotMuted:fields.groupNotMuted||fields.groupName||fields.charName||'',notChar:fields.notChar||fields.userName||'旅行者'},character:{description:fields.charDescription||'',personality:fields.charPersonality||'',scenario:fields.scenario||'',persona:fields.personaDescription||'',charPrompt:fields.systemPrompt||'',charInstruction:fields.postHistoryInstructions||'',mesExamplesRaw:fields.dialogueExamples||'',charDepthPrompt:fields.charDepthPrompt||fields.characterDepthPrompt||'',creatorNotes:fields.creatorNotes||'',version:fields.charVersion||'',firstMessage:fields.firstMessage||fields.firstMes||'',alternateGreetings:fields.alternateGreetings||[]},system:{model:fields.model||''},functions:{original:()=>fields.original||'',postProcess:context.transformMacro||((value)=>value)},dynamicMacros,extra:context.extra||{}};
 const value=withMacroHost({...context,warnings},()=>MacroEngine.evaluate(text,env));
 return {text:value,warnings:[...new Set(warnings)]};
}
setMacroEvaluator(expandMacros);
