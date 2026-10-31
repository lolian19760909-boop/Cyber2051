/** DOM contract fixture only; no browser, pixels, live model or player storage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createNativeReader} from '../src/ui/native-reader.mjs';
class Element{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.className='';this.value='';this.scrollTop=0;this.scrollHeight=1000;this.clientHeight=500;this.offsetHeight=48;this.events={};this._text='';}
  get classList(){return {add:(...names)=>{this.className=[...new Set([...this.className.split(' '),...names])].join(' ');}};}
  set textContent(text){this.replaceChildren();this._text=String(text);}get textContent(){return this._text+this.children.map(row=>row.textContent).join('');}
  append(...rows){for(const row of rows){row.remove();row.parentElement=this;this.children.push(row);}}
  replaceChildren(...rows){for(const row of this.children)row.parentElement=null;this.children=[];this._text='';this.append(...rows);}
  remove(){const parent=this.parentElement;if(parent){parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;}}
  insertBefore(row,before){row.remove();row.parentElement=this;const at=before?this.children.indexOf(before):-1;this.children.splice(at<0?this.children.length:at,0,row);}
  replaceWith(row){const parent=this.parentElement;parent.insertBefore(row,this);this.remove();}
  get firstElementChild(){return this.children.find(row=>row.tagName!=='#text')||null;}
  get nextElementSibling(){const rows=this.parentElement?.children||[];return rows[rows.indexOf(this)+1]||null;}
  setAttribute(name,value){this.attributes[name]=value;}
  closest(){return this.scroll||this.parentElement?.closest()||this;}
  querySelectorAll(selector){const match=el=>selector.startsWith('.')?el.className.split(' ').includes(selector.slice(1)):selector.startsWith('[data-paragraph')?el.dataset.paragraph!==undefined&&(!selector.includes('=')||el.dataset.paragraph===selector.match(/="(.*?)"/)[1]):el.tagName===selector;return this.children.flatMap(row=>[...(match(row)?[row]:[]),...row.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  addEventListener(name,fn){this.events[name]=fn;}removeEventListener(name){delete this.events[name];}
  getBoundingClientRect(){return {top:100,bottom:600};}scrollIntoView(){this.scrolled=true;}
}
const doc={createElement:tag=>new Element(tag,doc),createTextNode:text=>{const node=new Element('#text',doc);node._text=text;return node;}},scroll=new Element('main',doc),stage=new Element('div',doc);stage.scroll=scroll;
let frameId=0;const frames=new Map();globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};globalThis.cancelAnimationFrame=id=>frames.delete(id);
const flush=()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn();}};
globalThis.Cxx238Dialogue={portraits:[{id:'test',name:'甲'}],expression:()=> 'neutral'};
let mounts=0,destroys=0;globalThis.CxxNativeProse={mount(){mounts++;return {destroy(){destroys++;}};}};
const parser={parseMessage:raw=>({paragraphs:[{text:raw,speaker:raw.startsWith('「')?null:'甲',characterId:raw.startsWith('「')?null:'test'}],auxiliary:[]})},versions=[];
const reader=createNativeReader({stage,parser,onEdit:()=>{},onDelete:()=>{},onVersion:(...args)=>versions.push(args)});
const nodes=Array.from({length:100},(_,i)=>({nodeId:'node-'+i,parentId:i?'node-'+(i-1):null,message:{raw:'正文 '+i,input:{text:'行动 '+i}}}));
reader.update(nodes);assert.equal(stage.querySelectorAll('.cxx-native-floor').length,40);assert.equal(reader.position().floor,99);
const saved=stage.querySelectorAll('.cxx-native-floor').at(-1),oldParagraph=saved.querySelector('[data-paragraph="0"]'),mounted=mounts;
reader.update([...nodes]);assert.equal(mounts,mounted);assert.equal(saved.querySelector('[data-paragraph="0"]'),oldParagraph);
reader.stream('候选一');reader.stream('候选二');assert.ok(saved.parentElement);assert.equal(stage.querySelectorAll('.cxx-native-candidate').length,1);const candidate=stage.querySelector('.cxx-native-candidate');assert.equal(candidate.querySelector('article').children[0].dataset.cxxBdaStyle,'r4');assert.ok(candidate.textContent.includes('候选二'));reader.finish();assert.ok(candidate.textContent.includes('未保存'));
reader.select(29);assert.equal(reader.position().follow,false);scroll.scrollTop=scroll.scrollHeight-scroll.clientHeight;scroll.events.scroll();flush();assert.equal(reader.position().follow,false);assert.equal(stage.querySelectorAll('button').find(b=>b.textContent==='最新').disabled,false);
const viewing=reader.position().floor,offset=scroll.scrollTop,withNew=[...nodes,{nodeId:'node-100',parentId:'node-99',message:{raw:'正式回复',input:{text:'新行动'}}}];reader.update(withNew);assert.equal(reader.position().floor,viewing);assert.equal(scroll.scrollTop,offset);assert.equal(stage.querySelectorAll('.cxx-native-candidate').length,0);
reader.select(100);assert.equal(reader.position().floor,100);assert.equal(reader.position().follow,true);assert.ok(stage.querySelectorAll('.cxx-native-floor').some(row=>row.dataset.nodeId==='node-100'));
reader.update(withNew,{'node-100':['version-a','node-100']});await stage.querySelectorAll('button').find(b=>b.textContent==='上一版').onclick();assert.deepEqual(versions,[['node-100','version-a']]);
reader.stream('「未署名的台词」');assert.equal(stage.querySelectorAll('.cxx-native-unattributed').length,1);assert.equal(stage.querySelector('.cxx-native-candidate').querySelectorAll('.bda-speaker').length,0);reader.destroy();assert.equal(stage.children.length,0);assert.equal(mounts,destroys);
const report={ok:true,checks:['近期窗口限制首次渲染量，所有旧层可跳转','未变楼层复用 DOM','流式候选不清空正式正文，候选具气泡标记','历史窗口滚到底不会追更或锁住最新按钮','旧层浏览保留位置，新提交清除候选','版本操作绑定当前查看楼层','销毁清理增强器与事件'],scope:'DOM contract fixture; no visual/device acceptance'};
fs.writeFileSync(new URL('../../.cache/player-controls-20261029/native-reader-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
