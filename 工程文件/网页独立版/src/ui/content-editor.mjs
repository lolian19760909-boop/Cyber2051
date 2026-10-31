import {nativeBook,nativeEntries,exportWorldbook,checkedPreset,checkedRegex} from '../app/content-settings.mjs';

export function contentTools(parent,onError){
  const doc=parent.ownerDocument;
  const n=(tag,text,into=parent)=>{const el=doc.createElement(tag);if(text!=null)el.textContent=text;into.append(el);return el;};
  const action=(label,fn,into=parent)=>{const b=n('button',label,into);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(error){onError(error);}finally{b.disabled=false;}};return b;};
  function field(label,value,{type='text',into=parent,choices}={}){const wrap=n('label',label,into),el=n(choices?'select':type==='textarea'?'textarea':'input',null,wrap);el.setAttribute('aria-label',label);if(choices)for(const [id,text]of choices){const option=n('option',text,el);option.value=id;}else if(type!=='textarea')el.type=type;if(type==='checkbox')el.checked=!!value;else el.value=value??'';if(type==='textarea'){el.rows=10;el.spellcheck=false;}return el;}
  function advanced(value,apply,into){const box=n('details',null,into);n('summary','完整 JSON',box);const raw=field('JSON',JSON.stringify(value,null,2),{type:'textarea',into:box});action('应用 JSON',()=>apply(JSON.parse(raw.value)),box);}
  function exportJSON(name,value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=n('a',null);a.href=url;a.download=name+'.json';a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function importJSON(label,apply,into=parent){const input=n('input',null,into);input.type='file';input.accept='.json,application/json';input.hidden=true;action(label,()=>input.click(),into);input.onchange=async()=>{try{if(input.files[0])await apply(JSON.parse(await input.files[0].text()),input.files[0].name.replace(/\.json$/i,''));}catch(error){onError(error);}finally{input.value='';}};}
  return {n,action,field,advanced,exportJSON,importJSON};
}

