'use strict';
const assert = require('node:assert/strict');
const Chapters = require('./chapter-engine.js');

function load(source, {entries} = {}) {
  const chapter = JSON.parse(source('剧情/盗芯之夜.json'));
  const detection = JSON.parse(source('长期记忆/detection.json'));
  const lines = Chapters.fromChapter(chapter, detection);
  if (entries) for (const line of lines) for (const node of line.nodes) {
    const entry = entries.find(item => item.id === node.lore);
    assert(entry && entry.enabled === false, '章节节点必须绑定默认关闭的世界书：' + node.id);
    const content = entry.content.replace(/\r\n/g, '\n').trim();
    assert.equal(content, node.content.replace(/\r\n/g, '\n'), '章节正文与当前世界书不一致：' + node.id);
    node.content = content;
  }
  Chapters.normalize(lines);
  return lines;
}
module.exports = {load, fromChapter: Chapters.fromChapter};
