// Candidate opening entrance. Authored material is loaded by the assembly manifest, never invented here.
(()=>{
 'use strict';
 const form=document.querySelector('.settings-form'),dialog=document.createElement('dialog'),head=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button'),root=document.createElement('div');
 dialog.className='m18-opening-panel';dialog.setAttribute('aria-labelledby','m18-opening-title');title.id='m18-opening-title';title.textContent='身份与起始时间';close.type='button';close.textContent='关闭';close.addEventListener('click',()=>{cancelMount();dialog.close();});head.append(title,close);dialog.append(head,root);document.body.append(dialog);
 const style=document.createElement('style');style.textContent='.m18-opening-panel{width:min(760px,calc(100% - 24px));max-height:calc(100dvh - 48px);box-sizing:border-box;overflow:auto;background:#120b10;color:#ddd;border:1px solid #695057;padding:20px}.m18-opening-panel::backdrop{background:#0009}.m18-opening-panel header{display:flex;justify-content:space-between;align-items:center;gap:16px}.m18-opening-panel select,.m18-opening-panel textarea,.m18-opening-panel button{background:#100b10;color:inherit;border:1px solid #6b5158;min-height:44px;padding:8px;max-width:100%;box-sizing:border-box}.m18-opening-panel label{display:block;margin:16px 0}.m18-opening-panel select,.m18-opening-panel textarea{display:block;width:100%}.m18-opening-panel pre{white-space:pre-wrap;overflow-wrap:anywhere}.m18-opening-panel [role=status]{line-height:1.6}';document.head.append(style);
 let mount=null,authored=null,selection=null,disposed=false;
 function cancelMount(){if(mount){selection=mount.getSelection();mount.destroy();mount=null;}}
 function useManifest(manifest,retain=false){cancelMount();authored=manifest;if(!retain)selection=null;root.replaceChildren();mount=CxxOpeningLink.mount({root,manifest,getContext:()=>TOKYO_TERMINAL_HOST.read(),commit:tx=>TOKYO_TERMINAL_HOST.commitOpening(tx)});if(selection){root.querySelector('.cxx-opening-link-identity').value=selection.identityId||'';root.querySelector('.cxx-opening-link-timeline').value=selection.timelineId||'';root.querySelector('.cxx-opening-link-description').value=selection.customDescription||'';}return mount.refresh();}
 const button=document.createElement('button');button.type='button';button.className='quiet';button.textContent='新开局设置 ↗';button.addEventListener('click',()=>{if(disposed)return;if(!mount)useManifest(authored,true);dialog.showModal();mount.refresh();close.focus();});form?.append(button);
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
 dialog.addEventListener('cancel',cancelMount);dialog.addEventListener('close',()=>{if(!dialog.open)cancelMount();});
 window.CXX_OPENING_PANEL={useManifest,show:()=>button.click(),read:()=>mount?.getSelection()||selection,status:()=>mount?.status()||{phase:'closed'}};
 useManifest(window.CXX_OPENING_MANIFEST);
 function pagehide(e){cancelMount();if(dialog.open)dialog.close();if(e.persisted)return;disposed=true;dialog.remove();style.remove();button.remove();delete window.CXX_OPENING_PANEL;window.removeEventListener('pagehide',pagehide);}
 window.addEventListener('pagehide',pagehide);
})();
