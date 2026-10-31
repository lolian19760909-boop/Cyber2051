'use strict';
// Reads the stored ZIP format emitted by resource-pack.cjs; no extraction needed.
const fs=require('node:fs'),path=require('node:path');
module.exports=function readResources(root,options={}){
 const configFile=path.join(root,'资源/resource-profile.json');
 const profile=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):null;
 const selected=options.file||(options.master?profile?.master:profile?.player)||'资源/P4基础资源包.zip';
 const file=path.resolve(root,selected);
 if(!fs.existsSync(file))return null;
 const zip=fs.readFileSync(file),entries=new Map();
 for(let at=0;at+30<=zip.length&&zip.readUInt32LE(at)===0x04034b50;){
  const flags=zip.readUInt16LE(at+6),method=zip.readUInt16LE(at+8),bytes=zip.readUInt32LE(at+18),len=zip.readUInt16LE(at+26),extra=zip.readUInt16LE(at+28),start=at+30+len+extra,end=start+bytes;
  if(method!==0||(flags&8)||end>zip.length)throw Error('P4 基础资源包格式不符，请使用当前构建器生成的未压缩资源包');
  const name=zip.toString('utf8',at+30,at+30+len);entries.set(name,zip.subarray(start,end));at=end;
 }
 if(!entries.has('manifest.json'))throw Error('P4 基础资源包缺少 manifest.json');
 return {file,entries,manifest:JSON.parse(entries.get('manifest.json')),profile};
};
