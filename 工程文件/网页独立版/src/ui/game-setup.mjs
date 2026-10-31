/** Isolated setup surface. onContinue owns persistence and the existing creation handoff.
 * No storage, model, global preferences or worldbook writes occur in this module.
 * Use the returned draft() when remounting after a return from character creation.
 * Supply verified declarations through createGameSetup(); default contracts are absent.
 */
import {createGameSetup} from '../gameplay/game-setup.mjs';
export const GAME_SETUP_STYLE_URL=new URL('../../web/styles/game-setup.css',import.meta.url).href;

export function mountGameSetup({parent,setup=createGameSetup(),value,onContinue,onCancel,onChange=()=>{},onError=()=>{},styleUrl=GAME_SETUP_STYLE_URL}){
 if(typeof onContinue!=='function')throw new TypeError('游戏选择需要创建角色的接入函数');
 const doc=parent.ownerDocument,catalog=setup.catalog;
 let selection=structuredClone(value??setup.draft()),step=0,busy=false,disposed=false;
 const root=doc.createElement('section');root.className='cxx-game-setup';root.setAttribute('aria-label','新故事设置');root.style.visibility='hidden';root.setAttribute('aria-busy','true');
 const style=doc.createElement('link');style.rel='stylesheet';style.href=styleUrl;
 const ready=new Promise((resolve,reject)=>{style.onload=resolve;style.onerror=()=>reject(new Error('新故事设置样式读取失败，请重新打开。'));}).then(async()=>{
  const art=['frame-action.png','frame-active.png','nav-active.png'].map(name=>{const image=new doc.defaultView.Image();image.src=new URL('../assets/terminal-2x/'+name,style.href).href;return image.decode();});
  await Promise.allSettled([doc.fonts.load('16px CxxSetupLatin'),...art]);
  if(!disposed){root.style.removeProperty('visibility');root.removeAttribute('aria-busy');}
 });ready.catch(onError);root.append(style);
 const form=doc.createElement('form');root.append(form);parent.append(root);
 function node(tag,text,into=form,className=''){const el=doc.createElement(tag);if(text!==null)el.textContent=text;if(className)el.className=className;into.append(el);return el;}
 function control(labelText,type,value,checked,into,onchange){const label=node('label',null,into,'cxx-game-setup-choice'),input=node('input',null,label);input.type=type;input.value=value;input.checked=checked;if(type==='radio')input.name='cxx-game-setup-version';input.onchange=()=>{if(!busy)onchange(input);};const body=node('span',null,label);node('strong',labelText,body);return {input,body};}
 function changed(focusValue){onChange(structuredClone(selection));paint();[...form.querySelectorAll('input')].find(input=>input.value===focusValue)?.focus();}
 function switchCombination(baseVersion,expansions,focusValue){selection=setup.draft({baseVersion,expansions});changed(focusValue);}
 const visibleIssues=()=>setup.inspect(selection,{requireContract:step===1}).issues.filter(issue=>step===1||!issue.code.startsWith('setup_feature'));
 function paint(){
  form.replaceChildren();form.setAttribute('aria-busy',String(busy));
  const nav=node('ol',null,form,'cxx-game-setup-steps');for(const [i,label]of ['游戏版本','本局玩法','创建角色'].entries()){const item=node('li',label,nav);if(i===step)item.setAttribute('aria-current','step');}
  const heading=node('h2',step===0?'选择游戏版本':'选择本局玩法');heading.tabIndex=-1;
  const fields=node('fieldset',null);fields.disabled=busy;node('legend',step===0?'游戏版本与扩充包':'玩法开关',fields);
  if(step===0){
   for(const version of catalog.versions.filter(row=>row.create!==false||row.id===selection.baseVersion))control(version.label||version.id,'radio',version.id,selection.baseVersion===version.id,fields,()=>switchCombination(version.id,[],version.id));
   const available=catalog.expansions.filter(expansion=>catalog.combinations.some(row=>row.baseVersion===selection.baseVersion&&row.expansions.some(pin=>pin.packageId===expansion.packageId&&pin.version===expansion.version)));
   if(available.length){node('h3','扩充包',fields);for(const expansion of available){const checked=selection.expansions?.some(pin=>pin.packageId===expansion.packageId&&pin.version===expansion.version);control((expansion.label||expansion.packageId)+' '+expansion.version,'checkbox',expansion.packageId,checked,fields,input=>{const next=selection.expansions.filter(pin=>pin.packageId!==expansion.packageId);if(input.checked)next.push({packageId:expansion.packageId,version:expansion.version});switchCombination(selection.baseVersion,next,expansion.packageId);});}}
  }else{
   const checked=setup.inspect(selection),features=catalog.features.filter(feature=>checked.combination?.featureIds.includes(feature.id));
   if(!features.length)node('p','本版本暂无额外玩法选项。',fields,'cxx-game-setup-note');
   for(const feature of features){const {input,body}=control(feature.label,'checkbox',feature.id,selection.features?.[feature.id]===true,fields,input=>{selection={...selection,features:{...selection.features,[feature.id]:input.checked}};changed(feature.id);});input.disabled=feature.required===true;if(feature.description)node('span',feature.description,body,'cxx-game-setup-note');if(feature.required)node('span','必需',body,'cxx-game-setup-note');}
  }
  const status=node('div',null,form,'cxx-game-setup-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const issues=visibleIssues();for(const issue of issues)node('p',issue.message,status);
  const actions=node('div',null,form,'cxx-game-setup-actions');
  if(step===1){const back=node('button','上一步',actions);back.type='button';back.disabled=busy;back.onclick=()=>{step=0;paint();form.querySelector('h2').focus();};}
  else if(onCancel){const cancel=node('button','返回',actions);cancel.type='button';cancel.disabled=busy;cancel.onclick=()=>onCancel(structuredClone(selection));}
  const next=node('button',busy?'正在保存…':step===0?'下一步':'创建角色',actions,'cxx-game-setup-primary');next.type='submit';next.disabled=busy||issues.length>0;
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(disposed||busy)return;
  if(step===0){if(visibleIssues().length)return;step=1;paint();form.querySelector('h2').focus();return;}
  let binding;try{binding=setup.bind(selection);}catch(error){onError(error);paint();return;}
  busy=true;paint();
  try{await onContinue(binding,structuredClone(selection));}
  catch(error){if(!disposed){onError(error);busy=false;paint();const status=form.querySelector('[role="status"]');node('p',error.message,status);}}
  // A successful handoff remains locked until its owner destroys or remounts this surface.
 };
 paint();return {ready,draft:()=>structuredClone(selection),destroy(){disposed=true;root.remove();}};
}
