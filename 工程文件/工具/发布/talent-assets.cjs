'use strict';
const path=require('node:path');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
// The same original files feed the local preview and the self-contained card runtime.
function bundle(read=file=>fs.readFileSync(file)){
  const directory=path.join(__dirname,'../assets/talents');
  const manifest=JSON.parse(read(path.join(directory,'manifest.json')).toString('utf8'));
  const types={'.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'},map={};
  for(const row of manifest.assets){
    if(path.basename(row.file)!==row.file)throw Error('Invalid talent asset path');
    const bytes=read(path.join(directory,row.file));
    if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Talent asset hash mismatch: '+row.file);
    map[row.file]='data:'+types[path.extname(row.file)]+';base64,'+bytes.toString('base64');
  }
  return 'globalThis.CxxTalentAssets='+JSON.stringify(map)+';';
}
module.exports={bundle};
