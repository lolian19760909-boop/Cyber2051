// M10: six named places only. Coordinates are concept-map units, not metres.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {detailFootprint} from './city-detail.mjs';

export const COMMUNITY_MIGRATION_ID='m10-ring-community-1';
export const COMMUNITY_MIGRATIONS=[
  {id:'ring-community',fromAt:[1917.35,1090.36],at:[1790,1111],fromGroup:'underpool',group:'underpool',fromSource:'大区志条目 053「区划：RiNG社区」（迁移自【地区与治安】，待作者定稿）',source:'正式世界书 003「世界观设定」／042「地区与治安」·RiNG社区',reason:'丰岛池袋废弃地下铁社区的地表广场；地下层次沿正式地志表达。'},
  {id:'ring-live',fromAt:[1931.12,1096.99],at:[1773,1106],fromGroup:'underpool',group:'underpool',reason:'社区核心广场西侧独立场馆；地上三层、地下三层，中立停火与禁重武器。'},
  {id:'beni-street',fromAt:[1887.3,1126.09],at:[1796,1124],fromGroup:'underpool',group:'neonring',fromSource:'大区志条目 054「区划：红花街」（迁移自【地区与治安】，待作者定稿）',source:'正式世界书 042「地区与治安」·红花街',reason:'节点在暗池南缘与霓环普通住区的交界南侧；街巷地块跨两侧，不代表归某方管辖。'},
  {id:'a-yang-clinic',fromAt:[1890.22,1119.45],at:[1804,1118],fromGroup:'underpool',group:'underpool',reason:'诊所完整足迹位于红花街北侧巷内，消除旧点的暗池边界越界。'},
  {id:'circle',fromAt:[1951.99,1103.12],at:[1778,1139],fromGroup:'underpool',group:'neonring',reason:'RiNG外围独立场馆落在普通住区一侧；按实际几何记霓环，保留约500人及原事件。'},
  {id:'space-site',fromAt:[1901.91,1077.59],at:[1768,1087],fromGroup:'underpool',group:'underpool',cat:'旧址／停车场',type:'parking',reason:'2049年末关闭、公司收购后改停车场；低矮门岗与车位不再表现营业场馆。'}
];
export const OLD_REUSED_MICRO=[682,688,683,684,445,681,679,686];
export const NEW_REUSED_MICRO=[645,646,647,648,649,651];
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const copy=x=>structuredClone(x);
const bounds=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const rect=(x,y,w,h)=>[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]];
const lane=(id,points,width=1.2)=>({id,points,width});

