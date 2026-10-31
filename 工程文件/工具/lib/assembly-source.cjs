'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

function load(file){
 const root=path.dirname(file),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(manifest.format,'cyber2051.assembly.v1');
 const read=relative=>{const absolute=path.resolve(root,relative);assert(absolute.startsWith(root+path.sep),'Assembly source must stay inside its directory');return fs.readFileSync(absolute,'utf8');};
 const card=JSON.parse(read(manifest.baseFile)),seen=new Set();
 for(const part of manifest.parts){
  const key=JSON.stringify(part.pointer);assert(!seen.has(key),'Duplicate assembly field');seen.add(key);
  assert(part.pointer.length&&part.pointer.every(k=>typeof k==='string'||Number.isInteger(k)));
  let target=card;for(const k of part.pointer.slice(0,-1)){assert(Object.hasOwn(target,k));target=target[k];}
  const keyPart=part.pointer.at(-1);assert(Object.hasOwn(target,keyPart));
  const value=read(part.file);assert(['text','json'].includes(part.type));target[keyPart]=part.type==='text'?value:JSON.parse(value);
 }
 return card;
}
module.exports={load};
