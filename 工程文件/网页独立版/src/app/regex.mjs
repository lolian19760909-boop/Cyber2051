/** Native ST regex execution; display containers remain owned by the application's existing native views. */
import {getRegexedString} from './native-prompt/regex.mjs';
import {withMacroHost} from './native-prompt/host.mjs';
export const regexScripts=preset=>preset?.extensions?.regex_scripts||preset?.regex_scripts||[];
export function mergeRegexScripts({global=[],preset=[],card=[]}={}){return [...global,...(Array.isArray(preset)?preset:regexScripts(preset)),...(Array.isArray(card)?card:regexScripts(card?.data||card))];}
export function transformText(text,{preset,stage='prompt',placement=2,depth=null,context={},warnings=[],isEdit=false,characterOverride,containers='native-views'}={}){
 const scripts=regexScripts(preset).filter(script=>!(stage==='display'&&containers==='native-views'&&/<(?:!doctype|html|style|script|iframe|details|span)\b/i.test(script.replaceString||''))).map(script=>({...script,replaceString:script.replaceString??'',trimStrings:script.trimStrings||[]}));
 return withMacroHost({...context,warnings,regexScripts:scripts},()=>getRegexedString(String(text??''),placement,{isMarkdown:stage==='display',isPrompt:stage==='prompt',isEdit,depth,characterOverride}));
}
