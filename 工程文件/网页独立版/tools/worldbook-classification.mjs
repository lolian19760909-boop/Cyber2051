/** Build-only maintenance index. Classification never changes worldbook content or activation. */
import {createHash} from 'node:crypto';
const key=row=>row.bookId+':'+String(row.entryId);
export function buildWorldbookClassification(books,metadata){
 const source=new Map();
 for(const book of books)for(const entry of book.entries){const id=key({bookId:book.bookId,entryId:entry.id??entry.uid});if(source.has(id))throw Error('世界书复合编号重复：'+id);source.set(id,entry);}
 if(metadata.schema!==1)throw Error('世界书分类索引版本不匹配');
 const groups=new Set(metadata.groups.map(row=>row.id)),domains=new Set(metadata.domains.map(row=>row.id)),seen=new Set(),counts={};
 const entries=metadata.entries.map(row=>{
  const id=key(row),entry=source.get(id);if(seen.has(id))throw Error('世界书分类重复：'+id);if(!entry)throw Error('世界书分类无对应条目：'+id);seen.add(id);
  if(!groups.has(row.group)||!row.domains.length||row.domains.some(id=>!domains.has(id)))throw Error('世界书分类分组未登记：'+id);
  const enabled=entry.enabled!==false&&!entry.disable;if(row.sourceEnabled!==enabled)throw Error('世界书分类默认启停快照待同步：'+id);
  for(const target of [...row.dependsOn,...row.mutuallyExclusiveWith])if(!source.has(key(target)))throw Error('世界书分类引用不存在：'+id+' → '+key(target));
  counts[row.group]=(counts[row.group]||0)+1;
  return {...structuredClone(row),title:entry.comment,contentSha256:createHash('sha256').update(entry.content).digest('hex')};
 });
 const missing=[...source.keys()].filter(id=>!seen.has(id));if(missing.length)throw Error('世界书尚未分类：'+missing.join('、'));
 return {...structuredClone(metadata),entries,counts};
}
