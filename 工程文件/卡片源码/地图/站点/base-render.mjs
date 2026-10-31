import{project}from'./projection.mjs';
const sin=Math.sin(65*Math.PI/180);
export function prepareBase(data){
 const path=s=>s?new Path2D(s):null,land=path(data.landPath),regions=data.regions.filter(r=>r.kind!=='sector').map(r=>({path:path(r.selectionPath||r.path),color:r.color}));
 const roads=[...data.roads||[],...data.streets||[],...data.districtExpansion?.roads||[],...data.cityDetail?.harborLanes||[]],rivers=data.rivers||[],waters=data.waterBodies||[];
 const buildings=[...data.buildings||[],...data.districtExpansion?.buildings||[],...data.cityDetail?.harbor||[],...data.cityDetail?.micro||[],...data.districtExpansion?.micro||[]].map(b=>b.b||b).filter(b=>data.mapId!=='tokyo-central'||b[7]>=7);
 return function paint(ctx,{origin,scale,size,mode}){
  ctx.fillStyle='#050b11';ctx.fillRect(0,0,size,size);ctx.save();ctx.setTransform(scale,0,0,scale*sin,-origin[0]*scale,-origin[1]*scale);
  if(land){ctx.fillStyle='#0a151a';ctx.fill(land);ctx.strokeStyle='#1a3c46';ctx.lineWidth=1/scale;ctx.stroke(land);}
  for(const r of regions)if(r.path){ctx.globalAlpha=.08;ctx.fillStyle=r.color||'#91b0ab';ctx.fill(r.path);ctx.globalAlpha=1;}
  function line(points,width,color){if(!points?.length)return;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
  for(const w of waters){ctx.beginPath();w.points?.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle='#071e2b';ctx.fill();}
  for(const r of rivers)line(r.points,r.width||5,'#102e3a');
  for(const r of data.terrainContext?.contours||[])line(r.points,.65/scale,'#19343a');
  for(const r of roads)line(r.points,Math.max(r.width||1,.45/scale),r.kind==='expressway'||r.elevation>0?'#29505a':'#123b43');
  ctx.restore();
  if(mode!=='city')return;
  const b=buildings.filter(b=>{const p=project(b),pad=(b[2]+b[3]+b[4])*scale;return p[0]*scale-origin[0]*scale>-pad&&p[1]*scale-origin[1]*scale>-pad&&p[0]*scale-origin[0]*scale<size+pad&&p[1]*scale-origin[1]*scale<size+pad;}).sort((a,b)=>a[1]-b[1]);
  ctx.save();ctx.setTransform(scale,0,0,scale,-origin[0]*scale,-origin[1]*scale);
  for(const row of b){const[x,y,w,d,h,angle,,ri]=row,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),corners=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]);
   const base=corners.map(p=>project(p)),top=corners.map(p=>project(p,h));ctx.fillStyle=data.regions[ri]?.color||'#7f9b90';ctx.globalAlpha=.22;for(const f of [[...base.slice(2),...top.slice(2).reverse()],[base[1],base[2],top[2],top[1]],top]){ctx.beginPath();f.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill();}ctx.globalAlpha=.28;ctx.lineWidth=.45/scale;ctx.strokeStyle=data.regions[ri]?.color||'#7f9b90';ctx.stroke();
  }ctx.restore();
 };
}
