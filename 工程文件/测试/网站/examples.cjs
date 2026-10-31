'use strict';
const W=require('../../网站/gateway/public/submission-template.js');
function sample(kind){
  const f=W.byKind(kind),payload={format:f.format,templateVersion:W.version,templateKind:kind,sections:Object.fromEntries(f.fields.map(x=>[x.name,x.example]))};
  if(kind==='contract')payload.contract={mapId:'tokyo-central',placeId:'plaza',type:'调查',difficulty:'低',pay:3000,prerequisites:[]};
  else Object.assign(payload,{mapId:'tokyo-central',placeId:'plaza',keywords:[kind==='npc'?'林澈':'街区维修学徒']});
  return {type:f.type,title:'【填写示例】'+(kind==='npc'?'林澈':kind==='contract'?'取错的包裹':'街区维修学徒'),summary:'填写示例，演示栏目和表达方式，不属于正式设定或可安装内容。',authorName:'格式示例',tags:['填写示例'],payload};
}
module.exports={sample};
