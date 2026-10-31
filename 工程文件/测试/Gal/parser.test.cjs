'use strict';
// Actual Izumi output omits <content> and may emit a bare patch before the annotated one.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { parseMessage } = require("../../卡片源码/Gal/parser.js");
const { firstLine } = require("../../卡片源码/Gal/parser.js");
const fixtures = require("./fixtures/messages.json");

const scene = { date: '2051年4月12日', time: '21:18', location: '池袋旧街', characters: [{ name: '丰川祥子', outfit: '黑色外套', thought: '雨还没停。' }] };
const status = `<ztl>${JSON.stringify(scene)}</ztl>`;
const choices = '<xuan>\n1. 等雨停\n2. 走进店里\n3. 检查终端\n4. 看向巷口\n5. 递出雨伞\n</xuan>';
const update = '<UpdateVariable><Analysis>当前只调整好感度。</Analysis><JSONPatch>[{"op":"replace","path":"/丰川祥子/好感度","value":12}]</JSONPatch></UpdateVariable>';
const text = result => result.paragraphs.map(p => p.text).join('\n\n');

test('shared decoder recognizes syntax while schema remains field authority',()=>{
 const parser=require('../../卡片源码/Gal/parser.js'),events=[{event:'progress',kind:'happened',node:'node_1',evidence:[{fact:'collected',quote:'已经取回六套皮下护甲并当面清点。'}]}];
 const check=(entry,analysis='')=>parser.variableUpdates('<UpdateVariable>'+analysis+'<JSONPatch>'+JSON.stringify([entry])+'</JSONPatch></UpdateVariable>');
 for(const analysis of ['','<Analysis></Analysis>','<Analyze>记录事实。</Analyze>'])assert.deepEqual(check({op:'add',path:'/terminal/quests/q01/events',value:events},analysis).issues,[]);
 for(const path of ['/terminal/quests/q01/state','/terminal/quests/q01/events/-','/unrelated/events'])assert.deepEqual(check({op:'add',path,value:events}).issues,[]);
 for(const path of ['/terminal/quests/__proto__/events','/terminal/$internal/events','/terminal/bad~2path'])assert(check({op:'add',path,value:events}).issues.length);
 for(const op of ['remove','move','execute'])assert(check({op,path:'/terminal/wallet/yen',value:0}).issues.length);
});

test('a proven story boundary recovers orphan or unclosed thought prefixes without dropping the story',()=>{
 for(const prefix of ['规划文字。</think>','<think>规划文字。','<thinking>规划文字。']){
  const raw=prefix+'\n<cxx-story>街灯照亮了回家的路。</cxx-story>',parsed=parseMessage(raw);assert(text(parsed).includes('街灯照亮了回家的路。'));assert(!text(parsed).includes('规划文字'));
 }
});

test('history excerpts skip story-shaped planning and quoted examples before the real floor', () => {
  for (const prefix of ['<think><cxx-story>只供规划的示例。</cxx-story></think>', '```xml\n<cxx-story>代码中的示例。</cxx-story>\n```']) {
    const raw = prefix + '\n<cxx-story>街灯亮起。</cxx-story>';
    assert.equal(firstLine(raw), '街灯亮起。');
    assert.equal(text(parseMessage(raw)).includes('街灯亮起。'), true);
  }
});

test('history excerpts skip auxiliary summaries without a story wrapper and keep bounded output', () => {
  assert.equal(firstLine('<current_event>事件内部摘要。</current_event>\n街灯亮起。'), '街灯亮起。');
  assert.equal(firstLine('<cxx-story><cxx-say speaker="祥子">你来了。</cxx-say></cxx-story>'), '祥子：你来了。');
  assert.equal(firstLine('夜'.repeat(5000)).length, 60);
  assert.equal(firstLine(''), '');
});

