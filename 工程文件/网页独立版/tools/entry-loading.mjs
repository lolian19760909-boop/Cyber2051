/** Critical first paint, generated from the approved loading component and ASCII source. */
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './workspace-paths.mjs';
const fusion=path.resolve(ROOT,'../资料/设计/UI升级-设计师旧卡-20261026/fusion');
const read=file=>fs.readFileSync(path.join(fusion,file),'utf8').replace(/\r\n/g,'\n');
const bundle=(group,file)=>read('vendor/'+group+'/lib/kit.js').replace(/^export /gm,'')+'\n'+read('vendor/'+group+'/pieces/'+file).replace(/^import .*;\s*/gm,'').replace(/export default function/g,'function').replace(/^export /gm,'');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function entryLoading({assets='./opening-ui/assets/'}={}){
 const runner=bundle('sakiko','sakiko-run.js'),rain=bundle('rain','red-data-flow.js');
 // Owned source, evaluated at build time solely to obtain the existing first ASCII frame.
 const first=Function(runner+';return create()(0).text;')();
 const css=read('fusion.css').split('.fusion-sample-controls')[0];
 const theme=read('integration/themes.css').split('\n').filter(line=>/\.cxx-fusion-loading canvas|\.fusion-load-(?:status|track)/.test(line)).join('\n').replaceAll('.cxx-game-menu','.cxx-entry');
 const runtime=fs.readFileSync(path.join(ROOT,'卡片源码/主题/runtime.js'),'utf8');
 const expression=runtime.match(/const FILTERS=([\s\S]*?);\r?\n function install/)[1],filters=Function('return '+expression)();
 const loader=read('assets/loading-sprites.mjs').replace(/^export /gm,'')+'\n'+read('loading-screen.mjs').replace(/^import .*;\s*/gm,'').replace('export async function mountLoading','async function mountLoading');
 const head=`<meta name="color-scheme" content="dark"><style>
html,body{background:#030407;color:#c46070;color-scheme:dark}
.cxx-entry{position:fixed;inset:0;z-index:2147483646;margin:0;padding:0;border:0;width:100%;height:100%;max-width:none;max-height:none;overflow:hidden;background:#030407;color:#c46070}
.cxx-entry[data-opening-theme=yellow]{color:#ead86e}.cxx-entry[data-opening-theme=night]{color:#e6e9ec}
.cxx-entry .entry-run{position:absolute;right:5%;bottom:9.537%;margin:0;font:bold clamp(3px,.5144vh,10px)/1 Consolas,monospace;white-space:pre;user-select:none}
.cxx-entry>.fusion-load-status{color:inherit}.cxx-entry .entry-reload{padding:10px 20px;min-height:44px;background:#030407;color:inherit;border:1px solid currentColor;font:inherit;cursor:pointer}.cxx-entry .entry-reload:focus-visible{outline:2px solid currentColor;outline-offset:4px}
.cxx-entry [hidden]{display:none!important}
${css}\n${theme}
@media(max-width:700px){.cxx-entry .entry-run{right:24px;bottom:150px;font-size:min(5.74px,.6667vh)}.cxx-entry .fusion-load-status{left:24px;right:24px;bottom:calc(32px + env(safe-area-inset-bottom,0px))}.cxx-entry .fusion-load-line{margin-bottom:20px}}
@media(prefers-reduced-motion:reduce){.cxx-entry .fusion-load-track.indeterminate i{animation:none}}
</style>`;
 const body=`<section id="cxx-entry-loading" class="cxx-entry cx77" aria-label="正在载入东京都" aria-busy="true"><svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>${filters}</defs></svg><pre class="entry-run" aria-hidden="true">${escape(first)}</pre><div class="fusion-load-status"><div class="fusion-load-line"><span class="fusion-load-label" role="status">LOADING</span></div><div class="fusion-load-track indeterminate" role="progressbar" aria-label="正在载入东京都"><i style="width:24%"></i></div><button class="entry-reload" type="button" hidden>重新载入</button><noscript>请启用JavaScript后继续。</noscript></div></section>
<script>(()=>{
const root=document.getElementById('cxx-entry-loading');let theme='red';try{const saved=localStorage.getItem('cxx-ui-theme-v1');if(['red','yellow','night'].includes(saved))theme=saved;}catch{}root.dataset.openingTheme=theme;
const rain=(()=>{${rain};return {create,meta};})();
const createRain=rain.create,rainMeta=rain.meta;
${loader}
let view=null,ended=false;
const ready=new Promise(resolve=>requestAnimationFrame(resolve)).then(()=>mountLoading({parent:root,mapUrl:${JSON.stringify(assets+'map.png')},logoUrl:${JSON.stringify(assets+'logo.png')}})).then(value=>{view=value;if(ended)value.destroy();else{value.ready.then(loaded=>{if(loaded&&!ended)root.querySelector('.entry-run').hidden=true;});root.querySelector(':scope > .fusion-load-status').hidden=true;}return value;});
const destroy=()=>{ended=true;view?.destroy();root.remove();window.removeEventListener('pagehide',destroy);};
window.CxxEntryLoading={ready,destroy,error(error){view?.destroy();root.querySelector(':scope > .fusion-load-status').hidden=false;root.querySelector('.entry-run').hidden=false;root.setAttribute('aria-busy','false');root.querySelector('.fusion-load-label').textContent=error.message;root.querySelector('.fusion-load-track').hidden=true;const reload=root.querySelector('.entry-reload');reload.hidden=false;reload.onclick=()=>location.reload();}};
ready.catch(error=>{if(!ended)window.CxxEntryLoading.error(error);});window.addEventListener('pagehide',destroy,{once:true});
})();</script>`;
 return {head,body};
}
export function releaseEntry(html){const loading=entryLoading();return html.replace('<head>','<head>\n'+loading.head).replace(/(<body\b[^>]*>)/,'$1\n'+loading.body);}
export function bootstrapEntry(buildId){
 const loading=entryLoading({assets:'./releases/'+buildId+'/opening-ui/assets/'});
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>东京都2051</title>${loading.head}</head><body>${loading.body}<script type="module">
try{const response=await fetch('./current.json',{cache:'no-store'});if(!response.ok)throw Error('版本入口读取失败');const current=await response.json();if(!/^[a-f0-9]{20}$/.test(current.release))throw Error('版本入口无效');const target=new URL('./releases/'+current.release+'/index.html',location.href);target.search=location.search;target.hash=location.hash;await window.CxxEntryLoading.ready;location.replace(target);}catch(error){window.CxxEntryLoading.error(error);}
</script></body></html>`;
}
