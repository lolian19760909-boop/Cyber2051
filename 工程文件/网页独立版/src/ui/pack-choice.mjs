/** 首次进入前选择画质。下载完成后仍可在设置里切换或删除另一档。 */
import {formatBytes,qualityLabel,selectPack} from '../assets/pack-state.mjs';
export function choosePackQuality({catalog,defaultQuality='standard'}={}){
 const packs=Object.keys(catalog?.packs||{}).filter(key=>catalog.packs[key]).map(key=>({key,...catalog.packs[key]}));
 if(packs.length<=1)return Promise.resolve(packs[0]?.key||'standard');
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='cxx-pack-choice';dialog.setAttribute('aria-labelledby','cxx-pack-choice-title');
  const panel=document.createElement('div');panel.className='cxx-pack-choice-panel';dialog.append(panel);
  const title=document.createElement('h2');title.id='cxx-pack-choice-title';title.textContent='选择本机画质';panel.append(title);

  let selected=selectPack(catalog,defaultQuality)?.key||packs[0].key;
  const list=document.createElement('div');list.className='cxx-pack-options';panel.append(list);
  for(const pack of packs){
   const label=document.createElement('label');label.className='cxx-pack-card';label.dataset.quality=pack.key;
   const radio=document.createElement('input');radio.type='radio';radio.name='cxx-pack-quality';radio.value=pack.key;radio.checked=pack.key===selected;radio.onchange=()=>{selected=pack.key;paint();};label.append(radio);
   const body=document.createElement('span');body.className='cxx-pack-card-body';label.append(body);
   const name=document.createElement('strong');name.textContent=qualityLabel(pack.key)+(pack.key==='standard'?'（推荐）':'');body.append(name);
   const size=document.createElement('span');size.className='cxx-pack-size';size.textContent=formatBytes(pack.bytes);body.append(size);
   const note=document.createElement('span');note.className='cxx-pack-note';note.textContent=pack.key==='standard'?'WebP 图片':'PNG 原图';body.append(note);
   list.append(label);
  }
  const foot=document.createElement('div');foot.className='cxx-pack-choice-foot';panel.append(foot);

  const go=document.createElement('button');go.type='button';go.className='primary';go.textContent='用这个画质开始';foot.append(go);
  const paint=()=>{for(const card of list.querySelectorAll('.cxx-pack-card'))card.dataset.selected=String(card.dataset.quality===selected);go.textContent='用'+qualityLabel(selected)+'开始';};
  const finish=key=>{try{dialog.close();}catch{}dialog.remove();resolve(key);};
  go.onclick=()=>finish(selected);
  dialog.addEventListener('cancel',event=>event.preventDefault());
  paint();document.body.append(dialog);
  try{dialog.showModal();}catch{dialog.remove();const text=packs.map(pack=>qualityLabel(pack.key)+'：'+formatBytes(pack.bytes)).join('\n');finish(window.confirm('选择本机画质\n\n'+text+'\n\n确定使用原画质吗？取消则使用标准画质。')?'original':'standard');}
 });
}