test('background blocks are hidden in the text the card renders itself',()=>{
  const raw='椎名立希把签到表夹在写字板上。\n<background>同一时间的丰岛区池袋，红花街外围的交界巷口。</background>\n远处传来电车声。';
  const parsed=parseMessage(raw);
  assert.equal(parsed.raw,raw);
  assert.equal(text(parsed).includes('<background>'),false);
  assert.equal(text(parsed).includes('丰岛区池袋'),false);
  assert.equal(text(parsed).includes('椎名立希把签到表夹在写字板上。'),true);
  assert.equal(text(parsed).includes('远处传来电车声。'),true);
});

test('public context is hidden without changing the saved story or becoming MVU',()=>{
  const raw='街角的广播响了。\n<CityPublicContext>{"date":null,"location":null,"events":[]}</CityPublicContext>';
  const parsed=parseMessage(raw);assert.equal(parsed.raw,raw);assert.equal(text(parsed),'街角的广播响了。');assert.equal(parsed.warnings.length,0);
  assert.match(text(parseMessage('```\n<CityPublicContext>示例</CityPublicContext>\n```')),/示例/);
});

for (const fixture of fixtures) test(`fixture: ${fixture.id}`, () => {
  const parsed = parseMessage(fixture.raw);
  assert.deepEqual(parsed.paragraphs.map(p => p.speaker), fixture.expectedSpeakers);
  assert.equal(parsed.choices.length, fixture.expectedChoiceCount);
  assert.equal(parsed.scene?.location ?? null, fixture.expectedLocation);
  assert.equal(parsed.raw, fixture.raw);
});

test('all ten full names and verified short names map only at a line start', () => {
  const names = [
    ['高松灯', '灯', 'Tomorin'], ['千早爱音', '爱音', 'Anon'], ['长崎素世', '素世', 'Soyo'],
    ['椎名立希', '立希', 'Taki'], ['要乐奈', '乐奈', 'Rana'], ['丰川祥子', '祥子', 'Saki'],
    ['三角初华', '初华', 'Uika'], ['若叶睦', '睦', 'Mutsumi'], ['八幡海铃', '海铃', 'Umiri'],
    ['祐天寺若麦', '若麦', 'Nyamu']
  ];
  for (const [full, short, id] of names) {
    for (const alias of [full, short]) {
      const line = `${alias}：原句不改。`;
      assert.deepEqual(parseMessage(line).paragraphs, [{ text: line, speaker: full, characterId: id, dialogueText: '原句不改。', expression: 'normal' }]);
    }
  }
  assert.equal(parseMessage('喵梦: 原句').paragraphs[0].characterId, 'Nyamu');
  for (const raw of ['她转身说，祥子：你好。', '陌生人：你好。', '祥子：', '> 祥子：旧日引文。', '“祥子：引文。”']) {
    assert.equal(parseMessage(raw).paragraphs[0].speaker, null);
    assert.equal(text(parseMessage(raw)), raw);
  }
});

test('narration and dialogue on adjacent lines never inherit the last speaker', () => {
  const parsed = parseMessage('旁白首行\n旁白续行\n  祥子：你好。\n她抬起手。\n灯: 好。\n\n另一段。');
  assert.deepEqual(parsed.paragraphs.map(p => [p.text, p.speaker]), [
    ['旁白首行\n旁白续行', null], ['  祥子：你好。', '丰川祥子'], ['她抬起手。', null], ['灯: 好。', '高松灯'], ['另一段。', null]
  ]);
});

test('fenced, quoted, inline-code and HTML-quoted protocols remain inert', () => {
  const examples = [
    `\`\`\`json\n${status}\n\`\`\``, `~~~~\n${status}\n~~~\n${choices}\n~~~~`,
    `> ${status}`, `> 格式文档\n${status}`, `\`${status}\``, `“${status}”`, `「${status}」`,
    `<blockquote>\n${status}\n</blockquote>`, `\`\`\`\n${status}`
  ];
  for (const raw of examples) {
    const parsed = parseMessage(raw);
    assert.equal(parsed.scene, null, raw);
    assert.equal(parsed.choices.length, 0, raw);
    assert.equal(text(parsed), raw, raw);
    assert.deepEqual(parsed.warnings, [], raw);
  }
});

