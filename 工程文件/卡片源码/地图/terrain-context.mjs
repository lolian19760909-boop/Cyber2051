// 原创概念等高线；不是真实DEM，也不改变旧楼体/地面高度。
// RiNG只表现地面入口、棚户屋顶与公共空间，原地点身份保持不变。
import {contains,inPolygon,plotsOverlap} from './atlas-source.mjs';
import {detailFootprint} from './city-detail.mjs';
const round=n=>Math.round(n*100)/100;
const bounds=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
const near=(a,b,g)=>a[0]<=b[2]+g&&a[2]>=b[0]-g&&a[1]<=b[3]+g&&a[3]>=b[1]-g;
const samples=points=>points.flatMap((p,i)=>{const q=points[(i+1)%points.length],n=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/3));return Array.from({length:n},(_,j)=>p.map((v,k)=>v+(q[k]-v)*j/n));});
function hull(points){
  const p=[...new Map(points.map(q=>[q.join(','),q])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=items=>{const out=[];for(const q of items){while(out.length>1&&cross(out.at(-2),out.at(-1),q)<=0)out.pop();out.push(q);}return out;};
  return [...half(p).slice(0,-1),...half([...p].reverse()).slice(0,-1)];
}
export function buildTerrainContext(data){
  const onLand=p=>data.landmass.some(poly=>contains(p,poly))||data.regions.some(r=>r.polygons.some(poly=>inPolygon(p,poly)));
  const contours=[];
  const groups=[
    {region:'kai',offset:[-75,90],radius:[215,160],angle:-24,count:4,color:'#827785'},
    {region:'fuji',offset:[-20,90],radius:[220,170],angle:12,count:4,color:'#89745b'},
    {region:'west',offset:[-30,-35],radius:[115,85],angle:-18,count:3,color:'#746e80'},
    {region:'hokuen',offset:[-85,-65],radius:[165,110],angle:8,count:3,color:'#807660'}
  ];
  groups.forEach((g,gi)=>{
    const region=data.regions.find(r=>r.id===g.region),center=region.at.map((v,i)=>v+g.offset[i]),angle=g.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    const ring=(scale,level)=>Array.from({length:49},(_,i)=>{const a=i%48*Math.PI/24,wave=1+.1*Math.sin(a*3+gi)+.055*Math.cos(a*5-gi*.7),u=Math.cos(a)*g.radius[0]*scale*(1-level*.16)*wave,v=Math.sin(a)*g.radius[1]*scale*(1-level*.16)*wave;return [round(center[0]+u*c-v*s),round(center[1]+u*s+v*c)];});
    let scale=1;while(scale>.35&&!samples(ring(scale,0)).every(onLand))scale-=.05;
    if(!samples(ring(scale,0)).every(onLand))throw new Error('概念等高线缺少陆地范围：'+g.region);
    for(let level=0;level<g.count;level++){
      const points=ring(scale,level);if(!samples(points).every(onLand))throw new Error('概念等高线跨水：'+g.region+'/'+level);
      contours.push({id:'terrain-'+g.region+'-'+level,points,level,height:level,region:g.region,color:g.color});
    }
  });
  const node=data.nodes.find(n=>n.id==='ring-community'),live=data.nodes.find(n=>n.id==='ring-live');
  if(!node||!live)throw new Error('缺少原RiNG社区/场馆节点，不能另建替代身份');
  const ri=data.regions.findIndex(r=>r.id===node.group),region=data.regions[ri],city=data.cityDetail,expansion=data.districtExpansion;
  const obstacles=[...data.footprints.map(points=>({points,gap:1.4})),...data.specialSites.map(s=>({points:s.points,gap:s.setback+1})),...data.complexes.map(s=>({points:s.points,gap:2})),...city.microFootprints.map(points=>({points,gap:1.2})),...city.harborPlots.map(s=>({points:s.points,gap:3})),...data.grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:1})),...(expansion?.footprints||[]).map(points=>({points,gap:1.4})),...(expansion?.microFootprints||[]).map(points=>({points,gap:1.2})),...(expansion?.landmarks||[]).map(s=>({points:s.points,gap:3}))];
  for(const l of [...data.roads,...data.streets,...data.rivers.map(r=>({...r,width:r.width+8})),...city.harborLanes,...(expansion?.roads||[])])for(let i=1;i<l.points.length;i++)obstacles.push({points:[l.points[i-1],l.points[i]],gap:l.width/2+1});
  for(const o of obstacles)o.box=bounds(o.points);
  const clear=fp=>samples(fp).every(p=>onLand(p)&&region.polygons.some(poly=>inPolygon(p,poly)))&&!obstacles.some(o=>near(bounds(fp),o.box,o.gap)&&plotsOverlap(fp,o.points,o.gap));
  const candidates=[];
  // Existing location markers remain fixed; this is a nearby physical entrance roof.
  for(let y=live.at[1]-32;y<=live.at[1]+32;y+=2)for(let x=live.at[0]-32;x<=live.at[0]+32;x+=2)for(const angle of [0,18,48,72]){
    const b=[round(x),round(y),12,8,4.5,angle,0,ri,.68],fp=detailFootprint(b);
    if(clear(fp))candidates.push({b,fp,distance:Math.hypot(x-live.at[0],y-live.at[1])});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.b[0]-b.b[0]||a.b[1]-b.b[1]||a.b[5]-b.b[5]);
  if(!candidates.length)throw new Error('原RiNG周边没有合法小入口；禁止迁点或删除既有楼体');
  const entrance=candidates[0];
  const reusedMicroIndices=city.micro.map((m,index)=>({index,b:m.b,distance:Math.hypot(m.b[0]-node.at[0],m.b[1]-node.at[1])})).filter(m=>m.b[7]===ri&&m.distance<36&&samples(city.microFootprints[m.index]).every(p=>region.polygons.some(poly=>inPolygon(p,poly)))).sort((a,b)=>a.distance-b.distance||a.index-b.index).slice(0,9).map(m=>m.index);
  if(reusedMicroIndices.length<4)throw new Error('RiNG原点附近现有住区不足，不能伪造社区组团');
  const parts=reusedMicroIndices.map((index,i)=>{const b=[...city.micro[index].b];b[4]=round(Math.min(3.5,b[4]+(i%3===0?.5:0)));b[8]=round(.35+(i%4)*.12);return b;});
  parts.push(entrance.b);
  const footprints=[...reusedMicroIndices.map(index=>city.microFootprints[index].map(p=>[...p])),entrance.fp];
  const boundary=hull([...footprints.flat(),node.at,live.at]);
  const center=boundary.reduce((p,q)=>p.map((v,i)=>v+q[i]/boundary.length),[0,0]);
  let points=boundary.map(p=>p.map((v,i)=>round(v+(v-center[i])*.08)));
  if(!samples(points).every(onLand))points=boundary;
  // Short entry paving stays outside the new roof; it never continues through a shack.
  let forecourt=[];
  for(let i=0;i<entrance.fp.length;i++){
    const a=entrance.fp[i],b=entrance.fp[(i+1)%entrance.fp.length],middle=a.map((v,k)=>(v+b[k])/2),dx=middle[0]-entrance.b[0],dy=middle[1]-entrance.b[1],len=Math.hypot(dx,dy),line=[3.5,.65].map(t=>middle.map((v,k)=>round(v+(k?dy:dx)/len*t)));
    if(!obstacles.some(o=>near(bounds(line),o.box,.3)&&plotsOverlap(line,o.points,.3))&&!footprints.some(fp=>plotsOverlap(line,fp,.3))){forecourt=line;break;}
  }
  const complex={id:'ring-community-surface',name:'RiNG社区·地表入口',nodeIds:['ring-community','ring-live'],at:[...node.at],ri,points,size:[round(bounds(points)[2]-bounds(points)[0]),round(bounds(points)[3]-bounds(points)[1])],parts,footprints,forecourt};
  return {contours,complexes:[complex],places:[],reusedMicroIndices,metrics:{contourGroups:groups.length,contours:contours.length,maxConceptHeight:3,communityGroups:1,reusedMicro:reusedMicroIndices.length,newEntrance:1,communityAnchorId:node.id,liveAnchorId:live.id,terrainBasis:'原创概念线，非真实DEM；旧地面与楼体不抬升',communityBasis:'世界书003/036/042；仅绘地下社区的地面入口与现有棚户屋顶'}};
}
