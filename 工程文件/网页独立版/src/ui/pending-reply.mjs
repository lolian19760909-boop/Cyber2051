import {parseReply} from '../app/parse.mjs';

/** Present one retained reply while the saved story keeps its current head. */
export function mountPendingReply({document:doc,parser,onRetry,onDiscard}){
 const dialog=doc.createElement('dialog');dialog.className='cxx-memory-dialog cxx-pending-reply';dialog.setAttribute('aria-label','待处理回复');
 const node=(tag,text,parent=dialog)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;parent.append(el);return el;};
 node('h2','回复已保留，尚未保存');const reason=node('p');reason.setAttribute('role','status');
 const preview=node('article');preview.className='cxx-pending-reply-body';preview.setAttribute('aria-label','保留的回复');
 const source=node('details');node('summary','查看原文',source);const raw=node('textarea',undefined,source);raw.readOnly=true;raw.setAttribute('aria-label','保留的原文');
 const actions=node('footer');actions.className='cxx-pending-reply-actions';const retry=node('button','重试保存这份回复',actions),discard=node('button','丢弃这份回复',actions);retry.type=discard.type='button';retry.className='primary';
 let current=null,working=false;
 retry.onclick=()=>onRetry(current);discard.onclick=()=>onDiscard(current);
 dialog.addEventListener('cancel',event=>{if(working)event.preventDefault();});doc.body.append(dialog);
 return {
  open(record){const parsed=parseReply(record.raw,parser?{parser}:{});if(!parsed.display.paragraphs.length)return false;current=record;reason.textContent=record.error?.message||'收到的正文保留在这里。';preview.replaceChildren();for(const row of parsed.display.paragraphs)node('p',(row.speaker?row.speaker+'：':'')+row.text,preview);raw.value=record.raw;source.open=false;retry.textContent=record.processing?.mode==='extra'&&record.processing.stage!=='complete'?'继续处理这份回复':record.complete?'重试保存这份回复':'补全后重试';if(!dialog.open){dialog.showModal();retry.focus();}return true;},
  busy(value){working=value;dialog.setAttribute('aria-busy',String(value));retry.disabled=discard.disabled=value;},
  error(message){reason.textContent=message;},
  close(){if(dialog.open)dialog.close();current=null;},
  get operationId(){return current?.operationId;},
  destroy(){dialog.remove();current=null;}
 };
}
