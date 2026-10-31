'use strict';
// 2.3.29：卡内已「杀死 MVU」，这个脚本只剩兼容壳——不联网、不 import、不注册面板。
// 原来的 6 个用例断言的是「按镜像顺序动态加载远端 bundle」，那套机制已移除；
// 现在断言反过来：只要远端加载、import()、顶层 await 或面板注册回潮，就必须变红。
const test = require('node:test'), a = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = () => fs.readFileSync(path.join(root, '卡片源码/装配/启动脚本/07d0d1a7-897e-4a2d-adb4-e95d360e6ba2.js'), 'utf8');

test('桥脚本不联网：没有任何远端 URL、import() 或第三方仓库地址', () => {
  const text = source();
  // 旧机制已移除：四镜像 + 动态 import 换成了卡内解析器，这里反过来锁死。
  a.doesNotMatch(text, /https?:\/\//, '桥脚本里不应再出现任何 URL');
  a.doesNotMatch(text, /\bimport\s*\(/, '不应再有动态 import()');
  a.doesNotMatch(text, /^\s*import\s+['"]/m, '不应再有静态 import');
  a.doesNotMatch(text, /jsdelivr|MagicalAstrogy|MagVarUpdate/, '不应再引用远端 bundle 或镜像');
  a.doesNotMatch(text, /fetch\s*\(|XMLHttpRequest|require\(/, '不应自己发起网络请求');
});

test('桥脚本声明变量引擎在卡内，并保留空错误位', () => {
  const text = source();
  // 旧机制已移除：原来靠远端 bundle 求值，现在由本卡脚本接管。
  a.match(text, /CxxVariableEngine\s*=\s*'card-local'/, '必须写明引擎在卡内');
  a.match(text, /CxxMvuRemoteError\s*=\s*''/, '不再有远端失败，错误位保持为空');
  a.match(text, /变量由卡内解析器处理/);
});

test('兼容旧调用面：CxxMvuRetry 可调用、CxxMvuLoad 立即给 false，且不依赖顶层 await', () => {
  const text = source();
  // 旧机制已移除：这两个名字原来驱动真实加载，现在只是给旧调用方的空壳。
  a.match(text, /CxxMvuRetry\s*=/, 'CxxMvuRetry 必须仍然存在');
  a.match(text, /CxxMvuLoad\s*=\s*Promise\.resolve\(false\)/, 'CxxMvuLoad 必须是立即完成的 Promise');
  a.match(text, /Promise\.resolve\(false\)/);
  a.doesNotMatch(text, /^await /m, '桥脚本不允许顶层 await');
  a.doesNotMatch(text, /loadMvu\(\)/, '旧的加载器函数已移除');
});

test('运行态：引擎标记落在宿主窗口，加载立刻返回 false 且不留错误', async () => {
  const vm = require('node:vm');
  const page = {}; page.parent = page; page.top = page;
  const frame = { parent: page, top: page, addEventListener() {}, removeEventListener() {} };
  const context = vm.createContext({ window: frame, globalThis: frame, console, setTimeout, Promise });
  vm.runInContext(source(), context, { filename: 'mvu-shell.js' });

  a.equal(page.CxxVariableEngine, 'card-local', '宿主窗口应看到卡内引擎标记');
  a.equal(page.CxxMvuRemoteError, '', '空壳不应伪装成远端失败');
  a.equal(await page.CxxMvuLoad, false, 'CxxMvuLoad 必须立即 resolve(false)');
  a.equal(typeof page.CxxMvuRetry, 'function', '重试入口保留为可调用函数');
  a.equal(await page.CxxMvuRetry(), false, '重试也不再尝试远端，直接给 false');
  a.equal(typeof frame.CxxMvuRetry, 'function', 'globalThis 上同样保留兼容面');
});

test('空壳不注册第三方按钮面板，也不调用宿主按钮事件', () => {
  const text = source();
  // 旧机制已移除：原来会挂 getButtonEvent 面板，现在一个都不许留。
  a.doesNotMatch(text, /getButtonEvent\s*\(/, '不应再注册按钮面板');
  a.doesNotMatch(text, /eventOn\s*\(|tavern_events/, '不应再订阅宿主事件');
  a.doesNotMatch(text, /registerMvuSchema|createMvuSchema/, '不应再注册 MVU schema');
});

test('诊断只做信息级记录，不把失败写进宿主', () => {
  const vm = require('node:vm');
  const notes = [];
  const page = { CxxDiagnostics: { module: (name, note) => notes.push([name, note]) } };
  page.parent = page; page.top = page;
  const frame = { parent: page, top: page, addEventListener() {}, removeEventListener() {} };
  const context = vm.createContext({ window: frame, globalThis: frame, console, setTimeout, Promise });
  vm.runInContext(source(), context, { filename: 'mvu-shell-note.js' });

  a.equal(notes.length, 1, '只应留下一条模块说明');
  a.equal(notes[0][0], '变量引擎');
  a.match(notes[0][1], /卡内/);
  a.equal(page.CxxMvuRemoteError, '', '信息级记录不应升级成错误');
});
