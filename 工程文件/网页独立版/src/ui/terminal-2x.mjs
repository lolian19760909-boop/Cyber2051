/** Native 2.0 screenshot crops; the existing terminal still owns navigation and operations. */
import {appUrl} from '../platform/paths.mjs';
import {phone2xStyle,nativeFontStyle} from './phone-2x.mjs';
import {DETAIL_ENTER} from './terminal-detail-motion.mjs';
export async function prepareTerminal2x({shadow,session,theme}){
  const [response,phoneCSS]=await Promise.all([fetch(appUrl('web/terminal-2x.css')),phone2xStyle()]);if(!response.ok)throw Error('终端样式读取失败');
  const base=appUrl('web/assets/terminal-2x/'),art=['item-detail','stat-track','stat-fill','stat-up','stat-down','stat-up-marker','stat-down-marker','frame-action'];
  const css=(await response.text())+phoneCSS+':host{'+art.map(id=>'--cp2-'+id+':url("'+base+id+'.png")').join(';')+';--cp2-tree-bg:url("'+base+'talents/bg-70388ab4.webp")}',root=shadow.getElementById('t2051x-root'),doc=root.ownerDocument;
  const sheet=doc.createElement('style');sheet.textContent=css;shadow.append(sheet);root.dataset.cp2='';
  globalThis.CxxWebTerminal.talentAssets=Object.fromEntries(['available-7e42d897.png','available-88b3fa9e.png','bg-70388ab4.webp','maxed-9a8780b7.png','maxed-ab33beb4.png','not_connected-71149b76.png','not_connected-dff9bee3.png','tile-master-available-1322f2e3.png','tile-master-locked-3c2ba3f9.png','tile-master-maxed-472133c0.png','tile-master-maxed-glow-3449f49c.png','tile-milestone-available-64da32d1.png','tile-milestone-invested-f0e6d754.png','tile-milestone-locked-12fa8d8c.png','tile-milestone-maxed-edc31f05.png','tile-milestone-maxed-glow-f59aa444.png','tile-milestone-not_connected-83210518.png','tree-decoration-6ce8e6ed.png'].map(key=>[key,base+'talents/'+key]));
  for(const id of ['backdrop','edge-left','edge-right','nav-active','nav-idle','frame-idle','frame-active','frame-action','slot-texture','icon-backpack','icon-stats','icon-weapon','icon-clothing','icon-other','icon-cyberware','cursor','attribute-point','perk-point','attribute-circuits','cyberware-empty','archive-row','archive-current','archive-arrow','quest-mark','journal-row','journal-current'])root.style.setProperty('--cp2-'+id,'url("'+base+id+'.png")');
  const fonts=nativeFontStyle(doc);
  globalThis.CxxWebTerminal.detailEnter=DETAIL_ENTER;
  const previous=globalThis.CxxTerminalPlayerStyle;globalThis.CxxTerminalPlayerStyle=(previous||'')+'\n'+css;globalThis.CxxWebTerminal.native2x=true;globalThis.CxxWebTerminal.cyberwareBody=base+'cyberware-body.png';
  globalThis.CxxWebTerminal.attributeAssets=Object.fromEntries([['tile-3-6c9d2cd8.svg','attribute-top'],['tile-2-0ea2f3c7.svg','attribute-middle'],['tile-1-7ced94d8.svg','attribute-bottom'],['tree-decoration-6ce8e6ed.png','attribute-circuits']].map(([key,name])=>[key,base+name+'.png']));
  const n=(tag,text,where,cls)=>{const el=doc.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;where.append(el);return el;};
  let app,stop,level,identity,turn,wallet,nav,keyboard;
  const controls=[];
  function buildChrome(){
  const head=root.querySelector('.masthead'),brand=head.querySelector('.brand'),connection=head.querySelector('.connection'),close=head.querySelector('#t2051x-close-terminal');
  brand.replaceChildren();connection.replaceChildren();
  const levelGroup=n('span',null,brand,'cp2-stat');level=n('strong','—',levelGroup);n('span','等级',levelGroup);
  identity=n('span','',brand,'cp2-identity');const turnGroup=n('span',null,connection,'cp2-stat');n('span','回合',turnGroup);turn=n('b','—',turnGroup);wallet=n('span','',connection,'cp2-wallet');
  close.replaceChildren();n('kbd','Esc',close);n('span','关闭',close);
  nav=root.querySelector('.system-nav');nav.replaceChildren();nav.setAttribute('aria-label','游戏菜单');
  const foot=root.querySelector('.terminal-foot'),extra=n('nav',null,foot,'cp2-extra');extra.setAttribute('aria-label','其他终端功能');foot.append(close);
  const routes=[['characters','义体','义体'],['characters','物品栏','装备'],['characters','人物','人物'],['city',null,'地图'],['operations',null,'日志']];
  function routeButton(page,tab,title,into){const button=n('button',title,into,'cp2-menu-item');button.type='button';button.dataset.page=page;if(tab)button.dataset.tab=tab;
    button.onclick=async()=>{button.disabled=true;try{if(app.page!==page&&await app.canLeave()===false)return;app.navigate(page,{tab});refresh();}finally{button.disabled=false;}};controls.push({button,page,tab});return button;}
  for(const [page,tab,title]of routes)routeButton(page,tab,title,nav);
  for(const [page,title]of [['network','通讯'],['archive','资料库'],...(globalThis.CxxWebTerminal.mountDatabase?[['database','数据库']]:[]),['settings','设置']])routeButton(page,null,title,extra);
  keyboard=event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.stopImmediatePropagation();return;}if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...nav.querySelectorAll('button')],at=buttons.indexOf(event.target);if(at<0)return;event.preventDefault();event.stopImmediatePropagation();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(at+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;buttons[next].focus();};
  nav.addEventListener('keydown',keyboard,true);
  }
  function refresh(){
    root.dataset.cp2Theme=theme();const selected=globalThis.CxxEnsembleState.selected(session.currentState),g=selected.gameplay||{};
    level.textContent=g.growth?.level??'—';identity.textContent=(selected.actorId==='player'?session.profile.name:selected.record?.name)||'旅人';turn.textContent=session.currentState.terminal.turn??'—';wallet.textContent='¥ '+(selected.wallet?.yen??'—').toLocaleString('zh-CN');
    const tab=app?.state.player?.tab||'人物';root.dataset.cp2Tab=tab;
    for(const item of controls)item.button.setAttribute('aria-current',String(app?.page===item.page&&(!item.tab||item.tab===tab)));
  }
  return {install(terminal){app=terminal;buildChrome();stop=app.subscribe(refresh);refresh();},refresh,destroy(){stop?.();nav.removeEventListener('keydown',keyboard,true);fonts.remove();globalThis.CxxTerminalPlayerStyle=previous;}};
}
