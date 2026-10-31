'use strict';
// A process-local source overlay for this batch's isolated candidate. No shared output changes.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {root,work}=require('../维护/ui-motion-workspace.cjs');
const staged=path.join(work,'staged');
async function overlay(run){
 // Once applied, tests use the maintained source, including later collaborators' edits.
 if(fs.existsSync(path.join(work,'applied-receipt.json')))return run();
 const read=fs.readFileSync,js=Module._extensions['.js'],cjs=Module._extensions['.cjs'];
 function candidate(file){if(typeof file!=='string')return null;const absolute=path.resolve(file);if(!absolute.startsWith(root+path.sep)||absolute.startsWith(work+path.sep))return null;const next=path.join(staged,path.relative(root,absolute));return fs.existsSync(next)&&fs.statSync(next).isFile()?next:null;}
 fs.readFileSync=function(file,...args){return read.call(fs,candidate(file)||file,...args);};
 const compile=(original)=>(mod,file)=>{const next=candidate(file);if(next)mod._compile(read(next,'utf8'),file);else (original||js)(mod,file);};
 Module._extensions['.js']=compile(js);Module._extensions['.cjs']=compile(cjs);
 try{return await run();}finally{fs.readFileSync=read;Module._extensions['.js']=js;if(cjs)Module._extensions['.cjs']=cjs;else delete Module._extensions['.cjs'];}
}
module.exports={overlay};
if(require.main===module)overlay(async()=>{const {build}=require('../构建/当前/build.cjs'),{card,receipt}=await build({write:false});const file=path.join(work,'candidate.json'),bytes=Buffer.from(JSON.stringify(card));fs.writeFileSync(file,bytes);receipt.output={file,bytes:bytes.length,sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex')};fs.writeFileSync(path.join(work,'candidate-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify({version:card.data.character_version,...receipt.output}));}).catch(error=>{console.error(error);process.exitCode=1;});
