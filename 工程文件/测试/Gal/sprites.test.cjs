'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const standingSource = require('../lib/standing-source.cjs');
const sprites = require("../../卡片源码/Gal/sprites.js");
const { parseMessage } = require("../../卡片源码/Gal/parser.js");
const resolveSprite = (id, expression) => sprites.sprite(id, '', expression);
const ids = values => values.map(value => value.id);
const rank = (id, lastParagraph) => ({ id, name: id, characters: 100, turns: 1, firstParagraph: 0, lastParagraph });
const parsed = (speakers, ranking) => ({
  paragraphs: speakers.map(characterId => ({ characterId, speaker: characterId, text: characterId ? characterId + '：台词。' : '雨声落在街道。' })),
  dialogueRanking: ranking,
});

test('sprite heights match the maintained character profiles and survive cast selection', () => {
  const profiles = [...require('../../资源/立绘/20261020/character-map.json').characters,...require('../../资源/立绘/20261020-oc/character-map.json').characters];
  for (const character of sprites.characters) {
    const source = fs.readFileSync(path.join(__dirname, "../../卡片源码", profiles.find(p=>p.characterId===character.id).worldbookSource), 'utf8');
    const heightCm = (source.match(/身高[^\d\r\n]{0,4}(\d+)\s*cm/i)?.[1] ? Number(source.match(/身高[^\d\r\n]{0,4}(\d+)\s*cm/i)[1]) : null);
    assert.equal(character.heightCm, heightCm, character.name);
    const selected = sprites.select(parsed([character.id], [rank(character.id, 0)]), 0, resolveSprite);
    assert.equal(selected[0].heightCm, heightCm);
  }
});

test('ten speaking characters produce only three ranked sprites and resolve only selected assets', () => {
  const all = ['Saki', 'Anon', 'Tomorin', 'Soyo', 'Taki', 'Rana', 'Uika', 'Mutsumi', 'Umiri', 'Nyamu'];
  const state = parsed(all.concat(all), all.map((id, index) => rank(id, index + 10)));
  const requested = [];
  const selected = sprites.select(state, 0, id => { requested.push(id); return sprites.sprite(id); });
  assert.deepEqual(ids(selected), ['Saki', 'Anon', 'Tomorin']);
  assert.deepEqual(requested, ['Saki', 'Anon', 'Tomorin']);
  assert.equal(selected[0].name, '丰川祥子');
  assert.equal(selected[0].anchorX, 0.60);
});

test('a low-ranked current speaker takes the last slot while output still follows ranking order', () => {
  const all = ['Saki', 'Anon', 'Tomorin', 'Soyo', 'Taki', 'Rana', 'Uika', 'Mutsumi', 'Umiri', 'Nyamu'];
  const state = parsed(all.concat(all), all.map((id, index) => rank(id, index + 10)));
  const before = JSON.stringify(state), requested = [];
  assert.deepEqual(ids(sprites.select(state, 9, id => { requested.push(id); return sprites.sprite(id); })), ['Saki', 'Anon', 'Nyamu']);
  assert.deepEqual(requested, ['Nyamu', 'Saki', 'Anon']);
  assert.equal(JSON.stringify(state), before);
});

test('narration, mentioned names and scene membership alone never introduce a sprite', () => {
  const state = parsed([null], []);
  state.paragraphs[0].text = '祥子看着爱音和灯。';
  state.scene = { characters: [{ name: '丰川祥子' }, { name: '千早爱音' }, { name: '高松灯' }] };
  let requested = 0;
  assert.deepEqual(sprites.select(state, 0, () => { requested++; return '/unused.png'; }), []);
  assert.equal(requested, 0);
  state.paragraphs[0].characterId = 'Saki';
  assert.deepEqual(sprites.select(state, 0, resolveSprite), [], 'missing dialogue ranking cannot be synthesized from a speaker or scene');
  delete state.dialogueRanking;
  assert.deepEqual(sprites.select(state, 0, resolveSprite), []);
});

