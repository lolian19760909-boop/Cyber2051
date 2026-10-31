(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CxxSummaryUI235=factory();})(globalThis,function(){
  'use strict';
  function mount({document,root,service,settings=false}){
    const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
    const panel=make('section');panel.className='cxx-summary-panel';
    const note=make('p');note.setAttribute('role','status');
    const run=async fn=>{try{await fn();refresh();}catch(e){note.textContent=e.message;}};
    const btn=(text,fn)=>{const b=make('button',text);b.type='button';b.className='quiet';b.onclick=()=>run(fn);return b;};
    const field=(text,node)=>{const label=make('label',text+' ');label.append(node);panel.append(label);return node;};
    const select=(title,choices,fn)=>{const n=make('select');for(const [value,text]of choices){const o=make('option',text);o.value=value;n.append(o);}n.onchange=()=>run(()=>fn(n.value));return field(title,n);};
    const style=make('style');style.textContent=`
.cxx-summary-panel{display:grid;gap:12px;min-width:0;padding:16px;margin:12px 0;border:1px solid var(--cxx-line);border-top:2px solid var(--cxx-red);background:var(--cxx-panel);color:var(--cxx-text);font:16px/1.7 var(--cxx-font-ui);overflow-wrap:anywhere}
.cxx-summary-panel h3{margin:0 0 4px;font-size:20px;line-height:1.5;letter-spacing:.06em;color:var(--cxx-red-soft)}
.cxx-summary-panel label{display:flex;align-items:center;gap:12px;flex-wrap:wrap;min-height:44px}
.cxx-summary-panel select,.cxx-summary-panel input[type=number]{background:var(--cxx-ink);color:var(--cxx-text);border:1px solid var(--cxx-line);max-width:100%;padding:8px;min-height:44px;box-sizing:border-box;font:inherit}
.cxx-summary-panel input[type=number]{width:9em}
.cxx-summary-panel input[type=checkbox]{width:20px;height:20px;min-width:20px;min-height:20px;flex:0 0 20px;accent-color:var(--cxx-cyan)}
.cxx-summary-panel button{min-height:44px;white-space:normal;font:inherit}
.cxx-summary-panel details{border-top:1px solid var(--cxx-line);padding:12px 0}
.cxx-summary-panel summary{cursor:pointer;min-height:44px;align-content:center;color:var(--cxx-cyan-soft)}
.cxx-summary-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.85;max-width:72ch;color:var(--cxx-text)}
.cxx-summary-panel p{margin:4px 0;line-height:1.7;color:var(--cxx-muted)}
.cxx-summary-panel [role=status]{padding:8px 0;border-bottom:1px solid var(--cxx-line)}
.cxx-summary-panel :is(button,input,select,summary):focus-visible{outline:2px solid var(--cxx-cyan);outline-offset:2px}
`;
    panel.append(style,make('h3',settings?'总结与新闻设置':'剧情大总结'),note);root.append(panel);
    let mode,every,auto,target,approve,all,list,from,to,stamp='';const entryNodes=new Map();let emptyNote;
    const manual=btn('立即生成剧情总结',()=>service().summarizeNow());panel.append(manual);
    const manualCount=select('手动总结范围',[5,10,20,40].map(n=>[String(n),'最近未总结正文，最多 '+n+' 层']),value=>service().configure({manualSummaryCount:Number(value)}));
    const manualNews=make('input');manualNews.type='checkbox';manualNews.onchange=()=>run(()=>service().configure({manualNews:manualNews.checked}));field('手动总结成功后更新新闻',manualNews);
    panel.append(make('p','手动生成不需要达到自动间隔；不足设定层数也可生成，首次使用可总结已有聊天。更早的遗漏可按楼层范围补建。'));
    if(settings){
      mode=select('计数方式',[['all','全部聊天楼层'],['assistant','仅 AI 剧情回复']],value=>service().configure({countMode:value}));
      every=select('总结间隔',[10,20,30,40].map(n=>[String(n),n+' 层']),value=>service().configure({summaryEvery:Number(value)}));
      auto=make('input');auto.type='checkbox';auto.onchange=()=>run(()=>service().configure({autoEnabled:auto.checked}));field('自动生成总结与新闻',auto);
      target=make('p');approve=btn('允许此接口接收剧情并生成总结、新闻',()=>{const s=service(),c=s.config();return s.consent(s.endpoint(c.apiBase),c.model);});panel.append(target,approve);
      panel.append(make('p','间隔和计数方式只影响未总结部分。首次启用从当前楼层之后累计；历史剧情可在网路页按范围补建。标题开场和系统消息不计数，重 roll 不增加楼层。'));
    }else{
      all=make('input');all.type='checkbox';all.onchange=()=>run(()=>service().setSelection(all.checked?'all':'selected',all.checked?[]:(service().summaryEntries?.()||service().state().summary.entries).map(e=>e.id)));field('全选（新增总结也会加入）',all);
      panel.append(btn('全部取消',()=>service().setSelection('selected',[])),btn('按当前间隔生成下一段',()=>service().summarizePending()));
      from=make('input');to=make('input');for(const n of [from,to]){n.type='number';n.min='1';n.step='1';}
      field('补建起始楼层',from);field('补建结束楼层',to);panel.append(btn('生成此范围的总结',()=>service().summarizeRange(Number(from.value),Number(to.value))));
      panel.append(make('p','楼层编号与酒馆消息编号相同，开场为 0。补建范围包含玩家与 AI 正文。勾选只保存选择；点击上方“请求新动态”才会手动请求新闻。'),list=make('div'));
    }
    function refresh(){
      const s=service();if(!s){note.textContent='总结服务尚未就绪，请检查核心脚本。';return;}
      const state=s.state({light:typeof s.summaryEntries==='function'}),c=s.config();note.textContent='当前 '+state.pendingCount+'/'+c.summaryEvery+' '+(c.countMode==='all'?'楼层':'助手回复')+'，下次更新还差 '+Math.max(0,c.summaryEvery-state.pendingCount)+'。 '+state.status+(state.stale?' 当前显示的旧新闻已过期。':'')+(state.indexing?' 正在核对剧情来源。':'');panel.setAttribute('aria-busy',String(state.busy));
      manual.disabled=state.busy;manualCount.value=String(c.manualSummaryCount);manualNews.checked=c.manualNews;
      if(settings){mode.value=c.countMode;every.value=String(c.summaryEvery);auto.checked=c.autoEnabled;let address='未配置';try{address=s.endpoint(c.apiBase);}catch{}target.textContent='接收地址：'+address+' · 模型：'+(c.model||'未填写')+'。生成总结会发送选定范围的玩家剧情和 AI 正文；生成新闻只发送勾选的总结。'+(state.approved?' 已确认。':' 需要重新确认此用途。');approve.disabled=state.approved;return;}
      if(!state.summary)return;all.checked=state.summary.selectionMode==='all';from.max=to.max=String(state.lastFloor);
      const next=state.summaryRevision!==undefined?state.summaryRevision+':'+state.pendingCount+':'+state.indexing:JSON.stringify([state.summary,state.pendingCount]);if(next===stamp)return;stamp=next;
      const entries=s.summaryEntries?.()||[...state.summary.entries].sort((a,b)=>a.from-b.from),ids=new Set(entries.map(e=>e.id));
      for(const [id,node]of entryNodes)if(!ids.has(id)){node.item.remove();entryNodes.delete(id);}
      if(!entries.length){if(!emptyNote){emptyNote=make('p');list.append(emptyNote);}emptyNote.textContent='尚无总结。当前未总结计数：'+(state.indexing?'核对中':state.pendingCount)+'；首次启用前的剧情不会自动补算。';return;}emptyNote?.remove();emptyNote=null;
      for(const e of entries){
        let node=entryNodes.get(e.id);if(!node){const item=make('details');item.dataset.id=e.id;const head=make('summary'),label=make('label','用于新闻 '),check=make('input'),body=make('pre'),error=make('p');check.type='checkbox';
          check.onchange=()=>run(()=>{const snapshot=s.state({light:typeof s.summaryEntries==='function'}).summary,ids=new Set(snapshot.selectionMode==='all'?(s.summaryEntries?.()||snapshot.entries).map(x=>x.id):snapshot.selectedIds);if(check.checked)ids.add(e.id);else ids.delete(e.id);return s.setSelection('selected',[...ids]);});label.append(check);item.append(head,label,body,btn('重建 '+e.id,()=>s.rebuild(e.id)),error);node={item,head,check,body,error};entryNodes.set(e.id,node);list.append(item);}
        const title=e.id+' · 楼层 '+e.from+'—'+e.to+' · '+({valid:'有效',stale:'待重建',failed:'失败待重试'}[e.status]||e.status)+' · 修订 '+e.revision;if(node.head.textContent!==title)node.head.textContent=title;const text=e.text||'暂无可用正文';if(node.body.textContent!==text)node.body.textContent=text;node.check.checked=all.checked||state.summary.selectedIds.includes(e.id);node.error.hidden=!e.error;if(node.error.textContent!==(e.error||''))node.error.textContent=e.error||'';
      }
      entries.forEach((e,index)=>{const item=entryNodes.get(e.id).item;if(list.children[index]!==item)list.insertBefore(item,list.children[index]||null);});
    }
    refresh();return {refresh,destroy:()=>panel.remove()};
  }
  return {mount};
});
