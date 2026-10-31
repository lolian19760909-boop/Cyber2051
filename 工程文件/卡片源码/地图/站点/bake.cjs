'use strict';
// Offline rendering only. The public site receives WebP tiles, never scene geometry.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const B=require('./build-data.cjs'),native=path.join(B.mapRoot,'art-studies/hologram/core-seven/native-3d');
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function main(){
 const catalog=B.build(),raw=JSON.parse(fs.readFileSync(path.join(B.root,'.cache/map-site-20261029/current-maps.json'))),scene=JSON.parse(fs.readFileSync(path.join(native,'data/scene.json')));
 const {projection,project}=await import('./projection.mjs'),size=512,pad=24,batch=4,extent=size*batch+pad*2,assets=path.join(B.out,'assets');fs.mkdirSync(assets,{recursive:true});
 const quarter=scene.authoredQuarter,rowsBuffer=fs.readFileSync(path.join(native,'data',scene.adapted.instances.file)),rows=new Float32Array(rowsBuffer.buffer,rowsBuffer.byteOffset,rowsBuffer.length/4),corners=[];
 let cursor=(scene.adapted.instanceCount-quarter.groups.reduce((n,g)=>n+g.pieces,0)-(quarter.subsurface?.length||0)-(quarter.surfaceMarkings?.length||0)-(quarter.links||[]).reduce((n,g)=>n+(g.pieces||0),0))*15;
 for(const group of quarter.groups){if((quarter.sampleBlocks||['UP-06','UP-07']).includes(group.blockId))for(let at=cursor;at<cursor+group.pieces*15;at+=15)for(const x of [0,1])for(const y of [0,1])for(const z of [0,1]){const p=[0,1,2].map(i=>rows[at+i]+x*rows[at+3+i]+y*rows[at+6+i]+z*rows[at+9+i]);corners.push(project(p,p[2]));}cursor+=group.pieces*15;}
 const sampleBounds=[Math.min(...corners.map(p=>p[0]))-12,Math.min(...corners.map(p=>p[1]))-12,Math.max(...corners.map(p=>p[0]))+12,Math.max(...corners.map(p=>p[1]))+12];
 const inputHash=B.sha(JSON.stringify({catalog:catalog.revision,raw,scene,baker:B.sha(Buffer.concat([fs.readFileSync(__filename),fs.readFileSync(path.join(__dirname,'tile-delta.cjs'))])),renderer:B.sha(fs.readFileSync(path.join(native,'renderer.js'))),base:B.sha(fs.readFileSync(path.join(__dirname,'base-render.mjs'))),projection}));
 const priorFile=path.join(B.out,'data/tiles.json');if(fs.existsSync(priorFile)&&JSON.parse(fs.readFileSync(priorFile)).sourceHash===inputHash&&!process.argv.includes('--force')){console.log('图块来源未变，复用现有产物。');return;}
 const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;let body,type='text/javascript';
  if(p==='/'){type='text/html';body=`<canvas id="native" style="width:${extent}px;height:${extent}px"></canvas><script src="/renderer.js"></script><script type="module">import {prepareBase} from "/base-render.mjs";window.prepareBase=prepareBase;window.ready=true;</script>`;}
  else if(p==='/renderer.js')body=fs.readFileSync(path.join(native,'renderer.js'));
  else if(['/base-render.mjs','/projection.mjs'].includes(p))body=fs.readFileSync(path.join(__dirname,p.slice(1)));
  else if(p==='/scene.json'){body=JSON.stringify(scene);type='application/json';}
  else if(/^\/data\/[a-zA-Z0-9_.-]+$/.test(p)){body=fs.readFileSync(path.join(native,p));type='application/octet-stream';}
  else{res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':type});res.end(body);
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));server.unref();
 const browser=await chromium.launch({headless:true,channel:'msedge'});let bytesTotal=0,batches=0,renderedBatches=0;const jobFile=path.join(B.root,'.cache/map-clarity-20261029/bake-job.json');let job={sourceHash:inputHash,tiles:{}};if(fs.existsSync(jobFile)){const previous=JSON.parse(fs.readFileSync(jobFile));if(previous.sourceHash===inputHash)job=previous;}let reuseReceipt=null;const reuseArg=process.argv.indexOf('--reuse-from');if(reuseArg>=0){const reuse=require('./tile-delta.cjs')({baseline:path.resolve(process.argv[reuseArg+1]),B,raw,catalog,scene,native,projection,project});job.tiles={...reuse.tiles,...job.tiles};reuseReceipt=reuse.receipt;console.log(JSON.stringify(reuseReceipt));}const persistJob=()=>fs.writeFileSync(jobFile,JSON.stringify(job));const writeRef=(dir,bytes)=>{const hash=B.sha(bytes),file=dir+'/'+hash+'.json';fs.mkdirSync(path.dirname(path.join(B.out,file)),{recursive:true});if(!fs.existsSync(path.join(B.out,file)))fs.writeFileSync(path.join(B.out,file),bytes);return{path:file,sha256:hash,bytes:bytes.length};};
 const result={schema:'cyber2051.map-tiles/2',revision:scene.iteration,sourceHash:inputHash,projection,tileSize:size,maps:[]};
 try{const page=await browser.newPage({viewport:{width:560,height:560},deviceScaleFactor:1});await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready);
  await page.evaluate(async extent=>{const manifest=await(await fetch('/scene.json')).json();window.city=new CxxNativeCity3D(document.getElementById('native'),manifest,null,{transparent:true});await city.load('/data/','adapted');window.output=document.createElement('canvas');output.width=output.height=extent;},extent);
  for(const data of raw){const b=data.overviewBounds||data.bounds,lo=project(b.slice(0,2)),hi=project(b.slice(2)),bounds=[lo[0],lo[1]-160,hi[0],hi[1]],map={id:data.mapId,bounds,tiles:[],levels:[],artCoverage:data.mapId==='tokyo-central'?[{id:'ring-sample',bounds:sampleBounds,status:'study'}]:[]};
   const specs=[.0625,.125,.25,.5,1,2,4,8,16].map(scale=>({scale,bounds}));
   await page.evaluate(data=>{window.paintBase=prepareBase(data);},data);
   map.chunks=[];
   for(const [level,spec]of specs.entries()){
    const scale=spec.scale,x0=Math.floor(spec.bounds[0]*scale/size),y0=Math.floor(spec.bounds[1]*scale/size),x1=Math.ceil(spec.bounds[2]*scale/size),y1=Math.ceil(spec.bounds[3]*scale/size);map.levels.push({id:level,scale,bounds:spec.bounds,grid:[x0,y0,x1,y1]});
    const buckets=new Map();
    for(const mode of ['city','roads'])for(let y=y0;y<y1;y+=batch)for(let x=x0;x<x1;x+=batch){
     const nx=Math.min(batch,x1-x),ny=Math.min(batch,y1-y),keys=Array.from({length:nx*ny},(_,i)=>[data.mapId,mode,level,x+i%nx,y+Math.floor(i/nx)].join(':'));
     let tiles=keys.map(k=>job.tiles[k]),batchChanged=false;
     if(tiles.some(t=>!t||!fs.existsSync(path.join(B.out,t.path)))){
      batchChanged=true;renderedBatches++;const origin=[x*size/scale-pad/scale,y*size/scale-pad/scale];
      const encoded=await page.evaluate(({origin,scale,mode,mapId,extent,nx,ny})=>{
       const ctx=output.getContext('2d');window.paintBase(ctx,{origin,scale,size:extent,mode});
       if(mapId==='tokyo-central'){const c=city;c.center=[origin[0]+extent/2/scale,(origin[1]+extent/2/scale)/Math.sin(65*Math.PI/180),0];c.span=extent/scale;c.yaw=0;c.pitch=65*Math.PI/180;c.showBuildings=mode==='city';c.draw();c.gl.finish();if(c.gl.getError())throw Error('三维图块渲染失败');ctx.drawImage(c.canvas,0,0);}
       const tile=document.createElement('canvas');tile.width=tile.height=512;const rows=[];for(let yy=0;yy<ny;yy++)for(let xx=0;xx<nx;xx++){tile.getContext('2d').drawImage(output,24+xx*512,24+yy*512,512,512,0,0,512,512);rows.push(tile.toDataURL('image/webp',.94).split(',')[1]);}return rows;
      },{origin,scale,mode,mapId:data.mapId,extent,nx,ny});
      tiles=encoded.map((data,i)=>{const xx=x+i%nx,yy=y+Math.floor(i/nx),bytes=Buffer.from(data,'base64'),hash=B.sha(bytes),file='assets/'+hash+'.webp';if(!fs.existsSync(path.join(B.out,file)))fs.writeFileSync(path.join(B.out,file),bytes);const tile={level,mode,x:xx,y:yy,rect:[xx*size/scale,yy*size/scale,size/scale,size/scale],path:file,sha256:hash,bytes:bytes.length};job.tiles[keys[i]]=tile;return tile;});
     }
     for(const tile of tiles){bytesTotal+=tile.bytes;const cx=Math.floor(tile.x/8),cy=Math.floor(tile.y/8),key=mode+':'+cx+':'+cy;if(!buckets.has(key))buckets.set(key,{mode,level,x:cx,y:cy,tiles:[]});buckets.get(key).tiles.push(tile);}
     batches++;if(batchChanged&&renderedBatches%50===0){persistJob();console.log(JSON.stringify({map:data.mapId,level,mode,batches,tiles:Object.keys(job.tiles).length}));}
    }
    for(const chunk of buckets.values()){const ref=writeRef('data/chunks',Buffer.from(JSON.stringify({mapId:data.mapId,...chunk})));map.chunks.push({level,mode:chunk.mode,x:chunk.x,y:chunk.y,bounds:[chunk.x*8*size/scale,chunk.y*8*size/scale,(chunk.x+1)*8*size/scale,(chunk.y+1)*8*size/scale],...ref});}
    console.log(data.mapId+' level '+level+' complete');persistJob();
   }
   delete map.tiles;map.maxZoom=12;map.tileCount=map.levels.reduce((n,l)=>n+(l.grid[2]-l.grid[0])*(l.grid[3]-l.grid[1])*2,0);
   const ref=writeRef('data/tiles',Buffer.from(JSON.stringify(map)));result.maps.push({id:map.id,bounds:map.bounds,levels:map.levels,artCoverage:map.artCoverage,index:ref.path,sha256:ref.sha256,bytes:ref.bytes,tileCount:map.tileCount});
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
 fs.writeFileSync(priorFile+'.next',JSON.stringify(result));fs.renameSync(priorFile+'.next',priorFile);fs.writeFileSync(path.join(B.root,'.cache/map-site-20261029/bake-receipt.json'),JSON.stringify({sourceHash:inputHash,revision:scene.iteration,maps:result.maps.map(m=>({id:m.id,tiles:m.tileCount})),bytesTotal,renderedBatches,projection,reuse:reuseReceipt},null,2));console.log(JSON.stringify({tiles:result.maps.reduce((n,m)=>n+m.tileCount,0),bytesTotal,sourceHash:inputHash}));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
