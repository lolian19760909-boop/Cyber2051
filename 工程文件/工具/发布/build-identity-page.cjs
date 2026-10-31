'use strict';
const fs=require('node:fs'),path=require('node:path');
function build(){return '```html\n<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0c0f12;color:#e5e7ea;font:16px/1.7 sans-serif"><main class="lp-wrap"><span id="lpSkip"></span><span id="lpCustom"></span><p>人物配置已整合到五步开场。</p><button id="lpGo" type="button" onclick="parent.Cxx236OpeningHost.open()">继续开局配置</button></main></body></html>\n```\n';}
module.exports={build};
if(require.main===module){const target=path.resolve(__dirname,'../../.cache/build/legacy-identity-page.txt');if(process.argv.includes('--write')){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,build());}else console.log(JSON.stringify({target,bytes:Buffer.byteLength(build()),write:false}));}
