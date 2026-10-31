'use strict';
const vendors=['vendor/pixi.min.js','vendor/live2dcubismcore.min.js','vendor/live2d.min.js','vendor/live2d-display.min.js'];
const files=['coat.js','collar.js','detail.js','anon-frame.js'];
function validate(root,source){
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
 const manifest=JSON.parse(source('Live2D/manifest.json')),pack=require('./offline-resources.cjs')(root,{file:'资源/爱音Live2D-v2.zip'});
 assert.deepEqual(pack?.manifest,manifest,'模型包与维护清单不符，请重建模型包');
 for(const e of manifest.entries){const data=pack.entries.get(e.file);assert(data&&data.length===e.bytes&&hash(data)===e.id,'模型包内容不符：'+e.file);}
 for(const file of vendors){source('Live2D/'+file);const e=manifest.entries.find(e=>e.file===file);assert.equal(hash(fs.readFileSync(path.join(root,'卡片源码/Live2D',file))),e?.id,'播放器库已修改，请重建模型包：'+file);}
}
function player(source){const scripts=files.map(file=>'<script>'+source('Live2D/'+file).replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n');return '<!doctype html><html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}canvas{width:100%;height:100%;display:block;filter:saturate(.68) contrast(.97)}#controls{display:none}</style><body><canvas id="canvas"></canvas><div id="controls"><input id="outfit" value="techwear"><input id="coatEnabled" type="checkbox" checked><input id="coatSway" type="checkbox" checked><input id="coatLength" value="1"></div>'+scripts+'</body></html>';}
module.exports={player,vendors,validate};
