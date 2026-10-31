'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cmp = (a, b) => { for (let i = 0; i < 3; i++) { const n = a.split('.').map(Number)[i] - b.split('.').map(Number)[i]; if (n) return n; } return 0; };
const semver = v => /^\d+\.\d+\.\d+$/.test(v || '');
function readManifest(file) {
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); if (!semver(value.latest)) throw Error('清单 latest 无效'); return value; }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function atomic(file, bytes) { const tmp = file + '.new'; fs.writeFileSync(tmp, bytes, { mode: 0o644 }); fs.renameSync(tmp, file); }
function validateCard(card, version) {
  const d = card.data;
  if (!d || d.character_version !== version || !d.name.endsWith('V' + version) || !d.character_book?.name?.endsWith(' ' + version) || d.extensions?.world !== d.character_book.name) throw Error('卡名、版本、世界书名/绑定不一致');
}
function pngPayload(bytes) {
  if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw Error('不是 PNG');
  const payloads = [];
  for (let i = 8; i + 12 <= bytes.length;) {
    const n = bytes.readUInt32BE(i); if (i + n + 12 > bytes.length) throw Error('PNG chunk 截断');
    if (bytes.toString('ascii', i + 4, i + 8) === 'tEXt') {
      const text = bytes.subarray(i + 8, i + 8 + n), sep = text.indexOf(0), key = text.subarray(0, sep).toString();
      if (['chara', 'ccv3'].includes(key)) payloads.push(JSON.parse(Buffer.from(text.subarray(sep + 1).toString(), 'base64').toString()));
    }
    i += n + 12;
  }
  if (!payloads.length) throw Error('PNG 未含可核对的角色载荷');
  return payloads;
}
function preflight(png, json, version) {
  if (!png || !json) throw Error('--png 与 --json 必须同时提供');
  const pngBytes = fs.readFileSync(png), jsonBytes = fs.readFileSync(json), card = JSON.parse(jsonBytes);
  validateCard(card, version);
  for (const payload of pngPayload(pngBytes)) { validateCard(payload, version); if (JSON.stringify(payload.data) !== JSON.stringify(card.data)) throw Error('PNG/JSON 内容不一致'); }
  return { card, pngBytes, jsonBytes };
}
function publish(base, stage) {
  const meta = JSON.parse(fs.readFileSync(path.join(stage, 'release.json'), 'utf8'));
  if (!semver(meta.version)) throw Error('无效版本');
  const updates = path.join(base, 'updates'), download = path.join(base, 'download');
  const oldUpdate = readManifest(path.join(updates, 'manifest.json'));
  const oldDownload = readManifest(path.join(download, 'manifest.json'));
  if (oldUpdate && (!Array.isArray(oldUpdate.versions) || oldUpdate.cardId !== 'cyber2051')) throw Error('旧更新清单格式错误，不能抛弃历史');
  for (const old of [oldUpdate, oldDownload]) if (old && cmp(meta.version, old.latest) <= 0) throw Error('禁止降版或覆盖已发布版本');
  if (meta.files?.map(x => x.file).join(',') !== 'pack.json,card.png,card.json') throw Error('发布必须含三个固定文件');
  for (const entry of meta.files) { const bytes = fs.readFileSync(path.join(stage, entry.file)); if (sha(bytes) !== entry.sha256 || bytes.length !== entry.size) throw Error('暂存文件校验失败'); }
  const backup = path.join(stage, 'rollback'); fs.mkdirSync(backup, { mode: 0o700 });
  for (const [name, old] of [['updates', oldUpdate], ['download', oldDownload]]) fs.writeFileSync(path.join(backup, name + '.json'), JSON.stringify(old), { mode: 0o600 });
  fs.mkdirSync(path.join(updates, 'packages'), { recursive: true }); fs.mkdirSync(download, { recursive: true });
  const targets = [path.join(updates, 'packages', `v${meta.version}.update.json`), path.join(download, `cyber2051-V${meta.version}.png`), path.join(download, `cyber2051-V${meta.version}.json`)];
  meta.files.forEach((entry, i) => {
    if (fs.existsSync(targets[i])) { if (sha(fs.readFileSync(targets[i])) !== entry.sha256) throw Error('版本文件已存在且内容不同'); }
    else { fs.copyFileSync(path.join(stage, entry.file), targets[i], fs.constants.COPYFILE_EXCL); fs.chmodSync(targets[i], 0o644); }
  });
  const date = new Date().toISOString().slice(0, 10), site = 'https://cyber2051.top';
  const um = { ...(oldUpdate || {}), cardId: 'cyber2051', latest: meta.version, generatedAt: new Date().toISOString(), versions: [{ version: meta.version, date, url: `${site}/updates/packages/v${meta.version}.update.json`, sha256: meta.files[0].sha256, size: meta.files[0].size, notes: meta.notes }, ...(oldUpdate?.versions || [])] };
  const dm = { latest: meta.version, date, png: { url: `${site}/download/cyber2051-V${meta.version}.png`, sha256: meta.files[1].sha256, size: meta.files[1].size }, json: { url: `${site}/download/cyber2051-V${meta.version}.json`, sha256: meta.files[2].sha256, size: meta.files[2].size }, history: [oldDownload, ...(oldDownload?.history || [])].filter(Boolean).map(({ history, ...entry }) => entry) };
  try { atomic(path.join(download, 'manifest.json'), JSON.stringify(dm)); atomic(path.join(updates, 'manifest.json'), JSON.stringify(um)); }
  catch (e) { rollback(base, stage, false); throw e; }
}
function rollback(base, stage, checkCurrent = true) {
  const meta = JSON.parse(fs.readFileSync(path.join(stage, 'release.json')));
  for (const name of ['updates', 'download']) { const file = path.join(base, name, 'manifest.json'); if (checkCurrent && readManifest(file)?.latest !== meta.version) throw Error('清单已被其他发布改变，停止自动回退'); }
  for (const name of ['updates', 'download']) { const file = path.join(base, name, 'manifest.json'), old = JSON.parse(fs.readFileSync(path.join(stage, 'rollback', name + '.json'))); if (old === null) fs.rmSync(file, { force: true }); else atomic(file, JSON.stringify(old)); }
}
module.exports = { sha, cmp, preflight, publish, rollback };
if (require.main === module) { try { const [base, stage, mode] = process.argv.slice(2); if (base !== '/opt/cyber2051' || !/^\/opt\/cyber2051\/release-stage\/\d+-[a-f0-9]+$/.test(stage)) throw Error('目标路径超出发布范围'); if (mode === 'publish') publish(base, stage); else if (mode === 'rollback') rollback(base, stage); else throw Error('无效操作'); } catch (e) { console.error(e.message); process.exitCode = 1; } }
