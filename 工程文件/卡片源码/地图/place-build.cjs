'use strict';
function load(source){
 const data=JSON.parse(source('地图/places.json')),entries=JSON.parse(source('世界书/entries.json')).entries;
 const texts=new Map(data.regions.map(region=>{const entry=entries.find(e=>e.id===region.uid);if(!entry)throw Error('地区世界书未登记');return [region.uid,source(entry.file)];}));
 const places=data.places.map(place=>{const text=texts.get(place.entryId),label='【地点 '+place.id+'｜',start=text.indexOf(label);if(start<0||text.indexOf(label,start+1)>=0)throw Error('地区地点标记缺失或重复：'+place.id);const end=text.indexOf('\n【地点 ',start+1),section=text.slice(start,end<0?text.length:end),heading=section.indexOf('】');if(heading<0)throw Error('地点标题未闭合');return {...place,desc:section.slice(heading+1).trim()};});
 if(new Set(places.map(p=>p.id)).size!==places.length)throw Error('地点编号重复');
 return {...data,places};
}
module.exports={load};
