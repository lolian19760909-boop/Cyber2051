'use strict';
// Build-time composition only: one token source, no runtime style override.
function sheet(source,file){return source('主题/tokens.css')+'\n'+source(file);}
function scopedSheet(source,file,selector){return source('主题/tokens.css').replace(':root, :host {',selector+' {')+'\n'+source(file);}
function html(source,file){return source(file).replace(/<style([^>]*)>/,'<style$1>\n'+source('主题/tokens.css')+'\n');}
// The theme owner keeps this face available after the temporary menu has closed.
// Each attached document receives the same existing offline font bytes.
function runtimeSheet(source){
  const font=JSON.parse(source('运行时/hub-assets.json')).font;
  if(typeof font!=='string'||!font.startsWith('data:font/woff2;base64,'))throw Error('Missing embedded Rajdhani font');
  return '@font-face{font-family:Rajdhani;font-weight:500 600;font-display:swap;src:url('+JSON.stringify(font)+') format("woff2")}\n'+source('主题/carriers.css');
}
module.exports={sheet,scopedSheet,html,runtimeSheet};
