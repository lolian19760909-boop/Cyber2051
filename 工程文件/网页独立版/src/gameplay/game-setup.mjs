/**
 * Pre-creation choices, not a content registry or a state writer.
 * Declarations reference existing package versions and qualified worldbook IDs.
 * A combination is supported only when explicitly declared; version ordering is irrelevant.
 *
 * Integration: persist draft through read/writeStorySettings; bind() once before the
 * opening commit and retain that record on the opening node. Check compatibility()
 * before restoring a bound save. A legacy result delegates to the existing legacy path.
 * worldbookPatch() supplies the existing settings merge, never host/global book writes.
 * Its disabledEntries must also constrain selection and final main/extra prompt assembly.
 * Existing gallery preferences and tactical-enable remain owned by their current services.
 */
export const GAME_SETUP_SCHEMA=1;
export const DEFAULT_GAME_VERSION='3.0.0';
const copy=value=>structuredClone(value);
const fault=(code,message)=>Object.assign(new Error(message),{code});
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw fault('setup_declaration',label+'需要明确的非空标识');return value;};
function unique(rows,key,label){const seen=new Set();for(const row of rows){const id=text(row[key],label);if(seen.has(id))throw fault('setup_declaration',label+'重复：'+id);seen.add(id);}return seen;}
function pins(value){
 if(!Array.isArray(value))throw fault('setup_expansions','扩充包选择需要版本清单');
 const result=value.map(row=>({packageId:text(row?.packageId,'内容包'),version:text(row?.version,'内容包版本')}));
 unique(result,'packageId','内容包');return result.sort((a,b)=>a.packageId.localeCompare(b.packageId,'en'));
}
const pinKey=value=>JSON.stringify(pins(value));
const key=row=>row.baseVersion+'\n'+pinKey(row.expansions);

/**
 * versions: [{id,label}]; expansions: [{packageId,version,label}].
 * combinations: [{baseVersion,expansions:[{packageId,version}],featureIds,
 *                 contract:{rulesId,stateSchemaId}|null}].
 * features: [{id,label,description?,defaultEnabled?,required?,requires?,conflicts?,
 *             entries:[{bookId,entryId}]}]. Core protocols stay outside feature declarations.
 * The default has no invented gameplay, DLC or rule/schema identity; it cannot bind yet.
 */
