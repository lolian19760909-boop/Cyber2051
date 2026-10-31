'use strict';
// Shared website presentation. No administrator credentials are stored here.
(function () {
  const lang = () => window.CXXI18N ? CXXI18N.current() : 'zh';
  const t = (zh, en, ja) => ({ zh, en, ja: ja || en || zh }[lang()] || zh);
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function message(node, text, kind) {
    node.textContent = text || '';
    node.classList.remove('ok', 'err', 'busy');
    if (kind) node.classList.add(kind);
    node.setAttribute('role', kind === 'err' ? 'alert' : 'status');
    node.setAttribute('aria-live', kind === 'err' ? 'assertive' : 'polite');
  }
  function errorText(error) {
    const code = error && (error.code || error.message);
    const errors = {
      unauthorized: ['登录已失效，请重新登录。', 'Please sign in again.', 'もう一度ログインしてください。'],
      revision_conflict: ['内容已变化，请重新查看后操作。', 'This content changed. Reload before continuing.', '内容が変更されました。再確認してください。'],
      not_pending: ['这条内容已被处理，请刷新查看。', 'This item has already been reviewed. Reload the list.', 'この内容は処理済みです。再読み込みしてください。'],
      invalid_cursor: ['分页信息已失效，请回到第一页。', 'This page link is invalid. Return to the first page.', 'ページ情報が無効です。最初のページに戻ってください。'],
      rate_limited: ['操作太频繁，请稍后再试。', 'Please wait before trying again.', '少し待ってから再試行してください。']
    };
    if (errors[code]) return t(...errors[code]);
    return t('读取或操作失败，请检查连接后重试。', 'The request failed. Check your connection and try again.', '通信に失敗しました。接続を確認して再試行してください。');
  }
  function applyStrings() {
    document.querySelector('.site-theme-choices')?.setAttribute('aria-label',t('界面色调','Color theme','配色'));
    document.querySelectorAll('[data-ui-zh]').forEach(node => {
      node.textContent = t(node.dataset.uiZh, node.dataset.uiEn, node.dataset.uiJa);
    });
    document.querySelectorAll('[data-ui-ph-zh]').forEach(node => {
      node.placeholder = t(node.dataset.uiPhZh, node.dataset.uiPhEn, node.dataset.uiPhJa);
    });
    document.querySelectorAll('[data-ph-zh]').forEach(node => {
      node.placeholder = t(node.dataset.phZh, node.dataset.phEn, node.dataset.phJa);
    });
    document.querySelectorAll('img[data-ui-alt-zh]').forEach(node => {
      node.alt = t(node.dataset.uiAltZh, node.dataset.uiAltEn, node.dataset.uiAltJa);
    });
  }
  window.CXXUI = Object.freeze({ t, lang, element, message, errorText, applyStrings });

  function boot() {
    document.documentElement.dataset.siteReady = 'true';
    const root = document.documentElement;
    const theme = window.CxxTheme;
    theme.attach(document);
    root.dataset.input = 'pointer';
    const closingMenus = new Map();
    function setDropdown(dropdown, opened, instant = false) {
      if (!dropdown) return;
      clearTimeout(closingMenus.get(dropdown)); closingMenus.delete(dropdown);
      const summary = dropdown.querySelector('summary');
      const panel = dropdown.querySelector('.account-links, .display-panel');
      summary.setAttribute('aria-expanded', String(opened));
      panel.inert = !opened;
      if (opened) {
        dropdown.open = true; dropdown.dataset.popover = 'open';
      } else {
        dropdown.dataset.popover = 'closed';
        if (!dropdown.open) return;
        if (instant || root.dataset.motion === 'off' || root.dataset.input === 'keyboard') dropdown.open = false;
        else closingMenus.set(dropdown, setTimeout(() => { dropdown.open = false; closingMenus.delete(dropdown); }, 120));
      }
    }
    function finishClosingMenus() {
      for (const dropdown of Array.from(closingMenus.keys())) setDropdown(dropdown, false, true);
    }
    document.addEventListener('pointerdown', () => { root.dataset.input = 'pointer'; }, { capture: true, passive: true });
    document.addEventListener('keydown', () => { root.dataset.input = 'keyboard'; finishClosingMenus(); }, true);
    const bar = document.querySelector('.site-header .bar');
    const nav = bar && bar.querySelector('.nav');
    const footer = document.querySelector('.site-footer');
    let menu, settings, effects, language, account;
    if (bar && nav) {
      if (!nav.id) nav.id = 'site-navigation';
      nav.setAttribute('aria-label', t('网站导航', 'Site navigation', 'サイトナビゲーション'));
      // All pages, including the publisher, share the same primary destinations.
      const destinations = [['/', ['首页', 'Home', 'ホーム']], ['/recent.html', ['近期详情', 'Latest details', '最近の情報']], ['/play/', ['开始游玩', 'Play now', 'プレイする']], ['/workshop.html', ['创意工坊', 'Workshop', '工房']], ['/workshop/', ['留言墙', 'Message wall', '掲示板']], ['/recent.html#download', ['卡下载', 'Downloads', 'ダウンロード']]];
      const tools = element('div', 'header-tools');
      language = element('select', 'language-menu'); language.id = 'site-language';
      const languageLabel = element('label', 'sr-only', ''); languageLabel.htmlFor = language.id;
      [languageLabel.dataset.uiZh, languageLabel.dataset.uiEn, languageLabel.dataset.uiJa] = ['语言', 'Language', '言語'];
      for (const [value, label] of [['zh', '中文'], ['en', 'English'], ['ja', '日本語']]) {
        const option = element('option', '', label); option.value = value; language.append(option);
      }
      language.addEventListener('change', () => CXXI18N.apply(language.value));
      nav.querySelector('.lang-sw')?.remove();
      account = element('details', 'account-menu');
      const accountSummary = element('summary', '', '');
      [accountSummary.dataset.uiZh, accountSummary.dataset.uiEn, accountSummary.dataset.uiJa] = ['账户', 'Account', 'アカウント'];
      const accountLinks = element('div', 'account-links');
      // user.js finds its original chip under .nav on every account update.
      const userArea = nav.querySelector('#user-area') || nav.querySelector('.user-chip');
      if (userArea) accountLinks.append(userArea);
      else {
        const user = element('a', 'user-chip', t('登录', 'Sign in', 'ログイン')); user.href = '/my.html';
        if (!window.CXXUser) [user.dataset.uiZh, user.dataset.uiEn, user.dataset.uiJa] = ['登录 / 我的投稿', 'Sign in / My posts', 'ログイン / マイ投稿'];
        accountLinks.append(user);
      }
      for (const [href, labels] of [['/workshop/submit.html', ['我要投稿', 'Share a creation', '作品を投稿']], ['/workshop/admin.html', ['管理员入口', 'Administrator', '管理者入口']]]) {
        const link = element('a', href.includes('admin.html') ? 'admin-entry' : '', ''); link.href = href;
        [link.dataset.uiZh, link.dataset.uiEn, link.dataset.uiJa] = labels; accountLinks.append(link);
      }
      account.append(accountSummary, accountLinks);
      for (const link of Array.from(nav.children)) {
        if (link.tagName === 'A' && !destinations.some(([href]) => link.getAttribute('href') === href)) link.remove();
      }
      for (const [href, labels] of destinations) {
        let link = Array.from(nav.querySelectorAll('a')).find(a => a.getAttribute('href') === href);
        if (!link) { link = element('a', '', t(...labels)); link.href = href; nav.append(link); }
        [link.dataset.uiZh, link.dataset.uiEn, link.dataset.uiJa] = labels;
        if(href===location.pathname)link.setAttribute('aria-current','page');
      }
      const closeMenu = () => {
        menu.setAttribute('aria-expanded', 'false'); bar.classList.remove('menu-open');
        setDropdown(account, false); setDropdown(settings, false);
      };
      menu = element('button', 'nav-toggle', ''); menu.type = 'button';
      menu.setAttribute('aria-controls', nav.id); menu.setAttribute('aria-expanded', 'false');
      menu.addEventListener('click', () => {
        const opened = menu.getAttribute('aria-expanded') !== 'true';
        menu.setAttribute('aria-expanded', String(opened)); bar.classList.toggle('menu-open', opened);
        if (!opened) { setDropdown(account, false); setDropdown(settings, false); }
      });
      nav.addEventListener('click', e => {
        if (e.target.closest('a')) closeMenu();
      });
      bar.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const opened = [account, settings].find(node => node.dataset.popover === 'open' && node.contains(e.target)) || [account, settings].find(node => node.dataset.popover === 'open');
        if (opened) { setDropdown(opened, false, true); opened.querySelector('summary').focus(); e.preventDefault(); }
        else if (menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); e.preventDefault(); }
      });
      settings = element('details', 'display-settings tools-menu');
      const summary = element('summary', '', ''); summary.dataset.uiZh = '工具'; summary.dataset.uiEn = 'Tools'; summary.dataset.uiJa = 'ツール';
      const panel = element('div', 'display-panel');
      const themeChoices = element('div', 'site-theme-choices'); themeChoices.setAttribute('role','group'); themeChoices.setAttribute('aria-label',t('界面色调','Color theme','配色'));
      for (const [value, labels] of [['red',['红','Red','レッド']],['yellow',['黄','Yellow','イエロー']],['night',['夜','Night','ナイト']]]) {
        const choice=element('button','',t(...labels)); choice.type='button';choice.dataset.theme=value;
        [choice.dataset.uiZh,choice.dataset.uiEn,choice.dataset.uiJa]=labels;
        choice.addEventListener('click',()=>theme.set(value));themeChoices.append(choice);
      }
      const paintTheme=()=>{
        for(const choice of themeChoices.children)choice.setAttribute('aria-pressed',String(choice.dataset.theme===theme.read()));
        const meta=document.querySelector('meta[name="theme-color"]');
        if(meta)meta.content=getComputedStyle(root).getPropertyValue('--ink').trim();
      };
      theme.subscribe(paintTheme); paintTheme();
      const label = element('label', 'fld', ''); label.htmlFor = 'display-effects';
      label.dataset.uiZh = '动态效果'; label.dataset.uiEn = 'Effects'; label.dataset.uiJa = 'エフェクト';
      effects = element('select', ''); effects.id = 'display-effects';
      [['full', ['完整', 'Full', 'フル']], ['light', ['轻量', 'Light', '軽量']], ['static', ['静止', 'Still', '静止']]].forEach(([value, labels]) => {
        const option = element('option', '', t(...labels)); option.value = value;
        [option.dataset.uiZh, option.dataset.uiEn, option.dataset.uiJa] = labels; effects.append(option);
      });
      const hint = element('p', 'hint', ''); hint.dataset.uiZh = '系统的减少动态效果设置优先。'; hint.dataset.uiEn = 'Your system’s reduced-motion preference takes priority.'; hint.dataset.uiJa = 'システムの動きを減らす設定が優先されます。';
      panel.append(label, effects, hint); settings.append(summary, panel);
      tools.append(languageLabel, language, themeChoices, account, settings); nav.append(tools); bar.append(menu);
      for (const dropdown of [account, settings]) {
        setDropdown(dropdown, false, true);
        dropdown.querySelector('summary').addEventListener('click', event => {
          event.preventDefault();
          const opened = dropdown.dataset.popover !== 'open';
          for (const other of [account, settings]) if (other !== dropdown) setDropdown(other, false);
          setDropdown(dropdown, opened);
        });
      }
      document.addEventListener('click', e => {
        if (!account.contains(e.target)) setDropdown(account, false);
        if (!settings.contains(e.target)) setDropdown(settings, false);
        if (!bar.contains(e.target)) closeMenu();
      });
    }
    const footerAdmin = footer && footer.querySelector('a[href="/workshop/admin.html"]');
    if (footerAdmin) footerAdmin.classList.add('admin-entry');
    if (footer && !footerAdmin) {
      const link = element('a', 'admin-entry', ''); link.href = '/workshop/admin.html';
      link.dataset.uiZh = '管理员入口'; link.dataset.uiEn = 'Admin entrance'; link.dataset.uiJa = '管理者入口';
      footer.append(element('div', 'footer-utility')); footer.lastChild.append(link);
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = matchMedia('(max-width: 760px)');
    let saved, revealObserver;
    try { saved = localStorage.getItem('cxx-display-mode'); } catch {}
    if (!['full', 'light', 'static'].includes(saved)) saved = null;
    function applyEffects() {
      const mode = saved || (narrow.matches ? 'light' : 'full');
      document.documentElement.dataset.effects = mode;
      document.documentElement.dataset.motion = reduced.matches || mode === 'static' ? 'off' : 'on';
      if (effects) effects.value = mode;
      if (mode !== 'full' || document.documentElement.dataset.motion === 'off') showPendingReveals();
      if (document.documentElement.dataset.motion === 'off') finishClosingMenus();
    }
    if (effects) effects.addEventListener('change', () => {
      saved = effects.value; try { localStorage.setItem('cxx-display-mode', saved); } catch {}
      applyEffects();
    });
    reduced.addEventListener('change', applyEffects); narrow.addEventListener('change', applyEffects); applyEffects();
    if (!document.body.classList.contains('home-page') && root.dataset.motion === 'on') {
      const enter = () => import('/workshop/site-entry.mjs?v=expansion20261016').then(module => module.enter()).catch(() => {});
      if ('requestIdleCallback' in window) requestIdleCallback(enter, {timeout:1000}); else setTimeout(enter, 80);
    }
    const scanObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('scan-offscreen', !entry.isIntersecting))) : null;
    document.querySelectorAll('.scan').forEach(node => scanObserver?.observe(node));
    document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('fx-paused', document.hidden));
    document.documentElement.classList.toggle('fx-paused', document.hidden);
    const seen = new WeakSet();
    revealObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('revealed'); revealObserver.unobserve(entry.target); }
    }), { threshold: 0.05 }) : null;
    function showPendingReveals() {
      document.querySelectorAll('.reveal-ready:not(.revealed)').forEach(node => {
        node.classList.add('revealed'); revealObserver?.unobserve(node);
      });
    }
    function reveal() {
      document.querySelectorAll('.entries > .entry, .story-image, .story-copy, .home-section .section-head').forEach(node => {
        if (seen.has(node)) return; seen.add(node);
        node.classList.add('reveal-ready');
        const siblings = Array.from(node.parentElement.children); const index = siblings.indexOf(node);
        node.style.setProperty('--reveal-delay', index < 6 ? Math.max(0, index) * 40 + 'ms' : '0ms');
        if (revealObserver && document.documentElement.dataset.effects === 'full' && document.documentElement.dataset.motion === 'on' && root.dataset.input !== 'keyboard') revealObserver.observe(node);
        else node.classList.add('revealed');
      });
    }
    reveal();
    if (typeof MutationObserver === 'function') {
      for (const list of document.querySelectorAll('.entries')) {
        new MutationObserver(reveal).observe(list, { childList: true });
      }
    }
    window.addEventListener('pageshow', event => {
      document.documentElement.classList.toggle('fx-paused', document.hidden);
      if (event.persisted) showPendingReveals();
    });
    function languageChanged() {
      nav?.querySelector('.lang-sw')?.remove();
      applyStrings();
      if (language) language.value = lang();
      if (menu) menu.textContent = t('菜单', 'Menu', 'メニュー');
      if (nav) nav.setAttribute('aria-label', t('网站导航', 'Site navigation', 'サイトナビゲーション'));
    }
    document.addEventListener('cxx-lang-changed', languageChanged); languageChanged();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
