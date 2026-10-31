/* Temporary UI for the same check built into diagnostics. Install as a GLOBAL helper script. */
(function () {
  'use strict';
  const Check = typeof module === 'object' && module.exports ? require('../../卡片源码/运行时/character-cache-check.js') : globalThis.CxxCharacterCacheCheck;
  if (typeof module === 'object' && module.exports) { module.exports = Check; return; }
  const capture = Check.capture;
  const win = window.parent || window, doc = win.document; doc.getElementById('cxx-character-cache-probe')?.remove();
  const box = doc.createElement('section'); box.id = 'cxx-character-cache-probe'; box.setAttribute('role', 'dialog');
  box.style.cssText = 'position:fixed!important;inset:8px!important;z-index:2147483647!important;background:#15121a;color:#eee;padding:16px;box-sizing:border-box;overflow:auto;font:16px/1.5 sans-serif;';
  const title = doc.createElement('h2'); title.textContent = '2051 角色缓存检查（只读）'; box.append(title);
  const note = doc.createElement('p'); note.textContent = '只读取两次当前角色，不保存或刷新角色，不读取聊天正文。'; box.append(note);
  const output = doc.createElement('textarea'); output.readOnly = true; output.style.cssText = 'display:block;width:100%;height:50vh;box-sizing:border-box;background:#090a0d;color:#eee;font:13px/1.4 monospace'; box.append(output);
  let running = false, closed = false;
  async function refresh() { if (running) return; running = true; note.textContent = '检查中，约3秒…'; try { const result = await capture(win, globalThis); if (!closed) { output.value = JSON.stringify(result, null, 2); note.textContent = result.conclusion; } } catch (e) { if (!closed) { note.textContent = '检查未完成'; output.value = String(e.stack || e); } } finally { running = false; } }
  function button(label, run) { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'min-height:44px;padding:10px;margin:8px;background:#253a3d;color:#fff;border:1px solid #8ad5dc;font:16px sans-serif'; b.onclick = run; box.append(b); }
  button('重新检查', refresh); button('复制结果', async () => { if (running) return; try { await win.navigator.clipboard.writeText(output.value); note.textContent = '已复制，请发给作者。'; } catch { output.focus(); output.select(); note.textContent = '请长按上面的内容，全选并复制。'; } });
  const close = () => { closed = true; box.remove(); }; button('关闭', close); doc.body.append(box); void refresh(); window.addEventListener('pagehide', close, { once: true });
})();
