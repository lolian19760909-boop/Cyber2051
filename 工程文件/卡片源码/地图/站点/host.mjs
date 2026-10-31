import{mount}from'./app.mjs';
import{createRecordStore}from'./model.mjs';
// Both game hosts already expose the same atlas contract. The adapter receives
// current places and detail actions; it never receives a gameplay write port.
export async function mountHost({container,assetBase,catalog,tiles,mapId,scope,showPlace,getPlaces,visible=()=>true,storage,renderDetail,subscribe,publicURL}){
 if(!scope||typeof showPlace!=='function'||typeof getPlaces!=='function')throw Error('地图宿主需要当前存档、地点目录与跨地图查看接口。');
 const instance=await mount(container,{assetBase,catalog,tiles,scope,storage,records:createRecordStore({storage,scope}),publicURL,
  search:'?map='+encodeURIComponent(mapId),getPlaces:id=>getPlaces(id).filter(p=>visible(p.id,id)).map(p=>({...p,mapId:id,category:p.category||p.cat||'地点'})),
  onSelect:(id,context)=>showPlace(context.mapId,id),onDetail:renderDetail,subscribe});
 return{focus:(id,targetMap=mapId)=>instance.focus(id,targetMap),read:()=>instance.read(),refresh:()=>instance.refresh(),pause:value=>instance.pause(value),destroy:()=>instance.destroy()};
}
export const mountTavern=mountHost;
export const mountWeb=mountHost;
