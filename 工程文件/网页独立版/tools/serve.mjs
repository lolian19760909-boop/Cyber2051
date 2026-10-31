/**
 * 本地独立模式的启动器（也是开发与验收用的静态服务）。
 *
 * 为什么需要它：浏览器的 `file://` 不能加载 ES 模块、不能给卡内 UMD 提供稳定 origin，
 * IndexedDB 也按 origin 分库。所以"本地独立"= 本机跑 `node tools/serve.mjs` 打开
 * `http://127.0.0.1:2051/?mode=local`，不是双击 HTML。
 *
 * 路由：
 *   /            → web/index.html
 *   /src/*       → 网页内核源码（ESM）
 *   /web/*       → 界面资源
 *   /card/*      → 工程文件/卡片源码（卡内 UMD 与数据）
 *   /data/card.json   → 成卡 JSON（默认取 交付/当前 最新 2.3.33）
 *   /data/preset.json → 卡内正式预设
 *   /api/play/connect → 本机受限转发（仅当显式开启，默认不代理，交给公网站点）
 *
 * 用法：node tools/serve.mjs [--port 2051] [--host 127.0.0.1]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
const compress=promisify(gzip),acceptGzip=req=>String(req.headers['accept-encoding']||'').split(',').some(part=>{const [format,...params]=part.trim().split(';');return format==='gzip'&&!params.some(p=>/^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(p));});
import { buildContent } from './content-build.mjs';
const { createPlayConnect } = createRequire(import.meta.url)('../../网站/gateway/play-connect.cjs');

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WEB_ROOT = resolve(HERE, '..');
const PROJECT = resolve(WEB_ROOT, '..'); // 工程文件
const SUITE_ROOT = join(PROJECT, '配套扩展');
const CARD_SRC = join(PROJECT, '卡片源码');
const GENERATED = join(WEB_ROOT, 'generated');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

function args() {
  const out = { port: 2051, host: '127.0.0.1' };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') out.port = Number(argv[++i]);
    else if (argv[i] === '--host') out.host = String(argv[++i]);
  }
  return out;
}

function safeJoin(root, urlPath) {
  // 请求路径可能已经解码（原始 UTF-8 字节）也可能仍是百分号编码，两种情况都要能吃。
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath;
  }
  const clean = normalize(decoded).replace(/^[/\\]+/, '');
  if (!clean || clean.includes('..')) return null;
  const full = resolve(root, clean);
  const rel = relative(resolve(root), full);
  return rel && !rel.startsWith('..') ? full : null;
}

async function sendFile(req, res, file, cache = 'no-cache') {
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    const raw = await readFile(file),encoded=raw.length>=1024&&/\.(?:html|css|m?js|json|svg)$/i.test(file)&&acceptGzip(req),body=encoded?await compress(raw):raw;
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': cache,
      'vary':'Accept-Encoding',
      ...(encoded?{'content-encoding':'gzip'}:{}),
    });
    res.end(req.method==='HEAD'?undefined:body);
    return true;
  } catch {
    return false;
  }
}

export function createLocalServer() {
 const nonce=randomBytes(32).toString('hex');
 const send=(res,status,body,headers={})=>res.writeHead(status,{'content-type':'application/json; charset=utf-8',...headers}).end(JSON.stringify(body));
 const relay=createPlayConnect({send,authorize:req=>{const token=String(req.headers['x-cxx-local-token']||'');return token.length===nonce.length&&timingSafeEqual(Buffer.from(token),Buffer.from(nonce))?{row:{publisher_id:'local-launcher'}}:{error:'unauthorized',code:401};},readRawBody(req,res,max,callback){let size=0,chunks=[],finished=false;req.on('data',chunk=>{if(finished)return;size+=chunk.length;if(size>max){finished=true;chunks=[];send(res,413,{error:'payload_too_large'});callback(null);return;}chunks.push(chunk);});req.on('end',()=>{if(!finished){finished=true;callback(Buffer.concat(chunks));}});req.on('error',()=>{if(!finished){finished=true;callback(null);}});}});
 return createServer(async (req, res) => {
  const host=String(req.headers.host||'');
  if(!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(host)){send(res,403,{error:'local_host_required'});return;}
  if(req.headers.origin&&req.headers.origin!=='http://'+host){send(res,403,{error:'same_origin_required'});return;}
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname;
  if(path==='/api/local/session'&&req.method==='GET'){send(res,200,{mode:'local',token:nonce},{'cache-control':'no-store'});return;}
  if(path==='/api/play/connect'&&req.headers['content-encoding']&&!/^identity$/i.test(req.headers['content-encoding'].trim())){send(res,415,{error:'compressed_body_rejected'});return;}
  if(relay.handle(req,res,url,req.method))return;
  if(path==='/user.js'){if(await sendFile(req,res,join(PROJECT,'网站/gateway/public/user.js')))return;}

  if (path === '/' || path === '/index.html') {
    if (await sendFile(req,res, join(WEB_ROOT, 'web', 'index.html'))) return;
  }
  if (path === '/data/card.json') {
    if (await sendFile(req,res, join(GENERATED,'card.json'))) return;
    res.writeHead(404).end('card.json 缺失');
    return;
  }
  if (path === '/data/preset.json') {
    const presets=JSON.parse(await readFile(join(GENERATED,'presets.json'),'utf8'));
    const preset=presets.find(row=>row.id===(url.searchParams.get('id')||'izumi'));
    if(preset){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-cache'}).end(JSON.stringify(preset.preset));return;}
    res.writeHead(404).end('正式预设不存在');
    return;
  }
  if(['/data/manifest.json','/data/presets.json','/data/ui.json','/data/map-runtime.js','/data/memory-contract.json','/data/knowledge-index.json','/data/agent-prompts.json'].includes(path)){
    if(await sendFile(req,res,join(GENERATED,path.split('/').at(-1))))return;
  }
  // 打包版把 release-manifest.json 放在扩展的 app/ 里；开发预览读同一份构建回执。
  if(path==='/release-manifest.json'){
    if(await sendFile(req,res,join(WEB_ROOT,'artifacts/st-extension/app/release-manifest.json')))return;
  }
  if(path.startsWith('/assets/')){const file=safeJoin(join(GENERATED,'assets'),path.slice('/assets/'.length));if(file&&await sendFile(req,res,file,'public, max-age=31536000, immutable'))return;}
  if(path.startsWith('/opening-ui/')){const file=safeJoin(join(GENERATED,'opening-ui'),path.slice('/opening-ui/'.length));if(file&&await sendFile(req,res,file))return;}
  if(path.startsWith('/shared/context/')){const file=safeJoin(join(SUITE_ROOT,'tavern-runtime-suite/context/core'),path.slice('/shared/context/'.length));if(file&&await sendFile(req,res,file))return;}
  if(path.startsWith('/shared/mirror/')){const file=safeJoin(join(WEB_ROOT,'shared/mirror'),path.slice('/shared/mirror/'.length));if(file&&await sendFile(req,res,file))return;}
  if(path.startsWith('/shared/visual/runtime/')){const file=safeJoin(join(SUITE_ROOT,'tavern-runtime-suite/visual/runtime'),path.slice('/shared/visual/runtime/'.length));if(file&&await sendFile(req,res,file))return;}
  if(path.startsWith('/shared/visual/recipes/')){const file=safeJoin(join(SUITE_ROOT,'tavern-runtime-suite/visual/recipes'),path.slice('/shared/visual/recipes/'.length));if(file&&await sendFile(req,res,file))return;}
  if(['/site/site.css','/site/theme.css','/site/theme-runtime.js'].includes(path)){if(await sendFile(req,res,join(PROJECT,'网站/gateway/public',path.slice(6))))return;}
  if(path.startsWith('/site/assets/game-ui/')){const file=safeJoin(join(PROJECT,'网站/gateway/public/assets/game-ui'),path.slice('/site/assets/game-ui/'.length));if(file&&await sendFile(req,res,file))return;}
  if (path.startsWith('/card/')) {
    const file = safeJoin(CARD_SRC, path.slice('/card/'.length));
    if (file && (await sendFile(req,res, file))) return;
  }
  if (path.startsWith('/src/') || path.startsWith('/web/')) {
    const file = safeJoin(WEB_ROOT, path.slice(1));
    if (file && (await sendFile(req,res, file))) return;
  }
  if (path.startsWith('/suite/')) {
    // 只为验证卡线 motion 运行时：把 配套扩展/ 挂到 /suite/，不参与产品构建。
    const file = safeJoin(SUITE_ROOT, path.slice('/suite/'.length));
    if (file && (await sendFile(req,res, file))) return;
  }
  if (path === '/favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`未找到：${path}`);
}); }

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {port,host}=args();
  if(!['127.0.0.1','::1','localhost'].includes(host))throw new Error('本地启动器只监听回环地址');
  await buildContent();
  (await import('./p3a-adapt-views.mjs')).adaptViews();
  createLocalServer().listen(port,host,()=>console.log(`网页独立版已启动：http://${host}:${port}/?mode=local`));
}
