'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');


function mvuFixture({provider='api',settings={请求方式:'依次请求，失败后重试',请求次数:3}}={}){
  let now=0,extra=false,reads=0,inspects=0,writes=0,sends=0,saveLocked=false,next=0,result={status:'success',reason:'已从磁盘核对'};
  const timers=new Map(),events={},context={characterKey:'card',chatId:'chat'},mvu={isDuringExtraAnalysis:()=>extra};
  const doc={activeElement:null,createElement(tag){return {tag,children:[],style:{},textContent:'',listeners:{},isConnected:true,
    append(n){n.parentNode=this;this.children.push(n);},replaceChildren(){this.children=[];},attributes:{},setAttribute(n,v){this.attributes[n]=v;},getAttribute(n){return this.attributes[n]??null;},
    addEventListener(n,f){this.listeners[n]=f;},focus(){doc.activeElement=this;},remove(){this.isConnected=false;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);},
    querySelector(selector){return this.children.find(n=>n.tag===selector)||this.children.map(n=>n.querySelector(selector)).find(Boolean);}};},
    defaultView:{getComputedStyle:()=>({visibility:'visible'}),Event:class{}},querySelector(selector){return selector==='#send_textarea'?input:nativeButton;}};
  doc.body=doc.createElement('body');const input={value:'',dispatchEvent(){}},nativeButton={disabled:false,getClientRects:()=>[{}],click(){sends++;}};
  const record={id:'act',status:'submitted',ticket:{context:{...context},plan:{title:'购买样例'}}};
  const metadata={variables:{__cxx_gameplay_actions:{records:{act:record}}}},messages=[{mes:'saved',is_user:false,variables:[{stat_data:{terminal:{}}}]}];
  const rows=()=>[{chat_metadata:metadata},...messages],full=()=>({payload:{diskJSONL:rows().map(JSON.stringify).join('\n'),messages,header:{chat_metadata:metadata}}});
  const api={SillyTavern:{getContext:()=>({extensionSettings:{mvu_settings:{额外模型解析配置:settings}}})},getCharData:()=>({first_mes:'opening'}),
    tavern_events:{GENERATION_ENDED:'ended',CHAT_CHANGED:'chat'},eventOn(n,f){events[n]=f;},eventRemoveListener(n){delete events[n];},
    getVariables:()=>metadata.variables,updateVariablesWith(fn){writes++;metadata.variables=fn(metadata.variables);}};
  const root={module:{exports:{}},document:doc,fetch(){throw Error('No model/network expected');},crypto:{},Date:class extends Date{static now(){return now;}},
    setTimeout(fn,delay){const id=++next;timers.set(id,{fn,due:now+delay});return id;},clearTimeout(id){timers.delete(id);},
    CxxUpdateBackup:{nativeAdapters:()=>({async readCurrent(){return {jsonl:rows().map(JSON.stringify).join('\n')};}})}};
  if(provider==='api')api.Mvu=mvu;if(provider==='root')root.Mvu=mvu;if(provider==='parent')doc.defaultView.Mvu=mvu;
  vm.runInNewContext(fs.readFileSync(require.resolve("../../卡片源码/运行时/gameplay-host.js"),'utf8'),root);let adapter;
  const host={getContext:()=>({...context}),assertContext(expected){if(expected.characterKey!==context.characterKey||expected.chatId!==context.chatId)throw Object.assign(Error('聊天已切换'),{code:'action-context'});},readState:()=>({registry:{}})};
  const client=root.module.exports.create({api,host,backup:{async captureFull(){reads++;return full();}},getSeed:()=>({}),core:{canonical:JSON.stringify},
    content:{withMigration:s=>s,storyChoices:()=>({starts:[]})},gameplay:{read:()=>({yen:100,enabled:true}),catalogue:()=>({lists:{}})},
    actions:{create(options){adapter=options.host;return {async inspectAll(){inspects++;if(saveLocked)throw Object.assign(Error('尚在保存'),{code:'action-not-saved'});return {act:result};}};}}});
  const walk=n=>[n,...n.children.flatMap(walk)],text=()=>walk(doc.body).map(n=>n.textContent).join('\n');
  async function tick(ms){const until=now+ms;let count=0;while(true){const first=[...timers.entries()].sort((a,b)=>a[1].due-b[1].due)[0];if(!first||first[1].due>until)break;assert.ok(count++<200);now=first[1].due;timers.delete(first[0]);await first[1].fn();}now=until;}
  return {client,api,adapter,context,doc,timers,events,text,tick,setExtra:v=>{extra=v;},setSaveLocked:v=>{saveLocked=v;},setResult:v=>{result=v;},click:label=>walk(doc.body).find(n=>n.textContent===label).listeners.click(),counts:()=>({reads,inspects,writes,sends})};
}

