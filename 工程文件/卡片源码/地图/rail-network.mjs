// 2051概念轨交：借用已冻结的交通走廊；只交付地图线路、站点与安全落墩位置。
import {contains,inPolygon,roadDistance,plotsOverlap} from './atlas-source.mjs';
import {detailFootprint} from './city-detail.mjs';

const round=n=>Math.round(n*100)/100;
const mix=(a,b,t)=>a.map((v,i)=>round(v+(b[i]-v)*t));
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
const square=(at,r)=>[[at[0]-r,at[1]-r],[at[0]+r,at[1]-r],[at[0]+r,at[1]+r],[at[0]-r,at[1]+r]];
const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.03;
const heightAt=(s,at)=>{for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i];if(roadDistance(at,[a,b])<.03){const t=Math.min(1,Math.hypot(at[0]-a[0],at[1]-a[1])/Math.hypot(b[0]-a[0],b[1]-a[1]));return round(s.heights[i-1]+(s.heights[i]-s.heights[i-1])*t);}}return 0;};

export function buildRailNetwork(data){
  const {regions,roads,rivers,landmass}=data;
  const city=data.cityDetail,expansion=data.districtExpansion,terrain=data.terrainContext;
  const onLand=p=>landmass.some(poly=>contains(p,poly))||regions.some(r=>r.polygons.some(poly=>inPolygon(p,poly)));
  const built=[...data.footprints,...data.complexes.flatMap(c=>c.footprints),...(city?.microFootprints||[]),...(city?.harbor||[]).map(detailFootprint),...(expansion?.footprints||[]),...(expansion?.microFootprints||[]),...(terrain?.complexes||[]).flatMap(c=>c.footprints)];
  const reserved=[...data.specialSites.map(s=>({points:s.points,gap:s.setback})),...(city?.harborPlots||[]).map(p=>({points:p.points,gap:2})),...data.grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:1})),...(expansion?.landmarks||[]).map(l=>({points:l.points,gap:2})),...(terrain?.complexes||[]).map(c=>({points:c.points,gap:2}))];
  const obstacles=[...built.map(points=>({points,gap:1.5})),...reserved];
  const isClear=(at,r=1.2)=>{
    const fp=square(at,r);
    return fp.every(onLand)&&!rivers.some(river=>roadDistance(at,river.points)<river.width/2+r+3)&&!obstacles.some(o=>plotsOverlap(fp,o.points,o.gap));
  };
  const road=name=>{const r=roads.find(r=>r.name===name);if(!r)throw Error('Missing rail corridor: '+name);return r;};
  const segment=(points,mode,roadName)=>({points:points.map(p=>p.slice()),mode,height:mode==='elevated'?6:0,...(roadName?{roadName}:{})});
  const core=road('山手环线'),west=road('西部外环'),south=road('西南联络线');
  const routes=[
    {id:'R1',code:'R1',name:'山手城市环线',color:'#89b69e',desc:'借用山手环线走廊，连接皇核、霓环与方舟北口；受既有建筑约束的路段转入地下。',segments:core.points.slice(1).map((p,i)=>segment([core.points[i],p],'elevated',core.name))},
    {id:'R2',code:'R2',name:'都市外围环线',color:'#b49a6e',desc:'沿西部外环连接所泽、埼玉、千叶与川崎。湾段为规划地下连接，地图虚线不代表海上高架。',segments:[
      ...west.points.slice(1,9).map((p,i)=>segment([west.points[i],p],'elevated',west.name)),
      segment([west.points[8],[2565,2145],[2370,2158],south.points[4]],'tunnel'),
      segment(south.points.slice(4),'surface',south.name),
      segment([south.points.at(-1),west.points[0]],'tunnel')
    ]}
  ];
  // Keep overhead lines out of building masses; tunnel portals are schematic, not new land works.
  for(const route of routes){
    for(const s of route.segments){
      if(s.mode!=='elevated')continue;
      const hits=built.some(fp=>plotsOverlap(fp,s.points,1.2))||reserved.some(o=>plotsOverlap(o.points,s.points,o.gap));
      if(hits){s.mode='tunnel';s.height=0;}
    }
    // A non-elevated neighbour meets this line at ground level. Short spans lower their crest.
    route.segments.forEach((s,i)=>{
      if(s.mode!=='elevated'){s.heights=s.points.map(()=>0);return;}
      const previous=route.segments[(i+route.segments.length-1)%route.segments.length],next=route.segments[(i+1)%route.segments.length];
      const total=length(s.points),start=previous.mode==='elevated'?6:0,end=next.mode==='elevated'?6:0;
      const ramp=Math.min(120,total/(start===0&&end===0?2:1)),crest=Math.min(6,ramp*.05),a=s.points[0],b=s.points.at(-1);
      const positions=[0,...(start===0?[ramp]:[]),...(end===0?[total-ramp]:[]),total].sort((a,b)=>a-b).filter((n,j,values)=>j===0||n-values[j-1]>.01);
      s.points=positions.map(distance=>mix(a,b,distance/total));
      s.heights=positions.map(distance=>round(Math.min(crest,start===0?distance*.05:6,end===0?(total-distance)*.05:6)));
    });
    route.points=route.segments.flatMap((s,i)=>i?s.points.slice(1):s.points);
    if(!same(route.points[0],route.points.at(-1)))throw Error(route.id+' is not a closed ring');
  }
  // Each platform is chosen from its named corridor; it must be on dry, unoccupied land.
  const targets=[
    ['R1','皇核北口',0,.48],['R1','皇核东',1,.5],['R1','内湾联络',2,.54],
    ['R1','方舟北环',3,.5],['R1','霓环西',4,.5],['R1','暗池南环',5,.54],
    ['R2','环西南',0,.08],['R2','所泽东环',2,.82],['R2','埼玉南环',4,.09],
    ['R2','千叶西环',6,.42],['R2','京滨湾口',9,.05],['R2','川崎西环',9,.76]
  ];
  const stops=[];
  for(const [routeId,name,index,fraction] of targets){
    const route=routes.find(r=>r.id===routeId),s=route.segments[index],total=length(s.points);
    const atDistance=distance=>{for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<=len||i===s.points.length-1)return mix(a,b,Math.max(0,Math.min(1,distance/len)));distance-=len;}};
    const offsets=[0];for(let d=8;d<=160;d+=8)offsets.push(d,-d);
    const at=offsets.map(delta=>atDistance(Math.max(3,Math.min(total-3,total*fraction+delta)))).find(p=>isClear(p,2.2)&&!stops.some(other=>Math.hypot(p[0]-other.at[0],p[1]-other.at[1])<50));
    if(!at)throw Error('No safe station position: '+name);
    const group=regions.filter(r=>r.kind!=='overlay').sort((a,b)=>Math.hypot(a.at[0]-at[0],a.at[1]-at[1])-Math.hypot(b.at[0]-at[0],b.at[1]-at[1]))[0].id;
    stops.push({id:'rail-'+routeId.toLowerCase()+'-'+stops.filter(p=>p.routeIds.includes(routeId)).length,name,at,routeIds:[routeId],group,kind:'rail',mode:s.mode,height:heightAt(s,at)});
  }
  for(const route of routes){
    const along=stop=>{let dist=0;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i];if(roadDistance(stop.at,[a,b])<.03)return dist+Math.hypot(stop.at[0]-a[0],stop.at[1]-a[1]);dist+=Math.hypot(b[0]-a[0],b[1]-a[1]);}return Infinity;};
    route.stops=stops.filter(s=>s.routeIds.includes(route.id)).sort((a,b)=>along(a)-along(b)).map(s=>s.id);
  }
  const candidates=[];
  for(const route of routes){
    for(const s of route.segments.filter(s=>s.mode==='elevated'))for(let i=1;i<s.points.length;i++){
      const a=s.points[i-1],b=s.points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let distance=12;distance<len-8;distance+=34){const at=mix(a,b,distance/len),height=heightAt(s,at);if(height>=1.2&&isClear(at)&&!stops.some(stop=>Math.hypot(stop.at[0]-at[0],stop.at[1]-at[1])<12)&&!(expansion?.roads||[]).some(lane=>roadDistance(at,lane.points)<lane.width/2+2.5))candidates.push({at,height,routeId:route.id});}
    }
  }
  // Distribute one network-wide budget: a short inner ring must not strand an outer-ring quota.
  const count=Math.min(56,candidates.length),piers=Array.from({length:count},(_,i)=>candidates[Math.floor(i*candidates.length/count)]);
  const modeLengths={surface:0,elevated:0,tunnel:0};
  for(const route of routes)for(const s of route.segments)modeLengths[s.mode]+=length(s.points);
  return {routes,stops,piers,metrics:{routes:routes.length,stops:stops.length,piers:piers.length,modeLengths:Object.fromEntries(Object.entries(modeLengths).map(([key,value])=>[key,round(value)])),roadAlignedLength:round(routes.flatMap(r=>r.segments).filter(s=>s.roadName).reduce((sum,s)=>sum+length(s.points),0))}};
}
