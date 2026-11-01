export function mountBulletinView({scope,container,articles,openId='',logoUrl,setTheme,onClose,onRefresh,returnFocus}) {
  const document=container.ownerDocument;
  'use strict';

  const byId = new Map(articles.map(article => [article.id, article]));
  const searchable = new Map(articles.map(article => [article.id, [article.title, article.group, article.summary,
    ...article.sections.flatMap(section => [section.title, ...(section.paragraphs || []), ...(section.bullets || []),
      ...(section.steps || []).flatMap(step => [step.title, step.text]), section.callout?.title, section.callout?.text,
      section.image?.caption, ...(section.table?.headings || []), ...(section.table?.rows || []).flat(),
      ...(section.faq || []).flatMap(item => [item.question, item.answer])])].join('\n').toLocaleLowerCase('zh-CN')]));
  const labels = { notice: '公告', update: '更新记录', letter: '作者来信', guide: '游玩指南' };
  const dialog = scope.getElementById('cxx-bulletin');
  const panel = scope.getElementById('cxx-bulletin-panel');
  const index = scope.getElementById('cxx-index-list');
  const reader = scope.getElementById('cxx-document');
  const articleRoot = scope.getElementById('cxx-article');
  const search = scope.getElementById('cxx-search');
  const mobileIndex = scope.getElementById('cxx-mobile-index');
  const tabs = [...scope.querySelectorAll('[data-tab]')];
  const previous = scope.getElementById('cxx-previous');
  const next = scope.getElementById('cxx-next');
  const themePicker = scope.getElementById('cxx-theme');
  const themeTrigger = themePicker.querySelector('summary');
  const themeChoices = [...themePicker.querySelectorAll('[data-theme-option]')];
  const openedId = openId;
  let selected = byId.get(openedId) || articles[0];
  let activeTab = selected?.kind === 'guide' ? 'guide' : 'notices';
  let query = '';
  let visible = [];
  let largeText = false;

  // 内容是本地作者维护的数据；纯文本写入 DOM，不解析正文 HTML。
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const shapes = {
      arrow: ['path', { d: 'M4 12h16m-6-6 6 6-6 6' }],
      image: ['path', { d: 'M3 4h18v16H3zM3 17l6-6 4 4 3-3 5 5M15 8h.01' }]
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const [tag, attributes] = shapes[name];
    const shape = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value);
    svg.append(shape);
    return svg;
  }

  function button(className, text, onClick) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  function listOpen(open) {
    panel.dataset.listOpen = String(open);
    mobileIndex.setAttribute('aria-expanded', String(open));
  }

  function setTab(tab) {
    activeTab = tab;
    query = '';
    search.value = '';
    selected = null;
    render();
  }

  function choose(article, focusReader = false) {
    selected = article;
    listOpen(false);
    renderIndex();
    renderArticle();
    updatePager();
    if (focusReader) articleRoot.querySelector('h2').focus({ preventScroll: true });
  }

  function render() {
    const kinds = { notices: ['notice', 'update', 'letter'], updates: ['update'], letters: ['letter'], guide: ['guide'] }[activeTab];
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    visible = articles.filter(article => kinds.includes(article.kind) && (!needle || searchable.get(article.id).includes(needle)));
    if (!visible.includes(selected)) selected = visible[0] || null;
    for (const tab of tabs) {
      const current = tab.dataset.tab === activeTab;
      tab.setAttribute('aria-selected', String(current));
      tab.tabIndex = current ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', 'cxx-tab-' + activeTab);
    search.placeholder = activeTab === 'guide' ? '搜索教程' : '搜索公告';
    renderIndex();
    renderArticle();
    updatePager();
  }

  function renderIndex() {
    index.replaceChildren();
    let lastGroup = '';
    visible.forEach((article, position) => {
      if (article.group && article.group !== lastGroup) {
        index.append(element('h2', 'cxx-list-group', article.group));
        lastGroup = article.group;
      }
      const item = button('cxx-index-item', undefined, () => choose(article, true));
      if (article === selected) item.setAttribute('aria-current', 'page');
      const identity = element('span', article.kind === 'guide' ? 'cxx-chapter-number' : 'cxx-date-tile');
      identity.setAttribute('aria-hidden', 'true');
      if (article.kind === 'guide') identity.textContent = String(articles.filter(a => a.kind === 'guide').indexOf(article) + 1).padStart(2, '0');
      else identity.append(element('b', '', article.date.slice(8)), element('small', '', article.date.slice(5, 7) + '月'));
      const name = element('span', 'cxx-item-title', article.title);
      if (article.kind !== 'guide') name.append(element('span', 'cxx-item-meta', (article.pinned ? '置顶 · ' : '') + labels[article.kind]));
      const arrow = element('span', 'cxx-item-arrow');
      arrow.setAttribute('aria-hidden', 'true');
      item.append(identity, name, arrow);
      item.setAttribute('aria-label', article.title + (article.kind === 'guide' ? '' : '，' + article.date + (article.pinned ? '，置顶' : '')));
      item.addEventListener('keydown', event => {
        const offset = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
        if (!offset) return;
        event.preventDefault();
        const target = index.querySelectorAll('.cxx-index-item')[Math.max(0, Math.min(visible.length - 1, position + offset))];
        target.focus();
      });
      index.append(item);
    });
    if (!visible.length) {
      const empty = element('div', 'cxx-empty-index', query ? '没有找到相关内容' : activeTab === 'guide' ? '暂无教程' : '暂无公告');
      if(query)empty.append(button('cxx-clear-search', '清除搜索', () => { query = ''; search.value = ''; render(); search.focus(); }));
      index.append(empty);
    }
    scope.getElementById('cxx-result-count').textContent = visible.length + (activeTab === 'guide' ? ' 篇教程' : ' 则公告');
    scope.getElementById('cxx-mobile-label').textContent = (activeTab === 'guide' ? '教程目录' : '公告目录') + (selected ? ' · ' + selected.title : '');
  }

  function renderArticle() {
    articleRoot.replaceChildren();
    reader.scrollTop = 0;
    if (!selected) {
      const empty = element('div', 'cxx-reader-empty');
      empty.append(element('h2', '', query ? '没有找到相关内容' : activeTab === 'guide' ? '暂无教程' : '暂无公告'), element('p', '', query ? '换个关键词，或清除搜索后查看全部条目。' : '新内容发布后会显示在这里。'));
      articleRoot.append(empty);
      return;
    }

    const tools = element('div', 'cxx-article-tools');
    const meta = element('div', 'cxx-article-meta');
    meta.append(element('span', 'cxx-article-tag', selected.pinned ? '置顶' : labels[selected.kind]));
    if (selected.group) meta.append(element('span', '', selected.group));
    const date = element('time', '', selected.date.replaceAll('-', '.'));
    date.dateTime = selected.date;
    meta.append(date);
    const typeControl = element('div', 'cxx-type-control');
    typeControl.setAttribute('role', 'group');
    typeControl.setAttribute('aria-label', '正文字号');
    [false, true].forEach(large => {
      const control = button('', 'A', () => {
        largeText = large;
        container.style.setProperty('--notice-body-size', large ? '18px' : '16px');
        for (const child of typeControl.children) child.setAttribute('aria-pressed', String(child === control));
      });
      control.setAttribute('aria-label', large ? '较大字号' : '标准字号');
      control.setAttribute('aria-pressed', String(largeText === large));
      typeControl.append(control);
    });
    tools.append(meta, typeControl);
    const heading = element('h2', 'cxx-article-heading', selected.title);
    heading.tabIndex = -1;
    articleRoot.append(tools, heading, element('p', 'cxx-article-summary', selected.summary));
    if (selected.cover) {
      const cover = element('div', 'cxx-cover');
      cover.setAttribute('role', 'img');
      cover.setAttribute('aria-label', 'Tokyo 2051，卡内标志');
      const logo = element('img', 'cxx-cover-logo');
      logo.src = logoUrl;
      logo.alt = '';
      cover.append(logo);
      articleRoot.append(cover);
    }
    if (selected.kind === 'guide') {
      const toc = element('details', 'cxx-toc');
      toc.open = true;
      const nav = element('nav');
      nav.setAttribute('aria-label', '本篇教程目录');
      selected.sections.forEach((section, i) => nav.append(button('', section.title, () => {
        const target = articleRoot.querySelector('#cxx-section-' + i);
        target.scrollIntoView({ block: 'start' });
        target.querySelector('h3').focus({ preventScroll: true });
      })));
      toc.append(element('summary', '', '本篇内容'), nav);
      articleRoot.append(toc);
    }
    selected.sections.forEach((section, i) => {
      const block = element('section', 'cxx-article-section');
      block.id = 'cxx-section-' + i;
      const title = element('h3', '', section.title);
      title.tabIndex = -1;
      if(section.title)block.append(title);
      for (const text of section.paragraphs || []) block.append(element('p', '', text));
      if (section.callout) {
        const callout = element('aside', 'cxx-callout');
        callout.append(element('strong', '', section.callout.title), element('p', '', section.callout.text));
        block.append(callout);
      }
      if (section.bullets) {
        const list = element('ul');
        for (const text of section.bullets) list.append(element('li', '', text));
        block.append(list);
      }
      if (section.steps) {
        const list = element('ol', 'cxx-steps');
        section.steps.forEach((step, n) => {
          const item = element('li');
          const number = element('span', 'cxx-step-number', String(n + 1).padStart(2, '0'));
          number.setAttribute('aria-hidden', 'true');
          const body = element('div', 'cxx-step-body');
          body.append(element('strong', '', step.title), element('p', '', step.text));
          item.append(number, body);
          list.append(item);
        });
        block.append(list);
      }
      if (section.image) {
        const figure = element('figure', 'cxx-figure');
        const placeholder = () => {
          const node = element('div', 'cxx-image-placeholder');
          node.append(icon('image'), element('span', '', '教程截图位置'));
          return node;
        };
        if (section.image.src) {
          const image = element('img');
          image.src = section.image.src;
          image.alt = section.image.alt;
          image.loading = 'lazy';
          image.addEventListener('error', () => {
            const missing = placeholder();
            missing.lastChild.textContent = '图片未找到，请检查内容文件中的路径';
            image.replaceWith(missing);
          }, { once: true });
          figure.append(image);
        } else figure.append(placeholder());
        figure.append(element('figcaption', '', section.image.caption));
        block.append(figure);
      }
      if (section.table) {
        const wrap = element('div', 'cxx-table-wrap');
        wrap.tabIndex = 0;
        wrap.setAttribute('role', 'region');
        wrap.setAttribute('aria-label', section.title + '表格');
        const table = element('table');
        const head = element('thead');
        const headRow = element('tr');
        for (const text of section.table.headings) {
          const th = element('th', '', text);
          th.scope = 'col';
          headRow.append(th);
        }
        head.append(headRow);
        const body = element('tbody');
        for (const row of section.table.rows) {
          const tr = element('tr');
          for (const cell of row) tr.append(element('td', '', cell));
          body.append(tr);
        }
        table.append(head, body);
        wrap.append(table);
        block.append(wrap);
      }
      for (const item of section.faq || []) {
        const faq = element('details', 'cxx-faq');
        faq.append(element('summary', '', item.question), element('p', '', item.answer));
        block.append(faq);
      }
      articleRoot.append(block);
    });
    if (selected.signature) articleRoot.append(element('p', 'cxx-article-signature', selected.signature));
    if (selected.related) {
      const related = byId.get(selected.related);
      const relatedButton = button('cxx-related', undefined, () => {
        activeTab = related.kind === 'guide' ? 'guide' : 'notices';
        query = '';
        search.value = '';
        selected = related;
        listOpen(false);
        render();
        articleRoot.querySelector('h2').focus({ preventScroll: true });
      });
      relatedButton.append(element('span', '', selected.kind === 'guide' ? '继续阅读' : '相关教程'), element('strong', '', related.title), icon('arrow'));
      articleRoot.append(relatedButton);
    }
  }

  function updatePager() {
    const position = visible.indexOf(selected);
    scope.getElementById('cxx-page-count').textContent = (position + 1) + ' / ' + visible.length;
    previous.disabled = position <= 0;
    next.disabled = position < 0 || position >= visible.length - 1;
  }

  tabs.forEach((tab, n) => {
    tab.addEventListener('click', () => { listOpen(false); setTab(tab.dataset.tab); });
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = tabs[(n + 1) % tabs.length];
      if (event.key === 'ArrowLeft') target = tabs[(n + tabs.length - 1) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs[tabs.length - 1];
      if (!target) return;
      event.preventDefault();
      target.focus();
      listOpen(false);
      setTab(target.dataset.tab);
    });
  });
  mobileIndex.addEventListener('click', () => listOpen(panel.dataset.listOpen !== 'true'));
  search.addEventListener('input', () => { query = search.value; render(); });
  previous.addEventListener('click', () => choose(visible[visible.indexOf(selected) - 1], true));
  next.addEventListener('click', () => choose(visible[visible.indexOf(selected) + 1], true));
  themeChoices.forEach(control => control.addEventListener('click', () => {
    const theme = control.dataset.themeOption;
    setTheme(theme);
    themePicker.dataset.currentTheme = theme;
    scope.getElementById('cxx-theme-name').textContent = control.dataset.themeName;
    themeTrigger.setAttribute('aria-label', '切换界面主题，当前为' + control.dataset.themeName);
    themeChoices.forEach(choice => choice.setAttribute('aria-pressed', String(choice === control)));
    themePicker.open = false;
    themeTrigger.focus();
  }));
  themePicker.addEventListener('focusout', event => {
    if (!themePicker.contains(event.relatedTarget)) themePicker.open = false;
  });
  dialog.addEventListener('pointerdown', event => {
    if (!themePicker.contains(event.target)) themePicker.open = false;
  });
  scope.querySelectorAll('[data-close]').forEach(control => control.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => { themePicker.open = false; onClose(scope.getElementById('cxx-notice-remember').checked); returnFocus?.focus?.(); });
  dialog.addEventListener('cancel', event => {
    if (themePicker.open) {
      event.preventDefault();
      themePicker.open = false;
      themeTrigger.focus();
      return;
    }
    if (panel.dataset.listOpen !== 'true') return;
    event.preventDefault();
    listOpen(false);
    mobileIndex.focus();
  });
  scope.querySelectorAll('[data-open]').forEach(control => control.addEventListener('click', () => {
    returnFocus = control;
    listOpen(false);
    setTab(control.dataset.open);
    dialog.showModal();
  }));
  render();
  dialog.showModal();
  scope.getElementById('cxx-notice-refresh').onclick=onRefresh;
  const syncTheme=(theme)=>{themePicker.dataset.currentTheme=theme;themeChoices.forEach(choice=>choice.setAttribute('aria-pressed',String(choice.dataset.themeOption===theme)));const label=themeChoices.find(c=>c.dataset.themeOption===theme)?.dataset.themeName||'红色';scope.getElementById('cxx-theme-name').textContent=label;themeTrigger.setAttribute('aria-label','切换界面主题，当前为'+label);};
  return {dialog,close:()=>dialog.close(),syncTheme};
}
