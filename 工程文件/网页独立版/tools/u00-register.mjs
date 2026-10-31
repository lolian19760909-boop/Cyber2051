/** U00: register the five reference documents as read-only originals plus a K01–K44 register. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT=path.resolve(import.meta.dirname,'..','..');
const PROJECT=path.resolve(ROOT,'..');
const DOC=path.join(ROOT,'网页上线后增强与完整借鉴清单-20261026.md');
const RECEIPT=path.join(PROJECT,'.cache/网页借鉴规划-20261026/来源核对.json');
const OUT=path.join(PROJECT,'资料/参考/借鉴原件-20261026');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const text=fs.readFileSync(DOC,'utf8');
const lines=text.split('\n');

const pick=prefix=>lines.find(line=>line.startsWith(prefix));
const tableRows=(header)=>{
  const start=lines.findIndex(line=>line.trim()===header);
  if(start<0)throw new Error('表格缺失：'+header);
  const rows=[];
  for(const line of lines.slice(start+1)){
    if(!line.trim().startsWith('|'))break;
    if(/^\|[\s-|]+\|$/.test(line.trim()))continue;
    rows.push(line.trim().split('|').slice(1,-1).map(cell=>cell.trim()));
  }
  return rows;
};

const citations=tableRows('| 编号 | 来源 | 本次重点 |');
const receipt=JSON.parse(fs.readFileSync(RECEIPT,'utf8'));
const receiptByName=new Map(receipt.sources.filter(row=>row.path.endsWith('.md')).map(row=>[path.basename(row.path),row]));

fs.mkdirSync(OUT,{recursive:true});
const originals=[];
for(const [id,source,focus] of citations){
  const file=/<([^>]+)>/.exec(source)?.[1]||source.replace(/^\[.*?\]\(/, '').replace(/\)$/,'');
  const name=path.basename(file);
  const target=path.join(OUT,id+'-'+name);
  if(!fs.existsSync(file))throw new Error('原件缺失：'+file);
  const bytes=fs.readFileSync(file);
  if(!fs.existsSync(target)||sha(fs.readFileSync(target))!==sha(bytes))fs.writeFileSync(target,bytes);
  const known=receiptByName.get(name);
  const actual=sha(bytes);
  if(known&&known.sha256.toLowerCase()!==actual)throw new Error('原件与来源核对回执不一致：'+name);
  originals.push({id,file,name,target:path.relative(PROJECT,target).split(path.sep).join('/'),bytes:bytes.length,sha256:actual,focus,receiptSha:known?.sha256||null});
}

const abilities=tableRows('| ID | 借鉴内容与来源 | 接入2051 | 最小验收结果 |');
const pendingPattern=/待原件|待核对|待补/;
const register=abilities.map(([id,content,landing,acceptance])=>{
  const source=/A[1-5]/.exec(content)?.[0]||'';
  const status=pendingPattern.test(content+' '+acceptance)?'需补原件或原页面':'描述已登记';
  return {id:id.replace(/\*/g,''),source,content,landing,acceptance,status,type:content.includes('A2')?'草稿':'成品描述'};
});

const now=new Date().toISOString();
const md=[];
md.push('# 借鉴原件与能力登记（U00）');
md.push('');
md.push('> 生成物：由 `网页独立版/tools/u00-register.mjs` 从《网页上线后增强与完整借鉴清单-20261026.md》与 `.cache/网页借鉴规划-20261026/来源核对.json` 生成，不手改。原件按 A1–A5 编号只读保存；正文仍以原件为准。');
md.push('');
md.push('## 一、原件（只读）');
md.push('');
md.push('| 编号 | 本目录文件 | 字节 | sha256 | 来源核对回执 | 本次重点 |');
md.push('|---|---|---|---|---|---|');
for(const row of originals)md.push('| '+row.id+' | '+path.basename(row.target)+' | '+row.bytes+' | `'+row.sha256+'` | '+(row.receiptSha?'一致':'未登记')+' | '+row.focus+' |');
md.push('');
md.push('落位：`'+path.relative(PROJECT,OUT).split(path.sep).join('/')+'/`。这五份是**对原系统的描述与笔记**，不是原项目源码；原件正文缺哪一段，登记表就标“需补原件”，不用临时自写内容冒充。');
md.push('');
md.push('## 二、三分法');
md.push('');
md.push('- **附件成品描述**：A1／A3／A4／A5 对斗罗原系统与命定成品的行为记录，可直接作为复现依据。');
md.push('- **A2 草稿**：命定无 DB 事实与增量建议，只作草稿，不与成品行为混同。');
md.push('- **本案拟新增**：2051 的接入位置、视图、目录与验收场景，见下表“接入2051”与各 U 任务文档。');
md.push('');
md.push('## 三、K01—K44 登记');
md.push('');
md.push('| ID | 来源 | 类型 | 原件状态 | 借鉴内容 | 接入2051 | 最小验收 |');
md.push('|---|---|---|---|---|---|---|');
for(const row of register)md.push('| '+row.id+' | '+row.source+' | '+row.type+' | '+row.status+' | '+row.content+' | '+row.landing+' | '+row.acceptance+' |');
md.push('');
md.push('## 四、原网页页面／操作清单（K36）');
md.push('');
md.push('五份 MD 未覆盖原产品全部页面。本节只登记**已知**入口，其余标待核对，不以五份 MD 替代全产品清单：');
md.push('');
md.push('| 原页面／操作 | 依据 | 2051 对照 | 状态 |');
md.push('|---|---|---|---|');
md.push('| 发送拦截与门禁 | A2 §1 bindSendGate、A3 发送链路 | 网页发送按钮／runTurn | 描述已登记 |');
md.push('| 世界书接管与恢复 | A3 写回章节、A5 交叉核对 | U06 worldbook／agent-state | 描述已登记 |');
md.push('| 数据库／ACU 导出与固定查询 | A4 表契约与 SQL | U03 facts、st-projection | 描述已登记 |');
md.push('| 伴侣设置面板 | A3 配置部分 | U10 settings | 待补：原面板截图与逐项操作 |');
md.push('| 安装／更新／已知坏模板修复 | A1 §99 | U11 安装修复 | 待补：原安装器与模板原文 |');
md.push('| 其余原页面（任务、地图、通讯等） | 无 | 2051 src/ui 五视图 | 待核对：需原页面清单 |');
md.push('');
md.push('## 五、缺口');
md.push('');
md.push('- K27 原 DB 整理／更新／清理提示原文未随五份 MD 提供 → 任务对照只能先按 A1 §351–374 的结构登记。');
md.push('- K33 远程加载与动态装载的原依赖清单未提供 → 只登记“原依赖能装载、版本可见”的验收口径。');
md.push('- K36 原页面与操作清单未提供 → 上表保留待核对行。');
md.push('- K42 官方 Skill 模板原文与损坏样本未提供 → 修模板任务等原件。');

fs.writeFileSync(path.join(OUT,'索引.md'),md.join('\n')+'\n');
const report={schema:1,at:now,dir:path.relative(PROJECT,OUT).split(path.sep).join('/'),originals:originals.map(({id,target,bytes,sha256,receiptSha})=>({id,target,bytes,sha256,receiptMatches:!!receiptSha})),abilities:register.length,needsOriginals:register.filter(row=>row.status!=='描述已登记').map(row=>row.id)};
fs.mkdirSync(path.join(ROOT,'工程文件/网页独立版/reports'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'工程文件/网页独立版/reports/u00-register.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
