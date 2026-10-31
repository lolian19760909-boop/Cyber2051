'use strict';
// Publish the existing theme sources for website documents and packaged play pages.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
function build(){
 require('./site-art.cjs').build();
 const source=path.join(root,'卡片源码/主题'),out=path.join(root,'网站/gateway/public');
 const files={
  'theme.css':'/* Generated from the maintained game theme and existing game font. */\n@font-face{font-family:Rajdhani;font-weight:500 600;font-display:swap;src:url("./assets/game-ui/rajdhani.woff2") format("woff2")}\n'+['tokens.css','carriers.css'].map(name=>fs.readFileSync(path.join(source,name),'utf8')).join('\n'),
  'theme-runtime.js':fs.readFileSync(path.join(source,'runtime.js')),
 };
 for(const [name,bytes]of Object.entries(files))fs.writeFileSync(path.join(out,name),bytes);
 return Object.keys(files);
}
module.exports={build};
if(require.main===module)console.log(build().join('\n'));
