// 2.3.29：这一脚本原来是「从 CDN 取 MVU 本体」的桥。MVU 已被卡内解析器取代，
// 现在只保留同名壳子：不联网、不 import 任何远端模块，也不再注册第三方面板。
// 卡内解析器 = Gal/parser.js（抽 <UpdateVariable> 的 JSONPatch）+ MVU/schema.js（字段策略）
// + 数据/validator.js（本地校验层）+ 数据/applier.js（执行并落数据库表）。
(function () {
  'use strict';
  const HOST = window.parent || window;
  const note = '变量由卡内解析器处理，不再加载远端 MVU。';
  try {
    HOST.CxxMvuRemoteError = '';
    HOST.CxxVariableEngine = 'card-local';
  } catch (error) {}
  // 兼容旧调用面：外部若还问 CxxMvuRetry / CxxMvuLoad，给一个立即完成的 Promise。
  const done = function () { return Promise.resolve(false); };
  try { globalThis.CxxMvuRetry = done; } catch (error) {}
  try { HOST.CxxMvuRetry = done; } catch (error) {}
  try { globalThis.CxxMvuLoad = Promise.resolve(false); } catch (error) {}
  try { HOST.CxxMvuLoad = Promise.resolve(false); } catch (error) {}
  try {
    const diagnostics = HOST.CxxDiagnostics;
    if (diagnostics && typeof diagnostics.module === 'function') diagnostics.module('变量引擎', note);
  } catch (error) {}
})();
