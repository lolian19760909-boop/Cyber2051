/** Reading a floor does not move the committed story head. */
export function createNativeReader({stage,parser,onEdit,onDelete,onVersion,busy=()=>false,onPosition=()=>{}}){
  const doc=stage.ownerDocument,scroll=stage.closest('.stage'),windowSize=40,views=new Map();
  let nodes=[],versions={},floor=0,index=0,follow=true,start=0,end=0,pending=false,dead=false,frame=0,displayKey,streamView=null;
  const n=(tag,text,where,cls)=>{const el=doc.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;where.append(el);return el;};
  const button=(text,fn,where)=>{const el=n('button',text,where);el.type='button';el.onclick=fn;return el;};
  stage.replaceChildren();stage.classList.add('cxx-native-reading');
  const nav=n('nav',null,stage,'cxx-native-floors');nav.setAttribute('aria-label','正文楼层');
  const previous=button('上一层',()=>select(floor-1),nav),choose=n('select',null,nav),next=button('下一层',()=>select(floor+1),nav),latest=button('最新',()=>select(nodes.length-1),nav);
  choose.setAttribute('aria-label','选择正文楼层');choose.onchange=()=>select(Number(choose.value));
  const edit=button('编辑原文',()=>onEdit(nodes[floor].nodeId),nav),remove=button('删除此层起',()=>onDelete(nodes[floor].nodeId),nav),version=n('span',null,nav);
  const earlier=button('显示更早楼层',()=>{const height=scroll.scrollHeight;start=Math.max(0,start-windowSize);render();scroll.scrollTop+=scroll.scrollHeight-height;},stage);
  const list=n('div',null,stage,'cxx-native-layout');
  function position(){return {floor,index,follow};}
  function refreshBusy(){
    previous.disabled=floor<=0;next.disabled=floor>=nodes.length-1;latest.disabled=follow;choose.value=String(floor);
    edit.disabled=!nodes[floor]||pending||busy();remove.disabled=!nodes[floor]?.parentId||pending||busy();version.replaceChildren();
    const node=nodes[floor],ids=versions[node?.nodeId]||[],at=ids.indexOf(node?.nodeId);
    if(ids.length>1&&onVersion){const a=button('上一版',()=>changeVersion(ids[at-1]),version);a.disabled=at<=0||pending||busy();n('span',(at+1)+' / '+ids.length,version);const b=button('下一版',()=>changeVersion(ids[at+1]),version);b.disabled=at>=ids.length-1||pending||busy();}
  }
  function paragraph(item){
    const p=doc.createElement('p');
    if(item.speaker||item.characterId||item.dialogueText!==undefined||/^「[\s\S]*」$/.test(item.text.trim())){
      const person=globalThis.Cxx238Dialogue.portraits.find(c=>c.id===item.characterId||c.name===item.speaker),wrap=n('span',null,p,'bdc bdc-cxx bde-'+globalThis.Cxx238Dialogue.expression(item.expression)+(item.kind==='thought'?' bdc-thought':''));
      if(person)p.classList.add('bda-'+person.id.toLowerCase());
      const speaker=item.speaker||person?.name||item.characterId;if(speaker)n('span',speaker+'：',wrap,'bda-speaker');else wrap.classList.add('cxx-native-unattributed');if(item.kind==='thought')n('span','心声',wrap,'cxx-dialogue-mode');wrap.append(doc.createTextNode(item.text));
    }else p.textContent=item.text;
    return p;
  }
  function paint(view,raw,streaming=false){
    view.prose?.destroy();view.prose=null;
    const parsed=parser.parseMessage(raw,{nodeId:view.nodeId}),items=parsed.paragraphs||[],old=view.items||[];if(!view.aux)view.aux=n('div',null,view.body);
    for(let i=0;i<items.length;i++){if(JSON.stringify(items[i])===JSON.stringify(old[i]))continue;const p=paragraph(items[i]);p.dataset.paragraph=String(i);p.onclick=()=>{if(view.nodeId){floor=nodes.findIndex(row=>row.nodeId===view.nodeId);index=i;refreshBusy();onPosition(position());}};const existing=view.body.querySelector('[data-paragraph="'+i+'"]');if(existing)existing.replaceWith(p);else view.body.insertBefore(p,view.aux);}
    for(const p of view.body.querySelectorAll('[data-paragraph]'))if(Number(p.dataset.paragraph)>=items.length)p.remove();view.items=items;view.raw=raw;view.aux.replaceChildren();for(const block of parsed.auxiliary||[]){const detail=n('details',null,view.aux,'cxx-native-aux');detail.dataset.cxxAux='native';n('summary',block.label||'更多',detail);n('div',block.text||block.body||'',detail,'cxx-native-aux-body');}
    if(!streaming){view.prose?.destroy();view.prose=globalThis.CxxNativeProse.mount(view.body,{raw:()=>raw});}
  }
  function createView(node,at){
    const row=doc.createElement('section');row.className='mes cxx-native-floor';row.dataset.nodeId=node.nodeId;row.setAttribute('mesid',String(at));
    const title=n('header',null,row,'cxx-native-floor-title');button('第 '+(at+1)+' 层',()=>select(at),title);
    if(node.message.input?.text)n('p',node.message.input.text,title,'cxx-native-input');
    const body=n('article',null,row,'mes_text cxx-native-prose'),marker=n('span',null,body);marker.dataset.cxxBdaStyle='r4';marker.hidden=true;
    const view={row,body,nodeId:node.nodeId};paint(view,node.message.raw);return view;
  }
  function render(){
    const visible=new Set(nodes.slice(start,end).map(row=>row.nodeId));
    for(const [id,view]of views)if(!visible.has(id)){view.prose?.destroy();view.row.remove();views.delete(id);}
    let cursor=list.firstElementChild;
    for(let at=start;at<end;at++){const node=nodes[at];let view=views.get(node.nodeId);if(!view){view=createView(node,at);views.set(node.nodeId,view);}else if(view.raw!==node.message.raw||view.depth!==nodes.length-at-1)paint(view,node.message.raw);view.depth=nodes.length-at-1;if(view.row!==cursor)list.insertBefore(view.row,cursor);cursor=view.row.nextElementSibling;}
    if(streamView)list.append(streamView.row);earlier.hidden=start===0;refreshBusy();
  }
  function select(value,at=0){
    if(!nodes.length)return;floor=Math.max(0,Math.min(nodes.length-1,value));index=at;follow=floor===nodes.length-1;
    if(floor<start||floor>=end){start=Math.max(0,floor-Math.floor(windowSize/2));end=Math.min(nodes.length,start+windowSize);render();}
    refreshBusy();const view=views.get(nodes[floor].nodeId),target=at?view.body.querySelector('[data-paragraph="'+at+'"]'):view.row;target?.scrollIntoView({block:'start'});onPosition(position());
  }
  async function changeVersion(targetId){if(pending||busy())return;pending=true;refreshBusy();try{await onVersion(nodes[floor].nodeId,targetId);}finally{pending=false;refreshBusy();}}
  const onScroll=()=>{if(frame||dead)return;frame=requestAnimationFrame(()=>{frame=0;const top=scroll.getBoundingClientRect().top+nav.offsetHeight+8;let selected;
    for(const node of nodes.slice(start,end)){const view=views.get(node.nodeId);if(view.row.getBoundingClientRect().bottom>top){selected=node.nodeId;break;}}
    if(selected){floor=nodes.findIndex(row=>row.nodeId===selected);const view=views.get(selected);index=0;for(const p of view.body.querySelectorAll('[data-paragraph]'))if(p.getBoundingClientRect().top<=top)index=Number(p.dataset.paragraph);}
    follow=end===nodes.length&&scroll.scrollHeight-scroll.scrollTop-scroll.clientHeight<80;refreshBusy();onPosition(position());});};
  scroll.addEventListener('scroll',onScroll,{passive:true});
  return {
    update(nextNodes,nextVersions={},key){
      const selected=nodes[floor]?.nodeId,initial=!nodes.length,changed=key!==displayKey;displayKey=key;
      if(changed){for(const view of views.values()){view.prose?.destroy();view.row.remove();}views.clear();}
      const same=nodes.length===nextNodes.length&&nodes.every((row,i)=>row.nodeId===nextNodes[i].nodeId&&row.message.raw===nextNodes[i].message.raw);
      nodes=nextNodes;versions=nextVersions;const at=nodes.findIndex(row=>row.nodeId===selected);floor=follow||at<0?Math.max(0,nodes.length-1):at;
      if(initial||follow||at<0){start=Math.max(0,nodes.length-windowSize);end=nodes.length;}else{end=Math.min(end,nodes.length);start=Math.min(start,Math.max(0,end-1));}
      if(!same){choose.replaceChildren();for(const [i,node]of nodes.entries()){const option=n('option','第 '+(i+1)+' 层 · '+(node.message.input?.text||'开场').slice(0,24),choose);option.value=String(i);}if(streamView&&(nodes.at(-1)?.nodeId!==streamView.parentNodeId||nodes.at(-1)?.message.raw===streamView.raw)){streamView.prose?.destroy();streamView.row.remove();streamView=null;}}
      render();if(initial)select(floor);else if(!same&&follow)scroll.scrollTop=scroll.scrollHeight;
    },
    stream(raw){if(!streamView){const row=n('section',null,list,'mes cxx-native-floor cxx-native-candidate');n('header','正在生成',row,'cxx-native-floor-title');streamView={row,parentNodeId:nodes.at(-1)?.nodeId,body:n('article',null,row,'mes_text cxx-native-prose')};const marker=n('span',null,streamView.body);marker.dataset.cxxBdaStyle='r4';marker.hidden=true;}streamView.row.querySelector('header').textContent='正在生成';paint(streamView,raw,true);if(follow)scroll.scrollTop=scroll.scrollHeight;},
    finish(){if(streamView){streamView.row.querySelector('header').textContent='未保存的回复';paint(streamView,streamView.raw);}refreshBusy();},
    select,position,refreshBusy,destroy(){dead=true;cancelAnimationFrame(frame);scroll.removeEventListener('scroll',onScroll);for(const view of views.values())view.prose?.destroy();streamView?.prose?.destroy();views.clear();stage.replaceChildren();}
  };
}
