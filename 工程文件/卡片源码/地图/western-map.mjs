// A separate, deliberately compressed 2051 regional map. Coordinates are art units,
// not a survey projection; town/lake ordering follows the real Fuji–Yamanashi region.
const round=n=>Math.round(n*100)/100;
const bounds=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const ring=(at,rx,ry,phase=0,n=24)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2,r=1+.065*Math.sin(a*3+phase)+.04*Math.cos(a*5-phase);return [round(at[0]+Math.cos(a)*rx*r),round(at[1]+Math.sin(a)*ry*r)];});
const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const lineDistance=(p,pts)=>Math.min(...pts.slice(1).map((b,i)=>segmentDistance(p,pts[i],b)));
const crossesWater=(pts,waters)=>pts.slice(1).some((b,i)=>{const a=pts[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/5);return Array.from({length:steps+1},(_,k)=>[a[0]+(b[0]-a[0])*k/steps,a[1]+(b[1]-a[1])*k/steps]).some(p=>waters.some(l=>inside(p,l.points)));});
const footprint=b=>{const [x,y,w,d,,angle]=b,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[round(x+u*c-v*s),round(y+u*s+v*c)]);};

export function buildWesternMap(frozenM7){
 let seed=2051776;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const clone=v=>JSON.parse(JSON.stringify(v));
 const regionSpecs=[
  ['west-yamanashi','山梨盆地','YAMANASHI BASIN','#c19969',[1110,500],[[180,200],[1180,150],[1730,310],[2070,560],[2600,640],[2750,980],[2450,1200],[2020,1180],[1720,950],[1320,1150],[820,1140],[410,960],[180,580]],'盆地低层城区、果园与谷地物流走廊'],
  ['west-fuji','富士五湖','FUJI HIGHLANDS','#889d87',[1380,1540],[[410,960],[820,1140],[1320,1150],[1720,950],[2020,1180],[2330,1330],[2350,1860],[2190,2350],[1030,2450],[560,2240],[320,1670]],'五湖沿岸聚落、山林与富士火山体'],
  ['west-gotemba','御殿场','GOTEMBA GATEWAY','#ac737b',[2720,1740],[[2450,1200],[2900,1150],[3070,1610],[2990,2300],[2680,2480],[2190,2350],[2350,1860],[2330,1330]],'山麓市街、仓储工场与东部交通门户']
 ];
 const regions=regionSpecs.map(([id,name,en,color,at,points,theme])=>({id,name,en,color,at,kind:'new',polygons:[[points]],bounds:bounds(points),cover:theme,desc:theme+'。地貌和地名参考现实；2051年的设施与聚落布局属于本作地图设定。',dims:[],art:{theme,shapes:['低层街屋','独立仓储','院落组团'],street:'依山就势'},density:.35,angle:0}));
 const waters=[['motosu','本栖湖',[730,1320],84,107,.2],['shoji','精进湖',[915,1170],39,38,1.1],['saiko','西湖',[1160,1210],110,39,.5],['kawaguchi','河口湖',[1510,1137],154,59,1.8],['yamanaka','山中湖',[2215,1480],123,52,.8]].map(([id,name,at,rx,ry,phase])=>({id:'west-lake-'+id,name,at,points:ring(at,rx,ry,phase),color:'#030610'}));
 const landmass=[[[100,150],[1040,90],[1640,210],[2230,480],[2840,590],[3100,1170],[3160,1990],[2910,2520],[2210,2600],[1160,2560],[470,2370],[170,1940],[70,1080]]];
 const data={schemaVersion:clone(frozenM7.schemaVersion),mapId:'west-expansion',mapVersion:'west-1',displayName:'西部大区 · 山梨与富士',mapStyle:clone(frozenM7.mapStyle),icons:clone(frozenM7.icons),serviceTypes:clone(frozenM7.serviceTypes),detailRegions:regions.map(r=>r.id),world:{minX:0,minY:0,width:3250,height:2700,offset:[0,0],scale:1},bounds:[100,100,3150,2550],overviewBounds:[100,100,3150,2550],initialView:{x:1610,y:1325,z:.3,mode:'auto'},landmass,regions,nodes:[],services:[],roads:[],rivers:[],streets:[],grounds:[],buildings:[],footprints:[],features:[],portSites:[],landmarks:[],bridges:[],specialSites:[],complexes:[],geographyWaters:waters,geographyPeaks:[],cityDetail:{harbor:[],harborPlots:[],harborLanes:[],micro:[],microFootprints:[],tram:{routes:[],stops:[]}},districtExpansion:{districts:[],buildings:[],footprints:[],micro:[],microFootprints:[],places:[],landmarks:[],roads:[]},terrainContext:{contours:[],complexes:[],places:[],reusedMicroIndices:[]},railNetwork:{routes:[],stops:[],piers:[]},provenance:{geography:'现实地名与相对方位参考，概念式2051区域地图；距离、边界和建筑非测绘复刻。',sources:['https://www.gsi.go.jp/REPORT/JIHO/vol104-6.htm','https://www.gsi.go.jp/kikaku/tenkei_kanto.html','https://www.fujisan-3776.jp/info-lib/documents/jpn_sekaiisanfujisan.pdf']}};
 const addRoad=(name,points,width=3)=>data.roads.push({name,points,width,elevation:0});
 addRoad('甲府盆地干线',[[320,450],[590,480],[790,540],[950,660],[1210,735],[1480,780],[1760,750],[1980,790],[2220,820],[2630,940]],4.5);
 addRoad('御坂—富士北麓通道',[[950,660],[1000,855],[1120,987],[1350,1040],[1730,1045],[1800,1160],[1780,1240],[1940,1360]],3.2);
 addRoad('富士东麓干线',[[1940,1360],[2080,1355],[2300,1370],[2410,1540],[2430,1710],[2570,1790],[2660,1930],[2700,2240]],3.4);
 addRoad('大月谷地通道',[[2220,820],[2300,1020],[2440,1190],[2460,1370],[2410,1540]],3);
 addRoad('五湖沿岸联络道',[[530,1430],[610,1200],[815,1125],[950,1100],[1050,1125],[1240,1130],[1340,1205],[1395,1280],[1570,1250],[1780,1240],[1940,1360]],2.5);
 addRoad('鸣泽山麓道',[[610,1200],[555,1435],[810,1490],[980,1440],[1110,1420],[1340,1370],[1570,1250]],2.2);
 addRoad('西麓林间公路',[[590,480],[550,750],[650,900],[560,1050],[500,1510],[640,1690],[770,1850],[1000,2250],[1440,2410],[1880,2400],[2220,2280],[2530,2160],[2660,1930]],2.3);
 data.rivers=[{name:'釜无川',width:7,points:[[380,220],[460,450],[515,720],[685,880],[845,970],[790,1110],[630,1240],[510,1550]]},{name:'笛吹川',width:5,points:[[1420,390],[1340,550],[1250,710],[1050,865],[845,970]]},{name:'桂川',width:4,points:[[2000,1320],[2110,1200],[2115,1000],[2220,930],[2440,875],[2690,960]]}];
 const fuji={id:'west-fuji-peak',name:'富士山',at:[1650,1880],height:190,meters:3776,baseRadius:370,color:'#8e7e85',rings:[]};
 for(let i=0;i<11;i++){const t=i/10,rx=370*(1-t*.925),ry=335*(1-t*.925),height=round(fuji.height*t);const points=ring([1650+8*t,1880-10*t],rx,ry,.6,40);fuji.rings.push({points,height});data.terrainContext.contours.push({id:'west-fuji-contour-'+i,points,level:i,height,region:'west-fuji',color:'#817a85'});}
 data.geographyPeaks.push(fuji);
 for(const [id,at,rx,ry,ri,phase] of [['southern-alps',[320,680],175,470,0,.3],['chichibu',[1290,365],550,190,0,1.2],['misaka',[1400,970],400,83,1,.7],['tanzawa',[2760,1230],180,190,2,1.7]])for(let k=0;k<4;k++)data.terrainContext.contours.push({id:`west-${id}-${k}`,points:ring(at,rx*(1-k*.14),ry*(1-k*.15),phase),level:k,height:k*10,region:regions[ri].id,color:'#536c69'});
 const towns=[
  ['kai','甲斐·韮崎','KAI / NIRASAKI',0,[610,490],165,145,84,'散落在河阶上的住宅、农产集散与小型工场。'],
  ['kofu','甲府城下','KOFU BASIN',0,[950,660],275,200,170,'盆地中心旧城；窄街、公共设施和少量高层围绕主干道生长。'],
  ['katsunuma','笛吹·胜沼','KATSUNUMA',0,[1500,790],200,145,95,'果园间的低层聚落，酿造仓库和沿路交易市场。'],
  ['otsuki','大月谷口','OTSUKI VALLEY',0,[2220,820],215,105,80,'沿山谷拉长的城镇，住宅贴着道路与河流展开。'],
  ['kawaguchi','河口湖南岸','KAWAGUCHIKO',1,[1560,1275],180,100,65,'湖岸旅馆、医疗点与水源维护设施；湖面保持开放。'],
  ['yoshida','富士吉田','FUJIYOSHIDA',1,[1940,1300],155,110,70,'北麓生活中心，织物作坊、街屋和山地补给院落。'],
  ['narusawa','鸣泽林缘','NARUSAWA',1,[1110,1440],180,95,55,'低密度林缘聚落；建筑在公路两侧成小群分布。'],
  ['gotemba','御殿场下城','GOTEMBA',2,[2660,1950],205,275,120,'山麓交通门户；宽大的物流屋顶与低层住宅街区并置。']
 ];
 const occupied=[];
 const reserveComplex=(id,name,at,ri,parts,w,d,desc)=>{const points=footprint([...at,w,d,0,0]),c={id,name,at,ri,region:regions[ri].id,type:'civic',size:[w,d],points,forecourt:[[at[0],at[1]+d/2],[at[0],at[1]+d/2+7]],parts:parts.map(p=>[at[0]+p[0],at[1]+p[1],...p.slice(2),ri,.5]),desc,nodeIds:[id]};c.footprints=c.parts.map(footprint);data.complexes.push(c);occupied.push({at,radius:Math.hypot(w,d)/2+5});data.nodes.push({id,name,at,cat:'地标',type:'landmark',group:regions[ri].id,desc,source:'西部大区 · 2051原创地图档案'});};
 reserveComplex('west-kofu-civic','甲府城下综合诊疗院',[1025,598],0,[[-14,0,18,33,13,0,4],[12,-10,22,13,8,0,0],[12,12,18,12,6,0,0]],55,50,'围合庭院连接诊疗楼与街区急救入口。这个盆地医疗节点服务甲府旧城和周边农产聚落。');
 reserveComplex('west-katsunuma-depot','胜沼农产交易所',[1500,850],0,[[-20,-8,23,36,8,-8,1],[12,8,28,17,6,-8,0]],78,62,'温控仓库与装卸院落分开，货车从城镇外侧进入，内部摊位朝向住宅街道。');
 reserveComplex('west-lake-waterworks','河口湖水源维护站',[1660,1340],1,[[-10,0,16,27,7,10,3],[11,-5,13,13,9,10,5]],49,43,'湖岸水务站由低矮机房、储水设施和维修院落组成。建筑退在岸线后方，保留环湖通行。');
 reserveComplex('west-yoshida-textile','富士吉田织物工坊',[2010,1260],1,[[-16,0,22,30,7,-12,1],[15,1,19,26,5,-12,1]],70,48,'两座不同年代的织物厂房围着装卸巷；临街小铺仍保留手工业市场的尺度。');
 reserveComplex('west-gotemba-logistics','御殿场山麓物流院',[2740,1850],2,[[-22,-9,30,42,10,8,1],[20,-9,27,42,8,8,1],[0,31,42,13,6,8,0]],102,100,'成组长屋顶仓库、大车回转庭院与低层管理楼形成东部入口的物流地标。');
 const placeTypes=['food','hospital','drop','market','implant','bar','weapon','netrunner'];
 for(const [ti,t] of towns.entries()){
  const [id,name,en,ri,at,rx,ry,count,desc]=t,points=ring(at,rx,ry,ti*.6,11),district={id:'west-town-'+id,name,en,parent:regions[ri].id,ri,at,points,bounds:bounds(points),kind:'subdistrict',theme:desc,desc,openSpaces:[]};data.districtExpansion.districts.push(district);
  const local=[];
  for(let j=0;j<5;j++){const yy=(j-2)*ry*.3,a=(ti%3-1)*.18;const pts=[[-rx*.92,yy-ry*.06],[-rx*.35,yy+ry*.07],[rx*.25,yy-ry*.1],[rx*.88,yy+ry*.03]].map(([x,y])=>[round(at[0]+x*Math.cos(a)-y*Math.sin(a)),round(at[1]+x*Math.sin(a)+y*Math.cos(a))]);local.push({name:name+'街巷'+(j+1),ri,points:pts,width:j===2?2.6:.9});}
  local.push({name:name+'横街',ri,width:1.7,points:[[at[0]-rx*.28,at[1]-ry*.8],[at[0]-rx*.06,at[1]-ry*.2],[at[0]+rx*.2,at[1]+ry*.2],[at[0]+rx*.15,at[1]+ry*.85]]});
  // Larger compounds displace a street instead of having a lane painted through a roof.
  for(let j=local.length-1;j>=0;j--)if(crossesWater(local[j].points,waters)||data.complexes.some(c=>lineDistance(c.at,local[j].points)<Math.hypot(...c.size)/2+4))local.splice(j,1);
  data.streets.push(...local);
  let made=0;
  for(let attempt=0;made<count&&attempt<30000;attempt++){
   const angle=rnd()*Math.PI*2,rad=Math.sqrt(rnd()),p=[round(at[0]+Math.cos(angle)*rx*rad*.95),round(at[1]+Math.sin(angle)*ry*rad*.94)],small=made%5!==0;
   const scale=id==='gotemba'&&!small?1.6:1,w=round((small?4+rnd()*6:10+rnd()*11)*scale),d=round((small?4+rnd()*6:8+rnd()*15)*scale),radius=Math.hypot(w,d)/2+1.4;
   if(!inside(p,points)||!inside(p,regionSpecs[ri][5])||waters.some(l=>inside(p,l.points)||lineDistance(p,[...l.points,l.points[0]])<radius+8)||Math.hypot((p[0]-1650)/370,(p[1]-1880)/335)<1.1)continue;
   if(data.rivers.some(r=>lineDistance(p,r.points)<r.width/2+radius+4)||data.roads.some(r=>lineDistance(p,r.points)<r.width/2+radius+3)||local.some(r=>lineDistance(p,r.points)<r.width/2+radius+1.4)||occupied.some(o=>Math.hypot(p[0]-o.at[0],p[1]-o.at[1])<radius+o.radius))continue;
   const nearest=local.reduce((a,b)=>lineDistance(p,a.points)<lineDistance(p,b.points)?a:b),seg=nearest.points,base=Math.atan2(seg.at(-1)[1]-seg[0][1],seg.at(-1)[0]-seg[0][0])*180/Math.PI,rot=round(base+(rnd()-.5)*(small?36:16)),h=small?round(2+rnd()*3):id==='kofu'?round(9+rnd()*17):round(5+rnd()*8),b=[...p,w,d,h,rot,small?0:made%6,ri,round(rnd())];
   if(small){data.cityDetail.micro.push({b,infill:false});data.cityDetail.microFootprints.push(footprint(b));}else{data.buildings.push(b);data.footprints.push(footprint(b));}
   occupied.push({at:p,radius});made++;
  }
  if(made!==count)throw new Error(name+' buildings: '+made+' / '+count);
  const p=data.cityDetail.micro.find(m=>inside(m.b,points))?.b.slice(0,2)||at,type=placeTypes[ti];data.services.push({id:'west-service-'+id,name:name+' · '+data.serviceTypes.find(s=>s.id===type).name,type,cat:data.serviceTypes.find(s=>s.id===type).name,group:regions[ri].id,at:p,desc:desc+' 可查看地点档案；交易、委托与剧情触发尚未接入。',source:'西部大区 · 原创服务点档案',proposal:true});
 }
 data.nodes.push({id:fuji.id,name:'富士山',at:fuji.at,cat:'自然地标',type:'landmark',group:'west-fuji',desc:'富士火山体位于五湖南侧。近景呈现连续锥坡、山顶火口与不完全对称的山麓；周边山林不按都市密度填充建筑。',source:'地理轮廓参考国土地理院；2051地图以概念尺度呈现。'});
 for(const lake of waters)data.nodes.push({id:lake.id,name:lake.name,at:lake.at,cat:'自然地标',type:'landmark',group:'west-fuji',desc:'富士五湖之一。湖面与岸线留作独立水域，生活设施沿岸外缘分布。',source:'富士山世界文化遗产官方资料 / 地图轮廓为概念化绘制'});
 const townStats=towns.map(t=>({id:'west-town-'+t[0],name:t[1],objects:t[7]}));
 data.metrics={regions:regions.length,subdistricts:towns.length,buildings:data.buildings.length,micro:data.cityDetail.micro.length,complexParts:data.complexes.reduce((n,c)=>n+c.parts.length,0),lakes:waters.length,contours:data.terrainContext.contours.length};data.metrics.objects=data.metrics.buildings+data.metrics.micro+data.metrics.complexParts;data.metrics.byTown=townStats;
 return data;
}
