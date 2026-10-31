'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../卡片源码/数值引擎'),catalog=require("../../卡片源码/数值引擎/src/talent-data.js"),rules=require("../../卡片源码/数值引擎/src/talent-rules.js"),original=require("../../卡片源码/数值引擎/reference/cp2077-effects.js");
let text='# 179节点天赋适配对照\n\n自动从维护源生成。左侧原始参考仅留作比对，实际运行和界面文本由右侧结构化定义派生。所有数值是轻量战力参数，不是2077逐击伤害。条件标签见文末。\n\n';
for(const tree of catalog.trees){text+='## '+tree.name+'\n\n';for(const node of tree.nodes){text+='### '+node.name+'\n\n`'+node.id+'` · 属性门槛 '+node.required+' · '+node.ranks+'级\n\n| 等级 | 原参考 | 本卡适配 |\n|---|---|---|\n';rules.definitions[node.id].forEach((rank,i)=>{const escape=s=>s.replace(/\|/g,'／').replace(/\n/g,' ');text+='| '+(i+1)+' | '+escape(original[node.id][i])+' | '+escape(rank.map(rules.describe).join(''))+' |\n';});text+='\n';}}
text+='## 条件标签\n\n| 编号 | 含义 |\n|---|---|\n'+Object.entries(rules.labels).map(([id,label])=>'| '+id+' | '+label+' |').join('\n')+'\n';
fs.writeFileSync(path.join(root,'docs/天赋适配清单.md'),text);
console.log('Wrote all '+catalog.trees.reduce((n,t)=>n+t.nodes.length,0)+' talent mappings.');
