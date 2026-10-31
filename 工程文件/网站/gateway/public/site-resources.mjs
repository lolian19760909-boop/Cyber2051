const status=document.getElementById('pack-size');
const host=document.getElementById('pack-layers');
const badge=document.getElementById('pack-badge');

function formatBytes(bytes){
 const value=Number(bytes)||0;
 if(value>=1073741824)return (value/1073741824).toFixed(2)+' GiB';
 if(value>=1048576)return Math.round(value/1048576)+' MiB';
 if(value>=1024)return Math.round(value/1024)+' KiB';
 return value+' B';
}
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
function layerLabel(key){return key==='common'?'公共资源':key==='webp'?'标准画质图片':key==='png'?'原画质图片':key;}

try{
 const current=await(await fetch('/play/current.json',{cache:'no-store'})).json();
 if(!/^[a-f0-9]{20}$/.test(current.release))throw Error('资源版本入口无效');
 const response=await fetch('/play/releases/'+current.release+'/data/player-pack.json');
 if(!response.ok)throw Error('资源信息暂时不可用');
 const pack=await response.json();
 if(pack.schema!==2||!pack.layers||!pack.packs)throw Error('资源信息格式不匹配');

 const standard=pack.packs.standard;
 const original=pack.packs.original;
 function packFiles(target){const ids=new Set();for(const key of target?.layers||[])for(const entry of pack.layers[key]?.entries||[])ids.add(entry.id);return ids.size;}
 badge.textContent='当前 · 资源版本 '+pack.version;
 status.textContent='标准画质 '+packFiles(standard)+' 个文件 · '+formatBytes(standard?.bytes)+' · 原画质 '+packFiles(original)+' 个文件 · '+formatBytes(original?.bytes);
 host.textContent='';

 function section(title,note,layers){
  const block=node('section','pack-quality');
  block.append(node('h3','',title),node('p','meta',note));
  for(const key of layers){
   const layer=pack.layers[key];
   if(!layer)continue;
   const row=node('div','pack-layer');
   const info=node('div','');
   info.append(node('p','meta',layerLabel(key)+' · '+formatBytes(layer.bytes)+' · '+layer.name));
   info.append(node('code','',layer.sha256));
   const link=node('a','btn','下载 ZIP');
   link.href=layer.download;
   link.download=layer.name||'';
   row.append(info,link);
   block.append(row);
  }
  host.append(block);
 }

 section('公共资源','两档共用：字体、音频、Live2D、地图与不需要转码的小图。',['common']);
 if(standard)section('标准画质','WebP · '+formatBytes(standard.bytes)+'。',standard.layers.filter(key=>key!=='common'));
 if(original)section('原画质','PNG · '+formatBytes(original.bytes)+'。',original.layers.filter(key=>key!=='common'));
}catch(error){
 status.textContent=error.message;
}
