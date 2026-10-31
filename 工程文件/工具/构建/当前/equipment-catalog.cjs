'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../../..'),original=require('../../../卡片源码/装备/目录原始资料.json'),copy=require('../../../卡片源码/装备/中文文案.json');
function signature(value){let a=2166136261,b=5381;for(const c of String(value)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return String(value).length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);}
function build(){
 const records={},items=original.items.map(old=>{const text=copy.items[old.id];assert(text?.name&&text.ability,old.id);const {source,adaptation,originalAbility,...item}=old;records[old.id]={aliases:signature(JSON.stringify(old.aliases)),name:signature(old.name),ability:signature(old.ability),description:signature(old.ability+' '+old.adaptation),adaptation:signature(old.adaptation)};return {...item,name:text.name,ability:text.ability,...(text.manufacturer?{manufacturer:text.manufacturer}:{}),aliases:[...new Set([old.name,...old.aliases,...(text.aliases||[]),text.name].map(value=>text.manufacturer?value.replace(/Kang[ -]?Tao|康陶/gi,text.manufacturer):value))]};});
 assert.equal(items.length,304);const data={schema:original.schema,version:original.version,textVersion:copy.version,items};
 const output=`/* Generated from 装备/目录原始资料.json and 装备/中文文案.json by equipment-catalog.cjs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxItemCatalog=api;})(globalThis,function(){
 'use strict';
 const data=${JSON.stringify(data)},legacy=${JSON.stringify(records)};
 ${signature.toString()}
 const index=new Map();for(const item of data.items)for(const name of [item.id,item.name,...item.aliases])if(!index.has(name.toLowerCase()))index.set(name.toLowerCase(),item);
 function find(id){return index.get(String(id||'').toLowerCase())||null;}
 function definition(id,tier){const d=find(id);if(!d)throw Error('正式目录无此型号。');tier=tier??d.tier;if(!Number.isInteger(tier)||tier<1||tier>5)throw Error('品阶为1至5。');const key=d.id+'_t'+tier,effects=d.numericEffects.map(e=>({...e,value:e.kind==='powerFlat'?[8,12,18,26,36][tier-1]:['defense','hpMax','restoreHp','restoreStamina','damage'].includes(e.kind)?e.value*(1+(tier-1)*.35):e.value}));return {...structuredClone(d),id:key,template:d.id,tier,description:d.ability,weapon:d.category==='weapon'||d.part==='arms',numericEffects:[...effects,{kind:'ability',text:d.ability}],load:d.category==='cyberware'?tier*2:0,definitionRef:{packageId:'cxx_official_items',version:data.version,kind:'items',id:key}};}
 function translate(saved){const key=saved?.template||saved?.id?.replace(/_t[1-5]$/,''),d=find(key),old=legacy[key];if(!d||!old||saved.custom||saved.definitionRef?.packageId!=='cxx_official_items'||saved.definitionRef.version!==data.version)return saved;const out={...saved};if(signature(JSON.stringify(saved.aliases))===old.aliases)out.aliases=[...d.aliases];for(const field of ['name','ability','description'])if(signature(saved[field])===old[field]||field==='description'&&signature(saved[field])===old.ability)out[field]=field==='name'?d.name:d.ability;out.numericEffects=saved.numericEffects?.map(e=>e.kind==='ability'&&signature(e.text)===old.ability?{...e,text:d.ability}:e);if(signature(saved.adaptation)===old.adaptation){delete out.adaptation;delete out.originalAbility;delete out.source;}return out;}
 return {...data,find,definition,translate};
});
`;
 fs.writeFileSync(path.join(root,'卡片源码/运行时/item-catalog-data.js'),output);return {items:items.length,bytes:Buffer.byteLength(output)};
}
module.exports={build};if(require.main===module)console.log(build());