/** One draft per book: moving among entries retains unsaved edits. */
export function editBooks({parent,session,data,onError,changed}){
  const {n,action,field,advanced,exportJSON,importJSON}=contentTools(parent,onError),books=structuredClone(data.books),bar=n('div',null),area=n('div',null);
  bar.className='cx77-settings-actions';const select=field('世界书','',{into:bar,choices:[]});let book=null,collect=()=>{},entryCollect=()=>{},selectedId=null;
  const note=data.authorNote||{},noteBox=n('details',null);n('summary','作者注释',noteBox);
  const noteOn=field('启用作者注释',note.enabled!==false,{type:'checkbox',into:noteBox}),noteText=field('注释正文',note.content||'',{type:'textarea',into:noteBox}),noteDepth=field('注释深度',note.depth??4,{type:'number',into:noteBox}),noteRole=field('注释角色',note.role||'system',{into:noteBox,choices:[['system','System'],['user','User'],['assistant','Assistant']]}),noteInterval=field('每几条玩家消息插入',note.interval??1,{type:'number',into:noteBox});
  action('保存作者注释',async()=>{await session.saveAuthorNote({...note,content:noteText.value,enabled:noteOn.checked,depth:Number(noteDepth.value),role:noteRole.value,interval:Number(noteInterval.value)});await changed();},noteBox);
  function fill(id){select.replaceChildren();for(const row of books){const option=n('option',(row.enabled===false?'关闭 · ':'')+row.name,select);option.value=row.bookId;}select.value=id||books[0]?.bookId||'';show();}
  function show(){collect();area.replaceChildren();book=books.find(row=>row.bookId===select.value);collect=()=>{};entryCollect=()=>{};if(!book)return;
    const name=field('书名',book.name,{into:area}),enabled=field('启用世界书',book.enabled!==false,{type:'checkbox',into:area}),actions=n('div',null,area);actions.className='cx77-settings-actions';
    const search=field('搜索条目','',{type:'search',into:area}),list=field('条目','',{into:area,choices:[]}),body=n('div',null,area);
    collect=()=>{entryCollect();book.name=name.value;book.enabled=enabled.checked;};
    function fillEntries(){list.replaceChildren();const query=search.value.toLowerCase();for(const row of book.entries){if(query&&!(row.comment+' '+row.content+' '+row.keys.join(' ')).toLowerCase().includes(query))continue;const option=n('option',(row.enabled===false?'关闭 · ':'')+(row.comment||'条目 '+row.id),list);option.value=String(row.id);}if([...list.options].some(row=>row.value===selectedId))list.value=selectedId;paint();}
    function paint(){entryCollect();body.replaceChildren();selectedId=list.value;let entry=book.entries.find(row=>String(row.id)===selectedId);entryCollect=()=>{};if(!entry)return;
      const title=field('标题',entry.comment||'',{into:body}),on=field('启用条目',entry.enabled!==false,{type:'checkbox',into:body}),constant=field('常驻',entry.constant,{type:'checkbox',into:body});
      const keys=field('关键词（每行一个）',entry.keys.join('\n'),{type:'textarea',into:body}),secondary=field('次要关键词（每行一个）',(entry.secondary_keys||[]).join('\n'),{type:'textarea',into:body}),text=field('正文',entry.content,{type:'textarea',into:body});keys.rows=secondary.rows=3;
      const ext=entry.extensions||{},position=field('插入位置',ext.position??(entry.position==='after_char'?1:0),{into:body,choices:[['0','角色定义之前'],['1','角色定义之后'],['2','作者注释之前'],['3','作者注释之后'],['4','聊天深度'],['5','示例之前'],['6','示例之后'],['7','Outlet']]}),depth=field('深度',ext.depth??4,{type:'number',into:body}),role=field('消息角色',ext.role??0,{into:body,choices:[['0','System'],['1','User'],['2','Assistant']]}),order=field('顺序',entry.insertion_order??100,{type:'number',into:body});
      const outlet=field('Outlet 名称',ext.outletName||'',{into:body});outlet.parentElement.hidden=Number(position.value)!==7;position.onchange=()=>{outlet.parentElement.hidden=Number(position.value)!==7;};
      const selective=field('使用次要关键词',entry.selective!==false,{type:'checkbox',into:body}),logic=field('次要词逻辑',ext.selectiveLogic??0,{into:body,choices:[['0','至少一个匹配'],['1','并非全部匹配'],['2','全部不匹配'],['3','全部匹配']]}),regex=field('关键词按正则匹配',entry.use_regex,{type:'checkbox',into:body});
      const probability=field('触发概率 %',ext.useProbability?ext.probability??100:100,{type:'number',into:body}),scan=field('扫描深度（空白继承）',ext.scan_depth??'',{type:'number',into:body}),sensitive=field('区分大小写',ext.case_sensitive,{type:'checkbox',into:body}),whole=field('完整单词',ext.match_whole_words,{type:'checkbox',into:body});
      const activation=n('details',null,body);n('summary','持续与分组',activation);const sticky=field('黏性消息数',ext.sticky??0,{type:'number',into:activation}),cooldown=field('冷却消息数',ext.cooldown??0,{type:'number',into:activation}),delay=field('开局延迟消息数',ext.delay??0,{type:'number',into:activation}),group=field('互斥组（逗号分隔）',ext.group||'',{into:activation}),weight=field('分组权重',ext.group_weight??100,{type:'number',into:activation}),override=field('组内优先',ext.group_override,{type:'checkbox',into:activation}),scoring=field('按关键词命中数筛选',ext.use_group_scoring,{type:'checkbox',into:activation});for(const input of[sticky,cooldown,delay,weight])input.min='0';
      entryCollect=()=>{Object.assign(entry,{comment:title.value,enabled:on.checked,disable:!on.checked,constant:constant.checked,selective:selective.checked,use_regex:regex.checked,keys:keys.value.split('\n').filter(Boolean),secondary_keys:secondary.value.split('\n').filter(Boolean),content:text.value,insertion_order:Number(order.value)});entry.extensions={...ext,position:Number(position.value),depth:Number(depth.value),role:Number(role.value),outletName:outlet.value.trim(),sticky:Number(sticky.value),cooldown:Number(cooldown.value),delay:Number(delay.value),group:group.value.trim(),group_weight:Number(weight.value),group_override:override.checked,use_group_scoring:scoring.checked,selectiveLogic:Number(logic.value),useProbability:Number(probability.value)!==100,probability:Number(probability.value),scan_depth:scan.value===''?null:Number(scan.value),case_sensitive:sensitive.checked,match_whole_words:whole.checked};};
      action('删除条目',()=>{book.entries=book.entries.filter(row=>row!==entry);entryCollect=()=>{};fillEntries();},body);
      advanced(entry,next=>{const checked=nativeEntries([next])[0];if(book.entries.some(row=>row!==entry&&String(row.id)===String(checked.id)))throw Error('条目编号重复');book.entries[book.entries.indexOf(entry)]=checked;selectedId=String(checked.id);entryCollect=()=>{};fillEntries();},body);
    }
    search.oninput=()=>{entryCollect();fillEntries();};list.onchange=paint;
    action('新增条目',()=>{entryCollect();const id=String(Date.now());book.entries.push({id,uid:id,comment:'新条目',content:'',keys:[],secondary_keys:[],enabled:true,constant:false,insertion_order:100,extensions:{}});selectedId=id;entryCollect=()=>{};fillEntries();},actions);
    action('保存世界书',async()=>{collect();const saved=await session.saveWorldbook(book);Object.assign(book,saved);await changed();fill(book.bookId);},actions);
    action('导出',()=>{collect();exportJSON(book.name,exportWorldbook(book));},actions);
    action('删除世界书',async()=>{if(!confirm('从本局移除“'+book.name+'”？'))return;await session.saveWorldbook({...book,enabled:false,entries:[]});book.enabled=false;book.entries=[];await changed();show();},actions);
    fillEntries();
  }
  select.onchange=show;
  action('新建世界书',()=>{collect();const row={bookId:'book-'+Date.now(),name:'新世界书',enabled:true,entries:[]};books.push(row);fill(row.bookId);},bar);
  importJSON('导入世界书',async(raw,name)=>{collect();const row=nativeBook(raw,{bookId:'book-'+Date.now(),name:raw.name||name});books.push(row);await session.saveWorldbook(row);fill(row.bookId);await changed();},bar);
  fill();return {collect,value:()=>{collect();return structuredClone(book);}};
}

