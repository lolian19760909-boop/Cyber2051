/** Player copies retain native fields; normalization happens at the import/edit boundary. */
// ST1.19 originalWIDataKeyMap / convertCharacterBook. Unknown fields remain on the row.
export const NATIVE_EXTENSION_FIELDS={position:'position',depth:'depth',role:'role',probability:'probability',useProbability:'useProbability',scanDepth:'scan_depth',selectiveLogic:'selectiveLogic',caseSensitive:'case_sensitive',matchWholeWords:'match_whole_words',excludeRecursion:'exclude_recursion',preventRecursion:'prevent_recursion',delayUntilRecursion:'delay_until_recursion',ignoreBudget:'ignore_budget',outletName:'outletName',sticky:'sticky',cooldown:'cooldown',delay:'delay',group:'group',groupOverride:'group_override',groupWeight:'group_weight',useGroupScoring:'use_group_scoring',displayIndex:'display_index',automationId:'automation_id',vectorized:'vectorized',triggers:'triggers',matchPersonaDescription:'match_persona_description',matchCharacterDescription:'match_character_description',matchCharacterPersonality:'match_character_personality',matchCharacterDepthPrompt:'match_character_depth_prompt',matchScenario:'match_scenario',matchCreatorNotes:'match_creator_notes'};
export function nativeEntries(value){
  const canonicalArray=Array.isArray(value),rows=canonicalArray?value:Object.values(value||{}),ids=new Set();
  return rows.map((raw,index)=>{
    const row=structuredClone(raw),id=row.id??row.uid??index;
    if(ids.has(String(id)))throw Error('世界书条目编号重复：'+id);ids.add(String(id));
    row.id=id;row.keys=row.keys??row.key??[];row.secondary_keys=row.secondary_keys??row.keysecondary??[];
    if(!Array.isArray(row.keys)||!Array.isArray(row.secondary_keys)||typeof row.content!=='string')throw Error('世界书条目需要正文和关键词数组');
    row.enabled=canonicalArray&&Array.isArray(raw.keys)&&typeof raw.enabled==='boolean'?raw.enabled:raw.disable===undefined?raw.enabled!==false:!raw.disable;row.disable=!row.enabled;row.insertion_order=row.insertion_order??row.order??100;row.selective=row.selective??true;
    const ext=row.extensions={...(row.extensions||{})};
    if(ext.outletName===undefined&&ext.outlet_name!==undefined)ext.outletName=ext.outlet_name;
    for(const [from,to]of Object.entries(NATIVE_EXTENSION_FIELDS))if(raw[from]!==undefined&&ext[to]===undefined&&!(from==='position'&&typeof raw[from]==='string'))ext[to]=raw[from];
    delete ext.outlet_name;
    if(ext.position===undefined)ext.position=row.position==='after_char'?1:0;
    if(ext.triggers!==undefined&&(!Array.isArray(ext.triggers)||ext.triggers.some(value=>typeof value!=='string')))throw Error('世界书触发类型需要文字数组');
    for(const field of['sticky','cooldown','delay'])if(ext[field]!=null&&(!Number.isSafeInteger(ext[field])||ext[field]<0))throw Error('世界书 '+field+' 需要非负整数');
    if(ext.group_weight!=null&&(!Number.isFinite(ext.group_weight)||ext.group_weight<0))throw Error('世界书分组权重需要非负数');
    return row;
  });
}
export function nativeBook(raw,{bookId=raw.bookId||raw.name||'book',name=raw.name||bookId}={}){
  if(!raw||typeof raw!=='object'||!raw.entries)throw Error('请选择带 entries 的世界书 JSON');
  return {...structuredClone(raw),bookId:String(bookId),name:String(name),enabled:raw.enabled!==false,entries:nativeEntries(raw.entries)};
}
export function checkedPreset(raw){
  if(!Array.isArray(raw?.prompts)||!Array.isArray(raw?.prompt_order))throw Error('请选择酒馆聊天补全预设 JSON');
  const ids=new Set();for(const row of raw.prompts){if(!row.identifier||ids.has(row.identifier))throw Error('预设提示块编号缺失或重复');ids.add(row.identifier);}
  if(!raw.prompt_order.length||raw.prompt_order.some(group=>!Array.isArray(group.order)))throw Error('预设需要带 order 数组的提示块顺序');
  const next=structuredClone(raw);checkedRegex(next.extensions?.regex_scripts||next.regex_scripts||[]);return next;
}
export function checkedAuthorNote(raw={}){
 const next={...structuredClone(raw),content:String(raw.content??''),enabled:raw.enabled!==false,position:raw.position??1,depth:raw.depth??4,role:raw.role??'system',interval:raw.interval??1};
 if(!Number.isSafeInteger(next.depth)||next.depth<0||!Number.isSafeInteger(next.interval)||next.interval<0||!['system','user','assistant'].includes(next.role))throw Error('作者注释需要非负整数深度、间隔及有效消息角色');
 if(![0,1,2,'before','in_chat','after'].includes(next.position))throw Error('作者注释位置无效');
 return next;
}
export function checkedRegex(rows){
  if(!Array.isArray(rows))throw Error('正则文件需要规则数组');
  for(const row of rows){if(typeof row.findRegex!=='string'||!Array.isArray(row.placement))throw Error('正则规则需要 findRegex 与 placement');const match=row.findRegex.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);try{match?new RegExp(match[1],match[2]):new RegExp(row.findRegex);}catch(error){throw Error((row.scriptName||'正则')+'：'+error.message);}}
  return structuredClone(rows);
}

export function exportWorldbook(book){return {...structuredClone(book),entries:Object.fromEntries(book.entries.map(row=>{const ext=row.extensions||{},entry={...row,uid:row.id,key:[...row.keys],keysecondary:[...row.secondary_keys],disable:row.enabled===false,order:row.insertion_order,position:ext.position??(row.position==='after_char'?1:0),depth:ext.depth??4,role:ext.role??0,probability:ext.probability??100,useProbability:ext.useProbability??false,scanDepth:ext.scan_depth??null,selectiveLogic:ext.selectiveLogic??0,caseSensitive:ext.case_sensitive??null,matchWholeWords:ext.match_whole_words??null,excludeRecursion:ext.exclude_recursion??false,preventRecursion:ext.prevent_recursion??false,ignoreBudget:ext.ignore_budget??false};for(const [field,key]of Object.entries(NATIVE_EXTENSION_FIELDS))if(ext[key]!==undefined)entry[field]=ext[key];return [String(entry.uid),entry];}))};}
