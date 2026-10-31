'use strict';
const fs=require('node:fs'),path=require('node:path'),{inlineSource}=require('./inline-source.cjs');
const readDefault=file=>fs.readFileSync(path.join(__dirname,'../../卡片源码',file),'utf8').replace(/\r\n/g,'\n');
// Each helper script and embedded document owns its execution realm. Keep adapters local.
function prepend(code,read=readDefault){
 const parts=[];
 if(/\bCxxMotion\b/.test(code))parts.push(read('共享/motion.js'));
 if(/\bCxxDataClone\b/.test(code))parts.push(read('共享/data-clone.js'));
 if(/\bCxxPopover\b/.test(code))parts.push(read('共享/popover.js'));
 return parts.length?inlineSource(parts.join('\n;\n'))+'\n;\n'+code:code;
}
module.exports={prepend};
