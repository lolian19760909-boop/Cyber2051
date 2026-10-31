'use strict';
window.CXXOfficialRelease = ({ request, isAuthenticated, setBusy }) => {
  const $ = id => document.getElementById(id);
  let generation = 0, busy = false, ready = false, preview = null;
  const t = (...strings) => window.CXXUI.t(...strings);
  let accountText = () => '', messageText = () => '', messageError = false;
  const MAX_BYTES = 8 * 1024 * 1024;
  const MAX_CARD_BYTES = 16 * 1024 * 1024;
  const errors = {
    official_release_not_configured: ['发布服务尚未配置，请由站长完成首次配置。', 'The publishing service needs initial setup by the site owner.', '公開サービスの初期設定を管理者に依頼してください。'],
    official_not_configured: ['发布服务尚未配置，请由站长完成首次配置。', 'The publishing service needs initial setup by the site owner.', '公開サービスの初期設定を管理者に依頼してください。'],
    publishing_not_configured: ['发布服务尚未配置，请由站长完成首次配置。', 'The publishing service needs initial setup by the site owner.', '公開サービスの初期設定を管理者に依頼してください。'],
    invalid_card: ['角色卡文件未通过检查，请用当前维护流程重新导出。', 'The card failed validation. Export it again through the current maintenance process.', 'カードの検証に失敗しました。現在の管理手順で再出力してください。'],
    card_signing_key_mismatch: ['这张卡尚未装入当前官方公钥，请先用维护流程重新组装新卡。玩家无需配置公钥。', 'Rebuild the card with the current official public key. Players do not need to configure keys.', '現在の公式公開鍵を含めてカードを再構築してください。プレイヤー側の鍵設定は不要です。'],
    invalid_package: ['内容包文件未通过检查，请用当前维护流程重新导出。', 'The content package failed validation. Export it again through the maintenance process.', 'コンテンツパッケージの検証に失敗しました。管理手順で再出力してください。'],
    initial_card_required: ['首次发布需要带更新种子的完整角色卡 JSON，请先选择本次新卡。', 'The first release requires a complete card JSON containing the updater seed.', '初回公開には更新用データを含む完全版カードJSONが必要です。'],
    ownership_conflict: ['内容编号与另一个包冲突，请修正包里的归属后再检查。', 'Content IDs conflict with another package. Fix ownership, then check again.', '別のパッケージと内容IDが重複しています。所有範囲を修正して再確認してください。'],
    immutable_package_conflict: ['这个版本已经存在不同内容，请提高版本号后再检查。', 'This version already exists with different content. Increase the version number.', 'この版には別の内容が存在します。バージョン番号を上げてください。'],
    release_state_conflict: ['当前发布记录不一致，请由站长检查发布服务后再继续。', 'Release records are inconsistent. Ask the site owner to check the service.', '公開記録に不整合があります。管理者にサービスの確認を依頼してください。'],
    preview_expired: ['这份预览已过期，请重新检查文件。', 'This preview expired. Check the files again.', 'プレビューの有効期限が切れました。ファイルを再確認してください。'],
    preview_stale: ['已有其他更新发布，请重新检查文件。', 'Another update was released. Check the files again.', '別の更新が公開されました。ファイルを再確認してください。'],
    preview_hash_mismatch: ['预览已失效，请重新检查文件。', 'This preview is no longer valid. Check the files again.', 'プレビューが無効になりました。ファイルを再確認してください。'],
    release_locked: ['发布服务正在处理另一批更新，请稍后重新检查。', 'Another release is in progress. Check again shortly.', '別の更新を公開中です。少し待って再確認してください。'],
    rate_limited: ['操作过于频繁，请稍后重试。', 'Too many requests. Try again later.', '操作が多すぎます。少し待って再試行してください。'],
  };
  function translatedError(...strings) { const e = new Error(t(...strings)); e.uiMessage = () => t(...strings); return e; }
  const errorText = e => e.uiMessage ? e.uiMessage() : t('网络或读取失败，请检查连接后重试。', 'Network or file read failed. Check the connection and retry.', '通信またはファイルの読み込みに失敗しました。接続を確認して再試行してください。') + (e.message ? ' (' + e.message + ')' : '');
  function account(text) { accountText = typeof text === 'function' ? text : () => text; $('account-state').textContent = accountText(); }
  function message(text, error = false) {
    messageText = typeof text === 'function' ? text : () => text; messageError = error;
    $('message').textContent = messageText(); $('message').className = 'msg release-status ' + (error ? 'err' : 'ok');
  }
  function renderFiles() { $('file-state').textContent = [...$('files').files].map(f => f.name + ' (' + Math.ceil(f.size / 1024) + ' KB)').join(t('、', ', ', '、')) || t('尚未选择文件。', 'No files selected.', 'ファイル未選択。'); }
  function renderPreview() {
    if (!preview) return;
    $('preview-list').replaceChildren();
    for (const p of preview.packages) {
      const li = document.createElement('li');
      if(p.withdrawn){li.textContent=p.id+' · '+p.version+' · '+t('撤回公开发行；已安装与历史记录保留','Withdraw release; installed content and history are preserved','公開を撤回。導入済み内容と履歴を保持');$('preview-list').appendChild(li);continue;}
      li.textContent = (p.name || p.id) + ' · ' + (p.previousVersion ? p.previousVersion + ' → ' : t('新增 ', 'New ', '新規 ')) + p.version +
        ' · ' + (p.optional ? t('DLC / 可选包', 'DLC / optional package', 'DLC / 任意パッケージ') : t('基础包 / 可选接收', 'Base package / optional update', '基本パッケージ / 更新は任意')) +
        ' · ' + (p.activation === 'new_chat' ? t('新聊天启用', 'New chats', '新規チャットで有効') : p.activation === 'opt_in' ? t('玩家选择后启用', 'Enabled by player choice', 'プレイヤーの選択で有効') : t('兼容旧聊天', 'Compatible with existing chats', '既存チャットに対応')) +
        (Number.isFinite(p.bytes) ? ' · ' + Math.ceil(p.bytes / 1024) + ' KB' : '');
      for (const [key, labels] of Object.entries({ worldbook: ['世界书', 'Worldbook', 'ワールドブック'], regex: ['正则', 'Regex', '正規表現'], scripts: ['脚本', 'Scripts', 'スクリプト'], quests: ['任务', 'Quests', 'クエスト'], gallery: ['立绘', 'Gallery', '立ち絵'] })) {
        const change = p.changes?.[key];
        if (change) li.appendChild(Object.assign(document.createElement('p'), { className: 'hint', textContent: t(...labels) + ': ' + t('新增 ', 'added ', '追加 ') + (change.added?.length || 0) + t('，修改 ', ', changed ', '、変更 ') + (change.changed?.length || 0) + t('，移除 ', ', removed ', '、削除 ') + (change.removed?.length || 0) }));
      }
      $('preview-list').appendChild(li);
    }
    const locale = ({ zh: 'zh-CN', en: 'en', ja: 'ja' })[window.CXXUI.lang()] || 'zh-CN';
    $('preview-state').textContent = t('本次共 ', 'Packages: ', 'パッケージ数: ') + preview.packages.length + t(' 个包。预览有效至 ', '. Preview expires at ', '。プレビュー有効期限: ') + new Date(preview.expiresAt).toLocaleString(locale) + '。';
  }
  function invalidate() {
    generation++; preview = null; $('preview-panel').hidden = true; $('confirm').checked = false; controls();
  }
  function controls() {
    $('file-controls').disabled = busy || !ready;
    $('preview').disabled = busy || !ready || (!$('files').files.length&&!$('withdraw-packages').selectedOptions.length);
    $('publish').disabled = busy || !ready || !preview || !$('confirm').checked;
    $('confirm').disabled = busy;
  }
  async function api(path, body) {
    try { return await request(path, body); }
    catch (e) { if (errors[e.code]) e.uiMessage = () => t(...errors[e.code]); throw e; }
  }
  async function load() {
    if (busy) return;
    invalidate(); message(''); ready = false; $('release').hidden = true; controls();
    const ticket = generation;
    if (!isAuthenticated()) { account(''); return; }
    account(() => t('正在读取发布服务……', 'Loading publishing service…', '公開サービスを読み込み中…'));
    try {
      const j = await api('/api/official/me');
      if (ticket !== generation) return;
      if (!j.publishingReady) account(() => t('发布服务尚未就绪，请检查服务配置。', 'The publishing service is not ready. Check its configuration.', '公開サービスが準備できていません。設定を確認してください。'));
      else {
        ready = true; $('release').hidden = false;
        $('withdraw-packages').replaceChildren();for(const p of j.packages||[])if(p.kind==='content'&&p.optional){const o=document.createElement('option');o.value=p.id;o.textContent=p.id+' · '+p.version;$('withdraw-packages').append(o);}
        account(() => t('管理员已验证，可以发布官方更新。', 'Administrator verified. Official publishing is ready.', '管理者確認済み。公式更新を公開できます。'));
      }
    } catch (e) { if (ticket === generation) account(() => errorText(e)); }
    finally { controls(); }
  }
  $('files').addEventListener('change', () => {
    invalidate(); message('');
    renderFiles();
  });
  $('withdraw-packages').addEventListener('change',()=>{invalidate();message('');});
  $('preview').addEventListener('click', async () => {
    if (busy || !ready) return;
    invalidate(); const ticket = generation;
    busy = true; setBusy(true); controls(); message(() => t('正在核对文件并生成预览……', 'Checking files and generating a preview…', 'ファイルを確認してプレビューを生成中…'));
    try {
      const files = [...$('files').files];
      const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
      if (files.length > 20 || totalBytes > MAX_CARD_BYTES) throw translatedError('本次最多选择 20 个文件；含完整角色卡时总大小不超过 16 MiB，纯内容不超过 8 MiB。', 'Select up to 20 files: 16 MiB total with a full card, or 8 MiB for content only.', '20ファイルまで。完全版カードを含む場合は合計16MiB、コンテンツのみは8MiB以下です。');
      const body = { contents: [],withdraw:[...$('withdraw-packages').selectedOptions].map(o=>o.value) };
      for (const file of files) {
        let data;
        try { data = JSON.parse(await file.text()); } catch { throw translatedError(file.name + ' 无法读取为 JSON，请重新导出。', file.name + ' could not be read as JSON. Export it again.', file.name + ' をJSONとして読めません。再出力してください。'); }
        if (data?.data?.character_book || data?.character_book) {
          if (body.card || body.core) throw translatedError('一次只能选择一张角色卡或一个基础核心包。', 'Select only one character card or base core package per release.', '一度に選べるカードまたは基本コアパッケージは1個です。');
          body.card = data;
        } else if (data?.kind === 'core') {
          if (body.card || body.core) throw translatedError('一次只能选择一张角色卡或一个基础核心包。', 'Select only one character card or base core package per release.', '一度に選べるカードまたは基本コアパッケージは1個です。');
          body.core = data;
        } else body.contents.push(data);
      }
      if (!body.card && totalBytes > MAX_BYTES) throw translatedError('纯内容或旧核心包的文件总大小不超过 8 MiB。', 'Content or legacy core files must total no more than 8 MiB.', 'コンテンツまたは旧コアのファイル合計は8MiB以下です。');
      if (ticket !== generation || !isAuthenticated()) return;
      const j = await api('/api/official/preview', body);
      if (ticket !== generation) return;
      if (!j.previewId || !j.previewHash || !Array.isArray(j.packages) || !j.packages.length) throw translatedError('服务未返回完整预览，请重新检查。', 'The service returned an incomplete preview. Check again.', '完全なプレビューが返されませんでした。再確認してください。');
      preview = j; renderPreview();
      $('preview-panel').hidden = false; $('preview-title').focus(); message(() => t('检查通过。请核对上面的包版本和启用范围。', 'Validation passed. Review package versions and activation scope above.', '検証に成功しました。上記のバージョンと有効化範囲を確認してください。'));
    } catch (e) { if (ticket === generation) message(() => errorText(e), true); }
    finally { if (ticket === generation) { busy = false; setBusy(false); controls(); } }
  });
  $('confirm').addEventListener('change', controls);
  $('publish').addEventListener('click', async () => {
    if (busy || !preview || !ready || !$('confirm').checked) return;
    const current = preview, ticket = generation;
    busy = true; setBusy(true); controls(); message(() => t('正在发布，请等待结果……', 'Publishing. Please wait for the result…', '公開中です。結果をお待ちください…'));
    try {
      await api('/api/official/publish', { previewId: current.previewId, previewHash: current.previewHash });
      if (ticket !== generation) return;
      const withdrawn=new Set(current.packages.filter(p=>p.withdrawn).map(p=>p.id));
      busy = false; setBusy(false); invalidate(); $('files').value = '';for(const o of [...$('withdraw-packages').options]){o.selected=false;if(withdrawn.has(o.value))o.remove();}renderFiles();
      message(() => withdrawn.size===current.packages.length
        ? t('已撤回公开发行。新的目录不再提供这些包；已安装内容与历史记录保留。','Public distribution withdrawn. New catalogs omit these packages; installed content and history remain.','公開配布を撤回しました。新しい一覧から除外されますが、インストール済みの内容と履歴は残ります。')
        : t('更新清单已发布。新增内容由玩家选择安装；本次撤回的包停止公开分发，历史记录保留。','Catalog published. Players choose whether to install new content; withdrawn packages leave public distribution while history remains.','更新一覧を公開しました。新しい内容の導入はプレイヤーが選び、撤回したパッケージの履歴は保持します。'));
    } catch (e) {
      if (ticket === generation) { busy = false; setBusy(false); invalidate(); message(() => t('未收到成功结果：', 'Success was not confirmed: ', '成功結果を確認できませんでした: ') + errorText(e) + t(' 请先重新检查发布清单；网络中断时，服务可能已经完成发布。', ' Check the release list before retrying; the service may have completed publishing during a network interruption.', ' 再試行の前に公開一覧を確認してください。通信が切れても公開は完了している場合があります。'), true); }
    } finally { if (ticket === generation) { busy = false; setBusy(false); controls(); } }
  });
  function reset() {
    ready = false; busy = false; invalidate(); $('release').hidden = true;
    $('files').value = ''; $('withdraw-packages').replaceChildren(); $('preview-list').replaceChildren();
    $('preview-state').textContent = ''; account(''); message(''); renderFiles();
  }
  document.addEventListener('cxx-lang-changed', () => { account(accountText); message(messageText, messageError); renderFiles(); renderPreview(); });
  renderFiles();
  return { load, reset, syncControls: controls };
};
