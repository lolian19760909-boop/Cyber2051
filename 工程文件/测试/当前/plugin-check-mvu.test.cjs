'use strict';
// 2.3.29：MVU 已被卡内解析器取代，插件检查那一行改叫「变量解析器（卡内）」，
// 不再有「远程依赖没加载」这种状态。旧机制已移除：远端失败/镜像指向的断言换成卡内就绪判定。
const test = require('node:test'), a = require('node:assert/strict'), P = require('../../卡片源码/运行时/plugin-check.js');
const mvu = w => P.inspect(w, {}, null).find(r => r.id === 'mvu');

test('变量解析器在卡内：就绪只看 guard，不再因远端失败报错', () => {
  const row = mvu({ Cxx236VariableGuard: { state: () => ({ ready: false }) }, CxxMvuRemoteError: 'Failed to fetch dynamically imported module' });
  // 旧机制已移除：以前会按 CxxMvuRemoteError 判成 error 并指向镜像，现在这条错误不该影响判定。
  a.equal(row.kind, 'loading');
  a.match(row.message, /变量解析器已加载，校验层正在准备/);
  a.doesNotMatch(row.message, /jsdelivr|镜像|Failed to fetch/, '不再指向远端镜像或转述网络错误');
  a.match(row.purpose, /不需要安装 MVU 扩展/);
});

test('MVU 脚本本身没运行时提示启用角色脚本，而不是让人去装插件', () => {
  const row = mvu({});
  a.equal(row.kind, 'loading');
  a.match(row.message, /MVU Zod 脚本/);
  a.doesNotMatch(row.message, /装好后刷新页面/);
});

test('校验层还没就绪时只说在准备，并给可操作的下一步', () => {
  const row = mvu({ Mvu: { parseMessage() {} }, Cxx236VariableGuard: { state: () => ({ ready: false }) } });
  // 旧机制已移除：原来分「Mvu 在不在」，现在只看卡内解析器的 guard 就绪与否。
  a.equal(row.kind, 'loading');
  a.match(row.message, /变量解析器已加载，校验层正在准备/);
  a.match(row.message, /等几秒再检查一次/);
});

test('重新检查仍会调用空壳 CxxMvuRetry，但不再有远端要加载', async () => {
  let retried = 0, calls = 0;
  const p = P.create({
    // 旧机制已移除：CxxMvuRetry 现在只是立即 resolve(false) 的兼容壳，调用它不会触发任何网络。
    win: { setInterval: () => 1, clearInterval() {}, CxxMvuRetry: async () => { retried += 1; return false; } },
    loadRegistry: async () => { calls += 1; return { entries: [] }; }
  });
  await p.check();
  a.equal(retried, 1, '兼容调用面保留');
  a.equal(calls, 1);
  p.destroy();
});

test('服务在页面层时也能从嵌套窗口找到，就绪时写明引擎模式', () => {
  const page = { Cxx236VariableGuard: { state: () => ({ ready: true, mode: 'local', lastError: '' }) }, Cxx233Runtime: { alive: true } };
  const mid = { parent: page };
  const leaf = { parent: mid, Cxx233Runtime: { alive: true } };
  const row = mvu(leaf);
  a.equal(row.kind, 'ready');
  // 旧机制已移除：远端 bundle 时代没有「本地/兼容」之分，现在必须写明 mode。
  a.match(row.message, /已就绪（local 模式）/);
  a.match(row.message, /数据库表还没有读到行/);
  const mvuMode = mvu({ Cxx236VariableGuard: { state: () => ({ ready: true, mode: 'mvu' }) } });
  a.match(mvuMode.message, /已就绪（mvu 模式）/, '兼容期仍要如实报出实际模式');
});

test('找不到服务时提示已看过的层数与运行核心在不在', () => {
  const page = { Cxx233Runtime: { alive: true } };
  const row = mvu({ parent: { parent: page } });
  a.equal(row.kind, 'loading');
  const seen = Number((row.message.match(/已看过 ([0-9]+) 层窗口/) || [])[1]);
  a.ok(seen >= 3, '提示里要写出真实探测层数，实际 ' + seen);
  a.match(row.message, /正在启动/);
});
