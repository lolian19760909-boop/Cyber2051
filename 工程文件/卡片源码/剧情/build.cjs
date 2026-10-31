'use strict';
const assert = require('node:assert/strict');
const Model = require('./line-model.js');
const Engine = require('./line-engine.js');

function load(source, {entries, assets = []} = {}) {
  const index = JSON.parse(source('剧情/线/index.json'));
  assert.equal(index.schema, 1, '剧情线索引版本无效');
  assert(Array.isArray(index.lines), '剧情线索引需要 lines 数组');
  assert.equal(new Set(index.lines).size, index.lines.length, '剧情线文件重复登记');
  if (!index.lines.length) return [];
  const worldbook = entries || JSON.parse(source('世界书/entries.json')).entries.map(e => ({...e, content: source(e.file)}));
  const usedLore = new Set();
  const lines = index.lines.map(file => {
    assert(/^[a-zA-Z][\w-]*\.json$/.test(file), '剧情线文件名必须是稳定编号.json');
    const line = JSON.parse(source('剧情/线/' + file));
    assert.equal(line.id + '.json', file, '剧情线文件名与编号不符');
    assert(Array.isArray(line.nodes), '剧情线缺少节点数组');
    return {...line, nodes: line.nodes.map(node => {
      assert(Number.isInteger(node.lore) && !usedLore.has(node.lore), '剧情节点世界书编号无效或重复');
      usedLore.add(node.lore);
      const entry = worldbook.find(e => e.id === node.lore);
      assert(entry && entry.enabled === false, '剧情节点必须绑定默认关闭的世界书条目');
      assert((entry.keys || []).includes('__cxx_node_' + line.id + '_' + node.id), '剧情节点世界书触发键不匹配');
      assert(!Object.hasOwn(node, 'content'), '剧情正文只维护在世界书，不在节点数据重复存放');
      for (const picture of node.illustrations || []) {
        const asset = assets.find(a => a.file === picture.file);
        assert(asset, '剧情插图尚未登记到资源包：' + picture.file);
        assert(typeof asset.url === 'string' && asset.url.trim(), '剧情插图缺少资源地址：' + picture.file);
        assert(asset.width > 0 && asset.height > 0 && asset.width * 9 === asset.height * 16, '剧情插图须为16:9：' + picture.file);
      }
      return {...node, content: entry.content, ...(node.illustrations ? {illustrations: node.illustrations.map(picture => ({...picture, url: assets.find(a => a.file === picture.file).url}))} : {})};
    })};
  });
  Model.validate(lines);
  // One node must fit the same selection budget used during play.
  for (const line of lines) for (const node of line.nodes) {
    const size = node.title.length + line.title.length + node.content.length + JSON.stringify(node.conditions).length + JSON.stringify(node.outcomes || {}).length + JSON.stringify(node.choices || {}).length;
    assert(size <= 10000, '剧情节点超过单轮预算，请拆分：' + line.id + '/' + node.id);
  }
  Engine.create(lines);
  return lines;
}
module.exports = {load};