test('unknown analysis and markup remain text outside the verified card and Izumi protocols', () => {
  const raw = '<Analysis>独立说明</Analysis>\n<script>alert(1)</script>\n<CG id="unknown" />';
  assert.equal(text(parseMessage(raw)), raw);
  assert.equal(text(parseMessage(`${update}\n保留正文`)), '保留正文');
});

test('the actual maintained Izumi format examples use the supported content and planning delimiters', () => {
  const preset = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../卡片源码/预设/Izumi-V0.8.json'), 'utf8'));
  const examples = preset.prompts.filter(p => /吐槽版格式示例|其它格式示例|克劳德格式示例/.test(p.name));
  assert.equal(examples.length, 3);
  for (const entry of examples) {
    assert.match(entry.content, /<content>/);
    assert.match(entry.content, /<\/content>/);
    if (!/克劳德/.test(entry.name)) assert.match(entry.content, /<\/konatan_planning~>/);
  }
});

test('MVU marker examples inside fences, quotes and indented code remain literal', () => {
  const marker = '<StatusPlaceHolderImpl/>';
  for (const raw of ['```html\n' + marker + '\n```', '~~~\n' + marker + '\n~~~', '> ' + marker,
    '> 格式说明\n' + marker, '`' + marker + '`', '“' + marker + '”', '「' + marker + '」',
    '<blockquote>\n' + marker + '\n</blockquote>', '    ' + marker, '\t' + marker]) {
    assert.equal(text(parseMessage(raw)), raw);
  }
});

test('five and ten speakers rank by actual dialogue length rather than scene order or name length', () => {
  const names = ['灯', '千早爱音', '素世', '椎名立希', '乐奈', '丰川祥子', '初华', '若叶睦', '海铃', '祐天寺若麦'];
  const ids = ['Tomorin', 'Anon', 'Soyo', 'Taki', 'Rana', 'Saki', 'Uika', 'Mutsumi', 'Umiri', 'Nyamu'];
  for (const size of [5, 10]) {
    const raw = names.slice(0, size).map((name, i) => `${name}：${'字'.repeat(i + 1)}。`).join('\n') + '\n' + status;
    const parsed = parseMessage(raw);
    assert.deepEqual(parsed.dialogueRanking.map(entry => entry.id), ids.slice(0, size).reverse());
    assert.deepEqual(parsed.dialogueRanking.map(entry => entry.characters), Array.from({ length: size }, (_, i) => size - i));
    assert.equal(parsed.dialogueRanking.every(entry => entry.turns === 1), true);
    assert.equal(parsed.dialogueRanking[0].firstParagraph, size - 1);
    assert.equal(parsed.dialogueRanking[0].lastParagraph, size - 1);
  }
});

test('aliases merge; ties use turns then the first dialogue paragraph', () => {
  const raw = '雨夜的旁白。\n\n爱音：一二三四。\n祥子：一二。\n丰川祥子：三四。\n灯：一二。\n高松灯：三四。';
  const parsed = parseMessage(raw);
  assert.deepEqual(parsed.dialogueRanking, [
    { id: 'Saki', name: '丰川祥子', characters: 4, turns: 2, firstParagraph: 2, lastParagraph: 3 },
    { id: 'Tomorin', name: '高松灯', characters: 4, turns: 2, firstParagraph: 4, lastParagraph: 5 },
    { id: 'Anon', name: '千早爱音', characters: 4, turns: 1, firstParagraph: 1, lastParagraph: 1 }
  ]);
});

test('ranking excludes Unicode punctuation and whitespace without splitting surrogate pairs', () => {
  const parsed = parseMessage('祥子：“ 等、我……回来！ A — B。 ”\n灯：𠮷。');
  assert.equal(parsed.paragraphs[0].dialogueText, ' 等、我……回来！ A — B。 ');
  assert.equal(parsed.dialogueRanking[0].characters, 6);
  assert.equal(parsed.dialogueRanking[1].characters, 1);
});

