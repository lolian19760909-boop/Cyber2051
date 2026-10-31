/* Enhance already-rendered text; never render raw model HTML or rewrite messages. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require("../Gal/parser.js"):root.CxxGalParser);if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxNativeProse=api;})(globalThis,function(parser){
  'use strict';
  const names=new Set(['高松灯','灯','千早爱音','爱音','长崎素世','素世','椎名立希','立希','要乐奈','乐奈','丰川祥子','祥子','三角初华','初华','若叶睦','睦','八幡海铃','海铃','祐天寺若麦','若麦']);
  function speakerPrefix(text){
    const match=/^(\s*)([^\s：:]{1,8})([：:])/.exec(text);
    return match&&names.has(match[2])?{name:match[2],start:match[1].length,end:match[0].length}:null;
  }
  const auxiliaryBlocks=raw=>parser.parseMessage(raw).auxiliary;
  const normalize=text=>text.replace(/\s+/g,' ').trim();
  const excluded='pre,code,blockquote,details,iframe,style,script';
  function mount(container,{raw=()=>'',renderText=null}={}){
    const owned=[],folded=new WeakSet(),aux=[],wrappers=[];
    let cachedRaw=null,blocks=[];
    function wrap(nodes,label){
      const detail=container.ownerDocument.createElement('details'),summary=container.ownerDocument.createElement('summary'),body=container.ownerDocument.createElement('div');
      summary.textContent=label;detail.className='cxx-native-aux';detail.dataset.cxxAux='native';
      body.className='cxx-native-aux-body';
      // Explicitly hide one element, including any bare text nodes. Some host
      // themes override details layout; do not rely on its anonymous content box.
      const sync=()=>{body.hidden=!detail.open;body.style?.setProperty('display',detail.open?'block':'none','important');};
      nodes[0].before(detail);body.append(...nodes);detail.append(summary,body);detail.open=false;sync();detail.addEventListener('toggle',sync);folded.add(detail);wrappers.push({detail,summary,body,sync});
    }
    function fallbackAux(){
      const source=raw();
      if(source!==cachedRaw){cachedRaw=source;blocks=auxiliaryBlocks(source).map(block=>({...block,visible:renderText?renderText(block.text):block.text}));}
      for(const block of blocks){
        const target=normalize(block.visible);if(!target)continue;
        if(Array.from(container.querySelectorAll(excluded)).some(node=>normalize(node.textContent).includes(target)))continue;
        const nodes=Array.from(container.childNodes),matches=[];
        // Move only complete sibling nodes; preserve Markdown elements and their handlers.
        for(let i=0;i<nodes.length;i++){
          let text='',selected=[];
          for(let j=i;j<nodes.length;j++){
            const node=nodes[j];if(node.nodeType!==3&&node.nodeType!==1)break;
            if(node.nodeType===1&&(node.matches(excluded)||node.querySelector(excluded)))break;
            text=normalize(text+' '+node.textContent);selected.push(node);
            if(!text)continue;
            if(text===target){matches.push(selected);break;}
            if(!target.startsWith(text))break;
          }
        }
        // Leading whitespace nodes may describe the same block more than once.
        const unique=matches.filter((nodes,index)=>matches.findIndex(other=>other.at(-1)===nodes.at(-1))===index);
        if(unique.length===1){wrap(unique[0],block.label);continue;}
        if(unique.length)continue;
        const walker=container.ownerDocument.createTreeWalker(container,4),texts=[];
        while(walker.nextNode()){
          const node=walker.currentNode;if(node.parentElement?.closest(excluded))continue;
          const needle=block.visible.trim(),at=node.data.indexOf(needle);
          if(at>=0&&node.data.indexOf(needle,at+1)<0)texts.push({node,at,needle});
        }
        if(texts.length===1){const {node,at,needle}=texts[0];node.splitText(at+needle.length);const body=node.splitText(at);wrap([body],block.label);}
      }
    }
    function refresh(){
      // Drop detached references after streaming replaces a rendered message.
      for(const list of [owned,aux,wrappers])for(let i=list.length-1;i>=0;i--){const n=list[i].span||list[i].detail;if(!container.contains(n))list.splice(i,1);}
      for(const paragraph of container.querySelectorAll('p')){
        if(paragraph.closest('pre,code,blockquote,details')||paragraph.querySelector('.cxx-native-speaker'))continue;
        const text=paragraph.firstChild;
        if(text?.nodeType!==3)continue;
        const match=speakerPrefix(text.data);if(!match)continue;
        text.splitText(match.end);const label=text.splitText(match.start);
        const span=container.ownerDocument.createElement('span');span.className='cxx-native-speaker';
        label.replaceWith(span);span.append(label);paragraph.classList.add('cxx-native-dialogue');owned.push({paragraph,span});
      }
      // Only explicitly identified auxiliary surfaces. Unknown details are untouched.
      for(const detail of container.querySelectorAll('details')){
        const summary=detail.querySelector(':scope > summary');
        if(!detail.matches('[data-cxx-aux],.konata-thinking-details,.mvu-card,.kz-w')&&!summary?.matches('.k-sum-s'))continue;
        if(folded.has(detail))continue;folded.add(detail);aux.push({detail,open:detail.open,styled:detail.classList.contains('cxx-native-aux')});
        detail.open=false;detail.classList.add('cxx-native-aux');
      }
      fallbackAux();
    }
    refresh();
    return {refresh,destroy(){
      for(const {paragraph,span} of owned){if(span.parentNode)span.replaceWith(...span.childNodes);paragraph.classList.remove('cxx-native-dialogue');paragraph.normalize();}
      for(const {detail,open,styled} of aux){detail.open=open;if(!styled)detail.classList.remove('cxx-native-aux');}
      for(const {detail,summary,body,sync} of wrappers){detail.removeEventListener('toggle',sync);summary.remove();if(detail.parentNode){const parent=detail.parentNode;detail.replaceWith(...body.childNodes);parent.normalize();}}
    }};
  }
  return {speakerPrefix,auxiliaryBlocks,mount};
});
