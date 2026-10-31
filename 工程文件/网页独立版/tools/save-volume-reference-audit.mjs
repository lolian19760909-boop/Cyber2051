/** Inspect the already authorized public reference snapshot as text; never execute its bundle. */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const WEB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),ROOT=path.resolve(WEB,'..'),relative='.cache/xinghai-reference-20261025/public/local-worker__v_a456e9c6c8.js',bytes=fs.readFileSync(path.join(ROOT,relative)),source=bytes.toString('utf8');
const expected='51d11e75a16e7dd1ce18a6434cec0f23dfa1c5fcd38bb3c207b1abea03f2ce0b';assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
const queries=[
 ['trace','m.push(ae),t.updateTurn(a,r.id,{trace:m})',180,'日志每次写完整trace数组'],
 ['stream-body','onToken(Se)',340,'流式正文每500ms写当前完整body'],
 ['idb-dirty','function Zu(t)',150,'SQLite脏文件300ms调度flush'],
 ['idb-flush','function gh()',800,'flush获取数据库bytes并put files记录'],
 ['sqlite-export','bytes(){let e=this.db.export()',140,'bytes导出整个sql.js数据库'],
 ['done-full-game','l("done",{game:t.load(a,{legacy:!1})})',100,'生成完成发送整份game视图'],
 ['load-all-turns','load(e,{legacy:n=!0}={})',1400,'game视图含完整turns与before/after状态'],
 ['history-backup','m=t.export(e,{backups:!1})',450,'回档等操作前保存整档export备份'],
 ['branch-snapshot','function D2(t,e)',700,'分支fork保存export快照'],
 ['before-state','state:$e.readState(l),runtime:',650,'begin将当前完整state写before_state'],
 ['after-state','let A={chapterControl:h,state:v',420,'commit将完整state写after_state'],
 ['event-changes','function G3(t,',520,'事件账本另存changes及payload_hash'],
];
const evidence=queries.map(([id,needle,length,meaning])=>{const offset=source.indexOf(needle);assert(offset>=0,id);return {id,meaning,offset,line:source.slice(0,offset).split('\n').length,excerpt:source.slice(offset,offset+length)};});
const inventory=JSON.parse(fs.readFileSync(path.join(WEB,'reports/p1-baseline.json'),'utf8'));
const referenceBuildInputs=inventory.buildInputs.filter(row=>/xinghai|starsea|local-worker/i.test(row.path));
const report={at:new Date().toISOString(),scope:'text-only existing public snapshot inspection; source structure matches screenshot topics, not screenshot provenance, MB reproduction, current live state or executed performance',source:{path:relative,sha256:expected,bytes:bytes.length,version:expected.slice(0,20)},evidence,referenceBuildInputs,adoption:'Effective web content build inputs do not include this bundle; current independent storage is IndexedDB records/deltas, no sql.js Store copy.',errors:[]};
fs.writeFileSync(path.join(WEB,'reports/save-volume-reference-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({source:report.source,checks:evidence.map(row=>({id:row.id,line:row.line,offset:row.offset})),referenceBuildInputs,scope:report.scope},null,2));
