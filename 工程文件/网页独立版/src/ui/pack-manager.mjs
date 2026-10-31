/** 设置里的“本机资源”面板：显示已装载层，允许切换画质或删除不再需要的一档。 */
import {formatBytes,layerLabel,qualityLabel,selectPack,installedLayerKeys,removeInstalledLayer} from '../assets/pack-state.mjs';
export function mountPackManager({parent,catalog,quality,onChange=()=>{},onError=error=>{}}={}){
 if(!parent)return {refresh:async()=>{},destroy(){}};
 let disposed=false;
 const node=(tag,text,where=parent)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;where.append(el);return el;};
 const button=(label,fn,where=parent)=>{const el=node('button',label,where);el.type='button';el.onclick=()=>Promise.resolve(fn(el)).catch(error=>onError(error));return el;};
 parent.replaceChildren();
 const box=node('div','',parent);box.className='cxx-pack-manager';
 const summary=node('p','正在读取本机资源…',box);summary.className='cxx-pack-summary';summary.setAttribute('role','status');
 const list=node('div','',box);list.className='cxx-pack-layer-list';
 const actions=node('div','',box);actions.className='cxx-pack-manager-actions';
 const note=node('p','切换画质后重新载入。',box);note.className='hint';
 async function paint(){
  if(disposed)return;
  const installed=await installedLayerKeys(catalog);if(disposed)return;
  const current=selectPack(catalog,quality),layers=Object.values(catalog?.layers||{});
  const used=layers.filter(layer=>installed.has(layer.key)).reduce((n,layer)=>n+(Number(layer.bytes)||0),0);
  summary.textContent=(current?qualityLabel(current.key)+' · '+formatBytes(current.bytes):'资源目录未读取')+' · 本机已装载 '+formatBytes(used);
  list.replaceChildren();
  for(const layer of layers){const row=node('div','',list);row.className='cxx-pack-layer';row.dataset.installed=String(installed.has(layer.key));
   const dot=node('span','',row);dot.className='cxx-pack-dot';dot.setAttribute('aria-hidden','true');
   const body=node('span','',row);body.className='cxx-pack-layer-body';
   const name=node('strong',layerLabel(layer.key),body),size=node('span',formatBytes(layer.bytes),body);
   const stateText=installed.has(layer.key)?'已装载':layer.key==='common'?'尚未装载':'未安装';const status=node('span',stateText,body);status.className='cxx-pack-layer-state';
   const currentLayer=Boolean(current?.layers?.includes(layer.key));if(currentLayer)status.textContent+=' · 当前画质';
  }
  actions.replaceChildren();
  const otherKeys=Object.keys(catalog?.packs||{}).filter(key=>key!==current?.key);
  for(const key of otherKeys){const target=selectPack(catalog,key);if(!target)continue;const missing=(target.layers||[]).some(name=>!installed.has(name));button((missing?'下载并切换到':'切换到')+qualityLabel(key)+(missing?'（约 '+formatBytes(target.bytes)+'）':''),()=>{if(!window.confirm('切换到'+qualityLabel(key)+'？页面会重新载入。'))return;onChange(key);},actions);}
  for(const layer of layers){if(!installed.has(layer.key)||current?.layers?.includes(layer.key)||layer.key==='common')continue;button('删除'+layerLabel(layer.key)+'（'+formatBytes(layer.bytes)+'）',async el=>{if(!window.confirm('删除本机的'+layerLabel(layer.key)+'？以后需要时可以重新下载；不会影响存档。'))return;el.disabled=true;summary.textContent='正在删除'+layerLabel(layer.key)+'…';await removeInstalledLayer(layer);await paint();},actions);}
  if(!actions.children.length)node('span','当前画质已覆盖全部已装载资源。',actions);
 }
 void paint();
 return {refresh:paint,destroy(){disposed=true;parent.replaceChildren();}};
}
