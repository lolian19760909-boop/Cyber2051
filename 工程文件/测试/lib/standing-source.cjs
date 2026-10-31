'use strict';
// The author-approved refresh inventory owns this batch's original PNG bytes.
const assert = require('node:assert/strict'), path = require('node:path'), crypto = require('node:crypto'), fs = require('node:fs');
const media = require('../../卡片源码/Gal/standing-media.json').files;
const inventory = require('../../卡片源码/Gal/standing-inventory.json');
const sourceRoot = path.resolve(__dirname, '../../..', inventory.sourceDirectory);
function listFiles() { return inventory.assets.map(a=>a.file).sort(); }
function read(file) {
  const asset = media.find(value => value.file === file), matched = inventory.assets.find(a=>a.file===file);
  assert.ok(asset && matched, 'Allowlisted original PNG must exist in approved inventory: ' + file);
  const target=path.resolve(sourceRoot,matched.source.path),relative=path.relative(sourceRoot,target);
  assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
  const bytes = fs.readFileSync(target);
  assert.equal(bytes.length, matched.bytes, file + ' source size');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, file + ' original SHA256');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file + ' PNG signature');
  assert.equal(bytes[25], 6, file + ' original RGBA transparency channel');
  assert.ok(asset.remoteUrl.includes('/standing/' + asset.sha256.slice(0, 16) + '/'), file + ' source URL fingerprint');
  return bytes;
}
module.exports = {listFiles, read};