export function editPreset({parent,session,data,onError,changed}){
  const {n,action,field,advanced,exportJSON,importJSON}=contentTools(parent,onError);let preset=structuredClone(data.preset),selectedId=null,collect=()=>{};
  function show(){parent.replaceChildren();const name=field('预设名称',preset.name||data.presetId),bar=n('div',null);bar.className='cx77-settings-actions';
    const order=(preset.prompt_order.find(row=>row.character_id===100001)||preset.prompt_order.at(-1)).order,list=field('提示块','',{choices:[]}),body=n('div',null);
    for(const slot of order){const row=preset.prompts.find(p=>p.identifier===slot.identifier);if(row){const option=n('option',(slot.enabled===false?'关闭 · ':'')+(row.name||row.identifier),list);option.value=row.identifier;}}
    for(const row of preset.prompts)if(!order.some(slot=>slot.identifier===row.identifier)){order.push({identifier:row.identifier,enabled:row.enabled!==false});const option=n('option',row.name||row.identifier,list);option.value=row.identifier;}
    if(selectedId)list.value=selectedId;
    function paint(){collect();body.replaceChildren();selectedId=list.value;const row=preset.prompts.find(p=>p.identifier===selectedId),slot=order.find(p=>p.identifier===selectedId);collect=()=>{preset.name=name.value;};if(!row)return;
      const title=field('名称',row.name||row.identifier,{into:body}),enabled=field('启用',slot.enabled!==false,{type:'checkbox',into:body}),role=field('消息角色',row.role||'system',{into:body,choices:[['system','System'],['user','User'],['assistant','Assistant']]}),text=field('提示词',row.content||'',{type:'textarea',into:body}),position=field('插入位置',row.injection_position??0,{into:body,choices:[['0','按提示块顺序'],['1','聊天深度']]}),depth=field('深度',row.injection_depth??4,{type:'number',into:body});
      if(row.marker){text.readOnly=true;text.rows=2;text.placeholder='此标记使用对应的角色／世界书／聊天内容';}
      collect=()=>{preset.name=name.value;Object.assign(row,{name:title.value,role:role.value,content:text.value,injection_position:Number(position.value),injection_depth:Number(depth.value)});slot.enabled=enabled.checked;};
      for(const [label,step]of [['上移',-1],['下移',1]])action(label,()=>{collect();const at=order.indexOf(slot),to=at+step;if(to>=0&&to<order.length){order.splice(at,1);order.splice(to,0,slot);}collect=()=>{};show();},body);
      action('删除提示块',()=>{collect();preset.prompts=preset.prompts.filter(p=>p!==row);for(const group of preset.prompt_order)group.order=group.order.filter(p=>p.identifier!==row.identifier);selectedId=null;collect=()=>{};show();},body);
      advanced(row,next=>{if(next.identifier!==row.identifier)throw Error('请保留提示块编号');Object.assign(row,next);collect=()=>{};show();},body);
    }
    list.onchange=paint;action('新增提示块',()=>{collect();const id='prompt-'+Date.now();preset.prompts.push({identifier:id,name:'新提示块',role:'system',content:'',enabled:true});order.push({identifier:id,enabled:true});selectedId=id;collect=()=>{};show();},bar);
    action('保存预设',async()=>{collect();await session.savePreset(preset);await changed();},bar);action('导出',()=>{collect();exportJSON(preset.name||'preset',preset);},bar);
    importJSON('导入预设',async raw=>{preset=checkedPreset(raw);selectedId=null;collect=()=>{};await session.savePreset(preset,{id:'preset-'+Date.now()});show();await changed();},bar);
    advanced(preset,async next=>{preset=checkedPreset(next);collect=()=>{};selectedId=null;show();},parent);paint();
  }
  show();return {collect,value:()=>{collect();return structuredClone(preset);}};
}

