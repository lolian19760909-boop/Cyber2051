import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const fixture = path.dirname(fileURLToPath(import.meta.url));
const extension = path.resolve(fixture, '../../配套扩展/cxx-motion');
const assets = path.resolve(fixture, '../../独立制卡器/workbench/motion-m0/public/assets');
const lottie = path.resolve(fixture, '../../.cache/visual-runtime-20261019/fixtures');
const webExample = path.resolve(fixture, '../../../资料/设计/原型/视觉运行环境-样例-20261019/graphic-web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    const root = pathname.startsWith('/extension/') ? extension : pathname.startsWith('/fixture/') ? fixture : pathname.startsWith('/assets/') ? assets : pathname.startsWith('/lottie/') ? lottie : pathname.startsWith('/web-example/') ? webExample : null;
    if (!root) { response.writeHead(404).end(); return; }
    const relative = pathname.split('/').slice(2).join('/');
    if (root === assets && !['rating.riv', 'data-binding.riv'].includes(relative)) { response.writeHead(404).end(); return; }
    if (root === lottie && !['test.json', 'test.lottie', 'external.json', 'checker.png'].includes(relative)) { response.writeHead(404).end(); return; }
    if (root === webExample && !['project.json', 'entry.js'].includes(relative)) { response.writeHead(404).end(); return; }
    if (root === fixture && !['browser.html', 'browser.mjs'].includes(relative)) { response.writeHead(404).end(); return; }
    const target = path.resolve(root, relative);
    if (!target.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
    const bytes = await fs.readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(bytes);
  } catch { response.writeHead(404).end(); }
});
server.listen(8870, '127.0.0.1', () => console.log('http://127.0.0.1:8870/fixture/browser.html'));
