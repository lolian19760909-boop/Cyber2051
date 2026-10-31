'use strict';
// 仅隔离测试使用，不进入正式内容库。
const C=require('./workshop-contract.cjs');
const location={mapId:'tokyo-central',placeId:'plaza'};
function gameplay(){return {schema:1,
 slots:[{id:'hand',name:'测试手部',description:'隔离槽位'}],resources:[{id:'condition',name:'测试状态',description:'隔离数值',min:0,max:100}],
 items:[{id:'material',name:'测试材料',description:'隔离原料'},{id:'supply',name:'测试补给',description:'隔离消耗品',use:{effects:{resources:{condition:10}}}},{id:'tool',name:'测试工具',description:'隔离装备',slots:['hand'],effects:{description:'仅隔离描述'}}],
 blueprints:[{id:'plan',name:'测试蓝图',description:'隔离学习',recipes:['craft'],learnCost:1}],
 recipes:[{id:'craft',name:'测试制作',description:'隔离配方',blueprintId:'plan',materials:{material:1},outputs:{tool:1},cost:2}],
 skills:[{id:'ability',name:'测试技能',description:'隔离技能',learnCost:1,cost:1,effects:{resources:{condition:-1}}}],
 shops:[{id:'store',name:'测试商店',description:'隔离目录',location,offers:[['material','items'],['supply','items'],['tool','items'],['plan','blueprints'],['ability','skills']].map(([targetId,kind])=>({id:targetId,kind,targetId,price:10}))}],
 services:[{id:'heal',name:'测试治疗',description:'隔离服务',location,service:'heal',cost:2,effects:{resources:{condition:10}}}],
 encounters:[{id:'sighting',name:'测试目击',description:'隔离事件',requires:{location},outcomes:[{id:'accept',name:'记录',items:{supply:1}}]}]};}
function payload(kind,revision=1){
 const form=C.schema().templates.find(t=>t.id===kind);
 if(form.type==='contract')return {format:1,...(kind==='side_story'?{templateKind:kind}:{}),contract:{fixer:'隔离联系人',type:'调查',difficulty:'低',pay:10+revision,...location,brief:'测试简报 '+revision,goal:'核对隔离地点'}};
 const p={format:form.format||1,templateKind:kind,...(kind==='code_component'?{}:{...location,keywords:['隔离测试']})};
 for(const [key,,required]of form.fields)if(required)p[key]='隔离 '+key+' '+revision;
 if(form.gameplay||['encounter','function_zone'].includes(kind))p.gameplay=gameplay();
 if(kind==='npc')p.media=[{id:'portrait',url:'https://cyber2051.top/img/test-only.png',alt:'隔离素材占位，测试不加载'}];
 if(kind==='user_identity')p.opening='隔离通用开场 '+revision;
 return p;
}
module.exports={gameplay,payload,location};
