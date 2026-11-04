'use strict';
// Existing cursor, URL, search and cancellation contracts are retained.
document.addEventListener('DOMContentLoaded', () => {
'use strict';
const { t, element: el }=CXXUI;
const node=id=>document.getElementById(id);
let catalogView='grid';
try { const saved=localStorage.getItem('cxx-catalog-view');if(['list','compact'].includes(saved))catalogView=saved; } catch {}
function applyView(){
 document.body.dataset.catalogView=catalogView;
 document.querySelectorAll('button[data-catalog-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.catalogView===catalogView)));
}
document.querySelectorAll('button[data-catalog-view]').forEach(button=>button.addEventListener('click',()=>{
 catalogView=button.dataset.catalogView;try{localStorage.setItem('cxx-catalog-view',catalogView);}catch{}applyView();render();
}));
applyView();
const types={character:['NPC / 人物资料','NPC / Characters','NPC / 人物資料'],world_factor:['世界 / 地点资料','World / Places','世界 / 場所の資料'],user_identity:['玩家出身资料','Player backgrounds','プレイヤーの出自'],contract:['委托 / 侧剧情','Quests / Side stories','依頼 / サイドストーリー'],shop_item:['商店物品','Shop items','商品'],blueprint:['蓝图','Blueprints','設計図'],recipe:['配方','Recipes','レシピ'],skill:['技能','Skills','スキル'],function:['功能','Functions','機能'],code_component:['代码集成提案','Code integration proposal','コード統合提案']};
let cursor='', trail=[], data=null, status='loading', controller, generation=0;
const readURL=()=>{ const p=new URLSearchParams(location.search);node('type').value=p.get('type')||'';node('q').value=p.get('q')||'';node('sort').value=['new','updated','subscribers','endorsements'].includes(p.get('sort'))?p.get('sort'):'new';cursor=p.get('cursor')||'';trail=Array.isArray(history.state&&history.state.catalogTrail)?history.state.catalogTrail:[]; };
function writeURL(){const p=new URLSearchParams({sort:node('sort').value});if(node('type').value)p.set('type',node('type').value);if(node('q').value.trim())p.set('q',node('q').value.trim());if(cursor)p.set('cursor',cursor);history.replaceState({...history.state,catalogTrail:trail},'',location.pathname+(p.size?'?'+p:''));}
function renderTypes(){ const value=node('type').value;node('type').replaceChildren();const all=el('option','',t('全部类型','All types','すべての種類'));all.value='';node('type').append(all);for(const key of ['character','world_factor','user_identity','contract','shop_item','blueprint','recipe','skill','function','code_component']){const opt=el('option','',t(...types[key]));opt.value=key;node('type').append(opt);}node('type').value=value; }
function empty(title,body,action,callback){const box=el('div','empty');box.append(el('h2','',title),el('p','',body));if(action){const button=el('button','btn ghost',action);button.type='button';button.addEventListener('click',callback);box.append(button);}return box;}
function render(){
 const list=node('list');list.replaceChildren();list.setAttribute('aria-busy',String(status==='loading'));node('search').disabled=status==='loading';node('previous').disabled=status!=='ready'||!cursor;node('next').disabled=status!=='ready'||!data||!data.nextCursor;
 node('previous').textContent=cursor&&!trail.length?t('回到第一页','First page','最初のページ'):t('上一页','Previous','前へ');
 node('pages').hidden=status!=='ready'||!data||(data.total<=24&&!cursor);
 if(status==='loading'){node('count').textContent=t('正在读取目录…','Loading creations…','作品を読み込み中…');list.append(empty(t('读取中…','Loading…','読み込み中…'),'','',null));return;}
 if(status==='invalid-cursor'){node('count').textContent='';list.append(empty(t('分页链接已失效','This page link is invalid','ページ情報が無効です'),t('回到第一页继续浏览，筛选条件仍保留。','Return to the first page. Your filters are preserved.','最初のページに戻ってください。検索条件は保持されます。'),t('回到第一页','First page','最初のページ'),()=>{cursor='';trail=[];load();}));return;}
 if(status==='failed'){node('count').textContent='';list.append(empty(t('目录读取失败','Could not load the workshop','工房を読み込めません'),t('请检查连接后重试。筛选条件仍保留。','Check your connection. Your filters are preserved.','接続を確認してください。検索条件は保持されています。'),t('重试','Try again','再試行'),load));return;}
 node('count').textContent=t('共 ','Total: ','合計 ')+data.total+t(' 条内容',' creations',' 件');
 node('page-info').textContent=t('本页 ','Showing ','このページ ')+data.items.length+t(' 条',' items',' 件');
 if(!data.items.length){const filtered=node('type').value||node('q').value.trim();list.append(empty(filtered?t('没有匹配的内容','No matching creations','一致する作品はありません'):t('这里还没有公开内容','No published creations yet','公開作品はまだありません'),filtered?t('换个关键词，或清除筛选看看。','Try another keyword or clear your filters.','別のキーワードか、条件をクリアしてください。'):t('投稿经审核后会出现在这里。','Reviewed creations will appear here.','審査済みの作品がここに表示されます。'),filtered?t('清除筛选','Clear filters','条件をクリア'):t('投稿一份作品','Share a creation','作品を投稿'),filtered?reset:()=>{location.href='/workshop/submit.html';}));return;}
 if(catalogView==='compact'){
  const table=el('table','catalog-table'),head=el('thead',''),labels=el('tr','');for(const label of [t('类型','Type','種類'),t('标题','Title','タイトル'),t('作者','Author','作者'),t('订阅','Subscribers','購読'),t('认可','Endorsements','推薦'),t('版本','Version','版'),t('更新','Updated','更新')]){const cell=el('th','',label);cell.scope='col';labels.append(cell);}head.append(labels);const rows=el('tbody','');for(const item of data.items){const row=el('tr','');row.dataset.motionRow='';const title=el('td',''),link=el('a','catalog-entry-link',item.title);link.href='/workshop/submission.html?id='+encodeURIComponent(item.id);title.append(link);row.append(el('td','',types[item.type]?t(...types[item.type]):item.type),title,...[item.authorName||'—',item.subscriberCount||0,item.endorsementCount||0,item.publication?.version||'待发行',String(item.updatedAt||'').slice(0,10)].map(value=>el('td','',String(value))));rows.append(row);}table.append(head,rows);list.append(table);window.CxxWorkshopMotion?.rows(rows);return;
 }
 for(const item of data.items){const card=el('a','card click catalog-card');card.href='/workshop/submission.html?id='+encodeURIComponent(item.id);const badges=el('div','');badges.append(el('span','badge red',types[item.type]?t(...types[item.type]):item.type));if(item.hasFile)badges.append(el('span','badge amber',t('含附件','Attachment','添付あり')));card.append(badges,el('h2','',item.title),el('div','card-summary',item.summary||t('暂无简介','No summary','紹介文なし')));const tags=el('div','card-tags');for(const tag of(item.tags||[]).slice(0,4))tags.append(el('span','tag',tag));card.append(tags,el('div','meta card-meta',(item.authorName||t('匿名','Anonymous','匿名'))+' · '+t('订阅 ','Subscribers ','購読 ')+(item.subscriberCount||0)+' · '+t('认可 ','Endorsements ','推薦 ')+(item.endorsementCount||0)+' · '+(item.publication?'v'+item.publication.version:t('待发行','Awaiting release','公開待ち'))+' · '+String(item.updatedAt||'').slice(0,10)));card.dataset.motionRow='';list.append(card);}
 window.CxxWorkshopMotion?.rows(list);
}
async function load(){
 const current=++generation;if(controller)controller.abort();controller=new AbortController();status='loading';render();writeURL();
 const p=new URLSearchParams({pageSize:'24',sort:node('sort').value});if(node('type').value)p.set('type',node('type').value);if(node('q').value.trim())p.set('q',node('q').value.trim());if(cursor)p.set('cursor',cursor);
 try{const response=await fetch('/api/workshop/submissions?'+p,{cache:'no-store',signal:controller.signal});const j=await response.json();if(!response.ok||!j.ok||!Array.isArray(j.items))throw Error(j.error||'failed');if(current!==generation)return;data=j;status='ready';}
 catch(error){if(current!==generation||error.name==='AbortError')return;status=error.message==='invalid_cursor'?'invalid-cursor':'failed';}
 render();
}
function reset(){node('sort').value='new';node('type').value='';node('q').value='';cursor='';trail=[];load();}
node('filters').addEventListener('submit',e=>{e.preventDefault();cursor='';trail=[];load();});node('sort').addEventListener('change',()=>{cursor='';trail=[];load();});node('type').addEventListener('change',()=>{cursor='';trail=[];load();});node('clear').addEventListener('click',reset);
node('next').addEventListener('click',()=>{if(!data||!data.nextCursor)return;trail.push(cursor);cursor=data.nextCursor;load();});
node('previous').addEventListener('click',()=>{cursor=trail.length?trail.pop():'';load();});
document.addEventListener('cxx-lang-changed',()=>{renderTypes();render();});window.addEventListener('popstate',()=>{readURL();load();});
renderTypes();readURL();load();
});

