// Build-time street parcels. Shared cut edges give real T junctions; nothing runs per frame.
import {plotsOverlap,roadDistance} from './atlas-source.mjs';
const round=n=>Math.round(n*100)/100;
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2);
const center=p=>p.reduce((c,a)=>[c[0]+a[0]/p.length,c[1]+a[1]/p.length],[0,0]);
function split(poly,n,k){
  const halves=[[],[]],crossings=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*n[0]+a[1]*n[1]-k,db=b[0]*n[0]+b[1]*n[1]-k;
    halves[da>=0?0:1].push(a);
    if(da*db<0){const t=da/(da-db),p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];halves[0].push(p);halves[1].push(p);crossings.push(p);}
  }
  return {halves,crossings};
}
export function streetFabric({r,ri,profile,rnd,regionAt,specialSites,rivers}){
  const a=r.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),step=profile.step*1.4;
  const local=p=>[(p[0]-r.at[0])*c+(p[1]-r.at[1])*s,-(p[0]-r.at[0])*s+(p[1]-r.at[1])*c];
  const organic=profile.industrial?.13:r.id==='imperial'?.16:r.id==='chiba'?.32:r.id==='lowtown'?.7:1;
  const warp=([u,v])=>{const x=u+organic*(58*Math.sin(v/115+ri)+26*Math.sin(u/230+v/250)),y=v+organic*48*Math.sin(u/145-ri*.7);return [round(r.at[0]+x*c-y*s),round(r.at[1]+x*s+y*c)];};
  const edge=(p,q)=>{const n=Math.max(2,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/18));return Array.from({length:n+1},(_,i)=>warp([p[0]+(q[0]-p[0])*i/n,p[1]+(q[1]-p[1])*i/n]));};
  const b=r.bounds,ends=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]].map(local),x0=Math.min(...ends.map(p=>p[0]))-100,x1=Math.max(...ends.map(p=>p[0]))+100,y0=Math.min(...ends.map(p=>p[1]))-100,y1=Math.max(...ends.map(p=>p[1]))+100;
  const leaves=[],cuts=[];
  function partition(poly,level){
    const size=area(poly),limit=(step*(profile.industrial?2.7:2.35))**2*(.55+rnd()*1.05);
    if(size<limit||level>=9){leaves.push(poly);return;}
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]),wide=Math.max(...xs)-Math.min(...xs)>Math.max(...ys)-Math.min(...ys);
    for(let attempt=0;attempt<18;attempt++){
      const angle=(wide?0:Math.PI/2)+(rnd()-.5)*(profile.industrial?.42:1.22),n=[Math.cos(angle),Math.sin(angle)],values=poly.map(p=>p[0]*n[0]+p[1]*n[1]),lo=Math.min(...values),hi=Math.max(...values),k=lo+(hi-lo)*(.28+rnd()*.44),cut=split(poly,n,k);
      if(cut.crossings.length!==2||cut.halves.some(p=>area(p)<step*step*.8))continue;
      const points=edge(...cut.crossings);
      if(points.slice(1).some((p,i)=>specialSites.some(site=>plotsOverlap([points[i],p],site.points,site.setback+2))))continue;
      cuts.push({ri,points,level,width:level<2?2.6:level<4?1.7:.9});
      cut.halves.forEach(p=>partition(p,level+1));return;
    }
    leaves.push(poly);
  }
  partition([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],0);
  // Trim the actual data, not only the painted road, at shorelines and river channels.
  const streets=[];
  function simplify(points){if(points.length<3)return points;let far=0,at=0;for(let i=1;i<points.length-1;i++){const d=roadDistance(points[i],[points[0],points.at(-1)]);if(d>far){far=d;at=i;}}return far>.2?[...simplify(points.slice(0,at+1)).slice(0,-1),...simplify(points.slice(at))]:[points[0],points.at(-1)];}
  for(const cut of cuts){let run=[];const flush=()=>{if(run.length>1&&Math.hypot(run[0][0]-run.at(-1)[0],run[0][1]-run.at(-1)[1])>3)streets.push({...cut,points:simplify(run)});run=[];};
    for(let i=1;i<cut.points.length;i++){
      const a=cut.points[i-1],b=cut.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);
      for(let j=0;j<n;j++){const t=j/n,p=[round(a[0]+(b[0]-a[0])*t),round(a[1]+(b[1]-a[1])*t)];if(regionAt(p)===ri&&!rivers.some(r=>roadDistance(p,r.points)<r.width/2+cut.width/2+1))run.push(p);else flush();}
    }
    const p=cut.points.at(-1);if(regionAt(p)===ri&&!rivers.some(r=>roadDistance(p,r.points)<r.width/2+cut.width/2+1))run.push(p);flush();
  }
  const parcels=leaves.map(poly=>{const frontages=poly.map((p,i)=>edge(p,poly[(i+1)%poly.length])),boundary=frontages.flatMap(e=>e.slice(0,-1));return {points:boundary,frontages,corners:poly.map(warp),center:warp(center(poly)),area:area(boundary)};}).filter(p=>regionAt(p.center)===ri);
  return {streets,parcels};
}

