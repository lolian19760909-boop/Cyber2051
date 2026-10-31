#!/usr/bin/env node
/** ST1.19 世界书键匹配：仅 /…/flags 为正则，其余按字面匹配。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { activateWorldInfo,worldInfoScan } from '../src/app/worldinfo.mjs';

const checks=[];
const entry=(id,keys,{useRegex=false,content='命中'}={})=>({id,keys,content,enabled:true,use_regex:useRegex,extensions:{position:0},insertion_order:0});
function used(rows,scan){
 const out=activateWorldInfo({entries:rows,scan,history:[],budgetChars:1e6,budgetTokens:1e6,countTokens:text=>text.length,maxEntries:rows.length});
 return out.used.map(row=>row.id);
}
const cases=[
 ['括号物品名按字面命中原文',[entry('crowbar',['Crowbar (iconic)'],{useRegex:true})],'Crowbar (iconic) 在这里',['crowbar']],
 ['方括号条目名不作为字符类误触发',[entry('init',['[InitVar]'],{useRegex:true})],'init 在这里',[]],
 ['方括号条目名仍匹配原字面',[entry('init',['[InitVar]'],{useRegex:true})],'[InitVar] 初始化',['init']],
 ['点号物品名不作为通配正则',[entry('mg',['Mk. 31 HMG'],{useRegex:true})],'MkX 31 HMG 开火',[]],
 ['点号物品名仍匹配原字面',[entry('mg',['Mk. 31 HMG'],{useRegex:true})],'Mk. 31 HMG 开火',['mg']],
 ['无效斜杠正则退回字面匹配',[entry('invalid',['/[/'],{useRegex:true})],'字面 /[/ 键',['invalid']],
 ['use_regex=false 保持字面',[entry('crowbar',['Crowbar (iconic)'],{useRegex:false})],'Crowbar iconic',[]],
 ['斜杠正则键不受 use_regex 影响',[entry('cyber',['/(?:义体|植入)/i'],{useRegex:false})],'植入了一条义体',['cyber']],
 ['默认大小写不敏感',[entry('militech',['Militech'],{useRegex:true})],'militech 的货',['militech']],
];
for(const [name,rows,scan,want] of cases){
 const got=used(rows,scan);
 assert.deepEqual(got,want,name+'：'+JSON.stringify(got));
 checks.push({name,ok:true,scan,used:got});
}
const receipt={at:new Date().toISOString(),scope:'ST1.19斜杠正则、无效正则按字面匹配、大小写和普通文本键',checks};
const named={...entry('named',['/\\x01Player: hello/']),extensions:{position:0,scan_depth:1}},history=[{role:'assistant',content:'old'},{role:'user',content:'hello'}],fields={userName:'Player',charName:'Sakiko'};
assert.deepEqual(activateWorldInfo({entries:[named],scan:worldInfoScan(history,fields),history,context:{fields},budgetChars:100000}).used.map(row=>row.id),['named']);checks.push({name:'逐条扫描深度保留原生姓名与消息分隔符',ok:true});
const out=fileURLToPath(new URL('../../.cache/play-loading-20261027/checks/play-worldinfo.json',import.meta.url));
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
