'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const {cache}=require('./capture.cjs');
const svgpath=require('../../../卡片源码/地图/build-vendor/svgpath-2.6.0');
const clipper=require('../../../卡片源码/地图/build-vendor/polygon-clipping-0.15.7.cjs');
const same=(a,b)=>Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<1e-7;
const bounds=ring=>ring.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
const contains=(b,p)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
function inside(p,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function area(r){let a=0;for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];a+=p[0]*q[1]-q[0]*p[1];}return a/2;}
function rings(commands){
 const result=[];let current=[],pos=[0,0];
 const move=(x,y)=>{current=[];result.push(current);current.push(pos=[x,y]);};
 const line=(x,y)=>{if(!current.length)move(x,y);else current.push(pos=[x,y]);};
 function curve(p1,p2,p3){const p0=pos.slice(),n=Math.max(4,Math.min(40,Math.ceil((Math.hypot(p1[0]-p0[0],p1[1]-p0[1])+Math.hypot(p3[0]-p2[0],p3[1]-p2[1]))/4)));for(let i=1;i<=n;i++){const t=i/n,s=1-t;line(s*s*s*p0[0]+3*s*s*t*p1[0]+3*s*t*t*p2[0]+t*t*t*p3[0],s*s*s*p0[1]+3*s*s*t*p1[1]+3*s*t*t*p2[1]+t*t*t*p3[1]);}}
 const close=()=>{if(current.length&&!same(current[0],current.at(-1)))current.push(current[0].slice());};
 for(const [op,...a]of commands){
  if(op==='svg'){const parsed=svgpath(a[0]).abs().unshort().unarc().segments;for(const [cmd,...v]of parsed){if(cmd==='M')move(...v);else if(cmd==='L')line(...v);else if(cmd==='H')line(v[0],pos[1]);else if(cmd==='V')line(pos[0],v[0]);else if(cmd==='C')curve(v.slice(0,2),v.slice(2,4),v.slice(4,6));else if(cmd==='Q'){const p=pos.slice();curve([p[0]+(v[0]-p[0])*2/3,p[1]+(v[1]-p[1])*2/3],[v[2]+(v[0]-v[2])*2/3,v[3]+(v[1]-v[3])*2/3],v.slice(2));}else if(cmd==='Z'||cmd==='z')close();else throw Error('Unsupported SVG '+cmd);}continue;}
  if(op==='moveTo')move(...a);else if(op==='lineTo')line(...a);else if(op==='closePath')close();
  else if(op==='rect'){const [x,y,w,h]=a;move(x,y);line(x+w,y);line(x+w,y+h);line(x,y+h);close();}
  else if(op==='bezierCurveTo')curve(a.slice(0,2),a.slice(2,4),a.slice(4));
  else if(op==='quadraticCurveTo'){const p=pos.slice();curve([p[0]+(a[0]-p[0])*2/3,p[1]+(a[1]-p[1])*2/3],[a[2]+(a[0]-a[2])*2/3,a[3]+(a[1]-a[3])*2/3],a.slice(2));}
  else if(op==='arc'||op==='ellipse'){const [x,y,rx,ry,rot,start,end,ccw]=op==='arc'?[a[0],a[1],a[2],a[2],0,a[3],a[4],a[5]]:a;let d=end-start;if(!ccw&&d<0)d+=Math.PI*2;if(ccw&&d>0)d-=Math.PI*2;const n=Math.max(8,Math.min(48,Math.ceil(Math.abs(d)*Math.max(rx,ry)/2)));for(let i=0;i<=n;i++){const t=start+d*i/n,px=x+Math.cos(t)*rx*Math.cos(rot)-Math.sin(t)*ry*Math.sin(rot),py=y+Math.cos(t)*rx*Math.sin(rot)+Math.sin(t)*ry*Math.cos(rot);if(i===0&&!current.length)move(px,py);else line(px,py);}}
  else throw Error('Unsupported path '+op);
 }
 return result.filter(r=>r.length>1);
}
function polygons(rs,rule='nonzero'){
 const list=rs.filter(r=>r.length>=3&&Math.abs(area(r))>1e-8).map(r=>({r,b:bounds(r),a:area(r),parent:null,depth:0})).sort((a,b)=>Math.abs(b.a)-Math.abs(a.a));
 for(let i=0;i<list.length;i++){const n=list[i];for(let j=i-1;j>=0;j--){const p=list[j];if(contains(p.b,n.r[0])&&inside(n.r[0],p.r)){n.parent=p;n.depth=p.depth+1;break;}}}
 const result=[];for(const n of list){const hole=n.parent&&(rule==='evenodd'?n.depth%2:Math.sign(n.a)!==Math.sign(n.parent.a));if(hole){let p=n.parent;while(p&&!p.out)p=p.parent;if(p)p.out.push(n.r);}else{n.out=[n.r];result.push(n.out);}}return result;
}
function rgba(value,alpha){if(value[0]==='#'){let hex=value.slice(1);if(hex.length<=4)hex=hex.split('').map(x=>x+x).join('');return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat((hex.length===8?parseInt(hex.slice(6),16)/255:1)*alpha);}const c=value.match(/[\d.]+/g)?.map(Number);if(!c||c.length<3)throw Error('Color '+value);return [c[0]/255,c[1]/255,c[2]/255,(c[3]??1)*alpha];}
async function compile(file){
 const earcut=(await import('../../../卡片源码/地图/build-vendor/earcut-3.0.2.mjs')).default;
 const data=JSON.parse(fs.readFileSync(file)),{reference:ref}=data,z=ref.z,pathCache=new Map(),polygonCache=new Map(),output=[];
 const transform=(p,m)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
 function get(pathId,m){const key=pathId+':'+m.join(',');if(!pathCache.has(key))pathCache.set(key,rings(data.paths[pathId]).map(r=>r.map(p=>transform(p,m))));return pathCache.get(key);}
 function clipPoly(c){const key=c.path+':'+c.matrix.join(',')+':'+c.rule;if(!polygonCache.has(key))polygonCache.set(key,polygons(get(c.path,c.matrix),c.rule));return polygonCache.get(key);}
 let route=0;
 function primitive(points,offsets,color,layer){const ps=points.length===3?[...points,points[2]]:points,os=offsets||(ps.map(()=>[0,0]));for(let i=0;i<4;i++)output.push((ps[i][0]-ref.width/2)/z,(ps[i][1]-ref.height/2)/z);for(let i=0;i<4;i++)output.push(...os[i]);output.push(layer,...color,route);}
 const n=data.commands.length;
 for(let k=0;k<n;k++){
  const c=data.commands[k],color=rgba(c.color,c.alpha);if(color[3]<=0)continue;route=c.route||0;const rs=get(c.path,c.matrix),clips=c.clips.map(clipPoly),layer=(k+1)/(n+1),scale=Math.hypot(c.matrix[0],c.matrix[1]);
  if(c.kind==='fill'){
   let poly=polygons(rs,c.rule);for(const clip of clips){if(!poly.length)break;poly=clipper.intersection(poly,clip);}
   for(const polygon of poly){const flat=[],holes=[];for(let i=0;i<polygon.length;i++){if(i)holes.push(flat.length/2);for(const p of polygon[i])flat.push(...p);}const indices=earcut(flat,holes);for(let t=0;t<indices.length;t+=3){const points=indices.slice(t,t+3).map(i=>flat.slice(i*2,i*2+2));if(c.pixelRect){const offsets=points.map(p=>[p[0]-c.pixelRect[0],p[1]-c.pixelRect[1]]);primitive(points.map(()=>c.pixelRect),[...offsets,offsets[2]],color,layer);}else primitive(points,null,color,layer);}}
  }else{
   const sw=c.width*scale;const fixed=c.pixelStroke||sw<=1.8;
   for(const ring of rs)for(let i=1;i<ring.length;i++){
    const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<1e-7)continue;
    // Clip centerlines once at build time, preserving coast and district holes.
    const cuts=[0,1];for(const clip of clips)for(const polygon of clip)for(const r of polygon)for(let j=0;j<r.length;j++){const p=r[j],q=r[(j+1)%r.length],ex=q[0]-p[0],ey=q[1]-p[1],cross=dx*ey-dy*ex;if(Math.abs(cross)<1e-9)continue;const px=p[0]-a[0],py=p[1]-a[1],t=(px*ey-py*ex)/cross,u=(px*dy-py*dx)/cross;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}
    cuts.sort((a,b)=>a-b);for(let j=1;j<cuts.length;j++){const t0=cuts[j-1],t1=cuts[j],mid=[a[0]+dx*(t0+t1)/2,a[1]+dy*(t0+t1)/2];if(clips.some(poly=>!poly.some(p=>inside(mid,p[0])&&!p.slice(1).some(h=>inside(mid,h)))))continue;
     const segments=[];if(c.dash.length){const cycle=c.dash.reduce((a,b)=>a+b,0)*scale;let cursor=Math.floor(t0*len/cycle)*cycle;while(cursor<t1*len){let off=0;for(let d=0;d<c.dash.length;d++){const size=c.dash[d]*scale;if(d%2===0){const s=Math.max(t0,(cursor+off)/len),e=Math.min(t1,(cursor+off+size)/len);if(e>s)segments.push([s,e]);}off+=size;}cursor+=cycle;}}else segments.push([t0,t1]);
     for(const [s,e]of segments){const p=[a[0]+dx*s,a[1]+dy*s],q=[a[0]+dx*e,a[1]+dy*e],nx=-dy/len*sw/2,ny=dx/len*sw/2;
      if(fixed)primitive([p,q,q,p],[[nx,ny],[nx,ny],[-nx,-ny],[-nx,-ny]],color,layer);
      else primitive([[p[0]+nx,p[1]+ny],[q[0]+nx,q[1]+ny],[q[0]-nx,q[1]-ny],[p[0]-nx,p[1]-ny]],null,color,layer);
     }
    }
   }
  }
 }
 const binary=Buffer.from(new Float32Array(output).buffer),packed=zlib.deflateSync(binary,{level:9}),dest=file.replace('.capture.json','.mesh.deflate');fs.writeFileSync(dest,packed);
 const meta={...ref,instances:output.length/22,bytes:binary.length,packedBytes:packed.length,commands:n,file:path.basename(dest)};fs.writeFileSync(dest+'.json',JSON.stringify(meta));console.log(path.basename(dest),meta.instances,meta.bytes,meta.packedBytes);return meta;
}
module.exports={compile,rings,polygons};if(require.main===module)(async()=>{for(const f of fs.readdirSync(cache).filter(f=>f.endsWith('.capture.json'))){const input=path.join(cache,f);if(!process.argv.includes('--force')&&fs.existsSync(input.replace('.capture.json','.mesh.deflate')))continue;await compile(input);}})().catch(e=>{console.error(e);process.exitCode=1;});