export function frontageCandidates(parcel,{r,ri,profile,rnd}){
  const p=parcel.corners,choices=[],base=rnd(),industrial=profile.industrial;
  if(parcel.area>4500&&rnd()<.68){
    const w=Math.min(54,Math.sqrt(parcel.area)*(.32+rnd()*.16))*profile.size,d=w*(.65+rnd()*.65),h=profile.height[0]+rnd()*(profile.height[1]-profile.height[0]),angle=Math.atan2(p[1][1]-p[0][1],p[1][0]-p[0][0])*180/Math.PI;
    choices.push({b:[...parcel.center,round(w),round(d),round(h),round(angle),industrial?1:4,ri,round(rnd())],priority:base-.08,parcel});
  }
  for(let ei=0;ei<p.length;ei++){
    const edge=parcel.frontages[ei],lengths=[0];for(let i=1;i<edge.length;i++)lengths.push(lengths.at(-1)+Math.hypot(edge[i][0]-edge[i-1][0],edge[i][1]-edge[i-1][1]));const len=lengths.at(-1);
    const at=distance=>{let i=1;while(i<lengths.length-1&&lengths[i]<distance)i++;const t=(distance-lengths[i-1])/(lengths[i]-lengths[i-1]);return [edge[i-1][0]+(edge[i][0]-edge[i-1][0])*t,edge[i-1][1]+(edge[i][1]-edge[i-1][1])*t];};
    let t=8+rnd()*12,along=0;
    while(t<len-12){
      const size=profile.size*(.62+Math.pow(rnd(),1.8)*1.45),w=(industrial?26:18)*size,d=(industrial?30:21)*profile.size*(.65+rnd()*1.2),gap=3+rnd()*(industrial?10:5),setback=industrial?7:4+rnd()*4;
      if(t+w>len-5)break;
      const a=at(t),b=at(t+w),mid=at(t+w/2),dx=b[0]-a[0],dy=b[1]-a[1],span=Math.hypot(dx,dy),ux=dx/span,uy=dy/span,sign=(parcel.center[0]-mid[0])*(-uy)+(parcel.center[1]-mid[1])*ux>0?1:-1;
      const x=mid[0]-uy*sign*(d/2+setback),y=mid[1]+ux*sign*(d/2+setback),angle=Math.atan2(dy,dx)*180/Math.PI+(rnd()-.5)*(industrial?2:5),shape=profile.shapes[Math.floor(rnd()*profile.shapes.length)],h=profile.height[0]+rnd()*(profile.height[1]-profile.height[0]);
      choices.push({b:[round(x),round(y),round(w),round(d),round(h),round(angle),shape,ri,round(rnd())],priority:base+rnd()*.22,parcel});t+=w+gap;if(++along%3===0)t+=8+rnd()*12;
    }
  }
  return choices;
}

export function joinStreetSeams(streets,{regionAt,specialSites,rivers}){
  const links=[];
  for(const street of streets)for(const start of [street.points[0],street.points.at(-1)]){
    if([...streets,...links].some(s=>s!==street&&roadDistance(start,s.points)<2))continue;
    const options=[];
    for(const other of streets)if(other!==street)for(let i=1;i<other.points.length;i++){
      const a=other.points[i-1],b=other.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((start[0]-a[0])*dx+(start[1]-a[1])*dy)/(dx*dx+dy*dy))),end=[round(a[0]+t*dx),round(a[1]+t*dy)],distance=Math.hypot(end[0]-start[0],end[1]-start[1]);
      if(distance>40||distance<2)continue;
      const points=[start,end];
      if(Array.from({length:11},(_,i)=>[start[0]+(end[0]-start[0])*i/10,start[1]+(end[1]-start[1])*i/10]).some(p=>regionAt(p)<0))continue;
      if(specialSites.some(s=>plotsOverlap(points,s.points,s.setback+1))||rivers.some(r=>r.points.slice(1).some((p,j)=>plotsOverlap(points,[r.points[j],p],r.width/2+1))))continue;
      options.push({points,distance,other});
    }
    if(options.length){const best=options.sort((a,b)=>a.distance-b.distance)[0];for(const ri of new Set([street.ri,best.other.ri]))links.push({ri,points:best.points,width:.9,level:9,seam:true});}
  }
  return links;
}
