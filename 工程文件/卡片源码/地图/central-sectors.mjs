// Build-time partitioning only. Original place identities and source arrays stay intact.
import assert from 'node:assert/strict';
import clipping from './build-vendor/polygon-clipping-0.15.7.cjs';
import {applyCentralBoundaries,pathRings,sample} from './central-boundaries.mjs';

export const sectorDefinitions=[
 {id:'central-core',name:'核心七区',en:'CENTRAL CORE',color:'#8ea9b1',at:[1900,1350],members:['imperial','underpool','lowtown','neonring','tsurumaki','keihin','west']},
 {id:'north-corridor',name:'都北走廊',en:'NORTHERN CORRIDOR',color:'#b79857',at:[2300,-780],members:['ryomo','north-gateway','mito-oarai','saitama']},
 {id:'waterfront',name:'滨水区',en:'WATERFRONT',color:'#47b1ab',at:[3490,1180],members:['tsukuba-north','chiba','kashima-kamisu','docks','kujukuri','choshi']},
 {id:'new-kawasaki',name:'新川崎',en:'NEW KAWASAKI',color:'#747bc3',at:[1310,2490],members:['fuji','sagami','yokohama-miura']},
 {id:'west-country',name:'西郊野',en:'WESTERN COUNTRYSIDE',color:'#957baf',at:[320,670],members:['kai','hokuen']}
];
export const area=r=>r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
const centroid=pts=>pts.reduce((a,p)=>[a[0]+p[0]/pts.length,a[1]+p[1]/pts.length],[0,0]);
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
function hull(points){const ps=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const half=ps=>{const out=[];for(const p of ps){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out.slice(0,-1);};return [...half(ps),...half(ps.reverse())];}

export function buildSectors(baseline,canvas){
 const data=structuredClone(baseline),old=structuredClone(baseline),{Path2D,PathOp,FillType}=canvas;
 const poly=rings=>{const p=new Path2D();for(const r of rings){r.forEach((v,i)=>i?p.lineTo(...v):p.moveTo(...v));p.closePath();}p.setFillType(FillType.EvenOdd);return p;};
 const clone=p=>new Path2D(p);

 const g=applyCentralBoundaries(data,canvas),cells=new Map(g.authored.map(r=>[r.id,[[r.points]]]));
 const transferPoints=[[1320,1680],[1340,1677],[1368,1695],[1395,1690],[1410,1715],[1450,1725],[1480,1718],[1500,1748],[1540,1757],[1570,1753],[1600,1780],[1640,1785],[1660,1803],[1695,1815],[1720,1940],[1478,1960],[1310,1860]];
 const transfer=poly([transferPoints]),transferGeo=[[transferPoints]];
 const tsurumaki=data.regions.find(r=>r.id==='tsurumaki');
 tsurumaki.polygons=clipping.difference(old.regions.find(r=>r.id==='tsurumaki').polygons,transferGeo);
 const ts=poly(tsurumaki.polygons.flat());tsurumaki.selectionPath=ts.toSVGString();tsurumaki.selectionBounds=[...ts.computeTightBounds()];
 const landGeo=clipping.difference([pathRings(old.landPath)],...(old.waterBodies||[]).map(w=>[[w.points]]));
 const wardGeo=data.regions.filter(r=>r.kind==='legacy').map(r=>r.polygons);
 const coreUnion=clipping.union(...wardGeo);
 // Fill enclosed land cracks and join Keihin's separated quays to its core shore.
 // This changes the five-sector envelope, never the six protected ward contours.
 const keihinShore=[[hull(old.regions.find(r=>r.id==='keihin').polygons.flat(2))]];
 const coreDistricts=old.districtExpansion.districts.filter(d=>d.id!=='setagaya-south'&&sectorDefinitions[0].members.includes(d.parent)).map(d=>[[d.points]]);
 const guardGeo=clipping.union(...coreUnion.map(p=>[[p[0]]]),keihinShore,...coreDistricts);
 let coreGeo=clipping.difference(clipping.intersection(guardGeo,landGeo),transferGeo),core=poly(coreGeo.flat());
 const split=sample([[1430,-680],[1400,-520],[1490,-320],[1460,-100],[1500,100],[1480,300],[1390,390],[1220,440],[1200,570],[1230,665],[1260,760],[1370,940],[1940,1440]]);
 const westMask=[[[[-1100,-680],...split,[-1100,1440]]]],saitamaWest=clipping.intersection(cells.get('saitama'),westMask);
 const paths=new Map([['central-core',core]]),sectorGeometry={'central-core':coreGeo};
 for(const def of sectorDefinitions.slice(1)){
  let shape=clipping.union(...def.members.map(id=>cells.get(id)));
  if(def.id==='north-corridor')shape=clipping.difference(shape,saitamaWest);
  if(def.id==='west-country')shape=clipping.union(shape,saitamaWest);
  if(def.id==='new-kawasaki')shape=clipping.union(shape,transferGeo);
  shape=clipping.difference(clipping.intersection(shape,landGeo),coreGeo);
  if(def.id!=='new-kawasaki')shape=clipping.difference(shape,transferGeo);
  sectorGeometry[def.id]=shape;paths.set(def.id,poly(shape.flat()));
 }
 // Outer cells must not own detached fragments inside the core (including the
 // original harbour overlay's inland footprint). Keep those land gaps in core.
 const coreBounds=core.computeTightBounds(),infill=[];
 for(const def of sectorDefinitions.slice(1)){
  const shapes=sectorGeometry[def.id],largest=shapes.reduce((best,p)=>Math.abs(area(p[0]))>Math.abs(area(best[0]))?p:best,shapes[0]);
  const stray=p=>p!==largest&&p[0].every(([x,y])=>x>=coreBounds[0]&&x<=coreBounds[2]&&y>=coreBounds[1]&&y<=coreBounds[3]);
  infill.push(...shapes.filter(stray));sectorGeometry[def.id]=shapes.filter(p=>!stray(p));paths.set(def.id,poly(sectorGeometry[def.id].flat()));
 }
 if(infill.length){coreGeo=clipping.union(coreGeo,infill);core=poly(coreGeo.flat());sectorGeometry['central-core']=coreGeo;paths.set('central-core',core);}
 const definitions=sectorDefinitions.map(s=>({...s,selectionPath:paths.get(s.id).toSVGString(),bounds:[...paths.get(s.id).computeTightBounds()]}));
 const oldSector=Object.fromEntries(definitions.flatMap(s=>s.members.map(id=>[id,s.id])));
 function owner(at,fallback){
  if(transfer.isPointInPath(at[0],at[1]))return 'new-kawasaki';
  for(const s of definitions)if(paths.get(s.id).isPointInPath(at[0],at[1]))return s.id;
  return oldSector[fallback]||'central-core';
 }
 const places=[...data.nodes,...data.services,...data.districtExpansion.places,...data.terrainContext.places];
 // Split the approved transfer approximately equally by land area, west to east.
 let lo=1310,hi=1720;const transferArea=Math.abs(area(transferPoints));
 for(let i=0;i<28;i++){const x=(lo+hi)/2,p=clone(transfer).op(poly([[[1200,1600],[x,1600],[x,2100],[1200,2100]]]),PathOp.Intersect),a=pathRings(p.toSVGString()).reduce((n,r)=>n+area(r),0);if(a<transferArea/2)lo=x;else hi=x;}
 const transferSplitX=(lo+hi)/2;
 for(const p of places){p.sectorId=owner(p.at,p.group);if(transfer.isPointInPath(...p.at))p.mapParent=p.at[0]<transferSplitX?'fuji':'sagami';}
 for(const d of data.districtExpansion.districts){d.sectorId=owner(d.at,d.parent);if(d.id==='setagaya-south'){d.points=transferPoints;d.selectionPath=transfer.toSVGString();d.mapParents=['fuji','sagami'];}}
 for(const r of data.regions){r.sourceKind=r.kind;if(r.kind==='new')r.kind='alias';}
 for(const s of definitions)data.regions.push({...s,kind:s.id==='central-core'?'sector':'new',cover:'东京都 · 中心大区',polygons:[pathRings(s.selectionPath)],selectionBounds:s.bounds});
 const sectorRi=Object.fromEntries(definitions.map(s=>[s.id,data.regions.findIndex(r=>r.id===s.id)]));
 const riFor=(at,ri)=>{const id=owner(at,old.regions[ri]?.id);return id==='central-core'&&ri<7?ri:sectorRi[id];};
 const inTransfer=b=>transfer.isPointInPath(b[0],b[1]);
 const ordinary=[];
 for(const [key,bs] of [['buildings',old.buildings],['extra',old.districtExpansion.buildings],['micro',old.cityDetail.micro.map(m=>m.b)],['extraMicro',old.districtExpansion.micro.map(m=>m.b)]]){
  bs.forEach((b,i)=>{if(!inTransfer(b))return;const protectedBuilding=places.some(p=>Math.hypot(p.at[0]-b[0],p.at[1]-b[1])<Math.max(12,Math.hypot(b[2],b[3])/2+3));ordinary.push({key,i,b,protected:protectedBuilding,block:Math.floor((b[0]-1310)/42)+','+Math.floor((b[1]-1680)/42)});});
 }
 const eligible=ordinary.filter(x=>!x.protected),blocks=new Map();for(const x of eligible){if(!blocks.has(x.block))blocks.set(x.block,[]);blocks.get(x.block).push(x);}
 const ordered=[...blocks].sort((a,b)=>hash(a[0])-hash(b[0])),target=Math.round(eligible.length/3);let kept=0;const keep=new Set(ordinary.filter(x=>x.protected).map(x=>x.key+':'+x.i));
 // Whole blocks first, then one partial edge block to meet the requested count.
 for(const [,items] of ordered){for(const x of items.sort((a,b)=>a.b[0]-b.b[0]||a.b[1]-b.b[1]))if(kept<target){keep.add(x.key+':'+x.i);kept++;}}
 const keepBuilding=(key,b,i)=>!inTransfer(b)||keep.has(key+':'+i);
 const packets={},stats={};
 const sourceKeys=['buildings','footprints','streets','grounds','complexes','features','portSites','landmarks','specialSites','parcels'];
 const sourceCount=old.buildings.length+old.districtExpansion.buildings.length+old.cityDetail.micro.length+old.districtExpansion.micro.length;
 for(const sectorId of [null,...definitions.map(s=>s.id)]){
  const packet={sectorId};const belongs=(at,fallback)=>Boolean(sectorId)&&owner(at,fallback)===sectorId;
  const filterPoints=items=>items.filter(x=>belongs(x.at||x.center||centroid(x.points),x.group||x.region||old.regions[x.ri]?.id));
  const retag=x=>({...x,ri:riFor(x.at||x.center||centroid(x.points),x.ri)});
  function pair(bs,fps,key){const selected=bs.map((b,i)=>({b,i})).filter(({b,i})=>belongs(b,old.regions[b[7]]?.id)&&keepBuilding(key,b,i));return {buildings:selected.map(({b})=>{const out=[...b];out[7]=riFor(b,b[7]);return out;}),footprints:selected.map(({i})=>fps[i]),sourceIndices:selected.map(({i})=>i)};}
  const main=pair(old.buildings,old.footprints,'buildings'),extra=pair(old.districtExpansion.buildings,old.districtExpansion.footprints,'extra');
  packet.buildings=main.buildings;packet.footprints=main.footprints;
  packet.streets=filterPoints(old.streets).map(retag);packet.grounds=filterPoints(old.grounds).map(retag);
  packet.features=filterPoints(old.features).map(retag);packet.portSites=filterPoints(old.portSites);packet.landmarks=filterPoints(old.landmarks);packet.specialSites=filterPoints(old.specialSites);packet.parcels=[];
  const complex=cs=>filterPoints(cs).map(c=>({...retag(c),parts:c.parts.map(b=>{const out=[...b];out[7]=riFor(b,b[7]);return out;})}));
  packet.complexes=complex(old.complexes);
  const micro=pair(old.cityDetail.micro.map(m=>m.b),old.cityDetail.microFootprints,'micro'),extraMicro=pair(old.districtExpansion.micro.map(m=>m.b),old.districtExpansion.microFootprints,'extraMicro');
  packet.cityDetail={...data.cityDetail,micro:micro.buildings.map(b=>({b})),microFootprints:micro.footprints,harbor:old.cityDetail.harbor.filter(b=>belongs(b,old.regions[b[7]]?.id)).map(b=>{const out=[...b];out[7]=riFor(b,b[7]);return out;}),harborPlots:filterPoints(old.cityDetail.harborPlots).map(retag),harborLanes:filterPoints(old.cityDetail.harborLanes)};
  packet.districtExpansion={...data.districtExpansion,buildings:extra.buildings,footprints:extra.footprints,micro:extraMicro.buildings.map(b=>({b})),microFootprints:extraMicro.footprints,roads:filterPoints(old.districtExpansion.roads),landmarks:filterPoints(old.districtExpansion.landmarks).map(retag)};
  const extraMap=new Map(extra.sourceIndices.map((index,i)=>[index,i]));
  packet.districtExpansion.places=data.districtExpansion.places.map(p=>p.siteParts?{...p,siteParts:p.siteParts.map(i=>extraMap.get(i)).filter(i=>i!==undefined)}:p);
  packet.terrainContext={...data.terrainContext,complexes:complex(old.terrainContext.complexes),reusedMicroIndices:micro.sourceIndices.flatMap((v,i)=>old.terrainContext.reusedMicroIndices.includes(v)?[i]:[])};
  packet.plaza=sectorId==='central-core'?old.plaza:null;packet.plazaPlot=sectorId==='central-core'?old.plazaPlot:null;
  packet.sectorView={id:sectorId,definitions,oldSector};
  const visible=data.regions.filter(r=>r.kind!=='alias'&&(r.kind!=='legacy'||sectorId==='central-core')&&(r.id!=='central-core'||sectorId!=='central-core'));
  const edges=new Map();for(const r of visible){if(r.kind==='overlay')continue;for(const ring of pathRings(r.selectionPath))for(let i=0;i<ring.length;i++){const a=ring[i].map(v=>Math.round(v*1000)/1000),b=ring[(i+1)%ring.length].map(v=>Math.round(v*1000)/1000),key=[a.join(','),b.join(',')].sort().join('|');edges.set(key,[a,b]);}}
  packet.centralNight={revision:'230-night-1',sharedEdges:[...edges.values()]};
  stats[sectorId||'overview']={buildings:main.buildings.length+extra.buildings.length,micro:micro.buildings.length+extraMicro.buildings.length,complexParts:[...packet.complexes,...packet.terrainContext.complexes].reduce((n,c)=>n+c.parts.length,0)};
  packets[sectorId||'overview']=packet;
 }
 // The shared bootstrap has no city arrays; only the chosen JSON packet is parsed.
 const base=structuredClone(data);for(const key of sourceKeys)base[key]=[];
 base.cityDetail={...data.cityDetail,micro:[],microFootprints:[],harbor:[],harborPlots:[],harborLanes:[]};
 base.districtExpansion={...data.districtExpansion,buildings:[],footprints:[],micro:[],microFootprints:[],roads:[],landmarks:[]};
 base.terrainContext={...data.terrainContext,complexes:[],reusedMicroIndices:[]};delete base.centralNight;
 const westTransfer=clipping.intersection(transferGeo,[[[[1200,1600],[transferSplitX,1600],[transferSplitX,2100],[1200,2100]]]]),eastTransfer=clipping.difference(transferGeo,westTransfer);
 const transferParts=[['fuji',westTransfer],['sagami',eastTransfer]].map(([parent,polygons])=>({parent,polygons,area:polygons.flat().reduce((n,r)=>n+area(r),0)}));
 const receipt={sourceCount,stats,transfer:{splitX:transferSplitX,area:transferArea,ordinary:eligible.length,ordinaryKept:kept,protected:ordinary.length-eligible.length,removed:eligible.length-kept,parts:transferParts,buildings:ordinary.map(x=>({source:x.key,index:x.i,parent:x.b[0]<transferSplitX?'fuji':'sagami',retained:keep.has(x.key+':'+x.i),protected:x.protected}))},oldSector};
 assert.equal(kept,target);
 return {base,packets,definitions,paths,land:poly(landGeo.flat()),core,transfer,sectorGeometry,receipt,owner,old};
}
