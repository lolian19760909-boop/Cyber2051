'use strict';
// 本机预览读取维护源；游玩复用本地启动器，发布状态与公告只读公开站点。
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const E=path.resolve(__dirname,'..'),project=path.dirname(E),mode=process.argv[2]||'gal',port=Number(process.argv[3]||6977);
const playRootIndex=process.argv.indexOf('--play-root'),playRoot=playRootIndex<0?path.join(E,'网页独立版/dist'):path.resolve(process.argv[playRootIndex+1]||'');
if(playRootIndex>=0&&!process.argv[playRootIndex+1])throw Error('--play-root需要指定已构建网页目录');
const configs={gal:['卡片源码/Gal','preview.html'],terminal:['卡片源码/终端','index.html'],map:['卡片源码/地图','preview.html'],site:['网站/gateway/public','home.html']};
if(!configs[mode]||!Number.isInteger(port)||port<1024||port>65535)throw Error('用法: node 工程文件/工具/preview.cjs gal|terminal|map|site [1024–65535端口]');
const [dir,entry]=configs[mode],root=path.join(E,dir),assets=new Map();
let terminalPreview,playRequest;
if(mode==='gal'){
 const standing=require(path.join(root,'standing-inventory.json'));
 assets.set('/dialogue.js',path.join(E,'卡片源码/正文/dialogue.js'));
 for(const a of standing.assets)assets.set('/assets/'+a.characterId+'_'+a.expressionId+'.png',path.join(project,standing.sourceDirectory,a.source.path));
 for(const a of require(path.join(root,'media-inventory.json')).files)assets.set('/img/galgame/backgrounds/'+a.sha256.slice(0,16)+'/'+a.file,path.join(project,'图片/2051_backgroundCG',a.file));
 for(const name of ['terminal-fixture.html','hud-fixture.html'])assets.set('/'+name,path.join(E,'测试/Gal',name));
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{try{
 // The site preview mounts the existing local launcher, including its nonce-authenticated API.
 if(mode==='site'){
  const url=new URL(req.url,'http://127.0.0.1'),pathname=url.pathname;
  if(req.method==='GET'&&['/download/manifest.json','/api/workshop/announcements'].includes(pathname)){
   const upstream=await fetch('https://cyber2051.top'+pathname+url.search,{signal:AbortSignal.timeout(8000)});
   res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(Buffer.from(await upstream.arrayBuffer()));return;
  }
  if(pathname==='/api/local/session'||pathname==='/api/play/connect')return playRequest(req,res);
  if(pathname.startsWith('/resources/'))return playRequest(req,res);
  if(pathname==='/play'||pathname==='/play/'&&!url.searchParams.has('mode')){if(!url.searchParams.has('mode'))url.searchParams.set('mode','local');res.writeHead(308,{Location:'/play/'+url.search});res.end();return;}
  if(pathname.startsWith('/play/')){
   req.url=(pathname.slice(5)||'/')+url.search;
   return playRequest(req,res);
  }
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
 const raw=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),route=mode==='site'&&raw.startsWith('/workshop/')?raw.slice(9):raw,relative=mode==='site'&&raw==='/workshop/'?'index.html':route==='/'?entry:route.replace(/^\//,''),candidate=path.resolve(root,relative);
 if(mode==='terminal'&&(route==='/'||relative==='index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?'':terminalPreview);return;}
 if(!candidate.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 let file=assets.get(route)||candidate;
 if(mode==='map'){const cached=path.resolve(E,'.cache/map',relative);if(cached.startsWith(path.resolve(E,'.cache/map')+path.sep)&&fs.existsSync(cached))file=cached;}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});if(req.method==='HEAD')res.end();else if(['gal','terminal'].includes(mode)&&path.extname(file)==='.css')res.end(fs.readFileSync(path.join(E,'卡片源码/主题/tokens.css'),'utf8')+'\n'+fs.readFileSync(file,'utf8'));else fs.createReadStream(file).pipe(res);
}catch{res.writeHead(400);res.end('Bad request');}});
async function start(){
 if(mode==='terminal'){const {card}=await require('./构建/当前/build.cjs').build();terminalPreview=require('./lib/terminal-preview.cjs').preview(card);}
 if(mode==='site'){const {pathToFileURL}=require('node:url'),{createPackagedServer}=await import(pathToFileURL(path.join(E,'网页独立版/tools/local-runtime.mjs')).href);playRequest=createPackagedServer({root:playRoot}).listeners('request')[0];}
 server.listen(port,'127.0.0.1',()=>console.log(mode+' 预览 http://127.0.0.1:'+port));
}
start().catch(error=>{console.error(error);process.exitCode=1;});
process.on('SIGINT',()=>server.close(()=>process.exit(0)));

