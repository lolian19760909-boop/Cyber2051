'use strict';
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('D:/SillyTavern/node_modules/acorn');
const {sha} = require('../lib/card-ast.cjs');
const {inlineSource} = require("../lib/inline-source.cjs");
const Theme = require('../lib/ui-theme.cjs');
const Release = require("../../卡片源码/运行时/release.js");
async function make({write = false, cardFile = null, version = require('./当前/build.cjs').version, sourceFiles = []} = {}) {
  const root = path.resolve(__dirname, '../..');
  const cardBytes = fs.readFileSync(cardFile || require('./当前/build.cjs').output);
  const card = JSON.parse(cardBytes);
  const up = card.data.extensions.tavern_helper.scripts.find(s => s.id === Release.UPDATER);
  const sourceInputs = {};
  const read = file => {
    const text = fs.readFileSync(path.join(root, '卡片源码', file), 'utf8').replace(/\r\n/g, '\n');
    sourceInputs['卡片源码/' + file] = {
      sha256: sha(text),
      bytes: Buffer.byteLength(text)
    };
    return text;
  };
  if (card.data.character_version !== version)
    throw Error('Upgrade tool version must match its exact target card');
  const dir = path.resolve(__dirname, '../../.cache/build');
  const sources = new Map();
  for (const {
        name,
        sha256: h
      } of require('./旧版来源.json').sources) {
    if (!sources.has(h))
      sources.set(h, {
        sha256: h,
        versions: []
      });
    sources.get(h).versions.push(name);
  }
  const manifest = {
    format: 1,
    type: 'cyber2051.updater-upgrade',
    updaterId: Release.UPDATER,
    version,
    targetHash: sha(up.content),
    sources: [...sources.values()].filter(s => s.sha256 !== sha(up.content))
  };
  const modules = require('../lib/updater.cjs').modulePrefix(up.content);
  const source = modules.includes('root.CxxUpdaterUpgrade') ? '' : read('运行时/upgrader.js');
  const ui = read('运行时/upgrader-ui.js');
  const style = Theme.scopedSheet(read, '运行时/upgrader-ui.css', '[data-cxx-legacy-updater]');
  const entry = [
    '\n;(function(){\n let view;\n',
    ' const tool=CxxUpdaterUpgrade.create({api:globalThis,manifest:' + JSON.stringify(manifest),
    ',content:' + JSON.stringify(up.content) + ',report:message=>view?.report(message)});\n',
    ' view=CxxUpgradePanel.mount({document:parent.document,tool,version:' + JSON.stringify(version),
    ",subscribe:show=>{const name=getButtonEvent('旧版续玩工具');eventOn(name,show);",
    'return()=>eventRemoveListener(name,show);}});\n',
    " window.addEventListener('pagehide',()=>view.destroy(),{once:true});\n})();"
  ].join('');
  const content = inlineSource('globalThis.CxxUpgradeStyle=' + JSON.stringify(style) + ';\n' + modules + '\n;\n' + source + '\n' +
    ui +
    '\n' +
    entry);
  acorn.parse(content, {
    ecmaVersion: 'latest',
    sourceType: 'module'
  });
  const script = {
    type: 'script',
    id: 'cxx-updater-upgrade-216',
    name: '东京都2051｜旧版续玩工具',
    enabled: true,
    content,
    info: '导入酒馆助手全局脚本，在旧卡聊天点击“旧版续玩工具”。无需先升级更新器，即可导出并在新版导入为续玩副本。已登记版本见工具清单。更多操作保留原地更新器升级。目标 ' + version + '。',
    button: {
      enabled: true,
      buttons: [{
          name: '旧版续玩工具',
          visible: true
        }]
    },
    data: {},
    export_with: {
      data: true,
      button: true
    }
  };
  const file = '东京都2051-旧版续玩工具-' + version + '.json';
  const text = JSON.stringify(script, null, 2) + '\n';
  for (const file of ['工具/构建/upgrade-tool.cjs', '工具/lib/ui-theme.cjs']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    sourceInputs[file] = {
      sha256: sha(text),
      bytes: Buffer.byteLength(text)
    };
  }
  const sourceReceipt = {
    format: 1,
    type: 'cyber2051.upgrade-tool-sources',
    version,
    target: {
      cardSHA256: sha(cardBytes),
      updaterSHA256: manifest.targetHash,
      modulePrefixSHA256: sha(modules)
    },
    output: {
      file,
      bytes: Buffer.byteLength(text),
      sha256: sha(text)
    },
    normalization: 'LF source fingerprints',
    maintenanceSources: sourceInputs
  };
  if (write) {
    fs.mkdirSync(dir, { recursive: true });
    const manifestFile = version === '2.1.6' ? 'upgrade-manifest.json' : 'upgrade-manifest-' + version + '.json';
    fs.writeFileSync(path.join(dir, manifestFile), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, file), text);
    fs.writeFileSync(path.join(dir, 'upgrade-tool-sources-' + version + '.json'), JSON.stringify(sourceReceipt, null, 2) + '\n');
  }
  return {
    manifest,
    script,
    sourceReceipt
  };
}
module.exports = { make };
if (require.main === module) {
  const args = process.argv.slice(2);
  const value = k => args.includes(k) ? args[args.indexOf(k) + 1] : undefined;
  make({
    write: args.includes('--write'),
    cardFile: value('--card'),
    version: value('--version') || require('./当前/build.cjs').version
  }).then(r => console.log(JSON.stringify({
    sources: r.manifest.sources.map(s => ({
      sha256: s.sha256,
      versions: s.versions.length
    })),
    targetHash: r.manifest.targetHash,
    bytes: Buffer.byteLength(r.script.content)
  }, null, 2))).catch(e => {
    console.error(e.stack);
    process.exitCode = 1;
  });
}
