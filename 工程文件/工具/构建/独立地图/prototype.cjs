'use strict';
const {fs,path,root,read,assert,sha}=require('../../lib/card-ast.cjs'),{baseline,cache,inputs}=require('./capture.cjs');
function renderSource(source,west){
 if(source.includes('const gpu=window.CxxAtlasGPU'))return source;
 const start=source.indexOf('    const bg=ctx.createLinearGradient',source.indexOf('function draw(){')),end=source.indexOf('    renderLabels();',start);
 if(start<0||end<0)throw Error('draw hook not found');
 source=source.slice(0,start)+`    const gpuPainted=gpu?.draw({camera,width,height,dpr,localRegion:localDepthRegion,tram:state.tram,route:transit.routes.findIndex(r=>r.id===state.route)+1});
    if(!gpuPainted){\n`+source.slice(start,end)+`    }else{ctx.setTransform(dpr,0,0,dpr,0,0);if(state.region&&!state.node){const ri=data.regions.findIndex(r=>r.id===state.region),di=state.selection?.kind==='subdistrict'?districts.findIndex(d=>d.id===state.selection.id):-1,outline=di>=0?districtPaths[di]:regionSelectionPaths[ri];if(outline){ctx.save();const m=projectionCache;ctx.setTransform(dpr*m.a,dpr*m.b,dpr*m.c,dpr*m.d,dpr*m.e,dpr*m.f);for(const [w,a]of [[7,.045],[4,.12],[2,.28],[1.15,.92]]){ctx.strokeStyle=color(data.regions[ri].color,1,a);ctx.lineWidth=w/camera.z;ctx.stroke(outline);}ctx.restore();}}}
`+source.slice(end);
 source=source.replace('  function draw(){',`  const gpu=window.CxxAtlasGPU?.mount({target:canvas,id:${west?"'western'":"activeSector||'overview'"},redraw:requestDraw});\n  function draw(){`);
 source=source.replace('window.TOKYO_ATLAS_UNMOUNT=()=>{','window.TOKYO_ATLAS_UNMOUNT=()=>{gpu?.dispose();');
 return source;
}
function documents(){const assets=JSON.parse(fs.readFileSync(path.join(cache,'gpu-assets.json'),'utf8'));
 assert.deepEqual(assets.sources?.central,inputs(false),'Rebuild the central scene capture');assert.deepEqual(assets.sources?.western,inputs(true),'Rebuild the western scene capture');for(const [file,hash]of Object.entries(assets.sources.tools))assert.equal(sha(read(file)),hash,'Rebuild mesh/pack: '+file);
 return baseline().documents.map(doc=>{const west=doc.id!=='tokyo-central',scripts=[...doc.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)],last=scripts.at(-1),localAssets={pools:Object.fromEntries(Object.entries(assets.pools).filter(([key])=>west?key==='western':key!=='western')),views:Object.fromEntries(Object.entries(assets.views).filter(([key])=>west?key.startsWith('western-'):!key.startsWith('western-')))};
 const source=`window.CXX_ATLAS_GPU_ASSETS=${JSON.stringify(localAssets)};window.CXX_ATLAS_WORKER_SOURCE=${JSON.stringify(read('卡片源码/地图/scene-worker.js'))};\n`+read('卡片源码/地图/gpu-renderer.js')+'\n'+renderSource(read('卡片源码/地图/'+(west?'western-view.js':'atlas.js')),west)+(west?'':'\n'+read('卡片源码/地图/central-sector-runtime.js'))+'\n'+read('卡片源码/地图/map-api.js')+'\n'+read('卡片源码/地图/selection-feedback.js');
 let html=doc.html.replace(last[0],()=>'<script>'+source+'</script>');
 const state=scripts.find(s=>s[1].includes('window.TOKYO_ATLAS_STATE=Object.freeze'));if(!state)throw Error('Missing view-state script');
 html=html.replace(state[0],()=>'<script>'+read('卡片源码/地图/atlas-view-state.js')+'</script>').replace('</head>',()=>'<style>'+read('卡片源码/主题/tokens.css')+'\n'+read('卡片源码/地图/map-labels.css')+'</style></head>');
 return {...doc,html};});}
module.exports={renderSource,documents};if(require.main===module){const docs=documents();for(const d of docs)fs.writeFileSync(path.join(cache,d.id+'-prototype.html'),d.html);console.log(docs.map(d=>[d.id,d.html.length]));}
