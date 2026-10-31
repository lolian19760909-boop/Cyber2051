'use strict';
window.CxxContractForm = function (container) {
  const W=window.CxxSubmissionTemplate,inputs=new Map(),drafts=new Map();
  let schema,kind='contract',renderedKind=null,media=[],mediaRows=[],keywordsEdited=false;
  const L=(zh,en,ja)=>{const lang=window.CXXI18N?.current()||'zh';return lang==='en'?en:lang==='ja'?ja:zh;};
  const label=f=>L(...f.label);
  function field(name,e,text,required=false,target=container) {
    const l=document.createElement('label');l.className='fld';l.htmlFor='guided-'+name;
    l.textContent=text+L(required?'（必填）':'（选填）',required?' (required)':' (optional)',required?'（必須）':'（任意）');
    e.id=l.htmlFor;e.required=required;target.append(l,e);inputs.set(name,e);return e;
  }
  function select(name,text,values) {
    const e=document.createElement('select');
    for(const x of values){const o=document.createElement('option');o.value=typeof x==='string'?x:x.id;o.textContent=typeof x==='string'?x:x.name+(x.district?' · '+x.district:'');e.append(o);}
    return field(name,e,text,true);
  }
  function updatePlaces(){const e=inputs.get('placeId');e.replaceChildren();for(const place of schema.maps.find(m=>m.id===inputs.get('mapId').value)?.places||[]){const o=document.createElement('option');o.value=place.id;o.textContent=place.name+' · '+place.district;e.append(o);}}
  function capture(){
    if(!renderedKind||!inputs.size)return;
    const values=Object.fromEntries([...inputs].map(([k,e])=>[k,e.value]));
    values.prerequisites=[...container.querySelectorAll('#guided-prerequisites input:checked')].map(e=>e.value);
    values.media=mediaRows.map(row=>Object.fromEntries(Object.entries(row).map(([k,e])=>[k,e.value])));
    values.keywordsEdited=keywordsEdited;drafts.set(renderedKind,values);
  }
  function suggestKeywords(){
    const e=inputs.get('keywords');if(!e||keywordsEdited)return;
    e.value=inputs.get(kind==='npc'?'name':'identity')?.value.trim()||'';
  }
  function renderMedia(target){
    const block=document.createElement('div'),hint=document.createElement('p'),add=document.createElement('button');
    hint.className='hint';hint.textContent=L('图片资料选填。新图可作为附件提交供审核；这里只登记已经存在的本站图片，不会自动上传。','Images are optional. Attach new artwork for review; registered images must already exist on this site.','画像は任意です。新しい画像は添付で審査に提出できます。登録欄は既存の当サイト画像用です。');target.append(hint,block,add);
    add.type='button';add.className='btn sm ghost';add.textContent=L('添加已有图片','Add existing image','既存の画像を追加');
    function row(data={}){
      const wrap=document.createElement('fieldset'),record={};wrap.className='submission-media';
      for(const [key,text,max]of [['id',L('图片编号','Image ID','画像ID'),128],['url',L('本站图片地址','Site image URL','当サイト画像URL'),2000],['alt',L('图片说明','Image description','画像の説明'),120]]){const l=document.createElement('label'),e=document.createElement('input');l.textContent=text;e.value=data[key]||'';e.maxLength=max;e.required=true;l.append(e);wrap.append(l);record[key]=e;}
      const remove=document.createElement('button');remove.type='button';remove.className='btn sm ghost';remove.textContent=L('移除该图片资料','Remove image reference','画像登録を削除');remove.addEventListener('click',()=>{mediaRows=mediaRows.filter(x=>x!==record);wrap.remove();add.disabled=false;});wrap.append(remove);block.append(wrap);mediaRows.push(record);add.disabled=mediaRows.length>=12;
    }
    for(const m of media)row(m);add.addEventListener('click',()=>{if(mediaRows.length<12)row();});
  }
  function render(){
    if(!schema)return;capture();const saved=drafts.get(kind);container.replaceChildren();inputs.clear();mediaRows=[];media=saved?.media||[];keywordsEdited=saved?.keywordsEdited||false;renderedKind=kind;
    const form=schema.templates.find(t=>t.id===kind&&t.enabled);
    if(!form){const p=document.createElement('p');p.className='hint';p.textContent=L('该类别暂停新建和改投。原稿可查看、导出或撤回。','This category is paused. Existing posts can be read, exported or withdrawn.','この種類の新規投稿・改稿は停止中です。既存稿は閲覧・書き出し・取下げができます。');container.append(p);return;}
    const hint=document.createElement('p');hint.className='hint';hint.textContent=L('按栏目写清楚实际内容，不必凑字数。选填栏可以留空；示例仅示范写法，不是正式设定。','Write concrete details; there is no minimum word count. Optional fields may be blank. Chinese examples demonstrate writing only, not canon.','具体的に記入してください。最低文字数はありません。任意欄は空欄可。中国語の記入例は正式設定ではありません。');container.append(hint);
    const map=select('mapId',L('地图','Map','地図'),schema.maps);select('placeId',L('适用地点','Location','場所'),[]);map.addEventListener('change',updatePlaces);updatePlaces();
    if(kind==='contract') {
      select('type',L('任务类型','Quest type','任務の種類'),schema.taskTypes);select('difficulty',L('难度','Difficulty','難易度'),schema.difficulties);
      const e=field('pay',document.createElement('input'),L('报酬（日元）','Reward (JPY)','報酬（円）'),true);e.type='number';e.min='0';e.max=String(schema.limits.pay);e.step='1';
    }
    const more=document.createElement('details'),title=document.createElement('summary');more.className='form-options';title.textContent=L('3 · 扩展内容（选填）','3 · Additional details (optional)','3 · 補足（任意）');more.append(title);
    for(const f of form.writingFields){
      const target=f.required?container:more,e=field(f.name,document.createElement(f.input),label(f),f.required,target);e.maxLength=f.max;e.placeholder=f.example;if(f.input==='textarea')e.rows=f.name==='opening'?7:3;
      const help=document.createElement('p');help.className='hint';help.id=e.id+'-help';help.textContent=f.help+' '+L('建议：','Suggested: ','目安：')+f.suggested+' '+L('示例：','Example: ','例：')+f.example;e.setAttribute('aria-describedby',help.id);target.append(help);
      if(f.name===(kind==='npc'?'name':'identity'))e.addEventListener('input',suggestKeywords);
    }
    if(kind==='contract'){
      const p=document.createElement('p');p.className='fld';p.textContent=L('已完成的前置任务（选填）','Completed prerequisites (optional)','前提任務（任意・完了済み）');more.append(p);
      const list=document.createElement('div');list.id='guided-prerequisites';more.append(list);
      for(const id of schema.prerequisites){const l=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=id;l.append(box,' '+id);list.append(l);}
    }else{
      const keys=field('keywords',document.createElement('input'),L('触发关键词（逗号分隔，1—8个）','Keywords (1–8, comma separated)','キーワード（1～8個、カンマ区切り）'),true);keys.maxLength=500;keys.addEventListener('input',()=>{keywordsEdited=true;});
      if(kind==='npc')renderMedia(more);
    }
    container.append(more);
    if(saved){if(saved.mapId){inputs.get('mapId').value=saved.mapId;updatePlaces();}for(const [k,e]of inputs)if(k!=='mapId'&&saved[k]!==undefined)e.value=saved[k];for(const box of container.querySelectorAll('#guided-prerequisites input'))box.checked=(saved.prerequisites||[]).includes(box.value);}
    suggestKeywords();
  }
  const ready=fetch('/api/workshop/contracts/schema',{cache:'no-store',credentials:'omit'}).then(async r=>{const j=await r.json();if(!r.ok||!j.ok)throw Error(L('模板读取失败，请刷新重试。','Could not load templates. Refresh to retry.','テンプレートの取得に失敗しました。'));schema=j.schema;render();return schema;}).catch(e=>{container.textContent=e.message;throw e;});ready.catch(()=>{});
  document.addEventListener?.('cxx-lang-changed',render);
  return {ready,setKind(next){kind=next;render();},
    read({validate=true}={}){
      const form=schema?.templates.find(t=>t.id===kind);if(!form)throw Error(L('该模板未开放。','This template is unavailable.','このテンプレートは利用できません。'));
      capture();const values=drafts.get(kind),sections={};
      for(const f of form.writingFields){const e=inputs.get(f.name);if(validate&&!e.reportValidity())throw Error(L('请检查：','Please check: ','確認：')+label(f));if(e.value.trim())sections[f.name]=e.value.trim();}
      for(const k of ['mapId','placeId',...(kind==='contract'?['type','difficulty','pay']:['keywords'])])if(validate&&!inputs.get(k).reportValidity())throw Error(L('请检查地点、报酬与关键词。','Check location, reward and keywords.','場所・報酬・キーワードを確認してください。'));
      const p={format:form.format,templateVersion:schema.templateVersion,templateKind:kind,sections};
      if(kind==='contract')p.contract={mapId:values.mapId,placeId:values.placeId,type:values.type,difficulty:values.difficulty,pay:values.pay===''?null:Number(values.pay),prerequisites:values.prerequisites};
      else Object.assign(p,{mapId:values.mapId,placeId:values.placeId,keywords:values.keywords.split(/[,，]/).map(s=>s.trim()).filter(Boolean)},values.media.length?{media:values.media}:{});
      return p;
    },
    fill(payload){
      const form=schema.templates.find(t=>t.id===kind);if(!form)return;
      const p=W.upgradeLegacy(form.type,payload),source=p.contract||p;
      capture();drafts.set(kind,{...source,...p.sections,keywords:(p.keywords||[]).join(','),prerequisites:source.prerequisites||[],media:p.media||[],keywordsEdited:Boolean(p.keywords?.length)});renderedKind=null;render();
    },
    reset(){drafts.clear();inputs.clear();renderedKind=null;render();},
  };
};
