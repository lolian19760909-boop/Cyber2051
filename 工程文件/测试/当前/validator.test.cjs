'use strict';
/*! 本地校验层（zod-lite）回归：只验证 schema.js 真正用到的调用面，以及它替代真 Zod 后的表现。 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const Validator = require(path.join(root, '卡片源码/数据/validator.js'));
const Schema = require(path.join(root, '卡片源码/MVU/schema.js'));

const { z } = Validator;
const issues = value => (value.success ? [] : value.error.issues);

test('validator：链式规则可用，失败带 path 与可读原因', () => {
  const id = z.string().regex(/^[a-z]+$/).max(6);
  assert.equal(id.safeParse('abc').success, true);
  const wrongCase = issues(id.safeParse('ABC'));
  assert.equal(wrongCase.length, 1);
  assert.deepEqual(wrongCase[0].path, []);
  assert.match(wrongCase[0].message, /格式不符/);
  const tooLong = issues(id.safeParse('abcdefgh'));
  assert.match(tooLong[0].message, /不能超过 6 字/);
  assert.match(issues(z.number().int().min(1).max(3).safeParse(2.5))[0].message, /需要整数/);
  assert.match(issues(z.number().int().min(1).max(3).safeParse(9))[0].message, /不能大于 3/);
  assert.match(issues(z.enum(['甲', '乙']).safeParse('丙'))[0].message, /只接受 甲、乙/);
  assert.match(issues(z.literal(1).safeParse(2))[0].message, /只接受 1/);
  assert.equal(z.boolean().safeParse(true).success, true);
  assert.equal(z.unknown().safeParse(Symbol('x')).success, true);
});

test('validator：preprocess 归一化数字文本，非法文本留在原值并被拒', () => {
  const numeric = z.preprocess(Schema.numberInput, z.number().int().min(0).max(1000));
  assert.deepEqual(numeric.safeParse('900'), { success: true, data: 900 });
  assert.deepEqual(numeric.safeParse(' 42 '), { success: true, data: 42 });
  assert.equal(numeric.safeParse('abc').success, false);
  assert.equal(numeric.safeParse(-1).success, false);
  assert.equal(numeric.safeParse('9999999999').success, false);
  assert.deepEqual(numeric.safeParse(7), { success: true, data: 7 });
});

test('validator：object 丢未知键、looseObject 保留、catchall 校验未知键', () => {
  const strict = z.object({ a: z.string() });
  assert.deepEqual(strict.safeParse({ a: 'x', b: 1 }), { success: true, data: { a: 'x' } });
  const loose = z.looseObject({ a: z.string() });
  assert.deepEqual(loose.safeParse({ a: 'x', b: 1 }), { success: true, data: { a: 'x', b: 1 } });
  const table = z.looseObject({ $meta: z.unknown().optional() }).catchall(z.number());
  assert.equal(table.safeParse({ k1: 1, $meta: 'm' }).success, true);
  const bad = issues(table.safeParse({ k1: 'not-a-number' }));
  assert.deepEqual(bad[0].path, ['k1']);
  assert.equal(z.record(z.string(), z.number()).safeParse({ a: 1 }).success, true);
  assert.equal(z.record(z.string(), z.number()).safeParse({ a: 'x' }).success, false);
  assert.equal(z.array(z.number()).safeParse([1, 2]).success, true);
  assert.deepEqual(issues(z.array(z.number()).safeParse([1, 'x']))[0].path, [1]);
});

test('validator：superRefine 追加 issue 并保留自定义 path', () => {
  const schema = z.looseObject({}).catchall(z.number()).superRefine((value, ctx) => {
    for (const key of Object.keys(value)) if (!/^[a-z]+$/.test(key)) ctx.addIssue({ code: 'custom', path: [key], message: '记录编号格式错误' });
  });
  assert.equal(schema.safeParse({ ok: 1 }).success, true);
  const bad = issues(schema.safeParse({ ok: 1, 'Bad-Key': 2 }));
  assert.equal(bad.length, 1);
  assert.deepEqual(bad[0].path, ['Bad-Key']);
  assert.match(bad[0].message, /记录编号格式错误/);
});

test('validator：抛出的错误对象保留全部 issue', () => {
  const schema = z.object({ a: z.number(), b: z.number() });
  let caught = null;
  try {
    schema.parse({ a: 'x', b: 'y' });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Validator.ZodLiteError);
  assert.equal(caught.issues.length, 2);
  assert.match(caught.message, /a 需要数字/);
  assert.equal(Validator.describe(z.string()), 'string');
});

test('validator：能撑起 MVU/schema.js 的 build 与事务三件套', () => {
  const built = Schema.build(z);
  for (const key of ['stat', 'wallet', 'quest', 'gameplay']) assert.equal(typeof built[key].safeParse, 'function', key);
  for (const key of ['parse', 'audit', 'prepare', 'check', 'program']) assert.equal(typeof built[key], 'function', key);

  assert.deepEqual(built.audit({}), []);
  const before = {
    terminal: {
      wallet: { yen: 1000, earned: 0, spent: 0 },
      quests: {},
      ensemble: { control: { actorId: 'player' }, actors: {} },
      gameplay: { location: { mapId: 'm1', placeId: 'p1' } },
    },
  };
  assert.deepEqual(built.audit(before), []);
  const policy = { mapIndex: { m1: ['p1'] } };
  const tx = built.prepare([
    { op: 'replace', path: '/terminal/wallet/yen', value: '900' },
    { op: 'replace', path: '/terminal/wallet/spent', value: 100 },
  ], before, policy);
  assert.deepEqual(tx.patches.map(p => p.value), [900, 100]);
  const after = JSON.parse(JSON.stringify(before));
  after.terminal.wallet.yen = 900;
  after.terminal.wallet.spent = 100;
  assert.equal(built.check(tx, before, after), true);

  assert.throws(() => built.prepare([{ op: 'replace', path: '/terminal/nope', value: 1 }], before, policy), /该字段由程序维护或尚未开放/);
  assert.throws(() => built.prepare([{ op: 'replace', path: '/terminal/wallet/yen', value: '不是数字' }], before, policy), /需要数字/);
  assert.throws(() => built.prepare([{ op: 'remove', path: '/terminal/wallet/yen' }], before, policy), /只接受 replace 和限定字段的 add/);

  const unpaid = JSON.parse(JSON.stringify(before));
  unpaid.terminal.wallet.yen = 950;
  assert.throws(() => built.check(tx, before, unpaid), /未完整执行本批更新/);

  // 值写对了但收支不平：yen 少 100、earned 却多 100，守恒检查必须拦下。
  const drifted = built.prepare([
    { op: 'replace', path: '/terminal/wallet/yen', value: 900 },
    { op: 'replace', path: '/terminal/wallet/earned', value: 100 },
  ], before, policy);
  const driftedAfter = JSON.parse(JSON.stringify(before));
  driftedAfter.terminal.wallet.yen = 900;
  driftedAfter.terminal.wallet.earned = 100;
  assert.throws(() => built.check(drifted, before, driftedAfter), /钱包余额与本轮累计收入、支出不一致/);
});