export function applyCommunityMigration(data){
  assert.equal(data.mapId,'tokyo-central','Community migration belongs to the central map only.');
  if(data.terrainContext.communityMigration?.id===COMMUNITY_MIGRATION_ID){
    for(const row of COMMUNITY_MIGRATIONS){const n=data.nodes.find(n=>n.id===row.id);assert.deepEqual(n.at,row.at);assert.equal(n.group,row.group);}
    assert.equal(data.fullCentral.metrics.totalBuildingObjects,data.terrainContext.communityMigration.drawingObjects.afterTotal);
    return data;
  }
  const terrain=data.terrainContext,old=terrain.complexes.find(s=>s.id==='ring-community-surface');
  assert.equal(sha(old),'fc65a627ba8e184bc7bd8e25bae0e8d0c6bf8439d8d937f93e0e6fbfe749fb20','The frozen RiNG surface changed; review before migrating.');
  assert.deepEqual(terrain.reusedMicroIndices,OLD_REUSED_MICRO);
  assert.equal(sha(NEW_REUSED_MICRO.map(i=>({i,m:data.cityDetail.micro[i],fp:data.cityDetail.microFootprints[i]}))),'188ac843330f89c91e6818c9dae3f5d2af1ebc367b9f27dfe22e240655a4ae4a','Local ordinary roofs changed; do not overwrite concurrent work.');
  // Validate every old value before performing the first mutation.
  for(const row of COMMUNITY_MIGRATIONS){const n=data.nodes.find(n=>n.id===row.id);assert.ok(n,row.id);assert.deepEqual(n.at,row.fromAt,row.id);assert.equal(n.group,row.fromGroup,row.id);if(row.fromSource)assert.equal(n.source,row.fromSource,row.id);}
  assert.ok(!data.serviceTypes.some(t=>t.id==='parking'),'Review an existing parking type before migrating.');
  assert.equal(data.fullCentral.metrics.totalBuildingObjects,10335,'Review a changed M9 object inventory before migrating.');
  const under=data.regions.findIndex(r=>r.id==='underpool'),neon=data.regions.findIndex(r=>r.id==='neonring');
  assert.ok(under>=0&&neon>=0);
  const part=(x,y,w,d,h,ri=under,tone=.5)=>[x,y,w,d,h,0,0,ri,tone];
  const make=(id,name,nodeIds,at,ri,points,parts,groundDetails)=>{
    const b=bounds(points);return {id,name,nodeIds,at,ri,points,size:[b[2]-b[0],b[3]-b[1]],parts,footprints:parts.map(detailFootprint),forecourt:groundDetails.lanes[0]?.points||[],groundDetails};
  };
  const reused=NEW_REUSED_MICRO.map((i,k)=>{const b=copy(data.cityDetail.micro[i].b);b[4]=[2,3,2.5,1.5,1.5,3][k];b[8]=.35+(k%4)*.1;return b;});
  const coreLanes=[
    lane('ring-entry',[[1786,1107.5],[1787.5,1107.5],[1787.5,1116.8],[1787.5,1125],[1793,1125]]),
    lane('ring-plaza',[[1787.5,1116.8],[1793,1116.8],[1793,1112],[1798,1112]],1),
    lane('ring-north-alley',[[1787.5,1107.5],[1787.5,1094.5],[1773,1094.5],[1773,1092.5]],1),
    lane('ring-west-stalls',[[1787.5,1116.8],[1759,1116.8]],.8)
  ];
  const core=make('ring-community-surface','RiNG社区·废站地表与下沉入口',['ring-community','ring-live'],[1790,1111],under,
    [[1759,1080],[1806,1080],[1814,1098],[1814,1113],[1788,1113],[1788,1121],[1759,1121]],
    [part(1773,1106,24,17,8,under,.72),...reused,part(1790,1085,6,4,2),part(1793,1090,4,3,2.7),part(1765,1119,4,3,2),part(1771,1119,4,3,2.5),part(1777,1119,4,3,2),part(1783,1119,4,3,1.6)],
    {plazas:[{id:'ring-neutral-square',points:rect(1793,1111.8,11,6),label:'社区核心广场'}],lanes:coreLanes,
      stairs:[{id:'ring-transfer-stairs',points:rect(1795,1110.2,5,2),label:'废站入口 ↓ B1—B3'}],
      walkways:[{id:'ring-tin-walkway',points:[[1763,1115.8],[1784,1115.8]],height:3.2,width:.8}],parkingBays:[]});
  core.floors={above:3,below:3,buildingPart:0,underground:'沿废弃地下换乘大厅向下延伸；地图只表达入口，不重建地下可游览空间。'};
  core.reusedMicroIndices=copy(NEW_REUSED_MICRO);
  core.partRoles=['RING-Live!三层地表建筑',...reused.map(()=> '废站棚户屋顶'),'旧楼加建屋','电缆间','器材修补摊','二手乐器摊','热食摊','街口值守棚'];
  const beni=make('beni-transition-surface','红花街·贫民社区与普通住区交界',['beni-street','a-yang-clinic'],[1796,1124],under,
    [[1789,1114],[1809,1114],[1809,1127],[1789,1127]], [part(1804,1118,7,5,4.5,under,.58)],
    {plazas:[],lanes:[lane('beni-main',[[1793,1125],[1808,1125],[1810.94,1122.74]]),lane('clinic-door',[[1804,1125],[1804,1121.5]],.8)],
      stairs:[{id:'beni-street-steps',points:rect(1797,1118,2.5,4),label:'上下巷道'}],
      walkways:[{id:'beni-tin-bridge',points:[[1797,1115],[1802,1115]],height:3,width:.8}],parkingBays:[]});
  beni.transition={from:'RiNG棚户与灰色巷道',to:'普通住区与通勤街',regionIds:['underpool','neonring'],governance:'三不管地带；地图归属只用于检索，不代表管辖权。'};
  const circle=make('circle-peripheral-site','CiRCLE·社区外围独立场馆',['circle'],[1778,1139],neon,rect(1778,1139,24,18),
    [part(1778,1139,19,12,6,neon,.62)],
    {plazas:[{points:rect(1778,1131.5,20,2),label:'场馆前沿'}],lanes:[lane('circle-to-beni',[[1778,1132],[1778,1125],[1787.5,1125]])],stairs:[],walkways:[],parkingBays:[]});
  circle.capacityNote='约500人；保留CRYCHIC既有事件，独立于RING-Live!。';
  const parking=make('space-parking-site','SPACE旧址·公司停车场',['space-site'],[1768,1087],under,rect(1768,1087,16,11),
    [part(1762.5,1083.5,2,2,.8,under,.38)],
    {plazas:[],lanes:[lane('space-gate',[[1773,1092.5],[1773,1090.5]],1)],stairs:[],walkways:[],
      parkingBays:[0,1,2].map(i=>({points:[[1765+i*3.3,1083],[1765+i*3.3,1087.5],[1767.5+i*3.3,1087.5]]}))});
  parking.closedSince='2049年末';parking.currentUse='公司收购后的停车场';
  for(const row of COMMUNITY_MIGRATIONS){
    const n=data.nodes.find(n=>n.id===row.id);
    n.at=copy(row.at);n.group=row.group;if(row.cat)n.cat=row.cat;if(row.type)n.type=row.type;
    if(row.source)n.source=row.source;
    n.posBasis='M10概念迁址';n.posNote=row.reason;
    n.migration={id:COMMUNITY_MIGRATION_ID,fromAt:copy(row.fromAt),fromGroup:row.fromGroup,coordinateBasis:'概念地图坐标；保留的lon/lat仅为旧来源定位，不能反投影解释为新址实测经纬度。'};
    if(row.fromSource)n.migration.fromSource=row.fromSource;
  }
  terrain.complexes=terrain.complexes.filter(s=>s.id!=='ring-community-surface').concat([core,beni,circle,parking]);
  terrain.reusedMicroIndices=copy(NEW_REUSED_MICRO);
  data.serviceTypes.push({id:'parking',name:'停车场／旧址',group:'都市设施',color:'#91a7b2'});
  const newComplexParts=core.parts.length+beni.parts.length+circle.parts.length+parking.parts.length;
  const netAdded=newComplexParts-old.parts.length+OLD_REUSED_MICRO.length-NEW_REUSED_MICRO.length,beforeTotal=data.fullCentral.metrics.totalBuildingObjects;
  data.fullCentral.metrics.totalBuildingObjects=beforeTotal+netAdded;
  terrain.communityMigration={id:COMMUNITY_MIGRATION_ID,rows:copy(COMMUNITY_MIGRATIONS),restoredMicroIndices:copy(OLD_REUSED_MICRO),reusedMicroIndices:copy(NEW_REUSED_MICRO),
    drawingObjects:{removedOldComplexParts:old.parts.length,newComplexParts,restoredOrdinaryRoofs:OLD_REUSED_MICRO.length,suppressedReusedRoofs:NEW_REUSED_MICRO.length,netAdded,beforeTotal,afterTotal:beforeTotal+netAdded},
    access:{id:'community-east-access',streetIndex:52,at:[1810.94,1122.74],kind:'existing-street-endpoint'},
    sourceFiles:['003.txt','021.txt','036.txt','037.txt','042.txt'],sourceBasis:"卡片源码/字段快照/components/worldbook，正式文本只读；地图大区不是世界书行政或经济定案。",
    evidence:'完整足迹与路径离线几何检查；概念图非米制施工图。尚需浏览器与真实宿主分别验证。'};
  terrain.metrics={...terrain.metrics,communityGroups:4,reusedMicro:NEW_REUSED_MICRO.length,newEntrance:0,newCommunityParts:core.parts.length-reused.length+beni.parts.length+circle.parts.length+parking.parts.length,
    communityBasis:'世界书003/021/036/037/042；六地点精确迁移，原8棚顶恢复，6个新址普通屋顶只复用一次，正式卡与普通楼路未改。'};
  return data;
}
