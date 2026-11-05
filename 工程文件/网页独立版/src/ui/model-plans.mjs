/** Named model assignments live beside the existing connection form in every creation stage. */
export function mountModelPlans({parent,store,snapshot,apply,available}){
 const node=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;},root=node('section'),heading=node('h3','API 分工方案'),intro=node('p','整套切换正文、解析、记忆等模型和生成参数。密钥按“在此设备记住密钥”的选择保存。');root.className='model-plans';root.setAttribute('aria-label','API 分工方案');
 const field=(text,tag)=>{const label=node('label',text),input=node(tag);input.setAttribute('aria-label',text);label.append(input);root.append(label);return input;};root.append(heading,intro);const select=field('已保存的 API 方案','select'),name=field('API 方案名称','input');name.maxLength=80;const summary=node('p'),actions=node('div'),status=node('p');actions.className='model-plan-actions';status.setAttribute('role','status');root.append(summary,actions,status);parent.append(root);let rows=[],busy=false;
 const chosen=()=>rows.find(row=>row.id===select.value);
 function selection(){const row=chosen();name.value=row?.name||'';summary.textContent=row?[row.configuration.main.model||'正文待填',Object.entries(row.configuration.options.purposes).filter(([,value])=>Object.keys(value).length).length+' 项独立用途',row.configuration.main.rememberKey?'已记住方案密钥':'密钥保留在本次浏览会话'].join(' · '):'当前连接与分工可另存为新方案。';controls();}
 function controls(){for(const b of actions.querySelectorAll('button'))b.disabled=busy||!available();for(const b of [update,load,remove])b.disabled||=!chosen();select.disabled=name.disabled=busy||!available();}
 async function run(work){if(busy)return;busy=true;controls();try{await work();}catch(error){status.textContent=error.message||String(error);}finally{busy=false;controls();}}
 function button(label,work){const b=node('button',label);b.type='button';b.onclick=()=>void run(work);actions.append(b);return b;}
 const save=button('另存 API 方案',()=>{const row=store().save({name:name.value,configuration:snapshot()});refresh(row.id);status.textContent='已保存“'+row.name+'”。';});
 const update=button('更新 API 方案',()=>{const row=store().save({id:chosen().id,name:name.value,configuration:snapshot()});refresh(row.id);status.textContent='已更新“'+row.name+'”。';});
 const load=button('载入 API 方案',async()=>{const row=chosen();await apply(row.configuration);status.textContent='已载入“'+row.name+'”，并用于后续故事。';});
 const remove=button('删除 API 方案',()=>{const row=chosen();store().remove(row.id);refresh();status.textContent='已删除“'+row.name+'”。';});
 function refresh(id=select.value){try{rows=store()?.list()||[];select.replaceChildren(node('option','选择已保存方案'));select.firstElementChild.value='';for(const row of rows){const option=node('option',row.name);option.value=row.id;select.append(option);}select.value=rows.some(row=>row.id===id)?id:'';selection();}catch(error){status.textContent=error.message||String(error);controls();}}
 select.onchange=selection;refresh();return {refresh,destroy(){root.remove();}};
}
