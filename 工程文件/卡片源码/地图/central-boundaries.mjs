// Centre-only cartography. Shared authored seams partition land; places never move.
// Coordinates are the existing concept-map units, not surveyed administrative borders.
import assert from 'node:assert/strict';

const nodes={
 nw:[-1000,-2000],n1:[1390,-2000],n2:[2890,-2000],ne:[5400,-2000],
 lw:[-1000,-250],l:[630,-420],r:[1430,-680],t:[2510,-650],u:[2930,-810],v:[3700,-400],mr:[5400,-530],
 k:[670,480],h:[1050,1160],c:[1940,1440],w:[2580,300],z:[4110,980],e1:[5400,930],
 y:[4070,1430],e2:[5400,1580],j:[3840,1950],e3:[5400,1980],b:[2690,1870],
 fw:[-1000,1450],f:[1420,2410],x:[2450,2350],sw:[-1000,3600],s1:[1220,3600],s2:[2500,3600],se:[5400,3600]
};
// An edge is authored once. Adjacent rings reuse its samples in reverse order.
// The knots follow valleys, urban shoulders and river corridors at different scales.
const seams=[
 ['n1','r',[[1380,-1750],[1406,-1580],[1375,-1495],[1460,-1330],[1450,-1160],[1510,-1030],[1455,-850]]],
 ['n2','u',[[2840,-1750],[2885,-1520],[2850,-1390],[2955,-1190],[2908,-1025]]],
 ['lw','l',[[-710,-200],[-430,-260],[-180,-220],[80,-355],[230,-310],[410,-420]]],
 ['l','r',[[790,-475],[895,-450],[1090,-600],[1230,-610],[1350,-710]]],
 ['r','t',[[1650,-620],[1790,-660],[1960,-608],[2150,-664],[2280,-616],[2400,-660]]],
 ['t','u',[[2650,-650],[2740,-742],[2840,-723]]],
 ['u','v',[[3080,-770],[3240,-805],[3350,-718],[3490,-672],[3565,-532]]],
 ['v','mr',[[3850,-465],[4060,-465],[4250,-522],[4460,-510],[4600,-570],[4830,-543]]],
 ['l','k',[[590,-220],[660,-40],[600,110],[664,240],[630,350]]],
 ['k','c',[[846,470],[960,514],[1110,498],[1208,574],[1360,642],[1430,745],[1545,772],[1650,925],[1760,1115]]],
 ['k','h',[[610,610],[555,730],[545,825],[520,960],[690,1045],[850,1080]]],
 ['h','c',[[1230,1190],[1400,1270],[1580,1280],[1760,1390]]],
 ['c','fw',[[1660,1600],[1440,1680],[1290,1640],[1110,1795],[870,1750],[690,1820],[440,1700],[230,1660],[45,1540],[-210,1560],[-430,1445],[-700,1505]]],
 ['t','w',[[2460,-440],[2530,-280],[2500,-120],[2600,45],[2550,174]]],
 ['v','w',[[3640,-210],[3590,-75],[3480,115],[3410,142],[3335,295],[3210,373],[3090,355],[2990,322],[2900,372],[2760,315]]],
 ['w','c',[[2530,450],[2570,555],[2480,660],[2500,790],[2400,895],[2360,1055],[2170,1190]]],
 ['v','z',[[3795,-208],[3765,-58],[3850,96],[3860,267],[3970,422],[3940,576],[4030,708],[4060,875]]],
 ['z','e1',[[4280,907],[4420,935],[4550,898],[4715,968],[4890,920],[5050,956]]],
 ['z','y',[[4150,1090],[4095,1170],[4110,1290]]],
 ['y','e2',[[4240,1470],[4340,1515],[4495,1500],[4650,1585],[4850,1570],[5020,1640]]],
 ['y','j',[[4020,1540],[4055,1630],[3965,1730],[3950,1840]]],
 ['j','e3',[[4000,1970],[4140,1920],[4280,1980],[4440,1960],[4680,2040],[4900,2000]]],
 ['j','b',[[3690,1905],[3500,1938],[3360,1875],[3180,1900],[3040,1858],[2870,1910]]],
 ['b','c',[[2600,1740],[2480,1690],[2360,1600],[2200,1580],[2070,1480]]],
 ['c','f',[[1790,1590],[1660,1750],[1590,1840],[1495,1980],[1450,2150],[1425,2310]]],
 ['f','x',[[1550,2460],[1740,2510],[1920,2485],[2050,2450],[2180,2400],[2280,2390]]],
 ['b','x',[[2585,2030],[2520,2180]]],
 ['f','s1',[[1390,2575],[1270,2710],[1300,2870],[1210,3070],[1260,3310]]],
 ['x','s2',[[2420,2550],[2480,2760],[2420,3010],[2510,3240]]]
];
const cells={
 ryomo:['nw','n1','r','l','lw'],
 'north-gateway':['n1','n2','u','t','r'],
 'mito-oarai':['n2','ne','mr','v','u'],
 saitama:['l','r','t','w','c','k'],
 'tsukuba-north':['t','u','v','w'],
 'kashima-kamisu':['v','mr','e1','z'],
 hokuen:['k','c','h'],
 kai:['lw','l','k','h','c','fw'],
 fuji:['fw','c','f','s1','sw'],
 sagami:['c','b','x','f'],
 chiba:['w','v','z','y','j','b','c'],
 choshi:['z','e1','e2','y'],
 kujukuri:['y','e2','e3','j'],
 docks:['b','j','e3','se','s2','x'],
 'yokohama-miura':['f','x','s2','s1']
};
const round=v=>Math.round(v*1000)/1000;
export function sample(knots){
 const out=[];
 for(let i=0;i<knots.length-1;i++){
  const a=knots[Math.max(0,i-1)],b=knots[i],c=knots[i+1],d=knots[Math.min(knots.length-1,i+2)];
  const n=Math.max(2,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/9));
  for(let k=0;k<n;k++){
   const t=k/n,t2=t*t,t3=t2*t;
   const length=Math.hypot(c[0]-b[0],c[1]-b[1]),seed=(Math.abs(Math.round(b[0]*3+b[1]*7+c[0]))%17)/17;
   // Small, uneven shoulders sit on the authored large contour. Endpoints stay exact.
   const shoulder=length>100?Math.sin(Math.PI*t)*Math.min(7,length*.025)*(Math.sin(t*Math.PI*(3+Math.floor(seed*4))+seed*8)*.65+Math.sin(t*Math.PI*11+seed*5)*.22):0;
   out.push(b.map((v,j)=>round((2*t3-3*t2+1)*v+(t3-2*t2+t)*(c[j]-a[j])*.32+(-2*t3+3*t2)*c[j]+(t3-t2)*(d[j]-b[j])*.32+shoulder*(j?(c[0]-b[0]):-(c[1]-b[1]))/length)));
  }
 }
 out.push(knots.at(-1));return out;
}
const shared=new Map();
for(const [a,b,knots] of seams){const p=sample([nodes[a],...knots,nodes[b]]);shared.set(a+':'+b,p);shared.set(b+':'+a,[...p].reverse());}
function ring(ids){return ids.flatMap((a,i)=>{const b=ids[(i+1)%ids.length];return (shared.get(a+':'+b)||[nodes[a],nodes[b]]).slice(0,-1);});}
export function pathRings(svg){
 const tokens=svg.match(/[MLZmlz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];
 const rings=[];let current=null;
 for(let i=0;i<tokens.length;){const command=tokens[i++];if(command==='Z'||command==='z'){current=null;continue;}
  assert.ok(command==='M'||command==='L','Expected flattened polygon, got '+command);
  const p=[Number(tokens[i++]),Number(tokens[i++])];
  if(command==='M'){current=[];rings.push(current);}current.push(p);
  while(i<tokens.length&&!/^[MLZ]$/i.test(tokens[i]))current.push([Number(tokens[i++]),Number(tokens[i++])]);
 }
 return rings.filter(r=>r.length>=3);
}
export function applyCentralBoundaries(data,canvas){
 assert.equal(data.mapId,'tokyo-central');
 const {Path2D,PathOp,FillType}=canvas;
 const poly=rings=>{const p=new Path2D();for(const r of rings){r.forEach((v,i)=>i?p.lineTo(...v):p.moveTo(...v));p.closePath();}p.setFillType(FillType.EvenOdd);return p;};
 const sourcePaths=data.regions.map(r=>new Path2D(r.selectionPath));
 let core=new Path2D();data.regions.forEach((r,i)=>{if(r.kind==='legacy')core=core.op(sourcePaths[i],PathOp.Union);});
 let land=new Path2D(data.landPath);
 for(const water of data.waterBodies||[])land=land.op(poly([water.points]),PathOp.Difference);
 const domain=new Path2D(land).op(core,PathOp.Difference),paths=[];
 const originalDistricts=structuredClone(data.districtExpansion.districts);
 for(let i=0;i<data.regions.length;i++){
  const r=data.regions[i];if(r.kind!=='new'){paths.push(sourcePaths[i]);continue;}
  assert.ok(cells[r.id],'Missing authored region '+r.id);
  const p=poly([ring(cells[r.id])]).op(land,PathOp.Intersect);
  // Subtract each existing island separately. A single compound subtraction can
  // silently fail in the installed Skia build on the old, touching ward rings.
  for(const old of data.regions.filter(r=>r.kind==='legacy'))for(const rings of old.polygons)p.op(poly(rings),PathOp.Difference);
  for(const d of originalDistricts)if(data.regions.find(r=>r.id===d.parent)?.kind==='legacy')p.op(poly([d.points]),PathOp.Difference);
  p.asWinding();
  const svg=p.toSVGString(),rings=pathRings(svg);assert.ok(rings.length,r.id+' became empty');
  r.polygons=[rings];r.selectionPath=svg;r.bounds=[...p.computeTightBounds()];r.selectionBounds=[...r.bounds];paths.push(p);
 }
 for(const d of data.districtExpansion.districts){
  const ri=data.regions.findIndex(r=>r.id===d.parent);if(data.regions[ri]?.kind!=='new')continue;
  const clipped=poly([d.points]).op(paths[ri],PathOp.Intersect).asWinding();
  d.selectionPath=clipped.toSVGString();d.bounds=[...clipped.computeTightBounds()];
 }
 const segments=new Map();
 data.regions.forEach((r,i)=>{if(r.kind==='overlay')return;for(const points of pathRings(paths[i].toSVGString()))for(let j=0;j<points.length;j++){
  const a=points[j].map(round),b=points[(j+1)%points.length].map(round);if(a[0]===b[0]&&a[1]===b[1])continue;
  const sa=a.join(','),sb=b.join(','),key=sa<sb?sa+'|'+sb:sb+'|'+sa;
  if(!segments.has(key))segments.set(key,{points:[a,b],regions:[i]});else segments.get(key).regions.push(i);
 }});
 data.centralNight={revision:'230-night-1',sharedEdges:[...segments.values()].map(e=>e.points)};
 const authored=Object.entries(cells).map(([id,ids])=>({id,points:ring(ids)}));
 return {paths,domain,land,core,sourcePaths,authored,originalDistricts,sharedSeams:seams.length,segments:segments.size};
}
