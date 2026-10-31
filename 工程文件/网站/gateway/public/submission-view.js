'use strict';
window.CxxSubmissionView = {
  render(container,presentation,comparison){
    const lang=window.CXXI18N?.current()||'zh',T=(zh,en,ja)=>lang==='en'?en:lang==='ja'?ja:zh;
    const titles={'任务详情':T('任务详情','Quest details','任務の詳細'),'模型读取正文':T('模型读取正文','Model context','モデルが読む本文'),'世界书正文':T('世界书正文','Lorebook text','世界書本文'),'历史原稿（未转换）':T('历史原稿（未转换）','Original legacy text','旧原稿（未変換）')};
    const el=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;e.className=cls||'';return e;};
    container.replaceChildren();
    for(const panel of presentation?.panels||[]){const section=el('section','','submission-prose');section.append(el('h3',titles[panel.title]||panel.title),el('pre',panel.text,'submission-prose-text'));container.append(section);}
    if(presentation?.note)container.append(el('p',presentation.note,'hint'));
    if(comparison){const section=el('section','','submission-comparison');section.append(el('h3',comparison.previousRevision?T('与上一修订对照 · rev','Changes since revision ','前版との差分 · rev')+comparison.previousRevision:T('修订对照','Revision comparison','版の比較')));
      if(comparison.note)section.append(el('p',comparison.note,'hint'));
      for(const change of comparison.changes){const detail=el('details','','form-options');detail.open=true;detail.append(el('summary',change.label),el('p',T('修改前','Before','変更前'),'meta'),el('pre',change.before||T('（空）','(empty)','（空欄）'),'submission-prose-text'),el('p',T('修改后','After','変更後'),'meta'),el('pre',change.after||T('（空）','(empty)','（空欄）'),'submission-prose-text'));section.append(detail);}container.append(section);
    }
  }
};
