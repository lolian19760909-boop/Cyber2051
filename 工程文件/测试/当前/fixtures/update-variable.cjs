'use strict';
// Reconstructed from the report's structure, not the unavailable original reply.
// Names, item IDs and prose are synthetic; retain the erroneous input path.
const patch=[
  {op:'replace',path:'/terminal/wallet/yen',value:0},
  {op:'replace',path:'/terminal/wallet/spent',value:1200},
  {op:'add',path:'/terminal/gameplay/numeric/input',value:[{id:'fixture-item-01',kind:'item-gain',item:{id:'fixture-part',template:'component_quest',tier:3,name:'旧设备零件',description:'一件从摊位购得的零件。',category:'misc'},quantity:1,reason:'购买所得'}]},
  {op:'replace',path:'/当前详细地点',value:'街边旧货摊'},
  {op:'replace',path:'/当前时间',value:'2051-03-28 20:05'}
];
const update=(entries,tag='Analysis')=>`<UpdateVariable><${tag}>玩家购买零件，调整零钱与当前地点。</${tag}><JSONPatch>${JSON.stringify(entries)}</JSONPatch></UpdateVariable>`;
const fixed=structuredClone(patch);fixed[2].path='/terminal/gameplay/numericInput';
module.exports={patch,fixed,update,reported:update(patch),valid:update(fixed)};
