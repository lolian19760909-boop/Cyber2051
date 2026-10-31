'use strict';
// HTML script tokenization precedes JavaScript parsing, even inside quoted data.
const acorn=require('acorn'),assert=require('node:assert/strict');
function inlineSource(source){
  const edits=[],comments=[];
  const tokens=[...acorn.tokenizer(source,{ecmaVersion:'latest',sourceType:'module',onComment:comments})];
  for(const token of [...tokens.filter(t=>['string','regexp','template'].includes(t.type.label)),...comments]){
    const raw=source.slice(token.start,token.end);
    // Escaping all literal less-than characters also handles HTML comment states.
    if(raw.includes('<'))edits.push({start:token.start,end:token.end,text:raw.replace(/(\\*)</g,(_,slashes)=>slashes.slice(0,slashes.length-slashes.length%2)+'\\x3c')});
  }
  // Tagged templates can observe raw spelling; do not silently alter their data.
  const tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
  function visit(node){if(!node||typeof node!=='object')return;if(node.type==='TaggedTemplateExpression'&&source.slice(node.quasi.start,node.quasi.end).includes('<'))throw Error('Tagged template needs explicit safe serialization');for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
  visit(tree);
  for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
  const after=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});
  function values(node,result=[]){if(!node||typeof node!=='object')return result;if(node.type==='Literal'&&!node.regex)result.push(node.value);if(node.type==='TemplateElement')result.push(node.value.cooked);for(const v of Object.values(node))if(Array.isArray(v))v.forEach(n=>values(n,result));else if(v&&typeof v==='object')values(v,result);return result;}
  assert.deepEqual(values(after),values(tree),'Embedded string or template payload changed during inline encoding');
  return source;
}
module.exports={inlineSource};
