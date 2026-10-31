'use strict';
const B=require('../../lib/card-ast.cjs'),{fs,path,assert,root,read}=B;
const {chromium}=require('C:/Users/lolian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const input=path.join(root,'交付/基线/2.3.0-整理前.json'),cache=path.join(root,'.cache/map-2114');
function baseline(){const raw=fs.readFileSync(input);return B.extract(JSON.parse(raw));}
function inputs(west){return Object.fromEntries(['工具/构建/独立地图/capture.cjs','工具/构建/独立地图/record-context.js','卡片源码/地图/'+(west?'western-view.js':'atlas.js'),...west?[]:['卡片源码/地图/central-sector-runtime.js']].map(file=>[file,B.sha(read(file))]));}
function instrument(source,west){
 if(west)source=source.replace(", ctx=canvas.getContext('2d');",";let ctx=canvas.getContext('2d');");
 source=source.replace('function boundsVisible(b,margin=2,minHeight=0,maxHeight=0){','function boundsVisible(b,margin=2,minHeight=0,maxHeight=0){if(window.CXX_MAP_BAKING)return true;');
 source=source.replace('function visibleBuildings(){','function visibleBuildings(){if(window.CXX_MAP_BAKING)return allBuildings;');
 source=source.replace("city.tram.routes.forEach((r,i)=>{target.save();target.globalAlpha", "city.tram.routes.forEach((r,i)=>{target.save();target.routeCode=i+1;target.globalAlpha");
 source=source.replace("for(const s of city.tram.stops){", "for(const s of city.tram.stops){target.routeCode=transit.routes.findIndex(r=>s.lines.includes(r.id))+1;");
 source=source.replace("for(const s of railPaths){target.save();target.globalAlpha", "for(const s of railPaths){target.save();target.routeCode=transit.routes.findIndex(r=>r.id===s.routeId)+1;target.globalAlpha");
 source=source.replace("ctx.save();ctx.globalAlpha=state.route&&state.route!==s.routeId", "ctx.save();ctx.routeCode=transit.routes.findIndex(r=>r.id===s.routeId)+1;ctx.globalAlpha=state.route&&state.route!==s.routeId");
 source=source.replace("if(item.pier){const p=item.pier", "if(item.pier){ctx.routeCode=-1;const p=item.pier").replace("ctx.lineWidth=Math.max(1,1.3*camera.z);ctx.stroke();continue;", "ctx.lineWidth=Math.max(1,1.3*camera.z);ctx.stroke();ctx.routeCode=0;continue;");
 const hook=`
 window.CXX_MAP_CAPTURE=({mode='depth',region=-1,z=3,section='scene'}={})=>{
  const old={ctx,width,height,dpr,camera:{...camera},region:localDepthRegion,tween,gesture,projectionCache};
  window.CXX_MAP_BAKING=true;ctx=new window.CxxMapRecorder();width=200000;height=200000;dpr=1;tween=null;gesture=null;localDepthRegion=region;
  Object.assign(camera,{x:0,y:0,z,mode});projectionCache=cameraMatrix(camera);state.region=null;state.node=null;state.tram=true;state.route=null;
  renderStats={flatBuildingCalls:0,depthBuildingCalls:0,microFlatTiles:0,microDepthTiles:0,sortedItems:0,depthRegions:new Set()};
  const m=projectionCache;ctx.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);
  if(section==='ground'){
   ctx.strokeStyle='#23414c40';ctx.lineWidth=.5/z;ctx.pixelStroke=true;
   for(let x=Math.ceil(worldMinX/140)*140;x<worldMaxX;x+=140){ctx.beginPath();ctx.moveTo(x,worldMinY);ctx.lineTo(x,worldMaxY);ctx.stroke();}
   for(let y=Math.ceil(worldMinY/140)*140;y<worldMaxY;y+=140){ctx.beginPath();ctx.moveTo(worldMinX,y);ctx.lineTo(worldMaxX,y);ctx.stroke();}
   ctx.pixelStroke=false;terrain(ctx,z);${west?'':`ctx.pixelStroke=true;paintNightBorders(ctx);ctx.pixelStroke=false;`}
  }
  if(section==='scene'){smallBuildings(ctx,z,true);${west?'':'nightMicroLights();'}ctx.setTransform(1,0,0,1,0,0);mountainRelief();drawStructures(false);}
  if(section==='transit'){tramLayer(ctx,z);railGround(ctx,z);}
  const result={...ctx.export(),reference:{mode,region,z,width,height},mapId:data.mapId,regions:data.regions.map(r=>r.id)};
  ctx=old.ctx;width=old.width;height=old.height;dpr=old.dpr;Object.assign(camera,old.camera);localDepthRegion=old.region;tween=old.tween;gesture=old.gesture;projectionCache=old.projectionCache;window.CXX_MAP_BAKING=false;return result;
 };
 `;
 return source.replace('  // Same-origin preview bridge',hook+'\n  // Same-origin preview bridge');
}
async function capture({sectors=['central-core','waterfront'],west=false,all=false,force=false}={}){
 fs.mkdirSync(cache,{recursive:true});const docs=baseline().documents;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const doc of docs.filter(d=>west?d.id!=='tokyo-central':d.id==='tokyo-central')){
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>console.error(e.message));await page.route('**/*',r=>r.abort());
  const scripts=[...doc.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)],last=scripts.at(-1);
  const source=read('卡片源码/地图/'+(west?'western-view.js':'atlas.js'));
  const html=doc.html.replace(last[0],()=>'<script>'+fs.readFileSync(path.join(__dirname,'record-context.js'),'utf8')+'\n'+instrument(source,west)+(west?'':'\n'+read('卡片源码/地图/central-sector-runtime.js'))+'</script>');
  await page.setContent(html,{waitUntil:'load'});await page.waitForFunction(()=>window.CXX_MAP_CAPTURE);
  const ids=west?['western']:all?await page.evaluate(()=>[...TOKYO_ATLAS.sectorDefinitions.map(s=>s.id),'overview']):sectors;
  for(const id of ids){if(!west)await page.evaluate(id=>TOKYO_ATLAS_SECTORS.open(id==='overview'?null:id),id);await page.waitForTimeout(30);
   const variants=[['flat',-1],['depth',-1]];
   if(all){const local=await page.evaluate(()=>{const d=TOKYO_ATLAS,active=d.sectorView?.id;return d.regions.map((r,i)=>!d.sectorView||r.id===active||active==='central-core'&&r.kind==='legacy'||r.kind==='overlay'?i:-1).filter(i=>i>=0);});for(const ri of local)variants.push(['auto',ri]);}
   for(const [mode,region]of variants)for(const z of [0.7,3])for(const section of ['ground','scene','transit']){
    if(section!=='scene'&&(region!==-1||mode!=='flat'))continue;
    const file=path.join(cache,`${id}-${section}-${mode}-${region}-${z}.capture.json`);if(fs.existsSync(file)&&!force)continue;
    const data=await page.evaluate(args=>CXX_MAP_CAPTURE(args),{mode,region,z,section});fs.writeFileSync(file,JSON.stringify(data));console.log(id,section,mode,region,z,data.commands.length);
   }
  }if(all)fs.writeFileSync(path.join(cache,(west?'western':'central')+'-capture-inputs.json'),JSON.stringify(inputs(west)));await page.close();
 }}finally{await browser.close();}
}
module.exports={baseline,capture,cache,instrument,inputs};if(require.main===module)capture({all:process.argv.includes('--all'),west:process.argv.includes('--west'),force:process.argv.includes('--force')}).catch(e=>{console.error(e);process.exitCode=1;});