test('explicit speech verbs and paired quotation styles preserve narration but only score speech', () => {
  const cases = [
    ['祥子轻声说：‘等我。’她将伞递给爱音。', '等我。'],
    ['丰川祥子说："我会回来。"雨声没有停。', '我会回来。'],
    ['祥子问道：“可以吗？”', '可以吗？'],
    ['祥子说道：「跟我来。」', '跟我来。'],
    ['祥子答道：『知道了。』她点了点头。', '知道了。'],
    ["祥子低声说：'别出声。'", '别出声。'],
    ['祥子：“看这里。”她转身望向灯。', '看这里。']
  ];
  for (const [raw, spoken] of cases) {
    const parsed = parseMessage(raw);
    assert.equal(parsed.paragraphs[0].text, raw);
    assert.equal(parsed.paragraphs[0].dialogueText, spoken);
    assert.equal(parsed.paragraphs[0].speaker, '丰川祥子');
    assert.equal(parsed.dialogueRanking[0].characters, Array.from(spoken.replace(/[\s\p{P}]/gu, '')).length);
    assert.equal(parsed.raw, raw);
  }
});

test('name mentions, indirect speech, pronouns and unsupported attribution never become dialogue', () => {
  for (const raw of [
    '祥子看着灯，等她开口。', '有人提到祥子：这个名字耳熟。', '她轻声说：“跟我走。”',
    '祥子告诉爱音：“留在这里。”', '祥子说：她已经回去了。', '“等我。”祥子说。',
    '祥子： “还未闭合', '祥子问道：“还未闭合', '陌生人说：“你好。”'
  ]) {
    const parsed = parseMessage(raw);
    assert.equal(text(parsed), raw);
    assert.equal(parsed.paragraphs[0].speaker, null);
    assert.equal(parsed.paragraphs[0].dialogueText, undefined);
    assert.deepEqual(parsed.dialogueRanking, []);
  }
});

test('empty dialogue does not rank, while explicit punctuation-only speech keeps zero weight', () => {
  for (const raw of ['祥子：', '祥子：“”', '祥子说：“   ”']) {
    const parsed = parseMessage(raw);
    assert.equal(text(parsed), raw);
    assert.deepEqual(parsed.dialogueRanking, []);
  }
  for (const raw of ['祥子：……！', '祥子问道：“？”']) {
    const parsed = parseMessage(raw);
    assert.equal(text(parsed), raw);
    assert.deepEqual(parsed.dialogueRanking, [
      { id: 'Saki', name: '丰川祥子', characters: 0, turns: 1, firstParagraph: 0, lastParagraph: 0 }
    ]);
  }
});

test('silent dialogue keeps its last paragraph beside another speaker without gaining weight', () => {
  const parsed = parseMessage('祥子：……\n爱音：我在这里。\n祥子：“？”\n\n雨声继续落下。');
  assert.deepEqual(parsed.dialogueRanking, [
    { id: 'Anon', name: '千早爱音', characters: 4, turns: 1, firstParagraph: 1, lastParagraph: 1 },
    { id: 'Saki', name: '丰川祥子', characters: 0, turns: 2, firstParagraph: 0, lastParagraph: 2 }
  ]);
  assert.equal(parsed.paragraphs[2].characterId, 'Saki');
  assert.equal(parsed.paragraphs[3].speaker, null);
});

test('choice text and scene thoughts never count as dialogue', () => {
  const raw = '爱音：好的。\n' + status.replace('雨还没停。', '祥子：很长很长的内心活动。') + '\n' + choices.replace('1. 等雨停', '1. 祥子：假台词不得计分');
  assert.deepEqual(parseMessage(raw).dialogueRanking, [
    { id: 'Anon', name: '千早爱音', characters: 2, turns: 1, firstParagraph: 0, lastParagraph: 0 }
  ]);
});

