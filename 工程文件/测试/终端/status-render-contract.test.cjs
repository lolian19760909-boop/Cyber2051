'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { statusPattern, analysisPattern } = require("../../工具/lib/status-render-contract.cjs");
const card = JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD||path.resolve(__dirname, '../../.cache/build/赛博小祥2051-V2.3.0.json'), 'utf8'));
const rules=card.data.extensions.regex_scripts;
const currentStatus=rules.find(r=>r.id==='21d245e4-dfe4-4a83-a340-030599077e86'),currentAnalysis=rules.find(r=>r.id==='5932266d-22e7-47bd-98f3-98fc5edac7b2');
const compile=value=>{const literal=/^\/([\s\S]*)\/([dgimsuvy]*)$/.exec(value);return literal?new RegExp(literal[1],literal[2]):new RegExp(value);};
const scene = '<ztl>{"date":"2051年4月12日","time":"21:18","location":"隔离验证","characters":[]}</ztl>';
const bare = '<UpdateVariable>[{"op":"replace","path":"/terminal/wallet/yen","value":0}]</UpdateVariable>';
const annotated = '<UpdateVariable><Analysis>工程分析</Analysis><JSONPatch>[]</JSONPatch></UpdateVariable>';
const render = (raw, patterns) => raw.replace(compile(patterns.status), () => 'STATUS_WIDGET')
  .replace(compile(patterns.analysis), () => 'ANALYSIS_WIDGET');

test('current packaged regex preserves status and choices between bounded variable updates', () => {
  const raw = bare + '\n' + scene + '\n<xuan>五项</xuan>\n' + annotated + '\n<StatusPlaceHolderImpl/>';
  const fixed = render(raw, { status: currentStatus.findRegex, analysis: currentAnalysis.findRegex });
  assert.equal(fixed.includes('STATUS_WIDGET'), true);
  assert.equal(fixed.includes('<xuan>'), true);
  assert.equal(fixed.includes(bare), true);
  assert.equal(fixed.includes('ANALYSIS_WIDGET'), true);
  assert.equal(fixed.includes('<StatusPlaceHolderImpl/>'), true);
});

test('MVU marker supplies one fallback widget without consuming the music marker or prose', () => {
  for (const raw of ['祥子：正文。\n<StatusPlaceHolderImpl/>', scene + '\n<StatusPlaceHolderImpl/>']) {
    const fixed = raw.replace(new RegExp(statusPattern), () => 'STATUS_WIDGET');
    assert.equal(fixed.split('STATUS_WIDGET').length, 2);
    assert.equal(fixed.endsWith('<StatusPlaceHolderImpl/>'), true);
    assert.equal(fixed.includes('<ztl>'), false);
    if (!raw.startsWith('<ztl>')) assert.equal(fixed.startsWith('祥子：正文。'), true);
  }
  assert.equal('正文。'.replace(new RegExp(statusPattern), 'STATUS_WIDGET'), '正文。');
});

test('unfinished or crossed variable blocks cannot consume later narrative or status', () => {
  for (const prefix of ['<UpdateVariable>工程未闭合', '<UpdateVariable><Analysis>未闭合']) {
    const raw = prefix + '\n' + scene + '\n' + annotated;
    const match = new RegExp(analysisPattern).exec(raw);
    assert.equal(match[0], annotated);
    assert.equal(match[0].includes('<ztl>'), false);
  }
});
