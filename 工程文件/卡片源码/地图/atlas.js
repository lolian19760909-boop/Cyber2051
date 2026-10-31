window.TOKYO_ATLAS_MOUNT=()=>{
  'use strict';
  const lifetime=new AbortController();let paused=false;
  const listen=(target,name,fn,options={})=>target.addEventListener(name,fn,{...(typeof options==='boolean'?{capture:options}:options),signal:lifetime.signal});
  for(const id of ['map-labels','region-list','node-list','place-filters','tram-routes'])document.getElementById(id)?.replaceChildren();
  const regionOptions=document.getElementById('place-region');while(regionOptions?.options.length>1)regionOptions.remove(1);

  const data=window.TOKYO_ATLAS, $=s=>document.querySelector(s);
  const night=data.mapId==='tokyo-central'&&data.centralNight?.revision==='230-night-1';
  const sector=data.sectorView,activeSector=sector?.id;
  const regionVisible=r=>r.kind!=='alias'&&(!sector||(r.kind!=='legacy'||activeSector==='central-core')&&(r.id!=='central-core'||activeSector!=='central-core'));
  const effectiveRegion=(id,at)=>{if(!sector)return id;const r=data.regions.find(r=>r.id===id);if(r?.kind==='alias')return sector.oldSector[id];return id;};
  const placeRegion=n=>sector&&n.sectorId!=='central-core'?n.sectorId:n.group;
  const navigate=(kind,id)=>sector&&window.TOKYO_ATLAS_SECTORS.navigate({kind,id});
  const worldMinX=data.world.minX||0,worldMinY=data.world.minY||0,worldMaxX=worldMinX+data.world.width,worldMaxY=worldMinY+data.world.height;
  const root=$('#atlas'), map=$('#map'), canvas=$('#map-canvas');let ctx=canvas.getContext('2d');
  const regionList=$('#region-list'),nodeList=$('#node-list'),labels=$('#map-labels'),detail=$('#detail');
  const uiMotion=window.CxxMotion?.mount(root);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion=()=>reduced.matches||['reduced','off'].includes(document.documentElement.dataset.motion);
  const camera={x:1828,y:1424,z:.35,mode:'auto',...data.initialView}, state={region:null,node:null,poi:true,names:false,selection:null,type:'all',tram:true,route:null,filterRegion:null};
  const mapName=data.displayName||'东京都 · 中心大区';
  $('.location small').textContent=mapName;
  if(sector){const note=$('.index-note');note.childNodes[1].textContent='5 个分区 · 7 个核心地区';$('[data-view=depth]').title='当前分区全部楼体 3D';}
  $('.mast-center .version').textContent=sector?'05 SECTORS':String(data.regions.length).padStart(2,'0')+' DISTRICTS';
  const expansion=data.districtExpansion,terrainContext=data.terrainContext,rail=data.railNetwork;
  const districts=expansion.districts,allComplexes=[...data.complexes,...terrainContext.complexes],allBuildings=[...data.buildings,...expansion.buildings];
  const places=[...data.nodes,...data.services,...expansion.places,...terrainContext.places],port=data.regions.find(r=>r.id==='minato'),regionsById=new Map(data.regions.map(r=>[r.id,r]));
  let query='';
  const iconPaths={weapon:'M3 7h15v5h-7l-2 6H5l2-6H3z M15 7V4h4v3',implant:'M8 2h8v5h5v9h-5v6H8v-6H3V7h5z M10 10h4v4h-4z',hospital:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',market:'M5 8h14l2 13H3z M8 8V5a4 4 0 0 1 8 0v3',transit:'M4 4h16v12H4z M7 8h10 M7 13h2 M15 13h2 M8 16l-3 5 M16 16l3 5',spaceport:'M12 2l4 8-4 12-4-12z M3 14l5-3 M21 14l-5-3 M3 5a11 11 0 0 1 18 14',legacy:'M12 2l10 10-10 10L2 12z M8 12h8 M12 8v8',school:'M3 4l9 3 9-3v15l-9 3-9-3z M12 7v15',music:'M9 18V5l11-2v13 M9 5l11-2 M5 18a4 3 0 1 0 4 0 M16 16a4 3 0 1 0 4 0'};
  iconPaths.parking='M4 3h16v18H4z M9 18V7h4a3 3 0 0 1 0 6H9';
  function icon(type){if(data.icons[type]){const img=document.createElement('img');img.className='map-icon';img.src=data.icons[type];img.alt='';img.draggable=false;img.width=50;img.height=50;return img;}const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',iconPaths[type]||iconPaths.legacy);svg.append(path);return svg;}
  const placeType=n=>n.type||(n.id==='a-yang-clinic'?'implant':'legacy'),glyphType=n=>n.id==='a-yang-clinic'?'implant':n.type||(n.cat==='学校'?'school':n.cat==='场馆'?'music':n.cat==='店铺'?'market':'legacy');
  function matchesPlace(n,type=state.type){const r=regionsById.get(n.group);return parent.CxxAtlasTool?.visible?.(n.id)!==false&&(!state.filterRegion||n.group===state.filterRegion||placeRegion(n)===state.filterRegion||n.sectorId===state.filterRegion)&&(type==='all'||type==='legacy'&&!n.proposal||placeType(n)===type)&&[n.name,n.cat,r.name,r.en,regionsById.get(placeRegion(n))?.name,...(n.archive?.contacts||[]).map(c=>c.name)].join(' ').toLocaleLowerCase().includes(query);}
  let width=0,height=0,dpr=1,frame=0,tween=null,drawMs=0,drawCount=0,disposed=false;
  const drawSamples=[];
  let projectionCache=null,detailHeight=0,clusterSignature='';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
  let localDepthRegion=-1,renderStats={};
  function selectionRegion(selection){const d=selection?.kind==='subdistrict'?districts.find(d=>d.id===selection.id):null,n=selection?.kind==='node'?places.find(n=>n.id===selection.id):null;const id=selection?.kind==='region'?effectiveRegion(selection.id):n?placeRegion(n):d?(sector&&d.sectorId!=='central-core'?d.sectorId:d.parent):null;return data.regions.findIndex(r=>r.id===id);}
  const depth=c=>c.mode==='depth'||c.mode==='auto'&&localDepthRegion>=0?1:0;
  const groundDepth=c=>c.mode==='depth'?1:0;
  const regionDepth=ri=>camera.mode==='depth'||camera.mode==='auto'&&ri>=0&&(ri===localDepthRegion||sector&&activeSector==='central-core'&&data.regions[localDepthRegion]?.id==='central-core')?1:0;
  function cameraMatrix(c){const t=groundDepth(c),a=t*.26,co=Math.cos(a),si=Math.sin(a),k=1-t*.25,A=co*c.z,B=si*k*c.z,C=-si*c.z,D=co*k*c.z;return {a:A,b:B,c:C,d:D,e:width/2-A*c.x-C*c.y,f:height/2-B*c.x-D*c.y,lift:depth(c)*c.z};}
  function project(p,h=0,c=camera){if(c===camera&&projectionCache){const m=projectionCache;return [m.a*p[0]+m.c*p[1]+m.e,m.b*p[0]+m.d*p[1]+m.f-h*m.lift];}const t=groundDepth(c),a=t*.26,co=Math.cos(a),si=Math.sin(a),x=p[0]-c.x,y=p[1]-c.y;return [width/2+(x*co-y*si)*c.z,height/2+((x*si+y*co)*(1-t*.25)-h*depth(c))*c.z];}
  function unproject(p,c=camera){const t=groundDepth(c),a=t*.26,co=Math.cos(a),si=Math.sin(a),x=(p[0]-width/2)/c.z,y=(p[1]-height/2)/c.z/(1-t*.25);return [c.x+x*co+y*si,c.y-x*si+y*co];}
  function path(points,h=0,close=false){ctx.beginPath();points.forEach((p,i)=>{const [x,y]=project(p,h);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});if(close)ctx.closePath();}
  function color(hex,l=1,alpha=1){const v=parseInt(hex.slice(1),16);return `rgba(${Math.round((v>>16)*l)},${Math.round((v>>8&255)*l)},${Math.round((v&255)*l)},${alpha})`;}
  const ink=night?{...data.mapStyle,water:'#04080d',land:'#0a0f13',yard:'#14191b',park:'#0c1917'}:data.mapStyle;
  function districtTone(hex,light,alpha=1){const v=parseInt(hex.slice(1),16),rgb=[v>>16,v>>8&255,v&255],gray=rgb[0]*.3+rgb[1]*.5+rgb[2]*.2;return `rgba(${rgb.map(c=>Math.round((c*(night?.3:.64)+gray*(night?.7:.36))*light)).join(',')},${alpha})`;}
  const palettes=data.regions.map(r=>({land:color(r.color,night?.12:.18,night?.12:.24),edge:color(r.color,.7,.25),top:(night?[.28,.38,.49]:[.32,.43,.55]).map(l=>districtTone(r.color,l)),side:districtTone(r.color,.13),front:districtTone(r.color,.23),line:districtTone(r.color,.82,night?.36:.55)}));
  function compiled(lines,closed=false){const p=new Path2D();for(const line of lines){line.forEach((v,i)=>i?p.lineTo(...v):p.moveTo(...v));if(closed)p.closePath();}return p;}
  function boundsOf(points){const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of points){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;}
  // Reject only whole screen-exterior bounds; keep path vertices and draw order intact.
  function boundsVisible(b,margin=2,minHeight=0,maxHeight=0){if(!projectionCache||!Number.isFinite(b[0]))return true;const m=projectionCache,x=(b[0]+b[2])/2,y=(b[1]+b[3])/2,rx=(b[2]-b[0])/2,ry=(b[3]-b[1])/2,sx=m.a*x+m.c*y+m.e,sy=m.b*x+m.d*y+m.f,ex=Math.abs(m.a)*rx+Math.abs(m.c)*ry,ey=Math.abs(m.b)*rx+Math.abs(m.d)*ry;return sx+ex>=-margin&&sx-ex<=width+margin&&sy+ey-minHeight*m.lift>=-margin&&sy-ey-maxHeight*m.lift<=height+margin;}
  const regionPaths=data.regions.map(r=>night&&r.selectionPath?new Path2D(r.selectionPath):compiled(r.polygons.flat(),true));
  const regionBounds=data.regions.map(r=>night?r.selectionBounds:boundsOf(r.polygons.flat(2)));
  const regionSelectionPaths=data.regions.map((r,i)=>r.selectionPath?new Path2D(r.selectionPath):regionPaths[i]);
  const mainlandPath=data.landPath?new Path2D(data.landPath):compiled(data.landmass,true);
  const streetWidths=[.9,1.7,2.6],streetPaths=data.regions.map((_,i)=>streetWidths.map(w=>compiled(data.streets.filter(s=>s.ri===i&&s.width===w).map(s=>s.points))));
  const groundPaths=data.regions.map((_,ri)=>Object.fromEntries(['park','yard','block'].map(type=>[type,compiled(data.grounds.filter(g=>g.ri===ri&&g.type===type).map(g=>g.points),true)])));
  const streetMask=compiled([[[worldMinX,worldMinY],[worldMaxX,worldMinY],[worldMaxX,worldMaxY],[worldMinX,worldMaxY]],...data.specialSites.map(s=>s.points)],true);
  const terrainOrder=data.regions.map((r,i)=>regionVisible(r)?i:-1).filter(i=>i>=0);
  const roadPaths=data.roads.map(r=>compiled([r.points])),riverPaths=data.rivers.map(r=>compiled([r.points]));
  const roadBounds=data.roads.map(r=>boundsOf(r.points));
  const city=data.cityDetail,tramPaths=city.tram.routes.map(r=>compiled([r.points]));
  const transit={routes:[...city.tram.routes,...rail.routes],stops:[...city.tram.stops,...rail.stops.map(s=>({...s,lines:s.routeIds}))]};
  const districtPaths=districts.map(d=>night&&d.selectionPath!==undefined?new Path2D(d.selectionPath):compiled([d.points],true)),expansionRoads=[...new Set(expansion.roads.map(r=>r.width))].map(w=>({width:w,path:compiled(expansion.roads.filter(r=>r.width===w).map(r=>r.points))}));
  const districtBounds=districts.map(d=>boundsOf(d.points));
  const contours=[...terrainContext.contours,...data.geographyContours||[]].map(c=>({...c,path:compiled([c.points],true),bounds:boundsOf(c.points.map(p=>[p[0],p[1]-c.height*.6]))}));
  const naturalAreas=(data.geographyNatural||[]).map(a=>({...a,path:compiled([a.points],true),bounds:boundsOf(a.points)}));
  const nightEdges=night?compiled(data.centralNight.sharedEdges):null;
  const lampColors=['#e1bd8c','#a4c4cb','#c2ccd0'];
  function lampSeed(b){let n=Math.imul(Math.round(b[0]*100),73856093)^Math.imul(Math.round(b[1]*100),19349663)^Math.imul(Math.round(b[2]*100),83492791);n=Math.imul(n^(n>>>16),2246822507);return (n^(n>>>13))>>>0;}
  function overviewLamp(target,b,z){const seed=lampSeed(b);if(!night||seed%10<3)return;const size=Math.min(Math.min(b[2],b[3])*.3,1.05/z);target.fillStyle=lampColors[seed%3];target.globalAlpha=.64+(seed%4)*.08;target.fillRect(b[0]-size/2,b[1]-size/2,size,size);target.globalAlpha=1;}
  function paintNightBorders(target){
    if(!night)return;
    target.save();target.lineJoin='round';target.lineCap='round';
    for(let i=0;i<data.regions.length;i++){
      const r=data.regions[i];
      if(!regionVisible(r))continue;
      target.save();target.clip(regionSelectionPaths[i],'evenodd');
      for(const [w,a] of [[5,.035],[3.1,.07],[1.7,.14]]){target.strokeStyle=color(r.color,1,r.kind==='overlay'?a*.5:a);target.lineWidth=w/camera.z;target.stroke(regionSelectionPaths[i]);}
      target.restore();
    }
    target.strokeStyle='#adc1c578';target.lineWidth=.7/camera.z;target.stroke(nightEdges);
    const ri=data.regions.findIndex(r=>r.id===state.region);
    if(ri>=0&&!state.node){
      const di=state.selection?.kind==='subdistrict'&&(!sector||activeSector==='central-core')?districts.findIndex(d=>d.id===state.selection.id):-1,p=di>=0?districtPaths[di]:regionSelectionPaths[ri],hex=data.regions[ri].color;
      for(const [w,a] of [[7,.045],[4,.12],[2,.28],[1.15,.92]]){target.strokeStyle=color(hex,1,a*(di>=0?.8:1));target.lineWidth=w/camera.z;target.stroke(p);}
    }
    target.restore();
  }
  const borderLayer=night?document.createElement('canvas'):null;if(borderLayer){borderLayer.width=0;borderLayer.height=0;}
  let borderCache=null;
  function nightBorders(withBase=false){
    if(!night)return;
    const m=projectionCache,key=[camera.mode,state.region,state.node,state.selection?.kind,state.selection?.id,width,height,dpr,withBase].join('|'),margin=96;
    const ratio=borderCache?camera.z/borderCache.z:1;
    let dx=borderCache?m.e-ratio*(borderCache.e+margin):0,dy=borderCache?m.f-ratio*(borderCache.f+margin):0;
    if(!borderCache||borderCache.key!==key||Math.abs(ratio-1)>.06||dx>0||dy>0||dx+borderCache.w*ratio<width||dy+borderCache.h*ratio<height){
      const w=width+margin*2,h=height+margin*2;borderLayer.width=Math.ceil(w*dpr);borderLayer.height=Math.ceil(h*dpr);
      const target=borderLayer.getContext('2d');target.setTransform(dpr*m.a,dpr*m.b,dpr*m.c,dpr*m.d,dpr*(m.e+margin),dpr*(m.f+margin));
      if(withBase)target.drawImage(overviewLit,...overviewBounds.slice(0,2),overviewWidth,overviewHeight);
      paintNightBorders(target);borderCache={key,e:m.e,f:m.f,z:camera.z,w,h};dx=-margin;dy=-margin;
    }
    ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);const scale=camera.z/borderCache.z;ctx.drawImage(borderLayer,dx,dy,borderCache.w*scale,borderCache.h*scale);ctx.restore();
  }
  // Batch tiny roofs by tile, district and height; they never receive windows or rooftop equipment.
  // Some legacy micro roofs were shifted across a border after their color district was assigned.
  // Derive local lift from the actual center; retain source data and original colors.
  function geometryDepthRegion(b,fallback=-1){if(ctx.isPointInPath(regionSelectionPaths[b[7]],b[0],b[1]))return b[7];const ri=data.regions.findIndex((r,i)=>r.kind!=='overlay'&&regionVisible(r)&&ctx.isPointInPath(regionSelectionPaths[i],b[0],b[1]));return ri>=0?ri:fallback;}
  const microGroups=new Map(),allMicro=[...city.micro,...expansion.micro],allMicroFootprints=[...city.microFootprints,...expansion.microFootprints];allMicro.forEach((m,i)=>{if(i<city.micro.length&&terrainContext.reusedMicroIndices.includes(i))return;const b=m.b,owner=geometryDepthRegion(b),depthRi=owner>=0&&(i>=city.micro.length||allMicroFootprints[i].every(p=>ctx.isPointInPath(regionSelectionPaths[owner],...p)))?owner:-1,k=[Math.floor(b[0]/160),Math.floor(b[1]/160),b[7],b[4],depthRi].join(',');if(!microGroups.has(k))microGroups.set(k,{ri:b[7],depthRi,h:b[4],at:b.slice(0,2),shapes:[]});microGroups.get(k).shapes.push(allMicroFootprints[i]);});
  const microLampGroups=new Map();
  const microTiles=[...microGroups.values()].map(g=>{
    if(night){
      if(!microLampGroups.has(g.depthRi))microLampGroups.set(g.depthRi,{ri:g.depthRi,flat:[new Path2D(),new Path2D(),new Path2D()],local:[new Path2D(),new Path2D(),new Path2D()],depth:[new Path2D(),new Path2D(),new Path2D()]});
      const lamps=microLampGroups.get(g.depthRi);
      for(const pts of g.shapes){
        const b=boundsOf(pts),at=[pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length],seed=lampSeed([...at,b[2]-b[0]]);
        if(seed%10<3)continue;
        const dx=pts[1][0]-pts[0][0],dy=pts[1][1]-pts[0][1],len=Math.hypot(dx,dy),k=Math.min(.2,1.4/len);
        for(const [mode,x,y] of [['flat',0,0],['local',0,-g.h],['depth',Math.sin(.26)*g.h/.75,-Math.cos(.26)*g.h/.75]]){
          const path=lamps[mode][seed%3];path.moveTo(at[0]-dx*k+x,at[1]-dy*k+y);path.lineTo(at[0]+dx*k+x,at[1]+dy*k+y);
        }
      }
    }
    return {...g,path:compiled(g.shapes,true)};
  });
  function nightMicroLights(){
    if(!night)return;
    ctx.save();ctx.lineCap='round';ctx.lineWidth=Math.min(1.1/camera.z,1.65);ctx.globalAlpha=.78;
    for(const g of microLampGroups.values()){
      const mode=camera.mode==='depth'?'depth':regionDepth(g.ri)?'local':'flat';
      g[mode].forEach((p,i)=>{ctx.strokeStyle=lampColors[i];ctx.stroke(p);});
    }
    ctx.restore();
  }
  const microBatches=[];for(let i=0;i<microTiles.length;i+=32){const tiles=microTiles.slice(i,i+32);microBatches.push({tiles,bounds:boundsOf(tiles.map(tile=>tile.at))});}
  function smallBuildings(target,z,near=false,raisedOnly=false){
    for(const batch of microBatches){if(near&&!boundsVisible(batch.bounds,210*z))continue;for(const tile of batch.tiles){if(near){const p=project(tile.at);if(p[0]<-210*z||p[0]>width+210*z||p[1]<-210*z||p[1]>height+210*z)continue;}
      const t=near?regionDepth(tile.depthRi):0,pal=palettes[tile.ri];if(raisedOnly&&!t)continue;if(near)renderStats[t?'microDepthTiles':'microFlatTiles']++;
      if(t){const a=groundDepth(camera)*.26,lift=t/(1-groundDepth(camera)*.25);target.fillStyle=pal.side;target.fill(tile.path);target.save();target.translate(Math.sin(a)*tile.h*lift,-Math.cos(a)*tile.h*lift);}
      target.fillStyle=pal.top[1];target.fill(tile.path);if(z>1.35){target.lineWidth=.45/z;target.strokeStyle=pal.line;target.stroke(tile.path);}if(t)target.restore();
      if(!night&&data.regions[tile.ri].id==='chiba'&&(!raisedOnly||t)){target.save();if(t){const a=groundDepth(camera)*.26,lift=t/(1-groundDepth(camera)*.25);target.translate(Math.sin(a)*tile.h*lift,-Math.cos(a)*tile.h*lift);}const seed=Math.abs(Math.round(tile.at[0]*13+tile.at[1]*7));target.fillStyle=seed%5===0?'#93c4c3b0':'#dfa976b8';const size=Math.min(2.4,Math.max(.65,.9/z));target.fillRect(tile.at[0]-size/2,tile.at[1]-size/2,size,size);target.restore();}
    }}
  }
  function tramLayer(target,z){if(!state.tram)return;city.tram.routes.forEach((r,i)=>{target.save();target.globalAlpha=state.route&&state.route!==r.id?.25:1;target.lineJoin='round';target.lineCap='round';target.strokeStyle='#090e18';target.lineWidth=Math.max(2.4,2.8/z);target.stroke(tramPaths[i]);target.strokeStyle=r.color;target.lineWidth=Math.max(1.4,1.7/z);target.stroke(tramPaths[i]);if(z>1){target.strokeStyle='#101a23';target.lineWidth=.6;target.stroke(tramPaths[i]);}target.restore();});
    for(const s of city.tram.stops){if(state.route&&!s.lines.includes(state.route))continue;target.beginPath();target.arc(...s.at,(s.lines.length>1?4:2.5)/Math.max(.6,z),0,Math.PI*2);target.fillStyle='#0a101a';target.fill();target.strokeStyle=s.lines.length>1?'#eee3c9':city.tram.routes.find(r=>s.lines.includes(r.id)).color;target.lineWidth=1/z;target.stroke();}
  }
  function companyGround(target,z){
    if(!data.plaza||!data.plazaPlot)return;
    const [x,y]=data.plaza;target.fillStyle='#16121d';target.fill(compiled([data.plazaPlot],true));target.strokeStyle='#72475388';target.lineWidth=.8;target.stroke(compiled([data.plazaPlot],true));
    target.save();target.translate(x,y);target.fillStyle='#111f26';target.fillRect(-23,-38,46,43);target.strokeStyle='#48939c88';target.lineWidth=.7;target.strokeRect(-23,-38,46,43);
    target.fillStyle=ink.park;for(const side of [-1,1]){target.fillRect(side<0?-53:48,27,5,22);target.fillRect(side<0?-49:29,-48,20,4);}
    target.strokeStyle='#40909b66';target.beginPath();target.moveTo(0,-57);target.lineTo(0,-39);target.moveTo(0,5);target.lineTo(0,29);target.moveTo(-25,24);target.lineTo(25,24);target.moveTo(-23,58);target.lineTo(23,58);target.stroke();
    if(z>1){target.strokeStyle='#9ba7a735';for(let u=-20;u<=20;u+=5){target.beginPath();target.moveTo(u,7);target.lineTo(u,23);target.stroke();}}target.restore();
  }
  function facilities(target,z){
    const line=(pts,col,w=.8)=>{target.beginPath();pts.forEach((p,i)=>i?target.lineTo(...p):target.moveTo(...p));target.strokeStyle=col;target.lineWidth=w;target.stroke();};
    const roof=(x,y,w,h,pal)=>{target.fillStyle=pal.side;target.fillRect(x+2,y+3,w,h);target.fillStyle=pal.top[1];target.fillRect(x,y,w,h);target.strokeStyle=pal.line;target.lineWidth=.65;target.strokeRect(x,y,w,h);if(z>.6){for(let v=4;v<h;v+=5)line([[x+1,y+v],[x+w-1,y+v]],pal.line,.45);target.strokeRect(x+3,y+3,w-6,h-6);}};
    for(const site of data.portSites){target.save();target.translate(...site.at);target.rotate(site.angle*Math.PI/180);target.fillStyle='#16121f';
      if(site.layout==='cargo'){
        target.fillRect(-78,-49,90,98);target.fillStyle=ink.water;target.fillRect(12,-51,75,102);
        line([[-77,-51],[14,-51],[14,51],[-77,51]],'#4d9da3a0',.9);
        for(const y of [-38,-2,34]){target.fillStyle='#202032';target.fillRect(10,y-9,74,16);line([[10,y-9],[84,y-9],[84,y+7],[10,y+7]],'#4199a8',.8);
          for(const x of [-26,-16,-6])for(const dy of [-10,-3,4]){target.fillStyle=dy===-3?'#9b3446':'#572031';target.fillRect(x,y+dy,7,4);}
          for(const x of [27,55]){line([[x,y+5],[x,y-14],[x+17,y-14]],'#74c6ca',1.1);line([[x-4,y+5],[x+4,y+5],[x,y-12]],'#40919e',.75);}
        }
        line([[-83,-56],[-83,55]],ink.road,1.8);
      }else if(site.layout==='passenger'){
        target.fillRect(-16,-45,78,90);target.fillStyle=ink.water;target.fillRect(-70,-45,53,90);
        for(const y of [-27,0,27]){target.fillStyle='#25202e';target.fillRect(-66,y-4,53,8);line([[-66,y-4],[-13,y-4]],ink.road,.85);
          target.fillStyle='#702233';target.beginPath();target.moveTo(-55,y+8);target.lineTo(-23,y+8);target.lineTo(-17,y+12);target.lineTo(-23,y+16);target.lineTo(-55,y+16);target.closePath();target.fill();line([[-53,y+10],[-26,y+10]],'#ca596a',.65);}
        line([[60,-48],[60,47]],ink.road,1.6);
      }else{
        target.fillRect(-65,-45,130,90);target.strokeStyle='#6c263c';target.lineWidth=.8;target.strokeRect(-65,-45,130,90);
        target.fillStyle='#29131e';target.beginPath();target.arc(28,0,22,0,Math.PI*2);target.fill();target.strokeStyle='#a74753';target.stroke();target.beginPath();target.arc(28,0,16,0,Math.PI*2);target.stroke();
        line([[6,0],[50,0]],'#bc6870',.7);line([[28,-22],[28,22]],'#bc6870',.7);target.fillStyle='#87303e';target.fillRect(24,-5,8,10);line([[22,-8],[22,-19],[36,-19],[36,-8]],'#77bac2',.8);
        line([[-64,40],[62,40],[62,-40]],ink.road,1.1);line([[-14,-40],[-14,40]],'#7a394a',.7);line([[-18,-21],[0,-21],[11,-10],[11,0]],'#71969c',1.5);
        for(const y of [15,23,31]){target.fillStyle='#593144';target.fillRect(-6,y,10,4);target.strokeStyle='#9b596366';target.lineWidth=.5;target.strokeRect(-6,y,10,4);}
      }
      for(const [x,y,w,h] of site.buildings)roof(x,y,w,h,palettes[data.regions.findIndex(r=>r.id===site.group)]);target.restore();}
  }
  function districtFeature(target,feature,z){const [x,y]=feature.at,r=data.regions[feature.ri];target.save();target.clip(compiled([feature.points],true));target.translate(x,y);target.fillStyle=ink.park;target.fillRect(-28,-24,56,48);target.strokeStyle='#32535b55';target.lineWidth=.6;
    if(['sagami','hokuen','keihin','docks'].includes(r.id)){target.fillStyle=ink.yard;target.fillRect(-28,-24,56,48);for(let i=-2;i<=2;i++){target.beginPath();target.moveTo(i*9,-18);target.lineTo(i*9,18);target.stroke();}}
    else{target.beginPath();target.moveTo(-26,18);target.quadraticCurveTo(-6,-20,26,-15);target.stroke();}
    target.restore();
  }
  function complexGround(target,site,z){const r=data.regions[site.ri],p=compiled([site.points],true),[x,y]=site.at,[w,d]=site.size;
    target.save();target.clip(p);target.fillStyle=districtTone(r.color,.085);target.fill(p);target.strokeStyle=districtTone(r.color,.32,.42);target.lineWidth=.6/z;target.stroke(p);
    if(site.groundDetails){
      const g=site.groundDetails;
      for(const square of g.plazas){target.fillStyle='#223739';target.fill(compiled([square.points],true));}
      for(const stair of g.stairs){const shape=compiled([stair.points],true),b=boundsOf(stair.points);target.save();target.clip(shape);target.fillStyle='#080d16';target.fill(shape);target.strokeStyle='#a18b67';target.lineWidth=.25;for(let y=b[1];y<=b[3];y+=.6){target.beginPath();target.moveTo(b[0],y);target.lineTo(b[2],y);target.stroke();}target.restore();}
      target.strokeStyle='#a5a899';target.lineWidth=.25;for(const bay of g.parkingBays)target.stroke(compiled([bay.points]));
      target.restore();
      target.save();target.lineCap='round';target.lineJoin='round';for(const lane of g.lanes){const line=compiled([lane.points]);target.strokeStyle='#0b1820';target.lineWidth=lane.width+.6;target.stroke(line);target.strokeStyle='#668d89';target.lineWidth=lane.width;target.stroke(line);}
      target.restore();return;
    }
    target.strokeStyle='#42758575';target.lineWidth=1.4;target.stroke(compiled([site.forecourt]));
    target.translate(x,y);target.strokeStyle='#4c666a65';target.lineWidth=.45;
    if(['tsurumaki','fuji','west','kai'].includes(r.id)){target.fillStyle='#13302b';for(const side of [-1,1])for(let i=0;i<5;i++){target.beginPath();target.ellipse(side*(w/2-4),-d*.35+i*d*.17,2,3,0,0,Math.PI*2);target.fill();}}
    else{for(let i=-2;i<=2;i++){target.beginPath();target.moveTo(i*5,d/2-7);target.lineTo(i*5,d/2-2);target.stroke();}}
    target.restore();
  }
  const complexGroundBounds=allComplexes.map(site=>boundsOf([...site.points,...(site.groundDetails?.lanes||[]).flatMap(l=>l.points)]));
  function terrain(target,z){
    target.lineJoin='round';target.lineCap='round';
    target.fillStyle=ink.land;target.fill(mainlandPath);target.strokeStyle='#245b6b70';target.lineWidth=.7/z;target.stroke(mainlandPath);
    for(const ri of terrainOrder){if(target===ctx&&!boundsVisible(regionBounds[ri]))continue;const pal=palettes[ri],rp=regionPaths[ri],r=data.regions[ri];target.fillStyle=pal.land;target.fill(rp,'evenodd');target.strokeStyle=pal.edge;target.lineWidth=.65/z;if(!night&&z<1.2)target.stroke(rp);target.save();target.clip(rp,'evenodd');
      target.fillStyle=night?'#18262c45':'#33101a4d';target.fill(groundPaths[ri].block);target.fillStyle=ink.yard;target.fill(groundPaths[ri].yard);target.fillStyle=ink.park;target.fill(groundPaths[ri].park);target.strokeStyle='#2a495647';target.lineWidth=.4/z;target.stroke(groundPaths[ri].park);
      target.save();target.clip(streetMask,'evenodd');streetPaths[ri].forEach((p,i)=>{target.strokeStyle='#051721';target.lineWidth=streetWidths[i]+1;target.stroke(p);target.strokeStyle=night?(i===2?'#48646d80':'#324b5865'):(i===2?'#4595a5a0':'#31839480');target.lineWidth=Math.max(.45/z,streetWidths[i]*.75);target.stroke(p);});target.restore();
      if(!night&&r.id==='chiba'){target.save();target.clip(streetMask,'evenodd');target.strokeStyle='#d2996860';target.lineWidth=Math.max(.4/z,.6);target.stroke(streetPaths[ri][2]);target.restore();}
      target.restore();
    }
    districts.forEach((d,i)=>{if(sector&&(d.sectorId!==activeSector||activeSector!=='central-core'))return;if(target===ctx&&!boundsVisible(districtBounds[i]))return;target.fillStyle=color(data.regions[d.ri].color,.15,night?.055:.18);target.fill(districtPaths[i]);});
    for(const d of districts.filter(d=>!sector||d.sectorId===activeSector))for(const space of d.openSpaces||[]){target.fillStyle=space.type==='field'?'#29271c':'#14291f';target.fill(compiled([space.points],true));}
    for(const a of naturalAreas){if(target===ctx&&!boundsVisible(a.bounds))continue;target.fillStyle='#16241b60';target.fill(a.path);}
    for(const c of contours){if(target===ctx&&!boundsVisible(c.bounds))continue;target.save();target.translate(0,-c.height*.6);target.strokeStyle=c.color;target.lineWidth=(c.level%2? .55:.8)/z;target.setLineDash([4/z,5/z]);target.stroke(c.path);target.restore();}
    for(const r of expansionRoads){target.strokeStyle='#17424dcc';target.lineWidth=r.width+.3;target.stroke(r.path);target.strokeStyle=night?'#496c7568':'#44828b80';target.lineWidth=Math.min(r.width,Math.max(.35/z,r.width*.45));target.stroke(r.path);}
    for(const l of expansion.landmarks){target.fillStyle=districtTone(data.regions[l.ri].color,.09);target.fill(compiled([l.points],true));target.strokeStyle='#57655780';target.lineWidth=.7/z;target.stroke(compiled([l.points],true));}
    // An overlay ribbon leaves the underlying regional colors and open water visible.
    if(z<.9)for(const coast of port?.coastlines||[]){const p=compiled([coast]);target.strokeStyle='#b9486912';target.lineWidth=22;target.stroke(p);target.strokeStyle='#a7557048';target.lineWidth=.75/z;target.setLineDash([7/z,5/z]);target.stroke(p);target.setLineDash([]);}
    for(const feature of data.features)districtFeature(target,feature,z);
    allComplexes.forEach((site,i)=>{if(target!==ctx||boundsVisible(complexGroundBounds[i]))complexGround(target,site,z);});
    for(const site of city.harborPlots){target.fillStyle=districtTone(data.regions[site.ri].color,.075);target.fill(compiled([site.points],true));}
    facilities(target,z);
    for(const l of city.harborLanes){target.strokeStyle='#3d889294';target.lineWidth=l.width;target.stroke(compiled([l.points]));}
    for(const water of [...data.waterBodies||[],...data.geographyWaters||[]]){const p=compiled([water.points],true);target.fillStyle=ink.water;target.fill(p);target.strokeStyle='#37778a66';target.lineWidth=.7/z;target.stroke(p);}
    data.rivers.forEach((r,i)=>{target.strokeStyle=ink.water;target.lineWidth=r.width;target.stroke(riverPaths[i]);target.strokeStyle='#387c8966';target.lineWidth=Math.max(.6/z,r.width*.1);target.stroke(riverPaths[i]);});
    companyGround(target,z);
    data.roads.forEach((r,i)=>{if(target===ctx&&!boundsVisible(roadBounds[i],r.width*z/2+3))return;if(target===ctx&&camera.mode==='depth'&&['bay-bridge','bridge-approach'].includes(r.kind)){target.strokeStyle='#01040c66';target.lineWidth=r.width;target.stroke(roadPaths[i]);return;}target.strokeStyle='#05111be8';target.lineWidth=r.width+1.4/z;target.stroke(roadPaths[i]);target.strokeStyle=night?'#27495290':'#276879a0';target.lineWidth=r.width;target.stroke(roadPaths[i]);target.strokeStyle=night?'#72989d65':'#63bbc18c';target.lineWidth=Math.max(.5/z,r.width*.12);target.stroke(roadPaths[i]);});
  }
  // One small overview bitmap (~7 MB RGBA), released with this page. Near views use vector paths.
  const overviewBounds=data.overviewBounds||[worldMinX,worldMinY,worldMaxX,worldMaxY],overviewWidth=overviewBounds[2]-overviewBounds[0],overviewHeight=overviewBounds[3]-overviewBounds[1];
  const overview=document.createElement('canvas'),overviewScale=Math.min(.6,1450/Math.max(overviewWidth,overviewHeight));overview.width=0;overview.height=0;
  const allFootprints=[...data.footprints,...expansion.footprints],footprints=new Map(allBuildings.map((b,i)=>[b,allFootprints[i]]));
  let overviewReady=false;
  // World-space bins avoid projecting every distant building during a close view.
  const bins=new Map();for(const b of allBuildings){const key=Math.floor(b[0]/128)+','+Math.floor(b[1]/128);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(b);}
  function visibleBuildings(){const p=[[-100,-100],[width+100,-100],[width+100,height+300],[-100,height+300]].map(v=>unproject(v)),x0=Math.floor(Math.min(...p.map(v=>v[0]))/128),x1=Math.floor(Math.max(...p.map(v=>v[0]))/128),y0=Math.floor(Math.min(...p.map(v=>v[1]))/128),y1=Math.floor(Math.max(...p.map(v=>v[1]))/128),list=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)list.push(...(bins.get(x+','+y)||[]));return list;}
  function shape(points,h,fill,stroke){path(points,h,true);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.65;ctx.stroke();}}
  function corners(b){const [x,y,w,d,,angle]=b,a=angle*Math.PI/180,co=Math.cos(a),si=Math.sin(a);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+u*co-v*si,y+u*si+v*co]);}
  const portBuildings=data.portSites.flatMap(site=>{const a=site.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),ri=data.regions.findIndex(r=>r.id===site.group);return site.buildings.map(([x,y,w,d,h])=>{const u=x+w/2,v=y+d/2;return [site.at[0]+u*c-v*s,site.at[1]+u*s+v*c,w,d,h,site.angle,1,ri,.5];});}).concat(city.harbor);
  function massing(b,landmark){
    const [x,y,w,d,h,angle,kind]=b,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),parts=[];
    const base=landmark==='stepped'?h*.42:kind===1?h*.82:h*.48;
    if(landmark&&landmark!=='stepped')return [{b,base:0,points:footprints.get(b)}];
    parts.push({b:[...b.slice(0,4),base,...b.slice(5)],base:0,points:footprints.get(b)||corners(b)});
    const wing=(u,v,ww,dd,top,from=base)=>parts.push({b:[x+u*w*c-v*d*s,y+u*w*s+v*d*c,w*ww,d*dd,top,angle,kind===1?1:0,b[7],b[8]],base:from});
    if(landmark==='stepped'){wing(0,-.08,.8,.78,h*.76);wing(.03,-.12,.58,.5,h,h*.76);}
    else if(kind===1)wing(0,0,.78,.25,h);
    else if(kind===3||kind===4){wing(0,-.32,.9,.28,h);wing(-.34,.15,.24,.62,h*.82);if(kind===4)wing(.35,.16,.2,.62,h*.7);}
    else if(kind===2){wing(-.36,0,.22,.9,h*.86);wing(.36,0,.22,.9,h);}
    else if(kind===5){parts.push({b:[x,y,w*.65,d*.65,h,angle,kind,b[7],b[8]],base,points:(footprints.get(b)||corners(b)).map(p=>[x+(p[0]-x)*.65,y+(p[1]-y)*.65])});}
    else if(b[8]>.56){wing(-.18,-.1,.5,.69,h);wing(.3,.14,.22,.51,h*.73);}
    else wing(.08,-.13,.75,.6,h);
    return parts;
  }
  for(const b of city.harbor.filter(b=>b[6]===5))footprints.set(b,Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return [b[0]+Math.cos(a)*b[2]/2,b[1]+Math.sin(a)*b[3]/2];}));
  const buildingMasses=new Map([...allBuildings,...portBuildings].map(b=>[b,city.harbor.includes(b)&&b[4]<2?[{b,base:0,points:corners(b)}]:massing(b)]));
  const buildingRegions=new Map();for(const b of city.harbor){const ri=geometryDepthRegion(b,b[7]);buildingRegions.set(b,ri);for(const part of buildingMasses.get(b))buildingRegions.set(part.b,ri);}
  const overviewLit=night?document.createElement('canvas'):null;
  if(overviewLit){overviewLit.width=0;overviewLit.height=0;}
  function buildingRoofLight(b,h,pts){
    if(night){
      const seed=lampSeed(b);if(seed%10<3)return;
      const p=project(b,h),size=Math.min(1.3,Math.min(b[2],b[3])*camera.z*.32);if(size<.12)return;
      ctx.save();path(pts,h,true);ctx.clip();ctx.fillStyle=lampColors[seed%3];
      if(seed%17===0&&camera.z>.45){ctx.globalAlpha=.12;ctx.beginPath();ctx.arc(...p,2.3,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=.64+(seed%4)*.08;ctx.fillRect(p[0]-size/2,p[1]-size/2,size,size);ctx.restore();return;
    }
    if(data.regions[b[7]].id!=='chiba'||camera.z<.3)return;const seed=Math.abs(Math.round(b[0]*13+b[1]*7));if(seed%3===0)return;const p=project(b,h);ctx.save();ctx.fillStyle=seed%5===0?'#b4dfdc':'#f4bf87';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=camera.z>.8?4:2;const size=camera.z>1.2?1.5:1;ctx.fillRect(p[0]-size/2,p[1]-size/2,size,size);ctx.restore();
  }
  function building(b,landmark,baseHeight=0,outline){const [x,y,w,d,h,,kind,ri,noise]=b, p=project([x,y]);if(p[0]<-100||p[0]>width+100||p[1]<-60||p[1]>height+h*camera.z+60)return;
    const depthRi=buildingRegions.get(b)??ri,t=regionDepth(depthRi),pts=outline||(landmark==='crystal'?[[-.34,-.5],[.34,-.5],[.5,-.25],[.5,.32],[.27,.5],[-.5,.5],[-.5,-.25]].map(([u,v])=>[x+u*w,y+v*d]):footprints.get(b)||corners(b)),pal=landmark==='crystal'?{top:['#32101c','#5a1826','#722335'],side:'#130914',front:'#320f1d',line:'#db686eaa'}:palettes[ri],fine=!tween&&!gesture&&(landmark||Math.min(w,d)*camera.z>=12);
    renderStats[t?'depthBuildingCalls':'flatBuildingCalls']++;if(t)renderStats.depthRegions.add(data.regions[depthRi].id);
    if(!t){shape(pts,0,pal.top[Math.min(2,Math.floor((noise||.2)*3))],camera.z>.65?pal.line:null);buildingRoofLight(b,0,pts);return;}
    if(t>.02){
      const base=pts.map(p=>project(p,baseHeight)),top=pts.map(p=>project(p,h));
      for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;if(base[j][0]-base[i][0]>0)continue;ctx.beginPath();ctx.moveTo(...base[i]);ctx.lineTo(...base[j]);ctx.lineTo(...top[j]);ctx.lineTo(...top[i]);ctx.closePath();ctx.fillStyle=base[j][1]>base[i][1]?pal.side:pal.front;ctx.fill();
        if((night||data.regions[ri].id==='chiba')&&camera.z>(night?.65:1.2)&&h-baseHeight>5){ctx.save();ctx.fillStyle=night?lampColors[lampSeed(b)%3]:'#edb783c0';if(night)ctx.globalAlpha=Math.min(.74,(camera.z-.65)*.8);for(const level of [.3,.62])for(const u of [.2,.5,.78]){if(Math.abs(Math.round(x*7+y*11+u*31+level*23))%3===0)continue;const p=project([lerp(pts[i][0],pts[j][0],u),lerp(pts[i][1],pts[j][1],u)],lerp(baseHeight,h,level));ctx.fillRect(p[0]-.65,p[1]-.6,1.3,1.2);}ctx.restore();}
        if((landmark||fine)&&camera.z>1.9&&h-baseHeight>6){ctx.strokeStyle=pal.line;ctx.lineWidth=.45;for(let f=baseHeight+2;f<h;f+=landmark==='crystal'?7:landmark?5:3.4){path([pts[i],pts[j]],f);ctx.stroke();}if(landmark==='crystal'){for(const u of [.12,.18,.64,.86]){const p=[lerp(pts[i][0],pts[j][0],u),lerp(pts[i][1],pts[j][1],u)];ctx.beginPath();ctx.moveTo(...project(p,baseHeight+1));ctx.lineTo(...project(p,h));ctx.strokeStyle='#b8486466';ctx.lineWidth=u===.64?1.4:.65;ctx.stroke();}for(const f of [h*.34,h*.72]){path([pts[i],pts[j]],f);ctx.strokeStyle='#e4777870';ctx.lineWidth=1.5;ctx.stroke();}}}
      }
    }
    const variant=Math.min(2,Math.floor((noise||.2)*3));shape(pts,h,pal.top[variant],camera.z>.65?pal.line:null);
    buildingRoofLight(b,h,pts);
    if(h>=2&&fine&&camera.z>1.2&&(landmark||data.detailRegions.includes(data.regions[ri].id))){
      ctx.save();path(pts,h,true);ctx.clip();ctx.strokeStyle=pal.line;ctx.lineWidth=.65;
      const a=b[5]*Math.PI/180,co=Math.cos(a),si=Math.sin(a),local=(u,v)=>[x+u*co-v*si,y+u*si+v*co];
      const panel=(u,v,rw,rd,fill,edge=pal.line)=>shape([[u,v],[u+rw,v],[u+rw,v+rd],[u,v+rd]].map(p=>local(...p)),h+.12,fill,edge);
      if(landmark==='crystal'){shape(pts.map(p=>[x+(p[0]-x)*.68,y+(p[1]-y)*.7]),h+.2,'#180c1b','#b1537066');path([[x-w*.32,y-d*.36],[x+w*.25,y+d*.29]],h+.4);ctx.strokeStyle='#608997';ctx.lineWidth=1;ctx.stroke();}
      else if(!landmark&&['tsurumaki','west','fuji'].includes(data.regions[ri].id)){path([local(-w*.4,0),local(w*.4,0)],h+.1);ctx.stroke();for(const u of [-.32,0,.32]){path([local(w*u,-d*.4),local(w*u,d*.4)],h+.1);ctx.stroke();}panel(w*.18,-d*.3,w*.15,d*.2,'#274752');}
      else if(!landmark&&data.regions[ri].id==='underpool'){panel(-w*.35,-d*.32,w*.48,d*.3,pal.front);panel(w*.04,d*.05,w*.34,d*.24,pal.top[2]);path([local(-w*.3,d*.33),local(w*.12,-d*.2),local(w*.35,d*.33)],h+.1);ctx.stroke();}
      else if(kind===1){for(const v of [-.28,0,.28]){panel(-w*.38,d*v,w*.76,d*.12,pal.top[2]);panel(-w*.36,d*v,w*.68,d*.035,'#35758490');}for(const u of [-.37,-.19])panel(w*u,-d*.43,w*.1,d*.08,pal.side);}
      else if(kind===3||kind===4){panel(-w*.39,-d*.4,w*.76,d*.2,pal.front);for(const v of [-.05,.13]){panel(-w*.4,d*v,w*.13,d*.1,pal.side);panel(-w*.39,d*v,w*.07,d*.02,pal.top[2]);}path([local(-w*.36,d*.37),local(-w*.36,-d*.32),local(w*.32,-d*.32)],h+.1);ctx.stroke();}
      else if(kind===5){path(pts.map(p=>[x+(p[0]-x)*.55,y+(p[1]-y)*.55]),h+.1,true);ctx.stroke();for(let i=0;i<pts.length;i+=2){path([[x+(pts[i][0]-x)*.55,y+(pts[i][1]-y)*.55],pts[i]],h+.1);ctx.stroke();}}
      else{panel(-w*.34,-d*.34,w*.37,d*.55,pal.front);for(const v of [-.27,.04])panel(w*.17,d*v,w*.17,d*.17,pal.side);path([local(-w*.36,d*.34),local(w*.34,d*.34),local(w*.34,-d*.35)],h+.1);ctx.stroke();}
      ctx.restore();
    }
    if(kind===2&&camera.z>.65){const court=b.slice();court[2]*=.44;court[3]*=.5;shape(corners(court),h+.05,ink.yard,pal.line);}
    if(!landmark&&fine&&!data.detailRegions.includes(data.regions[ri].id)&&camera.z>1.2&&kind<3&&kind!==2){const roof=b.slice();roof[0]+=w*((noise||0)-.5)*.3;roof[2]*=.22;roof[3]*=.26;shape(corners(roof),h+.4,'#350e1c',pal.line);
      if(noise>.4){const unit=roof.slice();unit[0]-=w*.28;unit[1]+=d*.14;unit[2]*=.65;unit[3]*=.8;shape(corners(unit),h+.6,'#441322',pal.line);}
    }
    if((landmark||fine)&&camera.z>2.4){path([pts[0],pts[1]],h+.4);ctx.strokeStyle=landmark?'#8bd5d1':pal.line;ctx.lineWidth=1;ctx.stroke();
    }
  }
  function road(line,raised){const sw=Math.max(1,line.width*camera.z),pts=line.points,heights=raised?(line.heights||pts.map(()=>line.elevation)):pts.map(()=>0);
    const deckPath=()=>{ctx.beginPath();pts.forEach((p,i)=>{const q=project(p,heights[i]);i?ctx.lineTo(...q):ctx.moveTo(...q);});};
    deckPath();ctx.lineJoin='round';ctx.lineCap=raised?'butt':'round';ctx.strokeStyle=raised?'#06111df0':'#05111bd9';ctx.lineWidth=sw+3;ctx.stroke();
    if(raised&&line.kind!=='bay-bridge'&&depth(camera)>.05&&camera.z>1){for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let k=0;k<len;k+=32){const t=k/len,p=[lerp(a[0],b[0],t),lerp(a[1],b[1],t)],base=project(p),deck=project(p,lerp(heights[i-1],heights[i],t));ctx.beginPath();ctx.moveTo(...base);ctx.lineTo(...deck);ctx.strokeStyle='#46748690';ctx.lineWidth=2;ctx.stroke();}}}
    deckPath();ctx.strokeStyle=raised?'#1c485c':'#153c4d';ctx.lineWidth=sw;ctx.stroke();
    deckPath();ctx.strokeStyle=night?(raised?'#658f9580':'#4d717b80'):(raised?'#75d5dcaa':'#3f9fafa0');ctx.lineWidth=Math.max(.65,sw*.14);ctx.stroke();
  }
  const landmarkBuildings=data.landmarks.filter(l=>l.type!=='holo').map(l=>({b:[...l.at,l.w,l.d,l.h,0,0,0,.55],kind:l.type}));
  const complexBuildings=allComplexes.flatMap(site=>site.parts.map((b,i)=>({b,kind:'facility',points:site.footprints[i],helipad:site.id==='arakawa-hospital'&&i===0})));
  for(const item of complexBuildings){buildingMasses.set(item.b,[{b:item.b,base:0,points:item.points}]);}
  for(const item of landmarkBuildings){buildingMasses.set(item.b,massing(item.b,item.kind));}
  const gantries=data.portSites.filter(s=>s.gantry).flatMap(site=>{const g=site.gantry,ri=data.regions.findIndex(r=>r.id===site.group),x=site.at[0]+g.at[0],y=site.at[1]+g.at[1];return [-1,1].map(side=>({b:[x+side*g.span/2,y,2,4,g.height,0,0,ri,.65],base:0,kind:'gantry'})).concat({b:[x,y,g.span+2,4,g.height,0,0,ri,.65],base:g.height-2,kind:'gantry'});});
  // Short road sections share the building depth queue, so a distant viaduct cannot paint across a tower.
  const raisedSegments=data.roads.filter(r=>r.elevation||r.heights?.some(h=>h>0)).flatMap(r=>r.points.slice(1).flatMap((b,i)=>{const a=r.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/36),h0=r.heights?.[i]??r.elevation,h1=r.heights?.[i+1]??(i===r.points.length-2?r.endElevation??r.elevation:r.elevation);if(!h0&&!h1)return [];return Array.from({length:steps},(_,j)=>({...r,heights:[j/steps,(j+1)/steps].map(t=>lerp(h0,h1,t)),points:[j/steps,(j+1)/steps].map(t=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)])}));}));
  const raisedBatches=[];for(let i=0;i<raisedSegments.length;i+=32){const items=raisedSegments.slice(i,i+32).map(road=>({road,at:[(road.points[0][0]+road.points[1][0])/2,(road.points[0][1]+road.points[1][1])/2],bounds:boundsOf(road.points),minHeight:Math.min(0,...road.heights),maxHeight:Math.max(0,...road.heights)}));raisedBatches.push({items,bounds:boundsOf(items.flatMap(item=>item.road.points)),minHeight:Math.min(...items.map(item=>item.minHeight)),maxHeight:Math.max(...items.map(item=>item.maxHeight)),width:Math.max(...items.map(item=>item.road.width))});}
  function bridgeStructure(bridge){
    if(!bridge.towers){path(bridge.points,regionDepth(0)?bridge.h:0);ctx.strokeStyle='#263d49';ctx.lineWidth=bridge.width*camera.z;ctx.stroke();return;}
    if(camera.mode!=='depth'||camera.z<.25)return;
    const a=bridge.points[0],b=bridge.points.at(-1),len=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[-(b[1]-a[1])/len,(b[0]-a[0])/len],half=(bridge.width||10)*.62;
    const line=(points,stroke,w)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=stroke;ctx.lineWidth=w;ctx.stroke();};
    for(const tower of bridge.towers){for(const side of [-1,1]){const foot=[tower.at[0]+normal[0]*half*side,tower.at[1]+normal[1]*half*side],top=project(foot,tower.height);line([project(foot),top],'#243c4a',Math.max(1.6,camera.z*2.5));line([project(foot,tower.deckHeight),top],'#82b9be',Math.max(.75,camera.z*.6));
        for(const direction of [-1,1])for(const distance of [.06,.12,.18]){const deck=[tower.at[0]+(b[0]-a[0])*distance*direction+normal[0]*half*side,tower.at[1]+(b[1]-a[1])*distance*direction+normal[1]*half*side];line([top,project(deck,bridge.deckHeight)],'#67aab595',.65);}}
      line([-1,1].map(side=>project([tower.at[0]+normal[0]*half*side,tower.at[1]+normal[1]*half*side],tower.height*.87)),'#87b5ba',Math.max(1,camera.z));
    }
  }
  function sceneDepth(p){const a=groundDepth(camera)*.26;return p[0]*Math.sin(a)+p[1]*Math.cos(a);}
  const railSegments=rail.routes.flatMap(r=>r.segments.flatMap(s=>s.points.slice(1).flatMap((b,i)=>{const a=s.points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/32);return Array.from({length:steps},(_,j)=>({...s,routeId:r.id,color:r.color,heights:[j/steps,(j+1)/steps].map(t=>lerp(s.heights[i],s.heights[i+1],t)),points:[j/steps,(j+1)/steps].map(t=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)])}));})));
  const railPaths=rail.routes.flatMap(r=>r.segments.map(s=>({...s,routeId:r.id,color:r.color,path:compiled([s.points])})));
  function railGround(target,z){if(!state.tram)return;for(const s of railPaths){target.save();target.globalAlpha=state.route&&state.route!==s.routeId?.2:1;target.setLineDash(s.mode==='tunnel'?[5/z,5/z]:[]);target.strokeStyle=s.color;target.lineWidth=(s.mode==='tunnel'?1:1.6)/z;target.stroke(s.path);target.restore();}}
  function railDeck(s){const p=s.points.map((v,i)=>project(v,s.heights[i])),sw=Math.max(1.4,2.1*camera.z);ctx.save();ctx.globalAlpha=state.route&&state.route!==s.routeId?.24:1;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(...p[0]);ctx.lineTo(...p[1]);ctx.strokeStyle='#101319';ctx.lineWidth=sw+2;ctx.stroke();ctx.strokeStyle=s.color;ctx.lineWidth=sw;ctx.stroke();ctx.strokeStyle='#2c2625';ctx.lineWidth=Math.max(.65,sw*.45);ctx.stroke();ctx.restore();}
  function skyTower(l){
    const [x,y]=l.at,screen=project(l.at),topScreen=project(l.at,l.height);if(screen[0]<-100||screen[0]>width+100||screen[1]<-100||topScreen[1]>height+100)return;
    const ring=(r,n=8)=>Array.from({length:n},(_,i)=>[x+Math.cos(i*2*Math.PI/n)*r,y+Math.sin(i*2*Math.PI/n)*r]);
    building([x,y+10,28,10,2.2,0,0,l.ri,.5],'facility');
    if(!regionDepth(l.ri)){shape(ring(7.2,6),0,'#405747','#84977b');return;}
    const levels=[[0,7.2],[14,3.2],[23.3,2.9],[30,1.8],[36,1],[l.height,.25]];
    for(let k=1;k<levels.length;k++){const [h0,r0]=levels[k-1],[h1,r1]=levels[k],a=ring(r0,6),b=ring(r1,6);for(let i=0;i<6;i++){const j=(i+1)%6;ctx.beginPath();[project(a[i],h0),project(a[j],h0),project(b[j],h1),project(b[i],h1)].forEach((p,n)=>n?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=i<3?'#28362e':'#151e20';ctx.fill();ctx.strokeStyle='#6c81766e';ctx.lineWidth=.55;ctx.stroke();if(camera.z>1.7){ctx.beginPath();ctx.moveTo(...project(a[i],h0));ctx.lineTo(...project(b[j],h1));ctx.stroke();}}}
    for(const [h,r] of [[22.6,5.6],[29.5,4]]){const lower=ring(r*.78),upper=ring(r);for(let i=0;i<8;i++){const j=(i+1)%8;ctx.beginPath();[project(lower[i],h),project(lower[j],h),project(upper[j],h+1.6),project(upper[i],h+1.6)].forEach((p,n)=>n?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle='#405747';ctx.fill();}shape(upper,h+1.6,'#5a6d5b','#84977b');}
    const top=project(l.at,l.height),tip=project(l.at,l.height-6);ctx.beginPath();ctx.moveTo(...tip);ctx.lineTo(...top);ctx.strokeStyle='#91a19b';ctx.lineWidth=1;ctx.stroke();
  }
  function drawWalkway(w){path(w.points,w.height);ctx.strokeStyle='#14252c';ctx.lineWidth=Math.max(1,w.width*camera.z+2);ctx.stroke();ctx.strokeStyle='#a39279';ctx.lineWidth=Math.max(1,w.width*camera.z);ctx.stroke();if(w.height){path(w.points,w.height+.4);ctx.strokeStyle='#c0aa86';ctx.lineWidth=.6;ctx.stroke();}}
  function drawHolo(holo,raised){const [x,y]=holo.at;shape([[x-3,y-3],[x+3,y-3],[x+3,y+3],[x-3,y+3]],0,'#8fece180','#96eadd');if(raised&&camera.z>1.2)for(const ht of [4,8,12,15]){const p=project(holo.at,ht);ctx.strokeStyle='#5be2db88';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p[0],p[1],3.8*camera.z,1.1*camera.z,0,0,Math.PI*2);ctx.stroke();}}
  function drawStructures(raisedOnly=false){
    const items=[];for(const item of [...visibleBuildings().map(b=>({b})),...portBuildings.map(b=>({b})),...landmarkBuildings,...complexBuildings,...gantries]){if(regionDepth(buildingRegions.get(item.b)??item.b[7]))items.push({...item,order:sceneDepth(item.b)});else if(!raisedOnly)building(item.b,item.kind,0,item.points);}
    for(const site of allComplexes)for(const walkway of site.groundDetails?.walkways||[]){const ends=[walkway.points[0],walkway.points.at(-1)],at=ends[0].map((v,i)=>(v+ends[1][i])/2);if(boundsVisible(boundsOf(walkway.points),4,0,walkway.height+.4)){const local={...walkway,height:regionDepth(site.ri)?walkway.height:0};if(local.height)items.push({walkway:local,order:sceneDepth(at)});else if(!raisedOnly)drawWalkway(local);}}
    if(camera.mode==='depth')for(const batch of raisedBatches){if(!boundsVisible(batch.bounds,Math.max(1,batch.width*camera.z)/2+4,batch.minHeight,batch.maxHeight))continue;for(const {road:r,at,bounds,minHeight,maxHeight} of batch.items){if(boundsVisible(bounds,Math.max(1,r.width*camera.z)/2+4,minHeight,maxHeight))items.push({road:r,order:sceneDepth(at)});}}
    for(const bridge of data.bridges){if(camera.mode==='depth'||!bridge.towers&&regionDepth(0))items.push({bridge,order:Math.max(...bridge.points.map(sceneDepth))+.1});else if(!raisedOnly&&!bridge.towers)bridgeStructure(bridge);}
    for(const tower of expansion.landmarks){if(regionDepth(tower.ri))items.push({tower,order:sceneDepth(tower.at)});else if(!raisedOnly)skyTower(tower);}
    if(state.tram&&camera.mode==='depth'){for(const s of railSegments){if(s.mode!=='elevated')continue;const at=[(s.points[0][0]+s.points[1][0])/2,(s.points[0][1]+s.points[1][1])/2],p=project(at,s.height);if(p[0]>-90&&p[0]<width+90&&p[1]>-90&&p[1]<height+90)items.push({rail:s,order:sceneDepth(at)});}for(const pier of rail.piers)items.push({pier,order:sceneDepth(pier.at)-.01});}
    const holo=data.landmarks.find(l=>l.type==='holo');if(holo){if(regionDepth(0))items.push({holo,order:sceneDepth(holo.at)});else if(!raisedOnly)drawHolo(holo,false);}
    renderStats.sortedItems=items.length;
    items.sort((a,b)=>a.order-b.order);
    for(const item of items){
      if(item.walkway){drawWalkway(item.walkway);continue;}
      if(item.tower){skyTower(item.tower);continue;}
      if(item.rail){railDeck(item.rail);continue;}
      if(item.pier){const p=item.pier,base=project(p.at),top=project(p.at,p.height);ctx.beginPath();ctx.moveTo(...base);ctx.lineTo(...top);ctx.strokeStyle='#766b5290';ctx.lineWidth=Math.max(1,1.3*camera.z);ctx.stroke();continue;}
      if(item.road){road(item.road,true);continue;}
      if(item.bridge){bridgeStructure(item.bridge);continue;}
      if(item.holo){drawHolo(item.holo,true);continue;}
      if(item.kind==='gantry'){building(item.b,item.kind,item.base);continue;}
      if(!item.kind&&(camera.z<=.95||Math.min(item.b[2],item.b[3])*camera.z<12)){building(item.b);continue;}
      for(const part of buildingMasses.get(item.b))building(part.b,item.kind,part.base,part.points);
      if(item.helipad&&camera.z>1.2){const [x,y,,,h]=item.b;shape([[-5,-5],[5,-5],[5,5],[-5,5]].map(([u,v])=>[x+u,y+v+7]),h+.2,'#294444','#79b7b9');ctx.strokeStyle='#a0c7c4';ctx.lineWidth=1;for(const line of [[[-2,-3],[-2,3]],[[2,-3],[2,3]],[[-2,0],[2,0]]]){path(line.map(([u,v])=>[x+u,y+v+7]),h+.3);ctx.stroke();}}
    }
  }
  function mountainRelief(){
    if(camera.mode!=='depth')return;
    for(const peak of data.geographyPeaks||[]){const levels=peak.rings;for(let k=1;k<levels.length;k++){const lower=levels[k-1],upper=levels[k],n=Math.min(lower.points.length,upper.points.length);for(let i=0;i<n;i++){const j=(i+1)%n;ctx.beginPath();[project(lower.points[i],lower.height),project(lower.points[j],lower.height),project(upper.points[j],upper.height),project(upper.points[i],upper.height)].forEach((p,n)=>n?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=i<n/2?'#25372a':'#14221e';ctx.fill();}path(upper.points,upper.height,true);ctx.strokeStyle='#81917477';ctx.lineWidth=.65;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);}}
  }
  function bayCaptionPosition(){if(!data.bayLabel)return {hidden:true};const p=project(data.bayLabel.at);return {p,hidden:camera.z>data.bayLabel.maxZoom||p[0]<70||p[0]>width-70||p[1]<145||p[1]>height-100};}
  // Static distant local-3D geometry can move as one image. A margin keeps a
  // short drag off the rebuild path; exact roofs/windows are still used nearby.
  const cityLayer=sector?document.createElement('canvas'):null;if(cityLayer){cityLayer.width=0;cityLayer.height=0;}let cityCache=null;
  function cachedSectorCity(){
    const m=projectionCache,key=[width,height,localDepthRegion,state.tram].join('|'),margin=96,ratio=cityCache?camera.z/cityCache.z:1;
    let dx=cityCache?m.e-ratio*(cityCache.e+margin):0,dy=cityCache?m.f-ratio*(cityCache.f+margin):0;
    if(!cityCache||cityCache.key!==key||Math.abs(ratio-1)>.025||dx>0||dy>0||dx+cityCache.w*ratio<width||dy+cityCache.h*ratio<height){
      const target=ctx,originalWidth=width,originalHeight=height,originalProjection=projectionCache;
      width+=margin*2;height+=margin*2;cityLayer.width=Math.ceil(width);cityLayer.height=Math.ceil(height);ctx=cityLayer.getContext('2d');projectionCache=cameraMatrix(camera);
      try{const p=projectionCache;ctx.setTransform(p.a,p.b,p.c,p.d,p.e,p.f);smallBuildings(ctx,camera.z,true,true);nightMicroLights();ctx.setTransform(1,0,0,1,0,0);drawStructures(true);}
      finally{ctx=target;width=originalWidth;height=originalHeight;projectionCache=originalProjection;}
      cityCache={key,z:camera.z,e:m.e,f:m.f,w:cityLayer.width,h:cityLayer.height,stats:{...renderStats,depthRegions:new Set(renderStats.depthRegions)}};dx=-margin;dy=-margin;
    }else Object.assign(renderStats,cityCache.stats,{depthRegions:new Set(cityCache.stats.depthRegions)});
    const scale=camera.z/cityCache.z;ctx.drawImage(cityLayer,dx,dy,cityCache.w*scale,cityCache.h*scale);renderStats.cityCached=true;
  }
  function ensureOverview(){if(overviewReady)return;overviewReady=true;overview.width=Math.ceil(overviewWidth*overviewScale);overview.height=Math.ceil(overviewHeight*overviewScale);
  const overviewContext=overview.getContext('2d');overviewContext.setTransform(overviewScale,0,0,overviewScale,-overviewBounds[0]*overviewScale,-overviewBounds[1]*overviewScale);terrain(overviewContext,.4);
  smallBuildings(overviewContext,.4);
    for(const b of allBuildings){const shape=compiled([footprints.get(b)],true),pal=palettes[b[7]];overviewContext.save();overviewContext.translate(2.8,3.8);overviewContext.fillStyle='#030612a0';overviewContext.fill(shape);overviewContext.restore();overviewContext.fillStyle=pal.top[Math.min(2,Math.floor(b[8]*3))];overviewContext.fill(shape);overviewContext.strokeStyle=pal.line;overviewContext.lineWidth=.8;overviewContext.stroke(shape);overviewLamp(overviewContext,b,overviewScale);}
  canvas.dataset.overviewBytes=String(overview.width*overview.height*4);
  for(const b of city.harbor){overviewContext.fillStyle=palettes[b[7]].top[1];overviewContext.fill(compiled([corners(b)],true));overviewLamp(overviewContext,b,overviewScale);}
  if(night){
    overviewLit.width=overview.width;overviewLit.height=overview.height;
    const target=overviewLit.getContext('2d');target.drawImage(overview,0,0);
    target.setTransform(overviewScale,0,0,overviewScale,-overviewBounds[0]*overviewScale,-overviewBounds[1]*overviewScale);
    target.lineCap='round';target.lineWidth=1.65;target.globalAlpha=.78;
    for(const g of microLampGroups.values())g.flat.forEach((p,i)=>{target.strokeStyle=lampColors[i];target.stroke(p);});
  }

  for(const item of complexBuildings){overviewContext.fillStyle=palettes[item.b[7]].top[1];overviewContext.fill(compiled([item.points],true));}
  for(const item of landmarkBuildings){overviewContext.fillStyle=item.kind==='crystal'?'#6d293c':palettes[0].top[1];overviewContext.fill(compiled([corners(item.b)],true));}
  }
  const gpu=window.CxxAtlasGPU?.mount({target:canvas,id:activeSector||'overview',redraw:requestDraw});
  function draw(){const start=performance.now();renderStats={flatBuildingCalls:0,depthBuildingCalls:0,microFlatTiles:0,microDepthTiles:0,sortedItems:0,depthRegions:new Set()};projectionCache=cameraMatrix(camera);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const gpuPainted=gpu?.draw({camera,width,height,dpr,localRegion:localDepthRegion,tram:state.tram,route:transit.routes.findIndex(r=>r.id===state.route)+1,background:[night?'#080d11':'#050916',ink.water]});
    if(!gpuPainted){ensureOverview();
    const bg=ctx.createLinearGradient(0,0,width,height);bg.addColorStop(0,night?'#080d11':'#050916');bg.addColorStop(1,ink.water);ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    ctx.lineWidth=.5;ctx.strokeStyle='#23414c40';for(let x=Math.ceil(worldMinX/140)*140;x<worldMaxX;x+=140){path([[x,worldMinY],[x,worldMaxY]]);ctx.stroke();}for(let y=Math.ceil(worldMinY/140)*140;y<worldMaxY;y+=140){path([[worldMinX,y],[worldMaxX,y]]);ctx.stroke();}
    const m=projectionCache,cached=camera.z<=Math.min(.7,overviewScale*1.6)&&groundDepth(camera)===0;renderStats.baseCached=cached;
    ctx.setTransform(dpr*m.a,dpr*m.b,dpr*m.c,dpr*m.d,dpr*m.e,dpr*m.f);
    const nightBase=night&&cached&&depth(camera)===0,cityCached=sector&&cached&&camera.mode==='auto'&&depth(camera)>0;
    if(nightBase)nightBorders(true);else if(cached)ctx.drawImage(overview,...overviewBounds.slice(0,2),overviewWidth,overviewHeight);else terrain(ctx,camera.z);
    if(!cityCached&&(!cached||depth(camera)))smallBuildings(ctx,camera.z,true,cached);
    if(!cityCached&&(!cached||depth(camera)))nightMicroLights();
    tramLayer(ctx,camera.z);
    railGround(ctx,camera.z);
    if(!nightBase)nightBorders();
    if(!night&&state.region&&!state.node){const ri=data.regions.findIndex(r=>r.id===state.region),di=state.selection?.kind==='subdistrict'?districts.findIndex(d=>d.id===state.selection.id):-1,outline=di>=0?districtPaths[di]:regionSelectionPaths[ri];ctx.save();if(state.region==='chiba'){ctx.strokeStyle='#ff606aaa';ctx.shadowColor='#ff4058';ctx.shadowBlur=9;ctx.lineWidth=3/camera.z;ctx.stroke(outline);ctx.shadowBlur=0;ctx.strokeStyle='#ffd0c7';ctx.lineWidth=.7/camera.z;ctx.stroke(outline);}else{ctx.strokeStyle=color(data.regions[ri].color,1,.9);ctx.lineWidth=1.8/camera.z;ctx.stroke(outline);}ctx.restore();if(state.region==='minato'&&di<0)for(const line of port.coastlines)ctx.stroke(compiled([line]));}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(cityCached)cachedSectorCity();else if(!cached||depth(camera)){mountainRelief();drawStructures(cached);}
    }else{ctx.setTransform(dpr,0,0,dpr,0,0);if(state.region&&!state.node){const ri=data.regions.findIndex(r=>r.id===state.region),di=state.selection?.kind==='subdistrict'?districts.findIndex(d=>d.id===state.selection.id):-1,outline=di>=0?districtPaths[di]:regionSelectionPaths[ri];if(outline){ctx.save();const m=projectionCache;ctx.setTransform(dpr*m.a,dpr*m.b,dpr*m.c,dpr*m.d,dpr*m.e,dpr*m.f);for(const [w,a]of [[7,.045],[4,.12],[2,.28],[1.15,.92]]){ctx.strokeStyle=color(data.regions[ri].color,1,a);ctx.lineWidth=w/camera.z;ctx.stroke(outline);}ctx.restore();}}}
    renderLabels();$('#view-mode').textContent=(camera.z>.85?'近景 / ':'概览 / ')+(camera.mode==='depth'?'全3D':depth(camera)?'选区3D':'平面');$('#coordinate').textContent=`X ${Math.round(camera.x)}   Y ${Math.round(camera.y)}   ×${camera.z.toFixed(2)}`;
    const bay=bayCaptionPosition();$('#bay-caption').hidden=bay.hidden;if(!bay.hidden)labelAt($('#bay-caption'),bay.p);
    $('#zoom-level').value=Math.log(camera.z/.025)/Math.log(360);$('#zoom-caption').textContent=camera.z<.7?'全域':camera.z<2?'街区':'建筑';
    drawMs=performance.now()-start;canvas.dataset.drawMs=drawMs.toFixed(2);canvas.dataset.drawCount=String(++drawCount);canvas.dataset.motion=tween||gesture?'moving':'idle';
    if(window.CXX_ATLAS_PROFILE){drawSamples.push({ms:+drawMs.toFixed(2),z:+camera.z.toFixed(2),phase:tween?'transition':gesture?'drag':'still'});if(drawSamples.length>200)drawSamples.shift();canvas.dataset.drawSamples=JSON.stringify(drawSamples);}
    projectionCache=null;
  }
  function requestDraw(){if(!paused&&!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
  function tick(now){frame=0;if(paused||document.hidden||!width||!height)return;if(tween){const t=clamp((now-tween.time)/tween.duration,0,1),e=1-(1-t)**3;for(const k of ['x','y','z'])camera[k]=lerp(tween.from[k],tween.to[k],e);if(t===1)tween=null;}draw();if(tween)requestDraw();}
  function move(to,animate=true){tween=null;const target={x:clamp(to.x,worldMinX+100,worldMaxX-100),y:clamp(to.y,worldMinY+100,worldMaxY-100),z:clamp(to.z,.025,9)};if(animate&&!reduceMotion()){tween={from:{...camera},to:target,time:performance.now(),duration:540};canvas.dataset.motion='moving';}else Object.assign(camera,target);requestDraw();}
  function fit(){if(sector&&activeSector!==null){window.TOKYO_ATLAS_SECTORS.open(null);return;}state.region=null;state.node=null;setSelection(null);$('#view-name').textContent=mapName;const b=data.bounds;move({x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,z:Math.min((width-70)/(b[2]-b[0]),(height-150)/(b[3]-b[1]))});renderIndex();}
  function regionCamera(r){const b=r.selectionBounds||r.viewBounds||r.bounds,visibleWidth=width>700?width-370:width-55,visibleHeight=height-(width>700?200:detail.getBoundingClientRect().height+175),z=clamp(Math.min(visibleWidth/(b[2]-b[0]+35),Math.max(85,visibleHeight)/(b[3]-b[1]+35))*.88,.025,3),base={...camera,x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,z},target=[width>700?(width-340)/2:width/2,width>700?height/2:145+Math.max(85,visibleHeight)/2],at=unproject(target,base);return {x:2*base.x-at[0],y:2*base.y-at[1],z};}
  function focusRegion(id){if(navigate('region',id))return;const target=regionsById.get(id);id=effectiveRegion(id);const r=regionsById.get(id);state.region=id;state.node=null;setSelection({kind:'region',id});$('#view-name').textContent=target.name;move(regionCamera(target));closeIndex();renderIndex();announce(r.name+'，地区视图');}
  function nodeCamera(n){
    const bridge=data.bridges.find(b=>b.id===n.id);if(bridge){const p=bridge.points,h=Math.max(...bridge.towers.map(t=>t.height));return regionCamera({bounds:[Math.min(...p.map(v=>v[0]))-35,Math.min(...p.map(v=>v[1]))-h-35,Math.max(...p.map(v=>v[0]))+35,Math.max(...p.map(v=>v[1]))+35]});}
    const peak=data.geographyPeaks?.find(p=>p.id===n.id),water=data.geographyWaters?.find(p=>p.id===n.id);
    if(peak||water){const area=peak?peak.rings[0].points:water.points,cap=peak?.height||0,b=[Math.min(...area.map(p=>p[0])),Math.min(...area.map(p=>p[1]))-cap,Math.max(...area.map(p=>p[0])),Math.max(...area.map(p=>p[1]))];return regionCamera({bounds:b});}
    const tower=expansion.landmarks.find(l=>l.id===n.id),community=allComplexes.find(c=>c.nodeIds?.includes(n.id)),company=['plaza','tsurumaki-tower'].includes(n.id),site=tower||community||(company?data.specialSites[0]:data.specialSites.find(s=>s.id===n.id)),center=company?data.plaza:n.at;
    const complex=allComplexes.find(c=>c.id===n.id||c.nodeIds?.includes(n.id)),parts=n.siteParts?.map(i=>expansion.buildings[i]),area=site?site.points:parts?n.siteParts.flatMap(i=>expansion.footprints[i]):[[center[0]-45,center[1]-40],[center[0]+45,center[1]+40]],heightCap=tower?tower.height:company?52:complex?Math.max(...complex.parts.map(b=>b[4])):parts?Math.max(...parts.map(b=>b[4])):n.site?18:24;
    const visibleHeight=width>700?height-190:height-(!detail.hidden?detail.getBoundingClientRect().height:0)-145,visibleWidth=width>700?width-365:width-44;
    const bounds={w:Math.max(...area.map(p=>p[0]))-Math.min(...area.map(p=>p[0]))+35,h:Math.max(...area.map(p=>p[1]))-Math.min(...area.map(p=>p[1]))+heightCap+30};
    const maxZoom=community?.groundDetails?6:3.2;
    const z=clamp(Math.min(visibleWidth/bounds.w,Math.max(90,visibleHeight)/bounds.h,community?.groundDetails?maxZoom:company?3.2:n.site?2.8:3.1),.55,maxZoom),base={x:center[0],y:center[1]-heightCap*.28,z,mode:camera.mode};
    const target=[width>700?visibleWidth/2+20:width/2,145+Math.max(90,visibleHeight)/2],at=unproject(target,base);
    return {x:2*base.x-at[0],y:2*base.y-at[1],z};
  }
  function subdistrictButton(d){const b=document.createElement('button');b.className='subdistrict-button'+(state.selection?.id===d.id?' active':'');b.dataset.subdistrict=d.id;b.setAttribute('aria-pressed',String(state.selection?.id===d.id));const name=document.createElement('span'),parent=document.createElement('small');name.textContent=d.name;parent.textContent=regionsById.get(sector&&d.sectorId!=='central-core'?d.sectorId:d.parent).name;b.append(name,parent);return b;}
  function appendSubdistricts(body,parent){const group=sector?.definitions.find(s=>s.id===parent);if(group){for(const id of group.members){const b=document.createElement('button');b.className='subdistrict-button';b.dataset.region=id;b.textContent=regionsById.get(id).name;body.append(b);}return;}for(const d of districts.filter(d=>d.parent===parent))body.append(subdistrictButton(d));}
  function subdistrictCamera(d){return regionCamera({bounds:d.bounds});}
  function focusSubdistrict(id){if(navigate('subdistrict',id))return;const d=districts.find(d=>d.id===id);state.region=sector&&d.sectorId!=='central-core'?d.sectorId:d.parent;state.node=null;setSelection({kind:'subdistrict',id});$('#view-name').textContent=d.name;move(subdistrictCamera(d));closeIndex();renderIndex();announce(d.name+'，子区视图');}
  function focusNode(id){if(parent.CxxAtlasTool?.visible?.(id)===false)return;if(navigate('node',id))return;const n=places.find(n=>n.id===id);state.node=id;state.region=placeRegion(n);setSelection({kind:'node',id});$('#view-name').textContent=n.name;move(nodeCamera(n));closeIndex();renderIndex();announce(n.name+'，地点详情已打开');}
  function pilot(){focusNode('plaza');}
  function focusTram(kind,id){
    const item=(kind==='tram-stop'?transit.stops:transit.routes).find(n=>n.id===id);if(!item)return;
    state.node=null;state.region=null;state.tram=true;state.route=kind==='tram-route'?id:null;$('#tram-toggle').setAttribute('aria-pressed','true');setSelection({kind,id});$('#view-name').textContent=item.name;
    if(kind==='tram-stop')move(nodeCamera(item));else{const xs=item.points.map(p=>p[0]),ys=item.points.map(p=>p[1]),z=Math.min((width-(width>700?390:60))/(Math.max(...xs)-Math.min(...xs)+80),(height-250)/(Math.max(...ys)-Math.min(...ys)+120),2);move({x:(Math.min(...xs)+Math.max(...xs))/2+(width>700?160:0)/z,y:(Math.min(...ys)+Math.max(...ys))/2,z:Math.max(.15,z)});}
    closeIndex();renderIndex();announce(item.name+'，轨道交通');
  }
  function announce(text){$('#announce').textContent=text;}
  function closeIndex(){root.classList.remove('index-open');$('#index-toggle').setAttribute('aria-expanded','false');map.focus({preventScroll:true});}
  function head(text,count){const h=document.createElement('div');h.className='list-head';h.append(document.createTextNode(text));const s=document.createElement('span');s.textContent=String(count).padStart(2,'0');h.append(s);return h;}
  function renderIndex(){const q=$('#atlas-search').value.trim().toLocaleLowerCase();regionList.replaceChildren();nodeList.replaceChildren();
    if(state.type==='all')for(const kind of ['sector','legacy','new','overlay','alias']){const regs=data.regions.filter(r=>r.kind===kind&&(kind!=='alias'||q)&&(kind!=='legacy'||!sector||activeSector==='central-core'||q)&&(!state.filterRegion||r.id===state.filterRegion)&&[r.name,r.en,r.cover].join(' ').toLocaleLowerCase().includes(q));if(!regs.length)continue;regionList.append(head(kind==='sector'?'中心分区 / SECTOR':kind==='legacy'?'核心地区 / CORE':kind==='new'?'外围分区 / OUTER':kind==='alias'?'原地区名称 / SEARCH':'功能覆盖 / SPECIAL',regs.length));for(const r of regs){const button=document.createElement('button');button.className='region-button'+(state.region===r.id?' active':'');button.style.setProperty('--region-color',r.color);button.dataset.region=r.id;button.setAttribute('aria-pressed',String(state.region===r.id));const marker=document.createElement('i'),text=document.createElement('span'),b=document.createElement('b'),sm=document.createElement('small'),num=document.createElement('em');b.textContent=r.name;sm.textContent=r.en;num.textContent=String(sector&&sector.definitions.some(s=>s.id===r.id)?sector.definitions.findIndex(s=>s.id===r.id)+1:data.regions.indexOf(r)+1).padStart(2,'0');text.append(b,sm);button.append(marker,text,num);regionList.append(button);}}
    if(state.type==='all'){const subs=districts.filter(d=>(state.filterRegion?d.parent===state.filterRegion:q||!state.region||d.parent===state.region)&&[d.name,d.en,regionsById.get(d.parent).name].join(' ').toLocaleLowerCase().includes(q));if(subs.length){regionList.append(head('街区 / SUBDISTRICTS',subs.length));for(const d of subs)regionList.append(subdistrictButton(d));}}
    const nodes=places.filter(n=>(state.filterRegion||!state.region||placeRegion(n)===state.region||n.sectorId===state.region||q||state.type!=='all')&&matchesPlace(n));nodeList.append(head('地点 / PLACES',nodes.length));for(const n of nodes){const b=document.createElement('button');b.className='node-button'+(state.node===n.id?' active':'');b.dataset.node=n.id;const i=document.createElement('span'),text=document.createElement('span'),sm=document.createElement('small');i.append(icon(glyphType(n)));text.textContent=n.name;sm.textContent=n.cat;b.append(i,text,sm);nodeList.append(b);}$('#filter-count').textContent=nodes.length+' 个地点';for(const b of document.querySelectorAll('[data-filter]'))b.querySelector('small').textContent=places.filter(n=>matchesPlace(n,b.dataset.filter)).length;if(!nodes.length){const p=document.createElement('p');p.className='empty-results';p.textContent='没有匹配地点，请修改关键词或切换分类。';nodeList.append(p);}
  }
  // DOM labels are updated, never transformed with the buildings; text stays upright.
  const regionLabels=data.regions.map(r=>{const b=document.createElement('button');b.className='region-label';b.dataset.region=r.id;b.style.setProperty('--region-color',r.color);const title=document.createElement('b'),sub=document.createElement('small');title.textContent=r.name;sub.textContent=r.en;b.append(title,sub);labels.append(b);return b;});
  const districtLabels=districts.map(d=>{const b=document.createElement('button');b.className='subdistrict-label';b.dataset.subdistrict=d.id;b.textContent=d.name;labels.append(b);return b;});
  const labelOrder=data.regions.map((_,i)=>i).sort((a,b)=>data.regions[a].at[1]-data.regions[b].at[1]);
  const nodeLabels=places.map(n=>{const b=document.createElement('button');b.className='poi';b.dataset.node=n.id;b.setAttribute('aria-label',n.name);b.style.color=data.serviceTypes.find(t=>t.id===n.type)?.color||'#78e1e0';const glyph=document.createElement('span'),text=document.createElement('span');glyph.className='glyph';glyph.append(icon(glyphType(n)));text.className='poi-text';text.textContent=n.name;b.append(glyph,text);labels.append(b);return b;});
  $('#names-toggle')?.remove();const namesToggle=document.createElement('button');namesToggle.id='names-toggle';namesToggle.type='button';namesToggle.textContent='名称';namesToggle.title='显示地点与功能名称';namesToggle.setAttribute('aria-label','显示地点与功能名称');$('#poi-toggle').after(namesToggle);
  function syncNames(){root.dataset.placeNames=String(state.names);namesToggle.setAttribute('aria-pressed',String(state.names));}
  syncNames();listen(namesToggle,'click',()=>{state.names=!state.names;syncNames();requestDraw();});
  const clusterLayer=document.createElement('div');labels.append(clusterLayer);
  const tramLabels=transit.stops.map(s=>{const b=document.createElement('button');b.className='tram-stop';b.dataset.tramStop=s.id;b.setAttribute('aria-label',s.name+'轨道站');b.textContent=s.lines.length>1?'⇄':s.kind==='rail'?'R':'T';b.title=s.name;labels.append(b);return b;});
  const labelBins=new Map();places.forEach((p,i)=>{const k=Math.floor(p.at[0]/256)+','+Math.floor(p.at[1]/256);if(!labelBins.has(k))labelBins.set(k,[]);labelBins.get(k).push(i);});
  let labelLayoutCache=null,labelPositions=[],labelLines=[],replayingLabels=false,collectingLabels=false;
  function visibleNodeIndices(){const corners=[[-80,-80],[width+80,-80],[width+80,height+80],[-80,height+80]].map(p=>unproject(p)),b=boundsOf(corners),found=[];for(let y=Math.floor(b[1]/256);y<=Math.floor(b[3]/256);y++)for(let x=Math.floor(b[0]/256);x<=Math.floor(b[2]/256);x++)found.push(...(labelBins.get(x+','+y)||[]));return found.sort((a,b)=>a-b);}
  function labelLink(p,q,ink){if(collectingLabels)labelLines.push({a:unproject(p),b:unproject(q),ink});ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.strokeStyle=ink;ctx.lineWidth=.7;ctx.stroke();}
  function renderLabels(){const key=[camera.mode,Math.floor(Math.log2(camera.z)*8),...[.15,.3,.5,.7,.75,.85,.9,2.6].map(z=>camera.z>=z),Math.floor(camera.x*camera.z/40),Math.floor(camera.y*camera.z/40),width,height,detailHeight,state.region,state.node,state.type,state.poi,state.names,state.tram,state.route,state.filterRegion,state.selection?.kind,state.selection?.id,query].join('|');
   if(labelLayoutCache===key){replayingLabels=true;for(const {el,p}of labelPositions)if(el.isConnected&&!el.hidden)labelAt(el,project(p));for(const line of labelLines)labelLink(project(line.a),project(line.b),line.ink);replayingLabels=false;return;}
   labelPositions=[];labelLines=[];collectingLabels=true;layoutLabels();collectingLabels=false;labelLayoutCache=key;
  }
  function labelAt(el,p){if(collectingLabels)labelPositions.push({el,p:unproject(p)});el.style.left='0';el.style.top='0';el.style.transform=`translate(${p[0]}px,${p[1]}px) translate(-50%,-50%)`;}
  function layoutLabels(){const placed=[{p:[110,height-124],w:210,h:48}];labelOrder.forEach(i=>{const el=regionLabels[i],p=project(data.regions[i].at);el.hidden=!regionVisible(data.regions[i])||camera.z>.9||p[0]<-100||p[0]>width+100||p[1]<-100||p[1]>height+100;if(el.hidden)return;const compact=data.regions[i].id==='minato';el.classList.toggle('compact',compact);const overviewLabel=camera.z<=.3;el.classList.toggle('overview',overviewLabel);const w=compact?72:overviewLabel?105:width<700?115:142,h=compact?30:overviewLabel?34:42,offsets=camera.z<.2?[[0,0],[0,24],[0,-48]]:[[0,0],[0,24],[0,-48],[0,48],[-80,-30],[80,30],[0,-96],[0,96],[-80,60],[80,-60],[0,144],[-160,0],[160,0]],pos=offsets.map(([x,y])=>[p[0]+x,p[1]+y]).find(v=>v[0]>w/2+5&&v[0]<width-w/2-5&&v[1]>125&&v[1]<height-110&&!placed.some(q=>Math.abs(v[0]-q.p[0])<(w+q.w)/2+5&&Math.abs(v[1]-q.p[1])<(h+q.h)/2+4));if(!pos){el.hidden=true;return;}placed.push({p:pos,w,h});labelAt(el,pos);if(Math.hypot(pos[0]-p[0],pos[1]-p[1])>5){labelLink(p,pos,color(data.regions[i].color,.8,.5));}});const visible=[];
    districtLabels.forEach((el,i)=>{const d=districts[i],p=project(d.at);el.hidden=Boolean(sector&&(d.sectorId!==activeSector||activeSector!=='central-core'))||camera.z<.75||camera.z>2.6||p[0]<70||p[0]>width-70||p[1]<145||p[1]>height-120||placed.some(q=>Math.abs(p[0]-q.p[0])<(120+q.w)/2&&Math.abs(p[1]-q.p[1])<(30+q.h)/2);if(!el.hidden){labelAt(el,p);placed.push({p,w:120,h:30});}});
    nodeLabels.forEach(el=>{el.hidden=true;});visibleNodeIndices().forEach(i=>{const el=nodeLabels[i];const n=places[i],p=project(n.at);el.classList.toggle('selected',n.id===state.node);el.hidden=Boolean(sector&&n.sectorId!==activeSector)||!state.poi||!matchesPlace(n)||camera.z<(n.site?.15:n.proposal?.5:.85)||p[0]<22||p[0]>width-22||p[1]<105||p[1]>height-100;if(el.hidden)return;const pos=[[0,0],[0,-44],[-44,0],[44,0],[0,44],[-44,-44],[44,44],[0,-88],[0,88],[-88,0],[88,0],[-88,-88],[88,-88],[-88,88],[88,88]].map(([x,y])=>[p[0]+x,p[1]+y]).find(v=>v[0]>22&&v[0]<width-22&&v[1]>105&&v[1]<height-100&&(!n.site||!visible.some(a=>Math.hypot(a.p[0]-v[0],a.p[1]-v[1])<44))&&!placed.some(q=>Math.abs(v[0]-q.p[0])<q.w/2+24&&Math.abs(v[1]-q.p[1])<q.h/2+24));if(!pos){el.hidden=true;return;}labelAt(el,pos);if(Math.hypot(pos[0]-p[0],pos[1]-p[1])>5){labelLink(p,pos,'#d8bfd16e');}visible.push({i,p:pos});});
    // Keep collision buttons alive until membership changes; no per-frame DOM rebuild or layout read.
    const clusters=[],pending=visible.slice();while(pending.length){const cluster=[pending.shift()];let changed=true;while(changed){changed=false;for(let i=pending.length-1;i>=0;i--)if(cluster.some(a=>Math.hypot(a.p[0]-pending[i].p[0],a.p[1]-pending[i].p[1])<43)){cluster.push(pending.splice(i,1)[0]);changed=true;}}if(cluster.length>1)clusters.push(cluster.filter(v=>places[v.i].id!==state.node));}
    const tramFocus=width<=700&&state.selection?.kind==='tram-stop'?project(transit.stops.find(s=>s.id===state.selection.id).at):null;
    // A narrow station view uses one nearby-place drawer, leaving the selected stop clear.
    if(tramFocus&&clusters.length>1){const nearby=clusters.flat();clusters.splice(0,clusters.length,nearby);}
    const signature=state.names+':'+Boolean(tramFocus)+':'+clusters.map(c=>c.map(v=>v.i).join(',')).join('|');
    if(signature!==clusterSignature){clusterSignature=signature;clusterLayer.replaceChildren();for(const cluster of clusters){
      const stack=document.createElement('div');stack.className='poi-stack'+(state.names?'':' compact');
      if(!state.names||tramFocus||cluster.length>2){const b=document.createElement('button');b.dataset.cluster=cluster.map(v=>places[v.i].id).join(',');b.setAttribute('aria-label',cluster.map(v=>places[v.i].name).join('、')+'，展开附近地点');
        if(state.names)b.textContent='◈ '+cluster.length+' 个地点';else{const count=document.createElement('sup');count.textContent=cluster.length;count.setAttribute('aria-hidden','true');b.append(icon(glyphType(places[cluster[0].i])),count);}stack.append(b);
      }else for(const {i} of cluster){const b=document.createElement('button');b.dataset.node=places[i].id;b.append(icon(glyphType(places[i])),document.createTextNode(places[i].name));stack.append(b);}clusterLayer.append(stack);
    }}
    clusters.forEach((cluster,k)=>{const stack=clusterLayer.children[k],p=cluster[0].p,visibleHeight=height-(width<=700&&!detail.hidden?detailHeight:80),maxY=Math.max(125,visibleHeight-(state.names&&!tramFocus?cluster.length:1)*48/2-14),pos=state.names?[clamp(p[0]+130,100,width-100),clamp(p[1]+50,125,maxY)]:[clamp(p[0],24,width-24),clamp(p[1],125,maxY)];
      if(tramFocus&&Math.abs(pos[0]-tramFocus[0])<(state.names?120:44)&&Math.abs(pos[1]-(tramFocus[1]-18))<54){const y=[tramFocus[1]+36,tramFocus[1]-72].find(y=>y>=125&&y<=maxY);if(y!==undefined)pos[1]=y;}
      labelAt(stack,pos);for(const {i} of cluster)nodeLabels[i].hidden=true;});
    tramLabels.forEach((el,i)=>{const s=transit.stops[i],p=project(s.at,camera.mode==='depth'?s.height||0:0);el.hidden=!state.tram||camera.z<.7||state.route&&!s.lines.includes(state.route)||p[0]<24||p[0]>width-24||p[1]<125||p[1]>height-105;el.classList.toggle('selected',state.selection?.id===s.id);if(!el.hidden)labelAt(el,[p[0],p[1]-18]);});
  }
  function placeViewSwitch(){const controls=$('.view-switch'),target=width<=700&&!detail.hidden?detail.querySelector('header'):$('.map-top');if(controls.parentElement!==target)target.insertBefore(controls,target===detail.querySelector('header')?$('#detail-close'):null);}
  function setSelection(selection){const shown=!detail.hidden&&!!state.selection,from=!selection?uiMotion?.capture(detail):null;const apply=()=>setSelectionNow(selection);if(!uiMotion){apply();return;}if(selection&&shown)void uiMotion.update($('#detail-body'),apply);else{apply();void uiMotion.presence(detail,!!selection,{distance:10,from}).then(()=>{if(!lifetime.signal.aborted)requestDraw();});}}
  function setSelectionNow(selection){root.dataset.selectionKind=selection?.kind||'';queueMicrotask(()=>{if(!lifetime.signal.aborted)window.dispatchEvent(new CustomEvent("atlas-selection-changed"));});localDepthRegion=selectionRegion(selection);if(sector&&localDepthRegion>=0)state.region=data.regions[localDepthRegion].id;projectionCache=null;if(selection?.kind?.startsWith('tram-')){showTramDetail(selection);return;}state.selection=selection;detail.hidden=!selection;root.classList.toggle('detail-open',Boolean(selection));placeViewSwitch();if(!selection)return;const body=$('#detail-body');body.replaceChildren();body.scrollTop=0;$('#detail-focus').hidden=selection.kind==='cluster';if(selection.kind==='cluster'){$('#detail-kicker').textContent='PLACES / 附近地点';const h=document.createElement('h1');h.textContent=selection.ids.length+' 个附近地点';body.append(h);for(const id of selection.ids){const n=places.find(n=>n.id===id),b=document.createElement('button');b.className='node-button';b.dataset.node=id;b.append(icon(glyphType(n)),document.createTextNode(n.name));body.append(b);}$('#detail-status').textContent='选择地点查看';return;}const item=selection.kind==='node'?places.find(n=>n.id===selection.id):selection.kind==='subdistrict'?districts.find(d=>d.id===selection.id):regionsById.get(selection.id);$('#detail-kicker').textContent=selection.kind==='node'?'LOCATION / '+item.cat:'DISTRICT / '+item.en;const h=document.createElement('h1'),en=document.createElement('p');h.textContent=item.name;en.className='detail-en';en.textContent=selection.kind==='node'?regionsById.get(placeRegion(item)).name:selection.kind==='subdistrict'?regionsById.get(sector&&item.sectorId!=='central-core'?item.sectorId:item.parent).name+' / '+item.en:item.cover;body.append(h,en);
    if(selection.kind==='region')appendSubdistricts(body,item.id);if(selection.kind==='subdistrict'){const parent=document.createElement('button');parent.className='node-button';parent.dataset.region=item.parent;parent.textContent='← '+regionsById.get(item.parent).name+' · 所属地区';body.append(parent);}if(item.id==='tsurumaki-tower'){const study=document.createElement('div');study.className='height-study';for(const ht of [515,777,515]){const bar=document.createElement('i');bar.style.height=(ht/9)+'px';const sm=document.createElement('small');sm.textContent=ht+' m';bar.append(sm);study.append(bar);}body.append(study);}
    if(item.worldbookAnchor){for(const fact of item.worldbookAnchor.facts){const h=document.createElement('h2'),p=document.createElement('p');h.textContent=fact.title;p.textContent=fact.text;body.append(h,p);}}
    if(item.desc&&!item.worldbookAnchor){const p=document.createElement('p');p.textContent=item.desc;body.append(p);}if(item.art){const p=document.createElement('p');p.textContent='城市形态 / '+item.art.theme;body.append(p);}if(item.kind==='overlay'){const p=document.createElement('p');p.textContent='港区贯穿东京湾岸线，连接货运码头、客运港与工业岸线。京滨、川崎、千叶与木更津仍保留各自的地域身份；发射设施设在木更津外港。';body.append(p);}
    if(item.dims?.length&&!item.worldbookAnchor){const dl=document.createElement('dl');for(const d of item.dims){const dt=document.createElement('dt'),dd=document.createElement('dd'),sm=document.createElement('small');dt.textContent=d.k;dd.textContent=d.v;sm.textContent=d.d;dd.append(sm);dl.append(dt,dd);}body.append(dl);}
    if(item.locationNote||item.placement){const p=document.createElement('p');p.textContent=[item.locationNote,item.placement?item.posNote:null].filter(Boolean).join(' ');body.append(p);}
    if(item.relatedPlaceIds?.length){const h=document.createElement('h2');h.textContent=item.id==='ring-live'?'场馆内设施':'关联地点';body.append(h);for(const id of item.relatedPlaceIds){const n=places.find(n=>n.id===id);if(!n)continue;const b=document.createElement('button');b.className='node-button';b.dataset.node=id;b.dataset.related='true';b.append(icon(glyphType(n)),document.createTextNode(n.name));body.append(b);}}
    if(item.archive){
      for(const section of item.archive.sections||[]){const h=document.createElement('h2'),p=document.createElement('p');h.textContent=section.title;p.textContent=section.text;body.append(h,p);}
      if(item.archive.contacts?.length){const h=document.createElement('h2');h.textContent='人物联系';body.append(h);for(const contact of item.archive.contacts){const p=document.createElement('p');p.textContent=contact.name+' · '+contact.role;body.append(p);if(contact.placeId&&contact.placeId!==item.id&&places.some(n=>n.id===contact.placeId)){const b=document.createElement('button');b.className='node-button';b.dataset.node=contact.placeId;b.dataset.related='true';b.textContent='查看 '+places.find(n=>n.id===contact.placeId).name;body.append(b);}}}
    }
    if(item.worldbookAnchor){const source=document.createElement('p');source.className='source';source.textContent='设定来源：'+item.worldbookAnchor.sources.map(s=>s.comment).join('、');body.append(source);}else if(item.source&&!item.proposal){const source=document.createElement('p');source.className='source';source.textContent=item.source;body.append(source);}$('#detail-status').textContent=selection.kind==='node'?(item.worldbookAnchor?'世界书地点档案':item.availability==='dormant'?'行动线索 · 仅供查阅':'地点档案'):selection.kind==='subdistrict'?'子区档案':'地区档案';
  }
  function zoom(factor,point=[width/2,height/2]){tween=null;const before=unproject(point),next={...camera,z:clamp(camera.z*factor,.025,9)},after=unproject(point,next);move({x:camera.x+before[0]-after[0],y:camera.y+before[1]-after[1],z:next.z},false);}
  listen(root,'click',e=>{const region=e.target.closest('[data-region]'),node=e.target.closest('[data-node]'),view=e.target.closest('[data-view]'),cluster=e.target.closest('[data-cluster]'),filter=e.target.closest('[data-filter]');const subdistrict=e.target.closest('[data-subdistrict]');if(subdistrict)focusSubdistrict(subdistrict.dataset.subdistrict);if(region)focusRegion(region.dataset.region);if(node){if(node.dataset.related==='true')$('#filter-reset').click();focusNode(node.dataset.node);}if(cluster){setSelection({kind:'cluster',ids:cluster.dataset.cluster.split(',')});requestDraw();}if(filter){state.type=filter.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===filter)));$('#filter-name').textContent=filter.dataset.label;$('#filter-panel').open=false;renderIndex();requestDraw();}if(view){camera.mode=view.dataset.view;tween=null;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===view)));requestDraw();}});
  const regionFilter=$('#place-region');for(const r of data.regions.filter(r=>r.kind!=='alias')){const option=document.createElement('option');option.value=r.id;option.textContent=r.name;regionFilter.append(option);}listen(regionFilter,'change',()=>{state.filterRegion=regionFilter.value||null;renderIndex();requestDraw();});
  for(const group of ['总览','生活服务','人物联系','治安事件','委托','探索','都市设施']){
    const title=document.createElement('div');title.className='filter-group';title.textContent=group;$('#place-filters').append(title);
    const types=group==='总览'?[{id:'all',name:'全部'},{id:'legacy',name:'剧情地点'}]:data.serviceTypes.filter(t=>t.group===group);
    for(const t of types){const b=document.createElement('button');b.dataset.filter=t.id;b.dataset.label=t.name;b.style.setProperty('--type-color',t.color||'#6ecbd0');b.setAttribute('aria-pressed',String(t.id==='all'));const count=document.createElement('small');count.textContent=t.id==='all'?places.length:t.id==='legacy'?data.nodes.length:places.filter(n=>placeType(n)===t.id).length;b.append(icon(t.id),document.createTextNode(t.name),count);$('#place-filters').append(b);}
  }
  listen($('#atlas-search'),'input',()=>{query=$('#atlas-search').value.trim().toLocaleLowerCase();renderIndex();requestDraw();});listen($('#filter-reset'),'click',()=>{query='';$('#atlas-search').value='';state.type='all';state.filterRegion=null;regionFilter.value='';$('#filter-name').textContent='全部';$('#filter-panel').open=false;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='all')));renderIndex();requestDraw();});listen($('#pilot'),'click',pilot);listen($('#harbor-pilot'),'click',()=>focusNode('west-terminal'));listen($('#launch-pilot'),'click',()=>focusNode('east-terminal'));listen($('#home'),'click',fit);listen($('#zoom-in'),'click',()=>zoom(1.35));listen($('#zoom-out'),'click',()=>zoom(1/1.35));listen($('#poi-toggle'),'click',()=>{state.poi=!state.poi;$('#poi-toggle').setAttribute('aria-pressed',String(state.poi));requestDraw();});
  listen($('#detail-close'),'click',()=>{setSelection(null);const target=state.node?nodeLabels[places.findIndex(n=>n.id===state.node)]:map;(target.hidden?map:target).focus({preventScroll:true});requestDraw();});listen($('#detail-focus'),'click',()=>{if(state.selection?.kind==='node')focusNode(state.selection.id);else if(state.selection?.kind==='region')focusRegion(state.selection.id);else if(state.selection?.kind==='subdistrict')focusSubdistrict(state.selection.id);else if(state.selection?.kind?.startsWith('tram-'))focusTram(state.selection.kind,state.selection.id);});
  listen($('#index-toggle'),'click',()=>{const open=root.classList.toggle('index-open');$('#index-toggle').setAttribute('aria-expanded',String(open));if(open)$('#atlas-search').focus();});listen($('#index-close'),'click',()=>{closeIndex();$('#index-toggle').focus();});
  function showTramDetail(selection){
    state.selection=selection;detail.hidden=false;root.classList.add('detail-open');placeViewSwitch();
    const stop=selection.kind==='tram-stop',item=(stop?transit.stops:transit.routes).find(n=>n.id===selection.id),body=$('#detail-body');body.replaceChildren();body.scrollTop=0;
    $('#detail-kicker').textContent=stop?'TRANSIT / 轨道站':'TRANSIT / '+item.id;$('#detail-focus').hidden=false;
    const h=document.createElement('h1'),p=document.createElement('p');h.textContent=item.name;p.textContent=stop?(item.kind==='rail'?(item.mode==='tunnel'?'地下环线站。':'环线高架站。'):item.lines.length>1?'双线同站换乘。':'街行电车停靠站。')+'当前可查线路与站点，乘车服务尚未接通。':item.desc;body.append(h,p);
    for(const route of transit.routes.filter(r=>stop?item.lines.includes(r.id):r.id===item.id)){
      const link=document.createElement('button');link.className='tram-route';link.dataset.tramRoute=route.id;link.style.setProperty('--route-color',route.color);link.textContent=route.id+' / '+route.name;body.append(link);
      if(!stop)for(const id of route.stops){const s=transit.stops.find(s=>s.id===id),b=document.createElement('button');b.className='tram-station-row';b.dataset.tramStop=id;b.textContent=s.name+(s.lines.length>1?' ⇄ 换乘 '+s.lines.join(' / '):'');body.append(b);}
    }
    $('#detail-status').textContent=stop?'站点档案':'线路与停靠站';
  }
  for(const r of transit.routes){const b=document.createElement('button');b.className='tram-route';b.dataset.tramRoute=r.id;b.style.setProperty('--route-color',r.color);b.textContent=r.id+' / '+r.name;$('#tram-routes').append(b);}
  listen(root,'click',e=>{const route=e.target.closest('[data-tram-route]'),stop=e.target.closest('[data-tram-stop]');if(route)focusTram('tram-route',route.dataset.tramRoute);if(stop)focusTram('tram-stop',stop.dataset.tramStop);});
  listen($('#tram-toggle'),'click',()=>{state.tram=!state.tram;$('#tram-toggle').setAttribute('aria-pressed',String(state.tram));if(!state.tram&&state.selection?.kind?.startsWith('tram-'))setSelection(null);requestDraw();});
  const pointers=new Map();let gesture=null,tap=null;
  const point=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  function pickRegionAt(p){
    const world=unproject(p);ctx.save();ctx.setTransform(1,0,0,1,0,0);
    const selected=data.regions.findIndex((r,i)=>r.kind!=='overlay'&&ctx.isPointInPath(regionSelectionPaths[i],...world,'evenodd'));
    ctx.restore();return selected;
  }
  function startGesture(){if(pointers.size===1){const p=[...pointers.values()][0];gesture={kind:'pan',anchor:unproject(p)};}else if(pointers.size===2){const [a,b]=[...pointers.values()],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];gesture={kind:'pinch',anchor:unproject(mid),distance:Math.hypot(a[0]-b[0],a[1]-b[1]),z:camera.z};}}
  listen(canvas,'pointerdown',e=>{tween=null;pointers.set(e.pointerId,point(e));tap=night&&pointers.size===1?{id:e.pointerId,at:point(e)}:null;canvas.setPointerCapture(e.pointerId);startGesture();});
  listen(canvas,'pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));if(!gesture)return;if(gesture.kind==='pan'&&pointers.size===1){const p=point(e),at=unproject(p);camera.x=clamp(camera.x+gesture.anchor[0]-at[0],worldMinX+100,worldMaxX-100);camera.y=clamp(camera.y+gesture.anchor[1]-at[1],worldMinY+100,worldMaxY-100);}else if(gesture.kind==='pinch'&&pointers.size===2){const [a,b]=[...pointers.values()],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];camera.z=clamp(gesture.z*Math.hypot(a[0]-b[0],a[1]-b[1])/Math.max(1,gesture.distance),.025,9);const at=unproject(mid);camera.x=clamp(camera.x+gesture.anchor[0]-at[0],worldMinX+100,worldMaxX-100);camera.y=clamp(camera.y+gesture.anchor[1]-at[1],worldMinY+100,worldMaxY-100);}requestDraw();});
  listen(canvas,'pointermove',e=>{if(tap&&tap.id===e.pointerId&&Math.hypot(...point(e).map((v,i)=>v-tap.at[i]))>4)tap=null;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,event,e=>{const click=event==='pointerup'&&tap?.id===e.pointerId&&pointers.size===1;tap=null;pointers.delete(e.pointerId);gesture=null;if(pointers.size)startGesture();if(click){const ri=pickRegionAt(point(e));if(ri>=0)focusRegion(data.regions[ri].id);}requestDraw();});
  listen(canvas,'wheel',e=>{e.preventDefault();zoom(Math.exp(-clamp(e.deltaY,-120,120)*.0035),point(e));},{passive:false});
  listen(map,'keydown',e=>{if(e.target!==map)return;const delta=65/camera.z;const vectors={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]};if(vectors[e.key]){e.preventDefault();const [x,y]=vectors[e.key];move({x:camera.x+x,y:camera.y+y,z:camera.z},false);}else if(['+','=','-','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')fit();else zoom(e.key==='-'?1/1.35:1.35);}});
  listen(root,'keydown',e=>{if(e.key==='Escape'){if(root.classList.contains('index-open')){e.preventDefault();closeIndex();$('#index-toggle').focus();}else if(!detail.hidden){e.preventDefault();setSelection(null);map.focus();}requestDraw();}});
  function refitSelectionForViewport(){
    const selected=state.selection;if(!selected||detail.hidden)return;let target;
    if(selected.kind==='node')target=nodeCamera(places.find(n=>n.id===selected.id));
    else if(selected.kind==='region')target=regionCamera(regionsById.get(selected.id));
    else if(selected.kind==='subdistrict')target=subdistrictCamera(districts.find(d=>d.id===selected.id));
    else if(selected.kind==='tram-stop')target=nodeCamera(transit.stops.find(s=>s.id===selected.id));
    else if(selected.kind==='tram-route')target=regionCamera({bounds:boundsOf(transit.routes.find(r=>r.id===selected.id).points)});
    else if(selected.kind==='cluster')target=regionCamera({bounds:boundsOf(selected.ids.map(id=>places.find(n=>n.id===id).at))});
    if(target)move(target,false);
  }
  function resize(){const rect=map.getBoundingClientRect();if(!rect.width||!rect.height)return;const first=!width,changed=width!==rect.width||height!==rect.height;width=rect.width;height=rect.height;dpr=Math.min(devicePixelRatio||1,width<=700?1.25:1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);placeViewSwitch();if(first){const b=data.bounds;Object.assign(camera,{x:(b[0]+b[2])/2,y:(b[1]+b[3])/2,z:Math.min((width-70)/(b[2]-b[0]),(height-150)/(b[3]-b[1]))},data.initialView);$('#view-name').textContent=mapName;}else if(changed)refitSelectionForViewport();requestDraw();}
  const observer=new ResizeObserver(resize);observer.observe(map);
  const detailObserver=new ResizeObserver(entries=>{detailHeight=entries[0].contentRect.height;requestDraw();});detailObserver.observe(detail);
  function visibilityChanged(){if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;if(tween){Object.assign(camera,tween.to);tween=null;}}else requestDraw();}
  listen(document,'visibilitychange',visibilityChanged);
  function motionChanged(){if(reduceMotion()&&tween){Object.assign(camera,tween.to);tween=null;}requestDraw();}
  listen(reduced,'change',motionChanged);
  const motionObserver=new MutationObserver(motionChanged);motionObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  for(const [selector,id] of [['#pilot','plaza'],['#harbor-pilot','west-terminal'],['#launch-pilot','east-terminal']])$(selector).hidden=!places.some(p=>p.id===id);
  renderIndex();resize();
  if(data.initialView&&width&&height){const b=data.bounds;camera.z=Math.min(camera.z,(width-70)/(b[2]-b[0]),(height-150)/(b[3]-b[1]));requestDraw();}
  // Same-origin preview bridge owns only transient view state, never story variables.
  const viewDefaults={camera:{...camera},state:{...state},query,viewName:$('#view-name').textContent,viewport:{width,height}};
  window.TOKYO_ATLAS_VIEW={read:()=>window.TOKYO_ATLAS_STATE.snapshot({camera:{...(tween?.to||camera),mode:camera.mode},state:{...state},query,viewName:$('#view-name').textContent,viewport:{width,height}},data),restore:saved=>{
    const checked=window.TOKYO_ATLAS_STATE.normalize(saved,data,viewDefaults);
    if(checked.state.selection?.kind==='node'&&parent.CxxAtlasTool?.visible?.(checked.state.selection.id)===false){checked.state.selection=null;checked.state.node=null;}
    labelLayoutCache=null;tween=null;Object.assign(camera,checked.camera);Object.assign(state,checked.state);query=checked.query;$('#view-name').textContent=checked.viewName;
    $('#tram-toggle').setAttribute('aria-pressed',String(state.tram));$('#place-region').value=state.filterRegion||'';$('#atlas-search').value=query;$('#poi-toggle').setAttribute('aria-pressed',String(state.poi));syncNames();
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===camera.mode)));
    document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===state.type;b.setAttribute('aria-pressed',String(active));if(active)$('#filter-name').textContent=b.dataset.label;});
    renderIndex();setSelection(state.selection);if(checked.viewport&&(checked.viewport.width!==width||checked.viewport.height!==height))refitSelectionForViewport();requestDraw();
  }};
  // Read-only measurements for deterministic preview checks. No host APIs or game writes.
  window.TOKYO_ATLAS_DEBUG={snapshot:()=>({camera:{...camera},depth:depth(camera),groundDepth:groundDepth(camera),width,height,drawMs,selection:state.selection,localRegion:data.regions[localDepthRegion]?.id||null,render:{...renderStats,depthRegions:[...renderStats.depthRegions||[]]},regions:data.regions.length,buildings:allBuildings.length,micro:allMicro.length,sectorId:activeSector??null,complexParts:complexBuildings.length,cachedCanvasBytes:[overview,overviewLit,borderLayer,cityLayer].reduce((n,c)=>n+(c?c.width*c.height*4:0),0)}),project:p=>project(p),unproject:p=>unproject(p)};
  window.TOKYO_ATLAS_NAV={focusRegion,focusNode,focusSubdistrict,fit};
  window.CxxMapActivity={pause(value){paused=Boolean(value);if(paused){if(frame)cancelAnimationFrame(frame);frame=0;if(tween){Object.assign(camera,tween.to);tween=null;}}else requestDraw();},read:()=>({paused,pending:frame?1:0})};
  window.TOKYO_ATLAS_UNMOUNT=()=>{uiMotion?.dispose();gpu?.dispose();paused=true;lifetime.abort();disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;tween=null;observer.disconnect();detailObserver.disconnect();motionObserver.disconnect();reduced.removeEventListener('change',motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);for(const c of [canvas,overview,overviewLit,borderLayer,cityLayer])if(c){c.width=0;c.height=0;}for(const m of [bins,footprints,buildingMasses,buildingRegions,microGroups,microLampGroups])m.clear();window.TOKYO_ATLAS_DEBUG=null;window.TOKYO_ATLAS_NAV=null;};
};
if(!window.TOKYO_ATLAS_PACKETS)window.TOKYO_ATLAS_MOUNT();
