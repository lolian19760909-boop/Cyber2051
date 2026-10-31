const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { source, rendered, noStyle, hostFunctions } = require('../../工具/构建/预设/bubbles-check.cjs');
const donorRoot = 'C:/Users/lolian/Downloads/赛博小祥2051-主题与气泡-20261019/赛博小祥2051-主题与气泡-20261019/气泡主题/设计稿';
const donor = fs.readFileSync(path.join(donorRoot, 'bubble-layout.html'), 'utf8');
const donorCSS = donor.match(/<style>([\s\S]*?)<\/style>/)[1];
const start = donorCSS.indexOf('/* =====================================================================');
const sharedCSS = donorCSS.slice(0, start);
const config = JSON.stringify({ rendered, noStyle, donorCSS, sharedCSS });
const sanitize = 'const css=cssTools;function isExternalMediaAllowed(){return true;}\n'+hostFunctions+'\naddDOMPurifyHooks();window.sanitizeMessage=html=>decodeStyleTags(DOMPurify.sanitize(encodeStyleTags(new showdown.Converter({simpleLineBreaks:true}).makeHtml(html)),{ADD_TAGS:["custom-style"],MESSAGE_SANITIZE:true}),{prefix:".mes_text "});';
const files = new Map([
  ['/bubbles/', path.join(__dirname, 'bubbles.html')], ['/bubbles/fixture.mjs', path.join(__dirname, 'bubbles-fixture.mjs')],
  ['/bubbles/purify.js', 'D:/SillyTavern/node_modules/dompurify/dist/purify.js'],
  ['/bubbles/css.js', 'D:/SillyTavern/node_modules/@adobe/css-tools/dist/umd/adobe-css-tools.js'],
  ['/bubbles/showdown.js', 'D:/SillyTavern/node_modules/showdown/dist/showdown.js'],
  ...['rajdhani-semibold-latin.woff2','rajdhani-medium-latin.woff2'].map(name=>['/bubbles/assets/'+name,path.join(donorRoot,'assets',name)]),
]);
const helper = source.replaceAll(/https?:[^"'\s]+\.(?:webp|png|jpg)/gi, '/bubbles/portrait.svg');
const generated = new Map([
  ['/bubbles/config.js', `window.bubbleConfig=${config};`], ['/bubbles/sanitize.js', sanitize],
  ['/bubbles/helper.js', `window.substitudeMacros=parent.substitudeMacros;\n${helper}`],
  ['/bubbles/portrait.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect width="200" height="400" fill="#29343e"/><circle cx="100" cy="70" r="45" fill="#ddd0c7"/><path d="M30 400V140Q100 80 170 140V400" fill="#2d5263"/></svg>'],
]);
http.createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const body = generated.get(url.pathname) ?? (files.has(url.pathname) ? fs.readFileSync(files.get(url.pathname)) : null);
    if (body === null) { response.writeHead(404).end(); return; }
    const type = url.pathname.endsWith('.woff2') ? 'font/woff2' : url.pathname.endsWith('.svg') ? 'image/svg+xml' : /\.(?:js|mjs)$/.test(url.pathname) ? 'text/javascript' : 'text/html; charset=utf-8';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
}).listen(8871, '127.0.0.1', () => console.log('http://127.0.0.1:8871/bubbles/'));
