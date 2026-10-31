'use strict';
const {fs,path,assert,sha,read}=require('../../lib/card-ast.cjs'),{cache,inputs}=require('./capture.cjs'),zlib=require('node:zlib');
function pack(){
 const groups=new Map(),files=fs.readdirSync(cache).filter(f=>f.endsWith('.mesh.deflate'));
 for(const file of files){const id=file.split(/-(?:ground|scene|transit)-/)[0];if(!groups.has(id))groups.set(id,[]);groups.get(id).push(file);}
 const sources={};for(const [name,west]of [['central',false],['western',true]]){sources[name]=JSON.parse(fs.readFileSync(path.join(cache,name+'-capture-inputs.json'),'utf8'));assert.deepEqual(sources[name],inputs(west),'Scene capture is stale: '+name);}
 sources.tools=Object.fromEntries(['工具/构建/独立地图/mesh.cjs','工具/构建/独立地图/pack.cjs','卡片源码/地图/scene-worker.js'].map(file=>[file,sha(read(file))]));
 const result={pools:{},views:{},sources},receipt=[];
 for(const [id,files]of groups){const dictionary=new Map(),geometries=[];
  for(const file of files){const raw=zlib.inflateSync(fs.readFileSync(path.join(cache,file))),f=new Float32Array(raw.buffer,raw.byteOffset,raw.byteLength/4),ids=new Uint32Array(f.length/22);
   for(let i=0;i<ids.length;i++){const geom=Buffer.alloc(56),start=i*22;for(let j=0;j<8;j++)geom.writeInt32LE(Math.round(f[start+j]*100),j*4);for(let j=0;j<8;j++)geom.writeInt16LE(Math.round(f[start+8+j]*1000),32+j*2);for(let j=0;j<4;j++)geom[48+j]=Math.round(Math.max(0,Math.min(1,f[start+17+j]))*255);geom.writeInt32LE(f[start+21],52);const key=geom.toString('base64');let n=dictionary.get(key);if(n===undefined){n=geometries.length;dictionary.set(key,n);geometries.push(geom);}ids[i]=n;}
   // Consecutive draw IDs usually differ by one. ZigZag varints retain the exact
   // order without repeatedly storing four-byte absolute IDs for every view.
   const deltas=[];let previous=0;for(const value of ids){const delta=value-previous;let v=((delta<<1)^(delta>>31))>>>0;while(v>127){deltas.push((v&127)|128);v>>>=7;}deltas.push(v);previous=value;}
   const indices=zlib.deflateSync(Buffer.from(deltas),{level:9});result.views[file.replace('.mesh.deflate','')]={pool:id,count:ids.length,encoding:'delta-v1',data:indices.toString('base64')};
  }
  // Shape-aware integer deltas omit repeated triangle corners and opposite line offsets.
  const count=geometries.length,palette=[],paletteIds=new Map(),stream=[];let previousX=0,previousY=0;
  const uint=v=>{v>>>=0;while(v>127){stream.push((v&127)|128);v>>>=7;}stream.push(v);},sint=v=>uint((v<<1)^(v>>31));
  for(const g of geometries){const p=Array.from({length:8},(_,i)=>g.readInt32LE(i*4)),o=Array.from({length:8},(_,i)=>g.readInt16LE(32+i*2)),color=g.readUInt32LE(48);if(!paletteIds.has(color)){paletteIds.set(color,palette.length);palette.push(color);}const line=p[0]===p[6]&&p[1]===p[7]&&p[2]===p[4]&&p[3]===p[5]&&o[0]===o[2]&&o[1]===o[3]&&o[4]===-o[0]&&o[5]===-o[1]&&o[6]===-o[0]&&o[7]===-o[1],tag=line?2:o.some(Boolean)?3:p[4]===p[6]&&p[5]===p[7]?0:1;
   stream.push(tag);uint(paletteIds.get(color));uint(g.readInt32LE(52)+1);sint(p[0]-previousX);sint(p[1]-previousY);previousX=p[0];previousY=p[1];const vertices=tag===2?2:tag===0?3:4;for(let j=1;j<vertices;j++){sint(p[j*2]-p[0]);sint(p[j*2+1]-p[1]);}if(tag===2){sint(o[0]);sint(o[1]);}else if(tag===3)o.forEach(sint);
  }
  const header=Buffer.alloc(8+palette.length*4);header.writeUInt32LE(count);header.writeUInt32LE(palette.length,4);palette.forEach((v,i)=>header.writeUInt32LE(v,8+i*4));const bytes=Buffer.concat([header,Buffer.from(stream)]),packed=zlib.deflateSync(bytes,{level:9});result.pools[id]=packed.toString('base64');receipt.push({id,geometries:count,decodedBytes:4+count*56,streamBytes:bytes.length,packedBytes:packed.length,views:files.length});
 }
 fs.writeFileSync(path.join(cache,'gpu-assets.json'),JSON.stringify(result));fs.writeFileSync(path.join(cache,'gpu-pack.json'),JSON.stringify(receipt,null,2));console.log(receipt);return result;
}
module.exports={pack};if(require.main===module)pack();
