'use strict';
(() => {
  function boot() {
    const $ = id => document.getElementById(id);
    const T = (...texts) => window.CXXUI ? window.CXXUI.t(...texts) : texts[0];
    const names = {
      overview: ['待办概览', 'Overview', '概要'], feedback: ['留言审核', 'Messages', 'メッセージ審査'],
      submissions: ['投稿审核', 'Submissions', '投稿審査'], announcements: ['公告管理', 'Announcements', 'お知らせ管理'],
      accounts: ['账号管理', 'Accounts', 'アカウント管理'],
      official: ['官方更新', 'Official updates', '公式更新'],
      bugs: ['BUG 反馈', 'Bug reports', '不具合報告'],
    };
    const statuses = {
      pending: ['待审核', 'Pending', '審査待ち'], approved: ['已通过', 'Approved', '承認済み'],
      rejected: ['已拒绝', 'Rejected', '却下済み'], withdrawn: ['已撤回', 'Withdrawn', '撤回済み'],
      active: ['正常', 'Active', '有効'], banned: ['已封禁', 'Banned', '利用停止'],
      archived: ['已归档', 'Archived', 'アーカイブ済み'], all: ['全部', 'All', 'すべて'],
    };
    const types = {
      all: ['全部类型', 'All types', 'すべての種類'], contract: ['委托 / 侧剧情', 'Quest / side story', '依頼 / サイドストーリー'],
      world_factor: ['世界因子', 'World factor', '世界設定'], character: ['角色 / NPC', 'Character / NPC', 'キャラクター / NPC'],
      user_identity: ['玩家出身', 'Player background', 'プレイヤーの背景'],
      shop_item:['商店物品','Shop item','商品'],blueprint:['蓝图','Blueprint','設計図'],recipe:['配方','Recipe','レシピ'],skill:['技能','Skill','スキル'],function:['功能服务','Services','サービス'],code_component:['代码集成提案','Code integration','コード統合'],
    };
    const kinds = { site: ['网站', 'Website', 'サイト'], card: ['角色卡', 'Character card', 'キャラクターカード'], event: ['活动', 'Event', 'イベント'] };
    const fieldNames = {
      format: ['数据格式', 'Data format', 'データ形式'], templateKind: ['内容模板', 'Content template', '内容テンプレート'],
      mapId: ['地图编号', 'Map ID', 'マップ ID'], placeId: ['地点编号', 'Place ID', '地点 ID'], keywords: ['关键词', 'Keywords', 'キーワード'],
      fixer: ['发布人', 'Requester', '依頼主'], brief: ['简报', 'Brief', '概要'], goal: ['目标', 'Goal', '目標'],
      type: ['类型', 'Type', '種類'], difficulty: ['难度', 'Difficulty', '難易度'], pay: ['报酬', 'Reward', '報酬'],
      fixerNote: ['发布人备注', 'Requester notes', '依頼主の備考'], payNote: ['报酬说明', 'Reward notes', '報酬の説明'],
      deadline: ['期限', 'Deadline', '期限'], terms: ['要求', 'Requirements', '条件'], risk: ['风险', 'Risks', 'リスク'],
      bonus: ['额外奖励', 'Bonus', '追加報酬'], unlock: ['解锁条件', 'Unlock requirements', '解放条件'], prerequisites: ['前置任务', 'Prerequisite quests', '前提の依頼'],
      content: ['设定正文', 'Setting content', '設定本文'], witness: ['目击者', 'Witness', '目撃者'], event: ['发生的事件', 'Event', '出来事'], clue: ['线索', 'Clue', '手がかり'],
      purpose: ['用途', 'Purpose', '用途'], access: ['开放条件', 'Access conditions', '利用条件'], services: ['服务说明', 'Services', 'サービス'],
      name: ['姓名', 'Name', '名前'], identity: ['身份 / 出身', 'Identity / background', '身分 / 出自'], background: ['背景', 'Background', '背景'],
      relationships: ['关系', 'Relationships', '関係'], boundaries: ['行为边界', 'Behavior boundaries', '行動範囲'], appearance: ['外貌', 'Appearance', '外見'], skills: ['技能说明', 'Skills', '技能'],
    };
    let token = '', epoch = 0, zone = 'overview', currentStatus = 'pending', query = '', currentType = 'all';
    let counts = null, items = [], total = 0, nextCursor = null, cursors = [null], page = 0;
    let listTicket = 0, overviewTicket = 0, detailTicket = 0, reading = false, writing = false, loggingIn = false;
    let listAbort, overviewAbort, loginAbort, detailAbort, searchTimer, dialogAction = null;
    let official;
    let bugImageUrls = [];
    const localized = (node, texts) => {
      if (!Array.isArray(texts)) {
        ['Zh', 'En', 'Ja'].forEach(key => { delete node.dataset['ui' + key]; });
        node.textContent = String(texts ?? ''); return node;
      }
      ['Zh', 'En', 'Ja'].forEach((key, index) => { node.dataset['ui' + key] = texts[index] || texts[0]; });
      node.textContent = T(...texts); return node;
    };
    function element(tag, className, texts) {
      const node = document.createElement(tag); if (className) node.className = className;
      return texts === undefined ? node : localized(node, texts);
    }
    function message(texts, kind = '', target = $('admin-message')) {
      if (window.CXXUI) window.CXXUI.message(target, Array.isArray(texts) ? T(...texts) : texts, kind);
      else { target.className = 'msg ' + kind; target.textContent = Array.isArray(texts) ? T(...texts) : texts; }
      localized(target, texts || ['', '', '']);
    }
    const date = value => {
      const parsed = new Date(value); if (!value || Number.isNaN(parsed.getTime())) return '—';
      const lang = window.CXXI18N?.current() || 'zh';
      return parsed.toLocaleString(lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };
    const label = (catalog, key) => catalog[key] ? T(...catalog[key]) : String(key || '—');
    function button(texts, action, className = 'ghost') {
      const node = element('button', 'btn sm ' + className, texts); node.type = 'button';
      node.addEventListener('click', () => { if (!writing) Promise.resolve(action()).catch(error => showError(error)); });
      return node;
    }
    function errorText(error) {
      const known = {
        unauthorized: ['管理员密码不正确，请重新输入。', 'The administrator password is incorrect. Try again.', '管理者パスワードが正しくありません。再入力してください。'],
        revision_conflict: ['这条内容已被修改，请重新查看后再审核。', 'This item has changed. Review the latest version.', '内容が変更されています。最新の内容を確認してください。'],
        not_pending: ['这条内容已经处理过，列表已刷新。', 'This item has already been reviewed. The list was refreshed.', 'この項目は処理済みです。一覧を更新しました。'],
        not_found: ['这条内容已不存在，请刷新列表。', 'This item no longer exists. Refresh the list.', 'この項目は存在しません。一覧を更新してください。'],
        invalid_cursor: ['分页位置已失效，请刷新列表。', 'This page position is invalid. Refresh the list.', 'ページ位置が無効です。一覧を更新してください。'],
        publisher_unavailable: ['作者账号当前不可用，无法完成此操作。', 'The author account is unavailable for this action.', '投稿者のアカウントが利用できません。'],
        invalid_contract: ['投稿内容未通过现有格式检查，请作者修改后再审核。', 'The submission failed format checks. Ask the author to edit it.', '投稿の形式が不正です。修正後に再審査してください。'],
        source_hash_mismatch: ['投稿来源已经变化，请重新查看最新内容。', 'The submission source has changed. Check the latest content.', '投稿元が変更されています。最新の内容を確認してください。'],
        confirmation_required: ['请准确输入账号编号后再删除。', 'Enter the exact account ID before deleting.', '削除する前に正しいアカウント ID を入力してください。'],
        rate_limited: ['操作太频繁，请稍后再试。', 'Too many actions. Try again shortly.', '操作が多すぎます。しばらくしてから再試行してください。'],
      };
      if (known[error.code]) return known[error.code];
      if (error.status) return [error.message || '操作未成功，请稍后重试。', 'The request failed. Please try again. (' + error.status + ')', '処理に失敗しました。再試行してください。(' + error.status + ')'];
      return ['网络连接失败，请检查连接后重试。', 'Connection failed. Check your connection and retry.', '接続に失敗しました。接続を確認して再試行してください。'];
    }
    function showError(error, target = $('admin-message')) { if (error.name !== 'AbortError') message(errorText(error), 'err', target); }
    async function api(path, options = {}, credential = token, binary = false) {
      const requestEpoch = epoch;
      const response = await fetch(path, { cache: 'no-store', credentials: 'omit', ...options,
        headers: { ...(options.headers || {}), Authorization: 'Bearer ' + credential } });
      if (binary && response.ok) return response.blob();
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true) {
        const error = new Error(body.message || body.error || ('HTTP ' + response.status));
        error.status = response.status; error.code = body.error;
        if (response.status === 401 && token && requestEpoch === epoch) resetLogin(['管理密码已失效，请重新输入。', 'Your management password is no longer valid. Enter it again.', '管理パスワードが無効になりました。再入力してください。']);
        throw error;
      }
      return body;
    }
    function syncBusy() {
      $('admin-workspace').querySelectorAll('button').forEach(node => { node.disabled = writing; });
      $('admin-filters').querySelectorAll('input,select').forEach(node => { node.disabled = writing; });
      $('admin-prev').disabled = writing || reading || page === 0;
      $('admin-next').disabled = writing || reading || !nextCursor;
      $('admin-dialog-confirm').disabled = writing;
      $('admin-dialog-close').disabled = writing;
      $('admin-dialog-body').querySelectorAll('input,textarea,select').forEach(node => { node.disabled = writing; });
      official?.syncControls();
    }
    function closeDialog() {
      detailTicket++; detailAbort?.abort(); dialogAction = null;
      for (const url of bugImageUrls) URL.revokeObjectURL(url);
      bugImageUrls = [];
      if ($('admin-dialog').open) $('admin-dialog').close();
      $('admin-dialog-body').replaceChildren(); localized($('admin-dialog-title'), ['', '', '']); message('', '', $('admin-dialog-message'));
    }
    function resetLogin(notice, focus = true) {
      epoch++; listTicket++; overviewTicket++; detailTicket++;
      token = ''; loggingIn = false; writing = false; reading = false;
      official?.reset();
      [listAbort, overviewAbort, loginAbort, detailAbort].forEach(controller => controller?.abort());
      clearTimeout(searchTimer); closeDialog(); counts = null; items = []; total = 0; nextCursor = null; page = 0; cursors = [null];
      $('token').value = ''; $('token').type = 'password'; $('admin-show-password').setAttribute('aria-pressed', 'false');
      localized($('admin-show-password'), ['显示', 'Show', '表示']);
      $('admin-login').hidden = false; $('admin-workspace').hidden = true;
      $('admin-enter').disabled = false; $('admin-show-password').disabled = false;
      localized($('admin-enter'), ['进入管理台', 'Enter management', '管理画面へ']);
      $('admin-overview').replaceChildren(); $('admin-list').replaceChildren(); $('admin-search').value = '';
      localized($('admin-page-info'), ['', '', '']); $('admin-list').setAttribute('aria-busy', 'false');
      for (const kind of ['feedback', 'submissions']) { $('admin-' + kind + '-badge').textContent = ''; $('admin-' + kind + '-badge').removeAttribute('aria-label'); }
      message('', '', $('admin-message')); message(notice || '', '', $('admin-login-message')); syncBusy();
      if (focus) $('token').focus({ preventScroll: true });
    }
    function renderCounts() {
      if (!counts) return;
      for (const kind of ['feedback', 'submissions']) {
        const count = Number(counts[kind]?.pending || 0); $('admin-' + kind + '-badge').textContent = String(count);
        $('admin-' + kind + '-badge').setAttribute('aria-label', T('待审核 ' + count + ' 条', count + ' pending', '審査待ち ' + count + ' 件'));
      }
      const box = $('admin-overview'); box.replaceChildren();
      const definitions = [
        ['feedback', ['待审留言', 'Pending messages', '未審査メッセージ'], 'pending'],
        ['submissions', ['待审投稿', 'Pending submissions', '未審査投稿'], 'pending'],
        ['announcements', ['公开公告', 'Active announcements', '公開中のお知らせ'], 'active'],
        ['accounts', ['正常账号', 'Active accounts', '有効アカウント'], 'active'],
        ['bugs', ['私密 BUG 反馈', 'Private bug reports', '非公開の不具合報告'], 'total'],
      ];
      for (const [kind, title, field] of definitions) {
        const card = button(title, () => chooseZone(kind), 'admin-card admin-metric panel'); card.replaceChildren();
        card.append(element('span', 'meta', title), element('strong', 'admin-metric-value', String(counts[kind]?.[field] || 0)),
          element('span', 'hint', ['共 ' + (counts[kind]?.total || 0) + ' 条 · 点击查看 →', (counts[kind]?.total || 0) + ' total · View →', '合計 ' + (counts[kind]?.total || 0) + ' 件 · 一覧へ →']));
        box.append(card);
      }
    }
    async function loadOverview() {
      overviewAbort?.abort(); overviewAbort = new AbortController();
      const ticket = ++overviewTicket, session = epoch;
      try {
        const data = await api('/api/admin/overview', { signal: overviewAbort.signal });
        if (ticket !== overviewTicket || session !== epoch) return;
        counts = data.counts; renderCounts(); syncBusy();
      } catch (error) { if (ticket === overviewTicket && session === epoch) showError(error); }
    }
    function renderFilters() {
      $('admin-status-field').hidden = zone === 'bugs';
      const values = zone === 'feedback' ? ['pending', 'approved', 'rejected', 'all'] : zone === 'submissions' ? ['pending', 'approved', 'rejected', 'withdrawn', 'all'] : zone === 'announcements' ? ['active', 'archived', 'all'] : ['active', 'banned', 'all'];
      const select = $('admin-status'); select.replaceChildren();
      for (const value of values) { const texts = zone === 'announcements' && value === 'active' ? ['公开中', 'Published', '公開中'] : statuses[value]; const option = element('option', '', texts); option.value = value; select.append(option); }
      select.value = currentStatus;
      const typeSelect = $('admin-type'); typeSelect.replaceChildren();
      for (const [value, texts] of Object.entries(types)) { const option = element('option', '', texts); option.value = value; typeSelect.append(option); }
      typeSelect.value = currentType; $('admin-type-field').hidden = zone !== 'submissions';
    }
    function renderPageInfo() { localized($('admin-page-info'), ['共 ' + total + ' 条 · 第 ' + (page + 1) + ' 页', total + ' items · Page ' + (page + 1), '合計 ' + total + ' 件 · ' + (page + 1) + ' ページ']); }
    function resetPage() { page = 0; cursors = [null]; nextCursor = null; }
    function chooseZone(next) {
      if (!token || writing || !names[next]) return;
      clearTimeout(searchTimer); closeDialog(); listAbort?.abort(); listTicket++; reading = false;
      zone = next; currentStatus = ['feedback', 'submissions'].includes(zone) ? 'pending' : 'active'; query = ''; currentType = 'all'; items = []; resetPage();
      $('admin-search').value = ''; message('');
      $('admin-content-title').textContent = T(...names[zone]);
      document.querySelectorAll('[data-zone]').forEach(node => { if (node.dataset.zone === zone) node.setAttribute('aria-current', 'page'); else node.removeAttribute('aria-current'); });
      const listZone = zone !== 'overview' && zone !== 'official';
      $('admin-overview').hidden = zone !== 'overview'; $('admin-list').hidden = !listZone;
      $('admin-official').hidden = zone !== 'official';
      $('admin-filters').hidden = !listZone; $('admin-ann-actions').hidden = zone !== 'announcements'; $('admin-pagination').hidden = !listZone;
      if (zone === 'overview') { renderCounts(); if (!counts) loadOverview(); }
      else if (zone === 'official') official.load();
      else { renderFilters(); loadList(); }
      syncBusy();
    }
    function rowShell(title, meta, status, body, statusTexts = statuses[status]) {
      const card = element('article', 'panel admin-card');
      const header = element('div', 'admin-card-heading'); header.append(element('h3', '', title));
      header.append(element('span', 'badge status-' + status, statusTexts || [status, status, status]));
      card.append(header, element('p', 'meta', meta));
      if (body) card.append(element('p', 'admin-card-body', body));
      const actions = element('div', 'toolbar admin-card-actions'); card.append(actions); return { card, actions };
    }
    function confirmAction(title, body, labelTexts, action, requireText) {
      openDialog(title, container => {
        container.append(element('p', 'admin-warning', body));
        if (requireText) {
          const idLabel = element('label', 'fld', ['请输入账号 ID 确认删除', 'Enter the account ID to confirm deletion', '削除するアカウント ID を入力']); idLabel.htmlFor = 'admin-confirm-id';
          const input = element('input'); input.id = 'admin-confirm-id'; input.autocomplete = 'off'; input.required = true; input.spellcheck = false;
          input.addEventListener('input', () => input.setCustomValidity(''));
          container.append(element('p', 'meta', requireText), idLabel, input);
        }
      }, async () => {
        if (requireText && $('admin-confirm-id').value !== requireText) {
          $('admin-confirm-id').setCustomValidity(T('请准确输入上方账号 ID。', 'Enter the exact account ID above.', '上のアカウント ID を正しく入力してください。')); $('admin-confirm-id').reportValidity(); return false;
        }
        return action();
      }, labelTexts);
    }
    function reviewCard(item, submission) {
      const title = submission ? item.title : (item.nickname || T('匿名', 'Anonymous', '匿名')) + T(' 的留言', ' · Message', 'のメッセージ');
      const meta = submission ? '#' + item.id + ' · ' + label(types, item.type) + ' · ' + (item.author_name || T('匿名', 'Anonymous', '匿名')) + ' · ' + date(item.updated_at || item.created_at) + ' · rev' + item.revision : '#' + item.id + ' · ' + date(item.created_at);
      const { card, actions } = rowShell(title, meta, item.status, submission ? item.summary || T('未填写简介', 'No summary provided', '概要なし') : item.body);
      const base = '/api/admin/' + (submission ? 'submissions' : 'feedback') + '/' + item.id;
      const body = submission ? { baseRevision: item.revision } : {};
      if (submission) actions.append(button(['查看详情', 'View details', '詳細を見る'], () => showDetails(item)));
      if (item.status === 'pending') {
        actions.append(button(['通过', 'Approve', '承認'], () => mutate(base + '/approve', body, ['已通过审核。', 'Approved.', '承認しました。']), ''),
          button(['拒绝', 'Reject', '却下'], () => mutate(base + '/reject', body, ['已拒绝这条内容。', 'Rejected.', '却下しました。']), 'warn'));
      }
      if (submission && item.attachment) {
        card.insertBefore(element('p', 'meta admin-attachment', '📎 ' + item.attachment.fileName + ' · ' + Math.ceil(item.attachment.fileSize / 1024) + ' KB'), actions);
        actions.append(button(['删除附件', 'Delete attachment', '添付を削除'], () => confirmAction(['删除附件', 'Delete attachment', '添付を削除'], ['附件将永久删除，投稿会重新进入待审。', 'This attachment will be deleted and the submission returned to pending review.', '添付を削除すると、投稿は再び審査待ちになります。'], ['删除附件', 'Delete attachment', '添付を削除'], () => mutate(base + '/attachment', body, ['附件已删除，投稿已重新待审。', 'Attachment deleted. The submission is pending again.', '添付を削除しました。投稿は再審査待ちです。'], 'DELETE')), 'warn'));
      }
      actions.append(button(['删除条目', 'Delete item', '項目を削除'], () => confirmAction(['删除条目 #' + item.id, 'Delete item #' + item.id, '項目 #' + item.id + ' を削除'], ['条目将永久删除。请确认这是你要删除的内容。', 'This item will be permanently deleted. Confirm you selected the correct item.', 'この項目は完全に削除されます。対象を確認してください。'], ['确认删除', 'Delete', '削除する'], () => mutate(base + '/delete', body, ['条目已删除。', 'Item deleted.', '削除しました。'])), 'ghost'));
      return card;
    }
    function announcementCard(item) {
      const status = item.active ? 'active' : 'archived';
      const { card, actions } = rowShell(item.title, '#' + item.id + ' · ' + label(kinds, item.kind) + (item.pinned ? T(' · 置顶', ' · Pinned', ' · 固定') : '') + ' · ' + date(item.updated_at), status, item.body, item.active ? ['公开中', 'Published', '公開中'] : statuses.archived);
      const base = '/api/admin/announcements/' + item.id;
      actions.append(button(['编辑', 'Edit', '編集'], () => composeAnnouncement(item)),
        button(item.pinned ? ['取消置顶', 'Unpin', '固定を解除'] : ['置顶', 'Pin', '固定'], () => mutate(base + '/pin', undefined, ['置顶状态已更新。', 'Pin status updated.', '固定状態を更新しました。']), ''),
        button(item.active ? ['归档', 'Archive', 'アーカイブ'] : ['恢复', 'Restore', '復元'], () => mutate(base + (item.active ? '/archive' : '/restore'), undefined, ['公告状态已更新。', 'Announcement status updated.', 'お知らせの状態を更新しました。'])),
        button(['删除', 'Delete', '削除'], () => confirmAction(['删除公告', 'Delete announcement', 'お知らせを削除'], [item.title + ' 将永久删除。', item.title + ' will be permanently deleted.', item.title + ' を完全に削除します。'], ['确认删除', 'Delete', '削除する'], () => mutate(base + '/delete', undefined, ['公告已删除。', 'Announcement deleted.', 'お知らせを削除しました。'])), 'warn'));
      return card;
    }
    function accountCard(account) {
      const { card, actions } = rowShell(account.display_name_last || T('未填写名字', 'Unnamed account', '名前なし'), account.publisher_id + ' · ' + T('最近登录 ', 'Last sign-in ', '最終ログイン ') + date(account.last_login_at), account.status, account.banned_reason || '');
      card.insertBefore(element('p', 'meta', T('投稿 ' + account.submissions + ' · 留言 ' + account.feedback + ' · 官方发布：', account.submissions + ' submissions · ' + account.feedback + ' messages · Official publishing: ', '投稿 ' + account.submissions + ' 件 · メッセージ ' + account.feedback + ' 件 · 公式公開：') + (account.canPublishOfficial ? T('已开通', 'Enabled', '有効') : T('未开通', 'Disabled', '無効'))), actions);
      const base = '/api/admin/accounts/' + account.publisher_id;
      if (account.status === 'banned') actions.append(button(['解封', 'Unban', '停止を解除'], () => mutate(base + '/unban', {}, ['账号已解封。', 'Account unbanned.', '利用停止を解除しました。']), ''));
      else actions.append(button(['封禁', 'Ban', '利用停止'], () => openDialog(['封禁账号', 'Ban account', 'アカウントを停止'], container => {
        container.append(element('p', '', account.display_name_last || account.publisher_id));
        const fieldLabel = element('label', 'fld', ['原因（可选）', 'Reason (optional)', '理由（任意）']); fieldLabel.htmlFor = 'admin-ban-reason';
        const reason = element('textarea'); reason.id = 'admin-ban-reason'; reason.maxLength = 200; container.append(fieldLabel, reason);
      }, () => mutate(base + '/ban', { reason: $('admin-ban-reason').value.trim() }, ['账号已封禁。', 'Account banned.', 'アカウントを停止しました。']), ['确认封禁', 'Ban account', '停止する']), 'warn'));
      actions.append(button(account.canPublishOfficial ? ['关闭官方发布', 'Disable official publishing', '公式公開を無効にする'] : ['开通官方发布', 'Enable official publishing', '公式公開を有効にする'], () => confirmAction(['修改官方发布权限', 'Change official publishing permission', '公式公開権限を変更'], account.canPublishOfficial ? ['将关闭此账号的官方更新发布权限。', 'Disable this account’s official update publishing permission.', 'このアカウントの公式更新公開権限を無効にします。'] : ['开通后，此账号可以向所有玩家发布角色卡更新。', 'This account will be able to publish character card updates to all players.', 'このアカウントは全プレイヤーにカード更新を公開できるようになります。'], ['确认修改', 'Confirm change', '変更する'], () => mutate('/api/admin/publishers/' + account.publisher_id + '/official-release', { enabled: !account.canPublishOfficial }, ['官方发布权限已更新。', 'Official publishing permission updated.', '公式公開権限を更新しました。']))));
      actions.append(button(['删除账号和内容', 'Delete account and content', 'アカウントと内容を削除'], () => confirmAction(['删除账号和全部内容', 'Delete account and all content', 'アカウントと全内容を削除'], ['将永久删除此账号及其全部留言和投稿。', 'Permanently delete this account and all its messages and submissions.', 'このアカウントと全メッセージ・投稿を完全に削除します。'], ['永久删除', 'Delete permanently', '完全に削除'], () => mutate(base + '/delete', { confirmPublisherId: account.publisher_id }, ['账号和内容已删除。', 'Account and content deleted.', 'アカウントと内容を削除しました。']), account.publisher_id), 'warn'));
      return card;
    }
    function renderList() {
      const box = $('admin-list'); box.replaceChildren();
      if (!items.length) box.append(element('div', 'empty', ['这里没有符合条件的内容。', 'No items match these filters.', '条件に合う項目はありません。']));
      for (const item of items) box.append(zone === 'bugs' ? bugCard(item) : zone === 'accounts' ? accountCard(item) : zone === 'announcements' ? announcementCard(item) : reviewCard(item, zone === 'submissions'));
      renderPageInfo(); syncBusy();
    }
    async function loadList() {
      if (!token || zone === 'overview') return;
      listAbort?.abort(); listAbort = new AbortController();
      const ticket = ++listTicket, session = epoch, selectedZone = zone;
      const params = new URLSearchParams({ pageSize: '24' });
      if (currentStatus !== 'all' && zone !== 'bugs') params.set('status', currentStatus);
      if (query) params.set('q', query);
      if (zone === 'submissions' && currentType !== 'all') params.set('type', currentType);
      if (cursors[page]) params.set('cursor', cursors[page]);
      reading = true; nextCursor = null; $('admin-pagination').hidden = false; $('admin-list').setAttribute('aria-busy', 'true');
      localized($('admin-page-info'), ['正在读取…', 'Loading…', '読み込み中…']);
      $('admin-list').replaceChildren(element('div', 'empty', ['正在读取…', 'Loading…', '読み込み中…'])); syncBusy();
      try {
        const data = await api('/api/admin/' + selectedZone + '?' + params, { signal: listAbort.signal });
        if (ticket !== listTicket || session !== epoch) return;
        items = data.items; total = data.total; nextCursor = data.nextCursor || null; renderList();
      } catch (error) {
        if (ticket !== listTicket || session !== epoch || error.name === 'AbortError') return;
        items = []; nextCursor = null; $('admin-list').replaceChildren(element('div', 'empty', ['暂时无法读取。', 'Could not load these items.', '一覧を読み込めませんでした。']), button(['重新读取', 'Retry', '再試行'], () => loadList()));
        $('admin-pagination').hidden = true; showError(error);
      } finally { if (ticket === listTicket && session === epoch) { reading = false; $('admin-list').setAttribute('aria-busy', 'false'); syncBusy(); } }
    }
    async function refreshData() { if (!token) return; resetPage(); await Promise.all([loadOverview(), zone === 'overview' ? Promise.resolve() : zone === 'official' ? official.load() : loadList()]); }
    async function mutate(path, body, success, method = 'POST') {
      if (writing || !token) return false;
      clearTimeout(searchTimer); query = $('admin-search').value.trim();
      const session = epoch; writing = true; syncBusy(); let refresh = false, done = false;
      message(['正在处理，请等待结果…', 'Processing. Please wait for the result…', '処理中です。結果をお待ちください…'], '', $('admin-dialog').open ? $('admin-dialog-message') : $('admin-message'));
      try {
        const data = await api(path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
        if (session !== epoch) return false;
        message(data.artifact && path.endsWith('/approve') ? ['已通过审核，已审包已生成。', 'Approved. The reviewed package is ready.', '承認しました。審査済みパッケージを生成しました。'] : success, 'ok'); refresh = true; done = true;
      } catch (error) {
        if (session !== epoch) return false;
        if (error.status === 409) { closeDialog(); message(errorText(error), 'err'); refresh = true; }
        else if (!error.status) message(['未收到成功结果。请刷新检查状态后再决定是否重试。', 'No success result received. Refresh and check the status before retrying.', '成功結果を受信できませんでした。再試行前に更新して状態を確認してください。'], 'err', $('admin-dialog').open ? $('admin-dialog-message') : $('admin-message'));
        else showError(error, $('admin-dialog').open ? $('admin-dialog-message') : $('admin-message'));
      } finally { if (session === epoch && !refresh) { writing = false; syncBusy(); } }
      if (refresh && session === epoch) {
        try { await refreshData(); } finally { if (session === epoch) { writing = false; syncBusy(); } }
      }
      return done;
    }
    function openDialog(title, build, action = null, confirmTexts = ['确认', 'Confirm', '確認']) {
      closeDialog(); localized($('admin-dialog-title'), title); build($('admin-dialog-body')); dialogAction = action;
      $('admin-dialog-confirm').hidden = !action; localized($('admin-dialog-confirm'), confirmTexts);
      localized($('admin-dialog-close'), action ? ['取消', 'Cancel', 'キャンセル'] : ['关闭', 'Close', '閉じる']);
      $('admin-dialog').showModal(); syncBusy();
    }
    function bugCard(item) {
      const { card, actions } = rowShell('BUG #' + item.id, (item.author_name || T('玩家', 'Player', 'プレイヤー')) + ' · ' + date(item.created_at), 'private', item.summary, ['仅管理员可见', 'Administrators only', '管理者のみ']);
      card.insertBefore(element('p', 'meta', [item.imageCount + ' 张图片', item.imageCount + ' images', '画像 ' + item.imageCount + ' 枚']), actions);
      actions.append(button(['查看完整反馈', 'Read full report', '報告全文を見る'], () => showBug(item)));
      return card;
    }
    async function showBug(item) {
      openDialog(['BUG #' + item.id, 'Bug #' + item.id, '不具合 #' + item.id], container => container.append(element('p', '', ['正在读取…', 'Loading…', '読み込み中…'])));
      detailAbort = new AbortController(); const ticket = ++detailTicket, session = epoch, signal = detailAbort.signal;
      const current = () => ticket === detailTicket && session === epoch && $('admin-dialog').open;
      try {
        const data = await api('/api/admin/bugs/' + item.id, { signal });
        if (!current()) return;
        const body = $('admin-dialog-body'); body.replaceChildren(element('p', 'meta', (data.item.author_name || '') + ' · ' + date(data.item.created_at)));
        body.append(element('pre', 'admin-bug-text', data.item.body));
        for (const [index, attachment] of data.item.images.entries()) {
          const blob = await api('/api/admin/bugs/' + item.id + '/images/' + attachment.id, { signal }, undefined, true);
          if (!current()) return;
          const url = URL.createObjectURL(blob); bugImageUrls.push(url);
          const image = element('img', 'admin-bug-image'); image.src = url;
          image.alt = T('BUG 截图 ' + (index + 1), 'Bug screenshot ' + (index + 1), '不具合の画像 ' + (index + 1));
          body.append(image);
        }
      } catch (error) { if (current()) showError(error, $('admin-dialog-message')); }
    }
    async function showDetails(item) {
      openDialog(['投稿 #' + item.id + ' 的详情', 'Submission #' + item.id, '投稿 #' + item.id + ' の詳細'], container => container.append(element('p', 'meta', ['正在读取…', 'Loading…', '読み込み中…'])));
      detailAbort = new AbortController(); const ticket = ++detailTicket, session = epoch;
      try {
        const data = await api('/api/admin/submissions/' + item.id, { signal: detailAbort.signal });
        if (ticket !== detailTicket || session !== epoch || !$('admin-dialog').open) return;
        const current = data.item, body = $('admin-dialog-body'); body.replaceChildren();
        const typeTexts = types[current.type] || [current.type, current.type, current.type];
        const statusTexts = statuses[current.status] || [current.status, current.status, current.status];
        body.append(element('h3', '', current.title), element('p', 'meta', typeTexts.map((text, index) => text + ' · rev' + current.revision + ' · ' + statusTexts[index])),
          element('p', 'admin-card-body', current.summary || ''), element('p', 'meta', ['内容指纹：', 'Content hash: ', '内容ハッシュ：'].map(text => text + (current.contentHash || ''))));
        const payload = current.payload, presentation=document.createElement('div');
        CxxSubmissionView.render(presentation,data.presentation,data.comparison);body.append(presentation);
        body.append(element('p','hint',['格式校验不代替内容审核：请核对世界观、人物知情范围、能力局限及委托结果。','Check canon, knowledge limits, abilities and quest outcomes; format checks do not replace content review.','形式検証とは別に、世界観・知識・能力の限界・任務の結果を確認してください。']));
        const raw = element('details', 'admin-raw-json'); raw.append(element('summary', '', ['查看原始 JSON', 'View raw JSON', '元の JSON を表示']), element('pre', '', JSON.stringify(payload, null, 2))); body.append(raw);
      } catch (error) { if (ticket === detailTicket && session === epoch) showError(error, $('admin-dialog-message')); }
    }
    function composeAnnouncement(item) {
      openDialog(item ? ['编辑公告', 'Edit announcement', 'お知らせを編集'] : ['发布公告', 'New announcement', 'お知らせを作成'], container => {
        const field = (id, texts, tag = 'input') => { const fieldLabel = element('label', 'fld', texts); fieldLabel.htmlFor = id; const control = element(tag); control.id = id; container.append(fieldLabel, control); return control; };
        const kind = field('admin-ann-kind', ['公告类型', 'Announcement type', 'お知らせの種類'], 'select');
        for (const [value, texts] of Object.entries(kinds)) { const option = element('option', '', texts); option.value = value; kind.append(option); } kind.value = item?.kind || 'site';
        const title = field('admin-ann-title', ['标题', 'Title', 'タイトル']); title.maxLength = 120; title.required = true; title.value = item?.title || '';
        const body = field('admin-ann-body', ['正文', 'Body', '本文'], 'textarea'); body.maxLength = 4000; body.required = true; body.rows = 7; body.value = item?.body || '';
        const pinLabel = element('label', 'admin-checkbox'); const pin = element('input'); pin.id = 'admin-ann-pin'; pin.type = 'checkbox'; pin.checked = !!item?.pinned;
        pinLabel.append(pin, element('span', '', ['置顶（会取消其他公告置顶）', 'Pin (unpins other announcements)', '固定（他のお知らせの固定は解除されます）'])); container.append(pinLabel);
      }, () => {
        const body = { title: $('admin-ann-title').value.trim(), body: $('admin-ann-body').value.trim(), kind: $('admin-ann-kind').value, pinned: $('admin-ann-pin').checked };
        if (!body.title || !body.body) { message(['标题和正文不能为空。', 'Title and body are required.', 'タイトルと本文を入力してください。'], 'err', $('admin-dialog-message')); return false; }
        return mutate(item ? '/api/admin/announcements/' + item.id + '/update' : '/api/admin/announcements', body, item ? ['公告已更新。', 'Announcement updated.', 'お知らせを更新しました。'] : ['公告已发布。', 'Announcement published.', 'お知らせを公開しました。']);
      }, item ? ['保存修改', 'Save changes', '変更を保存'] : ['确认发布', 'Publish', '公開する']);
    }
    official = window.CXXOfficialRelease({
      request: (path, body) => api(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      isAuthenticated: () => !!token,
      setBusy: value => { writing = value; syncBusy(); },
    });
    $('admin-login-form').addEventListener('submit', async event => {
      event.preventDefault(); if (loggingIn || !$('admin-login-form').reportValidity()) return;
      const candidate = $('token').value, session = epoch; loggingIn = true; loginAbort = new AbortController();
      $('admin-enter').disabled = true; $('admin-show-password').disabled = true;
      message(['正在验证管理员密码…', 'Verifying your administrator password…', '管理者パスワードを確認中…'], '', $('admin-login-message'));
      try {
        const data = await api('/api/admin/overview', { signal: loginAbort.signal }, candidate);
        if (session !== epoch) return;
        token = candidate; $('token').value = ''; $('token').type = 'password'; counts = data.counts;
        $('admin-login').hidden = true; $('admin-workspace').hidden = false; message('', '', $('admin-login-message'));
        chooseZone(location.hash === '#official' ? 'official' : 'overview'); $('admin-content-title').focus({ preventScroll: true });
      } catch (error) { if (session === epoch) showError(error, $('admin-login-message')); }
      finally { if (session === epoch) { loggingIn = false; $('admin-enter').disabled = false; $('admin-show-password').disabled = false; } }
    });
    $('admin-show-password').addEventListener('click', () => {
      const show = $('token').type === 'password'; $('token').type = show ? 'text' : 'password';
      $('admin-show-password').setAttribute('aria-pressed', String(show)); localized($('admin-show-password'), show ? ['隐藏', 'Hide', '非表示'] : ['显示', 'Show', '表示']);
    });
    document.querySelectorAll('[data-zone]').forEach(node => node.addEventListener('click', () => chooseZone(node.dataset.zone)));
    $('admin-refresh').addEventListener('click', () => { if (!writing) { message(''); refreshData(); } });
    $('admin-logout').addEventListener('click', () => { if (!writing) resetLogin(['已退出管理。', 'Signed out of management.', '管理を終了しました。']); });
    $('admin-status').addEventListener('change', () => { currentStatus = $('admin-status').value; resetPage(); message(''); loadList(); });
    $('admin-type').addEventListener('change', () => { currentType = $('admin-type').value; resetPage(); message(''); loadList(); });
    function search() { if (writing || !token || zone === 'overview' || zone === 'official') return; clearTimeout(searchTimer); query = $('admin-search').value.trim(); resetPage(); message(''); loadList(); }
    $('admin-filters').addEventListener('submit', event => { event.preventDefault(); search(); });
    $('admin-search').addEventListener('input', event => { clearTimeout(searchTimer); if (!event.isComposing) searchTimer = setTimeout(search, 300); });
    $('admin-search').addEventListener('compositionend', () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 300); });
    $('admin-prev').addEventListener('click', () => { if (!reading && !writing && page > 0) { page--; loadList(); } });
    $('admin-next').addEventListener('click', () => { if (!reading && !writing && nextCursor) { cursors[page + 1] = nextCursor; page++; loadList(); } });
    $('admin-ann-new').addEventListener('click', () => { if (!writing) composeAnnouncement(); });
    $('admin-dialog-close').addEventListener('click', () => { if (!writing) closeDialog(); });
    $('admin-dialog').addEventListener('cancel', event => { event.preventDefault(); if (!writing) closeDialog(); });
    $('admin-dialog-form').addEventListener('submit', async event => {
      event.preventDefault(); if (writing || !dialogAction || !$('admin-dialog-form').reportValidity()) return;
      const action = dialogAction, session = epoch;
      try { if (await action() && session === epoch && dialogAction === action) closeDialog(); }
      catch (error) { if (session === epoch) showError(error, $('admin-dialog-message')); }
    });
    document.addEventListener('cxx-lang-changed', () => {
      document.title = T('站务管理 · 东京都2051', 'Site management · Tokyo 2051', 'サイト管理 · 東京都2051');
      if (!token) return;
      $('admin-content-title').textContent = T(...names[zone]); renderCounts();
      if (zone !== 'overview' && zone !== 'official') { renderFilters(); if (!reading) renderList(); }
    });
    window.addEventListener('pagehide', () => resetLogin(undefined, false));
    window.addEventListener('pageshow', event => { if (event.persisted) resetLogin(); else $('token').value = ''; });
    resetLogin(undefined, false);
    document.title = T('站务管理 · 东京都2051', 'Site management · Tokyo 2051', 'サイト管理 · 東京都2051');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
