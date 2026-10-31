/** ST owns persisted books; Helper 4.11.3's nested entries are an import format. */
import {nativeEntries,NATIVE_EXTENSION_FIELDS} from '../src/app/content-settings.mjs';
const clone=structuredClone;
const POSITIONS={before_character_definition:0,after_character_definition:1,before_author_note:2,after_author_note:3,at_depth:4,before_example_messages:5,after_example_messages:6,outlet:7};
const ROLES={system:0,user:1,assistant:2};
const LOGIC={and_any:0,not_all:1,not_any:2,and_all:3};

/** Exact public Helper shape, including its implicit native fields and extra data. */
export function helperToCanonical(value){
  const {strategy={},position={},recursion={},effect={},...rest}=clone(value);
  return nativeEntries([{...rest,uid:value.uid,comment:value.name||'',disable:value.enabled===false,
    constant:strategy.type==='constant',selective:strategy.type==='selective',vectorized:strategy.type==='vectorized',
    key:(strategy.keys||[]).map(String),keysecondary:(strategy.keys_secondary?.keys||[]).map(String),selectiveLogic:LOGIC[strategy.keys_secondary?.logic]??0,scanDepth:strategy.scan_depth==='same_as_global'?null:strategy.scan_depth??null,
    position:POSITIONS[position.type]??4,role:ROLES[position.role]??0,depth:position.depth??4,order:position.order??100,
    useProbability:true,probability:value.probability??100,excludeRecursion:recursion.prevent_incoming??false,preventRecursion:recursion.prevent_outgoing??false,delayUntilRecursion:recursion.delay_until??false,
    sticky:effect.sticky??null,cooldown:effect.cooldown??null,delay:effect.delay??null}])[0];
}

/** Native getGlobal/Chat/Persona/CharacterLore ownership rules, before entry sorting. */
export function worldbookSources({global=[],chat=null,persona=null,character=[]}={}){
  const seen=new Set(),books=[];
  for(const [source,names]of [['global',global],['chat',[chat]],['persona',[persona]],['character',character]])for(const name of names){
    if(typeof name!=='string'||!name||seen.has(name))continue;
    seen.add(name);books.push({bookId:name,id:name,name,source});
  }
  return books;
}

/** Patch the actual native document so untouched fields, UIDs and entries survive. */
export function patchNativeBook(book,patches){
  const next=clone(book),byId=new Map(Object.entries(next.entries||{}).map(([key,entry])=>[String(entry.uid??key),entry]));
  for(const patch of patches){
    const entry=byId.get(String(patch.entryId));if(!entry)throw Object.assign(Error('世界书没有条目 '+patch.entryId),{code:'worldbook_entry_missing'});
    if(typeof patch.content==='string')entry.content=patch.content;
    for(const [field,value]of Object.entries(patch.config||{})){
      if(field==='enabled')entry.disable=value===false;
      else if(field==='constant')entry.constant=value===true;
      else if(field==='strategy')entry.selective=value==='selective';
      else if(field==='order')entry.order=value;
      else if(field==='position')entry.position=Number.isInteger(value)?value:POSITIONS[value]??({before_char:0,after_char:1}[value]??entry.position);
      else if(field==='role')entry.role=ROLES[value]??value;
      else if(field==='probability'){entry.probability=value;entry.useProbability=true;}
      else if(field==='effect'||field==='type')entry.extensions={...entry.extensions,[field]:value};
      else {const native=Object.hasOwn(NATIVE_EXTENSION_FIELDS,field)?field:Object.keys(NATIVE_EXTENSION_FIELDS).find(key=>NATIVE_EXTENSION_FIELDS[key]===field);if(native)entry[native]=clone(value);}
    }
  }
  return next;
}
