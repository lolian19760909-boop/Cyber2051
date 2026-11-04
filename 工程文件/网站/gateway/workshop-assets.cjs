'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(__dirname,'../../配套扩展/tavern-runtime-suite/visual'),target=path.join(__dirname,'public/shared/visual');
function build(){const files=['runtime/motion.mjs','recipes/graphic.mjs','recipes/interface.mjs'],ledger=[];for(const file of files){const bytes=fs.readFileSync(path.join(source,file)),out=path.join(target,file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,bytes);ledger.push({file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});}fs.writeFileSync(path.join(target,'sources.json'),JSON.stringify({source:'配套扩展/tavern-runtime-suite/visual',files:ledger},null,2)+'\n');return ledger;}
if(require.main===module)console.log(JSON.stringify(build()));module.exports={build};