test('narration inside a speaking turn keeps only characters with dialogue still ahead', () => {
  const state = parsed(['Saki', null, 'Anon', 'Saki'], [rank('Saki', 3), rank('Anon', 2)]);
  assert.deepEqual(ids(sprites.select(state, 1, resolveSprite)), ['Saki', 'Anon']);
});

test('missing images are skipped and the next ranked available character fills the slot', () => {
  const state = parsed(['Saki', 'Anon', 'Tomorin', 'Soyo', 'Rana'],
    ['Saki', 'Anon', 'Tomorin', 'Soyo', 'Rana'].map(id => rank(id, 4)));
  const requested = [];
  const selected = sprites.select(state, 0, id => {
    requested.push(id);
    return id === 'Saki' ? null : id === 'Anon' ? '' : sprites.sprite(id);
  });
  assert.deepEqual(ids(selected), ['Tomorin', 'Soyo', 'Rana']);
  assert.deepEqual(requested, ['Saki', 'Anon', 'Tomorin', 'Soyo', 'Rana']);
});

test('duplicate and unknown ranked identities do not add extra sprites or reorder known characters', () => {
  const state = parsed([null, 'Saki'], [rank('Unknown', 1), rank('Anon', 1), rank('Anon', 1),
    rank('Saki', 1), rank('../Tomorin', 1), rank('Tomorin', 1)]);
  const requested = [];
  assert.deepEqual(ids(sprites.select(state, 0, id => { requested.push(id); return sprites.sprite(id); })), ['Anon', 'Saki', 'Tomorin']);
  assert.deepEqual(requested, ['Anon', 'Saki', 'Tomorin']);
});

test('URL generation remains limited to allowlisted normal assets', () => {
  assert.equal(sprites.sprite('../Saki'), null);
  assert.equal(sprites.sprite('Unknown'), null);
  assert.equal(sprites.sprite('Saki', 'http://127.0.0.1:6911/'), 'http://127.0.0.1:6911/assets/Saki_normal.png');
});

test('all 61 characters have a real default portrait, including Kokoro smile', () => {
  assert.equal(sprites.characters.length, 61);
  const media=require('../../卡片源码/Gal/standing-media.json');
  for (const { id, anchorX } of sprites.characters) {
    const url=sprites.sprite(id,'https://cyber2051.top','normal',media);
    const bytes = standingSource.read(decodeURIComponent(new URL(url).pathname.split('/').at(-1)));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.ok([832,1024].includes(bytes.readUInt32BE(16)));
    assert.ok([1216,1536].includes(bytes.readUInt32BE(20)));
    assert.ok(anchorX > 0 && anchorX < 1);
  }
});

test('expression URLs keep old normal paths and reject injected identities, bases and expression paths', () => {
  const hosted = require("../../卡片源码/Gal/standing-media.json").files;
  assert.deepEqual(sprites.expressions, ['normal', 'smile', 'blush', 'serious', 'sadness', 'regret', 'shocked', 'constricted_pupils', 'cyberpsychosis']);
  assert.equal(sprites.sprite('Saki'), '/assets/Saki_normal.png');
  for (const expression of sprites.expressions) {
    const asset = hosted.find(asset => asset.characterId === 'Saki' && asset.expressionId === expression);
    assert.equal(sprites.sprite('Saki', 'https://cyber2051.top/', expression, hosted), `https://cyber2051.top/img/galgame/standing/${asset.sha256.slice(0, 16)}/${encodeURIComponent(asset.file)}`);
  }
  for (const id of ['../Saki', 'Saki/../../x', '<script>', {}, null]) assert.equal(sprites.sprite(id, '', 'smile'), null);
  for (const base of ['javascript:alert(1)', '//evil.example', 'https://evil.example', 'https://u:p@cyber2051.top',
    'http://127.0.0.1:6911/?next=x', 'http://127.0.0.1:6911/#x', 'http://127.0.0.1:6911/other', null, {}]) {
    assert.equal(sprites.sprite('Saki', base, 'smile'), null);
  }
  for (const expression of ['../evil', 'smile?x=1', 'normal.png', '<script>', {}, null]) {
    assert.equal(sprites.sprite('Saki', '', expression), '/assets/Saki_normal.png');
  }
});

