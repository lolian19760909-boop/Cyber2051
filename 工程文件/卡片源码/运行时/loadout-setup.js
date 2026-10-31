(function(root,factory){const local=typeof module==='object'&&module.exports;const api=factory(local?require('./loadout.js'):root.CxxLoadout,local?require('./player-art.js'):root.CxxPlayerArt);if(local)module.exports=api;else root.CxxLoadoutSetup=api;})(globalThis,function(L,A){
  'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
  function rows(origin,value){return origin==='custom'?value.items:[...(L.kits[origin]||[]).map(([template,tier])=>({template,tier,quantity:1,status:'installed'})),...(value.weapon?[{template:value.weapon,tier:1,quantity:1,status:'equipped'}]:[])];}
  function detail(row){const d=L.definition(row),description=L.playerDescription(d).trim(),effects=d.numericEffects.length?d.numericEffects.map(L.model.describe):[L.describe(d)];return {row,d,part:L.parts[d.part]||L.clothing[d.part]||(d.category==='weapon'?'起步武器':'物品'),description:[...new Set([description,...effects].filter(Boolean))].join('；'),stats:d.numericEffects.filter(e=>e.kind!=='ability').map(e=>({name:L.model.labels[e.kind]+(e.when?'（'+L.model.conditionText(e.when)+'时）':''),value:L.model.percent.has(e.kind)?+(e.value*100).toFixed(4)+'%':String(e.value)}))};}
  function mount({document:doc,parent,origin,initial,onChange,onSelect}){
    let value=L.normalizeSetup(origin,initial);const root=doc.createElement('section');root.className='loadout-setup';
    function el(tag,text,parent=root){const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;parent.append(n);return n;}
    function button(text,fn,parent=root){const b=el('button',text,parent);b.type='button';b.onclick=fn;return b;}
    function select(label,rows,parent=root){const l=el('label',label,parent),s=el('select',undefined,l);s.setAttribute('aria-label',label.replace(/^▾ /,''));for(const [v,n]of rows){const o=el('option',n,s);o.value=v;}return s;}
    const style=el('style');style.textContent=globalThis.CxxLoadoutSetupStyle||'';
    const list=el('div');list.className='loadout-list';const note=el('p');note.className='loadout-note';note.setAttribute('role','status');
    let selectedKey='',selected=null;
    function publish(){onChange?.(structuredClone(value));}
    function paint(){list.replaceChildren();const items=rows(origin,value).map((row,i)=>({...detail(row),key:(row.id||row.template||row.name)+':'+i}));if(!items.some(item=>item.key===selectedKey))selectedKey=items.reduce((best,item)=>!best||item.d.tier>best.d.tier?item:best,null)?.key||'';selected=items.find(item=>item.key===selectedKey)||null;
      items.forEach((item,i)=>{const {d,row}=item,wrap=el('article',undefined,list),card=button('',()=>{selectedKey=item.key;selected=item;for(const b of list.querySelectorAll('.loadout-tile'))b.setAttribute('aria-pressed',String(b===card));if(onSelect)onSelect(item);},wrap);card.className='loadout-tile';card.style.setProperty('--loadout-grade','var(--cxx-grade-'+d.tier+')');card.setAttribute('aria-pressed',String(item===selected));card.setAttribute('aria-label',d.name+'，'+item.part+'，'+L.grades[d.tier-1]+'，数量 '+row.quantity+'。'+item.description);const image=el('div',undefined,card);image.className='loadout-asset';image.innerHTML=A.icon(d,{assets:row.artUpload?{[row.artUpload.id]:row.artUpload}:{}});el('strong',d.name,card);el('small',item.part+' · '+L.grades[d.tier-1],card);if(origin==='custom'){const remove=button('移除',()=>{value.items.splice(i,1);paint();publish();},wrap);remove.className='loadout-remove';remove.setAttribute('aria-label','移除'+d.name);}});if(!items.length)el('p','尚未添加初始物品。可以空手开局，也可以从下方添加。',list);if(onSelect)onSelect(selected);}
    if(origin!=='custom'){
      el('p','这些义体在开局前已经安装。选择一件一阶起步武器，或暂不携带。');
      const weapon=select('▾ 起步武器',[['','暂不携带'],...L.starterWeapons.map(id=>[id,L.templates[id].name])]);weapon.value=value.weapon;weapon.onchange=()=>{value.weapon=weapon.value;paint();publish();};
    }else{
      const form=el('div');form.className='loadout-form';const searchLabel=el('label','搜索目录',form),search=el('input',undefined,searchLabel);search.placeholder='武器、义体或衣物名称';searchLabel.className='loadout-wide';
      const allTemplates={...L.templates,...Object.fromEntries(L.official.items.map(d=>[d.id,d]))};const type=select('基础类型',Object.values(allTemplates).map(t=>[t.id,t.name+' · '+(L.parts[t.part]||L.clothing[t.part]||'武器')]),form);
      const tier=select('品阶',L.grades.map((n,i)=>[String(i+1),n]),form);
      const nameLabel=el('label','名称（可改为自己的物品）',form),name=el('input',undefined,nameLabel);name.maxLength=80;
      const qtyLabel=el('label','数量',form),qty=el('input',undefined,qtyLabel);qty.type='number';qty.min='1';qty.step='1';qty.value='1';
      const status=select('初始状态（选装一件，其余留背包）',[['inventory','放在背包'],['equipped','已经装备'],['installed','已经安装']],form);
      const descriptionLabel=el('label','描述／特殊来历',form),description=el('textarea',undefined,descriptionLabel);description.maxLength=2000;descriptionLabel.className='loadout-wide';
      const preview=el('p',undefined,form);preview.className='loadout-wide';
      function update(reset=false){const t=allTemplates[type.value];if(!t)return;if(reset){name.value=t.name;description.value=t.ability;}for(const option of status.options)option.disabled=option.value==='installed'?t.category!=='cyberware':option.value==='equipped'?!['weapon','clothing'].includes(t.category):false;if(status.selectedOptions[0]?.disabled)status.value='inventory';try{preview.textContent='实际效果：'+L.describe(L.definition({template:type.value,tier:Number(tier.value)}));}catch(e){preview.textContent=e.message;}}
      type.onchange=()=>update(true);tier.onchange=()=>update();search.oninput=()=>{for(const o of type.options)o.hidden=!o.textContent.toLowerCase().includes(search.value.trim().toLowerCase());const first=[...type.options].find(o=>!o.hidden);if(first&&type.selectedOptions[0]?.hidden){type.value=first.value;update(true);}};
      button('加入初始清单',()=>{try{const row={template:type.value,tier:Number(tier.value),name:name.value,description:description.value,quantity:Number(qty.value),status:status.value};value=L.normalizeSetup('custom',{items:[...value.items,row]});paint();publish();note.textContent='已添加；确认开局后才写入实际存档。';}catch(e){note.textContent=e.message;}},form);update(true);
    }
    let editor=null;if(origin==='custom'&&globalThis.CxxItemEditor)editor=globalThis.CxxItemEditor.mount({document:doc,parent:root,opening:true,onConfirm:row=>{value=L.normalizeSetup('custom',{items:[...value.items,{...row,id:'custom_'+L.hash(JSON.stringify(row)+Date.now())}]});paint();publish();}});paint();parent.append(root);return {value:()=>structuredClone(value),selected:()=>selected,destroy:()=>{editor?.destroy();root.remove();}};
  }
  return {mount,rows,detail};
});
