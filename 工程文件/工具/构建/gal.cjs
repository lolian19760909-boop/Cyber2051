'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const dir = path.resolve(__dirname,'../../卡片源码/Gal'), outputArg = process.argv.indexOf('--out');
const out = outputArg >= 0 ? path.resolve(process.argv[outputArg + 1] || '') : path.resolve(__dirname,'../../.cache/gal');
if (outputArg >= 0) {
  const relative = path.relative(path.resolve(__dirname, '../../.cache'), out);
  if (!process.argv[outputArg + 1] || !relative || relative.startsWith('..') || path.isAbsolute(relative) || fs.existsSync(out)) throw Error('--out 必须是 .cache 内未存在的目录');
}
const names = ["../运行时/identity.js", "../运行时/gameplay.js", "../运行时/content.js", 'parser.js', 'sprites.js', 'backgrounds.js', 'media-inventory.json', 'standing-media.json', 'hud.js', 'integrations/m18/opening-link.js', 'integrations/m18/terminal-host-state.js', 'opening-session.js', 'opening-manifest.json', 'identity-opening.js', 'opening-view.js', 'ui.js', 'controller.js', 'terminal-bridge.js', 'status-bridge.js', 'workshop-bridge.js', 'opening-bridge.js', 'prompt.js', 'mode.js', 'host.js', 'style.css', 'opening.css'];
const sources = Object.fromEntries(names.map(name => [name, fs.readFileSync(path.join(dir, name), 'utf8')]));
const media = JSON.parse(sources['media-inventory.json']).files.map(({ file, sha256 }) => ({ file, sha256 }));
const standing = JSON.parse(sources['standing-media.json']).files;
const mediaOrigin = process.argv.includes('--production-media') ? 'https://cyber2051.top' : 'http://127.0.0.1:6911';
const revision = crypto.createHash('sha256').update(names.map(name => sources[name]).join('\n')).update(mediaOrigin).digest('hex').slice(0, 16);
const content = `(function(){\nconst CXX_GAL_REVISION=${JSON.stringify(revision)};\nconst CXX_GAL_MEDIA=${JSON.stringify(media)};\nconst CXX_GAL_STANDING=${JSON.stringify(standing)};\nconst CXX_GAL_MEDIA_BASE=${JSON.stringify(mediaOrigin)};\nconst CXX_GAL_OPENING_MANIFEST=${JSON.stringify(JSON.parse(sources['opening-manifest.json']))};\nconst CXX_GAL_STYLE=${JSON.stringify(sources['style.css'] + '\n' + sources['opening.css'])};\n${names.filter(n => n.endsWith('.js')).map(n => sources[n]).join('\n')}\n})();`;
new vm.Script(content);
const helper = { type: 'script', enabled: true, name: 'Gal 阅读 · 本机验证', id: 'cxx-galgame-g1-local', content,
  info: '独立Gal验证组件；可选阅读、原生发送及开启时的台词署名约定。默认关闭。背景与常规立绘来自' + mediaOrigin + '，不是正式发布包。',
  button: { enabled: true, buttons: [{ name: 'Gal 模式', visible: true }] }, data: {}, export_with: { data: false, button: true } };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'galgame-g1.script.json'), JSON.stringify(helper, null, 2) + '\n');
// A minimal newly authored harness, never a rebuilt or overwritten production card.
const raw = '祥子：你来了。\n\n雨声掠过屋檐，终端屏幕照亮了她的侧脸。\n\n祥子：先确认你的路线。\n\n<ztl>{"date":"2051-10-03","time":"22:17","location":"RiNG · 接待区","characters":[{"name":"丰川祥子","outfit":"黑色外套","thought":"等候答复"}]}</ztl>\n<xuan>\n1. 询问路线\n2. 查看终端\n3. 留在原地\n4. 回应祥子\n5. 暂时沉默\n</xuan>';
const fixture = { spec: 'chara_card_v2', spec_version: '2.0', data: {
  name: 'Gal G1 隔离验收', description: '仅用于本机界面测试。', personality: '', scenario: '',
  first_mes: raw, mes_example: '', creator_notes: '最小测试卡，无正式卡世界书/MVU/终端。',
  system_prompt: '', post_history_instructions: '', alternate_greetings: ['祥子：这是第二个开场。'],
  tags: ['G1-local-test'], creator: 'local-test', character_version: revision,
  extensions: { tavern_helper: { scripts: [helper], variables: {} }, regex_scripts: [] },
}};
fs.writeFileSync(path.join(out, 'galgame-g1.fixture-card.json'), JSON.stringify(fixture, null, 2) + '\n');
const receipt = { revision, mediaOrigin, purpose: 'G1 isolated local test; not a full-card release', files: names.map(name => ({ name,
  sha256: crypto.createHash('sha256').update(sources[name]).digest('hex'), bytes: Buffer.byteLength(sources[name]) })) };
fs.writeFileSync(path.join(out, 'build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
