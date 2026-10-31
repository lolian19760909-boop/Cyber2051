'use strict';
const {inlineSource} = require('../../lib/inline-source.cjs');
const Theme = require('../../lib/ui-theme.cjs');
const assert = require('node:assert/strict');
const {extract} = require('../../lib/script-modules.cjs');
const {walk, workerNode} = require('../../lib/card-ast.cjs');
const {parse, findNodes, applyEdits, fillScriptSlots, replaceSlot} = require('../../lib/source-edits.cjs');
const {reportStartupErrors} = require('../../lib/startup-instrument.cjs');
const Bundles = require('./script-bundles.cjs');
const registry = require('./module-sources.json');
const sources = registry.modules;
const mapRecipe = registry.embeddedDocuments.maps;
// 后加载的脚本不再重复内联同一模块：先加载脚本里的正本已经挂在 globalThis 上。
// 缺模块时把名字记进 __cxxMissingModules 并打一行能看懂的 console.error，避免静默出错。
function assembleScript(s, {source, useSource, code, counts, historyWorker, openingPages, version, chipNightEnabled, shared}) {
  const style = file => Theme.sheet(source, file);
  const page = file => {
    const html=Theme.html(source,file);if(file!=='MVU/templates/status0.html')return html;
    const sprites=require('../../../卡片源码/Gal/sprites.js'),dialogue=require('../../../卡片源码/正文/dialogue.js'),media=JSON.parse(source('Gal/standing-media.json'));
    const fallback=Object.fromEntries(dialogue.portraits.map(c=>[c.name,sprites.sprite(c.id,'https://cyber2051.top','normal',media)]).filter(([,url])=>url));
    assert(html.includes('/*__CXX_STATUS_STANDING__*/{}'),'Native standing placeholder');
    return html.replace('/*__CXX_STATUS_STANDING__*/{}',JSON.stringify(fallback));
  };
  let text = s.content;
  if (!text)
    return text;
  const tree = parse(text);
  const changes = extract(text, Object.keys(sources)).map(m => {
    useSource(sources[m.name]);
    // 每个角色脚本在酒馆助手里各自独立的 iframe/globalThis 执行：
    // 别的脚本里 root.X = api 不会成为本脚本的全局，所以不能跨脚本去重，
    // 否则裸引用 CxxUpdateCore 之类的名字会 ReferenceError（2.3.20 现场故障）。
    counts[m.name] = (counts[m.name] || 0) + 1;
    return {
      ...m,
      value: code[m.name]
    };
  });
  const dataSources = registry.dataSources || {};
  walk(tree, n => {
    if (n.type === 'AssignmentExpression') {
      const d = dataSources[n.left.property?.name];
      if (d?.script === s.id)
        changes.push({
          start: n.right.start,
          end: n.right.end,
          value: source(d.file).trim()
        });
    }
  });
  if (s.id === 'cxx-business-core-241') {
    const node = workerNode(text);
    changes.push({
      start: node.start,
      end: node.end,
      value: inlineSource(JSON.stringify(historyWorker.source))
    });
    counts.historyWorker = 1;
  }
  if (s.id === 'cxx-native-ui-231') {
    const terminals = findNodes(tree, n => n.type === 'CallExpression' &&
      n.callee.object?.name === 'Cxx233TerminalFactory' && n.callee.property?.name === 'create');
    assert.equal(terminals.length, 1, 'One terminal document slot');
    const html = terminals[0].arguments[0].properties.find(p => p.key.name === 'html').value;
    changes.push({
      start: html.start,
      end: html.end,
      value: inlineSource(JSON.stringify(require('../../lib/journal-build.cjs').terminal(source)))
    });
    counts.journal = 1;
  }
  if (s.id === 'cxx-native-ui-231')
    walk(tree, n => {
      if (n.type === 'VariableDeclarator' && n.id.name === 'CXX_NATIVE_CSS') {
        changes.push({
          start: n.init.start,
          end: n.init.end,
          value: inlineSource(JSON.stringify(style('原生/prose.css')))
        });
        counts.nativeStyle = (counts.nativeStyle || 0) + 1;
      }
      if (n.type === 'VariableDeclarator' && n.id.name === 'documents') {
        changes.push({
          start: n.init.start,
          end: n.init.end,
          value: source(mapRecipe.catalog).trim()
        });
        counts.mapDocuments = (counts.mapDocuments || 0) + 1;
      }
      if (n.type === 'FunctionDeclaration' && n.id.name === 'install') {
        const configured = replaceSlot(source(mapRecipe.installer), '/*MAP_RESOURCE_CONFIG*/', source(mapRecipe.resources).trim());
        const install = replaceSlot(configured, '/*MAP_SHELL_RUNTIME*/', [...(mapRecipe.prelude||[]),mapRecipe.runtime].map(file=>source(file)).join('\n;\n'));
        changes.push({
          start: n.start,
          end: n.end,
          value: inlineSource(install)
        });
        counts.mapShell = (counts.mapShell || 0) + 1;
      }
      if (n.type === 'FunctionDeclaration' && n.id.name === 'prepare') {
        const sheets = [
          style(mapRecipe.styles[0]),
          ...mapRecipe.styles.slice(1).map(file => source(file))
        ];
        changes.push({
          start: n.start,
          end: n.end,
          value: inlineSource('function prepare(html){return CxxAtlasDocumentStyle.prepare(html,' + JSON.stringify(sheets) + ',' + JSON.stringify(require('../../../卡片源码/地图/place-build.cjs').load(source).places) + ','+JSON.stringify({atlas:source('地图/atlas.js'),api:source('地图/map-api.js')})+','+source('地图/industrial-parks.json')+');}')
        });
        counts.mapStyles = (counts.mapStyles || 0) + 1;
      }
      if (n.type === 'CallExpression' && n.callee.object?.name === 'CxxAtlasToolFactory' && n.callee.property?.name === 'create') {
        const sheets = {
          shell: Theme.scopedSheet(source, mapRecipe.shellStyle, '.cxx-atlas-tool,.cxx-atlas-tool::backdrop'),
          reading: source(mapRecipe.readingStyle)
        };
        for (const p of n.arguments[0].properties.find(p => p.key.name === 'styles').value.properties) {
          const name = p.key.name || p.key.value;
          assert(Object.hasOwn(sheets, name), 'Map style: ' + name);
          changes.push({
            start: p.value.start,
            end: p.value.end,
            value: inlineSource(JSON.stringify(sheets[name]))
          });
        }
      }
      if (n.type === 'CallExpression' && n.callee.object?.name === 'Cxx233Components') {
        const templates = n.arguments[0].properties.find(p => p.key.name === 'templates').value;
        for (const p of templates.properties) {
          const id = p.key.name || p.key.value;
          if (['status0', 'mvu', 'options', 'music12', 'music13', 'music14', 'music15'].includes(id)) {
            changes.push({
              start: p.value.start,
              end: p.value.end,
              value: inlineSource(JSON.stringify(page('MVU/templates/' + id + '.html')))
            });
            counts[id] = 1;
          }
        }
      }
      if (n.type === 'ObjectExpression' && n.properties.some(p => p.key && (p.key.name || p.key.value) === 'id' && p.value.value === 'q_heist')) {
        const unlock = n.properties.find(p => (p.key.name || p.key.value) === 'unlock');
        if (unlock)
          changes.push({
            start: unlock.value.start,
            end: unlock.value.end,
            value: JSON.stringify('完成2单任意委托')
          });
      }
    });
  if (s.id === 'cxx-business-core-241')
    walk(tree, n => {
      if (n.type === 'CallExpression' && n.callee.object?.name === 'Cxx236Variables') {
        const greetings = n.arguments[0].properties.find(p => p.key.name === 'greetings');
        if (greetings)
          changes.push({
            start: greetings.value.start,
            end: greetings.value.end,
            value: '[]'
          });
      }
    });
  const slots = {};
  if (s.id === 'cxx-business-core-241') {
    slots['shared-runtime'] = inlineSource([
      'MVU/variable-mode.js',
      '运行时/growth-repair.js',
      '运行时/reroll.js',
      '通讯/reading-guard.js',
      '通讯/source-service.js',
      '共享/worldbook-editor.js',
      '共享/shared-runtime.js'
    ].map(file => source(file)).join('\n;\n'));
    counts.runtime = 1;
  }
  if (s.id === 'cxx-galgame-g1-local')
    slots['gal-host'] = inlineSource(source('Gal/host.js'));
  if (s.id === 'cxx-galgame-g1-local')
    walk(tree, n => {
      if (n.type === 'VariableDeclarator' && n.id.name === 'CXX_GAL_STANDING') {
        changes.push({ start: n.init.start, end: n.init.end, value: inlineSource('(' + source('Gal/standing-media.json').trim() + ')') });
        counts.standingMedia = (counts.standingMedia || 0) + 1;
      }
      if (n.type === 'VariableDeclarator' && n.id.name === 'CXX_GAL_STYLE') {
        changes.push({
          start: n.init.start,
          end: n.init.end,
          value: inlineSource(JSON.stringify(style('Gal/style.css') + '\n' + source('Gal/host.css')))
        });
        counts.galStyle = (counts.galStyle || 0) + 1;
      }
    });
  if (s.id === 'cxx-business-core-241')
    walk(tree, n => {
      if (n.type === 'AssignmentExpression' && n.left.property?.name === 'CxxOpeningStyle') {
        changes.push({
          start: n.right.start,
          end: n.right.end,
          value: inlineSource(JSON.stringify(style('运行时/opening-ui.css')))
        });
        counts.openingStyle = (counts.openingStyle || 0) + 1;
      }
    });
  if (s.id === 'cxx-business-core-241' || s.id === 'cxx-native-ui-231')
    walk(tree, n => {
      if (n.type === 'AssignmentExpression' && n.left.property?.name === 'CxxOpeningCatalog')
        changes.push({
          start: n.right.start,
          end: n.right.end,
          value: source('开场/catalog.json').trim()
        });
      if (n.type === 'Property' && n.key.name === 'pages' && n.value.type === 'ArrayExpression' && n.value.elements.length >= 24)
        changes.push({
          start: n.value.start,
          end: n.value.end,
          value: '[' + n.value.elements.slice(0, 12).map(v => text.slice(v.start, v.end)).join(',') + ']'
        });
    });
  text = applyEdits(text, changes);
  if (s.id === 'cxx-business-core-241') {
    slots['opening-startup'] = '\n' + inlineSource(source('MVU/opening-startup.js')) +
      '\nCxxOpeningStartupFactory.install({win:parent,api:globalThis,runtime:parent.Cxx233Runtime,pages:' +
      openingPages +
      '});';
    counts.openingStartup = 1;
  }
  text = fillScriptSlots(text, slots);
  text = reportStartupErrors(text, s);
  text = Bundles.prefixModules(text, changes, s, {
    source,
    version,
    chipNightEnabled
  });
  return text;
}
module.exports = { assembleScript };
