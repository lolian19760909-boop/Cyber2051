// 手工维护：概念区域、交通骨架与公司广场造型。不是行政测绘或新世界书正文。
export const world = {width:3600,height:3200,offset:[450,200],scale:1.4};
export const expand=p=>[Math.round((400+(p[0]-200)*world.scale)*100)/100,Math.round((220+(p[1]-200)*world.scale)*100)/100];
export const oldStyles = {
  imperial:['#d65058',17,0.95],underpool:['#7e6acd',-12,0.82],
  lowtown:['#6ea860',7,0.96],neonring:['#d8a748',24,0.9],
  tsurumaki:['#54b69e',-8,0.67],keihin:['#5a94d4',18,0.86],west:['#a4a8aa',-14,0.57]
};
// 2051 概念分配，单位万人；总量5960万，对齐既有世界书“接近六千万”。不是现实统计。
export const populationWan={imperial:340,underpool:580,lowtown:860,neonring:360,tsurumaki:520,keihin:490,west:440,minato:160,saitama:640,hokuen:280,kai:210,fuji:120,sagami:480,chiba:550,docks:90};
// 港区是环湾功能覆盖；160万为沿岸覆盖人口子集，已计入京滨、千叶、木更津。
export const minatoRegion={id:'minato',name:'环湾港区',en:'TOKYO BAY HARBOR',cover:'东京湾沿岸 / 货运码头 · 客运港 · 工业岸线',color:'#c77995',angle:11,density:.56,kind:'overlay',populationScope:'subset',polygons:[]};
export const mapStyle={water:'#030610',land:'#0b101b',roof:['#51121e','#75202d','#9e303c'],side:'#290c15',front:'#45111e',edge:'#dc5c598a',road:'#54c6d3',yard:'#17101b',park:'#0c1d23'};
// 地名锚定水域，不参与屏幕标签的避让或吸边。
export const bayLabel={at:[2530,2220],maxZoom:1.15};
const districtDrafts = [
  {id:'saitama',name:'埼玉脊带',en:'SAITAMA SPINE',color:'#b79857',cover:'核心北侧 · 荒川上游方向',angle:8,density:.88,at:[1370,455],polygon:[[865,470],[1000,280],[1290,255],[1545,325],[1730,480],[1740,695],[1560,725],[1400,575],[1110,690],[920,680]]},
  {id:'hokuen',name:'北垣机造',en:'HOKUEN WORKS',color:'#668ea9',cover:'核心西北 · 机造走廊',angle:-18,density:.75,at:[760,650],polygon:[[570,590],[655,415],[890,435],[1030,600],[980,810],[1080,900],[920,995],[675,890],[615,740]]},
  {id:'kai',name:'甲斐层城',en:'KAI TERRACES',color:'#957baf',cover:'西侧 · 山地都市带',angle:-26,density:.67,at:[400,1020],polygon:[[255,835],[450,730],[625,760],[805,915],[735,1100],[755,1280],[585,1340],[365,1260],[235,1090]]},
  {id:'fuji',name:'富士环园',en:'FUJI CIRCUIT',color:'#83a98d',cover:'西南外缘 · 环园开发带',angle:-7,density:.5,at:[620,1540],polygon:[[385,1260],[570,1310],[735,1270],[885,1420],[965,1630],[860,1835],[630,1855],[430,1710],[340,1490]]},
  {id:'sagami',name:'相模南岸',en:'SAGAMI COAST',color:'#747bc3',cover:'南西沿岸 · 京滨外缘',angle:22,density:.85,at:[1200,1440],polygon:[[790,1240],[1030,1280],[1200,1340],[1430,1420],[1580,1500],[1510,1600],[1370,1590],[1170,1530],[1000,1480],[845,1380]]},
  {id:'chiba',name:'千叶镜湾',en:'CHIBA MIRROR BAY',color:'#47b1ab',cover:'湾东 · 滨水新城',angle:12,density:.87,at:[1990,995],polygon:[[1730,605],[1985,660],[2160,835],[2175,1120],[2100,1370],[1970,1320],[1940,1130],[1780,1010],[1690,810]]},
  {id:'docks',name:'外海船坞',en:'OUTER DOCKLANDS',color:'#bc785f',cover:'湾口东南 · 外港船坞带',angle:0,density:.81,at:[2000,1580],polygon:[[1970,1270],[2130,1340],[2200,1500],[2180,1740],[2060,1870],[1955,1840],[1955,1740],[1800,1715],[1800,1660],[1960,1640],[1960,1565],[1830,1540],[1830,1490],[1990,1480],[2015,1400],[1890,1370]]}
];
// Keep the expansion comparable in built-up extent to the established core.
const settle=p=>[Math.round(1270+(p[0]-1270)*.8),Math.round(1050+(p[1]-1050)*.8)];
const geography={saitama:['埼玉','SAITAMA','都市北侧 · 荒川上游与住区走廊'],hokuen:['所泽','TOKOROZAWA','西北外缘 · 武藏野台地与产业用地'],kai:['山梨','YAMANASHI','西侧山地 · 台地与山谷都市'],fuji:['富士山域','FUJI','西南外缘 · 大型公园与边缘开发带'],sagami:['川崎','KAWASAKI','核心西南 · 京滨延伸与带状产业走廊'],chiba:['千叶','CHIBA','东京湾东侧 · 滨水新城'],docks:['木更津','KISARAZU','湾口东南 · 指状港池与码头']};
const outward={saitama:[0,-130],hokuen:[-235,-115],kai:[-130,0],fuji:[-115,120],sagami:[0,270],chiba:[135,0],docks:[135,150]};
export const newRegions=districtDrafts.map(r=>{const shift=p=>{const v=settle(p),d=outward[r.id];return expand([v[0]+d[0],v[1]+d[1]]);};const [name,en,cover]=geography[r.id],at=shift(r.at);return {...r,name,en,cover,at,polygon:r.polygon.map(shift).map(p=>p.map((v,i)=>Math.round((at[i]+(v-at[i])*.94)*100)/100))};});
// 三段海岸合成环湾带；中央水面保持开放。设施是概念提案，不是测绘。
export const bayCoastlines=[
 [[1440,1140],[1480,1250],[1510,1340],[1620,1460],[1590,1650],[1535,1775]],
 [[1480,1250],[1615,1160],[1720,1140],[1815,1180],[1890,1190]],
 [[1890,1190],[1940,1300],[1925,1450],[1875,1570],[1835,1690],[1845,1850]]
].map(points=>points.map(expand));
export const portSites=[
 {id:'west-terminal',name:'湾西货运港',at:[2382,2124],angle:18,layout:'cargo',buildings:[[-72,-48,38,20,6],[-72,-12,38,20,6],[-72,24,38,20,6]],group:'minato',type:'transit',access:[[2206,2026],[2240,2050],[2303,2098]],desc:'东京湾西岸的货运港。长仓库与集装箱堆场沿岸展开，岸桥连接三条装卸泊位。'},
 {id:'bay-terminal',name:'湾岸客运码头',at:[2737,1707],angle:-5,layout:'passenger',buildings:[[-12,-35,21,70,8],[14,-23,40,22,5],[14,7,31,24,5]],group:'minato',type:'transit',access:[[2797,1702],[2801,1701]],desc:'沿东京湾东岸布置的客运码头。候船楼连接窄长栈桥，内侧道路与滨水街区相接。'},
 {id:'east-terminal',name:'木更津发射中心',at:[2950,2400],angle:0,layout:'launch',buildings:[[-59,-34,40,26,11],[-58,11,31,24,7]],gantry:{at:[28,-10],span:14,height:18},group:'docks',type:'spaceport',desc:'木更津外港南侧的发射中心。发射坪、总装库与港口物流相连，安全隔离带围绕发射设施布置。'}
];
export const landmass=[
 [[200,500],[480,240],[1440,190],[1690,400],[1760,770],[1780,1010],[1640,1190],[1550,1330],[1650,1480],[1590,1680],[1480,1790],[1130,1850],[850,1980],[430,1880],[190,1630]],
 [[1680,570],[2020,520],[2270,780],[2240,2080],[2070,2180],[1740,2000],[1730,1790],[1790,1570],[1870,1400],[1850,1190],[1780,1000],[1670,810]]
].map(r=>r.map(expand));
export const districtArt={
 imperial:{theme:'总部中轴与受控庭院',shapes:[3,4,0],street:'grid'},
 underpool:{theme:'旧街夹缝与轨道切口',shapes:[3,0,2],street:'irregular'},
 lowtown:{theme:'沿河排屋与回收工场',shapes:[1,0,3],street:'lanes'},
 neonring:{theme:'商场巨顶与车站放射街路',shapes:[4,3,5],street:'radial'},
 tsurumaki:{theme:'曲街宅院与树带',shapes:[3,4,0],street:'curved'},
 keihin:{theme:'港池仓库与物流新城',shapes:[1,3,0],street:'lanes'},
 west:{theme:'田块穿入近郊旧镇',shapes:[0,3,1],street:'curved'},
 minato:{theme:'港池、长仓库与连续工业岸线',shapes:[1,5,4],street:'grid'},
 saitama:{theme:'交通脊线与成组板楼住区',shapes:[1,4,0],street:'lanes'},
 hokuen:{theme:'装配园区与设备大院',shapes:[1,3,5],street:'grid'},
 kai:{theme:'等高线台地与跨谷组团',shapes:[3,4,0],street:'curved'},
 fuji:{theme:'山林、环园步道与稀疏边城',shapes:[5,0,3],street:'curved'},
 sagami:{theme:'平行货运线与带状工厂',shapes:[1,3,0],street:'lanes'},
 chiba:{theme:'水道新城与滨水阶梯平台',shapes:[4,3,5],street:'grid'},
 docks:{theme:'外港堆场与沿海发射中心',shapes:[1,3,0],street:'lanes'}
};
// 经过已有地点的交通线会在构建时添加；以下只描述视觉主路，不承诺交通玩法。
export const arterial = [
  {name:'都市北脊线',elevation:5,endElevation:3,width:5,points:[[570,1020],[700,740],[1030,770],[1345,530],[1610,730],[1850,1000],[1855,1500],[1920,1500]]},
  {name:'西南联络线',elevation:0,width:6,points:[[580,1060],[810,1100],[950,1195],[1240,1340],[1490,1490],[1280,1600],[850,1520]]},
  {name:'跨湾高架',elevation:6,endElevation:0,width:5,points:[[1320,1210],[1540,1330],[1700,1390],[1760,1540],[1760,1710],[1815,1695],[1907.14,1785.71],[1975.71,1785.71]]},
  {name:'西部外环',elevation:3,endElevation:0,width:4,points:[[850,1590],[650,1410],[580,1040],[665,660],[1090,575],[1420,500],[1735,800],[1910,1110],[1920,1500],[1965,1460],[1965,1290],[1915,1257.86]]}
];
export const wardRegions={13101:'imperial',13102:'imperial',13103:'minato',13105:'imperial',13104:'neonring',13113:'neonring',13110:'neonring',13116:'underpool',13119:'underpool',13120:'underpool',13117:'lowtown',13118:'lowtown',13106:'lowtown',13121:'lowtown',13122:'lowtown',13107:'lowtown',13123:'lowtown',13112:'tsurumaki',13115:'tsurumaki',13114:'tsurumaki',13109:'keihin',13111:'keihin',13108:'keihin',13203:'west',13204:'west'};
export function project(lon,lat){return expand([(lon-139.45)*1580/.53+world.offset[0],(35.90-lat)*1580/.53*110.57/(111.32*Math.cos(35.7*Math.PI/180))+world.offset[1]]);}
export function contains(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function inPolygon(p,rings){return contains(p,rings[0])&&!rings.slice(1).some(r=>contains(p,r));}
export function roadDistance(p,line){let min=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));min=Math.min(min,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return min;}
// 包含、边相交和最近边距一起检查；不能只检查楼体中心或顶点。
export function plotsOverlap(a,b,gap=0){
  if(a.some(p=>contains(p,b))||b.some(p=>contains(p,a)))return true;
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
    const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
    if(Math.max(p[0],q[0])>=Math.min(r[0],s[0])&&Math.max(r[0],s[0])>=Math.min(p[0],q[0])&&Math.max(p[1],q[1])>=Math.min(r[1],s[1])&&Math.max(r[1],s[1])>=Math.min(p[1],q[1])&&cross(p,q,r)*cross(p,q,s)<=0&&cross(r,s,p)*cross(r,s,q)<=0)return true;
    if(Math.min(roadDistance(p,[r,s]),roadDistance(q,[r,s]),roadDistance(r,[p,q]),roadDistance(s,[p,q]))<=gap)return true;
  }return false;
}
