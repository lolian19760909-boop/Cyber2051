/** Application ports around the pinned SillyTavern 1.19 World Info engine. */
import {expandMacros,transformText} from './prompt.mjs';
import {selectionSets} from '../context/agent.mjs';
import {createNativeWorldInfo} from './native-worldinfo/engine.mjs';
export function worldbookEntries(card){return (card?.data||card||{}).character_book?.entries||[];}
function chatForScan(history,fields={},includeNames=true){return history.slice().reverse().map(row=>(includeNames?(row.name||(row.role==='user'?fields.userName:fields.charName)||'')+': ':'')+String(row.content??row.message?.raw??''));}
export function worldInfoScan(history,fields={},includeNames=true){return chatForScan(history,fields,includeNames).map(text=>'\x01'+text).join('\n');}
function legacySignature(entry){let hash=2166136261;const text=JSON.stringify([entry.id,entry.content,entry.keys,entry.secondary_keys,entry.enabled,entry.extensions]);for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function effectMetadata(previous,entries,sorted){
 const state=structuredClone(previous||{sticky:{},cooldown:{}});if(!previous||previous.schema===2)return {timedWorldInfo:state};
 const migrated={sticky:{},cooldown:{}};
 for(const type of ['sticky','cooldown'])for(const [id,effect] of Object.entries(state[type]||{})){
  const entry=entries.find(row=>String(row.id)===id),native=entry&&sorted.find(row=>row.world===(entry.bookId||'card')&&String(row.uid)===String(entry.sourceEntryId??entry.id));
  if(native&&effect.hash===legacySignature(entry))migrated[type][native.world+'.'+native.uid]={...effect,hash:native.hash};
 }
 return {timedWorldInfo:migrated};
}
export function activateWorldInfo(input={}){
 const warnings=[],context=input.context||{},fields=context.fields||{},history=input.history||[];
 // Import/edit ports own validation. UID uniqueness is per book, never across all books.
 const entries=(input.entries||[]).map(entry=>{const uid=entry.sourceEntryId??entry.id,bookId=entry.bookId||'card';return {...entry,enabled:entry.enabled!==false,selective:entry.selective??true,keys:entry.keys||[],secondary_keys:entry.secondary_keys||[],insertion_order:entry.insertion_order??100,extensions:{position:entry.position==='after_char'?1:0,...entry.extensions},sourceEntryId:uid,bookId,id:bookId==='card'?uid:bookId+':'+uid};});
 const references=new Map(entries.map(entry=>[entry.bookId+':'+entry.sourceEntryId,String(entry.id)]));
 const plan=input.selection||{managedIds:[],selectedIds:[],requiredIds:[],removedIds:[],placements:[],bookChanges:[]};
 const {managed,selected,required,removed,placements,changes}=selectionSets(plan,(id,bookId)=>references.get(bookId?bookId+':'+id:String(id))??String(id));
 const settings={...(input.settings||{})};
 if(input.scanDepth!==undefined)settings.world_info_depth=input.scanDepth;
 if(input.recursion!==undefined)settings.world_info_recursive=input.recursion;
 if(input.groupScoring!==undefined)settings.world_info_use_group_scoring=input.groupScoring;
 let maximum=input.maxContext??2000000,countTokens=input.countTokens||((text)=>Math.ceil(text.length/2));
 if(Number.isFinite(input.budgetTokens)){maximum=input.budgetTokens;settings.world_info_budget=100;settings.world_info_budget_cap=0;}
 else if(Number.isFinite(input.budgetChars)){maximum=input.budgetChars;countTokens=text=>text.length;settings.world_info_budget=100;settings.world_info_budget_cap=0;}
 if(Number.isFinite(input.budgetTokens)&&Number.isFinite(input.budgetChars)){const tokens=countTokens,ratio=input.budgetTokens/Math.max(1,input.budgetChars);countTokens=input.engineFactory?async text=>Math.max(await tokens(text),text.length*ratio):text=>Math.max(tokens(text),text.length*ratio);}
 const books={global:[],character:[],chat:[],persona:[]},identity=new Map(),forced=new Set(),dropped=new Map(),importer=createNativeWorldInfo();
 for(const original of entries){
  const key=String(original.id),change=changes.get(key)||{},placement=placements.get(key)||{},entry=structuredClone(original);
  if(managed.has(key)&&(removed.has(key)||!selected.has(key)&&!required.has(key)))continue;
  if(change.enabled!==undefined)entry.enabled=change.enabled!==false;
  if(change.probability!==undefined){entry.extensions.probability=change.probability;entry.extensions.useProbability=true;}
  if(placement.position!==undefined)entry.extensions.position=placement.position;
  if(placement.depth!==undefined)entry.extensions.depth=placement.depth;
  if(placement.role!==undefined)entry.extensions.role=typeof placement.role==='string'?['system','user','assistant'].indexOf(placement.role):placement.role;
  if(managed.has(key)&&(selected.has(key)||required.has(key)))forced.add(entry.bookId+'.'+entry.sourceEntryId);
  if(required.has(key))entry.extensions.ignore_budget=true;
  entry.id=entry.sourceEntryId;
  entry.extensions.outlet_name=entry.extensions.outletName??entry.extensions.outlet_name;
  const converted=Object.values(importer.convertCharacterBook({entries:[entry]}).entries)[0];
  if(entry.characterFilter)converted.characterFilter=structuredClone(entry.characterFilter);
  converted.world=entry.bookId;
  const source=['global','character','chat','persona'].includes(entry.loreSource)?entry.loreSource:'character';
  books[source].push(converted);identity.set(converted.world+'.'+converted.uid,original);
 }
 const characterId=input.characterId||'character',host={extensionPrompts:input.extensionPrompts||{},tagMap:{[characterId]:input.characterTags||[]}};
 const ports={settings,books,random:input.random||Math.random,countTokens,context:host,characterId,characterName:input.characterName||fields.charName||'',
  expand:text=>expandMacros(text,{...context,warnings}).text,
  regex:(text,placement,options)=>input.preset?transformText(text,{preset:input.preset,stage:'prompt',placement,depth:options.depth,context,warnings}):text,
  warn:message=>warnings.push(message)};
 const sorted=createNativeWorldInfo(ports).getSortedEntries(),metadata=effectMetadata(input.timedEffects,entries,sorted);
 const externalActivations=sorted.filter(entry=>forced.has(entry.world+'.'+entry.uid)).map(entry=>[entry.world+'.'+entry.uid,entry]),attempted=new Set();
 const engine=(input.engineFactory||createNativeWorldInfo)({...ports,metadata,externalActivations,emit(type,args){
  if(type!=='worldinfo_scan_done')return;
  for(const entry of args.new.successful)attempted.add(entry.world+'.'+entry.uid);
  if(Number.isFinite(input.maxEntries)&&args.activated.entries.size>input.maxEntries)for(const [key,entry]of [...args.activated.entries].slice(input.maxEntries)){args.activated.entries.delete(key);dropped.set(key,{id:identity.get(key)?.id,comment:entry.comment,constant:entry.constant,reason:'entry_cap'});}
  return input.onScan?.(args);
 }});
 let chat=history.length?chatForScan(history,fields,settings.world_info_include_names!==false):String(input.scan||'').replace(/^\x01/,'').split('\n\x01').filter(Boolean);
 if(Number.isSafeInteger(input.messageCount)&&input.messageCount>chat.length)chat=chat.concat(Array(input.messageCount-chat.length).fill(''));
 const globals={trigger:input.generationType||'normal',personaDescription:fields.personaDescription||'',characterDescription:fields.charDescription||'',characterPersonality:fields.charPersonality||'',characterDepthPrompt:fields.characterDepthPrompt||'',scenario:fields.scenario||'',creatorNotes:fields.creatorNotes||'',...(input.globalScanData||{})};
 const finish=result=>{const activated=new Map([...result.allActivatedEntries].map(entry=>[entry.world+'.'+entry.uid,entry]));
 for(const key of attempted)if(!activated.has(key)&&!dropped.has(key)){const entry=identity.get(key);if(entry)dropped.set(key,{id:entry.id,comment:entry.comment,constant:entry.constant===true,reason:'budget'});}
 const used=[...activated].map(([key,native])=>({...identity.get(key),content:native.content,position:native.position,depth:native.depth??4,role:['system','user','assistant'][native.role??0]||'system'})).filter(entry=>entry.content.trim());
 const missing=[...managed].filter(id=>!entries.some(entry=>String(entry.id)===id));if(missing.length)warnings.push('选择方案有 '+missing.length+' 条目录未匹配（本轮跳过）');
 if(dropped.size)warnings.push('世界书 '+dropped.size+' 条未装入：'+[...dropped.values()].map(entry=>entry.comment||entry.id).join('、'));
 const effects={schema:2,...metadata.timedWorldInfo};
 return {before:result.worldInfoBefore,after:result.worldInfoAfter,injections:result.WIDepthEntries.map(row=>({role:['system','user','assistant'][row.role??0],depth:row.depth??4,order:100,content:row.entries.join('\n')})),anBefore:result.ANBeforeEntries,anAfter:result.ANAfterEntries,examplesBefore:result.EMEntries.filter(entry=>entry.position===0).map(entry=>entry.content),examplesAfter:result.EMEntries.filter(entry=>entry.position===1).map(entry=>entry.content),outlets:result.outletEntries,
  effects:entries.some(entry=>entry.extensions.sticky||entry.extensions.cooldown||entry.extensions.delay)||input.timedEffects?effects:undefined,
  used,dropped:[...dropped.values()],chars:used.reduce((sum,entry)=>sum+entry.content.length,0),tokens:input.engineFactory?undefined:countTokens(used.map(entry=>entry.content).join('\n')),
  selection:{managed:managed.size,selected:selected.size,required:required.size,removed:removed.size,used:used.filter(entry=>managed.has(String(entry.id))).length,missing},warnings:[...new Set(warnings)]};};
 const scanned=engine.checkWorldInfo(chat,maximum,false,globals);return input.engineFactory?scanned.then(finish):finish(scanned);
}
export async function activateWorldInfoAsync(input={}){const {createNativeWorldInfoAsync}=await import('./native-worldinfo/async-engine.mjs'),result=await activateWorldInfo({...input,engineFactory:createNativeWorldInfoAsync});result.tokens=await(input.countTokens||((text)=>Math.ceil(text.length/2)))(result.used.map(entry=>entry.content).join('\n'));return result;}
