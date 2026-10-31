/* Compose maintained styles and current clinic text after map integrity checks. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxAtlasDocumentStyle=api;})(globalThis,function(){
 'use strict';
 function rewriteData(html,label,transform){
  const start=html.indexOf(label);if(start<0)return html;const begin=start+label.length;
  let depth=0,quoted=false,escape=false,end=-1;
  for(let i=begin;i<html.length;i++){const ch=html[i];if(quoted){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')quoted=false;}else if(ch==='"')quoted=true;else if(ch==='{'||ch==='[')depth++;else if(ch==='}'||ch===']'){depth--;if(!depth){end=i+1;break;}}}
  if(end<0)throw Error('地图数据段没有闭合。');
  const data=JSON.parse(html.slice(begin,end));transform(data);
  return html.slice(0,begin)+JSON.stringify(data).replace(/</g,'\\u003c')+html.slice(end);
 }
 function placeFacts(html,places){
  if(!places?.length)return html;const byId=new Map(places.map(p=>[p.id,p]));
  function update(data){if(!data||typeof data!=='object')return;const p=byId.get(data.id);if(p&&typeof data.name==='string'&&('cat'in data||'desc'in data)){data.name=p.name;data.group=p.group;data.desc=p.desc;if(p.floor)data.floor=p.floor;if(p.questId){data.readOnly=false;data.acceptsQuest=true;data.questId=p.questId;if(data.archive){data.archive.readOnly=false;data.archive.acceptsQuest=true;}}}
   for(const value of Object.values(data))if(value&&typeof value==='object')update(value);
  }
  html=rewriteData(html,'window.TOKYO_ATLAS=',update);
  return rewriteData(html,'window.TOKYO_ATLAS_PACKETS=',packets=>{for(const [key,raw]of Object.entries(packets)){if(typeof raw!=='string')continue;const packet=JSON.parse(raw);update(packet);packets[key]=JSON.stringify(packet);}});
 }
 function maintainedModules(html,modules){
  const spans=[['atlas','window.TOKYO_ATLAS_MOUNT=()=>{','if(!window.TOKYO_ATLAS_PACKETS)window.TOKYO_ATLAS_MOUNT();'],['api','/* Public view contract; scene replacement never changes this interface. */',"window.addEventListener('pagehide',e=>{if(!e.persisted)api.destroy();});"]];
  for(const [key,begin,ending]of spans){if(!modules[key])continue;const start=html.indexOf(begin);if(start<0){if(key==='atlas')continue;throw Error('地图视图接口入口缺失。');}const last=html.indexOf(ending,start);if(last<0)throw Error('地图维护模块出口缺失：'+key);let end=last+ending.length;if(key==='api'){const tail=html.slice(end).match(/^\s*\}\)\(\);/);if(!tail)throw Error('地图视图接口未闭合。');end+=tail[0].length;}html=html.slice(0,start)+modules[key]+html.slice(end);}
  return html;
 }
 function industrialFacts(html,industrial,places){
  if(!industrial?.districts?.length)return html;
  let ri=-1;
  function facilities(data){
   if(!data||typeof data!=='object')return;
   if(industrial.facilities?.[data.id])Object.assign(data,industrial.facilities[data.id]);
   for(const value of Object.values(data))if(value&&typeof value==='object')facilities(value);
  }
  function update(data){
   if(ri<0||!data.districtExpansion)return;
   const districts=data.districtExpansion.districts,points=data.districtExpansion.places;
   for(const item of industrial.districts){
    const place=places.find(p=>p.industrialDistrict===item.id);if(!place)throw Error('工业园地点资料缺失：'+item.id);
    if(!districts.some(d=>d.id===item.id))districts.push({...item,ri,desc:place.desc});
    if(!points.some(p=>p.id===place.id))points.push({id:place.id,name:place.name,group:place.group,sectorId:item.sectorId,at:place.mapAt,cat:place.cat,type:'legacy',desc:place.desc,source:'世界书条目 '+place.entryId,industrialDistrict:item.id});
   }
  }
  html=rewriteData(html,'window.TOKYO_ATLAS=',data=>{
   if(data.mapId!=='tokyo-central')return;
   ri=data.regions.findIndex(r=>r.id===industrial.region);if(ri<0)throw Error('工业区兼容编号缺失。');
   const region=data.regions[ri],districts=industrial.districts;
   // Retain the old key and array position for saved views and building references.
   // The former bay-wide overlay no longer represents a separate district.
   Object.assign(region,{name:industrial.name,en:'INDUSTRIAL COMMONS',kind:'alias',at:[1950,1460],cover:'皇核南侧 · 三家企业的生产与整备园区',selectionPath:districts.map(d=>d.selectionPath).join(' '),selectionBounds:[Math.min(...districts.map(d=>d.bounds[0])),Math.min(...districts.map(d=>d.bounds[1])),Math.max(...districts.map(d=>d.bounds[2])),Math.max(...districts.map(d=>d.bounds[3]))],dims:[{k:'园区',v:'丰川 · 太平洋 · 泽塔',d:'独立厂区，共用公共道路与市政设施'}]});
   region.bounds=region.selectionBounds.slice();region.viewBounds=region.bounds.slice();region.coastlines=[];delete region.populationWan;delete region.populationScope;
   region.art={theme:'重型装配、装备整备与机电检测',shapes:[1,5,4],street:'grid'};
   const core=data.sectorDefinitions?.find(s=>s.id==='central-core');if(core&&!core.members.includes(industrial.region))core.members.push(industrial.region);
   if(data.sectorRouting)data.sectorRouting[industrial.region]='central-core';
   facilities(data);update(data);
  });
  return rewriteData(html,'window.TOKYO_ATLAS_PACKETS=',packets=>{for(const [key,raw]of Object.entries(packets)){if(typeof raw!=='string')continue;const data=JSON.parse(raw);facilities(data);packets[key]=JSON.stringify(data);}});
 }
 function prepare(html,styles,places=[],modules={},industrial=null){
  let index=0;
  let output=html.replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi,(block,start,end)=>{
   if(index>=styles.length)throw Error('地图样式配方与文档不匹配。');
   return start+styles[index++]+end;
  });
  if(index!==styles.length)throw Error('地图样式配方与文档不匹配。');
  const clinicText=[
   ['红花街内的义体诊所','夕暮老街的义体与神经内科诊所'],
   ['街里有一家便宜实惠、技术过硬的义体诊所——『阿杨』义体诊所，老板是在日长大的华人，对中国了解并不深，海铃经常光顾。','海铃也常去夕暮老街找宇田川巴处理伤口与维护义体，巴的诊所与羽泽咖啡店比邻。'],
   ['红花街里一家便宜实惠、技术过硬的义体诊所，老板是在日长大的华人，对中国了解并不深。海铃经常光顾这家义体诊所','夕暮老街的独立义体与神经内科诊所，由宇田川巴主理，与羽泽咖啡店比邻。海铃经常来这里接受外伤处理与义体维护'],
   ['红花街里一家便宜实惠、技术过硬的义体诊所，老板是在日长大的华人，对中国了解并不深。','夕暮老街的独立义体与神经内科诊所，由宇田川巴主理，与羽泽咖啡店比邻。'],
   ['卡内定案『红花街里』（随红花街锚点）','夕暮老街的巴诊所；地图点位沿用原诊所坐标'],
   ['阿杨义体诊所','宇田川巴的老街诊所']
  ];
  for(const [before,after]of clinicText)output=output.split(before).join(after);
  return maintainedModules(industrialFacts(placeFacts(output,places),industrial,places),modules);
 }
 return {prepare,placeFacts,maintainedModules,industrialFacts};
});