export function createGameSetup(declarations={}){
 const catalog=copy({versions:[{id:DEFAULT_GAME_VERSION,label:DEFAULT_GAME_VERSION}],expansions:[],features:[],combinations:[{baseVersion:DEFAULT_GAME_VERSION,expansions:[],featureIds:[],contract:null}],...declarations});
 for(const field of ['versions','expansions','features','combinations'])if(!Array.isArray(catalog[field]))throw fault('setup_declaration',field+'需要数组');
 if(!catalog.versions.length)throw fault('setup_declaration','至少需要一个已声明的游戏版本');
 const versionIds=unique(catalog.versions,'id','游戏版本'),featureIds=unique(catalog.features,'id','玩法');
 const expansionIds=new Set();for(const row of catalog.expansions){text(row.packageId,'扩充包');text(row.version,'扩充包版本');const id=JSON.stringify([row.packageId,row.version]);if(expansionIds.has(id))throw fault('setup_declaration','扩充包版本重复');expansionIds.add(id);}
 const owners=new Set();
 for(const feature of catalog.features){
  if(!Array.isArray(feature.entries)||!feature.entries.length)throw fault('setup_declaration','玩法需要对应的世界书条目：'+feature.id);
  for(const field of ['defaultEnabled','required'])if(feature[field]!==undefined&&typeof feature[field]!=='boolean')throw fault('setup_declaration','玩法默认值与必开标识需要布尔值');
  for(const field of ['requires','conflicts']){feature[field]??=[];if(!Array.isArray(feature[field])||feature[field].some(id=>!featureIds.has(id)||id===feature.id))throw fault('setup_declaration','玩法依赖或互斥引用无效：'+feature.id);}
  feature.entries=feature.entries.map(row=>{const bookId=text(row.bookId,'世界书'),entryId=text(String(row.entryId??''),'条目');const id=JSON.stringify([bookId,entryId]);if(owners.has(id))throw fault('setup_declaration','同一世界书条目不能归属多个玩法：'+bookId+':'+entryId);owners.add(id);return {bookId,entryId};});
 }
 const combinations=new Map();
 for(const row of catalog.combinations){
  if(!versionIds.has(row.baseVersion))throw fault('setup_declaration','组合指向未声明的游戏版本');
  row.expansions=pins(row.expansions);
  if(row.expansions.some(pin=>!expansionIds.has(JSON.stringify([pin.packageId,pin.version]))))throw fault('setup_declaration','组合指向未声明的扩充包版本');
  if(!Array.isArray(row.featureIds)||new Set(row.featureIds).size!==row.featureIds.length||row.featureIds.some(id=>!featureIds.has(id)))throw fault('setup_declaration','组合玩法清单无效');
  for(const feature of catalog.features.filter(f=>row.featureIds.includes(f.id)))if(feature.requires.some(id=>!row.featureIds.includes(id)))throw fault('setup_declaration','组合缺少玩法依赖：'+feature.id);
  if(row.contract!=null){text(row.contract.rulesId,'规则来源');text(row.contract.stateSchemaId,'状态结构来源');}
  const id=key(row);if(combinations.has(id))throw fault('setup_declaration','同一版本组合只能声明一次');combinations.set(id,row);
 }
 const featuresOf=row=>catalog.features.filter(feature=>row?.featureIds.includes(feature.id));
 function draft({baseVersion=catalog.versions[0].id,expansions=[]}={}){
  const selected=pins(expansions),row=combinations.get(key({baseVersion,expansions:selected}));
  return {schema:GAME_SETUP_SCHEMA,baseVersion,expansions:selected,features:Object.fromEntries(featuresOf(row).map(feature=>[feature.id,feature.required===true||feature.defaultEnabled===true]))};
 }
 function inspect(selection,{requireContract=false}={}){
  const issues=[],issue=(code,message)=>issues.push({code,message});let row=null,selected=[];
  if(!selection||selection.schema!==GAME_SETUP_SCHEMA)issue('setup_schema','此选择记录需要匹配的游戏版本');
  if(!versionIds.has(selection?.baseVersion))issue('setup_version','未安装或未声明该游戏版本');
  try{selected=pins(selection?.expansions);row=combinations.get(key({baseVersion:selection?.baseVersion,expansions:selected}));}catch(error){issue(error.code,error.message);}
  if(!row)issue('setup_combination','该游戏版本与扩充包组合尚未声明兼容');
  const values=selection?.features;
  if(!values||typeof values!=='object'||Array.isArray(values))issue('setup_features','玩法选择记录不完整');
  else if(row){
   if(Object.keys(values).some(id=>!row.featureIds.includes(id)))issue('setup_feature_unknown','选择中含有本版本未提供的玩法');
   for(const feature of featuresOf(row)){
    const enabled=values[feature.id];
    if(!Object.hasOwn(values,feature.id)||typeof enabled!=='boolean'){issue('setup_feature_value','请明确选择「'+feature.label+'」是否开启');continue;}
    if(feature.required&&!enabled)issue('setup_feature_required','「'+feature.label+'」是本版本必需项');
    if(enabled&&feature.requires.some(id=>values[id]!==true))issue('setup_feature_dependency','「'+feature.label+'」缺少所需玩法');
    if(enabled&&feature.conflicts.some(id=>values[id]===true))issue('setup_feature_conflict','「'+feature.label+'」与当前开启项互斥');
   }
  }
  if(requireContract&&row&&!row.contract)issue('setup_contract_missing','当前版本尚未完成接入，暂不能创建角色');
  return {ok:issues.length===0,issues,combination:row?copy(row):null};
 }
 function bind(selection){
  const checked=inspect(selection,{requireContract:true});if(!checked.ok)throw Object.assign(fault(checked.issues[0].code,checked.issues.map(row=>row.message).join('；')),{issues:checked.issues});
  const row=checked.combination;
  if((Object.hasOwn(selection,'rulesId')||Object.hasOwn(selection,'stateSchemaId'))&&(selection.rulesId!==row.contract.rulesId||selection.stateSchemaId!==row.contract.stateSchemaId))throw fault('setup_contract_mismatch','已有绑定不能自动改用另一套规则或状态结构');
  return {schema:GAME_SETUP_SCHEMA,baseVersion:row.baseVersion,expansions:copy(row.expansions),features:Object.fromEntries(row.featureIds.map(id=>[id,selection.features[id]])),rulesId:row.contract.rulesId,stateSchemaId:row.contract.stateSchemaId};
 }
 function compatibility(record){
  // null means no decision: preserve the host's existing legacy behavior, not an upgrade grant.
  if(record==null)return {status:'legacy',canWrite:null,issues:[]};
  const checked=inspect(record,{requireContract:true}),issues=[...checked.issues],contract=checked.combination?.contract;
  if(contract&&(record.rulesId!==contract.rulesId||record.stateSchemaId!==contract.stateSchemaId))issues.push({code:'setup_contract_mismatch',message:'存档的规则或状态结构与当前运行版本不兼容，请保留原档并使用匹配版本'});
  return {status:issues.length?'blocked':'compatible',canWrite:issues.length===0,issues};
 }
 function disabledEntries(record,{bookIds={}}={}){
  return featuresOf(combinations.get(key(record))).filter(feature=>record.features[feature.id]===false).flatMap(feature=>feature.entries.map(target=>({bookId:bookIds[target.bookId]??target.bookId,entryId:target.entryId})));
 }
 function worldbookPatch(record,{books,bookIds={}}={}){
  const checked=compatibility(record);if(checked.status!=='compatible')throw fault(checked.issues[0]?.code||'setup_binding_required',checked.issues[0]?.message||'请先确认本局游戏版本');
  if(!Array.isArray(books))throw fault('setup_worldbooks','需要当前本局世界书快照');
  const settingsPatch={books:{}},disabled=disabledEntries(record,{bookIds}),row=combinations.get(key(record));
  for(const feature of featuresOf(row))for(const target of feature.entries){
   const bookId=bookIds[target.bookId]??target.bookId,entryId=target.entryId,book=books.find(book=>book.bookId===bookId);
   if(!book?.entries?.some(entry=>String(entry.entryId??entry.id??entry.uid)===entryId))throw fault('setup_worldbook_target','找不到玩法「'+feature.label+'」对应的世界书条目：'+bookId+':'+entryId);
   const enabled=record.features[feature.id];settingsPatch.books[bookId]??={entries:{}};settingsPatch.books[bookId].entries[entryId]={config:{enabled}};
  }
  return {settingsPatch,disabledEntries:disabled};
 }
 return {get catalog(){return copy(catalog);},draft,inspect,bind,compatibility,disabledEntries,worldbookPatch};
}
