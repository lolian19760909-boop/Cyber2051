(function(root){
 'use strict';
 const top=root.parent||root;
 top.CxxDraftExit={choose(parent,title='修改尚未保存'){
  const doc=parent.ownerDocument||parent;return new Promise(resolve=>{
   const host=doc.createElement('dialog');host.className='cxx-draft-exit cxx-feedback-theme';host.setAttribute('aria-label',title);
   const sheet=doc.createElement('style');sheet.textContent=globalThis.CxxFeedbackStyle||'';
   const box=doc.createElement('section');
   const h=doc.createElement('h3');h.textContent=title;box.append(h);host.append(sheet,box);
   const scope=parent.getRootNode?.(),prior=scope?.activeElement||parent.activeElement||doc.activeElement;const finish=value=>{host.close();host.remove();prior?.isConnected&&prior.focus({preventScroll:true});resolve(value);};
   for(const [id,label]of [['save','保存并离开'],['keep','保留草稿并离开'],['stay','继续编辑']]){const b=doc.createElement('button');b.type='button';b.textContent=label;b.dataset.choice=id;b.onclick=()=>finish(id);box.append(b);}
   host.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish('stay');}if(e.key==='Tab'){const buttons=[...box.querySelectorAll('button')],at=buttons.indexOf(scope?.activeElement||parent.activeElement||doc.activeElement);e.preventDefault();buttons[(at+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}};
   host.oncancel=e=>{e.preventDefault();e.stopPropagation();finish('stay');};
   (scope?.nodeType===11?scope:doc.body).append(host);host.showModal();box.querySelector('button').focus({preventScroll:true});
  });
 }};
})(globalThis);
