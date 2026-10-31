'use strict';
const {inlineSource} = require('./inline-source.cjs');
const {replaceSlot: replaceOnce} = require('./source-edits.cjs');
function terminal(source) {
  const recipe = require('../构建/当前/module-sources.json').embeddedDocuments.terminal;
  const style = require('./ui-theme.cjs').sheet(source, recipe.styles[0]) + '\n' +
    recipe.styles.slice(1).map(file => source(file)).join('');
  const modules = [
    'window.CxxTerminalReadingStyle=' + JSON.stringify(source('终端/reading.css')) + ';',
    'window.CxxTerminalPlayerStyle=' + JSON.stringify(source('终端/player.css')) + ';',
    source(recipe.data),
    ...recipe.modules.map(file => file === '@crypto-compat' ? require('./crypto-compat.cjs').source(source) : source(file)),
    source(recipe.entry)
  ].join('\n;\n');
  const runtime = inlineSource(require('./runtime-prelude.cjs').prepend('window.CxxBootLoader=parent.CxxBootLoader;window.CxxVisualProjects=parent.CxxVisualProjects;'+replaceOnce(source(recipe.loader), '/*TERMINAL_MODULES*/', modules), source));
  return replaceOnce(replaceOnce(source(recipe.template), '/*TERMINAL_STYLE*/', '\n' + style + '\n'), '/*TERMINAL_RUNTIME*/', runtime);
}
module.exports = { terminal };
