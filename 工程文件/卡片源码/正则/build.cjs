'use strict';
const assert=require('node:assert/strict');

// Metadata order is execution order. Only findRegex is expanded; unknown host
// fields, IDs, flags and disabled alternatives pass through unchanged.
function build(read){
 const registry=JSON.parse(read('正则/rules.json'));
 const patterns=JSON.parse(read('正则/patterns.json'));
 assert.equal(registry.format,'cyber2051.regex-source.v1');
 const seen=new Set();
 return registry.rules.map(({key,script})=>{
  assert(script.id&&!seen.has(script.id),'Duplicate regex ID: '+key);seen.add(script.id);
  const spec=script.findRegex,body=patterns.bodies[spec.pattern];
  assert.equal(typeof body,'string','Unknown regex pattern: '+key);
  const source=spec.guard?patterns.literalGuard+'|(?:'+body+')':body;
  new RegExp(source,spec.flags||'');
  return {...script,findRegex:Object.hasOwn(spec,'flags')?'/'+source+'/'+spec.flags:source};
 });
}
module.exports={build};
