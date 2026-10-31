/** Lossless formal state in the existing SQLite engine; rules still own calculation. */
const escape=key=>key.replaceAll('~','~0').replaceAll('/','~1'),unescape=key=>key.replaceAll('~1','/').replaceAll('~0','~');
export function stateFields(state){
 const rows=[];
 function visit(value,path){if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length){for(const [key,next]of Object.entries(value))visit(next,path+'/'+escape(key));}else rows.push({path,json:JSON.stringify(value)});}
 visit(state,'');return rows;
}
export function fieldsState(rows){
 let root={};
 for(const row of rows){const value=JSON.parse(row.json);if(!row.path){root=value;continue;}const keys=row.path.slice(1).split('/').map(unescape);let target=root;
  for(const key of keys.slice(0,-1)){if(!Object.hasOwn(target,key))Object.defineProperty(target,key,{value:{},writable:true,enumerable:true,configurable:true});target=target[key];}
  Object.defineProperty(target,keys.at(-1),{value,writable:true,enumerable:true,configurable:true});
 }
 return root;
}
export function stateTemplate(template,{equipment}={}){
 if(!template)return template;
 const result={...template};let changed=false;
 const old="CHECK(slot IN ('主手', '副手', '头部', '躯干', '腿部', '义体'))";
 const factKinds="CHECK(kind IN ('购买', '装备', '成长', '战斗', '其他'))";
 for(const [key,table]of Object.entries(template)){
  if((table?.uid==='sheet_cxx_equipment'||table?.name==='装备表')&&table.sourceData?.ddl?.includes(old)){
   result[key]={...table,sourceData:{...table.sourceData,ddl:table.sourceData.ddl.replace(old,'CHECK(length(slot) > 0)'),note:table.sourceData.note.replace('只允许填写‘主手’、‘副手’、‘头部’、‘躯干’、‘腿部’、‘义体’。','使用现有装备槽键，不合并不同槽位。旧中文槽位仍可读取。')}};
   if(equipment)result[key].content=[table.content[0],...equipment.map((row,index)=>[index+1,row.actor_key,row.slot,row.item_key,row.installed,row.updated_turn])];
   changed=true;
  }
  // Fact kind is a stored label; receipt/fact_key own idempotency. Preserve legacy
  // labels verbatim instead of making an unrelated state restore reject the whole save.
  if((table?.uid==='sheet_cxx_fact'||table?.name==='事实流水表')&&table.sourceData?.ddl?.includes(factKinds)){
   result[key]={...table,sourceData:{...table.sourceData,ddl:table.sourceData.ddl.replace(factKinds,'')}};
   changed=true;
  }
 }
 return changed?result:template;
}
export function readSqlState(sql){const rows=sql.read();return rows.length?fieldsState(rows):null;}
export function writeSqlState(sql,state){sql.replace(stateFields(state));return readSqlState(sql);}
