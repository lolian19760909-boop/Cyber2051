/* Portable text and explicit continuation ownership; native vector files stay native. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxMemoryMaterial=value;})(globalThis,function(){
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const KEY='__cxx_long_memory',names=['纪要表','人物经历','承诺与未结事项','事件记录','人物认知','关系变化'],copy=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function source(raw){try{const text=String(raw||''),match=[...text.matchAll(/<cxx-source>([\s\S]*?)<\/cxx-source>/g)].at(-1);return JSON.parse(match?match[1]:text);}catch{return null;}}
 function owns(state,story,current){return same(story,current)||same(state.owner,current)&&(state.origins||[]).some(s=>same(s,story));}
 function tables(data,valid){const out=copy(data||{});for(const t of Object.values(out)){if(!names.includes(t?.name)||!t.content?.length)continue;const h=t.content[0],column=h.indexOf(t.name==='纪要表'?'纪要':'来源');t.content=[h,...t.content.slice(1).filter(r=>valid(source(r[column])))];}return out;}
 function merge(base,added,valid=()=>true){const out=copy(base||{}),mapping={};
  for(const name of names){const pair=Object.entries(added||{}).find(([,t])=>t?.name===name);if(!pair)continue;let target=Object.values(out).find(t=>t?.name===name);if(!target){out[pair[0]]=copy(pair[1]);target=out[pair[0]];target.content=[target.content[0]];}
   const h=target.content[0],ah=pair[1].content[0],column=h.indexOf(name==='纪要表'?'纪要':'来源'),code=h.indexOf('编码索引'),link=h.indexOf('关联纪要');let rowId=Math.max(0,...target.content.slice(1).map(r=>Number(r[0])||0)),nextCode=Math.max(0,...target.content.slice(1).map(r=>Number(String(r[code]||'').replace(/^AM/,''))||0));
   for(const row of pair[1].content.slice(1)){const r=h.map(k=>row[ah.indexOf(k)]??''),s=source(r[column]);if(!valid(s))continue;const old=target.content.slice(1).find(x=>same(source(x[column]),s)&&(code>=0&&x[code]===r[code]||h.every((_,i)=>i===0||i===code||i===link||same(x[i],r[i]))));if(old){if(code>=0)mapping[r[code]]=old[code];continue;}
    r[0]=++rowId;if(code>=0){const prior=r[code];if(!/^AM\d{4,}$/.test(prior)||target.content.slice(1).some(x=>x[code]===prior))r[code]='AM'+String(++nextCode).padStart(4,'0');nextCode=Math.max(nextCode,Number(r[code].slice(2)));mapping[prior]=r[code];}if(link>=0)r[link]=String(r[link]).replace(/AM\d{4,}/g,id=>mapping[id]||id);target.content.push(r);
   }
  }return out;
 }
 return {KEY,names,source,owns,tables,merge};
});
