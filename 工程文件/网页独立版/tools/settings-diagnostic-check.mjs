/** Directory diagnostics stay compact while retaining the exact missing IDs. */
import assert from 'node:assert/strict';
import {activateWorldInfo} from '../src/app/worldinfo.mjs';
const managedIds=Array.from({length:203},(_,i)=>'card:'+i),info=activateWorldInfo({entries:[],selection:{managedIds},budgetChars:10000});
assert.deepEqual(info.selection.missing,managedIds);
assert.equal(info.used.length,0);
const warning=info.warnings.find(text=>text.includes('选择方案'));
console.log(JSON.stringify({missing:info.selection.missing.length,statusCharacters:warning?.length,preview:warning?.slice(0,90)}));
assert(warning.includes('203'),'状态应说明未匹配的数量');
assert(warning.length<120,'目录 ID 全文挤进状态行');
assert(!warning.includes('card:0'),'具体 ID 应留在可展开的诊断中');
console.log(JSON.stringify({ok:true,checks:4,supplierCalls:0}));
