// M14: existing worldbook places and facilities; exact map positions remain conceptual.
import assert from 'node:assert/strict';
import {applyWorldbookAnchors} from './worldbook-anchors.mjs';
const fact=(title,text,entryId)=>({title,text,entryId});
const ringAt=[1773,1106];
const rooms=[
 ['ring-instruments','RING-Live! · 乐器店','music','乐器店','地下二层'],
 ['ring-records','RING-Live! · 旧唱片店','music','旧唱片店','地下二层'],
 ['ring-cafe','RING-Live! · 咖啡馆','food','咖啡馆','地上1—3层配套区'],
 ['ring-studio','RING-Live! · 录音与租赁','music','录音室／乐器租赁','地上1—3层配套区'],
 ['ring-basement-bar','Lust？Love？Live！','bar','酒吧','地下三层']
];
const homes=[
 {id:'sakiko-rental',name:'祥子的赤羽出租屋',type:'apartment',cat:'私人住所',group:'lowtown',at:[1886.33,846.89],buildingIndex:488,parent:'akabane'},
 {id:'akabane-clinic',name:'赤羽黑诊所',type:'implant',cat:'义体诊所',group:'lowtown',at:[1906.26,896.95],buildingIndex:466,parent:'akabane'},
 {id:'rana-shifune-home',name:'乐奈与诗船的公寓',type:'apartment',cat:'私人住所',group:'underpool',at:[1821.31,1072.29],buildingIndex:341,parent:'ring-community'}
];
export const refinementFacts=[
 {id:'akabane',facts:[fact('祥子的赤羽经历（年表2050年7月—2051年4月）','独自在赤羽租下一间廉价出租屋安身。在完全没有人认识她的地方开始了求生，游走在黑灰地带之间。',10)]},
 {id:'haneoka',facts:[fact('学校与日常','校风开朗的平民女子学校，设有初中部和高中部，以丰厚的奖学金机制和免费食堂而闻名。',23),fact('所在地','羽丘和RiNG社区都在丰岛区。',3)]},
 {id:'sakiko-rental',facts:[fact('住所与时间范围','住所：位于东京北区赤羽的廉价出租屋，独自生活。创立Ave Mujica后搬迁至组织据点。',10)]},
 {id:'akabane-clinic',facts:[fact('已知关联','赤羽黑诊所拼装件：廉价反射加速、单只义眼、皮下护甲片。',10)]},
 {id:'rana-shifune-home',facts:[fact('同住者','住所：位于东京丰岛区RiNG社区内的公寓，与外婆都筑诗船同住。',9)]},
 {id:'ring-instruments',facts:[fact('地下二层乐器店','地下二层集中了各类乐器店、二手唱片行和独立酒吧“来生”，亡者之酒纪念区设在来生店内。',37)]},
 {id:'ring-records',facts:[fact('地下二层唱片店','地下二层集中了各类乐器店、二手唱片行和独立酒吧“来生”，亡者之酒纪念区设在来生店内。',37)]},
 {id:'ring-cafe',facts:[fact('地上咖啡馆配套','地上三层是Live House演出区，咖啡馆、录音室与乐器租赁等配套都在这几层。',37)]},
 {id:'ring-studio',facts:[fact('地上录音与乐器租赁','地上三层是Live House演出区，咖啡馆、录音室与乐器租赁等配套都在这几层。',37)]},
 {id:'ring-basement-bar',facts:[fact('地下三层','地下三层是全社区最大的酒吧"Lust？Love？Live！"。',37)]}
];
export const refinementPlaceIds=[...homes.map(n=>n.id),...rooms.map(n=>n[0])];
// Apply current authored facts to the existing map; geometry stays in its own source.
export function syncDistrictFacts(data,options={}){
 const receipt=applyWorldbookAnchors(data,{...options,additionalDefinitions:refinementFacts});
 const node=id=>data.nodes.find(n=>n.id===id),facts=id=>node(id).worldbookAnchor.facts.map(f=>f.text).join('\n');
 for(const id of ['ring-community','ring-live','beni-street'])node(id).desc=facts(id);
 for(const [id,,,,floor]of rooms){const n=node(id);assert(n,'Missing room: '+id);n.floor=floor;n.locationNote=floor+'；场馆内设施与主入口共用地图位置。';}
 node('ring-community').source='世界书 UID 3／44 · RiNG社区';node('ring-community').posNote='池袋地下社区，公共广场位于RING-Live!的B1。';
 node('ring-live').source='世界书 UID 37 · RING-Live!';node('ring-live').posNote='地上三层演出及配套；B1公共广场、B2商店与来生、B3酒吧。';
 node('circle').group='underpool';node('circle').source='世界书 UID 38 · CiRCLE；06大区志 · 暗池';node('circle').posNote='暗池，RiNG社区外围的独立场馆。';
 const beni=node('beni-street');beni.group='underpool';beni.source='世界书 UID 44 · 红花街';beni.posNote='暗池，RiNG贫民社区与普通住区的交界。';
 for(const dim of beni.dims||[]){if(dim.k==='治安')Object.assign(dim,{v:'2 · 失序',d:'商户雇人维持局部秩序，警方主要驻守外围街口'});if(dim.k==='势力')Object.assign(dim,{v:'商户与多方势力',d:'商户分摊雇佣看场人员，各巷维持日常秩序'});}
 return receipt;
}
export function applyDistrictRefinement(data){
 assert.equal(data.mapId,'tokyo-central');
 const all=[...data.nodes,...data.services,...data.districtExpansion.places,...data.terrainContext.places];
 assert.ok(refinementPlaceIds.every(id=>!all.some(n=>n.id===id)),'M14 place already exists; apply once to the base build.');
 for(const n of homes)assert.deepEqual(data.buildings[n.buildingIndex].slice(0,2),n.at,'Existing building moved: '+n.id);
 const parents=['akabane','ring-community','ring-live'];for(const id of parents)assert.equal(data.nodes.filter(n=>n.id===id).length,1,'Missing parent: '+id);
 assert.ok(!data.serviceTypes.some(t=>t.id==='music'));
 data.serviceTypes.push({id:'music',name:'乐器与录音',group:'生活服务',color:'#f2f1ec'});
 for(const n of homes){const {buildingIndex,parent,...node}=n;data.nodes.push({...node,posBasis:'既有设定／概念点位',posNote:'地点依据来自世界书；图上使用附近现有建筑作概念定位，具体门牌尚未确定。',placement:{status:'proposed',buildingIndex},relatedPlaceIds:[parent],locationNote:n.type==='apartment'?'私人住所；地图标记不代表可租住或已获准进入。':'世界书只记载祥子的义体来源；医生姓名、具体服务与价格尚未设定。'});}
 for(const [id,name,type,cat,floor] of rooms)data.nodes.push({id,name,type,cat,group:'underpool',at:[...ringAt],parentPlaceId:'ring-live',floor,posBasis:'场馆内设施',posNote:'与RING-Live!共用建筑入口，不代表独立楼栋。',relatedPlaceIds:['ring-live'],locationNote:floor+'；场馆内设施与主入口共用地图位置。'});
 for(const id of parents){const parent=data.nodes.find(n=>n.id===id);parent.relatedPlaceIds=id==='ring-live'?rooms.map(n=>n[0]):homes.filter(n=>n.parent===id).map(n=>n.id);}
 return {batchId:'M14',addedPlaceIds:[...refinementPlaceIds],existingAnchorIds:['akabane','haneoka'],geometryChanges:0,positionStatus:'Existing canon, conceptual map placement; no formal worldbook writes.'};
}
