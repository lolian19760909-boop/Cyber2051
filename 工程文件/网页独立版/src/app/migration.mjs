/** 存档热更注册表：版本对比、更新计划与迁移步骤（issue #28）。
 *  版本号纪律（作者 2026-11-01）：兼容性热更走小版本，在此按目标版本登记高亮与可选迁移步骤；
 *  只有改状态结构常量（SCHEMA_ID/applier.VERSION，旧档无法继承）才升大版本，届时在同一条目里登记真迁移。 */
const semver=value=>String(value||'').split('+')[0].split('-')[0].split('.').map(part=>Number.isFinite(+part)?+part:0);
export function versionPrefix(value){return String(value||'').split('+')[0];}
export function compareVersions(a,b){const left=semver(a),right=semver(b);for(let i=0;i<3;i++){if((left[i]||0)!==(right[i]||0))return Math.sign((left[i]||0)-(right[i]||0));}return 0;}
const REGISTRY=[
 {version:'3.0.0',highlights:['版本号统一：卡内容 2.3.33 → 3.0.0（与引擎版本对齐）','存档数据无需变更，旧存档直接兼容']},
];
/** 更新计划：目标版本已登记且存档落后时返回弹窗内容；同版、更高（不可降级）、未登记路径或
 *  没有版本记录（新建/未提交的空会话）返回 null。 */
export function updatePlan({from,to}){
 const fromPrefix=versionPrefix(from),toPrefix=versionPrefix(to);
 if(!fromPrefix||compareVersions(fromPrefix,toPrefix)>=0)return null;
 const covered=REGISTRY.filter(row=>compareVersions(row.version,fromPrefix)>0&&compareVersions(row.version,toPrefix)<=0);
 const highlights=covered.flatMap(row=>row.highlights||[]),steps=covered.flatMap(row=>row.steps||[]);
 if(!highlights.length&&!steps.length)return null;
 return {from:fromPrefix,to:toPrefix,highlights,steps:steps.map(step=>({label:step.label,detail:step.detail}))};
}
export function needsSaveUpdate(from,to){return updatePlan({from,to})!=null;}