test('ranking after an edit is recomputed and never mutates earlier results', () => {
  const raw = '祥子：一二三。\n灯：四。';
  const first = parseMessage(raw);
  const edited = parseMessage(raw.replace('灯：四。', '灯：四五六七。'));
  assert.deepEqual(first.dialogueRanking.map(entry => entry.id), ['Saki', 'Tomorin']);
  assert.deepEqual(edited.dialogueRanking.map(entry => entry.id), ['Tomorin', 'Saki']);
  edited.dialogueRanking[0].characters = 1000;
  assert.equal(first.dialogueRanking[0].characters, 3);
  assert.equal(parseMessage(raw).dialogueRanking[1].characters, 1);
  assert.equal(first.raw, raw);
});

test('six explicit expression IDs affect only Gal display and never dialogue weight or raw text', () => {
  for (const expression of ['normal', 'smile', 'blush', 'serious', 'sadness', 'shocked']) {
    const raw = `  丰川祥子【${expression}】：「等我。」她合上终端。`;
    const parsed = parseMessage(raw), paragraph = parsed.paragraphs[0];
    assert.equal(parsed.raw, raw);
    assert.equal(paragraph.text, '  丰川祥子：「等我。」她合上终端。');
    assert.equal(paragraph.expression, expression);
    assert.equal(paragraph.characterId, 'Saki');
    assert.equal(paragraph.dialogueText, '等我。');
    assert.equal(parsed.dialogueRanking[0].characters, 2);
  }
});

test('unknown complete markers remain readable and normal without inflating dialogue weight', () => {
  for (const marker of ['angry', 'Smile', ' smile ', '', '../smile', '<img src=x onerror=alert(1)>']) {
    const raw = `丰川祥子【${marker}】：「等我。」`, parsed = parseMessage(raw);
    assert.equal(parsed.raw, raw);
    assert.equal(text(parsed), raw);
    assert.equal(parsed.paragraphs[0].characterId, 'Saki');
    assert.equal(parsed.paragraphs[0].expression, 'normal');
    assert.equal(parsed.dialogueRanking[0].characters, 2);
  }
});

test('broken or misplaced markers never remove prose or guess a speaker', () => {
  for (const raw of ['丰川祥子【smile：「等我。」', '丰川祥子【【smile】】：「等我。」',
    '丰川祥子【smile】【sadness】：「等我。」', '丰川祥子【smile】说道：「等我。」',
    '陌生人【smile】：「等我。」', '她看着丰川祥子【smile】：「等我。」']) {
    const parsed = parseMessage(raw);
    assert.equal(parsed.raw, raw); assert.equal(text(parsed), raw);
    assert.equal(parsed.paragraphs[0].expression, 'normal');
    assert.equal(parsed.paragraphs[0].characterId, null);
    assert.deepEqual(parsed.dialogueRanking, []);
  }
});

test('old dialogue and emotion words do not infer an expression; literal speech markers stay text', () => {
  const raw = '祥子：我很开心，笑着等你。\n爱音轻声说：“别难过。”\n\n丰川祥子：「【smile】是个标记。」';
  const parsed = parseMessage(raw);
  assert.equal(parsed.raw, raw);
  assert.equal(parsed.paragraphs[2].text, '丰川祥子：「【smile】是个标记。」');
  assert.deepEqual(parsed.paragraphs.map(paragraph => paragraph.expression), ['normal', 'normal', 'normal']);
});

test('expression parsing after a swipe or edit has no retained state', () => {
  const raw = '丰川祥子【smile】：「等我。」';
  const first = parseMessage(raw), before = JSON.stringify(first);
  assert.equal(parseMessage(raw.replace('smile', 'sadness')).paragraphs[0].expression, 'sadness');
  assert.equal(parseMessage('丰川祥子：「等我。」').paragraphs[0].expression, 'normal');
  assert.equal(JSON.stringify(first), before);
  assert.equal(parseMessage(raw).paragraphs[0].expression, 'smile');
});


