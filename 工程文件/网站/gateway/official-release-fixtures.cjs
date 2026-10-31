'use strict';
// 合成测试材料，不读取用户卡或任何已配置密钥。
const crypto = require('node:crypto');
const P = require("../../工具/发布/packages.cjs");
const UPDATER_ID = 'cf33c692-7a41-444d-b8b7-6a70163e0104';
const quest = (id = 'q01') => ({ id, title: '本地验收任务', fixer: '合成测试联系人', district: '红花街', type: '回收', difficulty: '低', pay: 100, brief: '只用于本地确定性验收。', goal: '完成测试。' });
function content(id = 'test.dlc', version = '1.0.0', optional = true) {
  return { id, version, optional, activation: optional ? 'opt_in' : 'compatible', requires: { engine: '1.0.0', packages: [] }, content: { quests: [quest(id + '.quest')], gallery: [], worldbook: [] } };
}
function card(pem, version = '1.0.0') {
  const base = { quests: [quest()], gallery: [{ id: 'base.sakiko.standard.1', characterId: 'sakiko', category: 'standard', url: 'https://cyber2051.top/img/test-only.png' }], worldbook: [] };
  const spki = crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' }).toString('base64');
  const seed = { cardId: 'cyber2051', engineVersion: '1.0.0', baseVersion: version, catalogUrl: 'https://cyber2051.top/updates/v3/manifest.json', trustedKeys: { 'test.key': spki }, characterIds: P.CONSUMED_CHARACTER_IDS, mapIndex: {}, initialContent: base,
    registry: { format: 1, packages: { 'cyber2051.base-content': { version, optional: false, activation: 'compatible', content: base, history: {}, historyActivation: {} } } } };
  return { spec: 'chara_card_v2', data: { name: '本地验收卡V' + version, character_version: version,
    character_book: { name: '本地验收世界书 ' + version, entries: [{ id: 1, comment: '本地测试', content: '合成正文', keys: ['测试'], enabled: true, extensions: {} }] },
    extensions: { world: '本地验收世界书 ' + version, regex_scripts: [{ id: 'test.regex', scriptName: '本地测试正则', placement: [2], findRegex: 'test', replaceString: 'tested', markdownOnly: true }],
      tavern_helper: { scripts: [{ id: UPDATER_ID, type: 'script', name: '本地测试脚本', content: 'void 0;', enabled: true, data: { __cxx_update_seed: seed } }] } } } };
}
function keys() {
  const pair = crypto.generateKeyPairSync('ed25519'); // 仅临时测试密钥，绝不用于正式发行。
  return { privateKey: pair.privateKey, pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() };
}
module.exports = { card, content, quest, keys };
