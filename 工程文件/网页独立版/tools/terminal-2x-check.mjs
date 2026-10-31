/** Controlled DOM and native source execution. No player data or product browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {prepareTerminal2x} from '../src/ui/terminal-2x.mjs';
const require=createRequire(import.meta.url),acorn=require('acorn'),checks=[];
class Element{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.events={};this.className='';this.value='';this.hidden=false;this._text='';this.style={setProperty:(key,value)=>{this.style[key]=value;}};}
  get classList(){return {add:(...names)=>{this.className=[...new Set([...this.className.split(' '),...names])].join(' ');}};}
  set textContent(text){this.replaceChildren();this._text=String(text);}get textContent(){return this._text+this.children.map(row=>row.textContent).join('');}
  append(...rows){for(const row of rows){row.remove();row.parentElement=this;this.children.push(row);}}
  replaceChildren(...rows){for(const row of this.children)row.parentElement=null;this.children=[];this._text='';this.append(...rows);}
  remove(){const parent=this.parentElement;if(parent){parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;}}
  setAttribute(name,value){this.attributes[name]=String(value);}getAttribute(name){return this.attributes[name];}
  querySelectorAll(selector){const match=el=>selector.startsWith('.')?el.className.split(' ').includes(selector.slice(1)):selector.startsWith('#')?el.id===selector.slice(1):el.tagName===selector;return this.children.flatMap(row=>[...(match(row)?[row]:[]),...row.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}getElementById(id){return this.querySelector('#'+id);}
  addEventListener(name,fn){this.events[name]=fn;}removeEventListener(name){delete this.events[name];}focus(){this.ownerDocument.activeElement=this;}
}
const doc={createElement:tag=>new Element(tag,doc)};doc.head=doc.createElement('head');
const n=(tag,text,where,cls)=>{const el=doc.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;where?.append(el);return el;};
const shadow=n('shadow'),root=n('section',null,shadow);root.id='t2051x-root';
const head=n('header',null,root,'masthead');n('div',null,head,'brand');n('div',null,head,'connection');n('button','收起',head).id='t2051x-close-terminal';n('nav',null,root,'system-nav');n('footer',null,root,'terminal-foot');
globalThis.CxxWebTerminal={};globalThis.CxxTerminalPlayerStyle='ORIGINAL_STYLE';globalThis.CxxEnsembleState=require('../../卡片源码/运行时/ensemble-state.js');
const source=fs.readFileSync(new URL('../../卡片源码/运行时/player-ui.js',import.meta.url),'utf8'),ast=acorn.parse(source,{ecmaVersion:'latest'}),functions=new Map();
const visit=node=>{if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration')functions.set(node.id.name,source.slice(node.start,node.end));for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);};visit(ast);
const priorFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,text:async()=>fs.readFileSync(new URL('../web/terminal-2x.css',import.meta.url),'utf8')});
const session={profile:{name:'测试旅人'},currentState:{terminal:{turn:7,wallet:{yen:2468},gameplay:{growth:{level:12}}}}},before=JSON.stringify(session.currentState),calls=[];
let listener,canLeave=true,unsubscribed=false,guardCalls=0;
const app={page:'city',state:{player:{tab:'人物'}},canLeave:async()=>{guardCalls++;return canLeave;},navigate(page,options){calls.push({page,...options});this.page=page;if(options.tab)this.state.player.tab=options.tab;listener();},subscribe(fn){listener=fn;return()=>{unsubscribed=true;};}};
const chrome=await prepareTerminal2x({shadow,session,theme:()=> 'red'});n('button','LEGACY',root.querySelector('.system-nav'));head.querySelector('.connection').textContent='LEGACY';chrome.install(app);
assert.equal(root.querySelector('#t2051x-close-terminal').parentElement,root.querySelector('.terminal-foot'));assert.equal(root.querySelector('.system-nav').children.length,5);assert.equal(root.querySelector('.cp2-extra').children.length,3);assert.ok(head.textContent.includes('测试旅人'));assert.ok(head.textContent.includes('2,468'));assert.ok(head.textContent.includes('12'));
const equipment=root.querySelector('.system-nav').children[1];await equipment.onclick();assert.deepEqual(calls.at(-1),{page:'characters',tab:'物品栏'});assert.equal(equipment.getAttribute('aria-current'),'true');assert.equal(root.querySelectorAll('button').filter(button=>button.getAttribute('aria-current')==='true').length,1);
canLeave=false;const count=calls.length;await root.querySelector('.system-nav').children[3].onclick();assert.equal(calls.length,count);canLeave=true;const guarded=guardCalls;await root.querySelector('.system-nav').children[0].onclick();assert.equal(guardCalls,guarded);assert.deepEqual(calls.at(-1),{page:'characters',tab:'义体'});
const nav=root.querySelector('.system-nav');nav.events.keydown({key:'ArrowRight',target:equipment,preventDefault(){},stopImmediatePropagation(){}});assert.equal(doc.activeElement,nav.children[2]);
let draftPrompts=0,routeJob;const actualPlayer={subview:null,talent:null,pending:false,itemEditor:null,loadoutDraft:{id:'kept'},shadow,body:root,data:{},activeTab:'物品栏',motion:null,closeDetail(){},remember(){},paint(){app.state.player.tab=actualPlayer.activeTab;},onViewChange(){listener();},top:{CxxDraftExit:{choose:async()=>{draftPrompts++;return 'keep';}}}};vm.createContext(actualPlayer);vm.runInContext(functions.get('canLeave')+'\n'+functions.get('setTab')+'\nglobalThis.playerGuard=canLeave;globalThis.playerSetTab=setTab;',actualPlayer);app.page='characters';app.state.player.tab='物品栏';app.canLeave=actualPlayer.playerGuard;app.navigate=(page,options)=>{app.page=page;routeJob=actualPlayer.playerSetTab(options.tab);};await nav.children[0].onclick();await routeJob;assert.equal(draftPrompts,1);assert.equal(actualPlayer.loadoutDraft.id,'kept');checks.push('实际setTab/canLeave链：保留装配草稿并切页签只询问一次');
assert.equal(JSON.stringify(session.currentState),before);chrome.destroy();assert.ok(unsubscribed);assert.equal(globalThis.CxxTerminalPlayerStyle,'ORIGINAL_STYLE');assert.equal(doc.head.children.length,0);globalThis.fetch=priorFetch;
checks.push('五个主导航与三个附加入口使用原导航API；未保存操作可阻止切页','页签当前态与键盘定位正确；人物等级／钱包来自当前状态','外壳不修改人物数据，销毁还原样式与订阅');


const body=n('main'),selected=n('label','当前武器',body),groups=[],details=[],tabs=[],changes=[];
const os={id:'os',name:'接入仓',category:'cyberware',part:'os'},pistol={id:'pistol',name:'测试手枪',category:'weapon',tier:2};
let definitionReads=0;const game={inventory:Object.fromEntries(Array.from({length:125},(_,i)=>['pistol-'+i,{quantity:2}])),equipment:{}},modelBefore=JSON.stringify(game),L={parts:{os:'操作系统',arms:'臂部',hands:'手掌'},list:()=>[{definition:os,slot:'implant-os'}],get:()=>{definitionReads++;return pistol;}};
const context={body,inventoryMode:'equipment',activeTab:'物品栏',filter:'',category:'',game:()=>game,L,
  el:n,btn:(text,fn,where,cls)=>{const button=n('button',text,where,cls);button.onclick=fn;return button;},
  tile:(definition,where,fn,note)=>{const button=n('button',definition?.name||note,where,'slot');button.onclick=fn;return button;},
  slotGroup:(where,label,slots)=>{groups.push({label,slots});n('section',label,where,'group');},
  scene:(where,left,right)=>{const scene=n('section',null,where,'scene');left(n('aside',null,scene,'groups'));n('figure',null,scene,'human');right(n('aside',null,scene,'groups'));},
  showDetail:(...args)=>details.push(args),setTab:tab=>tabs.push(tab),onViewChange:value=>changes.push(value)
};vm.createContext(context);const actualSlotGroup=vm.runInContext('('+functions.get('slotGroup')+')',context);context.slotGroup=(...args)=>{groups.push({label:args[1],slots:args[2]});return actualSlotGroup(...args);};vm.runInContext(functions.get('inventoryList')+'\n'+functions.get('inventoryLayout2x')+'\ninventoryLayout2x(currentSelect);',Object.assign(context,{currentSelect:selected}));
assert.equal(body.querySelector('.weapons').querySelectorAll('button').length,3);assert.equal(body.querySelector('.inventory'),null);assert.equal(definitionReads,0);const scene=body.querySelector('.scene'),related=body.querySelector('.cp2-related');assert.equal(scene.hidden,false);
await related.children.find(button=>button.textContent==='背包').onclick();const bag=body.querySelector('.inventory');assert.equal(definitionReads,125);assert.equal(bag.hidden,false);assert.equal(scene.hidden,true);assert.equal(changes.at(-1).inventoryMode,'backpack');
await body.querySelector('.cp2-bag-nav').children[0].onclick();assert.ok(bag.hidden);assert.equal(scene.hidden,false);await related.children.find(button=>button.textContent==='背包').onclick();assert.equal(body.querySelector('.inventory'),bag);assert.equal(definitionReads,125);
await related.children.find(button=>button.textContent==='查看义体').onclick();assert.deepEqual(tabs,['义体']);await body.querySelector('.cp2-installed').querySelector('button').onclick();assert.equal(details[0][0],os);assert.equal(details[0][1],'implant-os');
assert.deepEqual(JSON.parse(JSON.stringify(groups.flatMap(group=>group.slots))),['weapon_1','weapon_2','weapon_3','wear_head','wear_face','wear_outer','wear_inner','wear_legs','wear_feet','wear_outfit']);assert.equal(JSON.stringify(game),modelBefore);
assert.ok(!functions.get('scene').includes('Math.ceil(load/100)'));assert.ok(functions.get('scene').includes('总负荷'));
checks.push('125件物品夹具：装备首屏0次背包定义读取，切入后一次建立并复用','装备／背包切换与返回使用真实列表容器，无保存副作用','三个武器槽及七个衣物槽保留，已装义体打开原详情','界面不再臆造义体容量分母');
const report={ok:true,checks,scope:'synthetic DOM/source contracts, no visual or live-host acceptance'};
fs.writeFileSync(new URL('../../.cache/terminal-2x-20261029/ui-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
