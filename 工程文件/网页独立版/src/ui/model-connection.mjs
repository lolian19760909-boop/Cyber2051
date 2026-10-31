import {PROVIDER_FIELDS,ENDPOINT_CHOICES,sourceId,connectionDefaults,modelListAvailable} from '../models/connections.mjs';
/** One provider form for its real connection fields; no secrets enter the safe provider object. */
let serial=0;
export function mountModelConnection(form){
 const prefix="provider-"+(++serial)+"-",wrap=input=>input.closest(".field")||input.parentElement;
 const doc=form.ownerDocument,adapter=form.elements.namedItem('adapter'),base=form.elements.namedItem('baseUrl'),model=form.elements.namedItem('model'),key=form.elements.namedItem('apiKey');
 const panel=doc.createElement('div');panel.className='model-provider-fields';wrap(base).before(panel);
 let selected='',values={},savedBase='',fields={};
 function field(id,label,type='text',value='',options){const row=doc.createElement('div');row.className='field';const title=doc.createElement('label');title.textContent=label;title.htmlFor=prefix+id;const input=doc.createElement(options?'select':type==='textarea'?'textarea':'input');input.id=title.htmlFor;input.name=id;input.autocomplete='off';if(input.tagName==='INPUT')input.type=type;if(options)for(const [value,label]of options){const o=doc.createElement('option');o.value=value;o.textContent=label;input.append(o);}input.value=value;row.append(title,input);panel.append(row);fields[id]=input;return input;}
 function render(){
  const id=sourceId(adapter.value),vertex=['vertexai','vertex-ai'].includes(id),azure=['azure_openai','azure-openai'].includes(id),workers=['workers_ai','workersai'].includes(id);panel.replaceChildren();fields={};
  if(vertex){field('authMode','鉴权方式','text',values.authMode||'express',[['express','Express · API Key'],['full','服务账号 JSON']]).addEventListener('change',()=>{values={...values,...read().provider};render();});field('region','地区','text',values.region||'us-central1');if((values.authMode||'express')==='full')field('serviceAccount','Google 服务账号 JSON','textarea',values.serviceAccount||'');else field('projectId','项目 ID（可选）','text',values.projectId||'');}
  if(azure){field('deployment','部署名称','text',values.deployment||model.value);field('apiVersion','API 版本','text',values.apiVersion||'2024-10-21');}
  if(workers)field('accountId','Cloudflare 账户 ID','text',values.accountId||'');
  if(ENDPOINT_CHOICES[id])field('endpoint','服务端点','text',values.endpoint||ENDPOINT_CHOICES[id][0][0],ENDPOINT_CHOICES[id]);
  const full=vertex&&(values.authMode==='full'),connection=form.elements.namedItem('connection');if(connection){for(const option of connection.options)if(option.value==='lan')option.disabled=full;if(full&&connection.value!=='default')connection.value='default';}wrap(key).hidden=full||id==='pollinations'&&(values.endpoint==='anonymous');
  wrap(base).hidden=vertex||workers||Boolean(ENDPOINT_CHOICES[id]);base.placeholder=connectionDefaults(adapter.value,values)||'https://你的服务地址';base.value=savedBase;
  wrap(model).hidden=azure;model.required=!azure;model.placeholder=vertex?'例如 gemini-2.5-pro':azure?'部署中使用的型号':id==='claude'?'例如 claude-sonnet-4-5':id==='makersuite'?'例如 gemini-2.5-pro':id==='deepseek'?'例如 deepseek-chat':'服务商提供的模型 ID';
  if(azure)base.placeholder='https://你的资源.openai.azure.com';
  const list=form.querySelector('#test-models');if(list){list.disabled=!modelListAvailable(adapter.value);list.title=list.disabled?'此服务请手动填写型号或部署名':'';}
  for(const [name,input]of Object.entries(fields))if(name!=='authMode')input.addEventListener('change',()=>{values={...values,...read().provider};if(name==='serviceAccount')values.serviceAccount=input.value;if(name==='endpoint')render();});
 }
 function read(){const provider={};for(const name of PROVIDER_FIELDS)if(fields[name]&&fields[name].value.trim())provider[name]=fields[name].value.trim();return {provider,serviceAccount:fields.serviceAccount?.value||values.serviceAccount||'',baseUrl:wrap(base).hidden?'':base.value.trim(),...(fields.deployment?{model:fields.deployment.value.trim()}:{})};}
 adapter.addEventListener('change',()=>{if(adapter.value===selected)return;selected=adapter.value;values={};savedBase='';render();});
 return {read,sync(settings){selected=adapter.value;values={...(settings.provider||{}),serviceAccount:settings.serviceAccount||''};savedBase=settings.baseUrl||'';render();}};
}
