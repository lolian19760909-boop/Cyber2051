/** 本机资源包目录与画质选择。资源只影响图片层，存档、卡线与玩家数据不在这里。 */
import {appUrl} from '../platform/paths.mjs';
export const PACK_QUALITY_KEY='cxx2051:pack-quality:v1';
export const PACK_CACHE='cxx2051-official-media-v1';
const LABELS={standard:'标准画质',original:'原画质',common:'公共资源',webp:'标准画质图片',png:'原画质图片'};
export const layerLabel=key=>LABELS[key]||key||'资源';
export const qualityLabel=key=>LABELS[key]||key||'标准画质';
export function formatBytes(value){
 const bytes=Number(value)||0,MiB=1024*1024,GiB=1024*MiB;
 if(bytes>=GiB)return (bytes/GiB).toFixed(2)+' GB';
 if(bytes>=MiB)return Math.round(bytes/MiB)+' MB';
 return Math.max(1,Math.round(bytes/1024))+' KB';
}
export async function loadPackCatalog(){
 const response=await fetch(appUrl('data/player-pack.json'));if(!response.ok)throw Error('当前资源包目录缺失');
 const catalog=await response.json();if(catalog?.schema!==2||!catalog.layers||!catalog.packs)throw Error('当前资源包目录格式不受支持');
 return catalog;
}
export function selectPack(catalog,quality){
 const packs=catalog?.packs||{},key=packs[quality]?quality:(packs.standard?'standard':Object.keys(packs)[0]);
 return key?{key,...packs[key]}:null;
}
export function readPackQuality(catalog){
 let saved='';try{saved=localStorage.getItem(PACK_QUALITY_KEY)||'';}catch{}
 return saved&&selectPack(catalog,saved)?.key===saved?saved:null;
}
export function savePackQuality(quality){try{if(quality)localStorage.setItem(PACK_QUALITY_KEY,quality);else localStorage.removeItem(PACK_QUALITY_KEY);}catch{}}
export const clearPackQuality=()=>savePackQuality('');
export function activeLayers(catalog,quality){
 const pack=selectPack(catalog,quality);if(!pack)return [];
 return (pack.layers||[]).map(key=>catalog.layers[key]).filter(Boolean).map(layer=>({...layer,download:new URL(layer.download,appUrl('')).href}));
}
export function packEntries(catalog,quality){
 // 只取当前画质实际启用的层。WebP 层的别名里故意保留了原 PNG 地址（标准档直接命中 WebP），
 // 若把 PNG 层也一起登记，同一地址会被后写入的层覆盖，原画质就会读到 WebP。
 const layers=quality?activeLayers(catalog,quality):Object.values(catalog?.layers||{});
 return [...new Map(layers.flatMap(layer=>layer.entries||[]).map(entry=>[entry.id,entry])).values()];
}
export function packBytes(catalog,quality){const pack=selectPack(catalog,quality);return Number(pack?.bytes)||0;}
const siteRoot=()=>new URL('../../',appUrl(''));
const completeKey=id=>new URL('__cxx_media__/complete/'+id,siteRoot()).href;
export async function installedLayerKeys(catalog){
 const keys=new Set();if(!globalThis.caches||!catalog?.layers)return keys;
 try{const cache=await caches.open(PACK_CACHE);for(const layer of Object.values(catalog.layers)){if(await cache.match(completeKey(layer.id)))keys.add(layer.key);}}catch{}
 return keys;
}
export async function installedLayers(catalog){
 const keys=await installedLayerKeys(catalog);return Object.values(catalog?.layers||{}).filter(layer=>keys.has(layer.key));
}
export async function removeInstalledLayer(layer,{timeout=30000}={}){
 if(!layer?.id)throw Error('资源层无效');
 const registration=await navigator.serviceWorker?.ready;const worker=registration?.active;
 if(!worker)throw Error('资源安装器尚未就绪，请重新载入页面');
 const channel=new MessageChannel();
 return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{channel.port1.close();reject(Error('删除资源层超时'));},timeout);
  channel.port1.onmessage=({data})=>{if(data?.stage==='removed'){clearTimeout(timer);channel.port1.close();resolve(data);return;}if(data?.stage==='error'){clearTimeout(timer);channel.port1.close();reject(Error(data.message||'删除资源层失败'));}};
  worker.postMessage({type:'remove-layer',id:layer.id,entries:layer.entries||[]},[channel.port2]);
 });
}
