/** Vendor the pinned ST scanner. Browser ports are synchronous; no scan rule is reimplemented. */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const WEB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ST=path.resolve(WEB,'../.cache/debug223/host/app');
const require=createRequire(path.join(ST,'package.json')),{parse}=require('acorn');
const source=fs.readFileSync(path.join(ST,'public/scripts/world-info.js'),'utf8');
const sha=text=>createHash('sha256').update(text).digest('hex');
const expected='c42d11f113b53b93bf03786ac5c1190be3cad5152f23805906fce5ebd12fb416';
if(sha(source)!==expected)throw Error('ST world-info source changed; review the upstream delta before regenerating');
const nodes=parse(source,{ecmaVersion:'latest',sourceType:'module'}).body.map(n=>n.declaration||n);
const edits=[];
function walk(node){
 if(!node?.type)return;
 if(node.type==='AwaitExpression')edits.push([node.start,node.argument.start,'']);
 if(node.async){const prefix=source.slice(node.start,node.body?.start??node.end),offset=prefix.indexOf('async');if(offset>=0)edits.push([node.start+offset,node.start+offset+5,'']);}
 if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name==='Promise'&&node.callee.property.name==='all')edits.push([node.start,node.callee.end,'syncAll']);
 for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)walk(child);}else if(value?.type)walk(value);
}
const names=['world_info_insertion_strategy','world_info_logic','scan_state','world_info_depth','world_info_min_activations','world_info_min_activations_depth_max','world_info_budget','world_info_recursive','world_info_overflow_alert','world_info_case_sensitive','world_info_match_whole_words','world_info_use_group_scoring','world_info_character_strategy','world_info_budget_cap','world_info_max_recursion_steps','DEFAULT_DEPTH','DEFAULT_WEIGHT','MAX_SCAN_DEPTH','KNOWN_DECORATORS','defaultGlobalScanData','world_info_position','wi_anchor_position','sortFn','parseRegexFromString','WorldInfoBuffer','WorldInfoTimedEffects','filterGroupsByScoring','filterGroupsByTimedEffects','filterByInclusionGroups','newWorldInfoEntryDefinition','newWorldInfoEntryTemplate','convertCharacterBook','parseDecorators','getSortedEntries','checkWorldInfo'];
const selected=names.map(name=>{const node=nodes.find(n=>n.id?.name===name||n.declarations?.some(d=>d.id.name===name));if(!node)throw Error('Missing upstream symbol '+name);walk(node);return {name,node};});
function emit(node){let text=source.slice(node.start,node.end);for(const[a,b,replacement]of edits.filter(([a,b])=>a>=node.start&&b<=node.end).sort((a,b)=>b[0]-a[0]))text=text.slice(0,a-node.start)+replacement+text.slice(b-node.start);return text;}
const utils=fs.readFileSync(path.join(ST,'public/scripts/utils.js'),'utf8'),utilsNodes=parse(utils,{ecmaVersion:'latest',sourceType:'module'}).body.map(n=>n.declaration||n),utilityNames=['getStringHash','escapeRegex'];
const imports=`// Generated from SillyTavern 1.19.0 (AGPL-3.0). See provenance.json and LICENSE.
// Source rules are preserved. async/await and Promise.all are made synchronous because
// lore loading, tokenizer and extension callbacks here are in-memory application ports.
export function createNativeWorldInfo(ports={}) {
const console=ports.console||{debug(){},log(){},warn(){},error(){}};
const Math=Object.assign(Object.create(globalThis.Math),{random:ports.random||globalThis.Math.random});
const chat_metadata=ports.metadata||{},settings=ports.settings||{};
const getContext=()=>ports.context||{extensionPrompts:{},tagMap:{}};
const getGlobalLore=()=>ports.books?.global||[],getCharacterLore=()=>ports.books?.character||[],getChatLore=()=>ports.books?.chat||[],getPersonaLore=()=>ports.books?.persona||[];
const syncAll=values=>values;
const getExtensionPromptByName=name=>ports.extensionPrompt?.(name)||getContext().extensionPrompts[name]?.value||'';
const substituteParams=text=>ports.expand?ports.expand(text):String(text??'');
const getTokenCountAsync=text=>ports.countTokens?ports.countTokens(text):Math.ceil(String(text).length/2);
const getRegexedString=(text,placement,options)=>ports.regex?ports.regex(text,placement,options):text;
const eventSource={emit:(type,args)=>ports.emit?.(type,args)},event_types={WORLDINFO_ENTRIES_LOADED:'worldinfo_entries_loaded',WORLDINFO_SCAN_DONE:'worldinfo_scan_done'};
const this_chid=ports.characterId||'character',getCharaFilename=()=>ports.characterName||'',getTagKeyForEntity=()=>ports.characterId||'character';
const extension_prompt_roles={SYSTEM:0,USER:1,ASSISTANT:2},regex_placement={WORLD_INFO:5};
const shouldWIAddPrompt=false;
const GENERATION_TYPE_TRIGGERS=['normal','continue','regenerate','swipe','impersonate','quiet'];
const toastr={warning:message=>ports.warn?.(message)};
${utilityNames.map(name=>{const node=utilsNodes.find(n=>n.id?.name===name);return utils.slice(node.start,node.end);}).join('\n')}
`;
const settings=names.filter(n=>n.startsWith('world_info_')&&!['world_info_insertion_strategy','world_info_logic','world_info_position'].includes(n));
const trailer=`
${settings.map(n=>`if(settings.${n}!==undefined)${n}=settings.${n};`).join('\n')}
if(ports.externalActivations)WorldInfoBuffer.externalActivations=new Map(ports.externalActivations);
return {checkWorldInfo,getSortedEntries,convertCharacterBook,metadata:chat_metadata,getStringHash};
}
`;
const output=imports+selected.map(({node})=>emit(node)).join('\n\n')+trailer;
const asyncOutput=imports.replace('createNativeWorldInfo(ports','createNativeWorldInfoAsync(ports')+selected.map(({node})=>source.slice(node.start,node.end)).join('\n\n')+trailer;
parse(output,{ecmaVersion:'latest',sourceType:'module'});
parse(asyncOutput,{ecmaVersion:'latest',sourceType:'module'});
const dest=path.join(WEB,'src/app/native-worldinfo');fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'engine.mjs'),output);
fs.writeFileSync(path.join(dest,'async-engine.mjs'),asyncOutput);
const licenseCandidates=[path.join(ST,'LICENSE'),'D:/SillyTavern/LICENSE'];const license=licenseCandidates.find(p=>fs.existsSync(p));if(!license)throw Error('SillyTavern LICENSE missing');fs.copyFileSync(license,path.join(dest,'LICENSE'));
const provenance={upstream:'https://github.com/SillyTavern/SillyTavern',version:'1.19.0',source:'public/scripts/world-info.js',sourceSha256:sha(source),utilsSha256:sha(utils),symbols:names,adaptations:['Synchronous in-memory entry removes async/await and replaces Promise.all with identity aggregation; async entry preserves upstream awaits for remote tokenizers','Chat settings/metadata, macro expansion, regex, token count and events supplied per evaluation; no global application state','UI logging is optional; Author Note arrays are returned for the application PromptManager to consume'],outputSha256:sha(output),asyncOutputSha256:sha(asyncOutput)};
fs.writeFileSync(path.join(dest,'provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({symbols:names.length,bytes:Buffer.byteLength(output),sha256:provenance.outputSha256}));