test('549 mapped assets match the verified upload batch byte for byte', () => {
  const media = require("../../卡片源码/Gal/standing-media.json");
  const upload = {files:[...require("../../资源/立绘/20261020/standing-media.json").files,...require("../../资源/立绘/20261020-oc/standing-media.json").files]};
  const inventory=require("../../卡片源码/Gal/standing-inventory.json");
  assert.equal(media.files.length, 549);
  assert.deepEqual(media.files,upload.files);
  const unique = new Set();
  for (const asset of media.files) {
    unique.add(asset.characterId + ':' + asset.expressionId);
    assert.equal(asset.sha256,inventory.assets.find(item => item.file === asset.file).sha256);
    if(sprites.expressions.includes(asset.expressionId))assert.equal(sprites.sprite(asset.characterId, 'https://cyber2051.top', asset.expressionId, media),asset.remoteUrl);
  }
  assert.equal(unique.size, 549);
});

test('hosted lookup cannot fall through to nonexistent assets or accept missing, duplicate or malformed entries', () => {
  const good = { characterId: 'Saki', expressionId: 'smile', file: 'Saki_tachi_smile.png', sha256: 'a'.repeat(64) };
  for (const assets of [[], null, [good, good], [{ ...good, sha256: 'bad' }], [{ ...good, file: '../bad.png' }]]) {
    assert.equal(sprites.sprite('Saki', 'https://cyber2051.top', 'smile', assets), null);
  }
  assert.equal(sprites.sprite('Saki', 'http://127.0.0.1:6911', 'smile', [good]), 'http://127.0.0.1:6911/assets/Saki_smile.png');
});

test('selection resolves only visible expressions and normal fallbacks while retaining the three-person limit', () => {
  const all = ['Saki', 'Anon', 'Tomorin', 'Soyo'];
  const state = parsed(all.concat(all), all.map((id, index) => rank(id, index + 4)));
  state.paragraphs[0].expression = 'smile'; state.paragraphs[3].expression = 'serious';
  const requested = [];
  const selected = sprites.select(state, 3, (id, expression) => { requested.push([id, expression]); return resolveSprite(id, expression); });
  assert.deepEqual(ids(selected), ['Saki', 'Anon', 'Soyo']);
  assert.deepEqual(requested, [['Soyo', 'serious'], ['Soyo', 'normal'], ['Saki', 'smile'], ['Saki', 'normal'], ['Anon', 'normal']]);
  for (const item of selected) {
    assert.equal(item.url, resolveSprite(item.id, item.expression));
    assert.equal(item.fallbackUrl, resolveSprite(item.id, 'normal'));
  }
});

test('swipes and edits recompute expressions without leaking old or unknown markers', () => {
  const first = parseMessage('丰川祥子【smile】：「等我。」');
  const other = parseMessage('丰川祥子【shocked】：「等我。」');
  assert.equal(sprites.select(first, 0, resolveSprite)[0].expression, 'smile');
  assert.equal(sprites.select(other, 0, resolveSprite)[0].expression, 'shocked');
  assert.equal(sprites.select(parseMessage('丰川祥子【unknown】：「等我。」'), 0, resolveSprite)[0].expression, 'normal');
  assert.equal(sprites.select(first, 0, resolveSprite)[0].expression, 'smile');
});

test('all 549 original PNGs retain their recorded bytes, dimensions and transparency', () => {
  for (const asset of require('../../卡片源码/Gal/standing-inventory.json').assets) {
    const bytes = standingSource.read(asset.file);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), asset.width, asset.file);
    assert.equal(bytes.readUInt32BE(20), asset.height, asset.file);
  }
});
