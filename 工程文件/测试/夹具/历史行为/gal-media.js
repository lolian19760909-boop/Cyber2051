(function (root, factory) {
  'use strict';
  const api = factory(typeof module === 'object' && module.exports ? require('./landscape.js') : root.CxxGalLandscape);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxGalUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (landscape) {
  'use strict';

  function mount(options) {
    const doc = options.document;
    const parent = options.parent || doc.body;
    if (doc.getElementById('cxx-galgame-root')) throw new Error('Galgame 界面已经打开。');
    const previousFocus = doc.activeElement;
    const disposers = [];
    let destroyed = false;
    let composing = false;
    let model = {};
    let historySignature = '';
    let choiceSignature = '';
    let paragraphSignature = '';
    let paragraphScrollPending = false;
    let readingSignature = '';
    let readingTick = null, readingProbe = null, fontScrollRatio = null;
    const spriteNodes = new Map();
    const spriteExits = new Map();
    const spriteFailures = new Map();
    const mediaQueue = new Map();
    let mediaActive = null, mediaTick = null;
    let desiredSprites = [], speakingId = null;
    let openingView = null, hudSignature = '', detailSignature = '', backgroundUrl = '';
    let openingMessage, openingSwipe, openingRaw;

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function listen(node, event, handler) {
      node.addEventListener(event, handler);
      disposers.push(function () { node.removeEventListener(event, handler); });
    }
    function call(name, value) {
      if (!destroyed && typeof options[name] === 'function') options[name](value);
    }
    function button(text, callback, className) {
      const node = element('button', className || 'cxx-gal-button', text);
      node.type = 'button';
      listen(node, 'click', callback);
      return node;
    }
    function setText(node, value) {
      const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
      if (node.textContent !== text) node.textContent = text;
    }
    function setAttribute(node, name, value) {
      if (node.getAttribute(name) !== String(value)) node.setAttribute(name, value);
    }
    // One extra image may be loading/decoding across the stage. Keep the displayed
    // image until its replacement is decoded, and reject stale expression results.
    function scheduleMedia() {
      if (destroyed || mediaTick !== null) return;
      mediaTick = doc.defaultView.requestAnimationFrame(pumpMedia);
    }
    function cancelMedia(job) {
      if (!job) return;
      doc.defaultView.clearTimeout(job.timer);
      job.cancelCommit?.();
      job.node.onload = null; job.node.onerror = null;
      if (mediaActive === job) mediaActive = null;
      job.node.removeAttribute('src');
    }
    function queueImage(owner, key, urls, valid, commit, failed) {
      if ((mediaActive?.owner === owner && mediaActive.key === key) || mediaQueue.get(owner)?.key === key) return;
      mediaQueue.set(owner, { owner, key, urls, valid, commit, failed }); scheduleMedia();
    }
    function pumpMedia() {
      mediaTick = null;
      if (destroyed) return;
      for (const [owner, job] of mediaQueue) if (!job.valid()) mediaQueue.delete(owner);
      if (mediaActive) {
        if (mediaActive.valid()) return;
        cancelMedia(mediaActive);
      }
      const next = [...mediaQueue.values()].find(job => job.owner !== 'background') || mediaQueue.values().next().value;
      if (!next) return;
      mediaQueue.delete(next.owner);
      const job = mediaActive = { ...next, node: element('img'), index: 0, decoding: false, timer: null, deadline: Date.now()+18000, attempt:0 };
      job.node.decoding = 'async'; job.node.referrerPolicy = 'no-referrer';
      const finish = success => {
        if (destroyed || mediaActive !== job || job.finished) return;
        job.finished=true;
        doc.defaultView.clearTimeout(job.timer); job.node.onload = null; job.node.onerror = null;
        const valid = job.valid();
        const complete = () => { if (mediaActive === job) { mediaActive = null; scheduleMedia(); } };
        if (success && valid) {
          job.committing = true;
          Promise.resolve(job.commit(job.node, job.index, job)).then(complete, complete);
        } else {
          if (valid) job.failed?.(); job.node.removeAttribute('src'); complete();
        }
      };
      const load = () => {
        if (destroyed || mediaActive !== job) return;
        if (!job.valid() || Date.now()>=job.deadline) { finish(false); return; }
        const attempt=++job.attempt;
        job.node.onload=null;job.node.onerror=null;job.node.removeAttribute('src');
        job.node=element('img');job.node.decoding='async';job.node.referrerPolicy='no-referrer';
        const current=()=>!destroyed&&mediaActive===job&&!job.finished&&job.attempt===attempt;
        const retry = () => {
          if (!current()) return;
          doc.defaultView.clearTimeout(job.timer);
          if (++job.index < job.urls.length && job.valid() && Date.now()<job.deadline) load(); else finish(false);
        };
        job.decoding = false;
        job.node.onload = () => {
          if (!current() || job.decoding) return;
          if (!job.valid()) { finish(false); return; }
          job.decoding = true;
          doc.defaultView.clearTimeout(job.timer);
          job.timer=doc.defaultView.setTimeout(retry,Math.min(2500,Math.max(1,job.deadline-Date.now())));
          let decoded;
          try { decoded = job.node.decode?.(); } catch (_) { decoded = Promise.reject(); }
          Promise.resolve(decoded).then(() => {if(current())finish(true);}, () => {if(current())finish(job.node.complete && job.node.naturalWidth > 0);});
        };
        job.node.onerror = retry;
        job.timer = doc.defaultView.setTimeout(retry, Math.min(6000,Math.max(1,job.deadline-Date.now())));
        job.node.src = job.urls[job.index];
      };
      load();
    }
    function navSubtitle(node, text) {
      const subtitle = element('span', 'cxx-gal-nav-subtitle', text);
      subtitle.setAttribute('aria-hidden', 'true');
      node.append(subtitle);
    }
    // Romanization from maintained character drafts 004 and 006–014; unknown speakers stay empty.
    const speakerNames = { Tomorin: 'TAKAMATSU TOMORI', Anon: 'CHIHAYA ANON', Soyo: 'NAGASAKI SOYO',
      Taki: 'SHIINA TAKI', Rana: 'KANAME RANA', Saki: 'TOGAWA SAKIKO', Uika: 'MISUMI UIKA',
      Mutsumi: 'WAKABA MUTSUMI', Umiri: 'YAHATA UMIRI', Nyamu: 'YUTENJI NYAMU' };

    const root = element('section', 'cxx-gal-shell');
    root.id = 'cxx-galgame-root';
    root.setAttribute('aria-label', 'Galgame 对话界面');
    const header = element('header', 'cxx-gal-header');
    const brand = element('div', 'cxx-gal-brand');
    brand.append(element('span', 'cxx-gal-diamond'));
    const brandText = element('div');
    brandText.append(element('span', 'cxx-gal-eyebrow', 'TOKYO / 2051'));
    const gameTitle=element('h2', 'cxx-gal-title', 'Tokyo 2051'),wordmark=doc.defaultView.CxxMenuArt?.entries?.wordmark;gameTitle.setAttribute('aria-label','Tokyo 2051');
    if(wordmark){const img=element('img','cxx-gal-wordmark');img.alt='Tokyo 2051';img.src=wordmark.fallback;img.onload=()=>{gameTitle.textContent='';gameTitle.append(img);};}
    brandText.append(gameTitle);
    brand.append(brandText);
    const tools = element('nav', 'cxx-gal-tools');
    tools.setAttribute('aria-label', '界面操作');
    const terminalButton = button('终端', function () { call('onTerminal'); });
    terminalButton.title = '在 Gal 界面中打开当前聊天的终端';
    const mapButton = button('地图', function () { call('onMap'); });
    mapButton.setAttribute('aria-label','城市地图');mapButton.setAttribute('aria-haspopup','dialog');
    mapButton.title = '打开城市地图';
    const people = element('details', 'cxx-gal-more');
    const statusButton = element('summary','cxx-gal-button','人物');
    const peopleItems=element('div','cxx-gal-more-items');peopleItems.id='cxx-gal-people-items';statusButton.setAttribute('aria-controls',peopleItems.id);statusButton.setAttribute('aria-expanded','false');
    people.append(statusButton,peopleItems);
    peopleItems.append(button('User',()=>{people.open=false;call('onPlayer');}),button('人物',()=>{people.open=false;call('onStatus');}));
    statusButton.title = '玩家档案与人物状态';
    const closeButton = button('返回原生', function () { call('onClose'); });
    closeButton.title = '关闭 Galgame 界面，保留聊天和输入草稿';
    const workshopButton = button('工坊', function () { call('onWorkshop'); });
    workshopButton.title = '确认后前往官网创意工坊';
    navSubtitle(statusButton, 'CHARACTERS'); navSubtitle(terminalButton, 'TERMINAL');
    navSubtitle(workshopButton, 'WORKSHOP'); navSubtitle(closeButton, 'NATIVE');
    navSubtitle(mapButton, 'CITY MAP');
    tools.append(people, terminalButton, mapButton, workshopButton, closeButton);
    const menuButton=button('游戏菜单',()=>{const w=doc.defaultView.parent||doc.defaultView;if(w.__cxx_stories__)void w.__cxx_stories__.menu('hub');else call('onError','存档服务正在准备，请稍后重试。');});tools.prepend(menuButton);
    const phoneButton=button('手机',()=>{const phone=(doc.defaultView.parent||doc.defaultView).CxxPhone;if(phone)phone.open();else call('onError','通讯器尚未就绪，请稍后重试。');});tools.insertBefore(phoneButton,terminalButton);
    const openingSelection = button('开局选择', function () { call('onOpeningSelection'); });
    openingSelection.hidden = true; tools.insertBefore(openingSelection, closeButton);
    const more = element('details', 'cxx-gal-more');
    const moreSummary = element('summary', 'cxx-gal-button', '更多');
    navSubtitle(moreSummary, 'MORE');
    const moreItems = element('div', 'cxx-gal-more-items');
    moreItems.id = 'cxx-gal-more-items';
    const mailWindow=doc.defaultView.parent||doc.defaultView,mailButton=button('邮件',()=>mailWindow.CxxMailbox?.open());moreItems.append(mailButton);let mailStop;const bindMail=()=>{mailStop?.();mailStop=mailWindow.CxxMailbox?.subscribe(s=>{mailButton.textContent='邮件'+(s.unread?' ● '+s.unread:'');});};listen(mailWindow,'cxx-mail-ready',bindMail);bindMail();disposers.push(()=>mailStop?.());
    moreSummary.setAttribute('aria-controls', moreItems.id);
    moreSummary.setAttribute('aria-expanded', 'false');
    more.append(moreSummary, moreItems); tools.insertBefore(more, closeButton);
    function closeMore(returnFocus) {
      more.open = false; moreSummary.setAttribute('aria-expanded', 'false');
      if (returnFocus) moreSummary.focus({ preventScroll: true });
    }
    listen(more, 'toggle', function () { moreSummary.setAttribute('aria-expanded', String(more.open));if(more.open)people.open=false; });
    listen(people,'toggle',function(){statusButton.setAttribute('aria-expanded',String(people.open));if(people.open)closeMore(false);});
    listen(root,'click',function(event){if(people.open&&!people.contains(event.target))people.open=false;});
    listen(root,'keydown',function(event){if(event.key==='Escape'&&people.open){people.open=false;statusButton.focus();event.preventDefault();}});
    if(options.onMigration)moreItems.append(button('存档迁移',()=>{closeMore(true);options.onMigration();}));
    moreItems.append(button('电台',()=>{closeMore(true);try{mailWindow.Cxx233Terminal?.openPage('network',2);}catch(e){call('onError',e.message);}}));
    tools.replaceChildren(menuButton);header.append(brand, tools);

    const stage = element('div', 'cxx-gal-stage');
    let backgroundImage = null,backgroundValue=null,backgroundFailed=false,backgroundRetryUsed=false;
    const mediaLoading=element('div','cxx-gal-media-loading');mediaLoading.hidden=true;mediaLoading.setAttribute('role','status');stage.append(mediaLoading);
    function renderBackground(value) {
      const url = safeSpriteUrl(value?.url);
      if(backgroundValue?.url!==value?.url)backgroundRetryUsed=false;
      backgroundValue=value;
      if (backgroundUrl === url) return;
      backgroundUrl = url;
      backgroundFailed=false;
      mediaLoading.hidden=!url;mediaLoading.textContent=url?'Loading · 正在载入场景图片，正文可继续阅读。':'';
      mediaLoading.setAttribute('data-state','loading');
      if (!url) {
        backgroundImage?.remove(); backgroundImage = null; stage.removeAttribute('data-background-ready');
        mediaQueue.delete('background'); scheduleMedia(); return;
      }
      // One candidate per fallback tier, bounded by a total deadline. Do not
      // spend minutes trying every variant of an unavailable location.
      const tiers=new Set(),candidates=[value,...(value.fallbacks||[])].filter((item,i)=>{const tier=item.tier??(item.region==='generic'?2:i);if(tiers.has(tier))return false;tiers.add(tier);return true;}).slice(0,3);
      const urls = [...new Set(candidates.map(item=>safeSpriteUrl(item.url)).filter(Boolean))];
      queueImage('background', url, urls, () => backgroundUrl === url, node => {
        node.className = 'cxx-gal-cg'; node.alt = ''; node.setAttribute('aria-hidden', 'true');
        const old = backgroundImage; backgroundImage = node; stage.prepend(node); old?.remove();
        stage.setAttribute('data-background-ready', '1'); mediaLoading.hidden = true;
      }, () => {
        backgroundImage?.remove(); backgroundImage = null; stage.removeAttribute('data-background-ready');
        backgroundFailed=true;mediaLoading.textContent='场景图片暂不可用，已使用默认背景。';mediaLoading.append(button('重试图片',retryBackground));mediaLoading.setAttribute('data-state','failed');
      });
    }
    function retryBackground(){if(!backgroundFailed||destroyed)return;backgroundUrl='';renderBackground(backgroundValue);}
    const retryOnReturn=()=>{if(backgroundFailed&&!backgroundRetryUsed&&!doc.hidden){backgroundRetryUsed=true;retryBackground();}};
    listen(doc.defaultView,'online',retryOnReturn);listen(doc,'visibilitychange',retryOnReturn);
    const background = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    background.setAttribute('class', 'cxx-gal-background');
    background.setAttribute('viewBox', '0 0 1200 600');
    background.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    background.setAttribute('aria-hidden', 'true');
    background.setAttribute('focusable', 'false');
    [
      { tag: 'rect', attrs: { width: '1200', height: '600', fill: '#08080b', opacity: '.25' } },
      { tag: 'path', attrs: { d: 'M0 600V490L390 370H1200V600Z', fill: '#271016', opacity: '.3' } },
      { tag: 'path', attrs: { d: 'M740 0H1200V600H1020L740 320Z', fill: '#512127', opacity: '.08' } },
      { tag: 'path', attrs: { d: 'M0 490L390 370H1200M740 0V320L1020 600', fill: 'none', stroke: '#dc5c59', 'stroke-opacity': '.1', 'stroke-width': '1' } }
    ].forEach(function (shape) {
      const node = doc.createElementNS('http://www.w3.org/2000/svg', shape.tag);
      Object.keys(shape.attrs).forEach(function (key) { node.setAttribute(key, shape.attrs[key]); });
      background.append(node);
    });
    const stageLines = element('div', 'cxx-gal-stage-lines');
    stageLines.setAttribute('aria-hidden', 'true');
    const sceneHud = element('div', 'cxx-gal-scene');
    const location = element('span', 'cxx-gal-location');
    const dateTime = element('span', 'cxx-gal-datetime');
    const presence = element('span', 'cxx-gal-presence');
    sceneHud.append(location, dateTime, presence);
    const stats = element('aside', 'cxx-gal-stats');
    stats.id = 'cxx-gal-stats'; stats.hidden = true;
    stats.setAttribute('aria-label', '本楼状态信息');
    const statsScope = element('span', 'cxx-gal-stats-scope');
    const statsFields = element('dl', 'cxx-gal-stats-fields');
    const statsTop = element('div', 'cxx-gal-stats-top');
    const detailButton = button('详情', function () { showHudDetail(true); }, 'cxx-gal-button cxx-gal-hud-button');
    const statsClose = button('收起', function () { showStats(false); }, 'cxx-gal-button cxx-gal-hud-button');
    statsTop.append(statsScope, detailButton, statsClose);
    stats.append(statsTop, statsFields);
    const emptyStage = element('div', 'cxx-gal-empty-stage');
    emptyStage.setAttribute('aria-hidden', 'true');
    emptyStage.append(element('span', 'cxx-gal-stage-number', '2051'));
    emptyStage.append(element('span', 'cxx-gal-stage-caption', 'TOKYO NIGHT ARCHIVE'));
    const cast = element('div', 'cxx-gal-cast');
    cast.setAttribute('aria-label', '在场人物立绘');
    stage.append(background, stageLines, emptyStage, cast, sceneHud);

    const reading = element('section', 'cxx-gal-reading');
    reading.setAttribute('aria-label', '对话正文');
    const readingSurface = element('div', 'cxx-gal-reading-surface');
    readingSurface.setAttribute('aria-hidden', 'true');
    const readBar = element('div', 'cxx-gal-read-bar');
    const speaker = element('h3', 'cxx-gal-speaker', '旁白');
    const speakerLabel = element('div', 'cxx-gal-speaker-label');
    const speakerSubtitle = element('span', 'cxx-gal-speaker-subtitle');
    const thoughtBadge = element('span', 'cxx-gal-thought-badge', '心声');
    thoughtBadge.hidden = true;
    speakerSubtitle.hidden = true; speakerSubtitle.setAttribute('aria-hidden', 'true');
    speakerLabel.append(speaker, thoughtBadge, speakerSubtitle);
    function showSpeaker(paragraph) {
      const thought=paragraph.kind==='thought';
      let name=paragraph.speaker;
      if(['user','{{user}}','\x3cuser>','用户'].includes(name?.toLowerCase())){
        let current=(doc.defaultView.parent||doc.defaultView).Cxx233Runtime?.persona?.().name||'';
        try{if(!current&&typeof substitudeMacros==='function')current=substitudeMacros('{{user}}').trim();}catch{}
        if(!current||/[{}\x3c>]/.test(current))try{current=(typeof SillyTavern!=='undefined'?SillyTavern:doc.defaultView.SillyTavern)?.getContext?.().name1||'';}catch{}
        name=current&&!/[{}\x3c>]/.test(current)?current:'姓名未读取';
      }
      setText(speaker,name||(thought?'未署名':'旁白'));
      setText(speakerSubtitle,speakerNames[paragraph.characterId]||'');
      speakerSubtitle.hidden=!speakerSubtitle.textContent;
      thoughtBadge.hidden=!thought;
      speakerLabel.dataset.kind=thought?'thought':'speech';
      dialogue.dataset.kind=thought?'thought':'speech';
    }
    const history = element('span', 'cxx-gal-history', '历史回看');
    history.hidden = true;
    const counter = element('span', 'cxx-gal-counter', '0 / 0');
    function showPosition(total,index,busy=false){
      const current=total?index+1:0;setText(counter,String(current).padStart(2,'0')+' / '+String(total).padStart(2,'0'));
      counter.setAttribute('aria-label','第 '+current+' 段，共 '+total+' 段');
      reading.style.setProperty('--cxx-read-progress',(total?Math.min(100,current/total*100):0)+'%');
      reading.dataset.atEnd=String(!busy&&total>0&&current===total);
    }
    const statsToggle = button('状态', function () { showStats(stats.hidden); }, 'cxx-gal-button cxx-gal-stats-toggle');
    statsToggle.setAttribute('aria-controls', stats.id);
    statsToggle.setAttribute('aria-expanded', 'false');
    statsToggle.setAttribute('aria-label', '展开钱包、好感和委托状态');
    const voiceButton=button('',()=>{const r=mailWindow.CxxReading;if(!r)return call('onError','朗读服务尚未就绪。');const s=r.read();if(s.playing&&s.floor===model.selectedFloor&&s.index===(model.paragraphIndex||0))r.stop();else if(!mailWindow.__JINGYI__)r.setup?.();else call('onRead',false);},'cxx-gal-button cxx-gal-voice');
    voiceButton.innerHTML='\x3csvg viewBox="0 0 24 24" aria-hidden="true">\x3crect x="9" y="2.5" width="6" height="12" rx="3"/>\x3cpath d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1M12 18v4M8 22h8"/>\x3c/svg>';voiceButton.setAttribute('aria-label','朗读当前台词');voiceButton.title='朗读当前台词 · 再点停止';speakerLabel.append(voiceButton);
    readBar.append(speakerLabel, history, counter, statsToggle);
    const dialogue = element('div', 'cxx-gal-dialogue');
    dialogue.tabIndex = 0;
    dialogue.setAttribute('aria-label', '当前段落');
    const navigator = element('div', 'cxx-gal-navigator');
    const previous = button('上一句', function () {
      call('onSelectParagraph', Math.max(0, Number(model.paragraphIndex || 0) - 1));
    }, 'cxx-gal-button cxx-gal-previous');
    const next = button('下一句', function () {
      const paragraphs = Array.isArray(model.paragraphs) ? model.paragraphs : [];
      call('onSelectParagraph', Math.min(paragraphs.length - 1, Number(model.paragraphIndex || 0) + 1));
    }, 'cxx-gal-button cxx-gal-next');
    const historyPanel=element('section','cxx-gal-history-panel');historyPanel.hidden=true;historyPanel.id='cxx-gal-history-panel';historyPanel.setAttribute('role','dialog');historyPanel.setAttribute('aria-label','阅读历史');
    const historyButton=button('历史',()=>showHistory(historyPanel.hidden),'cxx-gal-button cxx-gal-history-button');historyButton.setAttribute('aria-haspopup','dialog');historyButton.setAttribute('aria-controls',historyPanel.id);historyButton.setAttribute('aria-expanded','false');
    const historyTop=element('header','cxx-gal-detail-top'),historyClose=button('返回阅读',()=>showHistory(false)),historyList=element('div','cxx-gal-history-list');
    historyTop.append(element('h3','','阅读历史'),historyClose);historyPanel.append(historyTop,element('p','','选择已发生的剧情回看，不会改变当前进度。'),historyList);
    function paintHistory(){
      const messages=Array.isArray(model.messages)?model.messages:[],signature=JSON.stringify([messages.map(m=>[m.id,m.label]),model.selectedId]);
      if(signature===historySignature)return;historySignature=signature;historyList.replaceChildren();
      for(const item of [...messages].reverse()){
        const row=element('button','cxx-gal-history-row',String(item.label??item.id));row.type='button';row.dataset.message=String(item.id);
        if(String(item.id)===String(model.selectedId))row.setAttribute('aria-current','true');
        row.onclick=()=>{showHistory(false);call('onSelectMessage',item.id);};historyList.append(row);
      }
      if(!messages.length)historyList.append(element('p','','暂无可回看的剧情。'));
    }
    function showHistory(open,returnFocus=true){
      historyPanel.hidden=!open;historyButton.setAttribute('aria-expanded',String(open));
      if(open){readTools.open=false;paintHistory();const current=historyList.querySelector('[aria-current="true"]');(current||historyClose).focus({preventScroll:true});current?.scrollIntoView({block:'nearest'});}
      else if(returnFocus)historyButton.focus({preventScroll:true});
    }
    listen(historyPanel,'keydown',event=>{if(event.key!=='Tab')return;const controls=[...historyPanel.querySelectorAll('button')],first=controls[0],last=controls.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}});
    let autoReading=false,autoDue=0,autoSignature='';
    const autoButton=button('自动',()=>{autoReading=!autoReading;autoDue=0;autoButton.textContent=autoReading?'停止自动':'自动';autoButton.setAttribute('aria-pressed',String(autoReading));},'cxx-gal-button cxx-gal-auto');autoButton.setAttribute('aria-pressed','false');
    const autoTimer=doc.defaultView.setInterval(()=>{if(!autoReading||destroyed||model.busy||model.opening||doc.hidden||root.inert||readTools.open||!historyPanel.hidden||mailWindow.__cxx_launcher__?.active?.()){autoDue=0;return;}const list=model.paragraphs||[],index=Number(model.paragraphIndex||0),sig=String(model.selectedId)+':'+index;if(sig!==autoSignature||!autoDue){autoSignature=sig;autoDue=Date.now()+Math.min(18000,Math.max(3500,String(list[index]?.text||'').length*70+2000));return;}if(Date.now()<autoDue)return;if(index+1<list.length){call('onSelectParagraph',index+1);autoDue=0;}else{autoReading=false;autoButton.textContent='自动';autoButton.setAttribute('aria-pressed','false');}},500);disposers.push(()=>doc.defaultView.clearInterval(autoTimer));
    navigator.append(previous, next, historyButton, autoButton);
    const readTools=element('details','cxx-gal-audio-tools'),readToggle=element('summary','cxx-gal-button','阅读与声音');
    const audioPanel=element('div','cxx-gal-audio-panel');audioPanel.id='cxx-gal-audio-panel';readToggle.setAttribute('aria-controls',audioPanel.id);readToggle.setAttribute('aria-expanded','false');readTools.append(readToggle,audioPanel);
    listen(readTools,'toggle',()=>{readToggle.setAttribute('aria-expanded',String(readTools.open));if(readTools.open)showHistory(false,false);});
    const readingModes=['original','reading','compare'].map((mode,i)=>button(['原文','译文','原译对照'][i],()=>call('onReadingMode',mode))),readTranslation=button('读此段译文',()=>call('onReadTranslation'));
    const modeGroup=element('div','cxx-gal-mode-options'),voiceGroup=element('div','cxx-gal-voice-options');modeGroup.append(...readingModes);voiceGroup.append(button('连续朗读',()=>call('onRead',true)),readTranslation,button('停止',()=>mailWindow.CxxReading?.stop()),button('继续声音',()=>mailWindow.CxxReading?.resume()));
    audioPanel.append(element('h3','','显示'),modeGroup,element('h3','','声音'),voiceGroup,button('镜译安装 / 设置',()=>mailWindow.CxxReading?.setup?.()));
    const readInfo=element('p','','默认阅读原文；翻译和声音设置由镜译控制。');audioPanel.append(readInfo);
    const readStatus=element('div');readStatus.setAttribute('role','status');audioPanel.append(readStatus);let stopReadStatus;
    const bindReadStatus=()=>{stopReadStatus?.();stopReadStatus=mailWindow.CxxReading?.subscribe(s=>{readStatus.textContent=s.status;voiceButton.setAttribute('aria-pressed',String(s.playing&&s.floor===model.selectedFloor&&s.index===(model.paragraphIndex||0)));});};listen(mailWindow,'cxx-phone-ready',bindReadStatus);bindReadStatus();disposers.push(()=>stopReadStatus?.());
    const readingBody = element('div', 'cxx-gal-reading-body');
    readingBody.append(dialogue, stats);
    const combatView=(doc.defaultView.parent||doc.defaultView).CxxCombatView?.mount({document:doc,parent:readingBody,compact:true});
    const combatStyle=element('style');combatStyle.textContent='#cxx-galgame-root .cxx-gal-reading-body:has(> [data-cxx-slot="combat"]:not([hidden])){grid-template-rows:minmax(0,var(--cxx-gal-dialogue-height)) auto;height:auto;max-height:none;row-gap:6px}#cxx-galgame-root .cxx-gal-reading-body>[data-cxx-slot="combat"]{grid-column:1/-1;grid-row:2;min-width:0}#cxx-galgame-root .cxx-gal-reading-body>.cxx-gal-dialogue:not(.cxx-gal-dialogue-probe){grid-column:1;grid-row:1}';root.append(combatStyle);
    reading.append(readingSurface, readBar, readingBody, navigator);
    tools.prepend(readTools);
    function clearStatsEntrance() { stats.removeAttribute('data-entering'); }
    function showStats(open, returnFocus) {
      const shouldReturnFocus = returnFocus || stats.contains(doc.activeElement);
      if (open && root.clientWidth <= 560 && root.dataset.landscape !== '1') showComposer(false);
      clearStatsEntrance();
      stats.hidden = !open;
      reading.setAttribute('data-hud-open', open ? '1' : '0');
      statsToggle.setAttribute('aria-expanded', String(open));
      statsToggle.setAttribute('aria-label', (open ? '收起' : '展开') + '钱包、好感和委托状态');
      if (open) {
        if (!doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) stats.setAttribute('data-entering', '1');
        detailButton.focus({ preventScroll: true });
      } else if (shouldReturnFocus) statsToggle.focus({ preventScroll: true });
      refreshReadingLayout();
    }
    listen(stats, 'animationend', function (event) { if (event.target === stats) clearStatsEntrance(); });

    const composer = element('section', 'cxx-gal-composer');
    composer.id = 'cxx-gal-composer';
    composer.hidden = true;
    composer.setAttribute('aria-label', '输入行动');
    const writeButton = button('写下行动', function () {
      showComposer(composer.hidden);
      if (!composer.hidden) focusDraft();
    }, 'cxx-gal-button cxx-gal-write');
    writeButton.setAttribute('aria-controls', composer.id);
    writeButton.setAttribute('aria-expanded', 'false');
    navigator.append(writeButton);
    function updateWriteEntry() {
      const count = Array.isArray(model.choices) ? model.choices.filter(function (value) { return typeof value === 'string' && value; }).length : 0;
      const open = !composer.hidden;
      setText(writeButton, open ? '收起输入' : count ? '可选 · ' + count + '项' : '写下行动');
      writeButton.setAttribute('aria-label', (open ? '收起' : '展开') + '行动输入' + (count ? '，含 ' + count + ' 个选项' : ''));
    }
    function showComposer(open) {
      if (open && root.clientWidth <= 560 && root.dataset.landscape !== '1' && !stats.hidden) showStats(false);
      const returnFocus = !open && composer.contains(doc.activeElement);
      if (!open) clearChoiceEntrance();
      composer.hidden = !open;
      root.setAttribute('data-composing', open ? '1' : '0');
      writeButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      updateWriteEntry();
      if (returnFocus) writeButton.focus({ preventScroll: true });
      refreshReadingLayout();
    }
    const choices = element('details', 'cxx-gal-choices');
    choices.hidden = true;
    const choiceSummary = element('summary', '', '行动选项');
    const choiceList = element('div', 'cxx-gal-choice-list');
    choiceList.id = 'cxx-gal-choice-list';
    choiceSummary.setAttribute('aria-controls', choiceList.id);
    choiceSummary.setAttribute('aria-expanded', 'false');
    choices.append(choiceSummary, choiceList);
    function clearChoiceEntrance() { choiceList.removeAttribute('data-entering'); }
    listen(choices, 'toggle', function () {
      clearChoiceEntrance();
      choiceSummary.setAttribute('aria-expanded', choices.open ? 'true' : 'false');
      if (choices.open && !choices.hidden && !composer.hidden && !doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        choiceList.setAttribute('data-entering', '1');
      } else if (!choices.open && choiceList.contains(doc.activeElement)) {
        choiceSummary.focus({ preventScroll: true });
      }
      refreshReadingLayout();
    });
    listen(choiceList, 'animationend', function (event) { if (event.target === choiceList) clearChoiceEntrance(); });
    const draftLabel = element('label', 'cxx-gal-draft-label', '你的行动');
    draftLabel.htmlFor = 'cxx-gal-draft';
    const draft = element('textarea', 'cxx-gal-draft');
    draft.id = 'cxx-gal-draft';
    draft.rows = 2;
    draft.placeholder = '写下你要说的话或采取的行动…';
    draft.setAttribute('aria-describedby', 'cxx-gal-status cxx-gal-error');
    function focusDraft() {
      draft.focus({ preventScroll: true });
      if (root.clientWidth <= 560 || root.dataset.landscape === '1') draft.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    listen(draft, 'input', function () { call('onDraft', draft.value); });
    listen(draft, 'compositionstart', function () { composing = true; });
    listen(draft, 'compositionend', function () {
      composing = false;
      call('onDraft', draft.value);
    });
    const composeRow = element('div', 'cxx-gal-compose-row');
    const composeActions = element('div', 'cxx-gal-compose-actions');
    const send = button('发送行动', function () {
      if (!composing && !model.busy && draft.value.trim()) call('onSend');
    }, 'cxx-gal-button cxx-gal-send');
    const stop = button('停止生成', function () { call('onStop'); });
    stop.hidden = true;
    composeActions.append(send);
    navigator.append(stop);
    composeRow.append(draft, composeActions);
    const footer = element('div', 'cxx-gal-footer');
    const status = element('span', 'cxx-gal-status');
    status.id = 'cxx-gal-status';
    status.setAttribute('role', 'status');
    const hint = element('span', 'cxx-gal-input-hint', 'Enter 换行 · 点击发送');
    footer.append(hint);
    const error = element('div', 'cxx-gal-error');
    error.id = 'cxx-gal-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    composer.append(choices, draftLabel, composeRow, footer);
    const readingStatus = element('div', 'cxx-gal-reading-status');
    readingStatus.append(status, error);
    reading.append(readingStatus);
    const bottom = element('div', 'cxx-gal-bottom');
    bottom.append(reading, composer);
    function refreshReadingLayout() {
      if (destroyed || readingTick !== null) return;
      readingTick = doc.defaultView.requestAnimationFrame(measureReadingLayout);
    }
    function measureReadingLayout() {
      readingTick = null;
      if (destroyed || !root.isConnected || bottom.hidden) return;
      const signature = JSON.stringify([paragraphSignature, dialogue.textContent, readingBody.clientWidth,
        root.clientHeight, root.dataset.landscape, root.dataset.mobile, root.style.getPropertyValue('--cxx-gal-dialogue-font-size'), stats.hidden, composer.hidden, choices.hidden, choices.open]);
      if (signature === readingSignature) return;
      readingSignature = signature;
      const scroll = dialogue.scrollTop;
      // Measure normal text capacity without hiding focused HUD controls or changing the visible tier.
      const probe = readingProbe || (readingProbe = dialogue.cloneNode(false));
      if (!probe.isConnected) {
        probe.classList.add('cxx-gal-dialogue-probe'); probe.removeAttribute('id');
        probe.removeAttribute('tabindex'); probe.setAttribute('aria-hidden', 'true'); readingBody.append(probe);
      }
      const width = (dialogue.clientWidth || readingBody.clientWidth) + 'px';
      if (probe.style.width !== width) probe.style.width = width; setText(probe, dialogue.textContent);
      const exceedsNormal = probe.scrollHeight > probe.clientHeight + 1;
      const mode = !composer.hidden && !choices.hidden && choices.open ? 'choices' :
        exceedsNormal ? 'long' : 'normal';
      setAttribute(reading, 'data-reading-mode', mode);
      dialogue.scrollTop = paragraphScrollPending ? 0 : fontScrollRatio === null ? scroll : fontScrollRatio * Math.max(0, dialogue.scrollHeight-dialogue.clientHeight);
      fontScrollRatio = null;
      if (dialogue.clientHeight) paragraphScrollPending = false;
    }
    if (doc.defaultView?.addEventListener) listen(doc.defaultView, 'resize', function () {
      if (root.clientWidth <= 560 && root.dataset.landscape !== '1' && !composer.hidden && !stats.hidden) showStats(false);
      refreshReadingLayout();
    });
    const openingNotice = element('div', 'cxx-gal-opening-host');
    openingNotice.hidden = true;
    const hudDetail = element('section', 'cxx-gal-hud-detail');
    hudDetail.hidden = true; hudDetail.setAttribute('role', 'dialog'); hudDetail.setAttribute('aria-label', '本楼 HUD 详情');
    const detailTop = element('header', 'cxx-gal-detail-top');
    const detailScope = element('h3');
    const detailClose = button('返回对话', function () { showHudDetail(false); });
    detailTop.append(detailScope, detailClose);
    const detailBody = element('div', 'cxx-gal-detail-body');
    hudDetail.append(detailTop, detailBody);
    function showHudDetail(open) {
      hudDetail.hidden = !open;
      if (open) detailClose.focus({ preventScroll: true });
      else (stats.hidden ? statsToggle : detailButton).focus({ preventScroll: true });
    }
    const memories=element('section','cxx-gal-memories');memories.hidden=true;memories.setAttribute('role','dialog');memories.setAttribute('aria-label','已解锁事件插画');
    const memoryTop=element('header','cxx-gal-detail-top'),memoryBody=element('div','cxx-gal-memory-grid');
    const memoryClose=button('返回对话',()=>{memories.hidden=true;readToggle.focus({preventScroll:true});});
    memoryTop.append(element('h3','','已解锁事件插画'),button('重新读取已保存影像',()=>call('onMediaRefresh')),memoryClose);memories.append(memoryTop,memoryBody);
    let memorySignature='';
    function paintMemories(){
      const entries=model.eventMedia || [],signature=JSON.stringify([entries,model.eventMediaStatus]);if(signature===memorySignature)return;memorySignature=signature;memoryBody.replaceChildren();
      if(!entries.length)memoryBody.append(element('p','',model.eventMediaStatus || '当前没有已保存的事件插画。事件完成、结果保存且有正式素材后，才会在此解锁。'));
      entries.forEach(item=>{const card=element('figure','cxx-gal-memory'),img=element('img');img.alt=item.alt;img.loading='lazy';img.decoding='async';img.src=safeSpriteUrl(item.url);img.onerror=()=>{img.hidden=true;card.append(element('p','','图片暂不可用，解锁记录仍保留。'));};card.append(img,element('figcaption','',item.name));memoryBody.append(card);});
    }
    const memoryButton=button('事件插画',()=>{readTools.open=false;memories.hidden=false;call('onMediaRefresh');paintMemories();memoryClose.focus();});audioPanel.append(memoryButton);
    const fontKey='cxx-gal-dialogue-font-v1';let fontSize=null;
    try{const saved=Number(doc.defaultView.localStorage.getItem(fontKey));if(Number.isInteger(saved)&&saved>=14&&saved<=30)fontSize=saved;}catch{}
    const fontPanel=element('section','cxx-gal-font-panel');fontPanel.hidden=true;fontPanel.setAttribute('role','dialog');fontPanel.setAttribute('aria-label','阅读字号');
    const fontTop=element('header','cxx-gal-detail-top'),fontValue=element('output','cxx-gal-font-value');
    const fontClose=button('返回对话',()=>{fontPanel.hidden=true;readToggle.focus({preventScroll:true});});
    fontTop.append(element('h3','','阅读字号'),fontClose);
    const fontControls=element('div','cxx-gal-font-controls'),fontSlider=element('input','cxx-gal-font-slider');fontSlider.type='range';fontSlider.min='14';fontSlider.max='30';fontSlider.step='1';fontSlider.setAttribute('aria-label','Gal 正文字号');
    function currentFont(){return fontSize??Math.round(parseFloat(doc.defaultView.getComputedStyle(dialogue).fontSize)||18);}
    function showFontValue(){const value=currentFont();fontSlider.value=String(value);fontValue.textContent=(fontSize===null?'默认 · ':'')+value+' px';}
    function setFont(value,save=true){
      const ratio=dialogue.scrollTop/Math.max(1,dialogue.scrollHeight-dialogue.clientHeight);
      if(fontScrollRatio===null)fontScrollRatio=ratio;
      fontSize=value===null?null:Math.max(14,Math.min(30,Math.round(Number(value))));
      if(fontSize===null)root.style.removeProperty('--cxx-gal-dialogue-font-size');else root.style.setProperty('--cxx-gal-dialogue-font-size',fontSize+'px');
      if(save)try{if(fontSize===null)doc.defaultView.localStorage.removeItem(fontKey);else doc.defaultView.localStorage.setItem(fontKey,String(fontSize));}catch{}
      readingSignature='';refreshReadingLayout();showFontValue();
    }
    fontControls.append(button('−',()=>setFont(currentFont()-1)),fontSlider,button('+',()=>setFont(currentFont()+1)));
    listen(fontSlider,'input',()=>setFont(fontSlider.value));
    fontPanel.append(fontTop,fontValue,fontControls,button('恢复默认',()=>setFont(null)));
    audioPanel.append(button('阅读字号',()=>{readTools.open=false;showFontValue();fontPanel.hidden=false;fontSlider.focus({preventScroll:true});}));
    root.append(stage, header, bottom, openingNotice, hudDetail, memories, fontPanel, historyPanel);
    const positionScene=()=>{if(!destroyed&&header.offsetHeight)root.style.setProperty('--cxx-gal-header-bottom',(header.offsetTop+header.offsetHeight+12)+'px');};
    const headerObserver=doc.defaultView.ResizeObserver?new doc.defaultView.ResizeObserver(positionScene):null;headerObserver?.observe(header);disposers.push(()=>headerObserver?.disconnect());listen(doc.defaultView,'resize',positionScene);
    listen(root, 'keydown', function (event) {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && !composing) {
        event.preventDefault();
        if(!fontPanel.hidden){fontPanel.hidden=true;readToggle.focus({preventScroll:true});}
        else if(!memories.hidden){memories.hidden=true;readToggle.focus({preventScroll:true});}
        else if(!historyPanel.hidden)showHistory(false);
        else if(readTools.open){readTools.open=false;readToggle.focus({preventScroll:true});}
        else if (!hudDetail.hidden) showHudDetail(false);
        else if (more.open) closeMore(true);
        else if (!stats.hidden) showStats(false, true);
        else call('onClose');
      }
    });
    listen(root, 'click', function (event) { if (more.open && !more.contains(event.target)) closeMore(false); });
    listen(root,'click',event=>{if(readTools.open&&!readTools.contains(event.target))readTools.open=false;if(!historyPanel.hidden&&!historyPanel.contains(event.target)&&!historyButton.contains(event.target))showHistory(false,false);});
    parent.append(root);
    // Non-modal top layer keeps the native host alive and lets its own dialogs open.
    // Older browsers retain the fixed viewport layer and maximum ordinary z-index.
    if (!landscape.isMobile(doc.defaultView) && typeof root.showPopover === 'function') {
      root.setAttribute('popover', 'manual');
      try { root.showPopover(); } catch (_) { root.removeAttribute('popover'); }
    }
    setFont(fontSize,false);
    const screenMode = landscape.mount({ document: doc, root, toolbar: audioPanel, before: null,
      onLayout: refreshReadingLayout });

    function safeSpriteUrl(value) {
      if (typeof value !== 'string' || !value) return '';
      try {
        const url = new URL(value, doc.baseURI);
        const origin = new URL(doc.baseURI).origin;
        if (url.username || url.password) return '';
        if (url.protocol === 'https:' && (url.hostname === 'cyber2051.top' || url.origin === origin)) return url.href;
        if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return url.href;
      } catch (_) { /* Invalid images retain the local background. */ }
      return '';
    }

    function removeSprite(id) {
      const node = spriteNodes.get(id);
      if (node) { node.remove(); spriteNodes.delete(id); }
      mediaQueue.delete('sprite:' + id); spriteFailures.delete(id); scheduleMedia();
      clearTimeout(spriteExits.get(id)); spriteExits.delete(id);
    }

    function renderSprites() {
      if (destroyed) return;
      const desiredIds = new Set(desiredSprites.map(function (item) { return item.id; }));
      const reduced = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches || root.getAttribute('data-cxx-effects')==='low';
      spriteNodes.forEach(function (node, id) {
        if (desiredIds.has(id)) {
          clearTimeout(spriteExits.get(id)); spriteExits.delete(id);
          node.removeAttribute('data-exiting'); node.removeAttribute('aria-hidden');
        } else if (!spriteExits.has(id)) {
          if (reduced || node.hidden) removeSprite(id);
          else {
            node.setAttribute('data-exiting', '1'); node.setAttribute('aria-hidden', 'true');
            spriteExits.set(id, setTimeout(function () { removeSprite(id); renderSprites(); }, 180));
          }
        }
      });
      desiredSprites.forEach(function (item) {
        let node = spriteNodes.get(item.id);
        // Position belongs to a stable outer slot. Expression images retain their
        // own anchor/scale and replace the previous image only after decode.
        if (!node && spriteNodes.size < 3) {
          node = element('div', 'cxx-gal-sprite-slot'); node.hidden = true;
          cast.append(node); spriteNodes.set(item.id, node);
        }
        if (!node) return;
        if (spriteFailures.has(item.id) && spriteFailures.get(item.id) !== item.url) spriteFailures.delete(item.id);
        if (node.cxxImage?.getAttribute('data-requested-src') !== item.url && spriteFailures.get(item.id) !== item.url) {
          const ownedNode = node;
          queueImage('sprite:' + item.id, item.url, [...new Set([item.url, item.fallbackUrl].filter(Boolean))],
            () => spriteNodes.get(item.id) === ownedNode && desiredSprites.some(next => next.id === item.id && next.url === item.url),
            (image, fallback, job) => {
              image.className = 'cxx-gal-sprite'; image.alt = item.name + '立绘';
              image.setAttribute('data-requested-src', item.url); image.setAttribute('data-expression', fallback ? 'normal' : item.expression || 'normal');
              if (fallback) image.setAttribute('data-fallback', '1');
              const previous = ownedNode.cxxImage; ownedNode.cxxImage = image;
              ownedNode.append(image); ownedNode.hidden = false; emptyStage.hidden = true;
              renderSprites();
              if (!previous || reduced) { previous?.remove(); return; }
              previous.setAttribute('aria-hidden', 'true'); previous.alt = '';
              // Retain the old pixels underneath the original 180ms arrival fade.
              // The shared queue waits, so this is still the only extra image.
              return new Promise(resolve => {
                const timer = doc.defaultView.setTimeout(() => { previous.remove(); job.cancelCommit = null; resolve(); }, 180);
                job.cancelCommit = () => { doc.defaultView.clearTimeout(timer); previous.remove(); resolve(); };
              });
            }, () => {
              spriteFailures.set(item.id, item.url); ownedNode.hidden = true;
              ownedNode.cxxImage?.remove(); ownedNode.cxxImage = null; renderSprites();
            });
        }
        setAttribute(node, 'data-character', item.id);
        setAttribute(node, 'data-active', item.id === speakingId ? '1' : '0');
        const anchor = String(Math.min(.8, Math.max(.2, Number(item.anchorX) || .5)) * -100) + '%';
        const scale = String(Math.min(1.1, Math.max(.9, (Number(item.heightCm) || 160) / 160)));
        if (node.style.getPropertyValue('--cxx-anchor') !== anchor) node.style.setProperty('--cxx-anchor', anchor);
        if (node.style.getPropertyValue('--cxx-height-scale') !== scale) node.style.setProperty('--cxx-height-scale', scale);
        setAttribute(node, 'data-height-cm', String(Number(item.heightCm) || 160));
        if (node.cxxImage) { node.cxxImage.alt = item.name + '立绘'; setAttribute(node.cxxImage, 'data-character', item.id); setAttribute(node.cxxImage, 'data-active', item.id === speakingId ? '1' : '0'); }
      });
      const count = spriteNodes.size;
      setAttribute(cast, 'data-count', count);
      // Most dialogue sits centrally in a three-person composition, with others at the sides.
      const slots = count === 3 ? [1, 0, 2] : count === 2 ? [0, 1] : [0];
      const ordered = desiredSprites.map(function (item) { return spriteNodes.get(item.id); }).filter(Boolean);
      spriteNodes.forEach(function (node) { if (!ordered.includes(node)) ordered.push(node); });
      ordered.forEach(function (node, index) { setAttribute(node, 'data-slot', slots[index]); if (node.cxxImage) setAttribute(node.cxxImage, 'data-slot', slots[index]); });
      setAttribute(cast, 'data-speaking', desiredSprites.some(function (item) { return item.id === speakingId; }) ? '1' : '0');
      emptyStage.hidden = Array.from(spriteNodes.values()).some(function (img) { return !img.hidden; });
      scheduleMedia();
    }

    function render(nextModel) {
      if (destroyed) return;
      model = nextModel || {};
      const projection=model.reading;readingModes.forEach((b,i)=>{b.disabled=i>0&&!projection?.available;b.setAttribute('aria-pressed',String((projection?.mode||'original')===['original','reading','compare'][i]));});readTranslation.disabled=!projection?.available;
      readInfo.textContent=projection?({ready:'译文已就绪',partial:'部分段落已翻译',processing:'镜译处理中，暂用原文',stale:'旧译文已停用，保留原文',failed:'镜译处理失败，保留原文',absent:'尚无译文'}[projection.state]||'原文已核对')+(projection.unmapped?' · 无法对应角色的译文不参与朗读':''):'默认阅读原文；翻译和声音设置由镜译控制。';
      if(!memories.hidden)paintMemories();
      combatView?.render(model.opening ? [] : model.combat || []);
      root.setAttribute('data-opening', model.opening ? '1' : '0');
      bottom.hidden = Boolean(model.opening);
      sceneHud.hidden = Boolean(model.opening);
      openingNotice.hidden = !model.opening;
      openingSelection.hidden = !model.opening || !options.onNativeOpening;
      terminalButton.disabled = Boolean(model.opening);
      statusButton.disabled = Boolean(model.opening);
      if (model.opening) {
        clearStatsEntrance(); stats.hidden = true;
        reading.setAttribute('data-hud-open', '0'); statsToggle.setAttribute('aria-expanded', 'false');
        statsToggle.setAttribute('aria-label', '展开钱包、好感和委托状态');
      }
      if (openingView && (!model.opening || openingMessage !== model.openingMessage ||
          openingSwipe !== model.openingSwipe || openingRaw !== model.openingRaw)) {
        openingView.destroy(); openingView = null;
      }
      if (model.opening && !openingView) {
        openingMessage = model.openingMessage; openingSwipe = model.openingSwipe; openingRaw = model.openingRaw;
        openingView = CxxGalOpeningView.mount({ document: doc, parent: openingNotice });
      } else if (model.opening) openingView.render();
      const hud = model.hud || { scope: '本楼变量未记录', fields: [] };
      setText(statsScope, hud.scope);
      setText(detailScope, hud.scope);
      renderBackground(model.opening ? null : model.background);
      if (model.opening) hudDetail.hidden = true;
      const nextDetailSignature = JSON.stringify(hud.details || []);
      if (nextDetailSignature !== detailSignature) {
        detailBody.replaceChildren();
        (hud.details || []).forEach(function (group) {
          const section = element('section');
          const list = element('dl', 'cxx-gal-detail-list');
          section.append(element('h4', '', group.label));
          (group.items || []).forEach(function (field) {
            const row = element('div');
            row.append(element('dt', '', field.label), element('dd', '', field.value)); list.append(row);
          });
          if (!(group.items || []).length) section.append(element('p', '', '此楼没有委托记录。'));
          section.append(list); detailBody.append(section);
        });
        detailSignature = nextDetailSignature;
      }
      const nextHudSignature = JSON.stringify(hud.fields);
      if (nextHudSignature !== hudSignature) {
        statsFields.replaceChildren();
        (hud.fields || []).forEach(function (field) {
          const item = element('div', 'cxx-gal-stat');
          item.setAttribute('data-kind', field.label === '钱包' ? 'wallet' : field.label.includes('好感') ? 'affection' : 'quest');
          const label = element('dt', '', field.label.includes('好感') ? '好感' : field.label);
          label.title = field.label; label.setAttribute('aria-label', field.label);
          item.append(label, element('dd', '', field.value));
          statsFields.append(item);
        });
        hudSignature = nextHudSignature;
      }
      const messages = Array.isArray(model.messages) ? model.messages : [];
      const paragraphs = Array.isArray(model.paragraphs) ? model.paragraphs : [];
      const index = Math.min(Math.max(0, Number(model.paragraphIndex) || 0), Math.max(0, paragraphs.length - 1));
      const paragraph = paragraphs[index] || {};
      historyButton.disabled = messages.length === 0;
      historyButton.title = '回看已发生的剧情 · '+(messages.find(m=>String(m.id)===String(model.selectedId))?.label||'');
      if(!historyPanel.hidden)paintHistory();
      showSpeaker(paragraph);
      voiceButton.hidden=!paragraph.speaker&&paragraph.kind!=='thought';voiceButton.disabled=paragraph.voiceEligible===false;voiceButton.setAttribute('aria-label','朗读'+(paragraph.speaker||'当前角色')+(paragraph.kind==='thought'?'的心声':'的台词'));const voiceState=mailWindow.CxxReading?.read();voiceButton.setAttribute('aria-pressed',String(voiceState?.playing&&voiceState.floor===model.selectedFloor&&voiceState.index===index));
      showPosition(paragraphs.length,index,model.busy);
      setText(dialogue, paragraph.text || (model.busy ? '正在等待新的正文…' : '当前楼层还没有可阅读的正文。'));
      const currentParagraph = String(model.selectedId) + ':' + index;
      if (currentParagraph !== paragraphSignature) {
        dialogue.scrollTop = 0;
        paragraphScrollPending = true;
        paragraphSignature = currentParagraph;
      }
      history.hidden = !model.history;
      previous.disabled = index === 0 || !paragraphs.length;
      next.disabled = index >= paragraphs.length - 1 || !paragraphs.length;
      const scene = model.scene && typeof model.scene === 'object' ? model.scene : {};
      setText(location, scene.location || '地点未记录');
      setText(dateTime, [scene.date, scene.time].filter(function (value) { return typeof value === 'string' && value; }).join(' / '));
      const names = Array.isArray(scene.characters) ? scene.characters.map(function (item) {
        return typeof item === 'string' ? item : item && typeof item.name === 'string' ? item.name : '';
      }).filter(Boolean) : [];
      setText(presence, names.length ? '在场 · ' + names.join(' / ') : '');
      presence.hidden = names.length > 1;

      const images = (Array.isArray(model.sprites) ? model.sprites : model.spriteUrl ?
        [{ id: paragraph.characterId || 'single', name: paragraph.speaker || '角色', url: model.spriteUrl }] : [])
        .map(function (item) { return { ...item, url: safeSpriteUrl(item.url), fallbackUrl: safeSpriteUrl(item.fallbackUrl) }; })
        .filter(function (item) { return item.id && item.url; }).slice(0, 3);
      desiredSprites = images; speakingId = paragraph.characterId;
      renderSprites();
      const availableChoices = Array.isArray(model.choices) ? model.choices.filter(function (value) { return typeof value === 'string' && value; }) : [];
      const newChoiceSignature = JSON.stringify([model.selectedId, availableChoices]);
      choices.hidden = !availableChoices.length;
      if (choiceSignature !== newChoiceSignature) {
        clearChoiceEntrance();
        choiceList.replaceChildren();
        availableChoices.forEach(function (text, choiceIndex) {
          const item = element('button', 'cxx-gal-choice', (choiceIndex + 1) + ' / ' + text);
          item.type = 'button';
          item.addEventListener('click', function () { call('onChoice', text); });
          choiceList.append(item);
        });
        choiceSignature = newChoiceSignature;
      }
      setText(choiceSummary, '行动选项 · ' + availableChoices.length + '（追加到草稿）');
      choiceList.querySelectorAll('button').forEach(b=>b.disabled=!!model.busy);
      updateWriteEntry();
      updateDraft(model.draft);
      send.hidden = !!model.busy;
      stop.hidden = !model.busy;
      stop.disabled = model.canStop === false;
      stop.title = model.canStop === false ? '额外MVU仍在处理；当前接口不能单独停止，可以返回原生查看状态。' : '';
      root.setAttribute('aria-busy', model.busy ? 'true' : 'false');
      setText(status, model.status || (model.busy ? '正在生成…' : '阅读中'));
      setText(error, model.error);
      error.hidden = !error.textContent;
      // Reading, generation and errors never change the user's composer visibility.
      refreshReadingLayout();
    }

    function updateDraft(text){
      model={...model,draft:text};
      const nextDraft = typeof model.draft === 'string' ? model.draft : '';
      if (!composing && draft.value !== nextDraft) {
        const isFocused = doc.activeElement === draft;
        const start = draft.selectionStart;
        const end = draft.selectionEnd;
        const direction = draft.selectionDirection;
        draft.value = nextDraft;
        if (isFocused) draft.setSelectionRange(Math.min(start, nextDraft.length), Math.min(end, nextDraft.length), direction);
      }
      send.disabled = !!model.busy || !draft.value.trim();
      const nativeCommand = draft.value.trim().startsWith('/');
      setText(send, nativeCommand ? '返回原生并执行指令' : '发送行动');
      setText(hint, nativeCommand ? '酒馆指令将在原生界面执行，可在那里查看弹窗与结果。' : 'Enter 换行 · 点击发送');

    }
    return {
      updateDraft,
      render: render,
      setBusy: function (message) {model={...model,busy:true};setText(status,message);send.disabled=true;send.hidden=true;stop.hidden=false;choiceList.querySelectorAll('button').forEach(b=>b.disabled=true);},
      renderStream: function (next) {
        if(destroyed)return;model={...model,...next};const paragraphs=next.paragraphs||[],index=next.paragraphIndex||0,p=paragraphs[index]||{};
        combatView?.render([]);bottom.hidden=false;openingNotice.hidden=true;choices.hidden=true;choiceList.querySelectorAll('button').forEach(b=>b.disabled=true);
        showSpeaker(p);showPosition(paragraphs.length,index,true);
        setText(dialogue,p.text||'正文正在生成…');setText(status,next.status);send.disabled=true;send.hidden=true;stop.hidden=false;stop.disabled=next.canStop===false;
        refreshReadingLayout();
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (readingTick !== null) doc.defaultView.cancelAnimationFrame(readingTick);
        screenMode.destroy();combatView?.destroy();
        clearChoiceEntrance();
        clearStatsEntrance();
        openingView?.destroy();
        disposers.forEach(function (dispose) { dispose(); });
        spriteExits.forEach(function (timer) { clearTimeout(timer); }); spriteExits.clear();
        if (mediaTick !== null) doc.defaultView.cancelAnimationFrame(mediaTick);
        cancelMedia(mediaActive); mediaQueue.clear(); spriteFailures.clear();
        spriteNodes.clear();
        if (backgroundImage) { backgroundImage.onload = null; backgroundImage.onerror = null; }
        if (root.hasAttribute('popover') && root.matches(':popover-open')) root.hidePopover();
        root.remove();
        if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      },
      focusInput: function () { if (!destroyed) { showComposer(true); focusDraft(); } },
      focusTerminal: function () { if (!destroyed) menuButton.focus({ preventScroll: true }); },
      focusWorkshop: function () { if (!destroyed) workshopButton.focus({ preventScroll: true }); },
      focusStatus: function () { if (!destroyed) statusButton.focus({ preventScroll: true }); }
    };
  }

  return { mount: mount };
});