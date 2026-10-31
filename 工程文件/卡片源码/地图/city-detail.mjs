// 构建时布置；小体块不参与地点身份、剧情或逐帧随机生成。
import {contains,inPolygon,roadDistance,plotsOverlap} from './atlas-source.mjs';
const round=n=>Math.round(n*100)/100;
const mix=(a,b,t)=>a.map((v,i)=>round(v+(b[i]-v)*t));
export function detailFootprint(b){const [x,y,w,d,,angle]=b,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[round(x+u*c-v*s),round(y+u*s+v*c)]);}
export function buildCityDetail(data){
  const {regions,roads,streets,rivers,landmass,specialSites,footprints,grounds}=data;
  let seed=205106;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const regionAt=p=>regions.findIndex(r=>r.polygons.some(poly=>inPolygon(p,poly)));
  const onLand=p=>landmass.some(poly=>contains(p,poly))||regionAt(p)>=0;
  const obstacles=[...footprints.map(points=>({points,gap:2})),...specialSites.map(s=>({points:s.points,gap:s.setback+2})),...grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:1}))];
  const lines=[...roads,...streets,...rivers.map(r=>({...r,width:r.width+9}))];
  // A spatial index is only used while building; the shipped map receives geometry.
  const bins=new Map(),key=(x,y)=>x+','+y;
  const cells=(fp,gap=0)=>{const xs=fp.map(p=>p[0]),ys=fp.map(p=>p[1]),out=[];for(let y=Math.floor((Math.min(...ys)-gap)/64);y<=Math.floor((Math.max(...ys)+gap)/64);y++)for(let x=Math.floor((Math.min(...xs)-gap)/64);x<=Math.floor((Math.max(...xs)+gap)/64);x++)out.push(key(x,y));return out;};
  const reserve=(points,gap=1)=>{const item={points,gap};for(const cell of cells(points,gap)){if(!bins.has(cell))bins.set(cell,[]);bins.get(cell).push(item);}};
  for(const o of obstacles)reserve(o.points,o.gap);
  for(const l of lines)for(let i=1;i<l.points.length;i++)reserve([l.points[i-1],l.points[i]],l.width/2+2);
  const clear=fp=>fp.every(onLand)&&![...new Set(cells(fp,3).flatMap(c=>bins.get(c)||[]))].some(o=>plotsOverlap(fp,o.points,o.gap));
  // Dock districts extend the existing ports inland: warehouses, tank farms and open yards.
  const harbor=[],harborPlots=[],harborLanes=[];
  const zones=[
    {id:'west-logistics',name:'湾西保税仓储带',at:[2298,2196],angle:18,ri:7},
    {id:'west-tanks',name:'京滨液体散货区',at:[2200,2300],angle:8,ri:5,scale:.58},
    {id:'east-logistics',name:'千叶港后物流带',at:[2990,1810],angle:-5,ri:13},
    {id:'kisarazu-yard',name:'木更津修造船作业带',at:[2840,2100],angle:0,ri:14}
  ];
  for(const zone of zones){
    const scale=zone.scale||1;
    const candidates=[];
    for(let dy=-160;dy<=160;dy+=20)for(let dx=-160;dx<=160;dx+=20)candidates.push({at:[zone.at[0]+dx,zone.at[1]+dy],distance:Math.hypot(dx,dy)});
    const plotCandidate=candidates.sort((a,b)=>a.distance-b.distance).find(p=>clear(detailFootprint([...p.at,164*scale,114*scale,0,zone.angle])));
    if(!plotCandidate)throw new Error('No clear port plot: '+zone.id);
    zone.at=plotCandidate.at;
    const a=zone.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),local=(u,v)=>[round(zone.at[0]+(u*c-v*s)*scale),round(zone.at[1]+(u*s+v*c)*scale)];
    // Different spans and setbacks leave the central service apron legible.
    const parts=zone.id==='west-tanks'?[[-36,-34,20,20,7,5],[0,-29,24,24,9,5],[35,-31,18,18,5,5],[-27,24,48,15,5,1],[34,27,16,24,12,0]]:
      zone.id==='kisarazu-yard'?[[-36,-31,57,14,8,1],[29,-26,26,34,12,1],[-30,29,62,17,5,1],[52,32,14,18,6,0],[-65,24,8,9,15,0]]:
      zone.id==='east-logistics'?[[-42,-30,64,25,7,1],[39,-35,28,22,5,1],[-35,30,40,17,4,1],[32,30,45,18,6,1],[66,0,10,13,14,0]]:
      [[-47,-32,52,20,5,1],[19,-39,33,28,8,1],[58,12,19,43,6,1],[-47,29,41,18,4,1],[4,33,20,14,3,0]];
    for(const [u,v,w,d,h,kind] of parts){const at=local(u,v),b=[...at,w*scale,d*scale,h,zone.angle,kind,zone.ri,.42+rnd()*.3],fp=detailFootprint(b);if(!clear(fp))continue;harbor.push(b);reserve(fp,2);}
    for(let i=0;i<24;i++){const at=local(-65+rnd()*112,(i%2?-1:1)*(7+rnd()*7)),b=[...at,5+rnd()*5,2.5,1.5,zone.angle,0,zone.ri,.35+rnd()*.4],fp=detailFootprint(b);if(clear(fp)){harbor.push(b);reserve(fp,1.2);}}
    const plot=detailFootprint([...zone.at,164*scale,114*scale,0,zone.angle]);harborPlots.push({...zone,points:plot});
    const spine=[local(-80,0),local(42,0)];
    const clearLane=line=>Array.from({length:21},(_,i)=>mix(line[0],line[1],i/20)).every(p=>onLand(p)&&!rivers.some(r=>roadDistance(p,r.points)<r.width/2+3))&&!obstacles.some(o=>plotsOverlap(line,o.points,o.gap))&&!harbor.some(b=>plotsOverlap(line,detailFootprint(b),1));
    const links=[];for(const gate of [spine[0]])for(const r of [...roads,...streets,...harborLanes])for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((gate[0]-a[0])*dx+(gate[1]-a[1])*dy)/(dx*dx+dy*dy))),end=mix(a,b,t),dist=Math.hypot(end[0]-gate[0],end[1]-gate[1]);if(dist<240&&clearLane([gate,end]))links.push({points:[gate,end],width:1.4,dist});
    }
    // Internal apron remains open; boxes stay beside it, never across the service spine.
    if(clearLane(spine))harborLanes.push({points:spine,width:1.4});
    if(links.length)harborLanes.push(links.sort((a,b)=>a.dist-b.dist)[0]);
    reserve(plot,3);
  }
  for(const l of harborLanes)reserve(l.points,2.5);
  const micro=[],microFootprints=[],counts=regions.map(()=>0);
  // Density is land-use specific. Wards are qualitative guidance, never surveyed building counts.
  const density={imperial:.58,underpool:1,lowtown:.98,neonring:.8,tsurumaki:.38,keihin:.62,west:.42,minato:.45,saitama:.78,hokuen:.47,kai:.26,fuji:.085,sagami:.55,chiba:.65,docks:.28};
  const candidates=[];
  const addStrip=(line,isStreet)=>{for(let j=1;j<line.points.length;j++){
    const a=line.points[j-1],b=line.points[j],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<3)continue;const dx=(b[0]-a[0])/len,dy=(b[1]-a[1])/len;
    for(let dist=4+rnd()*9;dist<len;dist+=7+rnd()*13)for(const side of [-1,1]){
      const u=dist/len,p=mix(a,b,u),near=regionAt(p),ri=near>=0?near:regions.map((r,i)=>({i,d:Math.hypot(r.at[0]-p[0],r.at[1]-p[1])})).filter(v=>regions[v.i].kind!=='overlay').sort((a,b)=>a.d-b.d)[0].i;
      const id=regions[ri].id,den=density[id],wave=.5+.5*Math.sin(p[0]*.017+Math.sin(p[1]*.013)*2);
      if(rnd()>den*(.4+.6*wave))continue;
      const industrial=['keihin','hokuen','sagami','docks','minato'].includes(id),w=industrial?8+rnd()*12:3+rnd()*6,d=industrial?4+rnd()*6:3+rnd()*5;
      const offset=line.width/2+4+d/2+(isStreet?rnd()*5:6+rnd()*25),at=[p[0]-dy*offset*side,p[1]+dx*offset*side];
      const angle=Math.atan2(dy,dx)*180/Math.PI+(rnd()-.5)*(industrial?4:22),h=industrial?3:rnd()>.65?3:1.5;
      candidates.push({b:[...at.map(round),round(w),round(d),h,round(angle),0,ri,round(rnd())],infill:near<0});
      // Irregular second-row dwellings; industrial yards and estates keep their breathing room.
      if(!industrial&&rnd()<den*.5){const farther=offset+d+3+rnd()*13;candidates.push({b:[round(p[0]-dy*farther*side+dx*3),round(p[1]+dx*farther*side+dy*3),round(w*.7),round(d*.8),1.5,round(angle+8),0,ri,round(rnd())],infill:near<0});}
    }
  }};
  for(const r of roads.filter(r=>!r.name.includes('入口')&&!r.name.includes('广场')))addStrip(r,false);
  for(const s of streets.filter(s=>!s.seam))addStrip(s,true);
  for(const {b,infill} of candidates){
    if(micro.length>=2600)break;const fp=detailFootprint(b);if(!clear(fp))continue;
    // Keep the entire small roof on land and outside river banks, not just its center.
    micro.push({b,infill});microFootprints.push(fp);counts[b[7]]++;reserve(fp,1.6);
  }
  const trunk=roads.find(r=>r.name==='西南联络线'),spur=roads.find(r=>r.name==='川崎都市联络线'),dock=roads.find(r=>r.name==='湾西货运港联络道');
  const crossing=(a,b,c,d)=>{const x=b[0]-a[0],y=b[1]-a[1],u=d[0]-c[0],v=d[1]-c[1],den=x*v-y*u;if(!den)return null;const t=((c[0]-a[0])*v-(c[1]-a[1])*u)/den,k=((c[0]-a[0])*y-(c[1]-a[1])*x)/den;return t>0&&t<1&&k>0&&k<1?mix(a,b,t):null;};
  let interchange;
  for(let i=1;i<trunk.points.length;i++)for(let j=1;j<spur.points.length;j++)interchange||=crossing(trunk.points[i-1],trunk.points[i],spur.points[j-1],spur.points[j]);
  if(!interchange)throw new Error('Tram lines have no shared street junction');
  const routes=[{id:'T1',name:'武藏野·湾西线',color:'#d4aa67',points:[...trunk.points.slice(0,5),...dock.points.slice(1)],desc:'连接武藏野住区、霓环南缘、京滨街区与湾西货运港。'},
    {id:'T2',name:'方舟·川崎线',color:'#bf8198',points:spur.points,desc:'连接方舟片区与川崎产业住区，在京滨南口换乘湾西线。'}];
  const stopNames=[['山梨东口','武藏野南','弦卷台南','京滨街市','湾西港前'],['方舟北','京滨南町','川崎工业街']];
  const stops=[{id:'tram-junction',name:'京滨南口',at:interchange,lines:['T1','T2'],group:'keihin'}];
  routes.forEach((r,i)=>{const lengths=r.points.slice(1).map((p,j)=>Math.hypot(p[0]-r.points[j][0],p[1]-r.points[j][1])),total=lengths.reduce((s,n)=>s+n,0);stopNames[i].forEach((name,j)=>{let dist=total*j/(stopNames[i].length-1),k=0;while(k<lengths.length-1&&dist>lengths[k])dist-=lengths[k++];const at=mix(r.points[k],r.points[k+1],dist/lengths[k]);stops.push({id:'tram-'+r.id.toLowerCase()+'-'+j,name,at,lines:[r.id]});});
    const along=stop=>{let distance=0;for(let k=0;k<lengths.length;k++){if(roadDistance(stop.at,[r.points[k],r.points[k+1]])<.03)return distance+Math.hypot(stop.at[0]-r.points[k][0],stop.at[1]-r.points[k][1]);distance+=lengths[k];}return Infinity;};
    r.stops=stops.filter(s=>s.lines.includes(r.id)).sort((a,b)=>along(a)-along(b)).map(s=>s.id);
  });
  return {micro,microFootprints,harbor,harborPlots,harborLanes,tram:{routes,stops},metrics:{microCounts:counts,micro:micro.length,gapInfill:micro.filter(m=>m.infill).length,harborParts:harbor.length}};
}
