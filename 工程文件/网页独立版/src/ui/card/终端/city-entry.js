/* Derived from 卡片源码/终端/city-entry.js; source SHA256 da2e80621bfdcec221ced427ad5ec7cab645988235242038f84a63faa3646dfe. Rebuild with tools/p3a-adapt-views.mjs. */
/* City page (DESIGN.md 10.14): the terminal's city map with the tracked commission, the current
   location and the four city entries over it; phones get a list that opens one full-screen detail.
   Read-only; the chat-owned atlas does all map work. */
(()=>{
 'use strict';
 const document=window.CxxWebTerminal.document;
 const app=window.CxxTerminalApp,city=document.getElementById('t2051x-page-city'),tool=()=>window.CxxAtlasTool,links=()=>window.TOKYO_TERMINAL_MAP_LINKS,data=window.T2051_DATA;
 const phone=window.matchMedia('(max-width:700px)');
 let disposed=false,focus='here',listScroll=0;
 const el=(tag,text,parent,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;parent.append(node);return node;};
 const button=(label,fn,parent,className='city-button')=>{const node=el('button',label,parent,className);node.type='button';node.onclick=fn;return node;};
 // The city SVG is a straight longitude/latitude projection, fitted on its own station dots.
 const SVG_W=1580,SVG_H=1568,toSVG=(lon,lat)=>[2794*lon-389559.1,-3695.6*lat+132662.8];
 const regionAnchor=new Map((data.regions||[]).map(r=>{const m=data.svg.match(new RegExp('<text[^>]*x="([\\d.]+)"[^>]*y="([\\d.]+)"[^>]*>'+r.name+'</text>'));return [r.id,m?{name:r.name,at:[+m[1],+m[2]]}:null];}));
 const regionByName=new Map([...regionAnchor].filter(([,v])=>v).map(([id,v])=>[v.name,id]));
 city.replaceChildren();
 const page=el('div',undefined,city,'sec-page city-hud');page.dataset.view='list';
 const head=el('header',undefined,page,'sec-head'),title=el('div',undefined,head,'sec-title');el('small','CITY / TOKYO 2051',title,'sec-eyebrow');el('h1','城市',title);el('span',undefined,head,'sec-grow');
 const figure=el('div',undefined,head,'sec-figure');el('small','已知地点',figure);const knownCount=el('strong','—',figure);
 const body=el('div',undefined,page,'city-body');
 const back=button('‹ 返回列表',()=>showList(),body,'city-back');
 const map=el('div',undefined,body,'city-map'),mapIn=el('div',undefined,map,'city-map-in'),art=el('img',undefined,mapIn);art.alt='';art.decoding='async';art.src='data:image/svg+xml,'+encodeURIComponent(data.svg);map.setAttribute('aria-hidden','true');
 const pinHere=el('i',undefined,mapIn,'city-pin is-here'),pinHereLabel=el('b',undefined,pinHere),pinTarget=el('i',undefined,mapIn,'city-pin is-target'),pinTargetLabel=el('b',undefined,pinTarget);pinHere.hidden=pinTarget.hidden=true;
 // Phone list: the two current rows; the entries below double as rows.
 const list=el('div',undefined,body,'city-list sec-list');el('p','当前 · 2',list,'sec-group');
 const row=(kind)=>{const node=button('',()=>showDetail(kind),list,'sec-row city-row');el('i',undefined,node,'sec-icon');const strong=el('strong','',node),side=el('span','',node,'city-row-side'),small=el('small','',node);return {node,strong,side,small};};
 const hereRow=row('here'),trackRow=row('track');
 const track=el('section',undefined,body,'city-track'),trackLabel=el('p','追踪目标',track,'city-label'),trackTitle=el('h2','',track),trackGoal=el('p','',track,'city-goal'),trackMeta=el('small','',track,'city-meta');trackLabel.setAttribute('aria-hidden','true');
 const trackActions=el('div',undefined,track,'city-actions');
 const questButton=button('查看追踪委托',()=>{const value=model();if(!value.quest){app.navigate('operations');return;}if(!links()?.openQuest(value.quest.id))note.textContent='这份委托暂不可用，请到委托页核对。';},trackActions);
 const targetButton=button('定位任务地点',()=>{const value=model();if(value.quest&&value.targetKnown)links()?.goToQuest(value.quest.id);},trackActions);
 const here=el('section',undefined,body,'city-here'),hereDot=el('i',undefined,here,'city-dot'),hereText=el('div',undefined,here),hereName=el('strong','',hereText),hereMeta=el('small','',hereText,'city-meta');hereDot.setAttribute('aria-hidden','true');
 const hereButton=button('在地图中查看',()=>{const value=model();if(value.locationKnown)openMap(value.location);},here);
 const cmd=el('nav',undefined,body,'city-cmd');cmd.setAttribute('aria-label','城市入口');el('p','城市入口 · 4',cmd,'sec-group');
 const entry=(label,hint,fn,primary)=>{const node=button('',fn,cmd,'city-entry-button'+(primary?' is-primary':''));el('span',label,node);el('small',hint,node);return node;};
 entry('打开城市地图 ↗','镜头、筛选与地点选择会保留',()=>openMap(),true);
 entry('地点与线索 ↗','城市记录',()=>tool()?.openRecords('places'));
 entry('警方与通缉 ↗','城市记录',()=>tool()?.openRecords('police'));
 entry('浏览地点资料 →','资料库 · 城市档案',()=>app.navigate('archive'));
 const note=el('p','',page,'city-status');note.setAttribute('role','status');
 function model(){
  const snapshot=window.TOKYO_TERMINAL_HOST.read(),sd=snapshot.statData||{},location=window.CxxCity?.actorLocation(sd)||sd.terminal?.gameplay?.location,trackedId=sd.terminal?.questJournal?.tracked;
  const quest=(snapshot.quests||[]).find(q=>q.id===trackedId),record=sd.terminal?.quests?.[trackedId]||{},locationName=location&&(window.CxxCity?.place(sd,location.placeId)?.name||links()?.placeName(location.mapId,location.placeId));
  return {sd,location,locationName,locationKnown:!!locationName,trackedId,quest,record,targetKnown:!!(quest&&links()?.placeName(quest.mapId,quest.placeId))};
 }
 // A place lands on its own coordinates, else on its district's label; the western region has no spot here.
 function spot(sd,mapId='tokyo-central',placeId){
  if(!placeId||mapId!=='tokyo-central')return null;
  const node=(data.nodes||[]).find(n=>n.id===placeId);if(node)return {at:toSVG(node.lon,node.lat),exact:true};
  const record=window.CxxCity?.place(sd,placeId)||data.locationMaps?.find(m=>m.id===mapId)?.places.find(p=>p.id===placeId);
  const region=regionAnchor.get(record?.group)||regionAnchor.get(regionByName.get(record?.district));
  return region?{at:region.at,exact:false,district:region.name}:null;
 }
 function districtOf(sd,placeId){const record=window.CxxCity?.place(sd,placeId)||data.locationMaps?.[0]?.places.find(p=>p.id===placeId);return record?.district||regionAnchor.get(record?.group)?.name||'';}
 let view={here:null,target:null};
 function place(){
  const w=map.clientWidth,h=map.clientHeight;if(!w||!h)return;
  const wide=!phone.matches,zoom=wide?1.5:2.4,scale=Math.max(w/SVG_W,h/SVG_H)*zoom,anchor=view.here?.at||view.target?.at||regionAnchor.get('imperial')?.at||[SVG_W/2,SVG_H/2];
  // Wide screens keep the focus right of centre, clear of the commission panel on the left.
  const fx=wide?.6:.5,fy=wide?.46:.5,iw=SVG_W*scale,ih=SVG_H*scale;
  const left=Math.min(0,Math.max(w-iw,w*fx-anchor[0]*scale)),top=Math.min(0,Math.max(h-ih,h*fy-anchor[1]*scale));
  Object.assign(mapIn.style,{width:iw+'px',height:ih+'px',transform:`translate(${left}px,${top}px)`});
  for(const [pin,value] of [[pinHere,view.here],[pinTarget,view.target]]){pin.hidden=!value;if(value){pin.style.left=value.at[0]*scale+'px';pin.style.top=value.at[1]*scale+'px';}}
  // Two nearby spots would stack their names; the target's name then reads to the left.
  const near=view.here&&view.target&&Math.abs(view.here.at[0]-view.target.at[0])*scale<220&&Math.abs(view.here.at[1]-view.target.at[1])*scale<34;pinTarget.classList.toggle('is-flipped',!!near);
 }
 function render(){
  if(disposed)return;const value=model(),sd=value.sd;
  const hereSpot=value.locationKnown?spot(sd,value.location.mapId,value.location.placeId):null,targetSpot=value.targetKnown?spot(sd,value.quest.mapId||'tokyo-central',value.quest.placeId):null;
  const hereDistrict=value.locationKnown?districtOf(sd,value.location.placeId):'',targetName=value.targetKnown?links()?.placeName(value.quest.mapId,value.quest.placeId):'';
  view={here:hereSpot,target:targetSpot};
  pinHereLabel.textContent=value.locationName?(hereSpot&&!hereSpot.exact?value.locationName+' · '+hereSpot.district:value.locationName):'';
  pinTargetLabel.textContent=targetName?(targetSpot&&!targetSpot.exact?targetName+' · '+targetSpot.district:targetName):'';
  hereName.textContent=value.locationName||(value.location?'地图未收录此地点':'尚未记录地点');
  hereMeta.textContent=value.locationKnown?['当前位置',hereDistrict].filter(Boolean).join(' · '):value.location?'已有地点记录保留，可继续浏览城市资料。':'剧情记录地点后，会在这里显示。';
  hereButton.disabled=!value.locationKnown;
  trackTitle.textContent=value.quest?.title||(value.trackedId?'追踪委托暂不可读取':'尚未追踪委托');
  trackGoal.textContent=value.quest?(value.record.objective||value.quest.goal||'查看委托中的当前目标。'):value.trackedId?'已有追踪记录保留，可到委托页核对。':'在委托页追踪任务后，这里会显示当前目标。';
  const pay=Number(value.record.agreedYen??value.quest?.pay);
  trackMeta.textContent=value.quest?[value.quest.fixer,targetName||value.quest.district,Number.isFinite(pay)&&pay>0?'¥ '+pay.toLocaleString('en-US'):''].filter(Boolean).join(' · '):'';
  questButton.textContent=value.quest?'查看追踪委托':'查看委托';targetButton.hidden=!value.targetKnown;track.dataset.empty=String(!value.quest);
  hereRow.strong.textContent='当前位置 · '+hereName.textContent;hereRow.small.textContent=hereMeta.textContent;hereRow.side.textContent=value.locationKnown?'在地图中查看':'';
  trackRow.strong.textContent='追踪目标 · '+trackTitle.textContent;trackRow.small.textContent=value.quest?[value.quest.fixer,targetName||value.quest.district].filter(Boolean).join(' · '):trackGoal.textContent;
  trackRow.side.replaceChildren();if(value.quest){const chip=el('span',value.record.state==='进行中'||!value.record.state?'追踪中':value.record.state,trackRow.side,'sec-chip is-attention');chip.setAttribute('aria-hidden','true');}
  const ids=new Set((data.locationMaps||[]).flatMap(m=>m.places.map(p=>p.id)));knownCount.textContent=String([...ids].filter(id=>!window.CxxCity||window.CxxCity.known(sd,id)).length);
  place();
 }
 // Phones: list first, one detail at a time, and the way back restores the list where it was.
 function showDetail(kind){
  if(!phone.matches){if(kind==='here')hereButton.focus();else questButton.focus();return;}
  focus=kind;listScroll=page.scrollTop;void app.motion.swap(body,()=>{page.dataset.view='detail';page.dataset.focus=kind;page.scrollTop=0;place();});requestAnimationFrame(place);back.focus({preventScroll:true});
 }
 function showList(){if(page.dataset.view!=='detail')return false;void app.motion.swap(body,()=>{page.dataset.view='list';place();},{direction:-1});requestAnimationFrame(()=>{place();page.scrollTop=listScroll;(focus==='here'?hereRow:trackRow).node.focus({preventScroll:true});});return true;}
 // Entry motion follows the section pages (DESIGN.md 10.11 / 10.14).
 let animations=[];
 function motion(kind){
  animations.forEach(a=>a.cancel());animations=[];
  if(app.motion.available){if(kind==='enter')for(const n of [track,here,...cmd.children])if(n.getClientRects().length)void app.motion.animate(n,[{opacity:.3,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{channel:'city-entry',duration:200});return;}
  if(document.getElementById('t2051x-root')?.dataset.motion!=='full'||!page.animate||city.hidden)return;
  const theme=document.documentElement.dataset.cxxTheme||'red',ease='cubic-bezier(.23,1,.32,1)',time=theme==='yellow'?180:theme==='night'?160:200;
  const frames=dx=>theme==='yellow'?[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}]:theme==='night'?[{opacity:0},{opacity:1}]:[{opacity:0,transform:`translateX(${dx}px)`},{opacity:1,transform:'none'}];
  const visible=node=>node.getClientRects().length>0;
  const parts=kind==='select'?[[here,24],[track,24]]:[[track,-16],[here,-16],...[...cmd.children,...list.children].map(n=>[n,-16])];
  parts.filter(([n])=>visible(n)).slice(0,14).forEach(([n,dx],i)=>animations.push(n.animate(frames(dx),{duration:time,delay:Math.min(i*24,300),easing:ease,fill:'backwards'})));
  if(kind==='enter')for(const [i,pin] of [pinHere,pinTarget].entries())if(!pin.hidden)animations.push(pin.animate(theme==='night'?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(-14px)'},{opacity:1,transform:'none'}],{duration:240,delay:200+i*160,easing:ease,fill:'backwards'}));
 }
 function openMap(location){
  if(!tool()){const page=app.page;note.textContent='正在准备地图…';void window.CxxWebTerminal.prepareMap().then(()=>{if(!disposed&&app.visible&&(app.page===page||app.page==='city'))openMap(location);}).catch(error=>{if(!disposed)note.textContent=error.message;});return true;}
  const atlas=tool();if(!atlas){note.textContent='城市地图尚未就绪，请稍后重试。';return false;}
  try{const opened=location?atlas.focus(location.mapId,location.placeId):atlas.open();note.textContent=opened?'':'此地点暂时没有地图入口。';return opened;}catch(error){note.textContent=error.message;return false;}
 }
 const launch=event=>{if(event.target.closest('[data-page="city"]'))queueMicrotask(()=>{if(!disposed)openMap();});};
 const nav=document.getElementById('t2051x-system-nav');nav.addEventListener('click',launch);
 const resize=new ResizeObserver(()=>place());resize.observe(map);
 const layout=()=>{if(!phone.matches)page.dataset.view='list';requestAnimationFrame(place);};phone.addEventListener('change',layout);
 let shown=false;
 // Leaving the city page closes a phone detail, so coming back always starts at the list.
 const stop=app.subscribe(event=>{if(disposed)return;if(event?.preferences)tool()?.preferences();if(event?.data||event?.route)render();if(event?.route){const now=app.page==='city'&&!city.hidden;if(!now)page.dataset.view='list';if(now&&!shown)requestAnimationFrame(()=>motion('enter'));shown=now;}});
 window.TOKYO_TERMINAL_MAP_CONTROL={focus(mapId,placeId){return !disposed&&openMap({mapId,placeId})||false;},escape:()=>!disposed&&showList(),read:()=>tool()?.read().shell,destroy(){if(disposed)return;disposed=true;stop();resize.disconnect();phone.removeEventListener('change',layout);nav.removeEventListener('click',launch);animations.forEach(a=>a.cancel());}};
 window.addEventListener('pagehide',()=>window.TOKYO_TERMINAL_MAP_CONTROL.destroy(),{once:true});render();
})();
