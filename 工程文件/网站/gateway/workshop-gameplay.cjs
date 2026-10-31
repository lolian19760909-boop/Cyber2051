'use strict';
// 与卡内使用同一份规则；投稿局部编号在编译时加上固定投稿前缀。
const path=require('node:path');
const G=require(process.env.CXX_GAMEPLAY_MODULE || "../../卡片源码/运行时/gameplay.js");
const forms={shop_item:['商店物品','items'],blueprint:['蓝图','blueprints'],recipe:['配方','recipes'],skill:['技能','skills'],function:['功能服务','services']};
function compile(defs,kind,submissionId,mapIndex){
 G.validate(defs,{mapIndex});
 const required={...Object.fromEntries(Object.entries(forms).map(([k,v])=>[k,v[1]])),encounter:'encounters',function_zone:'services'}[kind];
 if(!required||!defs[required]?.length)throw Error('此模板缺少实际可消费的 '+required+' 定义');
 const next=JSON.parse(JSON.stringify(defs)),prefix='ugc_'+submissionId+'_';
 const indexes=Object.fromEntries(G.KINDS.map(k=>[k,new Set((defs[k]||[]).map(d=>d.id))]));
 const ref=(table,id)=>{if(!indexes[table].has(id))throw Error('缺少同包定义：'+table+'/'+id+'；请把依赖定义一并提交');const result=prefix+id;if(result.length>80)throw Error('投稿局部编号过长，请缩短至60字内');return result;};
 const amounts=(table,v)=>Object.fromEntries(Object.entries(v).map(([id,n])=>[ref(table,id),n]));
 const effect=e=>{if(e?.resources)e.resources=amounts('resources',e.resources);};
 const offer=o=>{o.targetId=ref(o.kind,o.targetId);};
 for(const table of G.KINDS)for(const d of next[table]||[]){
  d.id=ref(table,d.id);
  if(d.requires){for(const k of ['blueprints','skills'])if(d.requires[k])d.requires[k]=d.requires[k].map(id=>ref(k,id));if(d.requires.events)d.requires.events=amounts('encounters',d.requires.events);}
  effect(d.effects);effect(d.use?.effects);
  if(d.slots)d.slots=d.slots.map(id=>ref('slots',id));
  if(d.recipes)d.recipes=d.recipes.map(id=>ref('recipes',id));
  if(d.blueprintId)d.blueprintId=ref('blueprints',d.blueprintId);
  if(d.materials)d.materials=amounts('items',d.materials);
  if(d.outputs)d.outputs=amounts('items',d.outputs);
  if(d.recipeId)d.recipeId=ref('recipes',d.recipeId);
  if(d.offer)offer(d.offer);for(const o of d.offers||[])offer(o);
  for(const o of d.outcomes||[]){if(o.items)o.items=amounts('items',o.items);effect(o.effects);}
 }
 if(kind==='shop_item'&&!next.shops?.some(s=>s.offers.some(o=>o.kind==='items')))throw Error('商店物品须有已登记地点的购买入口');
 for(const [type,table]of [['blueprint','blueprints'],['skill','skills']])if(kind===type&&!next.shops?.some(s=>s.offers.some(o=>o.kind===table)))throw Error('蓝图或技能须有购买入口；安装内容不会让玩家自动学会');
 G.validate(next,{mapIndex});return next;
}
module.exports={forms,compile};
