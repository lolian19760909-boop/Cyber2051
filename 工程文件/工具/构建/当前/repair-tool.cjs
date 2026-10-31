const fs = require('fs');
const path = require('path');
const {inlineSource} = require('../../lib/inline-source.cjs');
const {prepend} = require('../../lib/runtime-prelude.cjs');
module.exports = function (card, output, source) {
  const repairSource = require('../../lib/crypto-compat.cjs').source(source) + ';' + source('运行时/script-repair.js') +
    ';const repair=CxxScriptRepair.mount({api:globalThis,top:parent,candidate:' +
    JSON.stringify(card.data.extensions.tavern_helper.scripts) +
    '});window.addEventListener("pagehide",()=>repair.destroy(),{once:true});';
  const content = prepend(inlineSource(repairSource), source);
  const script = {
      type: 'script',
      id: 'cxx-script-repair-223',
      name: '2051 角色脚本诊断与恢复',
      enabled: true,
      content,
      info: '导入酒馆助手全局脚本；在本卡聊天先诊断，再按需恢复。保留角色变量和其他脚本。恢复前自动下载原数据。',
      button: {
        enabled: true,
        buttons: [{
            name: '角色脚本诊断与恢复',
            visible: true
          }]
      },
      data: {},
      export_with: {
        data: false,
        button: true
      }
    };
  require('D:/SillyTavern/node_modules/acorn').parse(content, {
    ecmaVersion: 'latest',
    sourceType: 'module'
  });
  const file = path.join(path.dirname(output), '东京都2051-脚本诊断恢复工具-' + card.data.character_version + '.json');
  fs.writeFileSync(file, JSON.stringify(script, null, 2) + '\n');
  return file;
};
