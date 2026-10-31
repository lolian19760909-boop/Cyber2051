// 赛博小祥2051 · 全站多语言运行时（中文默认；EN/JA 字典；页头切换器；localStorage 记忆）
// 用法：HTML 元素加 data-i18n="key"（textContent）/ data-i18n-ph="key"（placeholder）；
//       JS 动态文案用 t('key')；语言存 localStorage.cxx-lang；切换后即时生效。
'use strict';
(function () {
  const DICT = {
    en: {
      'auth.title': 'Workshop login', 'auth.ok': 'Signed in', 'auth.fail': 'Login failed', 'auth.return': 'Return to the workshop',
      'auth.okHint': 'Your identity is confirmed. Return to the original Tavern or webpage; login will finish automatically.',
      'auth.failHint': 'Login did not finish. Return to the original page and sign in again.', 'auth.details': 'Reason details',
      // 通用
      'nav.home': 'Home', 'nav.ws': 'Workshop', 'nav.fb': 'Message Wall', 'nav.dl': 'Download', 'nav.my': 'My Posts', 'nav.admin': 'Admin',
      'footer.line': 'CYBER2051.TOP · Fan-made derivative work, not affiliated with the official brands',
      'common.reading': 'Loading…', 'common.retry': 'Retry', 'common.close': '✕ Close', 'common.download': 'Download',
      // 首页
      'home.kicker': 'TOKYO · 2051 · ARCHIVE TERMINAL ACCESS',
      'home.lead': 'An original character card inspired by BanG Dream! characters set in a Cyberpunk 2077 world. This is its official hub: download the latest card, browse the player workshop, or leave your mark on the wall.',
      'home.chip.st': 'SillyTavern + Tavern Helper', 'home.chip.mvu': 'MVU save compatible',
      'home.e1.t': 'Workshop', 'home.e1.d': 'Player-made characters, world factors and creative settings — curated by the author, loadable in-card.', 'home.e1.m': 'Enter workshop →',
      'home.e2.t': 'Message Wall', 'home.e2.d': 'Play reports, bug reports and suggestions — shown after author review.', 'home.e2.m': 'Leave a message →',
      'home.e3.t': 'Card Download', 'home.e3.d': 'The latest card (PNG / JSON) and update packs, always released in sync.', 'home.e3.m': 'Get latest →',
      'home.dl.t': 'Card Download', 'home.dl.sub': 'Existing players can upgrade in-card via "Card Update" — no re-import needed. First time? Grab the full card below.',
      'home.dl.png': 'Full card', 'home.dl.json': 'JSON card', 'home.dl.pngnote': 'PNG image card — drag into SillyTavern to import', 'home.dl.jsonnote': 'JSON card, for import and debugging',
      'home.dl.none': 'Download info temporarily unavailable — try again later.', 'home.dl.date': 'Released ',
      'home.upd.t': 'Updater', 'home.upd.sub': 'Since V1.5.0 the card ships with "Card Update": when a new version is released here, the in-card updater offers a one-tap upgrade — saves, chats and affinity fully preserved.',
      'home.ann.t': 'Announcements', 'home.ver.latest': 'Latest: V', 'home.ver.fail': 'Version info unavailable',
      // 导航/工坊目录
      'ws.title': 'Workshop', 'ws.sub': 'Player submission catalog — characters, world factors and creative settings, shown after author review. Worldbook content can be loaded in-card with one tap.',
      'ws.search.ph': 'Search title / summary…', 'ws.search': 'Search', 'ws.submit': 'Submit',
      'ws.empty': 'No published submissions yet. ', 'ws.empty.link': 'Be the first →', 'ws.readfail': 'Failed to load, try again later.',
      'ws.file': 'Attachment', 'ws.anon': 'Anonymous',
      // 投稿页
      'sub.title': 'Submit', 'sub.sub': 'Character cards / world factors / creative settings — reviewed by the author, then shown publicly; worldbook content can be loaded in-card by players.',
      'sub.login.check': 'Checking login…', 'sub.login.required': 'Discord login is required to submit',
      'sub.login.ok': '✓ Logged in: ', 'sub.login.bind': ' (submissions bind to this identity)', 'sub.login.my': 'My posts',
      'sub.login.none': 'Discord login is not configured.', 'sub.login.unavailable': 'Discord login is not configured; submissions are unavailable.', 'sub.login.popup': 'Complete the authorization in the Discord window… (if blocked, allow popups and retry)',
      'sub.login.btn': 'Discord login',
      'sub.type': 'Type', 'sub.type.wf': 'World Factor (world lore · enters AI worldbook)', 'sub.type.ch': 'Character (NPC settings · with downloadable file)', 'sub.type.ui': 'Identity Preset (player origin · wired into identity page after next card update)',
      'sub.title.f': 'Title (required, max 60)', 'sub.author': 'Credit (optional, max 24)', 'sub.tags': 'Tags (comma separated, max 8)',
      'sub.summary': 'Summary (max 2000, shown on the catalog card)', 'sub.file': 'Attachment (optional, ≤10MB; .png / .json / .txt / .js)',
      'sub.file.hint': 'Finished card → PNG; worldbook export → JSON. Downloadable after approval.', 'sub.payload': 'Content JSON (required, ≤40KB; object)',
      'sub.send': 'Submit', 'sub.back': '← Back to catalog', 'sub.limit': 'Max 5 submissions/edits per hour; content must be your own or licensed; the edit key is shown only once.',
      'sub.sending': 'Submitting…', 'sub.err.json': 'Invalid JSON (double quotes required).', 'sub.err.object': 'Content must be a JSON object ({...}).',
      'sub.err.title': 'Title cannot be empty.', 'sub.ok': 'Submitted! It appears after author review.', 'sub.err.429': 'Too many actions, try again in an hour.',
      'sub.err.long': 'Over the 500-char limit.', 'sub.err.generic': 'Submit failed: ', 'sub.err.net': 'Network error, try again later.',
      'sub.uploading': 'Uploading attachment…', 'sub.upok': 'Submitted with attachment!', 'sub.upfail': 'Submitted, but attachment upload failed: ', 'sub.upnetfail': 'Submitted, but attachment failed (network).',
      'sub.keybox': '✓ Submitted! Edit key (shown ONLY once — copy it now):', 'sub.keybox.hint': 'Use it to edit, withdraw or attach. Lost = you lose management of this post.',
      // 详情页
      'subm.back': '← Back to catalog', 'subm.summary': 'Summary', 'subm.howto': 'How to use in-card',
      'subm.howto.wb': 'Worldbook content: open this card in SillyTavern → open the "Workshop" panel → find this item → tap "Load" (unloadable anytime).',
      'subm.howto.fn': 'Function/skill content touches card scripts — for safety only download is offered. Import manually via Tavern Helper.',
      'subm.howto.dl': 'This type has no one-tap loading yet: download the attachment and import via the matching SillyTavern / Tavern Helper feature.',
      'subm.json': 'Content JSON', 'subm.notfound': 'Submission not found or not public', 'subm.readfail': 'Failed to load',
      'subm.updated': ' · updated ', 'subm.dlbtn': 'Download attachment (', 'subm.404.title': 'Not found',
      // 留言墙
      'fb.title': 'Message Wall', 'fb.sub': 'Player reports & suggestions — messages appear after author review.',
      'fb.nick': 'Nickname (optional, max 24)', 'fb.body': 'Your message (required, max 500)',
      'fb.body.ph': 'Play reports, bugs, suggestions…', 'fb.send': 'Post message', 'fb.hint': 'Max 3 messages per 10 minutes; please do not post private data.',
      'fb.list': 'Published messages', 'fb.empty': 'No messages yet — be the first.', 'fb.sent': 'Posted! It appears here after review.',
      'fb.429': 'Too fast — take a short break.', 'fb.long': 'Over the 500-char limit.', 'fb.emptybody': 'Message cannot be empty.',
      'fb.fail': 'Post failed (', 'fb.net': 'Network error, try again later.', 'fb.readfail': 'Failed to load, try again later.',
      // 我的投稿
      'my.title': 'My Posts', 'my.sub': 'Manage submissions published with your Discord identity — edit, withdraw, attach. Anonymous posts are managed on the submit page with the edit key.',
      'my.login.none': 'Not logged in — log in to manage your posts', 'my.checking': 'Checking login…', 'my.ok': '✓ Logged in: ',
      'my.empty': 'No posts yet. ', 'my.empty.link': 'Go submit →', 'my.edit': 'Edit', 'my.attach': 'Attach', 'my.reattach': 'Replace file',
      'my.withdraw': 'Withdraw', 'my.withdraw.confirm': 'Withdraw this post? It leaves the public catalog (record kept).', 'my.withdraw.done': 'Withdrawn', 'st.pending': 'pending', 'st.approved': 'approved', 'st.rejected': 'rejected', 'st.withdrawn': 'withdrawn',
      'my.e.title': 'Title', 'my.e.summary': 'Summary', 'my.e.tags': 'Tags (comma separated)', 'my.e.json': 'Content JSON',
      'my.save': 'Save (re-enters review)', 'my.saved': 'Saved, re-entered review (rev', 'my.saved.bad': 'Save failed: ', 'my.saved.refresh': ' (current rev ', 'my.saved.refresh2': ', refresh and retry)',
      'my.uploading': 'Uploading…', 'my.upload.review': 'Attachment updated; the post awaits review again', 'my.uploadfail': 'Attachment failed: ',
      'my.readfail': 'Load failed: ', 'my.net': 'Network error.', 'my.jsonbad': 'Invalid JSON.', 'my.logged': 'Login failed / expired — please log in again',
      'my.login.timeout': 'Login timed out, please retry.', 'my.login.session': 'Login session invalid, please retry.',
    },
    ja: {
      'auth.title': 'ワークショップのログイン', 'auth.ok': 'ログイン成功', 'auth.fail': 'ログイン失敗', 'auth.return': 'ワークショップに戻る',
      'auth.okHint': '本人確認が完了しました。元の酒館またはページに戻ると、ログインが自動的に完了します。',
      'auth.failHint': 'ログインは完了しませんでした。元のページに戻って再度ログインしてください。', 'auth.details': '理由の詳細',
      'nav.home': 'ホーム', 'nav.ws': 'ワークショップ', 'nav.fb': '掲示板', 'nav.dl': 'カードDL', 'nav.my': 'マイ投稿', 'nav.admin': '管理者',
      'footer.line': 'CYBER2051.TOP · 二次創作作品。公式とは無関係です',
      'common.reading': '読み込み中…', 'common.retry': '再試行', 'common.close': '✕ 閉じる', 'common.download': 'ダウンロード',
      'home.kicker': 'TOKYO · 2051 · アーカイブ端末接続点',
      'home.lead': '『BanG Dream!』のキャラクターと『サイバーパンク2077』の世界観を融合したオリジナルキャラカードの公式ハブです。最新カードのダウンロード、プレイヤーワークショップの閲覧、メッセージの投稿ができます。',
      'home.chip.st': 'SillyTavern + Tavern Helper', 'home.chip.mvu': 'MVU セーブデータ互換',
      'home.e1.t': 'ワークショップ', 'home.e1.d': 'プレイヤー制作のキャラ・ワールドファクター・創作設定。作者の審査後に掲載され、カード内からワンタップで装着できます。', 'home.e1.m': '一覧へ →',
      'home.e2.t': 'メッセージボード', 'home.e2.d': 'プレイ感想・バグ報告・ご要望など。作者の審査後に公開されます。', 'home.e2.m': 'メッセージを書く →',
      'home.e3.t': 'カードDL', 'home.e3.d': '最新版カード（PNG / JSON）と更新パッケージ。常に同時リリース。', 'home.e3.m': '最新版を入手 →',
      'home.dl.t': 'カードダウンロード', 'home.dl.sub': '導入済みの方はカード内の「カード更新」でそのままアップグレードできます。初めての方は下から完全版をどうぞ。',
      'home.dl.png': '完全版カード', 'home.dl.json': 'JSONカード', 'home.dl.pngnote': 'PNG画像カード。SillyTavernにドラッグで導入', 'home.dl.jsonnote': 'JSONカード。導入・デバッグ用',
      'home.dl.none': 'ダウンロード情報を一時的に取得できません。後でお試しください。', 'home.dl.date': '公開日 ',
      'home.upd.t': 'アップデーター', 'home.upd.sub': 'V1.5.0 以降、カード内に「カード更新」を搭載。新バージョン公開時はカード内でワンタップ更新——セーブ・履歴・好感度はすべて保持されます。',
      'home.ann.t': 'お知らせ', 'home.ver.latest': '最新版: V', 'home.ver.fail': 'バージョン情報を取得できません',
      'ws.title': 'ワークショップ', 'ws.sub': 'プレイヤー投稿カタログ——キャラ・ワールドファクター・創作設定。作者の審査後に掲載され、ワールドブック系はカード内からワンタップ装着できます。',
      'ws.search.ph': 'タイトル / 概要を検索…', 'ws.search': '検索', 'ws.submit': '投稿する',
      'ws.empty': 'まだ掲載中の投稿はありません。 ', 'ws.empty.link': '最初の投稿者になる →', 'ws.readfail': '読み込み失敗。後でお試しください。',
      'ws.file': '添付', 'ws.anon': '匿名',
      'sub.title': '投稿する', 'sub.sub': 'キャラカード / ワールドファクター / 創作設定——投稿後、作者の審査を経て公開。ワールドブック系はカード内装着に対応します。',
      'sub.login.check': 'ログイン状態を確認中…', 'sub.login.required': '投稿には ログイン / 登録が必要です',
      'sub.login.ok': '✓ ログイン中: ', 'sub.login.bind': '（この名義で投稿されます）', 'sub.login.my': 'マイ投稿',
      'sub.login.none': 'ログイン / 登録は未設定です。', 'sub.login.unavailable': 'ログイン / 登録は未設定のため投稿できません。', 'sub.login.popup': 'ポップアップした Discord ウィンドウで認証を完了してください……（ブロックされた場合は許可して再試行）',
      'sub.login.btn': 'ログイン / 登録',
      'sub.type': '種類', 'sub.type.wf': 'ワールドファクター（世界設定・装着でAI世界観に反映）', 'sub.type.ch': 'キャラカード（NPC設定・添付ファイル付き）', 'sub.type.ui': 'アイデンティティ設定（プレイヤー出身・次回カード更新で身份ページに接続）',
      'sub.title.f': 'タイトル（必須・60字まで）', 'sub.author': '名義（任意・24字まで）', 'sub.tags': 'タグ（カンマ区切り・最大8）',
      'sub.summary': '概要（最大2000字・カタログカードに表示）', 'sub.file': '添付（任意・≤10MB; .png / .json / .txt / .js）',
      'sub.file.hint': '完成カードはPNG、ワールドブック書き出しはJSON。承認後にダウンロード可能。', 'sub.payload': '内容 JSON（必須・≤40KB・オブジェクト）',
      'sub.send': '投稿する', 'sub.back': '← 一覧に戻る', 'sub.limit': '投稿/編集は毎時5回まで。本人が権利を持つ内容のみ投稿可。編集キーは一度しか表示されません。',
      'sub.sending': '送信中……', 'sub.err.json': 'JSONの書式が不正です（ダブルクォート必須）。', 'sub.err.object': '内容は JSON オブジェクト({...})である必要があります。',
      'sub.err.title': 'タイトルは空にできません。', 'sub.ok': '投稿しました！審査通過後に公開されます。', 'sub.err.429': '操作が多すぎます。1時間後に再試行してください。',
      'sub.err.long': '500字の上限を超えています。', 'sub.err.generic': '投稿失敗: ', 'sub.err.net': 'ネットワーク異常。後でお試しください。',
      'sub.uploading': '添付アップロード中……', 'sub.upok': '投稿と添付を送信しました！', 'sub.upfail': '投稿成功、ただし添付失敗: ', 'sub.upnetfail': '投稿成功、ただし添付に失敗（ネットワーク）。',
      'sub.keybox': '✓ 投稿完了！編集キー（一度だけ表示・今すぐ保存）：', 'sub.keybox.hint': 'このキーで編集・取消・添付が可能。紛失すると管理できません。',
      'subm.back': '← 一覧に戻る', 'subm.summary': '概要', 'subm.howto': 'カード内での使い方',
      'subm.howto.wb': 'ワールドブック系：SillyTavern でこのカードを開く →「ワークショップ」パネル → この項目を選び「装着」（いつでも解除可能）。',
      'subm.howto.fn': '機能/スキル系はカード内スクリプトに関わるため、安全上ダウンロードのみ。Tavern Helper の「スクリプト取り込み」から手動で追加してください。',
      'subm.howto.dl': 'この種類は現在ワンタップ装着非対応：添付をダウンロードし、SillyTavern / Tavern Helper の該当機能から手動で取り込んでください。',
      'subm.json': '内容 JSON', 'subm.notfound': '投稿が存在しないか非公開です', 'subm.readfail': '読み込み失敗',
      'subm.updated': ' · 更新 ', 'subm.dlbtn': '添付をダウンロード（', 'subm.404.title': '見つかりません',
      'fb.title': 'メッセージボード', 'fb.sub': 'プレイ感想・要望の受付——投稿は作者の審査後に公開されます。',
      'fb.nick': 'ニックネーム（任意・24字まで）', 'fb.body': 'メッセージ（必須・500字まで）',
      'fb.body.ph': 'プレイ感想・バグ報告・ご要望……', 'fb.send': '送信', 'fb.hint': '10分間に3件まで。個人情報は書き込まないでください。',
      'fb.list': '公開中のメッセージ', 'fb.empty': 'まだメッセージはありません——最初の1件をどうぞ。', 'fb.sent': '送信完了！審査通過後にここに表示されます。',
      'fb.429': '送信が頻繁です。少し待ってください。', 'fb.long': '500字の上限を超えています。', 'fb.emptybody': 'メッセージを入力してください。',
      'fb.fail': '送信失敗（', 'fb.net': 'ネットワーク異常。後でお試しください。', 'fb.readfail': '読み込み失敗。後でお試しください。',
      'my.title': 'マイ投稿', 'my.sub': 'Discord 名義で公開した投稿の管理——編集・取消・添付。匿名投稿は投稿ページの編集キーで管理してください。',
      'my.login.none': '未ログイン——ログインすると投稿を管理できます', 'my.checking': 'ログイン状態を確認中…', 'my.ok': '✓ ログイン中: ',
      'my.empty': 'まだ投稿はありません。 ', 'my.empty.link': '投稿する →', 'my.edit': '編集', 'my.attach': '添付', 'my.reattach': '添付を差し替え',
      'my.withdraw': '取り下げ', 'my.withdraw.confirm': 'この投稿を取り下げますか？公開カタログから外れます（記録は保持）。', 'my.withdraw.done': '取り下げました', 'st.pending': '審査中', 'st.approved': '公開中', 'st.rejected': '却下', 'st.withdrawn': '取下済',
      'my.e.title': 'タイトル', 'my.e.summary': '概要', 'my.e.tags': 'タグ（カンマ区切り）', 'my.e.json': '内容 JSON',
      'my.save': '保存（審査へ再提出）', 'my.saved': '保存しました。審査へ再提出（rev', 'my.saved.bad': '保存失敗: ', 'my.saved.refresh': '（現在 rev ', 'my.saved.refresh2': '。更新して再試行）',
      'my.uploading': 'アップロード中……', 'my.upload.review': '添付を更新しました。投稿は再審査待ちです', 'my.uploadfail': '添付失敗: ',
      'my.readfail': '読み込み失敗: ', 'my.net': 'ネットワーク異常。', 'my.jsonbad': 'JSONの書式が不正です。', 'my.logged': 'ログインが無効です。再度ログインしてください',
      'my.login.timeout': 'ログインがタイムアウトしました。再試行してください。', 'my.login.session': 'ログインセッションが無効です。再試行してください。',
    },
  };
  const originals = new WeakMap();
  function current() { return localStorage.getItem('cxx-lang') || 'zh'; }
  function t(key, fallback) {
    if (current() === 'zh') return fallback != null ? fallback : key;
    return (DICT[current()] && DICT[current()][key]) || fallback || key;
  }
  function apply(lang) {
    lang = DICT[lang] ? lang : 'zh';
    localStorage.setItem('cxx-lang', lang);
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : (lang === 'ja' ? 'ja' : 'en');
    const nodes = [...document.querySelectorAll('[data-i18n]:not([data-i18n-dynamic])')].map(node => [node, false]);
    nodes.push(...[...document.querySelectorAll('[data-i18n-ph]')].map(node => [node, true]));
    for (const [node, isPh] of nodes) {
      if (!originals.has(node)) originals.set(node, isPh ? node.placeholder : node.textContent);
      const text = originals.get(node);
      const key = isPh ? node.getAttribute('data-i18n-ph') : node.getAttribute('data-i18n');
      const val = lang === 'zh' ? text : ((DICT[lang] && DICT[lang][key]) || text);
      if (isPh) node.placeholder = val; else node.textContent = val;
    }
    document.dispatchEvent(new CustomEvent('cxx-lang-changed', { detail: { lang } }));
  }
  function injectToggle() {
    const nav = document.querySelector('.site-header .nav');
    if (!nav || nav.querySelector('.lang-sw')) return;
    const sw = document.createElement('span');
    sw.className = 'lang-sw';
    sw.setAttribute('role', 'group');
    sw.setAttribute('aria-label', 'Language / 语言 / 言語');
    [['zh', '中'], ['en', 'EN'], ['ja', '日']].forEach(([code, label]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.type = 'button';
      b.dataset.lang = code;
      b.setAttribute('aria-label', code === 'zh' ? '中文' : code === 'en' ? 'English' : '日本語');
      b.addEventListener('click', () => { apply(code); sync(); });
      sw.appendChild(b);
    });
    const sync = () => sw.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.lang === current();
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    nav.appendChild(sw);
    document.addEventListener('cxx-lang-changed', sync);
    apply(current());
  }
  window.CXXI18N = { t, apply, current };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectToggle);
  else injectToggle();
})();
