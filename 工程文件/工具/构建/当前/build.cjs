'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const crypto = require('crypto');
const acorn = require('acorn');
const {extract} = require('../../lib/script-modules.cjs');
const {inlineSource} = require('../../lib/inline-source.cjs');
const {withoutAuto, componentsOf} = require('../../lib/updater.cjs');
const {workerNode} = require('../../lib/card-ast.cjs');
const root = path.resolve(__dirname, '../../..');
const version = '3.0.0';
const resourceVersion = '2.3.4';
const input = path.join(root, '卡片源码/装配/manifest.json');
const output = path.join(root, `.cache/build/东京都2051-V${ version }.json`);
const cache = path.join(root, '.cache/mirror220');
const loadInput = (file = input) => require('../../lib/assembly-source.cjs').load(file);
const Core = require('../../../卡片源码/运行时/core.js');
const Release = require('../../../卡片源码/运行时/release.js');
const Parser = require('../../../卡片源码/Gal/parser.js');
const Sprites = require('../../../卡片源码/Gal/sprites.js');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const sourceFiles = new Map();
const source = file => {
  const text = fs.readFileSync(path.join(root, '卡片源码', file), 'utf8').replace(/\r\n/g, '\n');
  sourceFiles.set(file, {
    sha256: sha(text),
    bytes: Buffer.byteLength(text)
  });
  return text;
};
const Theme = require('../../lib/ui-theme.cjs');
const maintainedSource = source;
// 数据/schema.js 由数据/表格模板生成：模板改了却没重跑生成器，卡里就会留旧表结构。
// 这里在构建时核对模板指纹，让漂移在构建阶段失败，而不是等到真机才发现表对不上。
(function assertSchemaMatchesTemplate() {
  const fsx = require('fs');
  const pathx = require('path');
  const cryptx = require('crypto');
  const schemaFile = pathx.join(__dirname, '../../卡片源码/数据/schema.js');
  if (!fsx.existsSync(schemaFile)) return;
  const text = fsx.readFileSync(schemaFile, 'utf8');
  const sha = /__templateSha256:'([0-9a-f]{64})'/.exec(text);
  const name = /__template:"([^"]+)"/.exec(text);
  if (!sha || !name) throw new Error('数据/schema.js 缺少 __template/__templateSha256，请重跑 .cache/diagnostics/2326-xinghai/build-schema.cjs');
  const templatePath = pathx.join(__dirname, '../..', name[1]);
  if (!fsx.existsSync(templatePath)) throw new Error('数据/schema.js 记录的模板不存在：' + name[1]);
  const actual = cryptx.createHash('sha256').update(fsx.readFileSync(templatePath)).digest('hex');
  if (actual !== sha[1]) throw new Error('数据/schema.js 与 ' + name[1] + ' 不一致：模板改过但没重跑生成器');
})();
const registry = require('./module-sources.json');
const sources = registry.modules;
const Bundles = require('./script-bundles.cjs');
const {assembleScript} = require('./assemble-scripts.cjs');
const {replaceSlot} = require('../../lib/source-edits.cjs');
const HistoryWorker = require('../../lib/history-worker.cjs');
function profiles(card, read = source) {
  const result = {};
  const assets = JSON.parse(read('Gal/standing-media.json'));
  for (const p of Sprites.characters) {
    const name = p.name;
    const e = card.data.character_book.entries.find(e => e.id === p.worldbookUid);
    assert(e, name);
    const m = /【性格与行为动机】([\s\S]*?)(?:心理特征：|【|$)/.exec(e.content);
    assert(m, name);
    result[p.id] = {
      name,
      personality: m[1].trim().slice(0, 3500),
      avatar: Sprites.sprite(p.id, 'https://cyber2051.top', 'normal', assets)
    };
  }
  return result;
}
const phoneCode = (card, read = source) => Bundles.phoneCode(card, read, profiles);
async function build({write = false, assemblyFile = input, includeResources = false} = {}) {
  const sourceUses = new Map();
  let sourceTarget = 'build:shared';
  const useSource = (file, target = sourceTarget) => {
    if (!sourceUses.has(file))
      sourceUses.set(file, new Set());
    sourceUses.get(file).add(target);
  };
  const source = (file, target = sourceTarget) => {
    useSource(file, typeof target === 'string' ? target : sourceTarget);
    return maintainedSource(file);
  };
  const style = file => Theme.sheet(source, file);
  const page = file => Theme.html(source, file);
  sourceFiles.clear();
  const loreScope = JSON.parse(source('世界书/entries.json'));
  const chipNightEnabled = (loreScope.chapters || []).includes('chip-night');
  const original = loadInput(assemblyFile);
  const bytes = Buffer.from(JSON.stringify(original));
  const card = structuredClone(original);
  const retired = new Set(loreScope.retiredIds || []);
  assert([...retired].every(Number.isInteger), 'Retired worldbook IDs must be integers');
  assert(!loreScope.entries.some(row => retired.has(row.id)), 'Retired worldbook IDs cannot be reused');
  const scripts = card.data.extensions.tavern_helper.scripts;
  const edits = [];
  const counts = {};
  function set(parts, value) {
    let o = card;
    for (const k of parts.slice(0, -1))
      o = o[k];
    const k = parts.at(-1);
    edits.push({
      parts,
      old: structuredClone(o[k])
    });
    o[k] = value;
  }
  set(['data', 'character_book', 'entries'], card.data.character_book.entries.filter(entry => !retired.has(entry.id)));
  source('正则/build.cjs', 'build:regex');
  set(['data', 'extensions', 'regex_scripts'], require('../../../卡片源码/正则/build.cjs').build(file => source(file, 'build:regex')));
  const code = Object.fromEntries(Object.entries(sources).map(([n, f]) => {
    const m = extract(inlineSource(withoutAuto(source(f))), [n]);
    assert.equal(m.length, 1, n);
    return [
      n,
      m[0].source
    ];
  }));
  const historyWorker = HistoryWorker.build({
    read: file => {
      useSource(file, 'script:cxx-business-core-241');
      return source(file, 'worker:history');
    }
  });
  for (const [name, text] of Object.entries(historyWorker.modules))
    assert.equal(text, code[name], 'Shared main/worker source: ' + name);
  sourceTarget = 'script:cxx-business-core-241';
  const openingPages = '[' +
    Array.from({ length: 12 }, (_, i) => inlineSource(JSON.stringify(page('MVU/openings/' + String(i).padStart(2, '0') + '.html')))).join(',') +
    ']';
  const sharedModules = new Set();
  for (const [i, script] of scripts.entries()) {
    sourceTarget = 'script:' + script.id;
    const content = assembleScript(script, {
      source,
      useSource,
      code,
      counts,
      historyWorker,
      openingPages,
      version,
      chipNightEnabled,
      shared: sharedModules
    });
    if (content !== script.content)
      set(['data', 'extensions', 'tavern_helper', 'scripts', i, 'content'], content);
  }
  sourceTarget = 'build:fields';
  for (const n of Object.keys(sources))
    if (n !== 'CxxOperations')
      assert(counts[n], n);
  assert.equal(counts.galStyle, 1);
  assert.equal(counts.runtime, 1);
  for (const name of ['mapDocuments', 'mapShell', 'mapStyles'])
    assert.equal(counts[name], 1, name);
  set(['data', 'alternate_greetings'], card.data.alternate_greetings.slice(0, 11));
  for (const [id, file] of Object.entries(require('./module-sources.json').worldbookSources).map(([id, file]) => [
      Number(id),
      file
    ])) {
    const i = card.data.character_book.entries.findIndex(e => e.id === id);
    assert(i >= 0);
    set(['data', 'character_book', 'entries', i, 'content'], source(file, 'worldbook:' + id));
  }
  const lore = loreScope.entries;
  assert.equal(new Set(lore.map(e => e.id)).size, lore.length, 'Duplicate lore ID');
  for (const row of lore) {
    sourceTarget = 'worldbook:' + row.id;
    const entries = card.data.character_book.entries;
    const i = entries.findIndex(e => e.id === row.id);
    let entry;
    if (row.templateId !== undefined) {
      assert.equal(i, -1, 'Lore ID already exists: ' + row.id);
      const template = entries.find(e => e.id === row.templateId);
      assert(template && !template.constant, 'Green-light lore template');
      entry = {
        ...structuredClone(template),
        id: row.id,
        content: source(row.file),
        comment: row.comment,
        keys: row.keys,
        ...row.enabled !== undefined ? { enabled: row.enabled } : {}
      };
      entry.extensions.display_index = entries.length;
      entry.extensions.cfSortKey = entries.length;
      set(['data', 'character_book', 'entries'], [
        ...entries,
        entry
      ]);
    } else {
      assert(i >= 0, 'Missing lore ID: ' + row.id);
      set(['data', 'character_book', 'entries', i, 'content'], source(row.file));
      for (const field of ['comment', 'keys', 'enabled'])
        if (row[field] !== undefined)
          set(['data', 'character_book', 'entries', i, field], row[field]);
    }
    if (row.extensions !== undefined) {
      const index = card.data.character_book.entries.findIndex(e => e.id === row.id);
      set(['data', 'character_book', 'entries', index, 'extensions'], {
        ...card.data.character_book.entries[index].extensions,
        ...row.extensions
      });
    }
  }
  sourceTarget = 'script:cxx-phone-v1';
  const phone = {
    type: 'script',
    enabled: true,
    id: 'cxx-phone-v1',
    name: '2051 通讯器与镜译阅读',
    content: phoneCode(card, source),
    info: `V${ version }：使用镜译公开接口，原文/译文/对照与手动分角色朗读；独立联系人、私聊和通话。默认原文，不自动开启镜译设置。`,
    button: {
      enabled: true,
      buttons: [{
          name: '手机',
          visible: true
        }]
    },
    data: {},
    export_with: {
      data: false,
      button: true
    }
  };
  assert(!scripts.some(s => s.id === phone.id));
  scripts.push(phone);
  sourceTarget = 'script:cxx-long-memory-p1';
  source('剧情/build.cjs');
  const storyResourceProfile = JSON.parse(source('../资源/resource-profile.json', 'build:story-assets'));
  if (storyResourceProfile.standing) source('../' + storyResourceProfile.standing, 'build:standing-assets');
  const storyResourceProof = JSON.parse(source('../' + storyResourceProfile.provenance, 'build:story-assets'));
  const storyAssets = JSON.parse(source('运行时/media-pack.json')).files.map(asset => {
    const size = storyResourceProof.assets.find(row => row.sourceId === asset.sha256)?.sourceSize || [];
    return {...asset, width: size[0], height: size[1]};
  });
  const memory = require('../../../卡片源码/长期记忆/build.cjs').script(source, {entries: card.data.character_book.entries, assets: storyAssets});
  assert(!scripts.some(s => s.id === memory.id));
  memory.content = inlineSource(memory.content);
  scripts.push(memory);
  sourceTarget = 'build:fields';
  const oldCatalog = require('../../../卡片源码/装备/目录原始资料.json').items;
  const newCatalog = require('../../../卡片源码/运行时/item-catalog-data.js');
  for (const [i, e] of card.data.character_book.entries.entries())
    if (e.comment.startsWith('[mvu_plot]物品目录：')) {
      let content = e.content;
      const lines = content.split('\n');
      const listing = lines.slice(2).map(line => line.replace(/^[^：]*：/, '')).join('；');
      const names = [];
      for (const old of oldCatalog) {
        const full = [
          old.name,
          ...old.aliases
        ].filter(Boolean).find(name => listing.split('；').some(label => label === name || label.startsWith(name + '（') || label.endsWith('（' + name + '）')));
        if (full) {
          const d = newCatalog.find(old.id);
          names.push(d.name);
        }
      }
      if (!names.length)
        throw Error('装备目录分组为空：' + e.comment);
      set(['data', 'character_book', 'entries', i, 'content'], lines[0] + '\n' + [...new Set(names)].join('；'));
      const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const key = '/(?:(?:装备|武器|义体|型号|手枪|左轮|步枪|霰弹枪|冲锋枪|刀|改造)[^\\n。！？.!?]{0,36}(?:' + escaped + ')|(?:' + escaped +
        ')[^\\n。！？.!?]{0,36}(?:装备|武器|义体|手枪|左轮|步枪|霰弹枪|冲锋枪|刀|改造))/i';
      set(['data', 'character_book', 'entries', i, 'keys'], [
        ...e.keys,
        key
      ]);
    }
  sourceTarget = 'worldbook:79';
  const extraIndex = card.data.character_book.entries.findIndex(e => e.id === 0);
  set(['data', 'character_book', 'entries', extraIndex, 'comment'], '[mvu_update]变量输出格式 · 额外解析');
  set(['data', 'character_book', 'entries', extraIndex, 'enabled'], false);
  const configIndex = card.data.character_book.entries.findIndex(e => e.id === 57);
  assert.equal(card.data.character_book.entries[configIndex]?.comment, '[config_override]');
  set(['data', 'character_book', 'entries', configIndex, 'content'], '{}');
  const baseRule = card.data.character_book.entries[extraIndex];
  const [intro, ...promptSections] = source('MVU/prompts/0.txt').split('\n\n');
  const introLines = intro.split('\n');
  assert(introLines.length === 2 && promptSections.length, 'MVU prompt: title and mode introduction, then rule sections');
  const mainPrompt = [
    introLines[0],
    '正文模型在同一次回复中写出剧情、状态栏和选项，并在末尾输出本轮变量更新。依据已经发生的事实填写JSONPatch。',
    '',
    promptSections.join('\n\n')
  ].join('\n');
  const mainRule = {
    ...structuredClone(baseRule),
    id: 79,
    comment: '变量输出格式 · 正文解析',
    enabled: true,
    content: mainPrompt
  };
  const modeConfig = {
    ...structuredClone(baseRule),
    id: 80,
    comment: '旧变量配置（已合并）',
    enabled: false,
    content: '{}'
  };
  assert(!card.data.character_book.entries.some(e => e.id === 79 || e.id === 80));
  set(['data', 'character_book', 'entries'], [
    ...card.data.character_book.entries,
    mainRule,
    modeConfig
  ]);
  const activeConfigs = card.data.character_book.entries.filter(e => e.comment.trim().toLowerCase() === '[config_override]');
  assert.equal(activeConfigs.length, 1, 'MVU config must be unique');
  assert.equal(activeConfigs[0].enabled, false);
  for (const [parts, v] of [
      [
        ['name'],
        '东京都2051 V' + version
      ],
      [
        ['data', 'name'],
        '东京都2051 V' + version
      ],
      [
        ['data', 'character_version'],
        version
      ],
      [
        ['data', 'character_book', 'name'],
        '东京都2051 V' + version
      ],
      [
        ['data', 'extensions', 'world'],
        '东京都2051 V' + version
      ]
    ])
    set(parts, v);
  for (const s of scripts) {
    acorn.parse(s.content || '', {
      ecmaVersion: 'latest',
      sourceType: 'module'
    });
    assert(!/<\/script\b|<%/.test(s.content || ''));
    for (const m of extract(s.content || '', Object.keys(sources)))
      assert.equal(m.source, code[m.name]);
  }
  const business = c => c.data.extensions.tavern_helper.scripts.find(s => s.id === 'cxx-business-core-241').content;
  assert.equal(workerNode(business(card)).value, historyWorker.source);
  sourceTarget = 'script:' + Release.UPDATER;
  // Resource releases keep their published URL when only the card version changes.
  const ResourcePack = require('../../lib/resource-pack.cjs');
  const resourcePack = ResourcePack.make({
    card,
    root,
    version: resourceVersion,
    set
  });
  const resourceFile = path.join(root, '资源/P4玩家资源包-' + resourceVersion + '.zip');
  const menuScript = scripts.findIndex(s => s.id === Release.UPDATER);
  const titlePreview = source('运行时/title-preview.json');
  const titleAssets = Object.entries(JSON.parse(source('运行时/menu-assets.json')).entries)
    .filter(([id]) => ['city', 'Saki', 'wordmark'].includes(id));
  const titleResources = {
    baseUrl: resourcePack.manifest.baseUrl,
    entries: Object.fromEntries(titleAssets.map(([id, a]) => [
      id,
      {
        width: resourcePack.dimensions(a.sha256)?.[0] || {
          city: 2370,
          Saki: 1024,
          wordmark: 2172
        }[id],
        height: resourcePack.dimensions(a.sha256)?.[1] || {
          city: 1327,
          Saki: 1536,
          wordmark: 724
        }[id],
        fallback: resourcePack.token(id === 'wordmark' ? sha(fs.readFileSync(path.join(root, '卡片源码/主题/assets/Tokyo2051-logo-v223.png'))) : a.sha256)
      }
    ]))
  };
  const titlePrefix = inlineSource('globalThis.CxxTitlePreview=' + titlePreview +
    ';globalThis.CxxTitleResources=' + JSON.stringify(titleResources) + ';');
  set(['data', 'extensions', 'tavern_helper', 'scripts', menuScript, 'content'], titlePrefix + ';' + scripts[menuScript].content);
  sourceTarget = 'script:cxx-runtime-bootstrap';
  require('../../lib/live2d-build.cjs').validate(root, source);
  for (const [i, script] of scripts.entries()) {
    if (!script.content)
      continue;
    const content = Bundles.scriptRuntime(script, file => source(file, 'script:' + script.id));
    set(['data', 'extensions', 'tavern_helper', 'scripts', i, 'content'], content);
  }
  scripts.push(Bundles.bootstrap({
    scripts,
    source,
    version,
    resourcePack
  }));
  sourceTarget = 'seed:' + Release.UPDATER;
  const si = scripts.findIndex(s => s.id === Release.UPDATER);
  const seed = structuredClone(scripts[si].data.__cxx_update_seed);
  seed.baseVersion = version;
  seed.registry.packages['cyber2051.base-content'].version = version;
  for (const id of [
      Release.ID,
      'cyber2051.base-content'
    ])
    seed.installed[id].version = version;
  for (const list of [
      seed.initialContent.quests,
      seed.registry.packages['cyber2051.base-content'].content?.quests
    ])
    for (const q of list || [])
      if (q.id === 'q_heist')
        q.unlock = '完成2单任意委托';
  if (chipNightEnabled) {
    const chapter = JSON.parse(source('剧情/盗芯之夜.json'));
    assert.equal(chapter.stages.length, 8);
    for (const [i, part] of chapter.stages.entries()) {
      const entry = card.data.character_book.entries.find(e => e.id === 94 + i);
      assert.equal(entry.content.trim(), part.content);
      assert.equal(entry.enabled, false);
    }
    assert(!seed.initialContent.quests.some(q => q.id === chapter.quest.id));
    seed.initialContent.quests.push(structuredClone(chapter.quest));
    assert(!seed.registry.packages['cyber2051.chip-night']);
    seed.registry.packages['cyber2051.chip-night'] = {
      version: '1.0.0',
      optional: false,
      activation: 'compatible',
      content: {
        quests: [structuredClone(chapter.quest)],
        gallery: [],
        worldbook: []
      },
      history: {},
      historyActivation: {}
    };
    seed.installed['cyber2051.chip-night'] = { version: '1.0.0' };
  } else {
    seed.initialContent.quests = seed.initialContent.quests.filter(q => !['q_heist', 'q_chip_night'].includes(q.id));
    for (const pack of Object.values(seed.registry.packages))
      if (pack.content?.quests)
        pack.content.quests = pack.content.quests.filter(q => !['q_heist', 'q_chip_night'].includes(q.id));
  }
  scripts.at(-1).content = inlineSource(source('运行时/character-comparison.js', 'script:cxx-runtime-bootstrap') + ';\n' +
    source('运行时/character-cache-check.js', 'script:cxx-runtime-bootstrap')) +
    ';\n' +
    scripts.at(-1).content;
  scripts.at(-1).content = require('../../lib/runtime-prelude.cjs').prepend(scripts.at(-1).content, file => source(file, 'script:cxx-runtime-bootstrap'));
  for (const migration of [
      seed.migration,
      ...require('../当前续玩来源.json')
    ])
    if (!seed.migration.accepts.some(x => x.buildId === migration.buildId))
      seed.migration.accepts.push({
        buildId: migration.buildId,
        saveSchema: migration.saveSchema
      });
  // Each feedback owner carries only its scoped theme; no document-wide overrides.
  for (let i = 0; i < scripts.length; i++)
    if (scripts[i].content.includes('globalThis.CxxFeedbackStyle')) {
      sourceTarget = 'script:' + scripts[i].id;
      set(['data', 'extensions', 'tavern_helper', 'scripts', i, 'content'], inlineSource('globalThis.CxxFeedbackStyle=' +
        JSON.stringify(Theme.scopedSheet(source, '主题/feedback.css', '.cxx-feedback-theme')) +
        ';') +
        '\n;\n' +
        scripts[i].content);
    }
  for (const script of scripts)
    assert(!/\r\n/.test(script.content || ''), '助手脚本必须使用 LF 换行：' + script.id + '（' + script.name + '）');
  const cardBuild = sha(JSON.stringify({
    version,
    scripts: scripts.map(s => ({
      id: s.id,
      enabled: s.enabled,
      content: s.content
    })),
    book: card.data.character_book,
    regex: card.data.extensions.regex_scripts,
    greetings: [
      card.data.first_mes,
      ...card.data.alternate_greetings
    ],
    initialContent: seed.initialContent
  }));
  const bootstrapScript = scripts.at(-1);
  bootstrapScript.content = replaceSlot(bootstrapScript.content, '__CXX_CARD_BUILD__', cardBuild);
  const menuContent = 'globalThis.CxxGameMenuBuild=' + JSON.stringify(cardBuild) + ';' + scripts[menuScript].content;
  set(['data', 'extensions', 'tavern_helper', 'scripts', menuScript, 'content'], menuContent);
  const businessIndex=scripts.findIndex(s=>s.id==='cxx-business-core-241');
  set(['data','extensions','tavern_helper','scripts',businessIndex,'data'],{...scripts[businessIndex].data,__cxx_required_updater:{version,sha256:sha(scripts[si].content)}});
  seed.baseline = await Core.fingerprints(componentsOf(card.data));
  seed.migration.buildId = 'card:' + await Core.sha256(seed.baseline);
  seed.release = {
    ...seed.release,
    owned: Release.ownership(componentsOf(card.data))
  };
  set(['data', 'extensions', 'tavern_helper', 'scripts', si, 'data', '__cxx_update_seed'], seed);
  const restored = structuredClone(card);
  for (const e of edits.slice().reverse()) {
    let o = restored;
    for (const k of e.parts.slice(0, -1))
      o = o[k];
    o[e.parts.at(-1)] = e.old;
  }
  restored.data.extensions.tavern_helper.scripts.pop();
  restored.data.extensions.tavern_helper.scripts.pop();
  restored.data.extensions.tavern_helper.scripts.pop();
  assert.deepEqual(restored, original, 'Unrelated R1 fields preserved');
  scripts.unshift(scripts.pop());
  const handoffRequirement=scripts.find(s=>s.id==='cxx-business-core-241').data.__cxx_required_updater;
  assert.equal(handoffRequirement.version,version,'Business updater requirement version');
  assert.equal(handoffRequirement.sha256,sha(scripts.find(s=>s.id===Release.UPDATER).content),'Business gate must target the final packed updater code');
  seed.baseline = await Core.fingerprints(componentsOf(card.data));
  seed.migration.buildId = 'card:' + await Core.sha256(seed.baseline);
  seed.release.owned = Release.ownership(componentsOf(card.data));
  // 紧凑输出：缩进与换行在 2.3.16 实测占成卡 1,349.7KB（13.1%），对玩家只是下载负担。
  const text = JSON.stringify(card) + '\n';
  const tt = await require('../../../测试/宿主/check.cjs').checkCard(card);
  const receipt = {
    version,
    cardBuild,
    baseline: {
      file: assemblyFile,
      sha256: sha(bytes)
    },
    output: {
      file: output,
      bytes: Buffer.byteLength(text),
      sha256: sha(text)
    },
    modules: counts,
    maintenanceSources: Object.fromEntries(sourceFiles),
    added: [
      'CxxReadingGuard',
      'CxxMirrorSource',
      'cxx-phone-v1',
      'cxx-long-memory-p1',
      'cxx-runtime-bootstrap',
      'CxxResources',
      'CxxDiagnostics',
      'CxxVariableMode',
      'CxxSettingsUI',
      'CxxDraftExit'
    ],
    changedPaths: edits.map(e => e.parts.join('/')),
    resources: {
      ...resourcePack.stats,
      manifest: resourcePack.manifest.id,
      file: resourceFile
    },
    workerUnchanged: historyWorker.source === workerNode(business(original)).value,
    published: false,
    mirror: {
      version: '0.50.1',
      apiVersion: 2,
      commit: 'd584024d00720a3969b103170fd2ee767f76f405'
    },
    tt
  };
  receipt.historyWorker = {
    generated: true,
    ...HistoryWorker.spec,
    sources: Object.fromEntries(HistoryWorker.spec.modules.map(name => [
      name,
      sources[name]
    ])),
    sha256: sha(historyWorker.source),
    bytes: Buffer.byteLength(historyWorker.source),
    mainWorkerParity: true
  };
  receipt.sourceUses = Object.fromEntries([...sourceUses].map(([file, targets]) => [
    file,
    [...targets]
  ]));
  if (write) {
    fs.mkdirSync(cache, { recursive: true });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, text);
    const resourceReceipt = resourceFile + '.json';
    if (!fs.existsSync(resourceFile) || !fs.existsSync(resourceReceipt) || JSON.parse(fs.readFileSync(resourceReceipt)).manifest !== resourcePack.manifest.id)
      fs.writeFileSync(resourceReceipt, JSON.stringify(await ResourcePack.writePack(resourceFile, resourcePack), null, 2));
    require('./repair-tool.cjs')(card, output, source);
    await require('../upgrade-tool.cjs').make({
      write: true,
      cardFile: output,
      version
    });
    fs.writeFileSync(path.join(cache, 'build.json'), JSON.stringify(receipt, null, 2) + '\n');
  }
  return {
    card,
    receipt,
    ...(includeResources?{resourcePack}:{})
  };
}
module.exports = {
  build,
  root,
  version,
  input,
  loadInput,
  output,
  cache,
  sources,
  source,
  phoneCode,
  profiles
};
if (require.main === module)
  build({ write: process.argv.includes('--write') }).then(({receipt: r}) => console.log(JSON.stringify({
    version,
    output: r.output,
    modules: r.modules,
    TT: r.tt.cases.length
  }))).catch(e => {
    console.error(e);
    process.exitCode = 1;
  });