export function editRegex({parent,session,data,onError,changed}){
  const {n,action,field,advanced,exportJSON,importJSON}=contentTools(parent,onError);let rules=structuredClone(data.regex),selected=0,collect=()=>{};
  function show(){parent.replaceChildren();const bar=n('div',null);bar.className='cx77-settings-actions';const list=field('规则','',{choices:[]}),body=n('div',null);
    rules.forEach((row,i)=>{const option=n('option',(row.disabled?'关闭 · ':'')+(row.scriptName||row.name||row.id),list);option.value=String(i);});list.value=String(selected);
    function paint(){collect();selected=Number(list.value)||0;body.replaceChildren();const row=rules[selected];collect=()=>{};if(!row)return;
      const title=field('名称',row.scriptName||row.name||'',{into:body}),enabled=field('启用',!row.disabled,{type:'checkbox',into:body}),find=field('查找正则',row.findRegex,{type:'textarea',into:body}),replacement=field('替换内容',row.replaceString||'',{type:'textarea',into:body}),trim=field('捕获组裁剪（每行一个）',(row.trimStrings||[]).join('\n'),{type:'textarea',into:body});find.rows=3;trim.rows=2;
      const markdown=field('只影响显示',row.markdownOnly,{type:'checkbox',into:body}),prompt=field('只影响提示词',row.promptOnly,{type:'checkbox',into:body}),substitution=field('查找中的宏',row.substituteRegex??0,{into:body,choices:[['0','不替换'],['1','直接替换'],['2','转义后替换']]}),min=field('最小深度',row.minDepth??'',{type:'number',into:body}),max=field('最大深度',row.maxDepth??'',{type:'number',into:body});
      const placements=[[1,'玩家输入'],[2,'模型回复'],[5,'世界书']].map(([id,label])=>[id,field(label,row.placement.includes(id),{type:'checkbox',into:body})]);
      collect=()=>{Object.assign(row,{scriptName:title.value,disabled:!enabled.checked,findRegex:find.value,replaceString:replacement.value,trimStrings:trim.value.split('\n').filter(Boolean),markdownOnly:markdown.checked,promptOnly:prompt.checked,substituteRegex:Number(substitution.value),minDepth:min.value===''?null:Number(min.value),maxDepth:max.value===''?null:Number(max.value),placement:placements.filter(([,el])=>el.checked).map(([id])=>id)});};
      for(const [label,step]of [['上移',-1],['下移',1]])action(label,()=>{collect();const to=selected+step;if(to>=0&&to<rules.length){rules.splice(selected,1);rules.splice(to,0,row);selected=to;}collect=()=>{};show();},body);
      action('删除规则',()=>{rules.splice(selected,1);selected=Math.max(0,selected-1);collect=()=>{};show();},body);
      advanced(row,next=>{rules[selected]=checkedRegex([next])[0];collect=()=>{};show();},body);
    }
    list.onchange=paint;action('新增规则',()=>{collect();rules.push({id:'regex-'+Date.now(),scriptName:'新规则',findRegex:'/(?!)/g',replaceString:'',placement:[2],disabled:false,markdownOnly:true,promptOnly:false});selected=rules.length-1;collect=()=>{};show();},bar);
    action('保存正则',async()=>{collect();await session.saveRegex(rules);await changed();},bar);action('导出',()=>{collect();exportJSON('regex',rules);},bar);
    importJSON('导入正则',async raw=>{collect();rules.push(...checkedRegex(Array.isArray(raw)?raw:[raw]));selected=rules.length-1;collect=()=>{};show();},bar);paint();
  }
  show();return {collect,value:()=>{collect();return structuredClone(rules);}};
}
