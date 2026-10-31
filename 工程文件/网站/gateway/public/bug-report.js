'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const T = (...texts) => window.CXXUI.t(...texts);
  let busy = false, imageUrls = [], notice = ['', '', ''], noticeError = false, request;
  const errors = {
    body_required: ['请填写 BUG 描述和完整标签文本。', 'Enter the bug description and full tagged text.', '不具合の説明とタグを含む全文を入力してください。'],
    body_too_long: ['文本最多 100000 字，请缩小到出现问题的完整回复。', 'Text is limited to 100000 characters. Include the complete affected response.', '本文は100000文字までです。問題が起きた応答の全文を含めてください。'],
    too_many_images: ['最多选择 4 张图片。', 'Choose up to 4 images.', '画像は4枚まで選択できます。'],
    invalid_image: ['请使用 PNG、JPG 或 WebP 图片，每张不超过 5 MiB。', 'Use PNG, JPG or WebP images, up to 5 MiB each.', 'PNG・JPG・WebP画像を使用してください。1枚5MiBまでです。'],
    images_too_large: ['图片合计不能超过 12 MiB。', 'Images must total no more than 12 MiB.', '画像の合計は12MiBまでです。'],
    file_too_large: ['本次内容过大，请减少图片后重试。', 'This report is too large. Reduce the images and retry.', '内容が大きすぎます。画像を減らして再送してください。'],
    rate_limited: ['提交太频繁，请稍后再试；输入内容仍保留。', 'Too many reports. Retry later; your draft is kept.', '送信が多すぎます。下書きは保持しています。後で再試行してください。'],
    daily_limit: ['今天的反馈收件已达上限，请稍后再试；输入内容仍保留。', 'Today’s report limit has been reached. Retry later; your draft is kept.', '本日の受付上限に達しました。下書きは保持しています。後で再試行してください。'],
    banned: ['当前账号不能提交反馈；输入内容仍保留。', 'This account cannot submit reports. Your draft is kept.', 'このアカウントでは送信できません。下書きは保持しています。'],
  };
  function message(texts, error = false) { notice = texts; noticeError = error; $('bug-message').textContent = T(...texts); $('bug-message').className = 'msg ' + (error ? 'err' : 'ok'); }
  function validate(files) {
    if (files.length > 4) return 'too_many_images';
    if (files.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) return 'invalid_image';
    if (files.reduce((sum, file) => sum + file.size, 0) > 12 * 1024 * 1024) return 'images_too_large';
    return null;
  }
  function controls() {
    const loggedIn = !!window.CXXUser.current();
    $('bug-send').disabled = busy || !loggedIn || !!validate([...$('bug-images').files]);
    $('bug-body').disabled = busy; $('bug-images').disabled = busy;
    $('bug-login-note').hidden = loggedIn;
    $('bug-count').textContent = $('bug-body').value.length + ' / 100000';
  }
  function clearPreviews() { imageUrls.forEach(url => URL.revokeObjectURL(url)); imageUrls = []; $('bug-previews').replaceChildren(); }
  function previews() {
    clearPreviews(); const files = [...$('bug-images').files], error = validate(files);
    if (error) { message(errors[error], true); controls(); return; }
    message(['', '', '']);
    for (const file of files) {
      const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
      image.src = URL.createObjectURL(file); imageUrls.push(image.src); image.alt = file.name;
      caption.textContent = file.name + ' · ' + Math.ceil(file.size / 1024) + ' KB'; figure.append(image, caption); $('bug-previews').append(figure);
    }
    controls();
  }
  const readImage = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ data: String(reader.result).split(',')[1] });
    reader.onerror = () => reject(Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
  $('bug-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !window.CXXUser.current()) return;
    const body = $('bug-body').value, files = [...$('bug-images').files];
    const invalid = !body.trim() ? 'body_required' : body.length > 100000 ? 'body_too_long' : validate(files);
    if (invalid) { message(errors[invalid], true); return; }
    const headers = window.CXXUser.headers({ 'Content-Type': 'application/json' });
    busy = true; request = new AbortController(); controls();
    message(['正在提交私密反馈……', 'Submitting your private report…', '非公開の報告を送信中…']);
    try {
      const images = await Promise.all(files.map(readImage));
      if (request.signal.aborted || headers.Authorization !== window.CXXUser.headers().Authorization) {
        message(['登录状态已变化，请确认后重新提交；输入内容仍保留。', 'Your login changed. Review and resubmit; your draft is kept.', 'ログイン状態が変わりました。下書きを確認して再送してください。'], true); return;
      }
      const response = await fetch('/api/workshop/bugs', { method: 'POST', headers, body: JSON.stringify({ body, images }), credentials: 'omit', cache: 'no-store', signal: request.signal });
      const result = await response.json().catch(() => ({}));
      if (response.status === 201 && result.ok && result.private === true) {
        $('bug-body').value = ''; $('bug-images').value = ''; clearPreviews();
        message(['BUG 反馈 #' + result.id + ' 已提交，仅管理员可见，不会显示在留言墙。', 'Bug report #' + result.id + ' submitted. Only administrators can view it; it will not appear on the wall.', '不具合報告 #' + result.id + ' を送信しました。管理者のみ閲覧でき、ボードには公開されません。']);
      } else if (response.status === 401) {
        if (headers.Authorization === window.CXXUser.headers().Authorization) window.CXXUser.logout();
        message(['登录已过期，请在上方重新登录；文本和图片仍保留。', 'Login expired. Sign in above; your text and images are kept.', 'ログイン期限切れです。上部から再ログインしてください。本文と画像は保持しています。'], true);
      } else message(errors[result.error] || ['提交未成功，请稍后重试；文本和图片仍保留。', 'Submission failed. Retry later; your text and images are kept.', '送信できませんでした。本文と画像は保持しています。後で再試行してください。'], true);
    } catch {
      message(['未确认是否提交成功；文本和图片仍保留，请稍后确认再重试。', 'Submission is unconfirmed. Your text and images are kept; check before retrying.', '送信結果を確認できません。本文と画像は保持しています。確認後に再試行してください。'], true);
    } finally { busy = false; controls(); }
  });
  $('bug-images').addEventListener('change', previews);
  $('bug-body').addEventListener('input', controls);
  document.addEventListener('cxx-user-changed', controls);
  document.addEventListener('cxx-lang-changed', () => { message(notice, noticeError); controls(); });
  window.addEventListener('pagehide', () => { request?.abort(); clearPreviews(); });
  controls();
})();
