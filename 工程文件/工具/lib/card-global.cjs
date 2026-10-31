'use strict';
const B=require('./card-ast.cjs');
module.exports=function globals(code,names){const found=new Map();B.walk(B.acorn.parse(code,{ecmaVersion:'latest',sourceType:'module'}),n=>{if(n.type==='AssignmentExpression'&&n.left.object?.name==='globalThis'&&names.includes(n.left.property?.name)){const name=n.left.property.name,source=code.slice(n.start,n.end);if(found.has(name))B.assert.equal(found.get(name),source,'shared global '+name);else found.set(name,source);}});return names.map(name=>{B.assert(found.has(name),'packaged global '+name);return found.get(name);}).join(';\n');};
