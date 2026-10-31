/** Common reading controls reuse the existing per-story preferences and Gal font key. */
export function mountPlayControls({parent,preferences,openGal,openNative,openReading,save,stories,temporary}){
  parent.replaceChildren();
  const n=(tag,text,where=parent)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;where.append(el);return el;};
  const action=(text,fn)=>{const b=n('button',text);b.type='button';b.onclick=fn;return b;};
  n('h3','阅读方式');action('GAL 对话',openGal);action('正文阅读',openNative);
  function range(label,min,max,step,value,changed){const wrap=n('label',label),input=n('input',null,wrap),out=n('output',String(value),wrap);input.type='range';Object.assign(input,{min,max,step,value});input.oninput=()=>{out.textContent=input.value;changed(Number(input.value));};}
  n('h3','文字与画面');
  const sync=()=>{const value=preferences.read();document.body.style.setProperty('--cxx-native-font-size',(value.nativeFont||20)+'px');document.body.style.setProperty('--cxx-native-line-height',String(value.nativeLineHeight||1.9));};
  range('正文字号',14,32,1,preferences.read().nativeFont||20,value=>{preferences.set({nativeFont:value});sync();});
  range('正文行距',1.4,2.4,.1,preferences.read().nativeLineHeight||1.9,value=>{preferences.set({nativeLineHeight:value});sync();});
  range('GAL 字号',14,30,1,Number(localStorage.getItem('cxx-gal-dialogue-font-v1'))||18,value=>{localStorage.setItem('cxx-gal-dialogue-font-v1',String(value));window.dispatchEvent(new CustomEvent('cxx-web-gal-font',{detail:value}));});
  const effectsLabel=n('label','画面效果 '),effects=n('select',null,effectsLabel);for(const [id,title]of [['low','轻量'],['medium','标准'],['high','完整']]){const option=n('option',title,effects);option.value=id;}effects.value=preferences.read().level;effects.onchange=()=>preferences.set({level:effects.value});
  n('h3','声音与翻译');action('翻译、朗读与声音设置',openReading);
  n('h3','进度');action('建立存档点',save);action('故事与存档',stories);let transferNote=null;const transferChanged=event=>{const value=event.detail;if(transferNote)transferNote.textContent=value.phase==='failed'?'本机进度已保存；临时上传未完成：'+value.error:value.phase==='ready'?'临时档已更新，到期时间：'+new Date(value.save.expiresAt).toLocaleString('zh-CN'):['packing','uploading','pending'].includes(value.phase)?'本机已保存，正在更新临时档…':'';};if(temporary){action('跨设备续玩',temporary);transferNote=n('p','');transferNote.setAttribute('role','status');window.addEventListener('cxx-temporary-save-changed',transferChanged);}sync();
  return {destroy(){window.removeEventListener('cxx-temporary-save-changed',transferChanged);parent.replaceChildren();document.body.style.removeProperty('--cxx-native-font-size');document.body.style.removeProperty('--cxx-native-line-height');delete document.body.dataset.nativePortraits;}};
}
