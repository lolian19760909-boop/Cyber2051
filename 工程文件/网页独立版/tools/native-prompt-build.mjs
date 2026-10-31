/** Vendor the pinned ST 1.19 macro engine. Runtime host bindings live in native-prompt/host.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const st=path.resolve(web,'../.cache/debug223/host/app'),out=path.join(web,'src/app/native-prompt');
const require=createRequire(path.join(st,'package.json')),acorn=require('acorn'),records=[];
const hash=text=>createHash('sha256').update(text).digest('hex');
const read=file=>fs.readFileSync(path.join(st,file),'utf8');
function write(file,text,source){const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);if(source)records.push({source,target:file,sourceSha256:hash(read(source)),sha256:hash(text)});}
function declarations(file,names){const text=read(file),nodes=acorn.parse(text,{ecmaVersion:'latest',sourceType:'module'}).body.map(n=>n.declaration||n);return names.map(name=>{const n=nodes.find(n=>n.id?.name===name||n.declarations?.some(row=>row.id?.name===name));if(!n)throw Error('Pinned source symbol missing: '+name);return text.slice(n.start,n.end);}).join('\n\n');}
const note=file=>`// Derived from SillyTavern 1.19.0 ${file}; AGPL-3.0. See SOURCE.json and LICENSE.\n`;
for(const name of ['MacroEngine','MacroRegistry','MacroLexer','MacroParser','MacroCstWalker','MacroFlags']){
 const file=`public/scripts/macros/engine/${name}.js`;
 let text=read(file).replaceAll("'../../../lib.js'","'../libraries.mjs'").replaceAll("'/scripts/utils.js'","'../utils.mjs'").replaceAll("'../../utils.js'","'../utils.mjs'").replace(/(from\s+['"][^'"]+)\.js(['"])/g,'$1.mjs$2');
 if(name==='MacroCstWalker')text="import {SillyTavern} from '../host.mjs';\n"+text;
 write(`engine/${name}.mjs`,note(file)+text,file);
}
for(const name of ['core','env','chat','time','variable','instruct']){
 const file=`public/scripts/macros/definitions/${name}-macros.js`;
 let text=read(file).replaceAll("'../../../lib.js'","'../libraries.mjs'").replaceAll("'../../utils.js'","'../utils.mjs'");
 for(const source of ['../../../script.js','../../power-user.js','../../instruct-mode.js','../../RossAscends-mods.js','../../textgen-settings.js','../../constants.js'])text=text.replaceAll(`'${source}'`,"'../host.mjs'");
 text=text.replace(/(from\s+['"][^'"]+)\.js(['"])/g,'$1.mjs$2');
 if(['core','chat'].includes(name))text="import { document } from '../host.mjs';\n"+text;
 if(name==='variable')text="import { SillyTavern } from '../host.mjs';\n"+text;
 write(`definitions/${name}-macros.mjs`,note(file)+text,file);
}
const diagnostic='public/scripts/macros/engine/MacroDiagnostics.js';
write('engine/MacroDiagnostics.mjs',note(diagnostic)+"import {diagnosticConsole as console} from '../host.mjs';\n"+declarations(diagnostic,['createMacroRuntimeError','logMacroRuntimeWarning','logMacroInternalError','logMacroRegisterWarning','logMacroRegisterError','logMacroGeneralError','logMacroSyntaxWarning','buildMacroPayload','inferMacroName'])+'\nexport {createMacroRuntimeError,logMacroRuntimeWarning,logMacroInternalError,logMacroRegisterWarning,logMacroRegisterError,logMacroGeneralError,logMacroSyntaxWarning};\n',diagnostic);
const utils='public/scripts/utils.js';
write('utils.mjs',note(utils)+"import {moment} from './libraries.mjs';\nimport {getMacroHost} from './host.mjs';\nclass SlashCommandClosure {}\nconst dateCache=new Map();\nconst getCurrentLocale=()=>getMacroHost().locale||'en';\n"+declarations(utils,['getStringHash','isTrueBoolean','isFalseBoolean','convertValueType','regexFromString','timestampToMoment','parseTimestamp'])+'\nexport {getStringHash,isTrueBoolean,isFalseBoolean,convertValueType,regexFromString,timestampToMoment};\n',utils);
const variable='public/scripts/variables.js',variableNames=['getLocalVariable','setLocalVariable','addLocalVariable','incrementLocalVariable','decrementLocalVariable','existsLocalVariable','deleteLocalVariable'];
write('variables.mjs',note(variable)+"import {convertValueType} from './utils.mjs';\nexport function createVarStore(initial={}, {onChange}={}){\n let chat_metadata={variables:structuredClone(initial)};\n const saveMetadataDebounced=()=>onChange?.(structuredClone(chat_metadata.variables));\n"+declarations(variable,variableNames)+`\n return {get:getLocalVariable,set:setLocalVariable,add:addLocalVariable,inc:incrementLocalVariable,dec:decrementLocalVariable,has:existsLocalVariable,del:deleteLocalVariable,delete:deleteLocalVariable,snapshot:()=>structuredClone(chat_metadata.variables),restore(value={}){chat_metadata.variables=structuredClone(value);return this;},clear(){chat_metadata.variables={};saveMetadataDebounced();},reset(value={}){this.restore(value);saveMetadataDebounced();return this;}};\n}\n`,variable);
const script='public/script.js',instruct='public/scripts/instruct-mode.js',openai='public/scripts/openai.js';
const defaults=['impersonation_prompt','new_chat_prompt','new_group_chat_prompt','new_example_chat_prompt','continue_nudge_prompt','scenario_format','personality_format','group_nudge_prompt'];
write('preset-defaults.mjs',note(openai)+declarations(openai,defaults.map(name=>'default_'+name))+'\nexport const NATIVE_PROMPT_DEFAULTS={'+defaults.map(name=>name+':default_'+name).join(',')+",wi_format:'{0}'};\n",openai);
write('examples.mjs',note(script)+note(instruct)+note(openai)+"import {power_user,main_api,substituteParams,selected_group,getGroupNames,name1,name2} from './host.mjs';\n"+declarations(instruct,['names_behavior_types'])+'\n'+declarations(script,['parseMesExamples'])+'\n'+declarations(openai,['parseExampleIntoIndividual'])+'\n'+declarations(instruct,['formatInstructModeExamples'])+'\nexport {parseMesExamples,parseExampleIntoIndividual,formatInstructModeExamples};\n',script);
const regex='public/scripts/extensions/regex/engine.js';
write('regex.mjs',note(regex)+"import {regexFromString} from './utils.mjs';\nimport {substituteParams,substituteParamsExtended,getMacroHost,diagnosticConsole as console} from './host.mjs';\nconst extension_settings={disabledExtensions:[]};\nconst getRegexScripts=()=>getMacroHost().regexScripts||[];\n"+declarations(regex,['substitute_find_regex','RegexProvider','sanitizeRegexMacro','getRegexedString','runRegexScript','filterString'])+'\nexport {getRegexedString,runRegexScript};\n',regex);
for(const [name,source,license] of [['chevrotain','chevrotain/lib/chevrotain.min.mjs','chevrotain/LICENSE.txt'],['seedrandom','seedrandom/seedrandom.js',null],['droll','droll/droll.js','droll/LICENSE'],['moment','moment/min/moment.min.js','moment/LICENSE']]){
 const sourcePath='node_modules/'+source,raw=read(sourcePath);
 write(`dependencies/${name}.mjs`,name==='chevrotain'?raw:`// ${source}; original license retained alongside this module.\nconst module={exports:{}};const exports=module.exports;\n${raw}\nexport default module.exports;\n`,sourcePath);
 if(license)write(`dependencies/${name}.LICENSE`,read('node_modules/'+license),'node_modules/'+license);
 else write(`dependencies/${name}.LICENSE`,raw.slice(0,raw.indexOf('*/')+2)+'\n',sourcePath);
}
const licensePath=fs.existsSync(path.join(st,'LICENSE'))?path.join(st,'LICENSE'):path.join(path.dirname(fs.realpathSync(path.join(st,'node_modules'))),'LICENSE');
const licenseText=fs.readFileSync(licensePath,'utf8');write('LICENSE',licenseText);records.push({source:'SillyTavern/LICENSE',target:'LICENSE',sourceSha256:hash(licenseText),sha256:hash(licenseText)});
write('SOURCE.json',JSON.stringify({upstream:'https://github.com/SillyTavern/SillyTavern',version:JSON.parse(read('package.json')).version,license:'AGPL-3.0',adaptation:'Engine and macro definitions retain upstream function bodies. Imports bind to the application host; variables have an explicit store owner. Dependency UMD files have ESM wrappers. Regenerate with tools/native-prompt-build.mjs.',files:records},null,2)+'\n');
console.log(JSON.stringify({modules:records.length,bytes:records.reduce((n,row)=>n+fs.statSync(path.join(out,row.target)).size,0),upstream:'SillyTavern 1.19.0'}));
