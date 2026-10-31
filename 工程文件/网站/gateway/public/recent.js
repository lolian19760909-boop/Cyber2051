'use strict';
// Project details, public notices and downloads live on this page only.
document.addEventListener('DOMContentLoaded',()=>{
const {t,element:el}=CXXUI;
const state={download:'loading',manifest:null,announcements:'loading',items:[]};
// A progressive enhancement: plain image links work without this optional module.
let scenesModule, scenesAttempt = 0;
document.querySelector('.scene-choices')?.addEventListener('click', async event => {
  const choice = event.target.closest('a[data-scene]');
  if (!choice || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  try {
    // Failed module URLs are retained by the browser's module map.
    scenesModule ||= import('/workshop/city-scenes.mjs?v=visual20261016' + (scenesAttempt ? '&retry=' + scenesAttempt : ''));
    const scenes = await scenesModule;
    scenes.selectScene(choice);
  } catch {
    scenesModule = null;
    scenesAttempt++;
    document.querySelector('.scene-feedback').textContent = t('取景功能未能加载，可再次选择重试。','City views could not load. Choose a view to retry.','風景の切り替えを読み込めませんでした。もう一度選択してください。');
  }
});
function statePanel(title, body, retry) {
  const box = el('div', 'panel download-state'); box.append(el('h3', '', title), el('p', 'meta', body));
  if (retry) { const button = el('button', 'btn ghost', t('重试', 'Try again', '再試行')); button.type = 'button'; button.addEventListener('click', retry); box.append(button); }
  return box;
}

function renderDownloads() {
  const box = document.getElementById('dl'), chip = document.getElementById('ver-chip'); box.replaceChildren();
  const labels = {
    loading: [t('读取中…','Loading…','読み込み中…'),t('正在检查发布信息。','Checking release information.','公開情報を確認しています。')],
    unreleased: [t('下载版本尚未发布','No download release yet','ダウンロード版は未公開です'),t('正式文件发布后，会在这里提供下载。你仍可以浏览工坊和留言墙。','Downloads will appear here after release. The workshop and message wall are available.','正式なファイル公開後、ここに表示されます。工房と掲示板は利用できます。')],
    failed: [t('下载信息读取失败','Download information unavailable','ダウンロード情報を取得できません'),t('可能是暂时的连接问题，请重试。','This may be a connection problem. Please try again.','接続の問題かもしれません。再試行してください。')]
  };
  if (state.download !== 'ready') { const [title,body]=labels[state.download]; chip.textContent=title; box.append(statePanel(title,body,state.download==='loading'?null:loadDownloads)); return; }
  const m=state.manifest; chip.textContent=t('最新版本 V','Latest: V','最新バージョン V')+m.latest;
  for (const [key,label,note] of [['png',t('完整角色卡 · PNG','Full rolecard · PNG','完全版カード · PNG'),t('拖入 SillyTavern 即可导入。','Drag into SillyTavern to import.','SillyTavern にドラッグして導入できます。')],['json',t('角色卡数据 · JSON','Rolecard data · JSON','カードデータ · JSON'),t('用于导入或查看角色卡数据。','Import or inspect the card data.','導入やカードデータの確認に使えます。')]]) {
    const file=m[key]; if (!file) continue;
    const card=el('article','card download-card'); card.append(el('h3','',label),el('p','meta',note));
    if (m.date) card.append(el('p','meta',t('发布于 ','Released ','公開日 ')+m.date));
    const link=el('a','btn',t('下载文件','Download file','ダウンロード')); link.href=file.url; card.append(link);
    if (file.sha256) {
      const detail=el('details',''); detail.append(el('summary','',t('查看文件校验值','File checksum','ファイルのチェックサム')),el('p','sha','SHA-256 '+file.sha256));
      const copy=el('button','btn sm ghost',t('复制校验值','Copy checksum','チェックサムをコピー')), feedback=el('p','meta'); copy.type='button'; feedback.setAttribute('role','status');
      copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(file.sha256));feedback.textContent=t('已复制。','Copied.','コピーしました。');}catch{feedback.textContent=t('无法自动复制，请选择上方校验值手动复制。','Select the checksum above and copy it manually.','上のチェックサムを選択して手動でコピーしてください。');}});
      detail.append(copy,feedback); card.append(detail);
    }
    box.append(card);
  }
}
async function loadDownloads() {
  state.download='loading'; renderDownloads();
  try {
    const response=await fetch('/download/manifest.json',{cache:'no-store'});
    if (response.status===404) { state.download='unreleased'; state.manifest=null; }
    else {
      if (!response.ok) throw Error('download_failed'); const m=await response.json();
      if (!m.latest||(!m.png&&!m.json)) throw Error('invalid_manifest');
      for (const key of ['png','json']) if (m[key]) { if (!m[key].url) throw Error('invalid_url'); const url=new URL(m[key].url,location.href); if (!['https:','http:'].includes(url.protocol)) throw Error('invalid_url'); }
      state.manifest=m; state.download='ready';
    }
  } catch { state.download='failed'; }
  renderDownloads();
}
function renderAnnouncements() {
  const box=document.getElementById('annlist'); box.replaceChildren();
  if (state.announcements==='loading') { box.append(statePanel(t('读取中…','Loading…','読み込み中…'),'',null)); return; }
  if (state.announcements==='failed') { box.append(statePanel(t('公告读取失败','Notices unavailable','お知らせを取得できません'),t('请检查连接后重试。','Check your connection and try again.','接続を確認して再試行してください。'),loadAnnouncements)); return; }
  if (!state.items.length) { box.append(el('p','panel meta',t('还没有公告。','No notices yet.','お知らせはまだありません。'))); return; }
  state.items.forEach((item,index) => {
    const article=el('article','card announcement'+(item.pinned?' is-pinned':'')); const kind={card:t('版本更新','Update','更新'),site:t('公告','Notice','お知らせ'),event:t('活动','Event','イベント')};
    const content=el('div','ann-content'); content.append(el('h3','',item.title));
    article.append(el('div','meta ann-date',String(item.created_at||'').slice(0,10)),content,el('span',item.pinned?'badge amber':'badge dim',item.pinned?t('置顶','Pinned','固定'):(kind[item.kind]||item.kind)));
    const body=String(item.body||'');
    if (body.length>180) { const preview=el('p','ann-body',body.slice(0,180)+'…'); const details=el('details',''); details.append(el('summary','',t('展开全文','Read more','全文を表示')),el('div','ann-body',body)); details.addEventListener('toggle',()=>{preview.hidden=details.open;}); content.append(preview,details); }
    else content.append(el('p','ann-body',body));
    if(index<3) box.append(article);
    else { let more=box.querySelector('.older-notices'); if(!more){more=el('details','older-notices');more.append(el('summary','',t('更多近期公告','More recent notices','その他の最近のお知らせ')),el('div','ann-list'));box.append(more);}more.lastChild.append(article); }
  });
}
async function loadAnnouncements() {
  state.announcements='loading'; renderAnnouncements();
  try { const response=await fetch('/api/workshop/announcements',{cache:'no-store'});if(!response.ok)throw Error('failed');const j=await response.json();if(!j.ok||!Array.isArray(j.items))throw Error('failed');state.items=j.items;state.announcements='ready'; }
  catch { state.announcements='failed'; }
  renderAnnouncements();
}
document.addEventListener('cxx-lang-changed',()=>{renderDownloads();renderAnnouncements();});
loadDownloads();loadAnnouncements();
});
