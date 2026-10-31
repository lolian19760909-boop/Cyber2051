/** Native ST source oracles for macro/regex/prompt semantics. No network, model or player store. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {expandMacros,createVarStore,transformText,assemblePrompt,continuationPrefix,mergeRegexScripts} from '../src/app/prompt.mjs';
import {buildRequest} from '../src/models/adapters.mjs';
if(!vm.SourceTextModule){const child=spawnSync(process.execPath,['--experimental-vm-modules','--no-warnings',fileURLToPath(import.meta.url)],{stdio:'inherit'});process.exit(child.status??1);}
const web=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),st=path.resolve(web,'../.cache/debug223/host/app'),require=createRequire(path.join(st,'package.json')),acorn=require('acorn');
const read=file=>fs.readFileSync(path.join(st,file),'utf8'),sha=text=>createHash('sha256').update(text).digest('hex'),checks=[];
function declaration(file,names){const src=read(file),nodes=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'}).body.map(n=>n.declaration||n);return names.map(name=>{const node=nodes.find(n=>n.id?.name===name||n.declarations?.some(d=>d.id?.name===name));assert(node,'native symbol '+name);return src.slice(node.start,node.end);}).join('\n');}
function method(file,owner,names){const src=read(file),node=acorn.parse(src,{ecmaVersion:'latest',sourceType:'module'}).body.map(n=>n.declaration||n).find(n=>n.id?.name===owner);return names.map(name=>{const found=node.body.body.find(n=>n.key?.name===name);return name+':({'+src.slice(found.start,found.end)+'}).'+name;}).join(',\n');}
const sources=JSON.parse(fs.readFileSync(path.join(web,'src/app/native-prompt/SOURCE.json')));
for(const record of sources.files){assert.equal(sha(fs.readFileSync(path.join(web,'src/app/native-prompt',record.target))),record.sha256,record.target);if(fs.existsSync(path.join(st,record.source)))assert.equal(sha(read(record.source)),record.sourceSha256,record.source);}
checks.push('vendored source and dependency fingerprints match pinned provenance');
const log={warn(){},error(){},debug(){},log(){}},nativeMoment=require('moment'),nativeSeedrandom=require('seedrandom'),nativeDroll=require('droll'),chevrotain=await import(pathToFileURL(require.resolve('chevrotain')));
let current={fields:{},chatMetadata:{},local:{},global:{},history:[]};
const scope=vm.createContext({console:log,structuredClone,Math,Date,JSON,document:{querySelector:()=>null},chat_metadata:{},extension_settings:{variables:{global:{}},disabledExtensions:[]},saveMetadataDebounced(){},saveSettingsDebounced(){},SlashCommandClosure:class{},power_user:{instruct:{},sysprompt:{},context:{}},main_api:'openai',selected_group:null,name1:'Player',name2:'Character',getGroupNames:()=>[],getCurrentChatId:()=>current.chatId||'',tokenHandler:{countAsync:async()=>0},character_names_behavior:{NONE:-1,DEFAULT:0,COMPLETION:1,CONTENT:2},extension_prompt_roles:{SYSTEM:0,USER:1,ASSISTANT:2},extension_prompt_types:{NONE:-1,IN_PROMPT:0,IN_CHAT:1,BEFORE_PROMPT:2},persona_description_positions:{IN_PROMPT:0},INJECTION_POSITION:{RELATIVE:0,ABSOLUTE:1},DEFAULT_ORDER:100,ToolManager:{canPerformToolCalls:()=>false,isToolCallingSupported:()=>false},isImageInliningSupported:()=>false,isVideoInliningSupported:()=>false,isAudioInliningSupported:()=>false,isReasoningSignatureSupported:()=>false,interleaved_reasoning_providers:[],tool_reasoning_modes:{DISABLED:'disabled'},TokenBudgetExceededError:Error,IdentifierNotFoundError:Error});
vm.runInContext(declaration('public/scripts/utils.js',['getStringHash','isTrueBoolean','isFalseBoolean','convertValueType','regexFromString','stringFormat']),scope);
scope.chat_completion_sources={CLAUDE:'claude'};
const variableNames=['getLocalVariable','setLocalVariable','addLocalVariable','incrementLocalVariable','decrementLocalVariable','existsLocalVariable','deleteLocalVariable','getGlobalVariable','setGlobalVariable','addGlobalVariable','incrementGlobalVariable','decrementGlobalVariable','existsGlobalVariable','deleteGlobalVariable'];
vm.runInContext(declaration('public/scripts/variables.js',variableNames),scope);
scope.SillyTavern={getContext:()=>({variables:Object.fromEntries(['local','global'].map(kind=>[kind,Object.fromEntries(Object.entries({get:'get',set:'set',add:'add',inc:'increment',dec:'decrement',has:'exists',del:'delete'}).map(([method,prefix])=>[method,(...args)=>scope[prefix+kind[0].toUpperCase()+kind.slice(1)+'Variable'](...args)]))]))})};
let engine;
const envFor=(text,fields={})=>({content:text,contentHash:scope.getStringHash(text),names:{user:fields.userName||'旅行者',char:fields.charName||'',group:fields.groupName||fields.charName||'',groupNotMuted:fields.groupName||fields.charName||'',notChar:fields.userName||'旅行者'},character:{description:fields.charDescription||'',personality:fields.charPersonality||'',scenario:fields.scenario||'',persona:fields.personaDescription||'',charPrompt:fields.systemPrompt||'',charInstruction:fields.postHistoryInstructions||'',mesExamplesRaw:fields.dialogueExamples||''},system:{model:''},functions:{original:()=>fields.original||'',postProcess:value=>value},dynamicMacros:{},extra:{}});
function nativeExpand(text,fields=current.fields,dynamic={}){const env=envFor(String(text??''),fields);env.dynamicMacros=Object.fromEntries(Object.entries(dynamic).map(([k,v])=>[k.toLowerCase(),v]));return engine.evaluate(String(text??''),env);}
scope.substituteParams=(text,override={})=>nativeExpand(text,{...current.fields,...(override.original!==undefined?{original:override.original}:{})});
scope.substituteParamsExtended=(text,extra={},postProcess)=>{const env=envFor(String(text??''),current.fields);env.dynamicMacros=Object.fromEntries(Object.entries(extra).map(([k,v])=>[k.toLowerCase(),v]));env.functions.postProcess=postProcess||((value)=>value);return engine.evaluate(String(text??''),env);};
vm.runInContext(declaration('public/script.js',['parseMesExamples'])+'\n'+declaration('public/scripts/openai.js',['parseExampleIntoIndividual'])+'\n'+declaration('public/scripts/instruct-mode.js',['names_behavior_types','formatInstructModeExamples']),scope);
const modules=new Map(),synthetic=(name,exports)=>{const module=new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context:scope,identifier:name});modules.set(name,module);return module;};
const scriptName=path.join(st,'public/script.js'),powerName=path.join(st,'public/scripts/power-user.js');
const scriptModule=synthetic(scriptName,{chat_metadata:scope.chat_metadata,chat:[],main_api:'openai',getMaxPromptTokens:()=>10000,getMaxContextTokens:()=>12000,getMaxResponseTokens:()=>2000,extension_prompts:{},getCurrentChatId:()=>current.chatId||'',parseMesExamples:scope.parseMesExamples});
const powerModule=synthetic(powerName,{power_user:scope.power_user});
synthetic(path.join(st,'public/lib.js'),{chevrotain,seedrandom:(seed,options)=>options?.entropy&&current.random?current.random:nativeSeedrandom(seed,options),droll:nativeDroll,moment:nativeMoment});
synthetic(path.join(st,'public/scripts/utils.js'),{getStringHash:scope.getStringHash,isTrueBoolean:scope.isTrueBoolean,isFalseBoolean:scope.isFalseBoolean,timestampToMoment:value=>nativeMoment(value)});
synthetic(path.join(st,'public/scripts/RossAscends-mods.js'),{isMobile:()=>false});
synthetic(path.join(st,'public/scripts/instruct-mode.js'),{formatInstructModeExamples:scope.formatInstructModeExamples});
synthetic(path.join(st,'public/scripts/textgen-settings.js'),{textgenerationwebui_banned_in_macros:[]});
synthetic(path.join(st,'public/scripts/constants.js'),{inject_ids:{CUSTOM_WI_OUTLET:key=>'customWIOutlet_'+key}});
const diagnostics=['createMacroRuntimeError','logMacroGeneralError','logMacroInternalError','logMacroRuntimeWarning','logMacroSyntaxWarning','logMacroRegisterError','logMacroRegisterWarning'];
synthetic(path.join(st,'public/scripts/macros/engine/MacroDiagnostics.js'),Object.fromEntries(diagnostics.map(name=>[name,name==='createMacroRuntimeError'?({message})=>Object.assign(new Error(message),{isMacroRuntimeError:true}):()=>{}])));
function load(file){file=path.normalize(file);if(modules.has(file))return modules.get(file);const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context:scope,identifier:file});modules.set(file,mod);return mod;}
const linker=(specifier,parent)=>load(specifier.startsWith('/')?path.join(st,'public',specifier):path.resolve(path.dirname(parent.identifier),specifier));
async function evaluate(file){const mod=load(path.join(st,file));if(mod.status==='unlinked')await mod.link(linker);if(mod.status==='linked')await mod.evaluate();return mod.namespace;}
engine=(await evaluate('public/scripts/macros/engine/MacroEngine.js')).MacroEngine;
for(const [group,name]of [['core','Core'],['env','Env'],['chat','Chat'],['time','Time'],['variable','Variable'],['instruct','Instruct']]){const mod=await evaluate('public/scripts/macros/definitions/'+group+'-macros.js');mod['register'+name+'Macros']();}
function reset(context={}){current={fields:{userName:'Player',charName:'Character',...context.fields},chatMetadata:structuredClone(context.chatMetadata||{}),local:structuredClone(context.local||{}),global:structuredClone(context.global||{}),history:context.history||[],chatId:context.chatId||'fixture',random:context.random};scope.chat_metadata={...current.chatMetadata,variables:current.local};scope.extension_settings.variables.global=current.global;scope.name1=current.fields.userName;scope.name2=current.fields.charName;scope.power_user={instruct:{},sysprompt:{},context:{},persona_description:current.fields.personaDescription||'',persona_description_position:0};scriptModule.setExport('chat_metadata',scope.chat_metadata);scriptModule.setExport('chat',current.history.map(row=>({mes:row.content,is_user:row.role==='user',is_system:row.role==='system'})));powerModule.setExport('power_user',scope.power_user);}
const macroCases=[
 ['legacy names','<USER>/<BOT>/<CHAR>/<GROUP>/<CHARIFNOTGROUP>'],
 ['nested variables','{{setvar::name::{{user}}}}{{getvar::name}}'],
 ['newline trim','A \t\n{{trim}}\n \tB'],
 ['scoped trim','{{trim}}\n  hello  \n{{/trim}}'],
 ['if lazy branches','{{setvar::n::0}}{{if false}}{{incvar::n}}{{else}}NO{{/if}}:{{getvar::n}}'],
 ['if nested','{{if true}}yes{{if false}}wrong{{else}}inner{{/if}}{{else}}wrong{{/if}}'],
 ['variable shorthand','{{setvar::x::2}}{{.x}}|{{setglobalvar::y::3}}{{$y}}'],
 ['global scope','{{setglobalvar::n::4}}{{incglobalvar::n}}/{{getglobalvar::n}}'],
 ['object value','{{setvarkey::obj::key::value}}{{getvarkey::obj::key}}'],
 ['array add','{{setvar::list::[1]}}{{addvar::list::two}}{{getvar::list}}'],
 ['space/newline','A{{space::2}}B{{newline::2}}C'],
 ['stable pick','{{pick::a::b::c}}/{{pick::a::b::c}}'],
 ['unknown preserved','{{future_unknown::x}}'],
 ['macro field inserted once','{{user}}',{fields:{userName:'{{setvar::injected::YES}}'}}],
];
for(const [name,text,options={}]of macroCases){reset(options);const vars=createVarStore(options.local),globalVars=createVarStore(options.global);const expected=nativeExpand(text),actual=expandMacros(text,{...options,fields:current.fields,chatId:current.chatId,vars,globalVars,chatMetadata:structuredClone(options.chatMetadata||{})});assert.equal(actual.text,expected,name);assert.deepEqual(vars.snapshot(),JSON.parse(JSON.stringify(scope.chat_metadata.variables)),name+' local');assert.deepEqual(globalVars.snapshot(),JSON.parse(JSON.stringify(scope.extension_settings.variables.global)),name+' global');checks.push(name);}
const stableA=expandMacros('{{pick::a::b::c}}',{chatId:'stable',random:()=>0}).text,stableB=expandMacros('{{pick::a::b::c}}',{chatId:'stable',random:()=>.999}).text;assert.equal(stableA,stableB);checks.push('pick is stable across injected random changes');
const persisted=createVarStore();expandMacros('{{setvar::n::7}}',{vars:persisted});const restored=createVarStore().restore(persisted.snapshot());assert.equal(expandMacros('{{incvar::n}}',{vars:restored}).text,'8');assert.equal(restored.get('n'),8);checks.push('local store snapshot and restore preserve native values');
const regexSymbols=['substitute_find_regex','RegexProvider','sanitizeRegexMacro','getRegexedString','runRegexScript','filterString'];scope.getRegexScripts=()=>current.regex;vm.runInContext(declaration('public/scripts/extensions/regex/engine.js',regexSymbols),scope);
for(const [name,text,rule,depth]of [['captured macro','{{user}}',{findRegex:'/(.*)/',replaceString:'$1'},null],['replacement per match','aa',{findRegex:'/a/g',replaceString:'{{incvar::n}}'},null],['no-depth rule','BODY',{findRegex:'/BODY/g',replaceString:'MATCH',minDepth:1},null],['numbered and named capture','ab',{findRegex:'/(?<first>a)(b)/g',replaceString:'$0/$1/$2/$<first>'},2]]){reset();const script={placement:[2],promptOnly:true,trimStrings:[],...rule};current.regex=[script];const expected=scope.getRegexedString(text,2,{isPrompt:true,depth}),actual=transformText(text,{preset:{regex_scripts:[script]},depth,context:{vars:createVarStore(),fields:current.fields}});assert.equal(actual,expected,name);checks.push('regex '+name);}
assert.deepEqual(mergeRegexScripts({global:[1],preset:[2],card:[3]}),[1,2,3]);checks.push('regex global/preset/card order');
// Execute the original PromptManager methods and OpenAI assembly functions with zero token cost.
vm.runInContext(declaration('public/scripts/PromptManager.js',['Prompt','PromptCollection'])+'\n'+declaration('public/scripts/openai.js',['Message','MessageCollection','ChatCompletion','formatWorldInfo','getPromptPosition','getPromptRole','preparePromptsForChatCompletion','populationInjectionPrompts','populateChatHistory','populateDialogueExamples','populateChatCompletion']),scope);
const nativeDefaultNames=['impersonation_prompt','new_chat_prompt','new_group_chat_prompt','new_example_chat_prompt','continue_nudge_prompt','scenario_format','personality_format','group_nudge_prompt'];vm.runInContext(declaration('public/scripts/openai.js',nativeDefaultNames.map(name=>'default_'+name))+'\nthis.nativePromptDefaults={'+nativeDefaultNames.map(name=>name+':default_'+name).join(',')+"};",scope);
vm.runInContext('this.promptManager={'+method('public/scripts/PromptManager.js','PromptManager',['preparePrompt','getPromptCollection','shouldTrigger','isPromptDisabledForActiveCharacter'])+'};',scope);
const barePrompts=[{identifier:'main',content:'MAIN',role:'system',system_prompt:true},...['worldInfoBefore','worldInfoAfter','charDescription','charPersonality','scenario','personaDescription','dialogueExamples','chatHistory'].map(identifier=>({identifier,marker:true,role:'system',system_prompt:true})),{identifier:'tail',content:'TAIL',role:'user',system_prompt:false},{identifier:'jailbreak',content:'JB',role:'system',system_prompt:true}];
const presetFor=patch=>({new_chat_prompt:'',new_example_chat_prompt:'[Example Chat]',wi_format:'{0}',scenario_format:'{{scenario}}',personality_format:'{{personality}}',continue_nudge_prompt:'CONTINUE {{lastChatMessage}}',continue_postfix:' ',names_behavior:-1,prompts:structuredClone(barePrompts),prompt_order:[{character_id:100001,order:barePrompts.map(row=>({identifier:row.identifier,enabled:true}))}],...patch});
async function nativePrompt(input){reset({fields:input.supplies,history:input.history});scope.oai_settings={...scope.nativePromptDefaults,...input.preset,chat_completion_source:input.chatCompletionSource||'deepseek'};scope.promptManager.serviceSettings=scope.oai_settings;scope.promptManager.getPromptOrderForCharacter=()=>input.preset.prompt_order[0].order;scope.promptManager.getPromptById=id=>input.preset.prompts.find(row=>row.identifier===id);scope.promptManager.getPromptOrderEntry=(_,id)=>input.preset.prompt_order[0].order.find(row=>row.identifier===id);scope.promptManager.getActiveGroupCharacters=()=>[];scope.promptManager.log=()=>{};scope.promptManager.isValidName=()=>true;scope.promptManager.sanitizeName=value=>value;
 const ext={};const note=input.authorNote,userCount=input.userMessageCount??input.history.filter(row=>row.role==='user').length;if(note&&note.enabled!==false&&(note.interval===1||userCount>0&&userCount%(note.interval??1)===0))ext['2_floating_prompt']={value:note.content,position:note.position??1,depth:note.depth??4,role:0};
 const injections=[...(input.injections||[])];if(ext['2_floating_prompt']?.position===1)injections.push({role:'system',depth:note.depth??4,content:note.content});scope.getExtensionPromptMaxDepth=()=>Math.max(0,...injections.map(row=>row.depth),...input.preset.prompts.map(row=>row.injection_depth||0));scope.getExtensionPrompt=async(_,depth,separator,role)=>injections.filter(row=>row.depth===depth&&['system','user','assistant'][role]===(row.role||'system')).map(row=>row.content).join(separator);
 const supplies=input.supplies||{},prompts=await scope.preparePromptsForChatCompletion({...supplies,name2:supplies.charName,extensionPrompts:ext,systemPromptOverride:input.systemPromptOverride,jailbreakPromptOverride:input.jailbreakPromptOverride,type:input.generationType||'normal'});
 const examples=scope.parseMesExamples(supplies.dialogueExamples||'',false).map(block=>scope.parseExampleIntoIndividual(block));const completion=vm.runInContext('new ChatCompletion()',scope);completion.setTokenBudget(10000000,0);await scope.populateChatCompletion(prompts,completion,{type:input.generationType||'normal',cyclePrompt:(input.history.at(-1)?.content||'')+(input.preset.continue_postfix||''),messages:structuredClone(input.history).reverse(),messageExamples:examples});if(input.preset.squash_system_messages)await completion.squashSystemMessages();return JSON.parse(JSON.stringify(completion.getChat()));}
const history=[{role:'user',content:'QUESTION'},{role:'assistant',content:'PARTIAL'}],supplies={userName:'Player',charName:'Character'};
const promptCases=[
 ['normal fields',{preset:presetFor({}),history,supplies}],
 ['continue prefill',{preset:presetFor({continue_prefill:true}),history,supplies,generationType:'continue',injections:[{role:'system',depth:0,content:'DEPTH'}]}],
 ['continue nudge',{preset:presetFor({continue_prefill:false}),history,supplies,generationType:'continue',injections:[{role:'system',depth:0,content:'DEPTH'}]}],
 ['continue empty nudge',{preset:presetFor({continue_prefill:false,continue_nudge_prompt:''}),history,supplies,generationType:'continue'}],
 ['Claude continue prefill',{preset:presetFor({continue_prefill:true,assistant_prefill:'PREFILL'}),history,supplies,generationType:'continue',chatCompletionSource:'claude'}],
 ['format fields',{preset:presetFor({wi_format:'WI[{0}]',personality_format:'P[{{personality}}]',scenario_format:'S[{{scenario}}]'}),history,supplies:{...supplies,worldInfoBefore:'BOOK',charPersonality:'PERSONALITY',scenario:'SCENE'}}],
 ['character overrides',{preset:presetFor({}),history,supplies,systemPromptOverride:'OVERRIDE {{original}}',jailbreakPromptOverride:'PHI {{original}}'}],
 ['forbid override',{preset:presetFor({prompts:barePrompts.map(row=>({...row,forbid_overrides:true}))}),history,supplies,systemPromptOverride:'SHOULD_NOT_REPLACE'}],
 ['new chat and empty input',{preset:presetFor({new_chat_prompt:'NEW',send_if_empty:'EMPTY'}),history,supplies}],
 ['relative note before',{preset:presetFor({}),history,supplies,authorNote:{content:'NOTE',position:2,interval:1}}],
 ['relative note after',{preset:presetFor({}),history,supplies,authorNote:{content:'NOTE',position:0,interval:1}}],
 ['full user count note',{preset:presetFor({}),history,supplies,userMessageCount:2,authorNote:{content:'NOTE',depth:0,interval:2}}],
 ['system squash',{preset:presetFor({squash_system_messages:true}),history,supplies:{...supplies,worldInfoBefore:'BOOK'}}],
 ['examples include explicit empty block',{preset:presetFor({}),history,supplies:{...supplies,dialogueExamples:'<START>\nPlayer: Q1\nCharacter: A1\n<START>\n<START>\nPlayer: Q2\nCharacter: A2'}}],
 ['prepared worldbook still passes PromptManager macros',{preset:presetFor({}),history,supplies:{...supplies,worldInfoBefore:'{{incvar::n}}'},expandedSupplies:['worldInfoBefore']}],
 ['history macros evaluate newest first',{preset:presetFor({}),history:[{role:'user',content:'{{incvar::n}}'},{role:'assistant',content:'{{incvar::n}}'}],supplies}],
];
for(const [name,input]of promptCases){const expected=await nativePrompt(input),actual=assemblePrompt(input).messages.map(({injected,...row})=>row);assert.deepEqual(actual,expected,name);checks.push('assembly '+name);}
assert.deepEqual(continuationPrefix('part',{continue_postfix:' '}),{prefix:'part ',postfix:' '});assert.deepEqual(continuationPrefix('part ',{continue_postfix:'\n'}),{prefix:'part ',postfix:''});checks.push('continuation postfix matches script.js saved-prefix condition');
const customMarker={new_chat_prompt:'',prompts:[{identifier:'analysisPrefix',marker:true},{identifier:'chatHistory',marker:true}],prompt_order:[{order:[{identifier:'analysisPrefix',enabled:true},{identifier:'chatHistory',enabled:true}]}]};assert.equal(assemblePrompt({preset:customMarker,supplies:{analysisPrefix:'ANALYZE'},expandedSupplies:['analysisPrefix'],history:[{role:'user',content:'BODY'}]}).messages[0].content,'ANALYZE');checks.push('application analysis marker contract remains wired');
// Cross the real native frontend parameter builder and full Claude backend with a memory fetch.
const constants=await import('data:text/javascript;base64,'+Buffer.from(read('src/constants.js')).toString('base64'));
const converterSource=read('src/prompt-converters.js').replace("import { getConfigValue, tryParse } from './util.js';",'const getConfigValue=(key,fallback)=>fallback;const tryParse=text=>{try{return JSON.parse(text);}catch{return null;}};');
const converters=await import('data:text/javascript;base64,'+Buffer.from(converterSource).toString('base64'));
Object.assign(scope,{chat_completion_sources:constants.CHAT_COMPLETION_SOURCES,model_list:[],openai_max_stop_strings:4,verbosity_levels:{auto:'auto'},reasoning_effort_types:{auto:'auto',min:'min',low:'low',medium:'medium',high:'high',max:'max'},getCustomStoppingStrings:()=>[],getCurrentChatId:()=>current.chatId,biasCache:null,calculateLogitBias:()=>({}),validateReverseProxy(){},clamp:(value,min,max)=>Math.max(min,Math.min(max,value))});
vm.runInContext(declaration('public/scripts/openai.js',['getReasoningEffort','getVerbosity','createGenerationParameters']),scope);
async function nativeClaude(payload){
 let captured;const nativeErrors=[];
 const sandbox={...constants,...converters,structuredClone,URL,AbortController,Response,process:{stdout:{columns:80}},console:{debug(){},warn(){},info(){},error:(...args)=>nativeErrors.push(args.map(String).join(' '))},getConfigValue:(key,fallback)=>fallback,readSecret:()=> 'SYNTHETIC_NOT_A_KEY',SECRET_KEYS:{CLAUDE:'claude'},API_CLAUDE:'https://fixture.invalid',cacheTTL:'5m',enableSystemPromptCache:false,cachingAtDepth:-1,enableAdaptiveThinking:true,color:{red:x=>x,yellow:x=>x,blue:x=>x},forwardFetchResponse:async()=>{},fetch:async(_url,options)=>{captured=JSON.parse(options.body);return new Response(JSON.stringify({content:[{type:'text',text:'fixture'}]}),{status:200,headers:{'content-type':'application/json'}});}};
 const handler=vm.runInNewContext('('+declaration('src/endpoints/backends/chat-completions.js',['sendClaudeRequest'])+')',sandbox);
 await handler({body:structuredClone(payload),socket:{removeAllListeners(){},on(){}},user:{directories:{}}},{status(){return this;},send(){return this;},json(){return this;}});
 assert(captured,'native Claude did not capture request: '+nativeErrors.join(';'));return captured;
}
for(const [type,prefill,model]of [['normal',false,'claude-3-5-sonnet-latest'],['impersonate',false,'claude-3-5-sonnet-latest'],['quiet',false,'claude-3-5-sonnet-latest'],['continue',true,'claude-3-5-sonnet-latest'],['continue',true,'claude-opus-4-6'],['normal',false,'claude-opus-4-6']]){
 const preset=presetFor({continue_prefill:prefill,assistant_prefill:'PREFILL {{getvar::mode}} {{incglobalvar::prefillCounter}} {{user}}',assistant_impersonation:'IMPERSONATE {{incglobalvar::impersonateCounter}} {{user}}'});preset.prompts[0].content='MAIN {{setvar::mode::READY}}';
 const input={preset,history,supplies,generationType:type,chatCompletionSource:'claude'};
 const nativeMessages=await nativePrompt(input);
 const settings={...preset,chat_completion_source:'claude',temp_openai:1,top_p_openai:.98,top_k_openai:0,freq_pen_openai:0,pres_pen_openai:0,openai_max_tokens:4096,stream_openai:false,show_thoughts:false,reasoning_effort:'auto',verbosity:'auto',seed:-1,n:1,use_sysprompt:true};
 scope.oai_settings=settings;scope.getChatCompletionModel=()=>model;
 const nativeParameters=(await scope.createGenerationParameters(settings,model,type,nativeMessages)).generate_data;
 const expected=await nativeClaude(nativeParameters),expectedGlobals=structuredClone(scope.extension_settings.variables.global);
 const globals=createVarStore(),assembled=assemblePrompt({...input,globalVars:globals,vars:createVarStore()});
 const payload={model,messages:assembled.messages,presetSettings:preset,...assembled.providerSettings,names:{userName:'Player',charName:'Character'},temperature:1,top_p:.98,top_k:0,max_tokens:4096,stream:false,include_reasoning:false,reasoning_effort:'auto',verbosity:'auto',use_sysprompt:true};
 const actual=JSON.parse(buildRequest({operation:'chat',adapter:'chat:claude',baseUrl:'https://fixture.invalid',credential:'SYNTHETIC_NOT_A_KEY',payload}).body);
 assert.deepEqual(actual,expected,'Claude prefill full chain '+type+' '+model);assert.deepEqual(globals.snapshot(),expectedGlobals,'prefill macros execute only once and only on the used field');
 if(type==='quiet')assert.deepEqual(globals.snapshot(),{});else if(type==='impersonate')assert.equal(globals.get('impersonateCounter'),1);else assert.equal(globals.get('prefillCounter'),1);
 if(model==='claude-opus-4-6')assert.equal(actual.messages.at(-1).role,'user','native backend, not prompt assembly, changes prohibited assistant prefill role');
 checks.push('Claude frontend+backend prefill '+type+' '+model);
}
for(const generationType of ['normal','quiet']){
 const preset=presetFor({impersonation_prompt:'',group_nudge_prompt:'',custom_include_body:'extra: "{{getvar::mode}}-{{incglobalvar::customCounter}}"\nliteral: "{{user}}"',custom_exclude_body:'{{setglobalvar::excluded::yes}}[temperature]',custom_include_headers:'X-Counter: "{{incglobalvar::customCounter}}"'});preset.prompts[0].content='MAIN {{setvar::mode::READY}}';
 const input={preset,history,supplies:{...supplies,userName:'{{incglobalvar::literal}}'},generationType,chatCompletionSource:'custom'},nativeMessages=await nativePrompt(input),settings={...preset,chat_completion_source:'custom',temp_openai:1,top_p_openai:1,top_k_openai:0,freq_pen_openai:0,pres_pen_openai:0,openai_max_tokens:4096,stream_openai:false,show_thoughts:false,reasoning_effort:'auto',verbosity:'auto',seed:-1,n:1};scope.oai_settings=settings;scope.getChatCompletionModel=()=> 'fixture';
 const expected=(await scope.createGenerationParameters(settings,'fixture',generationType,nativeMessages)).generate_data,expectedGlobals=structuredClone(scope.extension_settings.variables.global),globals=createVarStore(),actual=assemblePrompt({...input,vars:createVarStore(),globalVars:globals});
 for(const field of ['custom_include_body','custom_exclude_body','custom_include_headers'])assert.equal(actual.providerSettings[field],expected[field],field+' '+generationType);
 assert.deepEqual(globals.snapshot(),expectedGlobals);assert.equal(globals.get('customCounter'),2);assert.equal(globals.get('literal'),'');
 const request=buildRequest({operation:'chat',adapter:'chat:custom',baseUrl:'https://fixture.invalid',payload:{model:'fixture',messages:actual.messages,presetSettings:preset,...actual.providerSettings,temperature:1,max_tokens:4096,stream:false}}),body=JSON.parse(request.body);
 assert.equal(body.extra,'READY-1');assert.equal(body.literal,'{{incglobalvar::literal}}');assert.equal(body.temperature,undefined);assert.equal(request.headers['X-Counter'],'2');checks.push('custom request macros and literal preservation '+generationType);
}
console.log(JSON.stringify({ok:true,checks:checks.length,details:checks,sourceVersion:'SillyTavern 1.19.0, experimentalMacroEngine=true',realSupplierRequests:0,scope:'Original macro ESM modules in a separate VM; original regex functions and PromptManager/OpenAI assembly functions; explicit host/token seams. No website macro helper is used as the native oracle.'},null,2));
