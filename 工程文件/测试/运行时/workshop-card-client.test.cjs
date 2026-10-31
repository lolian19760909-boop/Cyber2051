'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,"../../卡片源码/运行时/workshop-client.js"),'utf8');
function connected(root,value){if(!root||typeof root!=='object')return;root.isConnected=value;for(const child of root.children||[])connected(child,value);}
function node(tag='div') {return {tag,style:{},children:[],listeners:{},value:'',hidden:false,isConnected:true,textContent:'',append(...items){this.children.push(...items);for(const item of items)connected(item,this.isConnected);},appendChild(item){this.append(item);return item;},replaceChildren(...items){for(const child of this.children)connected(child,false);this.children=[];this.append(...items);},addEventListener(name,fn){this.listeners[name]=fn;},remove(){this.removed=true;connected(this,false);},click(){return this.listeners.click?.();}};}
function descendants(root){return [root,...(root.children||[]).flatMap(child=>typeof child==='object'?descendants(child):[])];}
function fixture({items=[],detail=items[0],signedState={cardId:'cyber2051',instanceId:'test.instance'},token='',draft=null,receiver='immediate',panelOptions={},fetchHook}={}){
 const storage=new Map([['cxx-oauth-token',token]]);if(draft)storage.set('cxx-shop-draft',JSON.stringify(draft));
 const state={detail,book:null,entries:[],creates:0,writes:0,events:[],calls:[],waits:[],panel:null,callbacks:{},stopped:[],pageListeners:{},nativeConfirmCalls:0},body=node(),root=node(),parentBody=node();
 const updatePanel={isConnected:true,hidden:false,getClientRects:()=>[{}],computed:{display:'block',visibility:'visible',opacity:'1'},...panelOptions};
 const parentDocument={body:parentBody,createElement(tag){const n=node(tag);n.ownerDocument=parentDocument;return n;},querySelectorAll(selector){assert.equal(selector,'section[role="dialog"][aria-label="内容更新"]');return state.panel?[state.panel]:[];},defaultView:{getComputedStyle:panel=>panel.computed}};
 const iframeDocument={body,createElement(tag){const n=node(tag);n.ownerDocument=iframeDocument;return n;}};
 const context=vm.createContext({crypto:require('node:crypto').webcrypto,TextEncoder,TextDecoder,Uint8Array,console,
  window:{parent:{document:parentDocument},addEventListener(name,callback){state.pageListeners[name]=callback;}},document:iframeDocument,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},$(){},
  getButtonEvent(name){assert.equal(name,'创意工坊');return 'test-script-workshop-button';},eventOn(name,callback){state.callbacks[name]=callback;return {stop(){state.stopped.push(name);}};},tavern_events:{CHAT_CHANGED:'test-chat-changed'},
  setTimeout(callback,delay){state.waits.push(delay);if(receiver==='delayed'&&state.waits.length===2)state.panel=updatePanel;state.onWait?.();callback();},
  getVariables:option=>{assert.equal(option.type,'character');return signedState?{__cxx_update_state:signedState}:{};},eventEmit:async(...args)=>{state.events.push(args);if(receiver==='immediate')state.panel=updatePanel;},
  getChatWorldbookName:()=>state.book,getWorldbook:async()=>structuredClone(state.entries),
  getOrCreateChatWorldbook:async()=>{state.creates++;return state.book='test-chat-book';},
  updateWorldbookWith:async(name,callback)=>{assert.equal(name,state.book);state.writes++;state.entries=await callback(structuredClone(state.entries));state.entries.forEach((e,i)=>e.uid??=100+i);},
  confirm:()=>{state.nativeConfirmCalls++;return true;},prompt:()=>null,
  fetch:async(url,options={})=>{state.calls.push({url,options});const intercepted=fetchHook?.(url,options);if(intercepted!==undefined)return intercepted;return {ok:true,json:async()=>url.endsWith('/me/submissions')?{ok:true,items}:url.endsWith('/me')?{ok:true,displayName:'合成作者'}:url.endsWith('/submissions')?{ok:true,items}:{ok:true,item:state.detail}};}});
 vm.runInContext(source+'\nglobalThis.client={renderDirectory,renderSubmit,renderMine,installItem,uninstallItem,listInstalled,openSignedPanel,openPanel,init,destroy,loadDraft,setUI(value){ui=value;}};',context);
 const ui={root,status:node(),body:node(),tabsRow:node(),tab:'目录'};context.client.setUI(ui);
 return {client:context.client,state,ui,storage,parentDocument,iframeDocument};
}
const submission=(type,id=1)=>({id,type,title:'合成 '+type,revision:1,status:'approved',summary:'合成材料',payload:{worldFactors:[{title:'条目',content:'静态资料'}]}});
async function withdrawalFixture(options={}){const f=fixture({items:[submission('user_identity',7)],token:'test-synthetic-owner',...options});f.ui.tab='我的';await f.client.renderMine(f.ui.body);return f;}
const action=(f,label)=>descendants(f.ui.body).find(n=>n.textContent===label);
const posts=f=>f.state.calls.filter(c=>c.options.method==='POST');

