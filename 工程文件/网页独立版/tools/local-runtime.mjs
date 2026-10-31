/** Dependency-free packaged launcher. Same finite model relay as the public gateway. */
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {createRequire} from 'node:module';import {randomBytes,timingSafeEqual} from 'node:crypto';
import {createGzip} from 'node:zlib';import {pipeline} from 'node:stream';
const require=createRequire(import.meta.url),here=path.dirname(fileURLToPath(import.meta.url));
const gateway=fs.existsSync(path.join(here,'play-connect.cjs'))?path.join(here,'play-connect.cjs'):path.resolve(here,'../../网站/gateway/play-connect.cjs');
const {createPlayConnect}=require(gateway),MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.m4a':'audio/mp4','.wav':'audio/wav','.woff2':'font/woff2','.otf':'font/otf','.wasm':'application/wasm','.gz':'application/gzip'};
export function createPackagedServer({root=path.resolve(here,'..')}={}){
 root=path.resolve(root);const nonce=randomBytes(32).toString('hex'),send=(res,status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(body));};
 const selection=JSON.parse(fs.readFileSync(path.join(root,'current.json'),'utf8'));if(!/^[a-f0-9]{20}$/.test(selection.release))throw Error('本机应用版本入口无效');
 const relay=createPlayConnect({send,loadAdapters:()=>import(pathToFileURL(path.join(root,'releases',selection.release,'src/models/adapters.mjs')).href),authorize:req=>{const token=String(req.headers['x-cxx-local-token']||'');return token.length===nonce.length&&timingSafeEqual(Buffer.from(token),Buffer.from(nonce))?{row:{publisher_id:'local-launcher'}}:{error:'unauthorized',code:401};},readRawBody(req,res,max,callback){let bytes=0,chunks=[],done=false;req.on('data',chunk=>{if(done)return;bytes+=chunk.length;if(bytes>max){done=true;chunks=[];send(res,413,{error:'payload_too_large'});callback(null);return;}chunks.push(chunk);});req.on('end',()=>{if(!done){done=true;callback(Buffer.concat(chunks));}});req.on('error',()=>{if(!done){done=true;callback(null);}});}});
 return http.createServer((req,res)=>{void(async()=>{
  const host=String(req.headers.host||'');if(!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(host))return send(res,403,{error:'local_host_required'});
  if(req.headers.origin&&req.headers.origin!=='http://'+host)return send(res,403,{error:'same_origin_required'});
  const url=new URL(req.url,'http://127.0.0.1');if(url.pathname==='/api/local/session'&&req.method==='GET')return send(res,200,{mode:'local',token:nonce,release:selection.release,availableRelease:JSON.parse(fs.readFileSync(path.join(root,'current.json'),'utf8')).release});
  if(url.pathname==='/api/play/connect'&&req.headers['content-encoding']&&!/^identity$/i.test(req.headers['content-encoding'].trim()))return send(res,415,{error:'compressed_body_rejected'});
  if(relay.handle(req,res,url,req.method))return;if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'method_not_allowed'});
  if(url.pathname==='/current.json')return send(res,200,selection);
  let name=decodeURIComponent(url.pathname);if(name==='/')name='/index.html';const file=path.resolve(root,'.'+name),relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative))return send(res,404,{error:'not_found'});
  // Launchers are local executables, not an HTTP document surface.
  if(relative.split(path.sep)[0]==='local'||/\.(?:cmd|ps1|cjs)$/i.test(file))return send(res,404,{error:'not_found'});
  let info;try{info=await fs.promises.stat(file);}catch{return send(res,404,{error:'not_found'});}if(!info.isFile())return send(res,404,{error:'not_found'});
  const immutable=/^releases[/\\]/.test(relative)||/[/\\]assets[/\\]/.test(relative),encoded=info.size>=1024&&/\.(?:html|css|m?js|json|svg)$/i.test(file)&&String(req.headers['accept-encoding']||'').split(',').some(part=>{const [format,...params]=part.trim().split(';');return format==='gzip'&&!params.some(p=>/^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(p));});
  // Range 续传：资源包是 1.46GiB 的单文件，断点续传必须让浏览器拿到 206 和原始字节区间。
  // 压缩响应与 Range 互斥——对 gzip 字节做区间会让客户端拼出损坏的包，所以带 Range 时一律走 identity。
  let range=null;const rangeHeader=String(req.headers.range||'').trim();
  if(/^bytes=\d*-\d*$/i.test(rangeHeader)){
   const [startText,endText]=rangeHeader.slice(6).split('-'),start=startText===''?null:Number(startText),end=endText===''?null:Number(endText);
   if(start!==null&&start>=info.size){res.writeHead(416,{'content-type':'text/plain; charset=utf-8','content-range':'bytes */'+info.size,'cache-control':'no-store'});res.end();return;}
   if(start===null&&end!==null){const length=Math.min(end,info.size);range={start:info.size-length,end:info.size-1};}
   else if(start!==null){range={start,end:end===null?info.size-1:Math.min(end,info.size-1)};if(range.end<range.start)range=null;}
  }
  const useGzip=encoded&&!range,headers={'content-type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':immutable?'public, max-age=31536000, immutable':'no-cache','vary':'Accept-Encoding','accept-ranges':'bytes'};
  if(range){headers['content-length']=range.end-range.start+1;headers['content-range']='bytes '+range.start+'-'+range.end+'/'+info.size;}
  else if(!useGzip)headers['content-length']=info.size;
  if(useGzip)headers['content-encoding']='gzip';
  res.writeHead(range?206:200,headers);
  if(req.method==='HEAD')res.end();else{const stream=fs.createReadStream(file,range?{start:range.start,end:range.end}:undefined);pipeline(...(useGzip?[stream,createGzip(),res]:[stream,res]),error=>{if(error)res.destroy();});}
 })().catch(()=>{if(!res.headersSent)send(res,500,{error:'local_request_failed'});else res.destroy();});});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=name=>{const at=process.argv.indexOf(name);return at<0?null:process.argv[at+1];},root=arg('--root')||path.resolve(here,'..'),port=Number(arg('--port')||2051);
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口应在1024—65535之间；请长期沿用同一端口以读取原存档');
 const server=createPackagedServer({root});server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'2051端口已占用，请先关闭旧启动器或沿用已打开的页面。':error.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log('东京都2051：http://127.0.0.1:'+port+'/?mode=local\n请保留此窗口；Ctrl+C 关闭。'));
}
