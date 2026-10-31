/* Derived from 卡片源码/运行时/creator-ui.js; source SHA256 304a8bb81d5377d57a2fdf4864e8fe6d2d48b293519db0d1aa620e7198a5ac29. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxCreatorUI=api;})(globalThis,function(global){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 function collectGenerators(){const gen=root.CxxWebModels?.creator;return typeof gen==="function"?[gen]:[];}
 function resolveGenerator(start){return collectGenerators(start)[0]||null;}
 function mount({document:doc,parent,profile,custom='',origin='street',originText='',avatar='',resolvePortrait=()=>'',css='',appearance=global.CxxAppearance,art=global.CxxItemArt,onChange=()=>{},onError=()=>{},viewState={}}){
  const win=doc.defaultView;let p=structuredClone(profile),background=custom,disposed=false,uploadEpoch=0,group=viewState.group||'basic',fullImage=null;
  const controls=[],node=(tag,cls,text,container)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;container?.append(el);return el;};
  const host=node('section','cxx-creator',undefined,parent),style=node('style','',css,host);
  host.setAttribute('aria-label','捏人与背景补充');
  const button=(label,action,container,cls='')=>{const b=node('button',cls,label,container);b.type='button';b.onclick=()=>{try{Promise.resolve(action()).catch(onError);}catch(e){onError(e);}};return b;};
  const head=node('header','creator-heading',undefined,host);node('small','','PERSONAL DATABASE / 02',head);node('h2','','定义你的模样',head);node('p','','在东京都，留下属于你的面孔。',head);
  const grid=node('div','creator-grid',undefined,host),visual=node('section','creator-visual',undefined,grid);
  const previewToggle=button('展开人物预览',()=>{const open=visual.dataset.expanded!=='true';visual.dataset.expanded=String(open);previewToggle.setAttribute('aria-expanded',String(open));previewToggle.textContent=open?'收起人物预览':'展开人物预览';},visual,'creator-preview-toggle');previewToggle.setAttribute('aria-expanded','false');
  const stage=node('div','creator-stage',undefined,visual),image=node('img','creator-portrait',undefined,stage);image.alt='本故事人物立绘';const empty=node('p','creator-empty','尚未选择人物图片',stage);
  image.addEventListener('error',()=>{image.hidden=true;empty.hidden=false;empty.textContent='人物图片未能载入，可重新选择立绘。';});image.addEventListener('load',()=>{image.hidden=false;empty.hidden=true;});
  node('span','creator-stage-mark','PERSONAL RECORD',stage);const portraitCaption=node('div','creator-portrait-caption',undefined,stage),portraitName=node('strong','','',portraitCaption);node('small','','TOKYO / 2051',portraitCaption);
  const imageTools=node('div','creator-image-tools',undefined,visual),upload=node('input','',undefined,imageTools);upload.type='file';upload.accept='image/png,image/jpeg,image/webp';upload.hidden=true;upload.setAttribute('aria-label','上传人物立绘');
  const uploadButton=button('上传立绘',()=>upload.click(),imageTools),fit=button('填满画面',()=>{const cover=image.dataset.fit!=='cover';image.dataset.fit=cover?'cover':'contain';fit.textContent=cover?'适应画面':'填满画面';},imageTools);
  button('查看原图',()=>{if(!image.getAttribute('src'))return;fullImage?.remove();fullImage=node('dialog','creator-image-dialog',undefined,host);button('关闭原图',()=>{fullImage.close();fullImage.remove();fullImage=null;},fullImage);const large=node('img','',undefined,fullImage);large.src=image.src;large.alt='人物图片原始比例';fullImage.addEventListener('cancel',()=>{fullImage.remove();fullImage=null;});fullImage.showModal();},imageTools);
  button('使用当前头像',()=>{delete p.portrait;delete p.portraitUpload;emit();},imageTools);
  upload.onchange=async()=>{const file=upload.files?.[0];if(!file)return;const epoch=++uploadEpoch;uploadButton.disabled=true;try{const a=await art.upload(file,doc,{purpose:'portrait'});if(disposed||epoch!==uploadEpoch)return;p.portrait={schema:1,kind:'asset',id:a.id};p.portraitUpload=a;emit();}catch(e){onError(e);}finally{if(!disposed){uploadButton.disabled=false;upload.value='';}}};
  const file=node('details','creator-file',undefined,visual);node('summary','','人物文字档案',file);const summary=node('p','creator-summary','',file);
  const panel=node('section','creator-controls',undefined,grid),tabs=node('nav','creator-tabs',undefined,panel);tabs.setAttribute('aria-label','人物设定分类');const scroll=node('div','creator-parameters',undefined,panel),sections=new Map(),tabButtons=new Map();
  function select(id){group=id;for(const [key,section]of sections)section.hidden=key!==id;for(const [key,b]of tabButtons)b.setAttribute('aria-pressed',String(key===id));scroll.scrollTop=0;}
  for(const [id,label]of appearance.groups){tabButtons.set(id,button(label,()=>select(id),tabs));sections.set(id,node('section','creator-section',undefined,scroll));}
  function emit(){onChange({profile:structuredClone(p),custom:background});refreshSummary();}
  function value(id){return p.appearanceTraits?.values?.[id]||'';}
  function trait(id,v){p.appearanceTraits={...p.appearanceTraits,schema:1,values:{...p.appearanceTraits?.values,[id]:v}};emit();}
  let aiBusy=false;
  const digest=()=>[p.name&&('姓名：'+p.name),p.gender&&('性别：'+p.gender),p.age&&('年龄：'+p.age),p.address&&('称谓：'+p.address),originText&&('出身：'+originText),appearance.describe(p.appearanceTraits),p.appearance&&('外貌补充：'+p.appearance),p.clothing&&('服装：'+p.clothing),p.personality&&('性格：'+p.personality),p.history&&('经历：'+p.history),p.additional&&('补充：'+p.additional)].filter(Boolean).join('\n');
  function textField(key,label,multiline=false,target=sections.get('basic'),hint='',optional=false,ai=''){
   const row=node('div','creator-text-field',undefined,target),wrap=node('label','',undefined,row);node('span','',label,wrap);const input=node(multiline?'textarea':'input','',undefined,wrap),read=()=>key==='custom'?background:p[key]||'';input.value=read();input.setAttribute('aria-label',label);input.dataset.creatorField=key;input.placeholder=optional?'无（留空）；'+hint:hint||'可留空';if(!multiline)input.maxLength=80;
   const change=value=>{if(key==='custom')background=value;else p[key]=value;emit();};input.oninput=()=>change(input.value);const clear=optional?button('无（留空）',()=>{input.value='';change('');},row,'creator-clear-field'):null;clear?.setAttribute('aria-label','将'+label+'设为无（留空）');
   if(ai){const bar=node('div','creator-ai'),aiButton=button('AI 帮写',()=>void request(label,ai),bar,'creator-ai-button'),aiState=node('span','creator-ai-state','',bar);if(clear)row.appendChild(clear);row.appendChild(bar);clear?.setAttribute('aria-pressed',String(!read().trim()));
    async function request(name,prompt){
    if(aiBusy)return;
    const gens=collectGenerators(win);
    if(!gens.length){aiState.textContent='当前环境没有可用的生成接口：需要酒馆助手（JS-Slash-Runner）就绪；仍不行请刷新酒馆页面再试。';return;}
    aiBusy=true;aiButton.disabled=true;aiButton.setAttribute('aria-busy','true');aiState.textContent='正在让 AI 起草…';
    try{
     const payload={should_silence:true,ordered_prompts:[{role:'system',content:'你是《东京都 2051》的人物设定助手。只输出可以直接采用的简体中文正文，不要标题、不要解释、不要引号，180 字以内。'},{role:'user',content:'【已有设定】\n'+(digest()||'（尚未填写）')+'\n\n【需要写】'+name+'：'+prompt}]};
     let text='',last=null;
     for(const gen of gens){
      try{const draft=String(await gen(payload)||'').trim();if(draft){text=draft;break;}}catch(e){last=e;}
     }
     if(!text)throw last||Error('生成结果为空。');
     input.value=text;change(text);aiState.textContent='已生成草稿，可直接修改。';
    }catch(e){aiState.textContent='生成失败：'+((e&&e.message)||e)+'。可稍后重试。';}
    finally{aiBusy=false;aiButton.disabled=false;aiButton.removeAttribute('aria-busy');}
   }
   }
   controls.push({input,read,sync:()=>clear?.setAttribute('aria-pressed',String(!read().trim()))});return input;
  }
  textField('name','姓名',false,sections.get('basic'),'填写人物姓名');
  const genderRow=node('label','creator-text-field creator-gender',undefined,sections.get('basic'));node('span','','性别',genderRow);const gender=node('select','',undefined,genderRow);gender.setAttribute('aria-label','性别');gender.dataset.creatorField='gender';
  for(const [value,label]of [['','无（留空）'],['男','男'],['女','女'],['custom','自定义']]){const option=node('option','',label,gender);option.value=value;}
  const genderText=node('input','',undefined,genderRow);genderText.maxLength=80;genderText.setAttribute('aria-label','自定义性别');genderText.placeholder='填写自定义性别，也可以留空';let genderCustom=!!p.gender&&!['男','女'].includes(p.gender);
  const genderMode=()=>genderCustom||p.gender&&!['男','女'].includes(p.gender)?'custom':p.gender||'';
  controls.push({input:gender,read:genderMode,sync:()=>{genderText.hidden=genderMode()!=='custom';}},{input:genderText,read:()=>p.gender||''});
  gender.onchange=()=>{genderCustom=gender.value==='custom';if(!genderCustom)p.gender=gender.value;else if(['男','女'].includes(p.gender))p.gender='';emit();update(p,background);if(genderCustom)genderText.focus();};genderText.oninput=()=>{p.gender=genderText.value;emit();};
  for(const [key,label,hint]of [['address','称谓','如：我、前辈、同学'],['age','年龄','自定或留空']])textField(key,label,false,sections.get('basic'),hint);
  const traitRows=[],visibleTrait=f=>{const s=f.showIf;if(!s)return true;const cur=value(s.field);if(!cur)return false;if(s.except&&s.except.includes(cur))return false;return s.when==='*'?true:Array.isArray(s.when)?s.when.includes(cur):cur===s.when;};
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),nearestName=hex=>{const [r,g,b]=rgb(/^#[0-9a-f]{6}$/i.test(hex)?hex:'#000000');let best='',score=Infinity;for(const [name,code] of Object.entries(appearance.colors)){const [nr,ng,nb]=rgb(code),d=(r-nr)**2+(g-ng)**2+(b-nb)**2;if(d<score){score=d;best=name;}}return best;};
  for(const f of appearance.fields){const row=node('div','creator-trait',undefined,sections.get(f.group)),label=node('span','creator-trait-label',f.label,row),line=node('div','creator-choice',undefined,row),options=['',...f.options],unit=f.measure?f.measure.unit:'';
   const shown=raw=>{const text=(raw||'').trim();if(!text)return '无（留空）';if(unit&&/^\d+(?:\.\d+)?$/.test(text))return text+' '+unit;return text;};
   const write=v=>{trait(f.id,v);input.value=v;syncTraitVisibility();};
   const step=delta=>{if(f.measure){const now=Number(String(value(f.id)).replace(/[^\d.]/g,''))||0,next=Math.min(f.measure.max,Math.max(f.measure.min,(now||Math.round((f.measure.min+f.measure.max)/2))+delta*f.measure.step));write(String(next));return;}let i=options.indexOf(value(f.id));i=(Math.max(0,i)+delta+options.length)%options.length;write(options[i]);};
   const minus=button('‹',()=>step(-1),line,'creator-arrow');minus.setAttribute('aria-label','上一项'+f.label);
   const input=node('input','creator-trait-value',undefined,line);input.value=value(f.id);input.setAttribute('aria-label',f.label);
   if(f.measure){input.type='number';input.min=String(f.measure.min);input.max=String(f.measure.max);input.step=String(f.measure.step);input.placeholder='自己填，例如 '+Math.round((f.measure.min+f.measure.max)/2);input.oninput=()=>{trait(f.id,input.value);syncTraitVisibility();};}else{input.placeholder='无（留空）';input.maxLength=500;input.oninput=()=>{trait(f.id,input.value);syncTraitVisibility();};}
   if(unit)node('span','creator-unit',unit,line);
   controls.push({input,read:()=>value(f.id)});
   const plus=button('›',()=>step(1),line,'creator-arrow');plus.setAttribute('aria-label','下一项'+f.label);
   const optionsBox=node('details','creator-options',undefined,row);node('summary','',f.color?'色彩 / 自定义':f.measure?'快捷数值 / 自定义':'选择 / 自定义',optionsBox);const choices=node('div','creator-presets',undefined,optionsBox);
   if(f.color){const pick=node('label','creator-color-pick',undefined,choices);node('span','','调色盘',pick);const picker=node('input',undefined,undefined,pick);picker.type='color';picker.value=appearance.colors[value(f.id)]||'#8a6a8f';picker.setAttribute('aria-label',f.label+'调色盘');picker.oninput=()=>{const name=nearestName(picker.value),desc=name+'（'+picker.value.toUpperCase()+'）';write(desc);};const empty=button('清除发色色值',()=>write(''),pick,'creator-color-clear');empty.type='button';}
   for(const option of options){const b=button(option?(unit?option+' '+unit:option):'无（留空）',()=>{write(option);optionsBox.open=false;},choices);if(appearance.colors[option])b.style.setProperty('--swatch',appearance.colors[option]);}
   traitRows.push({field:f,row,input,shown,sync:()=>{const v=value(f.id);if(doc.activeElement!==input)input.value=v;row.hidden=!visibleTrait(f);}});
  }
  function syncTraitVisibility(){for(const t of traitRows)t.sync();}
  syncTraitVisibility();
  const bg=sections.get('background');if(origin==='custom')textField('custom','自定义出身背景',true,bg,'你从哪里来，曾经做过什么，如今为何来到这里……',true,'用两三句话写清来历：成长的地方、做过什么营生、为什么来到东京都。');else node('p','creator-origin',originText,bg);
  for(const [id,label,hint,ai]of [['appearance','外貌自由补充','补充未列出的体征与气质','写一两句整体气质与辨识度，例如走路的姿态、说话时的表情、让人一眼记住的细节。'],['clothing','服装','日常衣着、配饰与风格','写清日常穿什么、什么材质、有什么配饰或义体改装痕迹，符合赛博东京都的街头与公司区两种场合。'],['personality','性格','和别人相处时的方式','写清性格与相处方式，包含一个矛盾点和一个软肋，不要写形容词堆砌。'],['history','经历','来到东京都之前的生活','写一段过去的经历，包含一次失去或一次欠下人情，用具体事件而不是概括语。'],['additional','补充设定','这个故事需要的其他设定','补充其他有必要让故事知道的设定，例如人际关系、习惯、忌讳。']])textField(id,label,true,bg,hint,true,ai);
  const profileAPI=global.CxxStoryProfile||win.CxxStoryProfile,hostText=profileAPI?.hostPersona(win);if(hostText){const legacy=node('details','creator-import',undefined,bg);node('summary','','酒馆当前人物资料',legacy);node('p','',hostText,legacy);button('复制到补充设定',()=>{p=profileAPI.importPersona(p,hostText);update(p,background);emit();},legacy);}

  function refreshSummary(){portraitName.textContent=p.name||'你的名字';summary.textContent=[p.name,appearance.describe(p.appearanceTraits),p.appearance,p.clothing&&'服装：'+p.clothing].filter(Boolean).join('\n')||'选择体征后，人物描述会显示在这里。';const src=p.portraitUpload?.src||resolvePortrait(p.portrait)||avatar;image.hidden=!src;empty.hidden=!!src;if(src&&image.getAttribute('src')!==src)image.src=src;}
  function update(next,nextCustom=background){p=structuredClone(next);background=nextCustom;for(const c of controls){if(doc.activeElement!==c.input)c.input.value=c.read();c.sync?.();}syncTraitVisibility();refreshSummary();}
  function focusField(key){const control=controls.find(c=>c.input.dataset.creatorField===key);if(!control)return null;const section=control.input.closest('.creator-section');select([...sections].find(([,el])=>el===section)?.[0]||'basic');control.input.focus({preventScroll:true});control.input.scrollIntoView({block:'center',inline:'nearest'});return control.input;}
  select(group);update(p,background);
  return {element:host,update,focusField,setAvatar(src){avatar=src;refreshSummary();},view:()=>({group}),destroy(){disposed=true;uploadEpoch++;fullImage?.close();host.remove();}};
 }
 return {mount,resolveGenerator,collectGenerators};
});
